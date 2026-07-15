import { ml_dsa65 } from "../site/apps/noctweave-web-core/vendor/noctweave-pq.js";
import {
  decodeNoctweaveData,
  noctweaveDataEqual,
  noctweaveFingerprint,
} from "./noctweave-relay-security.js";

const ACTOR_PROOF_MAX_AGE_MS = 5 * 60 * 1000;
const ML_DSA_65_PUBLIC_KEY_BYTES = 1_952;
const ML_DSA_65_SIGNATURE_BYTES = 3_309;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const textEncoder = new TextEncoder();

export function noctweaveActorProofPayload(type, request, proof) {
  const signedAt = proof?.signedAt;
  const nonce = proof?.nonce;

  switch (type) {
    case "registerInbox":
      return compactObject({
        accessPublicKey: request?.accessPublicKey,
        contactOffer: request?.contactOffer,
        inboxId: request?.inboxId,
        nonce,
        signedAt,
      });
    case "fetch":
      return compactObject({
        inboxId: request?.inboxId,
        longPollTimeoutSeconds: request?.longPollTimeoutSeconds,
        maxCount: request?.maxCount,
        nonce,
        routingToken: request?.routingToken,
        signedAt,
      });
    case "acknowledgeMessages":
      return compactObject({
        inboxId: request?.inboxId,
        messageIds: request?.messageIds,
        nonce,
        signedAt,
      });
    case "sendPairRequest":
      return compactObject({
        nonce,
        offer: request?.offer,
        signedAt,
        targetFingerprint: request?.targetFingerprint,
      });
    case "fetchPairRequests":
      return compactObject({
        fingerprint: request?.fingerprint,
        maxCount: request?.maxCount,
        nonce,
        signedAt,
      });
    case "uploadPrekeys":
      return compactObject({
        bundle: request?.bundle,
        fingerprint: request?.fingerprint,
        nonce,
        signedAt,
        ttlSeconds: request?.ttlSeconds,
      });
    default:
      return null;
  }
}

export async function verifyNoctweaveActorProof({
  type,
  request,
  proof,
  expectedFingerprint = "",
  expectedPublicKey = null,
  now = Date.now(),
} = {}) {
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) {
    return failure("Missing actor proof.");
  }

  const fingerprint = cleanProofText(proof.fingerprint, 128);
  const signedAt = cleanProofText(proof.signedAt, 64);
  const nonce = cleanProofText(proof.nonce, 64);
  const publicKey = decodeNoctweaveData(proof.publicSigningKey, ML_DSA_65_PUBLIC_KEY_BYTES);
  const signature = decodeNoctweaveData(proof.signature, ML_DSA_65_SIGNATURE_BYTES);

  if (!fingerprint || !signedAt || !UUID_PATTERN.test(nonce) ||
      publicKey?.byteLength !== ML_DSA_65_PUBLIC_KEY_BYTES ||
      signature?.byteLength !== ML_DSA_65_SIGNATURE_BYTES) {
    return failure("Actor proof is malformed.");
  }

  const proofTime = Date.parse(signedAt);

  if (!Number.isFinite(proofTime) || Math.abs(now - proofTime) > ACTOR_PROOF_MAX_AGE_MS) {
    return failure("Actor proof expired.");
  }

  const derivedFingerprint = await noctweaveFingerprint(proof.publicSigningKey);

  if (!derivedFingerprint || derivedFingerprint !== fingerprint ||
      (expectedFingerprint && expectedFingerprint !== fingerprint)) {
    return failure("Actor proof fingerprint mismatch.");
  }

  if (expectedPublicKey && !noctweaveDataEqual(expectedPublicKey, proof.publicSigningKey)) {
    return failure("Actor proof signing key mismatch.");
  }

  const payload = noctweaveActorProofPayload(type, request, proof);

  if (!payload) {
    return failure("Actor proof operation is unsupported.");
  }

  let verified = false;

  try {
    verified = ml_dsa65.verify(signature, canonicalJSONBytes(payload), publicKey);
  } catch {
    verified = false;
  } finally {
    publicKey.fill(0);
    signature.fill(0);
  }

  if (!verified) {
    return failure("Invalid actor proof signature.");
  }

  return {
    ok: true,
    expiresAt: new Date(proofTime + ACTOR_PROOF_MAX_AGE_MS).toISOString(),
    nonceKey: `${fingerprint}:${nonce.toLowerCase()}`,
  };
}

export function canonicalNoctweaveJSON(value) {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalNoctweaveJSON).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalNoctweaveJSON(child)}`).join(",")}}`;
  }
  if (typeof value === "string") {
    return JSON.stringify(value).replaceAll("/", "\\/");
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError("Actor proof payload contains a non-finite number.");
  }
  return JSON.stringify(value);
}

function canonicalJSONBytes(value) {
  return textEncoder.encode(canonicalNoctweaveJSON(value));
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined));
}

function cleanProofText(value, maximumLength) {
  if (typeof value !== "string") {
    return "";
  }
  const text = value.trim();
  return text && text.length <= maximumLength && !/[\r\n]/.test(text) ? text : "";
}

function failure(error) {
  return { ok: false, error };
}
