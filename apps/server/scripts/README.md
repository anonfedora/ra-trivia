# Utility Scripts

This directory contains utility scripts for manual testing, debugging, and maintenance tasks.

## 🔧 Utility Scripts vs Automated Tests

### Utility Scripts (This Directory)
- **Purpose**: Manual testing, debugging, data inspection, one-off tasks
- **When to use**: During development, debugging issues, data maintenance
- **How to run**: `node scripts/script-name.js`

### Automated Tests (`src/__tests__/`)
- **Purpose**: Automated testing, CI/CD, regression prevention
- **When to use**: Always (run automatically on commits/PRs)
- **How to run**: `npm test`

## 📁 Script Categories

### Debugging Scripts
- `debug-email-system.js` - Check email system status and pending emails
- `check-duplicate-sessions.js` - Find duplicate/phantom quiz sessions
- `check-users.js` - Inspect user data

### Maintenance Scripts
- `cleanup-phantom-sessions.js` - Clean up stale quiz sessions
- `test-email-trigger.js` - Manually trigger pending email sends

### Legacy Test Scripts (Consider Migrating to Vitest)
These were used for manual testing during development:
- `test-access-complete.js` - Test user type access control
- `test-access-control.js` - Test access control middleware
- `test-access-denial.js` - Test access denial scenarios
- `test-access-simple.js` - Simple access control tests
- `test-auth.js` - Test authentication flow
- `test-functionality.js` - Test general functionality
- `test-middleware.js` - Test middleware functions
- `test-mixed-questions.js` - Test mixed question types
- `test-profile-management.js` - Test profile management
- `test-server-checkpoint.js` - Server checkpoint tests

## 🚀 Usage Examples

### Check Email System Status
```bash
node scripts/debug-email-system.js
```

### Clean Up Phantom Sessions
```bash
node scripts/cleanup-phantom-sessions.js
```

### Manually Trigger Emails
```bash
# Get admin token from browser console: localStorage.getItem('token')
node scripts/test-email-trigger.js YOUR_ADMIN_TOKEN
```

### Check for Duplicate Sessions
```bash
node scripts/check-duplicate-sessions.js
```

## 📝 Migration Plan

### Keep as Utility Scripts
These provide value as manual debugging/maintenance tools:
- ✅ `debug-email-system.js`
- ✅ `check-duplicate-sessions.js`
- ✅ `cleanup-phantom-sessions.js`
- ✅ `test-email-trigger.js`
- ✅ `check-users.js`

### Consider Migrating to Vitest
These test specific functionality and should be automated:
- 🔄 `test-access-*.js` → `src/__tests__/integration/access-control.test.ts`
- 🔄 `test-auth.js` → Already covered in `src/__tests__/integration/auth.test.ts`
- 🔄 `test-functionality.js` → Split into relevant test files
- 🔄 `test-middleware.js` → `src/__tests__/unit/middleware.test.ts`
- 🔄 `test-profile-management.js` → `src/__tests__/integration/profile.test.ts`

### Can Be Removed
Once migrated to Vitest:
- ❌ `test-server-checkpoint.js` - Covered by integration tests
- ❌ `test-mixed-questions.js` - Covered by quiz tests

## 🎯 Best Practices

### When to Create a Utility Script
- One-off data migrations
- Debugging production issues
- Manual testing of complex scenarios
- Data inspection and reporting

### When to Create an Automated Test
- Testing business logic
- Testing API endpoints
- Regression prevention
- CI/CD integration

## 📚 Related Documentation
- [Automated Tests](../src/__tests__/README.md)
- [Testing Guide](../../TESTING.md)
