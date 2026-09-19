# Evidenze grezze — audit Claude 19 settembre 2026 (UTC+8)

Ambiente: VM Linux del desktop Cowork con la cartella del progetto montata. Nessun comando macOS (spctl, cargo, xcrun, pnpm) eseguibile da qui.

## Identita del checkout
```
HEAD 3a2124733a29956b94d7e2d48720064c9f014a01 2026-09-16 22:49:24 +0200 feat(desktop): add vault RAW quick access, top navbar refresh and redesign proposal review UI
file modificati o non tracciati rispetto a HEAD: 80
```

## R2 — ricerca semantica non nel percorso reale
```
462:        const results=status.state==='ready'?await ipc.searchVault(vaultPath,{term:searchTerm.trim()||undefined,category:searchCategory||undefined,client:searchClient.trim()||undefined,project:searchProject.trim()||undefined,tags:searchTags.split(',').map(t=>t.trim()).filter(Boolean),status:searchStatusFilter||undefined}):[];
291:    getEmbeddingsStatus: (path: string) => readOnly(async () => invoke<EmbeddingsStatusReport>('embeddings_get_status', { vaultPath: path })),
292:    syncEmbeddings: (path: string, apiKey: string, model?: string) => run(async () => invoke<EmbeddingsStatusReport>('embeddings_sync_vault', { vaultPath: path, apiKey, model: model ?? null })),
293:    searchVaultHybrid: (path: string, query: SearchQuery, apiKey?: string, useSemantic?: boolean) => readOnly(async () => searchResults(await invoke('search_vault_hybrid', { vaultPath: path, query, apiKey: apiKey ?? null, useSemantic: useSemantic ?? true }))),
chiamate nei componenti (atteso 0 se non integrata): 0
```

## R3 — top-50 prima del filtro di ammissibilita
```
```

## R4 — verifica hash/revisione nel lettore
```
occorrenze verify_document_passage_integrity: 0
911:pub fn read_passage(
912-    vault_path: &Path,
913-    document_id: &str,
914-    passage_id: &str,
915-) -> Result<DocumentPassage, String> {
916-    let doc = get_document(vault_path, document_id)?;
917-    let passage = doc.passages
918-        .into_iter()
919-        .find(|p| p.passage_id == passage_id)
920-        .ok_or_else(|| format!("Passaggio non trovato: {}", passage_id))?;
921-    
922-    // Verify passage integrity
923-    let actual_hash = compute_sha256(passage.text.as_bytes());
924-    if actual_hash != passage.sha256 {
925-        return Err(format!("Integrità passaggio compromessa (hash atteso {}, trovato {})", passage.sha256, actual_hash));
926-    }
927-    Ok(passage)
132:          const txt = await ipc.readDocumentText(vaultPath, record.documentId);
```

## R5 — lettore limitato alla prima pagina del catalogo
```
117:          const listRes = await ipc.listCatalogDocuments(vaultPath);
868:    let limit = options.limit.unwrap_or(50);
```

## R6 — locator passato come passageId
```
27:      onOpenDocument(s.relativePath || s.documentId, s.locator || s.passageId);
434:                          passageRefs.current.set(passage.passageId, el);
435:                          if (passage.locator) passageRefs.current.set(passage.locator, el);
```

## C1/C2 — locator sintetici e chunking senza sovrapposizione
```
239:                format!("Paragrafo {}", current_locator_start)
265:            format!("Paragrafo {}", current_locator_start)
251:            current_chunk.clear();
32:            result += "\n\n## Pagina \(index+1)\n\n"
139:                                "\n\n## Slide {slide}\n\n{}",
```

## C3 — catalogo su file JSON, non SQLite
```
16:pub const CATALOG_FILE: &str = "VAULT_CATALOG.json";
occorrenze rusqlite/sqlx in Cargo.toml: 0
```

## Suite non eseguibili in questo ambiente
```
Error: 
esbuild presente nel checkout e compilato per macOS arm64: non eseguibile nella VM Linux
```
