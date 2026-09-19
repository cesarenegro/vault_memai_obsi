---
title: "LIMEN Vault — Guida rapida"
type: help
tags: [limen-vault, quickstart]
---

# Guida rapida v3

Torna all’indice: [[00_INDICE]]

1. Apri **LIMEN Vault v3** e apri il Vault esistente oppure creane uno nuovo in una cartella vuota.
2. Controlla che lo stato sia **Pronto**.
3. Una volta sola: salva la chiave API in **Impostazioni**; in **Fonti** indica il modello e premi **ATTIVA AUTOMAZIONE**.
4. Premi **CARICA DOCUMENTI** e scegli i file grezzi. Non convertirli prima.
5. Lascia l’app aperta: LIMEN converte, normalizza, classifica, collega, indicizza e genera le wiki.
6. Consulta **Avanzamento e documenti**; i risultati sono in **Conoscenza**, **Ricerca** e **Chiedi al Vault**.
7. Per una domanda, prepara **ANTEPRIMA FONTI** e invia le fonti mostrate.
8. Usa **Copie locali** per conservare una copia. La pubblicazione CRM è un’azione distinta.

La configurazione autorizza le chiamate automatiche a OpenAI per classificazione e wiki. Conversione/OCR avvengono sul Mac. L’app riprende la coda alla riapertura. Errori e limiti sono descritti in [[07_AUTOMAZIONE_DOCUMENTI]].

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
| Sistema — non toccare | `00_SYSTEM` |

I nomi delle cartelle e delle proprietà (`client`, `status: approved`…) **non vanno tradotti**.
