# Luna Noctweave Web Core

This is the browser adapter for the first Luna Noctweave website milestone.

It generates ML-DSA-65 and ML-KEM-768 key material in the browser, stores private material only in IndexedDB for the active account, builds a Noctweave-compatible contact offer, and registers the derived inbox with an HTTP relay. Accounts sync should only receive the public contact code, relay preference, and signing-key fingerprint.

Current scope:

- identity/contact-offer generation
- derived inbox registration
- default Luna Cloudflare relay with optional custom HTTP relay

Full browser send/receive still needs the remaining Noctweave message-ratchet and sealed-envelope adapter.
