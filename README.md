# Claymatching

Standalone source for `claymatching.luna21e8.xyz`: the Claymatching frontend, Solana/Sui holder APIs, canonical Supabase schema, and its Noctweave encrypted-message relay.

No unrelated product code or Supabase schema belongs in this repository.

## Local verification

```sh
npm install
npm test
npm run deploy:dry-run
```

## Supabase

This repository's only database project is `claymatching-production` (`jfpatuhroezchwjtsaga`). Link and push from this repository root:

```sh
supabase link --project-ref jfpatuhroezchwjtsaga
supabase db push --dry-run
supabase db push
```

Never copy migrations from another product into `supabase/migrations`.

## Cloudflare secrets

Cloudflare secrets are scoped to a Worker. They do not carry over from the legacy `luna21e8` Worker, so set each one on the standalone `claymatching` Worker during the coordinated cutover:

- `CLAYMATCHING_SESSION_SECRET`
- `CLAYMATCHING_TURNSTILE_SECRET_KEY`
- `HELIUS_API_KEY`
- `SUPABASE_SECRET_KEY`

Set them interactively with `wrangler secret put NAME`; never commit values or copy them into `wrangler.jsonc`.

## Relay continuity warning

The production relay's identity is the combination of the owning Worker script, Durable Object class, and object name—not the object name alone. For now this standalone Worker uses an external Durable Object binding:

- Standalone Worker script: `claymatching`
- External namespace owner: `luna21e8` (interim compatibility dependency)
- DO class: `LunaNoctweaveRelay` (legacy compatibility identifier)
- DO object: `luna-default-relay`

The standalone config intentionally has no Durable Object migration because it does not own that class yet. This preserves the current encrypted inbox namespace without risking replacement of the multi-product Worker. A planned namespace transfer is required before the legacy Worker can be retired. The only custom domain configured here is Claymatching.

## Production cutover

`npm run deploy` claims the live `claymatching.luna21e8.xyz` custom domain. Do not run it as an ordinary preview deploy.

1. Deploy and verify the host-isolation patch on the current `luna21e8` Worker first.
2. Run the Supabase dry run and confirm only Claymatching migrations are listed.
3. Run `npm test` and `npm run deploy:dry-run` here.
4. Create the `claymatching` Worker without moving the live route, then set all four secrets on that Worker.
5. In one coordinated maintenance window, remove the Claymatching route from the legacy Worker and deploy this Worker with the route.
6. Verify `/health`, `/info`, session restoration, and a two-account encrypted send/receive/acknowledge flow before declaring the cutover complete.

The external Durable Object binding is what keeps existing Claymatching encrypted inboxes reachable during this first cutover. Do not remove the legacy Worker or its Durable Object namespace afterward; namespace ownership must be transferred in a separate reviewed migration.
