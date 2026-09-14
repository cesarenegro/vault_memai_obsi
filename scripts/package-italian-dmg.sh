#!/bin/bash
# Package an already signed, Apple-accepted Italian application. Preserve previous releases.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/.local/ui-it-notarized-20260913"
EVIDENCE="$ROOT/IMPLEMENTATION/UI_IT_EVIDENCE/notarized"
APP="$OUT/LIMEN Vault.app"
: "${LIMEN_SIGN_IDENTITY:?Developer ID identity required}"
: "${LIMEN_NOTARY_PROFILE:?Existing Keychain profile required}"
python3 -c 'import json,sys;assert json.load(open(sys.argv[1]))["status"]=="Accepted"' "$EVIDENCE/app-notary.json"
xcrun stapler staple "$APP" > "$EVIDENCE/app-staple.log" 2>&1
xcrun stapler validate "$APP" >> "$EVIDENCE/app-staple.log" 2>&1
codesign --verify --deep --strict "$APP"
spctl --assess --type execute --verbose=4 "$APP" > "$EVIDENCE/app-gatekeeper.log" 2>&1
mkdir "$OUT/stage"
ditto "$APP" "$OUT/stage/LIMEN Vault.app"
ln -s /Applications "$OUT/stage/Applications"
cp "$ROOT/manuale UI utente.txt" "$OUT/stage/manuale UI utente.txt"
DMG="$OUT/LIMEN-Vault-0.2.0-arm64.dmg"
hdiutil create -volname 'LIMEN Vault Italiano' -srcfolder "$OUT/stage" -format UDZO "$DMG"
codesign --timestamp --sign "$LIMEN_SIGN_IDENTITY" "$DMG"
xcrun notarytool submit "$DMG" --keychain-profile "$LIMEN_NOTARY_PROFILE" --no-s3-acceleration --wait --timeout 10m --output-format json > "$EVIDENCE/dmg-notary.json"
python3 -c 'import json,sys;assert json.load(open(sys.argv[1]))["status"]=="Accepted"' "$EVIDENCE/dmg-notary.json"
xcrun stapler staple "$DMG" > "$EVIDENCE/dmg-staple.log" 2>&1
xcrun stapler validate "$DMG" >> "$EVIDENCE/dmg-staple.log" 2>&1
spctl --assess --type open --context context:primary-signature --verbose=4 "$DMG" > "$EVIDENCE/dmg-gatekeeper.log" 2>&1
