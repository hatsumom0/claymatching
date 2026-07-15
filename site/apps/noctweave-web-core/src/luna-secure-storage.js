const IDENTITY_ENVELOPE_VERSION = 1;
const IDENTITY_AAD_PREFIX = "luna-noctweave-web-identity:v1:";
const MESSAGE_KDF_V2 = "luna-noctweave-web-message-state:v2";
const MESSAGE_KDF_V3 = "luna-noctweave-web-message-state:v3";
const MAX_IDENTITY_BYTES = 2 * 1024 * 1024;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export async function generateLunaIdentityVaultKey(cryptoProvider = globalThis.crypto) {
  requireWebCrypto(cryptoProvider);
  return cryptoProvider.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptLunaIdentityRecord(record, cryptoKey, cryptoProvider = globalThis.crypto) {
  requireWebCrypto(cryptoProvider);
  const plaintext = textEncoder.encode(JSON.stringify(record));

  if (plaintext.byteLength > MAX_IDENTITY_BYTES) {
    plaintext.fill(0);
    throw new Error("Noctweave identity record exceeds its encrypted storage limit.");
  }

  const iv = cryptoProvider.getRandomValues(new Uint8Array(12));

  try {
    const ciphertext = new Uint8Array(await cryptoProvider.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: identityAAD(record.key),
      },
      cryptoKey,
      plaintext,
    ));

    return {
      version: IDENTITY_ENVELOPE_VERSION,
      algorithm: "AES-256-GCM",
      iv,
      ciphertext,
    };
  } finally {
    plaintext.fill(0);
  }
}

export async function decryptLunaIdentityRecord(key, envelope, cryptoKey, cryptoProvider = globalThis.crypto) {
  requireWebCrypto(cryptoProvider);

  if (envelope?.version !== IDENTITY_ENVELOPE_VERSION || envelope?.algorithm !== "AES-256-GCM") {
    throw new Error("Unsupported Noctweave identity vault record.");
  }

  const iv = asBytes(envelope.iv, "identity vault IV");
  const ciphertext = asBytes(envelope.ciphertext, "identity vault ciphertext");

  if (iv.byteLength !== 12 || ciphertext.byteLength < 16 || ciphertext.byteLength > MAX_IDENTITY_BYTES + 16) {
    throw new Error("Noctweave identity vault record is malformed.");
  }

  const plaintext = new Uint8Array(await cryptoProvider.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: identityAAD(key),
    },
    cryptoKey,
    ciphertext,
  ));

  try {
    const record = JSON.parse(textDecoder.decode(plaintext));

    if (record?.key !== key) {
      throw new Error("Noctweave identity vault key mismatch.");
    }

    return record;
  } finally {
    plaintext.fill(0);
  }
}

export function lunaIdentityKeyMaterialMatches(left, right) {
  return Boolean(
    left?.key && left.key === right?.key &&
    left?.inboxId === right?.inboxId &&
    left?.signing?.publicKey === right?.signing?.publicKey &&
    left?.signing?.secretKey === right?.signing?.secretKey &&
    left?.agreement?.publicKey === right?.agreement?.publicKey &&
    left?.agreement?.secretKey === right?.agreement?.secretKey &&
    left?.access?.publicKey === right?.access?.publicKey &&
    left?.access?.secretKey === right?.access?.secretKey
  );
}

export function lunaIdentityMigrationMarker(key, migratedAt = new Date().toISOString()) {
  if (typeof key !== "string" || !key) {
    throw new Error("Noctweave identity migration marker requires an account key.");
  }
  return {
    key,
    encryptedIdentityVersion: IDENTITY_ENVELOPE_VERSION,
    migratedAt,
  };
}

export async function deriveLunaMessageStorageKey(
  record,
  { version = 3, contactCode = record?.contactCode || "", cryptoProvider = globalThis.crypto } = {},
) {
  requireWebCrypto(cryptoProvider);

  const parts = [
    textEncoder.encode(version === 2 ? MESSAGE_KDF_V2 : MESSAGE_KDF_V3),
    fromBase64(record?.signing?.secretKey),
    fromBase64(record?.agreement?.secretKey),
    fromBase64(record?.access?.secretKey),
  ];

  if (version === 2) {
    parts.push(textEncoder.encode(contactCode));
  }

  const material = concatBytes(...parts);

  try {
    const digest = await cryptoProvider.subtle.digest("SHA-256", material);
    return cryptoProvider.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  } finally {
    material.fill(0);
    parts.forEach((part) => part.fill(0));
  }
}

function identityAAD(key) {
  if (typeof key !== "string" || !key) {
    throw new Error("Noctweave identity vault requires an account key.");
  }
  return textEncoder.encode(`${IDENTITY_AAD_PREFIX}${key}`);
}

function concatBytes(...parts) {
  const length = parts.reduce((total, part) => total + part.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }

  return result;
}

function fromBase64(value) {
  const encoded = String(value || "");

  if (!encoded || encoded.length > 100_000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error("Noctweave identity key material is malformed.");
  }

  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function asBytes(value, label) {
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
  throw new TypeError(`Noctweave ${label} is missing or invalid.`);
}

function requireWebCrypto(cryptoProvider) {
  if (!cryptoProvider?.subtle || typeof cryptoProvider.getRandomValues !== "function") {
    throw new Error("WebCrypto is required for Noctweave encrypted storage.");
  }
}
