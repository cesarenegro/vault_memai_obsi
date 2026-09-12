# M6 verifiche reali — 12 settembre 2026

API desktop: PASS. Chiave letta dal Portachiavi, modello gpt-4o-mini disponibile (HTTP 200). Anteprima di una fonte approvata, 615 byte. Risposta reale: Project Aurora launch date is 17 October 2026. Verification phrase: blue espresso. Modello restituito gpt-4o-mini-2024-07-18; 393 token. Apertura citazione con documento e SHA-256 corrispondenti alla fixture. Tutti i file della fixture invariati dopo API e Codex.

Business: PASS ricerca/lettura/risposta reale in Chrome, account cesare.negro@gmail.com e workspace Arkai for LIMEN VAULT. Nuova chiave verificata HTTP 200 con organizzazione esplicita. Tunnel privato avviato, /readyz 200. Plugin asdk_app_6aa556534f908191b1d45d8a001fefd3 connesso; list_vaults, search_vault, read_document rilevati come READ. Conversazione https://chatgpt.com/c/6aa556c0-5628-83ed-88d7-914253750852: data 17 October 2026, frase blue espresso, percorso 01_CLIENTS/approved.md, hash 846481b490e32c1e80d0fe622307c647800ea7e3b215cf101a900f7e6c1b7d0d. Traccia UI: Listed authorized vaults, searched Aurora information, and validated a source document. Fixture invariata. Tunnel fermato per prova interruzione; processo assente e health URL rimosso dal client. La successiva chiamata Business non ha restituito dati ed è stata interrotta manualmente mentre attendeva: non viene dichiarato osservato un timeout remoto concluso.

Il server stdio non aggiunge OAuth: l’autenticazione è del Secure MCP Tunnel e l’autorizzazione è vincolata al workspace associato e al Vault sintetico locale. Nessuna porta pubblica. Il plugin installato resta di sviluppo e il processo locale deve essere avviato per usarlo.

UI: corretta disattivazione maiuscole/autocorrezione e rimozione spazi esterni dal modello prima della preview. Bundle finale compilato con successo. La prova API UI è sul precedente bundle QA con valore modello corretto manualmente; non spacciata per verifica delle ultime due correzioni UI.

Revoca Business finale verificata: Plugin actions → Disconnect; UI tornata a Connection / Connect. Rapporto conclusivo: ../2026-09-12_M6_CLOSURE.md.
