#!/usr/bin/env bash
set -euo pipefail
STAGE="${1:-prod}"
PROFILE="${2:-}"
if [[ -n "$PROFILE" ]]; then
  export AWS_PROFILE="$PROFILE"
fi
echo "Deploying corvette-mechanic ($STAGE). Monthly cap is \$20. APIs pause at 100%."
npx sst deploy --stage "$STAGE"
