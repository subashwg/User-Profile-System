# Portfolio Profile System: Step 3 Portfolio Items & Design (Dev Brief)

Nov 19, 2026 · @Subash

## Goal and scope

Step 3 lets a user show their work. After this step a profile has portfolio items (a YouTube video, an article, a course, a project) shown as good-looking cards, grouped by the roles built in Step 2. The visitor sees a featured row at the top, a filter by role, and a grid of work.

This step needs Step 2 working first, because every item belongs to a role.

**Included**

- Portfolio items with a kind: video, article, course, project, product or other
- Adding an item by pasting a link, with title, description and cover filled in automatically
- Cover image from the link, or uploaded by the user
- Featuring up to 5 items, hiding items, reordering, deleting
- A public portfolio area on the profile page: featured row, role filter, card grid
- A proper visual design for the profile and cards (see Design direction)

**Not included yet** (later steps)

- Custom sections and drag-and-drop page layout
- Image galleries, file or PDF uploads, embedded video players
- Social links, testimonials, contact form
- Themes, custom domain, analytics
- Item detail pages (a card opens the original link for now)

## Data model

One table is added: Portfolio item. Each item belongs to one Role (built in Step 2), so a video sits under "Content Creator" and a test framework under "QA Engineer". The User, Profile, Role and Skill tables stay unchanged.

**Portfolio item**

| Field | Type | Notes |
| --- | --- | --- |
| id | UUID | Primary key |
| user\_id | UUID | Points to User; kept for fast ownership checks |
| role\_id | UUID | Points to Role; required |
| kind | enum | video, article, course, project, product or other |
| title | text | Required, max 100 characters |
| description | text | Optional, max 300 characters, plain text |
| url | text | Required, must be a valid http or https link, max 2000 characters |
| cover\_url | text | Optional; the stored image or the thumbnail found from the link |
| cover\_source | enum | none, link or upload; tells the app where the cover came from |
| source\_site | text | Site name shown on the card, for example "YouTube"; derived from the link |
| published\_on | date | Optional "when it was made"; shown as month and year |
| is\_featured | boolean | Shown in the featured row; default false |
| is\_hidden | boolean | Hidden items stay in the editor but not on the public page |
| position | integer | Display order within the role, starting at 0 |
| created\_at, updated\_at | timestamp |  |

**Limits and rules**

- Up to 50 items per user and up to 5 featured items per user.
- The same url cannot be added twice by one user (compare after removing a trailing slash and tracking parameters like utm\_source).
- Deleting a role from Step 2 must now warn about its items and delete them in the same transaction.
- Moving an item to another role puts it at the end of that role's list.

**Kind presets** (a fixed list in code)

Each kind has a label, a small icon and a call-to-action word used on the card: video (Watch), article (Read), course (Open course), project (View project), product (View product), other (Open).

## Features, feature by feature

Each feature is small enough to build and test alone.

**1. Add an item by pasting a link**

- The user clicks "Add work" and pastes a link. That is the only required step.
- The app looks up the link and fills in a suggested title, description, cover and kind. The user can change every field before saving.
- For YouTube links the app builds the thumbnail from the video id and sets the kind to video.
- If the lookup fails or is slow (more than 5 seconds), the form stays usable and says "We couldn't read this link. Fill in the details yourself."
- The user picks a role from their own roles. If they have only one role it is preselected.
- A live card preview on the side shows exactly how the item will look.

**2. Cover image**

- Three choices: use the cover found from the link, upload an image, or none.
- With no cover, the card shows a coloured block with the kind's icon, so the grid never has holes.
- Uploaded images are cropped to 16:9 and shrunk.

**3. Manage items**

- One list screen shows all items grouped by role, with a thumbnail, title and small status labels (Featured, Hidden).
- Edit opens the same form as Add.
- Feature or unfeature with a star button. A sixth featured item is blocked with a clear message.
- Hide or show with an eye button.
- Reorder items inside a role by drag and drop, with up and down buttons as the keyboard and mobile option.
- Move an item to a different role from the edit form.
- Delete asks for confirmation.

**4. Role filter on the public page**

- Visitors see chips: All, then one chip per role that has at least one visible item.
- Choosing a chip filters the grid without reloading the page.
- The chip choice is stored in the page address (for example `?role=content-creator`) so a filtered view can be shared.

**5. Profile editor additions**

- A new "Work" tab next to the profile basics and roles tabs from Step 2.
- The checklist shown to new users gets a line: "Add your first work item."

## Design direction

The design should make a user's work look good without effort, whether they teach, create or run a business. A companion Design file with mockups of the profile page, the card kinds and the add-work screen goes with this doc. The tokens below are the shared source for both.

**Principles**

1. The work is the star. The interface stays quiet: warm neutrals, one accent colour, no decoration that competes with covers.
2. One structure for every kind of user. Creators, teachers and entrepreneurs all get the same clean page; only content differs. Per-user colour themes come in a later step.
3. Generous space. Large gaps between sections, short text blocks, nothing cramped.
4. Mobile first. Design the phone layout first, then widen.
5. Nothing jumps. Loading placeholders have the same size as the real cards.

**Colour tokens**

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| background | #FAFAF7 | #0F1115 | Page background |
| surface | #FFFFFF | #171A20 | Cards, forms |
| text | #16181D | #F2F3F5 | Titles and body |
| text-muted | #5B6270 | #A0A7B4 | Descriptions, captions |
| border | #E6E4DE | #2A2E37 | Card and input outlines |
| accent | #0E7C7B | #3CC6C4 | Buttons, links, selected chip |
| accent-soft | #E3F3F2 | #12302F | Selected chip fill, highlights |
| danger | #B42318 | #F97066 | Delete, errors |

Two more tokens keep the design accessible. **accent-strong** (#0A5F5E light, #7EE0DE dark) is the text colour on accent-soft fills, such as a selected chip, because the main accent is slightly too light there. **border-strong** (#8C919B light, #5B6270 dark) outlines form inputs so they stand out from the page. Build the dark values now and switch dark mode on later. Check that normal text always has at least 4.5:1 contrast with its background.

**Kind tints** (cover placeholder fill and icon colour, used when an item has no cover)

| Kind | Fill | Icon |
| --- | --- | --- |
| Video | #FDE7E1 | #C2412D |
| Article | #E8EEFB | #3156B8 |
| Course | #FFF1D6 | #A86400 |
| Project | #E6F4EA | #1E7A3E |
| Product | #F3E8FB | #7A3FB0 |
| Other | #EEEEEA | #5B6270 |

**Type scale** (Inter, with the system font as fallback)

| Style | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| Display | 32/40 (28/36 on phones) | 650 | Name on the profile |
| Heading | 22/30 | 650 | Section titles such as "Featured" |
| Card title | 17/24 | 600 | Item title, max 2 lines |
| Body | 15/24 | 400 | Bio, descriptions |
| Small | 13/20 | 500 | Chips, buttons, labels |
| Caption | 12/16 | 500 | Source site and date |

**Space, shape and depth**

- Spacing steps (4px base): 4, 8, 12, 16, 24, 32, 48, 64. Use only these.
- Corner radius: cards 16, buttons and inputs 10, chips and badges fully round, avatar a circle.
- Cards at rest: 1px border and a very soft shadow (0 1px 2px at 4% black).
- Cards on hover or focus: shadow 0 8px 24px at 8% black and a 2px lift over 150 ms. Turn the motion off when the visitor prefers reduced motion.

**Layout**

- Content width up to 1040px, side padding 24px (16px on phones).
- Card grid: 3 columns from 1024px, 2 columns from 640px, 1 column below. Gap 24px (16px on phones).
- Profile header: avatar 112px (88px on phones), name, primary role badge, headline, location, bio. On phones it stacks and is centred; on desktop the avatar sits to the left.

**Portfolio card anatomy** (top to bottom)

1. Cover, 16:9, rounded at the top. Kind badge over the top-left corner: small icon plus label such as "Video".
2. Body, 16px padding: source site and date in caption style ("YouTube · Mar 2026").
3. Title in card-title style, 2 lines at most, then an ellipsis.
4. Description in muted body style, 2 lines at most.
5. Footer: role label (shown only when the filter is on All) and the call to action in accent colour with an arrow, such as "Watch →".

The whole card is one link (one tab stop) that opens the original page in a new tab. The cover image is decorative, so it gets an empty alt text and the title carries the meaning.

**Featured row**

- A "Featured" heading, then larger cards (about 360px wide) in a row that scrolls sideways and snaps to each card. On phones each card is 85% of the screen width so the next one peeks in.
- The Featured row always shows every featured item, whatever role filter is chosen. Featured items are not repeated in the grid below it.

**States to design for every screen**

| State | Behaviour |
| --- | --- |
| Loading | Grey placeholder cards in the real card size with a slow shimmer |
| Empty (owner) | One dashed card: "Add your first work" with a button |
| Empty (visitor) | The whole portfolio area is hidden; nothing says "empty" |
| Link lookup failed | Inline message above the form fields; fields stay editable |
| Broken cover | Fall back to the kind tint with its icon |
| Hidden item (editor only) | 50% opacity, eye-off icon and the word "Hidden" |
| Focus | 2px accent ring with a 2px offset on every interactive element |

**Editor screens**

- Add or edit work: form on the left, live card preview on the right. On phones the preview sits under the link field and can be collapsed.
- Work list: one row per item with a 96px thumbnail, title, role, status labels (Featured, Hidden) and action buttons. Grouped under role headings.

**Accessibility**

- Touch targets at least 44 by 44px.
- Status is never shown by colour alone: Featured and Hidden use an icon and a word.
- Filter chips are real buttons that report their selected state to screen readers.
- Icon-only buttons have text labels for screen readers.
- Drag to reorder always has an up and down button alternative.

## Public page changes

The "Portfolio coming soon" placeholder from Step 2 is replaced by the real portfolio area. The page at `/<username>` now reads like this, top to bottom:

1. Profile header from Step 2 (avatar, name, primary role badge, headline, location, bio)
2. Role cards with skills from Step 2, now more compact so the work appears sooner
3. **Featured** row (hidden if there are no featured items)
4. **Work** heading with the filter chips: All, then one chip per role that has visible items
5. Card grid of the remaining visible items, ordered by role order and then item order
6. A quiet footer line: "Made with \<product name>"

**Behaviour**

- The filter works on the page without reloading, and the chosen role is saved in the address as `?role=<role-slug>` so it can be shared.
- Under All, items are grouped by role order (the primary role first), then by each item's saved position.
- A role with no visible items gets no chip and no section.
- A page with a headline and roles but no items simply shows no Work area to visitors. The owner sees the dashed "Add your first work" card.
- Show the first 12 items; a "Show more" button loads the next 12. This keeps the page fast for users with many items.
- The page title and sharing preview from Step 2 stay the same.

**What the public data contains**

For each visible item: id, kind, title, description, url, cover, source site, date, role id and whether it is featured. Hidden items and internal fields are never sent.

## API endpoints

Step 3 adds about ten endpoints. Everything except the public data needs a logged-in user and only touches that user's own items.

| Endpoint | Purpose | Needs login |
| --- | --- | --- |
| POST /items/preview | Give a link, get back a suggested title, description, cover, kind and source site | Yes |
| GET /items | List all my items (including hidden), grouped by role | Yes |
| POST /items | Create an item | Yes |
| GET /items/:id | Return one of my items | Yes |
| PATCH /items/:id | Edit fields, move to another role, feature, hide | Yes |
| DELETE /items/:id | Delete an item and its uploaded cover | Yes |
| PUT /roles/:roleId/items/order | Save the new order of the items in a role | Yes |
| POST /items/:id/cover | Upload a cover image | Yes |
| DELETE /items/:id/cover | Remove the cover | Yes |
| GET /public/:username/items | Visible items of a published profile, with `role`, `offset` and `limit` options | No |

The existing GET /public/:username from Step 2 also returns the featured items, so the first screen needs only one request. The public items endpoint returns 404 for unknown usernames and for drafts, exactly like the profile.

## Rules for the agent

The Step 1 and Step 2 rules still apply. These are the extra rules for Step 3. The link preview is the riskiest part of this step, so build it with care.

**Link preview safety** (the server opens links that users type, so attackers will try to misuse it)

- Allow only http and https links. Reject everything else (file, ftp, javascript, data).
- Before fetching, resolve the host name and refuse private, loopback and internal addresses (for example 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16 and their IPv6 equivalents). Check again after every redirect, and follow at most 3 redirects.
- Time out after 5 seconds and read at most 1 MB of the page. Only read the head of the HTML to find the title, description and preview image tags.
- Send a clear user-agent name and do not forward the user's cookies or login data.
- Rate-limit the preview endpoint per user (for example 20 per minute).
- Treat everything found on the page as untrusted plain text. Cut it to the field limits and escape it on display.
- If a preview image address is found, validate it the same way before saving or showing it.
- Never show an error that reveals internal details; return "We couldn't read this link."

**Links on the public page**

- Item links open in a new tab with `rel="noopener noreferrer"`.
- Store links as typed after cleaning, but never display a javascript or data link even if one reaches the database.
- Remove common tracking parameters (utm\_source, utm\_medium, utm\_campaign, fbclid, gclid) when checking for duplicates.

**Cover uploads**

- Same rules as the Step 2 avatar: JPEG, PNG or WebP, real content check, random file names, old file deleted on replace.
- Maximum 5 MB. Crop to 16:9, resize to 1280 x 720 and also make a 640 x 360 version for the grid.
- Preview images found by the link lookup are downloaded and stored by the app, not hot-linked, so covers do not disappear or leak visitor data to other sites. If a download fails, fall back to the kind tint.

**Ownership, privacy and limits**

- Every item endpoint checks that the item belongs to the logged-in user and that the chosen role is also theirs. Otherwise return 404.
- The public endpoints return an explicit list of fields and never hidden items.
- Enforce 50 items per user and 5 featured items per user on the server, inside the same transaction that saves the change.
- A reorder request must include every item id of that role exactly once.
- Plain text only in title and description; no HTML.

## Build order

Build in ten small releases, one at a time. Finish, test and commit each before starting the next. The design tokens come first so every later screen uses them.

- [x] 1\. Design foundation: colour, type, spacing and radius tokens (with dark mode values), plus the shared components: button, chip, badge, card shell, skeleton, empty-state card, focus ring
- [x] 2\. Database: Portfolio item table, kind enum and migration; update the Step 2 role delete to remove items
- [x] 3\. Items CRUD without previews: create, list, edit, delete, kind, role, limits, duplicate-link check
- [x] 4\. The portfolio card component with all kinds, the tint fallback and every state in the Design direction, shown first on a simple test page
- [x] 5\. Feature, hide, reorder and move between roles, with the 5-featured limit
- [ ] 6\. Link preview: safe fetching, YouTube shortcut, title, description and cover suggestions, failure message
- [ ] 7\. Cover upload and storing of found covers, with resizing
- [ ] 8\. Add and edit work screens with the live card preview, and the Work list screen
- [ ] 9\. Public page: featured row, role filter chips with `?role=`, card grid, Show more, owner empty state
- [ ] 10\. Design polish pass (spacing, hover, focus, phone layout, dark mode check), accessibility check, tests, privacy and ownership checks

For each release, write tests for the happy path and the main failure cases: someone else's item or role, a 51st item, a sixth featured item, a duplicate link, a private-address link (such as `http://127.0.0.1`), a slow link, a fake image file, a draft profile opened by a stranger.

## Definition of done

Step 3 is finished when every item below is true and tested.

- [ ] A user can add a work item by pasting a link and get a suggested title, description, cover and kind
- [ ] When the link lookup fails, the user can still fill in and save the item by hand
- [ ] A user can upload, replace and remove a cover; fake or oversized files are rejected
- [ ] A user can edit, move to another role, feature, hide, reorder and delete items
- [ ] The limits hold on the server: 50 items, 5 featured, no duplicate links
- [ ] Links to private or internal addresses are refused by the preview, including through redirects
- [ ] The public page shows the Featured row, the role chips, the grid and Show more, as designed
- [ ] Visitors never see hidden items, drafts or any email or internal field
- [ ] A role with no visible items shows no chip; a profile with no items shows no Work area to visitors
- [ ] Cards, forms and screens match the Design direction on phone, tablet and desktop
- [ ] Every state is built: loading, empty, failed lookup, broken cover, hidden, focus
- [ ] Keyboard-only use works for adding, reordering and filtering; text contrast is at least 4.5:1
- [ ] One user cannot read or change another user's items
- [ ] The README is updated with how Step 3 works and where covers are stored

## Starter prompt for Antigravity

Save this doc in the project as `docs/step-3-portfolio.md` next to the Step 1 and Step 2 files. Also save the companion Design file (export it as an image or PDF, or keep its link) in `docs/design/`, so the agent can look at the screens. Then paste the prompt below for build-order item 1. For each next item, change only the task line.

```text
Read docs/step-1-auth.md, docs/step-2-profile.md and docs/step-3-portfolio.md. They are the source of truth.
Steps 1 and 2 are already built. We are now building Step 3 (portfolio items and the visual design) in small releases.

Today's task is build-order item 1 of Step 3 only: the design foundation (tokens and shared components).

Before writing any code:
1. Look at the existing project structure and styling approach, and tell me what you found.
2. Summarize what you will create and list the files you will add or change.
Wait for my approval, then implement.

Rules:
- Follow the Design direction section exactly: tokens, type scale, spacing steps, radius, states and accessibility. Do not invent new colours or sizes.
- Look at the images in docs/design/ and match them.
- Follow the data model, limits and security rules in the Step 3 doc exactly. The link preview rules are not optional.
- Reuse the existing User, Profile, Role and Skill code. Do not rewrite Steps 1 and 2.
- Do only the task I name. Do not start the next item.
- Ask me when something is unclear instead of guessing.
- Add tests for the happy path and the main failure cases.
- When done, tell me how to run it and how to test it.
```

After each item: run it yourself, look at it on a phone-width window and a desktop window, read the diff, tick the item in this doc, commit, then move on.
