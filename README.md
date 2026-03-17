# RA Trivia - Professional Quiz Platform

A modern, feature-rich quiz application built for candidate assessment and examination. Built with Next.js 14, TypeScript, and PostgreSQL.

## 🎯 Overview

RA Trivia is a comprehensive quiz platform designed for organizations to create, manage, and administer quizzes to candidates. It features real-time timers, progress tracking, email verification, scheduling, detailed analytics, and a full in-app notification system.

## ✨ Key Features

### 🚀 For Candidates
- **Real-time Quiz Experience**: Live timers, progress saving, and instant feedback
- **User Type Filtering**: Candidates only see exams that match their rank/type (e.g. `AMBASSADOR_RANK_EXAMS`)
- **Mobile Responsive**: Optimized for all devices and screen sizes
- **Secure Authentication**: Email verification with auto-focused 6-digit OTP input
- **Quiz History**: Track past attempts and view detailed results
- **Flexible Submission**: Review answers or submit immediately
- **In-App Notifications**: Get notified when a new matching exam is available or when results are released
- **Candidate Notifications Page**: Filter notifications by New Exams or Results

### 🛠️ For Administrators
- **Quiz Management**: Create, edit, and organize quizzes with ease
- **Question Bank**: Support for multiple choice questions with randomized options per user type
- **Scheduling Control**: Set start/end dates and time limits
- **Retake Limits**: Configure maximum attempts per quiz
- **Analytics Dashboard**: Monitor candidate performance and quiz statistics
- **User Management**: View and manage candidate accounts
- **Result Release**: Manually release results per-session or bulk per-quiz; scheduler auto-releases on time
- **In-App Notifications**: Bell icon with dropdown — new account registrations, exam submissions, result releases
- **Notification Filters**: Filter by All, Exams, Candidates, or Admins
- **SUPER_ADMIN Oversight**: Sees all notifications across all admins and candidates

### 🔔 Notification System
- **NEW_EXAM_AVAILABLE**: Sent to matching candidates when an admin activates a quiz
- **RESULT_RELEASED**: Sent to each candidate when their result is manually or automatically released
- **NEW_USER_REGISTERED**: Sent to SUPER_ADMIN when any candidate registers
- **NEW_ADMIN_REGISTERED**: Sent to SUPER_ADMIN when a new admin or super admin account is created
- **EXAM_SUBMITTED**: Sent to admins when a candidate submits an exam
- Bell dropdown floats above all content via React portal, mobile-safe with overflow clamping

### 🔧 Technical Features
- **Modern Tech Stack**: Next.js 14, React 18, TypeScript, Prisma ORM
- **Database**: PostgreSQL with optimized schema design
- **Email Service**: Resend integration for verification and result notifications
- **Security**: Input sanitization, JWT authentication, and role-based access control
- **Performance**: Optimized builds, lazy loading, and caching strategies
- **CI Pipeline**: TypeScript checks, ESLint, build validation via `./scripts/test-ci-local.sh`

## 🏗️ Architecture

```
ra-trivia/
├── apps/
│   ├── web/                 # Next.js frontend application
│   └── server/              # Express.js backend API
├── packages/
│   └── database/            # Prisma schema and migrations
├── scripts/                 # Utility and deployment scripts
└── docs/                   # Documentation
```

### Frontend (`apps/web`)
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React hooks and context
- **UI Components**: Custom components with Lucide icons

### Backend (`apps/server`)
- **Framework**: Express.js with TypeScript
- **Database**: Prisma ORM with PostgreSQL
- **Authentication**: JWT with email verification
- **Validation**: Express-validator with custom sanitization

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- pnpm package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ra-trivia
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database Setup**
   ```bash
   # Generate Prisma client
   pnpm --filter database exec prisma generate
   
   # Run migrations
   pnpm --filter database exec prisma migrate deploy
   
   # Seed database (optional)
   pnpm --filter database exec prisma db seed
   ```

5. **Start Development Servers**
   ```bash
   # Start backend server (port 4000)
   pnpm --filter server dev
   
   # Start frontend (port 3000)
   pnpm --filter web dev
   ```

## ⚙️ Configuration

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/ra_trivia"

# Authentication
JWT_SECRET="your-super-secret-jwt-key"
WEB_URL="http://localhost:3000"

# Email Service (Resend)
RESEND_API_KEY="your-resend-api-key"
FROM_EMAIL="noreply@yourdomain.com"

# API Configuration
NEXT_PUBLIC_API_URL="http://localhost:4000/api"
```

### Database Schema

The application uses the following main entities:

- **User**: Candidate and administrator accounts
- **Quiz**: Quiz configurations and settings
- **Question**: Individual quiz questions
- **QuizSession**: Candidate quiz attempts and results

## 📚 API Documentation

### Authentication Endpoints

```bash
POST /api/auth/register          # User registration
POST /api/auth/login             # User login
POST /api/auth/verify-otp        # Email OTP verification (triggers account notifications)
POST /api/auth/resend-otp        # Resend OTP code
```

### Quiz Endpoints

```bash
GET    /api/quizzes              # List quizzes (filtered by role & user type)
GET    /api/quizzes/:id          # Get quiz details
PATCH  /api/quizzes/:id          # Update quiz metadata (admin)
PATCH  /api/quizzes/:id/toggle   # Activate/deactivate quiz (notifies matching candidates)
DELETE /api/quizzes/:id          # Delete quiz
GET    /api/quiz/my-sessions     # Candidate's own sessions
POST   /api/quiz/start           # Start quiz session
POST   /api/quiz/submit          # Submit quiz answers
```

### Admin Endpoints

```bash
GET  /api/admin/results                        # All candidate results (paginated, searchable)
GET  /api/admin/analytics                      # Quiz performance analytics
GET  /api/admin/global-stats                   # Platform-wide statistics
POST /api/admin/sessions/release               # Manually release results for sessions
POST /api/admin/quizzes/:quizId/release-all    # Release all results for a quiz
PATCH /api/admin/sessions/:sessionId/status    # Set manual pass/fail status
POST /api/admin/trigger-emails                 # Manually trigger pending result emails
GET  /api/admin/export/formatted-excel         # Export formatted Excel report
GET  /api/admin/export/pdf                     # Export PDF report
GET  /api/admin/export/:quizId                 # Export per-quiz Excel report
```

### Notification Endpoints

```bash
GET  /api/notifications              # Get notifications (own for candidates/admins, all for SUPER_ADMIN)
PATCH /api/notifications/:id/read    # Mark notification as read
POST /api/notifications/mark-all-read # Mark all as read
DELETE /api/notifications/:id        # Delete notification
```

## 🧪 Testing

### Run Tests
```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter web test
pnpm --filter server test
```

### CI/CD Pipeline
```bash
# Run local CI checks
./scripts/test-ci-local.sh
```

The CI pipeline includes:
- Dependency installation
- Linting and formatting checks
- TypeScript compilation
- Security audits
- Database validation

## 🚀 Deployment

### Production Build
```bash
# Build all applications
pnpm build

# Build specific package
pnpm --filter web build
pnpm --filter server build
```

### Environment Setup
1. **Database**: Configure PostgreSQL connection
2. **Email Service**: Set up Resend API key
3. **Environment**: Configure all required variables
4. **SSL**: Enable HTTPS for production

### Docker Deployment
```bash
# Build and run with Docker
docker-compose up -d
```

## 🔧 Development

### Code Style
- **TypeScript**: Strict mode enabled
- **ESLint**: Custom rules for consistency
- **Prettier**: Automatic formatting
- **Husky**: Pre-commit hooks

### Database Migrations
```bash
# Create new migration
pnpm --filter database exec prisma migrate dev --name migration-name

# Deploy migrations
pnpm --filter database exec prisma migrate deploy
```

### Adding Features
1. Follow the existing code structure
2. Add TypeScript types for new data
3. Include proper error handling
4. Update documentation
5. Add tests for new functionality

## 🐛 Troubleshooting

### Common Issues

**Database Connection Issues**
```bash
# Check PostgreSQL status
pg_isready -h localhost -p 5432

# Test connection
psql "postgresql://user:password@localhost:5432/database"
```

**Build Errors**
```bash
# Clear node_modules
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

**Email Verification Not Working**
- Check Resend API key configuration
- Verify FROM_EMAIL domain is verified
- Check spam/junk folders

### Performance Optimization
- Use Next.js Image component for images
- Implement proper caching strategies
- Optimize database queries with indexes
- Enable compression for API responses

## 📊 Monitoring & Analytics

### Key Metrics
- Quiz completion rates
- User engagement statistics
- Performance metrics
- Error tracking

### Logging
- Structured logging with Winston
- Error tracking and reporting
- Performance monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the CI pipeline
6. Submit a pull request

### Development Guidelines
- Follow existing code patterns
- Write meaningful commit messages
- Update documentation
- Test thoroughly

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation

## 🔄 Version History

### v1.0.0
- Core quiz functionality
- User authentication and verification
- Admin dashboard
- Email notifications
- Real-time quiz experience
- Scheduling and retake limits

### v1.1.0
- Fixed TypeScript errors and test compilation issues
- Enhanced exam preview with fallback options
- PDF reports with DD/MM/YYYY date format and exam-named filenames
- Phantom session detection and cleanup
- Puppeteer configuration for cloud (Render) PDF generation
- Admin test protection with confirmation dialogs

### v1.2.0
- PDF export and session management bug fixes
- Improved error handling and robustness across services

### v1.3.0 (Current)
- **User Type Filtering**: Candidates only see and are notified about exams matching their type
- **Full Notification System**: In-app bell with portal dropdown for admins and candidates
  - `NEW_EXAM_AVAILABLE` — candidates notified when a matching quiz is activated
  - `RESULT_RELEASED` — candidates notified on manual or scheduled result release
  - `NEW_USER_REGISTERED` / `NEW_ADMIN_REGISTERED` — SUPER_ADMIN notified on all new accounts
  - `EXAM_SUBMITTED` — admins notified when candidates submit
- **Notification Pages**: Admin page with Exams/Candidates/Admins filter tabs; candidate page with New Exams/Results tabs
- **OTP UX**: Auto-focus on first input box after redirect from registration; responsive layout on narrow screens
- **Mobile Fixes**: Notification dropdown overflow clamped on narrow screens; OTP inputs scale correctly on 320px devices
- **CI Fix**: Removed `500.tsx` (Pages Router file incompatible with App Router) that caused build failures
- **@types/react override**: Pinned to `^18.3.0` via pnpm workspace overrides to prevent version conflicts

---

**Built with ❤️ for modern assessment and learning**
