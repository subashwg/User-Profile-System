# Portfolio Profile System: Step 1 Auth & Onboarding (Dev Brief)

Nov 16, 2026 · @Subash

## Goal

Step 1 delivers one thing: a person can create an account, log in, and finish a short onboarding. The wider product is a profile and portfolio platform where any creator, teacher or entrepreneur shows their work on one public page, built in small releases.

Later steps, in order: profile and roles, portfolio items, sections and layout, social links, testimonials, contact, branding, analytics. None of those are built in Step 1.

## Scope of Step 1

Step 1 covers login in three ways (email, Google, Apple), sessions, and a two-field onboarding. Nothing about profiles or portfolios yet.

**Included**

- Sign up and log in with email + password
- Email verification and forgot/reset password
- Continue with Google
- Continue with Apple
- Sessions and logout
- Linking several login methods to one user
- Onboarding: name and unique username
- Basic account settings (change password, see connected login methods)

**Not included yet**

- Profile page, roles, skills, portfolio items
- Themes, custom domain, analytics
- Followers, comments, payments
- Account deletion (plan the database for it, build it later)

## Suggested tech stack

This is a suggested default, not a requirement. Swap any row, but keep the data model and rules below the same.

| Part | Suggestion | Why |
| --- | --- | --- |
| Backend | NestJS + TypeScript | Clear structure (modules, guards), good fit for auth |
| Database | PostgreSQL | Reliable, relational, handles unique usernames and emails well |
| ORM | Prisma | Simple schema file and migrations |
| Password hashing | argon2 (or bcrypt) | Never store real passwords |
| Sessions | Secure cookie session (or JWT access + refresh tokens if a mobile app is planned) | Pick one and stay consistent |
| Google / Apple | OAuth 2.0 / OpenID Connect via official or well-known libraries | Don't hand-write the protocol |
| Email sending | Any provider with an SMTP or API (a dev inbox like Mailpit locally) | Needed for verification and reset links |
| Frontend | React or Next.js, simple forms only | Keep UI minimal in Step 1 |

Open decision: web only, or web + mobile app later? That decides cookies versus tokens.

## Data model

Keep the person (User) separate from how they log in (Login method), so email, Google and Apple all lead to the same user and duplicates are avoided.

**User**

| Field | Type | Notes |
| --- | --- | --- |
| id | UUID | Primary key |
| email | text | Unique, stored lowercase; may be a private relay address for Apple |
| email_verified | boolean | True after the link is clicked, or when Google confirms it |
| name | text | From onboarding or the provider |
| username | text | Unique, lowercase, set in onboarding; becomes the profile link |
| avatar_url | text | Optional, from Google |
| onboarding_completed | boolean | False until name and username are saved |
| created_at, last_login_at | timestamp |  |
| deleted_at | timestamp | Empty for now; reserved for later account deletion |

**Login method** (one user can have several)

| Field | Type | Notes |
| --- | --- | --- |
| id | UUID | Primary key |
| user_id | UUID | Points to User |
| type | enum | email, google or apple |
| provider_user_id | text | Google or Apple's own id for the person; empty for email |
| password_hash | text | Only for type email |
| created_at | timestamp |  |

Rule: the pair (type, provider_user_id) must be unique.

**Email token** (verification and password reset)

| Field | Type | Notes |
| --- | --- | --- |
| id | UUID | Primary key |
| user_id | UUID | Points to User |
| purpose | enum | verify_email or reset_password |
| token_hash | text | Store a hash of the random token, never the token itself |
| expires_at | timestamp | Verify: 24 hours. Reset: 30 minutes |
| used_at | timestamp | Set once used; a used token is dead |

**Session** (only if using server sessions)

| Field | Type | Notes |
| --- | --- | --- |
| id | random string | Stored in the cookie |
| user_id | UUID | Points to User |
| expires_at | timestamp | For example 30 days |
| user_agent, ip | text | Optional, useful for a later "log out of other devices" |

## Auth flows

Every flow ends the same way: a User exists, a session starts, and the user lands either in onboarding (if not completed) or on their empty profile page.

**Email sign-up**

1. User enters email and password (minimum 8 characters).
2. Server lowercases the email, rejects it if it already exists, hashes the password, creates User + Login method (type email).
3. Server creates an email token (verify_email) and sends the link.
4. User is logged in but marked unverified; the app shows a "verify your email" banner.
5. User clicks the link; the token is checked (exists, not expired, not used), then email_verified becomes true.

**Email login**

1. User enters email and password.
2. Server finds the email Login method and compares the password with the hash.
3. On any failure, return the same message: "Invalid email or password."
4. On success, start a session and update last_login_at.

**Forgot / reset password**

1. User enters their email. The response is always "If this email exists, we sent a link", whether or not it exists.
2. If it exists, create a reset_password token (30 minutes) and email the link.
3. User sets a new password through the link; the token is marked used.
4. End all existing sessions for that user.

**Google login**

1. User clicks "Continue with Google" and is sent to Google.
2. Google returns to the app with proof of identity.
3. Server verifies the proof and reads Google's user id, email, whether the email is verified, name and photo.
4. Look up a Login method with type google and that id. Found: log in. Not found: apply the linking rule below.

**Apple login**

1. Same pattern as Google, using Sign in with Apple.
2. Apple sends the user's name only on the first sign-in. Save it immediately.
3. The email may be a private relay address. Accept it as the user's email.

**Linking rule (when the provider id is new)**

1. If the provider says the email is verified and a User with that email exists: add the new Login method to that User and log in.
2. If the email exists but the provider does not confirm it as verified: do not merge. Ask the user to log in with their original method first.
3. If no User has that email: create a new User and Login method, mark the email verified when the provider confirms it, then start onboarding.

**Onboarding**

1. Welcome screen.
2. Ask for name (prefilled if a provider gave one).
3. Ask for a username: 3 to 30 characters, lowercase letters, digits and underscore, checked for availability as they type. Reserve words such as admin, api, login, settings.
4. Save, set onboarding_completed to true, go to the empty profile page.
5. If the user quits halfway, the next login resumes onboarding.

## API endpoints

Step 1 needs about fifteen endpoints, grouped by job. Paths are a suggestion.

| Endpoint | Purpose | Needs login |
| --- | --- | --- |
| POST /auth/register | Sign up with email + password | No |
| POST /auth/login | Log in with email + password | No |
| POST /auth/logout | End the current session | Yes |
| GET /auth/me | Return the current user (used by the app on load) | Yes |
| POST /auth/verify-email | Confirm email with a token | No |
| POST /auth/resend-verification | Send a new verification link | Yes |
| POST /auth/forgot-password | Request a reset link | No |
| POST /auth/reset-password | Set a new password with a token | No |
| GET /auth/google, GET /auth/google/callback | Start and finish Google login | No |
| GET /auth/apple, POST /auth/apple/callback | Start and finish Apple login (Apple posts back to the callback) | No |
| GET /users/username-available | Check a username while typing | Yes |
| POST /onboarding/complete | Save name + username, finish onboarding | Yes |
| GET /account/login-methods | List connected login methods | Yes |
| POST /account/change-password | Change password (email users) | Yes |
| POST /account/link/google, POST /account/link/apple | Add another login method | Yes |

## Security rules

These rules apply to every task. If a task seems to need breaking one, stop and ask first.

- Never store or log a real password, token or secret. Store only hashes (argon2 or bcrypt for passwords, a hash for email tokens).
- Use the same error for wrong email and wrong password. The forgot-password response is the same whether or not the email exists.
- Rate-limit login, register, forgot-password and resend-verification (for example 5 attempts, then a wait), per IP and per email.
- Email links use long random tokens, expire (verify: 24 hours, reset: 30 minutes) and work once.
- Cookies are HttpOnly, Secure and SameSite. The site runs on HTTPS outside local development.
- Validate all input on the server (email format, password length, username rules), not only in the form.
- Merge accounts only when the provider confirms the email is verified.
- Never allow removing the last login method of a user.
- Keep Google and Apple keys, the database URL and the session secret in environment variables. Commit an .env.example with fake values, never the real .env.
- Check Google and Apple identity proofs on the server: signature, issuer, audience and expiry.
- Protect against cross-site request forgery on cookie-based routes and use the OAuth state parameter on social login.

## Build order

Build in nine small releases, one at a time. Finish, test and commit each before starting the next.

- [x] 1. Project setup: repo, backend skeleton, database connection, environment config, .env.example, README with run steps
- [x] 2. Database: User and Login method tables, first migration
- [x] 3. Email sign-up, login, logout and GET /auth/me with sessions and password hashing
- [x] 4. Email verification: token table, sending (dev inbox locally), verify and resend endpoints
- [x] 5. Forgot and reset password, ending old sessions after a reset
- [x] 6. Onboarding: username check, complete-onboarding endpoint, resume-if-unfinished logic
- [x] 7. Google login with the linking rule
- [x] 8. Apple login, including first-time name capture and relay emails
- [x] 9. Account settings (list and add login methods, change password), rate limiting pass, security checklist pass

For each release, also write tests for the happy path and the main failure cases (wrong password, expired token, reused token, duplicate email, taken username).

## Definition of done

Step 1 is finished when every item below is true and tested.

- [x] A new user can sign up with email, verify it, and log in
- [x] A user can reset a forgotten password and old sessions end
- [x] A user can sign in with Google
- [x] A user can sign in with Apple
- [x] Logging in by different methods with the same verified email does not create duplicate users
- [x] A new user is taken through onboarding once and can choose a unique username
- [x] Logout works and sessions expire
- [x] Login, register and reset requests are rate-limited
- [x] No password, token or secret appears in logs or in the repo
- [x] The README explains how to run the project and set up Google and Apple keys

## Using this doc in Antigravity

Give the agent this doc as its source of truth and let it work on one build-order item at a time.

**Setup**

1. Export this doc as Markdown and save it in your project as `docs/step-1-auth.md`, so the agent can read it from the repo.
2. Create the empty project folder and open it in Antigravity.
3. Start with build-order item 1 only. Do not ask for the whole of Step 1 in one go.

**Starter prompt (paste into the agent)**

```text
Read docs/step-1-auth.md. It is the source of truth for this project.

We are building Step 1 (onboarding and authentication) in small releases.
Today's task is build-order item 1 only: project setup.

Before writing any code:
1. Summarize in a few lines what you will create.
2. List the files you will add or change.
Wait for my approval, then implement.

Rules:
- Follow the data model, flows and security rules in the doc exactly.
- Do only the task I name. Do not start the next item.
- Ask me when something in the doc is unclear instead of guessing.
- Add tests for the happy path and main failure cases.
- Never commit secrets. Keep real keys in .env and update .env.example.
- When done, tell me how to run it and how to test it.
```

**For each next item**

1. Tell the agent: "Next task: build-order item N from the doc." Use the same plan-first rule.
2. Review the plan, approve it, run the result yourself, and read the diff.
3. Tick the item in this doc, commit, then move on.

Keep this doc updated when a decision changes (for example cookies versus tokens), so the agent never works from old information.
