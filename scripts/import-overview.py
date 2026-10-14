#!/usr/bin/env python3
"""
Idempotent import of 「2026 BEST 项目招生总览」 (xlsx) into the CRM.

  python3 scripts/import-overview.py <xlsx> --env prod|dev [--apply]

- 营收总览 → programs.recruit_target / recruit_enrolled (project-level progress, source of truth for the sales tile).
- 项目超级管理 → per-team 招募状态 / seats / 课题海报 / 课程计划 image. Rows are matched to existing teams by
  name (same project); unmatched rows become new teams (id T-OV-…, note 「项目总览导入」). Re-running updates in place.
- Embedded images (xl/media via xl/drawings anchors: col J = 课程计划, col K = 课题海报) are converted to JPEG,
  named by content hash and copied to /opt/nexus/<env>/media (served at /api/media/<name>).
- 项目单价 is NOT read from the sheet (prices are entered in the 项目书); real prices are set via --prices only.
- No course_sessions are created: the sheet's 课表 are images, not structured sessions.
Without --apply it only prints the plan. With --apply it backs up programs/teams/articles on the server first.
"""
import argparse, collections, hashlib, io, json, os, re, subprocess, sys, tempfile, zipfile
from datetime import datetime
import openpyxl
from PIL import Image

PROGRAM_BY_TAG = {'BPA': 'bpa', 'CTB': 'ctb', 'iHOSA': 'ihosa', '康莱德': 'conrad'}
PROGRAM_BY_NAME = [('康莱德', 'conrad'), ('CTB', 'ctb'), ('BPA', 'bpa'), ('iHOSA', 'ihosa'), ('暑假', 'summer'), ('寒假', 'winter'), ('PrimeTeach', 'prime'), ('MVP', 'mvp')]
# Sheet team → CRM team name when the wording differs beyond the automatic rules (reviewed by hand).
ALIASES = {('ihosa', '睡眠'): '晚睡', ('bpa', '鹰眼在线教练'): '鹰眼'}
REAL_PRICES = {'conrad': 35000, 'ctb': 15800, 'bpa': 16800, 'ihosa': 16800}

def sh(cmd, inp=None):
    r = subprocess.run(['ssh', 'nexus', cmd], input=inp, text=True, capture_output=True)
    if r.returncode: sys.exit(f'ssh failed: {cmd}\n{r.stderr}')
    return r.stdout

def psql(db, sql):
    return sh(f'sudo -u postgres psql -d {db} -v ON_ERROR_STOP=1 -At -F "\t"', sql)

def core(s):
    s = re.sub(r'[（(][^）)]*[）)]', '', str(s or ''))
    s = re.sub(r'康莱德创新挑战赛|CBPA|iHOSA|TEAM|Team', '', s)
    return re.sub(r'[「」\s]', '', s).lower()

def tokens(s):
    c = core(s)
    return set(re.findall(r'[\u4e00-\u9fff]{2,}', c)) | {w for w in re.findall(r'[a-z]{3,}', c)}

def q(v):
    return 'NULL' if v is None else "'" + str(v).replace("'", "''") + "'"

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('xlsx'); ap.add_argument('--env', required=True, choices=['prod', 'dev'])
    ap.add_argument('--apply', action='store_true'); ap.add_argument('--prices', action='store_true', help='set the four confirmed real 项目参考价')
    a = ap.parse_args(); db = 'nexus_' + a.env
    wb = openpyxl.load_workbook(a.xlsx, read_only=True, data_only=True)
    sheets = {}
    for ws in wb.worksheets:
        ws.reset_dimensions(); sheets[ws.title] = [list(r) for r in ws.iter_rows(values_only=True)]
    team_rows, rev_rows = sheets['项目超级管理'], sheets['营收总览']
    print('sheets:', list(sheets), '| 项目超级管理 columns:', team_rows[0], '| rows:', len(team_rows) - 1)

    # --- images: anchors → (sheet row, column) ---
    z = zipfile.ZipFile(a.xlsx)
    drawing = z.read('xl/drawings/drawing1.xml').decode()
    rels = dict(re.findall(r'Id="(rId\d+)" Target="\.\./media/([^"]+)"', z.read('xl/drawings/_rels/drawing1.xml.rels').decode()))
    anchors = re.findall(r'<xdr:from><xdr:col>(\d+)</xdr:col>.*?<xdr:row>(\d+)</xdr:row>.*?r:embed="(rId\d+)"', drawing, re.S)
    out_dir = os.path.join(tempfile.gettempdir(), 'overview-media'); os.makedirs(out_dir, exist_ok=True)
    converted = {}
    def media(fname):
        if fname in converted: return converted[fname]
        raw = z.read('xl/media/' + fname)
        im = Image.open(io.BytesIO(raw))
        if im.mode in ('RGBA', 'LA', 'P'):
            bg = Image.new('RGB', im.size, 'white'); im = im.convert('RGBA'); bg.paste(im, mask=im.split()[-1]); im = bg
        else: im = im.convert('RGB')
        im.thumbnail((1800, 2600))
        buf = io.BytesIO(); im.save(buf, 'JPEG', quality=84, optimize=True, progressive=True)
        name = 'ov-' + hashlib.sha1(raw).hexdigest()[:20] + '.jpg'
        with open(os.path.join(out_dir, name), 'wb') as f: f.write(buf.getvalue())
        converted[fname] = '/api/media/' + name
        return converted[fname]
    cell_img = {}
    for col, row, rid in anchors:
        cell_img[(int(row) + 1, int(col))] = media(rels[rid])

    # --- CRM teams ---
    crm = [l.split('\t') for l in psql(db, "select t.id, t.program, t.name, (select count(*) from courses c where c.team=t.id) from teams t order by t.id;").strip().split('\n') if l]
    used, plan, skipped = set(), [], []
    # project default seat count = most common remaining among untouched (progress 0) rows
    mode_cap = {}
    for p in set(PROGRAM_BY_TAG.values()):
        vals = [int(r[6]) for r in team_rows[1:] if PROGRAM_BY_TAG.get(r[0]) == p and (r[5] or 0) == 0 and r[6]]
        mode_cap[p] = collections.Counter(vals).most_common(1)[0][0] if vals else None
    notes = []
    for i, r in enumerate(team_rows[1:], 2):
        tag, name, _, _, status, prog, rem = r[:7]
        program = PROGRAM_BY_TAG.get(tag)
        if not program or not name: skipped.append((i, name, 'unknown project tag')); continue
        prog = float(prog or 0); rem = int(rem or 0)
        if 0 < prog < 1: cap = round(rem / (1 - prog)); enrolled = cap - rem
        elif prog == 0: cap, enrolled = rem, 0
        else:
            cap = mode_cap.get(program) or rem or None; enrolled = cap; 
            if rem: notes.append(f'row {i} {name}: 招募进度 100% but 剩余名额 {rem} → treated as full ({enrolled}/{cap})')
            rem = 0
        c = core(name); alias = next((v for (p, k), v in ALIASES.items() if p == program and k in c), None)
        cands = [t for t in crm if t[1] == program and t[0] not in used and (core(t[2]) == c or (alias and alias in core(t[2])))]
        if not cands: cands = [t for t in crm if t[1] == program and t[0] not in used and tokens(name) & tokens(t[2])]
        if not cands: cands = [t for t in crm if t[1] == program and t[0] not in used and len(core(t[2])) >= 2 and (core(t[2]) in c or c in core(t[2]))]
        if len(cands) > 1:
            notes.append(f'row {i} {name}: {len(cands)} CRM candidates {[x[0]+" "+x[2] for x in cands]} → picked the one with courses')
            cands.sort(key=lambda t: -int(t[3]))
        team = cands[0] if cands else None
        tid = team[0] if team else 'T-OV-' + hashlib.md5((program + c).encode()).hexdigest()[:8].upper()
        if team: used.add(tid)
        plan.append(dict(row=i, program=program, sheet=name, id=tid, new=not team, crm=team[2] if team else None, status=status, cap=cap, enrolled=enrolled, rem=rem,
                         coach=(r[12] or '').strip(), poster=cell_img.get((i, 10)), schedule=cell_img.get((i, 9)), ref=(r[8] or '').strip()))
    progs = []
    for r in rev_rows[1:]:
        pid = next((v for k, v in PROGRAM_BY_NAME if k in str(r[0])), None)
        if not pid: skipped.append(('营收总览', r[0], 'no CRM project')); continue
        progs.append(dict(id=pid, name=r[0], target=int(r[3]), enrolled=int(r[7]), sheet_price=r[2]))

    print(f'teams: {sum(1 for p in plan if not p["new"])} matched, {sum(1 for p in plan if p["new"])} new; posters {sum(1 for p in plan if p["poster"])}, schedules {sum(1 for p in plan if p["schedule"])}; images {len(converted)}')
    for p in plan: print(f'  r{p["row"]:>2} {p["program"]:<6} {p["sheet"][:28]:<30} -> {p["id"]} {"NEW" if p["new"] else p["crm"]} | {p["status"]} {p["enrolled"]}/{p["cap"]} rem {p["rem"]}')
    for n in notes: print('NOTE', n)
    for s in skipped: print('SKIP', s)
    for p in progs: print(f'  project {p["id"]}: target {p["target"]} enrolled {p["enrolled"]} (sheet price {p["sheet_price"]}, not applied from sheet)')
    if not a.apply: return

    ts = datetime.now().strftime('%Y%m%d%H%M%S')
    bk = f'/opt/nexus/backups/overview_{a.env}_{ts}.sql'
    sh(f'mkdir -p /opt/nexus/backups && sudo -u postgres pg_dump -d {db} --data-only -t programs -t teams -t articles > {bk} && ls -la {bk}')
    print('backup', bk)
    sh(f'mkdir -p /opt/nexus/{a.env}/media')
    subprocess.run(['rsync', '-a', '--ignore-existing', out_dir + '/', f'nexus:/opt/nexus/{a.env}/media/'], check=True)
    sh(f'chmod -R a+rX /opt/nexus/{a.env}/media && ls /opt/nexus/{a.env}/media | wc -l')
    stmts = ['BEGIN;']
    for p in plan:
        if p['new']:
            stmts.append(f"INSERT INTO teams (id, name, program, teacher, stage, status, note, sort_order) VALUES ({q(p['id'])}, {q(re.sub(r'^(CBPA|iHOSA|康莱德创新挑战赛)\s*', '', p['sheet']).strip())}, {q(p['program'])}, {q(p['coach'])}, 0, '正常进行', '项目总览导入', 900) ON CONFLICT (id) DO NOTHING;")
        stmts.append(f"UPDATE teams SET recruit_status={q(p['status'])}, recruit_capacity={p['cap'] if p['cap'] is not None else 'NULL'}, recruit_enrolled={p['enrolled'] if p['enrolled'] is not None else 'NULL'}, recruit_remaining={p['rem']}, poster_url={q(p['poster'])}, schedule_url={q(p['schedule'])}, sheet_ref={q(p['ref'] or None)} WHERE id={q(p['id'])};")
    for p in progs:
        stmts.append(f"UPDATE programs SET recruit_target={p['target']}, recruit_enrolled={p['enrolled']}, recruit_source='2026 BEST 项目招生总览 · 营收总览' WHERE id={q(p['id'])};")
    if a.prices:
        for pid, fee in REAL_PRICES.items():
            val = f'¥{fee:,} / 人'
            for col in ('published', 'draft'):
                stmts.append(f"""UPDATE articles SET {col} = jsonb_set({col}, '{{blocks}}', (SELECT jsonb_agg(CASE WHEN b->>'type'='highlight' AND b->>'kind'='price' THEN jsonb_set(b, '{{items}}', (SELECT jsonb_agg(CASE WHEN it->>'label' ~ '参考价|单价' THEN jsonb_set(it, '{{value}}', to_jsonb({q(val)}::text)) ELSE it END ORDER BY o2) FROM jsonb_array_elements(b->'items') WITH ORDINALITY x2(it, o2))) ELSE b END ORDER BY o) FROM jsonb_array_elements({col}->'blocks') WITH ORDINALITY x(b, o))) WHERE program={q(pid)} AND {col} IS NOT NULL AND jsonb_typeof({col}->'blocks')='array';""")
    stmts.append('COMMIT;')
    print(psql(db, '\n'.join(stmts)).strip().replace('\n', ' '))

if __name__ == '__main__':
    main()
