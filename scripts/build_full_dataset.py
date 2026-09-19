#!/usr/bin/env python3
import json
import os
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CORPUS_DIR = ROOT / "tests" / "gold" / "A05_CORPUS"
QUERIES_PATH = ROOT / "tests" / "gold" / "A05_QUERIES.json"
sys.path.insert(0, str(ROOT))

from scripts.data_part1_gold import DOCS_GOLD_40
from scripts.corpus_part2 import DOCS_PART2
from scripts.corpus_part3 import DOCS_PART3
from scripts.generate_diverse_a05 import extract_tokens, compute_jaccard

# 1. Load exact base queries from git eaa8413
raw_queries = subprocess.check_output(["git", "show", "eaa8413:tests/gold/A05_QUERIES.json"]).decode("utf-8")
base_queries = json.loads(raw_queries)
assert len(base_queries) == 40

# Assign exact excerpt and query to part 1
for i in range(40):
    DOCS_GOLD_40[i]["target_excerpt"] = base_queries[i]["relevantTargetExcerpt"]
    DOCS_GOLD_40[i]["query"] = base_queries[i]["text"]
    DOCS_GOLD_40[i]["query_id"] = base_queries[i]["queryId"]

# 2. Update the 7 overlapping fillers in part 2 and 3
# doc_047
DOCS_PART2[6] = {
    "id": "doc_047",
    "query_id": None,
    "title": "Sboccatrici e Dosatrici di Liqueur d Expedition per Metodo Classico",
    "category": "enologia_spumanti",
    "tags": ["sboccatura_degorgement", "liqueur_expedition", "dosaggio_sciroppo"],
    "query": None,
    "target_excerpt": None,
    "body_paragraphs": [
        "La fase finale di confezionamento dello spumante metodo classico richiede l espulsione del ghiacciolo contenente i lieviti esausti dal collo della bottiglia.",
        "La giostra rotante automatica congela il collo a meno venticinque gradi prima di stappare la corona permettendo alla pressione interna di sparare fuori il deposito.",
        "Un gruppo dosatore in acciaio inox inietta tempestivamente il vino di dosaggio rimboccando il livello prima dell inserimento definitivo del tappo in sughero."
    ],
    "table": "| Velocita Oraria | Dosaggio Liqueur | Tolleranza Livello |\n|---|---|---|\n| 1200 bottiglie/h | 15 ml | +/- 0.5 mm |\n| 2500 bottiglie/h | 20 ml | +/- 0.8 mm |\n| 4000 bottiglie/h | 25 ml | +/- 1.0 mm |",
    "pages": None
}

# doc_049
DOCS_PART2[8] = {
    "id": "doc_049",
    "query_id": None,
    "title": "Gruppi di Taglio ad Acqua Waterjet ad Altissima Pressione per Guarnizioni",
    "category": "taglio_waterjet",
    "tags": ["waterjet_abrasivo", "quattromila_bar", "taglio_guarnizioni"],
    "query": None,
    "target_excerpt": None,
    "body_paragraphs": [
        "La sagomatura di guarnizioni industriali in gomma densa, grafite armata o PTFE espanso esige tagli ortogonali privi di bave termiche o distorsioni.",
        "L intensificatore idraulico comprime l acqua demineralizzata a oltre quattromila bar convogliandola attraverso un orifizio in zaffiro o diamante da tre decimi.",
        "La miscelazione controllata con sabbia di granato consente di fendere spessori fino a cinquanta millimetri senza alterare la struttura molecolare del pezzo."
    ],
    "table": "| Pressione Esercizio | Portata Abrasivo | Velocita Taglio Gomma |\n|---|---|---|\n| 3200 bar | 250 g/min | 800 mm/min |\n| 3800 bar | 350 g/min | 1400 mm/min |\n| 4100 bar | 450 g/min | 2100 mm/min |",
    "pages": None
}

# doc_050
DOCS_PART2[9] = {
    "id": "doc_050",
    "query_id": None,
    "title": "Sistemi di Guida Nastro Flessografico con Sensori a Ultrasuoni per Bordi",
    "category": "guida_nastro",
    "tags": ["guidanastro", "sensore_ultrasuoni", "centratura_bobina"],
    "query": None,
    "target_excerpt": None,
    "body_paragraphs": [
        "Lo sbandamento laterale del film plastico trasparente durante lo svolgimento dalle bobine madri provoca disallineamenti di stampa e grinze diagonali.",
        "Il sensore a forchetta a ultrasuoni misura la posizione del bordo del nastro senza risentire della trasparenza ottica o della riflettanza della pellicola.",
        "Un attuatore elettromeccanico a vite ricircolo di sfere corregge istantaneamente l inclinazione del telaio di scorrimento mantenendo il nastro in asse."
    ],
    "table": None,
    "pages": "## Pagina 1\n\nTaratura della sensibilita di risposta del servomotore brushless di correzione assiale.\n\n## Pagina 2\n\nCompensazione dell oscillazione del nastro in funzione della velocita di linea fino a 400 m/min."
}

# doc_058
DOCS_PART2[17] = {
    "id": "doc_058",
    "query_id": None,
    "title": "Casse Pieghevoli in Compensato Marino con Cantonali in Acciaio Zincato",
    "category": "casse_pieghevoli_legno",
    "tags": ["compensato_marino", "cantonali_zincati", "imballo_esportazione"],
    "query": None,
    "target_excerpt": None,
    "body_paragraphs": [
        "La spedizione di apparecchiature elettromeccaniche complesse richiede casse resistenti alla salsedine e facili da stivare a vuoto nei magazzini.",
        "I pannelli in multistrato fenolico di betulla vengono incernierati con angolari metallici dentati in lamiera zincata ribadita meccanicamente.",
        "La cassa si apre e si richiude a soffietto occupando da piegata soltanto il quindici percento del volume originario facilitando la logistica di ritorno."
    ],
    "table": "| Dimensioni Esterne | Spessore Parete | Portata Statica Impilamento |\n|---|---|---|\n| 800x600x600 mm | 6 mm | 2500 kg |\n| 1200x800x800 mm | 8 mm | 4000 kg |\n| 1600x1200x1000 mm | 10 mm | 6000 kg |",
    "pages": None
}

# doc_059
DOCS_PART2[18] = {
    "id": "doc_059",
    "query_id": None,
    "title": "Distributori Elettromagnetici di Flussante per Saldatura Circuiti",
    "category": "elettronica_dosaggio",
    "tags": ["flussante_saldatura", "ugello_elettromagnetico", "schede_pcb"],
    "query": None,
    "target_excerpt": None,
    "body_paragraphs": [
        "La brasatura a onda delle schede elettroniche esige la deposizione calibrata di flussante disossidante senza creare accumuli o sbavature corrosive.",
        "La microvalvola piezoelettrica ad altissima frequenza genera gocce calibrate da pochi nanolitri indirizzandole esclusivamente sulle piazzole di rame.",
        "La rapida evaporazione del veicolo alcolico lascia un velo sottile di resina debolmente attivata che favorisce la saldatura stagno-argento senza residui."
    ],
    "table": "| Frequenza Gocce | Diametro Spot Flussante | Pressione Flussante |\n|---|---|---|\n| 500 Hz | 0.8 mm | 1.2 bar |\n| 1200 Hz | 0.5 mm | 1.8 bar |\n| 2000 Hz | 0.3 mm | 2.4 bar |",
    "pages": None
}

# doc_082
DOCS_PART3[1] = {
    "id": "doc_082",
    "query_id": None,
    "title": "Essiccatori Rotativi a Cilindro per Granulati Plastici Idrofili",
    "category": "essiccatori_polimeri",
    "tags": ["essiccatore_rotativo", "deumidificazione_nylon", "punto_rugiada_negativo"],
    "query": None,
    "target_excerpt": None,
    "body_paragraphs": [
        "I polimeri tecnici igroscopici come poliammidi e policarbonati provocano difetti superficiali di idrolisi se estrusi in presenza di umidita residua.",
        "Il cilindro rotante a pale elicoidali miscela i granuli investendoli con un flusso d aria secca a punto di rugiada inferiore a meno quaranta gradi.",
        "La rigenerazione ciclica delle torri a setacci molecolari assicura una deumidificazione ininterrotta portando l umidita del granulo sotto lo zero virgola zero due percento."
    ],
    "table": "| Polimero Trattato | Temperatura Aria | Tempo Essiccamento |\n|---|---|---|\n| PA6 Poliammide | 85 C | 4.0 ore |\n| PBT Poliestere | 120 C | 3.5 ore |\n| PC Policarbonato | 125 C | 3.0 ore |",
    "pages": None
}

# doc_084
DOCS_PART3[3] = {
    "id": "doc_084",
    "query_id": None,
    "title": "Spalmatrici Hot-Melt a Rullo per Accoppiamento Moquette e Insonorizzanti",
    "category": "spalmatura_termica",
    "tags": ["spalmatrice_rullo", "hotmelt_insonorizzante", "automotive_tappeti"],
    "query": None,
    "target_excerpt": None,
    "body_paragraphs": [
        "La fabbricazione di pannelli fonoassorbenti per vani motore e tappetini per auto impone l incollaggio tenace di feltri tessili e membrane bituminose.",
        "La testa di spalmatura a rullo riscaldato a diatermia deposita una pellicola continua di adesivo termoplastico a viscosita controllata.",
        "La calandra di laminazione a doppio rullo raffreddato ad acqua compatta i materiali all istante bloccando la stratificazione senza rilascio di solventi."
    ],
    "table": "| Spessore Spalmatura | Temperatura Fuso | Velocita Avanzamento |\n|---|---|---|\n| 45 g/m2 | 175 C | 25 m/min |\n| 70 g/m2 | 185 C | 18 m/min |\n| 110 g/m2 | 195 C | 12 m/min |",
    "pages": None
}

# 3. Assemble all 120 documents
all_docs = []

# Part 1: docs 1..40
for d in DOCS_GOLD_40:
    all_docs.append({
        "id": d["id"],
        "query_id": d["query_id"],
        "title": d["title"],
        "category": d["category"],
        "tags": d["tags"],
        "query": d["query"],
        "target_excerpt": d["target_excerpt"],
        "body_paragraphs": d["body"],
        "table": d["table"],
        "pages": d["pages"]
    })

# Part 2: docs 41..80
for d in DOCS_PART2:
    all_docs.append(d)

# Part 3: docs 81..120
for d in DOCS_PART3:
    all_docs.append(d)

assert len(all_docs) == 120, f"Expected 120 docs, got {len(all_docs)}"
print("Assembled 120 documents.")

# 4. Check diversity and non-overlap
print("\n--- Verifying Diversity Across All 7,140 Pairs ---")
tokens = [extract_tokens(d["title"] + " " + " ".join(d["body_paragraphs"]) + " " + (d["target_excerpt"] or "") + " " + (d["table"] or "") + " " + (d["pages"] or "")) for d in all_docs]

max_j = 0
worst_pair = None
violations = 0
total_pairs = 0
sum_j = 0

for i in range(len(all_docs)):
    for j in range(i + 1, len(all_docs)):
        total_pairs += 1
        j_val = compute_jaccard(tokens[i], tokens[j])
        sum_j += j_val
        if j_val > max_j:
            max_j = j_val
            worst_pair = (all_docs[i]["id"], all_docs[j]["id"], j_val)
        if j_val > 0.30:
            violations += 1

print(f"Total pairs: {total_pairs}")
print(f"Average Jaccard: {sum_j / total_pairs:.4f}")
print(f"Max Jaccard: {max_j:.4f} between {worst_pair[0]} and {worst_pair[1]}")
print(f"Violations (>0.30): {violations}")
assert violations == 0, f"Found {violations} diversity violations!"

tables_count = sum(1 for d in all_docs if d["table"] is not None)
pages_count = sum(1 for d in all_docs if d["pages"] is not None)
print(f"Docs with tables: {tables_count} (>= 20 required)")
print(f"Docs with pages: {pages_count} (>= 10 required)")
assert tables_count >= 20
assert pages_count >= 10

# 5. Check 40 gold queries overlap
print("\n--- Verifying Zero Overlap for 40 Gold Queries ---")
overlap_fails = 0
for i in range(40):
    d = all_docs[i]
    qw = extract_tokens(d["query"])
    tw = extract_tokens(d["target_excerpt"])
    inter = qw & tw
    if inter:
        print(f"FAIL {d['query_id']}: {inter}")
        overlap_fails += 1

print(f"Overlap check failures: {overlap_fails} (must be 0)")
assert overlap_fails == 0, f"Found {overlap_fails} overlapping queries!"

# 6. Write files to tests/gold/A05_CORPUS/ and tests/gold/A05_QUERIES.json
CORPUS_DIR.mkdir(parents=True, exist_ok=True)
queries_out = []

for d in all_docs:
    doc_id = d["id"]
    title = d["title"]
    cat = d["category"]
    tags = d["tags"]
    
    content = f"""---
title: "{title}"
status: approved
category: {cat}
tags: [{", ".join(tags)}]
date: "2026-09-19"
document_id: "{doc_id}"
---

# {title}

"""
    if d.get("target_excerpt"):
        content += f"""## Descrizione e Specifiche Tecniche

{d["target_excerpt"]}

"""
    content += "## Inquadramento ed Evidenze di Processo\n\n"
    content += "\n\n".join(d["body_paragraphs"]) + "\n\n"
    
    if d.get("table"):
        content += f"""### Dati Sperimentali di Collaudo

{d["table"]}

"""
    if d.get("pages"):
        content += f"""{d["pages"]}
"""
    
    with open(CORPUS_DIR / f"{doc_id}.md", "w", encoding="utf-8") as f:
        f.write(content)
        
    if d.get("query_id"):
        queries_out.append({
            "queryId": d["query_id"],
            "text": d["query"],
            "relevantDocumentIds": [doc_id],
            "relevantPassageIds": [f"{doc_id}_p0"],
            "relevantTargetExcerpt": d["target_excerpt"]
        })

with open(QUERIES_PATH, "w", encoding="utf-8") as f:
    json.dump(queries_out, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"\nSuccessfully wrote 120 docs to {CORPUS_DIR}")
print(f"Successfully wrote 40 queries to {QUERIES_PATH}")
