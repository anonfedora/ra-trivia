# RA Trivia - Professional Quiz Platform

A modern, feature-rich quiz application built for candidate assessment and examination. Built with Next.js 14, TypeScript, and PostgreSQL.

## 🎯 Overview

RA Trivia is a comprehensive quiz platform designed for organizations to create, manage, and administer quizzes to candidates. It features real-time timers, progress tracking, email verification, scheduling, and detailed analytics.

## ✨ Key Features

### 🚀 For Candidates
- **Real-time Quiz Experience**: Live timers, progress saving, and instant feedback
- **Mobile Responsive**: Optimized for all devices and screen sizes
- **Secure Authentication**: Email verification and secure login system
- **Quiz History**: Track past attempts and view detailed results
- **Flexible Submission**: Review answers or submit immediately

### 🛠️ For Administrators
- **Quiz Management**: Create, edit, and organize quizzes with ease
- **Question Bank**: Support for multiple choice questions with randomized options
- **Scheduling Control**: Set start/end dates and time limits
- **Retake Limits**: Configure maximum attempts per quiz
- **Analytics Dashboard**: Monitor candidate performance and quiz statistics
- **User Management**: View and manage candidate accounts

### 🔧 Technical Features
- **Modern Tech Stack**: Next.js 14, React 18, TypeScript, Prisma ORM
- **Database**: PostgreSQL with optimized schema design
- **Email Service**: Resend integration for verification and notifications
- **Security**: Input sanitization, JWT authentication, and role-based access
- **Performance**: Optimized builds, lazy loading, and caching strategies

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
POST /api/auth/register    # User registration
POST /api/auth/login       # User login
POST /api/auth/verify      # Email verification
```

### Quiz Endpoints

```bash
GET  /api/quizzes          # List all quizzes
GET  /api/quizzes/:id      # Get quiz details
POST /api/quizzes/start    # Start quiz session
POST /api/quizzes/submit   # Submit quiz answers
```

### Admin Endpoints

```bash
GET  /api/admin/quizzes    # Manage quizzes
POST /api/admin/quizzes    # Create quiz
PUT  /api/admin/quizzes/:id # Update quiz
DELETE /api/admin/quizzes/:id # Delete quiz
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

### v1.0.0 (Current)
- Core quiz functionality
- User authentication and verification
- Admin dashboard
- Email notifications
- Real-time quiz experience
- Scheduling and retake limits

### v1.1.0 (Enhancements)
- ✅ **Fixed TypeScript Errors**: Resolved all test compilation issues
- ✅ **Enhanced Exam Preview**: Fixed blank quiz pages with fallback options
- ✅ **Improved Date Format**: PDF reports now use DD/MM/YYYY format
- ✅ **Better Filenames**: Export files include exam names with underscores
- ✅ **Phantom Session Prevention**: Added detection and cleanup for orphaned sessions
- ✅ **Cloud PDF Generation**: Fixed Puppeteer configuration for Render hosting
- ✅ **Admin Test Protection**: Added confirmation dialogs to prevent accidental session creation
- ✅ **Enhanced Logging**: Better debugging and error tracking
- ✅ **All Tests Passing**: Complete test suite coverage

### v1.2.0 (Recent Fixes)
- 🔧 **PDF Export**: Fixed syntax errors and cloud deployment issues
- 🔧 **Session Management**: Resolved phantom session creation bugs
- 🔧 **Error Handling**: Improved robustness across all services
- 🔧 **Performance**: Optimized for production environments

---

**Built with ❤️ for modern assessment and learning**
