// Modified by Luna for Claymatching: account-bound identity storage, persistent
// conversations, attachments, sender copies, and legacy relay URL migration.
import oqsFactory from "./wasm/dist/noctweave_oqs.js";
import {
  NoctweaveOQSWasmAdapter,
  NoctweaveRelayClient,
  WebCryptoPrimitives,
  base64,
  canonicalJsonBytes,
  createNativeInboundSession,
  createNativeOutboundSession,
  decodeNativeContactCode,
  decryptNativeAttachmentChunk,
  decryptNativeMessageEnvelope,
  encodeNativeContactCode,
  encryptNativeMessageEnvelope,
  encryptNativeAttachmentChunks,
  encryptNativeTextEnvelope,
  makeNativeContactOffer,
  nativeConversationKey,
  parseRelayEndpoint as parseNoctweaveRelayEndpoint,
  prepareNativeMessageKey,
  relayEndpointURL,
  relayRequests,
  swiftISODate,
  swiftUUID,
  verifyNativeContactOffer,
} from "./src/index.js";
import {
  decryptLunaIdentityRecord,
  deriveLunaMessageStorageKey,
  encryptLunaIdentityRecord,
  generateLunaIdentityVaultKey,
  lunaIdentityMigrationMarker,
  lunaIdentityKeyMaterialMatches,
} from "./src/luna-secure-storage.js";

const DB_NAME = "luna-noctweave-web-core";
const DB_VERSION = 4;
const IDENTITY_STORE = "identities";
const IDENTITY_KEY_STORE = "identity-keys-v1";
const IDENTITY_VAULT_STORE = "identity-vault-v1";
const MESSAGE_STORE = "messages";
const MEDIA_CACHE_STORE = "signal-media-cache-v1";
const MEDIA_CACHE_MAX_BYTES = 256 * 1024 * 1024;
const SIGNAL_MESSAGE_LOG_LIMIT = 100;
const DEFAULT_RELAY_ENDPOINT = Object.freeze({
  host: "luna21e8.xyz",
  port: 443,
  useTLS: true,
  transport: "http",
});
const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BECH32_GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const LUNA_SIGNAL_TEXT_PREFIX = "LUNA_SIGNAL_V1:";
const LUNA_SIGNAL_ATTACHMENT_PREFIX = "LUNA_SIGNAL_ATTACHMENT_V1:";
const MAX_SIGNAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const SIGNAL_ATTACHMENT_CHUNK_BYTES = 64 * 1024;
const SIGNAL_ATTACHMENT_TTL_SECONDS = 60 * 60;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let runtimePromise;

export const defaultRelayEndpoint = DEFAULT_RELAY_ENDPOINT;

export const isNoctweaveWebCoreAvailable = () =>
  typeof indexedDB !== "undefined" &&
  Boolean(globalThis.crypto?.getRandomValues) &&
  Boolean(globalThis.crypto?.subtle) &&
  typeof WebAssembly !== "undefined";

export async function createOrLoadSignalIdentity({
  accountId,
  accountHandle,
  displayName,
  relayUrl = "",
  registerInbox = true,
} = {}) {
  assertWebCoreAvailable();

  const runtime = await nativeRuntime();
  const key = normalizeAccountKey(accountId || accountHandle || displayName);
  const relay = parseRelayEndpoint(relayUrl);
  const existing = normalizeIdentityRecord(await readIdentityRecord(key));
  const baseRecord = hasCompleteKeyMaterial(existing)
    ? existing
    : await createIdentityRecord(runtime, key, accountId, accountHandle);
  const nextDisplayName = normalizeDisplayName(displayName || accountHandle || baseRecord.displayName || key);
  const contactOffer = makeNativeContactOffer({
    pqc: runtime.pqc,
    identity: { ...baseRecord, displayName: nextDisplayName },
    relayEndpoint: relay.endpoint,
  });
  const contactCode = encodeNativeContactCode(contactOffer);
  const previousContactCodes = [...new Set([
    ...(Array.isArray(baseRecord.previousContactCodes) ? baseRecord.previousContactCodes : []),
    baseRecord.contactCode && baseRecord.contactCode !== contactCode ? baseRecord.contactCode : "",
  ].map((code) => String(code || "").trim()).filter(Boolean))].slice(-5);

  let relayRegistration = null;
  const nextRecord = {
    ...baseRecord,
    accountId: String(accountId || baseRecord.accountId || ""),
    accountHandle: String(accountHandle || baseRecord.accountHandle || ""),
    displayName: nextDisplayName,
    relayEndpoint: relay.endpoint,
    relayInput: relay.input,
    relayUrl: relay.url,
    accountRelayUrl: relay.accountRelayUrl,
    contactOffer,
    contactCode,
    previousContactCodes,
    fingerprint: baseRecord.signingFingerprint,
    updatedAt: iso8601NoMilliseconds(),
  };

  if (registerInbox) {
    try {
      relayRegistration = await registerIdentityInbox(runtime, nextRecord);
      nextRecord.lastRelayRegistration = {
        type: relayRegistration.type || "ok",
        registeredAt: iso8601NoMilliseconds(),
      };
    } catch (error) {
      relayRegistration = {
        type: "error",
        error: error?.message || "Noctweave relay registration failed.",
      };
      nextRecord.lastRelayRegistration = {
        type: "error",
        error: relayRegistration.error,
        registeredAt: iso8601NoMilliseconds(),
      };
    }
  }

  await writeIdentityRecord(nextRecord);
  return publicIdentity(nextRecord, relayRegistration);
}

export async function getStoredSignalIdentity({ accountId, accountHandle, displayName } = {}) {
  assertWebCoreAvailable();

  const key = normalizeAccountKey(accountId || accountHandle || displayName);
  const record = normalizeIdentityRecord(await readIdentityRecord(key));
  return record ? publicIdentity(record) : null;
}

export async function clearSignalIdentity({ accountId, accountHandle, displayName } = {}) {
  assertWebCoreAvailable();

  const key = normalizeAccountKey(accountId || accountHandle || displayName);
  await Promise.all([
    deleteMessageRecord(key),
    deleteSignalMediaCacheForAccount(key),
    deleteIdentityRecord(key),
  ]);
}

export async function loadSignalMessageLog(context = {}) {
  assertWebCoreAvailable();

  const record = await readVerifiedIdentityRecord(context);
  const state = await loadSignalEnvelopeState(record);
  return state.messages;
}

export async function saveSignalMessageLog({
  accountId,
  accountHandle,
  displayName,
  signalContactCode = "",
  messages = [],
} = {}) {
  assertWebCoreAvailable();

  const record = await readVerifiedIdentityRecord({
    accountId,
    accountHandle,
    displayName,
    signalContactCode,
  });
  const state = await loadSignalEnvelopeState(record);

  state.messages = normalizeSignalMessages(messages);
  await saveSignalEnvelopeState(record, state);
  return state.messages;
}

export async function markSignalMessagesRead({
  accountId,
  accountHandle,
  displayName,
  signalContactCode = "",
  messageIds = [],
} = {}) {
  assertWebCoreAvailable();

  const record = await readVerifiedIdentityRecord({
    accountId,
    accountHandle,
    displayName,
    signalContactCode,
  });
  const state = await loadSignalEnvelopeState(record);
  const ids = new Set((Array.isArray(messageIds) ? messageIds : [messageIds])
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean));

  if (!ids.size) return state.messages;
  let changed = false;
  state.messages = normalizeSignalMessages(state.messages.map((message) => {
    const candidates = [message.id, message.envelopeId, ...(message.envelopeIds || [])]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);
    if (!message.unread || !candidates.some((candidate) => ids.has(candidate))) return message;
    changed = true;
    return { ...message, unread: false };
  }));
  if (changed) await saveSignalEnvelopeState(record, state);
  return state.messages;
}

export async function appendSignalMessageLogEntry({
  accountId,
  accountHandle,
  displayName,
  signalContactCode = "",
  message,
} = {}) {
  const record = await readVerifiedIdentityRecord({
    accountId,
    accountHandle,
    displayName,
    signalContactCode,
  });
  const state = await loadSignalEnvelopeState(record);

  state.messages = normalizeSignalMessages([message, ...state.messages]);
  await saveSignalEnvelopeState(record, state);
  return state.messages;
}

export async function clearSignalMessageLog({ accountId, accountHandle, displayName } = {}) {
  assertWebCoreAvailable();

  const key = normalizeAccountKey(accountId || accountHandle || displayName);
  await Promise.all([
    deleteMessageRecord(key),
    deleteSignalMediaCacheForAccount(key),
  ]);
}

export async function sendSignalText({
  accountId,
  accountHandle,
  displayName,
  signalContactCode = "",
  recipientContactCode = "",
  recipientContactCodes = [],
  senderContactCodes = [],
  recipientHandle = "",
  recipientFingerprint = "",
  text = "",
  message = "",
  subject = "new signal sent",
} = {}) {
  assertWebCoreAvailable();

  const bodyText = normalizeMessageField(text || message, 4000);
  if (!bodyText) {
    throw new Error("Signal message is empty.");
  }
  const contactCodes = normalizeRecipientContactCodes(recipientContactCode, recipientContactCodes);

  if (!contactCodes.length) {
    throw new Error("Recipient has no lunar key yet.");
  }
  const senderCopyCodes = normalizeRecipientContactCodes("", senderContactCodes);

  const runtime = await nativeRuntime();
  const record = await readVerifiedIdentityRecord({
    accountId,
    accountHandle,
    displayName,
    signalContactCode,
  });
  const state = await loadSignalEnvelopeState(record);
  const deliveries = [];
  const deliveryErrors = [];
  const seenFingerprints = new Set();
  const normalizedRecipientHandle = normalizeDesktopHandle(recipientHandle || "recipient");
  let primaryRecipientFingerprint = String(recipientFingerprint || "").trim();
  const deliveryTargets = [
    ...contactCodes.map((code) => ({ code, role: "recipient" })),
    ...senderCopyCodes.map((code) => ({ code, role: "sender-copy" })),
  ];

  for (const target of deliveryTargets) {
    try {
      const code = target.code;
      const offer = decodeNativeContactCode(code);

      await verifyNativeContactOffer({ crypto: runtime.crypto, pqc: runtime.pqc, offer });

      if (offer.fingerprint === record.signingFingerprint) {
        if (target.role === "sender-copy") {
          continue;
        }
        deliveryErrors.push("Skipped current device prayer key.");
        continue;
      }

      if (seenFingerprints.has(offer.fingerprint)) {
        continue;
      }
      seenFingerprints.add(offer.fingerprint);

      const contact = contactFromOffer(offer);
      if (target.role === "recipient" && !primaryRecipientFingerprint) {
        primaryRecipientFingerprint = contact.fingerprint;
      }
      upsertContact(state, contact);

      const conversationKey = nativeConversationKey(contact);
      const existingConversation = state.conversations[conversationKey];
      let conversation;
      let kemCiphertext;

      if (existingConversation) {
        conversation = structuredClone(existingConversation);
        kemCiphertext = null;
      } else {
        const created = await createNativeOutboundSession({
          crypto: runtime.crypto,
          pqc: runtime.pqc,
          identity: record,
          contact,
        });
        conversation = created.conversation;
        kemCiphertext = created.kemCiphertext;
      }

      const sentAt = swiftISODate();
      const envelope = await encryptNativeTextEnvelope({
        crypto: runtime.crypto,
        pqc: runtime.pqc,
        identity: record,
        contact,
        conversation,
        text: encodeSignalTextPayload({
          text: bodyText,
          recipientHandle: normalizedRecipientHandle,
          recipientFingerprint: primaryRecipientFingerprint || contact.fingerprint,
        }),
        sentAt,
        kemCiphertext,
      });
      const response = await relayClient(contact.relay).send(relayRequests.deliver({
        inboxId: contact.inboxId,
        routingToken: contact.inboxId,
        envelope,
        destinationRelay: endpointsEqual(contact.relay, record.relayEndpoint) ? null : contact.relay,
      }));

      if (response.type !== "delivered" && response.type !== "ok") {
        throw new Error(response.error || `Noctweave relay rejected signal: ${response.type || "unknown"}`);
      }

      state.conversations[conversationKey] = conversation;

      deliveries.push({
        contact,
        conversation,
        conversationKey,
        role: target.role,
        deliveredCount: response.delivered?.storedCount ?? response.storedCount ?? 0,
        envelope,
        sentAt,
      });
    } catch (error) {
      deliveryErrors.push(describeSignalError(error));
    }
  }

  const recipientDeliveries = deliveries.filter((delivery) => delivery.role === "recipient");
  if (!recipientDeliveries.length) {
    const actionableErrors = deliveryErrors
      .filter((error) => !/skipped current device prayer key/i.test(error));
    const reason = [...new Set(actionableErrors.length ? actionableErrors : deliveryErrors)]
      .filter(Boolean)
      .slice(0, 3)
      .join(" / ");

    throw new Error(reason
      ? `Signal could not be delivered: ${reason}`
      : "Signal could not be delivered to any saved device.");
  }

  const primaryDelivery = recipientDeliveries[0];
  const totalDeliveredCount = deliveries.reduce((total, delivery) => (
    total + (Number.isFinite(Number(delivery.deliveredCount)) ? Number(delivery.deliveredCount) : 0)
  ), 0);
  const visibleDeliveryErrors = deliveryErrors
    .filter((error) => !/skipped current device prayer key/i.test(error));
  const sentAt = primaryDelivery.sentAt || swiftISODate();
  const envelopeIds = deliveries.map((delivery) => delivery.envelope.id).filter(Boolean);
  const sentMessage = {
    id: primaryDelivery.envelope.id,
    envelopeId: primaryDelivery.envelope.id,
    envelopeIds,
    author: normalizeDesktopHandle(record.accountHandle || record.displayName || "Luna"),
    recipient: normalizedRecipientHandle || normalizeDesktopHandle(primaryDelivery.contact.displayName || "recipient"),
    counterpartyHandle: normalizedRecipientHandle || normalizeDesktopHandle(primaryDelivery.contact.displayName || "recipient"),
    conversationHandle: normalizedRecipientHandle || normalizeDesktopHandle(primaryDelivery.contact.displayName || "recipient"),
    recipientFingerprint: primaryRecipientFingerprint || primaryDelivery.contact.fingerprint,
    subject,
    message: bodyText,
    timestamp: "just now",
    createdAt: sentAt,
    unread: false,
    direction: "outbox",
    deliveryState: visibleDeliveryErrors.length ? "partial" : "sent",
    deliveryError: visibleDeliveryErrors.length ? visibleDeliveryErrors.join(" / ") : "",
    deliveredCount: totalDeliveredCount,
    deviceCount: deliveries.length,
    contactFingerprint: primaryDelivery.contact.fingerprint,
    conversationId: primaryDelivery.envelope.conversationId || primaryDelivery.conversation.id || primaryDelivery.conversationKey,
    conversationKey: primaryDelivery.conversationKey,
  };

  state.messages = normalizeSignalMessages([sentMessage, ...state.messages]);
  await saveSignalEnvelopeState(record, state);

  return {
    contact: primaryDelivery.contact,
    contacts: deliveries.map((delivery) => delivery.contact),
    deliveredCount: sentMessage.deliveredCount,
    deviceCount: sentMessage.deviceCount,
    envelopeIds,
    messages: state.messages,
    sentMessage,
  };
}

export async function sendSignalAttachment({
  accountId,
  accountHandle,
  displayName,
  signalContactCode = "",
  recipientContactCode = "",
  recipientContactCodes = [],
  senderContactCodes = [],
  recipientHandle = "",
  recipientFingerprint = "",
  data,
  fileName = "signal-attachment",
  mimeType = "application/octet-stream",
  voice = false,
  subject = "attachment signal sent",
} = {}) {
  assertWebCoreAvailable();

  const attachmentData = asBytes(data, "attachment data");
  if (!attachmentData.byteLength || attachmentData.byteLength > MAX_SIGNAL_ATTACHMENT_BYTES) {
    throw new Error("Attachment is empty or exceeds the 25 MB Luna limit.");
  }

  const contactCodes = normalizeRecipientContactCodes(recipientContactCode, recipientContactCodes);
  if (!contactCodes.length) {
    throw new Error("Recipient has no lunar key yet.");
  }

  const runtime = await nativeRuntime();
  const record = await readVerifiedIdentityRecord({ accountId, accountHandle, displayName, signalContactCode });
  const state = await loadSignalEnvelopeState(record);
  const normalizedRecipientHandle = normalizeDesktopHandle(recipientHandle || "recipient");
  const safeFileName = sanitizeSignalFileName(fileName);
  const candidateMimeType = voice && !String(mimeType || "").toLowerCase().startsWith("audio/")
    ? "audio/webm"
    : mimeType;
  const normalizedMimeType = normalizeMimeType(candidateMimeType);
  const contentDigest = base64(await runtime.crypto.sha256(attachmentData));
  const deliveries = [];
  const deliveryErrors = [];
  const seenFingerprints = new Set();
  let primaryRecipientFingerprint = String(recipientFingerprint || "").trim();
  const deliveryTargets = [
    ...contactCodes.map((code) => ({ code, role: "recipient" })),
    ...normalizeRecipientContactCodes("", senderContactCodes).map((code) => ({ code, role: "sender-copy" })),
  ];

  for (const target of deliveryTargets) {
    try {
      const offer = decodeNativeContactCode(target.code);
      await verifyNativeContactOffer({ crypto: runtime.crypto, pqc: runtime.pqc, offer });

      if (offer.fingerprint === record.signingFingerprint) {
        continue;
      }
      if (seenFingerprints.has(offer.fingerprint)) {
        continue;
      }
      seenFingerprints.add(offer.fingerprint);

      const contact = contactFromOffer(offer);
      if (target.role === "recipient" && !primaryRecipientFingerprint) {
        primaryRecipientFingerprint = contact.fingerprint;
      }
      upsertContact(state, contact);

      const conversationKey = nativeConversationKey(contact);
      const existingConversation = state.conversations[conversationKey];
      let conversation;
      let kemCiphertext;

      if (existingConversation) {
        conversation = structuredClone(existingConversation);
        kemCiphertext = null;
      } else {
        const created = await createNativeOutboundSession({
          crypto: runtime.crypto,
          pqc: runtime.pqc,
          identity: record,
          contact,
        });
        conversation = created.conversation;
        kemCiphertext = created.kemCiphertext;
      }

      const prepared = await prepareNativeMessageKey({ crypto: runtime.crypto, conversation });
      const descriptor = {
        byteCount: attachmentData.byteLength,
        chunkCount: Math.ceil(attachmentData.byteLength / SIGNAL_ATTACHMENT_CHUNK_BYTES),
        chunkSize: SIGNAL_ATTACHMENT_CHUNK_BYTES,
        fileName: encodeSignalAttachmentMetadata({
          fileName: safeFileName,
          recipientHandle: normalizedRecipientHandle,
          recipientFingerprint: primaryRecipientFingerprint || contact.fingerprint,
        }),
        id: swiftUUID(),
        mimeType: normalizedMimeType,
        sha256: contentDigest,
      };
      const chunks = await encryptNativeAttachmentChunks({
        crypto: runtime.crypto,
        data: attachmentData,
        descriptor,
        conversation,
        messageCounter: prepared.counter,
        messageKey: prepared.key,
      });

      for (const chunk of chunks) {
        const uploadResponse = await relayClient(contact.relay).send(relayRequests.uploadAttachment({
          attachmentId: descriptor.id,
          chunkIndex: chunk.chunkIndex,
          payload: chunk.payload,
          ttlSeconds: SIGNAL_ATTACHMENT_TTL_SECONDS,
        }));
        if (uploadResponse.type !== "ok") {
          throw new Error(uploadResponse.error || `Attachment upload failed: ${uploadResponse.type || "unknown"}`);
        }
      }

      const sentAt = swiftISODate();
      const envelope = await encryptNativeMessageEnvelope({
        crypto: runtime.crypto,
        pqc: runtime.pqc,
        identity: record,
        contact,
        conversation,
        body: { attachment: descriptor, type: "attachment" },
        preparedMessageKey: prepared,
        kemCiphertext,
        sentAt,
      });
      const response = await relayClient(contact.relay).send(relayRequests.deliver({
        inboxId: contact.inboxId,
        routingToken: contact.inboxId,
        envelope,
        destinationRelay: endpointsEqual(contact.relay, record.relayEndpoint) ? null : contact.relay,
      }));
      if (response.type !== "delivered" && response.type !== "ok") {
        throw new Error(response.error || `Noctweave relay rejected attachment: ${response.type || "unknown"}`);
      }

      state.conversations[conversationKey] = conversation;
      deliveries.push({
        attachmentRecovery: makeAttachmentRecovery(contact.relay, conversation, prepared),
        contact,
        conversation,
        conversationKey,
        deliveredCount: response.delivered?.storedCount ?? response.storedCount ?? 0,
        descriptor,
        envelope,
        role: target.role,
        sentAt,
      });
    } catch (error) {
      deliveryErrors.push(describeSignalError(error));
    }
  }

  const recipientDeliveries = deliveries.filter((delivery) => delivery.role === "recipient");
  if (!recipientDeliveries.length) {
    const reason = [...new Set(deliveryErrors)].filter(Boolean).slice(0, 3).join(" / ");
    throw new Error(reason ? `Attachment could not be delivered: ${reason}` : "Attachment could not be delivered to any saved device.");
  }

  const primaryDelivery = recipientDeliveries[0];
  const isVoice = voice || normalizedMimeType.startsWith("audio/");
  const attachmentLabel = signalAttachmentDisplayLabel(normalizedMimeType, isVoice);
  const sentMessage = {
    id: primaryDelivery.envelope.id,
    envelopeId: primaryDelivery.envelope.id,
    envelopeIds: deliveries.map((delivery) => delivery.envelope.id).filter(Boolean),
    author: normalizeDesktopHandle(record.accountHandle || record.displayName || "Luna"),
    recipient: normalizedRecipientHandle || normalizeDesktopHandle(primaryDelivery.contact.displayName || "recipient"),
    counterpartyHandle: normalizedRecipientHandle || normalizeDesktopHandle(primaryDelivery.contact.displayName || "recipient"),
    conversationHandle: normalizedRecipientHandle || normalizeDesktopHandle(primaryDelivery.contact.displayName || "recipient"),
    recipientFingerprint: primaryRecipientFingerprint || primaryDelivery.contact.fingerprint,
    subject: isVoice ? "voice signal sent" : subject,
    message: `${attachmentLabel} / ${safeFileName}`,
    timestamp: "just now",
    createdAt: primaryDelivery.sentAt,
    unread: false,
    direction: "outbox",
    deliveryState: deliveryErrors.length ? "partial" : "sent",
    deliveryError: deliveryErrors.join(" / "),
    deliveredCount: deliveries.reduce((total, delivery) => total + Number(delivery.deliveredCount || 0), 0),
    deviceCount: deliveries.length,
    contactFingerprint: primaryDelivery.contact.fingerprint,
    conversationId: primaryDelivery.envelope.conversationId || primaryDelivery.conversation.id,
    conversationKey: primaryDelivery.conversationKey,
    attachment: publicSignalAttachment(primaryDelivery.descriptor),
    attachmentRecovery: primaryDelivery.attachmentRecovery,
  };

  state.messages = normalizeSignalMessages([sentMessage, ...state.messages]);
  await saveSignalEnvelopeState(record, state);
  try {
    await saveSignalMediaCache(record, sentMessage.attachment, attachmentData);
  } catch (error) {
    console.warn("Luna Noctweave sent attachment cache failed without affecting delivery:", error);
  }
  return {
    deliveredCount: sentMessage.deliveredCount,
    deviceCount: sentMessage.deviceCount,
    envelopeIds: sentMessage.envelopeIds,
    messages: state.messages,
    sentMessage,
  };
}

export async function fetchSignalAttachment({
  accountId,
  accountHandle,
  displayName,
  signalContactCode = "",
  attachmentId = "",
} = {}) {
  const runtime = await nativeRuntime();
  const record = await readVerifiedIdentityRecord({ accountId, accountHandle, displayName, signalContactCode });
  const state = await loadSignalEnvelopeState(record);
  const normalizedID = normalizeUUID(attachmentId);
  const message = state.messages.find((entry) => normalizeUUID(entry?.attachment?.id) === normalizedID);

  if (!message?.attachment || !message?.attachmentRecovery?.messageKey) {
    throw new Error("Attachment recovery key is unavailable on this device.");
  }

  const descriptor = message.attachment;
  const recovery = message.attachmentRecovery;
  const cached = await loadSignalMediaCache(record, descriptor);
  if (cached) {
    return {
      data: cached,
      descriptor,
      source: "encrypted-cache",
    };
  }
  const messageKey = fromBase64(recovery.messageKey);
  const recoveredParts = [];

  for (let chunkIndex = 0; chunkIndex < descriptor.chunkCount; chunkIndex += 1) {
    const response = await relayClient(recovery.relay || record.relayEndpoint).send(
      relayRequests.fetchAttachment({ attachmentId: normalizedID, chunkIndex }),
    );
    if (response.type !== "attachment" || !response.attachment?.payload) {
      throw new Error(response.error || "Encrypted attachment chunk is unavailable or expired.");
    }
    recoveredParts.push(await decryptNativeAttachmentChunk({
      crypto: runtime.crypto,
      descriptor,
      recovery,
      messageKey,
      chunkIndex,
      payload: response.attachment.payload,
    }));
  }

  const recovered = concatBytes(...recoveredParts);
  if (recovered.byteLength !== descriptor.byteCount) {
    throw new Error("Attachment byte count did not match the signed descriptor.");
  }
  if (base64(await runtime.crypto.sha256(recovered)) !== descriptor.sha256) {
    throw new Error("Attachment digest verification failed.");
  }

  try {
    await saveSignalMediaCache(record, descriptor, recovered);
  } catch (error) {
    console.warn("Luna Noctweave received attachment cache failed without affecting recovery:", error);
  }

  return {
    data: recovered,
    descriptor,
    source: "relay",
  };
}

function normalizeRecipientContactCodes(primaryCode = "", contactCodes = []) {
  const values = [
    primaryCode,
    ...(Array.isArray(contactCodes) ? contactCodes : [contactCodes]),
  ];
  const seen = new Set();
  const normalized = [];

  values.forEach((value) => {
    const code = String(value || "").trim();
    const key = code.toLowerCase();

    if (!code || seen.has(key)) {
      return;
    }

    seen.add(key);
    normalized.push(code);
  });

  return normalized;
}

function encodeSignalTextPayload({
  text = "",
  recipientHandle = "",
  recipientFingerprint = "",
} = {}) {
  return `${LUNA_SIGNAL_TEXT_PREFIX}${JSON.stringify({
    recipientFingerprint: String(recipientFingerprint || "").trim(),
    recipientHandle: normalizeDesktopHandle(recipientHandle),
    text: String(text || ""),
    version: 1,
  })}`;
}

function decodeSignalTextPayload(value = "") {
  const raw = String(value || "");

  if (!raw.startsWith(LUNA_SIGNAL_TEXT_PREFIX)) {
    return {
      text: raw,
    };
  }

  try {
    const payload = JSON.parse(raw.slice(LUNA_SIGNAL_TEXT_PREFIX.length));
    return {
      recipientFingerprint: String(payload?.recipientFingerprint || "").trim(),
      recipientHandle: normalizeDesktopHandle(payload?.recipientHandle || ""),
      text: String(payload?.text || ""),
      version: Number(payload?.version || 1),
    };
  } catch (error) {
    console.warn("Luna Noctweave signal metadata decode failed:", error);
    return {
      text: raw,
    };
  }
}

function encodeSignalAttachmentMetadata({ fileName, recipientHandle, recipientFingerprint }) {
  const payload = {
    fileName: sanitizeSignalFileName(fileName),
    recipientFingerprint: String(recipientFingerprint || "").trim(),
    recipientHandle: normalizeDesktopHandle(recipientHandle),
    version: 1,
  };
  return `${LUNA_SIGNAL_ATTACHMENT_PREFIX}${base64(textEncoder.encode(JSON.stringify(payload)))}`;
}

function decodeSignalAttachmentMetadata(value = "") {
  const raw = String(value || "");
  if (!raw.startsWith(LUNA_SIGNAL_ATTACHMENT_PREFIX)) {
    return { fileName: sanitizeSignalFileName(raw), recipientFingerprint: "", recipientHandle: "" };
  }

  try {
    const payload = JSON.parse(textDecoder.decode(fromBase64(raw.slice(LUNA_SIGNAL_ATTACHMENT_PREFIX.length))));
    return {
      fileName: sanitizeSignalFileName(payload?.fileName),
      recipientFingerprint: String(payload?.recipientFingerprint || "").trim(),
      recipientHandle: normalizeDesktopHandle(payload?.recipientHandle || ""),
    };
  } catch (error) {
    console.warn("Luna Noctweave attachment metadata decode failed:", error);
    return { fileName: "signal-attachment", recipientFingerprint: "", recipientHandle: "" };
  }
}

function sanitizeSignalFileName(value = "") {
  const name = String(value || "").trim().replaceAll("\\", "/").split("/").pop() || "signal-attachment";
  return name.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 180) || "signal-attachment";
}

function normalizeMimeType(value = "") {
  const mimeType = String(value || "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(mimeType)
    ? mimeType.slice(0, 120)
    : "application/octet-stream";
}

function signalAttachmentDisplayLabel(mimeType, voice = false) {
  const normalized = normalizeMimeType(mimeType);
  if (voice || normalized.startsWith("audio/")) {
    return "voice signal";
  }
  if (normalized.startsWith("image/") && normalized !== "image/svg+xml") {
    return "photo signal";
  }
  return "file signal";
}

function publicSignalAttachment(descriptor = {}) {
  const metadata = decodeSignalAttachmentMetadata(descriptor.fileName || "");
  return {
    byteCount: Number(descriptor.byteCount || 0),
    chunkCount: Number(descriptor.chunkCount || 0),
    chunkSize: Number(descriptor.chunkSize || 0),
    fileName: metadata.fileName,
    id: normalizeUUID(descriptor.id),
    mimeType: normalizeMimeType(descriptor.mimeType),
    sha256: String(descriptor.sha256 || ""),
  };
}

function makeAttachmentRecovery(relay, conversation, prepared) {
  return {
    conversationId: conversation.id,
    messageCounter: Number(prepared.counter),
    messageKey: base64(prepared.key),
    relay: sanitizeRelayEndpoint(relay),
    sessionId: conversation.sessionId,
  };
}

export async function receiveSignalText({
  accountId,
  accountHandle,
  displayName,
  signalContactCode = "",
  contactCodes = [],
  maxCount = 25,
  acknowledge = true,
} = {}) {
  assertWebCoreAvailable();

  const runtime = await nativeRuntime();
  const record = await readVerifiedIdentityRecord({
    accountId,
    accountHandle,
    displayName,
    signalContactCode,
  });
  const state = await loadSignalEnvelopeState(record);
  await importSignalContactCodes({
    runtime,
    state,
    contactCodes,
    ownFingerprint: record.signingFingerprint,
  });
  const ownAccess = deserializeKeypair(record.access);
  const fetchCount = Math.max(1, Math.min(100, Number(maxCount) || 25));
  const signedAt = swiftISODate();
  const nonce = swiftUUID();
  const fetchPayload = {
    inboxId: record.inboxId,
    routingToken: record.inboxId,
    maxCount: fetchCount,
    longPollTimeoutSeconds: 0,
    signedAt,
    nonce,
  };
  const response = await relayClient(record.relayEndpoint).send(relayRequests.fetch({
    inboxId: record.inboxId,
    routingToken: record.inboxId,
    maxCount: fetchCount,
    longPollTimeoutSeconds: 0,
    accessProof: actorProof({
      pqc: runtime.pqc,
      keypair: ownAccess,
      fingerprint: record.accessFingerprint,
      signedAt,
      nonce,
      payload: fetchPayload,
    }),
  }));

  if (response.type === "ok") {
    return { messages: state.messages, receivedMessages: [] };
  }
  if (response.type !== "messages") {
    throw new Error(response.error || `Noctweave relay fetch failed: ${response.type || "unknown"}`);
  }

  const receivedMessages = [];
  const ackIds = [];
  const seen = new Set(state.seenEnvelopeIds || []);

  for (const envelope of response.messages || []) {
    const envelopeId = String(envelope?.id || "");
    const seenKey = envelopeId.toLowerCase();

    if (!envelopeId) {
      continue;
    }

    if (seen.has(seenKey)) {
      ackIds.push(normalizeUUID(envelopeId));
      continue;
    }

    let decoded;

    try {
      decoded = await decodeSignalEnvelope({ runtime, record, state, envelope });
    } catch (error) {
      console.warn("Luna Noctweave envelope skipped:", error);
      continue;
    }

    if (!decoded) {
      continue;
    }

    seen.add(seenKey);
    ackIds.push(normalizeUUID(envelopeId));

    if (decoded.ackOnly) {
      continue;
    }

    receivedMessages.push(decoded);
  }

  state.seenEnvelopeIds = [...seen];
  if (receivedMessages.length) {
    state.messages = normalizeSignalMessages([...receivedMessages, ...state.messages]);
  }
  await saveSignalEnvelopeState(record, state);

  if (acknowledge && ackIds.length) {
    try {
      await acknowledgeSignalMessages({ runtime, record, messageIds: ackIds });
    } catch (error) {
      console.warn("Luna Noctweave acknowledge failed:", error);
    }
  }

  return { messages: state.messages, receivedMessages };
}

async function importSignalContactCodes({
  runtime,
  state,
  contactCodes = [],
  ownFingerprint = "",
} = {}) {
  const uniqueCodes = [...new Set((Array.isArray(contactCodes) ? contactCodes : [])
    .map((code) => String(code || "").trim())
    .filter(Boolean))];

  for (const contactCode of uniqueCodes) {
    try {
      const offer = decodeNativeContactCode(contactCode);

      if (offer.fingerprint === ownFingerprint) {
        continue;
      }
      await verifyNativeContactOffer({ crypto: runtime.crypto, pqc: runtime.pqc, offer });
      upsertContact(state, contactFromOffer(offer));
    } catch (error) {
      console.warn("Luna Noctweave contact import skipped:", error);
    }
  }
}

export function parseRelayEndpoint(value = "") {
  const input = String(value || "").trim();

  if (!input) {
    return {
      endpoint: { ...DEFAULT_RELAY_ENDPOINT },
      input: "",
      url: relayEndpointToUrl(DEFAULT_RELAY_ENDPOINT),
      accountRelayUrl: "",
      isDefault: true,
    };
  }

  let endpoint;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) {
    endpoint = parseNoctweaveRelayEndpoint(normalizeLegacyRelayURL(input));
  } else {
    endpoint = parseNoctweaveRelayEndpoint(`https://${input}`);
  }

  assertBrowserRelayEndpoint(endpoint);
  return {
    endpoint,
    input,
    url: relayEndpointToUrl(endpoint),
    accountRelayUrl: input,
    isDefault: endpointsEqual(endpoint, DEFAULT_RELAY_ENDPOINT),
  };
}

function normalizeLegacyRelayURL(input) {
  const url = new URL(input);
  if (!url.username && !url.password && !url.search && !url.hash &&
      /^\/relay\/?$/i.test(url.pathname)) {
    url.pathname = "/";
    return url.href;
  }
  return input;
}

export function relayEndpointToUrl(endpoint) {
  return relayEndpointURL(sanitizeRelayEndpoint(endpoint), "/relay");
}

export function decodeContactCode(contactCode) {
  return decodeNativeContactCode(String(contactCode || "").trim());
}

export async function verifySignalContactCode(contactCode) {
  assertWebCoreAvailable();
  const runtime = await nativeRuntime();
  const offer = decodeNativeContactCode(String(contactCode || "").trim());
  await verifyNativeContactOffer({ crypto: runtime.crypto, pqc: runtime.pqc, offer });
  return {
    displayName: String(offer.displayName || ""),
    fingerprint: String(offer.fingerprint || ""),
  };
}

async function nativeRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => ({
      crypto: new WebCryptoPrimitives(),
      pqc: await NoctweaveOQSWasmAdapter.fromFactory(oqsFactory),
    }))();
  }
  return runtimePromise;
}

function assertWebCoreAvailable() {
  if (!isNoctweaveWebCoreAvailable()) {
    throw new Error("Noctweave web core needs IndexedDB, WebCrypto, and WebAssembly in this browser.");
  }
}

async function createIdentityRecord(runtime, key, accountId = "", accountHandle = "") {
  const signing = runtime.pqc.generateSigningKeypair();
  const agreement = runtime.pqc.generateKemKeypair();
  const access = runtime.pqc.generateSigningKeypair();
  const now = iso8601NoMilliseconds();
  const inboxId = bech32Encode("noctweave", await runtime.crypto.sha256(access.publicKey));

  return {
    key,
    accountId: String(accountId || ""),
    accountHandle: String(accountHandle || ""),
    displayName: String(accountHandle || key || "Luna"),
    createdAt: now,
    updatedAt: now,
    signing: serializeKeypair(signing),
    agreement: serializeKeypair(agreement),
    access: serializeKeypair(access),
    inboxId,
    accessFingerprint: base64(await runtime.crypto.sha256(access.publicKey)),
    signingFingerprint: base64(await runtime.crypto.sha256(signing.publicKey)),
    relayEndpoint: { ...DEFAULT_RELAY_ENDPOINT },
    relayUrl: relayEndpointToUrl(DEFAULT_RELAY_ENDPOINT),
    accountRelayUrl: "",
  };
}

async function registerIdentityInbox(runtime, record) {
  const access = deserializeKeypair(record.access);
  const signedAt = swiftISODate();
  const nonce = swiftUUID();
  const proofPayload = {
    accessPublicKey: record.access.publicKey,
    contactOffer: record.contactOffer,
    inboxId: record.inboxId,
    nonce,
    signedAt,
  };
  const response = await relayClient(record.relayEndpoint).send(relayRequests.registerInbox({
    inboxId: record.inboxId,
    accessPublicKey: record.access.publicKey,
    contactOffer: record.contactOffer,
    accessProof: actorProof({
      pqc: runtime.pqc,
      keypair: access,
      fingerprint: record.accessFingerprint,
      signedAt,
      nonce,
      payload: proofPayload,
    }),
  }));

  if (response?.type === "error") {
    throw new Error(response.error || "Noctweave relay registration failed.");
  }

  return response || { type: "ok" };
}

async function decodeSignalEnvelope({ runtime, record, state, envelope }) {
  const contact = (state.contacts || []).find((candidate) => candidate.fingerprint === envelope.senderFingerprint);

  if (!contact) {
    return null;
  }

  const conversationKey = nativeConversationKey(contact);
  const existingConversation = state.conversations[conversationKey];
  const candidates = [];

  if (envelope.kemCiphertext) {
    candidates.push(await createNativeInboundSession({
      crypto: runtime.crypto,
      pqc: runtime.pqc,
      identity: record,
      contact,
      kemCiphertext: envelope.kemCiphertext,
    }));
  }
  if (existingConversation) {
    candidates.push(structuredClone(existingConversation));
  }
  if (!candidates.length) {
    return null;
  }

  let decrypted;
  let conversation;
  let lastError;

  for (const candidate of candidates) {
    try {
      decrypted = await decryptNativeMessageEnvelope({
        crypto: runtime.crypto,
        pqc: runtime.pqc,
        identity: record,
        contact,
        conversation: candidate,
        envelope,
      });
      conversation = candidate;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!decrypted || !conversation) {
    throw lastError || new Error("Noctweave envelope could not be decrypted.");
  }
  state.conversations[conversationKey] = conversation;

  let payload;
  let attachment = null;
  let attachmentRecovery = null;
  let subject;
  let message;

  if (decrypted.body?.type === "text") {
    payload = decodeSignalTextPayload(decrypted.body.text);
    subject = "new signal received";
    message = payload.text;
  } else if (decrypted.body?.type === "attachment" && decrypted.body.attachment) {
    attachment = publicSignalAttachment(decrypted.body.attachment);
    const metadata = decodeSignalAttachmentMetadata(decrypted.body.attachment.fileName || "");
    payload = {
      recipientFingerprint: metadata.recipientFingerprint,
      recipientHandle: metadata.recipientHandle,
    };
    const isVoice = attachment.mimeType.startsWith("audio/");
    const attachmentLabel = signalAttachmentDisplayLabel(attachment.mimeType, isVoice);
    subject = `${attachmentLabel} received`;
    message = `${attachmentLabel} / ${attachment.fileName}`;
    attachmentRecovery = makeAttachmentRecovery(contact.relay, conversation, {
      counter: Number(envelope.messageCounter),
      key: decrypted.messageKey,
    });
  } else {
    throw new Error(`Unsupported native message body: ${decrypted.body?.type || "unknown"}`);
  }

  const author = normalizeDesktopHandle(contact.displayName || "signal");
  const ownHandle = normalizeDesktopHandle(record.accountHandle || record.displayName || "Luna");
  const recipient = normalizeDesktopHandle(payload.recipientHandle || ownHandle);
  const isOwnSenderCopy = author && ownHandle && author.toLowerCase() === ownHandle.toLowerCase();
  const direction = isOwnSenderCopy ? "outbox" : "inbox";
  const counterpartyHandle = direction === "outbox" ? recipient : author;

  return {
    id: envelope.id,
    envelopeId: envelope.id,
    author,
    recipient: direction === "outbox" ? recipient : ownHandle,
    counterpartyHandle,
    conversationHandle: counterpartyHandle,
    recipientFingerprint: payload.recipientFingerprint || "",
    subject,
    message,
    timestamp: envelope.sentAt || "just now",
    createdAt: envelope.sentAt || iso8601NoMilliseconds(),
    // Every decoded envelope arrived from the relay. The application can
    // identify encrypted copies from the user's other verified devices and
    // suppress those without trusting a sender-chosen display name.
    unread: true,
    direction,
    deliveryState: direction === "inbox" ? "received" : "sent",
    contactFingerprint: contact.fingerprint,
    conversationId: envelope.conversationId || conversation.id || conversationKey,
    conversationKey,
    attachment,
    attachmentRecovery,
  };
}

async function acknowledgeSignalMessages({ runtime, record, messageIds }) {
  const ownAccess = deserializeKeypair(record.access);
  const signedAt = swiftISODate();
  const nonce = swiftUUID();
  const payload = {
    inboxId: record.inboxId,
    messageIds,
    signedAt,
    nonce,
  };
  const response = await relayClient(record.relayEndpoint).send(relayRequests.acknowledgeMessages({
    inboxId: record.inboxId,
    messageIds,
    accessProof: actorProof({
      pqc: runtime.pqc,
      keypair: ownAccess,
      fingerprint: record.accessFingerprint,
      signedAt,
      nonce,
      payload,
    }),
  }));

  if (response?.type === "error") {
    throw new Error(response.error || "Noctweave relay acknowledgement failed.");
  }
  return response || { type: "ok" };
}

function relayClient(endpoint) {
  return new NoctweaveRelayClient(endpoint, {
    timeoutMs: 12000,
  });
}

function actorProof({ pqc, keypair, fingerprint, signedAt, nonce, payload }) {
  return {
    fingerprint,
    publicSigningKey: base64(keypair.publicKey),
    signedAt,
    nonce,
    signature: base64(pqc.sign(canonicalJsonBytes(withoutUndefined(payload)), keypair.secretKey)),
  };
}

function contactFromOffer(offer) {
  return {
    displayName: offer.displayName,
    inboxId: offer.inboxId,
    relay: sanitizeRelayEndpoint(offer.relay),
    fingerprint: offer.fingerprint,
    signingPublicKey: offer.signingPublicKey,
    agreementPublicKey: offer.agreementPublicKey,
  };
}

function upsertContact(state, contact) {
  state.contacts = Array.isArray(state.contacts) ? state.contacts : [];
  const existingIndex = state.contacts.findIndex((candidate) => candidate.fingerprint === contact.fingerprint);
  if (existingIndex >= 0) {
    state.contacts[existingIndex] = contact;
    return;
  }
  state.contacts.push(contact);
}

function publicIdentity(record, relayRegistration = null) {
  return {
    accountRelayUrl: record.accountRelayUrl || "",
    contactCode: record.contactCode || "",
    contactOffer: record.contactOffer || null,
    fingerprint: record.signingFingerprint || record.fingerprint || "",
    inboxId: record.inboxId || "",
    relayEndpoint: record.relayEndpoint || { ...DEFAULT_RELAY_ENDPOINT },
    relayUrl: record.relayUrl || relayEndpointToUrl(record.relayEndpoint || DEFAULT_RELAY_ENDPOINT),
    registered: relayRegistration ? relayRegistration.type !== "error" : record.lastRelayRegistration?.type !== "error" && Boolean(record.lastRelayRegistration),
    registrationError: relayRegistration?.type === "error" ? relayRegistration.error || "" : record.lastRelayRegistration?.error || "",
  };
}

function hasCompleteKeyMaterial(record) {
  return Boolean(
    record?.signing?.publicKey &&
    record?.signing?.secretKey &&
    record?.agreement?.publicKey &&
    record?.agreement?.secretKey &&
    record?.access?.publicKey &&
    record?.access?.secretKey &&
    record?.inboxId &&
    record?.accessFingerprint &&
    record?.signingFingerprint,
  );
}

function normalizeIdentityRecord(record) {
  if (!record) {
    return null;
  }
  if (record.signing && record.agreement && record.access) {
    return record;
  }
  if (
    record.signingPublicKey &&
    record.signingSecretKey &&
    record.agreementPublicKey &&
    record.agreementSecretKey &&
    record.inboxAccessPublicKey &&
    record.inboxAccessSecretKey
  ) {
    return {
      ...record,
      signing: {
        publicKey: base64FromBytes(record.signingPublicKey),
        secretKey: base64FromBytes(record.signingSecretKey),
      },
      agreement: {
        publicKey: base64FromBytes(record.agreementPublicKey),
        secretKey: base64FromBytes(record.agreementSecretKey),
      },
      access: {
        publicKey: base64FromBytes(record.inboxAccessPublicKey),
        secretKey: base64FromBytes(record.inboxAccessSecretKey),
      },
      accessFingerprint: record.accessFingerprint || record.inboxAccessFingerprint || "",
      signingFingerprint: record.signingFingerprint || record.fingerprint || "",
    };
  }
  return record;
}

function openIdentityDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(IDENTITY_STORE)) {
        db.createObjectStore(IDENTITY_STORE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(MESSAGE_STORE)) {
        db.createObjectStore(MESSAGE_STORE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(IDENTITY_KEY_STORE)) {
        db.createObjectStore(IDENTITY_KEY_STORE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(IDENTITY_VAULT_STORE)) {
        db.createObjectStore(IDENTITY_VAULT_STORE, { keyPath: "key" });
      }

      const mediaStore = db.objectStoreNames.contains(MEDIA_CACHE_STORE)
        ? request.transaction.objectStore(MEDIA_CACHE_STORE)
        : db.createObjectStore(MEDIA_CACHE_STORE, { keyPath: "key" });
      if (!mediaStore.indexNames.contains("accountKey")) {
        mediaStore.createIndex("accountKey", "accountKey", { unique: false });
      }
    };
    request.onerror = () => reject(request.error || new Error("Noctweave IndexedDB open failed."));
    request.onsuccess = () => resolve(request.result);
  });
}

async function storeOperation(storeName, mode, callback) {
  const db = await openIdentityDatabase();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let value;

      transaction.oncomplete = () => resolve(value);
      transaction.onerror = () => reject(transaction.error || new Error("Noctweave IndexedDB transaction failed."));
      transaction.onabort = () => reject(transaction.error || new Error("Noctweave IndexedDB transaction aborted."));

      try {
        callback(store, (nextValue) => {
          value = nextValue;
        });
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  } finally {
    db.close();
  }
}

function readLegacyIdentityRecord(key) {
  return storeOperation(IDENTITY_STORE, "readonly", (store, setValue) => {
    const request = store.get(key);
    request.onsuccess = () => setValue(request.result || null);
  });
}

function writeLegacyIdentityRecord(record) {
  return storeOperation(IDENTITY_STORE, "readwrite", (store) => {
    store.put(record);
  });
}

function deleteLegacyIdentityRecord(key) {
  return storeOperation(IDENTITY_STORE, "readwrite", (store) => {
    store.delete(key);
  });
}

async function readIdentityRecord(key) {
  const vaultRecord = await readIdentityVaultRecord(key);

  if (vaultRecord?.envelope) {
    const vaultKey = await readIdentityVaultKey(key);

    if (!vaultKey) {
      throw new Error("Encrypted Noctweave identity key is unavailable; no replacement key was generated.");
    }

    return decryptLunaIdentityRecord(key, vaultRecord.envelope, vaultKey);
  }

  const legacyRecord = await readLegacyIdentityRecord(key);

  if (!legacyRecord) {
    return null;
  }

  const normalizedLegacyRecord = normalizeIdentityRecord(legacyRecord);
  if (!hasCompleteKeyMaterial(normalizedLegacyRecord)) {
    throw new Error("Encrypted Noctweave identity is incomplete; no replacement key was generated.");
  }

  await writeEncryptedIdentityRecord(normalizedLegacyRecord);
  await writeLegacyIdentityMigrationMarker(key);
  return normalizedLegacyRecord;
}

async function writeIdentityRecord(record) {
  await writeEncryptedIdentityRecord(record);
  await writeLegacyIdentityMigrationMarker(record.key);
}

async function deleteIdentityRecord(key) {
  await Promise.all([
    deleteLegacyIdentityRecord(key),
    deleteIdentityVaultRecord(key),
    deleteIdentityVaultKey(key),
  ]);
}

async function writeEncryptedIdentityRecord(record) {
  const vaultKey = await getOrCreateIdentityVaultKey(record.key);
  const envelope = await encryptLunaIdentityRecord(record, vaultKey);
  const verified = await decryptLunaIdentityRecord(record.key, envelope, vaultKey);

  if (!lunaIdentityKeyMaterialMatches(record, verified)) {
    throw new Error("Encrypted Noctweave identity migration did not preserve key material.");
  }

  await writeIdentityVaultRecord({ key: record.key, envelope, updatedAt: iso8601NoMilliseconds() });
}

function writeLegacyIdentityMigrationMarker(key) {
  return writeLegacyIdentityRecord(lunaIdentityMigrationMarker(key, iso8601NoMilliseconds()));
}

async function getOrCreateIdentityVaultKey(key) {
  const existing = await readIdentityVaultKey(key);

  if (existing) {
    return existing;
  }

  const cryptoKey = await generateLunaIdentityVaultKey();
  await storeOperation(IDENTITY_KEY_STORE, "readwrite", (store) => {
    store.put({ key, cryptoKey });
  });
  return cryptoKey;
}

function readIdentityVaultKey(key) {
  return storeOperation(IDENTITY_KEY_STORE, "readonly", (store, setValue) => {
    const request = store.get(key);
    request.onsuccess = () => setValue(request.result?.cryptoKey || null);
  });
}

function deleteIdentityVaultKey(key) {
  return storeOperation(IDENTITY_KEY_STORE, "readwrite", (store) => store.delete(key));
}

function readIdentityVaultRecord(key) {
  return storeOperation(IDENTITY_VAULT_STORE, "readonly", (store, setValue) => {
    const request = store.get(key);
    request.onsuccess = () => setValue(request.result || null);
  });
}

function writeIdentityVaultRecord(record) {
  return storeOperation(IDENTITY_VAULT_STORE, "readwrite", (store) => store.put(record));
}

function deleteIdentityVaultRecord(key) {
  return storeOperation(IDENTITY_VAULT_STORE, "readwrite", (store) => store.delete(key));
}

function readMessageRecord(key) {
  return storeOperation(MESSAGE_STORE, "readonly", (store, setValue) => {
    const request = store.get(key);
    request.onsuccess = () => setValue(request.result || null);
  });
}

function writeMessageRecord(record) {
  return storeOperation(MESSAGE_STORE, "readwrite", (store) => {
    store.put(record);
  });
}

function deleteMessageRecord(key) {
  return storeOperation(MESSAGE_STORE, "readwrite", (store) => {
    store.delete(key);
  });
}

function readSignalMediaCacheRecord(accountKey, attachmentId) {
  const key = signalMediaCacheKey(accountKey, attachmentId);
  return storeOperation(MEDIA_CACHE_STORE, "readonly", (store, setValue) => {
    const request = store.get(key);
    request.onsuccess = () => setValue(request.result || null);
  });
}

function writeSignalMediaCacheRecord(record) {
  return storeOperation(MEDIA_CACHE_STORE, "readwrite", (store) => {
    store.put(record);
  });
}

function deleteSignalMediaCacheRecord(accountKey, attachmentId) {
  const key = signalMediaCacheKey(accountKey, attachmentId);
  return storeOperation(MEDIA_CACHE_STORE, "readwrite", (store) => {
    store.delete(key);
  });
}

function listSignalMediaCacheRecords(accountKey) {
  return storeOperation(MEDIA_CACHE_STORE, "readonly", (store, setValue) => {
    const request = store.index("accountKey").getAll(IDBKeyRange.only(accountKey));
    request.onsuccess = () => setValue(request.result || []);
  });
}

async function saveSignalMediaCache(record, descriptor, data) {
  const attachmentId = normalizeUUID(descriptor?.id);
  const bytes = asBytes(data, "attachment cache data");

  if (!attachmentId || !bytes.byteLength || bytes.byteLength > MAX_SIGNAL_ATTACHMENT_BYTES) {
    return;
  }
  if (Number(descriptor.byteCount || 0) !== bytes.byteLength) {
    throw new Error("Attachment cache byte count did not match its descriptor.");
  }

  const digest = base64FromBytes(await crypto.subtle.digest("SHA-256", bytes));
  if (digest !== String(descriptor.sha256 || "")) {
    throw new Error("Attachment cache digest did not match its descriptor.");
  }

  const storageKey = await deriveLunaMessageStorageKey(record, { version: 3 });
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: signalMediaCacheAAD(record.key, attachmentId),
    },
    storageKey,
    bytes,
  ));

  await writeSignalMediaCacheRecord({
    key: signalMediaCacheKey(record.key, attachmentId),
    accountKey: record.key,
    attachmentId,
    byteCount: bytes.byteLength,
    ciphertext,
    digest,
    iv,
    updatedAt: Date.now(),
  });
  await enforceSignalMediaCacheQuota(record.key);
}

async function loadSignalMediaCache(record, descriptor) {
  const attachmentId = normalizeUUID(descriptor?.id);
  if (!attachmentId) {
    return null;
  }

  const cached = await readSignalMediaCacheRecord(record.key, attachmentId);
  if (!cached?.ciphertext || !cached?.iv) {
    return null;
  }

  try {
    const storageKey = await deriveLunaMessageStorageKey(record, { version: 3 });
    const plaintext = new Uint8Array(await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: asBytes(cached.iv, "attachment cache iv"),
        additionalData: signalMediaCacheAAD(record.key, attachmentId),
      },
      storageKey,
      asBytes(cached.ciphertext, "attachment cache ciphertext"),
    ));
    const digest = base64FromBytes(await crypto.subtle.digest("SHA-256", plaintext));

    if (plaintext.byteLength !== Number(descriptor.byteCount || 0) || digest !== String(descriptor.sha256 || "")) {
      throw new Error("Encrypted attachment cache verification failed.");
    }

    await writeSignalMediaCacheRecord({
      ...cached,
      byteCount: plaintext.byteLength,
      digest,
      updatedAt: Date.now(),
    });
    return plaintext;
  } catch (error) {
    console.warn("Luna Noctweave encrypted attachment cache entry was discarded after verification failed:", error);
    await deleteSignalMediaCacheRecord(record.key, attachmentId);
    return null;
  }
}

async function enforceSignalMediaCacheQuota(accountKey) {
  const records = await listSignalMediaCacheRecords(accountKey);
  let totalBytes = records.reduce((total, record) => total + Number(record.ciphertext?.byteLength || 0), 0);

  if (totalBytes <= MEDIA_CACHE_MAX_BYTES) {
    return;
  }

  const oldestFirst = records.slice().sort((first, second) => Number(first.updatedAt || 0) - Number(second.updatedAt || 0));
  for (const record of oldestFirst) {
    if (totalBytes <= MEDIA_CACHE_MAX_BYTES) {
      break;
    }
    await deleteSignalMediaCacheRecord(accountKey, record.attachmentId);
    totalBytes -= Number(record.ciphertext?.byteLength || 0);
  }
}

async function deleteSignalMediaCacheForAccount(accountKey) {
  const records = await listSignalMediaCacheRecords(accountKey);
  for (const record of records) {
    await deleteSignalMediaCacheRecord(accountKey, record.attachmentId);
  }
}

function signalMediaCacheKey(accountKey, attachmentId) {
  return `${accountKey}:${normalizeUUID(attachmentId)}`;
}

function signalMediaCacheAAD(accountKey, attachmentId) {
  return textEncoder.encode(`LUNA-SIGNAL-MEDIA-V1:${accountKey}:${normalizeUUID(attachmentId)}`);
}

async function readVerifiedIdentityRecord({
  accountId,
  accountHandle,
  displayName,
  signalContactCode = "",
} = {}) {
  const key = normalizeAccountKey(accountId || accountHandle || displayName);
  const record = normalizeIdentityRecord(await readIdentityRecord(key));

  if (!hasCompleteKeyMaterial(record)) {
    throw new Error("Local prayer key is missing. Use send prayer on this device.");
  }

  return record;
}

async function loadSignalEnvelopeState(record) {
  const encryptedRecord = await readMessageRecord(record.key);

  if (!encryptedRecord?.ciphertext || !encryptedRecord?.iv) {
    return emptySignalState();
  }

  let payload;
  let migratedLegacyState = false;

  try {
    const candidates = encryptedRecord.kdfVersion === 3
      ? [{ version: 3 }]
      : [
          { version: 2, contactCode: record.contactCode || "" },
          ...(record.previousContactCodes || []).map((contactCode) => ({ version: 2, contactCode })),
        ];
    let lastError;

    for (const candidate of candidates) {
      try {
        const storageKey = await deriveLunaMessageStorageKey(record, candidate);
        const plaintext = await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: asBytes(encryptedRecord.iv, "messageLogIv"),
          },
          storageKey,
          asBytes(encryptedRecord.ciphertext, "messageLogCiphertext"),
        );
        payload = JSON.parse(textDecoder.decode(plaintext));
        migratedLegacyState = candidate.version === 2;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!payload) {
      throw lastError || new Error("Noctweave message state could not be decrypted.");
    }
  } catch (error) {
    console.warn("Luna Noctweave local message state was preserved after a decrypt failure:", error);
    throw new Error("Encrypted signal history could not be opened. Existing data was preserved.", { cause: error });
  }

  const state = normalizeSignalState(payload);

  if (migratedLegacyState) {
    await saveSignalEnvelopeState(record, state);
  }

  return state;
}

function describeSignalError(error) {
  const name = String(error?.name || "").trim();
  const message = String(error?.message || "").trim();

  if (name && message && !message.toLowerCase().includes(name.toLowerCase())) {
    return `${name}: ${message}`;
  }

  return message || name || "Noctweave delivery failed.";
}

async function saveSignalEnvelopeState(record, state) {
  const normalizedState = normalizeSignalState(state);
  const storageKey = await deriveLunaMessageStorageKey(record, { version: 3 });
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = textEncoder.encode(JSON.stringify({
    version: 2,
    ...normalizedState,
  }));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    storageKey,
    payload,
  ));

  await writeMessageRecord({
    key: record.key,
    kdfVersion: 3,
    contactCodeDigest: base64FromBytes(await crypto.subtle.digest("SHA-256", textEncoder.encode(record.contactCode || ""))),
    contactFingerprint: record.signingFingerprint || "",
    ciphertext,
    iv,
    updatedAt: iso8601NoMilliseconds(),
  });
}

function emptySignalState() {
  return {
    messages: [],
    contacts: [],
    conversations: {},
    seenEnvelopeIds: [],
  };
}

function normalizeSignalState(payload = {}) {
  return {
    messages: normalizeSignalMessages(payload.messages || []),
    contacts: normalizeContacts(payload.contacts || []),
    conversations: isPlainObject(payload.conversations) ? payload.conversations : {},
    seenEnvelopeIds: Array.isArray(payload.seenEnvelopeIds)
      ? [...new Set(payload.seenEnvelopeIds.map((id) => String(id || "").toLowerCase()).filter(Boolean))]
      : [],
  };
}

function normalizeContacts(contacts = []) {
  const byFingerprint = new Map();

  (Array.isArray(contacts) ? contacts : []).forEach((contact) => {
    if (!contact?.fingerprint || !contact?.inboxId || !contact?.relay) {
      return;
    }
    byFingerprint.set(contact.fingerprint, {
      displayName: normalizeMessageField(contact.displayName || contact.fingerprint, 80),
      inboxId: String(contact.inboxId),
      relay: sanitizeRelayEndpoint(contact.relay),
      fingerprint: String(contact.fingerprint),
      signingPublicKey: String(contact.signingPublicKey || ""),
      agreementPublicKey: String(contact.agreementPublicKey || ""),
    });
  });

  return [...byFingerprint.values()];
}

function normalizeSignalMessages(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .map((entry) => ({
      id: normalizeMessageField(entry?.id || `sig-${Date.now()}-${Math.random().toString(16).slice(2)}`, 120),
      envelopeId: normalizeMessageField(entry?.envelopeId || entry?.id || "", 120),
      envelopeIds: (Array.isArray(entry?.envelopeIds) ? entry.envelopeIds : [])
        .map((value) => normalizeMessageField(value, 120))
        .filter(Boolean)
        .slice(0, 20),
      author: normalizeMessageField(entry?.author, 80),
      recipient: normalizeMessageField(entry?.recipient, 160),
      counterpartyHandle: normalizeMessageField(entry?.counterpartyHandle, 160),
      conversationHandle: normalizeMessageField(entry?.conversationHandle, 160),
      recipientFingerprint: normalizeMessageField(entry?.recipientFingerprint, 120),
      subject: normalizeMessageField(entry?.subject, 120),
      message: normalizeMessageField(entry?.message, 4000),
      timestamp: normalizeMessageField(entry?.timestamp || entry?.createdAt || iso8601NoMilliseconds(), 80),
      createdAt: normalizeMessageField(entry?.createdAt || entry?.timestamp || iso8601NoMilliseconds(), 80),
      unread: Boolean(entry?.unread),
      direction: normalizeMessageField(entry?.direction || "outbox", 24),
      deliveryState: normalizeMessageField(entry?.deliveryState || "", 40),
      deliveryError: normalizeDeliveryError(entry?.deliveryError),
      deliveredCount: Number.isFinite(Number(entry?.deliveredCount)) ? Number(entry.deliveredCount) : 0,
      deviceCount: Number.isFinite(Number(entry?.deviceCount)) ? Number(entry.deviceCount) : 0,
      contactFingerprint: normalizeMessageField(entry?.contactFingerprint || "", 120),
      conversationId: normalizeMessageField(entry?.conversationId || "", 160),
      conversationKey: normalizeMessageField(entry?.conversationKey || "", 160),
      attachment: normalizeSignalAttachment(entry?.attachment),
      attachmentRecovery: normalizeSignalAttachmentRecovery(entry?.attachmentRecovery),
    }))
    .filter((entry) => entry.author || entry.recipient || entry.message)
    .slice(0, SIGNAL_MESSAGE_LOG_LIMIT);
}

function normalizeSignalAttachment(value) {
  if (!isPlainObject(value) || !value.id) {
    return null;
  }
  const byteCount = Math.max(0, Math.min(MAX_SIGNAL_ATTACHMENT_BYTES, Number(value.byteCount || 0)));
  const chunkSize = Math.max(1, Math.min(128 * 1024, Number(value.chunkSize || SIGNAL_ATTACHMENT_CHUNK_BYTES)));
  const chunkCount = Math.max(1, Math.min(512, Number(value.chunkCount || Math.ceil(byteCount / chunkSize))));

  return {
    id: normalizeUUID(value.id),
    fileName: sanitizeSignalFileName(value.fileName),
    mimeType: normalizeMimeType(value.mimeType),
    byteCount,
    sha256: normalizeMessageField(value.sha256, 120),
    chunkCount,
    chunkSize,
  };
}

function normalizeSignalAttachmentRecovery(value) {
  if (!isPlainObject(value) || !value.messageKey || !value.conversationId || !value.sessionId) {
    return null;
  }
  const relay = sanitizeRelayEndpoint(value.relay || DEFAULT_RELAY_ENDPOINT);
  return {
    conversationId: normalizeMessageField(value.conversationId, 160),
    sessionId: normalizeMessageField(value.sessionId, 160),
    messageCounter: Math.max(0, Number(value.messageCounter || 0)),
    messageKey: normalizeMessageField(value.messageKey, 120),
    relay,
  };
}

function normalizeMessageField(value, limit) {
  return String(value || "").trim().slice(0, limit);
}

function normalizeDeliveryError(value = "") {
  const error = normalizeMessageField(value, 240);

  if (/^skipped current device prayer key\.?$/i.test(error)) {
    return "";
  }

  return error;
}

function normalizeAccountKey(value) {
  const key = String(value || "").trim().toLowerCase();

  if (!key) {
    throw new Error("Noctweave web core needs an account before generating a signal key.");
  }

  return key;
}

function normalizeDisplayName(value) {
  const displayName = String(value || "").trim();

  if (!displayName) {
    return "Luna";
  }

  return displayName.slice(0, 80);
}

function normalizeDesktopHandle(value) {
  const cleaned = String(value || "").trim().replace(/^@+/, "");
  return cleaned ? `@${cleaned}` : "";
}

function sanitizeRelayEndpoint(endpoint) {
  const clean = {
    host: String(endpoint?.host || "").trim(),
    port: Number(endpoint?.port || 0),
    useTLS: Boolean(endpoint?.useTLS),
    transport: String(endpoint?.transport || "http").trim() || "http",
  };

  assertBrowserRelayEndpoint(clean);
  return clean;
}

function assertBrowserRelayEndpoint(endpoint) {
  if (!endpoint.host) {
    throw new Error("Noctweave relay endpoint is missing a host.");
  }
  if (!Number.isInteger(endpoint.port) || endpoint.port < 1 || endpoint.port > 65535) {
    throw new Error("Noctweave relay endpoint has an invalid port.");
  }
  if (!["http", "websocket"].includes(endpoint.transport)) {
    throw new Error("Browser signal onboarding requires an HTTP or WebSocket relay endpoint.");
  }
}

function endpointsEqual(left, right) {
  return String(left?.host || "").toLowerCase() === String(right?.host || "").toLowerCase() &&
    Number(left?.port || 0) === Number(right?.port || 0) &&
    Boolean(left?.useTLS) === Boolean(right?.useTLS) &&
    String(left?.transport || "http") === String(right?.transport || "http");
}

function serializeKeypair(keypair) {
  return {
    publicKey: base64(keypair.publicKey),
    secretKey: base64(keypair.secretKey),
  };
}

function deserializeKeypair(keypair) {
  return {
    publicKey: fromBase64(keypair.publicKey),
    secretKey: fromBase64(keypair.secretKey),
  };
}

function normalizeUUID(value) {
  return String(value || "").trim().toUpperCase();
}

function withoutUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(withoutUndefined);
  }
  if (!isPlainObject(value)) {
    return value;
  }
  return Object.keys(value).reduce((result, key) => {
    if (value[key] !== undefined && value[key] !== null) {
      result[key] = withoutUndefined(value[key]);
    }
    return result;
  }, {});
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asBytes(value, label = "bytes") {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value)) {
    return new Uint8Array(value);
  }
  throw new TypeError(`Noctweave ${label} are missing or invalid.`);
}

function concatBytes(...parts) {
  const arrays = parts.map((part) => asBytes(part));
  const length = arrays.reduce((total, array) => total + array.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;

  arrays.forEach((array) => {
    result.set(array, offset);
    offset += array.length;
  });

  return result;
}

function fromBase64(value) {
  const binary = atob(String(value || ""));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function base64FromBytes(bytes) {
  return base64(asBytes(bytes));
}

function iso8601NoMilliseconds(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function bech32Encode(hrp, data) {
  const lowerHrp = String(hrp || "").toLowerCase();
  const data5 = convertBits(Array.from(data), 8, 5, true);
  const checksum = createBech32Checksum(lowerHrp, data5);
  const combined = data5.concat(checksum);
  return `${lowerHrp}1${combined.map((value) => BECH32_CHARSET[value]).join("")}`;
}

function createBech32Checksum(hrp, data) {
  const values = hrpExpand(hrp).concat(data, [0, 0, 0, 0, 0, 0]);
  const polymod = bech32Polymod(values) ^ 1;
  const checksum = [];

  for (let index = 0; index < 6; index += 1) {
    checksum.push((polymod >> (5 * (5 - index))) & 31);
  }

  return checksum;
}

function hrpExpand(hrp) {
  const bytes = Array.from(textEncoder.encode(hrp));
  return bytes.map((byte) => byte >> 5).concat([0], bytes.map((byte) => byte & 31));
}

function bech32Polymod(values) {
  let checksum = 1;

  for (const value of values) {
    const top = checksum >> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;

    for (let index = 0; index < 5; index += 1) {
      if (((top >> index) & 1) !== 0) {
        checksum ^= BECH32_GENERATOR[index];
      }
    }
  }

  return checksum;
}

function convertBits(data, fromBits, toBits, pad) {
  let accumulator = 0;
  let bits = 0;
  const result = [];
  const maxValue = (1 << toBits) - 1;
  const maxAccumulator = (1 << (fromBits + toBits - 1)) - 1;

  for (const value of data) {
    if (value < 0 || (value >> fromBits) !== 0) {
      throw new Error("Invalid Bech32 data.");
    }

    accumulator = ((accumulator << fromBits) | value) & maxAccumulator;
    bits += fromBits;

    while (bits >= toBits) {
      bits -= toBits;
      result.push((accumulator >> bits) & maxValue);
    }
  }

  if (pad) {
    if (bits > 0) {
      result.push((accumulator << (toBits - bits)) & maxValue);
    }
  } else if (bits >= fromBits || ((accumulator << (toBits - bits)) & maxValue) !== 0) {
    throw new Error("Invalid Bech32 padding.");
  }

  return result;
}
