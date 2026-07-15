# Claymatching Noctweave browser fork

This directory is Claymatching's browser integration of [Noctweave](https://github.com/luizwidmer/Noctweave). It creates ML-DSA-65 and ML-KEM-768 identities in the browser, keeps account-bound identity material in encrypted IndexedDB storage, exchanges sealed messages through Claymatching's relay, and supports Claymatching's attachment and multi-device flows.

## Upstream provenance

- Repository: `https://github.com/luizwidmer/Noctweave`
- Audited upstream revision: `46eeabc9514f98a2bdd343c3248471662f8a0f3c`
- Audit date: 2026-07-14
- Upstream change: liboqs 0.16.0
- Upstream release/tag: none; `main` is the source of record

The OQS WASM binary and the reusable endpoint, relay-client, storage, WebCrypto, OQS-adapter, browser-identity, and portable-profile modules are synced from that revision. Protocol request shapes, canonicalization, and the core client were already byte-for-byte current.

This is deliberately not a wholesale upstream checkout. Claymatching preserves local APIs and storage behavior in:

- `noctweave-core-adapter.js`
- `src/index.js`
- `src/crypto/noctweave-native-message.js`
- `src/crypto/noctweave-native-attachment.js`
- `src/luna-secure-storage.js`

Those files carry modification notices. They provide persistent account identities, legacy `/relay` URL migration, generalized message bodies, attachments, sender copies, session reuse, and failed-decrypt recovery. Replacing them with upstream files would break Claymatching's public adapter and could make existing browser state unreadable.

## Compatibility policy

Upstream changes are reviewed and selectively ported. Cryptographic artifacts are never replaced without old-to-new and new-to-old ML-KEM/ML-DSA interoperability tests, a full Claymatching message round trip, relay tests, and a production-bundle dry run. The legacy test WASM lives only under `tests/fixtures`; it is not included in the deployed asset bundle.

Noctweave's Apache-2.0 license and NOTICE are included as `LICENSE.noctweave.txt` and `NOTICE.noctweave.txt`. Other vendored cryptography licenses are stored beside their artifacts.
