# Obsidian Vault Specification & Schema

## Directory Layout

```text
00_SYSTEM/             # System rules, changelog, and vault manifest
01_CLIENTS/            # Client profiles and account knowledge
02_PROJECTS/           # Project specifications and briefs
03_BRANDS/             # Brand positioning and visual identities
04_POSITIONING/        # Strategic positioning frameworks
05_PACKAGING_KNOWLEDGE/# Packaging in Italy core domain knowledge
06_METHODS/            # Methodologies & analytical frameworks
07_CASE_STUDIES/       # Case studies and results
08_MARKET_RESEARCH/    # Market intelligence and sector research
09_COMPETITORS/        # Competitor analyses
10_APPROVED_OUTPUTS/   # Final human-approved knowledge documents
20_RAW_SOURCES/        # Read-only input source material
80_AI_OUTPUTS/         # AI write area for generated drafts
90_PROPOSALS/          # AI write area for candidate knowledge proposals
99_ARCHIVE/            # Archived pages
```

---

## Frontmatter Schema

All compiled Markdown pages use versioned YAML frontmatter:

```yaml
---
schema_version: 1
id: limen-positioning-example
title: "Packaging Positioning Strategy"
type: positioning
client: client-acme
project: project-brand-refresh
status: approved
source_ids:
  - raw-source-001
created_at: "2026-09-11T00:00:00Z"
updated_at: "2026-09-11T00:00:00Z"
snapshot_id: snap-2026-09-11
tags: [packaging, positioning]
---
```
