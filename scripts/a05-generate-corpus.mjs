#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const CORPUS_DIR = path.join(ROOT, 'tests/gold/A05_CORPUS');
const QUERIES_PATH = path.join(ROOT, 'tests/gold/A05_QUERIES.json');

// 40 curated query-target pairs on packaging and consultancy.
// CRITICAL: ZERO content word overlap between query.text and targetExcerpt.
const PAIRS = [
  {
    id: "Q01",
    query: "Procedimenti ecologici finalizzati all abbattimento delle emissioni serra nei contenitori destinati alla grande distribuzione",
    targetExcerpt: "Linee guida per l ecodesign degli imballaggi secondari nei supermercati: calcolo carbon footprint e selezione materie prime sostenibili.",
    title: "Valutazione Impronta Ambientale Imballaggi Secondari",
    category: "sostenibilita",
    docId: "doc_001"
  },
  {
    id: "Q02",
    query: "Metodologie per massimizzare il coefficiente di riempimento dei pianali di carico nei viaggi intermodali marittimi",
    targetExcerpt: "Studio logistico sul tasso volumetrico dei pallet EUR1 all interno dei container ISO marini: schemi di accatastamento e riduzione spazi vuoti.",
    title: "Ottimizzazione Volumetrica Pallet e Container",
    category: "logistica",
    docId: "doc_002"
  },
  {
    id: "Q03",
    query: "Materiali multistrato capaci di impedire il passaggio dell ossigeno gassoso e dell umidita nei prodotti lievitati",
    targetExcerpt: "Specifiche film barriera EVOH accoppiato a PE per la salvaguardia della fragranza dei biscotti e delle torte confezionate industriali.",
    title: "Film Polimerici con Barriera ai Gas per Snack",
    category: "materiali",
    docId: "doc_003"
  },
  {
    id: "Q04",
    query: "Adempimenti prescritti dal regolamento europeo sugli scarti di confezionamento per favorire il recupero della materia",
    targetExcerpt: "Sintesi operativa PPWR 2025: requisiti di riciclabilita delle confezioni, quote obbligatorie di polimeri riciclati e divieto di formati monouso inutili.",
    title: "Guida alla Conformita Normativa PPWR",
    category: "normative",
    docId: "doc_004"
  },
  {
    id: "Q05",
    query: "Tecnica a vibrazioni sonore ad alta frequenza per la chiusura ermetica di sacchetti termosensibili",
    targetExcerpt: "Impianto di saldatura a ultrasuoni per buste flessibili: il generatore piezoceramico trasmette oscillazioni elastiche che fondono lo strato interno senza surriscaldare il blister.",
    title: "Sigillatura Ultrasuoni per Packaging Termosensibile",
    category: "macchine",
    docId: "doc_005"
  },
  {
    id: "Q06",
    query: "Protocolli di laboratorio per collaudare urti accidentali e oscillazioni meccaniche subite dai colli delle vendite online",
    targetExcerpt: "Standard di simulazione trasporto ISTA 3A: caduta libera da altezza variabile e vibrazione sinusoidale casuale per pacchi destinati a corrieri espressi.",
    title: "Certificazione Collaudi Dinamici ISTA per E-Commerce",
    category: "collaudi",
    docId: "doc_006"
  },
  {
    id: "Q07",
    query: "Vernici colorate prive di solventi organici per la stampa flessografica a contatto con alimenti",
    targetExcerpt: "Inchiostri idrosolubili conformi GMP: formulazioni acquose per rotocalco su astucci cartacei a bassa migrazione e assenza di VOC volatili.",
    title: "Formulazioni Inchiostri all Acqua per Packaging Alimentare",
    category: "chimica",
    docId: "doc_007"
  },
  {
    id: "Q08",
    query: "Rilevazione analitica degli idrocarburi saturi e aromatici provenienti da fibre riciclate di cellulosa",
    targetExcerpt: "Metodo GC-FID per quantificare MOSH e MOAH nella carta: estrazione con solvente e verifica della barriera funzionale verso il cibo.",
    title: "Laboratorio Analisi Idrocarburi Minerali nel Cartoncino",
    category: "sicurezza",
    docId: "doc_008"
  },
  {
    id: "Q09",
    query: "Pellicole polimeriche di origine biologica biodegradabili negli impianti di digestione anaerobica",
    targetExcerpt: "Scheda tecnica biopolimero PLA-PBAT: degradazione secondo EN 13432, ideale per vaschette da asporto e stoviglie destinate alla frazione umida urbana.",
    title: "Applicazioni Bioplastiche Compostabili nel Foodservice",
    category: "bioplastiche",
    docId: "doc_009"
  },
  {
    id: "Q10",
    query: "Sistemi optoelettronici con telecamere intelligenti per intercettare microfratture sulle giunzioni termosaldate",
    targetExcerpt: "Dispositivo di visione artificiale industriale: sensori CCD ad alta risoluzione analizzano il profilo termico delle termosaldature scartando i sacchetti difettosi a monte.",
    title: "Controllo Qualita in Linea delle Sigillature",
    category: "automazione",
    docId: "doc_010"
  },
  {
    id: "Q11",
    query: "Sostituti vegetali del polimero stirenico espanso per l imbottitura antiurto di elettrodomestici",
    targetExcerpt: "Gusci sagomati in fibra di mais e cellulosa soffiata: ammortizzazione ecologica in alternativa all EPS per imballaggi pesanti.",
    title: "Imbottiture Vegetali Alternative al Polistirolo",
    category: "sostenibilita",
    docId: "doc_011"
  },
  {
    id: "Q12",
    query: "Bracci antropomorfi ad alta cadenza per impilare scatole pesanti su bancali di legno",
    targetExcerpt: "Cella di pallettizzazione robotizzata con pinza pneumatica: movimentazione automatizzata di casse da 25 kg con frequenza di venti cicli al minuto.",
    title: "Isole Robotizzate di Fine Linea per Fardelli",
    category: "robotica",
    docId: "doc_012"
  },
  {
    id: "Q13",
    query: "Transponder a radiofrequenza passivi inseriti nelle etichette per contrastare la falsificazione dei profumi",
    targetExcerpt: "Tag RFID UHF miniaturizzati integrati nel packaging di lusso: codice crittografico univoco per autenticazione nei punti vendita e inventario istantaneo.",
    title: "Tracciabilita Digitale Anticontraffazione nel Luxury",
    category: "digitale",
    docId: "doc_013"
  },
  {
    id: "Q14",
    query: "Meccanismi a doppia pressione per impedire l ingestione accidentale di composti caustici da parte di infanti",
    targetExcerpt: "Tappi child-resistant conformi ISO 8317: capsula push and turn che richiede spinta assiale combinata alla rotazione per accedere ai detergenti corrosivi.",
    title: "Chiusure di Sicurezza per Flaconi Chimici e Farmaci",
    category: "sicurezza",
    docId: "doc_014"
  },
  {
    id: "Q15",
    query: "Riduzione dei micrometri di spessore delle bobine plastiche senza peggiorare la tenacia a trazione",
    targetExcerpt: "Down-gauging di film estensibile cast: resine metalloceniche che offrono allungamento all 300% riducendo i grammi per metro quadro.",
    title: "Strategie di Downgauging nei Film Flessibili",
    category: "materiali",
    docId: "doc_015"
  },
  {
    id: "Q16",
    query: "Composizioni monocomponente in polipropilene per agevolare il trattamento nei centri di rigenerazione plastica",
    targetExcerpt: "Buste stand-up pouch 100% all-PP: accoppiamento BOPP con CPP orientato, ideali per la raccolta differenziata e la lavorazione nelle filiere circolari.",
    title: "Sviluppo Monomateriali Riciclabili per Doypack",
    category: "sostenibilita",
    docId: "doc_016"
  },
  {
    id: "Q17",
    query: "Apparecchiature per montare ed incollare contenitori pieghevoli in cartone ondulato ad alta velocita",
    targetExcerpt: "Formatrice automatica per scatole fustellate tipo fefco 0201: apertura del fustellato piano, piega delle alette inferiori ed erogazione di mastice termoindurente.",
    title: "Incartonatrici Meccaniche per Cartoni Americani",
    category: "macchine",
    docId: "doc_017"
  },
  {
    id: "Q18",
    query: "Scaricamento elettrostatico atmosferico per aumentare l aggrappo delle sostanze adesive sui fogli sintetici",
    targetExcerpt: "Trattamento corona superficiale: generazione di plasma dielettrico per innalzare l energia superficiale oltre 42 dine consentendo la laminazione solventless.",
    title: "Trattamento Superficiale dei Film Polimerici",
    category: "processi",
    docId: "doc_018"
  },
  {
    id: "Q19",
    query: "Saturazione dello spazio di testa con molecole di azoto per ritardare il deterioramento lipidico dei condimenti",
    targetExcerpt: "Flussaggio con N2 puro nei serbatoi di imbottigliamento: estromissione del gas ossidante per salvaguardare l aroma e prevenire difetti di acidita nei grassi.",
    title: "Conservazione in Atmosfera Inerte per Oli e Grassi",
    category: "alimentare",
    docId: "doc_019"
  },
  {
    id: "Q20",
    query: "Diagnosi dei consumi elettrici dei compressori e delle stazioni di riscaldamento negli stabilimenti di soffiaggio",
    targetExcerpt: "Audit energetico per impianti di estrusione bottiglie in PET: monitoraggio potenza kilowattora assorbita dalle lampade infrarossi e calcolo rendimento termico.",
    title: "Efficienza Energetica nel Soffiaggio Contenitori",
    category: "energia",
    docId: "doc_020"
  },
  {
    id: "Q21",
    query: "Rocchetti adesivi sprovvisti di supporto siliconato da gettare per azzerare i residui solidi",
    targetExcerpt: "Tecnologia di etichettatura linerless: nastri senza carta siliconata di scarto con spalmatura di silicone sul fronte per applicazione diretta su vassoi ortofrutta.",
    title: "Etichettatura Ecologica Senza Supporto Siliconato",
    category: "sostenibilita",
    docId: "doc_021"
  },
  {
    id: "Q22",
    query: "Quantificazione della trasmissione delle molecole di H2O attraverso pellicole per pillole medicinali",
    targetExcerpt: "Misurazione WVTR in camera stagna: grammi di vapore penetrati nelle ventiquattro ore per saggiare la tenuta dei fogli accoppiati alluminio-pvc.",
    title: "Collaudo Permeabilita Igrometrica Blister Farmaceutici",
    category: "collaudi",
    docId: "doc_022"
  },
  {
    id: "Q23",
    query: "Supporti grafici cromatici che virano di tonalita al variare della cronologia termica nei medicinali biologici",
    targetExcerpt: "Indicatori tempo-temperatura TTI basati su reazioni enzimatiche: modificazione cromatica irreversibile che allerta se la catena refrigerata e stata interrotta.",
    title: "Dispositivi Intelligenti per Controllo Termico Catena del Freddo",
    category: "dispositivi",
    docId: "doc_023"
  },
  {
    id: "Q24",
    query: "Tracciatura trasparente dell origine responsabile del legname e della pasta da carta impiegata nei pieghevoli",
    targetExcerpt: "Certificazioni della catena di custodia FSC e PEFC: verifica documentale dei flussi di legno vergine ricavato da foreste gestite secondo principi di biodiversita.",
    title: "Certificazione Ambientale di Filiera Forestale",
    category: "certificazioni",
    docId: "doc_024"
  },
  {
    id: "Q25",
    query: "Sigillatura di casse pesanti con strisce di cellulosa trattate con colla vegetale idroattiva rinforzate da filamenti",
    targetExcerpt: "Nastro gommato armato con fili di fibra di vetro: adesivo a base di amido attivato con bagnatura che penetra nella pasta della cassa rendendo visibile ogni effrazione.",
    title: "Chiusura Anti-Effrazione per Scatole da Spedizione",
    category: "logistica",
    docId: "doc_025"
  },
  {
    id: "Q26",
    query: "Guaine avvolgibili ricavate da scarti plastici urbani post-consumo per stabilizzare i bancali",
    targetExcerpt: "Film termoretraibile con il 50% di polietilene PCR certificato: proprieta elastiche che mantengono la coesione del carico pallettizzato riducendo il fabbisogno di vergine.",
    title: "Utilizzo Polimeri Riciclati PCR nei Film Industriali",
    category: "materiali",
    docId: "doc_026"
  },
  {
    id: "Q27",
    query: "Procedimento a vapore pressurizzato per pastorizzare alimenti pronti in sacchetti multistrato",
    targetExcerpt: "Autoclave di sterilizzazione per buste retort pouches: ciclo a centoventi gradi con contropressione d aria per evitare l esplosione delle confezioni ermetiche.",
    title: "Processi di Sterilizzazione Retort per Piatti Pronti",
    category: "processi",
    docId: "doc_027"
  },
  {
    id: "Q28",
    query: "Trattamenti oleorepellenti privi di composti perfluorurati per scatole da asporto di cibi fritti",
    targetExcerpt: "Cartoncino greaseproof privo di PFAS: laccatura idrodispersa a base vegetale che arresta i trigliceridi caldi preservando la compostabilita del contenitore.",
    title: "Barriere ai Grassi PFAS-Free per Cartone Pizza",
    category: "chimica",
    docId: "doc_028"
  },
  {
    id: "Q29",
    query: "Copertura protettiva trasparente che aderisce come una seconda pelle sulla superficie di tagli di carne bovina",
    targetExcerpt: "Confezionamento skin-pack sottovuoto: riscaldamento di un film superiore altamente deformabile che avvolge il filetto senza formare sacche d aria e previene l essudato.",
    title: "Tecnologia Sottovuoto Skin per Carni Fresche",
    category: "alimentare",
    docId: "doc_029"
  },
  {
    id: "Q30",
    query: "Rilevamento accelerometrico delle oscillazioni anomale per prevenire blocchi imprevisti nei nastri di trasporto",
    targetExcerpt: "Analisi spettrale delle vibrazioni sui cuscinetti dei convogliatori: sensori MEMS triassiali che monitorano frequenze tipiche di usura per pianificare la lubrificazione.",
    title: "Manutenzione Predittiva Convogliatori Linee Imbottigliamento",
    category: "manutenzione",
    docId: "doc_030"
  },
  {
    id: "Q31",
    query: "Progettazione di contenitori cilindrici che permetta la scomposizione manuale immediata delle parti ferrose dalla struttura cartacea",
    targetExcerpt: "Barattoli compositi ad agevole disassemblaggio: fondo metallico aggraffato con linguetta a strappo che separa la flangia in alluminio dal cilindro di cartoncino per il conferimento nei cassonetti.",
    title: "Ecodesign di Packaging Multimateriale Facilmente Disassemblabile",
    category: "sostenibilita",
    docId: "doc_031"
  },
  {
    id: "Q32",
    query: "Impianti a siringa dosatrice con ugelli a taglio netto per fluidi viscosi senza sbavature sulle imboccature",
    targetExcerpt: "Dosatori volumetrici a pistone con valvola rotante e taglia-goccia ad azionamento pneumatico per maionese e salse dense in vasetti di vetro.",
    title: "Dosaggio di Precisione per Salse Viscose",
    category: "macchine",
    docId: "doc_032"
  },
  {
    id: "Q33",
    query: "Cassette coibentate con placche a cambiamento di fase per la spedizione aerea di fiale termolabili",
    targetExcerpt: "Contenitori isotermici con pannelli sottovuoto VIP ed accumulatori PCM tarati a quattro gradi: mantenimento della temperatura controllata per novantasei ore di volo.",
    title: "Logistica Farmaceutica Refrigerata con Accumulatori PCM",
    category: "logistica",
    docId: "doc_033"
  },
  {
    id: "Q34",
    query: "Valutazione dinamica del carico di schiacciamento massimo che una scatola fustellata regge prima di deformarsi",
    targetExcerpt: "Prova di compressione verticale Box Compression Test BCT secondo ISO 12048: presse a piastre parallele registrano i kilonewton di cedimento delle pareti ondulate.",
    title: "Determinazione Resistenza Meccanica BCT Scatole Ondulate",
    category: "collaudi",
    docId: "doc_034"
  },
  {
    id: "Q35",
    query: "Espulsione dell aria mediante introduzione di gas nobile prima della tappatura di barattoli di latte solubile",
    targetExcerpt: "Lavaggio con argon gassoso nella giostra di riempimento: abbattimento della concentrazione di O2 al di sotto dello zero virgola cinque percento per proteggere micronutrienti e vitamine.",
    title: "Inertizzazione Polveri Alimentari Sensibili",
    category: "alimentare",
    docId: "doc_035"
  },
  {
    id: "Q36",
    query: "Recipienti spremibili realizzati interamente in polietilene alta densita riciclabile per creme emollienti",
    targetExcerpt: "Tubi cosmetici mono-HDPE con spalla e tappo nella medesima resina: saldabilita ottimale e totale riciclabilita nel circuito flaconi rigidi da raccolta urbana.",
    title: "Tubetti Cosmetici Monopolimero Circolari",
    category: "materiali",
    docId: "doc_036"
  },
  {
    id: "Q37",
    query: "Tappeti modulari sagomati in plastica lavabili con idropulitrici ad alta pressione per salumi affettati",
    targetExcerpt: "Nastri trasportatori igienici a maglie aperte in POM: conformi alle prescrizioni EHEDG, superfici prive di punti di ristagno facilmente detersibili con schiume sanificanti.",
    title: "Sistemi di Trasporto Igienico per Carni Lavorate",
    category: "macchine",
    docId: "doc_037"
  },
  {
    id: "Q38",
    query: "Sensori fotonici ad elevata penetrazione per individuare microframmenti di filo di ferro e pietrisco nei cibi confezionati",
    targetExcerpt: "Ispezionatrice radiografica a raggi X in continuo: algoritmo di discriminazione di densita per identificare frammenti vetrosi, metallici e ossei all interno di vaschette sigillate.",
    title: "Rilevazione Contaminanti Solidi con Sistemi a Raggi X",
    category: "sicurezza",
    docId: "doc_038"
  },
  {
    id: "Q39",
    query: "Soluzioni per favorire la rimozione dei coperchi plastici termosaldati per consumatori con limitata destrezza articolare",
    targetExcerpt: "Film pelabili ad apertura facilitata Easy-Peel: formulazione del sigillante con adesione controllata che consente lo strappo fluido e continuo senza lacerazione del film.",
    title: "Accessibilita e Apertura Facilitata nelle Vaschette Alimentari",
    category: "ergonomia",
    docId: "doc_039"
  },
  {
    id: "Q40",
    query: "Piani programmati per calibrare sonde termometriche e rettificare le barre di compressione termoformatrici",
    targetExcerpt: "Manuale di manutenzione preventiva delle piastre saldanti: rilievo termografico per verificare l uniformita della temperatura e sostituzione programmata delle coperture in teflon usurato.",
    title: "Procedura Calibrazione Barre Saldanti Orizzontali",
    category: "manutenzione",
    docId: "doc_040"
  }
];

// Filler subjects to generate docs 41 to 120
const FILLER_TOPICS = [
  "Cartone compatto per scatole lusso", "Film estensibile automatico per fasciapallet",
  "Adesivi a caldo reactive hot melt", "Analisi ciclo di vita LCA imballaggi",
  "Scatole isotermiche in cartone alveolare", "Pallet in plastica riciclata igienici",
  "Regolamenti MOCA per materiali a contatto alimentare", "Confezionamento blister per minuteria metallica",
  "Incartonatrici wrap-around ad alta efficienza", "Sistemi di pesatura dinamica e controllo peso in linea",
  "Etichette termoretraibili sleeve decorate a 360 gradi", "Protezione anti-corrosione VCI per componenti metallici",
  "Flessografia digitale HD per tirature medie", "Buste stand-up con zip richiudibile salva-freschezza",
  "Vaschette in polpa di cellulosa stampata per uova", "Linee di imbottigliamento asettico per bevande",
  "Certificazione BRC GS Packaging Materials", "Imballaggi pericolosi omologati ONU per sostanze chimiche",
  "Sistemi di legatura automatica con reggia in poliestere", "Film barriera coestruso a 9 strati",
  "Valvole di degasaggio per sacchetti di caffe in grani", "Scatole automontanti per spedizioni veloci",
  "Nastri adesivi rinforzati per imballi pesanti", "Sistemi di visione 3D per orientamento bottiglie",
  "Audit di conformita imballaggi alimentari", "Studio di stabilita del carico pallettizzato",
  "Riduzione sfridi di fustellatura negli scatolifici", "Trattamenti antimuffa ecologici per bancali in legno",
  "Sacchi industriali a valvola per cementi e premiscelati", "Packaging monodose per settore cosmetico",
  "Film estensibile prestirato per risparmio materiale", "Vaschette in alluminio laccato per piatti pronti",
  "Sistemi di trasporto pneumatico per tappi e capsule", "Incollaggio scatole con colle viniliche ecologiche",
  "Certificazione ISO 14001 per aziende di packaging", "Tappi dosatori con ghiera di sicurezza",
  "Film barriera biodegradabile a base di amido", "Linee di termoformatura fiale per farmaceutica",
  "Scatole in cartone con stampa flexo ad acqua", "Imballaggi conduttivi ESD per schede elettroniche"
];

function generateA05Corpus() {
  fs.mkdirSync(CORPUS_DIR, { recursive: true });

  const queriesOutput = [];

  // Generate Docs 1 to 40 (Matching pairs)
  for (let i = 0; i < PAIRS.length; i++) {
    const p = PAIRS[i];
    const docNum = (i + 1).toString().padStart(3, '0');
    const docId = `doc_${docNum}`;

    let content = `---
title: "${p.title}"
status: approved
category: packaging
tags: [packaging, consulenza, ${p.category}]
date: "2026-09-19"
document_id: "${docId}"
---

# ${p.title}

## Sintesi Tecnica ed Ambito Operativo

La presente documentazione approfondisce i protocolli tecnici ed operativi relativi alle soluzioni di packaging e consulenza strategica per l industria.

${p.targetExcerpt}

## Specifiche e Parametri Operativi

I dettagli operativi richiedono l adozione di parametri misurabili e conformi alle prescrizioni di settore:
- Tolleranza dimensionale ammessa: conforme a standard UNI EN.
- Pressione operativa di esercizio: monitorata con manometri digitali tarati.
- Efficienza energetica della linea: calcolo del coefficiente di resa oraria.

`;

    // Add table or list to some documents (>= 20)
    if (i % 2 === 0) {
      content += `
### Tabella Parametri di Processo

| Parametro | Unita di Misura | Valore Standard | Tolleranza |
|---|---|---|---|
| Velocita nominale | pezzi/minuto | 120 | +/- 5% |
| Temperatura saldatura | gradi C | 145 | +/- 2C |
| Pressione sigillatura | bar | 4.5 | +/- 0.2 bar |
| Spessore film | micrometri | 45 | +/- 2% |

`;
    }

    // Add multi-section page markers to some documents (>= 10)
    if (i % 3 === 0) {
      content += `
## Pagina 1

Contenuto introduttivo della sezione prima, analisi dei requisiti di capitolato e pianificazione delle prove industriali su linea pilota.

## Pagina 2

Risultati dei collaudi dimensionali ed analisi spettroscopica dei materiali polimerici dopo quarantotto ore di condizionamento climatico.
`;
    }

    const filePath = path.join(CORPUS_DIR, `${docId}.md`);
    fs.writeFileSync(filePath, content, 'utf8');

    queriesOutput.push({
      queryId: p.id,
      text: p.query,
      relevantDocumentIds: [docId],
      relevantPassageIds: [`${docId}_p0`],
      relevantTargetExcerpt: p.targetExcerpt
    });
  }

  // Generate Docs 41 to 120 (Filler realistic documents to reach at least 120 docs)
  for (let i = 40; i < 120; i++) {
    const docNum = (i + 1).toString().padStart(3, '0');
    const docId = `doc_${docNum}`;
    const topicIdx = (i - 40) % FILLER_TOPICS.length;
    const topic = FILLER_TOPICS[topicIdx];

    let content = `---
title: "Studio Tecnico: ${topic} (Fase ${Math.floor(i / 20) + 1})"
status: approved
category: packaging
tags: [packaging, consulenza, settore_industriale, standard_${i}]
date: "2026-09-19"
document_id: "${docId}"
---

# Studio Tecnico: ${topic}

## Inquadramento Generale e Requisiti

La presente scheda tecnica e di consulenza analizza l applicazione di ${topic} per la modernizzazione degli impianti di confezionamento ed imballaggio industriale.

In questo settore, l efficacia delle soluzioni di imballo dipende dalla selezione accurata dei parametri di processo e dalla conformita dei lotti produttivi agli standard normativi internazionali. L audit energetico e prestazionale consente di ridurre le inefficienze della catena logistica e distributiva.

`;

    if (i % 2 === 1) {
      content += `
### Dettaglio delle Prove Sperimentali

| Codice Prova | Tipo Collaudo | Esito Rilevato | Note Tecniche |
|---|---|---|---|
| TST-00${i} | Tenuta pressione | Conforme | Nessuna microfessura riscontrata |
| TST-01${i} | Carico statico | Superato | Deformazione inferiore a 2 mm |
| TST-02${i} | Invecchiamento | Ottimale | Proprieta meccaniche inalterate |

`;
    }

    if (i % 4 === 0) {
      content += `
## Pagina 1

Introduzione alla fase di progettazione e calcolo dei fattori di sicurezza per la fornitura dei materiali di confezionamento.

## Pagina 2

Relazione sui collaudi di laboratorio, verifiche di compatibilita chimico-fisica e piano di campionamento secondo norma ISO 2859.
`;
    }

    const filePath = path.join(CORPUS_DIR, `${docId}.md`);
    fs.writeFileSync(filePath, content, 'utf8');
  }

  fs.writeFileSync(QUERIES_PATH, JSON.stringify(queriesOutput, null, 2), 'utf8');
  console.log(`Successfully generated ${120} documents in ${CORPUS_DIR}`);
  console.log(`Successfully generated ${queriesOutput.length} queries in ${QUERIES_PATH}`);
}

generateA05Corpus();
