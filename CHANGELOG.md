# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

Changes planned for the next release go here.

### Added

- Loading and disabled states for category controls in the expense form
- Vitest unit-test scripts and coverage for expense filtering and CSV serialization
- Duplicate-suppressed, capped toast notifications with pause-on-hover behavior
- Focus management for expense and filter dialogs
- Production environment template and static-host SPA routing fallback

### Changed

- Expense save now compensates for a newly-created sub-category when the expense request fails
- Moved preview sample expenses into `src/data/demo-data.ts`
- Centralized API error parsing and expired-session redirects
- Optimistic expense, category, and sub-category mutations with rollback on failure
- Added Vercel and Netlify deployment guidance

### Fixed

### Removed

## [1.0.0] - 2026-10-01

### Added

- Vue 3 and TypeScript expense tracker frontend
- JWT login, registration, refresh, logout, and current-user flows
- Expense creation, editing, deletion, filtering, pagination, and CSV export
- Category and sub-category management
- Category, month, and day spending summaries
- Dashboard API integration
- Category-dependent sub-category selection
- Automatic token refresh with rotating refresh-token support
- Preview mode with local sample expenses
- Light and dark themes
- Toast notifications for successful and failed actions
- GitHub-safe environment and README documentation

[Unreleased]: https://github.com/<owner>/<repository>/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/<owner>/<repository>/releases/tag/v1.0.0
