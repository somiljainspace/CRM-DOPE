#!/usr/bin/env bash
set -euo pipefail

: "${BOOTSTRAP_EMAIL:?Set BOOTSTRAP_EMAIL to the local demo login email}"
: "${BOOTSTRAP_PASSWORD:?Set BOOTSTRAP_PASSWORD to a local password (8+ characters)}"

export CRM_DOPE_DEMO_MODE="${CRM_DOPE_DEMO_MODE:-true}"
export BOOTSTRAP_TENANT_ID="${BOOTSTRAP_TENANT_ID:-f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11}"
export BOOTSTRAP_WORKSPACE_ID="${BOOTSTRAP_WORKSPACE_ID:-ffffffff-1111-2222-3333-444444444444}"
export BOOTSTRAP_PROJECT_ID="${BOOTSTRAP_PROJECT_ID:-aaaaaaaa-1111-2222-3333-444444444444}"
export BOOTSTRAP_ENVIRONMENT_ID="${BOOTSTRAP_ENVIRONMENT_ID:-bbbbbbbb-1111-2222-3333-444444444444}"
export BOOTSTRAP_CREATE_SCOPE="true"

node "$(dirname "$0")/bootstrap-owner.js"
