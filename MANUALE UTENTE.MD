# LIMEN Vault V5 — Manuale Utente

Edizione corrente: 25 settembre 2026 · versione 0.5.0 (macOS).

---

## File Creati o Modificati in Questa Sessione (FASE 7 Mac)

Di seguito l'elenco completo dei file di documentazione, configurazione e codice creati o aggiornati in questa sessione di lavoro:

1. [IMPLEMENTATION/ISTRUZIONI_TESTER_MAC.md](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/IMPLEMENTATION/ISTRUZIONI_TESTER_MAC.md)  
   *Percorso assoluto:* `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/IMPLEMENTATION/ISTRUZIONI_TESTER_MAC.md`  
   *Descrizione:* Guida per i tester esterni di LIMEN Vault V5 per macOS (testi interfaccia reali, configurazione RAG bge-m3 offline, consenso OpenAI, chat continua FASE 6b).

2. [manuale UI utente.txt](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/manuale%20UI%20utente.txt)  
   *Percorso assoluto:* `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/manuale UI utente.txt`  
   *Descrizione:* Manuale operativo integrale dell'interfaccia LIMEN Vault V5, comprensivo di tutti i workflow dettagliati per ogni operazione e grafici Mermaid intuitivi.

3. [MANUALE UTENTE.MD](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/MANUALE%20UTENTE.MD)  
   *Percorso assoluto:* `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/MANUALE UTENTE.MD`  
   *Descrizione:* Scheda riepilogativa e indice di riferimento per Obsidian e consultazione rapida del Vault.

4. [HELP/03_HELP_SCHERMATE.md](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/HELP/03_HELP_SCHERMATE.md)  
   *Percorso assoluto:* `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/HELP/03_HELP_SCHERMATE.md`  
   *Descrizione:* Documentazione integrata delle schermate dell'app, con la sezione Chiedi al Vault allineata alla FASE 6b (chat a turni, casella fissa in basso, contatore fonti citate, cassetto fonti e pulsante Apri documento).

5. [HELP/04_WORKFLOW.md](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/HELP/04_WORKFLOW.md)  
   *Percorso assoluto:* `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/HELP/04_WORKFLOW.md`  
   *Descrizione:* Diagrammi di workflow dell'applicazione, con il sequence diagram W5 aggiornato al flusso di messaggistica continua con citazione fonti e apertura documento.

6. [apps/desktop/src-tauri/src/llama.rs](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/apps/desktop/src-tauri/src/llama.rs)  
   *Percorso assoluto:* `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src-tauri/src/llama.rs`  
   *Descrizione:* Risoluzione del rilevamento del binario `llama-server` nel bundle di produzione macOS (`Contents/Resources/native/llama-server`) e corretta propagazione dei messaggi di log in caso di mancato avvio.

7. [apps/desktop/src-tauri/src/main.rs](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/apps/desktop/src-tauri/src/main.rs)  
   *Percorso assoluto:* `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/apps/desktop/src-tauri/src/main.rs`  
   *Descrizione:* Registrazione dell'hook `resource_dir` per mappare in modo affidabile la directory delle risorse native del pacchetto macOS.

8. [Pacchetto DMG: LIMEN-Vault-V5-0.5.0-arm64.dmg](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/.local/limen-v5-release/LIMEN-Vault-V5-0.5.0-arm64.dmg)  
   *Percorso assoluto:* `/Users/cesare/Documents/MEMAI V_FALLBACK OBSIDIAN/.local/limen-v5-release/LIMEN-Vault-V5-0.5.0-arm64.dmg`  
   *Descrizione:* Pacchetto d'installazione ufficiale per macOS Apple Silicon firmato e notarizzato con Developer ID.

---

## Riferimenti e Documentazione

- [Manuale dell’interfaccia utente completo (con grafici Mermaid)](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/manuale%20UI%20utente.txt)
- [Guida per i Tester Mac](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/IMPLEMENTATION/ISTRUZIONI_TESTER_MAC.md)
- [Documentazione HELP integrata](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/HELP/00_INDICE.md)

---

## Guida Rapida Operativa

1. **Apertura del Vault**: Avvia **LIMEN Vault V5**, clicca su **APRI VAULT ESISTENTE** e attendi qualche secondo per la verifica e ricostruzione dell'indice.
2. **Motore Semantico RAG Locale**: In **Avanzate → Collegamenti AI & MCP → Motore semantico**, scarica il modello bge-m3 con **SCARICA MODELLO (635 MB)** (stato verde: `INSTALLATO (SHA-256 OK)`). Il servizio locale parte da solo in background all'apertura dell'applicazione attestandosi su `ATTIVO`.
3. **Consenso e Chiave OpenAI**: Nel riquadro **Impostazioni OpenAI & Consenso**, attiva la spunta obbligatoria **"Consenti l'invio a OpenAI dei passaggi pertinenti per generare le risposte"**, seleziona il **Modello OpenAI predefinito** (es. `gpt-4o-mini`) e salva la tua chiave API nel Portachiavi con **Salva chiave**.
4. **Chiedi al Vault (Chat Continua)**: Nella scheda **Chiedi**, poni domande nella casella fissa in basso; le risposte compaiono a sinistra con il contatore **"N fonti citate"** per aprire le fonti nella barra laterale, consultare i dettagli dei passaggi e aprire i documenti originali con **Apri documento**.
