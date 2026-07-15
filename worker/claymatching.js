import { kiosk } from "@mysten/kiosk";
import { bcs } from "@mysten/sui/bcs";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui/utils";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import {
  decodeNoctweaveData,
  deriveNoctweaveInboxId,
  noctweaveDataEqual,
  noctweaveFingerprint,
} from "./noctweave-relay-security.js";
import { canonicalNoctweaveJSON, verifyNoctweaveActorProof } from "./noctweave-actor-proof.js";

const DEFAULT_ALLOWED_ORIGINS = ["https://claymatching.luna21e8.xyz"];
const DEFAULT_CLAYMATCHING_HOSTS = ["claymatching.luna21e8.xyz"];
const CLAYMATCHING_MAX_COLLECTIONS = 8;
const CLAYMATCHING_MAX_ASSETS_PER_COLLECTION = 100;
const CLAYMATCHING_MAX_UPSTREAM_BYTES = 2 * 1024 * 1024;
const CLAYMATCHING_MAX_SESSION_BODY_BYTES = 16 * 1024;
const CLAYMATCHING_SESSION_COOKIE = "__Host-claymatching_session";
const CLAYMATCHING_SESSION_TTL_SECONDS = 24 * 60 * 60;
const CLAYMATCHING_SOLANA_CHALLENGE_TTL_SECONDS = 5 * 60;
const CLAYMATCHING_SOLANA_PREVIEW_CACHE_SECONDS = 60;
const CLAYMATCHING_TERMS_VERSION = "2026-07-13";
const CLAY_COLLECT_ORIGIN = "https://collect.claynosaurz.com";
const CLAY_COLLECT_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CLAY_COLLECT_IDENTITY_MAX_BYTES = 256 * 1024;
const CLAY_COLLECT_ACHIEVEMENTS_MAX_BYTES = 2 * 1024 * 1024;
const CLAY_COLLECT_UPSTREAM_TIMEOUT_MS = 15_000;
const CLAY_COLLECT_MAX_ROOTS = 750;
const CLAY_COLLECT_MAX_SNAPSHOT_ITEMS = 500;
const CLAY_COLLECT_ICON_HOSTS = new Set([
  "storage.claynosaurz.com",
  "claynosaurz-storage.fra1.cdn.digitaloceanspaces.com",
]);
const CLAYMATCHING_SUI_CHALLENGE_TTL_SECONDS = 5 * 60;
const CLAYMATCHING_SUI_GRAPHQL_URL = "https://graphql.mainnet.sui.io/graphql";
const CLAYMATCHING_POPKINS_TYPE = "0xb908f3c6fea6865d32e2048c520cdfe3b5c5bbcebb658117c41bad70f52b7ccc::popkins_nft::Popkins";
const CLAYMATCHING_POPKINS_STAKING_PACKAGE = "0x38f0bad7a60a8c4399a810430b7625b60c93983321b3cd8723f201cc559de5c1";
const CLAYMATCHING_POPKINS_STAKING_CONTRACT = "0x886740809127b2db98b7c5f45452def2fe8f0c3e0efd6fa91d30e3eb0afa5287";
const CLAYMATCHING_POPKINS_STAKING_CONTRACT_TYPE = `${CLAYMATCHING_POPKINS_STAKING_PACKAGE}::staking_contract::StakingContract`;
const CLAYMATCHING_POPKINS_STAKING_DATA_TYPE = `${CLAYMATCHING_POPKINS_STAKING_PACKAGE}::staking_data::StakingData`;
const CLAYMATCHING_MAX_SUI_KIOSKS = 50;
const CLAYMATCHING_MAX_POPKINS = 25000;
const CLAYMATCHING_MAX_STAKING_ACCOUNTS = 1_000_000;
const CLAYMATCHING_MAX_POPKIN_AVATARS = 200;
const DEFAULT_SUPABASE_URL = "https://jfpatuhroezchwjtsaga.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_DZP4Vq_sc2XsbKUdLlANqw_qehrgjj-";
const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Compatibility identifiers. Changing the class, namespace, or object name would orphan existing encrypted inboxes.
const NOCTWEAVE_CLAYMATCHING_RELAY_OBJECT_NAME = "claymatching-relay";
const NOCTWEAVE_RELAY_VERSION = "luna-cloudflare-relay-1.0";
const NOCTWEAVE_MAX_REQUEST_BYTES = 1_000_000;
const NOCTWEAVE_MAX_MESSAGES_PER_INBOX = 250;
const NOCTWEAVE_MAX_FETCH_COUNT = 100;
const NOCTWEAVE_DEFAULT_ANNOUNCEMENT_TTL_SECONDS = 24 * 60 * 60;
const NOCTWEAVE_DEFAULT_ATTACHMENT_TTL_SECONDS = 60 * 60;
const NOCTWEAVE_MAX_ATTACHMENT_TTL_SECONDS = 6 * 60 * 60;
const NOCTWEAVE_MAX_ATTACHMENT_CHUNKS = 512;
const NOCTWEAVE_MAX_ATTACHMENT_CHUNK_BYTES = 64 * 1024;
const NOCTWEAVE_ATTACHMENT_CHUNK_PREFIX = "noctweave:attachment-chunk:v2:";
const NOCTWEAVE_ATTACHMENT_EXPIRY_PREFIX = "noctweave:attachment-expiry:v1:";
const NOCTWEAVE_ATTACHMENT_BACKFILL_CURSOR_KEY = "noctweave:attachment-cleanup-cursor:v1";
const NOCTWEAVE_ATTACHMENT_BACKFILL_COMPLETE_KEY = "noctweave:attachment-cleanup-backfilled:v1";
const NOCTWEAVE_ATTACHMENT_CLEANUP_BATCH_SIZE = 256;
const NOCTWEAVE_ATTACHMENT_CLEANUP_RETRY_MS = 60 * 1000;
const NOCTWEAVE_FEDERATION_FORWARD_TIMEOUT_MS = 8_000;
const NOCTWEAVE_FEDERATION_MAX_RESPONSE_BYTES = 1_000_000;
const NOCTWEAVE_FEDERATION_MAX_NODES = 32;
const NOCTWEAVE_FEDERATION_DIRECTORY_TTL_SECONDS = 5 * 60;
const NOCTWEAVE_MAX_ACTOR_PROOF_NONCES = 20_000;
const NOCTWEAVE_STORAGE_KEYS = {
  actorProofNonces: "noctweave:actor-proof-nonces:v1",
  announcements: "noctweave:announcements:v1",
  attachments: "noctweave:attachments:v1",
  federationNodes: "noctweave:federation-nodes:v1",
  inboxes: "noctweave:inboxes:v1",
  messages: "noctweave:messages:v1",
  pairRequests: "noctweave:pair-requests:v1",
  prekeys: "noctweave:prekeys:v1",
};
const NO_STORE_ASSET_PATHS = new Set(["/", "/index.html", "/claymatching/index.html"]);
const NO_STORE_ASSET_PREFIXES = [];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (isClaymatchingHost(url.hostname, env) && (url.pathname === "/" || url.pathname === "/index.html")) {
      return handleClaymatchingHomeRequest(request, env);
    }

    const clayRoutes = new Map([
      ["/api/claymatching/session", handleClaymatchingSessionRequest],
      ["/api/claymatching/assets", handleClaymatchingAssetsRequest],
      ["/api/claymatching/solana/read-only", handleClaymatchingSolanaReadOnlyRequest],
      ["/api/claymatching/solana/challenge", handleClaymatchingSolanaChallengeRequest],
      ["/api/claymatching/solana/link", handleClaymatchingSolanaLinkRequest],
      ["/api/claymatching/collect/sync", handleClaymatchingCollectSyncRequest],
      ["/api/claymatching/sui", handleClaymatchingSuiConnectionRequest],
      ["/api/claymatching/sui/challenge", handleClaymatchingSuiChallengeRequest],
      ["/api/claymatching/sui/link", handleClaymatchingSuiLinkRequest],
      ["/api/claymatching/popkins/sync", handleClaymatchingPopkinsSyncRequest],
    ]);

    if (url.pathname === "/api/claymatching/solana/preview") {
      return handleClaymatchingSolanaPreviewRequest(request, env, ctx);
    }

    const clayHandler = clayRoutes.get(url.pathname);
    if (clayHandler) return clayHandler(request, env);

    if (isNoctweaveRelayPath(url.pathname)) {
      const relayProfile = getNoctweaveRelayProfile(url.hostname, env);
      if (!relayProfile) return new Response("Not found", { status: 404 });
      return handleNoctweaveRelayRequest(request, env, relayProfile);
    }

    if (env.ASSETS) return fetchStaticAsset(request, env);
    return new Response("Not found", { status: 404 });
  },
};

async function fetchStaticAsset(request, env) {
  const response = await env.ASSETS.fetch(request);
  return withMutableAssetCacheHeaders(request, response, env);
}

async function handleClaymatchingHomeRequest(request, env) {
  if (!env.ASSETS || !["GET", "HEAD"].includes(request.method)) {
    return new Response("Method not allowed", {
      status: env.ASSETS ? 405 : 404,
      headers: env.ASSETS ? { Allow: "GET, HEAD" } : undefined,
    });
  }

  const assetUrl = new URL(request.url);
  assetUrl.pathname = "/claymatching/";
  const assetRequest = new Request(assetUrl, request);
  return fetchStaticAsset(assetRequest, env);
}

async function handleClaymatchingSessionRequest(request, env) {
  const headers = getClaymatchingCorsHeaders(request, env);
  const url = new URL(request.url);

  if (!isClaymatchingHost(url.hostname, env)) {
    return json({ error: "Not found." }, 404, headers);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (!isSameOriginBrowserRequest(request)) {
    return json({ error: "Cross-site session requests are not allowed." }, 403, headers);
  }

  if (request.method === "GET") {
    const session = await readClaymatchingSession(request, env);
    if (!session) {
      return json({ authenticated: false }, 401, headers);
    }
    const config = getClaymatchingServerConfig(env);
    if (!config.backendConfigured) {
      return json({ error: "Claymatching access is not fully configured yet." }, 503, headers);
    }
    try {
      const accessState = await loadClaymatchingAccessState(config, session.sub);
      if (!accessState.canPost) {
        return json({
          authenticated: true,
          canDm: false,
          canPost: false,
          error: "Claymatching posting access has expired. Recheck an eligible public address or verify a wallet.",
          holder: false,
          provisional: true,
          userId: session.sub,
        }, 403, {
          ...headers,
          "Set-Cookie": clearClaymatchingSessionCookie(),
        });
      }

      let effectiveSession = session;
      let setCookie;
      if (session.v === 1 || !claymatchingSessionMatchesAccessState(session, accessState)) {
        const refreshed = await createClaymatchingAccessSession({
          accessState,
          csrfToken: session.csrf,
          userId: session.sub,
        }, config.sessionSecret);
        effectiveSession = refreshed.session;
        setCookie = claymatchingSessionCookie(refreshed.token);
      }
      return json(claymatchingAccessResponse(accessState, effectiveSession), 200, {
        ...headers,
        ...(setCookie ? { "Set-Cookie": setCookie } : {}),
      });
    } catch (error) {
      console.error(JSON.stringify({
        event: "clay_access_state_failed",
        message: error?.message || String(error),
      }));
      return json({ error: "Claymatching access could not be restored right now." }, 502, headers);
    }
  }

  if (request.method === "DELETE") {
    return json({ authenticated: false }, 200, {
      ...headers,
      "Set-Cookie": clearClaymatchingSessionCookie(),
    });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { ...headers, Allow: "GET, POST, DELETE, OPTIONS" });
  }

  const config = getClaymatchingServerConfig(env);
  if (!config.configured) {
    return json({ error: "Claymatching membership is not fully configured yet." }, 503, headers);
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return json({ error: "A signed Supabase session is required." }, 401, headers);
  }

  let body;
  try {
    body = await readJsonBody(
      request,
      CLAYMATCHING_MAX_SESSION_BODY_BYTES,
      "Claymatching session request is too large.",
    );
  } catch {
    return json({ error: "A valid Claymatching session request is required." }, 400, headers);
  }

  try {
    const user = await verifyClaymatchingSupabaseUser(accessToken, config);
    let accessState = await loadClaymatchingAccessState(config, user.id);
    if (accessState.accountState && accessState.accountState !== "active") {
      return json({
        error: "This Claymatching account is not active.",
        holder: false,
      }, 403, {
        ...headers,
        "Set-Cookie": clearClaymatchingSessionCookie(),
      });
    }

    const hasCurrentConsent = accessState.consentCurrent;
    const adultAttested = hasCurrentConsent || body?.adultAttested === true;
    const holderAttested = hasCurrentConsent || body?.holderAttested === true;
    const lawfulUseAttested = hasCurrentConsent || body?.lawfulUseAttested === true;

    let signedAssets = [];
    const walletAddress = extractClaymatchingSolanaAddress(user)
      || accessState.signedSolanaAddress;
    if (walletAddress) {
      if (!adultAttested || !holderAttested || !lawfulUseAttested) {
        return json({
          consentRequired: true,
          error: "You must attest that you are 18+, an eligible holder, and using the service lawfully.",
        }, 403, headers);
      }

      signedAssets = await loadClaymatchingAssets(walletAddress, env);
      if (signedAssets.length) {
        const ipAddress = String(request.headers.get("CF-Connecting-IP") || "").trim();
        const ipHash = ipAddress
          ? await hmacHex(config.sessionSecret, `claymatching-ip:${ipAddress}`)
          : null;
        await claymatchingSupabaseRpc(config, "confirm_clay_holder", {
          raw_adult_attested: adultAttested,
          raw_assets: signedAssets,
          raw_holder_attested: holderAttested,
          raw_ip_hash: ipHash,
          raw_lawful_use_attested: lawfulUseAttested,
          raw_terms_version: CLAYMATCHING_TERMS_VERSION,
          raw_user_agent: String(request.headers.get("User-Agent") || "").slice(0, 300),
          raw_user_id: user.id,
          raw_wallet_address: walletAddress,
        });
        accessState = await loadClaymatchingAccessState(config, user.id);
      } else if (!accessState.canPost) {
        return json({
          error: "No eligible Claynosaurz holder asset was found in this authenticated wallet.",
          holder: false,
        }, 403, headers);
      }
    }

    if (!accessState.canPost) {
      return json({
        authenticated: true,
        canDm: false,
        canPost: false,
        error: "Check an eligible public Solana address or verify a Solana wallet to unlock posting.",
        holder: false,
        provisional: true,
        userId: user.id,
        walletRequired: true,
      }, 403, {
        ...headers,
        "Set-Cookie": clearClaymatchingSessionCookie(),
      });
    }

    const assets = await loadClaymatchingAuthorizedAssets(accessState, env, config, signedAssets);
    const sessionResult = await createClaymatchingAccessSession({
      accessState,
      userId: user.id,
    }, config.sessionSecret);

    return json(claymatchingAccessResponse(accessState, sessionResult.session, { assets }), 200, {
      ...headers,
      "Set-Cookie": claymatchingSessionCookie(sessionResult.token),
    });
  } catch (error) {
    const status = Number(error?.status || 0);
    console.error(JSON.stringify({
      event: "claymatching_session_failed",
      message: error?.message || String(error),
      status: status || 500,
    }));
    return json({
      error: status === 401
        ? "Your wallet session expired. Please sign in again."
        : "Claymatching could not verify membership right now.",
    }, status === 401 ? 401 : status === 503 ? 503 : 502, headers);
  }
}

async function handleClaymatchingAssetsRequest(request, env) {
  const headers = getClaymatchingCorsHeaders(request, env);
  const url = new URL(request.url);

  if (!isClaymatchingHost(url.hostname, env)) {
    return json({ error: "Not found." }, 404, headers);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "GET") {
    return json({ error: "Method not allowed." }, 405, { ...headers, Allow: "GET, OPTIONS" });
  }
  if (!isSameOriginBrowserRequest(request)) {
    return json({ error: "Cross-site asset requests are not allowed." }, 403, headers);
  }

  const session = await readClaymatchingSession(request, env);
  if (!session) {
    return json({ error: "An active Claymatching session is required." }, 401, headers);
  }

  try {
    const config = getClaymatchingServerConfig(env);
    if (!config.backendConfigured) {
      return json({ error: "Claymatching asset access is not fully configured yet." }, 503, headers);
    }
    const accessState = await loadClaymatchingAccessState(config, session.sub);
    if (!accessState.canPost) {
      return json({ error: "Posting access has expired. Recheck an eligible address or verify a wallet." }, 403, {
        ...headers,
        "Set-Cookie": clearClaymatchingSessionCookie(),
      });
    }
    const assets = await loadClaymatchingAuthorizedAssets(accessState, env, config);
    return json({
      assets,
      canDm: accessState.canDm,
      canPost: accessState.canPost,
      membershipMode: accessState.membershipMode,
      owner: accessState.signedSolanaActive ? accessState.signedSolanaAddress : null,
      readOnlySolanaAddress: accessState.readOnlySolanaAddress,
      readOnlyWalletAddress: accessState.readOnlySolanaAddress,
      signedSolanaAddress: accessState.signedSolanaAddress,
      verified: accessState.signedSolanaActive,
    }, 200, headers);
  } catch (error) {
    console.error(JSON.stringify({
      event: "claymatching_asset_lookup_failed",
      message: error?.message || String(error),
    }));
    return json({ error: "Verified collectibles could not be loaded right now." }, Number(error?.status || 502), headers);
  }
}

async function handleClaymatchingSolanaPreviewRequest(request, env, ctx) {
  const headers = getClaymatchingCorsHeaders(request, env);
  const url = new URL(request.url);

  if (!isClaymatchingHost(url.hostname, env)) {
    return json({ error: "Not found." }, 404, headers);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { ...headers, Allow: "POST, OPTIONS" });
  }
  if (!request.headers.get("Origin") || !isSameOriginBrowserRequest(request)) {
    return json({ error: "Solana previews must be started from Claymatching." }, 403, headers);
  }

  const config = getClaymatchingServerConfig(env);
  if (!config.configured) {
    return json({ error: "Solana collection previews are not fully configured yet." }, 503, headers);
  }
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return json({ error: "Sign in before previewing a public wallet." }, 401, headers);
  }

  let body;
  try {
    body = await readJsonBody(request, CLAYMATCHING_MAX_SESSION_BODY_BYTES, "Solana preview request is too large.");
  } catch {
    return json({ error: "A valid public Solana address is required." }, 400, headers);
  }
  const address = normalizeSolanaPublicKey(body?.address);
  if (!address) {
    return json({ error: "Paste a valid public Solana address." }, 400, headers);
  }

  try {
    const user = await verifyClaymatchingSupabaseUser(accessToken, config);
    const claimRows = await claymatchingSupabaseRpc(config, "claim_clay_solana_preview", {
      raw_user_id: user.id,
    });
    const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
    if (!claim?.allowed) {
      const retryAfter = Math.max(1, Math.min(30, Number(claim?.retry_after_seconds || 5)));
      return json({
        error: `Wait ${retryAfter} second${retryAfter === 1 ? "" : "s"} before checking another address.`,
        retryAfter,
      }, 429, { ...headers, "Retry-After": String(retryAfter) });
    }

    const assets = await loadCachedClaymatchingPreviewAssets(address, env, ctx);
    return json({
      address,
      assets,
      checkedAt: new Date().toISOString(),
      source: "public-chain-preview",
      verified: false,
    }, 200, headers);
  } catch (error) {
    const status = Number(error?.status || 0);
    console.error(JSON.stringify({
      event: "clay_solana_preview_failed",
      message: error?.message || String(error),
      status: status || 500,
    }));
    return json({
      error: status === 401
        ? "Your sign-in expired. Sign in again before previewing a wallet."
        : "That public wallet could not be checked right now.",
    }, status === 401 ? 401 : status === 503 ? 503 : 502, headers);
  }
}

async function handleClaymatchingSolanaReadOnlyRequest(request, env) {
  const headers = getClaymatchingCorsHeaders(request, env);
  const url = new URL(request.url);

  if (!isClaymatchingHost(url.hostname, env)) {
    return json({ error: "Not found." }, 404, headers);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (!request.headers.get("Origin") || !isSameOriginBrowserRequest(request)) {
    return json({ error: "Read-only Solana access must be changed from Claymatching." }, 403, headers);
  }

  const config = getClaymatchingServerConfig(env);
  if (!config.backendConfigured) {
    return json({ error: "Read-only Solana access is not fully configured yet." }, 503, headers);
  }

  if (request.method === "DELETE") {
    const session = await readClaymatchingSession(request, env);
    if (!session) {
      return json({ error: "Sign in before removing read-only access." }, 401, headers);
    }
    if (!claymatchingCsrfMatches(request, session)) {
      return json({ error: "Refresh Claymatching before removing read-only access." }, 403, headers);
    }
    try {
      await claymatchingSupabaseRpc(config, "unlink_clay_read_only_access", {
        raw_user_id: session.sub,
      });
      const accessState = await loadClaymatchingAccessState(config, session.sub);
      if (!accessState.canPost) {
        return json({
          authenticated: true,
          canDm: false,
          canPost: false,
          holder: false,
          membershipMode: accessState.membershipMode,
          readOnly: false,
          userId: session.sub,
        }, 200, {
          ...headers,
          "Set-Cookie": clearClaymatchingSessionCookie(),
        });
      }
      const refreshed = await createClaymatchingAccessSession({
        accessState,
        csrfToken: session.csrf,
        userId: session.sub,
      }, config.sessionSecret);
      return json({
        ...claymatchingAccessResponse(accessState, refreshed.session),
        readOnly: false,
      }, 200, {
        ...headers,
        "Set-Cookie": claymatchingSessionCookie(refreshed.token),
      });
    } catch (error) {
      console.error(JSON.stringify({
        event: "clay_read_only_unlink_failed",
        message: error?.message || String(error),
      }));
      return json({ error: "Read-only Solana access could not be removed right now." }, 502, headers);
    }
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { ...headers, Allow: "POST, DELETE, OPTIONS" });
  }
  if (!config.configured) {
    return json({ error: "Solana eligibility checks are not fully configured yet." }, 503, headers);
  }
  if (!String(env.CLAYMATCHING_TURNSTILE_SECRET_KEY || "").trim()) {
    return json({ error: "The anti-bot verification is not configured yet." }, 503, headers);
  }
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return json({ error: "Sign in before checking a public Solana address." }, 401, headers);
  }

  let body;
  try {
    body = await readJsonBody(request, CLAYMATCHING_MAX_SESSION_BODY_BYTES, "Read-only Solana request is too large.");
  } catch {
    return json({ error: "A valid public Solana address is required." }, 400, headers);
  }
  const address = normalizeSolanaPublicKey(body?.address);
  if (!address) {
    return json({ error: "Paste a valid public Solana address." }, 400, headers);
  }
  if (body?.adultAttested !== true || body?.holderAttested !== true || body?.lawfulUseAttested !== true) {
    return json({
      consentRequired: true,
      error: "You must attest that you are 18+, using an eligible holder address, and using the service lawfully.",
    }, 403, headers);
  }

  try {
    const user = await verifyClaymatchingSupabaseUser(accessToken, config);
    const turnstile = await verifyClaymatchingTurnstile(body?.captchaToken, request, env);
    if (!turnstile.ok) {
      return json({ error: turnstile.error }, turnstile.status, headers);
    }

    const assets = await loadClaymatchingAssets(address, env);
    if (!assets.length) {
      return json({
        eligibleAssetCount: 0,
        error: "No eligible Claynosaurz asset was found at that public address.",
        holder: false,
        verified: false,
      }, 403, headers);
    }

    const ipAddress = String(request.headers.get("CF-Connecting-IP") || "").trim();
    const ipHash = ipAddress
      ? await hmacHex(config.sessionSecret, `claymatching-ip:${ipAddress}`)
      : null;
    const eligibleAssetCount = Math.min(assets.length, 200);
    const confirmedRows = await claymatchingSupabaseRpc(config, "confirm_clay_read_only_access", {
      raw_adult_attested: true,
      raw_asset_count: eligibleAssetCount,
      raw_holder_attested: true,
      raw_ip_hash: ipHash,
      raw_lawful_use_attested: true,
      raw_terms_version: CLAYMATCHING_TERMS_VERSION,
      raw_user_agent: String(request.headers.get("User-Agent") || "").slice(0, 300),
      raw_user_id: user.id,
      raw_wallet_address: address,
    });
    const confirmed = Array.isArray(confirmedRows) ? confirmedRows[0] : confirmedRows;
    const accessState = await loadClaymatchingAccessState(config, user.id);
    if (confirmed?.user_id !== user.id || !accessState.canPost) {
      throw new Error("Read-only activation did not return posting access.");
    }

    const authorizedAssets = await loadClaymatchingAuthorizedAssets(accessState, env, config);
    const sessionResult = await createClaymatchingAccessSession({
      accessState,
      userId: user.id,
    }, config.sessionSecret);
    return json({
      ...claymatchingAccessResponse(accessState, sessionResult.session, { assets: authorizedAssets }),
      eligibleAssetCount,
      readOnly: accessState.membershipMode === "read_only_solana",
      verified: false,
    }, 200, {
      ...headers,
      "Set-Cookie": claymatchingSessionCookie(sessionResult.token),
    });
  } catch (error) {
    const status = Number(error?.status || 0);
    console.error(JSON.stringify({
      event: "clay_read_only_activation_failed",
      message: error?.message || String(error),
      status: status || 500,
    }));
    return json({
      error: status === 401
        ? "Your sign-in expired. Sign in and check the public address again."
        : "Read-only posting access could not be activated right now.",
    }, status === 401 ? 401 : status === 503 ? 503 : 502, headers);
  }
}

async function handleClaymatchingSolanaChallengeRequest(request, env) {
  const headers = getClaymatchingCorsHeaders(request, env);
  const url = new URL(request.url);

  if (!isClaymatchingHost(url.hostname, env)) {
    return json({ error: "Not found." }, 404, headers);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { ...headers, Allow: "POST, OPTIONS" });
  }
  if (!request.headers.get("Origin") || !isSameOriginBrowserRequest(request)) {
    return json({ error: "Solana verification must be started from Claymatching." }, 403, headers);
  }

  const config = getClaymatchingServerConfig(env);
  if (!config.configured) {
    return json({ error: "Solana wallet verification is not fully configured yet." }, 503, headers);
  }
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return json({ error: "Sign in before verifying a Solana wallet." }, 401, headers);
  }

  let body;
  try {
    body = await readJsonBody(request, CLAYMATCHING_MAX_SESSION_BODY_BYTES, "Solana link request is too large.");
  } catch {
    return json({ error: "A valid Solana wallet address is required." }, 400, headers);
  }
  const address = normalizeSolanaPublicKey(body?.address);
  if (!address) {
    return json({ error: "Connect a valid Solana wallet first." }, 400, headers);
  }

  try {
    const user = await verifyClaymatchingSupabaseUser(accessToken, config);
    const challengeId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      address,
      challengeId,
      exp: now + CLAYMATCHING_SOLANA_CHALLENGE_TTL_SECONDS,
      iat: now,
      kind: "clay-solana-link",
      origin: url.origin,
      sub: user.id,
      v: 1,
    };
    const result = await claymatchingSupabaseRpc(config, "begin_clay_solana_link", {
      raw_challenge_id: challengeId,
      raw_expires_at: new Date(payload.exp * 1000).toISOString(),
      raw_user_id: user.id,
      raw_wallet_address: address,
    });
    const claim = Array.isArray(result) ? result[0] : result;
    if (!claim?.allowed) {
      const reason = String(claim?.reason || "unavailable");
      if (reason === "rate_limited") {
        return json({
          error: "Wait a moment before requesting another wallet signature.",
          retryAfter: 3,
        }, 429, { ...headers, "Retry-After": "3" });
      }
      return json({
        error: reason === "wallet_in_use"
          ? "That Solana wallet is already linked to another account."
          : "That Solana wallet verification could not start.",
      }, reason === "invalid_expiry" ? 400 : 409, headers);
    }
    const challengeToken = await signClaymatchingSession(payload, config.sessionSecret);
    return json({
      address,
      challengeToken,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      message: formatClaymatchingSolanaLinkMessage(payload),
    }, 200, headers);
  } catch (error) {
    const status = Number(error?.status || 0);
    console.error(JSON.stringify({
      event: "clay_solana_challenge_failed",
      message: error?.message || String(error),
      status: status || 500,
    }));
    return json({
      error: status === 401
        ? "Your sign-in expired. Sign in and connect the wallet again."
        : "The Solana wallet verification could not start right now.",
    }, status === 401 ? 401 : status === 503 ? 503 : 502, headers);
  }
}

async function handleClaymatchingSolanaLinkRequest(request, env) {
  const headers = getClaymatchingCorsHeaders(request, env);
  const url = new URL(request.url);

  if (!isClaymatchingHost(url.hostname, env)) {
    return json({ error: "Not found." }, 404, headers);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { ...headers, Allow: "POST, OPTIONS" });
  }
  if (!request.headers.get("Origin") || !isSameOriginBrowserRequest(request)) {
    return json({ error: "Solana verification must be completed from Claymatching." }, 403, headers);
  }

  const config = getClaymatchingServerConfig(env);
  if (!config.configured) {
    return json({ error: "Solana wallet verification is not fully configured yet." }, 503, headers);
  }
  if (!String(env.CLAYMATCHING_TURNSTILE_SECRET_KEY || "").trim()) {
    return json({ error: "The anti-bot verification is not configured yet." }, 503, headers);
  }
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return json({ error: "Sign in before verifying a Solana wallet." }, 401, headers);
  }

  let body;
  try {
    body = await readJsonBody(request, CLAYMATCHING_MAX_SESSION_BODY_BYTES, "Solana wallet proof is too large.");
  } catch {
    return json({ error: "A valid Solana wallet proof is required." }, 400, headers);
  }
  if (body?.adultAttested !== true || body?.holderAttested !== true || body?.lawfulUseAttested !== true) {
    return json({
      consentRequired: true,
      error: "You must attest that you are 18+, an eligible holder, and using the service lawfully.",
    }, 403, headers);
  }

  try {
    const user = await verifyClaymatchingSupabaseUser(accessToken, config);
    const payload = await readClaymatchingSignedPayload(body?.challengeToken, config.sessionSecret);
    const address = normalizeSolanaPublicKey(payload?.address);
    const challengeId = String(payload?.challengeId || "").toLowerCase();
    const signature = decodeClaymatchingSolanaSignature(body?.signature);
    const now = Math.floor(Date.now() / 1000);
    const validChallenge = Boolean(
      payload?.v === 1
        && payload?.kind === "clay-solana-link"
        && payload?.sub === user.id
        && payload?.origin === url.origin
        && Number.isInteger(payload?.iat)
        && Number.isInteger(payload?.exp)
        && payload.iat <= now + 60
        && payload.exp > now
        && payload.exp - payload.iat <= CLAYMATCHING_SOLANA_CHALLENGE_TTL_SECONDS
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(challengeId)
        && address
        && signature?.length === 64,
    );
    if (!validChallenge) {
      return json({ error: "That Solana wallet request expired. Connect and try again." }, 400, headers);
    }

    const message = new TextEncoder().encode(formatClaymatchingSolanaLinkMessage(payload));
    if (!await verifyClaymatchingSolanaSignature(address, signature, message)) {
      return json({ error: "The Solana wallet signature did not match the connected address." }, 401, headers);
    }

    const turnstile = await verifyClaymatchingTurnstile(body?.captchaToken, request, env);
    if (!turnstile.ok) {
      return json({ error: turnstile.error }, turnstile.status, headers);
    }

    const assets = await loadClaymatchingAssets(address, env);
    if (!assets.length) {
      return json({
        error: "No eligible Claynosaurz holder asset was found in this verified wallet.",
        holder: false,
      }, 403, headers);
    }

    const ipAddress = String(request.headers.get("CF-Connecting-IP") || "").trim();
    const ipHash = ipAddress
      ? await hmacHex(config.sessionSecret, `claymatching-ip:${ipAddress}`)
      : null;
    const confirmed = await claymatchingSupabaseRpc(config, "confirm_clay_holder_with_solana_challenge", {
      raw_adult_attested: true,
      raw_assets: assets,
      raw_challenge_id: challengeId,
      raw_holder_attested: true,
      raw_ip_hash: ipHash,
      raw_lawful_use_attested: true,
      raw_terms_version: CLAYMATCHING_TERMS_VERSION,
      raw_user_agent: String(request.headers.get("User-Agent") || "").slice(0, 300),
      raw_user_id: user.id,
      raw_wallet_address: address,
    });
    const membership = Array.isArray(confirmed) ? confirmed[0] : confirmed;
    const holderVerifiedUntil = String(membership?.holder_verified_until || "");
    const holderVerifiedUntilMs = Date.parse(holderVerifiedUntil);
    if (membership?.user_id !== user.id
      || !Number.isFinite(holderVerifiedUntilMs)
      || holderVerifiedUntilMs <= Date.now()) {
      throw new Error("Solana challenge confirmation did not return a valid holder membership.");
    }
    const accessState = await loadClaymatchingAccessState(config, user.id);
    if (!accessState.canPost || accessState.signedSolanaAddress !== address) {
      throw new Error("Signed Solana confirmation did not become authoritative posting access.");
    }
    const authorizedAssets = await loadClaymatchingAuthorizedAssets(accessState, env, config, assets);
    const sessionResult = await createClaymatchingAccessSession({
      accessState,
      userId: user.id,
    }, config.sessionSecret);

    return json(claymatchingAccessResponse(accessState, sessionResult.session, { assets: authorizedAssets }), 200, {
      ...headers,
      "Set-Cookie": claymatchingSessionCookie(sessionResult.token),
    });
  } catch (error) {
    const status = Number(error?.status || 0);
    console.error(JSON.stringify({
      event: "clay_solana_link_failed",
      message: error?.message || String(error),
      status: status || 500,
    }));
    return json({
      error: status === 401
        ? "Your sign-in expired. Sign in and connect the wallet again."
        : "The signed Solana wallet could not be linked. It may already belong to another account.",
    }, status === 401 ? 401 : status === 503 ? 503 : status === 429 ? 429 : 409, headers);
  }
}

async function handleClaymatchingCollectSyncRequest(request, env) {
  const headers = getClaymatchingCorsHeaders(request, env);
  const url = new URL(request.url);

  if (!isClaymatchingHost(url.hostname, env)) {
    return json({ error: "Not found." }, 404, headers);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { ...headers, Allow: "POST, OPTIONS" });
  }
  if (!request.headers.get("Origin") || !isSameOriginBrowserRequest(request)) {
    return json({ error: "Collect sync must be started from the Claymatching site." }, 403, headers);
  }

  const session = await readClaymatchingSession(request, env);
  if (!session) {
    return json({ error: "An active Claymatching session is required." }, 401, headers);
  }
  const csrfToken = String(request.headers.get("X-Clay-CSRF") || "");
  if (!csrfToken || csrfToken !== session.csrf) {
    return json({ error: "Refresh Claymatching before syncing achievements." }, 403, headers);
  }

  const config = getClaymatchingServerConfig(env);
  if (!config.backendConfigured) {
    return json({ error: "Collect sync is not fully configured yet." }, 503, headers);
  }

  let accessState;
  try {
    accessState = await loadClaymatchingAccessState(config, session.sub);
  } catch (error) {
    console.error(JSON.stringify({
      event: "clay_collect_access_state_failed",
      message: error?.message || String(error),
    }));
    return json({ error: "Signed Solana access could not be checked right now." }, 502, headers);
  }
  if (!accessState.canPost
    || !accessState.signedSolanaActive
    || !session.wallet
    || session.wallet !== accessState.signedSolanaAddress) {
    return json({ error: "A currently verified, signed Solana wallet is required for Collect SYNC." }, 403, headers);
  }
  const signedSolanaAddress = accessState.signedSolanaAddress;

  const syncToken = crypto.randomUUID();
  let context;
  try {
    const result = await claymatchingSupabaseRpc(config, "begin_clay_collect_sync", {
      raw_sync_token: syncToken,
      raw_user_id: session.sub,
    });
    context = Array.isArray(result) ? result[0] : result;
  } catch (error) {
    console.error(JSON.stringify({
      event: "clay_collect_sync_claim_failed",
      message: error?.message || String(error),
    }));
    return json({ error: "The achievement sync could not start right now." }, 502, headers);
  }

  if (!context?.allowed) {
    const reason = String(context?.reason || "sync_unavailable");
    if (reason === "cooldown") {
      const retryAfter = Math.max(1, Math.min(300, Number(context?.retry_after_seconds || 1)));
      return json({
        error: `SYNC was just used. Try again in ${retryAfter} second${retryAfter === 1 ? "" : "s"}.`,
        retryAfter,
      }, 429, { ...headers, "Retry-After": String(retryAfter) });
    }
    if (reason === "collect_not_linked") {
      return json({ error: "Link a Collect profile first, then press SYNC." }, 409, headers);
    }
    if (reason === "profile_incomplete") {
      return json({ error: "Finish your Claymatching profile before syncing achievements." }, 409, headers);
    }
    if (reason === "account_inactive" || reason === "holder_inactive") {
      return json({ error: "Active holder verification is required before syncing achievements." }, 403, headers);
    }
    return json({ error: "The linked Collect profile is not ready to sync." }, 409, headers);
  }

  const collectProfileId = String(context.collect_profile_id || "").toLowerCase();
  const databaseWallet = normalizeSolanaAddress(context.wallet_address);
  if (!CLAY_COLLECT_UUID_PATTERN.test(collectProfileId) || !databaseWallet || databaseWallet !== signedSolanaAddress) {
    await finishClayCollectSync(config, {
      errorCode: "session_wallet_changed",
      succeeded: false,
      syncToken,
      userId: session.sub,
    }).catch(() => {});
    return json({ error: "Your holder wallet changed. Sign in again before syncing." }, 401, headers);
  }

  try {
    const identityPayload = await fetchClayCollectJson(
      `/achievements-api/users/${collectProfileId}`,
      CLAY_COLLECT_IDENTITY_MAX_BYTES,
    );
    const collectIdentity = verifyClayCollectIdentity(identityPayload, collectProfileId, signedSolanaAddress);
    const achievementsPayload = await fetchClayCollectJson(
      `/achievements-api/users/${collectProfileId}/achievements`,
      CLAY_COLLECT_ACHIEVEMENTS_MAX_BYTES,
    );
    const achievements = normalizeClayCollectAchievements(achievementsPayload);
    const commitAccessState = await loadClaymatchingAccessState(config, session.sub);
    if (!commitAccessState.canPost
      || !commitAccessState.signedSolanaActive
      || commitAccessState.signedSolanaAddress !== signedSolanaAddress) {
      await finishClayCollectSync(config, {
        errorCode: "membership_changed",
        succeeded: false,
        syncToken,
        userId: session.sub,
      }).catch(() => {});
      return json({ error: "Signed Solana access changed during SYNC. Verify the wallet and try again." }, 403, headers);
    }
    const finishResult = await finishClayCollectSync(config, {
      achievements,
      sourceUsername: collectIdentity.username,
      succeeded: true,
      syncToken,
      userId: session.sub,
    });
    const committed = Array.isArray(finishResult) ? finishResult[0] : finishResult;
    if (!committed?.committed) {
      if (committed?.sync_status === "membership_changed") {
        throw clayCollectError("Holder access changed while the sync was running.", "membership_changed", 403);
      }
      throw clayCollectError("The sync result was superseded.", "sync_superseded", 409);
    }

    return json({
      achievementCount: Number(committed.saved_count || achievements.length),
      collectUsername: collectIdentity.username || null,
      source: "collect.claynosaurz.com",
      syncedAt: committed.synced_at,
      userTriggered: true,
      walletMatched: true,
    }, 200, headers);
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    const errorCode = timeout ? "upstream_timeout" : String(error?.collectCode || "upstream_failed").slice(0, 64);
    await finishClayCollectSync(config, {
      errorCode,
      succeeded: false,
      syncToken,
      userId: session.sub,
    }).catch((finishError) => {
      console.error(JSON.stringify({
        event: "clay_collect_sync_failure_record_failed",
        message: finishError?.message || String(finishError),
      }));
    });
    console.error(JSON.stringify({
      event: "clay_collect_sync_failed",
      code: errorCode,
      message: error?.message || String(error),
    }));

    if (errorCode === "wallet_mismatch") {
      return json({
        error: "That Collect profile does not list this signed Solana wallet. Check the link or add the wallet in Collect, then SYNC again.",
      }, 409, headers);
    }
    if (errorCode === "profile_mismatch") {
      return json({ error: "Collect returned a different profile than the linked ID. Nothing was imported." }, 502, headers);
    }
    if (errorCode === "sync_superseded") {
      return json({ error: "The linked Collect profile changed during SYNC. Press SYNC again." }, 409, headers);
    }
    if (errorCode === "membership_changed") {
      return json({ error: "Active holder verification is required before achievements can be saved." }, 403, headers);
    }
    if (timeout) {
      return json({ error: "Collect took too long to answer. Nothing changed; try SYNC again shortly." }, 504, headers);
    }
    return json({ error: "Collect could not return a safe achievement snapshot. Nothing changed; try again shortly." }, 502, headers);
  }
}

async function handleClaymatchingSuiConnectionRequest(request, env) {
  const headers = getClaymatchingCorsHeaders(request, env);
  const url = new URL(request.url);

  if (!isClaymatchingHost(url.hostname, env)) {
    return json({ error: "Not found." }, 404, headers);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (!isSameOriginBrowserRequest(request) || (request.method !== "GET" && !request.headers.get("Origin"))) {
    return json({ error: "Sui wallet links can only be viewed or changed from Claymatching." }, 403, headers);
  }

  const session = await readClaymatchingSession(request, env);
  if (!session) {
    return json({ error: "An active Claymatching session is required." }, 401, headers);
  }
  const config = getClaymatchingServerConfig(env);
  if (!config.backendConfigured) {
    return json({ error: "Sui wallet links are not fully configured yet." }, 503, headers);
  }

  let accessState;
  try {
    accessState = await loadClaymatchingAccessState(config, session.sub);
  } catch (error) {
    console.error(JSON.stringify({
      event: "clay_sui_access_state_failed",
      message: error?.message || String(error),
    }));
    return json({ error: "Claymatching posting access could not be checked right now." }, 502, headers);
  }
  if (!accessState.canPost) {
    return json({ error: "Posting access is required before linking a Sui wallet." }, 403, {
      ...headers,
      "Set-Cookie": clearClaymatchingSessionCookie(),
    });
  }

  if (request.method === "GET") {
    try {
      const result = await claymatchingSupabaseRpc(config, "get_clay_sui_connection", {
        raw_user_id: session.sub,
      });
      const connection = Array.isArray(result) ? result[0] : result;
      return json(claymatchingSuiConnectionResponse(connection, accessState, session), 200, headers);
    } catch (error) {
      console.error(JSON.stringify({
        event: "clay_sui_state_failed",
        message: error?.message || String(error),
      }));
      return json({ error: "The Sui connection could not be loaded right now." }, 502, headers);
    }
  }

  if (request.method !== "DELETE") {
    return json({ error: "Method not allowed." }, 405, { ...headers, Allow: "GET, DELETE, OPTIONS" });
  }
  if (!claymatchingCsrfMatches(request, session)) {
    return json({ error: "Refresh Claymatching before changing wallet links." }, 403, headers);
  }

  try {
    await claymatchingSupabaseRpc(config, "unlink_clay_sui_connection", {
      raw_user_id: session.sub,
    });
    const refreshedState = await loadClaymatchingAccessState(config, session.sub);
    if (!refreshedState.canPost) {
      return json({
        ...claymatchingSuiConnectionResponse(null, refreshedState, session),
        linked: false,
      }, 200, {
        ...headers,
        "Set-Cookie": clearClaymatchingSessionCookie(),
      });
    }
    const refreshed = await createClaymatchingAccessSession({
      accessState: refreshedState,
      csrfToken: session.csrf,
      userId: session.sub,
    }, config.sessionSecret);
    return json({
      ...claymatchingSuiConnectionResponse(null, refreshedState, refreshed.session),
      linked: false,
    }, 200, {
      ...headers,
      "Set-Cookie": claymatchingSessionCookie(refreshed.token),
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "clay_sui_unlink_failed",
      message: error?.message || String(error),
    }));
    return json({ error: "The Sui wallet could not be unlinked right now." }, 502, headers);
  }
}

async function handleClaymatchingSuiChallengeRequest(request, env) {
  const headers = getClaymatchingCorsHeaders(request, env);
  const url = new URL(request.url);

  if (!isClaymatchingHost(url.hostname, env)) {
    return json({ error: "Not found." }, 404, headers);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { ...headers, Allow: "POST, OPTIONS" });
  }
  if (!request.headers.get("Origin") || !isSameOriginBrowserRequest(request)) {
    return json({ error: "Sui linking must be started from Claymatching." }, 403, headers);
  }

  const session = await readClaymatchingSession(request, env);
  if (!session) {
    return json({ error: "An active Claymatching session is required." }, 401, headers);
  }
  if (!claymatchingCsrfMatches(request, session)) {
    return json({ error: "Refresh Claymatching before linking a Sui wallet." }, 403, headers);
  }
  const config = getClaymatchingServerConfig(env);
  if (!config.backendConfigured) {
    return json({ error: "Sui wallet links are not fully configured yet." }, 503, headers);
  }

  try {
    const accessState = await loadClaymatchingAccessState(config, session.sub);
    if (!accessState.canPost) {
      return json({ error: "Posting access is required before linking a Sui wallet." }, 403, {
        ...headers,
        "Set-Cookie": clearClaymatchingSessionCookie(),
      });
    }
  } catch (error) {
    console.error(JSON.stringify({
      event: "clay_sui_challenge_access_failed",
      message: error?.message || String(error),
    }));
    return json({ error: "Posting access could not be checked right now." }, 502, headers);
  }

  let body;
  try {
    body = await readJsonBody(request, CLAYMATCHING_MAX_SESSION_BODY_BYTES, "Sui link request is too large.");
  } catch {
    return json({ error: "A valid Sui wallet address is required." }, 400, headers);
  }
  const address = normalizeClaymatchingSuiAddress(body?.address);
  if (!address) {
    return json({ error: "Connect a valid Sui mainnet wallet first." }, 400, headers);
  }

  const challengeId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    address,
    challengeId,
    exp: now + CLAYMATCHING_SUI_CHALLENGE_TTL_SECONDS,
    iat: now,
    kind: "clay-sui-link",
    origin: url.origin,
    sub: session.sub,
    v: 1,
  };

  try {
    const result = await claymatchingSupabaseRpc(config, "begin_clay_sui_link", {
      raw_challenge_id: challengeId,
      raw_expires_at: new Date(payload.exp * 1000).toISOString(),
      raw_user_id: session.sub,
    });
    const claim = Array.isArray(result) ? result[0] : result;
    if (!claim?.allowed) {
      return json({ error: "Active posting access is required before linking Sui." }, 403, headers);
    }
    const challengeToken = await signClaymatchingSession(payload, config.sessionSecret);
    return json({
      address,
      challengeToken,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      message: formatClaymatchingSuiLinkMessage(payload),
    }, 200, headers);
  } catch (error) {
    console.error(JSON.stringify({
      event: "clay_sui_challenge_failed",
      message: error?.message || String(error),
    }));
    return json({ error: "The Sui link request could not start right now." }, 502, headers);
  }
}

async function handleClaymatchingSuiLinkRequest(request, env) {
  const headers = getClaymatchingCorsHeaders(request, env);
  const url = new URL(request.url);

  if (!isClaymatchingHost(url.hostname, env)) {
    return json({ error: "Not found." }, 404, headers);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { ...headers, Allow: "POST, OPTIONS" });
  }
  if (!request.headers.get("Origin") || !isSameOriginBrowserRequest(request)) {
    return json({ error: "Sui linking must be completed from Claymatching." }, 403, headers);
  }

  const session = await readClaymatchingSession(request, env);
  if (!session) {
    return json({ error: "An active Claymatching session is required." }, 401, headers);
  }
  if (!claymatchingCsrfMatches(request, session)) {
    return json({ error: "Refresh Claymatching before linking a Sui wallet." }, 403, headers);
  }
  const config = getClaymatchingServerConfig(env);
  if (!config.backendConfigured) {
    return json({ error: "Sui wallet links are not fully configured yet." }, 503, headers);
  }

  try {
    const accessState = await loadClaymatchingAccessState(config, session.sub);
    if (!accessState.canPost) {
      return json({ error: "Posting access is required before linking a Sui wallet." }, 403, {
        ...headers,
        "Set-Cookie": clearClaymatchingSessionCookie(),
      });
    }
  } catch (error) {
    console.error(JSON.stringify({
      event: "clay_sui_link_access_failed",
      message: error?.message || String(error),
    }));
    return json({ error: "Posting access could not be checked right now." }, 502, headers);
  }

  let body;
  try {
    body = await readJsonBody(request, CLAYMATCHING_MAX_SESSION_BODY_BYTES, "Sui link proof is too large.");
  } catch {
    return json({ error: "A valid Sui wallet proof is required." }, 400, headers);
  }

  const payload = await readClaymatchingSignedPayload(body?.challengeToken, config.sessionSecret);
  const address = normalizeClaymatchingSuiAddress(payload?.address);
  const challengeId = String(payload?.challengeId || "").toLowerCase();
  const signature = String(body?.signature || "").trim();
  const walletName = cleanClaymatchingOptionalText(body?.walletName, 80);
  const now = Math.floor(Date.now() / 1000);
  const validChallenge = Boolean(
    payload?.v === 1
      && payload?.kind === "clay-sui-link"
      && payload?.sub === session.sub
      && payload?.origin === url.origin
      && Number.isInteger(payload?.iat)
      && Number.isInteger(payload?.exp)
      && payload.iat <= now + 60
      && payload.exp > now
      && payload.exp - payload.iat <= CLAYMATCHING_SUI_CHALLENGE_TTL_SECONDS
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(challengeId)
      && address
      && signature.length >= 16
      && signature.length <= 4096,
  );
  if (!validChallenge) {
    return json({ error: "That Sui link request expired. Connect and try again." }, 400, headers);
  }

  try {
    const message = new TextEncoder().encode(formatClaymatchingSuiLinkMessage(payload));
    await verifyPersonalMessageSignature(message, signature, { address });
  } catch {
    return json({ error: "The Sui wallet signature did not match the connected address." }, 401, headers);
  }

  try {
    const result = await claymatchingSupabaseRpc(config, "finish_clay_sui_link", {
      raw_challenge_id: challengeId,
      raw_user_id: session.sub,
      raw_wallet_address: address,
      raw_wallet_name: walletName || null,
    });
    const connection = Array.isArray(result) ? result[0] : result;
    const accessState = await loadClaymatchingAccessState(config, session.sub);
    if (!accessState.canPost || !accessState.canDm || accessState.suiAddress !== address) {
      throw new Error("Signed Sui confirmation did not become authoritative DM access.");
    }
    const refreshed = await createClaymatchingAccessSession({
      accessState,
      csrfToken: session.csrf,
      userId: session.sub,
    }, config.sessionSecret);
    return json({
      ...claymatchingSuiConnectionResponse(connection, accessState, refreshed.session),
      linked: true,
      walletAddress: normalizeClaymatchingSuiAddress(connection?.wallet_address) || address,
      walletName: connection?.wallet_name || walletName || null,
    }, 200, {
      ...headers,
      "Set-Cookie": claymatchingSessionCookie(refreshed.token),
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "clay_sui_link_failed",
      message: error?.message || String(error),
    }));
    return json({ error: "The signed Sui wallet could not be linked. It may already belong to another holder account." }, 409, headers);
  }
}

async function handleClaymatchingPopkinsSyncRequest(request, env) {
  const headers = getClaymatchingCorsHeaders(request, env);
  const url = new URL(request.url);

  if (!isClaymatchingHost(url.hostname, env)) {
    return json({ error: "Not found." }, 404, headers);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { ...headers, Allow: "POST, OPTIONS" });
  }
  if (!request.headers.get("Origin") || !isSameOriginBrowserRequest(request)) {
    return json({ error: "Popkins checks must be started from Claymatching." }, 403, headers);
  }

  const session = await readClaymatchingSession(request, env);
  if (!session) {
    return json({ error: "An active Claymatching session is required." }, 401, headers);
  }
  if (!claymatchingCsrfMatches(request, session)) {
    return json({ error: "Refresh Claymatching before checking Popkins." }, 403, headers);
  }
  const config = getClaymatchingServerConfig(env);
  if (!config.backendConfigured) {
    return json({ error: "Popkins checks are not fully configured yet." }, 503, headers);
  }

  let accessState;
  try {
    accessState = await loadClaymatchingAccessState(config, session.sub);
  } catch (error) {
    console.error(JSON.stringify({
      event: "clay_popkins_access_state_failed",
      message: error?.message || String(error),
    }));
    return json({ error: "Posting and Sui access could not be checked right now." }, 502, headers);
  }
  if (!accessState.canPost) {
    return json({ error: "Posting access is required before checking Popkins." }, 403, {
      ...headers,
      "Set-Cookie": clearClaymatchingSessionCookie(),
    });
  }
  if (!accessState.suiAddress || !accessState.suiVerifiedAt) {
    return json({ error: "Link and sign a Sui wallet before checking Popkins." }, 409, headers);
  }

  const syncToken = crypto.randomUUID();
  let context;
  try {
    const result = await claymatchingSupabaseRpc(config, "begin_clay_popkins_sync", {
      raw_sync_token: syncToken,
      raw_user_id: session.sub,
    });
    context = Array.isArray(result) ? result[0] : result;
  } catch (error) {
    console.error(JSON.stringify({
      event: "clay_popkins_sync_claim_failed",
      message: error?.message || String(error),
    }));
    return json({ error: "The Popkins check could not start right now." }, 502, headers);
  }

  if (!context?.allowed) {
    const reason = String(context?.reason || "sync_unavailable");
    if (reason === "cooldown") {
      const retryAfter = Math.max(1, Math.min(300, Number(context?.retry_after_seconds || 1)));
      return json({
        error: `Popkins were just checked. Try again in ${retryAfter} second${retryAfter === 1 ? "" : "s"}.`,
        retryAfter,
      }, 429, { ...headers, "Retry-After": String(retryAfter) });
    }
    if (reason === "sui_not_linked") {
      return json({ error: "Link a Sui wallet first, then check Popkins." }, 409, headers);
    }
    return json({ error: "Active holder verification is required before checking Popkins." }, 403, headers);
  }

  const address = normalizeClaymatchingSuiAddress(context.wallet_address);
  if (!address || address !== accessState.suiAddress) {
    return json({ error: "The linked Sui address is invalid. Unlink it and try again." }, 409, headers);
  }

  try {
    const snapshot = await loadClaymatchingPopkinsSnapshot(address, env);
    const commitAccessState = await loadClaymatchingAccessState(config, session.sub);
    if (!commitAccessState.canPost || commitAccessState.suiAddress !== address || !commitAccessState.suiVerifiedAt) {
      await claymatchingSupabaseRpc(config, "finish_clay_popkins_sync", {
        raw_assets: [],
        raw_error_code: "membership_changed",
        raw_popkins_count: 0,
        raw_succeeded: false,
        raw_sync_token: syncToken,
        raw_user_id: session.sub,
        raw_wallet_address: address,
      }).catch(() => {});
      return json({ error: "Posting or signed Sui access changed during the Popkins check." }, 403, headers);
    }
    const result = await claymatchingSupabaseRpc(config, "finish_clay_popkins_sync", {
      raw_assets: snapshot.assets,
      raw_error_code: null,
      raw_popkins_count: snapshot.count,
      raw_succeeded: true,
      raw_sync_token: syncToken,
      raw_user_id: session.sub,
      raw_wallet_address: address,
    });
    const committed = Array.isArray(result) ? result[0] : result;
    if (!committed?.committed || committed?.sync_status !== "synced") {
      return json({ error: "The linked Sui wallet changed during the check. Try again." }, 409, headers);
    }
    return json({
      avatarAssets: snapshot.assets.map((asset) => ({
        ...asset,
        chain: "sui",
        collectionId: CLAYMATCHING_POPKINS_TYPE,
        kind: "popkin",
      })),
      coverage: "wallet+owned-kiosk+staking-contract",
      avatarAssetCount: Number(committed.saved_avatar_count || snapshot.assets.length),
      popkinsCount: Number(committed.saved_count || snapshot.count),
      stakedPopkinsCount: snapshot.stakedCount,
      source: "Sui mainnet + Popkins staking contract",
      syncedAt: committed.synced_at,
      userTriggered: true,
    }, 200, headers);
  } catch (error) {
    await claymatchingSupabaseRpc(config, "finish_clay_popkins_sync", {
      raw_error_code: "sui_query_failed",
      raw_popkins_count: 0,
      raw_succeeded: false,
      raw_sync_token: syncToken,
      raw_user_id: session.sub,
      raw_wallet_address: address,
    }).catch(() => {});
    console.error(JSON.stringify({
      event: "clay_popkins_sync_failed",
      message: error?.message || String(error),
    }));
    return json({
      error: "Sui could not return the complete wallet, Kiosk, and staking-contract snapshot. The previous Popkins status was not changed.",
    }, 502, headers);
  }
}

function claymatchingCsrfMatches(request, session) {
  const csrfToken = String(request.headers.get("X-Clay-CSRF") || "");
  return Boolean(csrfToken && csrfToken === session?.csrf);
}

function normalizeClaymatchingSuiAddress(value) {
  const address = String(value || "").trim().toLowerCase();
  if (!address || !isValidSuiAddress(address)) return "";
  const normalized = normalizeSuiAddress(address).toLowerCase();
  return /^0x[0-9a-f]{64}$/.test(normalized) ? normalized : "";
}

function cleanClaymatchingOptionalText(value, maximumLength) {
  const text = String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return text.slice(0, maximumLength) || null;
}

function formatClaymatchingSolanaLinkMessage(payload) {
  return [
    "Claymatching Solana wallet verification",
    "",
    "This signature proves control of the public Solana address below.",
    "It does not authorize a transaction, token approval, or transfer.",
    "",
    `Claymatching account: ${payload.sub}`,
    `Solana address: ${payload.address}`,
    `Challenge: ${payload.challengeId}`,
    `Origin: ${payload.origin}`,
    `Expires: ${new Date(payload.exp * 1000).toISOString()}`,
  ].join("\n");
}

function formatClaymatchingSuiLinkMessage(payload) {
  return [
    "Claymatching Sui wallet link",
    "",
    "This signature proves control of the Sui address below.",
    "It does not authorize a transaction, token approval, or transfer.",
    "",
    `Claymatching account: ${payload.sub}`,
    `Sui address: ${payload.address}`,
    `Challenge: ${payload.challengeId}`,
    `Origin: ${payload.origin}`,
    `Expires: ${new Date(payload.exp * 1000).toISOString()}`,
  ].join("\n");
}

export async function loadClaymatchingPopkinsSnapshot(address, env = {}, providedClient = null) {
  const normalizedAddress = normalizeClaymatchingSuiAddress(address);
  if (!normalizedAddress) throw new Error("A valid linked Sui address is required.");
  const endpoint = new URL(String(env.SUI_GRAPHQL_URL || CLAYMATCHING_SUI_GRAPHQL_URL));
  if (endpoint.protocol !== "https:") {
    throw new Error("Sui GraphQL must use HTTPS.");
  }
  const timedFetch = (input, init = {}) => fetch(input, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  const client = providedClient || new SuiGraphQLClient({
    fetch: timedFetch,
    network: "mainnet",
    url: endpoint.toString(),
  }).$extend(kiosk());

  const seenObjectIds = new Set();
  const avatarObjectIds = new Set();
  const visibleAvatarCandidates = [];
  const stakedAvatarCandidates = [];
  const rememberPopkin = (rawObjectId, location) => {
    const objectId = normalizeClaymatchingSuiAddress(rawObjectId);
    if (!objectId) return false;
    if (location !== "staked") seenObjectIds.add(objectId);
    const candidates = location === "staked" ? stakedAvatarCandidates : visibleAvatarCandidates;
    if (!avatarObjectIds.has(objectId) && candidates.length < CLAYMATCHING_MAX_POPKIN_AVATARS) {
      avatarObjectIds.add(objectId);
      candidates.push({ location, objectId });
    }
    return true;
  };

  let cursor = null;
  let ownedObjectsHaveMore = false;
  for (let page = 0; page < 20 && seenObjectIds.size < CLAYMATCHING_MAX_POPKINS; page += 1) {
    const result = await client.core.listOwnedObjects({
      cursor,
      limit: 50,
      owner: normalizedAddress,
      type: CLAYMATCHING_POPKINS_TYPE,
    });
    result.objects.forEach((object) => {
      if (object.type === CLAYMATCHING_POPKINS_TYPE) rememberPopkin(object.objectId, "wallet");
    });
    ownedObjectsHaveMore = Boolean(result.hasNextPage);
    if (!ownedObjectsHaveMore) break;
    if (!result.cursor) throw new Error("Sui owned-object pagination did not return a cursor.");
    cursor = result.cursor;
  }
  if (ownedObjectsHaveMore) throw new Error("The direct Popkins snapshot exceeded its safe page limit.");

  const kioskIds = [];
  cursor = null;
  let ownedKiosksHaveMore = false;
  for (let page = 0; page < 10 && kioskIds.length < CLAYMATCHING_MAX_SUI_KIOSKS; page += 1) {
    const result = await client.kiosk.getOwnedKiosks({
      address: normalizedAddress,
      pagination: { cursor, limit: 50 },
    });
    kioskIds.push(...result.kioskIds.slice(0, CLAYMATCHING_MAX_SUI_KIOSKS - kioskIds.length));
    ownedKiosksHaveMore = Boolean(result.hasNextPage);
    if (!ownedKiosksHaveMore) break;
    if (!result.nextCursor) throw new Error("Sui Kiosk pagination did not return a cursor.");
    cursor = result.nextCursor;
  }
  if (ownedKiosksHaveMore) throw new Error("The owned Kiosk snapshot exceeded its safe page limit.");

  for (let index = 0; index < kioskIds.length; index += 5) {
    await Promise.all(kioskIds.slice(index, index + 5).map(async (id) => {
      const data = await client.kiosk.getKiosk({ id });
      const items = data.items.filter((item) => item.type === CLAYMATCHING_POPKINS_TYPE);
      items.forEach((item) => rememberPopkin(item.objectId, "kiosk"));
    }));
    if (seenObjectIds.size > CLAYMATCHING_MAX_POPKINS) {
      throw new Error("Popkins count exceeded the safe snapshot limit.");
    }
  }

  const stakingSnapshot = await loadClaymatchingStakedPopkinsSnapshot({
    address: normalizedAddress,
    client,
    rememberPopkin,
    remainingAvatarSlots: CLAYMATCHING_MAX_POPKIN_AVATARS,
  });
  if (stakingSnapshot.fullyEnumerated &&
      stakingSnapshot.objectIds.some((objectId) => seenObjectIds.has(objectId))) {
    throw new Error("Popkins custody changed during the snapshot. Try the check again.");
  }
  const totalCount = seenObjectIds.size + stakingSnapshot.count;
  if (totalCount > CLAYMATCHING_MAX_POPKINS) {
    throw new Error("Popkins count exceeded the safe snapshot limit.");
  }

  const avatarCandidates = selectClaymatchingPopkinAvatarCandidates(
    visibleAvatarCandidates,
    stakedAvatarCandidates,
  );
  const objects = [];
  for (let index = 0; index < avatarCandidates.length; index += 50) {
    const batch = avatarCandidates.slice(index, index + 50);
    const result = await client.core.getObjects({
      objectIds: batch.map((candidate) => candidate.objectId),
      include: { display: true, json: true },
    });
    const locations = new Map(batch.map((candidate) => [candidate.objectId, candidate.location]));
    result.objects.forEach((object) => {
      if (object instanceof Error) return;
      objects.push({ location: locations.get(normalizeClaymatchingSuiAddress(object.objectId)) || "wallet", object });
    });
  }

  return {
    assets: normalizeClaymatchingPopkinAvatarAssets(objects),
    count: totalCount,
    stakedCount: stakingSnapshot.count,
  };
}

async function loadClaymatchingStakedPopkinsSnapshot({
  address,
  client,
  rememberPopkin,
  remainingAvatarSlots,
}) {
  const { object: contract } = await client.core.getObject({
    objectId: CLAYMATCHING_POPKINS_STAKING_CONTRACT,
    include: { json: true },
  });
  if (contract.objectId !== CLAYMATCHING_POPKINS_STAKING_CONTRACT ||
      contract.type !== CLAYMATCHING_POPKINS_STAKING_CONTRACT_TYPE) {
    throw new Error("The Popkins staking contract identity changed.");
  }

  const stakingDataIndex = normalizeClaymatchingSuiTable(
    contract.json?.staking_datas,
    "staking account index",
    CLAYMATCHING_MAX_STAKING_ACCOUNTS,
  );
  let stakingDataField;
  try {
    const response = await client.core.getDynamicField({
      parentId: stakingDataIndex.id,
      name: {
        type: "address",
        bcs: bcs.Address.serialize(address).toBytes(),
      },
    });
    stakingDataField = response.dynamicField;
  } catch (error) {
    if (error?.code === "notFound") return { count: 0 };
    throw error;
  }

  if (!isClaymatchingSuiObjectIdType(stakingDataField?.value?.type)) {
    throw new Error("The Popkins staking account index returned an unexpected value type.");
  }
  const stakingDataId = normalizeClaymatchingSuiAddress(
    bcs.Address.parse(stakingDataField.value.bcs),
  );
  if (!stakingDataId) throw new Error("The Popkins staking account ID is invalid.");

  const { object: stakingData } = await client.core.getObject({
    objectId: stakingDataId,
    include: { json: true },
  });
  if (stakingData.objectId !== stakingDataId || stakingData.type !== CLAYMATCHING_POPKINS_STAKING_DATA_TYPE) {
    throw new Error("The Popkins staking account identity changed.");
  }
  if (normalizeClaymatchingSuiAddress(stakingData.json?.owner) !== address) {
    throw new Error("The Popkins staking account owner does not match the linked wallet.");
  }

  const stakedPopkins = normalizeClaymatchingSuiTable(
    stakingData.json?.staked_nfts_ids,
    "staked Popkins index",
    CLAYMATCHING_MAX_POPKINS,
  );
  const target = Math.min(stakedPopkins.size, remainingAvatarSlots);
  if (target === 0) {
    return { count: stakedPopkins.size, fullyEnumerated: stakedPopkins.size === 0, objectIds: [] };
  }

  const enumerated = new Set();
  let cursor = null;
  let hasNextPage = false;
  for (let page = 0; page < 20 && enumerated.size < target; page += 1) {
    const result = await client.core.listDynamicFields({
      parentId: stakedPopkins.id,
      cursor,
      limit: Math.min(50, target - enumerated.size),
    });
    for (const field of result.dynamicFields) {
      if (!isClaymatchingSuiObjectIdType(field?.name?.type)) {
        throw new Error("The staked Popkins index returned an unexpected key type.");
      }
      const objectId = normalizeClaymatchingSuiAddress(bcs.Address.parse(field.name.bcs));
      if (!objectId || enumerated.has(objectId)) {
        throw new Error("The staked Popkins index returned an invalid or duplicate object ID.");
      }
      enumerated.add(objectId);
      rememberPopkin(objectId, "staked");
      if (enumerated.size >= target) break;
    }
    hasNextPage = Boolean(result.hasNextPage);
    if (!hasNextPage) break;
    if (!result.cursor) throw new Error("The staked Popkins index pagination cursor is missing.");
    cursor = result.cursor;
  }

  if (enumerated.size !== target || (target === stakedPopkins.size && hasNextPage)) {
    throw new Error("The staked Popkins index returned an incomplete snapshot.");
  }
  return {
    count: stakedPopkins.size,
    fullyEnumerated: target === stakedPopkins.size,
    objectIds: [...enumerated],
  };
}

function selectClaymatchingPopkinAvatarCandidates(visible, staked) {
  if (!visible.length || !staked.length) {
    return [...staked, ...visible].slice(0, CLAYMATCHING_MAX_POPKIN_AVATARS);
  }

  const reservedStaked = Math.min(staked.length, Math.floor(CLAYMATCHING_MAX_POPKIN_AVATARS / 2));
  const selected = [
    ...staked.slice(0, reservedStaked),
    ...visible.slice(0, CLAYMATCHING_MAX_POPKIN_AVATARS - reservedStaked),
  ];
  if (selected.length < CLAYMATCHING_MAX_POPKIN_AVATARS) {
    selected.push(...staked.slice(reservedStaked, reservedStaked + CLAYMATCHING_MAX_POPKIN_AVATARS - selected.length));
  }
  if (selected.length < CLAYMATCHING_MAX_POPKIN_AVATARS) {
    selected.push(...visible.slice(selected.length, selected.length + CLAYMATCHING_MAX_POPKIN_AVATARS - selected.length));
  }
  return selected.slice(0, CLAYMATCHING_MAX_POPKIN_AVATARS);
}

function normalizeClaymatchingSuiTable(value, label, maximumSize) {
  const id = normalizeClaymatchingSuiAddress(value?.id);
  const rawSize = typeof value?.size === "string" && /^\d+$/.test(value.size)
    ? Number(value.size)
    : value?.size;
  if (!id || !Number.isSafeInteger(rawSize) || rawSize < 0 || rawSize > maximumSize) {
    throw new Error(`The ${label} is invalid.`);
  }
  return { id, size: rawSize };
}

function isClaymatchingSuiObjectIdType(value) {
  return /^0x0*2::object::ID$/i.test(String(value || ""));
}

export function normalizeClaymatchingPopkinAvatarAssets(items) {
  const seen = new Set();
  const assets = [];

  for (const candidate of Array.isArray(items) ? items : []) {
    const object = candidate?.object || candidate;
    const id = normalizeClaymatchingSuiAddress(object?.objectId);
    if (!id || seen.has(id) || object?.type !== CLAYMATCHING_POPKINS_TYPE) continue;

    const display = object?.display?.output && typeof object.display.output === "object"
      ? object.display.output
      : {};
    const jsonContent = object?.json && typeof object.json === "object" ? object.json : {};
    const image = normalizeClaymatchingPopkinImageUrl(
      display.image_url,
      display.image,
      display.thumbnail_url,
      jsonContent.image_url,
      jsonContent.image,
      jsonContent.url,
    );
    if (!image) continue;

    seen.add(id);
    assets.push({
      id,
      image,
      location: candidate?.location === "wallet" ? "wallet" : "kiosk",
      name: cleanClaymatchingText(display.name || jsonContent.name || `Popkin ${id.slice(2, 8).toUpperCase()}`, 100),
    });
  }

  return assets.sort((left, right) => left.name.localeCompare(right.name)).slice(0, CLAYMATCHING_MAX_POPKIN_AVATARS);
}

function normalizeClaymatchingPopkinImageUrl(...candidates) {
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value || value.length > 2_048 || /\s/.test(value)) continue;
    if (value.startsWith("ipfs://")) {
      const path = value.slice(7).replace(/^ipfs\//, "");
      if (/^[A-Za-z0-9._~!$&'()*+,;=:@%/-]{10,2000}$/.test(path)) {
        return `https://ipfs.io/ipfs/${path}`;
      }
      continue;
    }
    try {
      const url = new URL(value);
      if (url.protocol === "https:") return url.toString();
    } catch {
      // Ignore malformed and non-HTTPS Display fields.
    }
  }
  return "";
}

function normalizeStoredClaymatchingPopkinAssets(rows) {
  const seen = new Set();
  const assets = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = normalizeClaymatchingSuiAddress(row?.object_id);
    const image = normalizeClaymatchingPopkinImageUrl(row?.image_url);
    if (!id || !image || seen.has(id)) continue;
    seen.add(id);
    assets.push({
      chain: "sui",
      collectionId: CLAYMATCHING_POPKINS_TYPE,
      id,
      image,
      kind: "popkin",
      location: row?.location === "kiosk" ? "kiosk" : "wallet",
      name: cleanClaymatchingText(row?.asset_name || `Popkin ${id.slice(2, 8).toUpperCase()}`, 100),
      verifiedAt: row?.verified_at || null,
    });
  }
  return assets.slice(0, CLAYMATCHING_MAX_POPKIN_AVATARS);
}

function clayCollectError(message, collectCode, status = 502) {
  const error = new Error(message);
  error.collectCode = collectCode;
  error.status = status;
  return error;
}

async function finishClayCollectSync(config, {
  achievements = [],
  errorCode = null,
  sourceUsername = null,
  succeeded,
  syncToken,
  userId,
}) {
  return claymatchingSupabaseRpc(config, "finish_clay_collect_sync", {
    raw_achievements: achievements,
    raw_error_code: errorCode,
    raw_source_username: sourceUsername,
    raw_succeeded: succeeded === true,
    raw_sync_token: syncToken,
    raw_user_id: userId,
  });
}

async function fetchClayCollectJson(pathname, maximumBytes) {
  const endpoint = new URL(pathname, CLAY_COLLECT_ORIGIN);
  if (endpoint.origin !== CLAY_COLLECT_ORIGIN || endpoint.search || endpoint.hash) {
    throw clayCollectError("Invalid fixed Collect endpoint.", "upstream_endpoint_invalid");
  }

  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(CLAY_COLLECT_UPSTREAM_TIMEOUT_MS),
  });
  if (response.status >= 300 && response.status < 400) {
    throw clayCollectError("Collect redirects are not followed.", "upstream_redirect");
  }
  if (!response.ok) {
    throw clayCollectError(`Collect returned status ${response.status}.`, "upstream_status");
  }
  const contentType = String(response.headers.get("Content-Type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    throw clayCollectError("Collect did not return JSON.", "upstream_content_type");
  }

  let payload;
  try {
    payload = await readBoundedResponseJson(response, maximumBytes);
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") throw error;
    throw clayCollectError("Collect returned malformed JSON.", "upstream_invalid_json");
  }
  if (payload === null) {
    throw clayCollectError("Collect response exceeded the safe size limit.", "upstream_too_large");
  }
  return payload;
}

export function verifyClayCollectIdentity(payload, expectedProfileId, signedWalletAddress) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw clayCollectError("Collect identity shape is invalid.", "upstream_identity_schema");
  }
  const profileId = String(payload.dynamicXYZId || "").trim().toLowerCase();
  if (!CLAY_COLLECT_UUID_PATTERN.test(profileId) || profileId !== expectedProfileId) {
    throw clayCollectError("Collect identity does not match the linked profile.", "profile_mismatch", 409);
  }
  const wallets = Array.isArray(payload.wallets) ? payload.wallets : [];
  if (wallets.length > 250) {
    throw clayCollectError("Collect returned too many linked wallets.", "upstream_identity_schema");
  }
  const walletMatched = wallets.some((wallet) =>
    String(wallet?.chain || "").trim().toLowerCase() === "solana" &&
    String(wallet?.address || "").trim() === signedWalletAddress
  );
  if (!walletMatched) {
    throw clayCollectError("Signed Solana wallet is not linked to this Collect profile.", "wallet_mismatch", 409);
  }
  return {
    username: cleanClayCollectString(payload.username, 80) || null,
    walletMatched: true,
  };
}

export function normalizeClayCollectAchievements(payload) {
  if (!Array.isArray(payload) || payload.length > CLAY_COLLECT_MAX_ROOTS) {
    throw clayCollectError("Collect achievement shape is invalid.", "upstream_achievement_schema");
  }

  const normalizedById = new Map();
  for (const root of payload) {
    if (!root || typeof root !== "object" || Array.isArray(root)) {
      throw clayCollectError("Collect achievement record is invalid.", "upstream_achievement_schema");
    }
    const rootId = cleanClayCollectString(root.id, 160);
    if (!rootId) {
      throw clayCollectError("Collect achievement is missing an ID.", "upstream_achievement_schema");
    }

    if (!clayCollectNodeIsEarned(root)) continue;

    const claimedAt = normalizeClayCollectClaimedAt(root.claimedAt);
    if (!claimedAt) {
      throw clayCollectError("Earned Collect achievement is incomplete.", "upstream_achievement_schema");
    }
    const candidate = {
      achievementId: rootId,
      achievementType: cleanClayCollectString(root.type, 32) || "achievement",
      claimedAt,
      completedCount: clayCollectInteger(root.completedCount, 0, 1_000_000_000),
      description: cleanClayCollectString(root.description, 500),
      earnedPoints: clayCollectInteger(root.earnedPoints, 0, 1_000_000_000),
      iconUrl: normalizeClayCollectIconUrl(root.badgeIcon || root.icon),
      kind: cleanClayCollectString(root.kind, 32) || "achievement",
      name: cleanClayCollectString(root.name, 160) || "Unnamed achievement",
      points: clayCollectInteger(root.points, 0, 1_000_000_000),
      rarity: cleanClayCollectString(root.rarity, 32) || null,
      sourceRootId: rootId,
      tier: Number.isInteger(Number(root.tier))
        ? clayCollectInteger(root.tier, 0, 32767)
        : null,
      title: cleanClayCollectString(root.title, 160) || null,
    };
    const existing = normalizedById.get(rootId);
    if (!existing || candidate.claimedAt > existing.claimedAt) {
      normalizedById.set(rootId, candidate);
    }
  }

  const normalized = [...normalizedById.values()]
    .sort((left, right) => right.claimedAt.localeCompare(left.claimedAt) || left.achievementId.localeCompare(right.achievementId));
  if (normalized.length > CLAY_COLLECT_MAX_SNAPSHOT_ITEMS) {
    throw clayCollectError("Collect returned too many earned achievements.", "upstream_achievement_count");
  }
  return normalized;
}

function clayCollectNodeIsEarned(node) {
  return Boolean(
    node && typeof node === "object" && !Array.isArray(node) &&
    node.status === "enabled" && normalizeClayCollectClaimedAt(node.claimedAt),
  );
}

function normalizeClayCollectClaimedAt(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 64) return "";
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) return "";
  const year = new Date(timestamp).getUTCFullYear();
  return year >= 2000 && year <= 2200 ? new Date(timestamp).toISOString() : "";
}

function cleanClayCollectString(value, maximumLength) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
}

function clayCollectInteger(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.trunc(number)));
}

function normalizeClayCollectIconUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 2_048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || !CLAY_COLLECT_ICON_HOSTS.has(url.hostname)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

async function loadClaymatchingAssets(owner, env) {
  const apiKey = String(env.HELIUS_API_KEY || "").trim();
  const collectionIds = parseClaymatchingCollectionIds(env.CLAYMATCHING_COLLECTION_IDS);
  if (!apiKey || !collectionIds.length) {
    const error = new Error("Verified collection lookup is not configured yet.");
    error.status = 503;
    throw error;
  }

  const results = await Promise.all(
    collectionIds.map((collectionId) => fetchClaymatchingCollectionAssets({
      apiKey,
      collectionId,
      owner,
    })),
  );
  return normalizeClaymatchingAssets(results.flat(), owner, new Set(collectionIds));
}

async function loadCachedClaymatchingPreviewAssets(owner, env, ctx) {
  const cache = globalThis.caches?.default;
  if (!cache) return loadClaymatchingAssets(owner, env);

  const cacheKey = new Request(`https://claymatching-preview-cache.invalid/v1/${encodeURIComponent(owner)}`, {
    method: "GET",
  });
  try {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const cached = await readBoundedResponseJson(cachedResponse, CLAYMATCHING_MAX_UPSTREAM_BYTES);
      if (Array.isArray(cached?.assets)) return cached.assets;
    }
  } catch (error) {
    console.warn(JSON.stringify({
      event: "clay_solana_preview_cache_read_failed",
      message: error?.message || String(error),
    }));
  }

  const assets = await loadClaymatchingAssets(owner, env);
  const cacheResponse = Response.json({ assets }, {
    headers: { "Cache-Control": `public, max-age=${CLAYMATCHING_SOLANA_PREVIEW_CACHE_SECONDS}` },
  });
  try {
    const cacheWrite = cache.put(cacheKey, cacheResponse).catch((error) => {
      console.warn(JSON.stringify({
        event: "clay_solana_preview_cache_write_failed",
        message: error?.message || String(error),
      }));
    });
    if (ctx?.waitUntil) {
      ctx.waitUntil(cacheWrite);
    } else {
      await cacheWrite;
    }
  } catch (error) {
    console.warn(JSON.stringify({
      event: "clay_solana_preview_cache_write_failed",
      message: error?.message || String(error),
    }));
  }
  return assets;
}

async function fetchClaymatchingCollectionAssets({ apiKey, collectionId, owner }) {
  const endpoint = new URL("https://mainnet.helius-rpc.com/");
  endpoint.searchParams.set("api-key", apiKey);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "searchAssets",
      params: {
        grouping: ["collection", collectionId],
        limit: CLAYMATCHING_MAX_ASSETS_PER_COLLECTION,
        ownerAddress: owner,
        page: 1,
        tokenType: "nonFungible",
        options: {
          showCollectionMetadata: false,
          showUnverifiedCollections: false,
        },
      },
    }),
    signal: AbortSignal.timeout(8_000),
  });

  const contentLength = Number(response.headers.get("Content-Length") || 0);
  if (!response.ok || (contentLength && contentLength > CLAYMATCHING_MAX_UPSTREAM_BYTES)) {
    throw new Error(`Helius DAS request failed with status ${response.status}.`);
  }

  const payload = await readBoundedResponseJson(response, CLAYMATCHING_MAX_UPSTREAM_BYTES);
  if (!payload) {
    throw new Error("Helius DAS response was invalid or exceeded the safe size limit.");
  }
  if (payload?.error) {
    throw new Error(`Helius DAS error: ${String(payload.error.message || "unknown error").slice(0, 160)}`);
  }

  const result = payload?.result || payload?.assets;
  return Array.isArray(result?.items) ? result.items : [];
}

export function normalizeClaymatchingAssets(items, owner, allowedCollectionIds) {
  const normalizedOwner = normalizeSolanaAddress(owner);
  const allowed = allowedCollectionIds instanceof Set
    ? allowedCollectionIds
    : new Set(parseClaymatchingCollectionIds(allowedCollectionIds));
  const seen = new Set();
  const assets = [];

  for (const item of Array.isArray(items) ? items : []) {
    const id = normalizeSolanaAddress(item?.id);
    const itemOwner = normalizeSolanaAddress(item?.ownership?.owner);
    const collectionId = (Array.isArray(item?.grouping) ? item.grouping : [])
      .find((group) => group?.group_key === "collection" && allowed.has(group?.group_value))
      ?.group_value;
    const image = normalizeClaymatchingImageUrl(item);

    if (!id || seen.has(id) || !normalizedOwner || itemOwner !== normalizedOwner ||
        !collectionId || !image || item?.burnt === true) {
      continue;
    }

    seen.add(id);
    assets.push({
      collectionId,
      id,
      image,
      name: cleanClaymatchingText(item?.content?.metadata?.name || item?.name || "Owned collectible", 100),
    });
  }

  return assets.sort((left, right) => left.name.localeCompare(right.name)).slice(0, 200);
}

function normalizeClaymatchingImageUrl(item) {
  const files = Array.isArray(item?.content?.files) ? item.content.files : [];
  const imageFile = files.find((file) => String(file?.mime || "").toLowerCase().startsWith("image/")) || files[0];
  const candidates = [
    imageFile?.cdn_uri,
    imageFile?.uri,
    item?.content?.links?.image,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value || value.length > 2_048) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:") return url.toString();
    } catch {
      // Ignore malformed or non-URL metadata fields.
    }
  }

  return "";
}

function cleanClaymatchingText(value, maximumLength) {
  const text = String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return text.slice(0, maximumLength) || "Owned collectible";
}

function parseClaymatchingCollectionIds(value) {
  return [...new Set(String(value || "")
    .split(",")
    .map(normalizeSolanaAddress)
    .filter(Boolean))]
    .slice(0, CLAYMATCHING_MAX_COLLECTIONS);
}

function normalizeSolanaAddress(value) {
  const address = String(value || "").trim();
  return SOLANA_ADDRESS_PATTERN.test(address) ? address : "";
}

function normalizeSolanaPublicKey(value) {
  const address = normalizeSolanaAddress(value);
  if (!address) return "";
  const decoded = decodeBase58(address);
  return decoded?.length === 32 ? address : "";
}

function decodeBase58(value) {
  const input = String(value || "");
  if (!input || input.length > 128) return null;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const bytes = [0];

  for (const character of input) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) return null;
    let carry = digit;
    for (let index = 0; index < bytes.length; index += 1) {
      const valueAtIndex = bytes[index] * 58 + carry;
      bytes[index] = valueAtIndex & 0xff;
      carry = valueAtIndex >>> 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>>= 8;
    }
  }

  let leadingZeroCount = 0;
  while (leadingZeroCount < input.length && input[leadingZeroCount] === "1") {
    leadingZeroCount += 1;
  }
  const hasOnlyZeroByte = bytes.length === 1 && bytes[0] === 0;
  const decoded = new Uint8Array(leadingZeroCount + (hasOnlyZeroByte ? 0 : bytes.length));
  for (let index = 0; index < (hasOnlyZeroByte ? 0 : bytes.length); index += 1) {
    decoded[decoded.length - 1 - index] = bytes[index];
  }
  return decoded;
}

function decodeClaymatchingSolanaSignature(value) {
  const signature = String(value || "").trim();
  if (!signature || signature.length > 256 || /\s/.test(signature)) return null;

  const base58Bytes = decodeBase58(signature);
  if (base58Bytes?.length === 64) return base58Bytes;

  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(signature)) return null;
  try {
    const normalized = signature.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return bytes.length === 64 ? bytes : null;
  } catch {
    return null;
  }
}

async function verifyClaymatchingSolanaSignature(address, signature, message) {
  const publicKeyBytes = decodeBase58(address);
  if (publicKeyBytes?.length !== 32 || signature?.length !== 64 || !(message instanceof Uint8Array)) {
    return false;
  }
  try {
    const publicKey = await crypto.subtle.importKey(
      "raw",
      publicKeyBytes,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify({ name: "Ed25519" }, publicKey, signature, message);
  } catch {
    return false;
  }
}

async function verifyClaymatchingTurnstile(tokenValue, request, env) {
  const token = String(tokenValue || "").trim();
  const secret = String(env.CLAYMATCHING_TURNSTILE_SECRET_KEY || "").trim();
  if (!secret) {
    return { error: "The anti-bot verification is not configured yet.", ok: false, status: 503 };
  }
  if (!token || token.length > 2_048 || /[\r\n]/.test(token)) {
    return { error: "Complete the anti-bot check and try again.", ok: false, status: 403 };
  }

  const remoteIp = String(request.headers.get("CF-Connecting-IP") || "").trim().slice(0, 128);
  let response;
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return { error: "The anti-bot service could not be reached. Try again.", ok: false, status: 503 };
  }

  let result = null;
  try {
    result = await readBoundedResponseJson(response, 64 * 1024);
  } catch {
    // Invalid upstream responses fail closed below.
  }
  if (!response.ok || !result?.success) {
    return { error: "The anti-bot check expired or was already used. Complete it again.", ok: false, status: 403 };
  }
  const expectedHostname = new URL(request.url).hostname.toLowerCase();
  if (String(result.hostname || "").trim().toLowerCase() !== expectedHostname) {
    return { error: "The anti-bot check did not match this site. Refresh and try again.", ok: false, status: 403 };
  }
  return { ok: true, status: 200 };
}

function getClaymatchingServerConfig(env) {
  const supabaseSecretKey = String(env.SUPABASE_SECRET_KEY || "").trim();
  const sessionSecret = String(env.CLAYMATCHING_SESSION_SECRET || "").trim();
  const publishableKey = String(env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY).trim();
  let supabaseUrl;

  try {
    supabaseUrl = new URL(String(env.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim());
  } catch {
    supabaseUrl = null;
  }

  const configured = Boolean(
    supabaseUrl?.protocol === "https:" &&
    publishableKey &&
    supabaseSecretKey &&
    sessionSecret.length >= 32 &&
    String(env.HELIUS_API_KEY || "").trim() &&
    parseClaymatchingCollectionIds(env.CLAYMATCHING_COLLECTION_IDS).length,
  );
  const backendConfigured = Boolean(
    supabaseUrl?.protocol === "https:" &&
    publishableKey &&
    supabaseSecretKey &&
    sessionSecret.length >= 32,
  );

  return {
    backendConfigured,
    configured,
    publishableKey,
    sessionSecret,
    supabaseSecretKey,
    supabaseUrl,
  };
}

function getBearerToken(request) {
  const authorization = String(request.headers.get("Authorization") || "").trim();
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  const token = match?.[1] || "";
  return token.length >= 32 && token.length <= 16_384 ? token : "";
}

async function verifyClaymatchingSupabaseUser(accessToken, config) {
  const endpoint = new URL("/auth/v1/user", config.supabaseUrl);
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      apikey: config.publishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
    // Workers supports only "follow" and "manual". Manual keeps auth
    // verification fail-closed because any 3xx response remains non-ok below.
    redirect: "manual",
    signal: AbortSignal.timeout(8_000),
  });
  let payload = null;
  try {
    payload = await readBoundedResponseJson(response, 512 * 1024);
  } catch {
    // Authentication failures are intentionally normalized below.
  }
  if (!response.ok || !payload?.id) {
    const error = new Error("Supabase wallet session validation failed.");
    error.status = response.status === 401 || response.status === 403 ? 401 : 503;
    throw error;
  }
  return payload;
}

async function claymatchingSupabaseRpc(config, functionName, body) {
  const endpoint = new URL(`/rest/v1/rpc/${functionName}`, config.supabaseUrl);
  const headers = {
    Accept: "application/json",
    apikey: config.supabaseSecretKey,
    "Content-Profile": "public",
    "Content-Type": "application/json",
  };
  if (/^eyJ[A-Za-z0-9_-]+\./.test(config.supabaseSecretKey)) {
    headers.Authorization = `Bearer ${config.supabaseSecretKey}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    // Never forward the Supabase secret key to a redirected origin.
    redirect: "manual",
    signal: AbortSignal.timeout(8_000),
  });
  let payload = null;
  try {
    payload = await readBoundedResponseJson(response, 512 * 1024);
  } catch {
    // The caller receives a normalized server error without leaking backend details.
  }
  if (!response.ok) {
    const error = new Error(`Supabase RPC ${functionName} failed with status ${response.status}.`);
    error.status = response.status === 401 || response.status === 403 ? 503 : response.status === 404 ? 503 : 502;
    throw error;
  }
  return payload;
}

export function extractClaymatchingSolanaAddress(user) {
  const identities = Array.isArray(user?.identities) ? user.identities : [];

  for (const identity of identities) {
    const provider = String(identity?.provider || "").trim().toLowerCase();
    const identityData = identity?.identity_data && typeof identity.identity_data === "object"
      ? identity.identity_data
      : {};
    const chain = String(identityData.chain || identityData.blockchain || "").trim().toLowerCase();

    if (!provider.includes("web3") && !provider.includes("solana")) continue;
    if (chain && chain !== "solana") continue;

    const candidates = [
      identityData.address,
      identityData.wallet_address,
      identityData.walletAddress,
      identityData.public_key,
      identityData.publicKey,
      identityData.sub,
      identity?.provider_id,
    ];

    for (const candidate of candidates) {
      const raw = String(candidate || "").trim();
      const normalized = normalizeSolanaAddress(raw) || normalizeSolanaAddress(raw.split(":").at(-1));
      if (normalized) return normalized;
    }
  }

  return "";
}

function normalizeClaymatchingAccessDate(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeClaymatchingAccessState(value) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const signedSolanaAddress = normalizeSolanaAddress(raw.signed_solana_address);
  const signedSolanaVerifiedUntil = normalizeClaymatchingAccessDate(raw.signed_solana_verified_until);
  const readOnlySolanaAddress = normalizeSolanaAddress(raw.read_only_solana_address);
  const readOnlyCheckedAt = normalizeClaymatchingAccessDate(raw.read_only_checked_at);
  const readOnlyAccessUntil = normalizeClaymatchingAccessDate(raw.read_only_access_until);
  const suiAddress = normalizeClaymatchingSuiAddress(raw.sui_address);
  const suiVerifiedAt = normalizeClaymatchingAccessDate(raw.sui_verified_at);
  const signedSolanaActive = Boolean(
    signedSolanaAddress
      && signedSolanaVerifiedUntil
      && Date.parse(signedSolanaVerifiedUntil) > Date.now(),
  );
  const readOnlyActive = Boolean(
    readOnlySolanaAddress
      && readOnlyAccessUntil
      && Date.parse(readOnlyAccessUntil) > Date.now(),
  );
  const rawMode = String(raw.membership_mode || "").trim().toLowerCase();
  const membershipMode = signedSolanaActive
    ? "verified_solana"
    : readOnlyActive
    ? "read_only_solana"
    : ["verified_solana", "read_only_solana"].includes(rawMode)
    ? rawMode
    : null;
  const canPost = raw.can_post === true;
  const readOnlyAssetCount = Number(raw.read_only_asset_count);

  return {
    accountState: cleanClaymatchingOptionalText(raw.account_state, 40),
    canDm: canPost && raw.can_dm === true,
    canPost,
    consentCurrent: raw.consent_current === true,
    membershipMode,
    postingAccessUntil: normalizeClaymatchingAccessDate(raw.posting_access_until),
    profileExists: raw.profile_exists === true,
    readOnlyAccessUntil,
    readOnlyActive,
    readOnlyAssetCount: Number.isInteger(readOnlyAssetCount)
      ? Math.max(0, Math.min(200, readOnlyAssetCount))
      : 0,
    readOnlyCheckedAt,
    readOnlySolanaAddress,
    signedSolanaActive,
    signedSolanaAddress,
    signedSolanaVerifiedUntil,
    suiAddress,
    suiVerifiedAt: suiAddress ? suiVerifiedAt : null,
  };
}

async function loadClaymatchingAccessState(config, userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    const error = new Error("Claymatching access requires a user identity.");
    error.status = 401;
    throw error;
  }
  const result = await claymatchingSupabaseRpc(config, "get_clay_access_state", {
    raw_user_id: normalizedUserId,
  });
  const row = Array.isArray(result) ? result[0] : result;
  return {
    ...normalizeClaymatchingAccessState(row),
    userId: normalizedUserId,
  };
}

async function loadClaymatchingAuthorizedAssets(accessState, env, config, signedSolanaAssets) {
  if (!accessState?.canPost) return [];

  let assets = [];
  if (accessState.signedSolanaActive && accessState.signedSolanaAddress) {
    const claynoAssets = Array.isArray(signedSolanaAssets)
      ? signedSolanaAssets
      : await loadClaymatchingAssets(accessState.signedSolanaAddress, env);
    assets.push(...claynoAssets);
  }

  if (accessState.suiAddress && accessState.suiVerifiedAt) {
    try {
      const rows = await claymatchingSupabaseRpc(config, "get_clay_popkins_avatar_assets", {
        raw_user_id: accessState.userId,
      });
      assets.push(...normalizeStoredClaymatchingPopkinAssets(rows));
    } catch (error) {
      console.warn(JSON.stringify({
        event: "clay_popkins_avatar_restore_failed",
        message: error?.message || String(error),
      }));
    }
  }

  return assets;
}

function claymatchingAccessResponse(accessState, session, extras = {}) {
  const signedSolanaAddress = accessState.signedSolanaAddress || null;
  const readOnlySolanaAddress = accessState.readOnlySolanaAddress || null;
  const suiAddress = accessState.suiAddress || null;
  return {
    authenticated: true,
    canDm: accessState.canDm,
    canPost: accessState.canPost,
    connectedWallets: {
      solana: Boolean(signedSolanaAddress),
      sui: Boolean(suiAddress && accessState.suiVerifiedAt),
    },
    consentVersion: CLAYMATCHING_TERMS_VERSION,
    csrfToken: session.csrf,
    expiresAt: new Date(session.exp * 1000).toISOString(),
    holder: accessState.signedSolanaActive,
    holderVerifiedUntil: accessState.signedSolanaVerifiedUntil,
    membershipMode: accessState.membershipMode,
    postingAccessUntil: accessState.postingAccessUntil,
    readOnly: accessState.membershipMode === "read_only_solana",
    readOnlyAssetCount: accessState.readOnlyAssetCount,
    readOnlySolanaAddress,
    readOnlyWalletAddress: readOnlySolanaAddress,
    signedSolanaAddress,
    signedSolanaVerifiedUntil: accessState.signedSolanaVerifiedUntil,
    suiAddress,
    userId: session.sub,
    verified: accessState.signedSolanaActive,
    walletAddress: accessState.signedSolanaActive ? signedSolanaAddress : null,
    ...extras,
  };
}

function claymatchingSuiConnectionResponse(connection, accessState, session) {
  const connectionAddress = normalizeClaymatchingSuiAddress(connection?.wallet_address);
  const walletAddress = accessState.suiAddress || "";
  const linked = Boolean(walletAddress && accessState.suiVerifiedAt);
  const connectionMatches = linked && (!connectionAddress || connectionAddress === walletAddress);
  return {
    canDm: accessState.canDm,
    canPost: accessState.canPost,
    csrfToken: session.csrf,
    linked,
    membershipMode: accessState.membershipMode,
    popkinsCount: connectionMatches ? Math.max(0, Number(connection?.popkins_count || 0)) : 0,
    popkinsSource: connectionMatches ? connection?.popkins_source || null : null,
    popkinsSyncedAt: connectionMatches ? connection?.popkins_synced_at || null : null,
    postingAccessUntil: accessState.postingAccessUntil,
    readOnlySolanaAddress: accessState.readOnlySolanaAddress || null,
    signedSolanaAddress: accessState.signedSolanaAddress || null,
    suiAddress: linked ? walletAddress : null,
    verifiedAt: linked ? accessState.suiVerifiedAt : null,
    walletAddress: linked ? walletAddress : null,
    walletName: connectionMatches ? connection?.wallet_name || null : null,
  };
}

function claymatchingSessionCsrf(value) {
  const csrf = String(value || "");
  return csrf.length >= 16 && csrf.length <= 128 && /^[A-Za-z0-9_-]+$/.test(csrf)
    ? csrf
    : "";
}

async function createClaymatchingAccessSession({ accessState, csrfToken, userId }, secret) {
  if (!accessState?.canPost) {
    throw new Error("Posting access is required before creating a Claymatching session.");
  }
  const now = Math.floor(Date.now() / 1000);
  const postingAccessTimestamp = Date.parse(String(accessState.postingAccessUntil || ""));
  const postingAccessExpiry = Number.isFinite(postingAccessTimestamp)
    ? Math.floor(postingAccessTimestamp / 1000)
    : now + CLAYMATCHING_SESSION_TTL_SECONDS;
  const session = {
    canDm: accessState.canDm,
    canPost: accessState.canPost,
    csrf: claymatchingSessionCsrf(csrfToken) || randomBase64Url(24),
    exp: Math.min(now + CLAYMATCHING_SESSION_TTL_SECONDS, postingAccessExpiry),
    holderVerifiedUntil: accessState.signedSolanaVerifiedUntil,
    iat: now,
    membershipMode: accessState.membershipMode,
    postingAccessUntil: accessState.postingAccessUntil,
    sub: String(userId || "").trim(),
    sui: accessState.suiAddress && accessState.suiVerifiedAt ? accessState.suiAddress : null,
    v: 2,
    wallet: accessState.signedSolanaActive ? accessState.signedSolanaAddress : null,
  };
  if (!session.sub || session.exp <= now) {
    throw new Error("Claymatching posting access expired before the session could be created.");
  }
  return {
    session,
    token: await signClaymatchingSession(session, secret),
  };
}

function claymatchingSessionMatchesAccessState(session, accessState) {
  if (session?.v !== 2) return false;
  const expectedWallet = accessState.signedSolanaActive ? accessState.signedSolanaAddress : null;
  const expectedSui = accessState.suiAddress && accessState.suiVerifiedAt ? accessState.suiAddress : null;
  return session.canPost === accessState.canPost
    && session.canDm === accessState.canDm
    && session.membershipMode === accessState.membershipMode
    && (session.wallet || null) === expectedWallet
    && (session.sui || null) === expectedSui
    && normalizeClaymatchingAccessDate(session.holderVerifiedUntil) === accessState.signedSolanaVerifiedUntil
    && normalizeClaymatchingAccessDate(session.postingAccessUntil) === accessState.postingAccessUntil;
}

async function signClaymatchingSession(payload, secret) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacHex(secret, encodedPayload);
  return `${encodedPayload}.${signature}`;
}

async function readClaymatchingSignedPayload(token, secret) {
  const value = String(token || "").trim();
  if (secret.length < 32 || value.length < 40 || value.length > 8192) return null;
  const separatorIndex = value.lastIndexOf(".");
  if (separatorIndex <= 0) return null;
  const encodedPayload = value.slice(0, separatorIndex);
  const providedSignature = value.slice(separatorIndex + 1);
  const expectedSignature = await hmacHex(secret, encodedPayload);
  if (!timingSafeEqualHex(providedSignature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecodeText(encodedPayload));
    return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
}

async function readClaymatchingSession(request, env) {
  const secret = String(env.CLAYMATCHING_SESSION_SECRET || "").trim();
  const token = getCookie(request, CLAYMATCHING_SESSION_COOKIE);
  if (secret.length < 32 || !token) return null;
  const payload = await readClaymatchingSignedPayload(token, secret);
  const now = Math.floor(Date.now() / 1000);
  if (
    !payload
      || typeof payload.sub !== "string"
      || !payload.sub.trim()
      || !claymatchingSessionCsrf(payload.csrf)
      || !Number.isInteger(payload.iat)
      || !Number.isInteger(payload.exp)
      || payload.iat > now + 60
      || payload.exp <= now
      || payload.exp - payload.iat > CLAYMATCHING_SESSION_TTL_SECONDS + 60
  ) {
    return null;
  }

  if (payload.v === 1) {
    const wallet = normalizeSolanaAddress(payload.wallet);
    if (!wallet) return null;
    return {
      ...payload,
      canDm: true,
      canPost: true,
      membershipMode: "verified_solana",
      wallet,
    };
  }

  const wallet = payload.wallet == null ? null : normalizeSolanaAddress(payload.wallet);
  const sui = payload.sui == null ? null : normalizeClaymatchingSuiAddress(payload.sui);
  if (
    payload.v !== 2
      || typeof payload.canPost !== "boolean"
      || typeof payload.canDm !== "boolean"
      || !["verified_solana", "read_only_solana"].includes(payload.membershipMode)
      || (payload.wallet != null && !wallet)
      || (payload.sui != null && !sui)
  ) {
    return null;
  }
  return { ...payload, sui, wallet };
}

function base64UrlDecodeText(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function claymatchingSessionCookie(token) {
  return `${CLAYMATCHING_SESSION_COOKIE}=${token}; Max-Age=${CLAYMATCHING_SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

function clearClaymatchingSessionCookie() {
  return `${CLAYMATCHING_SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

function isSameOriginBrowserRequest(request) {
  const origin = request.headers.get("Origin");
  if (String(request.headers.get("Sec-Fetch-Site") || "").toLowerCase() === "cross-site") {
    return false;
  }
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function getClaymatchingCorsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = String(env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const headers = {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, X-Clay-CSRF",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Cache-Control": "private, no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function isClaymatchingHost(hostname, env) {
  const configuredHosts = String(env.CLAYMATCHING_HOSTS || DEFAULT_CLAYMATCHING_HOSTS.join(","))
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return configuredHosts.includes(String(hostname || "").toLowerCase());
}

function getNoctweaveRelayProfile(hostname, env) {
  const normalizedHost = String(hostname || "").trim().toLowerCase();
  if (!normalizedHost || !isClaymatchingHost(normalizedHost, env)) return null;

  return {
    endpoint: scopedNoctweaveRelayEndpoint(env.NOCTWEAVE_RELAY_URL, normalizedHost),
    federationDescription: cleanRelayText(
      env.NOCTWEAVE_FEDERATION_DESCRIPTION
        || "Cloudflare relay for sealed Noctweave envelopes used only by Claymatching.",
      512,
    ),
    federationName: cleanRelayText(env.NOCTWEAVE_FEDERATION_NAME || "luna-claymatching", 128),
    objectName: cleanRelayText(env.NOCTWEAVE_RELAY_OBJECT_NAME || NOCTWEAVE_CLAYMATCHING_RELAY_OBJECT_NAME, 128),
    relayName: cleanRelayText(env.NOCTWEAVE_RELAY_NAME || "Luna Claymatching Encrypted Relay", 128),
    scope: "claymatching",
  };
}

function scopedNoctweaveRelayEndpoint(configuredURL, hostname) {
  const configured = cleanRelayEndpoint(relayEndpointFromURL(configuredURL));
  if (
    configured
      && configured.host === hostname
      && configured.port === 443
      && configured.transport === "http"
      && configured.useTLS === true
  ) {
    return configured;
  }
  return { host: hostname, port: 443, transport: "http", useTLS: true };
}

function withMutableAssetCacheHeaders(request, response, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const contentType = response.headers.get("content-type") || "";
  const isClaymatchingAsset = isClaymatchingHost(url.hostname, env);
  const shouldNoStore =
    NO_STORE_ASSET_PATHS.has(pathname) ||
    pathname.endsWith(".html") ||
    NO_STORE_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    contentType.includes("text/html");

  if (!shouldNoStore && !isClaymatchingAsset) {
    return response;
  }

  const headers = new Headers(response.headers);
  if (shouldNoStore) {
    headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
  }
  if (isClaymatchingAsset) {
    headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
    headers.set("Referrer-Policy", "no-referrer");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isNoctweaveRelayPath(pathname) {
  return [
    "/relay",
    "/health",
    "/info",
    "/api/noctweave/relays",
    "/api/noctweave/relay",
    "/api/noctweave/health",
    "/api/noctweave/info",
  ].includes(pathname);
}

async function handleNoctweaveRelayRequest(request, env, relayProfile) {
  const url = new URL(request.url);
  const corsHeaders = getNoctweaveCorsHeaders(request, env, relayProfile);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if ((url.pathname === "/health" || url.pathname === "/api/noctweave/health") && (request.method === "GET" || request.method === "HEAD")) {
    return json({ type: "ok", status: "ok" }, 200, corsHeaders);
  }

  if ((url.pathname === "/info" || url.pathname === "/api/noctweave/info") && (request.method === "GET" || request.method === "HEAD")) {
    return json(noctweaveRelayInfoResponse(env, relayProfile), 200, corsHeaders);
  }

  if (url.pathname === "/api/noctweave/relays") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json(noctweaveRelayError("Use GET /api/noctweave/relays for Luna relay discovery."), 405, {
        ...corsHeaders,
        Allow: "GET, HEAD, OPTIONS",
      });
    }

    if (!env.NOCTWEAVE_RELAY || configuredNoctweaveRelayOwnerHost(env)) {
      return json(noctweaveRelayDirectoryResponse(env, relayProfile), 200, corsHeaders);
    }

    const stub = env.NOCTWEAVE_RELAY.getByName(relayProfile.objectName);
    return stub.fetch(request);
  }

  if (request.method !== "POST") {
    return json(noctweaveRelayError("Use POST /relay for Noctweave relay requests."), 405, {
      ...corsHeaders,
      Allow: "POST, OPTIONS",
    });
  }

  if (!env.NOCTWEAVE_RELAY) {
    return json(noctweaveRelayError("Noctweave relay Durable Object binding is not configured."), 503, corsHeaders);
  }

  const stub = env.NOCTWEAVE_RELAY.getByName(relayProfile.objectName);
  const ownerHost = configuredNoctweaveRelayOwnerHost(env);
  const relayRequest = ownerHost
    ? noctweaveRelayOwnerRequest(request, ownerHost)
    : request;
  const response = await stub.fetch(relayRequest);
  return ownerHost
    ? withNoctweaveRelayCorsHeaders(response, corsHeaders)
    : response;
}

function configuredNoctweaveRelayOwnerHost(env) {
  const candidate = cleanRelayText(env.NOCTWEAVE_RELAY_OWNER_HOST, 253).toLowerCase();
  if (!candidate) return "";

  try {
    const url = new URL(`https://${candidate}`);
    return url.hostname === candidate && !url.port && url.pathname === "/" ? candidate : "";
  } catch {
    return "";
  }
}

function noctweaveRelayOwnerRequest(request, ownerHost) {
  const url = new URL(request.url);
  url.hostname = ownerHost;
  url.port = "";
  return new Request(url, request);
}

function withNoctweaveRelayCorsHeaders(response, corsHeaders) {
  const headers = new Headers(response.headers);
  for (const name of [...headers.keys()]) {
    if (name.toLowerCase().startsWith("access-control-")) headers.delete(name);
  }
  for (const [name, value] of Object.entries(corsHeaders)) headers.set(name, value);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function noctweaveRelayInfoResponse(env, relayProfile) {
  const federationConfig = noctweaveFederationConfig(env, relayProfile);

  return {
    type: "info",
    relayInfo: {
      kind: "standard",
      federation: {
        mode: federationConfig.mode,
        name: federationConfig.name,
        description: federationConfig.description,
      },
      temporalBucketSeconds: 60,
      attachmentsEnabled: true,
      attachmentDefaultTTLSeconds: NOCTWEAVE_DEFAULT_ATTACHMENT_TTL_SECONDS,
      attachmentMaxTTLSeconds: NOCTWEAVE_DEFAULT_ATTACHMENT_TTL_SECONDS,
      attachmentStorageBackend: "durableObject",
      relayName: relayProfile.relayName,
      operatorNote: federationConfig.forwardingEnabled
        ? "Luna-operated encrypted relay. Stores opaque ciphertext envelopes only. Compatible HTTP relay forwarding is enabled."
        : "Luna-operated encrypted relay. Stores opaque ciphertext envelopes only. Federation forwarding is disabled.",
      softwareVersion: NOCTWEAVE_RELAY_VERSION,
      requiresPassword: false,
      tlsEnabled: true,
      transport: "http",
      advertisedAt: iso8601NoMilliseconds(new Date()),
    },
  };
}

function noctweaveRelayDirectoryResponse(env, relayProfile, extraRelays = []) {
  const relays = mergeNoctweaveRelayRecords([
    ...knownNoctweaveRelayRecords(env, relayProfile),
    ...extraRelays,
  ]);

  return {
    type: "relayDirectory",
    strategy: "luna-primary",
    note: "The Luna Cloudflare relay is the primary encrypted-message route. Additional relays appear only when explicitly configured and validated.",
    relays,
  };
}

function noctweaveFederationConfig(env, relayProfile) {
  const isLunaRelay = relayProfile.scope === "luna";
  const mode = cleanRelayText(
    (isLunaRelay ? env.LUNA_NOCTWEAVE_FEDERATION_MODE : env.NOCTWEAVE_FEDERATION_MODE) || "solo",
    32,
  );
  const normalizedMode = ["solo", "manual", "curated", "open"].includes(mode) ? mode : "solo";
  const forwardingEnabledValue = isLunaRelay
    ? env.LUNA_NOCTWEAVE_FEDERATION_FORWARDING_ENABLED
    : env.NOCTWEAVE_FEDERATION_FORWARDING_ENABLED;
  const allowPrivateEndpointsValue = isLunaRelay
    ? env.LUNA_NOCTWEAVE_ALLOW_PRIVATE_FEDERATION_ENDPOINTS
    : env.NOCTWEAVE_ALLOW_PRIVATE_FEDERATION_ENDPOINTS;
  const allowLiveRegistrationValue = isLunaRelay
    ? env.LUNA_NOCTWEAVE_FEDERATION_ALLOW_LIVE_REGISTRATION
    : env.NOCTWEAVE_FEDERATION_ALLOW_LIVE_REGISTRATION;

  return {
    mode: normalizedMode,
    name: relayProfile.federationName,
    description: relayProfile.federationDescription,
    forwardingEnabled: normalizedMode !== "solo" && forwardingEnabledValue !== "false",
    allowPrivateEndpoints: allowPrivateEndpointsValue === "true",
    allowLiveRegistration: allowLiveRegistrationValue === "true",
    forwardingAuthToken: cleanRelayText(
      isLunaRelay ? env.LUNA_NOCTWEAVE_FEDERATION_FORWARDING_AUTH_TOKEN : env.NOCTWEAVE_FEDERATION_FORWARDING_AUTH_TOKEN,
      512,
    ),
    registrationToken: cleanRelayText(
      isLunaRelay ? env.LUNA_NOCTWEAVE_FEDERATION_REGISTRATION_TOKEN : env.NOCTWEAVE_FEDERATION_REGISTRATION_TOKEN,
      512,
    ),
    staticAllowList: parseRelayEndpointList(
      isLunaRelay ? env.LUNA_NOCTWEAVE_FEDERATION_ALLOW : env.NOCTWEAVE_FEDERATION_ALLOW,
    ),
  };
}

function noctweaveActorProofMode(env) {
  const mode = cleanRelayText(env?.NOCTWEAVE_ACTOR_PROOF_MODE || "enforce", 16).toLowerCase();
  return ["enforce", "report", "off"].includes(mode) ? mode : "enforce";
}

function noctweaveRelayError(message) {
  return { type: "error", error: message };
}

function noctweaveOK() {
  return { type: "ok" };
}

function iso8601NoMilliseconds(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function cleanRelayText(value, maxLength = 256) {
  return String(value || "").trim().slice(0, maxLength);
}

function ttlExpiry(ttlSeconds, defaultSeconds) {
  const normalized = Number(ttlSeconds || defaultSeconds);
  const bounded = Math.min(Math.max(Number.isFinite(normalized) ? normalized : defaultSeconds, 60), 7 * 24 * 60 * 60);
  return iso8601NoMilliseconds(new Date(Date.now() + bounded * 1000));
}

function isFutureTimestamp(value) {
  return Date.parse(value || "") > Date.now();
}

function knownNoctweaveRelayRecords(env, relayProfile) {
  const now = new Date();
  const lastHeartbeatAt = iso8601NoMilliseconds(now);
  const expiresAt = iso8601NoMilliseconds(new Date(now.getTime() + NOCTWEAVE_FEDERATION_DIRECTORY_TTL_SECONDS * 1000));
  return [
    {
      endpoint: relayProfile.endpoint,
      relayInfo: noctweaveRelayInfoResponse(env, relayProfile).relayInfo,
      lastHeartbeatAt,
      expiresAt,
    },
  ];
}

function relayEndpointFromURL(value) {
  try {
    const raw = String(value || "").trim();
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    const useTLS = parsed.protocol === "https:" || parsed.protocol === "wss:" || parsed.protocol === "tls:";
    const isWebSocket = parsed.protocol === "ws:" || parsed.protocol === "wss:";
    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
    const fallbackPort = useTLS ? 443 : 80;
    return {
      host: parsed.hostname,
      port: Number(parsed.port || fallbackPort),
      useTLS,
      transport: isWebSocket ? "websocket" : isHttp ? "http" : "tcp",
    };
  } catch {
    return null;
  }
}

function parseRelayEndpointList(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(relayEndpointFromURL)
    .map(cleanRelayEndpoint)
    .filter(Boolean);
}

function cleanRelayEndpoint(endpoint) {
  if (!endpoint || typeof endpoint !== "object") {
    return null;
  }

  const host = cleanRelayText(endpoint.host, 253).toLowerCase();
  const port = Number(endpoint.port);
  const transport = ["tcp", "http", "websocket"].includes(endpoint.transport) ? endpoint.transport : "tcp";

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return {
    host,
    port,
    useTLS: Boolean(endpoint.useTLS),
    transport,
  };
}

function relayEndpointKey(endpoint) {
  const normalized = cleanRelayEndpoint(endpoint);

  if (!normalized) {
    return "";
  }

  return `${normalized.transport}:${normalized.useTLS ? "tls" : "plain"}:${normalized.host}:${normalized.port}`;
}

function relayEndpointsMatch(left, right) {
  const normalizedLeft = cleanRelayEndpoint(left);
  const normalizedRight = cleanRelayEndpoint(right);

  return Boolean(
    normalizedLeft
      && normalizedRight
      && normalizedLeft.host === normalizedRight.host
      && normalizedLeft.port === normalizedRight.port
      && normalizedLeft.useTLS === normalizedRight.useTLS
      && normalizedLeft.transport === normalizedRight.transport,
  );
}

function isLocalNoctweaveRelayEndpoint(endpoint, relayProfile) {
  const normalized = cleanRelayEndpoint(endpoint);
  if (!normalized) return false;
  return relayEndpointsMatch(normalized, relayProfile.endpoint);
}

function mergeNoctweaveRelayRecords(records) {
  const merged = new Map();

  for (const record of records) {
    const endpoint = cleanRelayEndpoint(record?.endpoint);
    const key = relayEndpointKey(endpoint);

    if (!key || !record?.relayInfo) {
      continue;
    }

    const normalized = {
      ...record,
      endpoint,
    };
    const existing = merged.get(key);

    if (!existing || Date.parse(normalized.lastHeartbeatAt || "") > Date.parse(existing.lastHeartbeatAt || "")) {
      merged.set(key, normalized);
    }
  }

  return [...merged.values()].sort((left, right) => {
    const leftHeartbeat = Date.parse(left.lastHeartbeatAt || "") || 0;
    const rightHeartbeat = Date.parse(right.lastHeartbeatAt || "") || 0;

    if (leftHeartbeat !== rightHeartbeat) {
      return rightHeartbeat - leftHeartbeat;
    }

    return relayEndpointKey(left.endpoint).localeCompare(relayEndpointKey(right.endpoint));
  });
}

export class LunaNoctweaveRelay {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async alarm() {
    try {
      const backfillPending = await this.backfillAttachmentExpiryMarkers();
      const nextExpiry = await this.cleanupExpiredAttachmentChunks();

      if (backfillPending) {
        await this.setAttachmentCleanupAlarm(Date.now() + 1_000);
      } else if (nextExpiry) {
        await this.setAttachmentCleanupAlarm(Math.max(nextExpiry, Date.now() + 1_000));
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: "noctweave_attachment_cleanup_error",
        message: error.message || String(error),
      }));
      await this.setAttachmentCleanupAlarm(Date.now() + NOCTWEAVE_ATTACHMENT_CLEANUP_RETRY_MS);
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const relayProfile = getNoctweaveRelayProfile(url.hostname, this.env);

    if (!relayProfile) {
      return new Response("Not found", { status: 404 });
    }
    const corsHeaders = getNoctweaveCorsHeaders(request, this.env, relayProfile);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if ((url.pathname === "/health" || url.pathname === "/api/noctweave/health") && (request.method === "GET" || request.method === "HEAD")) {
      return json({ type: "ok", status: "ok" }, 200, corsHeaders);
    }

    if ((url.pathname === "/info" || url.pathname === "/api/noctweave/info") && (request.method === "GET" || request.method === "HEAD")) {
      return json(noctweaveRelayInfoResponse(this.env, relayProfile), 200, corsHeaders);
    }

    if (url.pathname === "/api/noctweave/relays" && (request.method === "GET" || request.method === "HEAD")) {
      return json(await this.relayDirectory(relayProfile), 200, corsHeaders);
    }

    if (request.method !== "POST") {
      return json(noctweaveRelayError("Use POST /relay for Noctweave relay requests."), 405, corsHeaders);
    }

    let relayRequest;

    try {
      relayRequest = await readJsonBody(
        request,
        NOCTWEAVE_MAX_REQUEST_BYTES,
        "Noctweave relay request is too large.",
      );
    } catch (error) {
      return json(noctweaveRelayError(error.message || "Invalid Noctweave relay request."), 400, corsHeaders);
    }

    try {
      return json(await this.handleRelayRequest(relayRequest, relayProfile), 200, corsHeaders);
    } catch (error) {
      console.error(JSON.stringify({
        event: "noctweave_relay_error",
        type: relayRequest?.type || "unknown",
        message: error.message || String(error),
      }));
      return json(noctweaveRelayError(error.message || "Noctweave relay request failed."), 500, corsHeaders);
    }
  }

  async handleRelayRequest(request, relayProfile) {
    switch (request?.type) {
      case "health":
        return noctweaveOK();
      case "info":
        return noctweaveRelayInfoResponse(this.env, relayProfile);
      case "registerInbox":
        return this.registerInbox(request.registerInbox);
      case "deliver":
        return this.deliver(request.deliver, relayProfile);
      case "fetch":
        return this.fetchMessages(request.fetch);
      case "acknowledgeMessages":
        return this.acknowledgeMessages(request.acknowledgeMessages);
      case "announce":
        return this.announce(request.announce);
      case "listAnnouncements":
        return this.listAnnouncements(request.listAnnouncements);
      case "sendPairRequest":
        return this.sendPairRequest(request.sendPairRequest);
      case "fetchPairRequests":
        return this.fetchPairRequests(request.fetchPairRequests);
      case "uploadPrekeys":
        return this.uploadPrekeys(request.uploadPrekeys);
      case "fetchPrekeyBundle":
        return this.fetchPrekeyBundle(request.fetchPrekeyBundle);
      case "registerFederationNode":
        return this.registerFederationNode(request.registerFederationNode, request.authToken, relayProfile);
      case "listFederationNodes":
        return this.listFederationNodes(request.listFederationNodes, relayProfile);
      case "deliverGroupMessage":
        return this.deliverGroupMessage(request.deliverGroupMessage, relayProfile);
      case "uploadAttachment":
        return this.uploadAttachment(request.uploadAttachment);
      case "fetchAttachment":
        return this.fetchAttachment(request.fetchAttachment);
      default:
        return noctweaveRelayError(`Relay request type ${request?.type || "unknown"} is not supported by the Luna Cloudflare relay.`);
    }
  }

  async registerInbox(registerInbox) {
    const inboxId = cleanRelayText(registerInbox?.inboxId);
    const accessPublicKey = registerInbox?.accessPublicKey;

    if (!inboxId || !accessPublicKey) {
      return noctweaveRelayError("registerInbox requires inboxId and accessPublicKey.");
    }

    const boundInboxId = await deriveNoctweaveInboxId(accessPublicKey);

    if (!boundInboxId || boundInboxId !== inboxId.toLowerCase()) {
      return noctweaveRelayError("registerInbox inboxId is not bound to accessPublicKey.");
    }

    const contactOffer = registerInbox.contactOffer || null;

    if (contactOffer) {
      if (cleanRelayText(contactOffer.inboxId)?.toLowerCase() !== boundInboxId) {
        return noctweaveRelayError("registerInbox contact offer inbox does not match accessPublicKey.");
      }

      if (!noctweaveDataEqual(contactOffer.inboxAccessPublicKey, accessPublicKey)) {
        return noctweaveRelayError("registerInbox contact offer access key mismatch.");
      }
    }

    const proofFailure = await this.requireActorProof({
      type: "registerInbox",
      request: registerInbox,
      proof: registerInbox.accessProof,
      expectedFingerprint: await noctweaveFingerprint(accessPublicKey),
      expectedPublicKey: accessPublicKey,
    });

    if (proofFailure) {
      return proofFailure;
    }

    const inboxes = await this.readObject(NOCTWEAVE_STORAGE_KEYS.inboxes);
    inboxes[boundInboxId] = {
      inboxId: boundInboxId,
      accessPublicKey,
      contactOffer,
      registeredAt: iso8601NoMilliseconds(new Date()),
    };
    await this.state.storage.put(NOCTWEAVE_STORAGE_KEYS.inboxes, inboxes);
    return noctweaveOK();
  }

  async deliver(deliver, relayProfile) {
    const inboxId = cleanRelayText(deliver?.inboxId);
    const routingToken = cleanRelayText(deliver?.routingToken || deliver?.inboxId);
    const envelope = deliver?.envelope;
    const destinationRelay = cleanRelayEndpoint(deliver?.destinationRelay);

    if (!inboxId || !envelope?.id) {
      return noctweaveRelayError("deliver requires inboxId and envelope.id.");
    }

    if (destinationRelay && !isLocalNoctweaveRelayEndpoint(destinationRelay, relayProfile)) {
      return this.forwardRelayDelivery("deliver", {
        inboxId,
        routingToken,
        envelope,
      }, destinationRelay, relayProfile);
    }

    const allMessages = await this.readObject(NOCTWEAVE_STORAGE_KEYS.messages);
    const messages = Array.isArray(allMessages[routingToken]) ? allMessages[routingToken] : [];
    const existing = messages.find((message) => message.id === envelope.id);

    if (existing && canonicalNoctweaveJSON(existing) !== canonicalNoctweaveJSON(envelope)) {
      return noctweaveRelayError("Envelope identifier was reused with different ciphertext.");
    }

    if (!existing) {
      messages.push(envelope);
    }

    allMessages[routingToken] = messages.slice(-NOCTWEAVE_MAX_MESSAGES_PER_INBOX);
    await this.state.storage.put(NOCTWEAVE_STORAGE_KEYS.messages, allMessages);
    return { type: "delivered", delivered: { storedCount: existing ? 0 : 1 } };
  }

  async deliverGroupMessage(deliver, relayProfile) {
    const groupId = cleanRelayText(deliver?.groupId);
    const groupInboxId = cleanRelayText(deliver?.groupInboxId);
    const envelope = deliver?.envelope;
    const destinationRelay = cleanRelayEndpoint(deliver?.destinationRelay);

    if (!groupId || !groupInboxId || !envelope?.id) {
      return noctweaveRelayError("deliverGroupMessage requires groupId, groupInboxId, and envelope.id.");
    }

    if (!destinationRelay || isLocalNoctweaveRelayEndpoint(destinationRelay, relayProfile)) {
      return noctweaveRelayError("Local group message storage is not implemented in the Luna Cloudflare shim yet.");
    }

    return this.forwardRelayDelivery("deliverGroupMessage", {
      groupId,
      groupInboxId,
      envelope,
    }, destinationRelay, relayProfile);
  }

  async fetchMessages(fetchRequest) {
    const inboxId = cleanRelayText(fetchRequest?.inboxId);
    const routingToken = cleanRelayText(fetchRequest?.routingToken || fetchRequest?.inboxId);

    if (!inboxId || !routingToken) {
      return noctweaveRelayError("fetch requires inboxId.");
    }

    const inboxes = await this.readObject(NOCTWEAVE_STORAGE_KEYS.inboxes);
    const inbox = inboxes[routingToken];

    if (!inbox?.accessPublicKey) {
      return noctweaveRelayError("Inbox is not registered.");
    }

    const proofFailure = await this.requireActorProof({
      type: "fetch",
      request: fetchRequest,
      proof: fetchRequest.accessProof,
      expectedFingerprint: await noctweaveFingerprint(inbox.accessPublicKey),
      expectedPublicKey: inbox.accessPublicKey,
    });

    if (proofFailure) {
      return proofFailure;
    }

    const allMessages = await this.readObject(NOCTWEAVE_STORAGE_KEYS.messages);
    const messages = Array.isArray(allMessages[routingToken]) ? allMessages[routingToken] : [];
    const requestedMax = Number(fetchRequest?.maxCount || 25);
    const maxCount = Math.min(Math.max(Number.isFinite(requestedMax) ? requestedMax : 25, 1), NOCTWEAVE_MAX_FETCH_COUNT);
    return { type: "messages", messages: messages.slice(0, maxCount) };
  }

  async acknowledgeMessages(acknowledgement) {
    const inboxId = cleanRelayText(acknowledgement?.inboxId);
    const ids = new Set(Array.isArray(acknowledgement?.messageIds) ? acknowledgement.messageIds.map(String) : []);

    if (!inboxId) {
      return noctweaveRelayError("acknowledgeMessages requires inboxId.");
    }

    if (ids.size === 0 || ids.size > 1_000) {
      return noctweaveRelayError("acknowledgeMessages requires 1 to 1000 messageIds.");
    }

    const inboxes = await this.readObject(NOCTWEAVE_STORAGE_KEYS.inboxes);
    const inbox = inboxes[inboxId];

    if (!inbox?.accessPublicKey) {
      return noctweaveRelayError("Inbox is not registered.");
    }

    const proofFailure = await this.requireActorProof({
      type: "acknowledgeMessages",
      request: acknowledgement,
      proof: acknowledgement.accessProof,
      expectedFingerprint: await noctweaveFingerprint(inbox.accessPublicKey),
      expectedPublicKey: inbox.accessPublicKey,
    });

    if (proofFailure) {
      return proofFailure;
    }

    const allMessages = await this.readObject(NOCTWEAVE_STORAGE_KEYS.messages);
    const messages = Array.isArray(allMessages[inboxId]) ? allMessages[inboxId] : [];
    allMessages[inboxId] = messages.filter((message) => !ids.has(String(message.id)));
    await this.state.storage.put(NOCTWEAVE_STORAGE_KEYS.messages, allMessages);
    return noctweaveOK();
  }

  async announce(announce) {
    if (!announce?.offer) {
      return noctweaveRelayError("announce requires a contact offer.");
    }

    const announcements = await this.readArray(NOCTWEAVE_STORAGE_KEYS.announcements);
    const now = new Date();
    announcements.push({
      id: crypto.randomUUID(),
      offer: announce.offer,
      announcedAt: iso8601NoMilliseconds(now),
      expiresAt: ttlExpiry(announce.ttlSeconds, NOCTWEAVE_DEFAULT_ANNOUNCEMENT_TTL_SECONDS),
    });
    await this.state.storage.put(
      NOCTWEAVE_STORAGE_KEYS.announcements,
      announcements.filter((entry) => isFutureTimestamp(entry.expiresAt)).slice(-250),
    );
    return noctweaveOK();
  }

  async listAnnouncements(listAnnouncements) {
    const requestedLimit = Number(listAnnouncements?.limit || 50);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 50, 1), 100);
    const announcements = (await this.readArray(NOCTWEAVE_STORAGE_KEYS.announcements))
      .filter((entry) => isFutureTimestamp(entry.expiresAt));
    await this.state.storage.put(NOCTWEAVE_STORAGE_KEYS.announcements, announcements);
    return { type: "announcements", announcements: announcements.slice(-limit).reverse() };
  }

  async sendPairRequest(pairRequest) {
    const targetFingerprint = cleanRelayText(pairRequest?.targetFingerprint);

    if (!targetFingerprint || !pairRequest?.offer) {
      return noctweaveRelayError("sendPairRequest requires targetFingerprint and offer.");
    }

    const proofFailure = await this.requireActorProof({
      type: "sendPairRequest",
      request: pairRequest,
      proof: pairRequest.actorProof,
      expectedFingerprint: cleanRelayText(pairRequest.offer.fingerprint),
      expectedPublicKey: pairRequest.offer.signingPublicKey,
    });

    if (proofFailure) {
      return proofFailure;
    }

    const pairRequests = await this.readObject(NOCTWEAVE_STORAGE_KEYS.pairRequests);
    const targetRequests = Array.isArray(pairRequests[targetFingerprint]) ? pairRequests[targetFingerprint] : [];
    targetRequests.push({
      id: crypto.randomUUID(),
      from: pairRequest.offer,
      sentAt: iso8601NoMilliseconds(new Date()),
    });
    pairRequests[targetFingerprint] = targetRequests.slice(-100);
    await this.state.storage.put(NOCTWEAVE_STORAGE_KEYS.pairRequests, pairRequests);
    return noctweaveOK();
  }

  async fetchPairRequests(fetchPairRequests) {
    const fingerprint = cleanRelayText(fetchPairRequests?.fingerprint);

    if (!fingerprint) {
      return noctweaveRelayError("fetchPairRequests requires fingerprint.");
    }

    const proofFailure = await this.requireActorProof({
      type: "fetchPairRequests",
      request: fetchPairRequests,
      proof: fetchPairRequests.actorProof,
      expectedFingerprint: fingerprint,
    });

    if (proofFailure) {
      return proofFailure;
    }

    const requestedMax = Number(fetchPairRequests?.maxCount || 25);
    const maxCount = Math.min(Math.max(Number.isFinite(requestedMax) ? requestedMax : 25, 1), 100);
    const pairRequests = await this.readObject(NOCTWEAVE_STORAGE_KEYS.pairRequests);
    const targetRequests = Array.isArray(pairRequests[fingerprint]) ? pairRequests[fingerprint] : [];
    return { type: "pairRequests", pairRequests: targetRequests.slice(0, maxCount) };
  }

  async uploadPrekeys(uploadPrekeys) {
    const fingerprint = cleanRelayText(uploadPrekeys?.fingerprint);

    if (!fingerprint || !uploadPrekeys?.bundle) {
      return noctweaveRelayError("uploadPrekeys requires fingerprint and bundle.");
    }

    if (cleanRelayText(uploadPrekeys.bundle.identityFingerprint) !== fingerprint) {
      return noctweaveRelayError("Prekey bundle fingerprint mismatch.");
    }

    const proofFailure = await this.requireActorProof({
      type: "uploadPrekeys",
      request: uploadPrekeys,
      proof: uploadPrekeys.actorProof,
      expectedFingerprint: fingerprint,
    });

    if (proofFailure) {
      return proofFailure;
    }

    const prekeys = await this.readObject(NOCTWEAVE_STORAGE_KEYS.prekeys);
    prekeys[fingerprint] = {
      bundle: uploadPrekeys.bundle,
      expiresAt: ttlExpiry(uploadPrekeys.ttlSeconds, 7 * 24 * 60 * 60),
      updatedAt: iso8601NoMilliseconds(new Date()),
    };
    await this.state.storage.put(NOCTWEAVE_STORAGE_KEYS.prekeys, prekeys);
    return noctweaveOK();
  }

  async fetchPrekeyBundle(fetchPrekeyBundle) {
    const fingerprint = cleanRelayText(fetchPrekeyBundle?.fingerprint);

    if (!fingerprint) {
      return noctweaveRelayError("fetchPrekeyBundle requires fingerprint.");
    }

    const prekeys = await this.readObject(NOCTWEAVE_STORAGE_KEYS.prekeys);
    const entry = prekeys[fingerprint];
    return {
      type: "prekeyBundle",
      prekeyBundle: entry && isFutureTimestamp(entry.expiresAt) ? entry.bundle : null,
    };
  }

  async relayDirectory(relayProfile) {
    const response = await this.listFederationNodes({}, relayProfile);
    return noctweaveRelayDirectoryResponse(this.env, relayProfile, response.federationNodes || []);
  }

  async requireActorProof({ type, request, proof, expectedFingerprint = "", expectedPublicKey = null }) {
    const mode = noctweaveActorProofMode(this.env);

    if (mode === "off") {
      return null;
    }

    const result = await verifyNoctweaveActorProof({
      type,
      request,
      proof,
      expectedFingerprint,
      expectedPublicKey,
    });

    if (!result.ok) {
      if (mode === "report") {
        console.warn(JSON.stringify({ event: "noctweave_actor_proof_report", type, error: result.error }));
        return null;
      }
      return noctweaveRelayError(result.error);
    }

    const nonces = await this.readObject(NOCTWEAVE_STORAGE_KEYS.actorProofNonces);
    const now = Date.now();

    for (const [key, expiresAt] of Object.entries(nonces)) {
      if ((Date.parse(expiresAt) || 0) <= now) {
        delete nonces[key];
      }
    }

    if (nonces[result.nonceKey]) {
      if (mode === "report") {
        console.warn(JSON.stringify({ event: "noctweave_actor_proof_replay_report", type }));
        return null;
      }
      return noctweaveRelayError("Actor proof replay detected.");
    }

    nonces[result.nonceKey] = result.expiresAt;
    const bounded = Object.fromEntries(
      Object.entries(nonces)
        .sort((left, right) => (Date.parse(right[1]) || 0) - (Date.parse(left[1]) || 0))
        .slice(0, NOCTWEAVE_MAX_ACTOR_PROOF_NONCES),
    );
    await this.state.storage.put(NOCTWEAVE_STORAGE_KEYS.actorProofNonces, bounded);
    return null;
  }

  async registerFederationNode(registration, authToken, relayProfile) {
    const config = noctweaveFederationConfig(this.env, relayProfile);

    if (config.mode === "solo") {
      return noctweaveRelayError("Luna Cloudflare relay is configured for solo mode.");
    }

    if (!config.allowLiveRegistration) {
      return noctweaveRelayError("Live federation registration is disabled on this Luna relay.");
    }

    if (!config.registrationToken) {
      return noctweaveRelayError("Live federation registration requires a configured registration token.");
    }

    const provided = cleanRelayText(authToken, 512);

    if (!timingSafeEqualString(provided, config.registrationToken)) {
      return noctweaveRelayError("Unauthorized: federation registration token is required.");
    }

    const endpoint = cleanRelayEndpoint(registration?.endpoint);

    if (!endpoint) {
      return noctweaveRelayError("registerFederationNode requires a valid endpoint.");
    }

    if (endpoint.transport !== "http") {
      return noctweaveRelayError("Luna Cloudflare federation registration requires an HTTP relay endpoint.");
    }

    if (!config.allowPrivateEndpoints && !isPublicRelayEndpoint(endpoint)) {
      return noctweaveRelayError("Federation registration requires a public TLS endpoint.");
    }

    const relayInfo = await fetchRemoteRelayInfo(endpoint);
    const gateFailure = validateFederationPeerInfo({
      config,
      destinationRelay: endpoint,
      relayInfo,
      requireAllowList: false,
    });

    if (gateFailure) {
      return gateFailure;
    }

    const now = new Date();
    const ttlSeconds = boundedFederationTtlSeconds(registration?.ttlSeconds);
    const node = {
      endpoint,
      relayInfo,
      lastHeartbeatAt: iso8601NoMilliseconds(now),
      expiresAt: iso8601NoMilliseconds(new Date(now.getTime() + ttlSeconds * 1000)),
    };
    const nodes = await this.readFederationNodes();
    nodes[relayEndpointKey(endpoint)] = node;
    await this.writeFederationNodes(nodes);

    return {
      type: "federationNodes",
      federationNodes: [node],
    };
  }

  async listFederationNodes(listFederationNodes, relayProfile) {
    const requestedMode = cleanRelayText(listFederationNodes?.mode, 32);
    const requestedName = cleanRelayText(listFederationNodes?.federationName, 128);
    const requestedMaxStaleness = Number(listFederationNodes?.maxStalenessSeconds || 0);
    const stalenessCutoff = requestedMaxStaleness > 0 ? Date.now() - requestedMaxStaleness * 1000 : 0;

    if (listFederationNodes?.requireSignedSnapshot === true) {
      return noctweaveRelayError("Luna Cloudflare relay does not provide signed federation snapshots.");
    }

    const records = mergeNoctweaveRelayRecords([
      ...knownNoctweaveRelayRecords(this.env, relayProfile),
      ...Object.values(await this.readFederationNodes()),
    ]).filter((record) => {
      const info = record.relayInfo || {};
      const federation = info.federation || {};
      const modeMatches = !requestedMode || federation.mode === requestedMode;
      const nameMatches = !requestedName || federation.name === requestedName;
      const healthyMatches = listFederationNodes?.onlyHealthy !== true || isFutureTimestamp(record.expiresAt);
      const stalenessMatches = !stalenessCutoff || (Date.parse(record.lastHeartbeatAt || "") || 0) >= stalenessCutoff;

      return modeMatches && nameMatches && healthyMatches && stalenessMatches && isFutureTimestamp(record.expiresAt);
    });

    return {
      type: "federationNodes",
      federationNodes: records,
    };
  }

  async forwardRelayDelivery(type, payload, destinationRelay, relayProfile) {
    const gateFailure = await this.federationGate(destinationRelay, relayProfile);

    if (gateFailure) {
      return gateFailure;
    }

    const request = {
      type,
      [type]: payload,
    };
    const forwardingAuthToken = noctweaveFederationConfig(this.env, relayProfile).forwardingAuthToken;

    if (forwardingAuthToken) {
      request.authToken = forwardingAuthToken;
    }

    return forwardRelayRequest(destinationRelay, request);
  }

  async federationGate(destinationRelay, relayProfile) {
    const config = noctweaveFederationConfig(this.env, relayProfile);

    if (!config.forwardingEnabled) {
      return noctweaveRelayError("Federation forwarding is disabled on the Luna Cloudflare relay.");
    }

    if (destinationRelay.transport !== "http") {
      return noctweaveRelayError("Luna Cloudflare federation forwarding supports HTTP relays only.");
    }

    if (config.mode === "curated") {
      return noctweaveRelayError("Curated federation forwarding requires signed coordinator validation and is not enabled in the Luna Cloudflare shim.");
    }

    if (config.mode === "solo") {
      return noctweaveRelayError("Relay is not configured for federation forwarding.");
    }

    if (!config.allowPrivateEndpoints && !isPublicRelayEndpoint(destinationRelay)) {
      return noctweaveRelayError("Federation destination must use TLS and be publicly routable.");
    }

    if (config.mode === "open") {
      if (config.staticAllowList.length > 0) {
        return noctweaveRelayError("Open federation cannot use an allow list.");
      }

      if (!config.allowPrivateEndpoints && !isPublicRelayEndpoint(destinationRelay)) {
        return noctweaveRelayError("Open federation destination must use TLS and be publicly routable.");
      }
    }

    if (config.mode === "manual" && !(await this.isManualFederationAllowed(destinationRelay, relayProfile))) {
      return noctweaveRelayError("Manual federation: destination relay is not in the node list.");
    }

    const relayInfo = await fetchRemoteRelayInfo(destinationRelay);
    return validateFederationPeerInfo({
      config,
      destinationRelay,
      relayInfo,
      requireAllowList: config.mode === "manual",
    });
  }

  async isManualFederationAllowed(destinationRelay, relayProfile) {
    const config = noctweaveFederationConfig(this.env, relayProfile);

    if (config.staticAllowList.some((endpoint) => relayEndpointsMatch(endpoint, destinationRelay))) {
      return true;
    }

    const nodes = await this.readFederationNodes();
    const record = nodes[relayEndpointKey(destinationRelay)];
    return Boolean(record && isFutureTimestamp(record.expiresAt));
  }

  async readFederationNodes() {
    const nodes = await this.readObject(NOCTWEAVE_STORAGE_KEYS.federationNodes);
    const now = Date.now();
    let changed = false;

    for (const [key, record] of Object.entries(nodes)) {
      if (!record?.endpoint || !record?.relayInfo || Date.parse(record.expiresAt || "") <= now) {
        delete nodes[key];
        changed = true;
      }
    }

    if (changed) {
      await this.writeFederationNodes(nodes);
    }

    return nodes;
  }

  async writeFederationNodes(nodes) {
    const bounded = Object.fromEntries(
      Object.entries(nodes)
        .sort((left, right) => (Date.parse(right[1]?.lastHeartbeatAt || "") || 0) - (Date.parse(left[1]?.lastHeartbeatAt || "") || 0))
        .slice(0, NOCTWEAVE_FEDERATION_MAX_NODES),
    );
    await this.state.storage.put(NOCTWEAVE_STORAGE_KEYS.federationNodes, bounded);
  }

  async uploadAttachment(uploadAttachment) {
    const attachmentId = cleanRelayText(uploadAttachment?.attachmentId, 36);
    const chunkIndex = Number(uploadAttachment?.chunkIndex);
    const payload = validNoctweaveAttachmentPayload(uploadAttachment?.payload);

    if (!isNoctweaveUUID(attachmentId) || !Number.isInteger(chunkIndex) || chunkIndex < 0 ||
        chunkIndex >= NOCTWEAVE_MAX_ATTACHMENT_CHUNKS || !payload) {
      return noctweaveRelayError("uploadAttachment requires attachmentId, chunkIndex, and payload.");
    }

    const chunk = {
      attachmentId,
      chunkIndex,
      payload,
      expiresAt: noctweaveAttachmentExpiry(uploadAttachment.ttlSeconds),
    };
    await this.persistAttachmentChunk(chunk);
    return noctweaveOK();
  }

  async fetchAttachment(fetchAttachment) {
    const attachmentId = cleanRelayText(fetchAttachment?.attachmentId, 36);
    const chunkIndex = Number(fetchAttachment?.chunkIndex);

    if (!isNoctweaveUUID(attachmentId) || !Number.isInteger(chunkIndex) || chunkIndex < 0 ||
        chunkIndex >= NOCTWEAVE_MAX_ATTACHMENT_CHUNKS) {
      return noctweaveRelayError("fetchAttachment requires attachmentId and chunkIndex.");
    }

    const storageKey = noctweaveAttachmentStorageKey(attachmentId, chunkIndex);
    let chunk = await this.state.storage.get(storageKey);

    // One-release migration path for chunks written by the original single-record shim.
    if (!chunk) {
      const attachments = await this.readObject(NOCTWEAVE_STORAGE_KEYS.attachments);
      chunk = attachments[`${attachmentId}:${chunkIndex}`];
      if (chunk && isFutureTimestamp(chunk.expiresAt) && validNoctweaveAttachmentPayload(chunk.payload)) {
        await this.persistAttachmentChunk(chunk);
        delete attachments[`${attachmentId}:${chunkIndex}`];
        await this.state.storage.put(NOCTWEAVE_STORAGE_KEYS.attachments, attachments);
      }
    }

    if (!chunk || !isFutureTimestamp(chunk.expiresAt) || !validNoctweaveAttachmentPayload(chunk.payload)) {
      if (chunk) {
        await this.deleteAttachmentChunk(storageKey, chunk);
      }
      return noctweaveRelayError("Attachment chunk was not found.");
    }

    return { type: "attachment", attachment: chunk };
  }

  async persistAttachmentChunk(chunk) {
    const storageKey = noctweaveAttachmentStorageKey(chunk.attachmentId, chunk.chunkIndex);
    const expiryKey = noctweaveAttachmentExpiryStorageKey(chunk);
    await this.state.storage.put(expiryKey, { storageKey, expiresAt: chunk.expiresAt });
    await this.state.storage.put(storageKey, chunk);
    await this.scheduleAttachmentCleanup(chunk.expiresAt);
  }

  async deleteAttachmentChunk(storageKey, chunk) {
    const keys = [storageKey];
    const expiryKey = noctweaveAttachmentExpiryStorageKey(chunk);

    if (expiryKey) {
      keys.push(expiryKey);
    }

    await this.state.storage.delete(keys);
  }

  async scheduleAttachmentCleanup(expiresAt) {
    if (typeof this.state.storage.getAlarm !== "function" || typeof this.state.storage.setAlarm !== "function") {
      return;
    }

    const expiry = Date.parse(expiresAt);

    if (!Number.isFinite(expiry)) {
      return;
    }

    const backfillComplete = await this.state.storage.get(NOCTWEAVE_ATTACHMENT_BACKFILL_COMPLETE_KEY);
    const scheduledTime = backfillComplete ? expiry : Math.min(expiry, Date.now() + 1_000);
    const currentAlarm = await this.state.storage.getAlarm();

    if (currentAlarm === null || scheduledTime < currentAlarm) {
      await this.state.storage.setAlarm(scheduledTime);
    }
  }

  async setAttachmentCleanupAlarm(scheduledTime) {
    if (typeof this.state.storage.setAlarm === "function") {
      await this.state.storage.setAlarm(scheduledTime);
    }
  }

  async backfillAttachmentExpiryMarkers() {
    if (typeof this.state.storage.list !== "function" ||
        await this.state.storage.get(NOCTWEAVE_ATTACHMENT_BACKFILL_COMPLETE_KEY)) {
      return false;
    }

    const cursor = await this.state.storage.get(NOCTWEAVE_ATTACHMENT_BACKFILL_CURSOR_KEY);

    if (!cursor) {
      await this.migrateLegacyAttachmentChunks();
    }

    const options = {
      prefix: NOCTWEAVE_ATTACHMENT_CHUNK_PREFIX,
      limit: NOCTWEAVE_ATTACHMENT_CLEANUP_BATCH_SIZE,
    };

    if (typeof cursor === "string" && cursor) {
      options.startAfter = cursor;
    }

    const entries = await this.state.storage.list(options);
    let lastKey = null;

    for (const [storageKey, chunk] of entries) {
      lastKey = storageKey;

      if (!chunk || !isFutureTimestamp(chunk.expiresAt) || !validNoctweaveAttachmentPayload(chunk.payload)) {
        await this.state.storage.delete(storageKey);
        continue;
      }

      const expiryKey = noctweaveAttachmentExpiryStorageKey(chunk);
      await this.state.storage.put(expiryKey, { storageKey, expiresAt: chunk.expiresAt });
    }

    if (entries.size === NOCTWEAVE_ATTACHMENT_CLEANUP_BATCH_SIZE && lastKey) {
      await this.state.storage.put(NOCTWEAVE_ATTACHMENT_BACKFILL_CURSOR_KEY, lastKey);
      return true;
    }

    await this.state.storage.delete(NOCTWEAVE_ATTACHMENT_BACKFILL_CURSOR_KEY);
    await this.state.storage.put(NOCTWEAVE_ATTACHMENT_BACKFILL_COMPLETE_KEY, true);
    return false;
  }

  async migrateLegacyAttachmentChunks() {
    const attachments = await this.readObject(NOCTWEAVE_STORAGE_KEYS.attachments);

    for (const chunk of Object.values(attachments)) {
      if (!chunk || !isFutureTimestamp(chunk.expiresAt) || !validNoctweaveAttachmentPayload(chunk.payload) ||
          !isNoctweaveUUID(chunk.attachmentId) || !Number.isInteger(Number(chunk.chunkIndex))) {
        continue;
      }

      await this.persistAttachmentChunk({
        ...chunk,
        chunkIndex: Number(chunk.chunkIndex),
      });
    }

    if (Object.keys(attachments).length) {
      await this.state.storage.put(NOCTWEAVE_STORAGE_KEYS.attachments, {});
    }
  }

  async cleanupExpiredAttachmentChunks() {
    if (typeof this.state.storage.list !== "function") {
      return null;
    }

    const now = Date.now();
    const entries = await this.state.storage.list({
      prefix: NOCTWEAVE_ATTACHMENT_EXPIRY_PREFIX,
      limit: NOCTWEAVE_ATTACHMENT_CLEANUP_BATCH_SIZE,
    });
    const markerKeysToDelete = [];
    const chunkKeysToDelete = [];
    let nextExpiry = null;

    for (const [markerKey, marker] of entries) {
      const expiresAt = Date.parse(marker?.expiresAt || "");

      if (Number.isFinite(expiresAt) && expiresAt > now) {
        nextExpiry = expiresAt;
        break;
      }

      markerKeysToDelete.push(markerKey);

      if (typeof marker?.storageKey !== "string" || !marker.storageKey.startsWith(NOCTWEAVE_ATTACHMENT_CHUNK_PREFIX)) {
        continue;
      }

      const chunk = await this.state.storage.get(marker.storageKey);

      if (!chunk || !isFutureTimestamp(chunk.expiresAt)) {
        chunkKeysToDelete.push(marker.storageKey);
      }
    }

    const keysToDelete = [...new Set([...markerKeysToDelete, ...chunkKeysToDelete])];

    if (keysToDelete.length) {
      await this.state.storage.delete(keysToDelete);
    }

    if (!nextExpiry && entries.size === NOCTWEAVE_ATTACHMENT_CLEANUP_BATCH_SIZE) {
      return Date.now() + 1_000;
    }

    return nextExpiry;
  }

  async readObject(key) {
    return (await this.state.storage.get(key)) || {};
  }

  async readArray(key) {
    const value = await this.state.storage.get(key);
    return Array.isArray(value) ? value : [];
  }
}

function noctweaveAttachmentStorageKey(attachmentId, chunkIndex) {
  return `${NOCTWEAVE_ATTACHMENT_CHUNK_PREFIX}${attachmentId.toLowerCase()}:${chunkIndex}`;
}

function noctweaveAttachmentExpiryStorageKey(chunk) {
  const attachmentId = cleanRelayText(chunk?.attachmentId, 36);
  const chunkIndex = Number(chunk?.chunkIndex);
  const expiresAt = Date.parse(chunk?.expiresAt || "");

  if (!isNoctweaveUUID(attachmentId) || !Number.isInteger(chunkIndex) || !Number.isFinite(expiresAt)) {
    return null;
  }

  return `${NOCTWEAVE_ATTACHMENT_EXPIRY_PREFIX}${String(expiresAt).padStart(13, "0")}:${attachmentId.toLowerCase()}:${String(chunkIndex).padStart(3, "0")}`;
}

function noctweaveAttachmentExpiry(ttlSeconds) {
  const requested = Number(ttlSeconds ?? NOCTWEAVE_DEFAULT_ATTACHMENT_TTL_SECONDS);
  const normalized = Number.isFinite(requested) ? requested : NOCTWEAVE_DEFAULT_ATTACHMENT_TTL_SECONDS;
  const bounded = Math.min(Math.max(normalized, 60), NOCTWEAVE_MAX_ATTACHMENT_TTL_SECONDS);
  return iso8601NoMilliseconds(new Date(Date.now() + bounded * 1000));
}

function validNoctweaveAttachmentPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const nonce = decodeNoctweaveData(payload.nonce, 12);
  const ciphertext = decodeNoctweaveData(payload.ciphertext, NOCTWEAVE_MAX_ATTACHMENT_CHUNK_BYTES);
  const tag = decodeNoctweaveData(payload.tag, 16);

  if (nonce?.byteLength !== 12 || !ciphertext || ciphertext.byteLength > NOCTWEAVE_MAX_ATTACHMENT_CHUNK_BYTES ||
      tag?.byteLength !== 16) {
    return null;
  }

  return {
    nonce: payload.nonce,
    ciphertext: payload.ciphertext,
    tag: payload.tag,
  };
}

function isNoctweaveUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function boundedFederationTtlSeconds(value) {
  const parsed = Number(value || NOCTWEAVE_FEDERATION_DIRECTORY_TTL_SECONDS);
  const finite = Number.isFinite(parsed) ? parsed : NOCTWEAVE_FEDERATION_DIRECTORY_TTL_SECONDS;
  return Math.min(Math.max(Math.floor(finite), 60), 24 * 60 * 60);
}

function relayHttpURL(endpoint, path = "/relay") {
  const normalized = cleanRelayEndpoint(endpoint);

  if (!normalized || normalized.transport !== "http") {
    return null;
  }

  const protocol = normalized.useTLS ? "https:" : "http:";
  const url = new URL(`${protocol}//${normalized.host}`);
  const defaultPort = normalized.useTLS ? 443 : 80;

  if (normalized.port !== defaultPort) {
    url.port = String(normalized.port);
  }

  url.pathname = path;
  return url;
}

async function fetchRemoteRelayInfo(endpoint) {
  const infoURL = relayHttpURL(endpoint, "/info");

  if (!infoURL) {
    return null;
  }

  const infoResponse = await fetchBoundedRelayJson(infoURL, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (infoResponse?.type === "info" && infoResponse.relayInfo) {
    return infoResponse.relayInfo;
  }

  const relayURL = relayHttpURL(endpoint, "/relay");
  const relayResponse = relayURL
    ? await fetchBoundedRelayJson(relayURL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "info" }),
    })
    : null;

  return relayResponse?.type === "info" ? relayResponse.relayInfo || null : null;
}

async function forwardRelayRequest(endpoint, relayRequest) {
  const relayURL = relayHttpURL(endpoint, "/relay");

  if (!relayURL) {
    return noctweaveRelayError("Federation forwarding requires an HTTP relay endpoint.");
  }

  const response = await fetchBoundedRelayJson(relayURL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(relayRequest),
  });

  if (!response) {
    return noctweaveRelayError("Federation forwarding failed: destination relay did not return a relay response.");
  }

  return response;
}

async function fetchBoundedRelayJson(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NOCTWEAVE_FEDERATION_FORWARD_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return readBoundedResponseJson(response, NOCTWEAVE_FEDERATION_MAX_RESPONSE_BYTES);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function readBoundedResponseJson(response, maxBytes) {
  const contentLength = Number(response.headers.get("content-length") || 0);

  if (contentLength > maxBytes) {
    return null;
  }

  if (!response.body?.getReader) {
    const text = await response.text();
    return new TextEncoder().encode(text).byteLength <= maxBytes ? JSON.parse(text) : null;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > maxBytes) {
      await reader.cancel();
      return null;
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder().decode(bytes));
}

function validateFederationPeerInfo({ config, relayInfo }) {
  if (!relayInfo?.federation?.mode) {
    return noctweaveRelayError("Federation check failed: destination relay did not report its configuration.");
  }

  if (config.mode === "manual") {
    if (relayInfo.federation.mode !== "manual") {
      return noctweaveRelayError("Federation mismatch: destination relay is not manual.");
    }

    if (relayInfo.kind !== "standard") {
      return noctweaveRelayError("Manual federation requires destination relay kind standard.");
    }
  } else if (config.mode === "open") {
    if (relayInfo.federation.mode !== "open") {
      return noctweaveRelayError("Federation mismatch: destination relay is not open.");
    }
  } else if (config.mode === "curated") {
    return noctweaveRelayError("Curated federation forwarding requires signed coordinator validation.");
  } else {
    return noctweaveRelayError("Relay is not configured for federation forwarding.");
  }

  if (config.name && relayInfo.federation.name !== config.name) {
    return noctweaveRelayError("Federation mismatch: destination relay name differs.");
  }

  return null;
}

function isPublicRelayEndpoint(endpoint) {
  const normalized = cleanRelayEndpoint(endpoint);

  if (!normalized?.useTLS) {
    return false;
  }

  const host = normalized.host;

  if (
    host === "localhost"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || host === "0.0.0.0"
    || host === "::"
    || host === "::1"
  ) {
    return false;
  }

  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);

  if (!ipv4Match) {
    return true;
  }

  const octets = ipv4Match.slice(1).map(Number);

  if (octets.some((octet) => octet < 0 || octet > 255)) {
    return false;
  }

  const [first, second] = octets;
  return !(
    first === 10
    || first === 127
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 169 && second === 254)
  );
}

function timingSafeEqualString(left, right) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left || "");
  const rightBytes = encoder.encode(right || "");

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  let difference = 0;

  for (let i = 0; i < leftBytes.length; i += 1) {
    difference |= leftBytes[i] ^ rightBytes[i];
  }

  return difference === 0;
}

function base64UrlEncode(value) {
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(String(value));
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function readJsonBody(request, maxBytes, oversizedMessage = "Holder-pass request body is too large.") {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxBytes) {
    throw new Error(oversizedMessage);
  }

  if (!request.body?.getReader) {
    const text = await request.text();

    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new Error(oversizedMessage);
    }

    return JSON.parse(text);
  }

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error(oversizedMessage);
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder().decode(bytes));
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(/;\s*/);

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf("=");
    if (separatorIndex === -1) continue;

    const cookieName = cookie.slice(0, separatorIndex);
    if (cookieName === name) {
      return cookie.slice(separatorIndex + 1);
    }
  }

  return "";
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(signature));
}

function timingSafeEqualHex(left, right) {
  const leftBytes = hexToBytes(left);
  const rightBytes = hexToBytes(right);
  if (!leftBytes || !rightBytes || leftBytes.length !== rightBytes.length) {
    return false;
  }

  let difference = 0;
  for (let i = 0; i < leftBytes.length; i += 1) {
    difference |= leftBytes[i] ^ rightBytes[i];
  }

  return difference === 0;
}

function hexToBytes(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized || normalized.length % 2 !== 0) {
    return null;
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }

  return bytes;
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeHex(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/^0x/i, "")
    .toLowerCase();

  return /^[0-9a-f]{64}$/.test(normalized) ? normalized : "";
}

function randomBase64Url(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function getNoctweaveCorsHeaders(request, env, relayProfile) {
  const origin = request.headers.get("Origin");
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  if (!origin) return headers;

  try {
    const parsed = new URL(origin);
    const secureOrigin = parsed.protocol === "https:"
      && !parsed.username
      && !parsed.password
      && (!parsed.port || parsed.port === "443");
    if (secureOrigin && relayProfile.scope === "claymatching" && isClaymatchingHost(parsed.hostname, env)) {
      headers["Access-Control-Allow-Origin"] = parsed.origin;
    }
  } catch {
    // Invalid origins never receive cross-origin relay access.
  }
  return headers;
}

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}
