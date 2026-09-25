# LIMEN Vault V5 — Manuale Utente

Edizione corrente: 25 settembre 2026 · versione 0.5.0 (macOS).

- [Manuale dell’interfaccia utente completo (con grafici Mermaid)](manuale%20UI%20utente.txt)
- [Guida per i Tester Mac](IMPLEMENTATION/ISTRUZIONI_TESTER_MAC.md)
- [Documentazione HELP integrata](HELP/00_INDICE.md)

## Guida Rapida

1. **Apertura del Vault**: Avvia **LIMEN Vault V5**, clicca su **APRI VAULT ESISTENTE** e attendi qualche secondo per la verifica e ricostruzione dell'indice.
2. **Motore Semantico RAG Locale**: In **Avanzate → Collegamenti AI & MCP → Motore semantico**, scarica il modello bge-m3 con **SCARICA MODELLO (635 MB)** (stato verde: `INSTALLATO (SHA-256 OK)`). Il servizio locale parte da solo in background all'apertura dell'applicazione attestandosi su `ATTIVO`.
3. **Consenso e Chiave OpenAI**: Nel riquadro **Impostazioni OpenAI & Consenso**, attiva la spunta obbligatoria **"Consenti l'invio a OpenAI dei passaggi pertinenti per generare le risposte"**, seleziona il **Modello OpenAI predefinito** (es. `gpt-4o-mini`) e salva la tua chiave API nel Portachiavi con **Salva chiave**.
4. **Chiedi al Vault (Chat Continua)**: Nella scheda **Chiedi**, poni domande nella casella fissa in basso; le risposte compaiono a sinistra con il contatore **"N fonti citate"** per aprire le fonti nella barra laterale, consultare i dettagli dei passaggi e aprire i documenti originali con **Apri documento**.
