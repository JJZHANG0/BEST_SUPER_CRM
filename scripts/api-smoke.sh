#!/usr/bin/env bash
# Smoke-test a deployed NEXUS API with the demo accounts. Changes DEMO-0002 status (ops) and
# checks sales sees it. usage: scripts/api-smoke.sh http://1.13.182.30   (or :8080 for dev)
set -e
B=$1; J='Content-Type: application/json'
echo "health: $(curl -s $B/api/health)"
OPS=$(curl -s -X POST -H "$J" -d '{"email":"ops@nexus.demo","password":"NexusOps2026!"}' $B/api/auth/login | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
SALES=$(curl -s -X POST -H "$J" -d '{"email":"sales@nexus.demo","password":"NexusSales2026!"}' $B/api/auth/login | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
echo "bad login: $(curl -s -o /dev/null -w '%{http_code}' -X POST -H "$J" -d '{"email":"ops@nexus.demo","password":"x"}' $B/api/auth/login)"
echo "no token bootstrap: $(curl -s -o /dev/null -w '%{http_code}' $B/api/bootstrap)"
curl -s -H "Authorization: Bearer $OPS" $B/api/bootstrap | python3 -c 'import sys,json;d=json.load(sys.stdin);print("ops sees", {k:len(v) for k,v in d.items() if isinstance(v,list)}, d["user"]["name"])'
curl -s -H "Authorization: Bearer $SALES" $B/api/bootstrap | python3 -c 'import sys,json;d=json.load(sys.stdin);print("sales sees", {k:len(v) for k,v in d.items() if isinstance(v,list)}, d["user"]["name"]); s=[x for x in d["students"] if x["id"]=="DEMO-0002"][0]; print("sales DEMO-0002 before:", s["health"], s["healthBy"], s["healthUpdated"])'
NEW=$(python3 -c 'import random;print(random.choice(["状态不佳","需关注","状态良好"]))')
echo "ops PATCH DEMO-0002 -> $NEW: $(curl -s -X PATCH -H "$J" -H "Authorization: Bearer $OPS" -d "{\"health\":\"$NEW\",\"healthNote\":\"API 验证 $(date +%H:%M:%S)\"}" $B/api/students/DEMO-0002/status)"
echo "sales PATCH (expect 403): $(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H "$J" -H "Authorization: Bearer $SALES" -d '{"health":"需关注"}' $B/api/students/DEMO-0002/status)"
echo "sales PUT article (expect 403): $(curl -s -o /dev/null -w '%{http_code}' -X PUT -H "$J" -H "Authorization: Bearer $SALES" -d '{}' $B/api/articles/bpa)"
curl -s -H "Authorization: Bearer $SALES" $B/api/bootstrap | python3 -c 'import sys,json;d=json.load(sys.stdin);s=[x for x in d["students"] if x["id"]=="DEMO-0002"][0];print("sales DEMO-0002 after:", s["health"], s["healthNote"], s["healthBy"], s["healthUpdated"])'
curl -s -H "Authorization: Bearer $SALES" $B/api/students/DEMO-0002/history | python3 -c 'import sys,json;h=json.load(sys.stdin)["history"];print("history entries:",len(h),"latest:",h[0] if h else None)'
