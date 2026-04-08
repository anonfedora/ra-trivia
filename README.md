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
- **About Page**: Dedicated informational page for new users to learn about RA Trivia's features and mission.
- **Multiple Question Formats**:
  - **Multiple Choice (MCQ)**: Standard 4-option selection.
  - **Fill in the Gap (FITG)**: Interactive Drag & Drop interface (Web) or Tap-to-Select (Mobile) to fill blanks (`___`) in question text from a shuffled answer pool.
- **Exam Access Code**: Secure entry required for specific exams if set by admin (Web & Mobile).
- Register, verify email via 6-digit OTP, log in
- See only exams matching their user type (e.g. `AMBASSADOR_RANK_EXAMS`)
- Real-time countdown timer with auto-submit on expiry
- Anti-cheat: tab-switch detection (3 strikes = auto-submit), copy/paste/right-click disabled
- Review answers before submitting
- View results when released; locked with countdown until release time
- In-app notifications: new exams available, results released
- Password reset via email link (15-minute expiry)
- **Live Support**: Floating support button (bottom-left during exams, bottom-right otherwise) for real-time chat with admins.

### Admins
- Create, edit, activate/deactivate, and delete quizzes
- **Question Management**:
  - Import questions from Excel by user type and format (MCQ/FITG).
  - **Template Downloads**: Specialized Excel templates for each format to ensure valid imports.
  - **Pass Mark Configuration**: Set custom pass/fail percentage thresholds per quiz (defaults to 50%).
  - **Exam Access Code**: Optional code (e.g., `PLENIEXAM2026`) that candidates must enter to start the exam.
- **Bulk Candidate Import**: Register hundreds of candidates via Excel upload with automated welcome emails and 24-hour verification window
- **Bulk Communication**:
  - **Exam Notifications**: One-click broadcast to all candidates in an exam's category with date, time, and access code.
  - **General Announcements**: Send custom platform-wide or rank-specific messages via email and in-app notifications.
- Set retake limits, start/end scheduling
- View all candidate results with search and pagination
- **Bulk Result Release**: Select multiple results at once and release them via a single action; replaces individual "Release Now" buttons
- **AI-Powered Support Center**: Real-time chat with candidates, thread management, and resolution tracking.
  - **AI Support Assistant**: Analyzes candidate messages using Gemini 2.0 Flash to suggest the best FAQ template.
  - **AI Auto-Reply**: Automatically responds to high-confidence (85%+) common queries like login issues or result delays.
  - **Instant Templates**: Library of FAQ and troubleshooting templates that admins can send with a single click.
- Manually release results per-session or bulk per-quiz
- Set manual pass/fail status override
- Export results as formatted Excel or PDF
- **Enhanced Analytics**: Detailed performance metrics (Pass/Fail breakdown, Score extremes) with dynamic summary headers
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

### Session Maintenance

The platform implements a **Silent Token Refresh** mechanism:
- **Axios Interceptors**: Global interceptors handle 401 Unauthorized errors by automatically requesting a new access token using the refresh token.
- **Transparent Retry**: Failed requests due to expired sessions are retried automatically, ensuring uninterrupted user experience during exams.
- **Auto-Logout Refinement**: The system only redirects to the login page if the refresh token itself has expired or been revoked.

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
POST   /api/quizzes                        # Create with optional examCode (admin)
PATCH  /api/quizzes/:id                    # Update metadata (including examCode)
PATCH  /api/quizzes/:id/toggle             # Activate/deactivate
DELETE /api/quizzes/:id
```

### Quiz Session
```
POST /api/quiz/start                       # Starts session (requires examCode if set)
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

### v1.9.1 (Current)
- **AI-Powered Support Assistant**:
    - **Contextual Analysis**: Uses **Gemini 2.0 Flash** to analyze candidate messages and suggest the most relevant FAQ templates.
    - **AI Auto-Reply**: Automatically responds to common queries (Login, OTP, Results) with high confidence (85%+) matching.
    - **Keyword Fallback Engine**: Robust matching system ensures functionality even when the AI API quota is exceeded.
- **Bulk Communication Suite**:
    - **Exam Notifications**: Send bulk email and in-app alerts for upcoming exams, including date, time, and access code.
    - **General Announcements**: Broadcast custom messages to all or specific candidate ranks (Ambassador, Plenipotentiary, etc.).
- **Exam Access Code**:
    - **Secure Exam Entry**: Optional access codes required for candidates to start specific exams.
    - **Admin Controls**: Set codes during quiz creation, editing, or bulk question imports.
    - **Multi-Platform Support**: Secure entry implemented across Web and Mobile candidate interfaces.
- **UX & Layout Improvements**:
    - **Responsive Admin Controls**: Re-engineered button layouts for "Save", "Notify", and "Preview" for perfect mobile/desktop viewing.
    - **Enhanced Preview**: Correct answers for FITG questions and the exam code are now visible and copyable in admin preview mode.
- **Security & Stability**:
    - **Anti-Cheat Fix**: Suppressed password-manager popups on exam entry to prevent false-positive focus-loss violations.
    - **Database Integrity**: Linked notifications directly to users for personalized, persistent alert history.
- **Exam Access Code**:
    - **Secure Exam Entry**: Admins can now set an optional access code (e.g., `PLENIEXAM2026`) that candidates must enter before starting an exam.
    - **Multi-Platform Support**: Implemented across Web and Mobile candidate interfaces with secure password inputs.
    - **Validation Logic**: Robust server-side validation ensures the correct code is provided before initiating a quiz session.
    - **Import Integration**: Support for setting the exam code during bulk question imports.

### v1.9.0
- **Bulk Candidate Registration**:
    - **Excel Import**: Register hundreds of candidates in seconds via `.xlsx` or `.csv`.
    - **Automated Onboarding**: Candidates receive welcome emails with login credentials and a 24-hour verification OTP.
    - **Import Summaries**: Real-time reporting of successful vs. failed registrations with error details.
- **Enhanced Admin Analytics**:
    - **Pass/Fail Breakdown**: Visual metrics based on a 50% score threshold.
    - **Score Extremes**: Instant visibility of highest and lowest scores per quiz.
    - **Summary Headers**: Dynamic results header on the admin search page for filtered result sets.
- **Platform Experience & UI**:
    - **Bulk Result Release**: Modern selection-based results release workflow for admins.
    - **About Page**: New informational landing page for prospective users.
    - **Admin Preview Enhancement**: Correct answers now highlighted in the read-only preview for admin verification.
    - **Mobile Warning Optimization**: Centered and wrap-safe timer/violation alerts for mobile users.
    - **Unverified Login Flow**: Seamless redirection and new OTP generation for unverified accounts.
- **System Maintenance**:
    - **Automated Cleanup**: Hourly background task to purge expired (24h+) unverified accounts.
    - **SDK Downgrade (Mobile)**: Realigned to Expo SDK 54 for guaranteed Expo Go stability.
    - **Rate Limiting Fix**: Skips CORS OPTIONS preflight requests and increases API limits to 300 per 15-min window.

### v1.8.0
- **Social Sharing & QR Verification**:
    - **QR Code Generation**: Results pages now include a high-definition QR code for instant physical-to-digital validation.
    - **Public Verification Page**: A new dedicated, unauthenticated landing page (`/verify/[id]`) for third-party result verification.
    - **WhatsApp Integration**: One-click sharing of exam achievements with pre-filled templates and deep links.
    - **Web Share API**: Native mobile sharing support for a seamless "Share Achievement" experience.
- **Enhanced Verification Metadata**: Inclusion of Candidate Association and Exam Type (User Type) on official verification records.

### v1.7.0
- **Networking Architecture Migration**: Migrated from manual `fetch`/`apiJson` to a centralized **Axios-based** networking layer.
- **Silent Session Refreshes**: Implemented transparent token rotation via Axios interceptors, preventing session timeouts during active usage.
- **Unified apiFetch Utility**: Replaced fragmented calling patterns with a consistent, authenticated fetch helper across all modules.
- **Quiz UI Refinement**: Increased clearance for navigation buttons on mobile to prevent overlap with floating support buttons.
- **Legacy Cleanup**: Removed over 500 lines of redundant networking logic (`apiHelpers.ts`, etc.).

### v1.6.0
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
