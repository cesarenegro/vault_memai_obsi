# Collaudo Compito 1 sull'applicazione installata (build a08e769, notarizzata)

- Data: 2026-09-20, ore 19:16–19:20 UTC+8
- App: /Applications/LIMEN Vault v3.app (Desktop v3 0.3.0), commit a08e769545d6c3b61a41deac85cef53c9825fb23; notarizzazione app 6b0a0583-4974-4f55-bf96-278c2921c475 Accepted, DMG accettato e graffettato
- Vault: tests/scratch/vault_collaudo_local_rag_v2 (114 documenti, 9.458 passaggi, cache bge-m3 1024d con intersezione 100%)
- Sequenza: apertura vault dalla schermata iniziale -> Avanzate -> Collegamenti AI & MCP -> AVVIA SERVIZIO LOCALE -> ATTIVO (porta 60411, /health OK) -> Chiedi -> 'marca privata e distribuzione' con Ricerca Ibrida: 50 risultati, badge RAG 100% LOCALE -> kill del processo llama-server (pid 19379, unico socket TCP 127.0.0.1:60411 LISTEN) alle 19:17:57 UTC+8 -> nuova ricerca 'naming': 50 risultati lessicali, badge 'RAG LOCALE SPENTO (SOLO LESSICALE)' e banner giallo 'Modalita degradata (solo ricerca lessicale)' -> riavvio dal pannello: pid 21212 127.0.0.1:60470 -> ricerca ibrida di nuovo attiva
- Schermate: catturate con la scorciatoia di sistema cmd+shift+3 dall'applicazione reale (2880x1864), non da pagine di anteprima
- Esito: PASS. Nessun dato in uscita dal Mac (lsof).
