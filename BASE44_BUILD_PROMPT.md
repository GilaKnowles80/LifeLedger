# Base44 Build Prompt: LifeLedger

Build a complete, production-oriented social community and worldwide marketplace web app called **LifeLedger**. It should feel familiar to use as a social feed, but have its own calm, welcoming identity. Build the actual application, not a landing page.

## Product

LifeLedger connects people, local communities, independent makers, and companies around the world. Members can share updates, appreciate and comment on posts, discover marketplace listings, and promote a product or company through a paid advertisement.

The ad price is fixed at **PHP 250 per submission**. Use **PayPal only** for checkout. A paid ad must enter admin review and must not appear publicly until an administrator approves it.

## Visual Direction

Create a polished, responsive social product with an editorial/community feel:

- Brand name: LifeLedger. Tagline: “Your world, in good company.”
- Use a light paper background, white content surfaces, forest-green controls, muted sage accents, and restrained coral/gold details. Avoid purple-first or dark-first themes.
- Pair an expressive readable serif for display headings with a clear sans-serif for interface text.
- Keep cards compact with subtle borders and small radii. Prioritize clear hierarchy and scanning over oversized marketing sections.
- Use meaningful icons in controls, and accessible text labels/tooltips for icon-only controls.
- Use suitable real product/community imagery in feed and marketplace content. Include graceful loading, empty, error, and image-failure states.
- The first screen should open to the usable community feed.

## Responsive Behavior

Adapt layout based on available viewport width and input type, not operating-system detection:

- **Laptop/desktop:** three columns with primary navigation, centered feed, and a compact discovery/marketplace rail.
- **Tablet:** narrower primary navigation and centered feed; hide the secondary rail before the feed becomes cramped.
- **Mobile:** single-column feed, compact header, fixed bottom navigation, and a floating create-ad action. Use a bottom-sheet ad form.
- Support portrait and landscape orientation on phones and tablets. Use device-width viewport settings, safe-area insets for iOS, and touch targets around 44px for coarse pointers. Keep form text at least 16px on touch devices to avoid iOS input zoom. Respect reduced-motion preferences.
- Verify no horizontal overflow at widths from 320px through 1440px.

## Main Screens

### Community Feed

- Header with LifeLedger wordmark, search, notifications, and sign-in/profile action.
- Primary navigation: Home feed, Marketplace, Communities, and Saved.
- Show stories/circles, a post composer, and a chronological feed.
- Posts show author, avatar, location/time, text, optional image, appreciation count, comments, and actions to appreciate, comment, and save.
- Signed-in members can create, edit, and delete their own posts; appreciate/unappreciate; and comment. Persist all actions to the backend and update counts without requiring a full reload.
- Display sponsored posts with a clear “Sponsored” label.

### Marketplace

- Discover products and services from independent makers and companies around the world.
- Search by product, seller, category, and location. Provide category and region filters.
- Listing cards show a real product image, seller, title, localized price, category, and location.
- Include “Introduce your business” and “Create an advertisement” actions.

### Authentication

- Use the platform’s managed authentication. Support email magic-link sign-in and account creation.
- Create a profile for each account with a unique username, display name, avatar, and creation time.
- Protect all write operations and account-specific pages. Never trust client-supplied user IDs or role values; derive identity from the authenticated server session.
- Include sign-out, sign-in errors, loading indicators, and session expiry states.

### Advertisement Submission

- A responsive form asks for company/seller name, contact email, advertisement type (product, company, or marketplace listing), headline, description, optional website, and audience region (Worldwide, Philippines, North America, Europe, Asia Pacific, Africa, or Latin America).
- Clearly display the fixed price **₱250 PHP per ad** and that ads are reviewed before publication.
- Validate all inputs on both client and server.
- Start checkout with a server-created PayPal Orders v2 order for exactly `PHP 250.00`. Never accept price or currency from the browser as authoritative.
- Redirect to PayPal approval. On return, verify the signed checkout state, fetch/verify the PayPal order server-side, verify the order belongs to this ad and is exactly PHP 250, then capture it server-side. Use idempotency so repeated return requests cannot create duplicate captures.
- Also receive and verify PayPal webhook signatures. Store order/capture IDs and reconcile payment status. Treat signed webhooks as an additional source of payment truth.
- Only mark an ad paid after PayPal confirms a completed PHP 250 capture. Paid ads enter `awaiting_review`; do not auto-publish them.
- Provide clear success, cancelled, failed, and pending payment states. Never claim payment succeeded based only on the browser redirect.

### Admin Advertisement Review

- Create a protected admin route with a queue of paid ads awaiting review.
- Show submitted business name, contact details, type, headline, description, website, selected audience region, payment status, payment reference, and submission time.
- Admins can approve or reject with a moderation note. Only approved ads are visible in public marketplace/feed placement. Rejected ads remain unpublished and preserve their audit trail.
- Admin privileges must be granted server-side by an existing administrator. Never allow a user to promote their own account by editing profile metadata.
- Log reviewer, decision, note, and timestamp for every moderation action.

## Suggested Data Entities

Use the platform database with relationships, indexes, validation, and server-enforced authorization:

- `profiles`: user ID, username, display name, avatar URL, created time.
- `posts`: author ID, body, image URL, draft/published status, created/updated times.
- `comments`: post ID, author ID, body, created time.
- `reactions`: post ID, user ID, reaction type, created time; enforce one reaction per user/post.
- `communities`: name, description, image, visibility, creator, created time.
- `community_members`: community ID, user ID, role, joined time.
- `marketplace_listings`: seller ID, title, description, category, price amount/currency, location, image URLs, status, created time.
- `advertisements`: advertiser ID, company/contact fields, type, headline, description, website, target region, fixed amount `25000` minor units, currency `PHP`, payment state, moderation state, PayPal order ID, PayPal capture ID, created/paid/reviewed timestamps, reviewer and moderation note.

For all exposed records, implement row-level security or equivalent server authorization. Public users may read published posts, visible marketplace listings, and approved advertisements only. Members can mutate only their own records. Admin-only moderation endpoints must verify admin privileges on the server for every request.

## PayPal Configuration and Secrets

- Use PayPal Orders v2 with separate sandbox and live modes.
- Keep `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_WEBHOOK_ID` in Base44’s private server-side secrets. Never put the client secret in frontend code, public environment variables, database records, logs, or this prompt.
- Use `PAYPAL_MODE=sandbox` for testing and change to live only after successful end-to-end sandbox checkout, capture, webhook, duplicate-event, and cancellation tests.
- Configure the PayPal webhook URL to `https://www.lifeledger.com/api/paypal/webhook` when that domain is deployed. Subscribe to the payment-capture completion and denial events and any other events required for reconciliation.
- If Base44 provides a managed PayPal integration, use it only if it supports this server-verified fixed-PHP order and webhook flow; otherwise implement server-side functions and explain required secret/configuration values.
- Never invent credentials or mark a payment paid in a demo fallback.

## Safety, Privacy, and Reliability

- Add community guidelines and report/block actions for posts, comments, users, listings, and ads.
- Add server-side input validation, rate limits for posting/commenting/auth requests, safe URL validation, and safe handling of external images/links.
- Keep contact emails and payment references private to the advertiser and authorized admins.
- Store payment and moderation audit data durably in the managed database, not local files or browser-only state.
- Provide privacy policy, terms, and ad disclosure links/pages before public release.
- Show accurate error messages without leaking secrets or provider responses.
- Include an admin bootstrap/invite process that is not publicly self-service.

## Acceptance Checks

1. A visitor can browse public feed content and approved marketplace listings without signing in.
2. A visitor can create an account/sign in, then create posts, appreciate posts, comment, and save listings; state persists after reload.
3. A signed-in advertiser can submit an ad and is redirected to PayPal for exactly PHP 250.
4. Cancelled, invalid, duplicate, or unverified payments never publish an ad.
5. A verified PayPal capture changes the ad to paid/awaiting-review; only an admin can approve/reject it.
6. Public users can see approved ads only; pending, rejected, and unreviewed ads stay private.
7. Admin routes and data operations reject non-admin accounts.
8. Laptop, tablet, Android, and iOS layouts adapt correctly in portrait/landscape, with no clipping or horizontal overflow and touch-friendly controls.
9. Include a short setup guide for Base44 environment secrets, PayPal sandbox testing, production webhook URL, admin setup, and deployment checklist.
