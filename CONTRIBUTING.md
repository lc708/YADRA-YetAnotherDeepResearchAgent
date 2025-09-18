# Contributing to YADRA

Thank you for your interest in contributing to YADRA! We welcome contributions of all kinds.

## Quick Start

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/YADRA-YetAnotherDeepResearchAgent.git
   cd YADRA-YetAnotherDeepResearchAgent
   ```

2. **Set up development environment**
   ```bash
   ./bootstrap.sh --dev
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Guidelines

### Code Style

**Backend (Python)**
- Use `ruff` for formatting and linting
- Include type annotations
- Follow PEP 8 standards

```bash
ruff format src/
ruff check src/ --fix
```

**Frontend (TypeScript/React)**
- Use `prettier` and `eslint`
- Use functional components with hooks

```bash
cd web
pnpm lint
pnpm format
```

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type: description

Examples:
feat: add user authentication
fix: resolve SSE connection issue
docs: update installation guide
```

## Testing

```bash
# Backend tests
pytest tests/

# Frontend tests
cd web && pnpm test
```

## Pull Request Process

1. Ensure your code follows the style guidelines
2. Add tests for new features
3. Update documentation if needed
4. Create a Pull Request with a clear description

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests pass
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow convention

## Reporting Issues

When reporting bugs, please include:

- Environment details (OS, Python version, Node.js version)
- Steps to reproduce
- Expected vs actual behavior
- Error logs or screenshots

## Feature Requests

For new features, please describe:

- The problem you're solving
- Your proposed solution
- Any alternatives considered

## Community

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and discussions
- **Pull Requests**: Code contributions

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## Getting Help

If you need help:
- Check existing issues and discussions
- Create a new issue with detailed information
- Tag maintainers if urgent

Thank you for contributing to YADRA!