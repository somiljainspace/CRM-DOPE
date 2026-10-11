#!/usr/bin/env bash
# Create the initial OWNER for an existing tenant/workspace.
set -euo pipefail
: "${BOOTSTRAP_TENANT_ID:?Set BOOTSTRAP_TENANT_ID}"
: "${BOOTSTRAP_WORKSPACE_ID:?Set BOOTSTRAP_WORKSPACE_ID}"
: "${BOOTSTRAP_EMAIL:?Set BOOTSTRAP_EMAIL}"
: "${BOOTSTRAP_PASSWORD:?Set BOOTSTRAP_PASSWORD (8+ characters)}"

node "$(dirname "$0")/bootstrap-owner.js"
