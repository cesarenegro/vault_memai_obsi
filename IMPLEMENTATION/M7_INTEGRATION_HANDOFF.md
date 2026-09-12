# M7REV Integration Handoff — Output AI e Proposte con Revisione Umana

Data: 12 settembre 2026  
Stato: **Modulo `@limen-vault/proposal-engine` completato e verificato al 100% in isolamento con test dedicati.**  
Integrazioni condivise (Tauri IPC, Rust, UI App.tsx, vault-ipc.ts, TASK_LIST.md) pronte in specifica e in attesa del rilascio dei file condivisi da parte di Codex (impegnato su M6REV).

---

## 1. Modifiche Apportate in `@limen-vault/proposal-engine`

Tutte le modifiche M7REV sono state confinate all'interno di `packages/proposal-engine/src/` e `packages/proposal-engine/tests/` senza toccare alcun file condiviso o manifest di dipendenze:

1. **Contratti ed Interfacce ([packages/proposal-engine/src/index.ts](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/packages/proposal-engine/src/index.ts)):**
   - Definizione dei tipi `AIOutputItem`, `ProposalItem`, `ProposalRevisionRecord`, `ProposalDecision`, `ApprovalResult`, `AICitationSource`.
   - Distinzione esplicita tra lo stato del workflow (`pending`, `approved`, `rejected`) e lo stato del frontmatter (`draft`, `review`, `approved`, `archived`). Note e bozze conservano `status: "draft"` prima della pubblicazione; `rejected` è una decisione del workflow e non uno stato frontmatter valido.

2. **Sicurezza dei Percorsi ([packages/proposal-engine/src/path-safety.ts](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/packages/proposal-engine/src/path-safety.ts)):**
   - Helper autonomi `sanitizeVaultPath`, `validateSymlinkSafety`, `isSubdirectoryOrEqual` per il confinamento al Vault e la protezione da attacchi di path traversal o symlink.

3. **Frontmatter Serializer / Parser ([packages/proposal-engine/src/frontmatter-utils.ts](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/packages/proposal-engine/src/frontmatter-utils.ts)):**
   - Gestione autonoma del frontmatter YAML per note e bozze. Imposta esplicitamente `status: "draft"` per bozze/output e `status: "approved"` all'atto della pubblicazione da parte dell'utente umano.

4. **Persistenza e Lock Atomico ([packages/proposal-engine/src/proposal-store.ts](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/packages/proposal-engine/src/proposal-store.ts)):**
   - Indice persistente in `00_SYSTEM/PROPOSAL_INDEX.json` con scrittura atomica tramite file temporaneo `.tmp`. Traccia output AI, proposte, revisioni, hash dei byte e decisioni di approvazione/rifiuto.

5. **Salvataggio Output AI ([packages/proposal-engine/src/ai-output-store.ts](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/packages/proposal-engine/src/ai-output-store.ts)):**
   - Salvataggio esplicito delle risposte AI in `80_AI_OUTPUTS/out_${hash}.md` con `status: "draft"`.
   - Redazione automatica di eventuali token/chiavi API (`sanitizeCredentials`).
   - Sola lettura RAW: nessuna scrittura in `20_RAW_SOURCES/` né promozione automatica a conoscenza approvata.

6. **Gestore Proposte e Revisioni ([packages/proposal-engine/src/proposal-engine.ts](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/packages/proposal-engine/src/proposal-engine.ts)):**
   - `createProposal`: Creazione bozza in `90_PROPOSALS/` con revisione 1, conservando la provenienza dell'output/fonte originale.
   - `updateProposalRevision`: Incremento numero revisione (es. rev 2), conservazione della cronologia delle revisioni umane e aggiornamento dei byte su disco.
   - `rejectProposal`: Aggiornamento dello stato del workflow a `rejected` con motivazione registrata, preservando il file originale della proposta su disco senza cancellarlo.

7. **Approvazione Umana ed Invariante di Sola Lettura ([packages/proposal-engine/src/approver.ts](file:///Users/cesare/Documents/MEMAI%20V_FALLBACK%20OBSIDIAN/packages/proposal-engine/src/approver.ts)):**
   - **Byte-Verification:** Verifica SHA-256 dei byte su disco della proposta rispetto a `expectedSha256`. Se il contenuto della proposta è stato modificato su disco dopo l'anteprima, rifiuta l'approvazione con `conflictDetected: true`.
   - **Confinamento Categorie:** Destinazione confinata esclusivamente alle cartelle ufficiali approvate (`01_CLIENTS/` .. `08_RESEARCH/`).
   - **Controllo Collisione:** Rifiuto di sovrascritture silenziose se il file approvato esiste già (richiede `allowOverwrite: true` esplicito).
   - **Transizione Stato:** Transizione del frontmatter da `draft` ad `approved`. Scrittura atomica della nota pubblicata nella cartella approvata.
   - **Immutabilità RAW:** I file in `20_RAW_SOURCES/` restano 100% in sola lettura e non vengono mai toccati.

---

## 2. Test Mirati Eseguiti ed Esito

Eseguito `npx tsx tests/proposal-engine.test.ts` in `packages/proposal-engine`:

- `✔ AI Output Store — saves AI response into 80_AI_OUTPUTS with draft frontmatter and redacts keys`
- `✔ Proposal Engine — creates, lists, updates revisions, and rejects candidate proposals`
- `✔ Approver — human approval publishes proposal into approved category with status: approved and byte verification`
- `✔ Approver — detects byte conflict mismatch and target collisions`

**Risultato:** 4 suite su 4 **100% PASS** in 25ms.  
Build TypeScript (`pnpm --filter @limen-vault/proposal-engine build`) completata con **0 errori**.

---

## 3. Integrazioni Condivise da Applicare (Dopo che Codex avrà liberato i file)

Le seguenti modifiche dovranno essere collegate e riconciliate quando i file condivisi saranno liberi:

### A. Manifest Dipendenze (`packages/proposal-engine/package.json`)
- Aggiungere `"@limen-vault/vault-core": "workspace:*"` e `"type": "module"`.
- Aggiornare lo script `"test": "node --import tsx/esm tests/proposal-engine.test.ts"`.

### B. Modulo Nativo Rust & Comandi IPC (`apps/desktop/src-tauri/src/proposals.rs` & `main.rs`)
- Implementare modulo Rust `proposals.rs` che rispecchia i contratti di approvazione, verifica SHA-256 e salvataggio output in `80_AI_OUTPUTS/` e `90_PROPOSALS/`.
- Esporre comandi IPC Tauri: `save_ai_output`, `list_ai_outputs`, `create_proposal`, `list_proposals`, `update_proposal_revision`, `reject_proposal`, `approve_proposal`.

### C. Client IPC Frontend (`apps/desktop/src/vault-ipc.ts`)
- Aggiungere i metodi IPC per il salvataggio output AI, la gestione proposte e l'approvazione umana con parametro `expectedSha256`.

### D. Interfaccia UI (`apps/desktop/src/App.tsx`)
- **Schermata Ask Knowledge / AI Outputs:** Aggiungere pulsante *"Save Output"* che invoca `saveAIOutput` per salvare la risposta in `80_AI_OUTPUTS/` senza pubblicarla direttamente.
- **Schermata Candidate Proposals:** Collegare l'elenco delle proposte in `90_PROPOSALS/` con selettore revisioni, confronto diff, form motivazione rifiuto e pulsante *"Approve & Publish"* che invoca `approveProposal` inviando l'hash atteso `expectedSha256`.
- **Re-indicizzazione M5:** All'atto dell'approvazione di una proposta, notificare o attivare la re-indicizzazione esplicita in M5 per rendere la nuova nota approvata immediatamente ricercabile.

### E. Checklist Principale (`TASK_LIST.md`)
- Aggiornare lo stato di avanzamento per la Milestone M7REV.
