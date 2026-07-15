import assert from "node:assert/strict";
import { generateKeyPairSync, sign as signEd25519 } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { bcs } from "@mysten/sui/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

import worker, {
  extractClaymatchingSolanaAddress,
  loadClaymatchingPopkinsSnapshot,
  normalizeClayCollectAchievements,
  normalizeClaymatchingAssets,
  normalizeClaymatchingPopkinAvatarAssets,
  verifyClayCollectIdentity,
} from "../worker/claymatching.js";

const OWNER = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const OTHER_OWNER = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const COLLECTION = "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const COLLECT_PROFILE_ID = "5f82098f-191f-4757-86f2-b14c3b88119a";
const TEST_SESSION_SECRET = "a-secure-test-session-secret-that-is-long-enough";
const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_CSRF = "test-csrf-token-with-enough-entropy";
const POPKINS_TYPE = "0xb908f3c6fea6865d32e2048c520cdfe3b5c5bbcebb658117c41bad70f52b7ccc::popkins_nft::Popkins";
const POPKINS_STAKING_PACKAGE = "0x38f0bad7a60a8c4399a810430b7625b60c93983321b3cd8723f201cc559de5c1";
const POPKINS_STAKING_CONTRACT = "0x886740809127b2db98b7c5f45452def2fe8f0c3e0efd6fa91d30e3eb0afa5287";
const POPKINS_STAKING_CONTRACT_TYPE = `${POPKINS_STAKING_PACKAGE}::staking_contract::StakingContract`;
const POPKINS_STAKING_DATA_TYPE = `${POPKINS_STAKING_PACKAGE}::staking_data::StakingData`;
const TEST_SUI_ADDRESS = `0x${"a".repeat(64)}`;
const TEST_STAKING_DATA_ID = `0x${"b".repeat(64)}`;
const TEST_STAKING_INDEX_ID = `0x${"c".repeat(64)}`;
const TEST_STAKED_POPKINS_INDEX_ID = `0x${"d".repeat(64)}`;
const TEST_KIOSK_ID = `0x${"e".repeat(64)}`;

test("standalone deployment uploads only Claymatching assets and preserves its relay namespace", async () => {
  const [wranglerConfig, previewConfig, staticBuildScript, gitignore] = await Promise.all([
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.preview.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../scripts/prepare-static.mjs", import.meta.url), "utf8"),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
  ]);

  assert.match(wranglerConfig, /"directory"\s*:\s*"\.\/dist-claymatching"/);
  assert.doesNotMatch(wranglerConfig, /"directory"\s*:\s*"\.\/dist"/);
  assert.match(wranglerConfig, /"name"\s*:\s*"claymatching"/);
  assert.match(wranglerConfig, /"script_name"\s*:\s*"luna21e8"/);
  assert.match(wranglerConfig, /"NOCTWEAVE_RELAY_OBJECT_NAME"\s*:\s*"claymatching-relay"/);
  assert.doesNotMatch(wranglerConfig, /"NOCTWEAVE_RELAY_OBJECT_NAME"\s*:\s*"luna-default-relay"/);
  assert.match(wranglerConfig, /"pattern"\s*:\s*"claymatching\.luna21e8\.xyz"/);
  assert.match(previewConfig, /"workers_dev"\s*:\s*true/);
  assert.doesNotMatch(previewConfig, /"routes"\s*:/);
  assert.doesNotMatch(previewConfig, /"pattern"\s*:\s*"claymatching\.luna21e8\.xyz"/);
  assert.match(previewConfig, /"CLAYMATCHING_HOSTS"\s*:\s*"claymatching\.vfsp2wqysh\.workers\.dev"/);
  assert.match(previewConfig, /"script_name"\s*:\s*"luna21e8"/);
  assert.match(previewConfig, /"NOCTWEAVE_RELAY_OBJECT_NAME"\s*:\s*"claymatching-relay"/);
  assert.match(previewConfig, /"NOCTWEAVE_RELAY_OWNER_HOST"\s*:\s*"claymatching\.luna21e8\.xyz"/);
  assert.doesNotMatch(wranglerConfig, /"NOCTWEAVE_RELAY_OWNER_HOST"/);
  assert.match(staticBuildScript, /path\.join\(root, "dist-claymatching"\)/);
  assert.doesNotMatch(staticBuildScript, /path\.join\(root, "dist"\)/);
  assert.match(gitignore, /^\/dist-claymatching\/$/m);
});

function claymatchingConfiguredEnv(overrides = {}) {
  return {
    CLAYMATCHING_COLLECTION_IDS: COLLECTION,
    CLAYMATCHING_HOSTS: "claymatching.luna21e8.xyz",
    CLAYMATCHING_SESSION_SECRET: TEST_SESSION_SECRET,
    HELIUS_API_KEY: "test-helius-key",
    SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    SUPABASE_SECRET_KEY: "test-secret-key",
    SUPABASE_URL: "https://project.supabase.co",
    ...overrides,
  };
}

test("only the Claymatching host can reach the Claymatching relay object", async () => {
  const relayCalls = [];
  const env = claymatchingConfiguredEnv({
    NOCTWEAVE_RELAY: {
      getByName(name) {
        relayCalls.push({ name, type: "lookup" });
        return {
          async fetch(request) {
            relayCalls.push({ host: new URL(request.url).hostname, type: "fetch" });
            return Response.json({ objectName: name, type: "ok" });
          },
        };
      },
    },
  });

  for (const path of [
    "/relay",
    "/health",
    "/info",
    "/api/noctweave/relays",
    "/api/noctweave/relay",
    "/api/noctweave/health",
    "/api/noctweave/info",
  ]) {
    const method = path === "/relay" || path === "/api/noctweave/relay" ? "POST" : "GET";
    const response = await worker.fetch(new Request(`https://preview.example${path}`, { method }), env);
    assert.equal(response.status, 404, `${path} must reject relay access from an unconfigured host`);
  }
  assert.deepEqual(relayCalls, []);

  const metadataEnv = claymatchingConfiguredEnv();
  const clayInfoResponse = await worker.fetch(new Request("https://claymatching.luna21e8.xyz/info"), metadataEnv);
  const clayInfo = await clayInfoResponse.json();
  assert.equal(clayInfo.relayInfo.relayName, "Luna Claymatching Encrypted Relay");
  assert.equal(clayInfo.relayInfo.federation.name, "luna-claymatching");

  const clayAllowsClay = await worker.fetch(new Request("https://claymatching.luna21e8.xyz/info", {
    headers: { Origin: "https://claymatching.luna21e8.xyz" },
  }), metadataEnv);
  const clayRejectsOtherOrigin = await worker.fetch(new Request("https://claymatching.luna21e8.xyz/info", {
    headers: { Origin: "https://luna21e8.xyz" },
  }), metadataEnv);
  assert.equal(clayAllowsClay.headers.get("Access-Control-Allow-Origin"), "https://claymatching.luna21e8.xyz");
  assert.equal(clayRejectsOtherOrigin.headers.get("Access-Control-Allow-Origin"), null);

  const clayDirectory = await worker.fetch(new Request("https://claymatching.luna21e8.xyz/api/noctweave/relays"), metadataEnv);
  assert.equal((await clayDirectory.json()).relays[0].endpoint.host, "claymatching.luna21e8.xyz");

  const clayRelay = await worker.fetch(new Request("https://claymatching.luna21e8.xyz/relay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "ping" }),
  }), env);
  assert.equal(clayRelay.status, 200);
  assert.deepEqual(await clayRelay.json(), { objectName: "claymatching-relay", type: "ok" });

  const unrelatedRelay = await worker.fetch(new Request("https://luna21e8.xyz/relay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "ping" }),
  }), env);
  assert.equal(unrelatedRelay.status, 404);
  assert.deepEqual(relayCalls, [
    { name: "claymatching-relay", type: "lookup" },
    { host: "claymatching.luna21e8.xyz", type: "fetch" },
  ]);
});

test("workers.dev preview bridges only internal relay calls to the existing owner host", async () => {
  const relayCalls = [];
  const previewHost = "claymatching.vfsp2wqysh.workers.dev";
  const ownerHost = "claymatching.luna21e8.xyz";
  const env = claymatchingConfiguredEnv({
    ALLOWED_ORIGINS: `https://${previewHost}`,
    CLAYMATCHING_HOSTS: previewHost,
    NOCTWEAVE_RELAY_OWNER_HOST: ownerHost,
    NOCTWEAVE_RELAY_URL: `https://${previewHost}/relay`,
    NOCTWEAVE_RELAY: {
      getByName(name) {
        relayCalls.push({ name, type: "lookup" });
        return {
          async fetch(request) {
            const host = new URL(request.url).hostname;
            relayCalls.push({ host, type: "fetch" });
            if (host !== ownerHost) return new Response("Not found", { status: 404 });
            return Response.json(
              { objectName: name, type: "ok" },
              { headers: { "Access-Control-Allow-Origin": `https://${ownerHost}` } },
            );
          },
        };
      },
    },
  });

  const directory = await worker.fetch(new Request(`https://${previewHost}/api/noctweave/relays`, {
    headers: { Origin: `https://${previewHost}` },
  }), env);
  assert.equal(directory.status, 200);
  assert.equal(directory.headers.get("Access-Control-Allow-Origin"), `https://${previewHost}`);
  assert.equal((await directory.json()).relays[0].endpoint.host, previewHost);
  assert.deepEqual(relayCalls, []);

  const relay = await worker.fetch(new Request(`https://${previewHost}/relay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: `https://${previewHost}`,
    },
    body: JSON.stringify({ type: "health" }),
  }), env);
  assert.equal(relay.status, 200);
  assert.equal(relay.headers.get("Access-Control-Allow-Origin"), `https://${previewHost}`);
  assert.deepEqual(await relay.json(), { objectName: "claymatching-relay", type: "ok" });
  assert.deepEqual(relayCalls, [
    { name: "claymatching-relay", type: "lookup" },
    { host: ownerHost, type: "fetch" },
  ]);

  const unrelated = await worker.fetch(new Request("https://preview.example/relay", {
    method: "POST",
    body: JSON.stringify({ type: "health" }),
  }), env);
  assert.equal(unrelated.status, 404);
  assert.equal(relayCalls.length, 2);
});

function encodeBase58(bytes) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = 0n;
  for (const byte of bytes) value = (value * 256n) + BigInt(byte);
  let encoded = "";
  while (value > 0n) {
    encoded = alphabet[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1;
  return "1".repeat(leadingZeroes) + encoded;
}

function createSolanaTestSigner() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicDer = publicKey.export({ format: "der", type: "spki" });
  const address = encodeBase58(publicDer.subarray(publicDer.length - 32));
  return {
    address,
    sign(message) {
      return signEd25519(null, Buffer.from(message), privateKey).toString("base64");
    },
  };
}

async function claymatchingSessionCookie(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    csrf: TEST_CSRF,
    exp: now + 3600,
    holderVerifiedUntil: new Date(Date.now() + 3600_000).toISOString(),
    iat: now,
    sub: TEST_USER_ID,
    v: 1,
    wallet: OWNER,
    ...overrides,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(TEST_SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded));
  const hex = Buffer.from(signature).toString("hex");
  return `__Host-claymatching_session=${encoded}.${hex}`;
}

function clayAccessStateRow(overrides = {}) {
  const future = new Date(Date.now() + 3600_000).toISOString();
  return {
    account_state: "active",
    can_dm: true,
    can_post: true,
    consent_current: true,
    membership_mode: "verified_solana",
    posting_access_until: future,
    profile_exists: true,
    read_only_access_until: null,
    read_only_asset_count: null,
    read_only_checked_at: null,
    read_only_solana_address: null,
    signed_solana_address: OWNER,
    signed_solana_verified_until: future,
    sui_address: null,
    sui_verified_at: null,
    ...overrides,
  };
}

function collectEarnedAchievement({
  claimedAt = "2026-07-13T20:00:00.000Z",
  id = "provider:achievement:1",
  name = "Cave Celebrity",
  status = "enabled",
  ...overrides
} = {}) {
  return {
    claimedAt,
    description: "Did a very serious dinosaur thing.",
    earnedPoints: 10,
    id,
    kind: "achievement",
    name,
    points: 10,
    rarity: "rare",
    status,
    type: "community",
    ...overrides,
  };
}

function asset({
  burnt = false,
  collectionId = COLLECTION,
  id = "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
  image = "https://images.example/asset.png",
  name = "Clay collectible",
  owner = OWNER,
} = {}) {
  return {
    burnt,
    content: {
      files: [{ cdn_uri: image, mime: "image/png" }],
      metadata: { name },
    },
    grouping: [{ group_key: "collection", group_value: collectionId }],
    id,
    ownership: { owner },
  };
}

function createPopkinsSnapshotClient({
  address = TEST_SUI_ADDRESS,
  directIds = [],
  dynamicFieldPages,
  kioskPopkinIds = [],
  stakedIds = [],
  stakingCount = stakedIds.length,
  stakingDataId = TEST_STAKING_DATA_ID,
  stakingDataType = POPKINS_STAKING_DATA_TYPE,
  stakingLookupError = null,
  stakingOwner = address,
} = {}) {
  const calls = {
    getDynamicField: [],
    getObjects: [],
    listDynamicFields: [],
  };
  const pages = dynamicFieldPages || [{
    cursor: null,
    dynamicFields: stakedIds.map((objectId) => ({
      name: {
        bcs: bcs.Address.serialize(objectId).toBytes(),
        type: "0x2::object::ID",
      },
    })),
    hasNextPage: false,
  }];

  const client = {
    core: {
      async getDynamicField(input) {
        calls.getDynamicField.push(input);
        if (stakingLookupError) throw stakingLookupError;
        return {
          dynamicField: {
            value: {
              bcs: bcs.Address.serialize(stakingDataId).toBytes(),
              type: "0x2::object::ID",
            },
          },
        };
      },
      async getObject({ objectId }) {
        if (objectId === POPKINS_STAKING_CONTRACT) {
          return {
            object: {
              json: { staking_datas: { id: TEST_STAKING_INDEX_ID, size: 1 } },
              objectId: POPKINS_STAKING_CONTRACT,
              type: POPKINS_STAKING_CONTRACT_TYPE,
            },
          };
        }
        if (objectId === stakingDataId) {
          return {
            object: {
              json: {
                owner: stakingOwner,
                staked_nfts_ids: { id: TEST_STAKED_POPKINS_INDEX_ID, size: stakingCount },
              },
              objectId: stakingDataId,
              type: stakingDataType,
            },
          };
        }
        throw new Error(`Unexpected Popkins object lookup: ${objectId}`);
      },
      async getObjects(input) {
        calls.getObjects.push(input);
        return {
          objects: input.objectIds.map((objectId) => ({
            display: {
              output: {
                image_url: `https://images.example/${objectId.slice(2, 10)}.png`,
                name: `Popkin ${objectId.slice(2, 8).toUpperCase()}`,
              },
            },
            objectId,
            type: POPKINS_TYPE,
          })),
        };
      },
      async listDynamicFields(input) {
        calls.listDynamicFields.push(input);
        return pages[calls.listDynamicFields.length - 1] || {
          cursor: null,
          dynamicFields: [],
          hasNextPage: false,
        };
      },
      async listOwnedObjects() {
        return {
          cursor: "terminal-owned-cursor",
          hasNextPage: false,
          objects: directIds.map((objectId) => ({ objectId, type: POPKINS_TYPE })),
        };
      },
    },
    kiosk: {
      async getKiosk({ id }) {
        assert.equal(id, TEST_KIOSK_ID);
        return {
          items: kioskPopkinIds.map((objectId) => ({ objectId, type: POPKINS_TYPE })),
        };
      },
      async getOwnedKiosks() {
        return {
          hasNextPage: false,
          kioskIds: kioskPopkinIds.length > 0 ? [TEST_KIOSK_ID] : [],
          nextCursor: "terminal-kiosk-cursor",
        };
      },
    },
  };

  return { calls, client };
}

test("claymatching asset normalization returns only verified owned HTTPS images", () => {
  const assets = normalizeClaymatchingAssets([
    asset(),
    asset({ id: "EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE", owner: OTHER_OWNER }),
    asset({ id: "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", collectionId: OTHER_OWNER }),
    asset({ id: "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", image: "http://images.example/nope.png" }),
    asset({ id: "HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH", burnt: true }),
    asset(),
  ], OWNER, new Set([COLLECTION]));

  assert.deepEqual(assets, [{
    collectionId: COLLECTION,
    id: "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    image: "https://images.example/asset.png",
    name: "Clay collectible",
  }]);
});

test("claymatching custom domain root serves the isolated app shell", async () => {
  let requestedPath = "";
  const env = {
    ASSETS: {
      async fetch(request) {
        requestedPath = new URL(request.url).pathname;
        return new Response("<!doctype html>", { headers: { "Content-Type": "text/html" } });
      },
    },
    CLAYMATCHING_HOSTS: "claymatching.luna21e8.xyz",
  };

  const response = await worker.fetch(new Request("https://claymatching.luna21e8.xyz/"), env);

  assert.equal(response.status, 200);
  assert.equal(requestedPath, "/claymatching/");
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
  assert.match(response.headers.get("Permissions-Policy"), /camera=\(\)/);
});

test("claymatching asset API never accepts an owner supplied by the browser", async () => {
  const response = await worker.fetch(
    new Request(`https://claymatching.luna21e8.xyz/api/claymatching/assets?owner=${OWNER}`),
    {},
  );
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.match(body.error, /Claymatching session/i);
});

test("claymatching asset API ignores a pasted owner and reads only the signed holder-session wallet", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const requestedOwners = [];
  globalThis.fetch = async (request, init = {}) => {
    const url = new URL(String(request));
    if (url.hostname === "project.supabase.co" && url.pathname.endsWith("/get_clay_access_state")) {
      return Response.json([clayAccessStateRow()]);
    }
    if (url.hostname === "mainnet.helius-rpc.com") {
      const payload = JSON.parse(init.body);
      requestedOwners.push(payload.params.ownerAddress);
      return Response.json({ result: { items: [asset()] } });
    }
    throw new Error(`Unexpected test request: ${url}`);
  };

  try {
    const cookie = await claymatchingSessionCookie();
    const response = await worker.fetch(
      new Request(`https://claymatching.luna21e8.xyz/api/claymatching/assets?owner=${OTHER_OWNER}`, {
        headers: { Cookie: cookie },
      }),
      claymatchingConfiguredEnv(),
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.owner, OWNER);
    assert.equal(body.assets.length, 1);
    assert.deepEqual(requestedOwners, [OWNER]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("claymatching extracts the wallet only from a Supabase Web3 identity", () => {
  const address = extractClaymatchingSolanaAddress({
    identities: [{
      identity_data: { address: OWNER, chain: "solana" },
      provider: "web3",
      provider_id: OWNER,
    }],
    user_metadata: { address: OTHER_OWNER },
  });

  assert.equal(address, OWNER);
  assert.equal(extractClaymatchingSolanaAddress({
    identities: [],
    user_metadata: { address: OWNER },
  }), "");
});

test("claymatching session creation fails closed until backend secrets are configured", async () => {
  const response = await worker.fetch(
    new Request("https://claymatching.luna21e8.xyz/api/claymatching/session", {
      method: "POST",
      headers: {
        Authorization: "Bearer this-is-a-long-placeholder-token-for-the-test-only",
        "Content-Type": "application/json",
        Origin: "https://claymatching.luna21e8.xyz",
      },
      body: JSON.stringify({
        adultAttested: true,
        holderAttested: true,
        lawfulUseAttested: true,
      }),
    }),
    {},
  );

  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not fully configured/i);
});

test("claymatching public-wallet preview requires an authenticated same-origin browser request", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let upstreamRequests = 0;
  globalThis.fetch = async () => {
    upstreamRequests += 1;
    throw new Error("The request should fail before an upstream call.");
  };

  try {
    const env = claymatchingConfiguredEnv();
    const withoutOrigin = await worker.fetch(new Request(
      "https://claymatching.luna21e8.xyz/api/claymatching/solana/preview",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer this-is-a-long-placeholder-token-for-the-test-only",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address: OWNER }),
      },
    ), env);
    const crossOrigin = await worker.fetch(new Request(
      "https://claymatching.luna21e8.xyz/api/claymatching/solana/preview",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer this-is-a-long-placeholder-token-for-the-test-only",
          "Content-Type": "application/json",
          Origin: "https://attacker.invalid",
        },
        body: JSON.stringify({ address: OWNER }),
      },
    ), env);
    const withoutBearer = await worker.fetch(new Request(
      "https://claymatching.luna21e8.xyz/api/claymatching/solana/preview",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://claymatching.luna21e8.xyz",
        },
        body: JSON.stringify({ address: OWNER }),
      },
    ), env);

    assert.equal(withoutOrigin.status, 403);
    assert.equal(crossOrigin.status, 403);
    assert.equal(withoutBearer.status, 401);
    assert.equal(upstreamRequests, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("claymatching public-wallet preview stays unverified and cannot create holder state or a cookie", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const previewOwner = createSolanaTestSigner().address;
  const rpcCalls = [];
  globalThis.fetch = async (request, init = {}) => {
    const url = new URL(String(request));
    if (url.hostname === "project.supabase.co") {
      if (url.pathname === "/auth/v1/user") {
        return Response.json({
          email: "provisional@example.test",
          id: TEST_USER_ID,
          identities: [{ provider: "email" }],
        });
      }
      const rpcName = url.pathname.split("/").at(-1);
      rpcCalls.push(rpcName);
      if (rpcName === "claim_clay_solana_preview") {
        return Response.json([{ allowed: true, retry_after_seconds: 0 }]);
      }
      throw new Error(`Preview attempted a forbidden RPC: ${rpcName}`);
    }
    if (url.hostname === "mainnet.helius-rpc.com") {
      const payload = JSON.parse(init.body);
      assert.equal(payload.params.ownerAddress, previewOwner);
      return Response.json({ result: { items: [asset({ owner: previewOwner })] } });
    }
    throw new Error(`Unexpected test request: ${url}`);
  };

  try {
    const response = await worker.fetch(new Request(
      "https://claymatching.luna21e8.xyz/api/claymatching/solana/preview",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer this-is-a-long-placeholder-token-for-the-test-only",
          "Content-Type": "application/json",
          Origin: "https://claymatching.luna21e8.xyz",
        },
        body: JSON.stringify({ address: previewOwner }),
      },
    ), claymatchingConfiguredEnv());
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.verified, false);
    assert.equal(body.source, "public-chain-preview");
    assert.equal(body.address, previewOwner);
    assert.equal(body.assets.length, 1);
    assert.equal(response.headers.get("Set-Cookie"), null);
    assert.deepEqual(rpcCalls, ["claim_clay_solana_preview"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("claymatching email or Apple sessions return a structured provisional state without holder access", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const rpcCalls = [];
  globalThis.fetch = async (request) => {
    const url = new URL(String(request));
    if (url.hostname !== "project.supabase.co") throw new Error(`Unexpected test request: ${url}`);
    if (url.pathname === "/auth/v1/user") {
      return Response.json({
        email: "provisional@example.test",
        id: TEST_USER_ID,
        identities: [{ provider: "email" }],
      });
    }
    const rpcName = url.pathname.split("/").at(-1);
    rpcCalls.push(rpcName);
    if (rpcName === "get_clay_access_state") {
      return Response.json([clayAccessStateRow({
        account_state: null,
        can_dm: false,
        can_post: false,
        consent_current: false,
        membership_mode: null,
        posting_access_until: null,
        profile_exists: false,
        signed_solana_address: null,
        signed_solana_verified_until: null,
      })]);
    }
    throw new Error(`Provisional session attempted a forbidden RPC: ${rpcName}`);
  };

  try {
    const response = await worker.fetch(new Request(
      "https://claymatching.luna21e8.xyz/api/claymatching/session",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer this-is-a-long-placeholder-token-for-the-test-only",
          "Content-Type": "application/json",
          Origin: "https://claymatching.luna21e8.xyz",
        },
        body: JSON.stringify({}),
      },
    ), claymatchingConfiguredEnv());
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.authenticated, true);
    assert.equal(body.holder, false);
    assert.equal(body.provisional, true);
    assert.equal(body.walletRequired, true);
    assert.equal(body.userId, TEST_USER_ID);
    assert.match(response.headers.get("Set-Cookie"), /__Host-claymatching_session=; Max-Age=0/);
    assert.deepEqual(rpcCalls, ["get_clay_access_state"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("claymatching restores a previously signature-bound wallet for a returning email or Apple session", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const rpcCalls = [];
  globalThis.fetch = async (request) => {
    const url = new URL(String(request));
    if (url.hostname === "project.supabase.co") {
      if (url.pathname === "/auth/v1/user") {
        return Response.json({
          email: "returning@example.test",
          id: TEST_USER_ID,
          identities: [{ provider: "email" }],
        });
      }
      const rpcName = url.pathname.split("/").at(-1);
      rpcCalls.push(rpcName);
      if (rpcName === "get_clay_access_state") return Response.json([clayAccessStateRow()]);
      if (rpcName === "confirm_clay_holder") {
        return Response.json([{
          holder_verified_at: new Date().toISOString(),
          holder_verified_until: new Date(Date.now() + 3600_000).toISOString(),
          user_id: TEST_USER_ID,
        }]);
      }
      throw new Error(`Unexpected test RPC: ${rpcName}`);
    }
    if (url.hostname === "mainnet.helius-rpc.com") {
      return Response.json({ result: { items: [asset()] } });
    }
    throw new Error(`Unexpected test request: ${url}`);
  };

  try {
    const response = await worker.fetch(new Request(
      "https://claymatching.luna21e8.xyz/api/claymatching/session",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer this-is-a-long-placeholder-token-for-the-test-only",
          "Content-Type": "application/json",
          Origin: "https://claymatching.luna21e8.xyz",
        },
        body: JSON.stringify({}),
      },
    ), claymatchingConfiguredEnv());
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.authenticated, true);
    assert.equal(body.holder, true);
    assert.equal(body.walletAddress, OWNER);
    assert.match(response.headers.get("Set-Cookie"), /__Host-claymatching_session=/);
    assert.deepEqual(rpcCalls, [
      "get_clay_access_state",
      "confirm_clay_holder",
      "get_clay_access_state",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("claymatching Supabase verification uses the Workers-supported fail-closed redirect mode", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let redirectMode = "";
  globalThis.fetch = async (_request, init = {}) => {
    redirectMode = init.redirect;
    return new Response(null, {
      status: 302,
      headers: { Location: "https://redirect.invalid/" },
    });
  };

  try {
    const response = await worker.fetch(
      new Request("https://claymatching.luna21e8.xyz/api/claymatching/session", {
        method: "POST",
        headers: {
          Authorization: "Bearer this-is-a-long-placeholder-token-for-the-test-only",
          "Content-Type": "application/json",
          Origin: "https://claymatching.luna21e8.xyz",
        },
        body: JSON.stringify({
          adultAttested: true,
          holderAttested: true,
          lawfulUseAttested: true,
        }),
      }),
      {
        CLAYMATCHING_COLLECTION_IDS: COLLECTION,
        CLAYMATCHING_HOSTS: "claymatching.luna21e8.xyz",
        CLAYMATCHING_SESSION_SECRET: "a-secure-test-session-secret-that-is-long-enough",
        HELIUS_API_KEY: "test-helius-key",
        SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
        SUPABASE_SECRET_KEY: "test-secret-key",
        SUPABASE_URL: "https://project.supabase.co",
      },
    );

    assert.equal(redirectMode, "manual");
    assert.equal(response.status, 503);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("claymatching completes the signed wallet to holder-profile session handoff", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const supabaseRedirectModes = [];
  const supabaseRpcNames = [];
  globalThis.fetch = async (request, init = {}) => {
    const url = new URL(String(request));
    if (url.hostname === "project.supabase.co") {
      supabaseRedirectModes.push(init.redirect);
      if (url.pathname === "/auth/v1/user") {
        return Response.json({
          id: "11111111-1111-4111-8111-111111111111",
          identities: [{
            identity_data: { address: OWNER, chain: "solana" },
            provider: "web3",
            provider_id: OWNER,
          }],
        });
      }
      if (url.pathname.endsWith("/get_clay_access_state")) {
        supabaseRpcNames.push("get_clay_access_state");
        const signed = supabaseRpcNames.includes("confirm_clay_holder");
        return Response.json([signed
          ? clayAccessStateRow()
          : clayAccessStateRow({
            account_state: null,
            can_dm: false,
            can_post: false,
            consent_current: false,
            membership_mode: null,
            posting_access_until: null,
            profile_exists: false,
            signed_solana_address: null,
            signed_solana_verified_until: null,
          })]);
      }
      if (url.pathname.endsWith("/confirm_clay_holder")) {
        supabaseRpcNames.push("confirm_clay_holder");
        return Response.json([{
          holder_verified_at: "2026-07-13T18:00:00.000Z",
          holder_verified_until: "2026-07-14T18:00:00.000Z",
          user_id: "11111111-1111-4111-8111-111111111111",
        }]);
      }
    }
    if (url.hostname === "mainnet.helius-rpc.com") {
      return Response.json({ result: { items: [asset()] } });
    }
    throw new Error(`Unexpected test request: ${url}`);
  };

  try {
    const response = await worker.fetch(
      new Request("https://claymatching.luna21e8.xyz/api/claymatching/session", {
        method: "POST",
        headers: {
          Authorization: "Bearer this-is-a-long-placeholder-token-for-the-test-only",
          "Content-Type": "application/json",
          Origin: "https://claymatching.luna21e8.xyz",
        },
        body: JSON.stringify({
          adultAttested: true,
          holderAttested: true,
          lawfulUseAttested: true,
        }),
      }),
      {
        CLAYMATCHING_COLLECTION_IDS: COLLECTION,
        CLAYMATCHING_HOSTS: "claymatching.luna21e8.xyz",
        CLAYMATCHING_SESSION_SECRET: "a-secure-test-session-secret-that-is-long-enough",
        HELIUS_API_KEY: "test-helius-key",
        SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
        SUPABASE_SECRET_KEY: "test-secret-key",
        SUPABASE_URL: "https://project.supabase.co",
      },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.authenticated, true);
    assert.equal(body.walletAddress, OWNER);
    assert.equal(body.assets.length, 1);
    assert.deepEqual(supabaseRedirectModes, ["manual", "manual", "manual", "manual"]);
    assert.deepEqual(supabaseRpcNames, ["get_clay_access_state", "confirm_clay_holder", "get_clay_access_state"]);
    assert.doesNotMatch(supabaseRpcNames.join(" "), /get_clay_bound_wallet_account/);
    assert.match(response.headers.get("Set-Cookie"), /__Host-claymatching_session=/);
    assert.match(response.headers.get("Set-Cookie"), /HttpOnly/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("claymatching rejects a Solana link challenge used by another account or signed by another wallet", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const signer = createSolanaTestSigner();
  const wrongSigner = createSolanaTestSigner();
  const otherUserId = "22222222-2222-4222-8222-222222222222";
  let authenticatedUserId = TEST_USER_ID;
  let holderWriteAttempts = 0;
  globalThis.fetch = async (request) => {
    const url = new URL(String(request));
    if (url.hostname !== "project.supabase.co") {
      throw new Error(`Unexpected test request: ${url}`);
    }
    if (url.pathname === "/auth/v1/user") {
      return Response.json({ id: authenticatedUserId, identities: [{ provider: "email" }] });
    }
    const rpcName = url.pathname.split("/").at(-1);
    if (rpcName === "begin_clay_solana_link") return Response.json([{ allowed: true }]);
    if (rpcName === "confirm_clay_holder_with_solana_challenge") {
      holderWriteAttempts += 1;
      throw new Error("A mismatched proof must not reach the holder write.");
    }
    throw new Error(`Unexpected test RPC: ${rpcName}`);
  };

  try {
    const env = claymatchingConfiguredEnv({
      CLAYMATCHING_TURNSTILE_SECRET_KEY: "test-turnstile-secret",
    });
    const challengeResponse = await worker.fetch(new Request(
      "https://claymatching.luna21e8.xyz/api/claymatching/solana/challenge",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer this-is-a-long-placeholder-token-for-the-test-only",
          "Content-Type": "application/json",
          Origin: "https://claymatching.luna21e8.xyz",
        },
        body: JSON.stringify({ address: signer.address }),
      },
    ), env);
    const challenge = await challengeResponse.json();
    assert.equal(challengeResponse.status, 200);

    authenticatedUserId = otherUserId;
    const wrongAccount = await worker.fetch(new Request(
      "https://claymatching.luna21e8.xyz/api/claymatching/solana/link",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer this-is-a-long-placeholder-token-for-the-test-only",
          "Content-Type": "application/json",
          Origin: "https://claymatching.luna21e8.xyz",
        },
        body: JSON.stringify({
          adultAttested: true,
          captchaToken: "test-captcha-token",
          challengeToken: challenge.challengeToken,
          holderAttested: true,
          lawfulUseAttested: true,
          signature: signer.sign(challenge.message),
        }),
      },
    ), env);
    assert.equal(wrongAccount.status, 400);

    authenticatedUserId = TEST_USER_ID;
    const wrongWallet = await worker.fetch(new Request(
      "https://claymatching.luna21e8.xyz/api/claymatching/solana/link",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer this-is-a-long-placeholder-token-for-the-test-only",
          "Content-Type": "application/json",
          Origin: "https://claymatching.luna21e8.xyz",
        },
        body: JSON.stringify({
          adultAttested: true,
          captchaToken: "test-captcha-token",
          challengeToken: challenge.challengeToken,
          holderAttested: true,
          lawfulUseAttested: true,
          signature: wrongSigner.sign(challenge.message),
        }),
      },
    ), env);
    assert.equal(wrongWallet.status, 401);
    assert.equal(holderWriteAttempts, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("claymatching Solana activation consumes its one-use challenge and rejects replay", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const signer = createSolanaTestSigner();
  let confirmationAttempts = 0;
  globalThis.fetch = async (request, init = {}) => {
    const url = new URL(String(request));
    if (url.hostname === "project.supabase.co") {
      if (url.pathname === "/auth/v1/user") {
        return Response.json({ id: TEST_USER_ID, identities: [{ provider: "email" }] });
      }
      const rpcName = url.pathname.split("/").at(-1);
      if (rpcName === "begin_clay_solana_link") return Response.json([{ allowed: true }]);
      if (rpcName === "confirm_clay_holder_with_solana_challenge") {
        confirmationAttempts += 1;
        if (confirmationAttempts > 1) {
          return Response.json({ message: "challenge already consumed" }, { status: 409 });
        }
        return Response.json([{
          holder_verified_at: "2026-07-14T20:00:00.000Z",
          holder_verified_until: new Date(Date.now() + 3600_000).toISOString(),
          user_id: TEST_USER_ID,
        }]);
      }
      if (rpcName === "get_clay_access_state") {
        return Response.json([clayAccessStateRow({
          signed_solana_address: signer.address,
        })]);
      }
      throw new Error(`Unexpected test RPC: ${rpcName}`);
    }
    if (url.hostname === "challenges.cloudflare.com") {
      return Response.json({
        hostname: "claymatching.luna21e8.xyz",
        success: true,
      });
    }
    if (url.hostname === "mainnet.helius-rpc.com") {
      const payload = JSON.parse(init.body);
      assert.equal(payload.params.ownerAddress, signer.address);
      return Response.json({ result: { items: [asset({ owner: signer.address })] } });
    }
    throw new Error(`Unexpected test request: ${url}`);
  };

  try {
    const env = claymatchingConfiguredEnv({
      CLAYMATCHING_TURNSTILE_SECRET_KEY: "test-turnstile-secret",
    });
    const challengeResponse = await worker.fetch(new Request(
      "https://claymatching.luna21e8.xyz/api/claymatching/solana/challenge",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer this-is-a-long-placeholder-token-for-the-test-only",
          "Content-Type": "application/json",
          Origin: "https://claymatching.luna21e8.xyz",
        },
        body: JSON.stringify({ address: signer.address }),
      },
    ), env);
    const challenge = await challengeResponse.json();
    assert.equal(challengeResponse.status, 200);

    const linkRequest = () => new Request(
      "https://claymatching.luna21e8.xyz/api/claymatching/solana/link",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer this-is-a-long-placeholder-token-for-the-test-only",
          "Content-Type": "application/json",
          Origin: "https://claymatching.luna21e8.xyz",
        },
        body: JSON.stringify({
          adultAttested: true,
          captchaToken: "test-captcha-token",
          challengeToken: challenge.challengeToken,
          holderAttested: true,
          lawfulUseAttested: true,
          signature: signer.sign(challenge.message),
        }),
      },
    );

    const linked = await worker.fetch(linkRequest(), env);
    assert.equal(linked.status, 200);
    assert.match(linked.headers.get("Set-Cookie"), /__Host-claymatching_session=/);

    const replayed = await worker.fetch(linkRequest(), env);
    assert.equal(replayed.status, 409);
    assert.equal(replayed.headers.get("Set-Cookie"), null);
    assert.equal(confirmationAttempts, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("claymatching Solana activation fails closed before identity or asset writes when consent or Turnstile configuration is missing", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let upstreamRequests = 0;
  globalThis.fetch = async () => {
    upstreamRequests += 1;
    throw new Error("The invalid activation must fail before any upstream request.");
  };

  try {
    const baseRequest = (body) => new Request(
      "https://claymatching.luna21e8.xyz/api/claymatching/solana/link",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer this-is-a-long-placeholder-token-for-the-test-only",
          "Content-Type": "application/json",
          Origin: "https://claymatching.luna21e8.xyz",
        },
        body: JSON.stringify(body),
      },
    );

    const missingSecret = await worker.fetch(baseRequest({
      adultAttested: true,
      holderAttested: true,
      lawfulUseAttested: true,
    }), claymatchingConfiguredEnv());
    assert.equal(missingSecret.status, 503);

    const missingConsent = await worker.fetch(baseRequest({
      adultAttested: true,
      holderAttested: false,
      lawfulUseAttested: true,
    }), claymatchingConfiguredEnv({
      CLAYMATCHING_TURNSTILE_SECRET_KEY: "test-turnstile-secret",
    }));
    assert.equal(missingConsent.status, 403);
    assert.equal((await missingConsent.json()).consentRequired, true);
    assert.equal(upstreamRequests, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("claymatching Solana activation rejects invalid or wrong-host Turnstile proofs before holder confirmation", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const signer = createSolanaTestSigner();
  let turnstileChecks = 0;
  let holderWriteAttempts = 0;
  let heliusRequests = 0;
  globalThis.fetch = async (request) => {
    const url = new URL(String(request));
    if (url.hostname === "project.supabase.co") {
      if (url.pathname === "/auth/v1/user") {
        return Response.json({ id: TEST_USER_ID, identities: [{ provider: "email" }] });
      }
      const rpcName = url.pathname.split("/").at(-1);
      if (rpcName === "begin_clay_solana_link") return Response.json([{ allowed: true }]);
      if (rpcName === "confirm_clay_holder_with_solana_challenge") {
        holderWriteAttempts += 1;
        throw new Error("Turnstile failures must not reach holder confirmation.");
      }
      throw new Error(`Unexpected test RPC: ${rpcName}`);
    }
    if (url.hostname === "challenges.cloudflare.com") {
      turnstileChecks += 1;
      return turnstileChecks === 1
        ? Response.json({ success: false })
        : Response.json({ hostname: "attacker.invalid", success: true });
    }
    if (url.hostname === "mainnet.helius-rpc.com") {
      heliusRequests += 1;
      throw new Error("Turnstile failures must not reach Helius.");
    }
    throw new Error(`Unexpected test request: ${url}`);
  };

  try {
    const env = claymatchingConfiguredEnv({
      CLAYMATCHING_TURNSTILE_SECRET_KEY: "test-turnstile-secret",
    });
    const challengeResponse = await worker.fetch(new Request(
      "https://claymatching.luna21e8.xyz/api/claymatching/solana/challenge",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer this-is-a-long-placeholder-token-for-the-test-only",
          "Content-Type": "application/json",
          Origin: "https://claymatching.luna21e8.xyz",
        },
        body: JSON.stringify({ address: signer.address }),
      },
    ), env);
    const challenge = await challengeResponse.json();
    assert.equal(challengeResponse.status, 200);

    const linkRequest = () => new Request(
      "https://claymatching.luna21e8.xyz/api/claymatching/solana/link",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer this-is-a-long-placeholder-token-for-the-test-only",
          "Content-Type": "application/json",
          Origin: "https://claymatching.luna21e8.xyz",
        },
        body: JSON.stringify({
          adultAttested: true,
          captchaToken: "test-captcha-token",
          challengeToken: challenge.challengeToken,
          holderAttested: true,
          lawfulUseAttested: true,
          signature: signer.sign(challenge.message),
        }),
      },
    );

    const invalid = await worker.fetch(linkRequest(), env);
    const wrongHost = await worker.fetch(linkRequest(), env);
    assert.equal(invalid.status, 403);
    assert.equal(wrongHost.status, 403);
    assert.equal(turnstileChecks, 2);
    assert.equal(holderWriteAttempts, 0);
    assert.equal(heliusRequests, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("claymatching explicitly activates eligible read-only Solana posting without claiming wallet ownership", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const readOnlyAddress = createSolanaTestSigner().address;
  const rpcCalls = [];
  const future = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
  const checkedAt = new Date().toISOString();
  let turnstileChecks = 0;
  let heliusChecks = 0;

  globalThis.fetch = async (request, init = {}) => {
    const url = new URL(String(request));
    if (url.hostname === "project.supabase.co") {
      if (url.pathname === "/auth/v1/user") {
        return Response.json({
          email: "readonly@example.test",
          id: TEST_USER_ID,
          identities: [{ provider: "email" }],
        });
      }
      const rpcName = url.pathname.split("/").at(-1);
      const payload = JSON.parse(init.body || "{}");
      rpcCalls.push({ name: rpcName, payload });
      if (rpcName === "confirm_clay_read_only_access") {
        return Response.json([{
          access_until: future,
          can_dm: false,
          can_post: true,
          checked_at: checkedAt,
          membership_mode: "read_only_solana",
          user_id: TEST_USER_ID,
        }]);
      }
      if (rpcName === "get_clay_access_state") {
        return Response.json([{
          account_state: "active",
          can_dm: false,
          can_post: true,
          consent_current: true,
          membership_mode: "read_only_solana",
          posting_access_until: future,
          profile_exists: true,
          read_only_access_until: future,
          read_only_asset_count: 2,
          read_only_checked_at: checkedAt,
          read_only_solana_address: readOnlyAddress,
          signed_solana_address: null,
          signed_solana_verified_until: null,
          sui_address: null,
          sui_verified_at: null,
        }]);
      }
      throw new Error(`Unexpected test RPC: ${rpcName}`);
    }
    if (url.hostname === "challenges.cloudflare.com") {
      turnstileChecks += 1;
      const payload = JSON.parse(init.body || "{}");
      assert.equal(payload.secret, "test-turnstile-secret");
      assert.equal(payload.response, "test-captcha-token");
      assert.equal(payload.remoteip, "203.0.113.10");
      return Response.json({ hostname: "claymatching.luna21e8.xyz", success: true });
    }
    if (url.hostname === "mainnet.helius-rpc.com") {
      heliusChecks += 1;
      const payload = JSON.parse(init.body || "{}");
      assert.equal(payload.params.ownerAddress, readOnlyAddress);
      return Response.json({
        result: {
          items: [
            asset({ id: "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", owner: readOnlyAddress }),
            asset({ id: "EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE", owner: readOnlyAddress }),
          ],
        },
      });
    }
    throw new Error(`Unexpected test request: ${url}`);
  };

  try {
    const response = await worker.fetch(new Request(
      "https://claymatching.luna21e8.xyz/api/claymatching/solana/read-only",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer this-is-a-long-placeholder-token-for-the-test-only",
          "CF-Connecting-IP": "203.0.113.10",
          "Content-Type": "application/json",
          Origin: "https://claymatching.luna21e8.xyz",
          "User-Agent": "Claymatching read-only activation test",
        },
        body: JSON.stringify({
          address: readOnlyAddress,
          adultAttested: true,
          captchaToken: "test-captcha-token",
          eligibleAssetCount: 999,
          holderAttested: true,
          lawfulUseAttested: true,
        }),
      },
    ), claymatchingConfiguredEnv({
      CLAYMATCHING_TURNSTILE_SECRET_KEY: "test-turnstile-secret",
    }));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.authenticated, true);
    assert.equal(body.canPost, true);
    assert.equal(body.canDm, false);
    assert.equal(body.holder, false);
    assert.equal(body.readOnly, true);
    assert.equal(body.verified, false);
    assert.equal(body.membershipMode, "read_only_solana");
    assert.equal(body.walletAddress, null);
    assert.equal(body.signedSolanaAddress, null);
    assert.equal(body.connectedWallets?.solana, false);
    assert.equal(body.readOnlySolanaAddress, readOnlyAddress);
    assert.deepEqual(body.assets, []);
    assert.match(response.headers.get("Set-Cookie"), /__Host-claymatching_session=/);
    assert.equal(turnstileChecks, 1);
    assert.equal(heliusChecks, 1);
    assert.deepEqual(rpcCalls.map(({ name }) => name), [
      "confirm_clay_read_only_access",
      "get_clay_access_state",
    ]);

    const confirmation = rpcCalls[0].payload;
    assert.equal(confirmation.raw_user_id, TEST_USER_ID);
    assert.equal(confirmation.raw_wallet_address, readOnlyAddress);
    assert.equal(confirmation.raw_asset_count, 2, "the server derives eligibility; it never trusts the browser count");
    assert.equal(confirmation.raw_adult_attested, true);
    assert.equal(confirmation.raw_holder_attested, true);
    assert.equal(confirmation.raw_lawful_use_attested, true);
    assert.equal(confirmation.raw_terms_version, "2026-07-13");
    assert.equal(Object.hasOwn(confirmation, "raw_assets"), false);
    assert.doesNotMatch(rpcCalls.map(({ name }) => name).join(" "), /confirm_clay_holder|clay_holder_assets|clay_wallet_accounts/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("claymatching read-only activation fails before eligibility persistence without attestations or a valid Turnstile proof", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const readOnlyAddress = createSolanaTestSigner().address;
  let authChecks = 0;
  let turnstileChecks = 0;
  let forbiddenEligibilityWork = 0;

  globalThis.fetch = async (request) => {
    const url = new URL(String(request));
    if (url.hostname === "project.supabase.co" && url.pathname === "/auth/v1/user") {
      authChecks += 1;
      return Response.json({ id: TEST_USER_ID, identities: [{ provider: "email" }] });
    }
    if (url.hostname === "challenges.cloudflare.com") {
      turnstileChecks += 1;
      return Response.json({ success: false });
    }
    if (url.hostname === "mainnet.helius-rpc.com" || url.pathname.includes("/rest/v1/rpc/")) {
      forbiddenEligibilityWork += 1;
      throw new Error("Invalid read-only activation must not check assets or persist access.");
    }
    throw new Error(`Unexpected test request: ${url}`);
  };

  const request = (overrides = {}) => new Request(
    "https://claymatching.luna21e8.xyz/api/claymatching/solana/read-only",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer this-is-a-long-placeholder-token-for-the-test-only",
        "Content-Type": "application/json",
        Origin: "https://claymatching.luna21e8.xyz",
      },
      body: JSON.stringify({
        address: readOnlyAddress,
        adultAttested: true,
        captchaToken: "test-captcha-token",
        holderAttested: true,
        lawfulUseAttested: true,
        ...overrides,
      }),
    },
  );

  try {
    const env = claymatchingConfiguredEnv({
      CLAYMATCHING_TURNSTILE_SECRET_KEY: "test-turnstile-secret",
    });
    const missingAttestation = await worker.fetch(request({ holderAttested: false }), env);
    const invalidTurnstile = await worker.fetch(request(), env);

    assert.equal(missingAttestation.status, 403);
    assert.equal((await missingAttestation.json()).consentRequired, true);
    assert.equal(invalidTurnstile.status, 403);
    assert.equal(authChecks, 1, "only the otherwise-valid request reaches Supabase authentication");
    assert.equal(turnstileChecks, 1);
    assert.equal(forbiddenEligibilityWork, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("claymatching account UI includes persistent profile, Clayno, and sign-out controls", async () => {
  const [html, script, styles] = await Promise.all([
    readFile(new URL("../site/claymatching/index.html", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(html, /data-account-menu/);
  assert.match(html, /profile \+ my Claynos/);
  assert.match(html, /data-account-sign-out/);
  assert.match(html, /data-compose-signal/);
  assert.match(html, /data-signal-inbox/);
  assert.match(html, /data-mention-notifications/);
  assert.match(html, /data-signal-notifications/);
  assert.match(html, /data-signal-recipients/);
  assert.match(html, /data-reply-context/);
  assert.match(html, /data-cancel-reply/);
  assert.match(html, /data-member-profile-dialog/);
  assert.match(html, /data-admin-member-state="banned"/);
  assert.match(html, /restore account/);
  assert.match(html, /data-passkey-signin/);
  assert.match(html, /No password is ever created/);
  assert.match(html, /passkey-steps/);
  assert.match(html, /data-email-signin-form/);
  assert.match(html, /data-email-otp-entry/);
  assert.match(html, /data-verify-email-code/);
  assert.match(html, /autocomplete="one-time-code"/);
  assert.match(html, /data-link-email-otp/);
  assert.match(html, /data-verify-link-email/);
  assert.match(html, /data-apple-signin/);
  assert.match(html, /appleid\.cdn-apple\.com\/appleid\/button/);
  assert.match(html, /Mudprint links/);
  assert.match(html, /data-custom-background-preview/);
  assert.match(html, /name="customBackgroundTarget" value="profile"/);
  assert.match(html, /name="customBackgroundTarget" value="post"/);
  assert.match(html, /name="customProfileBackgroundUrl"/);
  assert.match(html, /name="customPostBackgroundUrl"/);
  assert.match(html, /data-custom-background-panel="profile"/);
  assert.match(html, /data-custom-background-panel="post"/);
  assert.match(html, /Each custom post keeps the image it was posted with/);
  assert.match(html, /data-profile-name[\s\S]*data-profile-achievements[\s\S]*data-profile-collect-link/);
  assert.match(script, /pendingConsentSession = session/);
  assert.match(script, /applyAccessCapabilities\(membership\)/);
  assert.match(script, /signOut\(\{ scope: "local" \}\)/);
  assert.match(script, /showSignalComposer/);
  assert.match(script, /p_target_user_id: targetUserId/);
  assert.match(script, /appendRoleBadge/);
  assert.match(script, /★ ADMIN/);
  assert.match(script, /setReplyTarget/);
  assert.match(script, /renderTaggedPostBody/);
  assert.match(script, /mark_clay_notifications_read/);
  assert.match(script, /renderSignalInbox/);
  assert.match(script, /openMemberProfile/);
  assert.match(script, /admin_set_clay_account_state/);
  assert.match(script, /experimental: \{ passkey: true \}/);
  assert.match(script, /signInWithPasskey\(\)/);
  assert.match(script, /registerPasskey\(\)/);
  assert.match(script, /shouldCreateUser: true/);
  assert.match(script, /verifyOtp\(\{ email, token, type: "email" \}\)/);
  assert.match(script, /verifyOtp\(\{ email, token, type: "email_change" \}\)/);
  assert.match(script, /Choose read-only Solana or verify a wallet whenever you are ready/);
  assert.match(script, /function readableErrorMessage/);
  assert.match(script, /sender domain still needs verification/);
  assert.doesNotMatch(script, /Magic link sent/);
  assert.match(script, /linkIdentity\(\{/);
  assert.match(script, /normalizeHttpsImageUrl/);
  assert.match(script, /update_clay_profile_v2/);
  assert.match(script, /raw_custom_profile_background_url/);
  assert.match(script, /raw_custom_post_background_url/);
  assert.match(script, /snapshottedPostBackgroundUrl\(post, author\)/);
  assert.match(script, /savedCustomBackgroundUrl\(currentProfile, "post"\)/);
  assert.match(script, /renderProfileAchievementShowcase\(profileAchievements, profile\)/);
  assert.match(script, /renderClayCollectLinkSlot\(profileCollectLink, profile\)/);
  assert.doesNotMatch(styles, /\.clay-button-cream\s*\{[^}]*width:\s*100%/);
  assert.match(styles, /\.member-admin-panel > div\s*\{[^}]*grid-template-columns:\s*repeat\(3,/);
  assert.match(styles, /\.profile-dialog\s*\{[^}]*1180px/);
  assert.match(styles, /\.mudprint-link-grid/);
  assert.match(styles, /\.post-card > p\s*\{[^}]*font-family:\s*var\(--font-display\)/);
  assert.match(styles, /\.mudprint-link-grid\s*\{[^}]*align-items:\s*start/);
  assert.match(styles, /\.post-custom/);
  assert.match(styles, /\.custom-background-target-picker/);
  assert.match(styles, /\.custom-background-post-sample/);
  assert.match(styles, /\.notification-badge/);
  assert.match(styles, /\.signal-inbox/);
  assert.match(styles, /\.mention-link/);
  const profileStatusCss = styles.match(/\.profile-status\s*\{([^}]*)\}/)?.[1] || "";
  const profileStatusFontSize = Number(profileStatusCss.match(/font-size:\s*([\d.]+)px/)?.[1]);
  const profileAdminCss = styles.match(/\.profile-body h2 > \.role-badge\s*\{([^}]*)\}/)?.[1] || "";
  const profileAdminFontSize = Number(profileAdminCss.match(/font-size:\s*([\d.]+)px/)?.[1]);
  assert.ok(profileStatusFontSize >= 12, "online-ish should remain readable on the profile art");
  assert.match(profileStatusCss, /padding:\s*(?:8|9|10)px\s+(?:12|13|14|15|16)px/);
  assert.ok(profileAdminFontSize >= 12, "the sidebar admin badge should remain readable beside the username");
  assert.match(styles, /\.profile-achievement-showcase\s*\{[^}]*display:\s*(?:grid|flex)[^}]*margin-top:/);
  assert.match(styles, /\.achievement-chip-showcase\s*\{[^}]*width:\s*100%[^}]*border:\s*2px solid var\(--ink\)/);
  assert.match(styles, /\.achievement-chip-showcase\[data-achievement-tone="(?:mint|sky|lavender|coral)"\]/);
});

test("claymatching account-menu actions survive touch focus changes and transient asset refresh failures", async () => {
  const script = await readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8");
  const openProfile = script.match(
    /async function openAccountProfile\(\)[\s\S]*?\n}\n\nasync function handleWalletButton/i,
  )?.[0] || "";
  const focusout = script.match(
    /accountArea\.addEventListener\("focusout",[\s\S]*?\n}\);/i,
  )?.[0] || "";

  assert.match(script, /accountProfileButton\.addEventListener\("click", openAccountProfile\)/);
  assert.match(script, /accountSignOutButton\.addEventListener\("click", signOut\)/);
  assert.match(focusout, /event\.relatedTarget && !accountArea\.contains\(event\.relatedTarget\)/);
  assert.doesNotMatch(focusout, /requestAnimationFrame|document\.activeElement/);
  assert.match(openProfile, /const refreshed = await refreshOwnedAvatarAssets\(\)/);
  assert.match(openProfile, /if \(!holderSessionReady\) return/);
  assert.match(openProfile, /if \(!refreshed\)[\s\S]*last verified collectible list/);
  assert.ok(
    openProfile.indexOf("openProfileDialog()") > openProfile.indexOf("if (!refreshed)"),
    "a temporary collectible refresh failure should still open the cached profile",
  );
});

test("claymatching offers three onboarding methods while keeping provisional accounts and preview assets locked", async () => {
  const [html, script, styles] = await Promise.all([
    readFile(new URL("../site/claymatching/index.html", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/styles.css", import.meta.url), "utf8"),
  ]);
  const provisionalRenderer = script.match(
    /function renderProvisionalPreviewAssets\([\s\S]*?\n}\n\nfunction renderProvisionalIdentity/,
  )?.[0] || "";

  assert.equal((html.match(/class="entry-method-card /g) || []).length, 3);
  assert.match(html, /<h3>Solana wallet<\/h3>/);
  assert.match(html, /<h3>Passwordless email<\/h3>/);
  assert.match(html, /<h3>Sign in with Apple<\/h3>/);
  assert.match(html, /data-provisional-shell[\s\S]*COMMUNITY ACCESS LOCKED/);
  assert.match(html, /READ-ONLY · UNVERIFIED/);
  assert.match(html, /cannot become your avatar, verified-holder badge, or wallet credential/i);
  assert.match(script, /function showProvisionalOnboarding\([\s\S]*appShell\.hidden = true[\s\S]*setHolderNavigationLocked\(true\)/);
  assert.match(script, /if \(error\.provisional\) \{[\s\S]*showProvisionalOnboarding\(session\)/);
  assert.match(provisionalRenderer, /provisionalPreviewAssets\s*=/);
  assert.doesNotMatch(provisionalRenderer, /ownedAssets\s*=|currentProfile\s*=|update_clay_profile/);
  assert.match(styles, /\.provisional-asset::after\s*\{[^}]*content:\s*"LOCKED"/);
  assert.match(styles, /\.provisional-shell\s*\{/);
});

test("claymatching keeps the synced cabinet tidy in the narrow profile rail", async () => {
  const [script, styles] = await Promise.all([
    readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/styles.css", import.meta.url), "utf8"),
  ]);
  const renderer = script.match(/function clayAchievementChip\([\s\S]*?\n}\n\nfunction featuredAchievementTone/)?.[0] || "";
  const showcaseCss = styles.match(/\.achievement-chip-showcase\s*\{([^}]*)\}/)?.[1] || "";

  assert.match(renderer, /className = "achievement-chip-value"/);
  assert.match(renderer, /total\.textContent = String\(count\)/);
  assert.match(renderer, /unit\.textContent = `achievement/);
  assert.doesNotMatch(renderer, /button\.title\s*=/);
  assert.match(showcaseCss, /grid-template-columns:\s*30px minmax\(0, 1fr\) 28px/);
  assert.match(showcaseCss, /min-height:\s*52px/);
  assert.match(showcaseCss, /white-space:\s*nowrap/);
  assert.match(styles, /\.achievement-chip-value\s*\{[^}]*display:\s*flex[^}]*white-space:\s*nowrap/);
});

test("claymatching reply-composer state stays legible", async () => {
  const [script, styles] = await Promise.all([
    readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/styles.css", import.meta.url), "utf8"),
  ]);
  const cssRule = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] || "";
  };
  const fontSize = (rule) => Number(rule.match(/font-size:\s*([\d.]+)px/)?.[1]);
  const replyContextCss = cssRule(".reply-context");
  const replyCancelCss = cssRule(".reply-context button");

  assert.match(replyContextCss, /font-family:\s*var\(--font-display\)/);
  assert.ok(fontSize(replyContextCss) >= 14, "the active reply context should be at least 14px");
  assert.ok(fontSize(replyCancelCss) >= 12, "the cancel-reply action should be at least 12px");
  assert.match(script, /replyContextCopy\.textContent\s*=\s*`Replying to @\$\{/);
});

test("claymatching published replies visibly reference their parent author and content", async () => {
  const [script, styles] = await Promise.all([
    readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/styles.css", import.meta.url), "utf8"),
  ]);
  const parentReferenceCss = styles.match(/\.post-parent-reference\s*\{([^}]*)\}/)?.[1] || "";
  const parentReferenceFontSize = Number(parentReferenceCss.match(/font-size:\s*([\d.]+)px/)?.[1]);
  const feedRenderer = script.match(/function renderFeed\([\s\S]*?\n}\n\nfunction renderMatches/)?.[0] || "";

  assert.match(feedRenderer, /className\s*=\s*["']post-parent-reference["']/);
  assert.match(feedRenderer, /parentPost/);
  assert.match(feedRenderer, /parentAuthor/);
  assert.match(feedRenderer, /parentPost\.body/);
  assert.match(parentReferenceCss, /font-family:\s*var\(--font-display\)/);
  assert.ok(parentReferenceFontSize >= 13, "published reply references should be readable");
  assert.doesNotMatch(feedRenderer, /parent(?:Post|Reference)[^\n]*(?:innerHTML|outerHTML|insertAdjacentHTML|srcdoc)/i);
});

test("claymatching every rendered post has a readable display-font timestamp", async () => {
  const [script, styles] = await Promise.all([
    readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/styles.css", import.meta.url), "utf8"),
  ]);
  const postTimestampCss = styles.match(/\.post-timestamp\s*\{([^}]*)\}/)?.[1] || "";
  const postTimestampFontSize = Number(postTimestampCss.match(/font-size:\s*([\d.]+)px/)?.[1]);
  const feedRenderer = script.match(/function renderFeed\([\s\S]*?\n}\n\nfunction renderMatches/)?.[0] || "";

  assert.match(feedRenderer, /className\s*=\s*["']post-timestamp["']/);
  assert.match(feedRenderer, /relativeTime\(post\.created_at\)/);
  assert.match(postTimestampCss, /font-family:\s*var\(--font-display\)/);
  assert.ok(postTimestampFontSize >= 13, "every post timestamp should be at least 13px");
});

test("claymatching achievement showcase uses an informative custom tooltip without a native title", async () => {
  const [script, styles] = await Promise.all([
    readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/styles.css", import.meta.url), "utf8"),
  ]);
  const renderer = script.match(/function clayAchievementChip\([\s\S]*?\n}\n\nfunction featuredAchievementTone/)?.[0] || "";
  const showcaseBranch = renderer.match(/if \(showcase\) \{[\s\S]*?\n  } else \{/)?.[0] || "";

  assert.match(showcaseBranch, /dataset\.tooltip\s*=/);
  assert.match(showcaseBranch, /wallet-matched/i);
  assert.match(showcaseBranch, /\bcount\b/);
  assert.match(showcaseBranch, /relativeTime\(profile\.collect_achievements_synced_at\)/);
  assert.doesNotMatch(renderer, /button\.title\s*=|setAttribute\(["']title["']/i);
  const hasPseudoTooltip = /\.achievement-chip-showcase::after\s*\{[^}]*content:\s*attr\(data-tooltip\)/.test(styles)
    && /\.achievement-chip-showcase:hover::after/.test(styles)
    && /\.achievement-chip-showcase:focus-visible::after/.test(styles);
  const hasFixedTooltip = /\.achievement-tooltip\s*\{[^}]*position:\s*fixed/.test(styles)
    && /achievementTooltip/.test(script)
    && /getBoundingClientRect\(\)/.test(script)
    && /Math\.(?:min|max)\(/.test(script);
  assert.ok(hasPseudoTooltip || hasFixedTooltip, "the showcase should use a keyboard-accessible custom tooltip that can avoid viewport clipping");
});

test("claymatching Signals uses the display type and keeps active inboxes compact", async () => {
  const [html, styles] = await Promise.all([
    readFile(new URL("../site/claymatching/index.html", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/styles.css", import.meta.url), "utf8"),
  ]);
  const cssRule = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] || "";
  };

  const navTabCss = cssRule(".nav-tab");
  const encryptedPillCss = cssRule(".encrypted-pill");
  const inboxHeaderCss = cssRule(".signal-inbox > header");
  const threadButtonCss = cssRule(".signal-thread > button");
  const threadNameCss = cssRule(".signal-thread-copy b");
  const threadPreviewCss = cssRule(".signal-thread-copy p");
  const relayCopy = html
    .match(/<span[^>]*class="[^"]*\bencrypted-pill\b[^"]*"[^>]*>([^<]*)<\/span>/i)?.[1]
    ?.replace(/\s+/g, " ")
    .trim();

  assert.match(navTabCss, /font-family:\s*var\(--font-display\)/);
  assert.match(encryptedPillCss, /font-family:\s*var\(--font-display\)/);
  assert.equal(relayCopy, "RELAY LIVE - END TO END ENCRYPTED");
  assert.doesNotMatch(html, /sealed and delivered/i);
  assert.match(inboxHeaderCss, /align-items:\s*(?:flex-start|start)/);
  assert.doesNotMatch(threadButtonCss, /grid-column:\s*1\s*\/\s*-1/);

  const threadNameFontSize = Number(threadNameCss.match(/font-size:\s*([\d.]+)px/)?.[1]);
  const threadPreviewFontSize = Number(threadPreviewCss.match(/font-size:\s*([\d.]+)px/)?.[1]);
  assert.match(threadNameCss, /font-family:\s*var\(--font-display\)/);
  assert.ok(threadNameFontSize >= 20, "Signals usernames should be prominent and readable");
  assert.match(threadPreviewCss, /font-family:\s*var\(--font-display\)/);
  assert.ok(threadPreviewFontSize >= 16, "Signals message previews should be prominent and readable");
});

test("claymatching public copy never describes device cryptography as private keys", async () => {
  const [html, script] = await Promise.all([
    readFile(new URL("../site/claymatching/index.html", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8"),
  ]);
  const userFacingPrivateKeyPhrase = /\bprivate\s+keys?\b/i;

  assert.doesNotMatch(html, userFacingPrivateKeyPhrase);
  assert.doesNotMatch(script, userFacingPrivateKeyPhrase);
});

test("claymatching supporting cards keep their small copy readable", async () => {
  const styles = await readFile(new URL("../site/claymatching/styles.css", import.meta.url), "utf8");
  const cssRule = (selector) => {
    for (const match of styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectors = match[1].split(",").map((candidate) => candidate.trim());
      if (selectors.includes(selector)) return match[2];
    }
    return "";
  };
  const fontSize = (selector) => Number(cssRule(selector).match(/font-size:\s*([\d.]+)px/)?.[1]);
  const assertReadable = (selector, minimum, label) => {
    const size = fontSize(selector);
    assert.ok(Number.isFinite(size), `${label} should declare an explicit font size`);
    assert.ok(size >= minimum, `${label} should be at least ${minimum}px`);
  };

  assertReadable(".profile-tags span", 12, "profile tags");
  assertReadable(".little-note p", 12, "house-rules body copy");
  assertReadable(".signal-directory-empty p", 13, "empty Signals-directory copy");
  assertReadable(".signal-guardrails span", 12, "Signals guardrail numbers");
  assertReadable(".signal-guardrails b", 18, "Signals guardrail titles");
  assertReadable(".signal-guardrails p", 12, "Signals guardrail body copy");
  assertReadable(".unofficial-note", 11, "unofficial holder note");
  assertReadable(".prompt-card span", 12, "prompt-card kicker");
  assertReadable(".prompt-card button", 12, "prompt-card answer link");
});

test("claymatching uses Clay Bubble across the UI without legacy Arial or Inter stacks", async () => {
  const styles = await readFile(new URL("../site/claymatching/styles.css", import.meta.url), "utf8");
  const bodyCss = styles.match(/body\s*\{([^}]*)\}/)?.[1] || "";
  const fontRules = [...styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)];

  assert.match(styles, /@font-face\s*\{[^}]*font-family:\s*["']Clay Bubble["']/);
  assert.match(bodyCss, /font-family:\s*var\(--font-display\)/);
  assert.doesNotMatch(styles, /\b(?:Arial|Inter)\b/i);
  for (const control of ["button", "input", "select", "textarea"]) {
    const inheritsClayBubble = fontRules.some(([, selectorList, declarations]) => (
      selectorList.split(",").map((selector) => selector.trim()).includes(control)
      && /font(?:-family)?:\s*inherit/.test(declarations)
    ));
    assert.ok(inheritsClayBubble, `${control} controls should inherit the global Clay Bubble font`);
  }
});

test("claymatching Collect profiles are manual self-attested links, never imported claims", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260713230000_claymatching_collect_profile_links.sql", import.meta.url),
    "utf8",
  );
  const setter = migration.match(
    /create or replace function public\.set_clay_collect_profile\([\s\S]*?\n\$\$;/,
  )?.[0] || "";

  assert.match(migration, /add column if not exists collect_profile_id uuid\s*;/i);
  assert.match(migration, /add column if not exists collect_profile_linked_at timestamptz\s*;/i);
  assert.doesNotMatch(migration, /collect_profile_id\s+uuid\s+not null/i);
  assert.doesNotMatch(migration, /collect_profile_linked_at\s+timestamptz\s+not null/i);
  assert.doesNotMatch(migration, /collect_profile_id\s+uuid\s+unique/i);
  assert.doesNotMatch(migration, /create\s+unique\s+index[\s\S]*?collect_profile_id/i);
  assert.doesNotMatch(migration, /unique\s*\(\s*collect_profile_id\s*\)/i);
  assert.match(setter, /security definer/i);
  assert.match(setter, /public\.clay_current_user_can_access\(\)/i);
  assert.match(setter, /where user_id = auth\.uid\(\)/i);
  assert.match(setter, /collect_profile_id = raw_profile_id/i);
  assert.match(setter, /when raw_profile_id is null then null/i);
  assert.match(migration, /revoke execute on function public\.set_clay_collect_profile\(uuid\) from public, anon/i);
  assert.match(migration, /grant execute on function public\.set_clay_collect_profile\(uuid\) to authenticated/i);
  assert.match(migration, /self-attested/i);
  assert.match(migration, /not verified|no ownership verification/i);
});

test("claymatching renders safe Collect links and an explicit wallet-matched SYNC", async () => {
  const [html, script, styles] = await Promise.all([
    readFile(new URL("../site/claymatching/index.html", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/styles.css", import.meta.url), "utf8"),
  ]);

  for (const hook of [
    "data-collect-profile-input",
    "data-save-collect-profile",
    "data-sync-collect-achievements",
    "data-unlink-collect-profile",
    "data-collect-profile-status",
    "data-collect-profile-link",
    "data-collect-link-state",
    "data-profile-collect-link",
    "data-member-profile-collect-link",
    "data-dm-collect-link",
    "data-achievement-dialog",
    "data-achievement-grid",
  ]) {
    assert.match(html, new RegExp(hook));
  }

  assert.match(html, /self-attested/i);
  assert.match(html, /user-triggered/i);
  assert.match(html, /exact signed-wallet match|matches your signed Solana address/i);
  assert.match(script, /function normalizeClayCollectProfileId\(/);
  assert.match(script, /function clayCollectProfileUrl\(/);
  assert.match(script, /function clayCollectProfileLink\(/);
  assert.match(script, /const CLAY_COLLECT_ORIGIN\s*=\s*["']https:\/\/collect\.claynosaurz\.com["']/i);
  assert.match(script, /url\.origin\s*!==\s*CLAY_COLLECT_ORIGIN/i);
  assert.match(script, /url\.username\s*\|\|\s*url\.password\s*\|\|\s*url\.hash/i);
  assert.match(script, /CLAY_COLLECT_UUID_PATTERN\s*=\s*\/\^\[0-9a-f\]\{8\}[-\\]/i);
  assert.match(script, /pathname\.match\(\/\^\\\/profile\\\//i);
  assert.match(script, /pathname\.match\(\/\^\\\/achievements-api\\\/users\\\//i);
  assert.match(script, /`\$\{CLAY_COLLECT_ORIGIN\}\/profile\/\$\{profileId\}\?tab=profile`/);
  assert.match(script, /link\.target\s*=\s*["']_blank["']/);
  assert.match(script, /link\.rel\s*=\s*["']noopener noreferrer nofollow["']/);
  assert.match(script, /\.rpc\(["']set_clay_collect_profile["'],\s*\{\s*raw_profile_id:/s);
  assert.match(script, /collect_profile_id,collect_profile_linked_at/);
  assert.match(script, /fetch\(["']\/api\/claymatching\/collect\/sync["']/i);
  assert.doesNotMatch(script, /fetch\s*\([^)]*collect\.claynosaurz\.com/is);
  assert.match(script, /"X-Clay-CSRF": csrfToken/);
  assert.match(script, /function clayAchievementChip/);
  assert.match(script, /textContent = achievement\.name/);
  assert.doesNotMatch(script, /achievement[^\n]*(?:innerHTML|outerHTML|insertAdjacentHTML|srcdoc)/i);

  const memberProfileRenderer = script.match(/function renderMemberProfile\([\s\S]*?\n}\n\nfunction openMemberProfile/)?.[0] || "";
  const feedRenderer = script.match(/function renderFeed\([\s\S]*?\n}\n\nfunction renderMatches/)?.[0] || "";
  const signalInboxRenderer = script.match(/function renderSignalInbox\([\s\S]*?\n}\n\nasync function refreshSignalInbox/)?.[0] || "";
  assert.match(memberProfileRenderer, /clayCollectProfileLink|renderClayCollectSlot/);
  assert.match(feedRenderer, /clayCollectProfileLink|renderClayCollectSlot/);
  assert.match(signalInboxRenderer, /clayCollectProfileLink|renderClayCollectSlot/);
  assert.match(styles, /\.collect-profile-chip/);
  assert.match(styles, /\.achievement-chip/);
  assert.match(styles, /\.achievement-grid/);
});

test("claymatching featured achievements are selected from the successful synced cabinet and rendered publicly", async () => {
  const [html, script, styles] = await Promise.all([
    readFile(new URL("../site/claymatching/index.html", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/styles.css", import.meta.url), "utf8"),
  ]);
  const profileForm = html.match(/<form[^>]*data-profile-form[\s\S]*?<\/form>/i)?.[0] || "";
  const functionBlock = (name) => {
    const start = script.search(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`));
    if (start < 0) return "";
    const rest = script.slice(start);
    const next = rest.slice(1).search(/\n(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/);
    return next < 0 ? rest : rest.slice(0, next + 1);
  };

  for (const hook of [
    "data-featured-achievement-picker",
    "data-featured-achievement-options",
    "data-featured-achievement-status",
  ]) {
    assert.match(profileForm, new RegExp(hook));
  }
  assert.match(
    profileForm,
    /name="username"[^>]*\/>\s*<\/label>\s*<[^>]*data-featured-achievement-picker/i,
    "the featured-achievement selector should be the next profile-editor control after username",
  );
  assert.match(profileForm, /data-featured-achievement-picker[\s\S]*name="bio"/i);

  assert.match(script, /function featuredClayAchievement\s*\(/);
  assert.match(script, /function renderFeaturedAchievementPicker\s*\(/);
  assert.match(script, /\.from\(["']clay_collect_achievements["']\)/);
  assert.match(script, /\.rpc\(["']set_clay_featured_achievement["'],\s*\{\s*raw_achievement_id:/s);
  assert.match(script, /className\s*=\s*["'][^"']*featured-achievement-badge/);
  assert.doesNotMatch(script, /featured[^\n]*(?:innerHTML|outerHTML|insertAdjacentHTML|srcdoc)/i);

  const picker = functionBlock("renderFeaturedAchievementPicker");
  assert.match(picker, /collect_achievements_synced_at/);
  assert.match(picker, /collect_wallet_matched_at/);
  assert.match(picker, /current(?:Session|Profile)/);
  assert.match(picker, /achievement_id/);
  assert.doesNotMatch(picker, /collect\.claynosaurz\.com|\/api\/claymatching\/collect\/sync/i);

  for (const renderer of ["renderProfile", "renderMemberProfile", "renderFeed"]) {
    assert.match(functionBlock(renderer), /featured/i, `${renderer} should render the selected featured-achievement badge`);
  }
  assert.match(styles, /\.featured-achievement-badge\s*\{/);
});

test("claymatching featured-achievement persistence validates the current synced snapshot and clears stale choices", async () => {
  const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
  const migrationFiles = (await readdir(migrationDirectory)).filter((name) => name.endsWith(".sql"));
  const migrations = await Promise.all(migrationFiles.map(async (name) => ({
    name,
    source: await readFile(new URL(name, migrationDirectory), "utf8"),
  })));
  const featuredMigration = migrations.find(({ source }) => /set_clay_featured_achievement/i.test(source));
  assert.ok(featuredMigration, "a migration should define the featured-achievement RPC");
  const migration = featuredMigration.source;
  const setter = migration.match(
    /create or replace function public\.set_clay_featured_achievement\s*\(\s*raw_achievement_id text(?:\s+default\s+null)?\s*\)[\s\S]*?\n\$\$;/i,
  )?.[0] || "";

  assert.match(migration, /add column if not exists featured_achievement_id text/i);
  assert.match(migration, /featured_achievement_id is null/i);
  assert.match(migration, /char_length\(featured_achievement_id\) between 1 and 160/i);
  assert.match(setter, /security definer/i);
  assert.match(setter, /set search_path = public, pg_temp/i);
  assert.match(setter, /auth\.uid\(\) is null/i);
  assert.match(setter, /public\.clay_current_user_can_access\(\)/i);
  assert.match(setter, /from public\.clay_collect_achievements/i);
  assert.match(setter, /achievement_id\s*=\s*(?:raw_achievement_id|normalized_achievement_id|requested_achievement_id)/i);
  assert.match(setter, /source_profile_id/i);
  assert.match(setter, /collect_profile_id/i);
  assert.match(setter, /collect_achievements_synced_at/i);
  assert.match(setter, /collect_wallet_matched_at/i);
  assert.match(setter, /where user_id = auth\.uid\(\)/i);
  assert.match(migration, /revoke execute on function public\.set_clay_featured_achievement\(text\) from public, anon/i);
  assert.match(migration, /grant execute on function public\.set_clay_featured_achievement\(text\) to authenticated/i);

  const deferredCleanup = /create constraint trigger[\s\S]*?after delete on public\.clay_collect_achievements[\s\S]*?deferrable initially deferred/i.test(migration)
    && /not exists\s*\([\s\S]*?from public\.clay_collect_achievements/i.test(migration)
    && /featured_achievement_id\s*=\s*null/i.test(migration);
  const atomicCleanup = /insert into public\.clay_collect_achievements[\s\S]*?update public\.clay_profiles[\s\S]*?featured_achievement_id\s*=\s*(?:null|case)/i.test(migration)
    && /not exists\s*\([\s\S]*?from public\.clay_collect_achievements/i.test(migration);
  assert.ok(deferredCleanup || atomicCleanup, "a resync must clear a featured achievement that is absent from the final earned snapshot");
});

test("claymatching accepts safe copied Collect link variants and rejects impostor links", async () => {
  const script = await readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8");
  const normalizerSource = script.match(/function normalizeClayCollectProfileId\(value\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(normalizerSource, "Collect profile normalizer should be extractable for behavioral tests");
  const normalize = Function(
    "CLAY_COLLECT_ORIGIN",
    "CLAY_COLLECT_UUID_PATTERN",
    `${normalizerSource}; return normalizeClayCollectProfileId;`,
  )("https://collect.claynosaurz.com", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  const profileId = "5f82098f-191f-4757-86f2-b14c3b88119a";

  for (const accepted of [
    profileId,
    `https://collect.claynosaurz.com/profile/${profileId}`,
    `https://collect.claynosaurz.com/profile/${profileId}/?tab=profile&utm_source=holder`,
    `https://collect.claynosaurz.com/achievements-api/users/${profileId}/achievements`,
    `https://collect.claynosaurz.com/achievements-api/users/${profileId}/achievements/?ignored=true`,
  ]) {
    assert.equal(normalize(accepted), profileId);
  }

  for (const rejected of [
    `https://collect.claynosaurz.com.evil.example/profile/${profileId}`,
    `https://collect.claynosaurz.com/not-a-profile/${profileId}`,
    `https://collect.claynosaurz.com/profile/${profileId}#spoofed`,
    "not-a-uuid",
  ]) {
    assert.equal(normalize(rejected), null);
  }
});

test("claymatching verifies Collect identity with an exact signed Solana wallet match", () => {
  const identity = verifyClayCollectIdentity({
    dynamicXYZId: COLLECT_PROFILE_ID,
    username: "Luna\u202e",
    wallets: [
      { address: OWNER, chain: "solana" },
      { address: "0x123", chain: "sui" },
    ],
  }, COLLECT_PROFILE_ID, OWNER);

  assert.equal(identity.walletMatched, true);
  assert.equal(identity.username, "Luna");
  assert.throws(
    () => verifyClayCollectIdentity({
      dynamicXYZId: COLLECT_PROFILE_ID,
      wallets: [{ address: OWNER.toLowerCase(), chain: "sui" }],
    }, COLLECT_PROFILE_ID, OWNER),
    (error) => error.collectCode === "wallet_mismatch",
  );
  assert.throws(
    () => verifyClayCollectIdentity({ dynamicXYZId: crypto.randomUUID(), wallets: [] }, COLLECT_PROFILE_ID, OWNER),
    (error) => error.collectCode === "profile_mismatch",
  );
});

test("claymatching normalizes unique earned top-level Collect achievements", () => {
  const normalized = normalizeClayCollectAchievements([
    collectEarnedAchievement({
      badgeIcon: "https://storage.claynosaurz.com/achievements/one.png",
      name: "<img src=x onerror=alert(1)>",
    }),
    collectEarnedAchievement({
      claimedAt: null,
      id: "provider:locked",
      status: "enabled",
    }),
    {
      id: "provider:tier-root",
      kind: "achievement",
      name: "Collector",
      status: "in-progress",
      type: "collection",
      tiers: [
        collectEarnedAchievement({ id: "provider:tier:1", name: "Collector I", tier: 1 }),
        collectEarnedAchievement({ id: "provider:tier:2", name: "Collector II", tier: 2 }),
        collectEarnedAchievement({ claimedAt: null, id: "provider:tier:3", name: "Collector III", status: "in-progress", tier: 3 }),
      ],
    },
    {
      claimedAt: "2026-07-12T10:00:00.000Z",
      id: "provider:milestone-root",
      kind: "achievement",
      name: "Milestones",
      status: "enabled",
      type: "community",
      milestones: [
        collectEarnedAchievement({
          badgeIcon: "https://storage.claynosaurz.com.evil.example/nope.png",
          id: "provider:milestone:1",
          name: "First mudprint",
        }),
        collectEarnedAchievement({ id: "provider:milestone:1", name: "First mudprint" }),
      ],
    },
  ]);

  assert.deepEqual(normalized.map((item) => item.achievementId).sort(), [
    "provider:achievement:1",
    "provider:milestone-root",
  ]);
  assert.equal(normalized.find((item) => item.achievementId === "provider:achievement:1").iconUrl, "https://storage.claynosaurz.com/achievements/one.png");
  assert.equal(normalized.find((item) => item.achievementId === "provider:milestone-root").iconUrl, null);
  assert.equal(normalized.find((item) => item.achievementId === "provider:achievement:1").name, "<img src=x onerror=alert(1)>");

  assert.throws(
    () => normalizeClayCollectAchievements(Array.from({ length: 501 }, (_, index) => collectEarnedAchievement({ id: `provider:${index}` }))),
    (error) => error.collectCode === "upstream_achievement_count",
  );
  assert.throws(
    () => normalizeClayCollectAchievements([{ name: "missing id" }]),
    (error) => error.collectCode === "upstream_achievement_schema",
  );
});

test("claymatching manual Collect SYNC derives fixed upstream URLs and saves an allowlisted snapshot", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let finishBody;
  globalThis.fetch = async (request, init = {}) => {
    const url = new URL(String(request));
    calls.push({ init, url: url.toString() });
    if (url.pathname.endsWith("/get_clay_access_state")) {
      return Response.json([clayAccessStateRow()]);
    }
    if (url.pathname.endsWith("/begin_clay_collect_sync")) {
      return Response.json([{
        allowed: true,
        collect_profile_id: COLLECT_PROFILE_ID,
        reason: "ok",
        retry_after_seconds: 0,
        wallet_address: OWNER,
      }]);
    }
    if (url.toString() === `https://collect.claynosaurz.com/achievements-api/users/${COLLECT_PROFILE_ID}`) {
      return Response.json({
        dynamicXYZId: COLLECT_PROFILE_ID,
        username: "LunaCollect",
        wallets: [{ address: OWNER, chain: "solana" }],
      });
    }
    if (url.toString() === `https://collect.claynosaurz.com/achievements-api/users/${COLLECT_PROFILE_ID}/achievements`) {
      return Response.json([collectEarnedAchievement()]);
    }
    if (url.pathname.endsWith("/finish_clay_collect_sync")) {
      finishBody = JSON.parse(init.body);
      return Response.json([{
        committed: true,
        saved_count: 1,
        sync_status: "synced",
        synced_at: "2026-07-14T01:00:00.000Z",
      }]);
    }
    throw new Error(`Unexpected test request: ${url}`);
  };

  try {
    const cookie = await claymatchingSessionCookie();
    const response = await worker.fetch(new Request("https://claymatching.luna21e8.xyz/api/claymatching/collect/sync", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: "https://claymatching.luna21e8.xyz",
        "X-Clay-CSRF": TEST_CSRF,
      },
      body: JSON.stringify({
        url: "http://169.254.169.254/latest/meta-data",
        userId: "someone-else",
      }),
    }), {
      CLAYMATCHING_HOSTS: "claymatching.luna21e8.xyz",
      CLAYMATCHING_SESSION_SECRET: TEST_SESSION_SECRET,
      SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
      SUPABASE_SECRET_KEY: "test-secret-key",
      SUPABASE_URL: "https://project.supabase.co",
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.walletMatched, true);
    assert.equal(body.userTriggered, true);
    assert.equal(body.achievementCount, 1);
    assert.deepEqual(calls.filter((call) => call.url.startsWith("https://collect.claynosaurz.com/")).map((call) => call.url), [
      `https://collect.claynosaurz.com/achievements-api/users/${COLLECT_PROFILE_ID}`,
      `https://collect.claynosaurz.com/achievements-api/users/${COLLECT_PROFILE_ID}/achievements`,
    ]);
    for (const call of calls.filter((entry) => entry.url.startsWith("https://collect.claynosaurz.com/"))) {
      const forwarded = new Headers(call.init.headers);
      assert.equal(call.init.redirect, "manual");
      assert.equal(forwarded.get("Authorization"), null);
      assert.equal(forwarded.get("Cookie"), null);
      assert.equal(forwarded.get("apikey"), null);
      assert.equal(forwarded.get("X-Clay-CSRF"), null);
    }
    assert.equal(finishBody.raw_succeeded, true);
    assert.equal(finishBody.raw_user_id, TEST_USER_ID);
    assert.equal(finishBody.raw_source_username, "LunaCollect");
    assert.deepEqual(Object.keys(finishBody.raw_achievements[0]).sort(), [
      "achievementId", "achievementType", "claimedAt", "completedCount", "description", "earnedPoints",
      "iconUrl", "kind", "name", "points", "rarity", "sourceRootId", "tier", "title",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("claymatching Collect SYNC rejects unauthenticated, stale, cross-site, and non-CSRF requests before upstream", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    throw new Error("No upstream request was expected");
  };
  const endpoint = "https://claymatching.luna21e8.xyz/api/claymatching/collect/sync";

  try {
    const validCookie = await claymatchingSessionCookie();
    const expiredCookie = await claymatchingSessionCookie({ exp: Math.floor(Date.now() / 1000) - 10 });
    const cases = [
      new Request(endpoint, { method: "POST", headers: { Origin: "https://claymatching.luna21e8.xyz", "X-Clay-CSRF": TEST_CSRF } }),
      new Request(endpoint, { method: "POST", headers: { Cookie: `${validCookie}tampered`, Origin: "https://claymatching.luna21e8.xyz", "X-Clay-CSRF": TEST_CSRF } }),
      new Request(endpoint, { method: "POST", headers: { Cookie: expiredCookie, Origin: "https://claymatching.luna21e8.xyz", "X-Clay-CSRF": TEST_CSRF } }),
      new Request(endpoint, { method: "POST", headers: { Cookie: validCookie, Origin: "https://evil.example", "X-Clay-CSRF": TEST_CSRF } }),
      new Request(endpoint, { method: "POST", headers: { Cookie: validCookie, Origin: "https://claymatching.luna21e8.xyz" } }),
    ];
    for (const request of cases) {
      const response = await worker.fetch(request, { CLAYMATCHING_HOSTS: "claymatching.luna21e8.xyz", CLAYMATCHING_SESSION_SECRET: TEST_SESSION_SECRET });
      assert.ok([401, 403].includes(response.status));
    }
    const getResponse = await worker.fetch(new Request(endpoint), { CLAYMATCHING_HOSTS: "claymatching.luna21e8.xyz" });
    assert.equal(getResponse.status, 405);
    assert.equal(fetchCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("claymatching Collect SYNC fails closed on wallet mismatch, redirects, oversized responses, and stream timeouts", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const cookie = await claymatchingSessionCookie();
  const endpoint = "https://claymatching.luna21e8.xyz/api/claymatching/collect/sync";
  const env = {
    CLAYMATCHING_HOSTS: "claymatching.luna21e8.xyz",
    CLAYMATCHING_SESSION_SECRET: TEST_SESSION_SECRET,
    SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    SUPABASE_SECRET_KEY: "test-secret-key",
    SUPABASE_URL: "https://project.supabase.co",
  };
  const makeRequest = () => new Request(endpoint, {
    method: "POST",
    headers: { Cookie: cookie, Origin: "https://claymatching.luna21e8.xyz", "X-Clay-CSRF": TEST_CSRF },
  });

  async function runScenario(identityResponse, achievementResponse) {
    let collectCalls = 0;
    let finishBody;
    globalThis.fetch = async (request, init = {}) => {
      const url = new URL(String(request));
      if (url.pathname.endsWith("/get_clay_access_state")) {
        return Response.json([clayAccessStateRow()]);
      }
      if (url.pathname.endsWith("/begin_clay_collect_sync")) {
        return Response.json([{ allowed: true, collect_profile_id: COLLECT_PROFILE_ID, reason: "ok", wallet_address: OWNER }]);
      }
      if (url.toString() === `https://collect.claynosaurz.com/achievements-api/users/${COLLECT_PROFILE_ID}`) {
        collectCalls += 1;
        assert.equal(init.redirect, "manual");
        return identityResponse();
      }
      if (url.toString().endsWith("/achievements")) {
        collectCalls += 1;
        return achievementResponse();
      }
      if (url.pathname.endsWith("/finish_clay_collect_sync")) {
        finishBody = JSON.parse(init.body);
        return Response.json([{ committed: true, saved_count: 0, sync_status: "failed" }]);
      }
      throw new Error(`Unexpected test request: ${url}`);
    };
    const response = await worker.fetch(makeRequest(), env);
    return { collectCalls, finishBody, response };
  }

  try {
    const mismatch = await runScenario(
      () => Response.json({ dynamicXYZId: COLLECT_PROFILE_ID, wallets: [{ address: OTHER_OWNER, chain: "solana" }] }),
      () => Response.json([]),
    );
    assert.equal(mismatch.response.status, 409);
    assert.equal(mismatch.collectCalls, 1);
    assert.equal(mismatch.finishBody.raw_error_code, "wallet_mismatch");
    assert.equal(mismatch.finishBody.raw_succeeded, false);

    const redirect = await runScenario(
      () => new Response(null, { status: 302, headers: { Location: "https://evil.example/" } }),
      () => Response.json([]),
    );
    assert.equal(redirect.response.status, 502);
    assert.equal(redirect.collectCalls, 1);
    assert.equal(redirect.finishBody.raw_error_code, "upstream_redirect");

    const oversized = await runScenario(
      () => Response.json({ dynamicXYZId: COLLECT_PROFILE_ID, wallets: [{ address: OWNER, chain: "solana" }] }),
      () => new Response("[]", {
        status: 200,
        headers: { "Content-Length": String(2 * 1024 * 1024 + 1), "Content-Type": "application/json" },
      }),
    );
    assert.equal(oversized.response.status, 502);
    assert.equal(oversized.collectCalls, 2);
    assert.equal(oversized.finishBody.raw_error_code, "upstream_too_large");

    const streamTimeout = await runScenario(
      () => new Response(new ReadableStream({
        start(controller) {
          controller.error(new DOMException("Collect body timed out", "TimeoutError"));
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
      () => Response.json([]),
    );
    assert.equal(streamTimeout.response.status, 504);
    assert.equal(streamTimeout.collectCalls, 1);
    assert.equal(streamTimeout.finishBody.raw_error_code, "upstream_timeout");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("claymatching Collect sync schema is service-written, holder-readable, atomic, and cooldown protected", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260714011500_claymatching_collect_achievement_sync.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /create table if not exists public\.clay_collect_achievements/);
  assert.match(migration, /create table if not exists public\.clay_collect_sync_jobs/);
  assert.match(migration, /primary key \(user_id, achievement_id\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /grant select on table public\.clay_collect_achievements to authenticated/);
  assert.doesNotMatch(migration, /grant (?:insert|update|delete)[^;]*clay_collect_achievements to authenticated/i);
  assert.match(migration, /create or replace function public\.begin_clay_collect_sync/);
  assert.match(migration, /for update/);
  assert.match(migration, /when 'synced' then 300/);
  assert.match(migration, /create or replace function public\.finish_clay_collect_sync/);
  assert.match(migration, /auth\.role\(\) is distinct from 'service_role'/);
  assert.match(migration, /raw_achievements is null or jsonb_typeof\(raw_achievements\) <> 'array'/);
  assert.match(migration, /revoke all on table public\.clay_collect_sync_jobs from public, anon, authenticated/);
  assert.doesNotMatch(migration, /alter table public\.clay_profiles[\s\S]*?add column if not exists collect_sync_token/i);
  assert.match(migration, /delete from public\.clay_collect_achievements[\s\S]*insert into public\.clay_collect_achievements/);
  assert.match(migration, /wallet_mismatch/);
  assert.match(migration, /previous_profile_id is distinct from raw_profile_id/);
  assert.match(migration, /grant execute on function public\.begin_clay_collect_sync\(uuid, uuid\) to service_role/);
  assert.match(migration, /grant execute on function public\.finish_clay_collect_sync\(uuid, uuid, boolean, text, text, jsonb\) to service_role/);
});

test("claymatching Collect sync is click-only and absent from scheduled/background refresh paths", async () => {
  const [workerScript, appScript] = await Promise.all([
    readFile(new URL("../worker/claymatching.js", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8"),
  ]);
  const scheduled = workerScript.match(/async scheduled\([\s\S]*?\n  },\n};/)?.[0] || "";
  const loadAppData = appScript.match(/async function loadAppData\([\s\S]*?\n}\n\nfunction renderEverything/)?.[0] || "";
  const notificationRefresh = appScript.match(/async function refreshNotificationState\([\s\S]*?\n}\n\nasync function markMention/)?.[0] || "";
  assert.doesNotMatch(scheduled, /collect|achievement/i);
  assert.doesNotMatch(loadAppData, /\/api\/claymatching\/collect\/sync/);
  assert.doesNotMatch(notificationRefresh, /\/api\/claymatching\/collect\/sync/);
  assert.match(appScript, /syncCollectAchievementsButton\.addEventListener\(["']click["'], syncClayCollectAchievements\)/);
  assert.equal((appScript.match(/fetch\(["']\/api\/claymatching\/collect\/sync["']/g) || []).length, 1);
});

test("claymatching mentions and replies create private durable notifications", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260713224500_claymatching_notifications.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /create table if not exists public\.clay_notifications/);
  assert.match(migration, /kind in \('mention', 'reply'\)/);
  assert.match(migration, /after insert on public\.clay_posts/);
  assert.match(migration, /lower\(new\.body\).*lower\(profile\.handle\)/s);
  assert.match(migration, /recipient_user_id = auth\.uid\(\)/);
  assert.match(migration, /grant select on table public\.clay_notifications to authenticated/);
  assert.doesNotMatch(migration, /grant insert on table public\.clay_notifications to authenticated/);
});

test("claymatching custom backgrounds stay HTTPS-only and isolated", async () => {
  const [migration, config] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260713220000_claymatching_custom_backgrounds.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/config.toml", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /add column if not exists custom_background_url text/);
  assert.match(migration, /custom_background_url ~ '\^https:\/\//);
  assert.match(migration, /'lavender', 'custom'/);
  assert.match(migration, /raw_custom_background_url text default null/);
  assert.match(config, /enable_manual_linking = true/);
  assert.match(config, /\[auth\.passkey\]\s+enabled = true/);
  assert.match(config, /rp_id = "claymatching\.luna21e8\.xyz"/);
  assert.match(config, /\[auth\.email\][\s\S]*enable_signup = true/);
  assert.match(config, /\[auth\.email\.template\.magic_link\][\s\S]*magic_link\.html/);
  assert.match(config, /\[auth\.email\.template\.email_change\][\s\S]*email_change\.html/);
});

test("claymatching separates profile and post artwork with immutable post snapshots", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260714150000_claymatching_split_custom_backgrounds.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /add column if not exists custom_profile_background_url text/);
  assert.match(migration, /add column if not exists custom_post_background_url text/);
  assert.match(migration, /custom_profile_background_url ~ '\^https:\/\//);
  assert.match(migration, /custom_post_background_url ~ '\^https:\/\//);
  assert.match(migration, /set custom_profile_background_url = coalesce\(custom_profile_background_url, custom_background_url\)/);
  assert.match(migration, /alter table public\.clay_posts[\s\S]*add column if not exists custom_background_url text/);
  assert.match(migration, /create trigger clay_posts_snapshot_background[\s\S]*before insert on public\.clay_posts/);
  assert.match(migration, /new\.custom_background_url := saved_background_url/);
  assert.match(migration, /create or replace function public\.update_clay_profile_v2\(/);
  assert.match(migration, /raw_custom_profile_background_url text default null/);
  assert.match(migration, /raw_custom_post_background_url text default null/);
  assert.match(migration, /custom_background_url = normalized_profile_background_url/);
  assert.match(migration, /select public\.update_clay_profile_v2\([\s\S]*raw_custom_background_url,[\s\S]*raw_custom_background_url/);
  assert.match(migration, /grant execute on function public\.update_clay_profile_v2\(text, text, text, text, text\[\], text, text\) to authenticated/);
  assert.match(migration, /revoke execute on function public\.clay_snapshot_post_background\(\) from public, anon, authenticated/);
  assert.doesNotMatch(migration, /grant execute on function public\.clay_snapshot_post_background/);
});

test("claymatching passwordless email templates deliver six-digit codes", async () => {
  const [magicLinkTemplate, emailChangeTemplate] = await Promise.all([
    readFile(new URL("../supabase/templates/magic_link.html", import.meta.url), "utf8"),
    readFile(new URL("../supabase/templates/email_change.html", import.meta.url), "utf8"),
  ]);

  assert.match(magicLinkTemplate, /\{\{ \.Token \}\}/);
  assert.doesNotMatch(magicLinkTemplate, /ConfirmationURL/);
  assert.match(emailChangeTemplate, /\{\{ \.Token \}\}/);
  assert.match(emailChangeTemplate, /\{\{ \.NewEmail \}\}/);
  assert.doesNotMatch(emailChangeTemplate, /ConfirmationURL/);
});

test("claymatching authentication guidance documents the split posting and DM capability model", async () => {
  const [readme, config] = await Promise.all([
    readFile(new URL("../supabase/README.md", import.meta.url), "utf8"),
    readFile(new URL("../supabase/config.toml", import.meta.url), "utf8"),
  ]);

  assert.match(config, /\[auth\][\s\S]*enable_signup = true/);
  assert.match(config, /\[auth\.email\][\s\S]*enable_signup = true/);
  assert.match(readme, /Email or Apple only \| No \| No/i);
  assert.match(readme, /Eligible, user-activated read-only Solana address \| Yes \| No/i);
  assert.match(readme, /Eligible read-only Solana \+ signed Sui \| Yes \| Yes/i);
  assert.match(readme, /Eligible signed Solana \| Yes \| Yes/i);
  assert.match(readme, /Signed Sui only \| No \| No/i);
  assert.match(readme, /Suspended, banned, or expired eligibility \| No \| No/i);
  assert.match(readme, /explicitly chooses read-only[\s\S]*attestations[\s\S]*Turnstile[\s\S]*rechecks eligible assets/i);
  assert.match(readme, /never writes `clay_wallet_accounts`[\s\S]*never[\s\S]*`clay_holder_assets`/i);
  assert.match(readme, /read-only public address never creates a Noctweave identity/i);
  assert.ok(
    readme.indexOf("20260714170000_claymatching_provisional_auth_solana_link.sql")
      < readme.indexOf("20260714180000_claymatching_access_capabilities.sql"),
    "the deployment guide must apply provisional auth before access capabilities",
  );
  assert.match(readme, /Apply the database migrations[\s\S]*before deploying code/i);
  assert.doesNotMatch(readme, /Disable new email signups/i);
});

test("claymatching account deletion is isolated from the other Supabase product", async () => {
  const [html, deletionPage, readme] = await Promise.all([
    readFile(new URL("../site/claymatching/index.html", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/account-deletion/index.html", import.meta.url), "utf8"),
    readFile(new URL("../supabase/README.md", import.meta.url), "utf8"),
  ]);

  assert.match(html, /href=["']\/claymatching\/account-deletion\/["']/);
  assert.match(deletionPage, /handled manually/i);
  assert.match(deletionPage, /nothing is deleted just by opening this page/i);
  assert.match(deletionPage, /mailto:luna@luna21e8\.xyz/);
  assert.match(deletionPage, /support\.apple\.com\/102571/);
  assert.doesNotMatch(deletionPage, /fogixaotetbjzpzazwhf|jfpatuhroezchwjtsaga|functions\/v1\/request-account-deletion/);
  assert.match(readme, /must not be used by Claymatching/i);
  assert.match(readme, /target project\s*`jfpatuhroezchwjtsaga` only/i);
});

test("claymatching holder migration avoids output-column ambiguity in conflict targets", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260713180000_claymatching_v1.sql", import.meta.url),
    "utf8",
  );
  const confirmationFunction = migration.match(
    /create or replace function public\.confirm_clay_holder[\s\S]*?\nend;\n\$\$;/,
  )?.[0] || "";

  assert.match(confirmationFunction, /on conflict on constraint clay_profiles_pkey/);
  assert.match(confirmationFunction, /on conflict on constraint clay_wallet_accounts_pkey/);
  assert.match(confirmationFunction, /on conflict on constraint clay_consents_pkey/);
  assert.match(confirmationFunction, /on conflict on constraint clay_holder_assets_pkey/);
  assert.doesNotMatch(confirmationFunction, /on conflict \(user_id/);
});

test("claymatching provisional storage is service-only, throttled, and promoted by one atomic Solana proof", async () => {
  const [baseMigration, migration, readme] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260713180000_claymatching_v1.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260714170000_claymatching_provisional_auth_solana_link.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/README.md", import.meta.url), "utf8"),
  ]);
  const confirmationFunction = migration.match(
    /create or replace function public\.confirm_clay_holder_with_solana_challenge[\s\S]*?\nend;\n\$\$;/i,
  )?.[0] || "";

  assert.match(baseMigration, /create or replace function public\.clay_current_user_can_access\(\)[\s\S]*from public\.clay_profiles[\s\S]*profile\.account_state = 'active'/i);
  assert.match(migration, /create table if not exists public\.clay_solana_link_challenges[\s\S]*user_id uuid not null references auth\.users\(id\) on delete cascade/i);
  assert.match(migration, /create table if not exists public\.clay_solana_preview_limits[\s\S]*user_id uuid primary key references auth\.users\(id\) on delete cascade/i);
  assert.match(migration, /create unique index if not exists clay_solana_link_challenges_one_per_user[\s\S]*\(user_id\)/i);
  assert.match(migration, /alter table public\.clay_solana_link_challenges enable row level security/i);
  assert.match(migration, /alter table public\.clay_solana_preview_limits enable row level security/i);
  assert.match(migration, /revoke all on table public\.clay_solana_link_challenges from public, anon, authenticated/i);
  assert.match(migration, /revoke all on table public\.clay_solana_preview_limits from public, anon, authenticated/i);
  assert.match(migration, /claim_clay_solana_preview[\s\S]*interval '5 seconds'/i);
  assert.match(migration, /begin_clay_solana_link[\s\S]*interval '3 seconds'/i);
  assert.match(confirmationFunction, /challenge\.user_id = raw_user_id[\s\S]*challenge\.wallet_address = normalized_address/i);
  assert.match(confirmationFunction, /for update[\s\S]*challenge_row\.consumed_at is not null/i);
  assert.match(confirmationFunction, /update public\.clay_solana_link_challenges[\s\S]*set consumed_at = timezone\('utc', now\(\)\)/i);
  assert.match(confirmationFunction, /from public\.confirm_clay_holder\(/i);
  assert.match(migration, /revoke execute on function public\.confirm_clay_holder_with_solana_challenge[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.confirm_clay_holder_with_solana_challenge[\s\S]*to service_role/i);
  assert.doesNotMatch(migration, /grant (?:all|execute|select|insert|update|delete)[^;]* to (?:public|anon|authenticated)/i);
  assert.match(readme, /wrangler secret put CLAYMATCHING_TURNSTILE_SECRET_KEY/);
});

test("claymatching database capabilities encode the complete post and DM access matrix", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260714180000_claymatching_access_capabilities.sql", import.meta.url),
    "utf8",
  );
  const canPost = migration.match(
    /create or replace function public\.clay_user_can_post\([\s\S]*?\n\$\$;/i,
  )?.[0] || "";
  const hasConnectedWallet = migration.match(
    /create or replace function public\.clay_user_has_connected_wallet\([\s\S]*?\n\$\$;/i,
  )?.[0] || "";
  const canDm = migration.match(
    /create or replace function public\.clay_user_can_dm\([\s\S]*?\n\$\$;/i,
  )?.[0] || "";

  assert.match(canPost, /profile\.account_state = 'active'/);
  assert.match(canPost, /consent\.terms_version = '2026-07-13'[\s\S]*consent\.adult_attested[\s\S]*consent\.holder_attested[\s\S]*consent\.lawful_use_attested/);
  assert.match(canPost, /from public\.clay_wallet_accounts[\s\S]*holder_verified_until > timezone\('utc', now\(\)\)/i);
  assert.match(canPost, /\bor exists \([\s\S]*from public\.clay_read_only_solana_access[\s\S]*access_until > timezone\('utc', now\(\)\)/i);
  assert.doesNotMatch(canPost, /clay_sui_accounts|auth\.identities|email|apple/i);

  assert.match(hasConnectedWallet, /from public\.clay_wallet_accounts/);
  assert.match(hasConnectedWallet, /\bor exists \([\s\S]*from public\.clay_sui_accounts[\s\S]*verified_at is not null/i);
  assert.match(canDm, /clay_user_can_post\(raw_user_id\)[\s\S]*clay_user_has_connected_wallet\(raw_user_id\)/i);

  const matrix = ({ active = true, consent = true, readOnly = false, signedSolana = false, signedSui = false }) => {
    const canPostResult = active && consent && (readOnly || signedSolana);
    return {
      canDm: canPostResult && (signedSolana || signedSui),
      canPost: canPostResult,
    };
  };
  assert.deepEqual(matrix({}), { canPost: false, canDm: false }, "email/Apple only");
  assert.deepEqual(matrix({ readOnly: true }), { canPost: true, canDm: false }, "read-only Solana");
  assert.deepEqual(matrix({ readOnly: true, signedSui: true }), { canPost: true, canDm: true }, "read-only Solana + signed Sui");
  assert.deepEqual(matrix({ signedSolana: true }), { canPost: true, canDm: true }, "signed Solana");
  assert.deepEqual(matrix({ signedSolana: true, signedSui: true }), { canPost: true, canDm: true }, "signed Solana + signed Sui");
  assert.deepEqual(matrix({ signedSui: true }), { canPost: false, canDm: false }, "Sui only");
  assert.deepEqual(matrix({ active: false, readOnly: true, signedSui: true }), { canPost: false, canDm: false }, "banned or suspended");
  assert.deepEqual(matrix({ readOnly: false, signedSolana: false, signedSui: true }), { canPost: false, canDm: false }, "expired eligibility");
});

test("claymatching read-only Solana activation is self-attested, time-bounded, and never becomes ownership data", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260714180000_claymatching_access_capabilities.sql", import.meta.url),
    "utf8",
  );
  const confirmation = migration.match(
    /create or replace function public\.confirm_clay_read_only_access\([\s\S]*?\nend;\n\$\$;/i,
  )?.[0] || "";

  assert.match(migration, /create table if not exists public\.clay_read_only_solana_access/);
  assert.match(migration, /wallet_address text not null[\s\S]*eligible_asset_count integer not null[\s\S]*checked_at timestamptz not null[\s\S]*access_until timestamptz not null/i);
  assert.match(migration, /access_until <= checked_at \+ interval '24 hours 1 minute'/i);
  assert.match(migration, /not proof of control[\s\S]*not unique/i);
  assert.match(migration, /alter table public\.clay_read_only_solana_access enable row level security/i);
  assert.match(migration, /revoke all on table public\.clay_read_only_solana_access from public, anon, authenticated/i);
  assert.match(confirmation, /auth\.role\(\) is distinct from 'service_role'/i);
  assert.match(confirmation, /raw_terms_version <> '2026-07-13'[\s\S]*raw_adult_attested[\s\S]*raw_holder_attested[\s\S]*raw_lawful_use_attested/i);
  assert.match(confirmation, /raw_asset_count is null or raw_asset_count < 1/i);
  assert.match(confirmation, /insert into public\.clay_read_only_solana_access/i);
  assert.doesNotMatch(confirmation, /(?:insert into|update|delete from) public\.clay_holder_assets/i);
  assert.doesNotMatch(confirmation, /(?:insert into|update|delete from) public\.clay_wallet_accounts/i);
  assert.doesNotMatch(migration, /unique[^;\n]*wallet_address/i);
  assert.match(migration, /does not prove wallet control or persist collectible metadata/i);
});

test("claymatching public-address preview stays inert until the user explicitly completes read-only consent", async () => {
  const app = await readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8");
  const preview = app.match(
    /async function previewProvisionalSolanaAddress\(event\)[\s\S]*?\n}\n\nasync function activateProvisionalHolder/i,
  )?.[0] || "";
  const activation = app.match(
    /async function activateProvisionalReadOnly\(session\)[\s\S]*?\n}\n\nasync function startProvisionalReadOnlyActivation/i,
  )?.[0] || "";
  const activationStart = app.match(
    /async function startProvisionalReadOnlyActivation\(\)[\s\S]*?\n}\n\nfunction renderClayCollectConnection/i,
  )?.[0] || "";
  const consentSubmit = app.match(
    /async function submitConsent\(event\)[\s\S]*?\n}\n\nasync function establishHolderSession/i,
  )?.[0] || "";
  const capabilities = app.match(
    /function applyAccessCapabilities\(result = \{}\)[\s\S]*?\n}\n\nfunction renderAccessControls/i,
  )?.[0] || "";

  assert.match(preview, /\/api\/claymatching\/solana\/preview/);
  assert.match(preview, /body\.verified !== false[\s\S]*body\.source !== "public-chain-preview"/);
  assert.doesNotMatch(preview, /\/api\/claymatching\/solana\/read-only|activateProvisionalReadOnly|openConsentDialog/);

  assert.match(activationStart, /openConsentDialog\(\{[\s\S]*activationMode: "read-only"/);
  assert.match(consentSubmit, /consentForm\.reportValidity\(\)/);
  assert.match(consentSubmit, /if \(!captchaToken[\s\S]*return;/);
  assert.match(consentSubmit, /provisionalActivationMode === "read-only"[\s\S]*activateProvisionalReadOnly\(session\)/);

  assert.match(activation, /fetch\("\/api\/claymatching\/solana\/read-only"[\s\S]*method: "POST"/);
  assert.match(activation, /adultAttested: true[\s\S]*captchaToken[\s\S]*holderAttested: true[\s\S]*lawfulUseAttested: true/);
  assert.doesNotMatch(activation, /eligibleAssetCount|raw_assets|provisionalPreviewAssets\s*[,}]/);

  assert.match(capabilities, /const hasCanPost = typeof result\.canPost === "boolean" \|\| typeof result\.can_post === "boolean"/);
  assert.match(capabilities, /holderSessionReady = hasCanPost\s*\? result\.canPost === true \|\| result\.can_post === true\s*:/);
  assert.match(capabilities, /const hasCanDm = typeof result\.canDm === "boolean" \|\| typeof result\.can_dm === "boolean"/);
  assert.match(capabilities, /dmAccessReady = hasCanDm\s*\? result\.canDm === true \|\| result\.can_dm === true\s*:/);
});

test("claymatching rejects arbitrary pasted avatar IDs unless they match a verified owned asset row", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260714150000_claymatching_split_custom_backgrounds.sql", import.meta.url),
    "utf8",
  );
  const profileSetter = migration.match(
    /create or replace function public\.update_clay_profile_v2\([\s\S]*?\nend;\n\$\$;/i,
  )?.[0] || "";

  assert.match(
    profileSetter,
    /from public\.clay_holder_assets as asset[\s\S]*?where asset\.user_id = auth\.uid\(\) and asset\.asset_id = raw_avatar_asset_id/i,
  );
  assert.match(
    profileSetter,
    /if not found then[\s\S]*?from public\.clay_sui_popkin_assets as asset[\s\S]*?where asset\.user_id = auth\.uid\(\) and asset\.object_id = lower\(raw_avatar_asset_id\)/i,
  );
  assert.match(
    profileSetter,
    /if chosen_asset_id is null then[\s\S]*?raise exception 'avatar must be a Clayno or Popkin currently verified in your linked wallets'/i,
  );
  assert.doesNotMatch(profileSetter, /chosen_asset_id\s*:=\s*raw_avatar_asset_id/i);
});

test("claymatching refreshes live posting access before attempting a post insert", async () => {
  const app = await readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8");
  const createPost = app.match(
    /async function createPost\([\s\S]*?\n}\n\nfunction setReplyTarget/i,
  )?.[0] || "";
  const accessCheck = createPost.indexOf("const accessReady = await refreshAuthoritativeAccess()");
  const insert = createPost.indexOf('db.from("clay_posts").insert');

  assert.ok(accessCheck >= 0, "post creation must refresh live posting access");
  assert.ok(insert > accessCheck, "the database insert must happen only after the live access refresh");
  assert.match(
    createPost,
    /if \(!accessReady \|\| !holderSessionReady\) \{[\s\S]*?showToast\("Posting access needs a fresh eligible-address or wallet check\."\);[\s\S]*?return;/,
  );
});

test("claymatching rebinds live auth account changes and rejects a mismatched Clay session", async () => {
  const app = await readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8");
  const clearCookie = app.match(
    /async function clearClaymatchingSessionCookie\(\)[\s\S]*?\n}\n\nasync function refreshAuthoritativeAccess/i,
  )?.[0] || "";
  const refresh = app.match(
    /async function refreshAuthoritativeAccess\([\s\S]*?\n}\n\nasync function rebindAuthenticatedSession/i,
  )?.[0] || "";
  const queueRebind = app.match(
    /function queueAuthenticatedSessionRebind\(session\)[\s\S]*?\n}\n\nfunction renderAccessControls/i,
  )?.[0] || "";
  const authListener = app.match(
    /db\.auth\.onAuthStateChange\([\s\S]*?\n  }\);/i,
  )?.[0] || "";

  assert.match(clearCookie, /fetch\("\/api\/claymatching\/session"[\s\S]*?method: "DELETE"[\s\S]*?credentials: "include"/);
  assert.match(refresh, /const expectedUserId = String\(currentSession\.user\.id \|\| ""\)/);
  assert.match(refresh, /String\(currentSession\?\.user\?\.id \|\| ""\) !== expectedUserId/);
  assert.match(refresh, /response\.ok && String\(body\.userId \|\| ""\) !== expectedUserId/);
  assert.match(refresh, /await clearClaymatchingSessionCookie\(\)/);
  assert.match(refresh, /canDm: false[\s\S]*canPost: false[\s\S]*showProvisionalOnboarding\(currentSession\)/);

  assert.match(queueRebind, /authRebindUserId = expectedUserId[\s\S]*resetApp\(\)[\s\S]*currentSession = session/);
  assert.match(queueRebind, /rebindAuthenticatedSession\(session, expectedUserId\)/);
  assert.match(authListener, /const previousUserId = String\(currentSession\?\.user\?\.id \|\| ""\)/);
  assert.match(authListener, /previousUserId !== nextUserId[\s\S]*queueAuthenticatedSessionRebind\(session\)/);
});

test("claymatching Signals RLS and client identity creation both require live DM capability", async () => {
  const [migration, app] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260714180000_claymatching_access_capabilities.sql", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8"),
  ]);
  const signalPolicies = migration.match(
    /drop policy if exists clay_signal_devices_self_read[\s\S]*?create or replace function public\.resolve_clay_signal_devices/i,
  )?.[0] || "";
  const resolver = migration.match(
    /create or replace function public\.resolve_clay_signal_devices[\s\S]*?\n\$\$;/i,
  )?.[0] || "";
  const initializeIdentity = app.match(
    /async function initializeSignalIdentity\([\s\S]*?\n}\n\nasync function syncSignals/i,
  )?.[0] || "";

  assert.equal((signalPolicies.match(/public\.clay_current_user_can_dm\(\)/g) || []).length, 5);
  assert.match(resolver, /public\.clay_current_user_can_dm\(\)/);
  assert.match(resolver, /public\.clay_user_can_dm\(p_target_user_id\)/);
  assert.match(migration, /if not public\.clay_user_can_dm\(raw_user_id\)[\s\S]*update public\.clay_signal_devices[\s\S]*set revoked_at/i);

  const guardIndex = initializeIdentity.indexOf("if (!dmAccessReady)");
  const importIndex = initializeIdentity.indexOf("import(\"/apps/noctweave-web-core/noctweave-core-adapter.js\")");
  const createIndex = initializeIdentity.indexOf("createOrLoadSignalIdentity");
  assert.ok(guardIndex >= 0, "Noctweave identity initialization must have a DM-capability guard");
  assert.ok(importIndex > guardIndex, "the Noctweave module must not load before the DM-capability guard");
  assert.ok(createIndex > guardIndex, "Noctweave identity material must not be created before the DM-capability guard");
  assert.match(app, /async function refreshSignalInbox\([\s\S]*?await refreshAuthoritativeAccess\(\{ requireDm: true \}\)/);
  assert.match(app, /async function openDm\([\s\S]*?await refreshAuthoritativeAccess\(\{ requireDm: true \}\)/);
  assert.match(app, /async function sendDm\([\s\S]*?await refreshAuthoritativeAccess\(\{ requireDm: true \}\)/);
});

test("claymatching revalidates relay access and recipient authorization for every inbox refresh and Signal send", async () => {
  const app = await readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8");
  const refreshInbox = app.match(
    /async function refreshSignalInbox\([\s\S]*?\n}\n\nasync function resolveCurrentDmDevices/i,
  )?.[0] || "";
  const resolver = app.match(
    /async function resolveCurrentDmDevices\([\s\S]*?\n}\n\nasync function openDm/i,
  )?.[0] || "";
  const openDm = app.match(
    /async function openDm\([\s\S]*?\n}\n\nfunction setDmComposerReady/i,
  )?.[0] || "";
  const sendDm = app.match(
    /async function sendDm\([\s\S]*?\n}\n\nasync function checkEncryptedInbox/i,
  )?.[0] || "";

  const inboxAccessCheck = refreshInbox.indexOf("await refreshAuthoritativeAccess({ requireDm: true })");
  const inboxIdentityUse = refreshInbox.indexOf("signalIdentity || await initializeSignalIdentity()");
  const inboxRelayUse = refreshInbox.indexOf("await syncSignals({ targetDevices: devices })");
  assert.ok(inboxAccessCheck >= 0, "inbox refresh must perform a live DM-capability check");
  assert.ok(inboxIdentityUse > inboxAccessCheck, "inbox identity access must happen after the live capability check");
  assert.ok(inboxRelayUse > inboxAccessCheck, "inbox relay access must happen after the live capability check");

  assert.match(resolver, /db\.rpc\("resolve_clay_signal_devices", \{[\s\S]*?p_target_user_id: targetUserId/);
  assert.match(resolver, /currentDmDevices = devices[\s\S]*?if \(!devices\.length\)[\s\S]*?throw new Error/);
  assert.match(openDm, /const targetDevices = await resolveCurrentDmDevices\(\)[\s\S]*?syncSignals\(\{ targetDevices \}\)/);
  assert.ok(
    openDm.indexOf("await resolveCurrentDmDevices()") < openDm.indexOf("await initializeSignalIdentity()"),
    "opening a cached thread must re-resolve its recipient before touching the relay identity",
  );

  const sendAccessCheck = sendDm.indexOf("await refreshAuthoritativeAccess({ requireDm: true })");
  const sendDeviceCheck = sendDm.indexOf("const targetDevices = await resolveCurrentDmDevices()");
  const relaySend = sendDm.indexOf("signalCore.sendSignalText");
  assert.ok(sendAccessCheck >= 0, "each send must refresh the sender's live DM capability");
  assert.ok(sendDeviceCheck > sendAccessCheck, "each send must resolve current permitted recipient devices after checking capability");
  assert.ok(relaySend > sendDeviceCheck, "relay delivery must happen only after recipient authorization is re-resolved");
  assert.match(sendDm, /recipientContactCodes: targetDevices\.map/);
  assert.doesNotMatch(sendDm, /recipientContactCodes: currentDmDevices\.map/);
});

test("claymatching account connections include optional Sui linking and manual Popkins checks", async () => {
  const [html, app, styles, migration, suiWalletSource, wranglerConfig, workerSource] = await Promise.all([
    readFile(new URL("../site/claymatching/index.html", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260714043000_claymatching_sui_popkins.sql", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching-sui-src/sui-wallet.js", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../worker/claymatching.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /Sui \+ Popkins/);
  assert.match(html, /data-link-sui-wallet/);
  assert.match(html, /data-sync-popkins/);
  assert.match(html, /data-avatar-collection="clayno"/);
  assert.match(html, /data-avatar-collection="popkin"/);
  assert.match(html, /data-avatar-clayno-count/);
  assert.match(html, /data-avatar-popkin-count/);
  assert.match(html, /data-asset-status[^>]*aria-live="polite"/);
  assert.match(html, /never a transaction, approval, or transfer/i);
  assert.match(html, /held directly in your wallet, in owned Sui Kiosks, or in the supported staking contract/i);
  assert.match(app, /Direct, Kiosk-held, and contract-staked Popkins are included/i);
  assert.doesNotMatch(`${html}\n${app}`, /staked (?:assets|Popkins) (?:are )?not included|need the (?:project’s )?official staking index/i);
  assert.match(app, /signPersonalMessage/);
  assert.match(app, /\/api\/claymatching\/sui\/challenge/);
  assert.match(app, /\/api\/claymatching\/popkins\/sync/);
  assert.match(app, /activeAvatarCollection = "popkin"/);
  assert.match(app, /option\.hidden = collection !== "neutral" && collection !== activeAvatarCollection/);
  assert.match(app, /linkedSuiConnection\?\.popkinsSyncedAt && Number\.isFinite\(syncedPopkinCount\)/);
  assert.match(app, /Clayno\$\{claynoCount === 1 \? "" : "s"\} currently verified/);
  assert.match(app, /Popkin\$\{popkinCount === 1 \? "" : "s"\} currently verified/);
  for (const source of [suiWalletSource, wranglerConfig, workerSource]) {
    assert.match(source, /https:\/\/graphql\.mainnet\.sui\.io\/graphql/);
    assert.doesNotMatch(source, /https:\/\/sui-mainnet\.mystenlabs\.com\/graphql/);
  }
  assert.match(styles, /mysten-dapp-kit-connect-button::part\(trigger\)/);
  assert.match(styles, /\.avatar-collection-switcher/);
  assert.match(styles, /Readability floor/);
  assert.match(migration, /create table if not exists public\.clay_sui_accounts/);
  assert.match(migration, /create table if not exists public\.clay_sui_link_challenges/);
  assert.match(migration, /consumed_at timestamptz/);
  assert.match(migration, /begin_clay_popkins_sync/);
  assert.match(migration, /grant execute .* to service_role/i);
  assert.doesNotMatch(migration, /grant .*clay_sui_accounts.*authenticated/i);
});

test("claymatching turns only exact verified Popkins Display objects into safe avatar choices", () => {
  const firstId = `0x${"1".repeat(64)}`;
  const secondId = `0x${"2".repeat(64)}`;
  const animatedId = `0x${"5".repeat(64)}`;
  const wrongTypeId = `0x${"3".repeat(64)}`;
  const unsafeImageId = `0x${"4".repeat(64)}`;
  const assets = normalizeClaymatchingPopkinAvatarAssets([
    {
      location: "wallet",
      object: {
        objectId: firstId,
        type: POPKINS_TYPE,
        display: { output: { image_url: "https://images.example/popkin-one.png", name: "Popkin One" } },
      },
    },
    {
      location: "kiosk",
      object: {
        objectId: secondId,
        type: POPKINS_TYPE,
        display: { output: { image_url: "ipfs://bafybeigdyrztkiosk/popkin.png", name: "Popkin Two" } },
      },
    },
    {
      location: "wallet",
      object: {
        objectId: animatedId,
        type: POPKINS_TYPE,
        display: { output: { image_url: "https://images.example/popkin-dance.gif", name: "Popkin Dance" } },
      },
    },
    {
      location: "kiosk",
      object: {
        objectId: firstId,
        type: POPKINS_TYPE,
        display: { output: { image_url: "https://images.example/duplicate.png", name: "Duplicate" } },
      },
    },
    {
      object: {
        objectId: wrongTypeId,
        type: "0x2::not_popkins::Nope",
        display: { output: { image_url: "https://images.example/wrong.png", name: "Wrong type" } },
      },
    },
    {
      object: {
        objectId: unsafeImageId,
        type: POPKINS_TYPE,
        display: { output: { image_url: "javascript:alert(1)", name: "Unsafe" } },
      },
    },
  ]);

  assert.deepEqual(assets, [
    {
      id: animatedId,
      image: "https://images.example/popkin-dance.gif",
      location: "wallet",
      name: "Popkin Dance",
    },
    {
      id: firstId,
      image: "https://images.example/popkin-one.png",
      location: "wallet",
      name: "Popkin One",
    },
    {
      id: secondId,
      image: "https://ipfs.io/ipfs/bafybeigdyrztkiosk/popkin.png",
      location: "kiosk",
      name: "Popkin Two",
    },
  ]);
});

test("claymatching Popkins snapshots union direct, Kiosk-held, and contract-staked assets", async () => {
  const directId = `0x${"1".repeat(64)}`;
  const kioskId = `0x${"2".repeat(64)}`;
  const firstStakedId = `0x${"3".repeat(64)}`;
  const secondStakedId = `0x${"4".repeat(64)}`;
  const { calls, client } = createPopkinsSnapshotClient({
    directIds: [directId],
    kioskPopkinIds: [kioskId],
    stakedIds: [firstStakedId, secondStakedId],
  });

  const snapshot = await loadClaymatchingPopkinsSnapshot(TEST_SUI_ADDRESS, {}, client);

  assert.equal(snapshot.count, 4);
  assert.equal(snapshot.stakedCount, 2);
  assert.deepEqual(
    snapshot.assets.map(({ id }) => id).sort(),
    [directId, kioskId, firstStakedId, secondStakedId].sort(),
  );
  assert.equal(snapshot.assets.find(({ id }) => id === directId)?.location, "wallet");
  assert.equal(snapshot.assets.find(({ id }) => id === kioskId)?.location, "kiosk");
  assert.equal(calls.getDynamicField.length, 1);
  assert.equal(calls.getDynamicField[0].parentId, TEST_STAKING_INDEX_ID);
  assert.equal(calls.getDynamicField[0].name.type, "address");
  assert.deepEqual(
    Buffer.from(calls.getDynamicField[0].name.bcs),
    Buffer.from(bcs.Address.serialize(TEST_SUI_ADDRESS).toBytes()),
  );
});

test("claymatching Popkins snapshots treat a missing staking account as zero staked assets", async () => {
  const notFound = Object.assign(new Error("The staking account was not found."), {
    code: "notFound",
  });
  const { calls, client } = createPopkinsSnapshotClient({ stakingLookupError: notFound });

  const snapshot = await loadClaymatchingPopkinsSnapshot(TEST_SUI_ADDRESS, {}, client);

  assert.deepEqual(snapshot, { assets: [], count: 0, stakedCount: 0 });
  assert.equal(calls.getDynamicField.length, 1);
  assert.equal(calls.listDynamicFields.length, 0);
  assert.equal(calls.getObjects.length, 0);
});

test("claymatching Popkins snapshots reject mismatched staking account ownership or type", async (t) => {
  const stakedId = `0x${"5".repeat(64)}`;

  await t.test("wrong owner", async () => {
    const { client } = createPopkinsSnapshotClient({
      stakedIds: [stakedId],
      stakingOwner: `0x${"f".repeat(64)}`,
    });
    await assert.rejects(
      loadClaymatchingPopkinsSnapshot(TEST_SUI_ADDRESS, {}, client),
      /staking account owner does not match/i,
    );
  });

  await t.test("wrong type", async () => {
    const { client } = createPopkinsSnapshotClient({
      stakedIds: [stakedId],
      stakingDataType: `${POPKINS_STAKING_PACKAGE}::staking_data::UnexpectedData`,
    });
    await assert.rejects(
      loadClaymatchingPopkinsSnapshot(TEST_SUI_ADDRESS, {}, client),
      /staking account identity changed/i,
    );
  });
});

test("claymatching staked Popkins pagination stops when hasNextPage is false despite a cursor", async () => {
  const stakedId = `0x${"6".repeat(64)}`;
  const { calls, client } = createPopkinsSnapshotClient({
    dynamicFieldPages: [{
      cursor: "non-null-terminal-cursor",
      dynamicFields: [{
        name: {
          bcs: bcs.Address.serialize(stakedId).toBytes(),
          type: "0x2::object::ID",
        },
      }],
      hasNextPage: false,
    }],
    stakedIds: [stakedId],
  });

  const snapshot = await loadClaymatchingPopkinsSnapshot(TEST_SUI_ADDRESS, {}, client);

  assert.equal(snapshot.count, 1);
  assert.equal(snapshot.stakedCount, 1);
  assert.deepEqual(snapshot.assets.map(({ id }) => id), [stakedId]);
  assert.equal(calls.listDynamicFields.length, 1);
  assert.equal(calls.listDynamicFields[0].cursor, null);
});

test("claymatching Popkins snapshots are private, atomic, and selectable as public avatars", async () => {
  const [app, styles, migration, workerSource] = await Promise.all([
    readFile(new URL("../site/claymatching/app.js", import.meta.url), "utf8"),
    readFile(new URL("../site/claymatching/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260714144000_claymatching_popkins_avatars.sql", import.meta.url), "utf8"),
    readFile(new URL("../worker/claymatching.js", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /create table if not exists public\.clay_sui_popkin_assets/);
  assert.match(migration, /revoke all on table public\.clay_sui_popkin_assets from public, anon, authenticated/i);
  assert.match(migration, /raw_assets jsonb/);
  assert.match(migration, /delete from public\.clay_sui_popkin_assets where user_id = raw_user_id/);
  assert.match(migration, /from public\.clay_sui_popkin_assets as asset[\s\S]*asset\.user_id = auth\.uid\(\)/);
  assert.match(migration, /clay_sui_accounts_clear_avatar/);
  assert.doesNotMatch(migration, /grant .*clay_sui_popkin_assets.*authenticated/i);

  assert.match(workerSource, /get_clay_popkins_avatar_assets/);
  assert.match(workerSource, /include: \{ display: true, json: true \}/);
  assert.match(workerSource, /raw_assets: snapshot\.assets/);
  assert.match(app, /await syncLinkedPopkins\(\{ afterLink: true \}\)/);
  assert.match(app, /POP · SUI/);
  assert.match(app, /image\.decoding = "async"/);
  assert.match(app, /isPopkinAvatarAsset/);
  assert.match(styles, /\.avatar-origin-badge/);
});

test("claymatching links a Sui address only after a valid personal-message signature", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const keypair = new Ed25519Keypair();
  const suiAddress = keypair.toSuiAddress();
  const cookie = await claymatchingSessionCookie();
  const rpcCalls = [];
  let suiLinked = false;

  globalThis.fetch = async (request, init = {}) => {
    const url = new URL(String(request));
    if (url.hostname !== "project.supabase.co") throw new Error(`Unexpected request: ${url}`);
    const functionName = url.pathname.split("/").at(-1);
    rpcCalls.push(functionName);
    if (functionName === "get_clay_access_state") {
      return Response.json([clayAccessStateRow(suiLinked ? {
        sui_address: suiAddress,
        sui_verified_at: "2026-07-14T04:30:00.000Z",
      } : {})]);
    }
    if (functionName === "begin_clay_sui_link") {
      return Response.json([{ allowed: true, reason: "ok" }]);
    }
    if (functionName === "finish_clay_sui_link") {
      suiLinked = true;
      return Response.json([{
        popkins_count: 0,
        popkins_synced_at: null,
        verified_at: "2026-07-14T04:30:00.000Z",
        wallet_address: suiAddress,
        wallet_name: "Test Sui Wallet",
      }]);
    }
    throw new Error(`Unexpected Supabase RPC: ${functionName}`);
  };

  const env = {
    CLAYMATCHING_HOSTS: "claymatching.luna21e8.xyz",
    CLAYMATCHING_SESSION_SECRET: TEST_SESSION_SECRET,
    SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    SUPABASE_SECRET_KEY: "test-secret-key",
    SUPABASE_URL: "https://project.supabase.co",
  };

  try {
    const challengeResponse = await worker.fetch(new Request(
      "https://claymatching.luna21e8.xyz/api/claymatching/sui/challenge",
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          Origin: "https://claymatching.luna21e8.xyz",
          "X-Clay-CSRF": TEST_CSRF,
        },
        body: JSON.stringify({ address: suiAddress }),
      },
    ), env);
    const challenge = await challengeResponse.json();
    assert.equal(challengeResponse.status, 200);
    assert.equal(challenge.address, suiAddress);
    assert.match(challenge.message, /does not authorize a transaction/i);
    assert.ok(challenge.challengeToken);

    const signed = await keypair.signPersonalMessage(new TextEncoder().encode(challenge.message));
    const linkResponse = await worker.fetch(new Request(
      "https://claymatching.luna21e8.xyz/api/claymatching/sui/link",
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          Origin: "https://claymatching.luna21e8.xyz",
          "X-Clay-CSRF": TEST_CSRF,
        },
        body: JSON.stringify({
          challengeToken: challenge.challengeToken,
          signature: signed.signature,
          walletName: "Test Sui Wallet",
        }),
      },
    ), env);
    const linked = await linkResponse.json();
    assert.equal(linkResponse.status, 200);
    assert.equal(linked.linked, true);
    assert.equal(linked.walletAddress, suiAddress);
    assert.deepEqual(rpcCalls, [
      "get_clay_access_state",
      "begin_clay_sui_link",
      "get_clay_access_state",
      "finish_clay_sui_link",
      "get_clay_access_state",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("claymatching rejects Popkins sync before any chain query without same-origin CSRF", async () => {
  const cookie = await claymatchingSessionCookie();
  const env = {
    CLAYMATCHING_HOSTS: "claymatching.luna21e8.xyz",
    CLAYMATCHING_SESSION_SECRET: TEST_SESSION_SECRET,
    SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    SUPABASE_SECRET_KEY: "test-secret-key",
    SUPABASE_URL: "https://project.supabase.co",
  };

  const crossSite = await worker.fetch(new Request(
    "https://claymatching.luna21e8.xyz/api/claymatching/popkins/sync",
    {
      method: "POST",
      headers: { Cookie: cookie, Origin: "https://evil.example" },
    },
  ), env);
  assert.equal(crossSite.status, 403);

  const noCsrf = await worker.fetch(new Request(
    "https://claymatching.luna21e8.xyz/api/claymatching/popkins/sync",
    {
      method: "POST",
      headers: { Cookie: cookie, Origin: "https://claymatching.luna21e8.xyz" },
    },
  ), env);
  assert.equal(noCsrf.status, 403);
});
