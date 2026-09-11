# LIMEN Vault — System Architecture Document

## Overview

LIMEN Vault is a standalone, local-first AI Knowledge System designed for LIMEN / Packaging in Italy. It provides an independent knowledge environment that operates directly on an Obsidian-compatible Markdown vault stored on the user's macOS device.

---

## Independence Architecture

LIMEN Vault is designed with strict runtime decoupling:

```text
+-------------------------------------------------------------------+
|                        LIMEN Vault Desktop                        |
|                                                                   |
|  +------------------+  +-------------------+  +----------------+  |
|  | Local Vault Files|  | Local Search Index|  | Snapshot Engine|  |
|  | (Markdown/YAML)  |  | (Offline Search)  |  | (SHA-256)      |  |
|  +------------------+  +-------------------+  +----------------+  |
+-------------------------------------------------------------------+
                                  ^
                                  | (Optional Internet AI queries)
                                  v
                        +--------------------+
                        |  OpenAI / Codex    |
                        +--------------------+
```

### Decoupling Rules
1. **No External Systems**: The desktop application has **zero** runtime dependencies on `PII_CRM`, `MEMAI`, `M3MAI`, `Render`, `Vercel`, or `Cloudflare R2`.
2. **Offline Local Knowledge**: Opening, browsing, searching, reading sources, and verifying snapshots work 100% offline.
3. **Authorized AI Providers**: AI inference uses OpenAI, ChatGPT, Codex, or future local LLM models. Anthropic, Claude, Gemini, and DeepSeek are strictly prohibited.

---

## Monorepo Layout

- `apps/web`: Next.js web application (deployable to Vercel `limen-vault`).
- `apps/desktop`: Native macOS application (React + Tauri).
- `packages/ui`: Shared design system (macOS neutral visual palette).
- `packages/vault-core`: Core vault filesystem security guards & root managers.
- `packages/vault-schema`: Zod schemas & TypeScript types.
- `packages/snapshot-engine`: Local SHA-256 integrity verification.
- `packages/ai-engine`: OpenAI & Codex provider interfaces.
- `packages/knowledge-compiler`: Markdown wiki generator.
- `packages/search-engine`: Local full-text & metadata search.
- `packages/proposal-engine`: Governed AI write proposal workflows.
- `vault-template`: Standard 14-folder Obsidian directory structure.
