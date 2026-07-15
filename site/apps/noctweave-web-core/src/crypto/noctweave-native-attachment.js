// Added by Luna for Claymatching: bounded encrypted attachment chunks.
import { base64 } from "./swift-canonical.js";

const encoder = new TextEncoder();

export async function encryptNativeAttachmentChunks({
  crypto,
  data,
  descriptor,
  conversation,
  messageCounter,
  messageKey,
}) {
  const input = bytes(data);
  const chunks = [];

  for (let offset = 0, chunkIndex = 0; offset < input.byteLength; offset += descriptor.chunkSize, chunkIndex += 1) {
    const plaintext = input.subarray(offset, Math.min(input.byteLength, offset + descriptor.chunkSize));
    const key = await deriveAttachmentKey(crypto, messageKey, descriptor.id, chunkIndex);
    const nonce = crypto.randomBytes(12);
    const encrypted = await crypto.aesGcmEncrypt({
      key,
      nonce,
      plaintext,
      additionalData: attachmentAuthenticatedData({
        conversationId: conversation.id,
        sessionId: conversation.sessionId,
        messageCounter,
        attachmentId: descriptor.id,
        chunkIndex,
        byteCount: plaintext.byteLength,
      }),
    });
    chunks.push({
      chunkIndex,
      payload: {
        nonce: base64(nonce),
        ciphertext: base64(encrypted.slice(0, -16)),
        tag: base64(encrypted.slice(-16)),
      },
    });
  }

  return chunks;
}

export async function decryptNativeAttachmentChunk({
  crypto,
  descriptor,
  recovery,
  messageKey,
  chunkIndex,
  payload,
}) {
  const offset = chunkIndex * descriptor.chunkSize;
  const byteCount = Math.min(descriptor.chunkSize, descriptor.byteCount - offset);
  if (byteCount <= 0) {
    throw new Error("Attachment chunk index exceeds the signed descriptor.");
  }
  const key = await deriveAttachmentKey(crypto, messageKey, descriptor.id, chunkIndex);
  return crypto.aesGcmDecrypt({
    key,
    nonce: fromBase64(payload.nonce),
    ciphertext: concatBytes(fromBase64(payload.ciphertext), fromBase64(payload.tag)),
    additionalData: attachmentAuthenticatedData({
      conversationId: recovery.conversationId,
      sessionId: recovery.sessionId,
      messageCounter: recovery.messageCounter,
      attachmentId: descriptor.id,
      chunkIndex,
      byteCount,
    }),
  });
}

export function attachmentAuthenticatedData({
  conversationId,
  sessionId,
  messageCounter,
  attachmentId,
  chunkIndex,
  byteCount,
}) {
  return encoder.encode(
    `${conversationId}:${sessionId}:${messageCounter}:${normalizeUUID(attachmentId)}:${chunkIndex}:${byteCount}`,
  );
}

async function deriveAttachmentKey(crypto, messageKey, attachmentId, chunkIndex) {
  return crypto.hkdfSha256({
    ikm: messageKey,
    salt: "NOCTWEAVE-ATTACH",
    info: `ATTACH:${normalizeUUID(attachmentId)}:${chunkIndex}`,
    length: 32,
  });
}

function normalizeUUID(value) {
  return String(value || "").trim().toUpperCase();
}

function bytes(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError("Attachment data is missing or invalid.");
}

function fromBase64(value) {
  const binary = atob(String(value || ""));
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
}

function concatBytes(...parts) {
  const length = parts.reduce((total, part) => total + part.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.byteLength;
  });
  return output;
}
