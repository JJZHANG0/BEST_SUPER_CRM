#!/usr/bin/env bash
# Obtain / renew Let's Encrypt certs for bestcrm.cc (+ www) and enable HTTPS nginx.
# Prerequisites: DNS A @ and www → this server's public IP; ports 80/443 open.
# Run on the CVM as root, or via: ssh nexus 'bash -s' < scripts/enable-https.sh
set -euo pipefail
DOMAIN=${DOMAIN:-bestcrm.cc}
WWW=${WWW:-www.bestcrm.cc}
EMAIL=${EMAIL:-jeazhang828@sina.com}
IP_EXPECT=${IP_EXPECT:-1.13.182.30}
ROOT_WEB=/var/www/certbot
SSL_INC=/etc/nginx/conf.d/nexus-ssl.conf.inc

echo "== check public DNS for $DOMAIN → $IP_EXPECT"
resolve() {
  python3 -c 'import socket,sys
h=sys.argv[1]
try:
  ips=sorted({ai[4][0] for ai in socket.getaddrinfo(h,80,socket.AF_INET)})
  print(",".join(ips) if ips else "")
except Exception:
  print("")' "$1"
}
for h in "$DOMAIN" "$WWW"; do
  got=$(resolve "$h" || true)
  echo "  $h → ${got:-'(no A record)'}"
  echo "$got" | tr ',' '\n' | grep -qx "$IP_EXPECT" || { echo "!! $h does not resolve to $IP_EXPECT yet" >&2; exit 1; }
done

mkdir -p "$ROOT_WEB"
if ! command -v certbot >/dev/null 2>&1; then
  echo "== install certbot"
  dnf install -y certbot python3-certbot-nginx || yum install -y certbot python3-certbot-nginx
fi

if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state 2>/dev/null | grep -q running; then
  firewall-cmd --permanent --add-service=https || true
  firewall-cmd --permanent --add-service=http || true
  firewall-cmd --reload || true
fi

echo "== certbot certonly (webroot) for $DOMAIN $WWW"
certbot certonly --webroot -w "$ROOT_WEB" \
  -d "$DOMAIN" -d "$WWW" \
  --email "$EMAIL" --agree-tos --non-interactive --keep-until-expiring

echo "== write HTTPS nginx include"
cat > "$SSL_INC" <<'NGINX'
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name bestcrm.cc www.bestcrm.cc;
    root /opt/nexus/prod/current/web;
    client_max_body_size 20m;
    # Idle HTTP/2 connections outlive the browser's (see deploy/nexus-ssl.conf.inc).
    keepalive_timeout 620s;
    keepalive_requests 10000;

    ssl_certificate     /etc/letsencrypt/live/bestcrm.cc/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bestcrm.cc/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location /a/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }
    location /_next/static/ { expires 1y; add_header Cache-Control "public, immutable"; try_files $uri =404; }
    location / { try_files $uri $uri/ $uri.html /index.html; add_header Cache-Control "no-cache"; }
}
NGINX

# Force HTTPS redirect for domain hosts on :80 (keep bare IP on HTTP).
python3 - <<'PY'
from pathlib import Path
p = Path('/etc/nginx/conf.d/nexus.conf')
text = p.read_text()
marker = '# NEXUS_HTTPS_REDIRECT'
if marker not in text:
    inject = '''
    # NEXUS_HTTPS_REDIRECT
    if ($host ~* ^(bestcrm\\.cc|www\\.bestcrm\\.cc)$) { return 301 https://$host$request_uri; }
'''
    if '\n    location /a/ {' not in text:
        raise SystemExit('cannot find location /a/ to inject redirect before')
    text = text.replace('\n    location /a/ {', inject + '\n    location /a/ {', 1)
    p.write_text(text)
    print('injected HTTPS redirect for domain hosts')
else:
    print('HTTPS redirect already present')
PY

nginx -t
systemctl reload nginx

for envf in /opt/nexus/prod/.env /opt/nexus/dev/.env; do
  [ -f "$envf" ] || continue
  if grep -q '^PUBLIC_ORIGIN=' "$envf"; then
    sed -i 's|^PUBLIC_ORIGIN=.*|PUBLIC_ORIGIN=https://bestcrm.cc|' "$envf"
  else
    echo 'PUBLIC_ORIGIN=https://bestcrm.cc' >> "$envf"
  fi
  if grep -q '^CORS_ORIGINS=' "$envf"; then
    sed -i 's|^CORS_ORIGINS=.*|CORS_ORIGINS=https://bestcrm.cc,https://www.bestcrm.cc|' "$envf"
  else
    echo 'CORS_ORIGINS=https://bestcrm.cc,https://www.bestcrm.cc' >> "$envf"
  fi
done
systemctl restart nexus-api-prod || true
systemctl restart nexus-api-dev || true

echo "== smoke"
curl -fsS "https://$DOMAIN/api/health"
echo
curl -fsSI "https://$DOMAIN/" | head -5
echo "== HTTPS ready: https://$DOMAIN  (DEV remains http://$IP_EXPECT:8080/)"
