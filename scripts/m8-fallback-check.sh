#!/bin/bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
mkdir -p IMPLEMENTATION/M8_EVIDENCE
if [ -x "$ROOT_DIR/.local/cargo/bin/cargo" ]; then
  export CARGO_HOME="$ROOT_DIR/.local/cargo"
  export RUSTUP_HOME="$ROOT_DIR/.local/rustup"
  export PATH="$CARGO_HOME/bin:$PATH"
fi
# --bank-only reuses existing artifacts; their actual hashes are always recorded.
# It does not claim that automatic checks were rerun.
if [ "${1:-}" != "--bank-only" ]; then
  pnpm test > IMPLEMENTATION/M8_EVIDENCE/tests.log 2>&1
  pnpm typecheck > IMPLEMENTATION/M8_EVIDENCE/typecheck.log 2>&1
  pnpm build > IMPLEMENTATION/M8_EVIDENCE/build.log 2>&1
  cargo test --release --manifest-path apps/desktop/src-tauri/Cargo.toml > IMPLEMENTATION/M8_EVIDENCE/rust.log 2>&1
  cargo build --release --manifest-path apps/desktop/src-tauri/Cargo.toml --bin vault-check > IMPLEMENTATION/M8_EVIDENCE/native-build.log 2>&1
  pnpm --filter @limen-vault/desktop tauri build --bundles app > IMPLEMENTATION/M8_EVIDENCE/bundle-build.log 2>&1
fi
# Exit 0 only if every required acceptance criterion is actually verified.
# Exit 1 = observed failure; exit 2 = incomplete acceptance, not a successful M8.
exec python3 scripts/m8-native-bank.py
