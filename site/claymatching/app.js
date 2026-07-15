const SUPABASE_URL = "https://jfpatuhroezchwjtsaga.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_DZP4Vq_sc2XsbKUdLlANqw_qehrgjj-";
const SUPABASE_STORAGE_KEY = "claymatching.supabase-auth.jfpatuhroezchwjtsaga.v1";
const TURNSTILE_SITE_KEY = "0x4AAAAAAD1MjHtoMBIR_Q8a";
const TERMS_VERSION = "2026-07-13";
const VIEW_STORAGE_KEY = "claymatching.view.v1";
const DEVICE_STORAGE_KEY = "claymatching.signal-device.v1";
const AUTH_RETURN_STORAGE_KEY = "claymatching.auth-return.v1";
const EMAIL_OTP_STORAGE_KEY = "claymatching.email-otp.v1";
const SIGNAL_SEEN_STORAGE_PREFIX = "claymatching.signal-seen.v1";
const SIGNAL_IDENTITY_DISPLAY_PREFIX = "claymatching:v1:";
const NOTIFICATION_REFRESH_MS = 60_000;
const SIGNAL_RELAY_URL = new URL("/relay", window.location.href).href;
const CLAY_COLLECT_ORIGIN = "https://collect.claynosaurz.com";
const CLAY_COLLECT_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POPKINS_COLLECTION_ID = "0xb908f3c6fea6865d32e2048c520cdfe3b5c5bbcebb658117c41bad70f52b7ccc::popkins_nft::Popkins";

const db = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    experimental: { passkey: true },
    flowType: "implicit",
    persistSession: true,
    storage: window.localStorage,
    storageKey: SUPABASE_STORAGE_KEY,
  },
});

const walletButton = document.querySelector("[data-wallet-button]");
const connectHeroButton = document.querySelector("[data-connect-hero]");
const walletState = document.querySelector("[data-wallet-state]");
const accountArea = document.querySelector("[data-account-area]");
const accountMenu = document.querySelector("[data-account-menu]");
const accountName = document.querySelector("[data-account-name]");
const accountAddress = document.querySelector("[data-account-address]");
const accountProfileButton = document.querySelector("[data-account-profile]");
const accountSignOutButton = document.querySelector("[data-account-sign-out]");
const walletGate = document.querySelector("[data-wallet-gate]");
const provisionalShell = document.querySelector("[data-provisional-shell]");
const provisionalMethod = document.querySelector("[data-provisional-method]");
const provisionalIdentity = document.querySelector("[data-provisional-identity]");
const provisionalPreviewForm = document.querySelector("[data-provisional-preview-form]");
const provisionalAddressInput = document.querySelector("[data-provisional-address]");
const provisionalPreviewSubmit = document.querySelector("[data-provisional-preview-submit]");
const provisionalPreviewStatus = document.querySelector("[data-provisional-preview-status]");
const provisionalPreviewSummary = document.querySelector("[data-provisional-preview-summary]");
const provisionalPreviewCount = document.querySelector("[data-provisional-preview-count]");
const provisionalAssetGrid = document.querySelector("[data-provisional-asset-grid]");
const provisionalPreviewWarning = document.querySelector("[data-provisional-preview-warning]");
const provisionalReadOnlyCallout = document.querySelector("[data-provisional-read-only-callout]");
const provisionalReadOnlyButton = document.querySelector("[data-provisional-read-only]");
const provisionalVerifyButton = document.querySelector("[data-provisional-verify]");
const provisionalSignOutButton = document.querySelector("[data-provisional-sign-out]");
const appShell = document.querySelector("[data-app-shell]");
const appLoading = document.querySelector("[data-app-loading]");
const consentDialog = document.querySelector("[data-consent-dialog]");
const consentForm = document.querySelector("[data-consent-form]");
const consentStatus = document.querySelector("[data-consent-status]");
const consentDialogTitle = document.querySelector("#consent-dialog-title");
const consentLead = consentDialog.querySelector(".consent-lead");
const consentSubmitButton = consentForm.querySelector('button[type="submit"]');
const turnstileHost = document.querySelector("[data-turnstile]");
const profileDialog = document.querySelector("[data-profile-dialog]");
const profileForm = document.querySelector("[data-profile-form]");
const avatarOptions = document.querySelector("[data-avatar-options]");
const assetStatus = document.querySelector("[data-asset-status]");
const avatarCollectionButtons = [...document.querySelectorAll("[data-avatar-collection]")];
const avatarClaynoCount = document.querySelector("[data-avatar-clayno-count]");
const avatarPopkinCount = document.querySelector("[data-avatar-popkin-count]");
const memberProfileDialog = document.querySelector("[data-member-profile-dialog]");
const memberProfileCard = document.querySelector("[data-member-profile-card]");
const memberProfileAvatar = document.querySelector("[data-member-profile-avatar]");
const memberProfileName = document.querySelector("[data-member-profile-name]");
const memberProfileBio = document.querySelector("[data-member-profile-bio]");
const memberProfileTags = document.querySelector("[data-member-profile-tags]");
const memberFeaturedAchievement = document.querySelector("[data-member-featured-achievement]");
const memberProfileCollectLink = document.querySelector("[data-member-profile-collect-link]");
const memberAccountState = document.querySelector("[data-member-account-state]");
const memberProfileEyebrow = document.querySelector("[data-member-profile-eyebrow]");
const memberMatchButton = document.querySelector("[data-member-match]");
const memberSignalButton = document.querySelector("[data-member-signal]");
const memberAdminPanel = document.querySelector("[data-member-admin-panel]");
const memberAdminReason = document.querySelector("[data-member-admin-reason]");
const memberAdminStatus = document.querySelector("[data-member-admin-status]");
const actionDialog = document.querySelector("[data-action-dialog]");
const actionForm = document.querySelector("[data-action-form]");
const actionEyebrow = document.querySelector("[data-action-eyebrow]");
const actionTitle = document.querySelector("[data-action-title]");
const actionCopy = document.querySelector("[data-action-copy]");
const actionCategoryWrap = document.querySelector("[data-action-category-wrap]");
const actionCategory = document.querySelector("[data-action-category]");
const actionDetailWrap = document.querySelector("[data-action-detail-wrap]");
const actionDetail = document.querySelector("[data-action-detail]");
const actionCancelButton = document.querySelector("[data-action-cancel]");
const actionConfirmButton = document.querySelector("[data-action-confirm]");
const dmDialog = document.querySelector("[data-dm-dialog]");
const dmForm = document.querySelector("[data-dm-form]");
const dmThread = document.querySelector("[data-dm-thread]");
const dmStatus = document.querySelector("[data-dm-status]");
const dmCollectLink = document.querySelector("[data-dm-collect-link]");
const toast = document.querySelector("[data-toast]");
const composer = document.querySelector("[data-composer]");
const composerSubmit = document.querySelector("[data-composer-submit]");
const replyContext = document.querySelector("[data-reply-context]");
const replyContextCopy = document.querySelector("[data-reply-context-copy]");
const achievementTooltip = document.querySelector("[data-achievement-tooltip-layer]");
const feed = document.querySelector("[data-feed]");
const boardHeading = document.querySelector("[data-board-heading]");
const matchingGrid = document.querySelector("[data-matching-grid]");
const matchingFilter = document.querySelector("[data-matching-filter]");
const peopleStack = document.querySelector("[data-people-stack]");
const liveCount = document.querySelector("[data-live-count]");
const signalStatus = document.querySelector("[data-signal-status]");
const signalsHeading = document.querySelector("[data-signals-heading]");
const signalsIntro = document.querySelector("[data-signals-intro]");
const signalsLock = document.querySelector("[data-signals-lock]");
const openWalletLinksButton = document.querySelector("[data-open-wallet-links]");
const signalInbox = document.querySelector("[data-signal-inbox]");
const signalInboxList = document.querySelector("[data-signal-inbox-list]");
const signalInboxHeading = document.querySelector("[data-signal-inbox-heading]");
const signalDirectory = document.querySelector("[data-signal-directory]");
const signalRecipients = document.querySelector("[data-signal-recipients]");
const signalDirectoryHeading = document.querySelector("[data-signal-directory-heading]");
const profileCard = document.querySelector("[data-profile-card]");
const profileName = document.querySelector("[data-profile-name]");
const profileAccessBadge = document.querySelector("[data-profile-access-badge]");
const profileBio = document.querySelector("[data-profile-bio]");
const profileTags = document.querySelector("[data-profile-tags]");
const profileFeaturedAchievement = document.querySelector("[data-profile-featured-achievement]");
const profileAchievements = document.querySelector("[data-profile-achievements]");
const profileCollectLink = document.querySelector("[data-profile-collect-link]");
const profileImage = document.querySelector("[data-profile-image]");
const profileFallback = document.querySelector("[data-profile-fallback]");
const profileAvatarButton = document.querySelector("[data-profile-avatar-button]");
const composerAvatar = document.querySelector("[data-composer-avatar]");
const emailSigninForm = document.querySelector("[data-email-signin-form]");
const emailOtpEntry = document.querySelector("[data-email-otp-entry]");
const emailTurnstileHost = document.querySelector("[data-email-turnstile]");
const emailTurnstileStatus = document.querySelector("[data-email-turnstile-status]");
const verifyEmailCodeButton = document.querySelector("[data-verify-email-code]");
const resetEmailCodeButton = document.querySelector("[data-reset-email-code]");
const authEntryStatus = document.querySelector("[data-auth-entry-status]");
const passkeySigninButton = document.querySelector("[data-passkey-signin]");
const appleSigninButton = document.querySelector("[data-apple-signin]");
const customPostBackground = document.querySelector("[data-custom-post-background]");
const customProfileBackgroundPreview = document.querySelector("[data-custom-profile-background-preview]");
const customProfileBackgroundSample = document.querySelector("[data-custom-profile-background-sample]");
const customPostBackgroundSample = document.querySelector("[data-custom-post-background-sample]");
const customBackgroundPanels = [...document.querySelectorAll("[data-custom-background-panel]")];
const linkedWallet = document.querySelector("[data-linked-wallet]");
const linkSolanaWalletButton = document.querySelector("[data-link-solana-wallet]");
const solanaLinkState = document.querySelector("[data-solana-link-state]");
const linkSuiWalletButton = document.querySelector("[data-link-sui-wallet]");
const unlinkSuiWalletButton = document.querySelector("[data-unlink-sui-wallet]");
const syncPopkinsButton = document.querySelector("[data-sync-popkins]");
const suiWalletStatus = document.querySelector("[data-sui-wallet-status]");
const suiLinkState = document.querySelector("[data-sui-link-state]");
const popkinsConnectionBadge = document.querySelector("[data-popkins-connection-badge]");
const popkinsConnectionCount = document.querySelector("[data-popkins-connection-count]");
const linkedEmailStatus = document.querySelector("[data-linked-email-status]");
const linkEmailInput = document.querySelector("[data-link-email-input]");
const linkEmailButton = document.querySelector("[data-link-email]");
const linkEmailOtp = document.querySelector("[data-link-email-otp]");
const linkEmailCodeAddress = document.querySelector("[data-link-email-code-address]");
const linkEmailCodeInput = document.querySelector("[data-link-email-code]");
const verifyLinkEmailButton = document.querySelector("[data-verify-link-email]");
const registerPasskeyButton = document.querySelector("[data-register-passkey]");
const emailLinkState = document.querySelector("[data-email-link-state]");
const linkedAppleStatus = document.querySelector("[data-linked-apple-status]");
const linkAppleButton = document.querySelector("[data-link-apple]");
const appleLinkState = document.querySelector("[data-apple-link-state]");
const collectProfileInput = document.querySelector("[data-collect-profile-input]");
const saveCollectProfileButton = document.querySelector("[data-save-collect-profile]");
const syncCollectAchievementsButton = document.querySelector("[data-sync-collect-achievements]");
const unlinkCollectProfileButton = document.querySelector("[data-unlink-collect-profile]");
const collectProfileStatus = document.querySelector("[data-collect-profile-status]");
const collectProfilePreview = document.querySelector("[data-collect-profile-link]");
const collectLinkState = document.querySelector("[data-collect-link-state]");
const featuredAchievementPicker = document.querySelector("[data-featured-achievement-picker]");
const featuredAchievementOptions = document.querySelector("[data-featured-achievement-options]");
const featuredAchievementStatus = document.querySelector("[data-featured-achievement-status]");
const achievementDialog = document.querySelector("[data-achievement-dialog]");
const achievementDialogTitle = document.querySelector("[data-achievement-title]");
const achievementDialogStatus = document.querySelector("[data-achievement-status]");
const achievementDialogGrid = document.querySelector("[data-achievement-grid]");
const achievementDialogSource = document.querySelector("[data-achievement-source]");
const mudprintLinkStatus = document.querySelector("[data-mudprint-link-status]");
const profileNotifications = document.querySelector("[data-profile-notifications]");
const notificationBadge = document.querySelector("[data-notification-badge]");
const notificationCount = document.querySelector("[data-notification-count]");
const notificationLive = document.querySelector("[data-notification-live]");
const notificationMenu = document.querySelector("[data-notification-menu]");
const notificationBoardAction = document.querySelector("[data-notification-board]");
const notificationBoardSummary = document.querySelector("[data-notification-board-summary]");
const notificationBoardCount = document.querySelector("[data-notification-board-count]");
const notificationSignalAction = document.querySelector("[data-notification-signals]");
const notificationSignalSummary = document.querySelector("[data-notification-signal-summary]");
const notificationSignalCount = document.querySelector("[data-notification-signal-count]");
const dmSubmitButton = dmForm.querySelector('button[type="submit"]');

let activeProvider;
let walletAddress = "";
let currentSession;
let currentProfile;
let holderSessionReady = false;
let dmAccessReady = false;
let accessMode = "";
let signedSolanaAddress = "";
let signedSolanaHolderReady = false;
let readOnlySolanaAddress = "";
let ownedAssets = [];
let activeAvatarCollection = "clayno";
let profiles = [];
let posts = [];
let postReferences = new Map();
let reactions = [];
let squishes = [];
let mutualMatches = [];
let matchingIntent = "all";
let selectedPostBackground = "dune";
let replyTargetId = null;
let pendingConsentSession = null;
let captchaToken = "";
let emailCaptchaToken = "";
let consentErrorMessage = "";
let consentSubmitting = false;
let turnstileWidgetId;
let emailTurnstileWidgetId;
let emailTurnstileRenderPromise;
let toastTimer;
let signalCore;
let signalIdentity;
let currentDmTarget;
let viewedProfile;
let currentDmDevices = [];
let ownSignalDevices = [];
let passkeys = [];
let appleAuthEnabled = null;
let pendingEmailSignIn = "";
let pendingLinkedEmail = "";
let previousLinkedEmail = "";
let notifications = [];
let signalMessages = [];
let signalUnreadCount = 0;
let signalProfileByFingerprint = new Map();
let ambiguousSignalFingerprints = new Set();
let ownSignalFingerprints = new Set();
let signalOperationQueue = Promise.resolve();
let signalIdentityPromise;
let signalIdentityAccountId = "";
let signalRefreshPromise;
let signalRefreshAccountId = "";
let notificationRefreshTimer;
let notificationMenuFrame;
let lastNotificationAnnouncement = "";
let accessRefreshPromise;
let lastAccessRefreshAt = 0;
let authRebindUserId = "";
let holderCsrfToken = "";
let achievementDialogRequestId = 0;
let featuredAchievementRequestId = 0;
let activeAchievementTooltipTrigger;
let achievementTooltipFrame;
let actionDialogResolve;
let actionDialogReturnFocus;
let signalDirectoryReturnFocus;
let walletAccountProvider;
let ownSyncedAchievements = [];
let featuredAchievementChoicesReady = false;
let linkedSuiConnection = null;
let connectedSuiWallet = null;
let suiWalletModulePromise;
let provisionalWalletActivation = false;
let provisionalActivationMode = "";
let provisionalPreviewAddress = "";
let provisionalPreviewAssets = [];
let provisionalPreviewRequestId = 0;
let provisionalPreviewPending = false;

function ensureSuiWalletModule() {
  if (!suiWalletModulePromise) {
    suiWalletModulePromise = import("/claymatching/sui-dist/sui-wallet.js?v=20260714-12")
      .catch((error) => {
        suiWalletModulePromise = undefined;
        throw error;
      });
  }
  return suiWalletModulePromise;
}

function cleanUsername(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 20);
}

function cleanOtp(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function readableErrorMessage(error, fallback) {
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  if (!message || message === "{}" || message === "[object Object]") return fallback;
  return message;
}

function rememberPendingEmailSignIn(email) {
  pendingEmailSignIn = String(email || "").trim().toLowerCase();
  try {
    if (pendingEmailSignIn) window.localStorage.setItem(EMAIL_OTP_STORAGE_KEY, pendingEmailSignIn);
    else window.localStorage.removeItem(EMAIL_OTP_STORAGE_KEY);
  } catch {
    // Code entry still works when private browsing blocks local storage.
  }
}

function showEmailCodeEntry(email, { focus = true } = {}) {
  rememberPendingEmailSignIn(email);
  emailSigninForm.elements.email.value = pendingEmailSignIn;
  emailOtpEntry.hidden = false;
  emailSigninForm.querySelector('button[type="submit"]').textContent = "send another code";
  if (focus) emailSigninForm.elements.otp.focus();
}

function clearEmailCodeEntry() {
  rememberPendingEmailSignIn("");
  emailOtpEntry.hidden = true;
  emailSigninForm.elements.otp.value = "";
  emailSigninForm.querySelector('button[type="submit"]').textContent = "email me a sign-in code";
}

function renderLinkedEmailCodeEntry() {
  linkEmailOtp.hidden = !pendingLinkedEmail;
  linkEmailCodeAddress.replaceChildren();
  if (!pendingLinkedEmail) return;
  const addresses = [...new Set([pendingLinkedEmail, previousLinkedEmail].filter(Boolean))];
  for (const email of addresses) {
    const option = document.createElement("option");
    option.value = email;
    option.textContent = email;
    linkEmailCodeAddress.append(option);
  }
}

function clearLinkedEmailCodeEntry() {
  pendingLinkedEmail = "";
  previousLinkedEmail = "";
  linkEmailCodeInput.value = "";
  renderLinkedEmailCodeEntry();
}

function signalSeenStorageKey() {
  return `${SIGNAL_SEEN_STORAGE_PREFIX}.${currentSession?.user?.id || "signed-out"}`;
}

function messageTimestamp(message) {
  const value = message?.createdAt || message?.timestamp || message?.created_at;
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function legacySeenSignalTime() {
  try {
    return Number(window.localStorage.getItem(signalSeenStorageKey()) || 0);
  } catch {
    return 0;
  }
}

function assertSignalOperationAccount(accountId) {
  if (!accountId || String(currentSession?.user?.id || "") !== accountId) {
    throw new Error("The signed-in account changed while Signals were updating.");
  }
}

function queueSignalOperation(operation) {
  const accountId = String(currentSession?.user?.id || "");
  const run = async () => {
    assertSignalOperationAccount(accountId);
    const result = await operation({
      accountId,
      assertCurrent: () => assertSignalOperationAccount(accountId),
    });
    assertSignalOperationAccount(accountId);
    return result;
  };
  const previous = signalOperationQueue.catch(() => {});
  const queued = previous.then(() => navigator.locks?.request
    ? navigator.locks.request(`claymatching-signal-log:${accountId}`, { mode: "exclusive" }, run)
    : run());
  signalOperationQueue = queued.catch(() => {});
  return queued;
}

function signalMessageDirection(message) {
  const contactFingerprint = String(message?.contactFingerprint || "").trim().toLowerCase();
  const locallySent = message?.direction === "outbox" && (
    (Array.isArray(message?.envelopeIds) && message.envelopeIds.length > 0)
      || Number(message?.deviceCount || 0) > 0
      || Number(message?.deliveredCount || 0) > 0
  );
  return locallySent || ownSignalFingerprints.has(contactFingerprint)
    ? "outbox"
    : "inbox";
}

function signalIdentityDisplayName(accountId, handle) {
  return `${SIGNAL_IDENTITY_DISPLAY_PREFIX}${String(accountId || "").toLowerCase()}:${cleanUsername(handle)}`;
}

function parseSignalIdentityDisplayName(value) {
  const displayName = String(value || "").trim();
  if (!displayName.startsWith(SIGNAL_IDENTITY_DISPLAY_PREFIX)) return undefined;
  const remainder = displayName.slice(SIGNAL_IDENTITY_DISPLAY_PREFIX.length);
  const separator = remainder.indexOf(":");
  if (separator < 1) return undefined;
  const accountId = remainder.slice(0, separator).toLowerCase();
  const handle = cleanUsername(remainder.slice(separator + 1));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(accountId) || !handle) return undefined;
  return { accountId, handle };
}

function unreadBoardNotifications() {
  const unique = new Map();
  for (const notification of notifications.filter((entry) => !entry.read_at)) {
    const key = `${notification.actor_user_id || "unknown"}:${notification.post_id || notification.id}`;
    const saved = unique.get(key);
    if (!saved || (saved.kind !== "reply" && notification.kind === "reply")) unique.set(key, notification);
  }
  return [...unique.values()];
}

function signalMessageHandle(message) {
  const candidates = signalMessageDirection(message) === "outbox"
    ? [message.counterpartyHandle, message.conversationHandle, message.recipient]
    : [message.author, message.counterpartyHandle, message.conversationHandle];
  for (const candidate of candidates) {
    const handle = cleanUsername(candidate);
    if (handle && handle.toLowerCase() !== cleanUsername(currentProfile?.handle).toLowerCase()) return handle;
  }
  return "";
}

function signalCounterpartyFingerprint(message) {
  const contactFingerprint = String(message?.contactFingerprint || "").trim().toLowerCase();
  const recipientFingerprint = String(message?.recipientFingerprint || "").trim().toLowerCase();
  if (signalMessageDirection(message) === "outbox" && ownSignalFingerprints.has(contactFingerprint)) {
    return recipientFingerprint || contactFingerprint;
  }
  return contactFingerprint;
}

function signalProfileForMessage(message) {
  const fingerprint = signalCounterpartyFingerprint(message);
  if (!fingerprint || ambiguousSignalFingerprints.has(fingerprint)) return undefined;
  return signalProfileByFingerprint.get(fingerprint);
}

function signalConversationIdentity(message) {
  const profile = signalProfileForMessage(message);
  if (profile?.user_id) {
    return {
      handle: cleanUsername(profile.handle) || "encrypted-contact",
      key: `profile:${profile.user_id}`,
      profile,
    };
  }
  const fingerprint = signalCounterpartyFingerprint(message);
  const fallbackKey = String(message?.conversationKey || message?.conversationId || message?.envelopeId || message?.id || "unknown");
  return {
    handle: "encrypted-contact",
    key: `contact:${fingerprint || fallbackKey}`,
    profile: undefined,
  };
}

async function verifiedSignalDevice(device) {
  const claimed = String(device?.key_fingerprint || "").trim().toLowerCase();
  if (!claimed || !signalCore?.verifySignalContactCode) return undefined;
  try {
    const verified = await signalCore.verifySignalContactCode(device.contact_code);
    const embedded = String(verified?.fingerprint || "").trim().toLowerCase();
    if (!embedded || embedded !== claimed) return undefined;
    const binding = parseSignalIdentityDisplayName(verified?.displayName);
    if (!binding) return undefined;
    return {
      ...binding,
      fingerprint: embedded,
    };
  } catch {
    return undefined;
  }
}

async function signalDeviceFingerprint(device) {
  return (await verifiedSignalDevice(device))?.fingerprint || "";
}

async function indexSignalDevicesForProfile(
  devices,
  profile,
  profileMap = signalProfileByFingerprint,
  ambiguousFingerprints = ambiguousSignalFingerprints,
) {
  const verifiedDevices = await Promise.all((devices || []).map(verifiedSignalDevice));
  const expectedAccountId = String(profile?.user_id || "").toLowerCase();
  const acceptedDevices = [];
  for (const [index, verified] of verifiedDevices.entries()) {
    const fingerprint = verified?.fingerprint || "";
    if (!fingerprint || !expectedAccountId || verified.accountId !== expectedAccountId) continue;
    acceptedDevices.push({ device: devices[index], fingerprint });
    if (ambiguousFingerprints.has(fingerprint)) continue;
    if (!profileMap.has(fingerprint)) {
      profileMap.set(fingerprint, profile);
      continue;
    }
    const existing = profileMap.get(fingerprint);
    if (existing?.user_id !== profile?.user_id) {
      profileMap.delete(fingerprint);
      ambiguousFingerprints.add(fingerprint);
    }
  }
  return acceptedDevices;
}

function isUnreadSignalMessage(message) {
  if (signalMessageDirection(message) === "outbox") return false;
  if (!message?.unread) return false;
  const legacySeenAt = legacySeenSignalTime();
  return !legacySeenAt || messageTimestamp(message) > legacySeenAt;
}

function unreadSignalMessages(messages = signalMessages) {
  return (messages || []).filter(isUnreadSignalMessage);
}

function notificationActorLabel(notification) {
  const actor = profiles.find((profile) => profile.user_id === notification?.actor_user_id);
  const handle = cleanUsername(actor?.handle);
  return handle ? `@${handle}` : "another creature";
}

function signalNotificationActorLabel(message) {
  const handle = cleanUsername(signalProfileForMessage(message)?.handle);
  if (handle) return `@${handle}`;
  const encryptedHandle = signalMessageHandle(message);
  return encryptedHandle ? `@${encryptedHandle} (encrypted contact)` : "an encrypted contact";
}

function formatNotificationSenders(labels = []) {
  const counts = new Map();
  for (const label of labels.filter(Boolean)) counts.set(label, (counts.get(label) || 0) + 1);
  const entries = [...counts.entries()];
  const visible = entries.slice(0, 3).map(([label, count]) => count > 1 ? `${label} ×${count}` : label);
  const remaining = entries.length - visible.length;
  if (remaining > 0) visible.push(`${remaining} more`);
  if (visible.length <= 1) return visible[0] || "another creature";
  if (visible.length === 2) return `${visible[0]} and ${visible[1]}`;
  return `${visible.slice(0, -1).join(", ")}, and ${visible.at(-1)}`;
}

function boardNotificationCopy(items) {
  const kinds = new Set(items.map((item) => item.kind));
  const noun = kinds.size > 1
    ? "Board alerts"
    : kinds.has("reply")
      ? (items.length === 1 ? "Reply" : "Replies")
      : (items.length === 1 ? "Tag" : "Tags");
  return `${noun} from ${formatNotificationSenders(items.map(notificationActorLabel))}`;
}

function signalNotificationCopy(items) {
  return `${items.length === 1 ? "Signal" : "Signals"} from ${formatNotificationSenders(items.map(signalNotificationActorLabel))}`;
}

function positionNotificationMenu() {
  if (!notificationMenu || notificationMenu.hidden || !notificationBadge?.isConnected) return;
  const triggerRect = notificationBadge.getBoundingClientRect();
  const menuRect = notificationMenu.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportLeft = viewport?.offsetLeft || 0;
  const viewportTop = viewport?.offsetTop || 0;
  const viewportWidth = viewport?.width || window.innerWidth;
  const viewportHeight = viewport?.height || window.innerHeight;
  const gutter = 12;
  const gap = 12;
  const minLeft = viewportLeft + gutter;
  const maxLeft = Math.max(minLeft, viewportLeft + viewportWidth - menuRect.width - gutter);
  const left = Math.min(maxLeft, Math.max(minLeft, triggerRect.left));
  const minTop = viewportTop + gutter;
  const maxTop = Math.max(minTop, viewportTop + viewportHeight - menuRect.height - gutter);
  const below = triggerRect.bottom + gap;
  const above = triggerRect.top - menuRect.height - gap;
  const top = Math.min(maxTop, Math.max(minTop, below > maxTop && above >= minTop ? above : below));
  notificationMenu.style.left = `${Math.round(left)}px`;
  notificationMenu.style.top = `${Math.round(top)}px`;
}

function setNotificationMenuOpen(open, { focusFirst = false } = {}) {
  if (!notificationMenu || !notificationBadge) return;
  const shouldOpen = Boolean(open && !notificationBadge.hidden);
  notificationBadge.setAttribute("aria-expanded", String(shouldOpen));
  if (!shouldOpen) {
    window.cancelAnimationFrame(notificationMenuFrame);
    notificationMenuFrame = undefined;
    if (typeof notificationMenu.hidePopover === "function" && notificationMenu.matches(":popover-open")) notificationMenu.hidePopover();
    notificationMenu.hidden = true;
    return;
  }
  notificationMenu.hidden = false;
  if (typeof notificationMenu.showPopover === "function" && !notificationMenu.matches(":popover-open")) notificationMenu.showPopover();
  positionNotificationMenu();
  if (focusFirst) window.requestAnimationFrame(() => notificationMenu.querySelector("button:not([hidden])")?.focus());
}

function scheduleNotificationMenuPosition() {
  if (!notificationMenu || notificationMenu.hidden || notificationMenuFrame) return;
  notificationMenuFrame = window.requestAnimationFrame(() => {
    notificationMenuFrame = undefined;
    positionNotificationMenu();
  });
}

function renderNotificationBadges() {
  const boardItems = unreadBoardNotifications();
  const signalItems = dmAccessReady ? unreadSignalMessages() : [];
  signalUnreadCount = signalItems.length;
  const total = boardItems.length + signalItems.length;
  const parts = [];
  if (boardItems.length) parts.push(boardNotificationCopy(boardItems));
  if (signalItems.length) parts.push(signalNotificationCopy(signalItems));

  const notificationHadFocus = profileNotifications.contains(document.activeElement);
  const announcementKey = total ? `${total}:${parts.join("|")}` : "0";
  if (announcementKey !== lastNotificationAnnouncement) {
    notificationLive.textContent = total
      ? `${total} unread notification${total === 1 ? "" : "s"}. ${parts.join(". ")}`
      : lastNotificationAnnouncement && lastNotificationAnnouncement !== "0"
        ? "All notifications read."
        : "";
    lastNotificationAnnouncement = announcementKey;
  }

  notificationCount.textContent = total > 99 ? "99+" : String(total);
  notificationBadge.hidden = total === 0;
  notificationBadge.classList.toggle("has-board", boardItems.length > 0);
  notificationBadge.classList.toggle("has-signals", signalItems.length > 0);
  notificationBadge.dataset.tooltip = parts.join(" · ") || "No unread notifications";
  notificationBadge.setAttribute("aria-label", total
    ? `Open ${total} unread notification${total === 1 ? "" : "s"}`
    : "No unread notifications");

  const boardActionHadFocus = notificationBoardAction === document.activeElement;
  const signalActionHadFocus = notificationSignalAction === document.activeElement;
  notificationBoardAction.hidden = boardItems.length === 0;
  notificationBoardCount.textContent = boardItems.length > 99 ? "99+" : String(boardItems.length);
  notificationBoardSummary.textContent = boardItems.length ? boardNotificationCopy(boardItems) : "No new board replies";
  notificationSignalAction.hidden = signalItems.length === 0;
  notificationSignalCount.textContent = signalItems.length > 99 ? "99+" : String(signalItems.length);
  notificationSignalSummary.textContent = signalItems.length ? signalNotificationCopy(signalItems) : "No new private Signals";
  if ((boardActionHadFocus && notificationBoardAction.hidden) || (signalActionHadFocus && notificationSignalAction.hidden)) {
    const replacement = [notificationBoardAction, notificationSignalAction].find((action) => !action.hidden) || notificationBadge;
    window.requestAnimationFrame(() => replacement.focus());
  }
  if (!total) {
    if (activeAchievementTooltipTrigger === notificationBadge) hideAchievementTooltip();
    setNotificationMenuOpen(false);
    if (notificationHadFocus) profileAvatarButton.focus();
  }
}

function updateSignalUnread(messages = signalMessages) {
  signalUnreadCount = unreadSignalMessages(messages).length;
  renderNotificationBadges();
}

async function markSignalMessageIdsRead(messages) {
  const accountId = String(currentSession?.user?.id || "");
  const accountHandle = cleanUsername(currentProfile?.handle);
  const identity = signalIdentity || await initializeSignalIdentity();
  assertSignalOperationAccount(accountId);
  const messageIds = (messages || []).flatMap((message) => [message.id, message.envelopeId, ...(message.envelopeIds || [])]).filter(Boolean);
  return signalCore.markSignalMessagesRead({
    accountHandle,
    accountId,
    displayName: accountHandle,
    messageIds,
    signalContactCode: identity.contactCode,
  });
}

async function migrateLegacySignalReadState(messages) {
  const seenAt = legacySeenSignalTime();
  if (!seenAt) return messages || [];
  const toMark = (messages || []).filter((message) => (
    signalMessageDirection(message) !== "outbox" && message.unread && messageTimestamp(message) <= seenAt
  ));
  let saved = messages || [];
  if (toMark.length) {
    try {
      saved = await markSignalMessageIdsRead(toMark);
    } catch {
      return messages || [];
    }
  }
  try {
    window.localStorage.removeItem(signalSeenStorageKey());
  } catch {
    // The encrypted message log remains authoritative if localStorage is unavailable.
  }
  return saved;
}

async function markSignalThreadRead(conversationKey, messages = signalMessages) {
  const target = String(conversationKey || "");
  if (!target) return messages || [];
  const toMark = (messages || []).filter((message) => (
    signalMessageDirection(message) !== "outbox" && message.unread && signalConversationIdentity(message).key === target
  ));
  if (!toMark.length) return messages || [];
  try {
    return await markSignalMessageIdsRead(toMark);
  } catch {
    showToast("This thread opened, but its unread marker could not be saved yet.");
    return messages || [];
  }
}

function shortAddress(address) {
  return address ? `${address.slice(0, 4)}…${address.slice(-4)}` : "not connected";
}

function preferredScrollBehavior() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function storedView() {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) || "board";
  } catch {
    return "board";
  }
}

function normalizeHttpsImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function normalizeClayCollectProfileId(value) {
  const raw = String(value || "").trim();
  if (CLAY_COLLECT_UUID_PATTERN.test(raw)) return raw.toLowerCase();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.origin !== CLAY_COLLECT_ORIGIN || url.username || url.password || url.hash) return null;
    const profileMatch = url.pathname.match(/^\/profile\/([0-9a-f-]{36})\/?$/i);
    if (profileMatch && CLAY_COLLECT_UUID_PATTERN.test(profileMatch[1])) {
      return profileMatch[1].toLowerCase();
    }
    const achievementMatch = url.pathname.match(/^\/achievements-api\/users\/([0-9a-f-]{36})\/achievements\/?$/i);
    if (achievementMatch && CLAY_COLLECT_UUID_PATTERN.test(achievementMatch[1])) {
      return achievementMatch[1].toLowerCase();
    }
    return null;
  } catch {
    return null;
  }
}

function clayCollectProfileUrl(value) {
  const profileId = normalizeClayCollectProfileId(value?.collect_profile_id ?? value);
  return profileId ? `${CLAY_COLLECT_ORIGIN}/profile/${profileId}?tab=profile` : "";
}

function clayCollectProfileLink(profile, label = "Collect · self-attested ↗") {
  const href = clayCollectProfileUrl(profile);
  if (!href) return null;
  const walletMatched = Boolean(profile?.collect_wallet_matched_at && profile?.collect_achievements_synced_at);
  const link = document.createElement("a");
  link.className = "collect-profile-chip";
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer nofollow";
  link.textContent = label === "Collect · self-attested ↗" && walletMatched ? "Collect · wallet match ↗" : label;
  link.title = walletMatched
    ? "Collect profile matched to the signed Solana wallet during the last user-triggered SYNC · unofficial"
    : "Self-attested Collect profile · not wallet matched yet · unofficial";
  link.setAttribute("aria-label", `Open @${cleanUsername(profile?.handle) || "holder"}'s ${walletMatched ? "wallet-matched" : "self-attested"} Collect profile in a new tab`);
  return link;
}

function clayAchievementChip(profile, { showcase = false } = {}) {
  const count = Number(profile?.collect_achievement_count || 0);
  if (!profile?.user_id || count < 1 || !profile?.collect_achievements_synced_at || !profile?.collect_wallet_matched_at) return null;
  const button = document.createElement("button");
  button.className = "achievement-chip";
  button.type = "button";
  button.dataset.achievementsUser = profile.user_id;
  if (showcase) {
    button.classList.add("achievement-chip-showcase");
    button.dataset.achievementTone = count >= 250 ? "coral" : count >= 100 ? "lavender" : count >= 25 ? "sky" : "mint";
    button.dataset.achievementTooltip = "cabinet";
    const syncedAge = relativeTime(profile.collect_achievements_synced_at);
    button.dataset.tooltip = `Wallet-matched cabinet · ${count} synced achievement${count === 1 ? "" : "s"} · refreshed ${syncedAge === "now" ? "just now" : `${syncedAge} ago`} · unofficial`;
    const mark = document.createElement("span");
    mark.className = "achievement-chip-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "★";
    const copy = document.createElement("span");
    copy.className = "achievement-chip-copy";
    const value = document.createElement("span");
    value.className = "achievement-chip-value";
    const total = document.createElement("strong");
    total.textContent = String(count);
    const unit = document.createElement("small");
    unit.textContent = `achievement${count === 1 ? "" : "s"}`;
    value.append(total, unit);
    copy.append(value);
    const arrow = document.createElement("span");
    arrow.className = "achievement-chip-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    button.append(mark, copy, arrow);
  } else {
    button.textContent = `★ ${count} achievement${count === 1 ? "" : "s"}`;
    button.dataset.achievementTooltip = "cabinet";
    const syncedAge = relativeTime(profile.collect_achievements_synced_at);
    button.dataset.tooltip = `Wallet-matched cabinet · ${count} synced achievement${count === 1 ? "" : "s"} · refreshed ${syncedAge === "now" ? "just now" : `${syncedAge} ago`} · unofficial`;
  }
  button.setAttribute("aria-label", `Open @${cleanUsername(profile.handle) || "holder"}'s wallet-matched cabinet with ${count} synced achievement${count === 1 ? "" : "s"}, last synced ${relativeTime(profile.collect_achievements_synced_at)} ago`);
  return button;
}

function featuredAchievementTone(value) {
  const tones = ["mint", "sky", "lavender", "coral", "dune"];
  const source = String(value || "featured");
  let hash = 0;
  for (const character of source) hash = ((hash << 5) - hash + character.codePointAt(0)) | 0;
  return tones[Math.abs(hash) % tones.length];
}

function featuredClayAchievement(profile) {
  const achievementId = String(profile?.featured_achievement_id || "").trim();
  const name = String(profile?.featured_achievement_name || "").trim();
  if (!achievementId || !name || !profile?.collect_achievements_synced_at || !profile?.collect_wallet_matched_at) return null;
  return {
    achievementId,
    iconUrl: normalizeClayCollectIconUrl(profile.featured_achievement_icon_url),
    name,
    rarity: String(profile.featured_achievement_rarity || "").trim(),
    title: String(profile.featured_achievement_title || "").trim(),
  };
}

function featuredAchievementBadge(profile, { compact = false } = {}) {
  const achievement = featuredClayAchievement(profile);
  if (!achievement || !profile?.user_id) return null;
  const button = document.createElement("button");
  button.className = "featured-achievement-badge";
  button.type = "button";
  button.dataset.achievementTone = featuredAchievementTone(achievement.achievementId);
  button.dataset.achievementsUser = profile.user_id;
  if (compact) button.classList.add("is-compact");

  const mark = document.createElement("span");
  mark.className = "featured-achievement-mark";
  mark.setAttribute("aria-hidden", "true");
  if (achievement.iconUrl) {
    const image = document.createElement("img");
    image.src = achievement.iconUrl;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      image.remove();
      mark.textContent = "★";
    }, { once: true });
    mark.append(image);
  } else {
    mark.textContent = "★";
  }

  const copy = document.createElement("span");
  copy.className = "featured-achievement-copy";
  const label = document.createElement("small");
  label.textContent = compact ? "featured" : "featured achievement";
  const name = document.createElement("strong");
  name.textContent = achievement.name;
  copy.append(label, name);
  if (!compact && (achievement.title || achievement.rarity)) {
    const detail = document.createElement("span");
    detail.textContent = [achievement.title, achievement.rarity].filter(Boolean).join(" · ");
    copy.append(detail);
  }
  button.append(mark, copy);
  button.dataset.achievementTooltip = "featured";
  button.dataset.tooltip = `${achievement.name}${achievement.rarity ? ` · ${achievement.rarity}` : ""} · featured from @${cleanUsername(profile.handle) || "holder"}'s latest wallet-matched SYNC`;
  button.setAttribute("aria-label", `${achievement.name}, @${cleanUsername(profile.handle) || "holder"}'s featured achievement. Open the synced cabinet.`);
  return button;
}

function renderFeaturedAchievementSlot(slot, profile, options) {
  if (!slot) return;
  const badge = featuredAchievementBadge(profile, options);
  slot.replaceChildren(...(badge ? [badge] : []));
  slot.hidden = !badge;
}

function renderFeaturedAchievementPicker({ loading = false, error = "" } = {}) {
  if (!featuredAchievementPicker || !featuredAchievementOptions || !featuredAchievementStatus) return;
  const selectable = Boolean(
    currentProfile?.user_id
      && currentProfile?.collect_wallet_matched_at
      && currentProfile?.collect_achievements_synced_at
      && Number(currentProfile?.collect_achievement_count || 0) > 0,
  );
  featuredAchievementPicker.hidden = !selectable;
  featuredAchievementOptions.replaceChildren();
  if (!selectable) return;

  if (loading) {
    featuredAchievementStatus.textContent = "Opening achievements from your latest successful wallet-matched SYNC…";
    const pending = document.createElement("p");
    pending.className = "featured-achievement-empty";
    pending.textContent = "Loading your earned achievement choices…";
    featuredAchievementOptions.append(pending);
    return;
  }
  if (error) {
    featuredAchievementStatus.textContent = error;
    return;
  }

  featuredAchievementStatus.textContent = "Choose one from your latest successful wallet-matched SYNC. It will appear beneath your username on your profile and posts.";
  const selectedId = String(currentProfile?.featured_achievement_id || "");
  const knownSelection = ownSyncedAchievements.some((achievement) => achievement.achievement_id === selectedId);

  const noneLabel = document.createElement("label");
  noneLabel.className = "featured-achievement-choice is-none";
  const noneInput = document.createElement("input");
  noneInput.type = "radio";
  noneInput.name = "featuredAchievement";
  noneInput.value = "";
  noneInput.checked = !knownSelection;
  const noneMark = document.createElement("span");
  noneMark.className = "featured-achievement-choice-mark";
  noneMark.textContent = "○";
  const noneCopy = document.createElement("span");
  const noneName = document.createElement("b");
  noneName.textContent = "No featured badge";
  const noneDetail = document.createElement("small");
  noneDetail.textContent = "Keep the cabinet synced without pinning one achievement.";
  noneCopy.append(noneName, noneDetail);
  noneLabel.append(noneInput, noneMark, noneCopy);
  featuredAchievementOptions.append(noneLabel);

  for (const achievement of ownSyncedAchievements) {
    const label = document.createElement("label");
    label.className = "featured-achievement-choice";
    label.dataset.achievementTone = featuredAchievementTone(achievement.achievement_id);
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "featuredAchievement";
    input.value = achievement.achievement_id;
    input.checked = achievement.achievement_id === selectedId;
    const mark = document.createElement("span");
    mark.className = "featured-achievement-choice-mark";
    const icon = normalizeClayCollectIconUrl(achievement.icon_url);
    if (icon) {
      const image = document.createElement("img");
      image.src = icon;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => {
        image.remove();
        mark.textContent = "★";
      }, { once: true });
      mark.append(image);
    } else {
      mark.textContent = "★";
    }
    const copy = document.createElement("span");
    const name = document.createElement("b");
    name.textContent = achievement.name || "Unnamed achievement";
    const detail = document.createElement("small");
    detail.textContent = [achievement.title, achievement.rarity].filter(Boolean).join(" · ") || "earned achievement";
    copy.append(name, detail);
    label.append(input, mark, copy);
    featuredAchievementOptions.append(label);
  }

  if (!ownSyncedAchievements.length) {
    featuredAchievementStatus.textContent = "The successful SYNC did not return an earned achievement choice. Run SYNC again to refresh the cabinet.";
  }
}

async function loadOwnSyncedAchievements() {
  const requestId = ++featuredAchievementRequestId;
  ownSyncedAchievements = [];
  featuredAchievementChoicesReady = false;
  const selectable = Boolean(
    currentProfile?.user_id
      && currentProfile?.collect_wallet_matched_at
      && currentProfile?.collect_achievements_synced_at
      && Number(currentProfile?.collect_achievement_count || 0) > 0,
  );
  if (!selectable) {
    renderFeaturedAchievementPicker();
    return;
  }
  renderFeaturedAchievementPicker({ loading: true });
  const { data, error } = await db.from("clay_collect_achievements")
    .select("achievement_id,name,title,rarity,icon_url,claimed_at")
    .eq("user_id", currentProfile.user_id)
    .order("claimed_at", { ascending: false })
    .limit(500);
  if (requestId !== featuredAchievementRequestId) return;
  if (error) {
    renderFeaturedAchievementPicker({ error: error.message || "Your synced achievement choices could not be loaded." });
    return;
  }
  ownSyncedAchievements = data || [];
  featuredAchievementChoicesReady = true;
  renderFeaturedAchievementPicker();
}

function renderProfileAchievementShowcase(slot, profile) {
  if (!slot) return;
  const achievements = clayAchievementChip(profile, { showcase: true });
  slot.replaceChildren(...(achievements ? [achievements] : []));
  slot.hidden = !achievements;
}

function renderClayCollectLinkSlot(slot, profile, label) {
  if (!slot) return;
  const link = clayCollectProfileLink(profile, label);
  slot.replaceChildren(...(link ? [link] : []));
  slot.hidden = !link;
}

function renderClayCollectSlot(slot, profile, label) {
  if (!slot) return;
  const link = clayCollectProfileLink(profile, label);
  const achievements = clayAchievementChip(profile);
  slot.replaceChildren(...[link, achievements].filter(Boolean));
  slot.hidden = !link && !achievements;
}

function normalizeClayCollectIconUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 2048) return "";
  try {
    const url = new URL(raw);
    const allowedHosts = new Set([
      "storage.claynosaurz.com",
      "claynosaurz-storage.fra1.cdn.digitaloceanspaces.com",
    ]);
    if (url.protocol !== "https:" || url.username || url.password || !allowedHosts.has(url.hostname)) return "";
    return url.href;
  } catch {
    return "";
  }
}

function setRemoteBackground(element, property, value) {
  if (!element) return false;
  const url = normalizeHttpsImageUrl(value);
  if (!url) {
    element.style.removeProperty(property);
    return false;
  }
  element.style.setProperty(property, `url(${JSON.stringify(url)})`);
  return true;
}

function savedCustomBackgroundUrl(profile, target) {
  const key = target === "post" ? "custom_post_background_url" : "custom_profile_background_url";
  if (profile && Object.prototype.hasOwnProperty.call(profile, key)) {
    return normalizeHttpsImageUrl(profile[key]) || "";
  }
  return normalizeHttpsImageUrl(profile?.custom_background_url) || "";
}

function snapshottedPostBackgroundUrl(post, author) {
  if (post && Object.prototype.hasOwnProperty.call(post, "custom_background_url")) {
    return normalizeHttpsImageUrl(post.custom_background_url) || "";
  }
  return savedCustomBackgroundUrl(author, "post");
}

function setCustomBackgroundEditorTarget(target = "profile") {
  const selectedTarget = target === "post" ? "post" : "profile";
  const targetInput = profileForm.querySelector(`input[name="customBackgroundTarget"][value="${selectedTarget}"]`);
  if (targetInput) targetInput.checked = true;
  for (const panel of customBackgroundPanels) {
    const isSelected = panel.dataset.customBackgroundPanel === selectedTarget;
    panel.hidden = !isSelected;
    const input = panel.querySelector("input");
    if (input) input.disabled = !isSelected;
  }
}

function renderCustomBackgroundPreviews() {
  const profileUrl = profileForm.elements.customProfileBackgroundUrl.value;
  const postUrl = profileForm.elements.customPostBackgroundUrl.value;
  setRemoteBackground(customProfileBackgroundPreview, "--custom-background-image", profileUrl);
  setRemoteBackground(customProfileBackgroundSample, "--custom-profile-preview-image", profileUrl);
  setRemoteBackground(customPostBackgroundSample, "--custom-post-preview-image", postUrl);
}

function identityProvider(identity) {
  return String(identity?.provider || "").toLowerCase();
}

function setAuthEntryStatus(message, { error = false } = {}) {
  if (!authEntryStatus) return;
  authEntryStatus.textContent = String(message || "");
  authEntryStatus.style.color = error ? "#9f3228" : "";
  authEntryStatus.style.fontWeight = error ? "750" : "";
  setStatusSemantics(authEntryStatus, error);
}

function setProvisionalPreviewStatus(message, { error = false } = {}) {
  if (!provisionalPreviewStatus) return;
  provisionalPreviewStatus.textContent = String(message || "");
  provisionalPreviewStatus.classList.toggle("is-error", error);
  setStatusSemantics(provisionalPreviewStatus, error);
}

function sessionEntryMethod(session) {
  const identities = Array.isArray(session?.user?.identities) ? session.user.identities : [];
  if (identities.some((identity) => identityProvider(identity) === "apple")) return "Sign in with Apple";
  if (session?.user?.email || identities.some((identity) => identityProvider(identity) === "email")) return "Passwordless email";
  return "Private sign-in";
}

function normalizeAccessMode(value) {
  const mode = String(value || "").trim().toLowerCase().replace(/_/g, "-");
  if (mode === "read-only-solana" || mode === "read-only") return "read-only-solana";
  if (mode === "verified-solana" || mode === "signed-solana" || mode === "holder") return "verified-solana";
  return "";
}

function isReadOnlyAccess(profile = currentProfile) {
  return normalizeAccessMode(profile?.membership_mode || accessMode) === "read-only-solana";
}

function applyAccessCapabilities(result = {}) {
  const owns = (key) => Object.prototype.hasOwnProperty.call(result, key);
  const firstOwnValue = (keys) => {
    const key = keys.find((candidate) => owns(candidate));
    return key ? result[key] : undefined;
  };
  const signedValue = firstOwnValue(["signedSolanaAddress", "signed_solana_address"]);
  const readOnlyValue = firstOwnValue([
    "readOnlySolanaAddress",
    "read_only_solana_address",
    "readOnlyWalletAddress",
    "readOnlyAddress",
  ]);
  const modeValue = firstOwnValue(["accessMode", "membershipMode", "membership_mode"]);
  const signedActiveValue = firstOwnValue(["signedSolanaActive", "signed_solana_active", "verified"]);

  if (signedValue !== undefined) {
    const candidate = String(signedValue || "").trim();
    signedSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(candidate) ? candidate : "";
  }
  if (readOnlyValue !== undefined) {
    const candidate = String(readOnlyValue || "").trim();
    readOnlySolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(candidate) ? candidate : "";
  }
  if (modeValue !== undefined) accessMode = normalizeAccessMode(modeValue);
  if (typeof signedActiveValue === "boolean") signedSolanaHolderReady = signedActiveValue;
  walletAddress = signedSolanaAddress;
  const hasCanPost = typeof result.canPost === "boolean" || typeof result.can_post === "boolean";
  const hasCanDm = typeof result.canDm === "boolean" || typeof result.can_dm === "boolean";
  holderSessionReady = hasCanPost
    ? result.canPost === true || result.can_post === true
    : holderSessionReady;
  dmAccessReady = hasCanDm
    ? result.canDm === true || result.can_dm === true
    : dmAccessReady;
  renderAccessControls();
}

async function clearClaymatchingSessionCookie() {
  try {
    await fetch("/api/claymatching/session", {
      method: "DELETE",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch {
    // Local capability state is still cleared below when the network is unavailable.
  }
}

async function refreshAuthoritativeAccess({ maxAgeMs = 0, requireDm = false } = {}) {
  if (!currentSession?.user) {
    if (requireDm) throw new Error("Sign in again before opening private Signals.");
    return false;
  }
  const expectedUserId = String(currentSession.user.id || "");
  if (!expectedUserId) {
    if (requireDm) throw new Error("Sign in again before opening private Signals.");
    return false;
  }
  if (maxAgeMs > 0 && Date.now() - lastAccessRefreshAt <= maxAgeMs) {
    if (requireDm && !dmAccessReady) throw new Error("A signed Solana or Sui wallet is required for private Signals.");
    return holderSessionReady;
  }

  accessRefreshPromise ||= (async () => {
    const response = await fetch("/api/claymatching/session", {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const body = await response.json().catch(() => ({}));
    if (String(currentSession?.user?.id || "") !== expectedUserId) {
      throw new Error("Your signed-in account changed. Claymatching is reopening the correct account.");
    }
    if (response.ok && String(body.userId || "") !== expectedUserId) {
      await clearClaymatchingSessionCookie();
      if (String(currentSession?.user?.id || "") === expectedUserId) {
        applyAccessCapabilities({
          canDm: false,
          canPost: false,
          membershipMode: null,
          readOnlySolanaAddress: null,
          signedSolanaAddress: null,
          verified: false,
        });
        holderCsrfToken = "";
        showProvisionalOnboarding(currentSession);
        showToast("Your saved Claymatching session belonged to another account and was safely cleared.");
      }
      return false;
    }
    if (!response.ok) {
      if ([401, 403].includes(response.status)) {
        applyAccessCapabilities({
          canDm: false,
          canPost: false,
          membershipMode: null,
          readOnlySolanaAddress: null,
          signedSolanaAddress: null,
          verified: false,
        });
        holderCsrfToken = "";
        showProvisionalOnboarding(currentSession);
        showToast(body.error || "Community access needs a fresh eligibility check.");
        return false;
      }
      throw new Error(body.error || "Live Claymatching access could not be checked.");
    }
    applyAccessCapabilities(body);
    holderCsrfToken = String(body.csrfToken || holderCsrfToken || "");
    lastAccessRefreshAt = Date.now();
    return holderSessionReady;
  })().finally(() => {
    accessRefreshPromise = undefined;
  });

  let ready;
  try {
    ready = await accessRefreshPromise;
  } catch (error) {
    if (requireDm) throw error;
    return false;
  }
  if (requireDm && (!ready || !dmAccessReady)) {
    throw new Error("A currently signed Solana or Sui wallet is required for private Signals.");
  }
  return ready;
}

async function rebindAuthenticatedSession(session, expectedUserId) {
  if (!session?.user || authRebindUserId !== expectedUserId) return;
  await clearClaymatchingSessionCookie();
  if (authRebindUserId !== expectedUserId || String(currentSession?.user?.id || "") !== expectedUserId) return;
  try {
    await restoreSession(session);
  } catch (error) {
    if (authRebindUserId !== expectedUserId || String(currentSession?.user?.id || "") !== expectedUserId) return;
    showProvisionalOnboarding(session);
    showToast(error?.message || "The newly selected account needs a fresh eligibility check.");
  } finally {
    if (authRebindUserId === expectedUserId) authRebindUserId = "";
  }
}

function queueAuthenticatedSessionRebind(session) {
  const expectedUserId = String(session?.user?.id || "");
  if (!expectedUserId) return;
  authRebindUserId = expectedUserId;
  resetApp();
  currentSession = session;
  window.setTimeout(() => {
    rebindAuthenticatedSession(session, expectedUserId).catch(() => {});
  }, 0);
}

function renderAccessControls() {
  const readOnly = isReadOnlyAccess();
  const signalFocusWasVisible = Boolean(
    document.querySelector('[data-view="signals"]')?.contains(document.activeElement)
      || dmDialog.contains(document.activeElement),
  );
  const signalsTab = document.querySelector('[data-view-button="signals"]');
  if (signalsTab) {
    signalsTab.classList.toggle("is-locked", holderSessionReady && !dmAccessReady);
    signalsTab.title = holderSessionReady && !dmAccessReady
      ? "Sign with a Solana or Sui wallet to unlock private Signals."
      : "";
    signalsTab.setAttribute("aria-label", holderSessionReady && !dmAccessReady
      ? "Signals locked; connect and sign with a Solana or Sui wallet"
      : "Signals");
  }
  document.querySelectorAll("[data-compose-signal], [data-open-signals]").forEach((button) => {
    button.disabled = holderSessionReady && !dmAccessReady;
    button.title = button.disabled ? "A signed Solana or Sui wallet is required for private Signals." : "";
  });
  if (signalsLock) signalsLock.hidden = !holderSessionReady || dmAccessReady;
  if (signalsIntro && holderSessionReady && !dmAccessReady) {
    signalsIntro.hidden = true;
  } else if (signalsIntro && dmAccessReady) {
    const hasConversations = signalMessages.length > 0;
    signalsIntro.hidden = hasConversations;
    if (signalInbox) signalInbox.hidden = !hasConversations;
  }
  if (!dmAccessReady) {
    signalUnreadCount = 0;
    signalProfileByFingerprint = new Map();
    ambiguousSignalFingerprints = new Set();
    ownSignalFingerprints = new Set();
    signalIdentity = undefined;
    ownSignalDevices = [];
    signalIdentityPromise = undefined;
    signalIdentityAccountId = "";
    signalMessages = [];
    currentDmTarget = undefined;
    currentDmDevices = [];
    signalInbox.hidden = true;
    signalInboxList.replaceChildren();
    signalDirectory.hidden = true;
    signalRecipients.replaceChildren();
    setDmComposerReady(false);
    dmThread.replaceChildren();
    if (dmDialog.open) dmDialog.close();
    if (signalFocusWasVisible && holderSessionReady) {
      window.requestAnimationFrame(() => signalsLock?.querySelector("button")?.focus());
    }
    renderNotificationBadges();
  }
  if (profileAccessBadge) profileAccessBadge.hidden = !readOnly;
}

function bytesToBase64(value) {
  let bytes;
  if (value instanceof Uint8Array) bytes = value;
  else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
  else if (ArrayBuffer.isView(value)) bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  else if (Array.isArray(value)) bytes = new Uint8Array(value);
  else return "";
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return window.btoa(binary);
}

function setHolderNavigationLocked(locked) {
  document.body.classList.toggle("holder-navigation-locked", Boolean(locked));
  document.querySelectorAll("[data-view-button]").forEach((button) => {
    button.disabled = Boolean(locked);
    button.setAttribute("aria-disabled", String(Boolean(locked)));
  });
}

function setMudprintStatus(message, { error = false } = {}) {
  if (!mudprintLinkStatus) return;
  mudprintLinkStatus.textContent = String(message || "");
  mudprintLinkStatus.style.color = error ? "#9f3228" : "";
  mudprintLinkStatus.style.fontWeight = error ? "750" : "";
  setStatusSemantics(mudprintLinkStatus, error);
}

function setCollectProfileStatus(message, { error = false } = {}) {
  if (!collectProfileStatus) return;
  collectProfileStatus.textContent = String(message || "");
  collectProfileStatus.classList.toggle("is-error", error);
  setStatusSemantics(collectProfileStatus, error);
}

function authRedirectUrl(intent) {
  try {
    window.localStorage.setItem(AUTH_RETURN_STORAGE_KEY, intent);
  } catch {
    // The exact production root still works when storage is unavailable.
  }
  return `${window.location.origin}/`;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = String(message || "Something went squishy.");
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 4600);
}

function positionAchievementTooltip() {
  if (!achievementTooltip || !activeAchievementTooltipTrigger?.isConnected || achievementTooltip.hidden) return;
  const triggerRect = activeAchievementTooltipTrigger.getBoundingClientRect();
  const tooltipRect = achievementTooltip.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportLeft = viewport?.offsetLeft || 0;
  const viewportTop = viewport?.offsetTop || 0;
  const viewportWidth = viewport?.width || window.innerWidth;
  const viewportHeight = viewport?.height || window.innerHeight;
  const gutter = 12;
  const gap = 10;
  const minLeft = viewportLeft + gutter;
  const maxLeft = Math.max(minLeft, viewportLeft + viewportWidth - tooltipRect.width - gutter);
  const preferredLeft = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
  const left = Math.min(maxLeft, Math.max(minLeft, preferredLeft));
  const minTop = viewportTop + gutter;
  const maxTop = Math.max(minTop, viewportTop + viewportHeight - tooltipRect.height - gutter);
  const below = triggerRect.bottom + gap;
  const above = triggerRect.top - tooltipRect.height - gap;
  const useTop = below > maxTop && above >= minTop;
  const top = Math.min(maxTop, Math.max(minTop, useTop ? above : below));
  const arrowLeft = Math.min(tooltipRect.width - 14, Math.max(14, (triggerRect.left + (triggerRect.width / 2)) - left));
  achievementTooltip.dataset.placement = useTop ? "top" : "bottom";
  achievementTooltip.style.left = `${Math.round(left)}px`;
  achievementTooltip.style.top = `${Math.round(top)}px`;
  achievementTooltip.style.setProperty("--tooltip-arrow-left", `${Math.round(arrowLeft)}px`);
}

function showAchievementTooltip(trigger) {
  if (!achievementTooltip || !trigger?.dataset.tooltip) return;
  if (activeAchievementTooltipTrigger && activeAchievementTooltipTrigger !== trigger) {
    activeAchievementTooltipTrigger.removeAttribute("aria-describedby");
  }
  activeAchievementTooltipTrigger = trigger;
  achievementTooltip.textContent = trigger.dataset.tooltip;
  trigger.setAttribute("aria-describedby", achievementTooltip.id);
  achievementTooltip.style.visibility = "hidden";
  achievementTooltip.hidden = false;
  if (typeof achievementTooltip.showPopover === "function" && !achievementTooltip.matches(":popover-open")) {
    achievementTooltip.showPopover();
  }
  positionAchievementTooltip();
  achievementTooltip.style.visibility = "";
}

function hideAchievementTooltip() {
  window.cancelAnimationFrame(achievementTooltipFrame);
  achievementTooltipFrame = undefined;
  activeAchievementTooltipTrigger?.removeAttribute("aria-describedby");
  activeAchievementTooltipTrigger = undefined;
  if (achievementTooltip) {
    if (typeof achievementTooltip.hidePopover === "function" && achievementTooltip.matches(":popover-open")) {
      achievementTooltip.hidePopover();
    }
    achievementTooltip.hidden = true;
  }
}

function scheduleAchievementTooltipPosition() {
  if (!activeAchievementTooltipTrigger || achievementTooltip?.hidden || achievementTooltipFrame) return;
  achievementTooltipFrame = window.requestAnimationFrame(() => {
    achievementTooltipFrame = undefined;
    positionAchievementTooltip();
  });
}

function setBusy(button, busy, label = "working…") {
  if (!button) return;
  if (busy) {
    if (!Object.prototype.hasOwnProperty.call(button.dataset, "previousLabel")) {
      button.dataset.previousLabel = button.textContent;
    }
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.previousLabel || button.textContent;
    button.disabled = false;
    delete button.dataset.previousLabel;
  }
}

function requestClayAction({
  eyebrow = "one careful tap",
  title = "Are you sure?",
  copy = "Check the details before continuing.",
  confirmLabel = "continue",
  mode = "confirm",
} = {}) {
  if (!actionDialog || actionDialog.open) return Promise.resolve({ confirmed: false, category: "other", detail: "" });
  actionEyebrow.textContent = eyebrow;
  actionTitle.textContent = title;
  actionCopy.textContent = copy;
  actionConfirmButton.textContent = confirmLabel;
  actionCategoryWrap.hidden = mode !== "report";
  actionDetailWrap.hidden = mode !== "report";
  actionCategory.value = "other";
  actionDetail.value = "";
  actionDialog.returnValue = "";
  actionDialogReturnFocus = document.activeElement;
  actionDialog.showModal();
  window.requestAnimationFrame(() => actionCancelButton.focus());
  return new Promise((resolve) => {
    actionDialogResolve = resolve;
  });
}

function setStatusSemantics(element, error = false) {
  if (!element) return;
  element.setAttribute("role", error ? "alert" : "status");
  element.setAttribute("aria-live", error ? "assertive" : "polite");
  element.setAttribute("aria-atomic", "true");
}

function setAppLoading(loading, message = "Loading your mudprint, posts, matches, and Signals.") {
  if (!appLoading) return;
  appShell.classList.toggle("is-loading", Boolean(loading));
  appShell.setAttribute("aria-busy", String(Boolean(loading)));
  appLoading.hidden = !loading;
  const detail = appLoading.querySelector("small");
  if (detail) detail.textContent = message;
}

function renderDataError(container, message) {
  if (!container) return;
  const state = document.createElement("div");
  state.className = "empty-state is-error-state";
  state.setAttribute("role", "alert");
  const copy = document.createElement("span");
  copy.textContent = message;
  const retry = document.createElement("button");
  retry.className = "clay-button clay-button-cream";
  retry.type = "button";
  retry.textContent = "try again";
  retry.addEventListener("click", async () => {
    setBusy(retry, true, "trying again…");
    try {
      await loadAppData();
    } catch (error) {
      showToast(error?.message || "Community data still could not load.");
      setBusy(retry, false);
    }
  });
  state.append(copy, retry);
  container.replaceChildren(state);
}

async function signInWithPasskey() {
  if (!db?.auth?.signInWithPasskey) {
    setAuthEntryStatus("Passkeys are not available in this browser yet.", { error: true });
    return;
  }
  passkeySigninButton.disabled = true;
  setAuthEntryStatus("Ask this device for your Claymatching passkey…");
  try {
    const { data, error } = await db.auth.signInWithPasskey();
    if (error) throw error;
    if (!data?.session) throw new Error("The passkey did not return a session.");
    await restoreSession(data.session);
    setAuthEntryStatus("Passkey accepted. Welcome back to the mud.");
  } catch (error) {
    if (currentSession && !holderSessionReady) {
      await db.auth.signOut({ scope: "local" }).catch(() => {});
      resetApp();
    }
    setAuthEntryStatus(error?.message || "Passkey sign-in did not finish.", { error: true });
  } finally {
    passkeySigninButton.disabled = false;
  }
}

async function signInWithApple() {
  if (appleAuthEnabled === false) {
    setAuthEntryStatus("Apple sign-in is waiting for its Apple Developer credentials.", { error: true });
    return;
  }
  appleSigninButton.disabled = true;
  setAuthEntryStatus("Opening Apple’s private sign-in…");
  const { error } = await db.auth.signInWithOAuth({
    provider: "apple",
    options: { redirectTo: authRedirectUrl("apple-signin") },
  });
  if (error) {
    appleSigninButton.disabled = false;
    setAuthEntryStatus(error.message || "Apple sign-in is not configured yet.", { error: true });
  }
}

function setEmailTurnstileStatus(message, { error = false } = {}) {
  emailTurnstileStatus.textContent = message;
  emailTurnstileStatus.classList.toggle("is-error", error);
}

async function waitForTurnstile(timeoutMs = 10_000) {
  const startedAt = Date.now();
  while (!window.turnstile && Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  return Boolean(window.turnstile);
}

async function renderEmailTurnstile() {
  if (!emailTurnstileHost || emailTurnstileWidgetId !== undefined) return;
  if (!emailTurnstileRenderPromise) {
    emailTurnstileRenderPromise = createEmailTurnstile().finally(() => {
      emailTurnstileRenderPromise = undefined;
    });
  }
  return emailTurnstileRenderPromise;
}

async function createEmailTurnstile() {
  if (!await waitForTurnstile()) {
    setEmailTurnstileStatus("The human check did not load. Check content blockers and refresh.", { error: true });
    return;
  }

  try {
    emailTurnstileWidgetId = window.turnstile.render(emailTurnstileHost, {
      sitekey: TURNSTILE_SITE_KEY,
      action: "email_otp",
      execution: "render",
      appearance: "always",
      size: "compact",
      theme: "light",
      "response-field": false,
      callback(token) {
        emailCaptchaToken = token;
        setEmailTurnstileStatus("Human check ready ✓");
      },
      "expired-callback"() {
        emailCaptchaToken = "";
        setEmailTurnstileStatus("The human check expired and is refreshing…");
      },
      "timeout-callback"() {
        emailCaptchaToken = "";
        setEmailTurnstileStatus("The human check timed out. Complete the refreshed check.", { error: true });
      },
      "before-interactive-callback"() {
        setEmailTurnstileStatus("Cloudflare needs one quick check below.");
      },
      "unsupported-callback"() {
        emailCaptchaToken = "";
        setEmailTurnstileStatus("This browser cannot run the human check. Try a current browser without strict content blocking.", { error: true });
      },
      "error-callback"(errorCode) {
        emailCaptchaToken = "";
        const safeCode = String(errorCode || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
        const codeHint = safeCode ? ` (${safeCode})` : "";
        setEmailTurnstileStatus(`The human check could not finish${codeHint}. Refresh and try again.`, { error: true });
      },
    });
  } catch {
    emailTurnstileWidgetId = undefined;
    setEmailTurnstileStatus("The human check could not start. Refresh and try again.", { error: true });
  }
}

function readEmailCaptchaToken() {
  if (emailCaptchaToken) return emailCaptchaToken;
  if (!window.turnstile || emailTurnstileWidgetId === undefined) return "";
  try {
    emailCaptchaToken = window.turnstile.getResponse(emailTurnstileWidgetId) || "";
  } catch {
    emailCaptchaToken = "";
  }
  return emailCaptchaToken;
}

function resetEmailTurnstile() {
  emailCaptchaToken = "";
  setEmailTurnstileStatus("Refreshing the human check…");
  if (!window.turnstile || emailTurnstileWidgetId === undefined) {
    renderEmailTurnstile();
    return;
  }
  try {
    window.turnstile.reset(emailTurnstileWidgetId);
  } catch {
    emailTurnstileWidgetId = undefined;
    emailTurnstileHost.replaceChildren();
    renderEmailTurnstile();
  }
}

async function requestEmailCode(event) {
  event.preventDefault();
  if (!emailSigninForm.reportValidity()) return;
  if (!db) {
    setAuthEntryStatus("Account service did not load. Refresh before requesting a code.", { error: true });
    return;
  }
  await renderEmailTurnstile();
  const captchaProof = readEmailCaptchaToken();
  if (!captchaProof) {
    setAuthEntryStatus("Complete the visible human check, then request the email code again.", { error: true });
    return;
  }
  const email = emailSigninForm.elements.email.value.trim().toLowerCase();
  const submitButton = emailSigninForm.querySelector('button[type="submit"]');
  setBusy(submitButton, true, "sending code…");
  setAuthEntryStatus("Sending a private one-time sign-in code…");
  let error;
  try {
    ({ error } = await db.auth.signInWithOtp({
      email,
      options: {
        captchaToken: captchaProof,
        emailRedirectTo: authRedirectUrl("email-signin"),
        shouldCreateUser: true,
      },
    }));
  } catch (requestError) {
    error = requestError;
  } finally {
    resetEmailTurnstile();
    setBusy(submitButton, false);
  }
  if (error) {
    const providerMessage = readableErrorMessage(error, "That email could not receive a sign-in code.");
    const message = /captcha/i.test(providerMessage)
      ? "The human check expired before Supabase accepted it. Complete the refreshed check and try again."
      : providerMessage;
    setAuthEntryStatus(message, { error: true });
    return;
  }
  showEmailCodeEntry(email);
  setAuthEntryStatus("Your six-digit code is on the way. After sign-in, choose eligible read-only Solana for posting or verify a wallet for Signals.");
}

async function verifyEmailCode() {
  const email = pendingEmailSignIn || emailSigninForm.elements.email.value.trim().toLowerCase();
  const token = cleanOtp(emailSigninForm.elements.otp.value);
  emailSigninForm.elements.otp.value = token;
  if (!email || token.length !== 6) {
    setAuthEntryStatus("Enter the complete six-digit code from your email.", { error: true });
    emailSigninForm.elements.otp.focus();
    return;
  }
  setBusy(verifyEmailCodeButton, true, "checking code…");
  setAuthEntryStatus("Checking that one-time code…");
  try {
    const { data, error } = await db.auth.verifyOtp({ email, token, type: "email" });
    if (error) throw error;
    const session = data?.session || (await db.auth.getSession()).data?.session;
    if (!session) throw new Error("The code was accepted, but no account session was returned. Request a fresh code.");
    clearEmailCodeEntry();
    setAuthEntryStatus("Code accepted. Opening your Claymatching sign-in…");
    await restoreSession(session);
    setAuthEntryStatus(holderSessionReady
      ? "Email code accepted. Welcome back to the mud."
      : "Email code accepted. Choose read-only Solana or verify a wallet whenever you are ready.");
  } catch (error) {
    setAuthEntryStatus(error?.message || "That code is invalid or expired. Request a fresh one and try again.", { error: true });
  } finally {
    setBusy(verifyEmailCodeButton, false);
  }
}

function resetEmailCodeEntry() {
  clearEmailCodeEntry();
  emailSigninForm.elements.email.value = "";
  emailSigninForm.elements.email.focus();
  setAuthEntryStatus("Enter a private email to start or restore your sign-in.");
}

function safePreviewAssetImage(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 2048) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}

function resetProvisionalPreview({ preserveInput = false, status = "No assets loaded. Nothing is queried until you paste a public address and press preview." } = {}) {
  provisionalPreviewRequestId += 1;
  provisionalPreviewPending = false;
  provisionalPreviewAddress = "";
  provisionalPreviewAssets = [];
  provisionalAssetGrid?.replaceChildren();
  if (provisionalAssetGrid) provisionalAssetGrid.hidden = true;
  if (provisionalPreviewSummary) provisionalPreviewSummary.hidden = true;
  if (provisionalPreviewWarning) provisionalPreviewWarning.hidden = true;
  if (provisionalReadOnlyCallout) provisionalReadOnlyCallout.hidden = true;
  if (provisionalPreviewCount) provisionalPreviewCount.textContent = "0 Claynos found";
  if (provisionalAddressInput && !preserveInput) provisionalAddressInput.value = "";
  setProvisionalPreviewStatus(status);
}

function renderProvisionalPreviewAssets(assets) {
  provisionalPreviewAssets = (Array.isArray(assets) ? assets : []).filter((asset) => safePreviewAssetImage(asset?.image));
  provisionalAssetGrid.replaceChildren();
  for (const asset of provisionalPreviewAssets) {
    const card = document.createElement("article");
    card.className = "provisional-asset";
    const image = document.createElement("img");
    image.src = safePreviewAssetImage(asset.image);
    image.alt = String(asset?.name || "Read-only Clayno preview").slice(0, 100);
    image.loading = "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    const name = document.createElement("b");
    name.textContent = String(asset?.name || "Owned Clayno").slice(0, 100);
    card.append(image, name);
    provisionalAssetGrid.append(card);
  }

  const count = provisionalPreviewAssets.length;
  provisionalPreviewCount.textContent = `${count} Clayno${count === 1 ? "" : "s"} found`;
  provisionalPreviewSummary.hidden = false;
  provisionalAssetGrid.hidden = count === 0;
  provisionalPreviewWarning.hidden = count === 0;
  provisionalReadOnlyCallout.hidden = count === 0;
  setProvisionalPreviewStatus(count
    ? "Eligible public-chain snapshot found. You may continue read-only for posting, or sign with the wallet for full access."
    : "No eligible Claynos were found at that public address. Nothing was linked to your account.");
}

function renderProvisionalIdentity(session) {
  const method = sessionEntryMethod(session);
  const email = String(session?.user?.email || "").trim();
  provisionalMethod.textContent = method === "Passwordless email"
    ? "Email sign-in ready"
    : method === "Sign in with Apple"
      ? "Apple sign-in ready"
      : `${method} ready`;
  provisionalIdentity.textContent = email
    ? `${email} is available for private sign-in. It is not shown on your public profile.`
    : `${method} is available for private sign-in. It is not shown on a public profile.`;
}

function showProvisionalOnboarding(session) {
  detachWalletAccountListener();
  currentSession = session;
  currentProfile = undefined;
  holderSessionReady = false;
  dmAccessReady = false;
  accessMode = "";
  signedSolanaAddress = "";
  signedSolanaHolderReady = false;
  readOnlySolanaAddress = "";
  holderCsrfToken = "";
  activeProvider = undefined;
  walletAddress = "";
  ownedAssets = [];
  profiles = [];
  posts = [];
  reactions = [];
  squishes = [];
  mutualMatches = [];
  notifications = [];
  lastNotificationAnnouncement = "";
  notificationLive.textContent = "";
  signalMessages = [];
  signalUnreadCount = 0;
  signalProfileByFingerprint = new Map();
  ambiguousSignalFingerprints = new Set();
  ownSignalFingerprints = new Set();
  signalIdentity = undefined;
  linkedSuiConnection = null;
  currentDmTarget = undefined;
  currentDmDevices = [];
  ownSignalDevices = [];
  signalIdentityPromise = undefined;
  signalIdentityAccountId = "";
  signalRefreshPromise = undefined;
  signalRefreshAccountId = "";
  accessRefreshPromise = undefined;
  lastAccessRefreshAt = 0;
  renderNotificationBadges();
  window.clearInterval(notificationRefreshTimer);
  notificationRefreshTimer = undefined;
  for (const dialog of [profileDialog, memberProfileDialog, actionDialog, achievementDialog, dmDialog]) {
    if (dialog.open) dialog.close();
  }
  walletGate.hidden = true;
  appShell.hidden = true;
  provisionalShell.hidden = false;
  renderProvisionalIdentity(session);
  resetProvisionalPreview();
  setHolderNavigationLocked(true);
  renderAccessControls();
  updateWalletHeader();
  handleAuthReturn();
}

async function previewProvisionalSolanaAddress(event) {
  event.preventDefault();
  if (!currentSession || holderSessionReady) return;
  const address = String(provisionalAddressInput.value || "").trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    setProvisionalPreviewStatus("Paste a complete public Solana address (32–44 base58 characters).", { error: true });
    provisionalAddressInput.focus();
    return;
  }

  const requestId = ++provisionalPreviewRequestId;
  provisionalPreviewPending = true;
  provisionalPreviewAddress = "";
  provisionalPreviewAssets = [];
  setBusy(provisionalPreviewSubmit, true, "checking public chain…");
  setProvisionalPreviewStatus("Checking public ownership data. This does not link or verify the address…");
  try {
    const response = await fetch("/api/claymatching/solana/preview", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${currentSession.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address }),
    });
    const body = await response.json().catch(() => ({}));
    if (requestId !== provisionalPreviewRequestId || String(provisionalAddressInput.value || "").trim() !== address) return;
    if (!response.ok) throw new Error(body.error || "That public address could not be previewed.");
    if (body.address !== address || body.verified !== false || body.source !== "public-chain-preview") {
      throw new Error("The preview response could not be matched to that public address.");
    }
    provisionalPreviewAddress = body.address;
    renderProvisionalPreviewAssets(body.assets);
  } catch (error) {
    if (requestId !== provisionalPreviewRequestId || String(provisionalAddressInput.value || "").trim() !== address) return;
    provisionalPreviewAddress = "";
    provisionalPreviewAssets = [];
    provisionalAssetGrid.replaceChildren();
    provisionalAssetGrid.hidden = true;
    provisionalPreviewSummary.hidden = true;
    provisionalPreviewWarning.hidden = true;
    provisionalReadOnlyCallout.hidden = true;
    setProvisionalPreviewStatus(error?.message || "That public address could not be previewed.", { error: true });
  } finally {
    if (requestId === provisionalPreviewRequestId) provisionalPreviewPending = false;
    setBusy(provisionalPreviewSubmit, false);
  }
}

async function activateProvisionalHolder(session) {
  const connectedAddress = String(activeProvider?.publicKey || walletAddress || "");
  if (!activeProvider || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(connectedAddress)) {
    throw new Error("Reconnect the Solana wallet you want to verify.");
  }

  const request = async (path, payload) => {
    const response = await fetch(path, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error || "The holder wallet could not be verified.");
      error.status = response.status;
      throw error;
    }
    return body;
  };

  setConsentStatus("Preparing an exact readable ownership message…");
  const challenge = await request("/api/claymatching/solana/challenge", { address: connectedAddress });
  if (!challenge?.challengeToken || !challenge?.message || challenge.address !== connectedAddress) {
    throw new Error("The wallet challenge was incomplete. Please try again.");
  }

  setConsentStatus("Your wallet will ask you to sign the ownership message—never a transaction.");
  const signed = await activeProvider.signMessage(new TextEncoder().encode(challenge.message), "utf8");
  const signatureBytes = signed?.signature || signed;
  const signature = typeof signatureBytes === "string" ? signatureBytes : bytesToBase64(signatureBytes);
  if (!signature) throw new Error("The wallet did not return a signature.");

  setConsentStatus("Signature received. Checking eligible Claynos and unlocking holder access…");
  const membership = await request("/api/claymatching/solana/link", {
    adultAttested: true,
    captchaToken,
    challengeToken: challenge.challengeToken,
    holderAttested: true,
    lawfulUseAttested: true,
    signature,
  });
  if (membership?.holder !== true || membership?.userId !== session.user.id || membership?.walletAddress !== connectedAddress) {
    throw new Error("Holder verification returned an incomplete account binding. Please retry.");
  }
  return membership;
}

async function startProvisionalWalletActivation(event) {
  if (!currentSession || (holderSessionReady && !isReadOnlyAccess())) return;
  const triggerButton = event?.currentTarget instanceof HTMLButtonElement
    ? event.currentTarget
    : provisionalShell?.hidden
      ? linkSolanaWalletButton
      : provisionalVerifyButton;
  setBusy(triggerButton, true, "opening wallet…");
  try {
    if (!await connectWallet()) return;
    await openConsentDialog({
      activation: true,
      session: currentSession,
      message: "Complete the checks, then your wallet will sign a readable ownership message—not a transaction.",
    });
  } finally {
    setBusy(triggerButton, false);
  }
}

async function activateProvisionalReadOnly(session) {
  const address = String(provisionalPreviewAddress || "").trim();
  const displayedAddress = String(provisionalAddressInput?.value || "").trim();
  if (!session?.access_token
    || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
    || displayedAddress !== address
    || !provisionalPreviewAssets.length) {
    throw new Error("Preview an eligible public Solana address again before continuing read-only.");
  }
  const response = await fetch("/api/claymatching/solana/read-only", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address,
      adultAttested: true,
      captchaToken,
      holderAttested: true,
      lawfulUseAttested: true,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Read-only posting access could not be activated.");
  if (body.canPost !== true || normalizeAccessMode(body.accessMode || body.membershipMode) !== "read-only-solana") {
    throw new Error("The read-only access response was incomplete. Preview the address and try again.");
  }
  return body;
}

async function startProvisionalReadOnlyActivation() {
  if (!currentSession || holderSessionReady || !provisionalPreviewAssets.length || !provisionalPreviewAddress) return;
  await openConsentDialog({
    activationMode: "read-only",
    message: "Complete the house promise, then Claymatching will recheck this public address and unlock posting without asking for a wallet signature.",
    session: currentSession,
  });
}

function renderClayCollectConnection() {
  const profileId = normalizeClayCollectProfileId(currentProfile?.collect_profile_id);
  const linked = Boolean(profileId);
  const synced = Boolean(currentProfile?.collect_achievements_synced_at && currentProfile?.collect_wallet_matched_at);
  const achievementCount = Number(currentProfile?.collect_achievement_count || 0);
  collectProfileInput.value = linked ? clayCollectProfileUrl(profileId) : "";
  saveCollectProfileButton.textContent = linked ? "update self-attested link" : "self-attest link";
  syncCollectAchievementsButton.hidden = !linked || !signedSolanaHolderReady;
  syncCollectAchievementsButton.textContent = synced ? "SYNC again" : "SYNC achievements";
  unlinkCollectProfileButton.hidden = !linked;
  collectLinkState.textContent = synced ? "wallet matched" : linked ? "self-attested" : "not linked";
  collectLinkState.classList.toggle("is-linked", linked || synced);
  renderClayCollectSlot(collectProfilePreview, currentProfile, "open linked Collect profile ↗");
  if (synced) {
    const sourceName = currentProfile.collect_source_username ? `Collect @${currentProfile.collect_source_username} · ` : "";
    setCollectProfileStatus(`Showing the last successful snapshot: ${sourceName}${achievementCount} earned achievement${achievementCount === 1 ? "" : "s"}, synced ${relativeTime(currentProfile.collect_achievements_synced_at)} ago after an exact Solana wallet match. Unofficial; press SYNC to refresh.`);
  } else if (linked && !signedSolanaHolderReady) {
    setCollectProfileStatus("Public self-attested link saved. Achievement SYNC requires a signed Solana wallet because the wallet match cannot use a pasted read-only address.");
  } else {
    setCollectProfileStatus(linked
      ? "Public self-attested link. Press SYNC manually; achievements import only if Collect lists this exact signed Solana wallet."
      : "Paste your Collect profile URL, achievements API URL, or user ID, save it, then press SYNC manually.");
  }
}

function applyClayCollectProfileUpdate(data, profileId) {
  const returnedProfile = Array.isArray(data) ? data[0] : data;
  const safeProfile = returnedProfile && typeof returnedProfile === "object" ? returnedProfile : {};
  currentProfile = {
    ...currentProfile,
    ...safeProfile,
    collect_profile_id: profileId || null,
    collect_profile_linked_at: profileId ? safeProfile.collect_profile_linked_at || new Date().toISOString() : null,
  };
  const index = profiles.findIndex((profile) => profile.user_id === currentProfile.user_id);
  if (index >= 0) profiles[index] = currentProfile;
  else profiles.push(currentProfile);
  renderEverything();
  renderClayCollectConnection();
}

async function persistClayCollectProfile(profileId, button) {
  if (!currentProfile?.user_id) {
    setCollectProfileStatus("Save your Claymatching username first, then add this public self-attested link.", { error: true });
    return;
  }
  setBusy(button, true, profileId ? "linking…" : "unlinking…");
  setCollectProfileStatus(profileId ? "Saving the self-attested link without querying it…" : "Removing the self-attested link…");
  const { data, error } = await db.rpc("set_clay_collect_profile", { raw_profile_id: profileId || null });
  setBusy(button, false);
  if (error) {
    setCollectProfileStatus(error.message || "The Collect profile link could not be saved.", { error: true });
    return;
  }
  applyClayCollectProfileUpdate(data, profileId);
  await loadOwnSyncedAchievements();
  setCollectProfileStatus(profileId
    ? "Linked as a public self-attestation. Press SYNC to match the signed Solana wallet and import earned achievements."
    : "Collect profile unlinked. Claymatching did not contact Claynosaurz.");
}

async function saveClayCollectProfile() {
  const profileId = normalizeClayCollectProfileId(collectProfileInput.value);
  if (!profileId) {
    setCollectProfileStatus("Use a UUID, the exact Collect profile URL, or the exact achievements API URL.", { error: true });
    collectProfileInput.focus();
    return;
  }
  collectProfileInput.value = clayCollectProfileUrl(profileId);
  await persistClayCollectProfile(profileId, saveCollectProfileButton);
}

async function unlinkClayCollectProfile() {
  await persistClayCollectProfile(null, unlinkCollectProfileButton);
}

async function ensureHolderCsrfToken() {
  if (holderCsrfToken) return holderCsrfToken;
  const response = await fetch("/api/claymatching/session", {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.csrfToken) throw new Error(body.error || "Refresh your holder session before syncing.");
  holderCsrfToken = String(body.csrfToken);
  return holderCsrfToken;
}

async function syncClayCollectAchievements() {
  if (!normalizeClayCollectProfileId(currentProfile?.collect_profile_id)) {
    setCollectProfileStatus("Save a Collect profile first, then press SYNC.", { error: true });
    return;
  }
  let completed = false;
  setBusy(syncCollectAchievementsButton, true, "SYNCING…");
  setCollectProfileStatus("Manually checking this Collect profile for an exact match to your signed Solana wallet…");
  try {
    const csrfToken = await ensureHolderCsrfToken();
    const response = await fetch("/api/claymatching/collect/sync", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "X-Clay-CSRF": csrfToken,
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "The achievement SYNC did not finish.");
    currentProfile = {
      ...currentProfile,
      collect_achievement_count: Number(body.achievementCount || 0),
      collect_achievements_synced_at: body.syncedAt,
      collect_source_username: body.collectUsername || null,
      collect_wallet_matched_at: body.syncedAt,
    };
    const index = profiles.findIndex((profile) => profile.user_id === currentProfile.user_id);
    if (index >= 0) profiles[index] = currentProfile;
    completed = true;
    await loadAppData().catch(() => {});
    await loadOwnSyncedAchievements();
    showToast(`${body.achievementCount || 0} earned Collect achievements synced after an exact wallet match.`);
  } catch (error) {
    await loadAppData().catch(() => {});
    setCollectProfileStatus(error.message || "The achievement SYNC did not finish.", { error: true });
  } finally {
    setBusy(syncCollectAchievementsButton, false);
    if (completed) {
      renderEverything();
      renderClayCollectConnection();
    }
  }
}

function setSuiWalletStatus(message, { error = false } = {}) {
  suiWalletStatus.textContent = message;
  suiWalletStatus.classList.toggle("is-error", error);
  setStatusSemantics(suiWalletStatus, error);
}

function renderSuiConnection() {
  const wallet = connectedSuiWallet || window.claySui?.getState?.() || {};
  connectedSuiWallet = wallet;
  const linked = Boolean(linkedSuiConnection?.linked && linkedSuiConnection?.walletAddress);
  const linkedAddress = String(linkedSuiConnection?.walletAddress || "").toLowerCase();
  const connectedAddress = String(wallet.address || "").toLowerCase();
  const sameWallet = Boolean(linked && wallet.connected && linkedAddress === connectedAddress);
  const popkinsCount = Number(linkedSuiConnection?.popkinsCount || 0);
  const popkinsSyncedAt = linkedSuiConnection?.popkinsSyncedAt;
  const avatarChoiceCount = ownedAssets.filter((asset) => isPopkinAvatarAsset(asset)).length;

  linkSuiWalletButton.hidden = !wallet.connected || sameWallet;
  linkSuiWalletButton.textContent = linked ? "replace linked Sui wallet" : "link this Sui wallet";
  syncPopkinsButton.hidden = !linked;
  syncPopkinsButton.textContent = popkinsCount > 0 && avatarChoiceCount === 0
    ? "load Popkin PFPs"
    : popkinsSyncedAt ? "check Popkins again" : "check Popkins";
  unlinkSuiWalletButton.hidden = !linked;
  suiLinkState.textContent = popkinsCount > 0 ? "Popkins holder" : linked ? "Sui linked" : "not linked";
  suiLinkState.classList.toggle("is-linked", linked);
  popkinsConnectionBadge.hidden = !(linked && popkinsSyncedAt && popkinsCount > 0);
  popkinsConnectionCount.textContent = `${popkinsCount} Popkin${popkinsCount === 1 ? "" : "s"}`;
  if (avatarOptions.children.length) applyAvatarCollectionFilter();

  if (linked) {
    const linkedLabel = `${shortAddress(linkedAddress)} linked privately`;
    const checkedLabel = popkinsSyncedAt
      ? ` Last manual Popkins check: ${popkinsCount} Popkin${popkinsCount === 1 ? "" : "s"}, ${relativeTime(popkinsSyncedAt)} ago.${popkinsCount > 0 && avatarChoiceCount === 0 ? " Press “load Popkin PFPs” once to add the new verified avatar snapshot." : ` ${avatarChoiceCount} available in your avatar picker.`}`
      : " Press “check Popkins” for a fresh wallet, Kiosk, and staking-contract snapshot.";
    const mismatchLabel = wallet.connected && !sameWallet
      ? ` The wallet picker currently has ${shortAddress(connectedAddress)} connected; linking it will replace the saved Sui address.`
      : "";
    const accessLabel = dmAccessReady
      ? " Private Signals are unlocked by a signed wallet."
      : " Link proof is saved; refresh access if private Signals still appear locked.";
    setSuiWalletStatus(`${linkedLabel}.${checkedLabel}${mismatchLabel}${accessLabel}`);
    return;
  }
  if (wallet.connecting) {
    setSuiWalletStatus("Opening the Sui wallet picker…");
  } else if (wallet.connected) {
    setSuiWalletStatus(`${wallet.walletName || "Sui wallet"} ${shortAddress(connectedAddress)} is connected locally. Press “link this Sui wallet” to prove control with a readable message.`);
  } else {
    setSuiWalletStatus("Connect an installed Sui wallet to begin. A linked address stays private.");
  }
}

async function refreshSuiConnection({ quiet = false } = {}) {
  if (!currentSession?.user) return;
  try {
    const response = await fetch("/api/claymatching/sui", {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "The Sui connection could not be loaded.");
    if (typeof body.canDm === "boolean" || typeof body.can_dm === "boolean") applyAccessCapabilities(body);
    linkedSuiConnection = body;
    renderSuiConnection();
  } catch (error) {
    linkedSuiConnection = null;
    renderSuiConnection();
    if (!quiet) setSuiWalletStatus(error.message || "The Sui connection could not be loaded.", { error: true });
  }
}

async function linkConnectedSuiWallet() {
  const wallet = window.claySui?.getState?.() || connectedSuiWallet || {};
  if (!wallet.connected || !wallet.address || !window.claySui?.signPersonalMessage) {
    setSuiWalletStatus("Connect a Sui wallet in the picker first.", { error: true });
    return;
  }

  setBusy(linkSuiWalletButton, true, "preparing proof…");
  setSuiWalletStatus("Preparing a readable, transaction-free ownership message…");
  try {
    const csrfToken = await ensureHolderCsrfToken();
    const challengeResponse = await fetch("/api/claymatching/sui/challenge", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Clay-CSRF": csrfToken,
      },
      body: JSON.stringify({ address: wallet.address }),
    });
    const challenge = await challengeResponse.json().catch(() => ({}));
    if (!challengeResponse.ok) throw new Error(challenge.error || "The Sui link request could not start.");

    setBusy(linkSuiWalletButton, true, "sign in wallet…");
    setSuiWalletStatus("Your wallet will ask you to sign a readable ownership message—not a transaction.");
    const signed = await window.claySui.signPersonalMessage(challenge.message);
    const linkResponse = await fetch("/api/claymatching/sui/link", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Clay-CSRF": csrfToken,
      },
      body: JSON.stringify({
        challengeToken: challenge.challengeToken,
        signature: signed.signature,
        walletName: wallet.walletName || null,
      }),
    });
    const connection = await linkResponse.json().catch(() => ({}));
    if (!linkResponse.ok) throw new Error(connection.error || "The signed Sui wallet could not be linked.");
    applyAccessCapabilities(connection);
    linkedSuiConnection = connection;
    ownedAssets = ownedAssets.filter((asset) => !isPopkinAvatarAsset(asset));
    renderAvatarOptions();
    renderSuiConnection();
    await loadAppData();
    if (dmAccessReady && currentProfile?.handle) {
      await initializeSignalIdentity();
      renderAccessControls();
    }
    setMudprintStatus("Sui wallet linked privately. Checking it now so owned Popkins can become profile-picture choices…");
    await syncLinkedPopkins({ afterLink: true });
  } catch (error) {
    setSuiWalletStatus(error?.message || "The Sui wallet was not linked.", { error: true });
  } finally {
    setBusy(linkSuiWalletButton, false);
  }
}

async function syncLinkedPopkins({ afterLink = false } = {}) {
  if (!linkedSuiConnection?.linked) {
    setSuiWalletStatus("Link a Sui wallet before checking Popkins.", { error: true });
    return;
  }
  setBusy(syncPopkinsButton, true, "checking Sui…");
  setSuiWalletStatus("Checking the linked wallet, owned Sui Kiosks, and supported Popkins staking contract…");
  try {
    const csrfToken = await ensureHolderCsrfToken();
    const response = await fetch("/api/claymatching/popkins/sync", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "X-Clay-CSRF": csrfToken,
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "The Popkins check did not finish.");
    linkedSuiConnection = {
      ...linkedSuiConnection,
      popkinsCount: Number(body.popkinsCount || 0),
      popkinsSource: body.coverage || "wallet+owned-kiosk+staking-contract",
      popkinsSyncedAt: body.syncedAt,
    };
    const syncedPopkins = (Array.isArray(body.avatarAssets) ? body.avatarAssets : [])
      .filter((asset) => asset?.kind === "popkin" && asset?.chain === "sui");
    ownedAssets = [
      ...ownedAssets.filter((asset) => !isPopkinAvatarAsset(asset)),
      ...syncedPopkins,
    ];
    if (!await refreshOwnedAvatarAssets({ quiet: true }) || !holderSessionReady) return;
    await loadAppData();
    activeAvatarCollection = "popkin";
    renderAvatarOptions();
    renderSuiConnection();
    const choiceCount = ownedAssets.filter((asset) => isPopkinAvatarAsset(asset)).length;
    setMudprintStatus(`${afterLink ? "Sui linked and Popkins checked" : "Manual Popkins check complete"}: ${linkedSuiConnection.popkinsCount} verified, with ${choiceCount} profile-picture choice${choiceCount === 1 ? "" : "s"}. Direct, Kiosk-held, and contract-staked Popkins are included.`);
  } catch (error) {
    setSuiWalletStatus(error?.message || "Popkins could not be checked right now.", { error: true });
  } finally {
    setBusy(syncPopkinsButton, false);
  }
}

async function unlinkSuiWallet() {
  if (!linkedSuiConnection?.linked) return;
  const confirmation = await requestClayAction({
    eyebrow: "disconnect the second chain",
    title: "Unlink Sui + Popkins?",
    copy: "This removes the private Sui link and its Popkins snapshot. Your Solana holder login and Clayno profile stay exactly as they are.",
    confirmLabel: "unlink Sui",
  });
  if (!confirmation.confirmed) return;
  setBusy(unlinkSuiWalletButton, true, "unlinking…");
  try {
    const csrfToken = await ensureHolderCsrfToken();
    const response = await fetch("/api/claymatching/sui", {
      method: "DELETE",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "X-Clay-CSRF": csrfToken,
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "The Sui wallet could not be unlinked.");
    applyAccessCapabilities(body);
    linkedSuiConnection = body;
    ownedAssets = ownedAssets.filter((asset) => !isPopkinAvatarAsset(asset));
    if (!await refreshOwnedAvatarAssets({ quiet: true }) || !holderSessionReady) return;
    await loadAppData();
    activeAvatarCollection = "clayno";
    renderAvatarOptions();
    renderSuiConnection();
    setMudprintStatus(dmAccessReady
      ? "Sui wallet unlinked. Your signed Solana wallet still unlocks private Signals."
      : "Sui wallet unlinked. Read-only posting remains open, but private Signals are sealed again.");
  } catch (error) {
    setSuiWalletStatus(error?.message || "The Sui wallet could not be unlinked.", { error: true });
  } finally {
    setBusy(unlinkSuiWalletButton, false);
  }
}

async function renderMudprintLinks() {
  if (!currentSession?.user) return;
  await ensureSuiWalletModule();
  const userResult = await db.auth.getUser();
  if (!userResult.error && userResult.data?.user) currentSession.user = userResult.data.user;
  const address = signedSolanaAddress || walletAddress || extractSessionWallet(currentSession);
  linkedWallet.textContent = address
    ? signedSolanaHolderReady
      ? `${shortAddress(address)} signed and holder-verified privately`
      : `${shortAddress(address)} signed privately · Claynos recheck needed`
    : readOnlySolanaAddress
      ? `${shortAddress(readOnlySolanaAddress)} read-only · self-attested`
      : "no Solana posting source linked";
  solanaLinkState.textContent = signedSolanaHolderReady ? "verified Solana" : address ? "signed · recheck" : readOnlySolanaAddress ? "read-only" : "not linked";
  solanaLinkState.classList.toggle("is-linked", Boolean(address || readOnlySolanaAddress));
  linkSolanaWalletButton.hidden = signedSolanaHolderReady;
  linkSolanaWalletButton.textContent = address
    ? "recheck Claynos with Solana"
    : readOnlySolanaAddress
      ? "upgrade with signed Solana"
      : "connect + sign Solana";
  if (!pendingLinkedEmail) linkEmailInput.value = currentSession.user.email || "";

  let identities = currentSession.user.identities || [];
  const identityResult = await db.auth.getUserIdentities();
  if (!identityResult.error && Array.isArray(identityResult.data?.identities)) {
    identities = identityResult.data.identities;
    currentSession.user.identities = identities;
  }
  const hasApple = identities.some((identity) => identityProvider(identity) === "apple");
  const email = currentSession.user.email || "";
  const emailConfirmed = Boolean(email && currentSession.user.email_confirmed_at);

  passkeys = [];
  if (db.auth.passkey?.list && emailConfirmed) {
    const passkeyResult = await db.auth.passkey.list();
    if (!passkeyResult.error) passkeys = passkeyResult.data || [];
  }

  linkedEmailStatus.textContent = email
    ? emailConfirmed
      ? `${email} confirmed${passkeys.length ? ` · ${passkeys.length} passkey${passkeys.length === 1 ? "" : "s"}` : " · ready for a passkey"}`
      : `${email} is waiting for confirmation`
    : "Add and confirm a private email first. No password is ever created.";
  emailLinkState.textContent = emailConfirmed ? "linked" : email ? "confirm email" : "not linked";
  emailLinkState.classList.toggle("is-linked", emailConfirmed);
  linkEmailButton.textContent = pendingLinkedEmail ? "send again" : email ? "change email" : "send email confirmation";
  renderLinkedEmailCodeEntry();
  registerPasskeyButton.disabled = !emailConfirmed;
  registerPasskeyButton.textContent = passkeys.length ? "add another passkey" : "create a passkey on this device";

  linkedAppleStatus.textContent = hasApple
    ? "Apple is attached to this holder account."
    : appleAuthEnabled === false
      ? "Ready here; waiting for the Apple Developer provider credentials."
      : "Attach Apple privately to this holder account.";
  appleLinkState.textContent = hasApple ? "linked" : "not linked";
  appleLinkState.classList.toggle("is-linked", hasApple);
  linkAppleButton.disabled = hasApple || appleAuthEnabled === false;
  renderClayCollectConnection();
  await refreshSuiConnection({ quiet: true });
  setMudprintStatus(dmAccessReady
    ? "Posting and private Signals are unlocked. Wallet and sign-in links stay private; manual collection checks never request a transaction."
    : "Read-only posting is unlocked. Sign with Solana or Sui to unseal private Signals; manual collection checks never request a transaction.");
}

async function linkEmailToHolder() {
  const email = linkEmailInput.value.trim().toLowerCase();
  if (!email || !linkEmailInput.checkValidity()) {
    linkEmailInput.reportValidity();
    return;
  }
  const currentEmail = String(currentSession?.user?.email || "").trim().toLowerCase();
  if (email === currentEmail && currentSession?.user?.email_confirmed_at) {
    setMudprintStatus("That email is already confirmed. You can create a passkey now.");
    return;
  }
  previousLinkedEmail = currentEmail && currentEmail !== email ? currentEmail : "";
  pendingLinkedEmail = email;
  setBusy(linkEmailButton, true, "sending confirmation…");
  setMudprintStatus("Sending a private email confirmation…");
  const { data, error } = await db.auth.updateUser({ email }, { emailRedirectTo: authRedirectUrl("email-linked") });
  setBusy(linkEmailButton, false);
  if (error) {
    clearLinkedEmailCodeEntry();
    const message = readableErrorMessage(
      error,
      "Email delivery is temporarily unavailable because the sender domain still needs verification. Please try again after the site owner finishes that setup.",
    );
    setMudprintStatus(message, { error: true });
    showToast(message);
    return;
  }
  if (data?.user) currentSession.user = data.user;
  await renderMudprintLinks();
  linkEmailCodeInput.focus();
  setMudprintStatus(previousLinkedEmail
    ? "Use the six-digit code if the email contains one; secure address changes may send one to each inbox. If it contains a confirmation link instead, open that link."
    : "Use the six-digit code if the email contains one. If it contains a secure confirmation link instead, open that link. No password is created.");
}

async function verifyLinkedEmailCode() {
  const email = String(linkEmailCodeAddress.value || pendingLinkedEmail).trim().toLowerCase();
  const token = cleanOtp(linkEmailCodeInput.value);
  linkEmailCodeInput.value = token;
  if (!email || token.length !== 6) {
    setMudprintStatus("Enter the complete six-digit code from the selected inbox.", { error: true });
    linkEmailCodeInput.focus();
    return;
  }
  setBusy(verifyLinkEmailButton, true, "checking code…");
  setMudprintStatus(`Checking the code sent to ${email}…`);
  try {
    const { data, error } = await db.auth.verifyOtp({ email, token, type: "email_change" });
    if (error) throw error;
    if (data?.session) currentSession = data.session;
    else if (data?.user) currentSession.user = data.user;
    const userResult = await db.auth.getUser();
    if (!userResult.error && userResult.data?.user) currentSession.user = userResult.data.user;
    const confirmedEmail = String(currentSession?.user?.email || "").trim().toLowerCase();
    const isComplete = confirmedEmail === pendingLinkedEmail && Boolean(currentSession?.user?.email_confirmed_at);
    linkEmailCodeInput.value = "";
    if (isComplete) {
      clearLinkedEmailCodeEntry();
      try {
        window.localStorage.removeItem(AUTH_RETURN_STORAGE_KEY);
      } catch {
        // The confirmed identity is authoritative even without local storage.
      }
      await renderMudprintLinks();
      setMudprintStatus("Email confirmed. You can add a passkey now—still no password required.");
    } else {
      renderLinkedEmailCodeEntry();
      setMudprintStatus("That code was accepted. If Supabase sent a second code to the other inbox, select it and enter that code now.");
      linkEmailCodeInput.focus();
    }
  } catch (error) {
    setMudprintStatus(error?.message || "That code is invalid or expired. Send another code and try again.", { error: true });
  } finally {
    setBusy(verifyLinkEmailButton, false);
  }
}

async function registerHolderPasskey() {
  if (!currentSession?.user?.email || !currentSession.user.email_confirmed_at) {
    setMudprintStatus("Confirm the linked email before adding a passkey.", { error: true });
    return;
  }
  registerPasskeyButton.disabled = true;
  setMudprintStatus("Your device will ask where to save this passkey…");
  try {
    const { error } = await db.auth.registerPasskey();
    if (error) throw error;
    await renderMudprintLinks();
    setMudprintStatus("Device passkey added. You can use it from the splash page next time.");
  } catch (error) {
    setMudprintStatus(error?.message || "The passkey was not added.", { error: true });
  } finally {
    registerPasskeyButton.disabled = false;
  }
}

async function linkAppleToHolder() {
  if (appleAuthEnabled === false) {
    setMudprintStatus("Apple is waiting for its Services ID and rotating client secret.", { error: true });
    return;
  }
  linkAppleButton.disabled = true;
  setMudprintStatus("Opening Apple to attach it to this holder account…");
  const { error } = await db.auth.linkIdentity({
    provider: "apple",
    options: { redirectTo: authRedirectUrl("apple-linked") },
  });
  if (error) {
    linkAppleButton.disabled = false;
    setMudprintStatus(error.message || "Apple could not be linked yet.", { error: true });
  }
}

function setConsentStatus(message, { error = false } = {}) {
  consentErrorMessage = error ? String(message || "Holder verification failed.") : "";
  consentStatus.textContent = String(message || "");
  consentStatus.classList.toggle("is-error", error);
  setStatusSemantics(consentStatus, error);
}

function setAccountMenuOpen(open, { focus = false } = {}) {
  const shouldOpen = Boolean(open && currentSession && holderSessionReady);
  accountMenu.hidden = !shouldOpen;
  walletButton.setAttribute("aria-expanded", String(shouldOpen));
  if (shouldOpen && focus) {
    window.requestAnimationFrame(() => accountMenu.querySelector('[role="menuitem"]')?.focus());
  }
}

function getWalletProviders() {
  return [...new Set([
    window.phantom?.solana,
    window.backpack?.solana,
    window.solflare,
    window.solana,
  ].filter((provider) => typeof provider?.connect === "function" && typeof provider?.signMessage === "function"))];
}

function providerName(provider) {
  if (provider?.isPhantom) return "Phantom";
  if (provider?.isBackpack) return "Backpack";
  if (provider?.isSolflare) return "Solflare";
  return "Solana wallet";
}

function detachWalletAccountListener() {
  if (!walletAccountProvider) return;
  if (typeof walletAccountProvider.off === "function") {
    walletAccountProvider.off("accountChanged", handleWalletAccountChanged);
  } else {
    walletAccountProvider.removeListener?.("accountChanged", handleWalletAccountChanged);
  }
  walletAccountProvider = undefined;
}

function attachWalletAccountListener(provider) {
  detachWalletAccountListener();
  provider?.on?.("accountChanged", handleWalletAccountChanged);
  walletAccountProvider = provider;
}

function extractSessionWallet(session) {
  const identities = Array.isArray(session?.user?.identities) ? session.user.identities : [];
  for (const identity of identities) {
    const provider = String(identity?.provider || "").toLowerCase();
    const data = identity?.identity_data || {};
    const chain = String(data.chain || data.blockchain || "").toLowerCase();
    if (!provider.includes("web3") && !provider.includes("solana")) continue;
    if (chain && chain !== "solana") continue;
    for (const candidate of [data.address, data.wallet_address, data.walletAddress, data.public_key, data.publicKey, data.sub, identity.provider_id]) {
      const raw = String(candidate || "").trim();
      const value = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(raw) ? raw : raw.split(":").at(-1);
      if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value || "")) return value;
    }
  }
  return "";
}

async function connectWallet({ silent = false } = {}) {
  const providers = getWalletProviders();
  if (!providers.length) {
    if (!silent) showToast("Install Phantom, Backpack, or Solflare to enter the holder board.");
    return false;
  }

  activeProvider = providers[0];
  setBusy(walletButton, true, silent ? "checking wallet…" : `connecting ${providerName(activeProvider)}…`);
  try {
    const result = await activeProvider.connect(silent ? { onlyIfTrusted: true } : undefined);
    walletAddress = String(result?.publicKey || activeProvider.publicKey || "");
    if (!walletAddress) throw new Error("The wallet did not return a public address.");
    updateWalletHeader();
    attachWalletAccountListener(activeProvider);
    return true;
  } catch (error) {
    activeProvider = undefined;
    if (!silent && !String(error?.message || "").toLowerCase().includes("trusted")) {
      showToast(error?.message || "Wallet connection was cancelled.");
    }
    return false;
  } finally {
    setBusy(walletButton, false);
    updateWalletHeader();
  }
}

async function handleWalletAccountChanged(publicKey) {
  const nextAddress = String(publicKey || "");
  if (currentSession && nextAddress && nextAddress !== walletAddress) {
    showToast("Wallet account changed. Sign in again so the holder session stays bound to one wallet.");
    await signOut();
  }
}

function updateWalletHeader() {
  const address = signedSolanaAddress || walletAddress || extractSessionWallet(currentSession);
  const readOnlyAddress = readOnlySolanaAddress;
  const username = cleanUsername(currentProfile?.handle);
  const provisional = Boolean(currentSession && !holderSessionReady && provisionalShell && !provisionalShell.hidden);
  const entryMethod = sessionEntryMethod(currentSession);
  walletState.textContent = username
    ? `@${username}`
    : address
      ? shortAddress(address)
      : readOnlyAddress
        ? `${shortAddress(readOnlyAddress)} · read-only`
      : provisional
        ? `${entryMethod} ready`
        : shortAddress(address);
  walletState.title = address || readOnlyAddress || "";
  accountName.textContent = username ? `@${username}` : provisional ? entryMethod : readOnlyAddress ? "read-only profile" : "holder profile";
  accountAddress.textContent = address
    ? `${shortAddress(address)} · signed Solana`
    : readOnlyAddress
      ? `${shortAddress(readOnlyAddress)} · read-only Solana`
      : provisional
        ? "posting source not selected"
        : "wallet not connected";
  accountAddress.title = address || readOnlyAddress || "";

  if (currentSession && holderSessionReady) {
    walletButton.innerHTML = `<span class="button-dot" aria-hidden="true"></span> ${username ? "profile" : "create profile"}`;
    walletButton.setAttribute("aria-haspopup", "menu");
  } else {
    const label = provisional ? "choose access" : currentSession ? "finish setup" : address ? "finish sign in" : "connect wallet";
    walletButton.innerHTML = `<span class="button-dot" aria-hidden="true"></span> ${label}`;
    walletButton.removeAttribute("aria-haspopup");
    setAccountMenuOpen(false);
  }
  walletButton.disabled = false;
}

async function beginSignIn() {
  if (!db) {
    showToast("Account service did not load. Refresh and try again.");
    return;
  }
  if (!await connectWallet()) return;
  pendingConsentSession = null;
  await openConsentDialog();
}

async function openConsentDialog({ session = null, message = "", activation = false, activationMode = "" } = {}) {
  pendingConsentSession = session;
  provisionalActivationMode = activationMode === "read-only" ? "read-only" : activation ? "wallet" : "";
  provisionalWalletActivation = provisionalActivationMode === "wallet";
  captchaToken = "";
  consentForm.reset();
  const readOnly = provisionalActivationMode === "read-only";
  consentDialogTitle.textContent = readOnly ? "Read-only gate + house promise" : "Holder gate + house promise";
  consentLead.textContent = readOnly
    ? "This is an unofficial, non-commercial, holder-made social experiment. A public address check is self-attested and does not prove wallet ownership."
    : "This is an unofficial, non-commercial, holder-made social experiment. Your wallet signs a readable login or ownership message only—never a transaction.";
  consentSubmitButton.textContent = readOnly ? "agree + enter read-only" : "agree + verify holder";
  setConsentStatus(message || "Complete the checks, then sign the login message in your wallet.");
  if (!consentDialog.open) consentDialog.showModal();
  await renderTurnstile();
}

async function renderTurnstile() {
  if (!await waitForTurnstile()) {
    setConsentStatus("The anti-bot check did not load. Check content blockers and refresh.", { error: true });
    return;
  }
  if (turnstileWidgetId !== undefined) {
    try {
      window.turnstile.remove(turnstileWidgetId);
    } catch {
      // A prior widget may already have been removed by navigation.
    }
  }
  turnstileHost.replaceChildren();
  turnstileWidgetId = window.turnstile.render(turnstileHost, {
    sitekey: TURNSTILE_SITE_KEY,
    theme: "light",
    callback(token) {
      captchaToken = token;
      if (!consentSubmitting && !consentErrorMessage) {
        setConsentStatus(provisionalActivationMode === "read-only"
          ? "Ready. Continue to recheck the public address and unlock posting—no wallet signature is requested."
          : provisionalWalletActivation
          ? "Ready. Continue to sign a readable ownership message—not a transaction."
          : pendingConsentSession
            ? "Wallet signed. Submit again to retry the holder check—no new signature is needed."
            : "Ready. Your wallet will ask for a login signature—not a transaction.");
      }
    },
    "expired-callback"() {
      captchaToken = "";
      if (!consentSubmitting) setConsentStatus("The anti-bot check expired. Please complete it again.", { error: true });
    },
    "error-callback"() {
      captchaToken = "";
      if (!consentSubmitting) setConsentStatus("The anti-bot check failed to load. Refresh and try again.", { error: true });
    },
  });
}

async function submitConsent(event) {
  event.preventDefault();
  if (!consentForm.reportValidity()) return;
  if (!captchaToken && (!pendingConsentSession || provisionalActivationMode)) {
    setConsentStatus("Complete the anti-bot check first.", { error: true });
    return;
  }

  const submitButton = consentForm.querySelector('button[type="submit"]');
  consentSubmitting = true;
  setConsentStatus(provisionalActivationMode === "read-only"
    ? "Rechecking eligible public ownership before read-only posting opens…"
    : provisionalWalletActivation
    ? "Preparing the holder ownership check…"
    : pendingConsentSession
      ? "Retrying the holder check…"
      : "Waiting for your wallet login signature…");
  setBusy(submitButton, true, provisionalActivationMode === "read-only" ? "opening read-only…" : "verifying holder…");
  let membership;
  let session;
  try {
    session = pendingConsentSession;
    if (provisionalActivationMode === "read-only") {
      if (!session) throw new Error("Your email or Apple sign-in expired. Sign in again and retry.");
      membership = await activateProvisionalReadOnly(session);
    } else if (provisionalWalletActivation) {
      if (!session) throw new Error("Your email or Apple sign-in expired. Sign in again and retry.");
      membership = await activateProvisionalHolder(session);
    } else if (!session) {
      if (!activeProvider) throw new Error("Reconnect your Solana wallet first.");
      const statement = `I confirm I am 18+, hold an eligible asset, accept Claymatching Terms v${TERMS_VERSION}, and will not use the service for illegal purposes.`;
      const { data, error } = await db.auth.signInWithWeb3({
        chain: "solana",
        wallet: activeProvider,
        statement,
        options: {
          captchaToken,
          url: window.location.href,
        },
      });
      if (error) throw error;
      session = data?.session;
      if (!session) throw new Error("The wallet login did not create a session.");
      pendingConsentSession = session;
      currentSession = session;
      walletAddress = extractSessionWallet(session) || walletAddress;
      updateWalletHeader();
    }

    if (!membership) {
      setConsentStatus("Wallet signed. Checking this wallet for eligible Claynos…");
      membership = await establishHolderSession(session, {
        adultAttested: true,
        holderAttested: true,
        lawfulUseAttested: true,
      });
    }
  } catch (error) {
    const message = error?.message || "Holder verification failed.";
    const retryHint = provisionalActivationMode === "read-only"
      ? "Complete a fresh anti-bot check, preview the address again if needed, then retry."
      : provisionalWalletActivation
      ? "Complete a fresh anti-bot check, then retry the readable wallet signature."
      : pendingConsentSession
      ? "Your wallet login is saved; use the same button to retry without signing again."
      : "Complete the anti-bot check and try the wallet login again.";
    setConsentStatus(`${message} ${retryHint}`, { error: true });
    if (turnstileWidgetId !== undefined) window.turnstile?.reset?.(turnstileWidgetId);
    captchaToken = "";
    return;
  } finally {
    consentSubmitting = false;
    setBusy(submitButton, false);
  }

  currentSession = session;
  applyAccessCapabilities(membership);
  holderCsrfToken = String(membership.csrfToken || "");
  ownedAssets = membership.assets || [];
  pendingConsentSession = null;
  provisionalWalletActivation = false;
  provisionalActivationMode = "";
  provisionalPreviewRequestId += 1;
  provisionalPreviewPending = false;
  provisionalPreviewAddress = "";
  consentDialog.close();
  updateWalletHeader();

  try {
    await enterAuthenticatedApp();
    showToast(isReadOnlyAccess()
      ? "Read-only posting is open. Connect and sign a Solana or Sui wallet whenever you want to unlock private Signals."
      : "Wallet verified. Create your profile—your signed session now persists on this device.");
  } catch (error) {
    walletGate.hidden = true;
    appShell.hidden = false;
    renderAvatarOptions();
    openProfileDialog();
    showToast(`${isReadOnlyAccess() ? "Read-only posting is open" : "Wallet verified"}. Profile setup is open, but some board data needs a retry: ${error.message}`);
  }
}

async function establishHolderSession(session, consent = {}) {
  const response = await fetch("/api/claymatching/session", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify(consent),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "Holder verification failed.");
    error.consentRequired = body.consentRequired === true;
    error.provisional = body.provisional === true;
    error.walletRequired = body.walletRequired === true;
    error.status = response.status;
    throw error;
  }
  return body;
}

async function restoreSession(session) {
  currentSession = session;
  clearEmailCodeEntry();
  holderSessionReady = false;
  dmAccessReady = false;
  accessMode = "";
  signedSolanaHolderReady = false;
  readOnlySolanaAddress = "";
  signedSolanaAddress = extractSessionWallet(session);
  walletAddress = signedSolanaAddress;
  updateWalletHeader();

  let membership;
  const cookieResponse = await fetch("/api/claymatching/session", {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const cookieSession = await cookieResponse.json().catch(() => ({}));

  try {
    if (cookieResponse.ok && cookieSession.userId === session.user.id) {
      membership = cookieSession;
      const assetResponse = await fetch("/api/claymatching/assets", {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const assetBody = await assetResponse.json().catch(() => ({}));
      if (assetResponse.ok) ownedAssets = assetBody.assets || [];
    } else {
      membership = await establishHolderSession(session);
      ownedAssets = membership.assets || [];
    }
  } catch (error) {
    if (error.provisional) {
      showProvisionalOnboarding(session);
      return;
    }
    if (error.consentRequired) {
      await openConsentDialog({
        session,
        message: "Your wallet login is valid. Accept the current holder rules to finish creating the Claymatching profile.",
      });
      return;
    }
    throw error;
  }

  applyAccessCapabilities(membership);
  holderCsrfToken = String(membership.csrfToken || "");
  await enterAuthenticatedApp();
}

async function enterAuthenticatedApp() {
  walletGate.hidden = true;
  provisionalShell.hidden = true;
  appShell.hidden = false;
  setHolderNavigationLocked(false);
  setAppLoading(true);
  updateWalletHeader();
  try {
    await loadAppData();
  } finally {
    setAppLoading(false);
  }
  renderAvatarOptions();
  if (!currentProfile?.handle) {
    openProfileDialog();
  } else {
    if (dmAccessReady) {
      initializeSignalIdentity().catch((error) => {
        signalStatus.textContent = `Encrypted DMs are still initializing: ${error.message}`;
        setStatusSemantics(signalStatus, true);
      });
    } else {
      renderAccessControls();
      signalStatus.textContent = "Private Signals stay sealed until you sign with a Solana or Sui wallet.";
      setStatusSemantics(signalStatus, false);
    }
    refreshNotificationState().catch(() => {});
    window.clearInterval(notificationRefreshTimer);
    notificationRefreshTimer = window.setInterval(() => refreshNotificationState(), NOTIFICATION_REFRESH_MS);
  }
  handleAuthReturn();
}

function handleAuthReturn() {
  const url = new URL(window.location.href);
  let intent = url.searchParams.get("auth_return");
  try {
    intent ||= window.localStorage.getItem(AUTH_RETURN_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_RETURN_STORAGE_KEY);
  } catch {
    // URL-based email returns continue to work without local storage.
  }
  if (!intent) return;
  const messages = {
    "apple-linked": "Apple is now attached to this holder account.",
    "apple-signin": holderSessionReady
      ? "Signed in with Apple. Community access restored."
      : "Signed in with Apple. Choose read-only Solana or verify a wallet whenever you are ready.",
    "email-linked": "Email confirmation received. You can add a device passkey now.",
    "email-signin": holderSessionReady
      ? "Email sign-in accepted. Community access restored."
      : "Email sign-in accepted. Choose read-only Solana or verify a wallet whenever you are ready.",
  };
  if (messages[intent]) showToast(messages[intent]);
  if (["apple-linked", "email-linked"].includes(intent) && currentProfile?.handle && !profileDialog.open) {
    openProfileDialog();
  }
  for (const parameter of ["auth_return", "code", "token_hash", "type", "error", "error_code", "error_description"]) {
    url.searchParams.delete(parameter);
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

async function signOut() {
  const provider = activeProvider;
  const hadHolderAccess = holderSessionReady;
  detachWalletAccountListener();
  try {
    await fetch("/api/claymatching/session", {
      method: "DELETE",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    await db?.auth.signOut({ scope: "local" });
    await provider?.disconnect?.();
  } catch {
    // Local state is still cleared even when an extension or network is unavailable.
  }
  resetApp();
  showToast(hadHolderAccess
    ? "Signed out. Your encrypted Signal identity remains protected on this device."
    : "Signed out. No wallet or preview address was attached to this sign-in.");
}

function resetApp() {
  detachWalletAccountListener();
  currentSession = undefined;
  currentProfile = undefined;
  holderSessionReady = false;
  dmAccessReady = false;
  accessMode = "";
  signedSolanaAddress = "";
  signedSolanaHolderReady = false;
  readOnlySolanaAddress = "";
  activeProvider = undefined;
  walletAddress = "";
  ownedAssets = [];
  profiles = [];
  posts = [];
  reactions = [];
  squishes = [];
  mutualMatches = [];
  notifications = [];
  lastNotificationAnnouncement = "";
  notificationLive.textContent = "";
  signalMessages = [];
  signalUnreadCount = 0;
  signalProfileByFingerprint = new Map();
  ambiguousSignalFingerprints = new Set();
  ownSignalFingerprints = new Set();
  holderCsrfToken = "";
  ownSyncedAchievements = [];
  featuredAchievementChoicesReady = false;
  featuredAchievementRequestId += 1;
  passkeys = [];
  signalIdentity = undefined;
  linkedSuiConnection = null;
  currentDmTarget = undefined;
  currentDmDevices = [];
  ownSignalDevices = [];
  signalIdentityPromise = undefined;
  signalIdentityAccountId = "";
  signalRefreshPromise = undefined;
  signalRefreshAccountId = "";
  accessRefreshPromise = undefined;
  lastAccessRefreshAt = 0;
  pendingConsentSession = null;
  provisionalWalletActivation = false;
  provisionalActivationMode = "";
  provisionalPreviewAddress = "";
  provisionalPreviewAssets = [];
  captchaToken = "";
  clearLinkedEmailCodeEntry();
  window.clearInterval(notificationRefreshTimer);
  notificationRefreshTimer = undefined;
  renderNotificationBadges();
  clearReplyTarget();
  setAccountMenuOpen(false);
  viewedProfile = undefined;
  for (const dialog of [consentDialog, profileDialog, memberProfileDialog, actionDialog, achievementDialog, dmDialog]) {
    if (dialog.open) dialog.close();
  }
  appShell.hidden = true;
  provisionalShell.hidden = true;
  walletGate.hidden = false;
  resetProvisionalPreview();
  setHolderNavigationLocked(true);
  renderAccessControls();
  updateWalletHeader();
}

async function loadAppData() {
  let postReferenceError;
  feed.setAttribute("aria-busy", "true");
  matchingGrid.setAttribute("aria-busy", "true");
  const [profileResult, postResult, reactionResult, squishResult, matchResult, notificationResult] = await Promise.all([
    db.from("clay_profiles").select("user_id,handle,bio,avatar_asset_id,avatar_collection_id,avatar_image_url,avatar_name,background,custom_background_url,custom_profile_background_url,custom_post_background_url,intents,role,account_state,membership_mode,collect_profile_id,collect_profile_linked_at,collect_achievement_count,collect_achievements_synced_at,collect_wallet_matched_at,collect_source_username,featured_achievement_id,featured_achievement_name,featured_achievement_title,featured_achievement_rarity,featured_achievement_icon_url,featured_achievement_selected_at,created_at,updated_at").order("created_at", { ascending: true }).limit(500),
    db.from("clay_posts").select("id,author_user_id,parent_post_id,body,background,custom_background_url,deleted_at,created_at,updated_at").order("created_at", { ascending: false }).limit(150),
    db.from("clay_reactions").select("post_id,user_id,created_at").limit(5000),
    db.from("clay_squishes").select("actor_user_id,target_user_id,created_at").limit(5000),
    db.rpc("clay_matches"),
    db.from("clay_notifications").select("id,actor_user_id,post_id,kind,read_at,created_at").is("read_at", null).order("created_at", { ascending: false }).limit(100),
  ]);
  feed.setAttribute("aria-busy", "false");
  matchingGrid.setAttribute("aria-busy", "false");
  if (profileResult.error) {
    throw new Error(profileResult.error.message || "Your holder profile could not be loaded.");
  }

  profiles = profileResult.data || [];
  posts = postResult.error ? [] : postResult.data || [];
  postReferences = new Map();
  const loadedPostIds = new Set(posts.map((post) => post.id));
  const missingParentIds = [...new Set(posts
    .map((post) => post.parent_post_id)
    .filter((parentId) => parentId && !loadedPostIds.has(parentId)))];
  if (missingParentIds.length) {
    const referenceResult = await db.from("clay_posts")
      .select("id,author_user_id,parent_post_id,body,background,custom_background_url,deleted_at,created_at,updated_at")
      .in("id", missingParentIds);
    postReferenceError = referenceResult.error;
    if (!referenceResult.error) {
      postReferences = new Map((referenceResult.data || []).map((post) => [post.id, post]));
    }
  }
  reactions = reactionResult.error ? [] : reactionResult.data || [];
  squishes = squishResult.error ? [] : squishResult.data || [];
  mutualMatches = matchResult.error ? [] : matchResult.data || [];
  notifications = notificationResult.error ? [] : notificationResult.data || [];
  currentProfile = profiles.find((profile) => profile.user_id === currentSession.user.id);
  renderEverything();
  if (postResult.error) {
    renderDataError(feed, "Board chatter could not load right now. Your account is still signed in.");
  }
  if (squishResult.error || matchResult.error) {
    renderDataError(matchingGrid, "Potential mudmates could not load right now. Try the herd again in a moment.");
  }
  updateWalletHeader();

  const communityError = [postResult, reactionResult, squishResult, matchResult, notificationResult].find((result) => result.error)?.error || postReferenceError;
  if (communityError) {
    showToast(`Your profile is ready. Some community data is still loading: ${communityError.message}`);
  }
}

function renderEverything() {
  renderProfile();
  renderNotificationBadges();
  renderFeed();
  renderMatches();
  renderPeople();
  renderSignalDirectory();
  renderAccessControls();
  const activeCreatureCount = profiles.filter((profile) => profile.handle && profile.account_state === "active").length;
  liveCount.innerHTML = "<i></i> ";
  liveCount.append(`${activeCreatureCount} creature${activeCreatureCount === 1 ? "" : "s"} in the mud`);
}

async function refreshNotificationState() {
  if (!currentSession || !holderSessionReady || document.hidden) return;
  if (!await refreshAuthoritativeAccess()) return;
  const result = await db.from("clay_notifications")
    .select("id,actor_user_id,post_id,kind,read_at,created_at")
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!result.error) notifications = result.data || [];
  renderNotificationBadges();
  if (dmAccessReady) await refreshSignalInbox({ quiet: true }).catch(() => {});
}

async function markMentionNotificationsRead() {
  if (!notifications.some((notification) => !notification.read_at)) return;
  const { error } = await db.rpc("mark_clay_notifications_read");
  if (error) {
    showToast(error.message || "Those tag notifications could not be cleared yet.");
    return;
  }
  const readAt = new Date().toISOString();
  notifications = notifications.map((notification) => notification.read_at ? notification : { ...notification, read_at: readAt });
  renderNotificationBadges();
}

function renderSignalDirectory() {
  signalRecipients.replaceChildren();
  if (!dmAccessReady) {
    const empty = document.createElement("div");
    empty.className = "signal-directory-empty";
    const copy = document.createElement("p");
    copy.textContent = "Private Signals require a signed Solana or Sui wallet. A read-only public address never unlocks DMs by itself.";
    empty.append(copy);
    signalRecipients.append(empty);
    return;
  }
  const recipients = mutualMatches.filter((profile) => profile.handle);
  if (!recipients.length) {
    const empty = document.createElement("div");
    empty.className = "signal-directory-empty";
    const copy = document.createElement("p");
    copy.textContent = "No mutual squishes yet. Both creatures need to squish each other before encrypted DMs unlock.";
    const findButton = document.createElement("button");
    findButton.className = "clay-button clay-button-coral";
    findButton.type = "button";
    findButton.textContent = "find a mudmate";
    findButton.addEventListener("click", () => setView("matching", { scroll: true }));
    empty.append(copy, findButton);
    signalRecipients.append(empty);
    return;
  }

  for (const match of recipients) {
    const profile = profiles.find((candidate) => candidate.user_id === match.user_id) || match;
    const row = document.createElement("article");
    row.className = "signal-recipient";
    const avatar = avatarElement(profile);
    const copy = document.createElement("div");
    const name = document.createElement("b");
    name.textContent = `@${profile.handle}`;
    appendRoleBadge(name, profile);
    markProfileTarget(name, profile);
    const meta = document.createElement("span");
    meta.textContent = `${(profile.intents || ["holder"]).join(" + ")} · mutual squish`;
    copy.append(name, meta);
    const collectLink = clayCollectProfileLink(profile);
    if (collectLink) copy.append(collectLink);
    const achievementChip = clayAchievementChip(profile);
    if (achievementChip) copy.append(achievementChip);
    const messageButton = document.createElement("button");
    messageButton.className = "clay-button clay-button-dark";
    messageButton.type = "button";
    messageButton.dataset.dmUser = profile.user_id;
    messageButton.textContent = "message";
    row.append(avatar, copy, messageButton);
    signalRecipients.append(row);
  }
}

function showSignalComposer() {
  if (!dmAccessReady) {
    showToast("Sign with a Solana or Sui wallet to unlock private Signals.");
    setView("signals", { scroll: true });
    return;
  }
  setView("signals", { scroll: true });
  renderSignalDirectory();
  signalDirectoryReturnFocus = document.activeElement;
  signalDirectory.hidden = false;
  requestAnimationFrame(() => {
    signalDirectory.scrollIntoView({ behavior: preferredScrollBehavior(), block: "center" });
    (signalRecipients.querySelector("[data-dm-user]") || signalDirectoryHeading)?.focus();
  });
}

function avatarElement(profile, className = "mini-avatar") {
  const element = document.createElement("div");
  element.className = className;
  const appendInitial = () => {
    const initial = document.createElement("span");
    initial.textContent = cleanUsername(profile?.handle).slice(0, 1).toUpperCase() || "?";
    element.append(initial);
  };
  if (profile?.avatar_image_url) {
    const image = document.createElement("img");
    image.src = profile.avatar_image_url;
    image.alt = profile.avatar_name || `@${profile.handle || "holder"}`;
    image.loading = "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      element.replaceChildren();
      appendInitial();
    }, { once: true });
    element.append(image);
  } else {
    appendInitial();
  }
  markProfileTarget(element, profile);
  return element;
}

function markProfileTarget(element, profile) {
  if (!element) return;
  if (!profile?.user_id) {
    delete element.dataset.profileUser;
    element.classList.remove("profile-click-target");
    element.removeAttribute("role");
    element.removeAttribute("tabindex");
    element.removeAttribute("aria-label");
    return;
  }
  element.dataset.profileUser = profile.user_id;
  element.classList.add("profile-click-target");
  element.setAttribute("role", "button");
  element.tabIndex = 0;
  element.setAttribute("aria-label", `Open @${profile.handle || "holder"}'s profile`);
}

function appendRoleBadge(container, profile) {
  if (!container || !["admin", "moderator"].includes(profile?.role)) return;
  const badge = document.createElement("span");
  badge.className = `role-badge role-badge-${profile.role}`;
  badge.textContent = profile.role === "admin" ? "★ ADMIN" : "◆ MOD";
  badge.title = profile.role === "admin" ? "Claymatching administrator" : "Claymatching moderator";
  container.append(" ", badge);
}

function accessBadgeElement(profile, { compact = false } = {}) {
  if (!isReadOnlyAccess(profile)) return null;
  const badge = document.createElement("span");
  badge.className = `access-badge access-badge-read-only${compact ? " is-compact" : ""}`;
  badge.textContent = compact ? "READ-ONLY" : "READ-ONLY · SELF-ATTESTED";
  badge.title = "Eligible public Solana address supplied by this user. Wallet ownership was not proven.";
  badge.setAttribute("aria-label", "Read-only self-attested Solana access; wallet ownership not proven");
  return badge;
}

function renderProfile() {
  const profile = currentProfile || {};
  const username = cleanUsername(profile.handle) || "unnamed-clay";
  profileName.textContent = `@${username}`;
  appendRoleBadge(profileName, profile);
  markProfileTarget(profileName, profile);
  markProfileTarget(profileAvatarButton, profile);
  profileAccessBadge.hidden = !isReadOnlyAccess(profile);
  renderFeaturedAchievementSlot(profileFeaturedAchievement, profile);
  renderProfileAchievementShowcase(profileAchievements, profile);
  renderClayCollectLinkSlot(profileCollectLink, profile);
  profileBio.textContent = profile.bio || "Mold a profile before posting or matching.";
  const profileBackgroundUrl = savedCustomBackgroundUrl(profile, "profile");
  const postBackgroundUrl = savedCustomBackgroundUrl(profile, "post");
  const hasCustomBackground = setRemoteBackground(profileCard, "--profile-background-image", profileBackgroundUrl);
  profileCard.dataset.background = profile.background === "custom" && !hasCustomBackground ? "dune" : profile.background || "dune";
  customPostBackground.hidden = !postBackgroundUrl;
  setRemoteBackground(customPostBackground, "--custom-background-image", postBackgroundUrl);
  if (!postBackgroundUrl && selectedPostBackground === "custom") {
    selectedPostBackground = "dune";
    document.querySelectorAll("[data-post-background]").forEach((swatch) => {
      const selected = swatch.dataset.postBackground === "dune";
      swatch.classList.toggle("is-selected", selected);
      swatch.setAttribute("aria-pressed", String(selected));
    });
  }
  profileTags.replaceChildren(...(profile.intents || ["friends", "memes"]).map((intent) => {
    const tag = document.createElement("span");
    tag.textContent = intent;
    return tag;
  }));

  composerAvatar.replaceChildren();
  if (profile.avatar_image_url) {
    profileImage.src = profile.avatar_image_url;
    profileImage.alt = profile.avatar_name || "Selected owned collectible";
    profileImage.decoding = "async";
    profileImage.onerror = () => {
      profileImage.hidden = true;
      profileFallback.hidden = false;
    };
    profileImage.hidden = false;
    profileFallback.hidden = true;
    const composerImage = document.createElement("img");
    composerImage.src = profile.avatar_image_url;
    composerImage.alt = "";
    composerImage.decoding = "async";
    composerImage.referrerPolicy = "no-referrer";
    composerImage.addEventListener("error", () => {
      const initial = document.createElement("span");
      initial.textContent = username.slice(0, 1).toUpperCase();
      composerAvatar.replaceChildren(initial);
    }, { once: true });
    composerAvatar.append(composerImage);
  } else {
    profileImage.onerror = null;
    profileImage.hidden = true;
    profileImage.removeAttribute("src");
    profileFallback.hidden = false;
    profileFallback.className = "clay-avatar avatar-coral";
    profileFallback.innerHTML = '<span class="clay-eye eye-one"></span><span class="clay-eye eye-two"></span><span class="clay-smile"></span>';
    const initial = document.createElement("span");
    initial.textContent = username.slice(0, 1).toUpperCase();
    composerAvatar.append(initial);
  }
}

function renderAvatarOptions() {
  const checkedAvatarId = avatarOptions.querySelector('input[name="avatar"]:checked')?.value;
  const selectedAvatarId = checkedAvatarId ?? currentProfile?.avatar_asset_id ?? "";
  avatarOptions.replaceChildren();
  const verifiedAssets = [...ownedAssets];
  if (currentProfile?.avatar_asset_id && !verifiedAssets.some((asset) => asset.id === currentProfile.avatar_asset_id)) {
    verifiedAssets.push({
      chain: currentProfile.avatar_collection_id === POPKINS_COLLECTION_ID ? "sui" : "solana",
      collectionId: currentProfile.avatar_collection_id,
      id: currentProfile.avatar_asset_id,
      image: currentProfile.avatar_image_url,
      kind: currentProfile.avatar_collection_id === POPKINS_COLLECTION_ID ? "popkin" : "clayno",
      name: currentProfile.avatar_name || "Currently selected collectible",
      selectedSnapshot: true,
    });
  }
  const options = [{ id: "", name: "Original placeholder — no collectible avatar" }, ...verifiedAssets];
  for (const asset of options) {
    const label = document.createElement("label");
    label.className = "avatar-option";
    const isPopkin = isPopkinAvatarAsset(asset);
    const collection = asset.id ? (isPopkin ? "popkin" : "clayno") : "neutral";
    label.dataset.avatarOptionCollection = collection;
    label.classList.toggle("is-popkin", isPopkin);
    label.title = isPopkin ? `${asset.name} · verified Popkin on Sui` : asset.name;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "avatar";
    input.value = asset.id;
    input.checked = selectedAvatarId === asset.id;
    label.append(input);
    if (asset.image) {
      const image = document.createElement("img");
      image.src = asset.image;
      image.alt = asset.name;
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => {
        image.remove();
        const shape = document.createElement("span");
        shape.className = "avatar-demo avatar-demo-coral";
        shape.setAttribute("aria-label", `${asset.name} image unavailable`);
        label.append(shape);
      }, { once: true });
      label.append(image);
    } else {
      const shape = document.createElement("span");
      shape.className = "avatar-demo avatar-demo-coral";
      shape.setAttribute("aria-label", asset.name);
      label.append(shape);
    }
    if (isPopkin) {
      const origin = document.createElement("span");
      origin.className = "avatar-origin-badge";
      origin.textContent = "POP · SUI";
      label.append(origin);
    }
    avatarOptions.append(label);
  }
  applyAvatarCollectionFilter();
}

function applyAvatarCollectionFilter() {
  const claynoCount = ownedAssets.filter((asset) => !isPopkinAvatarAsset(asset)).length;
  const popkinAvatarCount = ownedAssets.filter((asset) => isPopkinAvatarAsset(asset)).length;
  const syncedPopkinCount = Number(linkedSuiConnection?.popkinsCount);
  const popkinCount = linkedSuiConnection?.popkinsSyncedAt && Number.isFinite(syncedPopkinCount)
    ? Math.max(0, syncedPopkinCount)
    : popkinAvatarCount;
  if (avatarClaynoCount) avatarClaynoCount.textContent = String(claynoCount);
  if (avatarPopkinCount) avatarPopkinCount.textContent = String(popkinCount);

  for (const button of avatarCollectionButtons) {
    const selected = button.dataset.avatarCollection === activeAvatarCollection;
    button.setAttribute("aria-pressed", String(selected));
    button.classList.toggle("is-active", selected);
  }
  for (const option of avatarOptions.querySelectorAll("[data-avatar-option-collection]")) {
    const collection = option.dataset.avatarOptionCollection;
    option.hidden = collection !== "neutral" && collection !== activeAvatarCollection;
  }

  assetStatus.classList.toggle("is-empty", activeAvatarCollection === "clayno" ? claynoCount === 0 : popkinCount === 0);
  if (activeAvatarCollection === "clayno") {
    assetStatus.textContent = claynoCount
      ? `${claynoCount} Clayno${claynoCount === 1 ? "" : "s"} currently verified. Only the avatar you choose becomes public.`
      : isReadOnlyAccess()
        ? "Read-only Claynos stay private and locked because the public address was not signed. Use the placeholder, verify Solana, or link Sui for verified Popkin choices."
        : "0 Claynos currently verified. Reconnect your Solana wallet to refresh holder ownership.";
    return;
  }
  if (popkinCount) {
    const availability = popkinAvatarCount === popkinCount
      ? "Only the avatar you choose becomes public."
      : `${popkinAvatarCount} ${popkinAvatarCount === 1 ? "is" : "are"} currently available as avatar choices. Only the avatar you choose becomes public.`;
    assetStatus.textContent = `${popkinCount} Popkin${popkinCount === 1 ? "" : "s"} currently verified. ${availability}`;
  } else if (!linkedSuiConnection?.linked) {
    assetStatus.textContent = "0 Popkins currently verified. Link a Sui wallet under Mudprint links to load your Popkins.";
  } else if (!linkedSuiConnection?.popkinsSyncedAt) {
    assetStatus.textContent = "0 Popkins currently verified. Press check Popkins under Mudprint links to load your verified choices.";
  } else {
    assetStatus.textContent = "0 Popkins found in the latest wallet, Kiosk, and staking-contract check.";
  }
}

function isPopkinAvatarAsset(asset) {
  return Boolean(
    asset?.kind === "popkin"
      || asset?.chain === "sui"
      || asset?.collectionId === POPKINS_COLLECTION_ID,
  );
}

async function refreshOwnedAvatarAssets({ quiet = false } = {}) {
  try {
    const accessReady = await refreshAuthoritativeAccess({ maxAgeMs: 5_000 });
    if (!accessReady) return false;
    const response = await fetch("/api/claymatching/assets", {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Your verified collectibles could not be refreshed.");
    applyAccessCapabilities(body);
    ownedAssets = body.assets || [];
    return true;
  } catch (error) {
    if (!quiet) showToast(`${error.message} Showing the last verified list instead.`);
    return false;
  }
}

function openProfileDialog() {
  if (!currentSession) return;
  profileForm.elements.username.value = cleanUsername(currentProfile?.handle);
  profileForm.elements.bio.value = currentProfile?.bio || "";
  profileForm.elements.customProfileBackgroundUrl.value = savedCustomBackgroundUrl(currentProfile, "profile");
  profileForm.elements.customPostBackgroundUrl.value = savedCustomBackgroundUrl(currentProfile, "post");
  setCustomBackgroundEditorTarget("profile");
  renderCustomBackgroundPreviews();
  [...profileForm.elements.intent].forEach((input) => {
    input.checked = (currentProfile?.intents || ["friends", "memes"]).includes(input.value);
  });
  const savedBackground = currentProfile?.background === "custom" && !savedCustomBackgroundUrl(currentProfile, "profile")
    ? "dune"
    : currentProfile?.background || "dune";
  const background = profileForm.querySelector(`input[name="background"][value="${savedBackground}"]`);
  if (background) background.checked = true;
  activeAvatarCollection = currentProfile?.avatar_collection_id === POPKINS_COLLECTION_ID ? "popkin" : "clayno";
  renderAvatarOptions();
  loadOwnSyncedAchievements().catch(() => {
    renderFeaturedAchievementPicker({ error: "Your synced achievement choices could not be loaded." });
  });
  renderMudprintLinks().catch((error) => setMudprintStatus(error.message || "Private sign-in links could not be loaded.", { error: true }));
  profileDialog.showModal();
}

async function openAccountProfile() {
  setAccountMenuOpen(false);
  setBusy(accountProfileButton, true, "loading collectibles…");
  const refreshed = await refreshOwnedAvatarAssets();
  setBusy(accountProfileButton, false);
  if (!holderSessionReady) return;
  if (!refreshed) {
    showToast("Profile opened with your last verified collectible list. Refresh again when the connection is back.");
  }
  openProfileDialog();
}

async function handleWalletButton() {
  if (currentSession && holderSessionReady) {
    setAccountMenuOpen(accountMenu.hidden, { focus: accountMenu.hidden });
    return;
  }
  if (currentSession && provisionalShell && !provisionalShell.hidden) {
    await startProvisionalWalletActivation();
    return;
  }
  if (currentSession) {
    await openConsentDialog({
      session: currentSession,
      message: "Your wallet login is saved. Accept the holder rules to finish creating your profile.",
    });
    return;
  }
  await beginSignIn();
}

async function saveProfile(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  if (!profileForm.reportValidity()) return;
  const username = cleanUsername(profileForm.elements.username.value);
  const intents = [...profileForm.querySelectorAll('input[name="intent"]:checked')].map((input) => input.value);
  const background = profileForm.querySelector('input[name="background"]:checked')?.value || "dune";
  const customProfileBackgroundUrl = normalizeHttpsImageUrl(profileForm.elements.customProfileBackgroundUrl.value);
  const customPostBackgroundUrl = normalizeHttpsImageUrl(profileForm.elements.customPostBackgroundUrl.value);
  if (username.length < 3 || !intents.length) {
    showToast("Choose a valid username and at least one intention.");
    return;
  }
  if (customProfileBackgroundUrl === null || (background === "custom" && !customProfileBackgroundUrl)) {
    showToast("Your custom profile background needs a valid direct HTTPS image URL.");
    setCustomBackgroundEditorTarget("profile");
    profileForm.elements.customProfileBackgroundUrl.focus();
    return;
  }
  if (customPostBackgroundUrl === null) {
    showToast("Your custom post background needs a valid direct HTTPS image URL.");
    setCustomBackgroundEditorTarget("post");
    profileForm.elements.customPostBackgroundUrl.focus();
    return;
  }
  const submitButton = profileForm.querySelector('button[type="submit"]');
  setBusy(submitButton, true, "saving creature…");
  const { data, error } = await db.rpc("update_clay_profile_v2", {
    raw_avatar_asset_id: profileForm.querySelector('input[name="avatar"]:checked')?.value || null,
    raw_background: background,
    raw_bio: profileForm.elements.bio.value.trim().slice(0, 160),
    raw_custom_post_background_url: customPostBackgroundUrl || null,
    raw_custom_profile_background_url: customProfileBackgroundUrl || null,
    raw_handle: username,
    raw_intents: intents.slice(0, 4),
  });
  if (error) {
    setBusy(submitButton, false);
    showToast(error.message || "Profile could not be saved.");
    return;
  }
  let savedProfile = Array.isArray(data) ? data[0] : data;
  if (featuredAchievementChoicesReady && !featuredAchievementPicker.hidden) {
    const selectedAchievementId = profileForm.querySelector('input[name="featuredAchievement"]:checked')?.value || null;
    const featuredResult = await db.rpc("set_clay_featured_achievement", {
      raw_achievement_id: selectedAchievementId,
    });
    if (featuredResult.error) {
      setBusy(submitButton, false);
      currentProfile = { ...currentProfile, ...(savedProfile || {}) };
      const savedIndex = profiles.findIndex((profile) => profile.user_id === currentProfile.user_id);
      if (savedIndex >= 0) profiles[savedIndex] = currentProfile;
      else profiles.push(currentProfile);
      renderEverything();
      showToast(featuredResult.error.message || "Your profile was saved, but the featured achievement could not be updated.");
      return;
    }
    const featuredProfile = Array.isArray(featuredResult.data) ? featuredResult.data[0] : featuredResult.data;
    savedProfile = { ...(savedProfile || {}), ...(featuredProfile || {}) };
  }
  setBusy(submitButton, false);
  currentProfile = { ...currentProfile, ...(savedProfile || {}) };
  const index = profiles.findIndex((profile) => profile.user_id === currentProfile.user_id);
  if (index >= 0) profiles[index] = currentProfile;
  else profiles.push(currentProfile);
  profileDialog.close();
  renderEverything();
  updateWalletHeader();
  if (dmAccessReady) {
    await initializeSignalIdentity().catch((signalError) => {
      signalStatus.textContent = `Profile saved; encrypted DM setup needs another try: ${signalError.message}`;
      setStatusSemantics(signalStatus, true);
    });
  } else {
    renderAccessControls();
    signalStatus.textContent = "Profile saved. Private Signals stay sealed until you sign with Solana or Sui.";
    setStatusSemantics(signalStatus, false);
  }
  showToast(isReadOnlyAccess() ? "Profile saved with read-only, self-attested access." : "Profile saved to your holder account.");
}

function relativeTime(value) {
  const timestamp = new Date(value || "").getTime();
  if (!Number.isFinite(timestamp)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function validTimestamp(value) {
  const date = new Date(value || "");
  return Number.isFinite(date.getTime()) ? date : null;
}

function postTimestampLabel(value) {
  const date = validTimestamp(value);
  if (!date) return "Time unavailable";
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const dayKey = (candidate) => `${candidate.getFullYear()}-${candidate.getMonth()}-${candidate.getDate()}`;
  const calendarLabel = dayKey(date) === dayKey(now)
    ? "Today"
    : dayKey(date) === dayKey(yesterday)
      ? "Yesterday"
      : new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
          ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
        }).format(date);
  const clockLabel = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  return `${calendarLabel} · ${clockLabel}`;
}

function absoluteTimestampLabel(value) {
  const date = validTimestamp(value);
  if (!date) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function postPreviewText(value, limit = 150) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

function renderTaggedPostBody(element, body) {
  element.replaceChildren();
  const source = String(body || "");
  const profileByHandle = new Map(profiles.filter((profile) => profile.handle).map((profile) => [profile.handle.toLowerCase(), profile]));
  const matcher = /@([a-zA-Z0-9_-]{3,20})/g;
  let cursor = 0;
  for (const match of source.matchAll(matcher)) {
    const profile = profileByHandle.get(match[1].toLowerCase());
    if (!profile) continue;
    element.append(document.createTextNode(source.slice(cursor, match.index)));
    const mention = document.createElement("button");
    mention.className = "mention-link";
    mention.type = "button";
    mention.textContent = match[0];
    markProfileTarget(mention, profile);
    element.append(mention);
    cursor = match.index + match[0].length;
  }
  element.append(document.createTextNode(source.slice(cursor)));
}

function renderFeed() {
  feed.replaceChildren();
  if (!posts.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No posts yet. Squish the first one.";
    feed.append(empty);
    return;
  }
  const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const postMap = new Map(postReferences);
  for (const post of posts) postMap.set(post.id, post);
  const reactionCounts = reactions.reduce((counts, reaction) => counts.set(reaction.post_id, (counts.get(reaction.post_id) || 0) + 1), new Map());
  const replyCounts = posts.reduce((counts, post) => post.parent_post_id ? counts.set(post.parent_post_id, (counts.get(post.parent_post_id) || 0) + 1) : counts, new Map());
  const ownReactions = new Set(reactions.filter((reaction) => reaction.user_id === currentSession.user.id).map((reaction) => reaction.post_id));

  for (const post of posts) {
    const author = profileMap.get(post.author_user_id) || {};
    const article = document.createElement("article");
    const customPostUrl = post.background === "custom" ? snapshottedPostBackgroundUrl(post, author) : "";
    const postBackground = post.background === "custom" && !customPostUrl ? "dune" : post.background || "dune";
    article.className = `post-card post-${postBackground}${post.parent_post_id ? " is-reply" : ""}`;
    if (customPostUrl) setRemoteBackground(article, "--post-background-image", customPostUrl);
    article.dataset.postId = post.id;
    const header = document.createElement("header");
    const avatar = avatarElement(author);
    const byline = document.createElement("div");
    byline.className = "post-byline";
    const nameLine = document.createElement("div");
    nameLine.className = "post-name-line";
    const name = document.createElement("b");
    name.textContent = `@${author.handle || "departed-clay"}`;
    appendRoleBadge(name, author);
    markProfileTarget(name, author);
    nameLine.append(name);
    const trustRow = document.createElement("div");
    trustRow.className = "post-trust-row";
    const achievementChip = clayAchievementChip(author);
    if (achievementChip) trustRow.append(achievementChip);
    const accessBadge = accessBadgeElement(author, { compact: true });
    if (accessBadge) trustRow.append(accessBadge);
    const featuredBadge = featuredAchievementBadge(author, { compact: true });
    if (featuredBadge) trustRow.append(featuredBadge);
    const meta = document.createElement("div");
    meta.className = "post-meta-line";
    const kind = document.createElement("span");
    kind.className = "post-kind";
    kind.textContent = post.parent_post_id ? "↳ reply" : (author.intents || ["holder"])[0];
    const timestamp = document.createElement("time");
    timestamp.className = "post-timestamp";
    const createdAt = validTimestamp(post.created_at);
    const postAge = relativeTime(post.created_at);
    timestamp.textContent = `${postTimestampLabel(post.created_at)}${postAge ? ` · ${postAge === "now" ? "now" : `${postAge} ago`}` : ""}`;
    if (createdAt) timestamp.dateTime = createdAt.toISOString();
    timestamp.title = absoluteTimestampLabel(post.created_at);
    timestamp.setAttribute("aria-label", `Posted ${absoluteTimestampLabel(post.created_at)}`);
    meta.append(kind, timestamp);
    const collectLink = clayCollectProfileLink(author, "Collect ↗");
    if (collectLink) {
      collectLink.classList.add("is-inline");
      meta.append(collectLink);
    }
    byline.append(nameLine);
    if (trustRow.childElementCount) byline.append(trustRow);
    byline.append(meta);
    const more = document.createElement("button");
    more.className = "more-button";
    more.type = "button";
    more.dataset.postAction = post.id;
    more.setAttribute("aria-label", "Post actions");
    more.textContent = "•••";
    header.append(avatar, byline, more);
    let parentReference;
    if (post.parent_post_id) {
      const parentPost = postMap.get(post.parent_post_id);
      const parentAuthor = parentPost ? profileMap.get(parentPost.author_user_id) || {} : {};
      parentReference = document.createElement("aside");
      parentReference.className = "post-parent-reference";
      parentReference.dataset.parentPost = post.parent_post_id;
      const referenceMeta = document.createElement("div");
      referenceMeta.className = "post-parent-reference-meta";
      const referenceLabel = document.createElement("strong");
      referenceLabel.textContent = parentPost
        ? `↳ Replying to @${parentAuthor.handle || "departed-clay"}`
        : "↳ Replying to an earlier post";
      referenceMeta.append(referenceLabel);
      if (parentPost?.created_at) {
        const parentTime = document.createElement("time");
        parentTime.className = "post-parent-reference-time";
        const parentDate = validTimestamp(parentPost.created_at);
        if (parentDate) parentTime.dateTime = parentDate.toISOString();
        parentTime.textContent = postTimestampLabel(parentPost.created_at);
        parentTime.title = absoluteTimestampLabel(parentPost.created_at);
        referenceMeta.append(parentTime);
      }
      const parentPreview = document.createElement("blockquote");
      parentPreview.textContent = !parentPost
        ? "The original post is outside the current board view."
        : parentPost.deleted_at
          ? "This post was removed."
          : postPreviewText(parentPost.body) || "This post has no preview.";
      parentReference.append(referenceMeta, parentPreview);
    }
    const copy = document.createElement("p");
    renderTaggedPostBody(copy, post.body);
    const footer = document.createElement("footer");
    const reaction = document.createElement("button");
    reaction.type = "button";
    reaction.dataset.reaction = post.id;
    if (ownReactions.has(post.id)) reaction.classList.add("is-loved");
    reaction.setAttribute("aria-pressed", ownReactions.has(post.id) ? "true" : "false");
    reaction.setAttribute("aria-label", `${ownReactions.has(post.id) ? "Remove love from" : "Love"} @${author.handle || "holder"}'s post`);
    reaction.append(ownReactions.has(post.id) ? "♥ " : "♡ ");
    const count = document.createElement("span");
    count.textContent = String(reactionCounts.get(post.id) || 0);
    reaction.append(count);
    const reply = document.createElement("button");
    reply.type = "button";
    reply.className = "post-reply-button";
    reply.dataset.reply = post.id;
    reply.dataset.replyHandle = author.handle || "holder";
    reply.setAttribute("aria-label", `Reply to @${author.handle || "holder"}`);
    reply.textContent = "↳ reply";
    const replyCount = document.createElement("small");
    const totalReplies = replyCounts.get(post.id) || 0;
    replyCount.className = "post-reply-count";
    replyCount.textContent = `${totalReplies} ${totalReplies === 1 ? "reply" : "replies"}`;
    const seen = document.createElement("span");
    seen.className = "post-board-label";
    seen.textContent = post.deleted_at ? "soft deleted" : "holder board";
    footer.append(reaction, reply, replyCount, seen);
    article.append(header);
    if (parentReference) article.append(parentReference);
    article.append(copy, footer);
    feed.append(article);
  }
}

function renderMatches() {
  matchingGrid.replaceChildren();
  const allCandidates = profiles.filter((profile) => profile.user_id !== currentSession?.user.id && profile.handle && profile.account_state === "active");
  const candidates = matchingIntent === "all"
    ? allCandidates
    : allCandidates.filter((profile) => (profile.intents || []).includes(matchingIntent));
  const outgoing = new Set(squishes.filter((row) => row.actor_user_id === currentSession?.user.id).map((row) => row.target_user_id));
  const mutual = new Set(mutualMatches.map((profile) => profile.user_id));
  if (!candidates.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = matchingIntent === "all"
      ? "No other profiles yet. Invite a holder you trust."
      : `No active mudmates are here for ${matchingIntent} yet.`;
    matchingGrid.append(empty);
    return;
  }

  for (const [index, profile] of candidates.entries()) {
    const article = document.createElement("article");
    article.className = `match-card ${["match-card-peach", "match-card-green", "match-card-blue"][index % 3]}`;
    const visual = document.createElement("div");
    visual.className = "match-visual";
    visual.append(avatarElement(profile, "match-avatar"));
    const percent = document.createElement("span");
    percent.className = "match-percent";
    percent.textContent = mutual.has(profile.user_id)
      ? "mutual squish ✓"
      : isReadOnlyAccess(profile)
        ? "read-only · self-attested"
        : "holder verified";
    visual.append(percent);
    const copy = document.createElement("div");
    copy.className = "match-copy";
    const eyebrow = document.createElement("span");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = (profile.intents || ["friends"]).join(" · ");
    const title = document.createElement("h3");
    title.textContent = `@${profile.handle}`;
    appendRoleBadge(title, profile);
    markProfileTarget(title, profile);
    const accessBadge = accessBadgeElement(profile, { compact: true });
    const bio = document.createElement("p");
    bio.textContent = profile.bio || "Mysterious, but holder verified.";
    const tags = document.createElement("div");
    for (const intent of profile.intents || []) {
      const tag = document.createElement("span");
      tag.textContent = intent;
      tags.append(tag);
    }
    const footer = document.createElement("footer");
    const matchButton = document.createElement("button");
    matchButton.className = "clay-button clay-button-coral";
    matchButton.type = "button";
    matchButton.dataset.matchUser = profile.user_id;
    matchButton.textContent = outgoing.has(profile.user_id) ? "squished ✓" : "squish";
    const dmButton = document.createElement("button");
    dmButton.className = "circle-button";
    dmButton.type = "button";
    dmButton.dataset.dmUser = profile.user_id;
    dmButton.setAttribute("aria-label", `Message @${profile.handle}`);
    dmButton.textContent = mutual.has(profile.user_id) ? "↗" : "⌁";
    dmButton.disabled = !dmAccessReady;
    dmButton.title = dmAccessReady ? "" : "Sign with a Solana or Sui wallet to unlock private Signals.";
    footer.append(matchButton, dmButton);
    copy.append(eyebrow, title);
    if (accessBadge) copy.append(accessBadge);
    copy.append(bio, tags, footer);
    article.append(visual, copy);
    matchingGrid.append(article);
  }
}

function renderPeople() {
  peopleStack.replaceChildren();
  const mutual = new Set(mutualMatches.map((profile) => profile.user_id));
  const candidates = profiles.filter((profile) => profile.handle && profile.account_state === "active" && profile.user_id !== currentSession?.user.id).slice(0, 4);
  if (!candidates.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "The herd is still arriving.";
    peopleStack.append(empty);
    return;
  }
  for (const profile of candidates) {
    const article = document.createElement("article");
    article.className = "person-row";
    const avatar = avatarElement(profile);
    const copy = document.createElement("div");
    const name = document.createElement("b");
    name.textContent = `@${profile.handle}`;
    appendRoleBadge(name, profile);
    markProfileTarget(name, profile);
    const meta = document.createElement("span");
    meta.textContent = (profile.intents || ["holder"]).join(" + ");
    copy.append(name, meta);
    const accessBadge = accessBadgeElement(profile, { compact: true });
    if (accessBadge) copy.append(accessBadge);
    const dm = document.createElement("button");
    dm.type = "button";
    dm.dataset.dmUser = profile.user_id;
    dm.setAttribute("aria-label", `Message @${profile.handle}`);
    dm.textContent = mutual.has(profile.user_id) ? "↗" : "⌁";
    dm.disabled = !dmAccessReady;
    dm.title = dmAccessReady ? "" : "Sign with a Solana or Sui wallet to unlock private Signals.";
    article.append(avatar, copy, dm);
    peopleStack.append(article);
  }
}

async function createPost(event) {
  event.preventDefault();
  const message = composer.elements.post.value.trim();
  if (!message || !currentProfile?.handle) {
    if (!currentProfile?.handle) openProfileDialog();
    return;
  }
  const accessReady = await refreshAuthoritativeAccess();
  if (!accessReady || !holderSessionReady) {
    showToast("Posting access needs a fresh eligible-address or wallet check.");
    return;
  }
  if (selectedPostBackground === "custom" && !savedCustomBackgroundUrl(currentProfile, "post")) {
    showToast("Add and save a custom HTTPS post background in your profile first.");
    openProfileDialog();
    setCustomBackgroundEditorTarget("post");
    return;
  }
  const submitButton = composer.querySelector('button[type="submit"]');
  setBusy(submitButton, true, "squishing…");
  const { error } = await db.from("clay_posts").insert({
    author_user_id: currentSession.user.id,
    background: selectedPostBackground,
    body: message.slice(0, 600),
    parent_post_id: replyTargetId,
  });
  setBusy(submitButton, false);
  if (error) {
    showToast(error.message || "Post could not be squished.");
    return;
  }
  composer.reset();
  clearReplyTarget();
  await loadAppData();
  showToast("Post squished to the holder board.");
}

function setReplyTarget(postId, handle) {
  replyTargetId = postId;
  const targetPost = posts.find((post) => post.id === postId) || postReferences.get(postId);
  const preview = targetPost && !targetPost.deleted_at ? postPreviewText(targetPost.body, 96) : "";
  replyContextCopy.textContent = `Replying to @${handle || "holder"}${preview ? ` · “${preview}”` : ""}`;
  replyContext.hidden = false;
  composer.dataset.mode = "reply";
  composer.elements.post.setAttribute("aria-describedby", replyContextCopy.id);
  composer.elements.post.placeholder = `Write a reply to @${handle || "holder"}…`;
  composerSubmit.textContent = "squish reply";
  composer.elements.post.focus();
  composer.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
}

function clearReplyTarget({ focus = false } = {}) {
  replyTargetId = null;
  replyContext.hidden = true;
  replyContextCopy.textContent = "Replying to a post";
  delete composer.dataset.mode;
  composer.elements.post.removeAttribute("aria-describedby");
  composer.elements.post.placeholder = "What are we overthinking today?";
  composerSubmit.textContent = "squish post";
  if (focus) composer.elements.post.focus();
}

function renderMemberProfile(profile) {
  if (!profile) return;
  viewedProfile = profile;
  const hasCustomBackground = setRemoteBackground(memberProfileCard, "--member-background-image", savedCustomBackgroundUrl(profile, "profile"));
  memberProfileCard.dataset.background = profile.background === "custom" && !hasCustomBackground ? "dune" : profile.background || "dune";
  memberProfileAvatar.replaceChildren();
  const avatar = avatarElement(profile, "member-profile-avatar");
  markProfileTarget(avatar, null);
  memberProfileAvatar.append(avatar);
  memberProfileName.textContent = `@${profile.handle || "unnamed-clay"}`;
  appendRoleBadge(memberProfileName, profile);
  memberProfileEyebrow.textContent = isReadOnlyAccess(profile) ? "read-only mudprint · self-attested" : "verified mudprint";
  renderFeaturedAchievementSlot(memberFeaturedAchievement, profile);
  renderClayCollectSlot(memberProfileCollectLink, profile);
  memberProfileBio.textContent = profile.bio || "This creature has not written a bio yet.";
  memberProfileTags.replaceChildren(...(profile.intents || ["holder"]).map((intent) => {
    const tag = document.createElement("span");
    tag.textContent = intent;
    return tag;
  }));

  const accountState = profile.account_state || "active";
  memberAccountState.className = `member-account-state is-${accountState}`;
  memberAccountState.textContent = accountState === "active"
    ? isReadOnlyAccess(profile) ? "active read-only account" : "active holder"
    : accountState;
  const isOwnProfile = profile.user_id === currentSession?.user.id;
  const isAdmin = ["moderator", "admin"].includes(currentProfile?.role);
  const outgoing = squishes.some((row) => row.actor_user_id === currentSession?.user.id && row.target_user_id === profile.user_id);
  const mutual = mutualMatches.some((match) => match.user_id === profile.user_id);
  memberMatchButton.hidden = isOwnProfile;
  memberSignalButton.hidden = isOwnProfile;
  memberMatchButton.disabled = accountState !== "active";
  memberSignalButton.disabled = accountState !== "active" || !dmAccessReady;
  memberMatchButton.textContent = outgoing ? "squished ✓" : "squish";
  memberSignalButton.textContent = !dmAccessReady
    ? "connect a wallet for Signals"
    : mutual ? "send signal☽" : "signal after mutual squish";
  memberAdminPanel.hidden = !isAdmin || isOwnProfile;
  memberAdminStatus.textContent = `Current state: ${accountState}. Moderation actions are logged.`;
}

function openMemberProfile(userId) {
  const profile = profiles.find((candidate) => candidate.user_id === userId);
  if (!profile) {
    showToast("That holder profile is no longer available.");
    return;
  }
  memberAdminReason.value = "";
  renderMemberProfile(profile);
  if (!memberProfileDialog.open) memberProfileDialog.showModal();
}

async function openAchievementDialog(userId) {
  const profile = profiles.find((candidate) => candidate.user_id === userId);
  if (!profile || Number(profile.collect_achievement_count || 0) < 1) {
    showToast("That holder has no synced achievements yet.");
    return;
  }
  const requestId = ++achievementDialogRequestId;
  const count = Number(profile.collect_achievement_count || 0);
  achievementDialogTitle.textContent = `@${profile.handle || "holder"}'s cabinet`;
  achievementDialogStatus.textContent = `${count} earned achievement${count === 1 ? "" : "s"} · exact Solana wallet match during a user-triggered SYNC · unofficial`;
  const sourceLink = clayCollectProfileLink(profile, "open wallet-matched Collect profile ↗");
  achievementDialogSource.replaceChildren(...(sourceLink ? [sourceLink] : []));
  achievementDialogSource.hidden = !sourceLink;
  achievementDialogGrid.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "empty-state";
  loading.textContent = "Opening the synced achievement cabinet…";
  achievementDialogGrid.append(loading);
  if (!achievementDialog.open) achievementDialog.showModal();

  const { data, error } = await db.from("clay_collect_achievements")
    .select("achievement_id,name,title,description,rarity,tier,points,earned_points,claimed_at,icon_url")
    .eq("user_id", userId)
    .order("claimed_at", { ascending: false })
    .limit(500);
  if (requestId !== achievementDialogRequestId || !achievementDialog.open) return;
  if (error) {
    achievementDialogGrid.replaceChildren();
    const message = document.createElement("p");
    message.className = "empty-state";
    message.textContent = error.message || "The synced cabinet could not be opened.";
    achievementDialogGrid.append(message);
    return;
  }

  achievementDialogGrid.replaceChildren();
  for (const achievement of data || []) {
    const card = document.createElement("article");
    card.className = "achievement-card";
    const icon = normalizeClayCollectIconUrl(achievement.icon_url);
    if (icon) {
      const image = document.createElement("img");
      image.src = icon;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => {
        const fallback = document.createElement("span");
        fallback.className = "achievement-fallback";
        fallback.textContent = "★";
        fallback.setAttribute("aria-hidden", "true");
        image.replaceWith(fallback);
      }, { once: true });
      card.append(image);
    } else {
      const fallback = document.createElement("span");
      fallback.className = "achievement-fallback";
      fallback.textContent = "★";
      fallback.setAttribute("aria-hidden", "true");
      card.append(fallback);
    }
    const copy = document.createElement("div");
    const name = document.createElement("b");
    name.textContent = achievement.name || "Unnamed achievement";
    const detail = document.createElement("span");
    detail.textContent = [
      achievement.title,
      achievement.rarity,
      Number.isInteger(achievement.tier) ? `tier ${achievement.tier}` : "",
    ].filter(Boolean).join(" · ") || "earned achievement";
    const description = document.createElement("p");
    description.textContent = achievement.description || "Earned in the linked Collect profile.";
    const meta = document.createElement("small");
    const earnedPoints = Number(achievement.earned_points || achievement.points || 0);
    const claimed = new Date(achievement.claimed_at);
    meta.textContent = `${earnedPoints} pt${earnedPoints === 1 ? "" : "s"} · ${Number.isFinite(claimed.getTime()) ? claimed.toLocaleDateString() : "synced"}`;
    copy.append(name, detail, description, meta);
    card.append(copy);
    achievementDialogGrid.append(card);
  }
  if (!achievementDialogGrid.children.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No earned achievements were present in the last safe snapshot.";
    achievementDialogGrid.append(empty);
  }
}

async function moderateViewedProfile(state) {
  if (!viewedProfile || !["active", "suspended", "banned"].includes(state)) return;
  const reason = memberAdminReason.value.trim();
  if (state !== "active" && !reason) {
    memberAdminStatus.textContent = "Add a moderation reason before suspending or banning this account.";
    memberAdminReason.focus();
    return;
  }
  const handle = viewedProfile.handle || "this holder";
  const moderationCopy = state === "active"
    ? `Restore @${handle} to normal participation? This action will be recorded in the moderation log.`
    : state === "banned"
      ? `Ban @${handle}? They will be removed from matching and unable to participate normally. This action will be recorded.`
      : `Suspend @${handle}? The restriction is reversible and this action will be recorded.`;
  const confirmation = await requestClayAction({
    eyebrow: "admin moderation",
    title: state === "active" ? "Restore this holder?" : state === "banned" ? "Ban this holder?" : "Suspend this holder?",
    copy: moderationCopy,
    confirmLabel: state === "active" ? "restore account" : state === "banned" ? "ban account" : "suspend account",
  });
  if (!confirmation.confirmed) return;
  const actionButton = memberAdminPanel.querySelector(`[data-admin-member-state="${state}"]`);
  setBusy(actionButton, true, state === "active" ? "restoring…" : state === "banned" ? "banning…" : "suspending…");
  const { error } = await db.rpc("admin_set_clay_account_state", {
    raw_reason: reason.slice(0, 1000),
    raw_state: state,
    raw_user_id: viewedProfile.user_id,
  });
  setBusy(actionButton, false);
  if (error) {
    memberAdminStatus.textContent = error.message || "Moderation action failed.";
    return;
  }
  const moderatedUserId = viewedProfile.user_id;
  await loadAppData();
  const refreshed = profiles.find((profile) => profile.user_id === moderatedUserId);
  if (refreshed) renderMemberProfile(refreshed);
  memberAdminReason.value = "";
  showToast(state === "active" ? "Account restored." : state === "banned" ? "Account banned from Claymatching." : "Account suspended.");
}

async function toggleReaction(postId) {
  const existing = reactions.some((reaction) => reaction.post_id === postId && reaction.user_id === currentSession.user.id);
  const result = existing
    ? await db.from("clay_reactions").delete().eq("post_id", postId).eq("user_id", currentSession.user.id)
    : await db.from("clay_reactions").insert({ post_id: postId, user_id: currentSession.user.id });
  if (result.error) showToast(result.error.message || "Reaction failed.");
  else {
    await loadAppData();
    window.requestAnimationFrame(() => document.querySelector(`[data-reaction="${CSS.escape(postId)}"]`)?.focus());
  }
}

async function toggleSquish(targetUserId) {
  const existing = squishes.some((row) => row.actor_user_id === currentSession.user.id && row.target_user_id === targetUserId);
  const result = existing
    ? await db.from("clay_squishes").delete().eq("actor_user_id", currentSession.user.id).eq("target_user_id", targetUserId)
    : await db.from("clay_squishes").insert({ actor_user_id: currentSession.user.id, target_user_id: targetUserId });
  if (result.error) {
    showToast(result.error.message || "Squish failed.");
    return;
  }
  await loadAppData();
  const target = profiles.find((profile) => profile.user_id === targetUserId);
  const nowMutual = mutualMatches.some((profile) => profile.user_id === targetUserId);
  showToast(existing
    ? `Unsquished @${target?.handle || "holder"}.`
    : nowMutual
      ? dmAccessReady
        ? `Mutual squish with @${target?.handle}. Encrypted DMs unlocked.`
        : `Mutual squish with @${target?.handle}. Sign with Solana or Sui to unlock private Signals.`
      : `You squished @${target?.handle || "holder"}.`);
}

async function handlePostAction(postId) {
  const post = posts.find((candidate) => candidate.id === postId);
  if (!post) return;
  const isOwn = post.author_user_id === currentSession.user.id;
  const isAdmin = ["moderator", "admin"].includes(currentProfile?.role);
  if (isOwn || isAdmin) {
    const confirmation = await requestClayAction({
      eyebrow: isOwn ? "tidy the board" : "admin moderation",
      title: isOwn ? "Delete your post?" : "Remove this post?",
      copy: isOwn
        ? "This removes the post from the holder board. This cannot be undone."
        : "This removes the post as a moderation action. The action is recorded for the admin team.",
      confirmLabel: isOwn ? "delete post" : "remove post",
    });
    if (!confirmation.confirmed) return;
    const result = isOwn
      ? await db.rpc("delete_clay_post", { raw_post_id: postId })
      : await db.rpc("admin_delete_clay_post", { raw_post_id: postId, raw_reason: "Removed from Claymatching board" });
    if (result.error) showToast(result.error.message || "Post could not be removed.");
    else await loadAppData();
    return;
  }
  const report = await requestClayAction({
    eyebrow: "quietly alert the cave wardens",
    title: "Report this post?",
    copy: "Choose the closest reason and add any context that will help a moderator review it. The author is not told who reported them.",
    confirmLabel: "send report",
    mode: "report",
  });
  if (!report.confirmed) return;
  const { error } = await db.from("clay_reports").insert({
    category: report.category,
    detail: report.detail.slice(0, 1000),
    post_id: postId,
    reporter_user_id: currentSession.user.id,
    reported_user_id: post.author_user_id,
  });
  showToast(error ? error.message : "Report sent to the Claymatching moderators.");
}

function getSignalDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (existing) return existing;
    const id = `clay-web-${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_STORAGE_KEY, id);
    return id;
  } catch {
    return `clay-web-${crypto.randomUUID()}`;
  }
}

async function initializeSignalIdentityForAccount(accountId, accountHandle) {
  await refreshAuthoritativeAccess({ maxAgeMs: 5_000, requireDm: true });
  assertSignalOperationAccount(accountId);
  if (!dmAccessReady) {
    throw new Error("A signed Solana or Sui wallet is required before this device can create or register a Signal inbox.");
  }
  signalStatus.textContent = "Preparing encrypted messaging on this browser…";
  setStatusSemantics(signalStatus, false);
  signalCore ||= await import("/apps/noctweave-web-core/noctweave-core-adapter.js?v=20260715-3");
  assertSignalOperationAccount(accountId);
  const identity = await signalCore.createOrLoadSignalIdentity({
    accountHandle,
    accountId,
    displayName: signalIdentityDisplayName(accountId, accountHandle),
    registerInbox: true,
    relayUrl: SIGNAL_RELAY_URL,
  });
  assertSignalOperationAccount(accountId);
  if (!identity.contactCode || !identity.fingerprint) {
    throw new Error(identity.registrationError || "The encrypted inbox could not be registered.");
  }
  const deviceId = getSignalDeviceId();
  const { error } = await db.from("clay_signal_devices").upsert({
    contact_code: identity.contactCode,
    device_id: deviceId,
    device_label: `${navigator.platform || "Browser"} / Claymatching web`,
    key_fingerprint: identity.fingerprint,
    platform: "web",
    relay_url: identity.relayUrl || SIGNAL_RELAY_URL,
    revoked_at: null,
    user_id: accountId,
  }, { onConflict: "user_id,device_id" });
  if (error) throw error;
  assertSignalOperationAccount(accountId);
  const ownResult = await db.from("clay_signal_devices").select("device_id,contact_code,key_fingerprint,relay_url").eq("user_id", accountId).is("revoked_at", null);
  assertSignalOperationAccount(accountId);
  const ownDevices = ownResult.data || [];
  const verifiedOwnFingerprints = await Promise.all(ownDevices.map(signalDeviceFingerprint));
  assertSignalOperationAccount(accountId);
  signalIdentity = identity;
  ownSignalDevices = ownDevices;
  ownSignalFingerprints = new Set([
    String(identity.fingerprint || "").trim().toLowerCase(),
    ...verifiedOwnFingerprints,
  ].filter(Boolean));
  signalStatus.textContent = identity.registered
    ? "Encrypted inbox ready on this device."
    : `Encrypted messaging is ready locally; relay connection will retry: ${identity.registrationError || "offline"}`;
  setStatusSemantics(signalStatus, false);
  return identity;
}

async function initializeSignalIdentity() {
  const accountId = String(currentSession?.user?.id || "");
  const accountHandle = cleanUsername(currentProfile?.handle);
  if (!accountId || !accountHandle) return null;
  if (signalIdentityPromise && signalIdentityAccountId === accountId) return signalIdentityPromise;
  const initialize = () => initializeSignalIdentityForAccount(accountId, accountHandle);
  const promise = (navigator.locks?.request
    ? navigator.locks.request(`claymatching-signal-identity:${accountId}`, { mode: "exclusive" }, initialize)
    : initialize()).finally(() => {
      if (signalIdentityPromise === promise) {
        signalIdentityPromise = undefined;
        signalIdentityAccountId = "";
      }
    });
  signalIdentityPromise = promise;
  signalIdentityAccountId = accountId;
  return promise;
}

async function syncSignals({ targetDevices = [] } = {}) {
  const identity = signalIdentity || await initializeSignalIdentity();
  if (!identity) return [];
  const contactCodes = [...new Set(targetDevices.map((device) => device.contact_code).filter(Boolean))];
  const received = await signalCore.receiveSignalText({
    accountHandle: currentProfile.handle,
    accountId: currentSession.user.id,
    contactCodes,
    displayName: currentProfile.handle,
    maxCount: 50,
    signalContactCode: identity.contactCode,
  });
  if (received.receivedMessages?.length) {
    signalStatus.textContent = `${received.receivedMessages.length} encrypted signal${received.receivedMessages.length === 1 ? "" : "s"} opened on this device.`;
    setStatusSemantics(signalStatus, false);
  }
  return received.messages || [];
}

function signalCounterpartyHandle(message) {
  return signalConversationIdentity(message).handle;
}

function renderSignalInbox(messages) {
  if (!dmAccessReady) {
    signalMessages = [];
    signalInbox.hidden = true;
    signalsIntro.hidden = true;
    signalsLock.hidden = false;
    signalInboxList.replaceChildren();
    return;
  }
  const focusWasInsideIntro = signalsIntro.contains(document.activeElement);
  signalMessages = messages || [];
  const groups = new Map();
  for (const message of [...signalMessages].sort((a, b) => messageTimestamp(a) - messageTimestamp(b))) {
    const identity = signalConversationIdentity(message);
    const group = groups.get(identity.key) || { ...identity, messages: [] };
    group.messages.push(message);
    groups.set(identity.key, group);
  }

  const hasConversations = groups.size > 0;
  signalsIntro.hidden = hasConversations;
  signalInbox.hidden = !hasConversations;
  signalInboxList.replaceChildren();
  if (!hasConversations) return;
  if (focusWasInsideIntro) window.requestAnimationFrame(() => signalInboxHeading?.focus());

  const ordered = [...groups.values()].sort((a, b) => messageTimestamp(b.messages.at(-1)) - messageTimestamp(a.messages.at(-1)));
  for (const group of ordered) {
    const latest = group.messages.at(-1);
    const profile = group.profile;
    const unread = group.messages.filter(isUnreadSignalMessage).length;
    const row = document.createElement("article");
    row.className = "signal-thread";
    row.append(avatarElement(profile || { handle: group.handle }));
    const copy = document.createElement("div");
    copy.className = "signal-thread-copy";
    const name = document.createElement("b");
    name.textContent = `@${group.handle}`;
    if (profile) {
      appendRoleBadge(name, profile);
      markProfileTarget(name, profile);
    }
    const preview = document.createElement("p");
    preview.textContent = `${latest.direction === "outbox" ? "You: " : ""}${latest.message || "Encrypted signal"}`;
    copy.append(name);
    const accessBadge = accessBadgeElement(profile, { compact: true });
    if (accessBadge) copy.append(accessBadge);
    const collectLink = clayCollectProfileLink(profile);
    if (collectLink) copy.append(collectLink);
    const achievementChip = clayAchievementChip(profile);
    if (achievementChip) copy.append(achievementChip);
    copy.append(preview);
    const meta = document.createElement("div");
    meta.className = "signal-thread-meta";
    const time = document.createElement("span");
    time.textContent = relativeTime(latest.createdAt || latest.timestamp || latest.created_at);
    meta.append(time);
    if (unread) {
      const count = document.createElement("span");
      count.className = "signal-thread-unread";
      count.textContent = unread > 99 ? "99+" : String(unread);
      count.title = `${unread} unread private ${unread === 1 ? "signal" : "signals"}`;
      meta.append(count);
    }
    row.append(copy, meta);
    const open = document.createElement("button");
    open.className = "clay-button clay-button-dark";
    open.type = "button";
    if (profile && mutualMatches.some((match) => match.user_id === profile.user_id)) {
      open.dataset.dmUser = profile.user_id;
      open.textContent = "open thread";
    } else {
      open.dataset.dmHandle = group.handle;
      open.dataset.dmConversation = group.key;
      open.textContent = "open saved thread";
    }
    row.append(open);
    signalInboxList.append(row);
  }
}

async function refreshSignalInbox({ quiet = false } = {}) {
  if (!currentProfile?.handle || !currentSession) return [];
  const accountId = String(currentSession.user.id);
  if (signalRefreshPromise && signalRefreshAccountId === accountId) return signalRefreshPromise;
  const refreshPromise = (async () => {
    await refreshAuthoritativeAccess({ requireDm: true });
    if (!dmAccessReady) return [];
    return queueSignalOperation(async ({ assertCurrent }) => {
      if (!quiet) {
        signalStatus.textContent = "Checking encrypted relay inboxes…";
        setStatusSemantics(signalStatus, false);
      }
      const identity = signalIdentity || await initializeSignalIdentity();
      assertCurrent();
      const deviceResults = await Promise.all(mutualMatches.map(async (match) => ({
        match,
        result: await db.rpc("resolve_clay_signal_devices", { p_target_user_id: match.user_id }),
      })));
      assertCurrent();
      const nextProfileByFingerprint = new Map();
      const nextAmbiguousFingerprints = new Set();
      const devices = [];
      for (const { match, result } of deviceResults) {
        const profileDevices = result.data || [];
        devices.push(...profileDevices);
        await indexSignalDevicesForProfile(profileDevices, match, nextProfileByFingerprint, nextAmbiguousFingerprints);
      }
      assertCurrent();
      signalProfileByFingerprint = nextProfileByFingerprint;
      ambiguousSignalFingerprints = nextAmbiguousFingerprints;
      const visibleConversationKey = dmDialog.open ? String(currentDmTarget?.signalConversationKey || "") : "";
      let messages = await syncSignals({ targetDevices: devices });
      assertCurrent();
      messages = await migrateLegacySignalReadState(messages);
      assertCurrent();
      if (visibleConversationKey && dmDialog.open && currentDmTarget?.signalConversationKey === visibleConversationKey) {
        messages = await markSignalThreadRead(visibleConversationKey, messages);
        assertCurrent();
        if (dmDialog.open && currentDmTarget?.signalConversationKey === visibleConversationKey) renderDmMessages(messages);
      }
      assertCurrent();
      renderSignalInbox(messages);
      updateSignalUnread(messages);
      if (!quiet) {
        signalStatus.textContent = `${messages.length} locally stored encrypted signal${messages.length === 1 ? "" : "s"}. Inbox ${identity.registered ? "connected" : "will retry relay registration"}.`;
        setStatusSemantics(signalStatus, false);
      }
      return messages;
    });
  })().finally(() => {
    if (signalRefreshPromise === refreshPromise) {
      signalRefreshPromise = undefined;
      signalRefreshAccountId = "";
    }
  });
  signalRefreshPromise = refreshPromise;
  signalRefreshAccountId = accountId;
  return signalRefreshPromise;
}

async function resolveCurrentDmDevices() {
  const targetUserId = String(currentDmTarget?.user_id || "");
  if (!targetUserId) {
    currentDmDevices = [];
    throw new Error("Choose a current mutual before sending a Signal.");
  }

  const { data, error } = await db.rpc("resolve_clay_signal_devices", {
    p_target_user_id: targetUserId,
  });
  if (error) {
    currentDmDevices = [];
    throw error;
  }
  if (String(currentDmTarget?.user_id || "") !== targetUserId) {
    currentDmDevices = [];
    throw new Error("The open Signal thread changed. Open it again before sending.");
  }

  const devices = data || [];
  currentDmDevices = devices;
  if (!devices.length) {
    throw new Error("This Signal thread is no longer available. Check that you are still mutuals, neither account is blocked, and the recipient still has an active device.");
  }
  return devices;
}

async function openStoredDm(conversationKey, handle) {
  const storedHandle = cleanUsername(handle);
  const storedConversationKey = String(conversationKey || "");
  if (!storedHandle || !storedConversationKey || !dmAccessReady) return;
  if (currentDmTarget?.signalConversationKey !== storedConversationKey) dmForm.elements.message.value = "";
  currentDmTarget = {
    handle: storedHandle,
    signalConversationKey: storedConversationKey,
  };
  currentDmDevices = [];
  setDmComposerReady(false);
  dmDialog.querySelector("[data-dm-title]").textContent = `Saved Signal @${storedHandle}`;
  renderClayCollectSlot(dmCollectLink, undefined);
  dmStatus.textContent = "Opening encrypted history stored on this device…";
  setStatusSemantics(dmStatus, false);
  if (!dmDialog.open) dmDialog.showModal();
  try {
    await queueSignalOperation(async ({ assertCurrent }) => {
      assertCurrent();
      if (currentDmTarget?.signalConversationKey !== storedConversationKey) return;
      const messages = await markSignalThreadRead(storedConversationKey, signalMessages);
      assertCurrent();
      if (currentDmTarget?.signalConversationKey !== storedConversationKey) return;
      renderDmMessages(messages);
      renderSignalInbox(messages);
      updateSignalUnread(messages);
      dmStatus.textContent = "Saved encrypted history. Sending stays locked unless this creature is a current mutual with an active device.";
      setStatusSemantics(dmStatus, false);
      window.requestAnimationFrame(() => dmDialog.querySelector("[data-dm-close]")?.focus());
    });
  } catch (error) {
    if (currentDmTarget?.signalConversationKey !== storedConversationKey) return;
    dmStatus.textContent = error.message || "Saved encrypted history could not be opened.";
    setStatusSemantics(dmStatus, true);
  }
}

async function openDm(targetUserId) {
  try {
    await refreshAuthoritativeAccess({ requireDm: true });
  } catch (error) {
    showToast(error?.message || "Sign with a Solana or Sui wallet to unlock private Signals.");
    return;
  }
  const target = profiles.find((profile) => profile.user_id === targetUserId);
  if (!target) return;
  if (!mutualMatches.some((profile) => profile.user_id === targetUserId)) {
    const saved = signalMessages.map(signalConversationIdentity).find((identity) => identity.key === `profile:${targetUserId}`);
    return saved ? openStoredDm(saved.key, saved.handle) : undefined;
  }
  if (currentDmTarget?.signalConversationKey !== `profile:${target.user_id}`) dmForm.elements.message.value = "";
  currentDmTarget = {
    ...target,
    signalConversationKey: `profile:${target.user_id}`,
  };
  currentDmDevices = [];
  setDmComposerReady(false);
  dmDialog.querySelector("[data-dm-title]").textContent = `Signal @${target.handle}`;
  renderClayCollectSlot(dmCollectLink, target);
  dmStatus.textContent = "Opening this device's encrypted inbox…";
  setStatusSemantics(dmStatus, false);
  dmThread.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "empty-state";
  loading.textContent = "Decrypting local conversation history…";
  dmThread.append(loading);
  dmDialog.showModal();
  const expectedTargetUserId = String(target.user_id);
  try {
    await queueSignalOperation(async ({ assertCurrent }) => {
      if (String(currentDmTarget?.user_id || "") !== expectedTargetUserId) return;
      const targetDevices = await resolveCurrentDmDevices();
      assertCurrent();
      if (String(currentDmTarget?.user_id || "") !== expectedTargetUserId) return;
      await initializeSignalIdentity();
      assertCurrent();
      if (String(currentDmTarget?.user_id || "") !== expectedTargetUserId) return;
      await indexSignalDevicesForProfile(targetDevices, target);
      if (String(currentDmTarget?.user_id || "") !== expectedTargetUserId) return;
      let messages = await syncSignals({ targetDevices });
      assertCurrent();
      if (String(currentDmTarget?.user_id || "") !== expectedTargetUserId) return;
      messages = await migrateLegacySignalReadState(messages);
      assertCurrent();
      if (String(currentDmTarget?.user_id || "") !== expectedTargetUserId) return;
      messages = await markSignalThreadRead(`profile:${target.user_id}`, messages);
      assertCurrent();
      if (String(currentDmTarget?.user_id || "") !== expectedTargetUserId) return;
      renderDmMessages(messages);
      renderSignalInbox(messages);
      updateSignalUnread(messages);
      dmStatus.textContent = "End-to-end encrypted. The relay only sees encrypted data, not this text.";
      setStatusSemantics(dmStatus, false);
      setDmComposerReady(true);
      window.requestAnimationFrame(() => dmForm.elements.message.focus());
    });
  } catch (error) {
    if (String(currentDmTarget?.user_id || "") !== expectedTargetUserId) return;
    const saved = signalMessages.map(signalConversationIdentity).find((identity) => identity.key === `profile:${target.user_id}`);
    if (saved) return openStoredDm(saved.key, saved.handle);
    dmStatus.textContent = error.message || "Encrypted conversation could not be opened.";
    setStatusSemantics(dmStatus, true);
    setDmComposerReady(false);
    renderDmMessages([]);
  }
}

function setDmComposerReady(ready) {
  dmForm.elements.message.disabled = !ready;
  dmSubmitButton.disabled = !ready;
}

function renderDmMessages(messages) {
  dmThread.replaceChildren();
  const targetConversationKey = String(currentDmTarget?.signalConversationKey || "");
  const conversation = (messages || [])
    .filter((message) => signalConversationIdentity(message).key === targetConversationKey)
    .slice(0, 60)
    .reverse();
  if (!conversation.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No signals with this creature yet.";
    dmThread.append(empty);
    return;
  }
  for (const message of conversation) {
    const bubble = document.createElement("article");
    const direction = signalMessageDirection(message);
    bubble.className = `dm-bubble ${direction === "outbox" ? "is-outbox" : "is-inbox"}`;
    const meta = document.createElement("small");
    meta.textContent = `${direction === "outbox" ? "you" : currentDmTarget.handle} · ${relativeTime(message.createdAt || message.timestamp)}`;
    const copy = document.createElement("p");
    copy.textContent = message.message;
    bubble.append(meta, copy);
    dmThread.append(bubble);
  }
  dmThread.scrollTop = dmThread.scrollHeight;
}

async function sendDm(event) {
  event.preventDefault();
  try {
    await refreshAuthoritativeAccess({ requireDm: true });
  } catch (error) {
    dmStatus.textContent = error?.message || "A signed Solana or Sui wallet is required for private Signals.";
    setStatusSemantics(dmStatus, true);
    return;
  }
  const message = dmForm.elements.message.value.trim();
  const targetUserId = String(currentDmTarget?.user_id || "");
  const targetHandle = cleanUsername(currentDmTarget?.handle);
  const targetProfile = currentDmTarget ? { ...currentDmTarget } : undefined;
  const senderAccountId = String(currentSession?.user?.id || "");
  const senderHandle = cleanUsername(currentProfile?.handle);
  if (!message || !targetUserId || !targetHandle || !senderAccountId || !senderHandle) return;
  if (/seed\s+phrase|private\s+key/i.test(message)) {
    dmStatus.textContent = "Credential or seed-phrase language is blocked. Never share wallet secrets.";
    setStatusSemantics(dmStatus, true);
    return;
  }
  const submitButton = dmForm.querySelector('button[type="submit"]');
  setBusy(submitButton, true, "sealing signal…");
  try {
    await queueSignalOperation(async ({ accountId, assertCurrent }) => {
      if (accountId !== senderAccountId) return;
      if (String(currentDmTarget?.user_id || "") !== targetUserId) return;
      const targetDevices = await resolveCurrentDmDevices();
      assertCurrent();
      if (String(currentDmTarget?.user_id || "") !== targetUserId) return;
      const identity = signalIdentity || await initializeSignalIdentity();
      assertCurrent();
      if (String(currentDmTarget?.user_id || "") !== targetUserId) return;
      const verifiedRecipients = await indexSignalDevicesForProfile(targetDevices, targetProfile);
      assertCurrent();
      if (accountId !== senderAccountId) return;
      if (String(currentDmTarget?.user_id || "") !== targetUserId) return;
      if (!verifiedRecipients.length) {
        throw new Error("This mutual has no verified Signal device yet. Ask them to reopen Claymatching and try again.");
      }
      const sent = await signalCore.sendSignalText({
        accountHandle: senderHandle,
        accountId: senderAccountId,
        displayName: senderHandle,
        message: message.slice(0, 600),
        recipientContactCodes: verifiedRecipients.map(({ device }) => device.contact_code),
        recipientFingerprint: verifiedRecipients[0].fingerprint,
        recipientHandle: `@${targetHandle}`,
        senderContactCodes: [...ownSignalDevices].map((device) => device.contact_code),
        signalContactCode: identity.contactCode,
        subject: "claymatching signal",
      });
      assertCurrent();
      renderSignalInbox(sent.messages || []);
      updateSignalUnread(sent.messages || []);
      if (String(currentDmTarget?.user_id || "") !== targetUserId) return;
      dmForm.elements.message.value = "";
      renderDmMessages(sent.messages || []);
      dmStatus.textContent = `Encrypted signal delivered to ${sent.deviceCount || 1} device${sent.deviceCount === 1 ? "" : "s"}.`;
      setStatusSemantics(dmStatus, false);
    });
  } catch (error) {
    dmStatus.textContent = error.message || "Encrypted signal could not be delivered.";
    setStatusSemantics(dmStatus, true);
    if (!currentDmDevices.length) setDmComposerReady(false);
  } finally {
    setBusy(submitButton, false);
    if (!dmDialog.open || String(currentDmTarget?.user_id || "") !== targetUserId) setDmComposerReady(false);
  }
}

async function checkEncryptedInbox() {
  if (!dmAccessReady) {
    showToast("Sign with a Solana or Sui wallet to unlock private Signals.");
    return;
  }
  try {
    await refreshSignalInbox();
    window.requestAnimationFrame(() => (signalInbox.hidden ? signalStatus : signalInboxHeading)?.focus());
  } catch (error) {
    signalStatus.textContent = error.message || "Encrypted inbox check failed.";
    setStatusSemantics(signalStatus, true);
  }
}

function setView(view, { scroll = false } = {}) {
  const validView = ["board", "matching", "signals"].includes(view) ? view : "board";
  document.querySelectorAll("[data-view]").forEach((section) => {
    section.hidden = section.dataset.view !== validView;
  });
  document.querySelectorAll("[data-view-button]").forEach((button) => {
    const selected = button.dataset.viewButton === validView;
    button.classList.toggle("is-active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, validView);
  } catch {
    // Navigation still works when private browsing blocks storage.
  }
  if (validView === "signals" && holderSessionReady && !dmAccessReady) {
    signalsIntro.hidden = true;
    signalInbox.hidden = true;
    signalDirectory.hidden = true;
    signalsLock.hidden = false;
  }
  if (validView === "signals" && dmAccessReady && currentSession && currentProfile?.handle) {
    refreshSignalInbox({ quiet: true }).catch(() => {});
  }
  if (scroll) window.scrollTo({ top: 0, behavior: preferredScrollBehavior() });
}

async function finishEmailTokenFromUrl() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const authError = url.searchParams.get("error_description") || hash.get("error_description");
  if (authError) setAuthEntryStatus(authError, { error: true });
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (!tokenHash || !["email", "email_change"].includes(type)) return;
  const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) throw error;
}

async function loadAuthCapabilities() {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      cache: "no-store",
    });
    if (!response.ok) return;
    const settings = await response.json();
    appleAuthEnabled = settings?.external?.apple === true;
    appleSigninButton.disabled = !appleAuthEnabled;
    if (!appleAuthEnabled) {
      setAuthEntryStatus("Passwordless email is ready. Apple is waiting for its Apple Developer credentials; passkeys are for returning unlocked holders.");
    }
  } catch {
    appleAuthEnabled = null;
  }
}

walletButton.addEventListener("click", handleWalletButton);
walletButton.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowDown" || !currentSession || !holderSessionReady) return;
  event.preventDefault();
  setAccountMenuOpen(true, { focus: true });
});
accountMenu.addEventListener("keydown", (event) => {
  const items = [...accountMenu.querySelectorAll('[role="menuitem"]:not(:disabled)')];
  if (!items.length) return;
  const currentIndex = Math.max(0, items.indexOf(document.activeElement));
  let nextIndex;
  if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
  else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = items.length - 1;
  else return;
  event.preventDefault();
  items[nextIndex].focus();
});
accountArea.addEventListener("focusout", (event) => {
  // Some touch/Safari clicks never move focus to the pressed menu button.
  // Waiting a frame could therefore hide the button before its
  // click event fired. A real relatedTarget preserves keyboard auto-close;
  // outside-click and Escape already cover pointer and null-focus cases.
  if (event.relatedTarget && !accountArea.contains(event.relatedTarget)) {
    setAccountMenuOpen(false);
  }
});
connectHeroButton.addEventListener("click", beginSignIn);
consentForm.addEventListener("submit", submitConsent);
document.querySelector("[data-consent-close]").addEventListener("click", () => consentDialog.close());
consentDialog.addEventListener("close", () => {
  if (!holderSessionReady || provisionalActivationMode) {
    provisionalWalletActivation = false;
    provisionalActivationMode = "";
    pendingConsentSession = null;
  }
});
provisionalPreviewForm.addEventListener("submit", previewProvisionalSolanaAddress);
provisionalAddressInput.addEventListener("input", () => {
  if (!provisionalPreviewPending && !provisionalPreviewAddress && !provisionalPreviewAssets.length) return;
  resetProvisionalPreview({
    preserveInput: true,
    status: "Address changed. Press preview again before choosing read-only access.",
  });
});
provisionalReadOnlyButton.addEventListener("click", startProvisionalReadOnlyActivation);
provisionalVerifyButton.addEventListener("click", startProvisionalWalletActivation);
provisionalSignOutButton.addEventListener("click", signOut);
profileForm.addEventListener("submit", saveProfile);
profileForm.elements.customProfileBackgroundUrl.addEventListener("input", () => {
  const valid = setRemoteBackground(customProfileBackgroundPreview, "--custom-background-image", profileForm.elements.customProfileBackgroundUrl.value);
  setRemoteBackground(customProfileBackgroundSample, "--custom-profile-preview-image", profileForm.elements.customProfileBackgroundUrl.value);
  if (valid) profileForm.querySelector('input[name="background"][value="custom"]').checked = true;
});
profileForm.elements.customPostBackgroundUrl.addEventListener("input", () => {
  setRemoteBackground(customPostBackgroundSample, "--custom-post-preview-image", profileForm.elements.customPostBackgroundUrl.value);
});
profileForm.querySelectorAll('input[name="customBackgroundTarget"]').forEach((input) => {
  input.addEventListener("change", () => setCustomBackgroundEditorTarget(input.value));
});
accountProfileButton.addEventListener("click", openAccountProfile);
accountSignOutButton.addEventListener("click", signOut);
emailSigninForm.addEventListener("submit", requestEmailCode);
verifyEmailCodeButton.addEventListener("click", verifyEmailCode);
resetEmailCodeButton.addEventListener("click", resetEmailCodeEntry);
emailSigninForm.elements.otp.addEventListener("input", (event) => {
  event.target.value = cleanOtp(event.target.value);
});
emailSigninForm.elements.otp.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  verifyEmailCode();
});
passkeySigninButton.addEventListener("click", signInWithPasskey);
appleSigninButton.addEventListener("click", signInWithApple);
linkEmailButton.addEventListener("click", linkEmailToHolder);
verifyLinkEmailButton.addEventListener("click", verifyLinkedEmailCode);
linkEmailCodeInput.addEventListener("input", (event) => {
  event.target.value = cleanOtp(event.target.value);
});
linkEmailCodeInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  verifyLinkedEmailCode();
});
registerPasskeyButton.addEventListener("click", registerHolderPasskey);
linkAppleButton.addEventListener("click", linkAppleToHolder);
linkSolanaWalletButton.addEventListener("click", startProvisionalWalletActivation);
linkSuiWalletButton.addEventListener("click", linkConnectedSuiWallet);
syncPopkinsButton.addEventListener("click", syncLinkedPopkins);
unlinkSuiWalletButton.addEventListener("click", unlinkSuiWallet);
for (const button of avatarCollectionButtons) {
  button.addEventListener("click", () => {
    activeAvatarCollection = button.dataset.avatarCollection === "popkin" ? "popkin" : "clayno";
    applyAvatarCollectionFilter();
  });
  button.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const currentIndex = avatarCollectionButtons.indexOf(button);
    const nextButton = avatarCollectionButtons[(currentIndex + direction + avatarCollectionButtons.length) % avatarCollectionButtons.length];
    nextButton?.click();
    nextButton?.focus();
  });
}
saveCollectProfileButton.addEventListener("click", saveClayCollectProfile);
syncCollectAchievementsButton.addEventListener("click", syncClayCollectAchievements);
unlinkCollectProfileButton.addEventListener("click", unlinkClayCollectProfile);
collectProfileInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  saveClayCollectProfile();
});
dmForm.addEventListener("submit", sendDm);
document.querySelector("[data-dm-close]").addEventListener("click", () => {
  setDmComposerReady(false);
  dmDialog.close();
});
dmDialog.addEventListener("close", () => {
  setDmComposerReady(false);
  dmForm.elements.message.value = "";
  currentDmTarget = undefined;
  currentDmDevices = [];
});
document.querySelector("[data-member-profile-close]").addEventListener("click", () => memberProfileDialog.close());
document.querySelector("[data-achievement-close]").addEventListener("click", () => achievementDialog.close());
achievementDialog.addEventListener("close", () => { achievementDialogRequestId += 1; });
document.querySelector("[data-action-close]").addEventListener("click", () => actionDialog.close("cancel"));
actionCancelButton.addEventListener("click", () => actionDialog.close("cancel"));
actionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  actionDialog.close("confirm");
});
actionDialog.addEventListener("close", () => {
  const result = {
    confirmed: actionDialog.returnValue === "confirm",
    category: actionCategory.value || "other",
    detail: actionDetail.value.trim(),
  };
  const resolve = actionDialogResolve;
  const returnFocus = actionDialogReturnFocus;
  actionDialogResolve = undefined;
  actionDialogReturnFocus = undefined;
  resolve?.(result);
  window.requestAnimationFrame(() => {
    if (returnFocus?.isConnected) returnFocus.focus();
  });
});
window.addEventListener("claymatching:sui-wallet", (event) => {
  connectedSuiWallet = event.detail || null;
  renderSuiConnection();
});
memberMatchButton.addEventListener("click", async () => {
  if (!viewedProfile) return;
  const userId = viewedProfile.user_id;
  await toggleSquish(userId);
  const refreshed = profiles.find((profile) => profile.user_id === userId);
  if (refreshed) renderMemberProfile(refreshed);
});
memberSignalButton.addEventListener("click", () => {
  if (!viewedProfile) return;
  const userId = viewedProfile.user_id;
  memberProfileDialog.close();
  openDm(userId);
});
document.querySelectorAll("[data-admin-member-state]").forEach((button) => {
  button.addEventListener("click", () => moderateViewedProfile(button.dataset.adminMemberState));
});
document.querySelectorAll("[data-edit-profile]").forEach((button) => button.addEventListener("click", openProfileDialog));
document.querySelectorAll("[data-view-button]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewButton, { scroll: true })));
document.querySelectorAll("[data-view-shortcut]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewShortcut, { scroll: true })));
matchingFilter?.addEventListener("change", () => {
  matchingIntent = ["friends", "memes", "lore", "dating"].includes(matchingFilter.value) ? matchingFilter.value : "all";
  renderMatches();
});
document.querySelectorAll("[data-post-background]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedPostBackground = button.dataset.postBackground;
    document.querySelectorAll("[data-post-background]").forEach((swatch) => {
      const selected = swatch === button;
      swatch.classList.toggle("is-selected", selected);
      swatch.setAttribute("aria-pressed", String(selected));
    });
  });
});
composer.addEventListener("submit", createPost);
document.querySelector("[data-cancel-reply]").addEventListener("click", () => clearReplyTarget({ focus: true }));
document.querySelector("[data-open-signals]").addEventListener("click", checkEncryptedInbox);
openWalletLinksButton.addEventListener("click", async () => {
  setView("board", { scroll: true });
  await openAccountProfile();
});
document.querySelectorAll("[data-compose-signal]").forEach((button) => button.addEventListener("click", showSignalComposer));
document.querySelector("[data-close-signal-directory]").addEventListener("click", () => {
  signalDirectory.hidden = true;
  const returnFocus = signalDirectoryReturnFocus;
  signalDirectoryReturnFocus = undefined;
  window.requestAnimationFrame(() => {
    if (returnFocus?.isConnected) returnFocus.focus();
  });
});
notificationBadge.addEventListener("click", (event) => {
  event.stopPropagation();
  hideAchievementTooltip();
  setNotificationMenuOpen(notificationMenu.hidden, { focusFirst: event.detail === 0 });
});
notificationMenu.addEventListener("toggle", (event) => {
  const isOpen = event.newState === "open" || notificationMenu.matches(":popover-open");
  notificationBadge.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) scheduleNotificationMenuPosition();
  else notificationMenu.hidden = true;
});
notificationMenu.addEventListener("keydown", (event) => {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const items = [...notificationMenu.querySelectorAll('button:not([hidden]):not(:disabled)')];
  if (!items.length) return;
  event.preventDefault();
  const currentIndex = items.indexOf(document.activeElement);
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? items.length - 1
      : event.key === "ArrowDown"
        ? (currentIndex + 1 + items.length) % items.length
        : (currentIndex - 1 + items.length) % items.length;
  items[nextIndex].focus();
});
profileNotifications.addEventListener("focusout", () => {
  window.requestAnimationFrame(() => {
    if (!profileNotifications.contains(document.activeElement) && !notificationMenu.contains(document.activeElement)) {
      setNotificationMenuOpen(false);
    }
  });
});
notificationBoardAction.addEventListener("click", async (event) => {
  event.stopPropagation();
  const targetPostId = unreadBoardNotifications()[0]?.post_id;
  setNotificationMenuOpen(false);
  setView("board", { scroll: true });
  await markMentionNotificationsRead();
  requestAnimationFrame(() => {
    const target = targetPostId ? document.querySelector(`[data-post-id="${CSS.escape(targetPostId)}"]`) : null;
    if (!target) return boardHeading.focus();
    target.tabIndex = -1;
    target.scrollIntoView({ behavior: preferredScrollBehavior(), block: "center" });
    target.focus({ preventScroll: true });
  });
});
notificationSignalAction.addEventListener("click", (event) => {
  event.stopPropagation();
  setNotificationMenuOpen(false);
  setView("signals", { scroll: true });
  window.requestAnimationFrame(() => signalsHeading.focus());
});

document.addEventListener("pointerover", (event) => {
  if (event.pointerType === "touch") return;
  const trigger = event.target.closest?.("[data-achievement-tooltip]");
  if (!trigger || trigger === activeAchievementTooltipTrigger || trigger.contains(event.relatedTarget)) return;
  showAchievementTooltip(trigger);
});
document.addEventListener("pointerout", (event) => {
  if (!activeAchievementTooltipTrigger || activeAchievementTooltipTrigger.contains(event.relatedTarget)) return;
  hideAchievementTooltip();
});
document.addEventListener("focusin", (event) => {
  const trigger = event.target.closest?.("[data-achievement-tooltip]");
  if (trigger) showAchievementTooltip(trigger);
});
document.addEventListener("focusout", (event) => {
  if (!activeAchievementTooltipTrigger || activeAchievementTooltipTrigger.contains(event.relatedTarget)) return;
  hideAchievementTooltip();
});
document.addEventListener("scroll", scheduleAchievementTooltipPosition, true);
window.addEventListener("resize", scheduleAchievementTooltipPosition);
window.visualViewport?.addEventListener("resize", scheduleAchievementTooltipPosition);
window.visualViewport?.addEventListener("scroll", scheduleAchievementTooltipPosition);
document.addEventListener("scroll", scheduleNotificationMenuPosition, true);
window.addEventListener("resize", scheduleNotificationMenuPosition);
window.visualViewport?.addEventListener("resize", scheduleNotificationMenuPosition);
window.visualViewport?.addEventListener("scroll", scheduleNotificationMenuPosition);

document.addEventListener("click", async (event) => {
  if (!accountArea.contains(event.target)) setAccountMenuOpen(false);
  if (!profileNotifications.contains(event.target)) setNotificationMenuOpen(false);
  const achievements = event.target.closest("[data-achievements-user]");
  if (achievements) {
    hideAchievementTooltip();
    return openAchievementDialog(achievements.dataset.achievementsUser);
  }
  const profileTarget = event.target.closest("[data-profile-user]");
  if (profileTarget) return openMemberProfile(profileTarget.dataset.profileUser);
  const reaction = event.target.closest("[data-reaction]");
  if (reaction) return toggleReaction(reaction.dataset.reaction);
  const reply = event.target.closest("[data-reply]");
  if (reply) {
    setReplyTarget(reply.dataset.reply, reply.dataset.replyHandle);
    return;
  }
  const match = event.target.closest("[data-match-user]");
  if (match) return toggleSquish(match.dataset.matchUser);
  const dm = event.target.closest("[data-dm-user]");
  if (dm) return openDm(dm.dataset.dmUser);
  const storedDm = event.target.closest("[data-dm-handle]");
  if (storedDm) return openStoredDm(storedDm.dataset.dmConversation, storedDm.dataset.dmHandle);
  const postAction = event.target.closest("[data-post-action]");
  if (postAction) return handlePostAction(postAction.dataset.postAction);
  if (event.target.closest("[data-prompt-reply]")) {
    setView("board", { scroll: true });
    composer.elements.post.focus();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideAchievementTooltip();
  if (event.key === "Escape" && !notificationMenu.hidden) {
    setNotificationMenuOpen(false);
    notificationBadge.focus();
    return;
  }
  if (event.key === "Escape" && replyTargetId && composer.contains(document.activeElement)) {
    clearReplyTarget({ focus: true });
    return;
  }
  const profileTarget = event.target.closest?.("[data-profile-user]");
  if (profileTarget && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    openMemberProfile(profileTarget.dataset.profileUser);
    return;
  }
  if (event.key === "Escape" && !accountMenu.hidden) {
    setAccountMenuOpen(false);
    walletButton.focus();
  }
});

setView(storedView());
updateWalletHeader();
setHolderNavigationLocked(true);
renderEmailTurnstile();
try {
  const savedEmail = String(window.localStorage.getItem(EMAIL_OTP_STORAGE_KEY) || "").trim().toLowerCase();
  if (savedEmail) showEmailCodeEntry(savedEmail, { focus: false });
} catch {
  // A fresh request can still be made when storage is unavailable.
}

if (!db) {
  showToast("Supabase did not load. Refresh before connecting a wallet.");
} else {
  db.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      authRebindUserId = "";
      resetApp();
      return;
    }
    if (!session?.user) return;
    const previousUserId = String(currentSession?.user?.id || "");
    const nextUserId = String(session.user.id || "");
    if (previousUserId && nextUserId && previousUserId !== nextUserId) {
      queueAuthenticatedSessionRebind(session);
      return;
    }
    currentSession = session;
  });
  await loadAuthCapabilities();
  try {
    await finishEmailTokenFromUrl();
  } catch (emailError) {
    setAuthEntryStatus(emailError.message || "That email link is invalid or expired.", { error: true });
  }
  const { data, error } = await db.auth.getSession();
  if (error) {
    showToast("The saved wallet session could not be restored. Connect again.");
  } else if (data.session) {
    try {
      await restoreSession(data.session);
    } catch (restoreError) {
      showToast(restoreError.message || "The holder session expired. Connect again.");
      await db.auth.signOut({ scope: "local" });
      resetApp();
    }
  } else {
    connectWallet({ silent: true });
  }
}
