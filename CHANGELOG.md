# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2025-06-12

### Fixed
- Worktree merge UI update issue - SessionManager instances are now properly shared between API and WebSocket handlers
- UI now correctly updates after merging worktrees

## [0.1.3] - 2025-06-12

### Added
- Issue templates for bug reports and feature requests
- Demo video in README

### Fixed
- Exclude test files from TypeScript build output
- Remove test helper files from npm package distribution

### Changed
- Improved project structure and cleanliness

## [0.1.2] - 2025-06-12

### Fixed
- Corrected application title from "CCManager Web" to "Claude Code Crew"
- Fixed npm package dependencies for global installation

### Added
- GitHub Sponsors support
- Comprehensive CI/CD with GitHub Actions
- README badges for npm version, downloads, and CI status

## [0.1.1] - 2025-06-12

### Fixed
- npm workspace dependencies for global installation compatibility
- Package.json scripts for production deployment

### Changed
- Simplified package structure for npm distribution

## [0.1.0] - 2025-06-12

### Added
- Initial release
- Web-based terminal interface using xterm.js
- Git worktree management (create, delete, merge)
- Real-time session monitoring
- WebSocket communication for terminal streaming
- Single-port architecture
- Session history preservation when switching worktrees

[0.1.4]: https://github.com/to-na/claude-code-crew/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/to-na/claude-code-crew/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/to-na/claude-code-crew/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/to-na/claude-code-crew/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/to-na/claude-code-crew/releases/tag/v0.1.0