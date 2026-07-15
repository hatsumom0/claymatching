# Claymatching Supabase

This is the standalone repository's canonical Supabase directory. Only
Claymatching migrations belong here.

Project:

- Name: `claymatching-production`
- Ref: `jfpatuhroezchwjtsaga`
- URL: `https://jfpatuhroezchwjtsaga.supabase.co`
- Publishable key: `sb_publishable_DZP4Vq_sc2XsbKUdLlANqw_qehrgjj-`
- Turnstile site key: `0x4AAAAAAD1MjHtoMBIR_Q8a`

Run Supabase commands from the repository root with:

```bash
npx supabase link --project-ref jfpatuhroezchwjtsaga
npx supabase db push --dry-run
npx supabase db push
```

Never copy another product's migrations into this directory, and always verify
the linked project ref before a database push.

## Production authentication settings

Claymatching offers three safe ways to begin onboarding: Solana, passwordless
email, or Sign in with Apple. Email and Apple may create a Supabase user, but
that sign-in alone has no community or DM access. Access is granted separately
from current, server-checked eligibility and any signed wallet connection.

The production access matrix is:

| Current account state | Board/posts | Private Signals |
| --- | --- | --- |
| Email or Apple only | No | No |
| Eligible, user-activated read-only Solana address | Yes | No |
| Eligible read-only Solana + signed Sui | Yes | Yes |
| Eligible signed Solana | Yes | Yes |
| Eligible signed Solana + signed Sui | Yes | Yes |
| Signed Sui only | No | No |
| Suspended, banned, or expired eligibility | No | No |

Rules behind that matrix:

- Solana-first onboarding keeps the existing signed-wallet route. It verifies
  current Clayno eligibility and unlocks both posting and DMs.
- Email- or Apple-first onboarding creates a resumable account with both
  capabilities off. Sui by itself is also not an eligibility credential.
- Pasting a public Solana address first produces only an unverified preview.
  Nothing activates until the signed-in user explicitly chooses read-only
  access, repeats the 18+/eligible-holder/lawful-use attestations, completes
  Turnstile, and the Worker rechecks eligible assets on the server.
- Read-only activation does **not** claim wallet ownership. It stores only a
  private, time-bounded address/count/check snapshot in
  `clay_read_only_solana_access`; it never writes `clay_wallet_accounts`, never
  copies assets to `clay_holder_assets`, and never makes preview assets
  selectable avatars. Posting access expires after 24 hours and must be
  user-triggered and server-checked again.
- Private Signals additionally require proof of control of a Solana or Sui
  wallet. A read-only public address never creates a Noctweave identity or
  advertises a Signal device by itself.
- Suspension, banning, missing or outdated consent, and expired Solana eligibility
  are enforced live by database capability checks. They deny both posting and
  DMs; inactive accounts also have advertised Signal devices revoked.
- Passkeys are enrolled only after a private email is confirmed. They are a
  convenient returning sign-in method, not eligibility or wallet-control proof.
- Every returning session reloads `can_post` and `can_dm` from server-side
  state. Browser-provided capability flags are never trusted for authorization.

In the Supabase dashboard for `jfpatuhroezchwjtsaga`:

1. Authentication → URL Configuration
   - Site URL: `https://claymatching.luna21e8.xyz`
   - Redirect URL: `https://claymatching.luna21e8.xyz/`
   - Staging redirect URL: `https://claymatching.vfsp2wqysh.workers.dev/`
2. Authentication → Sign In / Providers → Email
   - Enable Email.
   - Enable new email signups.
   - Require email confirmation.
3. Authentication → Email Templates → Magic Link
   - Subject: `Your Claymatching sign-in code`
   - Make sure the body visibly includes `{{ .Token }}`. That variable is the
     six-digit code accepted by the onboarding form. A minimal production body
     is:

     ```html
     <h2>Your Claymatching sign-in code</h2>
     <p>Enter this six-digit code on Claymatching:</p>
     <p style="font-size: 32px; font-weight: 800; letter-spacing: 0.3em;">{{ .Token }}</p>
     <p>This code expires shortly and can be used once.</p>
     ```
4. Authentication → Settings
   - Enable manual identity linking.
5. Authentication → Passkeys
   - Enable passkeys.
   - Display name: `Claymatching`
   - RP ID: `claymatching.luna21e8.xyz`
   - Origin: `https://claymatching.luna21e8.xyz`
6. Authentication → Bot and Abuse Protection
   - Enable Cloudflare Turnstile.
   - Use the **secret key** from the same widget as the public site key listed
     above. Supabase, not the browser, validates this secret for email OTP.
7. In the Cloudflare Turnstile widget's hostname list, allow both:
   - `claymatching.luna21e8.xyz`
   - `claymatching.vfsp2wqysh.workers.dev`
8. Project Settings → Authentication → SMTP Settings
   - Keep custom SMTP enabled with the saved Resend credentials.
   - Use a sender address on the already verified `luna21e8.xyz` domain.
   - Never place the Resend API key or SMTP password in this repository or in
     the browser. Resend configuration lives in Supabase, not the Worker.

The production browser app accepts Supabase's six-digit email OTP. The HTML
files under `supabase/templates/` configure local Supabase only; Supabase's
hosted project must be updated on its Email Templates dashboard page. Custom
SMTP is required for dependable production delivery. Switching back to PKCE
would also require token-hash callback links.

Do not change the passkey RP ID after holders enroll passkeys; passkeys are bound
to it.

## Worker secret for wallet activation

Email- and Apple-first accounts complete a fresh Turnstile check for either an
explicit read-only activation or a signed Solana ownership message. Add the
existing Claymatching widget's **secret key** to the Worker under this exact
binding name (do not paste the public site key):

```bash
npx wrangler secret put CLAYMATCHING_TURNSTILE_SECRET_KEY
```

The command prompts for the value without saving it in shell history. The
Worker intentionally fails closed when this secret is absent, and it verifies
that Turnstile returned `claymatching.luna21e8.xyz` as the hostname.

## Sign in with Apple

Apple needs credentials from the Apple Developer account before its provider can
be enabled:

- A primary App ID with Sign in with Apple enabled.
- A web Services ID attached to that App ID.
- Apple website domain: `jfpatuhroezchwjtsaga.supabase.co`
- Apple return URL: `https://jfpatuhroezchwjtsaga.supabase.co/auth/v1/callback`
- Team ID, Key ID, and the private `AuthKey_*.p8` signing key.

Generate the six-month Apple client secret locally (the `.p8` stays on the
computer):

```bash
npm run apple:secret -- /absolute/path/AuthKey_KEYID.p8 TEAM_ID KEY_ID SERVICES_ID
```

In Supabase Authentication → Sign In / Providers → Apple, use the Services ID as
the Client ID and the generated value as the Secret, then enable Apple. Store the
`.p8` securely and rotate the generated client secret before six months.

An Apple login may create a provisional user. Apple alone never grants posting
or DM access and must not be treated as eligibility or wallet-control proof.

## Migration order

`db push` applies these files in filename order. Before deploying the Worker or
browser changes, confirm the dry run ends with the two capability migrations in
this exact order:

1. `20260713180000_claymatching_v1.sql`
2. `20260713191500_fix_confirm_clay_holder_conflicts.sql`
3. `20260713220000_claymatching_custom_backgrounds.sql`
4. `20260713224500_claymatching_notifications.sql`
5. `20260713230000_claymatching_collect_profile_links.sql`
6. `20260714011500_claymatching_collect_achievement_sync.sql`
7. `20260714020000_claymatching_featured_achievement.sql`
8. `20260714043000_claymatching_sui_popkins.sql`
9. `20260714144000_claymatching_popkins_avatars.sql`
10. `20260714150000_claymatching_split_custom_backgrounds.sql`
11. `20260714170000_claymatching_provisional_auth_solana_link.sql`
12. `20260714180000_claymatching_access_capabilities.sql`

The access-capabilities migration depends on the provisional-auth and Sui
tables. Do not apply it alone or out of order. Apply the database migrations
before deploying code that calls `get_clay_access_state` or
`confirm_clay_read_only_access`.

## Account deletion isolation

The existing `/account-deletion/` page belongs to a different Supabase product
and must not be used by Claymatching. Claymatching account settings should link
to `/claymatching/account-deletion/`, and that page/function must target project
`jfpatuhroezchwjtsaga` only. Do not point it at the repository's existing
`fogixaotetbjzpzazwhf` deletion function.

Until an isolated Claymatching deletion function and deletion-request table are
deployed, the Claymatching page provides the documented manual deletion path.
Do not imply that a request has been automatically completed. A production
automation must authenticate the current Claymatching user, use a one-use
hashed confirmation token, delete the Supabase Auth user with the service role,
and let foreign-key cascades remove holder/profile data.
