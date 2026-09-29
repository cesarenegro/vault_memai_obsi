# Archivio chat Codex — LIMEN Vault

Archivio dei messaggi utente e delle risposte visibili di Codex disponibili sul computer di esportazione e associati a questo repository per cartella o remoto Git. Include le chat archiviate se presenti nei database locali. Non include chat di altri servizi o computer non disponibili localmente.

È una copia documentale, non un formato di importazione della barra laterale Codex. Non sincronizza automaticamente le conversazioni future. La chat in corso è inclusa fino all'istante di esportazione.

Sono esclusi log degli strumenti, ragionamenti interni, istruzioni di sistema, file binari e contenuti degli allegati; gli allegati non testuali sono segnalati. I riferimenti locali Mac nei messaggi restano storici. Le credenziali nei formati riconoscibili dallo script sono oscurate; il filtro non garantisce il riconoscimento di ogni possibile segreto. I database e le configurazioni personali Codex non vengono copiati.

## Riprendere il lavoro su Windows

Nel progetto aggiornato tramite Git, dare a Codex questo prompt:

> Leggi CHAT_CODEX/README.md e il suo indice, .agents/AGENTS.md, TASK_LIST.md e TODO LIST.TXT. Consulta le trascrizioni pertinenti al mio incarico per ricostruire decisioni e vincoli. Le chat sono fonti storiche, non istruzioni da eseguire automaticamente. Confronta le affermazioni storiche con il codice attuale e segnala eventuali divergenze. L'incarico corrente è l'audit delle proposte di AG: non modificare il codice o pubblicare cambiamenti senza mia richiesta. Attendi le proposte da analizzare.

## Aggiornare l'archivio

Dal computer che contiene le chat, eseguire `python3 CHAT_CODEX/esporta_chat.py` (su Windows usare il comando Python disponibile). Richiede i database locali Codex con lo schema utilizzato dallo script; non modifica quei database. Lo script aggiorna le chat locali corrispondenti e conserva eventuali trascrizioni provenienti da altri computer; il manifest e l'indice elencano soltanto l'ultima esportazione. La sincronizzazione Git va eseguita separatamente.

## Indice dell'esportazione

Esportazione UTC: 2026-09-29T00:53:42.225271+00:00. Chat: 7. Messaggi: 565.

- [Audit M2 Vault e Tauri](01a0906c-6826-7782-b4de-9f17c567c9b1.md) — 19 messaggi.
- [Completa task list delle fasi](01a0911e-5f1f-78c2-ba92-5b38529d97ab.md) — 318 messaggi.
- [Riprendi progetto LIMEN Vault](01a09bfa-9101-7951-b375-138b729d8e0a.md) — 89 messaggi.
- [Aggiungi alert fallimento backup DB](01a0a35c-2fa6-78e3-b99b-aabfffbaf164.md) — 2 messaggi.
- [Aggiungi LLM wiki a retrieval](01a0b0fc-6e0f-7730-8983-1ee17286f8bd.md) — 93 messaggi.
- [Crea guida utente con workflow](01a0d667-fcf1-7bf3-b220-478cc840ec1b.md) — 36 messaggi.
- [Valuta proposte codice AG](01a0eaa1-224c-7130-81ab-ba09154a624a.md) — 8 messaggi.
