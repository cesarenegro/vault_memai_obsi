# LIMEN Vault V5 — Manuale Utente

Edizione corrente: 25 settembre 2026 · versione 0.5.0 (macOS).

---

## File Creati o Modificati in Questa Sessione (FASE 7 Mac & FASE 8 Ministral)

Di seguito l'elenco completo dei file di documentazione, configurazione e codice creati o aggiornati in questa sessione di lavoro:

1. [apps/desktop/src-tauri/src/llama_llm.rs](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/apps/desktop/src-tauri/src/llama_llm.rs)  
   *Percorso assoluto:* `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src-tauri/src/llama_llm.rs`  
   *Descrizione:* Modulo backend Rust per la gestione del ciclo di vita del modello generativo locale Ministral 3 8B Instruct Q5_K_M (~6,06 GB), downloader streaming SHA-256 e istanza dedicata di `llama-server` su Metal GPU.

2. [apps/desktop/src-tauri/src/ai.rs](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/apps/desktop/src-tauri/src/ai.rs)  
   *Percorso assoluto:* `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src-tauri/src/ai.rs`  
   *Descrizione:* Router di streaming unificato con supporto a doppio binario: dispatch verso OpenAI Responses API o Chat Completions su `llama-server` locale, con eventi SSE unificati.

3. [apps/desktop/src-tauri/src/main.rs](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/apps/desktop/src-tauri/src/main.rs)  
   *Percorso assoluto:* `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src-tauri/src/main.rs`  
   *Descrizione:* Registrazione stato applicativo `LlamaLlmServerState`, comandi IPC `local_llm_*` e arresto pulito dei processi alla chiusura dell'app.

4. [apps/desktop/src/ai-ipc.ts](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/apps/desktop/src/ai-ipc.ts)  
   *Percorso assoluto:* `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src/ai-ipc.ts`  
   *Descrizione:* Metodi IPC TypeScript e interfaccia per lo stato del modello locale Ministral e del relativo server.

5. [apps/desktop/src/AiPanel.tsx](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/apps/desktop/src/AiPanel.tsx)  
   *Percorso assoluto:* `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src/AiPanel.tsx`  
   *Descrizione:* Pulsante toggle Verde Lime ("SOLO LOCALE (Mac)"), modale di download per Ministral (~6,06 GB), badge in calce alla risposta (`Generato sul Mac · Ministral 3 8B Instruct Q5_K_M (Offline)`).

6. [apps/desktop/src/SemanticEngineSettings.tsx](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/apps/desktop/src/SemanticEngineSettings.tsx)  
   *Percorso assoluto:* `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src/SemanticEngineSettings.tsx`  
   *Descrizione:* Nuova Sezione 4 per la gestione del modello generativo locale Ministral 3 8B (stato installazione, monitoraggio memoria Metal GPU, download e avvio/arresto).

7. [IMPLEMENTATION/ISTRUZIONI_TESTER_MAC.md](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/IMPLEMENTATION/ISTRUZIONI_TESTER_MAC.md)  
   *Percorso assoluto:* `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/IMPLEMENTATION/ISTRUZIONI_TESTER_MAC.md`  
   *Descrizione:* Guida collaudo tester per macOS con la descrizione della doppia modalità Ibrida vs Solo Locale.

8. [manuale UI utente.txt](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/manuale%20UI%20utente.txt)  
   *Percorso assoluto:* `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/manuale UI utente.txt`  
   *Descrizione:* Manuale operativo integrale aggiornato con la sezione sulla modalità 100% Solo Locale Ministral e diagrammi di flusso.

---

## Riferimenti e Documentazione


## Guida illustrata A4 orizzontale

Edizione 25 settembre 2026: 42 pagine, 37 procedure con diagrammi Mermaid, stile del manuale CRM.

- [PDF pronto per la lettura](output/guida_utente/LIMEN_Vault_V5_Manuale_Utente_A4_Orizzontale.pdf)
- [Word modificabile](output/guida_utente/LIMEN_Vault_V5_Manuale_Utente_A4_Orizzontale.docx)
- [Manuale con sorgenti Mermaid](output/guida_utente/LIMEN_Vault_V5_Manuale_Utente_Mermaid.md)
- [Fonti e verifiche](output/guida_utente/FONTI_E_VERIFICHE.md)

## Materiali di partenza

- [Manuale dell’interfaccia utente completo (con grafici Mermaid)](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/manuale%20UI%20utente.txt)
- [Guida per i Tester Mac](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/IMPLEMENTATION/ISTRUZIONI_TESTER_MAC.md)
- [Documentazione HELP integrata](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/HELP/00_INDICE.md)

---

## Guida Rapida Operativa

1. **Apertura del Vault**: Avvia **LIMEN Vault V5**, clicca su **APRI VAULT ESISTENTE** e attendi qualche secondo per la verifica e ricostruzione dell'indice.
2. **Motore Semantico RAG Locale**: In **Avanzate → Collegamenti AI & MCP → Motore semantico**, scarica il modello bge-m3 con **SCARICA MODELLO (635 MB)** (stato verde: `INSTALLATO (SHA-256 OK)`). Il servizio locale parte da solo in background all'apertura dell'applicazione attestandosi su `ATTIVO`.
3. **Consenso e Chiave OpenAI**: Nel riquadro **Impostazioni OpenAI & Consenso**, attiva la spunta obbligatoria **"Consenti l'invio a OpenAI dei passaggi pertinenti per generare le risposte"**, seleziona il **Modello OpenAI predefinito** (es. `gpt-4o-mini`) e salva la tua chiave API nel Portachiavi con **Salva chiave**.
4. **Chiedi al Vault (Chat Continua)**: Nella scheda **Chiedi**, poni domande nella casella fissa in basso; le risposte compaiono a sinistra con il contatore **"N fonti citate"** per aprire le fonti nella barra laterale, consultare i dettagli dei passaggi e aprire i documenti originali con **Apri documento**.
