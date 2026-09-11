# Security Model & Filesystem Boundaries

## Filesystem Security Rules

1. **Path Traversal Protection**: `sanitizeVaultPath()` rejects relative path traversal (`..`), leading slashes (`/`), and symlink escapes.
2. **Strict Vault Boundary**: All file operations are restricted to the validated local Vault root.
3. **Write Scope Enforcement**: AI automated agents may write **only** to `80_AI_OUTPUTS` and `90_PROPOSALS`. Direct AI write access to `01_CLIENTS` through `10_APPROVED_OUTPUTS` or `20_RAW_SOURCES` is hard-blocked.
4. **Secret Isolation**: Secrets are kept outside vault files and stored in local OS keyring facilities or environment templates (`SECRETS.TXT`).
