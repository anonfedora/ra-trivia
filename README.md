# RA Trivia — Professional Quiz Platform

A full-stack candidate assessment platform built with Next.js 14, Express.js, TypeScript, and PostgreSQL. Deployed on Vercel (frontend) and Render (backend).

## Overview

RA Trivia lets organizations create and administer exams to candidates by user type, with real-time notifications, anti-cheat enforcement, result scheduling, PDF/Excel exports, and a full in-app notification system.

## Monorepo Structure

```
ra-trivia/
├── apps/
│   ├── web/          # Next.js 14 frontend (Vercel)
│   └── server/       # Express.js API (Render)
├── packages/
│   └── database/     # Prisma schema + migrations
└── scripts/          # CI and utility scripts
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- pnpm 10+

### Install

```bash
git clone <repo-url>
cd ra-trivia
pnpm install
```

### Environment

```bash
# Root
cp .env.example .env

# Server
cp apps/server/.env.example apps/server/.env

# Web
cp apps/web/.env.example apps/web/.env
```

### Database

```bash
pnpm --filter database exec prisma generate
pnpm --filter database exec prisma migrate deploy
```

### Dev Servers

```bash
# Backend — http://localhost:4000
pnpm --filter server dev

# Frontend — http://localhost:3000
pnpm --filter web dev
```

## Environment Variables

### Server (`apps/server/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `WEB_URL` | Frontend URL (e.g. `https://ra-trivia.vercel.app`) — used in password reset emails |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `FROM_EMAIL` | Verified sender address |
| `PORT` | Server port (default `4000`) |
| `CORS_ORIGIN` | Comma-separated allowed origins |

### Web (`apps/web/.env`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (e.g. `https://ra-trivia.onrender.com/api`) |

## Features

### Candidates
- Register, verify email via 6-digit OTP, log in
- See only exams matching their user type (e.g. `AMBASSADOR_RANK_EXAMS`)
- Real-time countdown timer with auto-submit on expiry
- Anti-cheat: tab-switch detection (3 strikes = auto-submit), copy/paste/right-click disabled
- Review answers before submitting
- View results when released; locked with countdown until release time
- In-app notifications: new exams available, results released
- Password reset via email link (15-minute expiry)

### Admins
- Create, edit, activate/deactivate, and delete quizzes
- Import questions from Excel by user type
- Set retake limits, start/end scheduling
- View all candidate results with search and pagination
- Support Center: Real-time chat with candidates, thread management, and resolution tracking
- Manually release results per-session or bulk per-quiz
- Set manual pass/fail status override
- Export results as formatted Excel or PDF
- Analytics dashboard with per-quiz and platform-wide stats
- In-app notifications: exam submissions, new registrations

### SUPER_ADMIN
- All admin capabilities across all admins
- Sees all admin-scoped notifications (new users, new admins, exam submissions)
- Manages admin accounts

### Notification System

| Type | Recipient | Trigger |
|---|---|---|
| `NEW_EXAM_AVAILABLE` | Matching candidates | Quiz activated |
| `RESULT_RELEASED` | Candidate | Result manually or auto-released |
| `EXAM_SUBMITTED` | Quiz owner admin | Candidate submits |
| `NEW_USER_REGISTERED` | SUPER_ADMIN | Candidate verifies OTP |
| `NEW_ADMIN_REGISTERED` | SUPER_ADMIN | Admin/SUPER_ADMIN verifies OTP |

Real-time delivery via Socket.IO (falls back to 30s polling on connection failure). Bell dropdown rendered via React portal — floats above all content, mobile-safe.

### Password Reset
`POST /api/auth/forgot-password` → sends email with 15-minute token link → `POST /api/auth/reset-password` validates token and updates password.

> **Render env var required**: `WEB_URL=https://ra-trivia.vercel.app`

## API Reference

### Auth
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/verify-otp
POST /api/auth/resend-otp
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

### Quizzes
```
GET    /api/quizzes                        # List (filtered by role + user type)
GET    /api/quizzes/:id
POST   /api/quizzes                        # Create (admin)
PATCH  /api/quizzes/:id                    # Update metadata
PATCH  /api/quizzes/:id/toggle             # Activate/deactivate
DELETE /api/quizzes/:id
```

### Quiz Session
```
POST /api/quiz/start
POST /api/quiz/submit
POST /api/quiz/update-answer               # Auto-save answer
GET  /api/quiz/my-sessions
```

### Admin
```
GET   /api/admin/results                   # Paginated, searchable
GET   /api/admin/analytics
GET   /api/admin/global-stats
POST  /api/admin/sessions/release          # Bulk release
POST  /api/admin/quizzes/:id/release-all
PATCH /api/admin/sessions/:id/status       # Manual pass/fail
GET   /api/admin/export/formatted-excel
GET   /api/admin/export/pdf
GET   /api/support/admin                   # List threads (admin)
GET   /api/support/admin/:userId           # History for user
POST  /api/support/admin/:userId           # Reply to user
PATCH /api/support/admin/:userId/resolve   # Close thread

### Support (Candidate)
```
GET   /api/support                         # History + relevant notifications
GET   /api/support/unread-count            # Get unread message count
PATCH /api/support/read                    # Mark admin messages as read
POST  /api/support                         # Submit new message
```

### System & Maintenance
```
GET   /api/health/detailed                 # Detailed system health status
POST  /api/quiz/maintenance/toggle         # Toggle global maintenance mode
GET   /api/quiz/maintenance/status         # Get maintenance status
```

### Notifications
```
GET    /api/notifications
PATCH  /api/notifications/:id/read
POST   /api/notifications/mark-all-read
DELETE /api/notifications/:id
```

## Testing

```bash
# Run all server tests
pnpm --filter server test

# Single run (CI mode)
pnpm --filter server test -- --run

# Local CI check (runs lint + build + tests)
./scripts/test-ci-local.sh
```

## Deployment

### Frontend (Vercel)
- Auto-deploys from `main`
- Set `NEXT_PUBLIC_API_URL` in Vercel environment settings

### Backend (Render)
- Set all server env vars in Render dashboard
- `WEB_URL` must be set to `https://ra-trivia.vercel.app` for password reset emails to work
- Build command: `pnpm run build:ci`
- Start command: `node dist/index.js`

## Version History

### v1.6.0 (Current)
- **Typing Indicators**: Real-time "Typing..." feedback in support chats for both admins and candidates.
- **Admin Support Refinement**: Added advanced filtering (unread, user rank), candidate search, and pagination.
- **Canned Responses**: Pre-defined response templates for admins to handle support requests faster.
- **Global Maintenance Mode**: Centralized control to pause new exam starts during system updates.
- **System Health API**: Detailed monitoring of database, memory, and platform vitals.
- **Read Receipts**: Real-time single/double-check marks for message status.
- **Unread Counters**: Dynamic badges on the admin dashboard and candidate floating support button.

### v1.5.0
- **Password Reset**: Forgot password flow with 15-min expiry token, email link, confirm password page
- **WebSocket Notifications**: Socket.IO real-time delivery; falls back to polling on error
- **Toast System**: Global `useToast()` hook + `<Toaster />` portal — replaces all `alert()` calls across pages
- **Error Boundary**: `<ErrorBoundary>` wraps app via `ClientProviders` — catches uncaught render errors
- **Anti-Cheat Enforcement**: Copy, paste, cut, and right-click disabled during active exam session
- **Next.js Image**: All `<img>` replaced with `<Image />` to fix Vercel ESLint build failure
- **Vercel Build Fix**: `ErrorBoundary` moved into `ClientProviders` client wrapper to resolve `@types/react` Server Component type conflict

### v1.3.0
- User type filtering for exams and notifications
- Full in-app notification system (bell dropdown via React portal)
- Notification pages for candidates and admins with filter tabs
- OTP auto-focus and responsive layout improvements
- Mobile notification dropdown overflow fix
- CI `@types/react` override pinned to `^18.3.0`

### v1.2.0
- PDF export and session management bug fixes
- Improved error handling across services

### v1.1.0
- Exam preview with fallback options
- PDF reports with DD/MM/YYYY format
- Phantom session detection and cleanup
- Puppeteer config for Render cloud PDF generation

### v1.0.0
- Core quiz functionality, authentication, admin dashboard, email verification, scheduling
