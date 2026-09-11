# LIMEN Vault

> **Independent Local-First AI Knowledge System**

LIMEN Vault is a standalone, local-first knowledge environment built for LIMEN / Packaging in Italy. It provides an offline-capable, Obsidian-compatible Markdown Knowledge Vault, local full-text search, persistent knowledge wiki compilation, snapshot integrity verification, and AI-assisted knowledge workflows.

---

## 1. Why LIMEN Vault is Independent from MEMAI

LIMEN Vault is architected specifically so that core knowledge operations remain usable even when cloud services and external CRM systems are offline. 

**Fundamental Principle:**
> LIMEN Vault must never require MEMAI, PII_CRM, Render, Vercel, or Cloudflare R2 in order to open, browse, search, or inspect an already available local knowledge snapshot on macOS.

---

## 2. Monorepo Architecture

```text
LIMEN-VAULT/
├── apps/
│   ├── web/                    # Next.js Web Dashboard (Vercel target: limen-vault)
│   └── desktop/                # Tauri / React Desktop Application (macOS primary target)
│
├── packages/
│   ├── ui/                     # Shared Design System (macOS minimal aesthetic)
│   ├── vault-core/             # Core Vault interfaces & security guards
│   ├── vault-schema/           # Zod schemas & TypeScript contracts
│   ├── knowledge-compiler/     # Knowledge compiler interfaces & contracts
│   ├── search-engine/          # Offline local search abstractions
│   ├── snapshot-engine/        # Local snapshot & SHA-256 integrity contracts
│   ├── ai-engine/              # OpenAI / Codex abstract provider interfaces
│   └── proposal-engine/        # Proposal workflow & write-safety contracts
│
├── vault-template/             # Obsidian-compatible directory template & system markdown specs
│   ├── 00_SYSTEM/
│   ├── 01_CLIENTS/
│   ├── 02_PROJECTS/
│   ├── 03_BRANDS/
│   ├── 04_POSITIONING/
│   ├── 05_PACKAGING_KNOWLEDGE/
│   ├── 06_METHODS/
│   ├── 07_CASE_STUDIES/
│   ├── 08_MARKET_RESEARCH/
│   ├── 09_COMPETITORS/
│   ├── 10_APPROVED_OUTPUTS/
│   ├── 20_RAW_SOURCES/
│   ├── 80_AI_OUTPUTS/
│   ├── 90_PROPOSALS/
│   └── 99_ARCHIVE/
│
├── docs/                       # Architecture, security, and milestone documentation
├── tests/                      # Automated guard tests & verification suites
├── scripts/                    # Workspace verification helpers
├── AGENTS.md                   # System rules and independence guidelines
└── SECRETS.TXT                 # Local environment template (Git-ignored)
```

---

## 3. Quick Start & Running Locally

### Prerequisites
- Node.js (>= 20.0.0)
- `pnpm` (>= 9.0.0)

### Installation
```bash
pnpm install
```

### Running Applications
```bash
# Run Web Application (Next.js)
pnpm dev:web

# Run Desktop Application (React / Tauri shell)
pnpm dev:desktop
```

---

## 4. Verification & Testing

```bash
# Run unit & prohibited-dependency guard tests
pnpm test

# TypeScript type checking across all apps & packages
pnpm typecheck

# Production build
pnpm build
```

---

## 5. Current Milestone Status

**Current Milestone:** `M0 — FOUNDATION` & `M1 — PRODUCT UI SHELL` (COMPLETE)

- [x] Monorepo architecture established
- [x] Standalone independence guards implemented
- [x] Obsidian vault template (`vault-template/`) created with markdown system specs
- [x] Reusable macOS minimal design system (`packages/ui`)
- [x] Desktop application shell with first-run flow and 11 core screens
- [x] Web application shell with MEMAI status placeholder & LIMEN Vault landing
- [x] Architecture & milestone documentation complete (`docs/`)

---

## 6. Authorized AI Ecosystem & Non-Goals

### Authorized AI Ecosystem
- OpenAI (GPT-4o, ChatGPT)
- Codex
- Future local LLMs

### Explicitly Prohibited
- Anthropic & Claude (Strictly prohibited by design policy)
- Gemini & DeepSeek (Prohibited)
- `memaiFetch`, `PII_CRM` or `M3MAI` runtime dependencies

### Explicit Non-Goals for M0/M1
- Direct AI writes to approved knowledge directories (AI output is strictly written to `80_AI_OUTPUTS` or `90_PROPOSALS`).
- Simulated or fake working health data when external services are unavailable.

---

## 7. Security & Filesystem Principles

1. **Path Traversal Protection**: Vault core strictly validates paths to prevent relative escapes (`..`), symlink redirection outside vault root, or absolute path traversal.
2. **Deterministic Manifests**: Manifests track relative file paths and SHA-256 hashes to verify vault integrity locally.
3. **Secret Isolation**: Secrets are kept outside vault markdown files and stored in local OS facilities or git-ignored environment configs.
