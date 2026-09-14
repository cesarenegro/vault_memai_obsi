# M10 protocol — implementation status 2026-09-13

The cloud destination selected by the owner is the existing private Cloudflare R2 bucket `m3mai-core-vault`. All new keys are under `limen/<tenant>/<vault>/<channel>/`. Existing keys outside this namespace are not migrated or changed. Private and published manifests are distinct; applications consuming a published release read the same version and objects.

The optional Worker in `services/vault-sync-api/worker.mjs` authenticates every call against `ACCESS_GRANTS`, a server secret containing token hashes, tenantId, vaultId, channels, write permission and an expiry date. Raw bearer tokens are kept in the macOS Keychain under `dev.arkai.limenvault.sync`, never in the Vault. Grant configuration is required before deployment; the repository contains no production grants. The CRM additionally checks authenticated staff and its explicit user/Vault allowlist. Names in frontmatter are not access grants.

The release history endpoint is GET `/v1/<channel>/releases`, limited to the latest 100 committed ancestors of current; orphan manifests are not listed.

HTTP operations are `/v1/status`, `/<channel>/current`, PUT `/<channel>/object/<sha256>`, POST `/<channel>/commit`, GET `/<channel>/release/<releaseId>[/<sha256>]`, and POST `/<channel>/revoke`. All paths follow `/v1`. Published reads require the current non-revoked release and membership of the requested hash in its manifest. Error responses do not expose credentials or object contents.

Objects and release manifests are written exclusively. The server validates every referenced object before changing current with a conditional ETag write; initial creation uses If-None-Match. Repeating the same committed release/hash returns the same commit. Different writers from the same base produce a conflict. Revocation denies subsequent published reads; it cannot erase copies already downloaded.

Initial limits: 1,000 documents per server/native release, 8 MiB per object and 256 MiB total. The native client uses HTTPS, no redirects, bounded response reads and at most three attempts for transient failures; authentication and conflict errors stop immediately. Cancellation is checked between requests; an already dispatched request can take up to its 20-second timeout and a commit already accepted by the server remains committed.

The native plan freezes bytes and persists the plan/capture in the app data directory. A restart can resume the pending operation with its original release ID. Download always uses a new sibling staging directory and an exclusive native rename after Vault validation. The existing Vault is never replaced. Interrupted staging directories are retained and explicitly reported.

Deployment, production identity provisioning, native UI over the deployed Worker, CRM E2E and the new signed release are not certified by protocol unit tests. See TASK_LIST.md and IMPLEMENTATION/M10_EVIDENCE for actual evidence.
