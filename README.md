## Unolo Field Force Tracker

A web application for tracking field employee check-ins at client locations.  
This project was extended and stabilized by identifying and fixing multiple **authentication, security, database, and frontend reliability issues**.

---

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, React Router
- **Backend:** Node.js, Express.js
- **Database:** SQLite (development)
- **Authentication:** JWT

---

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm run setup    # Installs dependencies and initializes database
cp .env.example .env
npm run dev
```

Backend runs on: `http://localhost:3001`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: `http://localhost:5173`

### Test Credentials

| Role     | Email             | Password    |
| -------- | ----------------- | ----------- |
| Manager  | manager@unolo.com | password123 |
| Employee | rahul@unolo.com   | password123 |
| Employee | priya@unolo.com   | password123 |

## Project Structure

```
├── backend/
│   ├── config/          # Database configuration
│   ├── middleware/      # Auth middleware
│   ├── routes/          # API routes
│   ├── scripts/         # Database init scripts
│   └── server.js        # Express app entry
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components
│   │   ├── context/     # Auth context
│   │   └── utils/       # API helpers & utilities
│   └── index.html
└── database/            # SQL schemas (reference only)
```

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Check-ins

- `GET /api/checkin/clients` - Get assigned clients
- `POST /api/checkin` - Create check-in
- `PUT /api/checkin/checkout` - Checkout
- `GET /api/checkin/history` - Get check-in history
- `GET /api/checkin/active` - Get active check-in

### Dashboard

- `GET /api/dashboard/stats` - Manager stats
- `GET /api/dashboard/employee` - Employee stats

### Daily Summary Report

- `GET /api/reports/daily-summary` - Get daily summary report (including date specific)

## Bug Fixes & Stability Improvements

This project originally contained multiple logic, security, and database issues.  
The following fixes were implemented to make the application reliable, secure, and production-ready.

### Authentication & Security

- Fixed password validation bug caused by missing `await` in `bcrypt.compare`
- Removed password hash from JWT payload (critical security issue)
- Corrected JWT handling so invalid credentials no longer force page reloads
- Standardized HTTP status codes (`400`, `401`, `409`) across auth and check-in APIs
- Prevented SQL injection in history filters using parameterized queries

### Authorization & Data Integrity

- Replaced hard-coded user ID checks with role-based authorization
- Ensured managers and employees always hit the correct dashboard endpoints
- Fixed authorization mismatches between frontend and backend

### Database & SQL Issues

- Replaced MySQL-specific functions (`NOW()`, `DATE_SUB`) with SQLite-compatible syntax
- Fixed incorrect string literal usage in SQLite queries
- Corrected date filtering logic for accurate reporting
- Stabilized dashboard queries that previously crashed under SQLite

### Frontend Reliability

- Prevented form reloads during check-in submission
- Fixed attendance history crashes caused by null state handling
- Corrected UTC-to-local time rendering across dashboard and history views
- Added defensive reducers to handle incomplete data safely

### Performance Improvements

- Reduced unnecessary re-renders using memoization
- Stabilized derived calculations (total hours, summaries)
- Moved authentication state to context to prevent cascading re-renders

## Architecture Decisions & Future Optimization

### Key Architecture Decisions Made

- **Database-first correctness**
  - Core business rules (such as preventing invalid check-ins and enforcing access control) are handled at the database and API layer instead of relying on frontend checks.
  - This ensures correctness even under concurrency, retries, or malformed requests.

- **Clear separation of responsibilities**
  - Authentication (JWT validation) and authorization (role-based access using middleware) are explicitly separated.
  - Reporting logic is isolated into dedicated routes instead of being mixed with check-in logic.

- **Consistent and predictable API contracts**
  - APIs return a stable response shape even when there is no data (for example, daily reports with zero check-ins).
  - This avoids frontend conditionals and reduces UI edge-case bugs.

- **Security-first fixes**
  - Sensitive data is never exposed in JWT payloads.
  - All user input affecting SQL queries is parameterized to prevent injection.
  - HTTP status codes correctly reflect error semantics (`400`, `401`, `409`).

- **SQLite retained intentionally**
  - SQLite is kept for development simplicity and ease of setup.
  - All fixes were implemented in a way that remains compatible with SQLite while avoiding MySQL-specific syntax.

---

### Future Optimization Opportunities

- **Database migration to PostgreSQL**
  - While existing indexes already cover common access patterns, SQLite’s single-writer limitation makes it unsuitable for high-concurrency workloads.
  - Migrating to PostgreSQL would enable:
    - Concurrent writes
    - Row-level locking
    - Safer handling of peak check-in traffic

- **Database-level constraints**
  - Introduce partial unique constraints (in PostgreSQL) to enforce rules like “one active check-in per employee” directly in the database.
  - This eliminates race conditions without relying on application timing.

- **Background aggregation for reports**
  - Daily summaries can be precomputed using scheduled jobs instead of being calculated on every request.
  - This reduces query load as data volume grows.

- **Offline-first check-in support**
  - Mobile clients can queue check-ins locally when offline and sync later.
  - Store both client timestamps and server receipt times for auditability and correctness.

- **Caching for read-heavy endpoints**
  - Manager dashboards and daily reports can be cached per date and manager.
  - Cache invalidation can occur only when new check-ins are recorded.

---

These decisions prioritize **correctness, security, and long-term scalability**, while keeping the current implementation simple and developer-friendly.

#### The system is now resistant to:

- Invalid logins
- Data leaks
- Race conditions
- Incorrect dashboard access
- Broken time calculations
