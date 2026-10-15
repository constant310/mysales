# mySales: Instagram Collaborator + Facebook Page auto-publishing

## Current state
**Prepared only. No automated publishing is activated.**
The GitHub branch `meta-instagram-facebook-autopost` contains the optional Meta publisher and a guarded workflow. The existing main-branch video generator is left unchanged.

## What this supports
- Produces a 9:16 Reel on the existing twice-daily workflow.
- Uploads its MP4 from the GitHub Actions runner directly to Instagram using Meta's **resumable upload** protocol (no paid video hosting).
- Invites up to three **public** Instagram usernames to collaborate during Reel creation. Invitations appear only if Meta accepts the publish request; each collaborator **must accept**.
- Posts a **separate** Reel to a selected Facebook **Page** using Meta's Page Reels API when opted in; do not assume the Instagram Accounts Center toggle automatically copies API-created Reels.
- Checks persistent date/slot publishing records to avoid accidental repeats on reruns. A network failure between publishing and saving a record can still require a manual duplicate check.

## Required user actions
1. Confirm which Instagram professional account should be the original publisher (e.g. `_constano_` or `_my_sales_`), the collaborator username(s), and which Facebook **Page** (not a personal profile).
2. In Meta for Developers, authorize an app using **Instagram API with Facebook Login** for the correct professional Instagram account and its linked Facebook Page. Request the necessary publishing and Page permissions; Meta may require additional authorization/review. Generate valid tokens with the correct permissions.
3. In the repository GitHub Settings > Secrets and variables > Actions, add encrypted **secrets**:
   - `META_IG_ACCESS_TOKEN` — valid Page-associated token that can publish to the chosen IG professional account.
   - `META_FB_PAGE_ACCESS_TOKEN` — valid Page access token with Page Reel publishing permission (if posting to a Facebook Page).
   Never send tokens, passwords or recovery codes in chat, commit them to GitHub, or paste them into public issues.
4. Add repository **variables**:
   - `META_IG_USER_ID` — Meta's numeric Instagram professional-user ID (not username).
   - `META_IG_COLLABORATORS` — e.g. `_my_sales_`, or comma-separated PUBLIC usernames, maximum 3. Blank disables collaborators.
   - `META_FB_PAGE_ID` — numeric Facebook Page ID.
   - `META_FB_ENABLED` — `true` only when Facebook Page access works.
   - Leave `META_AUTOPOST_ENABLED` unset or `false` until after successful dry-run and approval.
5. Review/merge the branch only after the account and Page destinations are verified. The production workflow automatically checks the MP4 and prints a **dry-run** publishing validation first.
6. Validate a **single controlled test Reel**, ensure invitations appear on the correct accounts, accept the collaboration invitation, and verify Facebook Page publishing.
7. After validation, set `META_AUTOPOST_ENABLED=true` to authorize unattended posting.

## Accounts Center setting for native Instagram→Facebook sharing
On Instagram (Android): Profile → ☰ → **Accounts Center** → **Sharing across profiles** → under **Share from** select Instagram → under **Share to** choose the correct Facebook destination → turn on **Your Instagram reels**.

**Caution:** Meta's Accounts Center toggle is distinct from API publishing, and may not apply to Reels created through a third-party API. For dependable unattended Page posting, the branch uses the separate Facebook Reels API.

## Technical caveats
- Requires professional Instagram account, suitable Meta permissions and a supported Page connection.
- Account names/IDs and collaborators are deliberately *not* hardcoded.
- The current automated video renderer uses template chalk artwork; it does not call ChatGPT's image generator in the background. Approve creative quality before enabling full automatic posting.
- Edge neural voice service and GitHub Actions are free to use within applicable limits; service availability, rate limits, Meta policy and token expiry still apply.
- Meta may reject certain collaborator accounts or upload requests; the workflow will fail instead of quietly publishing without the required settings.
