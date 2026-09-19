#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const CORPUS_DIR = path.join(ROOT, 'tests/gold/A15_CORPUS');
const QUERIES_PATH = path.join(ROOT, 'tests/gold/A15_QUERIES.json');

// Deterministic PRNG with fixed seed
let s = 20260919;
function pseudoRandom() {
  s = (s * 9301 + 49297) % 233280;
  return s / 233280;
}

const DOMAINS = [
  "cartone_ondulato", "film_estensibile", "biopolimeri", "termoformatura",
  "pallettizzazione", "flussaggio_azoto", "etichettatura_linerless", "collaudi_ista",
  "barriera_evoh", "adesivi_hotmelt", "inchiostri_acqua", "saldatura_ultrasuoni"
];

const ACTIONS = [
  "Collaudo dimensionale e prova di scorrimento",
  "Verifica tenuta saldatura a caldo e trazione",
  "Monitoraggio potenza assorbita dai riscaldatori",
  "Controllo spessore con micrometro digitale",
  "Analisi permeabilita al vapor d acqua WVTR",
  "Test caduta libera da un metro su piano rigido",
  "Ispezione ottica automatica per rilevazione grinze",
  "Campione di resistenza a compressione verticale BCT",
  "Misurazione attrito dinamico su slitta d acciaio",
  "Sostituzione filtri dell aria compressa e lubrificazione"
];

function generateA15Corpus() {
  fs.mkdirSync(CORPUS_DIR, { recursive: true });
  console.log(`Generating 1,000 documents for A15 in ${CORPUS_DIR}...`);

  for (let i = 1; i <= 1000; i++) {
    const docId = `perf_doc_${i.toString().padStart(4, '0')}`;
    const domain = DOMAINS[i % DOMAINS.length];
    const clientCode = `CL-${(100 + (i % 50))}`;
    const batchCode = `LOTTO-2026-${(i * 7) % 9999}`;

    let content = `---
title: "Scheda Tecnica Imballo ${docId.toUpperCase()}"
status: approved
category: packaging
tags: [prestazioni, ${domain}, benchmark_a15]
date: "2026-09-19"
client: "${clientCode}"
document_id: "${docId}"
---

# Scheda Tecnica e Rapporto di Manutenzione: ${docId.toUpperCase()}

## Pagina 1
### 1. Dati Generali e Tracciabilita
Il presente fascicolo documenta le specifiche tecniche per il lotto produttivo ${batchCode} destinato al cliente ${clientCode}. L impianto opera su tre turni lavorativi con verifica continua dei parametri ambientali.

## Pagina 2
### 2. Descrizione del Materiale
Tipologia del supporto: ${domain}. Il film plastico e stato formulato per massimizzare la resa chilometrica e garantire elevata trasparenza superficiale. Non sono presenti inclusioni gassose o impurezze di estrusione.

## Pagina 3
### 3. Parametri di Esercizio e Condizioni di Processo
Temperatura di processo: ${(140 + (i % 30))} gradi Celsius. Pressione di esercizio: ${(3.5 + ((i % 10) * 0.1)).toFixed(1)} bar. Velocita operativa nominale: ${(80 + (i % 40))} cicli al minuto con tempo di sosta saldante pari a duecento millisecondi.

## Pagina 4
### 4. Prove Sperimentali e Risultati del Laboratorio
${ACTIONS[i % ACTIONS.length]}. Tutti i campioni prelevati secondo il piano statistico hanno superato i criteri di conformita stabiliti dal capitolato tecnico.

## Pagina 5
### 5. Indicatori di Efficienza e Resa Macchina
Il rendimento complessivo dell isola OEE registrato durante il turno e pari al 94.2%. Gli arresti macchina per cambio bobina sono stati contenuti entro sette minuti complessivi.

## Pagina 6
### 6. Trattamenti Superficiali e Adesione
Trattamento ad effetto corona eseguito a monte della bobinatura: valore di bagnabilita superficiale pari a 42 dine/cm. Il valore assicura l adesione dei collanti a base acquosa.

## Pagina 7
### 7. Conformita Normativa e Standard Internazionali
La fornitura rispetta i regolamenti europei applicabili per gli imballaggi industriali e secondari. Nessuna sostanza dell elenco SVHC risulta impiegata oltre le soglie consentite.

## Pagina 8
### 8. Prescrizioni di Stoccaggio in Magazzino
I bancali devono essere conservati in ambiente asciutto con umidita relativa compresa tra 40% e 60% e temperatura tra 15 e 25 gradi. Non sovrapporre piu di due unita di carico.

## Pagina 9
### 9. Manutenzione Preventiva e Componenti Usurabili
Controllo delle guide di scorrimento lineari e pulizia delle barre saldanti con solvente neutro. Verifica della tensione delle cinghie dentate dei servomotori brushless.

## Pagina 10
### 10. Note Conclusive e Validazione Qualita
Il lotto ${batchCode} e stato approvato dal responsabile del controllo qualita per l invio alla stazione di imballaggio finale e pallettizzazione automatica.

## Pagina 11
### 11. Dettagli Aggiuntivi di Sicurezza
I dispositivi di arresto di emergenza e le barriere fotoelettriche di categoria 4 sono stati collaudati con esito positivo prima dell inizio delle lavorazioni.
`;

    const filePath = path.join(CORPUS_DIR, `${docId}.md`);
    fs.writeFileSync(filePath, content, 'utf8');
  }

  // Generate 100 queries
  console.log(`Generating 100 distinct queries for A15...`);
  const queries = [];

  const queryTerms = [
    "cartone_ondulato", "film_estensibile", "biopolimeri", "termoformatura",
    "pallettizzazione", "flussaggio_azoto", "etichettatura_linerless", "collaudi_ista",
    "barriera_evoh", "adesivi_hotmelt", "inchiostri_acqua", "saldatura_ultrasuoni",
    "temperatura", "pressione", "velocita", "conformita", "manutenzione", "lotto",
    "cliente", "bancali", "stoccaggio", "qualita", "sicurezza", "barre saldanti",
    "guarnizioni", "rendimento OEE", "trattamento corona", "bagnabilita", "lineari",
    "servomotori", "statistico", "campionamento", "umidita", "sovrapposizione",
    "resistenze", "micrometro", "spessore", "trazione", "scorrimento", "effrazione"
  ];

  for (let q = 1; q <= 100; q++) {
    const term = queryTerms[(q - 1) % queryTerms.length];
    const subIdx = (q * 13) % 1000;
    const qText = q <= 40 ? `${term}` : `${term} lotto CL-${(100 + (subIdx % 50))}`;
    queries.push({
      queryId: `A15_Q${q.toString().padStart(3, '0')}`,
      text: qText,
      term: qText,
      limit: 10
    });
  }

  fs.writeFileSync(QUERIES_PATH, JSON.stringify(queries, null, 2), 'utf8');
  console.log(`Successfully generated 1,000 documents in ${CORPUS_DIR}`);
  console.log(`Successfully generated 100 queries in ${QUERIES_PATH}`);
}

generateA15Corpus();
