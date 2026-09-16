# UniMatch — Product Requirements Document

## Original Problem Statement
UniMatch is a web app that builds a student profile and recommends genuinely-fit universities and
scholarships with explainable, deterministic (rule-based, NO LLM in MVP) "Fit Scores". MVP focused.
Single user role: Student. Trust rules are non-negotiable: never guarantee admission, every data point
shows a source + Verified/Estimated status, missing student data is scored as Estimated with lowered
confidence (never silently assumed).

## Stack (locked)
- Frontend: React + Tailwind + shadcn/ui. Clean minimal light theme, NO gradients (Linear/Notion feel).
- Backend: FastAPI (Python). Deterministic matching engine.
- DB: MongoDB (universities embed programs/requirements/costs; scholarships referenced by slug).
- Auth: JWT (email + password), Bearer token in localStorage + httpOnly cookie fallback.

## User Personas
- Primary: high-schoolers planning a Bachelor's abroad, unsure what's realistic.
- Secondary (same UI): Master's applicants, parents/counselors browsing.

## Core Requirements (static)
1. Auth: signup/login/logout, password reset, persistent sessions.
2. Profile Builder: 6-step wizard (Personal, Academics, English, Interest, Destinations, Budget), saves partial progress, tracks missing fields.
3. University + Program data with structured requirements/costs/deadlines, each carrying source + Verified/Estimated.
4. Scholarship database (provider, coverage, eligibility, deadline), linked to universities.
5. Matching engine: weighted Fit Score across Academic(25), Budget(20), Scholarship(20), Requirements(15), Program(10), Location(5), Ranking(5). Deterministic; missing data => Estimated + lower confidence.
6. Scholarship eligibility estimator (rule-based verdict + plain-English reasons).
7. "Why This Match?" template-driven breakdown per recommendation.
8. Discovery + filters/sort, university detail pages, side-by-side compare (2–5, mobile tabbed fallback).
9. Saved shortlist with private notes + status (Considering/Applying/Submitted).
10. Personalized timeline from real target deadlines.
11. Dashboard: completeness, top matches, upcoming deadlines, saved count.

## Implemented (2026-06-14)
- Backend: JWT auth (register/login/me/logout/refresh/forgot+reset, bcrypt, brute-force lockout, admin seed).
- Deterministic matching engine (`matching.py`) with 7 weighted categories + Verified/Estimated confidence + explanations. Rule-based scholarship eligibility estimator.
- Curated seed set: ~32 global universities (US, UK, Canada, Switzerland, Germany, Netherlands, Belgium, France, Sweden, Denmark, Finland, Singapore, Hong Kong, Japan, Korea, China, Australia, NZ, Ireland) with programs/requirements/costs/deadlines; ~19 scholarships.
- Endpoints: profile (+completeness), meta, universities (filter/sort/detail), recommendations (+detail), compare, scholarships/estimate, saved CRUD, timeline, dashboard.
- Frontend: Landing, Auth (login/register/forgot/reset), 6-step Profile Wizard, Dashboard, Discover (filters + fit rings + Why-this-match + compare selection), University Detail, Compare matrix (desktop + mobile tabbed), Scholarships (verdict cards), Shortlist (notes + status), Timeline.
- Verified: backend 31/31 pytest pass; frontend full E2E happy path pass. Fixed post-register redirect race (removed render-time PublicOnly redirect; mount-only redirect in auth pages).

## Test Credentials
- Admin: admin@unimatch.app / Admin@123
- Test student: student@test.com / Test@123

## Backlog / Remaining
- P1: Enrich per-university campus imagery (currently 6 images cycled across 32 unis).
- P1: Wizard personal-step save robustness under very fast input (minor).
- P2 (post-MVP): AI Advisor with tool-calling, application tracker + document checklist, community-submitted data + verification workflow, Meilisearch search upgrade, internal-only data editor UI.

## Next Tasks
- Gather user feedback on matching weights and seed depth.
- Consider country-focused deep seed sets if engine needs richer per-country data.
