# UniMatch

Find universities and scholarships that actually fit your profile.

A full-stack university and scholarship matching platform — FastAPI backend, React frontend, MongoDB.

---

## Architecture

```
frontend/          React 19 (CRA + Tailwind CSS)
backend/           FastAPI + Motor (async MongoDB driver)
database/          MongoDB (you provide the instance)
```

**Stack:** FastAPI · React 19 · Tailwind CSS · MongoDB · SerpAPI (optional)

---

## Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.10+ (for backend)
- **MongoDB** 6+ — local install or Atlas cloud cluster

---

## Quick Start

### 1. Clone & go in

```bash
cd UniMatch
```

### 2. Start MongoDB

**Option A — Local install** (e.g. via Homebrew on macOS):

```bash
brew services start mongodb-community
```

**Option B — Docker:**

```bash
docker run -d \
  --name unimatch-mongo \
  -p 27017:27017 \
  -v unimatch-db:/data/db \
  mongo:7
```

**Option C — MongoDB Atlas** (cloud, free tier):

Create a cluster at [cloud.mongodb.com](https://cloud.mongodb.com) and note your connection string.

---

### 3. Backend setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate   # on Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — set MONGO_URL to your MongoDB connection string
```

**`.env.example`** (copy to `.env` and fill in):

```env
# ── Database ────────────────────────────────────────────────
# Local:        mongodb://localhost:27017
# Atlas:        mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/unimatch
MONGO_URL=mongodb://localhost:27017

# ── Authentication ───────────────────────────────────────────
# Secret key for JWT tokens (min 32 chars, random string)
SECRET_KEY=change-me-to-a-random-secret-key-here

# ── Admin Seed ──────────────────────────────────────────────
# Password set for the seeded admin account
ADMIN_PASSWORD=Admin@123

# ── CORS ────────────────────────────────────────────────────
# Comma-separated list of allowed origins, or * for all
CORS_ORIGINS=*

# ── SerpAPI (optional) ───────────────────────────────────────
# Only needed if using the web research feature
SERP_API_KEY=
```

**Run the server:**

```bash
uvicorn server:app --reload --port 8001 --host 127.0.0.1
```

The API will be at `http://localhost:8001`. On first startup it will:
- Create MongoDB indexes
- Seed the admin account (`admin@unimatch.local` / `Admin@123`)
- Seed university and scholarship data

---

### 4. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local — set REACT_APP_BACKEND_URL if your backend isn't on localhost:8001
```

**`.env.example`** (copy to `.env.local`):

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

**Run in development:**

```bash
BROWSER=none npm start
```

Frontend will be at `http://localhost:3000`.

---

### 5. Production build

```bash
cd frontend

# Set production backend URL
echo "REACT_APP_BACKEND_URL=https://your-api-domain.com" > .env.production

BROWSER=none npm run build
```

The production build outputs to `frontend/build/` as a static site — deploy to Vercel, Netlify, Cloudflare Pages, or any static host.

---

## Database Collections

| Collection | Description |
|---|---|
| `users` | User accounts |
| `profiles` | Student profile data (GPA, budget, preferred countries, etc.) |
| `universities` | University documents (curated seed data + custom per-user entries) |
| `scholarships` | Scholarship documents (curated seed data + custom per-user entries) |
| `saved` | User's saved/shortlisted universities |
| `password_reset_tokens` | Password reset tokens (TTL index, auto-expire) |
| `login_attempts` | Rate-limiting login attempts |

**University-Scholarship linking:** Stored bidirectionally — `scholarship_slugs` on the university document and `linked_university_slugs` on the scholarship document. These are kept in sync by the `_link_scholarship_to_university` / `_unlink_scholarship_from_university` helpers in `routes.py`.

---

## API Overview

Base URL: `http://localhost:8001/api`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Sign in (returns JWT) |
| `POST` | `/auth/forgot-password` | Request password reset |
| `POST` | `/auth/reset-password` | Reset with token |
| `GET` | `/universities` | List universities |
| `GET` | `/universities/:slug` | University detail + programs |
| `GET` | `/scholarships` | List scholarships |
| `GET` | `/recommendations/:slug` | Fit scores for a university |
| `GET` | `/saved` | User's shortlist |
| `POST` | `/saved` | Add to shortlist |
| `DELETE` | `/saved/:slug` | Remove from shortlist |
| `GET` | `/profile` | Get current user profile |
| `PUT` | `/profile` | Update profile |
| `GET` | `/meta` | Static options (countries, fields, degree levels) |
| `POST` | `/research` | SerpAPI web research (requires `SERP_API_KEY`) |

---

## Project Structure

```
backend/
├── server.py          FastAPI app + startup/shutdown
├── db.py              Motor MongoDB client
├── auth.py            Auth router (login, register, JWT, password reset)
├── routes.py          All API route handlers
├── models.py          Pydantic request/response models
├── matching.py        Fit score calculation logic
├── seed.py            University + scholarship seed data
├── research.py        SerpAPI web research client
├── db.py
├── .env               Local env vars (gitignored)
├── .env.example       Template for .env
└── requirements.txt

frontend/
├── src/
│   ├── pages/         Page components (Landing, Dashboard, UniversityDetail…)
│   ├── components/     Shared UI components (Layout, FitScoreRing, WhyThisMatch…)
│   ├── context/       React context (AuthContext, CompareContext)
│   ├── lib/api.js     Axios instance + interceptors
│   └── constants/     Static config (test IDs, etc.)
├── public/
│   ├── index.html     HTML template
│   └── assets/        Static assets (logo, images)
├── build/             Production build output (gitignored)
├── .env.local         Local frontend env vars (gitignored)
└── .env.example       Template for .env.local
```

---

## Environment Variables Summary

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGO_URL` | Yes | — | MongoDB connection string |
| `SECRET_KEY` | Yes | — | JWT signing secret (min 32 chars) |
| `ADMIN_PASSWORD` | No | `Admin@123` | Seeded admin password |
| `CORS_ORIGINS` | No | `*` | Comma-separated allowed origins |
| `SERP_API_KEY` | No | — | For web research feature |
| `REACT_APP_BACKEND_URL` | Yes (prod) | `http://localhost:8001` | Backend API URL |

---

## Development Notes

**Backend port:** `8001` — configured in `server.py` via `uvicorn` CLI args.

**Frontend proxy:** The CRA dev server proxies `/api` to `http://localhost:8001` via `setupProxy.js` or Vite proxy config — no CORS issues in dev.

**Seed data:** `seed.py` populates 32 universities and 19 scholarships on every startup (idempotent). Custom universities/scholarships are stored in the same collections with a `user_id` field.

**Testing:**
```bash
# Backend tests
cd backend && pytest -n auto

# Frontend (dev only)
cd frontend && BROWSER=none npm start
```

---

## Deploying to Production

### Backend
Recommended: **Railway**, **Render**, or **Fly.io**.

1. Push backend to a Git repo
2. Connect to Railway/Render — set build command to `pip install -r requirements.txt` and start command to `uvicorn server:app --host 0.0.0.0 --port $PORT`
3. Set all required environment variables (`MONGO_URL`, `SECRET_KEY`, `CORS_ORIGINS`, etc.)
4. Use MongoDB Atlas (cloud) for the database in production

### Frontend
Recommended: **Vercel** or **Cloudflare Pages**.

1. Set `REACT_APP_BACKEND_URL` to your deployed backend URL
2. Run `npm run build` locally (or let Vercel do it via build command `npm run build` and output dir `build`)
3. Deploy

**CORS note:** Set `CORS_ORIGINS` on the backend to your frontend's deployed domain (e.g. `https://unimatch.vercel.app`).
