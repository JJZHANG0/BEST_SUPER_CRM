import pandas as pd, json, re, math, datetime as dt
import sys
F=sys.argv[1] if len(sys.argv)>1 else 'data.xlsx'  # usage: python3 scripts/import-real-seed.py <workbook.xlsx>
x=pd.read_excel(F,sheet_name=None,engine='calamine')
CUT='2026-10-01'
OPS={'张捷嘉':'zhangjiejia@nexus.local','程雪晴':'chengxueqing@nexus.local','张雪航':'zhangxuehang@nexus.local','许瑾':'xujin@nexus.local','方彦淇':'fangyanqi@nexus.local'}
CT={'1. 线上1-2人班型':('CT01','hour'),'2. 线上3-5人班型':('CT02','hour'),'3. 线上6人及以上班型':('CT03','person_hour'),'4. 线下1-2人班型':('CT04','hour'),'5. 线下3-5人班型':('CT05','hour'),'6. 线下6人及以上班型':('CT06','person_hour')}
JUNK={'无所谓','未找到','0','nan',''}
report={'skipped_courses':[], 'unmapped_ops':{}, 'skipped_records':[], 'notes':[]}
def s(v):
    if v is None or v is pd.NaT or (isinstance(v,float) and math.isnan(v)): return ''
    if isinstance(v,(pd.Timestamp,dt.datetime)): return v.strftime('%Y-%m-%d')
    if isinstance(v,float) and v.is_integer(): v=int(v)
    return str(v).strip()
def d(v):
    if v is None or (isinstance(v,float) and math.isnan(v)) or v is pd.NaT: return ''
    if isinstance(v,(pd.Timestamp,dt.datetime)): return v.strftime('%Y-%m-%d')
    if isinstance(v,(int,float)) and 30000<v<60000: return (dt.date(1899,12,30)+dt.timedelta(days=int(v))).isoformat()
    t=str(v).strip()
    m=re.match(r'^(\d{1,2})\.(\d{1,2})$',t)
    if m: return f'2026-{int(m[1]):02d}-{int(m[2]):02d}'
    m=re.match(r'^(\d{4})[/-](\d{1,2})月?$',t)
    if m:
        y,mo=int(m[1]),int(m[2]); last=(dt.date(y+(mo==12),mo%12+1,1)-dt.timedelta(days=1)); return last.isoformat()
    m=re.match(r'^(\d{4})-(\d{2})-(\d{2})',t)
    return m[0] if m else ''
c=x['🔒课程编号管理']
rows=[r for _,r in c.iterrows()]
# lesson records from per-teacher sheets
recs=[];seen=set()
for name in [k for k in x if k.endswith('学情反馈表')]:
    for i,r in x[name].iterrows():
        code=s(r.get('课程编号'))
        if not code: continue
        date=d(r.get('授课日期'))
        if not date:
            report['skipped_records'].append(f'{name} 第{i+2}行 {code}: 授课日期缺失或无法识别（{s(r.get("授课日期"))}）'); continue
        if date<CUT: continue
        if date>='2026-12-01' and code.startswith('CBPA'):
            report['skipped_records'].append(f'{name} 第{i+2}行 {code} {date}: 判断为 2025年12月（CBPA2025001 课程已结束、位于 2026年1月记录之前），早于 2026-10-01，未导入'); continue
        key=(code,date,s(r.get('授课老师')),s(r.get('教务老师')))
        if key in seen: report['notes'].append(f'重复记录已合并：{name} {code} {date}'); continue
        seen.add(key); recs.append((name,i,r,code,date))
rec_codes={rc[3] for rc in recs}
courses=[];projects={};teachers=[]
def addt(n):
    n=s(n)
    if n and n not in JUNK and n not in teachers: teachers.append(n)
for r in rows: addt(r.get('授课老师'))
for k in [k for k in x if k.endswith('学情反馈表')]:
    for v in x[k]['授课老师']: addt(v)
for r in rows:
    p=s(r.get('项目编号'))
    if p and p not in projects: projects[p]={'codes':[], 'names':[], 'starts':[], 'ends':[], 'status':[]}
    if p:
        projects[p]['names'].append(s(r.get('课程名称'))); projects[p]['status'].append(s(r.get('课程状态')))
        if d(r.get('起始日期')): projects[p]['starts'].append(d(r.get('起始日期')))
        if d(r.get('终止日期')): projects[p]['ends'].append(d(r.get('终止日期')))
codes_done=set()
for idx,r in enumerate(rows):
    code=s(r.get('课程编号')); p=s(r.get('项目编号')); st=s(r.get('课程状态')); end=d(r.get('终止日期')); start=d(r.get('起始日期'))
    if not code and not p: continue
    relevant = st in ('进行中','未开始') or (end and end>=CUT) or code in rec_codes
    if not relevant: continue
    if not code or not p: report['skipped_courses'].append(f'第{idx+2}行 {s(r.get("课程名称"))}: 缺少{"课程编号" if not code else "项目编号"}'); continue
    if code in codes_done: report['notes'].append(f'课程编号 {code} 重复，保留第一行'); continue
    ct=CT.get(s(r.get('班级类型')))
    if not ct: report['skipped_courses'].append(f'第{idx+2}行 {code} {s(r.get("课程名称"))}: 缺少班级类型，无法计算津贴'); continue
    ops=s(r.get('教务老师'))
    if ops and ops not in OPS: report['unmapped_ops'].setdefault(ops,[]).append(code)
    teacher=s(r.get('授课老师')); teacher='' if teacher in JUNK else teacher
    if st not in ('未开始','进行中','已结束'): st='进行中' if (end and end>=CUT) else '已结束'
    rate=r.get('津贴标准')
    courses.append({'id':'OC-'+code,'code':code,'project':'P-'+p,'name':s(r.get('课程名称')),'status':st,'classType':ct[0],'teacher':teacher,'opsTeacher':OPS.get(ops,''),'startDate':start,'endDate':end,'_rate':None if rate is None or (isinstance(rate,float) and math.isnan(rate)) else float(rate)})
    codes_done.add(code)
def pname(code,names):
    u=sorted(set(n.strip() for n in names if n.strip()))
    if len(u)==1: return u[0]
    toks=[re.split(r'[\s「（(\-－]',n.strip())[0] for n in names if n.strip()]
    toks=[t for t in toks if t]
    return max(set(toks),key=toks.count) if toks else code
plist=[]
for code,v in projects.items():
    st='进行中' if '进行中' in v['status'] else ('未开始' if v['status'] and all(x=='未开始' for x in v['status']) else '已结束')
    plist.append({'id':'P-'+code,'code':code,'name':pname(code,v['names']),'startDate':min(v['starts']) if v['starts'] else '','endDate':max(v['ends']) if v['ends'] else '','status':st,'note':'导入自课程编号管理表'})
lessons=[];feedbacks=[]
cmap={c['code']:c for c in courses}
for n,(name,i,r,code,date) in enumerate(recs,1):
    course=cmap.get(code)
    if not course: report['skipped_records'].append(f'{name} 第{i+2}行 {code} {date}: 课程不在导入的课程列表中'); continue
    ops=s(r.get('教务老师'))
    if ops not in OPS: report['skipped_records'].append(f'{name} 第{i+2}行 {code} {date}: 教务老师「{ops}」不是系统账号'); continue
    unit=CT.get(s(r.get('班型')),(course['classType'],'hour'))[1]
    rate=r.get('津贴标准'); rate=float(rate) if isinstance(rate,(int,float)) and not math.isnan(rate) else (course['_rate'] if course['_rate'] is not None else None)
    if rate is None: rate={'CT01':10,'CT02':15,'CT03':3,'CT04':15,'CT05':25,'CT06':5}[course['classType']]; report['notes'].append(f'{code} {date}: 记录未填津贴标准，按班型标准 ¥{rate}')
    hours=float(r.get('课时计数') or 0)
    present=r.get('实到人数'); present=int(present) if isinstance(present,(int,float)) and not math.isnan(present) else None
    due=r.get('应到人数'); due=int(due) if isinstance(due,(int,float)) and not math.isnan(due) else None
    amount=round(rate*hours*(present or 0),2) if unit=='person_hour' else round(rate*hours,2)
    xa=r.get('单次津贴')
    if isinstance(xa,(int,float)) and not math.isnan(xa) and abs(xa-amount)>0.01: report['notes'].append(f'{code} {date}: 表内单次津贴 {xa} 与按标准计算 {amount} 不一致，采用计算值')
    future = date>'2026-10-11'
    note=' · '.join(filter(None,[f'授课老师 {s(r.get("授课老师"))}' if s(r.get('授课老师')) else '', f'{s(r.get("课程地点"))}' if s(r.get('课程地点')) else '', '导入自学情反馈表'+('（表内日期晚于导入日 2026-10-11）' if future else '')]))
    lid=f'L-IMP-{n:03d}'
    lessons.append({'id':lid,'course':course['id'],'date':date,'hours':hours,'students':present,'opsTeacher':OPS[ops],'rate':rate,'unit':unit,'amount':amount,'note':note,'createdBy':OPS[ops]})
    content=s(r.get('课程反馈'))
    if content or s(r.get('本周作业')):
        feedbacks.append({'id':f'LF-IMP-{n:03d}','course':course['id'],'lesson':lid,'date':date,'attendance':(f'实到 {present}/{due} 人' if due and present is not None else (f'应到 {due} 人' if due else (f'实到 {present} 人' if present is not None else ''))),'content':content[:4000],'performance':s(r.get('课程进度')) and f'课程进度 {round(float(r.get("课程进度"))*100)}%','issues':s(r.get('教学异常报备'))[:4000],'nextSteps':s(r.get('本周作业'))[:2000],'opsTeacher':OPS[ops],'createdBy':OPS[ops]})
for c_ in courses: c_.pop('_rate')
tlist=[{'id':f'TCH{n:03d}','name':t,'note':'','active':True} for n,t in enumerate(teachers,1)]
out={'projects':plist,'courses':courses,'teachers':tlist,'lessons':lessons,'lessonFeedbacks':feedbacks}
json.dump(out,open('real-seed.json','w'),ensure_ascii=False,indent=1)
json.dump(report,open('report.json','w'),ensure_ascii=False,indent=1)
print({k:len(v) for k,v in out.items()})
print(json.dumps(report,ensure_ascii=False,indent=1))
print([t['name'] for t in tlist])
for l in lessons: print(l)
