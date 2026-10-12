# Data Room

A self-hosted virtual data room: upload confidential documents, invite reviewers by email, make them sign an NDA before anything is shown, and see exactly how long each person spent on each document (down to the page).

## Features

**Sharing and access**
- Multiple data rooms per owner account, each with folders, documents and its own guest list.
- Email invitations with private, per-person links. Optional expiry window per invitation, revoke/restore at any time (revoking ends live sessions immediately), re-send, copy link.
- Guests never create passwords: the invitation link is their identity. Sessions are cookie-based and scoped per room.
- Drafts: documents can be hidden from guests until you publish them. New versions replace the file in place; history is kept.

**NDA gating**
- Every room ships with an editable NDA. Guests must scroll to the end, type their full name and confirm before a single document is served (enforced on the file API, not just the UI).
- NDA versions: editing the text publishes a new version and automatically requires everyone to sign again.
- Each signature stores the signer's name, title, company, email, IP address, browser and a SHA-256 hash of the exact text they accepted. A signed-record PDF (agreement text + audit page) can be downloaded for any signature.

**Engagement analytics**
- Active reading time per guest per document. Only time with the tab visible, window focused and recent user activity counts; idle time is excluded. Heartbeats are server-capped against wall-clock time so a tampered client cannot inflate numbers.
- Page-level heat maps for PDFs: which pages each reader lingered on, furthest page reached.
- Room dashboard: most engaged guests, most reviewed documents, guest × document heat map, total review time.
- Per-guest timeline of every session, and per-document breakdown of every viewer.

**Protection**
- In-browser PDF viewer (pdf.js) rather than handing out the file. Right-click and print are suppressed, pages render to canvas.
- Dynamic watermark with the viewer's email and date over every page in the viewer; downloads (when allowed) are stamped server-side with the same identity.
- Downloads off by default, configurable per room and overridable per document. Every download is logged.

**Collaboration and audit**
- Q&A: guests can ask questions about the room or a specific document; owners answer from the admin side. Both are notified by email when SMTP is configured.
- Full activity log: sign-ins, invitations, NDA signatures, views, downloads, uploads, setting changes, with IP addresses.
- Owner notifications when a guest first enters or signs the NDA.
- "Preview as guest" mode for owners (never tracked).

## Quick start

```bash
cp .env.example .env            # then set SESSION_SECRET and APP_URL
npm install                     # also generates the Prisma client and copies the pdf.js worker
npm run db:push                 # creates the SQLite database
npm run seed                    # optional demo data: owner@example.com / password123
npm run dev                     # http://localhost:3000
```

The seed prints three guest invitation links; open one in a private window to walk through the guest experience.

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite by default (`file:./dev.db`). For Postgres/MySQL change the `provider` in `prisma/schema.prisma` and run `npm run db:migrate`. |
| `SESSION_SECRET` | Random string; rotate to invalidate all sessions. |
| `APP_URL` | Public URL used in invitation emails. |
| `STORAGE_DIR` | Where uploaded files live (default `./storage`). Mount a persistent volume in production. |
| `MAX_UPLOAD_MB` | Upload size limit (default 100). |
| `SMTP_URL`, `EMAIL_FROM` | Outgoing mail. When unset, emails are printed to the server log and invite links can be copied from the People tab. |
| `ALLOW_SIGNUP` | Set to `false` once your owner accounts exist. |

## How time tracking works

1. Opening a document calls `POST /api/view` with `op: "start"`, which creates a view session (guest, document, version, IP).
2. Once a second the browser checks that the tab is visible, the window is focused, and the reader has moved, scrolled or typed in the last 60 seconds. If so, one second is attributed to the page that currently fills most of the viewport.
3. Every five seconds the per-page buckets are flushed as a heartbeat. The server never accepts more seconds than have elapsed since the previous heartbeat (plus a small tolerance), and caps each heartbeat at 30 seconds.
4. On tab close or navigation the remaining seconds are sent with `sendBeacon`.

Analytics sum `ViewSession.activeSeconds` and `PageTime.seconds`; nothing is estimated.

## Project layout

```
prisma/schema.prisma        data model (rooms, documents, invites, NDA versions/signatures, view sessions, audit log)
prisma/seed.ts              demo data
src/lib/                    auth (owners), guest-auth (invited reviewers), storage, pdf (watermark + NDA record), analytics, audit, email
src/app/actions/            server actions (auth, rooms, documents, invites, nda, questions, guest)
src/app/(auth)/             owner sign in / sign up
src/app/dashboard/          room list
src/app/rooms/[roomId]/     owner admin: documents, people, NDA, Q&A, analytics, activity, settings
src/app/invite/[token]/     invitation landing page
src/app/r/[roomId]/         guest experience: NDA signing, document list, viewer, questions
src/app/api/files/[docId]   authorised file streaming + watermarked downloads
src/app/api/view            engagement heartbeat endpoint
src/components/viewer/      pdf.js viewer, watermark overlay, engagement hook
```

## Production notes

- Run behind HTTPS; cookies are marked `secure` in production.
- Put `STORAGE_DIR` on persistent storage (or swap `src/lib/storage.ts` for an S3 client; it is the only module that touches the filesystem).
- Set `ALLOW_SIGNUP=false` after creating owner accounts.
- `npm run build && npm start`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint, TypeScript |
| `npm run db:push` | Sync schema to the database (development) |
| `npm run db:migrate` | Create a migration (production databases) |
| `npm run db:studio` | Browse the database |
| `npm run seed` | Demo owner, room, documents, guests and engagement data |
