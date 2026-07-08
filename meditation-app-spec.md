# Personalized Meditation App — Specification & Requirements

## 1. Overview

A cross-platform mobile application built with React Native that allows users to generate fully personalized, AI-narrated meditation sessions on demand. The user describes their current mood or desired outcome in natural language, and the app produces a custom meditation script via Google Gemini and reads it aloud using a text-to-speech API.

> **Development & Testing:** Day-to-day on-device testing uses **Expo Go** (`npx expo start`, then scan the QR code on the phone). As of SDK 56, every package in the prototype stack — `expo-audio`, `expo-router`, `@supabase/supabase-js`, AsyncStorage, Zustand — is included in Expo Go, so no development build is required for the prototype. A Development Build becomes necessary only when native code outside Expo Go is added (e.g., Google Sign-In, post-prototype) and for store distribution. Build commands at that point: `npx expo run:android` locally (requires Android Studio), and EAS Build for iOS — `npx expo run:ios` requires macOS/Xcode and cannot run on a Windows development machine.

---

## 2. Goals

### Prototype Goals (Phase 1)
- Authenticate users (login / account creation)
- Accept a free-text prompt describing what kind of meditation the user wants
- Send the prompt to Google Gemini API and receive a generated meditation script
- Pass the generated script to the ElevenLabs text-to-speech (TTS) API and play the audio back to the user

### Future Goals (Post-Prototype)
- Meditation history / session library
- Favorite sessions and saved scripts
- Background music / ambient sound layering
- Personalization over time (learning user preferences)
- Scheduled / reminder-based sessions
- Offline mode

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Mobile Framework | React Native |
| On-Device Testing | Expo Go for the prototype (entire stack is included in Expo Go on SDK 56). Development Build (`npx expo run:android` locally; EAS Build for iOS from Windows) only once native modules outside Expo Go are added |
| Language | TypeScript |
| Navigation | Expo Router (bundled with SDK 56 — `~56.2.x`; Expo now uses unified SDK versioning, so `expo-*` package versions track the SDK number, not standalone majors like "v4") |
| Authentication | Supabase Authentication (email/password; Google Sign-In is post-prototype) |
| Backend / Database | Supabase (user profiles, session history) |
| AI Script Generation | Google Gemini API via the `@google/genai` SDK (the older `@google/generative-ai` SDK is deprecated) |
| Text-to-Speech | ElevenLabs |
| Backend Proxy | Supabase Edge Functions (all external API calls route through here) |
| State Management | Zustand (v5.x) with Immer middleware |
| Audio Playback | expo-audio (replaces deprecated expo-av; included in Expo Go on SDK 56) |
| Audio Storage | Supabase Storage (Edge Function uploads generated MP3 here; app receives a signed URL) |
| Environment/Secrets | Supabase Secrets (`supabase secrets set`) for server-side keys; `EXPO_PUBLIC_*` variables in `.env` for Supabase URL/publishable key (accessed via `process.env.EXPO_PUBLIC_SUPABASE_URL` — no expo-constants needed) |

> All major architectural decisions are now resolved. See Section 9 for full Zustand specifications.

---

## 4. User Roles

| Role | Description |
|---|---|
| Guest | Can view the app's onboarding/splash screen only; must create an account to use features |
| Authenticated User | Full access to meditation generation, playback, and account settings |

---

## 5. Screens & User Flows

### 5.1 Onboarding / Splash Screen
- App logo and name displayed on launch
- Options: **Log In** or **Create Account**

### 5.2 Authentication
- **Create Account:** Email, password, display name; email verification optional for prototype (disable "Confirm email" in the Supabase Auth dashboard for the prototype — otherwise new sign-ups cannot log in until they click the verification link)
- **Log In:** Email + password
- **Forgot Password:** Password reset via email (Supabase)
- On success, navigate to the Home screen

### 5.3 Home Screen
- Welcome message with the user's display name
- Prominent call-to-action: "Start a Meditation"
- (Post-prototype) Recent sessions list

### 5.4 Meditation Prompt Screen
- Large text input field with placeholder text (e.g., *"I'm feeling anxious and want to calm down…"*)
- Optional: duration selector (5 min / 10 min / 15 min / custom) — guides Gemini prompt length
- **Generate** button
- Loading / generation state shown while waiting for the API response

### 5.5 Meditation Playback Screen
- Displays the generated meditation script (scrollable)
- Audio playback controls: Play, Pause, Replay, Stop
- Progress bar showing audio position
- Option to save the session (post-prototype)
- Back / Cancel navigation

### 5.6 Account / Settings Screen
- Display name and email
- Log Out
- (Post-prototype) Notification preferences, voice preference, theme

---

## 6. Functional Requirements

### 6.1 Authentication
- FR-AUTH-01: Users must be able to create a new account with email and password.
- FR-AUTH-02: Users must be able to log in with existing credentials.
- FR-AUTH-03: Sessions must persist across app restarts (user stays logged in).
- FR-AUTH-04: Users must be able to log out.
- FR-AUTH-05: Passwords must meet a minimum length of 8 characters.

### 6.2 Meditation Script Generation (Gemini API)
- FR-GEN-01: The app must send the user's text prompt to the Gemini API.
- FR-GEN-02: The system prompt sent to Gemini must instruct it to generate a calm, guided meditation script suitable for audio narration (no markdown, no headers, no lists — plain flowing prose only).
- FR-GEN-03: If a duration is selected by the user, the prompt must include an instruction to target approximately that length.
- FR-GEN-04: The app must display an error message if the API call fails (network error, quota exceeded, invalid response).
- FR-GEN-05: The generated script must be displayed on the playback screen before or alongside audio playback.

### 6.3 Text-to-Speech Playback
- FR-TTS-01: The generated script must be sent to the ElevenLabs TTS API and returned as audio.
- FR-TTS-02: The user must be able to play, pause, and replay the audio.
- FR-TTS-03: A progress indicator must display the current position of the audio.
- FR-TTS-04: Audio must play through the device speaker by default, with headphone support. On iOS, `setAudioModeAsync({ playsInSilentMode: true })` (from `expo-audio`) must be called once at app startup — without it, playback is silently muted whenever the hardware ring/silent switch is set to silent, which presents as "audio doesn't play" with no error.
- FR-TTS-05: The app must display an error message if the TTS API call fails.

### 6.4 Navigation
- FR-NAV-01: Unauthenticated users must never be able to reach `(app)` routes. Implemented with Expo Router's **`Stack.Protected`** guards in the root layout (`app/_layout.tsx`): `<Stack.Protected guard={!!session}>` wraps the `(app)` group screen and `<Stack.Protected guard={!session}>` wraps the `(auth)` group screen, with the guard condition read from `authStore`. This is the officially recommended pattern (SDK 53+) — do **not** use the older `router.replace('/login')`-inside-`useEffect` approach, and no `<PrivateRoute>` wrapper is needed. When auth state changes, the guard automatically redirects.
- FR-NAV-02: Authenticated users must land on the Home screen after login.
- FR-NAV-03: The back button on the Playback screen must stop audio before navigating away. Implemented via a `useEffect` cleanup function that calls the `audioStore`'s `unload()` action (which calls `player.remove()` on the store-owned player — see §9.13) when the component unmounts.

---

## 7. Non-Functional Requirements

- NFR-01 **Security:** Gemini and ElevenLabs API keys must never be in the React Native bundle or source control. All calls to external APIs must route through the Supabase Edge Function proxy, which verifies the user's JWT before forwarding any request.
- NFR-02 **Performance:** Script generation should begin within 3 seconds of tapping Generate on a standard connection; a loading indicator must appear immediately.
- NFR-03 **Responsiveness:** UI must support both iOS and Android screen sizes without layout breaking. Use React Native's `useWindowDimensions` hook and the `Platform` API for platform-specific adjustments.
- NFR-04 **Offline Handling:** If the device has no network connection, the user must see a clear "No internet connection" message rather than a spinner or crash.
- NFR-05 **Error States:** Every API call must have a corresponding error state surfaced to the user in plain language.
- NFR-06 **Accessibility:** Text must meet minimum contrast ratios; interactive elements must have `accessibilityLabel` props for screen readers.

---

## 8. API Integration Details

### 8.1 Backend Proxy Architecture

All calls to Gemini and ElevenLabs are made server-side through a single Supabase Edge Function. The React Native app never holds or transmits external API keys.

**Request flow:**

```
React Native App
    │
    │  (1) User submits meditation prompt + Supabase JWT
    ▼
Supabase Edge Function: /generate-script
    │
    ├──► (2) Verify Supabase JWT — reject unauthenticated requests immediately
    │
    ├──► (3) Call Google Gemini API → returns plain-text script
    │
    └──► (4) Save script to sessions table in Supabase DB → returns sessionId
    │
    ▼
React Native App receives { sessionId, script }, displays script, calls second Edge Function

React Native App
    │
    │  (5) Sends sessionId + Supabase JWT
    ▼
Supabase Edge Function: /synthesize-audio
    │
    ├──► (6) Verify Supabase JWT
    │
    ├──► (7) Fetch script from sessions table using sessionId — verify it belongs to authenticated user
    │
    ├──► (8) Call ElevenLabs API → returns raw MP3 bytes
    │
    └──► (9) Upload MP3 to Supabase Storage → returns a signed URL (expires in 1 hour)
    │
    ▼
React Native App receives signed URL and loads it with expo-audio
```

> **Why two Edge Functions?** A single function running Gemini + ElevenLabs sequentially for a 10–15 minute meditation risks hitting Supabase's 150-second Edge Function timeout. Splitting also lets the UI show the generated script immediately while audio is still being synthesized.
>
> **Why Supabase Storage for audio?** ElevenLabs returns raw audio bytes, and a 10-minute MP3 is many megabytes — returning multi-megabyte binary payloads through `supabase.functions.invoke()` is slow, memory-hungry in the function, and not seekable. Uploading to Supabase Storage and returning a signed URL sidesteps this entirely, persists the audio for replay, and lets `expo-audio` stream (and seek) from the URL natively.
>
> **Signed URL expiration risk:** The 1-hour signed URL is long enough for active playback, but a user who pauses and returns 61+ minutes later will receive a network error from `expo-audio` when they resume. The `audioStore` guards against this: when the user taps Play, it checks whether `Date.now() - urlGeneratedAt > 45 * 60 * 1000` (45 minutes). If the threshold is exceeded, it fetches a fresh signed URL from Supabase Storage before resuming. See Section 9.13.

**Edge Function responsibilities (`/generate-script`):**
- JWT verification on every invocation
- Reading the Gemini API key from Supabase Secrets
- Enforcing max prompt length before forwarding to Gemini
- Enforcing per-user rate limits by checking a usage counter in the database
- Saving the generated script to the sessions table in Supabase, associated with the authenticated user
- Returning `{ sessionId: string, script: string }` or a structured error response

**Edge Function responsibilities (`/synthesize-audio`):**
- JWT verification on every invocation
- Fetching the script from the sessions table using the provided `sessionId` — verifying it belongs to the authenticated user
- Reading the ElevenLabs API key from Supabase Secrets
- Calling ElevenLabs TTS and uploading the MP3 bytes to Supabase Storage
- Updating the session record with the Storage **object path** (`audio_path`, e.g. `{userId}/{sessionId}.mp3`) — never persist the signed URL itself in the DB, since it expires in 1 hour and would be dead on any later read
- Returning `{ audioUrl: string }` (a signed URL) or a structured error response

---

### 8.2 API Security Requirements

Every invocation of the `/generate-script` and `/synthesize-audio` Edge Functions must pass the following checks in order:

| # | Check | Action on Failure |
|---|---|---|
| SEC-01 | Verify Supabase JWT is present and valid | Return `401 Unauthorized` |
| SEC-02 | Enforce max prompt length (e.g., 1,000 characters) | Return `400 Bad Request` |
| SEC-03 | Check per-user rate limit counter in DB (e.g., max N requests / hour) | Return `429 Too Many Requests` |
| SEC-04 | Call Gemini API using key from Supabase Secrets (`/generate-script`) | Propagate error if call fails |
| SEC-05 | Call ElevenLabs API using key from Supabase Secrets, upload to Supabase Storage (`/synthesize-audio`) | Propagate error if call fails |

**Additional security requirements:**
- All tables storing prompts or generated scripts must have Row Level Security (RLS) enabled in Supabase so users can only read and write their own records.
- Gemini and ElevenLabs API keys must be stored exclusively via `supabase secrets set` and accessed as environment variables inside the Edge Function — never passed from the client.
- The React Native app transmits only the Supabase URL and publishable key (both safe to expose publicly per Supabase's design); RLS and JWT verification enforce actual access control.
- The audio Storage bucket must be **private**. Objects are uploaded under a `{userId}/{sessionId}.mp3` path, and a `storage.objects` RLS policy must allow authenticated users to read (and therefore create signed URLs for) only objects under their own `{userId}/` prefix. This policy is what makes the client-side `refreshAudioUrl` call in §9.13 work.
- Rate-limit counter updates (SEC-03) must be atomic — use a single `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` statement or a Postgres function (RPC), not a read-then-write from the Edge Function, to avoid race conditions letting users exceed the limit.

---

### 8.3 Google Gemini API
- **SDK:** `@google/genai` — the current official SDK. Do **not** use `@google/generative-ai`; it is the deprecated legacy SDK, no longer receives new-model support, and has a different API surface (`GoogleGenerativeAI` / `getGenerativeModel()`), so mixing the two produces code that compiles against neither.
- **Model:** `gemini-2.5-flash`. Verify the current recommended flash-tier model name against https://ai.google.dev/gemini-api/docs at implementation time — Google's docs now feature newer models, and hardcoding a retired model name is a silent runtime failure.
- **Auth:** API key read from Supabase Secrets as `GEMINI_API_KEY`
- **Deno import:** Supabase Edge Functions run on Deno, not Node.js. Use the `npm:` specifier — bare package names and `require()` are not supported.
- **Request shape:** Pass the system prompt via `config.systemInstruction` (separate from `contents`), and the user's prompt as `contents`. Do **not** concatenate the system prompt into `contents` — the model treats them differently.

```typescript
import { GoogleGenAI } from "npm:@google/genai";

const ai = new GoogleGenAI({ apiKey: Deno.env.get('GEMINI_API_KEY')! });
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: userPrompt,
  config: { systemInstruction: SYSTEM_PROMPT },
});
const script = response.text; // property, not a method — .text() is the old SDK
```

- **System instruction (draft):**
  > "You are a professional meditation guide. The user will describe how they are feeling or what they want from their meditation session. Write a calming, first-person guided meditation script tailored to their request. Use only plain prose — no bullet points, headers, or markdown formatting. The tone should be warm, slow, and soothing. Begin the script immediately without any preamble."
- **Expected response:** Plain text string ready to pass to TTS

### 8.4 Text-to-Speech API: ElevenLabs
- **Preferred voice characteristics:** Slow tempo, warm/neutral gender, low pitch
- **Input:** Plain text string (the Gemini output)
- **Output:** Audio file or stream (MP3 or WAV preferred)
- **Playback:** Handled in-app via `expo-audio` (`useAudioPlayer` hook). The app receives a signed Supabase Storage URL from the `/synthesize-audio` Edge Function and loads it directly — no local file save required.

---

## 9. State Management — Zustand

### 9.1 Overview

This application uses Zustand (v5.x) as the sole client-side state management solution. All shared state and async business logic must be managed through Zustand stores. Local, ephemeral UI state (e.g., a toggle visible to only one component) may use React's `useState`. Shared state must never be prop-drilled — it belongs in a store.

### 9.2 Dependencies

The versions below reflect what is **already installed** in `package.json` (Expo SDK 56). SDK 56 uses unified versioning — `expo-*` packages share the SDK version number, so standalone majors like `expo-audio 0.4.x` or `expo-router 4.x` no longer exist.

```json
{
  "dependencies": {
    "expo": "~56.0.12",
    "expo-audio": "~56.0.12",
    "expo-router": "~56.2.11",
    "react": "19.2.3",
    "react-native": "0.85.3",
    "zustand": "^5.0.14",
    "immer": "^11.1.8",
    "@supabase/supabase-js": "^2.108.2",
    "@react-native-async-storage/async-storage": "2.2.0"
  },
  "devDependencies": {
    "typescript": "~6.0.3",
    "@types/react": "~19.2.2",
    "jest": "^30.4.2",
    "@testing-library/react-native": "^14.0.1"
  }
}
```

> **Rules:** Add or upgrade any Expo/native package with `npx expo install <pkg>` (never plain `npm install`) so versions stay aligned with SDK 56. `expo-av` is deprecated — use `expo-audio`. `react-router-native` has been removed from the stack. For testing, install the `jest-expo` preset (`npx expo install jest-expo -- --save-dev`) and set `"preset": "jest-expo"` in the Jest config — bare Jest cannot transform React Native / Expo modules.

No code generation step is required. Zustand stores are plain TypeScript modules.

### 9.3 Layer Structure

Stores are organized into three layers. Each layer may only depend on the layer below it.

```
UI Layer        → consumes stores via Zustand selector hooks; calls store actions in event handlers
Store Layer     → Zustand stores holding typed state + async action functions
Repository Layer → plain TypeScript modules called by store actions; never imported by UI
```

### 9.4 Directory Structure

```
app/
├── _layout.tsx                       # Root layout — Supabase auth listener + Stack.Protected guards for (auth)/(app) groups
├── (auth)/
│   ├── _layout.tsx                   # Auth group layout (no tab bar)
│   ├── login.tsx                     # Log in screen
│   └── register.tsx                  # Create account screen
└── (app)/
    ├── _layout.tsx                   # App group layout (stack/tabs) — access already guarded by Stack.Protected in root
    ├── index.tsx                     # Home screen
    ├── prompt.tsx                    # Meditation prompt screen
    ├── playback.tsx                  # Playback screen
    └── settings.tsx                  # Account / settings screen
src/
├── stores/
│   ├── authStore.ts                  # Auth state + sign-in / sign-out actions
│   ├── meditationStore.ts            # Prompt input, script generation, audio generation state
│   └── audioStore.ts                 # Playback state and controls (backed by expo-audio)
├── hooks/
│   ├── useAuth.ts                    # Selector hooks for authStore
│   ├── useMeditation.ts              # Selector hooks for meditationStore
│   └── useAudio.ts                   # Selector hooks + expo-audio player management
├── repositories/
│   ├── geminiRepository.ts           # Calls /generate-script Edge Function
│   ├── elevenLabsRepository.ts       # Calls /synthesize-audio Edge Function → returns signed URL
│   └── supabaseRepository.ts         # Supabase DB operations (history, user profile)
└── lib/
    └── supabaseClient.ts             # Single Supabase client instance (module-level singleton)
```

### 9.5 Store Type Conventions

| Use Case | Pattern |
|---|---|
| Supabase client instance | Module-level singleton in `src/lib/supabaseClient.ts` |
| Auth state | `authStore` — hydrated from `supabase.auth.onAuthStateChange` in root layout |
| User input / simple UI state | `useState` (local) or a store slice if shared across screens |
| Async API call (Gemini, ElevenLabs) | Zustand async action with a typed `status` field |
| Real-time Supabase data | `useEffect` + `supabase.channel().on()` subscription, cleaned up on unmount |
| Audio playback state | `audioStore` owning a player created with `expo-audio`'s **`createAudioPlayer()`** (the imperative API — `useAudioPlayer` is a React hook and cannot live inside a store); released via `player.remove()` in the store's `unload()` action |
| Derived / computed values | Selector functions passed inline to `useStore(selector)` — not stored in state |

### 9.6 Store Shape Convention

Every async operation in a store must include a typed `status` field alongside `data` and `error`. This provides the same three-state coverage as Riverpod's `AsyncValue<T>`.

```typescript
type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

interface MeditationStore {
  prompt: string;
  sessionId: string | null;
  script: string | null;
  scriptStatus: AsyncStatus;
  audioUrl: string | null;
  audioStatus: AsyncStatus;
  error: string | null;
  setPrompt: (prompt: string) => void;
  generate: (prompt: string, durationMinutes?: number) => Promise<void>;
  reset: () => void;
}
```

### 9.7 Meditation Generation Flow

The full prompt → script → audio flow is handled inside a single orchestrating action in `meditationStore`. The UI calls `generate()` once; the store sequences the two API calls internally and exposes separate `scriptStatus` and `audioStatus` fields so the UI can reflect each stage independently.

```typescript
// src/stores/meditationStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { generateScript } from '../repositories/geminiRepository';
import { synthesizeSpeech } from '../repositories/elevenLabsRepository';

export const useMeditationStore = create<MeditationStore>()(
  immer((set, get) => ({
    prompt: '',
    sessionId: null,
    script: null,
    scriptStatus: 'idle',
    audioUrl: null,
    audioStatus: 'idle',
    error: null,

    setPrompt: (prompt) => set((state) => { state.prompt = prompt; }),

    generate: async (prompt, durationMinutes) => {
      // Re-entrancy guard: ignore double-taps on Generate while a run is in flight
      if (get().scriptStatus === 'loading' || get().audioStatus === 'loading') return;
      set((state) => {
        state.scriptStatus = 'loading';
        state.audioStatus = 'idle';
        state.error = null;
      });
      let sessionId: string;
      try {
        const result = await generateScript(prompt, durationMinutes);
        sessionId = result.sessionId;
        set((state) => {
          state.sessionId = result.sessionId;
          state.script = result.script;
          state.scriptStatus = 'success';
        });
      } catch (err) {
        set((state) => {
          state.scriptStatus = 'error';
          state.error = (err as Error).message;
        });
        return;
      }

      set((state) => { state.audioStatus = 'loading'; });
      try {
        const url = await synthesizeSpeech(sessionId);
        set((state) => {
          state.audioUrl = url;
          state.audioStatus = 'success';
        });
      } catch (err) {
        set((state) => {
          state.audioStatus = 'error';
          state.error = (err as Error).message;
        });
      }
    },

    reset: () => set(() => ({
      prompt: '',
      sessionId: null,
      script: null,
      scriptStatus: 'idle',
      audioUrl: null,
      audioStatus: 'idle',
      error: null,
    })),
  }))
);
```

The UI watches the store fields to show loading, error, and success states. No manual event chaining is required.

### 9.8 UI Consumption Rules

- Subscribe to store slices using selector functions to avoid unnecessary re-renders:

```typescript
// Subscribes only to scriptStatus — re-renders only when that field changes
const scriptStatus = useMeditationStore((s) => s.scriptStatus);

// Subscribe to multiple fields with the shallow comparator
import { useShallow } from 'zustand/react/shallow';
const { script, audioUrl } = useMeditationStore(
  useShallow((s) => ({ script: s.script, audioUrl: s.audioUrl }))
);
```

- Call store actions directly in event handlers — do not subscribe to action functions:

```typescript
const generate = useMeditationStore((s) => s.generate);
// in onPress: generate(prompt, duration)
```

- Use `useEffect` to react to status changes and trigger side effects (navigation, toasts, audio loading). This replaces Riverpod's `ref.listen`:

```typescript
useEffect(() => {
  if (audioStatus === 'success' && audioUrl) {
    useAudioStore.getState().load(audioUrl);
  }
}, [audioStatus, audioUrl]);
```

- All status states (`idle`, `loading`, `error`, `success`) must be handled explicitly in every consuming component.

### 9.9 Supabase Integration Rules

- The Supabase client must be instantiated once in `src/lib/supabaseClient.ts` and imported from there everywhere. Never call `createClient()` more than once in the app.
- The client must be configured for React Native: `createClient(url, key, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })`. Without `storage: AsyncStorage`, sessions do not survive app restarts and FR-AUTH-03 fails. Additionally, wire React Native's `AppState` to call `supabase.auth.startAutoRefresh()` on foreground and `stopAutoRefresh()` on background so tokens keep refreshing reliably.
- Auth state must be initialized in `app/_layout.tsx` by subscribing to `supabase.auth.onAuthStateChange` and writing updates into `authStore`. Unsubscribe in the cleanup effect.
- Auth-gated routes must be protected via `Stack.Protected` guards in the root layout (`app/_layout.tsx`), with the guard condition read from `authStore` (see FR-NAV-01) — individual screen components and group layouts must not implement their own auth redirect logic.
- Real-time Supabase subscriptions must be started in a `useEffect` and cleaned up in the `useEffect` return function to prevent listener leaks.

### 9.10 Error Handling Rules

- All async store actions must wrap external calls in `try/catch` and write the caught error message to the store's `error` field, then set `status` to `'error'`.
- Repositories must throw typed errors (e.g., `GeminiError`, `ElevenLabsError`) rather than returning `null`, so error messages surface meaningfully in the UI.
- Never swallow errors silently inside a store action — always transition `status` to `'error'` and set `error`.

### 9.11 Testing Rules

Stores must be reset between tests using Zustand's `setState` with the initial state object. Repositories must be mocked at the module level using Jest's `jest.mock`.

```typescript
import { useMeditationStore } from '../stores/meditationStore';
import * as geminiRepository from '../repositories/geminiRepository';
import * as elevenLabsRepository from '../repositories/elevenLabsRepository';

jest.mock('../repositories/geminiRepository');
jest.mock('../repositories/elevenLabsRepository');

const initialState = useMeditationStore.getState();

beforeEach(() => {
  useMeditationStore.setState(initialState, true); // replace, don't merge
});

it('sets scriptStatus to success on valid Gemini response', async () => {
  // generateScript resolves { sessionId, script } — NOT a bare string (see §8.1)
  (geminiRepository.generateScript as jest.Mock).mockResolvedValue({
    sessionId: 'session-123',
    script: 'A calm meditation...',
  });
  (elevenLabsRepository.synthesizeSpeech as jest.Mock).mockResolvedValue('https://audio.url/file.mp3');

  await useMeditationStore.getState().generate('I feel anxious');

  expect(useMeditationStore.getState().scriptStatus).toBe('success');
  expect(useMeditationStore.getState().script).toBe('A calm meditation...');
});

it('sets scriptStatus to error when Gemini call fails', async () => {
  (geminiRepository.generateScript as jest.Mock).mockRejectedValue(new Error('Quota exceeded'));

  await useMeditationStore.getState().generate('I feel anxious');

  expect(useMeditationStore.getState().scriptStatus).toBe('error');
  expect(useMeditationStore.getState().error).toBe('Quota exceeded');
});
```

### 9.12 What Not To Do

- Do not use React `Context` + `useReducer` for shared state — use Zustand stores.
- Do not call Supabase or any external API directly from a component — always go through a store action that calls a repository.
- Do not store derived or computed values in the store — compute them inline in the component via a selector function.
- Do not subscribe to the entire store object (e.g., `useMeditationStore()` with no selector) — always select the minimum needed slice to avoid excessive re-renders.
- Do not create multiple Supabase client instances — import the singleton from `src/lib/supabaseClient.ts`.
- Do not use `useState` or `useReducer` for state that needs to be shared across screens — it belongs in a Zustand store.

### 9.13 Audio Store — Signed URL Expiration Guard

Supabase Storage signed URLs expire after 1 hour. A user who pauses a session and returns after the URL has expired will receive a silent network error from `expo-audio`. The `audioStore` must guard against this on every play attempt.

**Player ownership:** the `audioStore` creates its player with `createAudioPlayer(source)` (imperative, safe outside React) and swaps sources with `player.replace(newSource)`. It must expose an `unload()` action that calls `player.remove()`; the playback screen calls `unload()` from its `useEffect` cleanup (FR-NAV-03). For live position/duration UI, the screen passes the store's player to the `useAudioPlayerStatus(player)` hook — do not poll or mirror position into the store. Never use the `useAudioPlayer` hook for the store's player: hook-created players are auto-released on component unmount, which would leave the store holding a dead player.

**Required state fields:**

```typescript
interface AudioStore {
  audioUrl: string | null;
  urlGeneratedAt: number | null;  // Date.now() timestamp set when the URL is stored
  // ... playback state fields
}
```

**Play action logic:**

```typescript
play: async () => {
  const { audioUrl, urlGeneratedAt } = get();
  const URL_TTL_MS = 45 * 60 * 1000; // 45 minutes — refresh before the 1-hour expiry

  if (!audioUrl || !urlGeneratedAt) return;

  if (Date.now() - urlGeneratedAt > URL_TTL_MS) {
    const sessionId = useMeditationStore.getState().sessionId;
    if (!sessionId) return;
    const freshUrl = await refreshAudioUrl(sessionId); // supabaseRepository call
    set((state) => {
      state.audioUrl = freshUrl;
      state.urlGeneratedAt = Date.now();
    });
  }

  // proceed with expo-audio playback using the current (fresh) URL
},
```

**Rules:**
- `urlGeneratedAt` must be set (to `Date.now()`) whenever `audioUrl` is written to the store — both on initial load and after a refresh.
- `refreshAudioUrl(sessionId)` is a `supabaseRepository` call that reads the session's `audio_path` and calls `supabase.storage.from(bucket).createSignedUrl(audio_path, ...)` for the existing Storage object; it does not re-invoke ElevenLabs. It relies on the per-user `storage.objects` RLS policy described in §8.2.
- The 45-minute threshold provides a 15-minute buffer against the 1-hour signed URL expiry.

---

## 10. Data Model (Supabase / Postgres)

Supabase is Postgres — the model is relational tables with RLS, not nested document paths. `auth.users` is managed by Supabase Auth; do not duplicate email/password there.

> **Note:** the `sessions` table is **required for the prototype**, not post-prototype — both Edge Functions depend on it (`/generate-script` writes the script, `/synthesize-audio` reads it back and records the audio path; see §8.1).

```sql
-- Prototype
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  script text not null,
  audio_path text,              -- Storage object path ({userId}/{sessionId}.mp3), NOT a signed URL
  duration_seconds int,
  created_at timestamptz not null default now()
);

create table usage_counters (   -- rate limiting, SEC-03
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count int not null default 0,
  primary key (user_id, window_start)
);
```

**RLS:** enabled on every table. `profiles` and `sessions` policies restrict all operations to `auth.uid() = id` / `auth.uid() = user_id`. `usage_counters` is written only by the Edge Functions (service-role client bypasses RLS); no client-facing policies are created for it.

---

## 11. Out of Scope for Prototype

- Google Sign-In (email/password only; Google auth requires additional native OAuth configuration)
- Background ambient music
- Voice selection by the user
- Offline playback / cached audio
- Push notifications / reminders
- Social or sharing features
- In-app purchases or subscriptions
- Android/iOS app store submission
