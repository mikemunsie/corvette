#!/usr/bin/env bash
set -euo pipefail
STAGE="${1:-prod}"
PROFILE="${2:-}"
if [[ -n "$PROFILE" ]]; then
  export AWS_PROFILE="$PROFILE"
fi

read -r -p "Alert email for the 75% budget notice: " ALERT_EMAIL
if [[ -z "$ALERT_EMAIL" ]]; then
  echo "Alert email is required." >&2
  exit 1
fi
read -r -s -p "Setup code for the live site: " SETUP_CODE
echo
if [[ -z "$SETUP_CODE" ]]; then
  echo "Setup code is required." >&2
  exit 1
fi

npx sst secret set AlertEmail "$ALERT_EMAIL" --stage "$STAGE"
npx sst secret set SetupCode "$SETUP_CODE" --stage "$STAGE"
exec bash scripts/deploy.sh "$STAGE" "$PROFILE"
