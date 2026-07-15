# Vendored Noctweave OQS browser build

These two production browser artifacts were copied unchanged from the Claymatching production source snapshot used for this standalone repository. The source repository did not record a reproducible upstream liboqs commit, Emscripten command line, or build provenance for this exact pair, so none is asserted here.

SHA-256:

```text
e344a80ec78a28c2f4dbe38825039a4fec576b0bb54c914c35c725f9493933b1  dist/noctweave_oqs.js
eaa179f6e52e316537e4a442b267c68c5250df31028a8d324de359b670d3d113  dist/noctweave_oqs.wasm
```

The files are retained byte-for-byte for compatibility with existing Claymatching browser identities and Noctweave messages. Replacing them requires cryptographic interoperability tests and a planned client migration. `LICENSE.liboqs.txt` contains the upstream liboqs license text retrieved from the official Open Quantum Safe repository.
