#!/usr/bin/env bash
# Run ON the server as root: pg_dump both databases to /opt/nexus/backups/<timestamp>/ (custom format, mode 600).
#   ssh root@1.13.182.30 'bash -s' < scripts/backup-db.sh
# Restore one: sudo -u postgres pg_restore --clean --if-exists -d nexus_prod /opt/nexus/backups/<ts>/nexus_prod.dump
set -euo pipefail
TS=${BACKUP_TS:-$(date +%Y%m%d-%H%M%S)}
DIR=/opt/nexus/backups/$TS
install -d -m 700 -o postgres -g postgres /opt/nexus/backups "$DIR"
for DB in nexus_prod nexus_dev; do
  sudo -u postgres pg_dump -Fc -d "$DB" -f "$DIR/$DB.dump"
  sudo -u postgres pg_restore -l "$DIR/$DB.dump" >/dev/null   # sanity: archive is readable
  echo "backup: $DIR/$DB.dump ($(stat -c %s "$DIR/$DB.dump") bytes)"
done
chmod 600 "$DIR"/*.dump
echo "$DIR"
