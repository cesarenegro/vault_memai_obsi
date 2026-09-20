# Misura A04 — lessicale BM25, semantico bge-m3 locale, ibrido F2 k=0,20 (corpus reale, 82 casi)

- Eseguita: 2026-09-20 19:40 UTC+8, binario a04_real_local (porta esplicita LIMEN_LOCAL_PORT=8091, tempo di calcolo reale, cartella evidenze parametrica), codice di prodotto al commit dbe7939 (motore identico ad a08e769)
- Vault: tests/scratch/real_vault_v1 (56 documenti, 4.633 passaggi; cache bge-m3 1024d completa, nessun ricalcolo: 2,47 s); server bge-m3 dedicato su 127.0.0.1:8091 (binario impacchettato dell'app installata)
- Risultati (ricalcolati dal per-query.jsonl): LESSICALE P@1 77/82 = 0,939, R@10 82/82, 1 pari merito (gruppo 2) — identico alla misura indipendente V4 con vault-check; SEMANTICO P@1 50/82 = 0,610, R@10 72/82 = 0,878; IBRIDO P@1 76/82 = 0,927, R@10 82/82 = 1,000, 0 pari merito
- Effetto della fusione sul segnale semantico: 0 query declassate dal rango 1 (prima di BM25 erano 24), 26 guadagnate; recall: 10 recuperate rispetto al semantico puro, 0 perse
- Nota: il semantico puro differisce di 1 caso dalla corsa V2 (49 -> 50 al rango 1; 73 -> 72 in top 10): vettori delle query ricalcolati da un'istanza diversa di llama-server (parametri di batch diversi), differenze numeriche minime
- Correzione al banco di prova: rimosso il tempo cablato 846.64 s che il codice riportava come misurato quando la cache era gia' completa
