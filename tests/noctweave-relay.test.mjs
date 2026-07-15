import assert from "node:assert/strict";
import test from "node:test";

import oqsFactory from "../site/apps/noctweave-web-core/wasm/dist/noctweave_oqs.js";
import { NoctweaveOQSWasmAdapter } from "../site/apps/noctweave-web-core/src/crypto/oqs-wasm-adapter.js";
import { LunaNoctweaveRelay } from "../worker/claymatching.js";
import {
  canonicalNoctweaveJSON,
  noctweaveActorProofPayload,
} from "../worker/noctweave-actor-proof.js";
import {
  deriveNoctweaveInboxId,
  noctweaveFingerprint,
} from "../worker/noctweave-relay-security.js";

const pqcPromise = NoctweaveOQSWasmAdapter.fromFactory(oqsFactory);

function makeState() {
  const values = new Map();
  let alarm = null;

  return {
    storage: {
      async get(key) {
        return structuredClone(values.get(key));
      },
      async put(key, value) {
        values.set(key, structuredClone(value));
      },
      async delete(key) {
        for (const entry of Array.isArray(key) ? key : [key]) {
          values.delete(entry);
        }
      },
      async list(options = {}) {
        const prefix = String(options.prefix || "");
        const startAfter = String(options.startAfter || "");
        const limit = Number.isInteger(options.limit) ? options.limit : Number.MAX_SAFE_INTEGER;
        const entries = [...values.entries()]
          .filter(([key]) => key.startsWith(prefix) && (!startAfter || key > startAfter))
          .sort(([left], [right]) => left.localeCompare(right))
          .slice(0, limit)
          .map(([key, value]) => [key, structuredClone(value)]);
        return new Map(entries);
      },
      async getAlarm() {
        return alarm;
      },
      async setAlarm(value) {
        alarm = Number(value);
      },
    },
  };
}

function relayRequest(payload, body = JSON.stringify(payload), extra = {}) {
  const { relayURL = "https://claymatching.luna21e8.xyz/relay", ...requestInit } = extra;
  return new Request(relayURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    ...requestInit,
  });
}

async function relayJSON(relay, payload, body, extra) {
  const response = await relay.fetch(relayRequest(payload, body, extra));
  return { response, payload: await response.json() };
}

async function makeActorIdentity(fill = 0x7a) {
  const pqc = await pqcPromise;
  const keypair = pqc.generateSigningKeypair();
  const publicKey = Buffer.from(keypair.publicKey).toString("base64");
  return {
    fingerprint: await noctweaveFingerprint(publicKey),
    fill,
    keypair,
    publicKey,
  };
}

async function makeActorProof(type, request, identity, overrides = {}) {
  const pqc = await pqcPromise;
  const signedAt = overrides.signedAt || new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const nonce = overrides.nonce || crypto.randomUUID().toUpperCase();
  const proofShell = { signedAt, nonce };
  const payload = noctweaveActorProofPayload(type, request, proofShell);
  const signature = pqc.sign(
    new TextEncoder().encode(canonicalNoctweaveJSON(payload)),
    identity.keypair.secretKey,
  );

  return {
    fingerprint: identity.fingerprint,
    publicSigningKey: identity.publicKey,
    signedAt,
    nonce,
    signature: Buffer.from(signature).toString("base64"),
    ...overrides,
  };
}

test("existing direct-message relay flow remains compatible", async () => {
  const relay = new LunaNoctweaveRelay(makeState(), {});
  const actor = await makeActorIdentity();
  const accessPublicKey = actor.publicKey;
  const inboxId = await deriveNoctweaveInboxId(accessPublicKey);
  const envelope = { id: "8e47637b-73b4-4897-863d-51b73e112237", ciphertext: "sealed" };
  const registration = {
    inboxId,
    accessPublicKey,
  };
  registration.accessProof = await makeActorProof("registerInbox", registration, actor);

  const registered = await relayJSON(relay, {
    type: "registerInbox",
    registerInbox: registration,
  });
  assert.equal(registered.response.status, 200);
  assert.equal(registered.payload.type, "ok");

  const delivered = await relayJSON(relay, {
    type: "deliver",
    deliver: { inboxId, routingToken: inboxId, envelope },
  });
  assert.equal(delivered.payload.type, "delivered");
  assert.equal(delivered.payload.delivered.storedCount, 1);

  const duplicate = await relayJSON(relay, {
    type: "deliver",
    deliver: { inboxId, routingToken: inboxId, envelope },
  });
  assert.equal(duplicate.payload.type, "delivered");
  assert.equal(duplicate.payload.delivered.storedCount, 0);

  const conflicting = await relayJSON(relay, {
    type: "deliver",
    deliver: {
      inboxId,
      routingToken: inboxId,
      envelope: { ...envelope, ciphertext: "different sealed payload" },
    },
  });
  assert.equal(conflicting.payload.type, "error");
  assert.match(conflicting.payload.error, /reused with different ciphertext/i);

  const fetchRequest = {
    inboxId,
    routingToken: inboxId,
    maxCount: 25,
    longPollTimeoutSeconds: 0,
  };
  fetchRequest.accessProof = await makeActorProof("fetch", fetchRequest, actor);
  const fetched = await relayJSON(relay, {
    type: "fetch",
    fetch: fetchRequest,
  });
  assert.deepEqual(fetched.payload.messages, [envelope]);

  const acknowledgement = {
    inboxId,
    messageIds: [envelope.id],
  };
  acknowledgement.accessProof = await makeActorProof("acknowledgeMessages", acknowledgement, actor);
  const acknowledged = await relayJSON(relay, {
    type: "acknowledgeMessages",
    acknowledgeMessages: acknowledgement,
  });
  assert.equal(acknowledged.payload.type, "ok");

  const emptyFetchRequest = { inboxId, maxCount: 25 };
  emptyFetchRequest.accessProof = await makeActorProof("fetch", emptyFetchRequest, actor);
  const empty = await relayJSON(relay, {
    type: "fetch",
    fetch: emptyFetchRequest,
  });
  assert.deepEqual(empty.payload.messages, []);
});

test("only the Claymatching endpoint is treated as the local relay", async () => {
  const relay = new LunaNoctweaveRelay(makeState(), {
    CLAYMATCHING_HOSTS: "claymatching.luna21e8.xyz",
    NOCTWEAVE_FEDERATION_FORWARDING_ENABLED: "false",
    NOCTWEAVE_FEDERATION_MODE: "solo",
  });
  const actor = await makeActorIdentity(0x52);
  const inboxId = await deriveNoctweaveInboxId(actor.publicKey);
  const registration = { inboxId, accessPublicKey: actor.publicKey };
  registration.accessProof = await makeActorProof("registerInbox", registration, actor);

  const registered = await relayJSON(relay, {
    type: "registerInbox",
    registerInbox: registration,
  });
  assert.equal(registered.payload.type, "ok");

  const envelope = { id: "64b7052e-c3af-42ca-93e6-069e16f9f91d", ciphertext: "sealed-alias" };
  const delivered = await relayJSON(relay, {
    type: "deliver",
    deliver: {
      destinationRelay: {
        host: "claymatching.luna21e8.xyz",
        port: 443,
        useTLS: true,
        transport: "http",
      },
      envelope,
      inboxId,
      routingToken: inboxId,
    },
  });
  assert.equal(delivered.payload.type, "delivered");

  const fetchRequest = { inboxId, routingToken: inboxId, maxCount: 25 };
  fetchRequest.accessProof = await makeActorProof("fetch", fetchRequest, actor);
  const fetched = await relayJSON(relay, { type: "fetch", fetch: fetchRequest });
  assert.deepEqual(fetched.payload.messages, [envelope]);

  const rejectedAlias = await relayJSON(relay, {
    type: "deliver",
    deliver: {
      destinationRelay: {
        host: "luna21e8.xyz",
        port: 443,
        useTLS: true,
        transport: "http",
      },
      envelope: { id: "48f98a77-a267-4468-9581-65d874b71729", ciphertext: "wrong-host" },
      inboxId,
      routingToken: inboxId,
    },
  });
  assert.equal(rejectedAlias.payload.type, "error");
  assert.match(rejectedAlias.payload.error, /federation forwarding is disabled/i);

});

test("relay metadata and CORS are scoped only to the Claymatching host", async () => {
  const relay = new LunaNoctweaveRelay(makeState(), {
    ALLOWED_ORIGINS: "https://luna21e8.xyz,https://claymatching.luna21e8.xyz",
  });
  const clayInfo = await relayJSON(relay, { type: "info" }, undefined, {
    headers: { "Content-Type": "application/json", Origin: "https://luna21e8.xyz" },
  });
  assert.equal(clayInfo.payload.relayInfo.relayName, "Luna Claymatching Encrypted Relay");
  assert.equal(clayInfo.response.headers.get("Access-Control-Allow-Origin"), null);

  const clayOrigin = await relayJSON(relay, { type: "info" }, undefined, {
    headers: { "Content-Type": "application/json", Origin: "https://claymatching.luna21e8.xyz" },
  });
  assert.equal(clayOrigin.response.headers.get("Access-Control-Allow-Origin"), "https://claymatching.luna21e8.xyz");
});

test("encrypted attachment chunks use bounded per-chunk storage", async () => {
  const relay = new LunaNoctweaveRelay(makeState(), {});
  const attachmentId = "8e47637b-73b4-4897-863d-51b73e112237";
  const payload = {
    nonce: Buffer.alloc(12, 0x11).toString("base64"),
    ciphertext: Buffer.alloc(64 * 1024, 0x22).toString("base64"),
    tag: Buffer.alloc(16, 0x33).toString("base64"),
  };

  const uploaded = await relayJSON(relay, {
    type: "uploadAttachment",
    uploadAttachment: { attachmentId, chunkIndex: 0, payload, ttlSeconds: 60 },
  });
  assert.equal(uploaded.payload.type, "ok");

  const fetched = await relayJSON(relay, {
    type: "fetchAttachment",
    fetchAttachment: { attachmentId, chunkIndex: 0 },
  });
  assert.equal(fetched.payload.type, "attachment");
  assert.deepEqual(fetched.payload.attachment.payload, payload);

  const oversized = await relayJSON(relay, {
    type: "uploadAttachment",
    uploadAttachment: {
      attachmentId,
      chunkIndex: 1,
      payload: { ...payload, ciphertext: Buffer.alloc(64 * 1024 + 1).toString("base64") },
    },
  });
  assert.equal(oversized.payload.type, "error");

  const tooManyChunks = await relayJSON(relay, {
    type: "uploadAttachment",
    uploadAttachment: { attachmentId, chunkIndex: 512, payload },
  });
  assert.equal(tooManyChunks.payload.type, "error");
});

test("attachment cleanup alarm removes expired chunk storage", async () => {
  const state = makeState();
  const relay = new LunaNoctweaveRelay(state, {});
  const attachmentId = "c31118e5-7b20-44dd-8d3d-75cb4eed93b6";
  const payload = {
    nonce: Buffer.alloc(12, 0x11).toString("base64"),
    ciphertext: Buffer.alloc(64 * 1024, 0x22).toString("base64"),
    tag: Buffer.alloc(16, 0x33).toString("base64"),
  };

  const uploaded = await relayJSON(relay, {
    type: "uploadAttachment",
    uploadAttachment: { attachmentId, chunkIndex: 0, payload, ttlSeconds: 60 },
  });
  assert.equal(uploaded.payload.type, "ok");
  assert.ok(await state.storage.getAlarm());

  const chunkEntries = await state.storage.list({ prefix: "noctweave:attachment-chunk:v2:" });
  const markerEntries = await state.storage.list({ prefix: "noctweave:attachment-expiry:v1:" });
  assert.equal(chunkEntries.size, 1);
  assert.equal(markerEntries.size, 1);

  const [chunkKey, chunk] = chunkEntries.entries().next().value;
  const [markerKey, marker] = markerEntries.entries().next().value;
  chunk.expiresAt = "2020-01-01T00:00:00Z";
  marker.expiresAt = chunk.expiresAt;
  await state.storage.put(chunkKey, chunk);
  await state.storage.put(markerKey, marker);

  await relay.alarm();
  assert.equal(await state.storage.get(chunkKey), undefined);
  assert.equal(await state.storage.get(markerKey), undefined);
});

test("attachment cleanup alarm backfills legacy chunk storage", async () => {
  const state = makeState();
  const relay = new LunaNoctweaveRelay(state, {});
  const attachmentId = "7ebbbec0-eb6d-4a36-af1b-f86e703e19e3";
  const chunk = {
    attachmentId,
    chunkIndex: 0,
    payload: {
      nonce: Buffer.alloc(12, 0x41).toString("base64"),
      ciphertext: Buffer.alloc(64, 0x42).toString("base64"),
      tag: Buffer.alloc(16, 0x43).toString("base64"),
    },
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  await state.storage.put("noctweave:attachments:v1", { [`${attachmentId}:0`]: chunk });

  await relay.alarm();

  assert.deepEqual(await state.storage.get("noctweave:attachments:v1"), {});
  assert.equal((await state.storage.list({ prefix: "noctweave:attachment-chunk:v2:" })).size, 1);
  assert.equal((await state.storage.list({ prefix: "noctweave:attachment-expiry:v1:" })).size, 1);
});

test("actor proofs reject missing, stale, and replayed inbox access", async () => {
  const relay = new LunaNoctweaveRelay(makeState(), {});
  const actor = await makeActorIdentity(0x31);
  const inboxId = await deriveNoctweaveInboxId(actor.publicKey);
  const registration = { inboxId, accessPublicKey: actor.publicKey };
  registration.accessProof = await makeActorProof("registerInbox", registration, actor);
  assert.equal((await relayJSON(relay, { type: "registerInbox", registerInbox: registration })).payload.type, "ok");

  const missing = await relayJSON(relay, {
    type: "fetch",
    fetch: { inboxId, maxCount: 25 },
  });
  assert.equal(missing.payload.type, "error");
  assert.match(missing.payload.error, /missing actor proof/i);

  const staleRequest = { inboxId, maxCount: 25 };
  staleRequest.accessProof = await makeActorProof("fetch", staleRequest, actor, {
    signedAt: "2020-01-01T00:00:00Z",
  });
  const stale = await relayJSON(relay, { type: "fetch", fetch: staleRequest });
  assert.equal(stale.payload.type, "error");
  assert.match(stale.payload.error, /expired/i);

  const replayRequest = { inboxId, maxCount: 25 };
  replayRequest.accessProof = await makeActorProof("fetch", replayRequest, actor);
  const first = await relayJSON(relay, { type: "fetch", fetch: replayRequest });
  const replayed = await relayJSON(relay, { type: "fetch", fetch: replayRequest });
  assert.equal(first.payload.type, "messages");
  assert.equal(replayed.payload.type, "error");
  assert.match(replayed.payload.error, /replay/i);
});

test("pairing and prekey actor proofs bind the correct identity", async () => {
  const relay = new LunaNoctweaveRelay(makeState(), {});
  const sender = await makeActorIdentity(0x41);
  const recipient = await makeActorIdentity(0x42);
  const offer = {
    version: 3,
    displayName: "Sender",
    fingerprint: sender.fingerprint,
    signingPublicKey: sender.publicKey,
    agreementPublicKey: Buffer.alloc(16, 0x44).toString("base64"),
    inboxId: "noctweave1test",
    relay: { host: "luna21e8.xyz", port: 443, useTLS: true, transport: "http" },
    signature: Buffer.alloc(16, 0x55).toString("base64"),
  };
  const sendRequest = { targetFingerprint: recipient.fingerprint, offer };
  sendRequest.actorProof = await makeActorProof("sendPairRequest", sendRequest, sender);
  assert.equal((await relayJSON(relay, { type: "sendPairRequest", sendPairRequest: sendRequest })).payload.type, "ok");

  const fetchRequest = { fingerprint: recipient.fingerprint, maxCount: 25 };
  fetchRequest.actorProof = await makeActorProof("fetchPairRequests", fetchRequest, recipient);
  const fetched = await relayJSON(relay, { type: "fetchPairRequests", fetchPairRequests: fetchRequest });
  assert.equal(fetched.payload.type, "pairRequests");
  assert.equal(fetched.payload.pairRequests.length, 1);

  const bundle = { identityFingerprint: sender.fingerprint, prekeys: [{ id: "one", key: "sealed" }] };
  const uploadRequest = { fingerprint: sender.fingerprint, bundle, ttlSeconds: 600 };
  uploadRequest.actorProof = await makeActorProof("uploadPrekeys", uploadRequest, sender);
  assert.equal((await relayJSON(relay, { type: "uploadPrekeys", uploadPrekeys: uploadRequest })).payload.type, "ok");

  const mismatched = { fingerprint: recipient.fingerprint, bundle, ttlSeconds: 600 };
  mismatched.actorProof = await makeActorProof("uploadPrekeys", mismatched, recipient);
  assert.equal((await relayJSON(relay, { type: "uploadPrekeys", uploadPrekeys: mismatched })).payload.type, "error");
});

test("inbox registration rejects access-key and contact-offer mismatches", async () => {
  const relay = new LunaNoctweaveRelay(makeState(), {});
  const accessPublicKey = Buffer.alloc(1_952, 0x2a).toString("base64");
  const inboxId = await deriveNoctweaveInboxId(accessPublicKey);

  const unbound = await relayJSON(relay, {
    type: "registerInbox",
    registerInbox: { inboxId: `${inboxId}x`, accessPublicKey },
  });
  assert.equal(unbound.payload.type, "error");
  assert.match(unbound.payload.error, /not bound/i);

  const mismatchedOffer = await relayJSON(relay, {
    type: "registerInbox",
    registerInbox: {
      inboxId,
      accessPublicKey,
      contactOffer: {
        inboxId,
        inboxAccessPublicKey: Buffer.alloc(1_952, 0x2b).toString("base64"),
      },
    },
  });
  assert.equal(mismatchedOffer.payload.type, "error");
  assert.match(mismatchedOffer.payload.error, /access key mismatch/i);
});

test("live federation registration fails closed without a secret", async () => {
  const relay = new LunaNoctweaveRelay(makeState(), {
    NOCTWEAVE_FEDERATION_ALLOW_LIVE_REGISTRATION: "true",
    NOCTWEAVE_FEDERATION_MODE: "manual",
  });
  const result = await relayJSON(relay, {
    type: "registerFederationNode",
    registerFederationNode: {
      endpoint: { host: "relay.example.com", port: 443, useTLS: true, transport: "http" },
    },
  });

  assert.equal(result.payload.type, "error");
  assert.match(result.payload.error, /configured registration token/i);
});

test("manual federation registration rejects private endpoints", async () => {
  const relay = new LunaNoctweaveRelay(makeState(), {
    NOCTWEAVE_ALLOW_PRIVATE_FEDERATION_ENDPOINTS: "false",
    NOCTWEAVE_FEDERATION_ALLOW_LIVE_REGISTRATION: "true",
    NOCTWEAVE_FEDERATION_MODE: "manual",
    NOCTWEAVE_FEDERATION_REGISTRATION_TOKEN: "registration-secret",
  });
  const result = await relayJSON(relay, {
    type: "registerFederationNode",
    authToken: "registration-secret",
    registerFederationNode: {
      endpoint: { host: "127.0.0.1", port: 443, useTLS: true, transport: "http" },
    },
  });

  assert.equal(result.payload.type, "error");
  assert.match(result.payload.error, /public TLS endpoint/i);
});

test("federation probes never follow redirects", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let observedRedirectPolicy;
  globalThis.fetch = async (_url, init) => {
    observedRedirectPolicy = init.redirect;
    return new Response(null, {
      status: 302,
      headers: { Location: "https://redirected.example/relay" },
    });
  };

  try {
    const relay = new LunaNoctweaveRelay(makeState(), {
      NOCTWEAVE_FEDERATION_ALLOW_LIVE_REGISTRATION: "true",
      NOCTWEAVE_FEDERATION_MODE: "manual",
      NOCTWEAVE_FEDERATION_REGISTRATION_TOKEN: "registration-secret",
    });
    const result = await relayJSON(relay, {
      type: "registerFederationNode",
      authToken: "registration-secret",
      registerFederationNode: {
        endpoint: { host: "relay.example.com", port: 443, useTLS: true, transport: "http" },
      },
    });

    assert.equal(observedRedirectPolicy, "manual");
    assert.equal(result.payload.type, "error");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("chunked request bodies are bounded without Content-Length", async () => {
  const chunk = new Uint8Array(600_000).fill(0x20);
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(chunk);
      controller.enqueue(chunk);
      controller.close();
    },
  });
  const relay = new LunaNoctweaveRelay(makeState(), {});
  const request = new Request("https://claymatching.luna21e8.xyz/relay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    duplex: "half",
  });
  const response = await relay.fetch(request);
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.type, "error");
  assert.match(payload.error, /too large/i);
});
