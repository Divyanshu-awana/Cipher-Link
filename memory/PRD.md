# CipherLink — Product Requirements (MVP v1)

## Vision
A secure, AI-integrated mobile messenger with an embedded GPT-4o assistant
called **Cipher**. Built on Expo (React Native) + FastAPI + MongoDB.

## Stack
- Frontend: Expo SDK 54 / React Native 0.81 / expo-router (file-based)
- Backend: FastAPI + Motor (MongoDB)
- AI: OpenAI GPT-4o via Emergent Universal LLM key (`emergentintegrations`)
- Auth: JWT (email/password) + Emergent Google OAuth
- Storage: base64 in MongoDB (S3 omitted for MVP)
- Real-time: 3.5s polling fallback (WebSockets omitted for MVP)
- Push: omitted for MVP

## Implemented features
**Auth & Onboarding**
- Email/password registration + login
- Google OAuth via Emergent (login screen "Continue with Google")
- Profile setup (avatar, bio) and 3-slide onboarding tour
- 2FA TOTP (QR code, secret, 6-digit verify) — pyotp + qrcode

**Messaging**
- 1-to-1 and group conversations with admin tracking
- Message types: text, image (base64), audio placeholder + waveform, document
- Reply, edit (with edit history), delete, react with emoji
- Delivery status ✓/✓✓/✓✓ blue (sent/delivered/read)
- Long-press context menu (reply/copy/edit/delete + 6 reactions)
- 3.5s polling refresh; read-all on focus
- Attachment picker bottom sheet (camera/gallery/file/audio)

**Cipher AI**
- @Cipher prefix detection in chat input
- Floating Cipher FAB on chat screen with prompt modal + suggestion chips
- Structured JSON responses (intent + summary + cards)
- Card types: restaurant (image, rating, ₹/$, distance, Book Now),
  weather (icon + 4-day forecast), calendar (date block + Meet link),
  reminder, general
- Session-scoped multi-turn context (LlmChat session_id =
  `cipher-{conversation_id}`) — supports follow-ups like
  "What about a cheaper option?"
- Graceful fallback ("Cipher is running in limited mode") on LLM failure

**Tabs**
- Chats (with FAB, swipe/long-press for mute/delete, online dot, unread badge)
- Groups (group list + FAB to /group-create)
- Search (filter pills All/Messages/Contacts/AI Chats; debounced live search)
- Profile (avatar pick, theme toggle, 2FA toggle, sign-out, GDPR delete)

## Not in scope (mocked or omitted)
- Real Google Places / Yelp / OpenTable / Weather / Google Calendar APIs
  (LLM generates plausible cards instead — MOCKED)
- Real-time WebSockets (replaced with 3.5s polling — MOCKED)
- FCM push notifications — OMITTED
- AWS S3 media storage — OMITTED (base64 in Mongo)
- Phone OTP / SMS verification — OMITTED
- Certificate pinning, AES-256-at-rest — OMITTED for MVP

## Test users (password = `Test1234`)
alice@cipherlink.app · bob@cipherlink.app · cara@cipherlink.app · dan@cipherlink.app
