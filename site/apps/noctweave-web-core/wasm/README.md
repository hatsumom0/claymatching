# Vendored Noctweave OQS browser build

The production browser artifacts are byte-for-byte current with official Noctweave revision `b19046cc0e618842ffc0706fccb40f02e8098aeb` (2026-07-15). The binary upgrade remains liboqs 0.16.0; the later upstream revision added attribution metadata only.

SHA-256:

```text
e344a80ec78a28c2f4dbe38825039a4fec576b0bb54c914c35c725f9493933b1  dist/noctweave_oqs.js
f20a490464bcee31bbd66d1e4978dea8a75bed9b84c88d794ea82a8045b6c4c4  dist/noctweave_oqs.wasm
```

Claymatching's previous WASM is retained only as a test fixture. Automated tests prove that legacy signatures verify in the current module, current signatures verify in the legacy module, and ML-KEM encapsulation/decapsulation works in both directions. The legacy fixture is outside `site/` and is never deployed.

`LICENSE.liboqs.txt` contains the liboqs license. The Noctweave Apache-2.0 license and NOTICE are one directory above.
