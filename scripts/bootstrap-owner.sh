#!/bin/bash
# Phase 2B bootstrap: create initial OWNER (run once, requires env vars)
# Required env: BOOTSTRAP_TENANT_ID, BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD
set -euo pipefail
if [ -z "${BOOTSTRAP_TENANT_ID:-}" ] || [ -z "${BOOTSTRAP_EMAIL:-}" ] || [ -z "${BOOTSTRAP_PASSWORD:-}" ]; then
  echo "SET BOOTSTRAP_TENANT_ID, BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD"; exit 1;
fi
echo "Bootstrap requires manual setup (password hashed via argon2); not automatic to prevent unauthorized owners. Documented at docs/AUTHENTICATION.md."
