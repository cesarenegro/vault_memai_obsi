#!/bin/bash
# Run only after release build and acceptance checks. Does not commit or publish.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
: "${LIMEN_SIGN_IDENTITY:?Set verified Developer ID Application identity SHA-1}"
: "${LIMEN_NOTARY_PROFILE:?Set existing Keychain profile name}"
APP="$ROOT_DIR/apps/desktop/src-tauri/target/release/bundle/macos/LIMEN Vault.app"
OUT="$ROOT_DIR/.local/m9-release"
mkdir -p "$OUT" IMPLEMENTATION/M9_EVIDENCE
if [ -e "$OUT/LIMEN-Vault-0.1.0-arm64.dmg" ]; then
  echo 'Existing release preserved. Move it to a versioned archive before another packaging run.' >&2; exit 1
fi
# Tauri discovers Cargo's test harness as a second binary. It is never shipped.
python3 - "$APP" <<'PYTHON'
import pathlib,sys
macos=pathlib.Path(sys.argv[1])/'Contents/MacOS'
harness=macos/'vault-check'
if harness.exists():
    if sys.argv[1].endswith('LIMEN Vault.app') and harness.is_file() and not harness.is_symlink(): harness.unlink()
    else: raise SystemExit('Unexpected harness path')
assert sorted(p.name for p in macos.iterdir())==['limen-vault'],'Unexpected executable in release app'
PYTHON
if [ "${1:-}" != "--package-signed" ]; then
for name in tunnel-client cloudflared; do
  codesign --force --options runtime --timestamp --sign "$LIMEN_SIGN_IDENTITY" "$APP/Contents/Resources/mcp/$name"
done
codesign --force --options runtime --timestamp --sign "$LIMEN_SIGN_IDENTITY" "$APP"
fi
codesign --verify --deep --strict --verbose=2 "$APP" > IMPLEMENTATION/M9_EVIDENCE/signature.log 2>&1
if [ "${1:-}" = "--sign-only" ]; then exit 0; fi
# Staple the application itself so copies from the DMG work offline.
ditto -c -k --keepParent "$APP" "$OUT/notarization.zip"
xcrun notarytool submit "$OUT/notarization.zip" --keychain-profile "$LIMEN_NOTARY_PROFILE" --no-s3-acceleration --wait --timeout 10m --output-format json > IMPLEMENTATION/M9_EVIDENCE/app-notary.json
python3 -c 'import json; assert json.load(open("IMPLEMENTATION/M9_EVIDENCE/app-notary.json"))["status"]=="Accepted"'
xcrun stapler staple "$APP"
xcrun stapler validate "$APP"
STAGE="$(mktemp -d "$OUT/dmg-stage.XXXXXX")"
ditto "$APP" "$STAGE/LIMEN Vault.app"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname 'LIMEN Vault' -srcfolder "$STAGE" -format UDZO "$OUT/LIMEN-Vault-0.1.0-arm64.dmg"
codesign --timestamp --sign "$LIMEN_SIGN_IDENTITY" "$OUT/LIMEN-Vault-0.1.0-arm64.dmg"
xcrun notarytool submit "$OUT/LIMEN-Vault-0.1.0-arm64.dmg" --keychain-profile "$LIMEN_NOTARY_PROFILE" --no-s3-acceleration --wait --timeout 10m --output-format json > IMPLEMENTATION/M9_EVIDENCE/dmg-notary.json
python3 -c 'import json; assert json.load(open("IMPLEMENTATION/M9_EVIDENCE/dmg-notary.json"))["status"]=="Accepted"'
xcrun stapler staple "$OUT/LIMEN-Vault-0.1.0-arm64.dmg"
xcrun stapler validate "$OUT/LIMEN-Vault-0.1.0-arm64.dmg"
spctl --assess --type execute --verbose=4 "$APP" > IMPLEMENTATION/M9_EVIDENCE/gatekeeper-app.log 2>&1
spctl --assess --type open --context context:primary-signature --verbose=4 "$OUT/LIMEN-Vault-0.1.0-arm64.dmg" > IMPLEMENTATION/M9_EVIDENCE/gatekeeper-dmg.log 2>&1
shasum -a 256 "$OUT/LIMEN-Vault-0.1.0-arm64.dmg" > IMPLEMENTATION/M9_EVIDENCE/SHA256SUMS.txt
printf '%s\n' 'Signed/notarized artifacts prepared. Functional installation acceptance remains a separate required check.'
