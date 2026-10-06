# Expense Tracker API — Reference Documentation

A REST API for tracking personal expenses with category/sub-category management, built in Go (chi router, PostgreSQL via pgx). This document is a complete reference for building a client against this API.

## Base URL

Replace `<BASE_URL>` with the actual deployed URL or `http://localhost:8080` for local development.

## Authentication

Most endpoints require a JWT access token sent as a Bearer token:

```
Authorization: Bearer <access_token>
```

Tokens are obtained via `/auth/login` or `/auth/register`, and renewed via `/auth/refresh`. Access tokens are short-lived (1 hour by default); refresh tokens are long-lived (7 days by default) and **rotate on every use** — each successful call to `/auth/refresh` invalidates the refresh token that was used and returns a brand new one, which the client must store and use for the next refresh.

## Error Response Shape

All errors follow this shape:

```json
{ "error": "human-readable message" }
```

There are currently no machine-readable error codes — clients must rely on the HTTP status code for branching logic:

| Status | Meaning |
|--------|---------|
| 400 | Validation error / malformed request body |
| 401 | Missing, invalid, or expired auth token; invalid login credentials |
| 404 | Resource not found (or not owned by the authenticated user) |
| 409 | Conflict (e.g. duplicate email on register, duplicate category name) |
| 429 | Rate limited (login endpoint only) |
| 500 | Server error |

---

## Auth Endpoints

### `POST /auth/register`
No auth required.

**Request body:**
```json
{ "email": "user@example.com", "password": "password123" }
```
Password must be at least 8 characters.

**Response `201`:**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "user": { "id": 1, "email": "user@example.com", "created_at": "2026-09-27T00:00:00Z" }
}
```

**Errors:** `400` (validation), `409` (email already registered)

---

### `POST /auth/login`
No auth required. Rate-limited: 5 attempts per 15 minutes per IP.

**Request body:**
```json
{ "email": "user@example.com", "password": "password123" }
```

**Response `200`:** same shape as register.

**Errors:** `401` (invalid email or password — the same message is returned for both cases, to avoid revealing which emails are registered), `429` (rate limited)

---

### `POST /auth/refresh`
No auth required (the refresh token itself is the credential).

**Request body:**
```json
{ "refresh_token": "..." }
```

**Response `200`:**
```json
{ "access_token": "...", "refresh_token": "..." }
```
Note: the returned `refresh_token` is a **new** token — the one sent in the request is now invalid and cannot be reused.

**Errors:** `401` (invalid or expired refresh token)

---

### `POST /auth/logout`
No auth header required, but the refresh token itself must be valid.

**Request body:**
```json
{ "refresh_token": "..." }
```

**Response `204`** (no body). Revokes the refresh token server-side. Note: any already-issued access token remains technically valid until its natural expiry (there is no access-token blocklist) — logout only guarantees the refresh token can no longer be used to mint new access tokens.

---

### `GET /auth/me`
**Requires auth.**

**Response `200`:**
```json
{ "id": 1, "email": "user@example.com", "created_at": "2026-09-27T00:00:00Z" }
```

---

## Category Endpoints

All require auth. Categories and sub-categories are scoped per-user — each user only sees and manages their own.

### `GET /categories`
Returns all of the user's categories, each with its nested sub-categories.

**Response `200`:**
```json
[
  {
    "id": 1,
    "name": "Food",
    "sub_categories": [
      { "id": 1, "category_id": 1, "name": "Dine-in" },
      { "id": 2, "category_id": 1, "name": "Groceries" }
    ]
  },
  {
    "id": 2,
    "name": "Transport",
    "sub_categories": []
  }
]
```

---

### `POST /categories`
**Request body:**
```json
{ "name": "Food" }
```

**Response `201`:**
```json
{ "id": 1, "name": "Food", "sub_categories": [] }
```

**Errors:** `400` (empty name or duplicate name for this user)

---

### `PUT /categories/{id}`
Renames a category.

**Request body:**
```json
{ "name": "Food & Drink" }
```

**Response `200`:** the updated category object (without nested sub-categories in this response — only `GET /categories` returns the nested shape).

**Errors:** `400` (empty/duplicate name), `404` (not found or not owned by user)

---

### `DELETE /categories/{id}`
Deletes a category **and its sub-categories**. Any expenses referencing this category (or its sub-categories) have their `category_id`/`sub_category_id` set to `null` — expense records are preserved, not deleted.

**Response `204`** (no body).

**Errors:** `404`

---

### `POST /categories/{id}/sub-categories`
Creates a sub-category under the given parent category.

**Request body:**
```json
{ "name": "Dine-in" }
```

**Response `201`:**
```json
{ "id": 1, "category_id": 1, "name": "Dine-in" }
```

**Errors:** `400` (empty/duplicate name, or parent category doesn't exist/isn't owned by user)

---

### `PUT /sub-categories/{id}`
Renames a sub-category.

**Request body:**
```json
{ "name": "Restaurant" }
```

**Response `200`:**
```json
{ "id": 1, "category_id": 1, "name": "Restaurant" }
```

**Errors:** `400`, `404`

---

### `DELETE /sub-categories/{id}`
Any expenses referencing this sub-category have `sub_category_id` set to `null`.

**Response `204`** (no body).

**Errors:** `404`

---

## Expense Endpoints

All require auth. Expenses are scoped per-user.

### Expense object shape

```json
{
  "id": 1,
  "amount": 50000,
  "category_id": 1,
  "category_name": "Food",
  "sub_category_id": 1,
  "sub_category_name": "Dine-in",
  "description": "Lunch at Solaria",
  "date": "2026-09-27T00:00:00Z"
}
```

Notes:
- `category_id`/`sub_category_id` are nullable integers (`sub_category_id` is always optional; `category_id` can become `null` if the category it pointed to was later deleted — expenses are never deleted as a side effect of category deletion).
- `category_name`/`sub_category_name` are server-populated (joined from the categories table) and are **omitted from the JSON entirely** when there's no category/sub-category set (standard `omitempty` behavior) — don't assume they're always present as keys.
- `amount` is a plain JSON number (stored as `NUMERIC(12,2)` server-side).
- `date` is an ISO 8601 timestamp string.

---

### `POST /expenses/scan-receipt`
Accepts one receipt image and returns a suggestion for the user to review. The result is **not saved**; use `POST /expenses` after the user confirms the details.

**Request:** `multipart/form-data` with the image in the `image` field.

**Response `200`:**
```json
{
  "amount": 56000,
  "category_id": 1,
  "category_name": "Food",
  "sub_category_id": 1,
  "sub_category_name": "Dine-in",
  "description": "Solaria - Nasi Goreng Spesial",
  "date": "2026-09-27",
  "confidence_note": "optional free-text note if extraction was uncertain"
}
```

Category and sub-category IDs/names may be `null` when no existing category is a suitable match. Errors use the standard `{ "error": "..." }` response shape, including when the file is not a valid receipt image or the extracted response cannot be parsed.

### `GET /expenses`
Paginated list, with optional filters.

**Query parameters (all optional):**
| Param | Type | Notes |
|-------|------|-------|
| `page` | int | Default 1 |
| `limit` | int | Default 20, max 100 |
| `category_id` | int | Filter to a single category |
| `search` | string | Case-insensitive substring match against `description` |
| `from` | string | `YYYY-MM-DD`, inclusive start of date range |
| `to` | string | `YYYY-MM-DD`, inclusive end of date range (end-of-day) |

**Response `200`:**
```json
{
  "expenses": [ /* array of expense objects */ ],
  "page": 1,
  "limit": 20,
  "total": 47,
  "total_pages": 3
}
```
`total`/`total_pages` reflect the filtered count, not the user's total expense count.

---

### `POST /expenses`
**Request body:**
```json
{
  "amount": 50000,
  "category_id": 1,
  "sub_category_id": 1,
  "description": "Lunch",
  "date": "2026-09-27T00:00:00Z"
}
```
`category_id` is **required** (must be a valid category ID owned by the user). `sub_category_id` and `description` are optional. `amount` must be greater than 0. `date` cannot be more than 24 hours in the future.

**Response `201`:** the created expense object (with `category_name`/`sub_category_name` populated).

**Errors:** `400` (validation failure, or `category_id`/`sub_category_id` doesn't exist/isn't owned by the user — surfaces as a foreign key violation wrapped in a generic error message)

---

### `GET /expenses/{id}`
**Response `200`:** a single expense object.

**Errors:** `404`

---

### `PUT /expenses/{id}`
Partial update — only send the fields being changed.

**Request body (all fields optional):**
```json
{
  "amount": 55000,
  "category_id": 2,
  "sub_category_id": null,
  "description": "Updated description"
}
```

**Response `200`:** the updated expense object.

**Errors:** `400` (validation, or invalid category/sub-category reference)

**Known limitation:** there is currently no way to explicitly clear `category_id` back to null via this endpoint while leaving other fields untouched — omitting the field means "don't change it," not "set it to null." Since `category_id` is required on create, this is rarely an issue in practice, but worth knowing if a client needs a "remove category from this expense" action.

---

### `DELETE /expenses/{id}`
**Response `204`** (no body).

**Errors:** `404`

---

### `GET /expenses/export`
Downloads a CSV file of the user's expenses. Accepts the same filter query parameters as `GET /expenses` (`category_id`, `search`, `from`, `to`) — no pagination params, since export always returns every matching row.

**Response `200`:** `Content-Type: text/csv`, `Content-Disposition: attachment; filename=expenses.csv`. CSV columns: `ID, Amount, Category, Sub-Category, Description, Date`.

---

## Summary Endpoints

All require auth. Each groups the user's **entire** expense history (not paginated) by a time/category dimension.

### `GET /summary/category`
**Response `200`:**
```json
[
  {
    "category": "Food",
    "total": 150000,
    "expenses": [ /* array of expense objects in this category */ ]
  }
]
```
Expenses with no category are grouped under `"category": "Uncategorized"`. Sorted by `total` descending.

### `GET /summary/month`
Same shape, with `"month"` (format `YYYY-MM`) instead of `"category"`. Sorted by month ascending.

### `GET /summary/day`
Same shape, with `"day"` (format `YYYY-MM-DD`) instead of `"category"`. Sorted by day ascending.

### `GET /dashboard`
Combines everything above into one response:
```json
{
  "expenses": [ /* full expense list, unpaginated */ ],
  "by_category": [ /* same shape as /summary/category */ ],
  "by_month": [ /* same shape as /summary/month */ ],
  "by_day": [ /* same shape as /summary/day */ ]
}
```

---

## Other Endpoints

### `GET /health`
No auth required.

**Response `200`:**
```json
{ "status": "healthy", "database": "connected" }
```

**Response `503`** (if the database is unreachable):
```json
{ "status": "unhealthy", "database": "unreachable" }
```

### `GET /swagger/index.html`
Interactive Swagger/OpenAPI UI, generated from code annotations. Useful for exploring and manually testing the live API.

---

## CORS

The API has CORS configured to allow specific origins (currently `http://localhost:5173` for local frontend development). A new frontend origin must be explicitly added to the server's CORS configuration before browser-based requests from that origin will succeed — this is a backend code change, not something a client can work around.

## Database Schema Reference

For context on the underlying data model (not part of the API surface, but useful for understanding constraints):

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    UNIQUE(user_id, name)
);

CREATE TABLE sub_categories (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    UNIQUE(category_id, name)
);

CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    amount NUMERIC(12, 2) NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    sub_category_id INTEGER REFERENCES sub_categories(id) ON DELETE SET NULL,
    description TEXT,
    date TIMESTAMPTZ NOT NULL
);

CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
