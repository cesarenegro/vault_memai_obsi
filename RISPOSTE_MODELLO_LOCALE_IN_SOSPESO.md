# Risposte con modello locale — IN SOSPESO

Stato: in sospeso per decisione di Cesare, 23/09/2026 (UTC+8). Non implementare finché Cesare non lo riattiva.

## Obiettivo
Permettere a LIMEN Vault di scrivere le risposte con un modello installato sul computer, in alternativa a OpenAI, così che nessun passaggio del vault esca dal computer.

## Stato attuale verificato
- Le risposte sono generate solo da OpenAI: apps/desktop/src-tauri/src/ai.rs invia a https://api.openai.com/v1/responses (verificato al commit 25918eb).
- Il solo modello locale oggi è bge-m3 (bge-m3-Q8_0.gguf), usato per la ricerca semantica, non per scrivere risposte.
- Il llama-server incluso nella build Windows di prova è quello di Docker Desktop (firma Docker Inc, versione "1 (ec2b787)"): va sostituito con la release ufficiale di llama.cpp (FASE 7) prima di qualunque modello nuovo.
- Hardware di Cesare: NVIDIA GeForce RTX 3060, 11.543 MiB liberi rilevati da llama-server; bge-m3 occupa circa 307 MiB sulla GPU (log llama-server del 23/09/2026).
- Ollama è installato sul PC di Cesare con: qwen2.5-coder:14b (9,0 GB), deepseek-r1:14b (9,0 GB), qwen3-coder:30b (18 GB). I due "coder" sono specializzati nel codice e deepseek-r1 ragiona passo per passo prima di rispondere: nessuno è pensato per scrivere prosa in italiano da documenti. qwen3-coder:30b supera la memoria della RTX 3060.

## Candidati individuati (da riverificare alla ripresa)
Fonte sulla qualità in italiano: studio del Politecnico di Milano, maggio 2026, test ITALIC su materiale d'esame italiano autentico — https://arxiv.org/pdf/2605.07731
Risultati riportati: Ministral-3-8B-Instruct 87,4% (migliore modello aperto), GPT-5 nano 86,8%, gemma-3-12b 76,5%, Qwen3-8B 70,8%, Velvet-14B 68,1%, Minerva-7B 49,9%. Il test è a scelta multipla: misura la comprensione, non la scrittura di risposte.

1. Ministral 3 8B Instruct (Mistral AI), licenza Apache 2.0.
   File GGUF ufficiale: https://huggingface.co/mistralai/Ministral-3-8B-Instruct-2512-GGUF — file Ministral-3-8B-Instruct-2512-Q5_K_M.gguf, 6.059.268.512 byte, SHA-256 pubblicato dichiarato 7A5454127EC772E2389F0E71A77FEDB88B83D4366D8A69FACD0CFD0898F04D35 (da riverificare sulla pagina del file).
2. Gemma 4 12B instruction-tuned (Google), licenza Apache 2.0 dal 2 aprile 2026.
   File GGUF ufficiale QAT: https://huggingface.co/google/gemma-4-12B-it-qat-q4_0-gguf — file gemma-4-12b-it-qat-q4_0.gguf, 6.975.879.296 byte, SHA-256 pubblicato dichiarato 93567E57A8FE10B23569B9D9EC38CD005DEEDF71E29477C421A4B83F418A538B (da riverificare). Modalità di ragionamento da disattivare.
3. Qwen3.5 9B: escluso finché la versione di llama.cpp in uso non ne carica l'architettura (qwen35). La verifica fatta cercando testo nel binario ha escluso il supporto.
