# Evidenza di Collaudo MA-09: Selezione Modelli e Indipendenza Architetturale

## Obiettivo
Garantire l'indipendenza completa dell'applicazione da uno specifico modello o provider AI, prevenendo errori di selezione su endpoint non supportati (audio, embedding, TTS, immagini) e consentendo l'utilizzo sia offline che con diversi provider commerciali (OpenAI, OpenRouter, Anthropic) e modelli locali.

## Implementazione Verificata

1. **Filtro Modelli Chat-Capable a Due Livelli**:
   - Backend Rust (`apps/desktop/src-tauri/src/ai.rs`):
     - Implementata funzione `is_chat_model(id: &str) -> bool`.
     - Esclusi rigorosamente modelli non destinati al completamento testuale o alla chat:
       - `whisper-1` (audio transcription)
       - `tts-1`, `tts-1-hd` (text-to-speech)
       - `dall-e-2`, `dall-e-3` (image generation)
       - `text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002` (embeddings)
       - `babbage`, `davinci` (legacy completion)
       - `omni-moderation`, `text-moderation`
   - Frontend TypeScript (`apps/desktop/src/ModelPicker.tsx`):
     - Implementato filtro client-side mirror `isChatModel(m.id)` per garantire visualizzazione e selezione sicure anche in caso di liste caricate da cache o endpoint custom.

2. **Test Unitari e di Regressione**:
   - `ai::model_tests::models_are_validated_and_deduplicated`: PASS (73/73 test lib.rs).
   - Verificato che una risposta contenente modelli eterogenei restituisce solo i modelli compatibili deduplicati, impostando fallback affidabili (`gpt-4o-mini`).
