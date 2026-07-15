import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import oqsFactory from "../site/apps/noctweave-web-core/wasm/dist/noctweave_oqs.js";
import {
  base64,
  createNativeInboundSession,
  createNativeOutboundSession,
  decryptNativeEnvelope,
  encryptNativeTextEnvelope,
  NoctweaveOQSWasmAdapter,
  WebCryptoPrimitives,
} from "../site/apps/noctweave-web-core/src/index.js";
import { parseRelayEndpoint as parseClaymatchingRelayEndpoint } from
  "../site/apps/noctweave-web-core/noctweave-core-adapter.js";

const CURRENT_WASM_SHA256 = "f20a490464bcee31bbd66d1e4978dea8a75bed9b84c88d794ea82a8045b6c4c4";
const currentPqcPromise = NoctweaveOQSWasmAdapter.fromFactory(oqsFactory);
const legacyPqcPromise = NoctweaveOQSWasmAdapter.fromFactory(oqsFactory, {
  locateFile: () => new URL(
    "./fixtures/noctweave-legacy/noctweave_oqs.wasm",
    import.meta.url,
  ).href,
});
const webCrypto = new WebCryptoPrimitives();

test("Claymatching vendors the audited Noctweave liboqs 0.16 WASM", async () => {
  const wasm = await readFile(new URL(
    "../site/apps/noctweave-web-core/wasm/dist/noctweave_oqs.wasm",
    import.meta.url,
  ));
  assert.equal(createHash("sha256").update(wasm).digest("hex"), CURRENT_WASM_SHA256);
});

test("current Noctweave crypto remains bidirectionally compatible with legacy Claymatching identities", async () => {
  const [current, legacy] = await Promise.all([currentPqcPromise, legacyPqcPromise]);
  assert.deepEqual(current.profile(), legacy.profile());

  const message = new TextEncoder().encode("claymatching-noctweave-upstream-compatibility");
  const legacySigning = legacy.generateSigningKeypair();
  const currentSigning = current.generateSigningKeypair();
  assert.equal(
    current.verify(message, legacy.sign(message, legacySigning.secretKey), legacySigning.publicKey),
    true,
  );
  assert.equal(
    legacy.verify(message, current.sign(message, currentSigning.secretKey), currentSigning.publicKey),
    true,
  );

  const legacyKem = legacy.generateKemKeypair();
  const currentKem = current.generateKemKeypair();
  const currentToLegacy = current.encapsulate(legacyKem.publicKey);
  const legacyToCurrent = legacy.encapsulate(currentKem.publicKey);
  assert.deepEqual(
    legacy.decapsulate(currentToLegacy.ciphertext, legacyKem.secretKey),
    currentToLegacy.sharedSecret,
  );
  assert.deepEqual(
    current.decapsulate(legacyToCurrent.ciphertext, currentKem.secretKey),
    legacyToCurrent.sharedSecret,
  );
});

test("strict upstream endpoint parsing preserves stored Claymatching /relay URLs", () => {
  const parsed = parseClaymatchingRelayEndpoint("https://claymatching.luna21e8.xyz/relay");
  assert.deepEqual(parsed.endpoint, {
    host: "claymatching.luna21e8.xyz",
    port: 443,
    transport: "http",
    useTLS: true,
  });
  assert.equal(parsed.url, "https://claymatching.luna21e8.xyz/relay");
  assert.equal(parsed.accountRelayUrl, "https://claymatching.luna21e8.xyz/relay");
  assert.throws(
    () => parseClaymatchingRelayEndpoint("https://claymatching.luna21e8.xyz/not-the-relay"),
    /path/i,
  );
});

test("current Noctweave browser ratchet still sends and decrypts Claymatching messages", async () => {
  const pqc = await currentPqcPromise;
  const alice = await makeIdentity(pqc, "alice", "Alice");
  const bob = await makeIdentity(pqc, "bob", "Bob");
  const outbound = await createNativeOutboundSession({
    crypto: webCrypto,
    pqc,
    identity: alice,
    contact: contactFor(bob),
  });
  const inbound = await createNativeInboundSession({
    crypto: webCrypto,
    pqc,
    identity: bob,
    contact: contactFor(alice),
    kemCiphertext: base64(outbound.kemCiphertext),
  });
  const envelope = await encryptNativeTextEnvelope({
    crypto: webCrypto,
    pqc,
    identity: alice,
    contact: contactFor(bob),
    conversation: outbound.conversation,
    text: "still sealed, still squishy",
    kemCiphertext: outbound.kemCiphertext,
  });
  assert.equal(await decryptNativeEnvelope({
    crypto: webCrypto,
    pqc,
    identity: bob,
    contact: contactFor(alice),
    conversation: inbound,
    envelope,
  }), "still sealed, still squishy");
});

async function makeIdentity(pqc, key, displayName) {
  const signing = pqc.generateSigningKeypair();
  const agreement = pqc.generateKemKeypair();
  const access = pqc.generateSigningKeypair();
  const signingFingerprint = base64(await webCrypto.sha256(signing.publicKey));
  const accessFingerprint = base64(await webCrypto.sha256(access.publicKey));
  return {
    key,
    displayName,
    signing: serializeKeypair(signing),
    agreement: serializeKeypair(agreement),
    access: serializeKeypair(access),
    signingFingerprint,
    accessFingerprint,
    inboxId: `test-${accessFingerprint.slice(0, 24)}`,
  };
}

function contactFor(identity) {
  return {
    displayName: identity.displayName,
    fingerprint: identity.signingFingerprint,
    signingPublicKey: identity.signing.publicKey,
    agreementPublicKey: identity.agreement.publicKey,
  };
}

function serializeKeypair(keypair) {
  return {
    publicKey: base64(keypair.publicKey),
    secretKey: base64(keypair.secretKey),
  };
}
