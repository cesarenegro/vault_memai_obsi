#!/bin/bash
# Package the v3 release after tests and a Tauri app build. Existing outputs are preserved.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${LIMEN_SIGN_IDENTITY:?Developer ID identity required}"
: "${LIMEN_NOTARY_PROFILE:?Existing notary profile required}"
OUT="${LIMEN_RELEASE_OUT:-$ROOT/.local/limen-v3-release}"
EVIDENCE="${LIMEN_RELEASE_EVIDENCE:-$ROOT/IMPLEMENTATION/V3_EVIDENCE}"
APP="$OUT/LIMEN Vault v3.app"
mkdir -p "$EVIDENCE"
case "${1:-prepare}" in
prepare)
  if [ -e "$OUT" ]; then echo 'Existing v3 output preserved' >&2; exit 1; fi
  mkdir "$OUT"
  ditto "$ROOT/apps/desktop/src-tauri/target/release/bundle/macos/LIMEN Vault v3.app" "$APP"
  python3 - "$APP" <<'PY'
import pathlib,sys,plistlib
app=pathlib.Path(sys.argv[1])
for b in list((app/'Contents/MacOS').iterdir()):
    if b.name != 'limen-vault': b.unlink()
assert [p.name for p in (app/'Contents/MacOS').iterdir()]==['limen-vault']
with (app/'Contents/Info.plist').open('rb') as f: assert plistlib.load(f)['CFBundleShortVersionString']=='0.3.0'
assert (app/'Contents/Resources/documentation/HELP/07_AUTOMAZIONE_DOCUMENTI.md').is_file()
assert (app/'Contents/Resources/native/limen-extract').is_file()
PY
  for helper in mcp/tunnel-client mcp/cloudflared; do
    if [ -f "$APP/Contents/Resources/$helper" ]; then
      codesign --force --options runtime --timestamp --sign "$LIMEN_SIGN_IDENTITY" "$APP/Contents/Resources/$helper"
    fi
  done
  # I backend ggml (*.so) vanno firmati con lo stesso Team ID del binario: con il runtime
  # indurito, dyld rifiuta di caricare librerie firmate da un Team ID diverso (library validation).
  find "$APP/Contents/Resources/native" -type f \( -name "*.dylib" -o -name "*.so" -o -perm +111 \) -exec codesign --force --options runtime --timestamp --sign "$LIMEN_SIGN_IDENTITY" {} +
  codesign --force --options runtime --timestamp --sign "$LIMEN_SIGN_IDENTITY" "$APP"
  codesign --verify --deep --strict --verbose=2 "$APP" > "$EVIDENCE/app-signature.log" 2>&1
  ditto -c -k --keepParent "$APP" "$OUT/app-v3.zip"
  xcrun notarytool submit "$OUT/app-v3.zip" --keychain-profile "$LIMEN_NOTARY_PROFILE" --no-s3-acceleration --output-format json > "$EVIDENCE/app-submit.json"
  ;;
package)
  python3 - "$EVIDENCE/app-status.json" <<'PY'
import json,sys
assert json.load(open(sys.argv[1]))['status']=='Accepted'
PY
  xcrun stapler staple "$APP" > "$EVIDENCE/app-staple.log" 2>&1
  xcrun stapler validate "$APP" >> "$EVIDENCE/app-staple.log" 2>&1
  codesign --verify --deep --strict "$APP"
  spctl --assess --type execute --verbose=4 "$APP" > "$EVIDENCE/app-gatekeeper.log" 2>&1
  mkdir "$OUT/stage"
  ditto "$APP" "$OUT/stage/LIMEN Vault v3.app"
  ln -s /Applications "$OUT/stage/Applications"
  ditto "$ROOT/HELP" "$OUT/stage/HELP v3"
  cp "$ROOT/docs/GUIDA_UTENTE_LIMEN.md" "$OUT/stage/Guida utente LIMEN v3.md"
  cp "$ROOT/manuale UI utente.txt" "$OUT/stage/Manuale LIMEN v3.txt"
  cp "$EVIDENCE/LEGGIMI-v3.txt" "$OUT/stage/LEGGIMI-v3.txt"
  hdiutil create -volname 'LIMEN Vault v3' -srcfolder "$OUT/stage" -format UDZO "$OUT/LIMEN-Vault-v3-arm64.dmg"
  codesign --timestamp --sign "$LIMEN_SIGN_IDENTITY" "$OUT/LIMEN-Vault-v3-arm64.dmg"
  xcrun notarytool submit "$OUT/LIMEN-Vault-v3-arm64.dmg" --keychain-profile "$LIMEN_NOTARY_PROFILE" --no-s3-acceleration --output-format json > "$EVIDENCE/dmg-submit.json"
  ;;
finish)
  python3 - "$EVIDENCE/dmg-status.json" <<'PY'
import json,sys
assert json.load(open(sys.argv[1]))['status']=='Accepted'
PY
  xcrun stapler staple "$OUT/LIMEN-Vault-v3-arm64.dmg" > "$EVIDENCE/dmg-staple.log" 2>&1
  xcrun stapler validate "$OUT/LIMEN-Vault-v3-arm64.dmg" >> "$EVIDENCE/dmg-staple.log" 2>&1
  spctl --assess --type open --context context:primary-signature --verbose=4 "$OUT/LIMEN-Vault-v3-arm64.dmg" > "$EVIDENCE/dmg-gatekeeper.log" 2>&1
  ;;
*) exit 2;;
esac
