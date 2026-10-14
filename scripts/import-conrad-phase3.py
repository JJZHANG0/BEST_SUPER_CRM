#!/usr/bin/env python3
"""
Import Conrad (康莱德) 第三阶段 courses from the team timetable Excel into BEST_SUPER_CRM.

Creates (per team with phase-3 rows):
  1. ops_courses row WS2026017-3-N if missing (binds 课程编号)
  2. one timetable courses row + N course_sessions (manual slots)

Usage:
  python3 scripts/import-conrad-phase3.py /path/to.xlsx          # dry-run
  python3 scripts/import-conrad-phase3.py /path/to.xlsx --apply  # write prod via ssh nexus

Reads sheets with pandas engine=calamine. Skips sheets with ( / （, 湖州课表, and 不用.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
import sys
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import pandas as pd

PROJECT_ID = "P-WS2026017"
PROJECT_CODE = "WS2026017"
PROGRAM = "conrad"
CLASS_TYPE = "CT02"  # 线上3-5人班型 — phase3 meetings are 线上
OPS_STATUS = "进行中"
COURSE_STATUS = "已安排"
LOCATION = "线上"
TIME_SEP = "–"  # en-dash, matches UI

# Sheet short name → ops TEAM keyword (as used in ops_courses.name)
SHEET_TO_OPS_KEY = {
    "加密": "目镜",
    "舱外": "EVA",  # ops: TEAM EVA 工具
    "魔术墙": "魔术墙",
    "听障": "听障",
}

SKIP_SHEETS_EXACT = {"湖州课表"}
SKIP_SHEET_SUBSTR = ("不用",)


def should_skip_sheet(name: str) -> tuple[bool, str | None]:
    if "(" in name or "（" in name:
        return True, "parentheses"
    if name in SKIP_SHEETS_EXACT:
        return True, "non-team"
    for s in SKIP_SHEET_SUBSTR:
        if s in name:
            return True, f"marked-{s}"
    return False, None


def parse_time_range(s) -> tuple[str | None, str | None]:
    if s is None or (isinstance(s, float) and math.isnan(s)):
        return None, None
    t = str(s).strip().replace("—", "-").replace("–", "-").replace("～", "-").replace("~", "-")
    m = re.match(r"(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})", t)
    if not m:
        return None, None
    return f"{int(m.group(1)):02d}:{m.group(2)}", f"{int(m.group(3)):02d}:{m.group(4)}"


def parse_date(s, default_year=2026) -> tuple[str | None, str | None]:
    """Return (YYYY-MM-DD, note). Fixes Excel serial year typo 2025→2026 for Nov phase3."""
    if s is None or (isinstance(s, float) and math.isnan(s)):
        return None, None
    if hasattr(s, "strftime"):
        y, mo, d = s.year, s.month, s.day
        note = None
        if y == 2025 and mo >= 10:
            y = 2026
            note = "fixed-year-2025→2026"
        return f"{y}-{mo:02d}-{d:02d}", note
    raw = str(s).strip()
    m = re.search(r"(20\d{2})[/\-](\d{1,2})[/\-](\d{1,2})", raw)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        note = None
        if y == 2025 and mo >= 10:
            y = 2026
            note = "fixed-year-2025→2026"
        return f"{y}-{mo:02d}-{d:02d}", note
    m = re.search(r"(\d{1,2})\s*月\s*(\d{1,2})\s*日", raw)
    if m:
        return f"{default_year}-{int(m.group(1)):02d}-{int(m.group(2)):02d}", None
    return None, None


def normalize_form(s) -> str | None:
    if s is None or (isinstance(s, float) and math.isnan(s)):
        return None
    fs = str(s).strip()
    if "线上" in fs:
        return "线上"
    if "线下" in fs:
        return "线下"
    return fs


def strip_team_decor(name: str) -> str:
    n = name.strip()
    n = re.sub(r"^TEAM\s*", "", n, flags=re.I)
    n = n.replace("「", "").replace("」", "").replace(""", "").replace(""", "")
    return re.sub(r"\s+", "", n)


def parse_excel(path: str) -> dict:
    xlsx = pd.ExcelFile(path, engine="calamine")
    sessions = []
    skipped = []
    imported = []
    sheet_meta = []

    for sheet in xlsx.sheet_names:
        skip, reason = should_skip_sheet(sheet)
        if skip:
            skipped.append({"sheet": sheet, "reason": reason})
            continue
        df = pd.read_excel(xlsx, sheet_name=sheet, header=None, engine="calamine")
        phase3_row = None
        for i in range(len(df)):
            vals = [str(v) if not pd.isna(v) else "" for v in df.iloc[i].tolist()]
            if any("第三阶段" in v for v in vals):
                phase3_row = i
                break
        if phase3_row is None:
            skipped.append({"sheet": sheet, "reason": "no-第三阶段"})
            continue

        header_row = None
        for i in range(phase3_row, min(phase3_row + 5, len(df))):
            vals = [str(v) if not pd.isna(v) else "" for v in df.iloc[i].tolist()]
            has_dateish = any(("日期" in v) or (v == "课次") for v in vals)
            has_timeish = any(("时间" in v) or ("时长" in v) or ("上课" in v) for v in vals)
            if has_dateish and has_timeish:
                header_row = i
                break
        if header_row is None:
            skipped.append({"sheet": sheet, "reason": "no-header-after-phase3"})
            continue

        headers = [str(v).strip() if not pd.isna(v) else f"col{j}" for j, v in enumerate(df.iloc[header_row].tolist())]
        col_date = next((j for j, h in enumerate(headers) if "日期" in h or h == "课次"), 1)
        col_time = next((j for j, h in enumerate(headers) if "时间" in h or "时长" in h or "上课" in h), 2)
        col_form = next((j for j, h in enumerate(headers) if "形式" in h), 3)
        col_content = next((j for j, h in enumerate(headers) if "内容" in h or ("课程" in h and "时长" not in h)), 4)

        team_short = sheet.replace("Team ", "").strip()
        phase_title = None
        for v in df.iloc[phase3_row].tolist():
            if pd.isna(v):
                continue
            vs = str(v).strip()
            if vs and "第三阶段" not in vs:
                phase_title = vs
                break

        rows = []
        for i in range(header_row + 1, len(df)):
            row = df.iloc[i].tolist()
            joined = " ".join(str(v) if not pd.isna(v) else "" for v in row)
            if any(x in joined for x in ("第一阶段", "第二阶段", "第四阶段")):
                break
            date_raw = row[col_date] if col_date < len(row) else None
            time_raw = row[col_time] if col_time < len(row) else None
            form_raw = row[col_form] if col_form < len(row) else None
            content_raw = row[col_content] if col_content < len(row) else None
            date, note = parse_date(date_raw)
            if not date:
                continue
            start, end = parse_time_range(time_raw)
            content = None if content_raw is None or (isinstance(content_raw, float) and math.isnan(content_raw)) else str(content_raw).strip()
            if not content or not start or not end:
                continue
            rows.append({
                "team": team_short,
                "sheet": sheet,
                "date": date,
                "start": start,
                "end": end,
                "form": normalize_form(form_raw) or "线上",
                "title": content,
                "note": note,
            })

        if not rows:
            skipped.append({"sheet": sheet, "reason": "phase3-empty"})
            continue
        imported.append(sheet)
        sessions.extend(rows)
        sheet_meta.append({"sheet": sheet, "team": team_short, "count": len(rows), "phase_title": phase_title})

    return {"sessions": sessions, "skipped": skipped, "imported_sheets": imported, "sheet_meta": sheet_meta}


def psql(sql: str, tuples: bool = False) -> str:
    flag = "-tA" if tuples else "-c"
    cmd = [
        "ssh", "-i", os.path.expanduser("~/.ssh/nexus_deploy"),
        "-o", "StrictHostKeyChecking=accept-new",
        "nexus",
        f'set -a; source /opt/nexus/prod/.env; set +a; psql "$DATABASE_URL" {flag} ' + json.dumps(sql),
    ]
    # Use bash -c on remote for proper quoting
    remote = f"set -a; source /opt/nexus/prod/.env; set +a; psql \"$DATABASE_URL\" {'-tA' if tuples else ''} -v ON_ERROR_STOP=1 -c {json.dumps(sql)}"
    r = subprocess.run(
        ["ssh", "-i", os.path.expanduser("~/.ssh/nexus_deploy"), "-o", "StrictHostKeyChecking=accept-new", "nexus", remote],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise RuntimeError(f"psql failed:\n{r.stderr}\n{r.stdout}")
    return r.stdout


def psql_copy(query: str) -> list[dict]:
    """Run COPY (query) TO STDOUT WITH CSV HEADER and parse."""
    sql = f"COPY ({query}) TO STDOUT WITH CSV HEADER"
    remote = f"set -a; source /opt/nexus/prod/.env; set +a; psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1 -c {json.dumps(sql)}"
    r = subprocess.run(
        ["ssh", "-i", os.path.expanduser("~/.ssh/nexus_deploy"), "-o", "StrictHostKeyChecking=accept-new", "nexus", remote],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise RuntimeError(f"psql COPY failed:\n{r.stderr}\n{r.stdout}")
    import csv
    from io import StringIO
    rows = list(csv.DictReader(StringIO(r.stdout)))
    return rows


def extract_category_and_team(ops_name: str) -> tuple[str | None, str | None]:
    """From '康莱德 「健康」TEAM 水界 第一阶段' → ('健康', '水界')."""
    m = re.search(r"[「\"]([^」\"]+)[」\"]\s*TEAM\s+(.+?)\s+(第一阶段|第二阶段|第三阶段)", ops_name)
    if m:
        return m.group(1), m.group(2).strip()
    m = re.search(r"TEAM\s+(.+?)\s+(第一阶段|第二阶段|第三阶段)", ops_name)
    if m:
        return None, m.group(1).strip()
    return None, None


def team_key_from_ops_name(ops_name: str) -> str:
    _, team = extract_category_and_team(ops_name)
    if not team:
        return ""
    # normalize: drop App / Helios / 工具 suffixes lightly for matching
    k = strip_team_decor(team)
    # EVA工具 / EVA 工具 → EVA
    if k.startswith("EVA"):
        return "EVA"
    if k.startswith("魔术"):
        return "魔术墙"
    if "目镜" in k:
        return "目镜"
    if "听障" in k:
        return "听障"
    # 心识 App → 心识
    k = re.sub(r"App$", "", k, flags=re.I)
    k = re.sub(r"Helios$", "", k, flags=re.I)
    return k


def sheet_ops_key(sheet_team: str) -> str:
    return SHEET_TO_OPS_KEY.get(sheet_team, sheet_team)


def minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def overlaps(a_start, a_end, b_start, b_end) -> bool:
    return minutes(a_start) < minutes(b_end) and minutes(b_start) < minutes(a_end)


def sql_str(v: str | None) -> str:
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("xlsx")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--report", default="/workspace/conrad_phase3_import_report.json")
    args = ap.parse_args()

    parsed = parse_excel(args.xlsx)
    sessions = parsed["sessions"]
    by_team: dict[str, list] = defaultdict(list)
    for s in sessions:
        by_team[s["team"]].append(s)

    # --- load prod ---
    teams = psql_copy("SELECT id, name, teacher FROM teams WHERE program = 'conrad'")
    ops = psql_copy(
        "SELECT id, code, name, status, class_type, teacher, ops_teacher, start_date, end_date "
        "FROM ops_courses WHERE code LIKE 'WS2026017-%'"
    )
    existing_courses = psql_copy(
        "SELECT id, name, team, teacher, date, time, status, code, location FROM courses WHERE program = 'conrad'"
    )
    existing_sessions = psql_copy(
        "SELECT cs.id, cs.course_id, cs.date, cs.start_time, cs.end_time "
        "FROM course_sessions cs JOIN courses c ON c.id = cs.course_id WHERE c.program = 'conrad'"
    ) if existing_courses else []

    # index teams by stripped name
    team_by_key: dict[str, dict] = {}
    for t in teams:
        k = strip_team_decor(t["name"])
        # prefer 「quoted」 variant over plain when duplicate (埙)
        if k not in team_by_key or "「" in t["name"]:
            team_by_key[k] = t
    # aliases
    if "魔术" in team_by_key and "魔术墙" not in team_by_key:
        team_by_key["魔术墙"] = team_by_key["魔术"]
    if "目镜" in team_by_key:
        team_by_key["加密"] = team_by_key["目镜"]
    if "舱外" in team_by_key:
        team_by_key["EVA"] = team_by_key["舱外"]

    # ops courses by phase + team key
    phase1: dict[str, dict] = {}
    phase2: dict[str, dict] = {}
    phase3: dict[str, dict] = {}
    for o in ops:
        code = o["code"]
        tk = team_key_from_ops_name(o["name"])
        if not tk:
            continue
        if re.match(r"WS2026017-1-\d+", code):
            # prefer non -2 suffix duplicates? keep first unless more specific
            if tk not in phase1 or code.count("-") == 2:
                phase1[tk] = o
        elif re.match(r"WS2026017-2-\d+$", code) and "TEAM" in o["name"]:
            phase2[tk] = o
        elif re.match(r"WS2026017-3-\d+$", code):
            phase3[tk] = o

    # also map 轻腕 etc
    phase3_by_code = {o["code"]: o for o in ops if re.match(r"WS2026017-3-\d+$", o["code"])}

    # next phase3 suffix
    used_suffixes = []
    for o in ops:
        m = re.match(r"WS2026017-3-(\d+)$", o["code"])
        if m:
            used_suffixes.append(int(m.group(1)))
    next_suffix = max(used_suffixes) + 1 if used_suffixes else 1

    # existing timetable by code
    course_by_code = {c["code"]: c for c in existing_courses if c.get("code")}

    plan_ops = []
    plan_courses = []
    unmatched = []
    notes = []
    conflicts = []

    # stable order: excel sheet order
    team_order = []
    for meta in parsed["sheet_meta"]:
        team_order.append(meta["team"])

    for team_short in team_order:
        rows = sorted(by_team[team_short], key=lambda x: (x["date"], x["start"]))
        ops_key = sheet_ops_key(team_short)
        team_row = team_by_key.get(ops_key) or team_by_key.get(team_short) or team_by_key.get(strip_team_decor(team_short))
        if not team_row:
            # try fuzzy: any team key containing
            for k, t in team_by_key.items():
                if team_short in k or k in team_short or ops_key in k:
                    team_row = t
                    break
        if not team_row:
            unmatched.append({"team": team_short, "reason": "no-team-row"})
            continue

        ref = phase2.get(ops_key) or phase2.get(team_short) or phase1.get(ops_key) or phase1.get(team_short)
        # special: 舱外 ↔ EVA
        if not ref and ops_key == "EVA":
            ref = phase2.get("EVA") or phase1.get("EVA")
        if not ref and team_short == "魔术墙":
            ref = phase2.get("魔术墙") or phase1.get("魔术墙")
        if not ref and team_short == "加密":
            ref = phase2.get("目镜") or phase1.get("目镜")

        existing_p3 = phase3.get(ops_key) or phase3.get(team_short)
        if team_short == "加密":
            existing_p3 = existing_p3 or phase3.get("目镜")
        if team_short == "舱外":
            existing_p3 = existing_p3 or phase3.get("EVA")
        if team_short == "魔术墙":
            existing_p3 = existing_p3 or phase3.get("魔术墙")

        cat = None
        display_team = team_short
        if ref:
            cat, tname = extract_category_and_team(ref["name"])
            if tname:
                # keep ops display team name (e.g. 目镜, EVA 工具, 心识 App)
                display_team = tname
        if not cat and ref:
            cat = extract_category_and_team(ref["name"])[0]
        if not cat:
            cat = "康莱德"

        teacher = (team_row.get("teacher") or "").strip()
        if not teacher or teacher == "待分配":
            teacher = (ref or {}).get("teacher") or ""
        ops_teacher = (ref or {}).get("ops_teacher") or ""
        class_type = CLASS_TYPE

        if existing_p3:
            ops_code = existing_p3["code"]
            ops_id = existing_p3["id"]
            ops_action = "reuse"
            ops_name = existing_p3["name"]
            # fill teacher if blank on existing
            if not (existing_p3.get("teacher") or "").strip() and teacher:
                plan_ops.append({
                    "action": "update_teacher",
                    "id": ops_id,
                    "code": ops_code,
                    "teacher": teacher,
                    "ops_teacher": ops_teacher or existing_p3.get("ops_teacher") or "",
                    "start_date": rows[0]["date"],
                    "end_date": rows[-1]["date"],
                    "status": OPS_STATUS,
                })
        else:
            ops_code = f"WS2026017-3-{next_suffix}"
            next_suffix += 1
            ops_id = "OC-" + ops_code
            ops_name = f"康莱德 「{cat}」TEAM {display_team} 第三阶段"
            ops_action = "create"
            plan_ops.append({
                "action": "create",
                "id": ops_id,
                "code": ops_code,
                "project": PROJECT_ID,
                "name": ops_name,
                "status": OPS_STATUS,
                "class_type": class_type,
                "teacher": teacher,
                "ops_teacher": ops_teacher,
                "start_date": rows[0]["date"],
                "end_date": rows[-1]["date"],
            })

        # dedupe: if timetable course with same code exists, skip create / maybe add missing sessions
        existing_c = course_by_code.get(ops_code)
        if existing_c:
            plan_courses.append({
                "action": "skip-exists",
                "team": team_short,
                "team_id": team_row["id"],
                "code": ops_code,
                "course_id": existing_c["id"],
                "sessions": rows,
                "reason": "timetable-course-already-has-code",
            })
            continue

        # also skip if any course for same team has overlapping first session datetime
        dup = False
        for c in existing_courses:
            if c["team"] == team_row["id"] and c["date"] == rows[0]["date"] and c["time"].startswith(rows[0]["start"]):
                plan_courses.append({
                    "action": "skip-exists",
                    "team": team_short,
                    "team_id": team_row["id"],
                    "code": ops_code,
                    "course_id": c["id"],
                    "sessions": rows,
                    "reason": "same-team-datetime",
                })
                dup = True
                break
        if dup:
            continue

        course_id = f"C{int(time.time() * 1000) + len(plan_courses)}"
        # ensure unique ids with small sleep offset
        sess_records = []
        for i, r in enumerate(rows):
            sid = f"CS-{int(time.time()):x}-{i:02d}{len(plan_courses):02d}{i}"
            # better uniqueness
            sid = f"CS-p3-{ops_code.split('-')[-1]}-{r['date'].replace('-','')}-{r['start'].replace(':','')}"
            sess_records.append({
                "id": sid,
                "course": course_id,
                "date": r["date"],
                "start": r["start"],
                "end": r["end"],
                "location": LOCATION,
                "title": r["title"],
                "sort_order": i,
            })

        first = rows[0]
        plan_courses.append({
            "action": "create",
            "team": team_short,
            "team_id": team_row["id"],
            "team_name": team_row["name"],
            "ops_action": ops_action,
            "code": ops_code,
            "ops_name": ops_name if ops_action == "create" else (existing_p3 or {}).get("name", ops_name),
            "course_id": course_id,
            "name": ops_name if ops_action == "create" else (existing_p3["name"] if existing_p3 else f"康莱德 TEAM {team_short} 第三阶段"),
            "teacher": teacher,
            "ops_teacher": ops_teacher,
            "date": first["date"],
            "time": f"{first['start']}{TIME_SEP}{first['end']}",
            "location": LOCATION,
            "status": COURSE_STATUS,
            "sessions": sess_records,
            "notes": [r["note"] for r in rows if r.get("note")],
        })

    # fix accidental bug in plan_ops create status
    for p in plan_ops:
        if p.get("status") is True or p.get("status") is False:
            p["status"] = OPS_STATUS
        if "status" in p and not isinstance(p["status"], str):
            p["status"] = OPS_STATUS

    # detect teacher conflicts within planned creates
    planned_occ = []
    for pc in plan_courses:
        if pc["action"] != "create":
            continue
        for s in pc["sessions"]:
            planned_occ.append({
                "course_id": pc["course_id"],
                "team": pc["team"],
                "teacher": pc["teacher"],
                "code": pc["code"],
                "date": s["date"],
                "start": s["start"],
                "end": s["end"],
            })
    conflict_course_ids = set()
    for i, a in enumerate(planned_occ):
        for b in planned_occ[i + 1:]:
            if a["course_id"] == b["course_id"]:
                continue
            if a["date"] != b["date"]:
                continue
            if not overlaps(a["start"], a["end"], b["start"], b["end"]):
                continue
            reasons = []
            if a["teacher"] and a["teacher"] == b["teacher"]:
                reasons.append("teacher")
            if reasons:
                conflicts.append({**a, "other": b["code"], "other_team": b["team"], "reasons": reasons})
                conflict_course_ids.add(a["course_id"])
                conflict_course_ids.add(b["course_id"])

    for pc in plan_courses:
        if pc["action"] == "create" and pc["course_id"] in conflict_course_ids:
            pc["conflict_override"] = True
        elif pc["action"] == "create":
            pc["conflict_override"] = False

    report = {
        "dry_run": not args.apply,
        "skipped_sheets": parsed["skipped"],
        "imported_sheets": parsed["imported_sheets"],
        "session_count": len(sessions),
        "teams_planned": len([p for p in plan_courses if p["action"] == "create"]),
        "ops_create": [p for p in plan_ops if p["action"] == "create"],
        "ops_update": [p for p in plan_ops if p["action"] == "update_teacher"],
        "courses_create": [p for p in plan_courses if p["action"] == "create"],
        "courses_skip": [p for p in plan_courses if p["action"].startswith("skip")],
        "unmatched": unmatched,
        "conflicts": conflicts,
        "notes": notes,
    }

    # print dry-run summary
    print("=== SKIPPED SHEETS ===")
    for s in parsed["skipped"]:
        print(f"  {s['sheet']}: {s['reason']}")
    print(f"\n=== IMPORT {len(parsed['imported_sheets'])} sheets / {len(sessions)} sessions ===")
    print(f"ops_courses to create: {len(report['ops_create'])}")
    print(f"ops_courses to update: {len(report['ops_update'])}")
    print(f"timetable courses to create: {len(report['courses_create'])}")
    print(f"timetable courses skipped: {len(report['courses_skip'])}")
    print(f"unmatched teams: {len(unmatched)}")
    print(f"teacher conflicts (pairs): {len(conflicts)}")
    for p in report["ops_create"]:
        print(f"  OPS+ {p['code']} | {p['name']} | teacher={p['teacher']} ops={p['ops_teacher']}")
    for p in report["ops_update"]:
        print(f"  OPS~ {p['code']} teacher→{p['teacher']}")
    for p in report["courses_create"]:
        print(f"  CRS+ {p['code']} | {p['team_name']} | {p['teacher']} | {len(p['sessions'])} sess | {p['date']}..{p['sessions'][-1]['date']} | override={p['conflict_override']}")
    for p in report["courses_skip"]:
        print(f"  SKIP {p.get('code')} {p['team']}: {p['reason']}")
    for u in unmatched:
        print(f"  UNMATCHED {u}")
    for c in conflicts[:20]:
        print(f"  CONFLICT {c['code']} {c['team']} {c['date']} {c['start']}-{c['end']} vs {c['other']} ({c['other_team']}) {c['reasons']}")

    Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote report {args.report}")

    if not args.apply:
        print("\nDry-run only. Re-run with --apply to write prod.")
        return

    # --- APPLY ---
    stmts = ["BEGIN;"]
    for p in plan_ops:
        if p["action"] == "create":
            stmts.append(
                "INSERT INTO ops_courses (id, code, project, name, status, class_type, teacher, ops_teacher, start_date, end_date, sort_order) "
                f"VALUES ({sql_str(p['id'])}, {sql_str(p['code'])}, {sql_str(p['project'])}, {sql_str(p['name'])}, "
                f"{sql_str(p['status'])}, {sql_str(p['class_type'])}, {sql_str(p['teacher'])}, {sql_str(p['ops_teacher'])}, "
                f"{sql_str(p['start_date'])}, {sql_str(p['end_date'])}, 0) "
                f"ON CONFLICT (code) DO NOTHING;"
            )
        elif p["action"] == "update_teacher":
            stmts.append(
                "UPDATE ops_courses SET "
                f"teacher = {sql_str(p['teacher'])}, "
                f"ops_teacher = COALESCE(NULLIF(ops_teacher, ''), {sql_str(p['ops_teacher'])}), "
                f"start_date = {sql_str(p['start_date'])}, end_date = {sql_str(p['end_date'])}, "
                f"status = {sql_str(p['status'])}, updated_at = now() "
                f"WHERE code = {sql_str(p['code'])};"
            )

    for pc in plan_courses:
        if pc["action"] != "create":
            continue
        co = "TRUE" if pc.get("conflict_override") else "NULL"
        stmts.append(
            "INSERT INTO courses (id, name, program, team, teacher, date, time, status, code, location, conflict_override, sort_order) "
            f"VALUES ({sql_str(pc['course_id'])}, {sql_str(pc['name'])}, {sql_str(PROGRAM)}, {sql_str(pc['team_id'])}, "
            f"{sql_str(pc['teacher'])}, {sql_str(pc['date'])}, {sql_str(pc['time'])}, {sql_str(pc['status'])}, "
            f"{sql_str(pc['code'])}, {sql_str(pc['location'])}, {co}, 0);"
        )
        for s in pc["sessions"]:
            stmts.append(
                "INSERT INTO course_sessions (id, course_id, date, start_time, end_time, location, sort_order) "
                f"VALUES ({sql_str(s['id'])}, {sql_str(s['course'])}, {sql_str(s['date'])}, "
                f"{sql_str(s['start'])}, {sql_str(s['end'])}, {sql_str(s['location'])}, {s['sort_order']}) "
                "ON CONFLICT DO NOTHING;"
            )

    stmts.append("COMMIT;")
    sql_all = "\n".join(stmts)
    sql_path = "/workspace/conrad_phase3_apply.sql"
    Path(sql_path).write_text(sql_all, encoding="utf-8")
    print(f"Wrote SQL {sql_path} ({len(stmts)} statements)")

    # pipe SQL via ssh
    remote = 'set -a; source /opt/nexus/prod/.env; set +a; psql "$DATABASE_URL" -v ON_ERROR_STOP=1'
    r = subprocess.run(
        ["ssh", "-i", os.path.expanduser("~/.ssh/nexus_deploy"), "-o", "StrictHostKeyChecking=accept-new", "nexus", remote],
        input=sql_all,
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        print("APPLY FAILED:", r.stderr, r.stdout)
        # try rollback already happened via ON_ERROR_STOP if in transaction
        sys.exit(1)
    print("APPLY OK")
    print(r.stdout[-2000:] if r.stdout else "")

    # verify
    v = psql_copy(
        "SELECT code, name, teacher FROM ops_courses WHERE code LIKE 'WS2026017-3-%' ORDER BY code"
    )
    print(f"phase3 ops_courses now: {len(v)}")
    for row in v:
        print(f"  {row['code']} | {row['name']} | {row['teacher']}")
    c = psql_copy("SELECT count(*) AS n FROM courses WHERE program = 'conrad'")
    s = psql_copy(
        "SELECT count(*) AS n FROM course_sessions cs JOIN courses c ON c.id = cs.course_id WHERE c.program = 'conrad'"
    )
    print(f"conrad courses: {c[0]['n']}, sessions: {s[0]['n']}")

    report["dry_run"] = False
    report["applied"] = True
    report["verify"] = {"ops_phase3": v, "courses": c[0]["n"], "sessions": s[0]["n"]}
    Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
