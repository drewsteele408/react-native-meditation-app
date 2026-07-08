# Meditation App — Build Plan

## Overview

This document breaks the prototype build into sequential phases. Each phase has a clear goal, a list of deliverables, and the specific files to create or modify. Phases are ordered so that each one builds on a stable foundation from the phase before it.

---

## Phase 0 — Project Setup & Infrastructure

**Goal:** A runnable Expo project with the correct folder structure, all dependencies installed, and environment variables wired up. No features — just a green "it boots" baseline.

### Tasks

1. **Initialize the Expo project**
   - `npx create-expo-app@latest meditation-app --template blank-typescript`
   - Confirm the project boots via `npx expo start`

2. **Install all dependencies from spec section 9.2**
   ```
   npx expo install expo-router expo-audio @supabase/supabase-js zustand immer @react-native-async-storage/async-storage
   npm install --save-dev jest @testing-library/react-native @types/react typescript
   ```

3. **Configure Expo Router**
   - Set `"main": "expo-router/entry"` in `package.json`
   - Add the Expo Router scheme to `app.json`

4. **Create the directory skeleton** (empty placeholder files)
   ```
   app/
   ├── _layout.tsx
   ├── (auth)/
   │   ├── _layout.tsx
   │   ├── login.tsx
   │   └── register.tsx
   └── (app)/
       ├── _layout.tsx
       ├── index.tsx
       ├── prompt.tsx
       ├── playback.tsx
       └── settings.tsx
   src/
   ├── stores/
   │   ├── authStore.ts
   │   ├── meditationStore.ts
   │   └── audioStore.ts
   ├── hooks/
   │   ├── useAuth.ts
   │   ├── useMeditation.ts
   │   └── useAudio.ts
   ├── repositories/
   │   ├── geminiRepository.ts
   │   ├── elevenLabsRepository.ts
   │   └── supabaseRepository.ts
   └── lib/
       └── supabaseClient.ts
   ```

5. **Configure environment variables**
   - Create `.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Add `.env` to `.gitignore`

6. **Create the Supabase project**
   - Create project at supabase.com
   - Copy URL and publishable key into `.env`
   - Initialize the Supabase CLI locally: `npx supabase init`

7. **Configure Development Build**
   - Verify `expo-audio` is not compatible with Expo GO
   - Document build commands: `npx expo run:ios` / `npx expo run:android`

### Exit Criteria
- `npx expo run:ios` builds and shows a blank screen without errors
- All directories and placeholder files exist

---

## Phase 1 — Database Schema & RLS

**Goal:** Supabase database tables exist with correct columns and Row Level Security locked down before any app code writes to them.

### Tasks

1. **Create `profiles` table** (extends the built-in `auth.users`)
   ```sql
   create table profiles (
     id uuid references auth.users(id) primary key,
     display_name text not null,
     created_at timestamptz default now()
   );
   ```

2. **Create `sessions` table**
   ```sql
   create table sessions (
     id uuid primary key default gen_random_uuid(),
     user_id uuid references auth.users(id) not null,
     prompt text not null,
     script text,
     audio_url text,
     duration_minutes int,
     created_at timestamptz default now()
   );
   ```

3. **Create `usage_counters` table** (for SEC-03 rate limiting)
   ```sql
   create table usage_counters (
     user_id uuid references auth.users(id) primary key,
     request_count int default 0,
     window_start timestamptz default now()
   );
   ```

4. **Enable and write RLS policies**
   - `profiles`: users can only select/update their own row
   - `sessions`: users can only select/insert/update their own rows
   - `usage_counters`: users can only select their own row; only the Edge Function service role can update

5. **Create a `profiles` insert trigger** on `auth.users` so a profile row is created automatically on account creation

6. **Write SQL as a Supabase migration file** under `supabase/migrations/` so the schema is version-controlled

7. **Set up Supabase Storage bucket** named `meditation-audio` with private access (signed URLs only)

### Exit Criteria
- All three tables exist in the Supabase dashboard
- RLS is enabled on all three tables and policies are verified via the Supabase Policy Editor
- The storage bucket exists

---

## Phase 2 — Authentication

**Goal:** Users can create an account, log in, and stay logged in across app restarts. Navigation automatically enforces the auth gate.

### Files to Build

**`src/lib/supabaseClient.ts`**
- Instantiate the Supabase client once using `createClient()` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Export as a named singleton — this is the only place `createClient()` is ever called

**`src/stores/authStore.ts`**
```typescript
interface AuthStore {
  user: User | null;
  session: Session | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
}
```
- `signIn` / `signUp` / `signOut` call Supabase Auth methods
- `setSession` is called from the root layout's auth listener
- Use Immer middleware

**`src/hooks/useAuth.ts`**
- Export selector hooks: `useUser()`, `useAuthStatus()`, `useSignIn()`, etc.

**`app/_layout.tsx`** — Root layout
- Subscribe to `supabase.auth.onAuthStateChange` in a `useEffect`
- On each change, call `authStore.setSession(session)`
- Unsubscribe in the cleanup function
- Renders `<Stack />` (Expo Router's root navigator)

**`app/(auth)/_layout.tsx`**
- Simple stack layout, no tab bar
- If user is already authenticated, redirect to `/(app)/`

**`app/(auth)/login.tsx`**
- Email + password inputs
- "Log In" button → calls `signIn()` from `authStore`
- Link to Register screen
- Shows error message when `authStore.error` is set
- Shows loading indicator while status is `loading`

**`app/(auth)/register.tsx`**
- Email, password, display name inputs
- Password must be ≥ 8 characters (FR-AUTH-05)
- "Create Account" button → calls `signUp()`
- On success, navigates to `/(app)/`

**`app/(app)/_layout.tsx`** — Protected layout
- Reads `authStore.status` with a selector
- If `status === 'unauthenticated'`, calls `router.replace('/login')`
- Individual screens do NOT implement their own auth redirect

### Exit Criteria
- New user can create an account and land on the `(app)` group
- Existing user can log in
- Logged-in user stays logged in after force-closing and reopening the app (FR-AUTH-03)
- Unauthenticated user is always redirected to `/login`
- Logged-out user is immediately redirected back to `/login`

---

## Phase 3 — State & Repository Layer

**Goal:** All Zustand stores and repositories are implemented with correct types and tested in isolation. No UI wired up yet — this is pure business logic.

### Files to Build

**`src/repositories/geminiRepository.ts`**
```typescript
export async function generateScript(
  prompt: string,
  durationMinutes?: number
): Promise<{ sessionId: string; script: string }>
```
- Calls `supabase.functions.invoke('generate-script', { body: { prompt, durationMinutes } })`
- Attaches the user's JWT automatically via the Supabase client
- Throws `GeminiError` with a human-readable message on failure

**`src/repositories/elevenLabsRepository.ts`**
```typescript
export async function synthesizeSpeech(sessionId: string): Promise<string>
// returns signed audio URL
```
- Calls `supabase.functions.invoke('synthesize-audio', { body: { sessionId } })`
- Throws `ElevenLabsError` on failure

**`src/repositories/supabaseRepository.ts`**
```typescript
export async function refreshAudioUrl(sessionId: string): Promise<string>
export async function getSession(sessionId: string): Promise<MeditationSession>
```
- `refreshAudioUrl` generates a new signed URL for an existing Storage object without calling ElevenLabs

**`src/stores/meditationStore.ts`**
- Full implementation per spec section 9.7
- `generate(prompt, durationMinutes)` orchestrates both repositories sequentially
- Exposes `scriptStatus` and `audioStatus` independently
- Exposes `reset()` for when the user navigates away from playback

**`src/stores/audioStore.ts`**
```typescript
interface AudioStore {
  audioUrl: string | null;
  urlGeneratedAt: number | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  status: 'idle' | 'loading' | 'ready' | 'error';
  load: (url: string) => void;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seekTo: (positionMs: number) => void;
}
```
- `play()` implements the signed URL expiration guard from spec section 9.13
- The 45-minute threshold check runs before every play attempt
- `load()` sets `urlGeneratedAt = Date.now()`

**`src/hooks/useMeditation.ts`** and **`src/hooks/useAudio.ts`**
- Selector hooks for each store
- `useAudio.ts` also manages the `expo-audio` `useAudioPlayer` instance lifecycle

### Tests to Write (per spec section 9.11)
- `meditationStore`: happy path, Gemini failure, ElevenLabs failure
- `audioStore`: URL expiration guard (mock `Date.now()`)
- `geminiRepository`: mock `supabase.functions.invoke`, verify error handling

### Exit Criteria
- All stores compile with no TypeScript errors
- Unit tests pass for all three stores
- `generate()` sequences correctly: `scriptStatus` → `success` before `audioStatus` → `loading`

---

## Phase 4 — Edge Functions (Backend)

**Goal:** Both Supabase Edge Functions are deployed and callable. The full Gemini → ElevenLabs → Storage pipeline works end-to-end from a curl command or the Supabase dashboard.

### Files to Build

**`supabase/functions/generate-script/index.ts`**

Security checks in order (per spec section 8.2):
1. **SEC-01** — Verify Supabase JWT; return `401` if missing or invalid
2. **SEC-02** — Enforce max prompt length of 1,000 characters; return `400` if exceeded
3. **SEC-03** — Check `usage_counters` table; return `429` if over limit
4. **SEC-04** — Call Gemini API using `GEMINI_API_KEY` from `Deno.env`

Implementation details:
- Use `npm:@google/generative-ai` with Deno `npm:` specifier
- Model: `gemini-2.5-flash`
- Pass system prompt via `systemInstruction` (not in `contents`)
- System prompt: calm meditation guide, plain prose, no markdown, no preamble
- Save script to `sessions` table with `user_id` and `prompt`
- Return `{ sessionId: string, script: string }`

**`supabase/functions/synthesize-audio/index.ts`**

1. **SEC-01** — Verify JWT; return `401` if invalid
2. **SEC-05** — Fetch script from `sessions` table by `sessionId`; verify `user_id` matches authenticated user; return `403` if mismatch
3. Call ElevenLabs API using `ELEVENLABS_API_KEY` from `Deno.env`
4. Upload MP3 bytes to Supabase Storage bucket `meditation-audio` at path `{userId}/{sessionId}.mp3`
5. Generate a signed URL with 1-hour expiry
6. Update `sessions` row with `audio_url`
7. Return `{ audioUrl: string }`

**Secrets to configure:**
```
supabase secrets set GEMINI_API_KEY=<key>
supabase secrets set ELEVENLABS_API_KEY=<key>
supabase secrets set ELEVENLABS_VOICE_ID=<voice-id>
```

**ElevenLabs voice selection:**
- Use a voice matching spec: slow tempo, warm/neutral, low pitch
- Suggested: "Rachel" or "Adam" — confirm in ElevenLabs dashboard

### Deployment
```
supabase functions deploy generate-script
supabase functions deploy synthesize-audio
```

### Exit Criteria
- `generate-script` returns `{ sessionId, script }` for a valid JWT + prompt
- `generate-script` returns `401` for a request with no JWT
- `generate-script` returns `429` after exceeding the per-user rate limit
- `synthesize-audio` returns `{ audioUrl }` and the URL plays valid MP3 audio
- `synthesize-audio` returns `403` if `sessionId` belongs to a different user
- The MP3 file is visible in the Supabase Storage dashboard

---

## Phase 5 — UI Screens

**Goal:** All five screens are built, wired to the Zustand stores, and visually complete. The golden path works end-to-end on a device.

### Screens to Build

**`app/(app)/index.tsx`** — Home Screen
- Welcome message: "Hello, {displayName}"
- Prominent "Start a Meditation" button → navigates to `/prompt`
- Settings icon in header → navigates to `/settings`

**`app/(app)/prompt.tsx`** — Prompt Screen
- Large `TextInput` with placeholder text: *"I'm feeling anxious and want to calm down…"*
- Duration selector: segmented control or picker with options 5 / 10 / 15 min
- "Generate" button
- Button calls `meditationStore.generate(prompt, duration)`
- While `scriptStatus === 'loading'`: show spinner + "Generating your meditation…"
- While `audioStatus === 'loading'`: show "Preparing audio…"
- On `scriptStatus === 'success'`: navigate to `/playback`
- On `scriptStatus === 'error'` or `audioStatus === 'error'`: show inline error message in plain language
- Max prompt length enforced client-side at 1,000 chars (mirrors SEC-02)

**`app/(app)/playback.tsx`** — Playback Screen
- Displays `meditationStore.script` in a `ScrollView`
- Audio controls (Play, Pause, Replay, Stop) connected to `audioStore`
- Progress bar: `positionMs / durationMs`
- While `audioStatus === 'loading'`: skeleton or spinner over the controls
- `useEffect` cleanup: calls `audioStore.stop()` on unmount (FR-NAV-03)
- `useEffect` triggers `audioStore.load(audioUrl)` when `audioStatus === 'success'`

**`app/(app)/settings.tsx`** — Settings Screen
- Display name and email from `authStore.user`
- "Log Out" button → calls `authStore.signOut()` → navigates to `/login`

**`app/(auth)/login.tsx`** and **`app/(auth)/register.tsx`** — (already outlined in Phase 2)

### Cross-Cutting UI Requirements (per spec NFR section)
- Use `useWindowDimensions` for responsive layouts (NFR-03)
- Use `Platform` API for iOS/Android differences
- Add `accessibilityLabel` to all interactive elements (NFR-06)
- Show "No internet connection" instead of a spinner when offline (NFR-04) — implement via a `NetInfo` check or a custom `useNetworkStatus` hook

### Exit Criteria
- Full golden path works on a real device: launch → create account → enter prompt → generate → playback audio
- Each screen handles all four async states: idle, loading, error, success
- Back button on Playback stops audio before navigating away

---

## Phase 6 — Error Handling, Offline Detection & Polish

**Goal:** Every failure path surfaces a clear user-facing message. The app never crashes silently or shows an infinite spinner.

### Tasks

1. **Offline detection**
   - Install `@react-native-community/netinfo`
   - Create a `useNetworkStatus()` hook
   - Show a banner or modal on the Prompt screen when offline
   - Disable the Generate button when offline

2. **Error boundary**
   - Wrap the root layout in a React Error Boundary component
   - Show a generic "Something went wrong" screen with a restart option

3. **Toast / error display**
   - Decide on a pattern: inline error text below the triggering UI or a modal
   - Ensure errors from `meditationStore.error` and `audioStore` are always visible

4. **Loading indicator timing** (NFR-02)
   - Spinner must appear within 3 seconds of tapping Generate
   - Verify against a slow 3G network simulation

5. **Accessibility pass**
   - Audit all screens for `accessibilityLabel` coverage
   - Verify minimum contrast ratios on the color palette

6. **Navigation edge cases**
   - Handle double-tapping Generate (disable button while `scriptStatus === 'loading'`)
   - Handle back navigation from Prompt while generation is in-flight (cancel or warn)

### Exit Criteria
- Disabling Wi-Fi mid-generation shows a clear error message, not a crash
- Every button has an `accessibilityLabel`
- Tapping Generate twice doesn't trigger two concurrent API calls

---

## Phase 7 — Testing

**Goal:** Unit test coverage for all stores and repositories. Integration smoke test for the Edge Functions.

### Unit Tests

| File | Tests |
|---|---|
| `meditationStore` | happy path, Gemini failure, ElevenLabs failure, reset |
| `audioStore` | load sets `urlGeneratedAt`, play refreshes URL after 45 min, play does not refresh within 45 min |
| `authStore` | sign-in success, sign-in failure, sign-out clears state |
| `geminiRepository` | parses valid response, throws `GeminiError` on 4xx, throws on network error |
| `elevenLabsRepository` | parses valid response, throws `ElevenLabsError` on failure |

### Integration Tests (Manual)

| Scenario | Expected Result |
|---|---|
| Valid prompt → generate | Script displayed + audio plays |
| Prompt > 1,000 chars | `400` from Edge Function, error shown in UI |
| > Rate limit requests in 1 hour | `429` from Edge Function, error shown in UI |
| Expired JWT | `401` from Edge Function, user redirected to login |
| Pause audio for 46+ minutes, tap Play | New signed URL fetched, audio resumes |

### Exit Criteria
- `npm test` passes all unit tests with no failures
- Manual integration tests pass on both iOS and Android

---

## Dependency Map Between Phases

```
Phase 0 (Setup)
    └── Phase 1 (Database Schema)
            └── Phase 2 (Authentication)
                    └── Phase 3 (State & Repository Layer)
                            ├── Phase 4 (Edge Functions)  ← can start in parallel with Phase 3
                            └── Phase 5 (UI Screens)      ← requires Phase 3 + Phase 4
                                    └── Phase 6 (Polish)
                                            └── Phase 7 (Testing)
```

Phases 3 and 4 can be worked in parallel since they have independent surfaces (client-side stores vs. server-side functions). They converge in Phase 5 when the UI calls the stores, which call the deployed Edge Functions.

---

## Key Technical Decisions to Lock In Early

| Decision | Spec Reference |
|---|---|
| Never call Supabase `createClient()` more than once | Section 9.9 |
| Use `npm:` specifier for all imports inside Edge Functions (Deno, not Node) | Section 8.3 |
| Pass system prompt via `systemInstruction`, not in `contents` array | Section 8.3 |
| Use Development Build — Expo GO will crash on `expo-audio` | Section 3 |
| 45-minute URL refresh threshold (not 60) to buffer against expiry | Section 9.13 |
| `sessionId` is the only value passed to `/synthesize-audio` — script is fetched server-side | Section 8.1 |
| Auth redirect lives in `app/(app)/_layout.tsx` only — not in individual screens | Section 9.9 |
