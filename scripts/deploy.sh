#!/usr/bin/env bash
# Build PROJECT NEXUS locally and deploy it to the server.
#   scripts/deploy.sh dev     -> http://<host>:8080/  (nexus_dev,  nexus-api-dev,  port 3002)
#   scripts/deploy.sh prod    -> http://<host>/       (nexus_prod, nexus-api-prod, port 3001)
# Env: NEXUS_SSH (default root@1.13.182.30), NEXUS_SSH_KEY (default ~/.ssh/nexus_deploy),
#      ALLOW_DIRTY=1 to deploy prod from a dirty tree, SKIP_BUILD=1 to reuse out/ + server-dist/.
# The server must have been provisioned once with deploy/server-setup.sh (see docs/DEPLOY.md).
# Builds run locally (the 2 GiB server is not used for building).
set -euo pipefail
ENV_NAME=${1:-}
case "$ENV_NAME" in prod) PORT=3001; APP_ENV=production ;; dev) PORT=3002; APP_ENV=development ;; *) echo "usage: $0 <dev|prod>" >&2; exit 2 ;; esac
HOST=${NEXUS_SSH:-root@1.13.182.30}
KEY=${NEXUS_SSH_KEY:-$HOME/.ssh/nexus_deploy}
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)
[ -f "$KEY" ] && SSH_OPTS+=(-i "$KEY" -o IdentitiesOnly=yes)
cd "$(dirname "$0")/.."

BRANCH=$(git rev-parse --abbrev-ref HEAD); SHA=$(git rev-parse --short HEAD)
if [ "$ENV_NAME" = prod ]; then
  [ "$BRANCH" = main ] || echo "warning: deploying prod from branch '$BRANCH' (expected main)" >&2
  if [ -n "$(git status --porcelain)" ] && [ "${ALLOW_DIRTY:-}" != 1 ]; then echo "refusing: working tree is dirty (set ALLOW_DIRTY=1 to override)" >&2; exit 1; fi
fi
RELEASE=$(date +%Y%m%d%H%M%S)-$SHA

if [ "${SKIP_BUILD:-}" != 1 ]; then
  echo "== build frontend ($APP_ENV, API at /api)"
  NEXT_PUBLIC_BASE_PATH= NEXT_PUBLIC_API_BASE=/api NEXT_PUBLIC_NEXUS_ENV=$APP_ENV node scripts/build-static.mjs
  echo "== build API bundle"
  node server/build.mjs
fi
[ -f out/index.html ] && [ -f server-dist/index.mjs ] || { echo "build output missing" >&2; exit 1; }

STAGE=$(mktemp -d); trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/$RELEASE"; cp -R out "$STAGE/$RELEASE/web"; cp -R server-dist "$STAGE/$RELEASE/server"
printf '{"release":"%s","commit":"%s","branch":"%s","env":"%s"}\n' "$RELEASE" "$(git rev-parse HEAD)" "$BRANCH" "$ENV_NAME" > "$STAGE/$RELEASE/web/release.json"
tar -C "$STAGE" -czf "$STAGE/release.tgz" "$RELEASE"

echo "== upload $RELEASE to $HOST ($ENV_NAME)"
scp -q "${SSH_OPTS[@]}" "$STAGE/release.tgz" "$HOST:/tmp/nexus-$ENV_NAME-$RELEASE.tgz"
ssh "${SSH_OPTS[@]}" "$HOST" ENV_NAME="$ENV_NAME" RELEASE="$RELEASE" PORT="$PORT" bash -s <<'REMOTE'
set -euo pipefail
DIR=/opt/nexus/$ENV_NAME; TGZ=/tmp/nexus-$ENV_NAME-$RELEASE.tgz
[ -f "$DIR/.env" ] || { echo "missing $DIR/.env — run deploy/server-setup.sh first" >&2; exit 1; }
tar -C "$DIR/releases" -xzf "$TGZ"; rm -f "$TGZ"
chown -R root:root "$DIR/releases/$RELEASE"; chmod -R a+rX "$DIR/releases/$RELEASE"
run() { (set -a; . "$DIR/.env"; set +a; cd "$DIR/releases/$RELEASE/server"; runuser -u nexus --preserve-environment -- /usr/bin/node index.mjs "$@"); }
echo "-- migrate"; run migrate
echo "-- seed (idempotent)"; run seed
PREV=$(readlink "$DIR/current" || true)
ln -sfn "releases/$RELEASE" "$DIR/current.new" && mv -Tf "$DIR/current.new" "$DIR/current"
systemctl enable -q "nexus-api-$ENV_NAME"; systemctl restart "nexus-api-$ENV_NAME"
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then OK=1; break; fi; sleep 1
done
if [ "${OK:-}" != 1 ]; then
  echo "!! health check failed; rolling back to $PREV" >&2
  journalctl -u "nexus-api-$ENV_NAME" -n 30 --no-pager >&2 || true
  [ -n "$PREV" ] && ln -sfn "$PREV" "$DIR/current" && systemctl restart "nexus-api-$ENV_NAME"
  exit 1
fi
nginx -t -q && systemctl reload nginx
# Keep the five newest releases.
ls -1dt "$DIR"/releases/*/ | tail -n +6 | xargs -r rm -rf
echo "-- health: $(curl -fsS http://127.0.0.1:$PORT/api/health)"
REMOTE
echo "== deployed $RELEASE to $ENV_NAME"
