# M6 — evidenze di accettazione

- api-business-status.md: prove reali API desktop e Business, con limiti esatti e stato revoca.
- codex-e2e.jsonl: client Codex reale su MCP stdio, fixture condivisa.
- fixture.json: hash prima e dopo API, Codex e Business.
- ai-tests-final.log: 8 test AI TS passati, mock provider dichiarati nei soli test unitari.
- rust-tests-final.log: 22 lib + 18 bin passati, con casi condivisi duplicati.
- m6-e2e-release.log: protocollo MCP su release, parità TS e rifiuto indice falsificato.
- monorepo-tests-final.log, typecheck-final.log, build-final.log: tutti passati sul checkout finale.
- native-release-build-final.log: bundle macOS finale compilato dopo correzioni campo modello.
- offline-native-final.log: prove native M3 e M5 passate sotto sandbox con rete negata.

API: endpoint Responses fisso, citazioni ID/hash verificate; correttezza fattuale da revisionare sempre. RAW esclusi. M6 non scrive risposte nel Vault; M7 resta separata. Account/organizzazione e tunnel verificati nell’interfaccia corrente. Nessun segreto nei file di progetto. Nessun commit, push o deploy.
