const NOCTWEAVE_INBOX_HRP = "noctweave";
const MAX_NOCTWEAVE_KEY_BYTES = 16_384;
const MAX_NOCTWEAVE_DATA_BYTES = 256 * 1024;
const BECH32_CHARSET = [..."qpzry9x8gf2tvdw0s3jn54khce6mua7l"];
const BECH32_GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

export async function deriveNoctweaveInboxId(accessPublicKey) {
  const keyBytes = decodeNoctweaveData(accessPublicKey);

  if (!keyBytes) {
    return null;
  }

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", keyBytes));
  return bech32Encode(NOCTWEAVE_INBOX_HRP, digest);
}

export function noctweaveDataEqual(left, right) {
  const leftBytes = decodeNoctweaveData(left);
  const rightBytes = decodeNoctweaveData(right);

  if (!leftBytes || !rightBytes || leftBytes.byteLength !== rightBytes.byteLength) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }

  return difference === 0;
}

export function decodeNoctweaveData(value, maximumBytes = MAX_NOCTWEAVE_KEY_BYTES) {
  if (typeof value !== "string") {
    return null;
  }

  const encoded = value.trim();

  if (!encoded || !Number.isSafeInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > MAX_NOCTWEAVE_DATA_BYTES ||
      encoded.length > Math.ceil(maximumBytes / 3) * 4 + 4) {
    return null;
  }

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 === 1) {
    return null;
  }

  try {
    const binary = atob(encoded);

    if (!binary.length || binary.length > maximumBytes) {
      return null;
    }

    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export async function noctweaveFingerprint(value) {
  const bytes = decodeNoctweaveData(value);

  if (!bytes) {
    return null;
  }

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return encodeNoctweaveData(digest);
}

function encodeNoctweaveData(bytes) {
  let binary = "";

  for (let offset = 0; offset < bytes.byteLength; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }

  return btoa(binary);
}

function bech32Encode(hrp, data) {
  const payload = convertBits(data, 8, 5, true);

  if (!payload) {
    return null;
  }

  const checksum = createBech32Checksum(hrp, payload);
  return `${hrp}1${[...payload, ...checksum].map((value) => BECH32_CHARSET[value]).join("")}`;
}

function createBech32Checksum(hrp, data) {
  const values = [...expandBech32Hrp(hrp), ...data, 0, 0, 0, 0, 0, 0];
  const polymod = bech32Polymod(values) ^ 1;
  const checksum = [];

  for (let index = 0; index < 6; index += 1) {
    checksum.push((polymod >>> (5 * (5 - index))) & 31);
  }

  return checksum;
}

function expandBech32Hrp(hrp) {
  const bytes = [...new TextEncoder().encode(hrp.toLowerCase())];
  return [...bytes.map((value) => value >>> 5), 0, ...bytes.map((value) => value & 31)];
}

function bech32Polymod(values) {
  let checksum = 1;

  for (const value of values) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;

    for (let index = 0; index < BECH32_GENERATOR.length; index += 1) {
      if (((top >>> index) & 1) !== 0) {
        checksum ^= BECH32_GENERATOR[index];
      }
    }

    checksum >>>= 0;
  }

  return checksum >>> 0;
}

function convertBits(data, fromBits, toBits, pad) {
  let accumulator = 0;
  let bitCount = 0;
  const maxValue = (1 << toBits) - 1;
  const output = [];

  for (const value of data) {
    if ((value >>> fromBits) !== 0) {
      return null;
    }

    accumulator = (accumulator << fromBits) | value;
    bitCount += fromBits;

    while (bitCount >= toBits) {
      bitCount -= toBits;
      output.push((accumulator >>> bitCount) & maxValue);
    }
  }

  if (pad && bitCount > 0) {
    output.push((accumulator << (toBits - bitCount)) & maxValue);
  } else if (!pad && (bitCount >= fromBits || ((accumulator << (toBits - bitCount)) & maxValue) !== 0)) {
    return null;
  }

  return output;
}
