---
title: "LIMEN Vault — Guida rapida"
type: help
created_at: "2026-09-16"
updated_at: "2026-09-20"
tags: [limen-vault, quickstart, rag-locale]
---

# Guida rapida v3

Torna all’indice: [[00_INDICE]]

1. Apri **LIMEN Vault v3** e seleziona un Vault esistente (es. `~/Documents/VAULT`) oppure creane uno nuovo in una cartella vuota.
2. Controlla che la Panoramica mostri lo stato **Pronto**.
3. **Configura il Motore Semantico Locale (Rete Zero)**:
   - Vai in **Avanzate e Manutenzione → Collegamenti AI & MCP**.
   - Nel pannello **Motore semantico**, seleziona **Locale (bge-m3, nessun dato esce dal Mac)**.
   - Premi **SCARICA MODELLO (BGE-M3)** (~605 MB, operazione una-tantum con verifica hash SHA-256) oppure seleziona un file `.gguf` locale.
   - Premi **AVVIA SERVIZIO LOCALE** (lo stato diventerà *ATTIVO* con una porta dinamica libera).
   - *(Facoltativo)* Se intendi usare anche la chat generativa remota in *Chiedi al Vault*, salva la chiave OpenAI nel Portachiavi.
4. Premi il pulsante verde **CARICA DOCUMENTI** e seleziona i file grezzi (PDF, DOCX, presentazioni, immagini, trascrizioni). Non convertirli prima: l'estrattore nativo Swift esegue OCR e chunking sul Mac.
5. In **Avanzate → Collegamenti AI & MCP → Motore semantico**, controlla che la cache indichi **9.458 passaggi indicizzati** (o il numero corrispondente ai tuoi documenti) e sia *Allineata*. Se necessario, premi **RICALCOLA CACHE SEMANTICA**.
6. Vai nella scheda **Chiedi**: con la casella **Ricerca Ibrida** spuntata, interroga i tuoi contenuti unendo la precisione del lessicale BM25 e l'intelligenza concettuale dei vettori locali bge-m3.
7. Se il servizio locale dovesse essere spento, l'app passa automaticamente in **Modalità Degradata** (solo BM25) esponendo un banner giallo senza mai bloccarsi né inviare dati all'esterno.
8. Usa **Copie locali** per creare snapshot verificati con impronte SHA-256.

---

## Dove va ogni file

| Stai inserendo… | Cartella |
| --- | --- |
| Documenti grezzi, trascrizioni, brief, appunti | `20_RAW_SOURCES` |
| Schede clienti | `01_CLIENTS` |
| Schede progetto | `02_PROJECTS` |
| Marchi | `03_BRANDS` |
| Posizionamento | `04_POSITIONING` |
| Conoscenza tecnica packaging | `05_PACKAGING_KNOWLEDGE` |
| Metodi e checklist | `06_METHODS` |
| Casi studio | `07_CASE_STUDIES` |
| Ricerche di mercato | `08_MARKET_RESEARCH` |
| Concorrenti | `09_COMPETITORS` |
| Contenuti definitivi approvati | `10_APPROVED_OUTPUTS` (preferibilmente tramite Proposte) |
| (solo AI) risposte salvate | `80_AI_OUTPUTS` |
| (solo AI / compilatore) bozze e proposte | `90_PROPOSALS` |
| Archivio | `99_ARCHIVE` |
| Indici e sistema — non toccare a mano | `00_SYSTEM` |

I nomi delle cartelle e delle proprietà YAML (`client`, `status: approved`…) **non vanno tradotti**.
