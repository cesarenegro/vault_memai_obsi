# Misura A04 lessicale V4 — BM25 (C11, seconda meta')

- Eseguita: 2026-09-20 16:06:26 UTC+8
- Motore: limen_vault::search::search_vault tramite vault-check search (solo lessicale, 100% locale, zero rete), limit 10
- Formula: BM25 sul punteggio documentale, k1=1.2, b=0.75, dl=numero token del documento, avgdl=media sull'indice; bonus titolo/tag invariati; punteggio di passaggio invariato (ripiego)
- Vault: tests/scratch/real_vault_v1 (56 documenti, 4.633 passaggi, indice post-C11 con tf reale)
- Casi: tests/gold/A04_REAL_QUERIES.json (82, verita' di riferimento automatica)
- Confronto: V1 pre-C11 P@1 74/82 R@10 82/82 pari-merito 14 | V3 post-C11 senza normalizzazione P@1 12/82 R@10 48/82 | V4 BM25 P@1 77/82 R@10 82/82 pari-merito 1 (gruppo 2), 32 documenti distinti al rango 1, mediana 48.208 byte
- Suite Rust alla revisione della misura: 94 + 17 = 111 passati, 0 falliti
