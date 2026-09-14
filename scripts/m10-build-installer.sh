#!/bin/bash
# Reproducible installer build; SOURCE_DMG must be the verified LIMEN release.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${SOURCE_DMG:?Set path to verified LIMEN 0.2.0 DMG}"
: "${INSTALLER_OUT:?Set a new output directory}"
: "${LIMEN_SIGN_IDENTITY:?Set Developer ID Application SHA-1}"
: "${LIMEN_NOTARY_PROFILE:?Set Keychain notarization profile}"
if [ -e "$INSTALLER_OUT" ]; then echo 'Output already exists; preserved.' >&2; exit 1; fi
mkdir -p "$INSTALLER_OUT"
APP="$INSTALLER_OUT/Installa LIMEN Vault.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
swiftc -swift-version 5 "$ROOT/tools/mac-installer/main.swift" -o "$APP/Contents/MacOS/installer" -framework AppKit
cp "$SOURCE_DMG" "$APP/Contents/Resources/LIMEN.dmg"
python3 - "$APP" <<'PY'
import pathlib,plistlib,sys
p={'CFBundleExecutable':'installer','CFBundleIdentifier':'dev.arkai.limenvault.installer','CFBundleName':'Installa LIMEN Vault','CFBundleDisplayName':'Installa LIMEN Vault','CFBundleShortVersionString':'0.2.0','CFBundleVersion':'2','CFBundlePackageType':'APPL','LSMinimumSystemVersion':'26.3','NSHighResolutionCapable':True}
with (pathlib.Path(sys.argv[1])/'Contents/Info.plist').open('wb') as f:plistlib.dump(p,f)
PY
# Discard Finder metadata inherited by copied payloads before sealing this new bundle.
xattr -cr "$APP"
codesign --force --options runtime --timestamp --sign "$LIMEN_SIGN_IDENTITY" "$APP"
codesign --verify --deep --strict "$APP"
ditto -c -k --keepParent "$APP" "$INSTALLER_OUT/installer.zip"
xcrun notarytool submit "$INSTALLER_OUT/installer.zip" --keychain-profile "$LIMEN_NOTARY_PROFILE" --no-s3-acceleration --wait --timeout 10m --output-format json > "$INSTALLER_OUT/app-notary.json"
python3 -c 'import json,sys;assert json.load(open(sys.argv[1]))["status"]=="Accepted"' "$INSTALLER_OUT/app-notary.json"
xcrun stapler staple "$APP"
xcrun stapler validate "$APP"
mkdir "$INSTALLER_OUT/stage"
ditto "$APP" "$INSTALLER_OUT/stage/Installa LIMEN Vault.app"
cp "$ROOT/tools/mac-installer/LEGGIMI.txt" "$INSTALLER_OUT/stage/LEGGIMI.txt"
cp "$ROOT/manuale UI utente.txt" "$INSTALLER_OUT/stage/manuale UI utente.txt"
DMG="$INSTALLER_OUT/Installa-LIMEN-Vault-0.2.0-arm64.dmg"
hdiutil create -volname 'Installa LIMEN Vault' -srcfolder "$INSTALLER_OUT/stage" -format UDZO "$DMG"
codesign --timestamp --sign "$LIMEN_SIGN_IDENTITY" "$DMG"
xcrun notarytool submit "$DMG" --keychain-profile "$LIMEN_NOTARY_PROFILE" --no-s3-acceleration --wait --timeout 10m --output-format json > "$INSTALLER_OUT/dmg-notary.json"
python3 -c 'import json,sys;assert json.load(open(sys.argv[1]))["status"]=="Accepted"' "$INSTALLER_OUT/dmg-notary.json"
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"
spctl --assess --type open --context context:primary-signature "$DMG"
shasum -a 256 "$DMG" > "$INSTALLER_OUT/SHA256SUMS.txt"
