---
title: "LIMEN Vault — Note di audit sulla documentazione"
type: help
tags: [limen-vault, audit]
---

# Note di audit — codice e documenti a confronto (16 settembre 2026)

Torna all'indice: [[00_INDICE]]

Verifica eseguita leggendo i file del repository `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN`.
L'app non è stata avviata: gli aspetti visivi sono dedotti dal codice.

## Confermato dal codice

- Versione 0.2.0, identificativo `dev.arkai.limenvault`, macOS minimo 26.3 (`apps/desktop/src-tauri/tauri.conf.json`).
- 11 voci di menu e relative etichette italiane (`apps/desktop/src/App.tsx`, righe 407–417).
- 15 cartelle obbligatorie e 3 file di sistema (`apps/desktop/src-tauri/src/vault.rs`).
- Formati compilabili `.md .markdown .txt .html .htm` (`compiler.rs`).
- Anteprima AI valida 300 s, timeout HTTPS 30 s, domanda max 2.000 caratteri (`ai.rs`, `AiPanel.tsx`).
- MCP: `127.0.0.1` su porta casuale, percorso `/mcp`, strumenti `list_vaults`, `search_vault`, `read_document` (`mcp.rs`).
- `--mcp-stdio` richiede esattamente un argomento percorso (`main.rs`, riga 244–245).
- Tunnel arrestato alla chiusura dell'app (`main.rs`, riga 313).

## Discrepanze e punti deboli

| # | Dove | Problema | Impatto utente |
| --- | --- | --- | --- |
| 1 | `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/MANUALE UTENTE.MD` | Indica il comando MCP con `/Users/cesare/Applications/LIMEN Vault.app/...`, mentre il manuale UI 0.2.0 indica `LIMEN Vault 0.2.0.app`. In `/Users/cesare/Applications` esistono **tre** app: `LIMEN Vault 0.2.0.app`, `LIMEN Vault M10.app`, `LIMEN Vault.app` | Codex può avviare una versione vecchia. Il nome del binario dentro l'app non è stato verificato (cartella non collegata) |
| 2 | `MANUALE UTENTE.MD` | Usa ancora le etichette inglesi (CREATE NEW VAULT, SAVE KEY…) superate dalla 0.2.0 italiana | Confusione: tenere solo `manuale UI utente.txt` o questa guida |
| 3 | `README.md` | Dice "Latest completed milestone: M3"; `docs/MILESTONES.md` riporta M9 completata | Documento non aggiornato |
| 4 | `docs/ARCHITECTURE.md` | Parla di "14-folder" struttura; il codice ne richiede 15 | Documento non aggiornato |
| 5 | `docs/UI_INFORMATION_ARCHITECTURE.md` | Elenca 11 schermate senza Trasferimenti e con nomi inglesi | Documento non aggiornato |
| 6 | `apps/desktop/src/App.tsx` (Impostazioni) | Il campo *Cartella locale del Vault* è modificabile e cambia il percorso in memoria senza validazione | Rischio: l'utente crede di aver cambiato Vault. Meglio renderlo sola lettura |
| 7 | `App.tsx` (Accesso rapido) | Gli 8 pulsanti categoria aprono Conoscenza senza preselezionare la categoria; mancano Concorrenti e Contenuti approvati | Aspettativa tradita |
| 8 | `App.tsx` (menu) | Sigle interne M6, M3, M10 visibili all'utente | Rumore; da rimuovere nella UI finale |
| 9 | `App.tsx` riga 624 | Il riquadro stato usa solo `READY` o `INVALID`: `INCOMPLETE` e `NOT_ACCESSIBLE` vengono mostrati come `INVALID`. La traduzione di `INVALID` non è in `locale.tsx`; la resa dipende da `packages/ui` (non verificato) | Possibile etichetta inglese o stato poco preciso |
| 10 | `packages/vault-schema/src/knowledge.ts` | `status` ha valore predefinito `approved` se assente | Una nota senza `status` potrebbe essere trattata come approvata. Da verificare nel codice Rust di indice e pubblicazione |
| 11 | `SyncPanel.tsx` | *Collega archivio* accetta un JSON (`endpoint`, `token`): il formato non è spiegato nell'interfaccia | L'amministratore deve fornire il codice già nel formato giusto |
| 12 | Aiuto | Il menu Aiuto non apre nessun manuale; il manuale è un file separato | Questa cartella HELP potrebbe essere inclusa nel bundle e collegata al menu |

## Non verificato in questa sessione

- Resa grafica reale delle schermate (app non avviata).
- Menu nativi macOS (ripresi dal manuale UI del 13 settembre).
- Comportamento del servizio cloud in produzione e mapping Cliente/Progetto con note reali (anche la documentazione dichiara M10 non certificata).
