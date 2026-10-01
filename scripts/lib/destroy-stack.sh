#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${STAGE:-}" ]]; then
  echo "STAGE is required." >&2
  exit 1
fi

cat <<EOF
This will delete the ${STAGE} stack:
- site bucket
- GarageTable and StatsTable
- Lambda
- CloudFront
- SNS
- Budget
- IAM roles

Prod data is retained until this script redeploys with SST_DESTROY=1.
Type the stage name to continue: ${STAGE}
EOF

read -r CONFIRM
if [[ "$CONFIRM" != "$STAGE" ]]; then
  echo "Canceled."
  exit 1
fi

export SST_DESTROY=1
if [[ "$STAGE" == "prod" ]]; then
  npx sst deploy --stage "$STAGE"
fi
npx sst remove --stage "$STAGE"
