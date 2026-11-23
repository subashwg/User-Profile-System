# Portfolio Profile System

A portfolio and profile platform built in structured, verified releases.

## Step 1: Auth & Onboarding

Step 1 implements authentication (Email + Password, Google, Apple), session management, and onboarding (name and unique username).

## Step 2: Profile, Roles & Skills

Step 2 delivers the portfolio profile creator and public profile system:
- **Profile Basics**: Headline (max 120 chars), short bio (max 500 chars), location (max 80 chars) with server-side length limits and HTML tag stripping.
- **Avatar System**: Upload JPEG, PNG, or WebP with magic byte validation (max 2 MB), auto-resized to 512×512 square WebP. Replaces previous images on disk. Tiered fallbacks to Google OAuth picture or initials circle with deterministic color hashing.
- **Avatar Storage Location**: Stored locally on disk at `backend/uploads/avatars/` via an abstracted `StorageService` interface ready for S3 migration.
- **Roles Management**: Add up to 5 roles from presets or custom titles (max 60 chars) and descriptions (max 200 chars). Exactly one primary role supported; drag/reorder roles by position.
- **Skills Management**: Add up to 15 skills per role (max 40 chars) with case-insensitive duplicate prevention, tag pills, reordering, and individual removal.
- **Onboarding Step**: "What do you do?" screen during onboarding to pick up to 5 preset roles with skills preview (skippable).
- **Public Profile (`/@<username>` or `/<username>`)**:
  - Displays avatar, name, primary role badge, headline, location, bio, and role cards with skills pills in position order.
  - "Portfolio coming soon" section placeholder for future project showcases.
  - Empty states: Bio hidden for visitors (hint shown to owner); role with no skills shows title and description.
  - Dynamic page titles (`<Name> | <Headline>`), meta description tags, and `<meta name="robots" content="noindex, nofollow">` for drafts.
- **Draft & Published Flow**:
  - Profiles start in `draft` mode.
  - Drafts are invisible to visitors and search engines (returning standard 404s).
  - Owners preview their draft with a private banner and instant "Publish Now" button.
  - Publishing requires a headline and at least 1 role.
  - One-click "Unpublish" to revert to draft mode.
  - Strict privacy sanitization: public endpoints never expose emails, user IDs, or login methods.
  - Reserved words (`app`, `www`, `api`, `admin`, `auth`, `public`, `settings`, `onboarding`) cannot be used as profile handles.

### Step 2 API Endpoints

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| `GET` | `/profile/me` | Fetch authenticated user's profile basics | Yes |
| `PATCH` | `/profile/me` | Update headline, bio, location | Yes |
| `POST` | `/profile/me/avatar` | Upload or replace avatar image (multipart/form-data) | Yes |
| `DELETE` | `/profile/me/avatar` | Remove custom avatar | Yes |
| `POST` | `/profile/me/publish` | Publish profile (requires headline and ≥1 role) | Yes |
| `POST` | `/profile/me/unpublish` | Revert profile to private draft | Yes |
| `GET` | `/roles/presets` | Get preset role titles | Yes |
| `GET` | `/roles` | List authenticated user's roles with skills | Yes |
| `POST` | `/roles` | Add a role (max 5) | Yes |
| `PATCH` | `/roles/:id` | Edit role title, description, or primary flag | Yes |
| `DELETE` | `/roles/:id` | Delete role and its skills | Yes |
| `PUT` | `/roles/order` | Reorder all roles by position | Yes |
| `POST` | `/roles/:id/skills` | Add skill to role (max 15) | Yes |
| `DELETE` | `/roles/:id/skills/:skillId` | Remove skill from role | Yes |
| `PUT` | `/roles/:id/skills/order` | Reorder role's skills | Yes |
| `POST` | `/onboarding/roles` | Save roles selected during onboarding | Yes |
| `GET` | `/public/:username` | Return sanitized public profile or owner draft preview | No (Session checked) |

---

## Step 3: Portfolio Items & Visual Design System

Step 3 introduces the portfolio item management and showcase system:
- **6 Kind Presets**: Each item belongs to one of six semantic presets: `video`, `article`, `course`, `project`, `product`, or `other`, styled with dedicated color badges, icons, and contextual call-to-actions ("Watch →", "Read →", "Learn →", "View project →", "View product →", "Visit →").
- **Link Preview Engine**:
  - Automatically fetches metadata (title, description, cover image, source site, kind) from pasted links.
  - **YouTube Shortcut**: Extracts video ID from YouTube URLs and directly queries the YouTube oEmbed API for fast, reliable titles and high-resolution thumbnail images without full page scraping.
  - **SSRF Guard**: Strict server-side validation rejecting private, loopback, and carrier-grade NAT addresses (e.g. `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `100.64.0.0/10`, and IPv6 equivalents) across initial hostnames and after every redirect (up to 3 redirects max). Enforces 5-second timeout and 1 MB read limit.
  - **Rate Limiting**: 20 preview requests per minute per user.
  - **Fallback Safety**: If preview lookup fails, users are guided by an inline notification while all form fields remain editable for manual input.
- **Cover Image Processing & Storage**:
  - **Storage Location**: Stored locally on disk at `backend/uploads/covers/` (served at `/uploads/covers/:filename`) via `StorageService`.
  - **Resizing**: Uploaded covers (JPEG, PNG, WebP up to 5 MB) are validated via magic bytes and processed into two 16:9 WebP variants: full resolution (1280×720) and grid thumbnail (640×360).
  - **Remote Cover Storing**: Preview covers found on external websites are safely downloaded, SSRF-validated, and stored locally so visitor IPs and privacy are never leaked to external sites.
  - **Tint Fallbacks**: Items without a cover image use the kind's designated soft tint background with centered icon.
- **Organization & Limits**:
  - **Strict Server-Side Limits**: Enforces a maximum of 50 portfolio items per user and a maximum of 5 featured items per user.
  - **Duplicate Detection**: Prevents duplicate URLs per user, stripping marketing parameters (`utm_*`, `fbclid`, `gclid`).
  - **Reordering**: Drag-and-drop and accessible up/down buttons within each role (`PUT /roles/:roleId/items/order`).
  - **Cascade Delete**: Deleting a role cleanly deletes its associated portfolio items and their cover images from disk.
- **Editor Screens**:
  - Dedicated "Work & Portfolio" tab in the profile editor.
  - Add/Edit form with live desktop sticky preview card and collapsible mobile preview.
  - Work list grouped by role with 96px 16:9 thumbnails, status badges ("Featured", "Hidden"), drag handles, and 44px touch-target action buttons.
- **Public Profile (`/@<username>` or `/<username>`)**:
  - **Featured Row**: Top horizontal snap-scroll row with ~360px cards (85% viewport width on mobile) displaying up to 5 featured items across all roles.
  - **Role Filter Chips**: Interactive button chips ("All" + roles with visible items) synced with the URL query `?role=<role-slug>` supporting direct links.
  - **Responsive Grid**: 3 columns on desktop (≥1024px), 2 columns on tablet (≥640px), 1 column on mobile.
  - **Show More Pagination**: Displays first 12 items with a "Show more" button loading subsequent items.
  - **Empty States**: Public portfolio area is completely hidden for visitors when empty; owners see a dashed "Add your first work item" card.
  - Quiet footer line: "Made with UserProfile".

### Step 3 API Endpoints

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| `POST` | `/items/preview` | Safe link preview fetcher (title, description, cover, kind) with SSRF guard | Yes |
| `GET` | `/items` | List user's portfolio items grouped by role (includes hidden items) | Yes |
| `POST` | `/items` | Create a new portfolio item (validates 50-item limit and duplicate URLs) | Yes |
| `GET` | `/items/:id` | Return details of a specific portfolio item | Yes |
| `PATCH` | `/items/:id` | Update item details, move to role, toggle featured (max 5), toggle hidden | Yes |
| `DELETE` | `/items/:id` | Delete an item and its associated cover image file | Yes |
| `PUT` | `/roles/:roleId/items/order` | Reorder all items within a role | Yes |
| `POST` | `/items/:id/cover` | Upload cover image (cropped to 16:9, generates 1280x720 & 640x360 WebP) | Yes |
| `DELETE` | `/items/:id/cover` | Remove cover image and revert to kind tint fallback | Yes |
| `GET` | `/public/:username` | Returns public profile with `featured_items` array | No (Session checked) |
| `GET` | `/public/:username/items` | Returns paginated visible items with `role`, `limit`, and `offset` query options | No (Session checked) |
| `GET` | `/uploads/covers/:filename` | Serves cover images with 1-year immutable cache headers | No |

---

### Tech Stack
- **Backend:** NestJS (TypeScript, Node.js 24)
- **Database & ORM:** PostgreSQL + Prisma ORM
- **Frontend:** React + TypeScript (Vite)
- **Sessions:** Secure HttpOnly Cookie Sessions
- **Testing:** Vitest + Supertest

---

## Project Structure

```text
User-profile/
├── backend/                  # NestJS backend application
│   ├── prisma/               # Prisma schema and migrations
│   ├── src/
│   │   ├── config/           # Environment validation & configuration
│   │   ├── health/           # Health check & database connection endpoints
│   │   ├── prisma/           # Prisma client service with lifecycle management
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/                 # Integration / E2E tests
│   ├── .env.example          # Environment variable template
│   └── package.json
├── frontend/                 # React frontend application (Vite)
│   ├── src/                  # React UI components
│   ├── .env.example
│   └── package.json
├── docs/                     # Specifications & dev briefs
│   └── step-1-auth.md
├── package.json              # Root workspace scripts
└── README.md
```

---

## Prerequisites

- **Node.js**: v22+ (v24 recommended)
- **npm**: v10+
- **PostgreSQL**: v14+ running locally or remotely (e.g. `postgresql://postgres:postgres@localhost:5432/user_profile`)

---

## Getting Started

### 1. Environment Configuration

Copy the example environment files for backend and frontend:

```bash
# In backend/
cp backend/.env.example backend/.env

# In frontend/
cp frontend/.env.example frontend/.env
```

Ensure your `backend/.env` has a valid `DATABASE_URL`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/user_profile?schema=public"
```

### 2. Generate Prisma Client

```bash
npm run prisma:generate
# or
cd backend && npm run prisma:generate
```

### 3. Run the Development Servers

**Run backend (NestJS):**
```bash
npm run start:backend
# or
cd backend && npm run start:dev
```
The backend starts at [http://localhost:3000](http://localhost:3000).
Check health endpoint: [http://localhost:3000/health](http://localhost:3000/health).

**Run frontend (React):**
```bash
npm run start:frontend
# or
cd frontend && npm run dev
```
The frontend starts at [http://localhost:5173](http://localhost:5173).

### 4. OAuth Configuration (Google & Apple)

#### Setting up Google OAuth
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `Portfolio Profile`).
3. Under **APIs & Services > OAuth consent screen**, set User Type to External, fill in your app details, and add the scopes `email`, `profile`, `openid`.
4. Under **APIs & Services > Credentials**, click **Create Credentials > OAuth client ID**.
5. Choose **Web application**:
   - **Authorized JavaScript origins**: `http://localhost:3000`, `http://localhost:5173`
   - **Authorized redirect URIs**: `http://localhost:3000/auth/google/callback`
6. Copy the generated **Client ID** and **Client Secret** into your `backend/.env`:
   ```env
   GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"
   ```

#### Setting up Sign in with Apple
1. Register an App ID and a Services ID on the [Apple Developer Portal](https://developer.apple.com/account/).
2. Enable **Sign in with Apple** on the Services ID.
3. Configure the domain and Return URL:
   - **Domains**: your domain (or tunnel for local testing)
   - **Return URLs**: `http://localhost:3000/auth/apple/callback`
4. Generate a private key (`.p8`) for Sign in with Apple and record your **Key ID** and **Team ID**.
5. Add the values to `backend/.env`:
   ```env
   APPLE_CLIENT_ID="your.service.id"
   APPLE_TEAM_ID="your-team-id"
   APPLE_KEY_ID="your-key-id"
   APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
   APPLE_CALLBACK_URL="http://localhost:3000/auth/apple/callback"
   ```

---

## Running Tests

### Backend Unit Tests
Runs unit tests for environment validation, controllers, and services:
```bash
npm run test:backend
# or
cd backend && npm run test
```

### Backend E2E Tests
Runs end-to-end integration tests (NestJS server lifecycle & health endpoint):
```bash
npm run test:backend:e2e
# or
cd backend && npm run test:e2e
```

### Production Build
```bash
npm run build:backend
npm run build:frontend
```
