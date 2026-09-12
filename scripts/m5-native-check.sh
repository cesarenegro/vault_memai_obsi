#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
if [ -x "$ROOT/.local/cargo/bin/cargo" ]; then
  export CARGO_HOME="$ROOT/.local/cargo"
  export RUSTUP_HOME="$ROOT/.local/rustup"
  export PATH="$CARGO_HOME/bin:$PATH"
fi
cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo build --locked --manifest-path apps/desktop/src-tauri/Cargo.toml --bin vault-check
pnpm --filter @limen-vault/desktop test:native-parity
pnpm --filter @limen-vault/desktop test:m3-e2e
pnpm --filter @limen-vault/desktop test:m4-e2e
pnpm --filter @limen-vault/desktop test:m5-e2e
pnpm --filter @limen-vault/desktop tauri build --bundles app
