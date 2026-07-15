import { readFile } from "node:fs/promises";
import { createSign } from "node:crypto";

const [, , keyPath, teamId, keyId, servicesId] = process.argv;

if (!keyPath || !teamId || !keyId || !servicesId) {
  console.error("Usage: node scripts/generate-apple-client-secret.mjs <AuthKey_KEYID.p8> <TEAM_ID> <KEY_ID> <SERVICES_ID>");
  process.exit(1);
}

const base64url = (value) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const now = Math.floor(Date.now() / 1000);
const expiresIn = 60 * 60 * 24 * 180;
const privateKey = await readFile(keyPath, "utf8");

const header = {
  alg: "ES256",
  kid: keyId,
};

const payload = {
  iss: teamId,
  iat: now,
  exp: now + expiresIn,
  aud: "https://appleid.apple.com",
  sub: servicesId,
};

const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
const signer = createSign("SHA256");
signer.update(signingInput);
signer.end();

const signature = signer
  .sign({ key: privateKey, dsaEncoding: "ieee-p1363" })
  .toString("base64")
  .replace(/=/g, "")
  .replace(/\+/g, "-")
  .replace(/\//g, "_");

console.log(`${signingInput}.${signature}`);
