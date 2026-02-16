# Firebase Phone Authentication Implementation Plan

## Goal
Implement Phone Number Verification using **Firebase Authentication (Phone Auth)**. This provides free SMS OTP delivery (up to 10k/month).

## Prerequisites (User Action Required)
1.  **Create Firebase Project:** Go to [console.firebase.google.com](https://console.firebase.google.com).
2.  **Enable Auth:** Authentication -> Sign-in method -> **Phone** -> Enable.
3.  **Get Client Config:** Project Settings -> General -> "Add App" (Web) -> Copy `firebaseConfig`.
4.  **Get Service Account (Backend):** Project Settings -> Service Accounts -> "Generate new private key". (Needed for backend verification).

## Proposed Changes

### 1. Database Schema
- [ ] Add `phone_verified` (boolean) to `students` table.
- [ ] (Optional) Add `firebase_uid` if we want to link identities.

### 2. Backend (`firebase-admin`)
- [ ] Install `firebase-admin`.
- [ ] Initialize Admin SDK using Service Account credentials (env vars).
- [ ] Create API Route: `POST /api/auth/verify-phone`
    -   Receives: `idToken` (from frontend).
    -   Verifies token with Firebase.
    -   Extracts phone number.
    -   Updates `students` table (`phone_verified = true`) if phone matches.

### 3. Frontend (`firebase/auth`)
- [ ] Install `firebase`.
- [ ] Create `src/lib/firebase.ts` (Initialize App).
- [ ] Create `PhoneVerification` Component:
    -   Input Phone Number.
    -   "Send OTP" Button -> `signInWithPhoneNumber`.
    -   Input OTP -> `confirmationResult.confirm(otp)`.
    -   On Success -> Call Backend API with `idToken`.

## UX Flow
1.  User enters phone number.
2.  Click "Verify".
3.  reCAPTCHA (handled by Firebase) appears.
4.  SMS sent.
5.  User enters Code.
6.  "Phone Verified" badge appears.
