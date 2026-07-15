// Modified by Luna for Claymatching: preserves the app-specific attachment and
// generalized-message exports while exposing the current upstream helpers.
export { normalizeRelayEndpoint, parseRelayEndpoint, relayEndpointURL } from "./endpoint.js";
export { relayRequests } from "./requests.js";
export {
  NoctweaveRelayClient,
  normalizeRelayClientPolicy,
  relayClientPolicyDefaults,
  relayClientPolicyLimits
} from "./relay-client.js";
export { NoctweaveWebClient } from "./client.js";
export {
  NoctweaveBrowserIdentityService,
  parseBrowserRelayEndpoint,
  validateBrowserDisplayName
} from "./browser-identity.js";
export {
  BrowserLocalStorageStore,
  DatabaseNoctweaveStore,
  EncryptedNoctweaveStore,
  IndexedDBNoctweaveStore,
  MemoryNoctweaveStore,
  NoctweaveStateRepository
} from "./storage.js";
export {
  decryptPortableProfile,
  encryptPortableProfile,
  portableProfileLimits
} from "./profile-vault.js";
export { bytes, WebCryptoPrimitives } from "./crypto/webcrypto.js";
export { NoctweaveOQSWasmAdapter, OQSWasmError } from "./crypto/oqs-wasm-adapter.js";
export { NoctweaveCryptoSuite } from "./crypto/noctweave-crypto-suite.js";
export { base64, canonicalJson, canonicalJsonBytes, swiftISODate, swiftUUID } from "./crypto/swift-canonical.js";
export { envelopeSignableBytes, envelopeSignablePayload } from "./crypto/noctweave-wire.js";
export {
  attachmentAuthenticatedData,
  decryptNativeAttachmentChunk,
  encryptNativeAttachmentChunks
} from "./crypto/noctweave-native-attachment.js";
export {
  createNativeInboundSession,
  createNativeOutboundSession,
  decodeNativeContactCode,
  decryptNativeEnvelope,
  decryptNativeMessageEnvelope,
  encodeNativeContactCode,
  encryptNativeMessageEnvelope,
  encryptNativeTextEnvelope,
  makeNativeContactOffer,
  nativeConversationKey,
  prepareNativeMessageKey,
  verifyNativeContactOffer
} from "./crypto/noctweave-native-message.js";
