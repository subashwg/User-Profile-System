# Portfolio Profile System: Step 2 Profile, Roles & Skills (Dev Brief)

Nov 18, 2026 · @Subash

## Goal and scope

Step 2 gives every user a public profile page that shows who they are and what they do, as one person with several roles. A user who finishes Step 2 has a shareable link like `yoursite.com/subash` showing a photo, a short bio, their roles (for example QA Engineer, Content Creator, Mentor) and the skills under each role.

This step needs Step 1 working first, at least build-order items 1 to 6 (users, login and onboarding with username).

**Included**

- Profile basics: headline, short bio, location, avatar
- Many roles per person, with one marked primary and a chosen order
- Skills under each role
- A public profile page at the user's username
- Draft or published control, so nobody is public by accident
- A "what do you do?" screen added to onboarding

**Not included yet** (later steps)

- Portfolio items (videos, courses, projects)
- Sections, layouts and templates
- Social links, testimonials, contact form
- Cover image, themes, custom domain
- Analytics, search and discovery

## Data model

One User has one Profile and many Roles. Each Role has many Skills. Later, portfolio items will attach to a Role, so a video can belong to "Content Creator" and a test framework to "QA Engineer".

The User table from Step 1 stays unchanged. The name and username already live there.

**Profile** (one per user)

| Field | Type | Notes |
| --- | --- | --- |
| id | UUID | Primary key |
| user\_id | UUID | Unique, points to User |
| headline | text | One line under the name, max 120 characters |
| bio | text | Max 500 characters, plain text |
| location | text | Free text, max 80 characters (for example "Kathmandu, Nepal") |
| avatar\_url | text | Optional; replaces the provider photo once the user uploads one |
| status | enum | draft or published; default draft |
| published\_at | timestamp | Set the first time it is published |
| created\_at, updated\_at | timestamp |  |

**Role** (many per user)

| Field | Type | Notes |
| --- | --- | --- |
| id | UUID | Primary key; later steps attach portfolio items to it |
| user\_id | UUID | Points to User |
| title | text | For example "Content Creator", max 60 characters |
| description | text | Optional one or two lines, max 200 characters |
| position | integer | Display order, starting at 0 |
| is\_primary | boolean | Exactly one primary role per user |
| created\_at, updated\_at | timestamp |  |

Rules: a user has 1 to 5 roles; role titles are unique per user (ignoring upper and lower case); deleting a role deletes its skills.

**Skill** (many per role)

| Field | Type | Notes |
| --- | --- | --- |
| id | UUID | Primary key |
| role\_id | UUID | Points to Role |
| name | text | For example "Playwright", max 40 characters |
| position | integer | Display order |

Rules: up to 15 skills per role; skill names are unique within a role (ignoring case). Skills are plain tags for now. If search by skill is needed later, they can move to a shared catalog without changing the screens.

**Role presets** (a fixed list in code, not a table)

Content Creator, Teacher, Entrepreneur, Developer, QA Engineer, Designer, Writer, Consultant, Coach, Other. The user can pick a preset or type their own title.

## Features, feature by feature

Each feature below is small enough to build and test alone.

**1. Profile basics**

- The user edits headline, bio and location on one screen.
- Name and username show at the top but are changed in account settings (Step 1).
- Counters show characters left (for example "312 / 500").
- Changes save with a Save button; no auto-save in this step.

**2. Avatar**

- The user uploads a photo; the app crops it to a square and shrinks it.
- If they logged in with Google and never upload one, the Google photo is used.
- With no photo at all, show a circle with the user's initials.
- The user can remove the photo.

**3. Roles**

- The user adds a role by picking a preset or typing their own title, with an optional short description.
- Up to 5 roles. One is the primary role and shows first, next to the name.
- The user reorders roles by drag and drop (or up/down buttons on mobile).
- Deleting a role asks for confirmation and warns that its skills go with it. Later, once portfolio items exist, it will also warn about them.
- The primary role cannot be deleted until another role is made primary.

**4. Skills**

- Under each role the user types a skill and presses Enter to add it as a chip; clicking x removes it.
- Up to 15 skills per role, reorderable.
- Typing a name that already exists in that role is ignored with a short message.

**5. Draft and published**

- A new profile is a draft. Only the owner can open the page, and a banner says "Only you can see this."
- The Publish button is enabled when the profile has a headline and at least one role.
- Unpublish turns the page back into a draft; the link then shows "not found" to visitors.

**6. Onboarding addition**

- Onboarding from Step 1 gets a third screen after username: "What do you do?"
- The user picks 1 to 5 role presets (or types their own) and marks one as primary.
- The screen can be skipped; the user then lands on the profile editor with no roles and a hint to add one.
- This screen creates the empty Profile record if it does not exist yet.

## Public profile page

The public page lives at `/<username>` and shows only what the owner chose to publish. It never shows an email address.

**What a visitor sees, top to bottom**

1. Avatar, name, headline and location
2. The primary role as a badge next to the name
3. Bio
4. One card per role in the saved order (primary first), each with its title, description and skill chips
5. A quiet placeholder: "Portfolio coming soon" (replaced in the next step)

**URL rules**

- Usernames are lowercase and already unique from Step 1. The route is case-insensitive and redirects to the lowercase form.
- Reserved words can never be usernames, because they collide with app routes: admin, api, app, login, logout, signup, settings, onboarding, profile, help, about, terms, privacy, support, www.
- An unknown username, or a draft seen by a stranger, returns the same "Profile not found" page with a 404 status, so drafts cannot be discovered.
- If the owner changes their username, the old link stops working in this step. Redirects from old usernames can be added later.

**Owner preview**

- The owner opening their own draft page sees the full page plus a banner: "Only you can see this. Publish when ready."

**Page basics for sharing**

- Page title: "\<Name> | \<Headline>"
- Description: the first 160 characters of the bio
- Preview image for link sharing: the avatar
- Draft pages tell search engines not to index them

**Empty states**

- No bio: the section is hidden for visitors; the owner sees a hint "Add a short bio".
- No skills in a role: the role card shows only its title and description.

## API endpoints

Step 2 adds about seventeen endpoints. Every endpoint except the public ones needs a logged-in user and only touches that user's own data.

| Endpoint | Purpose | Needs login |
| --- | --- | --- |
| GET /profile/me | Return my profile with roles and skills | Yes |
| PATCH /profile/me | Update headline, bio, location | Yes |
| POST /profile/me/avatar | Upload or replace the avatar | Yes |
| DELETE /profile/me/avatar | Remove the avatar | Yes |
| POST /profile/me/publish | Make the profile public | Yes |
| POST /profile/me/unpublish | Make it a draft again | Yes |
| GET /role-presets | Return the preset role titles | Yes |
| GET /roles | List my roles with skills | Yes |
| POST /roles | Add a role | Yes |
| PATCH /roles/:id | Edit title, description, primary flag | Yes |
| DELETE /roles/:id | Delete a role and its skills | Yes |
| PUT /roles/order | Save the new order of all roles | Yes |
| POST /roles/:id/skills | Add a skill to a role | Yes |
| DELETE /roles/:id/skills/:skillId | Remove a skill | Yes |
| PUT /roles/:id/skills/order | Save the new order of a role's skills | Yes |
| POST /onboarding/roles | Save the roles picked during onboarding | Yes |
| GET /public/:username | Return the public profile data | No |

The public endpoint returns only: name, username, avatar, headline, location, bio, roles and skills. It returns a 404 for unknown usernames and for drafts (unless the caller is the owner).

## Rules for the agent

The Step 1 security rules still apply. These are the extra rules for Step 2.

**Ownership and privacy**

- On every role and skill endpoint, check that the item belongs to the logged-in user. A request for someone else's item returns 404, not 403.
- The public endpoint returns an explicit list of allowed fields. Never return the whole User or Profile record, so email, login methods and internal ids do not leak.
- A draft profile is invisible to everyone except its owner.

**Validation (on the server, not only in the form)**

- Trim spaces. Reject empty titles and skill names.
- Enforce the limits in the data model: headline 120, bio 500, location 80, role title 60, role description 200, skill 40, 5 roles, 15 skills per role.
- Treat all text as plain text and escape it when displaying. Do not allow HTML or scripts in any field.
- Compare role titles and skill names ignoring upper and lower case when checking duplicates.
- Exactly one primary role: setting a new primary clears the old one in the same database transaction.
- Reordering endpoints must receive every id of the list exactly once; otherwise reject.

**Avatar upload**

- Allow JPEG, PNG and WebP only. Check the real file content, not just the extension.
- Maximum 2 MB. Resize to a 512 x 512 square and save as WebP or JPEG.
- Save under a random file name, never the original name. Use local disk in development and S3-compatible storage later; keep the storage behind one small service so it can be swapped.
- Delete the old file when a new avatar replaces it.

**Abuse limits**

- Rate-limit avatar upload and profile saves per user.
- Rate-limit the public endpoint per IP to reduce scraping.

## Build order

Build in eight small releases, one at a time. Finish, test and commit each before starting the next.

- [ ] 1\. Database: Profile, Role and Skill tables and the first migration; create an empty Profile for every user who already has an account
- [ ] 2\. Profile basics: GET and PATCH /profile/me with validation and the character limits
- [ ] 3\. Avatar: upload, resize, replace, remove, initials fallback, Google photo fallback
- [ ] 4\. Roles: presets endpoint, add, edit, delete, primary role, reorder, limit of 5
- [ ] 5\. Skills: add, remove, reorder, limits and duplicate checks
- [ ] 6\. Onboarding screen "What do you do?" with POST /onboarding/roles, skippable
- [ ] 7\. Public profile: GET /public/:username, the `/<username>` page, draft and published, owner preview, publish and unpublish, reserved usernames
- [ ] 8\. Profile editor screen, page title and sharing tags, tests and the ownership and privacy checks

For each release, write tests for the happy path and the main failure cases: someone else's role id, a sixth role, a duplicate skill, a draft opened by a stranger, an oversized or fake image file.

## Definition of done

Step 2 is finished when every item below is true and tested.

- [ ] A new user can pick roles during onboarding, or skip and add them later
- [ ] A user can edit headline, bio and location with the limits enforced
- [ ] A user can upload, replace and remove an avatar, and a fake or oversized file is rejected
- [ ] A user can add up to 5 roles, reorder them and change the primary role
- [ ] A user can add and remove skills under each role, with no duplicates
- [ ] The public page at the user's username shows avatar, name, headline, location, bio and role cards
- [ ] A draft is visible only to its owner; strangers get the same 404 as for an unknown username
- [ ] Publish needs a headline and at least one role; unpublish works
- [ ] Reserved words cannot be used as usernames
- [ ] The public response contains no email or internal data
- [ ] One user cannot read or change another user's roles or skills
- [ ] The README is updated with how to run Step 2 and where uploaded files are stored

## Starter prompt for Antigravity

Save this doc in the project as `docs/step-2-profile.md` next to the Step 1 file, then paste the prompt below for build-order item 1. For each next item, change only the task line.

```text
Read docs/step-1-auth.md and docs/step-2-profile.md. They are the source of truth.
Step 1 (authentication and onboarding) is already built. We are now building Step 2 (profile, roles and skills) in small releases.

Today's task is build-order item 1 of Step 2 only: the database tables and migration.

Before writing any code:
1. Look at the existing project structure and tell me what you found.
2. Summarize what you will create and list the files you will add or change.
Wait for my approval, then implement.

Rules:
- Follow the data model, limits, rules and security notes in the Step 2 doc exactly.
- Reuse the existing User table, auth guard and project conventions. Do not rewrite Step 1 code.
- Do only the task I name. Do not start the next item.
- Ask me when something is unclear instead of guessing.
- Add tests for the happy path and the main failure cases.
- When done, tell me how to run it and how to test it.
```

After each item: run it yourself, read the diff, tick the item in this doc, commit, then move on.
