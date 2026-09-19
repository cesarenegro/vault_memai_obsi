---
schema_version: 1
id: system-vault-rules
title: Vault Governance & Write Safety Rules
type: approved_output
status: approved
created_at: 2026-09-11T00:00:00Z
updated_at: 2026-09-17T00:00:00Z
tags: [system, governance]
---

# Vault Governance & Write Safety Rules

1. **Raw Sources (`20_RAW_SOURCES`)**: originals are preserved after import. Query AI and ingestion never rewrite them.
2. **Human-approved knowledge**: existing approved notes and human edits are never overwritten by automated ingestion.
3. **Automatic ingestion**: when enabled for this Vault, the application may create immutable `auto-source-*.md` and `auto-wiki-*.md` documents in categories 01–09. They retain `status: review`, provenance and dependency hashes; they are not human approvals.
4. **Retrieval**: approved notes and current automatically generated documents may be used. Automatic documents require a matching ingestion registry and unchanged source hashes. Obsolete or edited generated versions are excluded.
5. **Query AI and proposals**: conversational AI does not modify knowledge. Saved responses/proposals remain in `80_AI_OUTPUTS`/`90_PROPOSALS`; human approval and external publication remain separate explicit actions.
6. **Obsidian compatibility**: generated pages are standard Markdown with valid YAML frontmatter and source links.
