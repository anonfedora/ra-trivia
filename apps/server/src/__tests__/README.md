# Server Test Suite

This directory contains comprehensive tests for the Royal Ambassadors Quiz Portal server.

## Test Structure

```
__tests__/
├── setup.ts                    # Test environment setup
├── unit/                       # Unit tests
│   ├── validation.test.ts      # Validation utilities
│   ├── userTypeAccess.test.ts  # User type filtering logic
│   ├── reportGenerator.test.ts # Report generation logic
│   ├── rateLimiter.test.ts     # Rate limiting functionality (13 tests)
│   └── questionShuffling.test.ts # Crypto-secure question shuffling (7 tests)
└── integration/                # Integration tests
    ├── auth.test.ts            # Authentication endpoints
    └── quiz.test.ts            # Quiz endpoints
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run specific test file
```bash
npm test -- validation.test.ts
```

### Run tests matching a pattern
```bash
npm test -- --grep "authentication"
```

## Test Categories

### Unit Tests
Unit tests focus on testing individual functions and utilities in isolation:
- **validation.test.ts**: Tests email, password, and name validation
- **userTypeAccess.test.ts**: Tests question filtering by user type
- **reportGenerator.test.ts**: Tests report summary calculations
- **rateLimiter.test.ts**: Tests enhanced rate limiting with IPv6 support and user-based limits (13 tests)
- **questionShuffling.test.ts**: Tests crypto-secure Fisher-Yates shuffling algorithm and answer remapping (7 tests)

### Integration Tests
Integration tests test complete API endpoints with database interactions:
- **auth.test.ts**: Tests registration, OTP verification, and login flows
- **quiz.test.ts**: Tests quiz start, answer updates, submission, and session retrieval

## Writing New Tests

### Unit Test Example
```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../../utils/myUtil';

describe('MyUtil', () => {
  describe('myFunction', () => {
    it('should do something correctly', () => {
      const result = myFunction('input');
      expect(result).toBe('expected output');
    });

    it('should handle edge cases', () => {
      expect(myFunction('')).toBe('');
      expect(myFunction(null)).toBe(null);
    });
  });
});
```

### Integration Test Example
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app';

describe('API Endpoint', () => {
  it('should return success response', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .expect(200);

    expect(response.body).toHaveProperty('data');
  });
});
```

## Test Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Clean up test data after each test to avoid pollution
3. **Descriptive Names**: Use clear, descriptive test names that explain what is being tested
4. **Arrange-Act-Assert**: Structure tests with setup, execution, and verification phases
5. **Mock External Dependencies**: Mock external services (email, file system, etc.)
6. **Test Edge Cases**: Include tests for error conditions and edge cases
7. **Keep Tests Fast**: Unit tests should run quickly; use mocks for slow operations

## Coverage Goals

- **Unit Tests**: Aim for 80%+ coverage of utility functions and business logic
- **Integration Tests**: Cover all critical API endpoints and user flows
- **Edge Cases**: Test error handling, validation failures, and boundary conditions

## Continuous Integration

Tests are automatically run on:
- Every commit (pre-commit hook)
- Pull requests (CI pipeline)
- Before deployment (pre-deployment check)

## Debugging Tests

### Run tests with verbose output
```bash
npm test -- --reporter=verbose
```

### Run a single test
```bash
npm test -- --grep "specific test name"
```

### Debug in VS Code
Add this configuration to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["test"],
  "console": "integratedTerminal"
}
```

## Common Issues

### Database Connection Errors
- Ensure test database is running
- Check DATABASE_URL in .env.test
- Verify database migrations are up to date

### Timeout Errors
- Increase timeout in vitest.config.ts
- Check for hanging promises or unclosed connections
- Ensure proper cleanup in afterEach/afterAll hooks

### Flaky Tests
- Check for race conditions
- Ensure proper test isolation
- Use deterministic test data
- Avoid time-dependent assertions

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)
