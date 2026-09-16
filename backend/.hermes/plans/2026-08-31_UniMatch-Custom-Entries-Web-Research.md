# UniMatch Enhancement Plan: Custom Entries + Web Research

## Goal
Allow users to:
1. Add **custom universities and scholarships** (not in the curated DB) — private to their own account
2. **Research scholarships on the web** and import results into their saved list
3. Use **any country** during onboarding — no hardcoded allowlist

---

## Context

### Current state
- `University` and `Scholarship` are seeded from `seed.py` (curated, `source="curated"`)
- Countries in onboarding come from `GET /api/meta` which aggregates DB entries
- No way for users to add their own data
- No web search capability

### Design decisions
- **Custom entries are private** — stored in a new `custom_entries` collection, scoped to the user who added them
- **Not shared** — other users never see another user's custom entries
- **Two types of custom data:**
  - `custom_university` — lightweight: name, country, city, type, optional link
  - `custom_scholarship` — can be linked to a curated OR custom university, or standalone (global)
- **Web research** queries **Google Scholarship databases** via SerpAPI (free tier: 100 searches/month)
  - Falls back to scraping known scholarship portal pages if no API key
- **Matching** includes custom entries with lower confidence weighting (`estimated` status)

---

## Step-by-Step Plan

### Step 1 — Update Pydantic models

**File:** `backend/models.py`

Add to `University`:
```python
source: Literal["curated", "custom"] = "curated"
verified: bool = True
added_by_user_id: Optional[str] = None  # null for curated
```

Add to `Scholarship`:
```python
source: Literal["curated", "custom"] = "curated"
verified: bool = True
added_by_user_id: Optional[str] = None
```

Add new schemas:
```python
class CustomUniversityCreate(BaseModel):
    name: str
    country: str
    city: str = ""
    type: str = "Public"
    website: str = ""
    qs_ranking: Optional[int] = None
    description: str = ""

class CustomScholarshipCreate(BaseModel):
    name: str
    provider: str = ""
    university_slug: Optional[str] = None   # link to curated uni, or None for global
    custom_university_name: Optional[str] = None  # if linking to custom uni
    coverage_type: str = "Partial"
    coverage_text: str = ""
    amount_per_year: Optional[int] = None
    degree_level: str = "Any"
    field: str = "Any"
    deadline: Optional[str] = None   # ISO date string
    requirements_text: str = ""
    link: str = ""
```

---

### Step 2 — Create new `custom_entries` collection

**File:** `backend/db.py`
```python
await db.custom_universities.create_index([("user_id", 1), ("slug", 1)], unique=True)
await db.custom_scholarships.create_index([("user_id", 1), ("slug", 1)], unique=True)
```

Schema for `custom_universities`:
```json
{
  "user_id": "string",
  "slug": "string (auto-generated)",
  "name": "string",
  "country": "string",
  "city": "string",
  "type": "Public|Private",
  "website": "string",
  "qs_ranking": "int|null",
  "description": "string",
  "source": "custom",
  "verified": false,
  "created_at": "ISO date"
}
```

Schema for `custom_scholarships`:
```json
{
  "user_id": "string",
  "slug": "string (auto-generated)",
  "name": "string",
  "provider": "string",
  "university_slug": "string|null",
  "custom_university_name": "string|null",
  "coverage_type": "Full|Partial|Stipend",
  "coverage_text": "string",
  "amount_per_year": "int|null",
  "degree_level": "string",
  "field": "string",
  "deadline": "ValuedField (status=Estimated)",
  "requirements_text": "string",
  "link": "string",
  "source": "custom",
  "verified": false,
  "created_at": "ISO date"
}
```

---

### Step 3 — Add research endpoint

**File:** `backend/routes.py`

`GET /api/research/scholarships`

Query params: `country`, `field`, `degree`, `query` (free text)

**Implementation:**
- Use `serpapi` library (pip install `google-search-results`)
- Search query: `"{country} scholarship {field} {degree} 2025 2026 international students`
- Returns raw results from Google — title, snippet, link
- Results are **read-only research** — user can then add one to their custom list via a follow-up POST

If `SERP_API_KEY` env var is not set, return a helpful error message directing user to get a free key.

**Alternative (no API key):**
- Query a known scholarship portal (e.g., `https://www.scholarshipportal.com/scholarships?country={country}`)
- Use `httpx` to fetch and parse scholarship listing pages
- Less reliable but works without an API key

---

### Step 4 — Add custom entry endpoints

**File:** `backend/routes.py`

```
POST /api/custom/universities
  Body: CustomUniversityCreate
  Response: created custom university

GET /api/custom/universities
  List all custom universities for current user

DELETE /api/custom/universities/{slug}
  Remove a custom university

POST /api/custom/scholarships
  Body: CustomScholarshipCreate
  Response: created custom scholarship

GET /api/custom/scholarships
  List all custom scholarships for current user

DELETE /api/custom/scholarships/{slug}
  Remove a custom scholarship
```

**Slug generation:** `custom-{user_id_short}-{name_slugified}-{random4chars}`

---

### Step 5 — Update matching to include custom entries

**File:** `backend/routes.py` — `recommendations` and `scholarships_estimate`

Modify queries to also fetch `custom_universities` and `custom_scholarships` for the current user and merge them into results.

**Key change in `/api/recommendations`:**
```python
# Fetch curated unis
curated_unis = await db.universities.find(q, {"_id": 0}).to_list(500)
# Fetch user's custom unis
custom_unis = await db.custom_universities.find(
    {"user_id": user["id"], **q}, {"_id": 0}).to_list(100)
all_unis = curated_unis + custom_unis
```

Custom entries get `verified=False` — matching engine sees them as `Estimated` confidence.

---

### Step 6 — Update `/api/meta` for dynamic countries

**File:** `backend/routes.py` — `meta` endpoint

```python
@router.get("/meta")
async def meta(user: dict = Depends(get_current_user)):
    # Curated countries
    curated = await db.universities.distinct("country")
    # User's custom countries
    custom = await db.custom_universities.distinct("country", {"user_id": user["id"]})
    countries = sorted(set(curated) | set(custom))
    fields = sorted({p["field"] for u in curated_unis for p in u.get("programs", [])})
    return {"countries": countries, "fields": fields,
            "degree_levels": ["Bachelor", "Master"]}
```

---

### Step 7 — Update onboarding / profile

**File:** `frontend` (separate from backend, noted for coordination)

`preferred_countries` field becomes a free-text array — no enum restriction.
Countries not in DB are stored as-is and passed through to matching.
Meta endpoint returns the union of DB countries + user's custom countries.

---

## Files to Modify

| File | Change |
|---|---|
| `backend/models.py` | Add `source`/`verified`/`added_by_user_id` fields; add `CustomUniversityCreate`, `CustomScholarshipCreate` schemas |
| `backend/db.py` | Add indexes for `custom_universities`, `custom_scholarships` collections |
| `backend/routes.py` | Add research endpoint, custom CRUD endpoints, update meta + recommendations |
| `backend/.env` | Add `SERP_API_KEY=` line (optional) |

## Files to Create

| File | Purpose |
|---|---|
| `backend/research.py` | Web search logic (SerpAPI + fallback scraping) |

## New Dependencies

```
google-search-results  # SerpAPI client
httpx                 # for fallback scraping
```

## Environment Variables

```
SERP_API_KEY=   # optional — get free key at serpapi.com (100 searches/month)
```

If not set, research endpoint returns a clear error with setup instructions.

## Validation & Testing

1. Add a custom university via POST — verify it appears in GET
2. Add a custom scholarship — verify it appears in scholarship matching
3. Run recommendations with custom entries — verify they appear in results
4. Call `/api/meta` before and after adding custom university — verify country appears
5. Call `/api/research/scholarships?country=Germany&field=Computer+Science` — verify results return

## Risks & Tradeoffs

1. **SerpAPI dependency** — if key runs out, research feature degrades gracefully (shows error, custom entry creation still works)
2. **Custom entry quality** — user-added data is unverified; scoring is conservative. Frontend should visually distinguish verified vs custom entries.
3. **No program data on custom universities** — custom unis don't have programs, so matching uses only university-level scoring (no academic/budget fit). Document this limitation.
4. **No pagination on custom entries yet** — fine for MVP (users won't add thousands), add later if needed.
