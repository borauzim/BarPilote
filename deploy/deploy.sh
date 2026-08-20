#!/usr/bin/env bash
set -Eeuo pipefail

REVISION="${1:?Usage: deploy/deploy.sh <git-revision>}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${BARPILOTE_VENV_PATH:-$APP_DIR/.venv}"
SERVICE_NAME="${BARPILOTE_SERVICE_NAME:-barpilote}"
cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Deployment stopped: $APP_DIR/.env is missing." >&2
  exit 1
fi

previous_revision="$(git rev-parse HEAD)"
echo "Deploying $REVISION (previous: $previous_revision)"
git fetch --prune origin main
if ! git cat-file -e "$REVISION^{commit}" 2>/dev/null; then
  echo "Unknown revision: $REVISION" >&2
  exit 1
fi
if ! git merge-base --is-ancestor "$REVISION" origin/main; then
  echo "Revision is not part of origin/main: $REVISION" >&2
  exit 1
fi
git checkout --force main
git reset --hard "$REVISION"

mkdir -p "$APP_DIR/backups"
if [[ -f "$APP_DIR/db.sqlite3" ]]; then
  backup_file="$APP_DIR/backups/db-$(date +%Y%m%d-%H%M%S).sqlite3"
  cp "$APP_DIR/db.sqlite3" "$backup_file"
  find "$APP_DIR/backups" -type f -name 'db-*.sqlite3' -printf '%T@ %p\n' \
    | sort -nr | tail -n +11 | cut -d ' ' -f2- | xargs -r rm --
  echo "Database backup: $backup_file"
fi

if [[ ! -x "$VENV_DIR/bin/python" ]]; then
  python3 -m venv "$VENV_DIR"
fi
"$VENV_DIR/bin/python" -m pip install --disable-pip-version-check --upgrade pip
"$VENV_DIR/bin/python" -m pip install --disable-pip-version-check -r requirements.txt
"$VENV_DIR/bin/python" manage.py check
"$VENV_DIR/bin/python" manage.py migrate --noinput
"$VENV_DIR/bin/python" manage.py collectstatic --noinput

sudo systemctl restart "$SERVICE_NAME"
sudo systemctl is-active --quiet "$SERVICE_NAME"
echo "Deployment complete: $(git rev-parse --short HEAD)"
