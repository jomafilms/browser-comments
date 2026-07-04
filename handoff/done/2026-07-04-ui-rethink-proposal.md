# ui-rethink — IA Proposal (Phase A)

**Status:** awaiting Annie's approval — no code until this is approved/edited.
**Verified against:** live walk of `/c/{token}` (client + project tokens), `/admin`, local dev DB, prod read-only counts (2026-07-03).

---

## 1. What's actually confusing today (verified live, not just from the brief)

Walked the running app with a client token, a freshly generated project token, and an owner session:

1. **The magic link lands in the wrong place.** `/c/{token}` with one project auto-redirects to `/c/{token}/{projectId}` — the **annotation canvas**: a drawing toolbar over an iframe of the project URL, with **no header, no branding, no nav, no client name**. If the site doesn't render in an iframe (auth-gated, X-Frame-Options, localhost) it's a blank page with a toolbar. A client's first impression of "their portal" is an empty drawing app. The project-picker "portal" page only ever appears for multi-project clients (3 of 6 prod clients).
2. **Token scope is invisible.** A client token and a project token render pixel-identical UIs — same header ("Living With Fire Demo"), same nav, same settings page. Nothing anywhere answers "what can this link see?"
3. **Project context is a buried filter.** The only project control is a `Projects` dropdown sitting among five other filters on the comments page. Decisions and capture don't share it. Refs like `LWF-12` appear on cards but nothing connects the `LWF` prefix to a project.
4. **Settings lie to project-token users.** The settings page ignores the API's `readOnly` flag for the Widget section: a project-token user gets a fully editable form and a Save button, and only learns via a 403 alert *after* clicking Save. (NotificationSettings handles this correctly — banner + disabled fieldset; the Widget section doesn't.) The embed tab also shows the **client-level** widget key to project tokens.
5. **The origin→project routing is invisible.** The widget key is per-CLIENT, but submissions route to a project by origin matching against project URLs — and the client-facing UI never shows project URLs at all (they're admin-only). A client user cannot answer "which sites can submit here."
6. **Four credential-ish strings, no unified view.** Client magic link, project magic links/tokens, widget key, webhook secrets — scattered across the admin clients list, the admin projects table, settings→Widget→Embed Code, and settings→Webhooks. Webhooks aren't visible in admin at all.
7. **Admin flattens the hierarchy.** `/admin` is a flat Clients list + a *separate* all-clients Projects table. The client→project ownership is a text column. Each client row has six action buttons; keys live behind different expanders than links.
8. **Mobile is broken in places.** Settings' fixed 192px sidebar doesn't collapse (content pushed off-screen at 375px), the top nav clips ("Settin…"), the filter bar stacks awkwardly.
9. **Orphan tickets: resolved non-issue.** Prod has **0** comments with NULL project (v4 backfill). Only local dev has orphan test rows, and those have NULL client_id too — invisible to every scope including client scope. The widget can no longer create orphans (it always resolves/rejects). Recommendation below is "minimal safety net, not a feature."

---

## 2. Recommended IA

### 2.1 Client-facing `/c/{token}` — one dashboard, scope always visible

**Principle: the magic link opens a dashboard, not a canvas. Scope is stated in the header, always.**

```
┌──────────────────────────────────────────────────────────────────────┐
│ [logo] Company Name      Comments · Decisions · Settings   [＋ Capture]│
│        Living With Fire  ┌─────────────────┐                          │
│                          │ All projects ▾  │   Support: a@b.com       │
│                          └─────────────────┘                          │
└──────────────────────────────────────────────────────────────────────┘
   scope pill: client token = switcher ("All projects / LWF App UI (LWF) / …")
               project token = fixed label "LWF App UI (LWF) · project link"
```

- **`/c/{token}` always lands on Comments** (the daily-use surface). The single-project auto-redirect into the canvas is removed.
- **Scope pill in the header (new, the centerpiece).**
  - Client token: a project **switcher** — `All projects ▾` → per-project entries showing name + ref prefix (`LWF App UI · LWF-…`). Selecting one sets the project context **everywhere** (comments filter, decisions filter, capture target) via the existing `?project=` URL param. Single-project clients see a static label instead of a dropdown.
  - Project token: a fixed pill `LWF App UI · project-scoped link` — no switcher. This is the answer to "what can this token see," visible on every page.
  - The `Projects` dropdown leaves the filter bar (the pill replaces it); all other filters stay as-is.
- **Capture becomes an explicit action**: a `＋ Capture` button in the header opens the annotation canvas for the current project (multi-project client on "All projects" → picks the project first — the current picker page, repurposed). The canvas screen gets a **slim header** (project name + "← Back to comments"); the AnnotationCanvas component itself is untouched.
- **Comments / Decisions pages: unchanged** apart from consuming the shared project context and dropping the redundant filter dropdown. Cards, table view, decisions table all stay as they are.

### 2.2 Settings — scope-labeled sections + one "Install & Access" panel

Settings keeps the side-nav shape (top-tabs on mobile) with reordered, scope-badged sections:

```
 Settings                          each section header carries a badge:
 ├─ Install & Access   ← NEW       [applies to all projects]  or  [per project]
 ├─ Widget appearance
 ├─ Notifications
 ├─ Assignees
 └─ Webhooks
```

**Install & Access (new; client-level; the unified answer to "which key/which sites"):**

```
┌─ Install & Access ──────────────────────────── [applies to all projects] ─┐
│ Embed snippet (one key for all your sites)                                │
│   <script src="https://…/widget.js" data-key="050a77…"></script>  [Copy]  │
│                                                                           │
│ Sites that can submit feedback          ← surfaces origin→project routing │
│   http://lwf.example.com     → routes to  LWF App UI       (LWF-…)        │
│   http://files.example.com   → routes to  LWF Whatever…    (LWF2-…)       │
│   "Feedback from any other domain is rejected. To add a site, contact     │
│    support / your operator."                                              │
│                                                                           │
│ Access links & tokens                                                     │
│   Client link (sees everything above)      /c/84a7cd… [Copy]              │
│   Project link — LWF App UI                /c/e62d02… [Copy]              │
│   "Use project links to share one project only. Agents/CLI use these      │
│    same tokens as Bearer tokens."                                         │
└───────────────────────────────────────────────────────────────────────────┘
```

- Data needs: project names/urls/ref prefixes and tokens already come from `GET /api/projects?token=` — **no API change**. Project tokens see only their own row and no client link.
- **Read-only done right:** project tokens get the NotificationSettings treatment on every client-level section — one banner ("This is client-level. Open the client link to change it.") + disabled fieldset. The 403-after-Save trap goes away. `readOnly` already comes back from `/api/settings` — the page just starts using it.
- Webhooks section: show project **names** (not `project 4`), scope badge per hook.

### 2.3 Admin `/admin` — client-centric grouping, keys in one place

Keep it one page (owner-only, 6 clients — a multi-page admin would be over-building). Restructure the two flat lists into **client cards with their projects nested inside**, and consolidate every credential into one expander per client:

```
┌─ Living With Fire ────────────────────────────────────────────────┐
│   [Access & keys ▾] [Branding ▾] [Notifications ▾] [Open portal]  │
│                                                                   │
│   Projects                                          [+ Add project]│
│   ├─ LWF App UI    LWF-…   http://lwf…    [Edit] [Branding] [⋯]   │
│   └─ LWF Files     LWF2-…  http://files…  [Edit] [Branding] [⋯]   │
│                                                                   │
│   Access & keys (expanded)                                        │
│   ├─ Client magic link      /c/84a7… [Copy] [Open] [Regenerate]   │
│   ├─ Widget key             050a77…  [Copy snippet] [Regenerate]  │
│   ├─ Project link — App UI  /c/e62d… [Copy] [Generate/Regen]      │
│   └─ Webhooks               2 configured → manage                 │
└───────────────────────────────────────────────────────────────────┘
```

- The separate all-clients Projects table goes away; `ProjectForm`/edit logic is reused inside the card.
- Admin gains webhook visibility by reusing `WebhooksSettings` with the client token — exactly the pattern `ClientsSection` already uses for `NotificationSettings`. No new API.
- Instance branding stays at the top as-is.
- **Orphan safety net (minimal):** if (and only if) `comments WHERE project_id IS NULL` > 0, show a one-line warning banner with the count at the top of admin. No dedicated page, no reassign UI — prod count is 0 and the widget can't create new ones. (A reassign action would need an additive API and isn't worth it until the banner ever fires.)

### 2.4 Mobile plan (no component rebuilds)

- ClientNav: two rows — branding row, then a horizontally scrollable row of tabs + scope pill. `＋ Capture` collapses to an icon button.
- Settings side-nav → horizontal scrollable tabs under the header at `<md`.
- Comments filter bar → single horizontally scrollable row at `<md` (matches the widget toolbar's existing pattern).
- AnnotationCanvas, CommentCard, CommentsTableView internals: untouched.

---

## 3. What moves where (summary table)

| Thing | Today | Proposed |
|---|---|---|
| Magic-link landing | Canvas (1 project) or picker (n projects) | Comments dashboard, always |
| Capture canvas | The landing page | `＋ Capture` header action, slim header added |
| Project selection | Filter dropdown on comments only | Header scope pill, drives all pages |
| Token scope | Invisible | Stated in the scope pill (client switcher vs fixed project label) |
| Embed snippet + widget key | Settings → Widget → Embed Code tab | Settings → **Install & Access** |
| "Which sites can submit" | Nowhere (admin-only project URLs) | Install & Access sites table (origin → project) |
| Client/project magic links | Admin only | Install & Access (client token sees all; project token sees own) + admin Access & keys |
| Webhook management | Client settings only | Unchanged + admin Access & keys gains a view (reused component) |
| Admin projects table | Separate flat table | Nested under each client card |
| Client credentials in admin | 3 places (row buttons, widget expander, projects table) | One Access & keys expander per client |
| Widget-settings 403 trap | Editable form, fails on Save | Read-only banner + disabled fields (existing `readOnly` flag) |
| Orphan tickets | Invisible | Admin banner if count > 0 (prod: 0) |

## 4. URL compatibility (nothing 404s, nothing gated)

| Existing URL | Behavior after |
|---|---|
| `/c/{token}` | Redirects to `/c/{token}/comments` (client-side, same as today's redirect pattern) |
| `/c/{token}/comments` + all query params (`?status=`, `?c=`, legacy `?commentId=`, `?project=`…) | **Unchanged** — this is what admin "Copy Link" has always handed out, so virtually all real bookmarks already point here |
| `/c/{token}/{projectId}` | Keeps working: redirects to the canonical new capture route `/c/{token}/capture/{projectId}` (Next static segments already win over the dynamic one, so no collision today or after) |
| `/c/{token}/decisions`, `/c/{token}/settings` | Unchanged paths; settings content reorganized |
| `/admin`, `/admin/login` | Unchanged |
| Magic links | Stay **ungated** (PROJECT-RULES auth tier 2) — no login, no interstitial |

## 5. Explicitly untouched

- **All API request/response shapes** (Rule 3) — every data need above is served by existing endpoints (`/api/projects?token=`, `/api/settings` `readOnly`, existing webhooks/notifications APIs). Zero API changes.
- **Security boundary** — per-client scoping logic (`lib/auth.ts`, `resolveToken`, scope checks) untouched (Rule 2).
- **Widget** — `widget.js`, embed snippet contract, `widget-src/`, origin matching behavior.
- **CLI / MCP** — no contract changes.
- **Components** — `AnnotationCanvas`, `CommentCard`, `CommentsTableView`, `ImageModal` internals (wrapped/relabeled only).
- **`app/page.tsx`, README/docs, landing screenshots** — landing-install lane's territory (EXTERNAL-DEV-SETUP gets a nav-screenshot refresh in Phase B only if that lane has landed).
- **Auth tiers** — owner session, ungated magic links, agent tokens, widget key: semantics unchanged.

## 6. Phase B sketch (sizing, for context — not for approval here)

Touched: `components/ClientNav.tsx` (scope pill + responsive), new `components/ScopePill.tsx`, `app/c/[token]/page.tsx` (redirect), new `app/c/[token]/capture/[projectId]/page.tsx` + legacy redirect in `[projectId]/page.tsx`, `app/c/[token]/settings/page.tsx` (625 lines → split into `settings/sections/*.tsx`, each ≤300), new `InstallAccess` section component, `app/c/[token]/comments/page.tsx` (consume shared project context, drop dropdown — also 478 lines, split candidate), `app/admin/ClientsSection.tsx` + `ProjectsSection.tsx` (merge into client cards + `AccessKeys` expander), small `WebhooksSettings` label fix. All ≤300-line rule enforced along the way. No schema, no API changes.

## 7. Open questions for Annie

1. **"Projects" vs "Sites" in client-facing copy?** A project *is* a site/app (it's defined by origin URLs). Renaming the client-facing label to "Sites" would dissolve much of the confusion by itself ("which sites can submit here" → the Sites table). Code/API/admin keep saying `project`. Risk: "site" reads odd if a project is ever a native app. **Recommendation: yes, client-facing "Sites", admin keeps "Projects".**
2. **How prominent should Capture be?** Proposal makes it a header button. If clients rarely use the iframe-capture flow (vs the widget on their real site), it could demote further into a link on the empty-comments state. **Recommendation: header button, and the canvas's "blank page?" hint stays.**
3. **Admin single-page cards (proposed) vs per-client detail pages (`/admin/clients/[id]`)?** Cards keep it one page for 6 clients; detail pages scale better if the operator side grows. **Recommendation: cards now — the split is easy later.**
4. **Show project magic links to client-token users in Install & Access?** It's scope-narrowing (client already sees everything), so no security change, and it lets clients self-serve sharing one project with a contractor. But it puts more credential-ish strings in front of clients. **Recommendation: yes, show them.**

---

*Phase A verification notes: dev server ran on port 3009 against local `browser_comments` DB (Neon untouched except two read-only SELECTs). Local-dev-only writes made to walk the UI: generated a project token for project 3, re-bootstrapped the local test owner (`owner@example.com` / `local-dev-pass-1`). Screenshots in session scratchpad (`shots/`).*
