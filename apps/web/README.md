# RA Trivia — Web

Next.js 14 frontend for the RA Trivia quiz platform. Deployed on Vercel.

## Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Real-time**: Socket.IO client
- **Date formatting**: date-fns

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root layout — ThemeProvider, ToastProvider, ErrorBoundary
│   ├── page.tsx                      # Landing page
│   ├── login/
│   ├── register/
│   ├── verify-otp/
│   ├── forgot-password/
│   ├── reset-password/
│   ├── dashboard/                    # Candidate dashboard
│   ├── notifications/                # Candidate notifications page
│   ├── profile/
│   ├── results/
│   ├── quiz/
│   │   └── [id]/
│   │       ├── instructions/         # Pre-exam instructions + anti-cheat notice
│   │       └── page.tsx              # Active exam page
│   └── admin/
│       ├── dashboard/
│       ├── results/
│       ├── analytics/
│       ├── notifications/
│       └── quizzes/[id]/preview/
├── components/
│   ├── ClientProviders.tsx           # "use client" wrapper for ErrorBoundary
│   ├── ErrorBoundary.tsx             # Class component — catches render errors
│   ├── NotificationBell.tsx          # Bell icon + portal dropdown + Socket.IO listener
│   ├── Toaster.tsx                   # Portal-rendered toast stack
│   ├── ThemeToggle.tsx
│   ├── PasswordInput.tsx
│   └── UserTypeSelector.tsx
├── contexts/
│   ├── ThemeContext.tsx
│   └── ToastContext.tsx              # useToast() hook — success/error/warning/info
└── lib/
    └── api.ts                        # apiJson() fetch wrapper
```

## Setup

```bash
# From workspace root
pnpm install

cp apps/web/.env.example apps/web/.env
```

### Environment Variables

```bash
NEXT_PUBLIC_API_URL="http://localhost:4000/api"
```

For production set this to your Render backend URL, e.g. `https://ra-trivia.onrender.com/api`.

## Scripts

```bash
# Development
pnpm --filter web dev        # http://localhost:3000

# Production build
pnpm --filter web build

# Start production
pnpm --filter web start

# Lint
pnpm --filter web lint
```

## Key Pages

### Public
| Route | Description |
|---|---|
| `/` | Landing page |
| `/login` | Login with forgot password link |
| `/register` | Candidate registration |
| `/verify-otp` | 6-digit OTP verification (auto-focuses first input) |
| `/forgot-password` | Request password reset email |
| `/reset-password` | Set new password via token from email |

### Candidate (requires auth, role = CANDIDATE)
| Route | Description |
|---|---|
| `/dashboard` | Available exams + past results |
| `/quiz/:id/instructions` | Pre-exam instructions with anti-cheat rules |
| `/quiz/:id` | Active exam — timer, questions, auto-save |
| `/results` | Result detail (locked until released) |
| `/admin/notifications` | All notifications with New Exams / Results filter tabs |
| `/admin/support` | Support Center dashboard with real-time candidate chat |
| `/profile` | View and update profile |

### Admin (requires auth, role = ADMIN or SUPER_ADMIN)
| Route | Description |
|---|---|
| `/admin/dashboard` | Quiz management, import, recent activity |
| `/admin/results` | All candidate results, search, release, export |
| `/admin/analytics` | Performance charts and stats |
| `/admin/notifications` | Notifications with Exams / Candidates / Admins filter tabs |
| `/admin/quizzes/:id/preview` | Preview quiz questions |

## Toast System

A global toast system is available on every page via `useToast()`:

```tsx
import { useToast } from '../../contexts/ToastContext';

const { toast } = useToast();

toast('Saved successfully', 'success');
toast('Something went wrong', 'error');
toast('Quiz has not started yet', 'warning');
toast('3 new notifications', 'info');
```

Toasts auto-dismiss after 4 seconds. The `<Toaster />` component renders via a React portal at the bottom-right of the screen.

## Notification Bell

`<NotificationBell />` connects to the backend Socket.IO server on mount using the stored JWT. It joins the user's private room and listens for `notification` events to refresh the list in real time. Falls back to 30-second polling if the socket fails to connect.

The dropdown is rendered via `createPortal` into `document.body` so it floats above all content regardless of stacking context. Position is clamped to prevent overflow on narrow screens.

## Anti-Cheat (Exam Page)

During an active exam session the following are enforced client-side:

- **Tab switching / window blur**: 3 violations trigger automatic submission
- **Copy / Paste / Cut**: `copy`, `paste`, `cut` events are `preventDefault()`-ed
- **Right-click**: `contextmenu` event is `preventDefault()`-ed
- **Page reload**: `beforeunload` shows a browser confirmation dialog

These are disclosed to candidates on the instructions page before they start.

## Error Boundary

`<ErrorBoundary>` wraps the entire app via `<ClientProviders>` in `layout.tsx`. Any uncaught render error shows a friendly "Something went wrong" screen with a reload button instead of a blank page.

Because `layout.tsx` is a Server Component, `ErrorBoundary` (a class component) is wrapped in `ClientProviders.tsx` (`"use client"`) to avoid `@types/react` version conflicts between server and client contexts.

## Deployment (Vercel)

1. Connect the repo to Vercel
2. Set `NEXT_PUBLIC_API_URL` in Vercel environment settings
3. Vercel auto-deploys on push to `main`

The project uses `next/image` for all images — required for Vercel's ESLint build check.
