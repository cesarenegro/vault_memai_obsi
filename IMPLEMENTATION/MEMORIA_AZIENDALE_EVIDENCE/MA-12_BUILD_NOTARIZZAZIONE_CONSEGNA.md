# Evidenza di Collaudo MA-12: Build, Notarizzazione e Consegna LIMEN Vault v3

## Dati di Release

- **Nome Prodotto Ufficiale**: `LIMEN Vault v3`
- **Versione**: `0.3.0`
- **Architettura**: `macOS Apple Silicon (arm64)`
- **Bundle Identifier**: `dev.arkai.limenvault`
- **Identità di Firma Developer ID**: `Developer ID Application: Arkitecna Hong Kong Limited (ZVGX4HFZC3)` (`E01892F9C136DA67B393B9CD29AF97E369956968`)
- **Notary Profile Apple**: `LIMEN-M9`

## Artefatti Prodotti e Collaudati

1. **Applicazione Firmata e Notarizzata**:
   - Percorso: `.local/limen-v3-final/LIMEN Vault v3.app`
   - Gatekeeper Status: `accepted (source=Notarized Developer ID)`
   - Verifica Codice: `valid on disk; satisfies its Designated Requirement`

2. **Immagine Disco DMG per Installazione Utente**:
   - Percorso: `.local/limen-v3-final/LIMEN-Vault-v3-arm64.dmg`
   - SHA-256: `d6f36e8a323bf9d73e219956dc653b63143898eea5386b33977e233a07199764`
   - Notary Submission ID: `b29ccea0-5c47-40b3-95e8-438981dcdc29`
   - Esito Notary Apple: `Accepted`
   - Stapler: `The staple and validate action worked!`
   - Spctl Assessment:
     ```
     /Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/.local/limen-v3-final/LIMEN-Vault-v3-arm64.dmg: accepted
     source=Notarized Developer ID
     origin=Developer ID Application: Arkitecna Hong Kong Limited (ZVGX4HFZC3)
     ```

3. **Archivio App Zip Notarizzato**:
   - Percorso: `.local/limen-v3-final/app-v3.zip`
   - SHA-256: `878c7c7d2188dec7e560d1be1b096b747409410d654369d218f3013111fd4089`
   - Notary Submission ID: `72b72393-bca4-4c69-ab45-788b087d86a6`
   - Esito Notary Apple: `Accepted`

## Documentazione e Contenuti nel DMG
Nel volume `LIMEN Vault v3` sono inclusi:
- `LIMEN Vault v3.app` (applicazione principale)
- Collegamento ad `/Applications`
- `HELP v3` (documentazione completa offline)
- `Guida utente LIMEN v3.md`
- `Manuale LIMEN v3.txt`
- `LEGGIMI-v3.txt`
