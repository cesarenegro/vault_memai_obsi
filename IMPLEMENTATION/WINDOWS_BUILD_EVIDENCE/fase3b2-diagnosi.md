# Diagnosi Comparativa Passo 3b-2 — Punti C & D

Data: 23 Settembre 2026  
Ambiente: Windows 11 Pro, Vault di sviluppo (`E:\VAULT WIN TEST DEV`)  
Commit di riferimento baseline (3b-1): `54ab84b`  
Modello OpenAI: Invariato (`gpt-4o`) — **ZERO chiamate OpenAI effettuate durante la diagnosi tecnica locale**.

---

## 1. Sintesi dei Risultati Chiave

Il Passo 3b-2 (Punti C & D di `fase3b-piano.md`) ha introdotto:
1. **Multi-passaggio per documento**: Da 1 a 3 passaggi più pertinenti per ciascun documento candidato anziché un unico ritaglio orfano di contesto.
2. **Integrità crittografica puntuale**: Ciascun singolo passaggio estratto possiede e verifica la propria impronta SHA-256 (`passage.sha256`) verificata dal catalogo del vault.
3. **Localizzatori coerenti e concatenati**: Ordine naturale narrativo preservato (es. `"Paragrafi 1-4, Paragrafo 5"`, `"Paragrafi 1-13, Paragrafi 52-68"`).
4. **Pieno utilizzo del budget di 24.000 byte**: Il volume dei contenuti utili inviati sale da 9.201–11.541 byte a **15.361–17.422 byte di testo puro** (e **20.908–22.965 byte complessivi di payload JSON**), saturando in modo ottimale il budget senza mai superare il tetto dei 24.000 byte.
5. **Risoluzione caso critico audit BNXT**: Nel documento di audit `abaef2b48c6e5b70-audit-localizzazione-EN-baseline-6f2f2b8.md` non arriva più soltanto il frammentario "Paragrafo 5", ma vengono forniti congiuntamente l'inquadramento introduttivo ("Paragrafi 1-4") e il contenuto operativo ("Paragrafo 5"), per un totale di 2.053 byte (contro i precedenti 1.198 B).

---

## 2. Tabella Comparativa Prima (3b-1) vs Dopo (3b-2)

| Domanda | Metrica | Passo 3b-1 (Misurato da Cesare) | Passo 3b-2 (Implementato) | Variazione |
|---|---|---|---|---|
| **#1 BNXT**<br>`"Cosa è il progetto BNXT?"` | Fonti inviate<br>Testo contenuti<br>Payload JSON<br>Passaggi per doc | 8 fonti<br>9.201 byte<br>~12.800 byte<br>1 passaggio fisso | 8 fonti<br>**15.361 byte**<br>**20.908 byte**<br>**1–2 passaggi (15 tot)** | +67% testo<br>Budget rispettato<br>Risolto audit baseline |
| **#2 ARKAI**<br>`"ARKAI è un'azienda o un marchio? Di cosa si occupa?"` | Fonti inviate<br>Testo contenuti<br>Payload JSON<br>Passaggi per doc | 10 fonti (6 Arkai)<br>10.749 byte<br>~14.500 byte<br>1 passaggio fisso | 7 fonti (7 Arkai!)<br>**17.422 byte**<br>**22.965 byte**<br>**2–3 passaggi (17 tot)** | +62% testo<br>100% pertinenza<br>Focalizzazione massima |
| **#3 SCENA**<br>`"Cos'è il progetto SCENA e quali app comprende?"` | Fonti inviate<br>Testo contenuti<br>Payload JSON<br>Passaggi per doc | 10 fonti<br>11.541 byte<br>~15.200 byte<br>1 passaggio fisso | 8 fonti<br>**16.857 byte**<br>**22.695 byte**<br>**1–2 passaggi (15 tot)** | +46% testo<br>Budget rispettato<br>Copertura completa |

---

## 3. Dettaglio Fonti e Passaggi Estratti nel Passo 3b-2

### Domanda #1: "Cosa è il progetto BNXT?"
- **Budget utilizzato**: 15.361 byte (testo) / 20.908 byte (payload serializzato JSON su 24.000 max)
- **Fonti selezionate**: 8 fonti

| ID | Percorso Relativo | Byte | Passaggi | Localizzatore Concatenato | Note di Contesto |
|---|---|---|---|---|---|
| `[S1]` | `20_RAW_SOURCES/32f2a4081d13410e-BNXT CRM.md` | 2.439 B | 2 passaggi | Paragrafi 1-13, Paragrafi 52-68 | Introduzione e configurazione WhatsApp |
| `[S2]` | `20_RAW_SOURCES/a86061ba2701d614-_Progetto - BNXT AUDIT VICENZA.md` | 555 B | 1 passaggio | Paragrafi 1-8 | Inquadramento audit Vicenza |
| `[S3]` | `20_RAW_SOURCES/d70f1c7b1d36f912-STEFANO APP.md` | 2.355 B | 2 passaggi | Paragrafo 224, Paragrafi 224-234 | Integrazione app e processi |
| `[S4]` | `20_RAW_SOURCES/4245a51312c5c1f2-2026-04-07 - Workflow app iPhone nativa con Xcode.md` | 2.412 B | 2 passaggi | Paragrafi 6-11, Paragrafi 12-25 | Workflow Xcode per iOS |
| `[S5]` | `20_RAW_SOURCES/5a54c2ce2f581cf2-verifica-walkthrough-ux-email-whatsapp-2026-09-10.md` | 1.742 B | 2 passaggi | Paragrafi 1-3, Paragrafo 4 | Walkthrough e verifiche email/WhatsApp |
| `[S6]` | `20_RAW_SOURCES/957b10627e45aa38-_INDICE.md` | 2.342 B | 2 passaggi | Paragrafi 1-2, Paragrafo 2 | Struttura globale e indice |
| `[S7]` | `20_RAW_SOURCES/abaef2b48c6e5b70-audit-localizzazione-EN-baseline-6f2f2b8.md` | 2.053 B | 2 passaggi | Paragrafi 1-4, Paragrafo 5 | **Risolto**: presenti baseline e paragrafo 5 |
| `[S8]` | `20_RAW_SOURCES/1e755ab82023a095-verifica-impl-plan-ux-email-whatsapp-2026-09-10.md` | 1.463 B | 2 passaggi | Paragrafi 1-3, Paragrafo 4 | Piano implementativo |

---

### Domanda #2: "ARKAI è un'azienda o un marchio? Di cosa si occupa?"
- **Budget utilizzato**: 17.422 byte (testo) / 22.965 byte (payload serializzato JSON su 24.000 max)
- **Fonti selezionate**: 7 fonti (tutte e 7 primarie di Arkai)

| ID | Percorso Relativo | Byte | Passaggi | Localizzatore Concatenato | Note di Contesto |
|---|---|---|---|---|---|
| `[S1]` | `20_RAW_SOURCES/540e37c638dd2045-2026-03-31 - Presentazione investitori Arkai.archi.md` | 3.151 B | 3 passaggi | Paragrafi 1-4, Paragrafo 4, Paragrafo 8 | Presentazione societaria e architettura |
| `[S2]` | `20_RAW_SOURCES/0bc92121a0ad46f7-2026-03-26 - Arkai.Dev expansion into Italian market.md` | 2.805 B | 3 passaggi | Paragrafi 1-4, Paragrafo 33, Paragrafo 34 | Espansione societaria Arkai.Dev Italia |
| `[S3]` | `20_RAW_SOURCES/aa217245dfd86aeb-nuovo LLM AI Arkai.md` | 2.871 B | 3 passaggi | Paragrafi 1-10, Paragrafo 74, Paragrafo 75 | Modello LLM AI proprietario Arkai |
| `[S4]` | `20_RAW_SOURCES/98de5fb0d0fac3db-2026-04-12 - AI model development with LORA for floorplan recognition.md` | 2.250 B | 2 passaggi | Paragrafo 339, Paragrafo 340 | Modelli AI e riconoscimento planimetrie |
| `[S5]` | `20_RAW_SOURCES/f4fd17ebca858f34-ARKAI.DEV Software Developer.md` | 2.058 B | 2 passaggi | Paragrafi 1-8, Paragrafi 9-19 | Struttura team software e ruoli |
| `[S6]` | `20_RAW_SOURCES/410dbac00663f59c-2026-06-03 - Analisi Excel investitori e outreach personalizzate.md` | 2.232 B | 2 passaggi | Paragrafi 188-193, Paragrafi 387-388 | Investitori e posizionamento di mercato |
| `[S7]` | `20_RAW_SOURCES/86e2218e7ed905f1-ARKAI FLOORPLAN NICE.md` | 2.055 B | 2 passaggi | Paragrafi 505-507, Paragrafi 508-513 | Specifiche floorplan e prodotto |

---

### Domanda #3: "Cos'è il progetto SCENA e quali app comprende?"
- **Budget utilizzato**: 16.857 byte (testo) / 22.695 byte (payload serializzato JSON su 24.000 max)
- **Fonti selezionate**: 8 fonti

| ID | Percorso Relativo | Byte | Passaggi | Localizzatore Concatenato | Note di Contesto |
|---|---|---|---|---|---|
| `[S1]` | `20_RAW_SOURCES/1779683df5b44f8e-2026-04-29 - Presentazione funzionalità sistema SCENA.md` | 2.386 B | 2 passaggi | Paragrafi 19-24, Paragrafi 29-35 | Presentazione del sistema e architettura |
| `[S2]` | `20_RAW_SOURCES/823633921a2bb46a-areas - scena.md` | 1.117 B | 1 passaggio | Paragrafi 1-3 | Mappatura delle aree funzionali |
| `[S3]` | `20_RAW_SOURCES/ada7498f19b363c3-STUDIO CINEMA APP & DASHBOARD.md` | 2.392 B | 2 passaggi | Paragrafi 1405-1436, Paragrafi 1437-1454 | Studio Cinema App e Dashboard integrata |
| `[S4]` | `20_RAW_SOURCES/c4f02a78e4b17fdc-2026-06-01 - Audit sincronizzazione dati tra gestionale e app iOS.md` | 2.317 B | 2 passaggi | Paragrafi 114-118, Paragrafo 179 | Sincronizzazione iOS e gestionale |
| `[S5]` | `20_RAW_SOURCES/2a3b60ff71c42897-Coordinating updates across three integrated projects.md` | 2.143 B | 2 passaggi | Paragrafi 98-103, Paragrafi 111-116 | Coordinamento dei 3 progetti integrati |
| `[S6]` | `20_RAW_SOURCES/c7fdf167bf695434-2026-05-16 - Manuale operativo minimalista e leggibile.md` | 1.785 B | 2 passaggi | Paragrafi 1-4, Paragrafo 24 | Manuale d'uso e componenti |
| `[S7]` | `20_RAW_SOURCES/18ce369ee3bd81fe-2026-06-02 - Migrazione chat a project.md` | 2.452 B | 2 passaggi | Paragrafo 1851, Paragrafi 1851-1855 | Moduli chat e transizione |
| `[S8]` | `20_RAW_SOURCES/7e90bad5776b00a0-Autorizzazioni CRM Packaging in Italy.md` | 2.265 B | 2 passaggi | Paragrafi 1-12, Paragrafi 13-18 | Connessioni CRM e autorizzazioni |
