# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

Only the latest minor release receives security updates.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, report them via [GitHub Security Advisories](https://github.com/BigfootBytes/threatlocker-mcp/security/advisories/new).

Please include:

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fix (if available)

You should receive an initial response within 72 hours. We will keep you informed of progress toward a fix and may ask for additional information.

## Security Considerations

This project is an MCP server that proxies requests to the ThreatLocker API. Keep the following in mind:

- **API Keys**: Never commit API keys or credentials. Use environment variables or a `.env` file (which is gitignored).
- **Transport Security**: When using the HTTP/SSE transport, always run behind HTTPS in production. The server includes rate limiting but does not handle TLS directly.
- **Access Control**: The MCP server inherits the permissions of the ThreatLocker API key it is configured with. Use the principle of least privilege when generating API keys.
- **Dependencies**: We monitor dependencies for known vulnerabilities. If you discover a vulnerable dependency, please report it.

## Disclosure Policy

- Confirmed vulnerabilities will be patched in a timely manner.
- A security advisory will be published on GitHub once a fix is available.
- Credit will be given to reporters unless they prefer to remain anonymous.
