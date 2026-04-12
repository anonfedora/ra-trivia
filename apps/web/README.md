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
│       ├── support/                  # Real-time admin support chat
│       └── quizzes/[id]/preview/
├── components/
│   ├── ClientProviders.tsx           # "use client" wrapper for ErrorBoundary
│   ├── ErrorBoundary.tsx             # Class component — catches render errors
│   ├── NotificationBell.tsx          # Bell icon + portal dropdown + Socket.IO listener
│   ├── SupportButton.tsx             # Floating chat button (repositions during exams)
│   ├── Toaster.tsx                   # Portal-rendered toast stack
│   ├── ThemeToggle.tsx
│   ├── PasswordInput.tsx
│   └── UserTypeSelector.tsx
├── contexts/
│   ├── ThemeContext.tsx
│   └── ToastContext.tsx              # useToast() hook — success/error/warning/info
└── lib/
    └── api.ts                        # apiFetch() unified authenticated fetch
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
| `/admin/results` | All candidate results, search, release, export, **Bulk Import** |
| `/admin/analytics` | Performance charts, **Pass/Fail Breakdown**, Score extremes |
| `/admin/notifications` | Notifications with Exams / Candidates / Admins filter tabs |
| `/admin/quizzes/:id/preview` | Preview quiz questions with **PDF export** functionality |

## Admin Features

### Bulk Candidate Import
Admins can now register multiple candidates at once via Excel/CSV. 
- **Template Download**: Get a pre-formatted Excel template with required headers.
- **Auto-Verification**: Candidates receive a welcome email with their password and a 6-digit verification code.
- **Status Reporting**: Real-time summary of successful vs. failed registrations with error details.

### Quiz Preview PDF Export
- **Professional PDF Generation**: Export complete quiz with questions and answers as professionally formatted PDF from admin preview page.
- **Clean Layout**: Optimized for printing with proper headers, question numbering, and answer highlighting.
- **One-Click Export**: Simple download button in admin quiz preview header with loading states.

### Enhanced Analytics
- **Pass/Fail Breakdown**: Visual distribution based on a 50% score threshold.
- **Score Extremes**: Prominent display of Highest and Lowest scores per quiz.
- **Dynamic Summary Headers**: When searching for a specific exam title, a header appears with the filtered Pass/Fail ratio and Average Score.

## UI/UX Improvements
- **Mobile Optimized Warnings**: Timer and Violation alerts are now centered and wrap properly on small screens.
- **Unified Dark Mode**: Premium dark mode applied across Dashboard, Quiz, and Admin pages with consistent theme persistence.
- **Enhanced Verification Flow**: Unverified users attempting to login are automatically sent a new OTP and redirected to the verify page.

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

## Networking & Session Maintenance

The application uses a centralized **Axios-based networking layer** in `lib/api.ts`:

- **apiFetch**: A unified helper that mimics the standard `fetch` API but routes requests through an authenticated Axios instance.
- **Automatic Token Rotation**: A response interceptor detects `401 Unauthorized` errors and automatically attempts to refresh the access token using the stored refresh token.
- **Retry Logic**: If a refresh is successful, the original failed request is retried transparently.
- **Global Auth Handling**: If a refresh fails (session truly expired), the user is automatically redirected to the login page.

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
