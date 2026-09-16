---
title: "LIMEN Vault — Tutorial completo"
type: help
tags: [limen-vault, tutorial]
---

# Tutorial completo — un giro intero su un Vault di prova

Torna all'indice: [[00_INDICE]]

Durata: dipende dalle note che scrivi; nessuna stima fissa.
Obiettivo: attraversare **tutte** le sezioni dell'app su un Vault che puoi buttare via,
senza toccare il Vault reale `/Users/cesare/Documents/VAULT`.

> Nel tutorial il Vault di prova si chiama `/Users/cesare/Documents/VAULT-PROVA`.
> È un **nome di esempio**: usa qualsiasi cartella che ancora non esiste.

---

## Lezione 1 — Creare il Vault di prova

1. Avvia LIMEN Vault.
2. In **Percorso del Vault (cartella locale)** scrivi `/Users/cesare/Documents/VAULT-PROVA`.
3. Premi **CREA NUOVO VAULT**.

**Risultato atteso**
- Stato *Pronto*.
- Panoramica: **File Markdown = 2** (`00_SYSTEM/HOME.md` e `00_SYSTEM/VAULT_RULES.md`), **Fonti originali = 0**, **File delle proposte = 0**.
- Sul disco compaiono le 15 cartelle (`00_SYSTEM` … `99_ARCHIVE`) e i tre file di sistema (`HOME.md`, `VAULT_RULES.md`, `VAULT_MANIFEST.json`).

**Perché funziona così**: la creazione rifiuta cartelle occupate e non sovrascrive nulla. Se fallisce a metà, i file parziali restano: scegli un'altra cartella, non cancellare a caso.

---

## Lezione 2 — Collegare Obsidian

1. Premi **Apri in Obsidian** (sotto il menu laterale o nel riepilogo).
2. La prima volta Obsidian non conosce la cartella: scegli **Open folder as vault**, seleziona `VAULT-PROVA`, conferma.
3. Torna in LIMEN e premi di nuovo **Apri in Obsidian**: ora si apre direttamente.

Se il pulsante non funziona, controlla **Sistema → Applicazione Obsidian**: deve dire *Rilevata e disponibile*.

---

## Lezione 3 — Scrivere la prima nota

In Obsidian crea il file `01_CLIENTS/cliente-demo.md` con questo contenuto:

```markdown
---
schema_version: 1
id: cliente-demo
title: "Cliente Demo"
type: client
client: cliente-demo
status: approved
created_at: "2026-09-16T00:00:00Z"
updated_at: "2026-09-16T00:00:00Z"
tags: [demo, tutorial]
---

# Cliente Demo

Produttore di pasta secca. Richiede packaging in carta riciclabile.
```

Regole del blocco proprietà (frontmatter), verificate su `packages/vault-schema/src/knowledge.ts`:

| Campo | Obbligatorio | Valori |
| --- | --- | --- |
| `id`, `title`, `created_at`, `updated_at` | sì | testo; date tra virgolette |
| `type` | sì | `client`, `project`, `brand`, `positioning`, `packaging`, `method`, `case_study`, `research`, `competitor`, `approved_output`, `raw_source`, `ai_output`, `proposal` |
| `status` | no (lo schema usa `approved` se manca) | `draft`, `review`, `approved`, `archived` |
| `client`, `project`, `brand`, `snapshot_id` | no | testo |
| `tags`, `source_ids` | no | lista |
| `schema_version` | no | numero intero |

**Consiglio**: scrivi sempre `status` in modo esplicito, così nessuno deve ricordarsi il valore predefinito.
Una nota senza frontmatter è accettata con un avviso; un frontmatter scritto male rende il Vault *non valido*.

Torna in LIMEN → **Conoscenza** → categoria **Clienti** → **AGGIORNA CONOSCENZA**. La nota compare; aprila e controlla percorso, stato e impronta.

---

## Lezione 4 — Indicizzare e cercare

1. **Ricerca** → **AGGIORNA INDICE DI RICERCA**. La riga *Stato indice* mostra quanti documenti sono indicizzati e quando.
2. Nel campo *Cerca parole, titoli, proprietà, etichette...* scrivi `pasta`.
3. Prova i filtri: categoria *Clienti*, *Filtra per cliente* = `cliente-demo`, *Filtra per etichette* = `demo`, stato *Approvata*.

Se non trovi nulla: togli i filtri, riaggiorna l'indice, verifica che il file esista.

---

## Lezione 5 — Da documento grezzo a bozza compilata

1. Nel Finder copia un file `.md`, `.markdown`, `.txt`, `.html` o `.htm` in `VAULT-PROVA/20_RAW_SOURCES/` (esempio: `brief-demo.txt`). L'app non ha un pulsante di caricamento.
2. **Fonti** → **AGGIORNA FONTI**. La riga mostra lo stato *Da compilare*.
3. Premi **Compila bozza** sulla riga (oppure **COMPILA TUTTE LE FONTI**).
4. Leggi il *Riepilogo compilazione* (compilate, invariate, non supportate, errori).
5. La bozza è in `90_PROPOSALS/` con `status: draft`. L'originale in `20_RAW_SOURCES` resta intatto.

Se poi modifichi il file grezzo, lo stato diventa *Modificata*: ricompila.

---

## Lezione 6 — Approvare la bozza compilata

1. **Proposte** → apri **Importa una bozza compilata da revisionare**.
2. Scegli la **Categoria** (es. Clienti) → apri la bozza → leggila → **IMPORTA BOZZA MOSTRATA**.
3. Apri la proposta con stato *Da revisionare*. Controlla testo, **Fonti e provenienza**, **Cronologia delle revisioni conservate**.
4. (Facoltativo) Correggi: scrivi il testo in **Testo della nuova revisione**, confronta *Testo attuale* / *Testo proposto*, premi **SALVA NUOVA REVISIONE (CONSERVA LA PRECEDENTE)**.
5. In **Nuova destinazione (.md)** scrivi `01_CLIENTS/cliente-demo-brief.md` (file nuovo, dentro la cartella della categoria scelta).
6. Spunta **Ho verificato questa revisione e la destinazione indicata.**
7. Premi **APPROVA REVISIONE MOSTRATA**.
8. **Conoscenza → Clienti → AGGIORNA CONOSCENZA**, poi **Ricerca → AGGIORNA INDICE DI RICERCA**.

Per esercitarti sul rifiuto: su un'altra proposta scrivi il **Motivo del rifiuto** e premi **RIFIUTA REVISIONE MOSTRATA**. La bozza non viene cancellata.

---

## Lezione 7 — Chiedere a OpenAI

Prerequisiti: una chiave API OpenAI e l'indice aggiornato.

1. **Impostazioni** → *Chiave API OpenAI* → **SALVA CHIAVE** (macOS può chiedere l'autorizzazione al Portachiavi) → **VERIFICA PORTACHIAVI**.
2. **Chiedi al Vault** → *Modello OpenAI*: scrivi l'identificativo di un modello attivo nel tuo account (l'app non lo verifica prima dell'invio).
3. Domanda (max 2.000 caratteri): `Che packaging richiede Cliente Demo?`
4. Lascia **non spuntata** *Includi bozze indicizzate e note non approvate* per usare solo note approvate.
5. **ANTEPRIMA FONTI** → apri le fonti mostrate e controllale.
6. Entro 5 minuti (l'anteprima scade dopo 300 secondi nel codice `ai.rs`) premi **INVIA A OPENAI LE FONTI MOSTRATE**.
7. Leggi la risposta e apri le citazioni.
8. **SALVA RISPOSTA COME BOZZA** → messaggio *Bozza salvata in locale*.

---

## Lezione 8 — Dalla risposta AI alla nota approvata

1. **Risposte AI** → **AGGIORNA** → apri la risposta salvata.
2. Scegli la **Categoria** di destinazione → **CREA PROPOSTA DALLA RISPOSTA SALVATA**.
3. Vai in **Proposte** e ripeti i passi 3–8 della Lezione 6.

---

## Lezione 9 — Copia locale e verifica integrità

1. **Copie locali** → nota facoltativa `prima prova` → **CREA COPIA LOCALE**.
2. La tabella mostra ID copia, data, nota, numero di file e *Verificata (SHA-256)*.
3. Esperimento (solo sul Vault di prova): nel Finder modifica un file **dentro** la copia in `00_SYSTEM/SNAPSHOTS/snap-…/`, poi **VERIFICA INTEGRITÀ** → la copia risulta *Danneggiata*, il Vault resta intatto.

Nota: dopo aver scritto note nuove, la scheda *Integrità SHA-256* della Panoramica può mostrare *Differenze rilevate* (file aggiunti rispetto al manifesto). È normale se le modifiche sono tue: leggi l'elenco.

---

## Lezione 10 — Trasferimenti cloud (solo con codice dell'amministratore)

Esegui questa lezione **solo** se hai un codice di collegamento reale. Non inventarlo.

1. **Trasferimenti** → scheda **Impostazioni Copia cloud**.
2. Incolla il codice in *Codice di collegamento fornito dall'amministratore* → **Collega archivio**. Il codice è un testo JSON con i campi `endpoint` e `token` (verificato in `SyncPanel.tsx`): se il testo non è JSON oppure manca uno dei due campi, il collegamento non avviene e compare un errore.
3. **Test Connessione** → atteso *Collegamento verificato*.
4. Scheda **Operazioni Trasferimento** → **Pubblica conoscenza** → seleziona le note → controlla l'anteprima → **Conferma ed Esegui**.
5. Per una copia privata: **Carica versione** → **Conferma ed Esegui**.
6. Per recuperare: **Versioni precedenti da recuperare** → **Carica versioni** → scegli → **Scarica copia** → conferma. Annota il percorso "Copia salvata" (cartella nuova `LIMEN-copy-…`) e aprilo dalla schermata iniziale.

---

## Lezione 11 — Chiudere l'esercitazione

- In Obsidian rimuovi `VAULT-PROVA` dall'elenco dei Vault se non ti serve più.
- La cartella resta sul disco: cancellala a mano dal Finder quando sei sicuro.
- Per tornare al Vault reale: chiudi e riapri LIMEN → **APRI VAULT ESISTENTE** con `/Users/cesare/Documents/VAULT`.
  Non usare il campo *Cartella locale del Vault* in Impostazioni per cambiare Vault (vedi [[05_PROBLEMI_E_GLOSSARIO]]).
