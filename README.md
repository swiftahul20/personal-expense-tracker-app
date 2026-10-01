# Personal Expense Tracker

It is a Vue 3 expense tracker for recording, filtering, and reviewing personal spending. It supports category and sub-category management, summaries, JWT authentication, preview data, and a responsive light/dark interface.

## Features

- Register and sign in with the REST API
- Automatic access-token refresh with rotating refresh tokens
- Create, edit, and delete expenses
- Category and sub-category management
- Category-dependent sub-category selection when adding an expense
- Search, category, and date-range filters
- Monthly, daily, and category spending summaries
- Responsive layout with light and dark themes
- Preview mode with local sample expenses
- Toast notifications for successful and failed actions

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- A running instance of the Expense Tracker API

The expected API contract is documented in [api-documentation.md](api-documentation.md). The backend must allow the frontend origin through CORS. Vite's default development origin is `http://localhost:5173`.

## Getting Started

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd expense-tracker
npm install
```

Create a local environment file:

```bash
copy .env.example .env.local
```

On macOS or Linux, use:

```bash
cp .env.example .env.local
```

Set the API URL in `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8080
```

`.env.local` is ignored by Git and must never be committed. Use `.env.example` as the safe template for other contributors.

Start the development server:

```bash
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

## Available Scripts

| Command              | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `npm run dev`        | Start the Vite development server                       |
| `npm run build`      | Run Vue TypeScript checks and create a production build |
| `npm run test`       | Run the Vitest test suite once                          |
| `npm run test:watch` | Run Vitest in watch mode                                |
| `npm run preview`    | Preview the production build locally                    |

## API Configuration

The frontend reads one public Vite environment variable:

| Variable            | Description                         | Example                 |
| ------------------- | ----------------------------------- | ----------------------- |
| `VITE_API_BASE_URL` | Base URL of the Expense Tracker API | `http://localhost:8080` |

Use only the API host in this variable. Do not include an endpoint path such as `/auth/login`; the client appends paths itself.

For the current production API, the value format is:

```env
VITE_API_BASE_URL=https://01a0d77e-2ac4-781d-a870-26f4e9a39a72-8080.eur-1.aiven.app
```

The client attaches the access token to protected requests and attempts a refresh after an expired access token. The backend refresh endpoint must return both a new `access_token` and a new `refresh_token` because refresh tokens rotate on every use.

## Reliability Behavior

Category and expense data is cleared when the authenticated user changes or the session expires. The expense form disables category controls while category data is loading. If a new sub-category must be created before an expense can be saved and the expense request fails, the frontend attempts to remove that new sub-category to avoid leaving unused taxonomy data behind.

Toast messages suppress duplicates, keep at most four visible messages, and pause their timeout while hovered. If an access token and its refresh token both fail, the client clears the session and redirects to the login screen.

Expense and taxonomy mutations update the interface immediately and restore the previous state if the API rejects the change. The expense and filter dialogs move focus into the dialog, keep keyboard focus contained while open, and return focus to the triggering control when closed.

## Project Structure

```text
src/
	components/       Reusable UI components, including the expense form and toasts
	data/             Preview-only sample data
	lib/              API client and request/authentication handling
	stores/           Pinia stores for auth, expenses, categories, themes, and toasts
	views/            Login, home, insights, and profile screens
	types.ts          Shared API and domain types
	router.ts         Auth-aware Vue Router configuration
```

## Authentication and Preview Mode

Access and refresh tokens are stored in browser `localStorage` under application-specific keys. Logging out revokes the refresh token when possible and clears local credentials locally even if the API is unavailable.

Preview mode does not call the backend. It uses local sample data and is intended for trying the interface without an account. Preview data is not synchronized with a real account or device.

## Production Build

Build the application with:

```bash
npm run build
```

The generated files are placed in `dist/`. Configure `VITE_API_BASE_URL` in the hosting environment before building. Vite embeds `VITE_*` variables into the client bundle, so never place private keys or server secrets in them.

## Environment Workflow

Use environment files according to the target:

| File                      | Use                               | Commit to Git? |
| ------------------------- | --------------------------------- | -------------- |
| `.env.example`            | Local development template        | Yes            |
| `.env.local`              | Local machine values              | No             |
| `.env.production.example` | Production configuration template | Yes            |
| `.env.production`         | Local production build values     | No             |

For a local production build, copy the production template and set the real API URL:

```bash
copy .env.production.example .env.production
npm run build
```

On macOS or Linux:

```bash
cp .env.production.example .env.production
npm run build
```

For hosted deployments, set `VITE_API_BASE_URL` in the provider's environment settings instead of committing an environment file, then redeploy. Vite injects public `VITE_*` values into the browser bundle, so they must contain URLs and public configuration only.

The backend must also allow the deployed frontend origin in its CORS configuration. A frontend cannot fix a missing backend CORS origin by changing its own environment variable.

## Deployment

The application is a client-side Vue SPA. Build output is generated in `dist/`.

### Vercel

Create a Vercel project from the GitHub repository with:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://your-production-api.example.com`

Deployments are created automatically when the configured branch receives a push. Add the deployed frontend origin to the backend CORS allowlist.

### Netlify

Create a Netlify site from the GitHub repository with:

- Build command: `npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://your-production-api.example.com`

The committed `public/_redirects` file keeps Vue Router routes working after a direct refresh. Add the deployed Netlify origin to the backend CORS allowlist.

## Testing

Run the unit tests with:

```bash
npm run test
```

The current tests cover shared expense filtering and CSV serialization helpers. Preview data is kept in `src/data/demo-data.ts` so it is separate from the Pinia stores and can be reused by tests without importing store logic.

## Backend Documentation

See [api-documentation.md](api-documentation.md) for endpoint paths, request and response shapes, error statuses, pagination, CSV export, summaries, and CORS requirements.

## Versioning and Release Workflow

Release history is tracked in [CHANGELOG.md](CHANGELOG.md). Use one focused commit for each logical update, and keep unfinished work under the `Unreleased` section.

For a normal update:

1. Make one focused change.
2. Add a short entry under `Unreleased` in `CHANGELOG.md`.
3. Run `npm run build`.
4. Commit the change with a descriptive message, such as `feat: add expense pagination` or `fix: reset stores on logout`.
5. Push the commit to GitHub.

For a release:

1. Move the `Unreleased` entries into a new dated version section.
2. Update the `version` field in `package.json`.
3. Run `npm install` if the lockfile needs to reflect the version change.
4. Run `npm run build`.
5. Commit the release, for example `release: v1.1.0`.
6. Create and push a matching Git tag:

```bash
git tag v1.1.0
git push origin v1.1.0
```

Use semantic versioning:

- Patch (`1.0.1`): bug fixes and small safe corrections
- Minor (`1.1.0`): backwards-compatible features
- Major (`2.0.0`): breaking changes

Replace `<owner>/<repository>` in `CHANGELOG.md` with the real GitHub repository path after the repository URL is finalized.

## GitHub Checklist

- Confirm `.env.local` is not staged
- Set `VITE_API_BASE_URL` for the target environment
- Confirm the backend CORS allowlist includes the deployed frontend origin
- Run `npm run build`
- Do not commit API keys, tokens, passwords, or other secrets
