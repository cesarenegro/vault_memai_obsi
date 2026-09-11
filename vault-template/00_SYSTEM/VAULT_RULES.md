---
schema_version: 1
id: system-vault-rules
title: Vault Governance & Write Safety Rules
type: approved_output
status: approved
created_at: 2026-09-11T00:00:00Z
updated_at: 2026-09-11T00:00:00Z
tags: [system, governance]
---

# Vault Governance & Write Safety Rules

1. **Raw Sources (`20_RAW_SOURCES`)**: Strictly READ-ONLY for AI processes.
2. **Approved Knowledge (`01_CLIENTS` - `10_APPROVED_OUTPUTS`)**: Strictly READ-ONLY for AI processes.
3. **AI Write Operations**: AI tools may write ONLY to `80_AI_OUTPUTS` or `90_PROPOSALS`.
4. **Promotion Rule**: A proposal in `90_PROPOSALS` becomes Approved Knowledge only after explicit human review and approval.
5. **Obsidian Compatibility**: All pages must maintain standard Markdown format with valid YAML frontmatter.
