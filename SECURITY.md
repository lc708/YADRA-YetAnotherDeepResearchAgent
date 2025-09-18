# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| main branch | ✅ |
| Latest release | ✅ |
| Older versions | ❌ |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

### How to Report

1. **GitHub Security Advisories** (Recommended)
   - Go to the repository's [Security tab](../../security)
   - Click "Report a vulnerability"
   - Fill out the vulnerability report form

2. **Email** (if available)
   - Send email to project maintainers
   - Use subject: "[SECURITY] YADRA Security Issue"

### What to Include

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if any)
- Environment details

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 7 days  
- **Fix timeline**: 30-90 days depending on severity

## Security Best Practices

### For Users

- Keep API keys secure (use environment variables)
- Use HTTPS in production
- Regularly update dependencies
- Implement proper access controls

### For Developers

- Validate all user inputs
- Use security scanning tools
- Follow secure coding practices
- Keep dependencies updated

## Known Security Considerations

### AI/LLM Related

- **Prompt Injection**: Malicious users may try to manipulate AI behavior
- **Data Leakage**: AI models might accidentally expose training data
- **API Abuse**: Implement rate limiting and monitoring

### Web Application

- **XSS**: All user inputs should be properly escaped
- **CSRF**: Implement CSRF protection
- **SSRF**: Validate external URL requests

## Contact

For questions about this security policy, please create a GitHub issue (for non-security matters) or use GitHub Discussions.

Thank you for helping keep YADRA secure!