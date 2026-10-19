# Active HTTPS vhost for bestcrm.cc — only install when Let's Encrypt certs exist.
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name bestcrm.cc www.bestcrm.cc;
    root /opt/nexus/prod/current/web;
    client_max_body_size 20m;
    # Keep idle client (HTTP/2) connections longer than browsers do, so the browser closes first.
    # With nginx\'s default 65s, a POST/PUT sent on a connection nginx just closed fails as a
    # network error (browsers do not auto-retry non-idempotent requests) — the 「first save fails」 bug.
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
