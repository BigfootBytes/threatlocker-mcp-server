# ThreatLocker MCP Server - Development Log

## 2026-02-03

- Built initial MCP server with 4 tools: computers, computer_groups, applications, policies
- Added `.env` file support via dotenv
- Fixed authentication headers (`Authorization` instead of `APIKey`, case-sensitive `ManagedOrganizationId`)
- Discovered undocumented `ApplicationFile/ApplicationFileGetByApplicationId` endpoint via DynamicIT PowerShell module
- Added `files` action to applications tool
- Added multi-stage Dockerfile for in-container TypeScript builds
- Added GitHub Actions workflow for GHCR publishing on version tags
- Added docker-compose.yml and .env.example
- Security: enforce HTTPS for base URL, run container as non-root user
- Released v0.1.0 to GHCR
- Updated docker-compose to use published image
- Added dual-mode transport: stdio (default) and HTTP with per-request auth
- HTTP mode uses pass-through credentials (no secrets stored on server)
- Rewrote README with Docker and Claude configuration instructions
