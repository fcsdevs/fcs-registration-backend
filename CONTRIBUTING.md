# Contributing to FCS Registration Backend

Thank you for your interest in contributing to the FCS Registration Backend! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and professional in all interactions. We are committed to providing a welcoming and inclusive environment.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 12
- Docker & Docker Compose (optional, for local development)

### Setup Development Environment

1. **Clone the repository**
   ```bash
   git clone https://github.com/fcsdevs/fcs-registration-backend.git
   cd fcs-registration-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your local settings
   ```

4. **Setup database**
   ```bash
   # Using Docker Compose
   docker-compose up -d

   # Or using local PostgreSQL
   npm run db:migrate
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## Development Workflow

### Branch Naming Convention

- Feature: `feature/description`
- Bug fix: `fix/description`
- Documentation: `docs/description`
- Chore: `chore/description`

Example: `feature/add-email-notifications`

### Commit Message Convention

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Example:
```
feat(auth): add JWT token refresh mechanism

Implement token refresh endpoint that allows clients to obtain
new access tokens using refresh tokens.

Closes #123
```

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, readable code
   - Follow the existing code style
   - Add comments for complex logic
   - Update related documentation

3. **Run tests and linting**
   ```bash
   npm test
   npm run lint
   npm run lint:fix  # Auto-fix linting issues
   ```

4. **Format code**
   ```bash
   npm run format
   ```

5. **Commit your changes**
   ```bash
   git commit -m "feat(module): description of change"
   ```

## Code Standards

### Style Guide

- **Indentation**: 2 spaces
- **Quotes**: Single quotes
- **Semicolons**: Always use
- **Line length**: Max 100 characters
- **Variables**: Use `const` by default, `let` when needed, never `var`

### File Organization

- Controllers: Handle HTTP requests/responses
- Services: Business logic
- Routes: Endpoint definitions
- Middleware: Request processing

### Error Handling

- Use the provided error classes from `src/middleware/error-handler.js`
- Always pass errors to `next()` middleware
- Include meaningful error messages and error codes

```javascript
import { ValidationError, NotFoundError } from './error-handler.js';

// Validation error
if (!email) {
  return next(new ValidationError('Email is required'));
}

// Not found error
if (!resource) {
  return next(new NotFoundError('Resource'));
}
```

### Async/Await

Use async/await instead of promises:

```javascript
// Good
try {
  const user = await User.findById(id);
} catch (error) {
  next(error);
}

// Avoid
User.findById(id)
  .then(user => res.json(user))
  .catch(err => next(err));
```

## Testing

### Writing Tests

- Write tests for new features
- Maintain or improve code coverage
- Use Jest for unit tests
- Test both happy paths and error cases

```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report
```

### Test Structure

```javascript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something specific', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = functionToTest(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

## Database Migrations

### Creating a Migration

1. **Update the schema**
   ```bash
   # Edit prisma/schema.prisma
   ```

2. **Create migration**
   ```bash
   npm run db:migrate -- --name add_user_table
   ```

3. **Review generated SQL**
   - Check the migration file in `prisma/migrations/`
   - Ensure it's correct and safe

4. **Test the migration**
   ```bash
   npm run db:reset  # For development only
   ```

### Migration Best Practices

- One logical change per migration
- Use descriptive migration names
- Test migrations thoroughly
- Never edit generated migration files manually
- Always make migrations reversible

## Documentation

### Code Comments

- Document complex algorithms
- Explain why, not what (code shows what)
- Use JSDoc for functions and classes

```javascript
/**
 * Validates user input against schema
 * @param {Object} data - User input data
 * @param {string} schema - Joi validation schema
 * @returns {Object} Validation result with errors or data
 * @throws {ValidationError} If validation fails
 */
export const validateInput = (data, schema) => {
  // Implementation
};
```

### API Documentation

- Update `API_DOCUMENTATION.md` for new endpoints
- Include request/response examples
- Document error responses
- List all query parameters and body fields

## Pull Request Process

1. **Before creating PR**
   - Pull latest changes from main
   - Run tests and ensure they pass
   - Run linting and format code
   - Update documentation

2. **Create Pull Request**
   - Use a clear, descriptive title
   - Fill out the PR template completely
   - Reference related issues using `#123`
   - Add labels (feature, bug, documentation, etc.)

3. **PR Description Template**
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation

   ## Testing
   Steps to test the changes

   ## Checklist
   - [ ] Tests added/updated
   - [ ] Documentation updated
   - [ ] No breaking changes
   - [ ] Code follows style guidelines
   ```

4. **Code Review**
   - Respond to reviewer comments
   - Request re-review after making changes
   - Keep commits clean (consider squashing if needed)

5. **Merge**
   - Ensure all CI checks pass
   - Get approval from maintainers
   - Use "Squash and merge" for feature branches

## Common Issues

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Database Connection Issues

```bash
# Check PostgreSQL connection
psql -U postgres -h localhost

# Reset database (development only)
npm run db:reset
```

### Module Import Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Performance Considerations

- Optimize database queries
- Use connection pooling
- Implement caching where appropriate
- Monitor response times
- Profile before optimizing

## Security Guidelines

- Never commit `.env` files
- Use environment variables for secrets
- Validate and sanitize all inputs
- Use parameterized queries
- Keep dependencies updated
- Report security issues privately

## Getting Help

- Check existing issues and discussions
- Review documentation and API docs
- Ask in pull request comments
- Contact maintainers directly

## License

By contributing, you agree that your contributions will be licensed under the PROPRIETARY license.

## Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [JWT Documentation](https://jwt.io/)
- [Conventional Commits](https://www.conventionalcommits.org/)

Thank you for contributing!
