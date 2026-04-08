# RA Trivia — Server

Express.js + TypeScript REST API for the RA Trivia quiz platform. Deployed on Render.

## Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 5
- **Database**: PostgreSQL via Prisma ORM 6
- **Auth**: JWT + bcryptjs
- **Email**: Resend (transactional) + Nodemailer
- **Real-time**: Socket.IO 4
- **PDF**: Puppeteer + @sparticuz/chromium (Render-compatible)
- **Excel**: xlsx
- **Validation**: express-validator
- **Security**: helmet, express-rate-limit, custom sanitize middleware
- **Tests**: Vitest + Supertest

## Project Structure

```
src/
├── index.ts                  # App entry — Express + Socket.IO setup
├── config/
│   └── index.ts              # Centralised config
├── middlewares/
│   ├── auth.ts               # JWT authenticate + authorizeAdmin
│   ├── errorHandler.ts       # Global error handler
│   ├── rateLimiter.ts        # API + auth rate limits
│   ├── sanitize.ts           # XSS sanitization
│   └── userTypeAccess.ts     # User-type-based question filtering
├── routes/
│   ├── auth.ts               # Register, login, OTP, password reset
│   ├── quiz.ts               # Start, submit, update-answer, my-sessions
│   ├── quizzes.ts            # CRUD + toggle (admin)
│   ├── questions.ts          # Import questions from Excel (MCQ + FITG support)
│   ├── admin.ts              # Results, analytics, release, export
│   ├── support.ts            # Real-time chat + FAQ templates
│   ├── notifications.ts      # CRUD notifications
│   └── password-requirements.ts
├── services/
│   ├── email.ts              # Resend email helpers
│   ├── reportGenerator.ts    # PDF + Excel generation
│   ├── scheduler.ts          # Auto-release cron job
│   └── socketService.ts      # Socket.IO singleton + emitNotification
└── utils/
    ├── envValidator.ts        # Startup env check
    └── validation.ts          # Shared validators
```

## Setup

```bash
# From workspace root
pnpm install

# Copy env
cp apps/server/.env.example apps/server/.env
```

### Required Environment Variables

```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/ra_trivia"
JWT_SECRET="change-me-in-production"
WEB_URL="https://ra-trivia.vercel.app"   # Used in password reset emails
GEMINI_API_KEY="AIza..."                # Google Generative AI for Support Assistant
RESEND_API_KEY="re_..."
FROM_EMAIL="noreply@yourdomain.com"
PORT=4000
CORS_ORIGIN="https://ra-trivia.vercel.app,http://localhost:3000"
```

> `WEB_URL` must be set on Render — it defaults to `localhost:3000` which breaks password reset links in production.

## Scripts

```bash
# Development (hot reload)
pnpm --filter server dev

# Production build
pnpm --filter server build

# CI build (no db push)
pnpm --filter server build:ci

# Start production
pnpm --filter server start

# Run tests (single pass)
pnpm --filter server test

# Run tests in watch mode
pnpm --filter server test:watch

# Coverage report
pnpm --filter server test:coverage
```

## API Endpoints

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Register candidate or admin |
| POST | `/login` | — | Login, returns JWT |
| POST | `/verify-otp` | — | Verify 6-digit OTP; triggers account notifications |
| POST | `/resend-otp` | — | Resend OTP to email |
| POST | `/forgot-password` | — | Send 15-min password reset link |
| POST | `/reset-password` | — | Validate token, set new password |

### Quizzes — `/api/quizzes`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Candidate/Admin | List quizzes filtered by role + user type |
| GET | `/:id` | Any | Get quiz details |
| POST | `/` | Admin | Create quiz |
| PATCH | `/:id` | Admin | Update title, duration, retake limit, schedule |
| PATCH | `/:id/toggle` | Admin | Activate/deactivate; notifies matching candidates |
| DELETE | `/:id` | Admin | Delete quiz + all sessions |
| POST | `/:id/notify` | Admin | Send bulk exam notifications to category candidates |

### Quiz Session — `/api/quiz`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/start` | Candidate | Start session, returns randomised questions |
| POST | `/submit` | Candidate | Submit answers, calculate score |
| POST | `/update-answer` | Candidate | Auto-save single answer |
| GET | `/my-sessions` | Candidate | Own session history |

### Admin — `/api/admin`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/results` | Admin | Paginated results with search + user type filter |
| GET | `/analytics` | Admin | Per-quiz performance stats + **Pass/Fail Breakdown** |
| GET | `/global-stats` | Admin | Platform-wide stats |
| POST | `/sessions/release` | Admin | Release results for given session IDs |
| POST | `/quizzes/:id/release-all` | Admin | Release all sessions for a quiz |
| PATCH | `/sessions/:id/status` | Admin | Set manual pass/fail override |
| POST | `/trigger-emails` | Admin | Manually trigger pending result emails |
| GET | `/export/formatted-excel` | Admin | Formatted Excel export |
| GET | `/export/pdf` | Admin | PDF report (Puppeteer) |
| POST | `/bulk-candidates` | Admin | Bulk register candidates via Excel upload |
| POST | `/announcement` | Admin | Send broadcast message to all/rank candidates |

## Backend Services

### Bulk Registration & Verification
The `bulk-candidates` endpoint parses Excel files, hashes passwords, and generates verification OTPs.
- **24-hour Expiry**: Bulk-imported accounts have a 24-hour verification window.
- **Automated Cleanup**: A background scheduler deletes any unverified accounts older than 24 hours every hour.
- **Welcome Emails**: Custom welcome emails are sent with registration details, login password, and verification OTP.

### Scheduler & Automation
- **Results Release**: Checks for quiz sessions ready for release every 15 minutes.
- **Account Cleanup**: Runs hourly to purge expired, unverified accounts.
- **10 PM Batch**: Result emails are specifically triggered during the 22:00 hour for consistency.

### Notifications — `/api/notifications`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Any | Own notifications (role-scoped) |
| PATCH | `/:id/read` | Any | Mark one as read |
| POST | `/mark-all-read` | Any | Mark all as read |
| DELETE | `/:id` | Any | Delete notification |

### Support — `/api/support`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Candidate | Own history + relevant notifications |
| POST | `/` | Candidate | Submit new message |
| GET | `/admin` | Admin | List all support threads |
| GET | `/admin/:userId` | Admin | History for specific user |
| POST | `/admin/:userId` | Admin | Reply to user |
| PATCH | `/admin/:userId/resolve` | Admin | Close thread |
| GET | `/admin/templates` | Admin | Get canned response templates |
| GET | `/unread-count` | Candidate | Own unread message count |
| GET | `/admin/unread-count` | Admin | Global unread message count |
| PATCH | `/read` | Candidate | Mark admin messages as read |
| PATCH | `/admin/:userId/read` | Admin | Mark candidate messages as read |

### System & Maintenance — `/api/health` & `/api/quiz/maintenance`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health/detailed` | Any | Detailed monitoring (DB, Memory, Uptime) |
| POST | `/api/quiz/maintenance/toggle` | Admin | Enable/Disable global maintenance |
| GET | `/api/quiz/maintenance/status` | Admin | Current maintenance state |

### Notification Scoping

- **SUPER_ADMIN**: `EXAM_SUBMITTED`, `NEW_USER_REGISTERED`, `NEW_ADMIN_REGISTERED`
- **ADMIN**: same types, own notifications only (`createdById = userId`)
- **CANDIDATE**: `NEW_EXAM_AVAILABLE`, `RESULT_RELEASED` (own only)

## Real-time (Socket.IO)

Clients connect with `{ auth: { token } }`. On connection the server verifies the JWT and joins the socket to a private room `user:<userId>`.

```ts
// Emit to a specific user
import { emitNotification } from './services/socketService';
emitNotification(userId, notificationPayload);
```

The frontend `NotificationBell` listens on the `notification` event and refreshes the list. Falls back to 30s polling if the socket fails to connect.

### Socket.IO Events

| Event | Direction | Description |
|---|---|---|
| `notification` | Server → Client | General notification (all users) |
| `support_message` | Server → Admin | New candidate message in support thread |
| `support_reply` | Server → Candidate | New admin reply to support thread |
| `user_typing` | Candidate → Admin | Candidate is composing a message |
| `admin_typing` | Admin → Candidate | Support team is composing a message |
| `messages_read` | Server → All | Read receipts synchronization |
| `maintenance_mode` | Server → All | System maintenance status change |

## Scheduler

`initScheduler()` runs on startup. It polls every minute for sessions where `resultReleasesAt <= now` and `isReleased = false`, releases them, sends emails, and emits Socket.IO notifications to each candidate.

## Security

- **Rate limiting**: 100 req/15min general; 20 req/15min on auth routes
- **Helmet**: Sets security headers
- **CORS**: Whitelist via `CORS_ORIGIN` env var + hardcoded Vercel/Render origins
- **Sanitization**: Custom middleware strips `<script>` tags and HTML from request bodies
- **JWT**: HS256, expiry configurable via `JWT_EXPIRES_IN`
- **Password hashing**: bcryptjs with salt rounds 12

## Testing

Tests live in `src/__tests__/`. See [`src/__tests__/README.md`](src/__tests__/README.md) for full details.

```bash
# Run once
pnpm --filter server test

# Watch
pnpm --filter server test:watch
```

Test database uses `.env.test` — set `DATABASE_URL` to a separate test DB to avoid polluting development data.

## Deployment (Render)

1. Set all env vars in Render dashboard (especially `WEB_URL`)
2. Build command: `pnpm run build:ci`
3. Start command: `node dist/index.js`
4. Puppeteer uses `@sparticuz/chromium` — no extra Chrome install needed on Render
