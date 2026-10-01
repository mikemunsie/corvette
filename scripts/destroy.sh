#!/usr/bin/env bash
set -euo pipefail
STAGE="${1:-prod}"
PROFILE="${2:-}"
if [[ -n "$PROFILE" ]]; then
  export AWS_PROFILE="$PROFILE"
fi
export STAGE
source scripts/lib/destroy-stack.sh
