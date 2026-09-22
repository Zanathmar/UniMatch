from typing import List, Optional
import hashlib, re, os

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from auth import get_current_user
from db import db
from matching import compute_fit, estimate_eligibility
from models import (
    ProfileUpdate, SaveRequest, SaveUpdate, now_iso,
    CustomUniversityCreate, CustomUniversityResponse,
    CustomScholarshipCreate, CustomScholarshipResponse,
    CustomProgramCreate,
    ResearchResult, UserSettingsUpdate, UserSettingsResponse,
)
from research import search_scholarships, get_limits, _is_global_key_configured

router = APIRouter(prefix="/api", tags=["core"])

PROFILE_STEPS = {
    "personal": ["full_name", "nationality", "current_country"],
    "academics": ["gpa", "education_level", "graduation_year"],
    "english": ["english_test", "english_score"],
    "interest": ["field_of_study", "degree_level"],
    "destinations": ["preferred_countries"],
    "budget": ["budget_per_year"],
}


# ---------------- Profile ----------------
async def _get_or_create_profile(user_id: str) -> dict:
    prof = await db.profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not prof:
        prof = {"user_id": user_id, "gpa_scale": 4.0, "preferred_countries": [],
                "needs_funding": False, "completed_steps": [], "updated_at": now_iso()}
        await db.profiles.insert_one(dict(prof))
        prof = await db.profiles.find_one({"user_id": user_id}, {"_id": 0})
    return prof


def _completeness(prof: dict):
    missing = {}
    done_steps = []
    total = 0
    filled = 0
    for step, fields in PROFILE_STEPS.items():
        step_missing = []
        for f in fields:
            total += 1
            v = prof.get(f)
            if v is None or v == "" or (isinstance(v, list) and len(v) == 0):
                step_missing.append(f)
            else:
                filled += 1
        if step_missing:
            missing[step] = step_missing
        else:
            done_steps.append(step)
    pct = round(filled / total * 100) if total else 0
    return {"percent": pct, "missing_by_step": missing, "completed_steps": done_steps,
            "missing_fields": [f for fs in missing.values() for f in fs]}


@router.get("/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    prof = await _get_or_create_profile(user["id"])
    prof["completeness"] = _completeness(prof)
    return prof


@router.put("/profile")
async def update_profile(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    await _get_or_create_profile(user["id"])
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    update["updated_at"] = now_iso()
    await db.profiles.update_one({"user_id": user["id"]}, {"$set": update})
    prof = await db.profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    prof["completeness"] = _completeness(prof)
    return prof


# ---------------- Meta ----------------
@router.get("/meta")
async def meta(user: dict = Depends(get_current_user)):
    curated_unis = await db.universities.find({}, {"_id": 0, "country": 1, "programs.field": 1}).to_list(500)
    curated_countries = sorted({u["country"] for u in curated_unis})
    # User's custom countries (from their own entries)
    custom_unis = await db.custom_universities.find(
        {"user_id": user["id"]}, {"_id": 0, "country": 1}).to_list(500)
    custom_countries = sorted({u["country"] for u in custom_unis})
    # User's manually-added custom countries (from settings)
    from bson import ObjectId
    db_user = await db.users.find_one({"_id": ObjectId(user["id"])}, {"custom_countries": 1})
    settings_countries = db_user.get("custom_countries", []) if db_user else []
    # User's preferred_countries from their profile
    profile = await db.profiles.find_one({"user_id": user["id"]}, {"preferred_countries": 1})
    profile_countries = profile.get("preferred_countries", []) if profile else []
    # Merge all: curated + custom university countries + user settings countries + profile countries
    all_countries = sorted(set(curated_countries) | set(custom_countries) | set(settings_countries) | set(profile_countries))
    fields = sorted({p["field"] for u in curated_unis for p in u.get("programs", [])})
    return {"countries": all_countries, "fields": fields,
            "degree_levels": ["Bachelor", "Master"]}


# ---------------- Universities ----------------
@router.get("/universities")
async def list_universities(country: Optional[str] = None, field: Optional[str] = None,
                            degree: Optional[str] = None, search: Optional[str] = None,
                            sort: str = "ranking", page: int = 1, page_size: int = 24):
    q: dict = {"source": "curated"}   # only curated/seed universities in public listing
    if country:
        q["country"] = country
    if search:
        q["name"] = {"$regex": search, "$options": "i"}
    if field or degree:
        elem: dict = {}
        if field:
            elem["field"] = field
        if degree:
            elem["degree"] = degree
        q["programs"] = {"$elemMatch": elem}
    docs = await db.universities.find(q, {"_id": 0}).to_list(500)
    if sort == "ranking":
        docs.sort(key=lambda d: d.get("qs_ranking") or 9999)
    elif sort == "name":
        docs.sort(key=lambda d: d["name"])
    elif sort == "tuition_low":
        docs.sort(key=lambda d: min([(p["tuition_per_year"].get("value") or 0) for p in d.get("programs", [])] or [0]))
    total = len(docs)
    start = (page - 1) * page_size
    return {"total": total, "page": page, "page_size": page_size,
            "items": docs[start:start + page_size]}


@router.get("/universities/{slug}")
async def get_university(slug: str):
    u = await db.universities.find_one({"slug": slug}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="University not found")
    # attach linked scholarships via scholarship_slugs (top-level canonical store)
    sch_slugs = u.get("scholarship_slugs", [])
    # Also collect any scholarship_ids from programs not already in scholarship_slugs
    for p in u.get("programs", []):
        for s in p.get("scholarship_ids", []):
            if s not in sch_slugs:
                sch_slugs.append(s)
    sch = await db.scholarships.find({"slug": {"$in": sch_slugs}}, {"_id": 0}).to_list(100)
    u["scholarships"] = sch
    return u


# ---------------- Scholarships ----------------
async def _get_program_scholarships(program: dict, degree: str, field: str, university: dict):
    slugs = program.get("scholarship_ids", [])
    linked = await db.scholarships.find({"slug": {"$in": slugs}}, {"_id": 0}).to_list(100)

    # Only include TRULY global scholarships — those with no university affiliation at all.
    # A scholarship is global only when BOTH:
    #   - linked_university_slugs is absent OR empty (not linked to specific unis via country scholarships)
    #   - university_slug is absent OR null (not a university-specific scholarship)
    # Scholarships with university_slug set (mit-need, harv-need, etc.) are excluded from global results.
    globals_ = await db.scholarships.find(
        {"$and": [
            # Must have no specific university links
            {"$or": [
                {"linked_university_slugs": {"$exists": False}},
                {"linked_university_slugs": {"$size": 0}},
            ]},
            # Must not be tied to a specific university
            {"$or": [
                {"university_slug": {"$exists": False}},
                {"university_slug": None},
            ]},
            # Degree match
            {"$or": [{"degree_level": "Any"}, {"degree_level": degree}]},
            # Field match
            {"$or": [{"field": "Any"}, {"field": field}]},
            # Country match — must be "Any" (explicitly country-agnostic) or match the university's country.
            # Missing/blank country fails CLOSED (excluded) rather than leaking as a silent wildcard.
            {"$or": [{"country": "Any"}, {"country": university.get("country")}]},
        ]},
        {"_id": 0}).to_list(100)
    seen = {s["slug"] for s in linked}
    for g in globals_:
        if g["slug"] not in seen:
            linked.append(g)

    return linked


@router.get("/scholarships")
async def list_scholarships(degree: Optional[str] = None, coverage: Optional[str] = None,
                            search: Optional[str] = None,
                            user_id: Optional[str] = None):
    q: dict = {}
    # If user_id is passed, return only that user's custom entries; otherwise return curated
    if user_id is not None:
        q["user_id"] = user_id
    else:
        q["source"] = "curated"
    if degree:
        q["degree_level"] = {"$in": ["Any", degree]}
    if coverage:
        q["coverage_type"] = coverage
    if search:
        q["name"] = {"$regex": search, "$options": "i"}
    docs = await db.scholarships.find(q, {"_id": 0}).to_list(500)
    return {"total": len(docs), "items": docs}


@router.get("/scholarships/estimate")
async def scholarships_estimate(user: dict = Depends(get_current_user)):
    prof = await _get_or_create_profile(user["id"])
    # Curated scholarships only for eligibility estimation
    docs = await db.scholarships.find({"source": "curated"}, {"_id": 0}).to_list(500)
    out = []
    for s in docs:
        est = estimate_eligibility(prof, s)
        out.append({**s, "eligibility_result": est})
    order = {"Likely Eligible": 0, "Possibly Eligible": 1, "Not Eligible": 2}
    out.sort(key=lambda x: order.get(x["eligibility_result"]["verdict"], 3))
    return {"total": len(out), "items": out}


# ---------------- Custom University Helpers ----------------
def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[-\s]+", "-", text)
    return text[:60]


async def _link_scholarship_to_university(university_slug: str, scholarship_slug: str, degree_level: str, user_id: str):
    """Add a scholarship slug to a university's program(s) scholarship_ids and scholarship_slugs,
    and update the scholarship's linked_university_slugs."""
    u = await db.universities.find_one({"slug": university_slug}, {"_id": 0, "programs": 1, "scholarship_slugs": 1})
    if not u or not u.get("programs"):
        return

    # Normalize degree for matching: "Bachelor's" == "Bachelor", "Master's" == "Master"
    def norm_deg(d):
        return d.replace("'s", "").strip() if d else ""

    # Find programs matching degree level (Bachelor/Master → normalized match, Any → first program)
    norm_sch_deg = norm_deg(degree_level)
    matching_programs = [p for p in u["programs"]
                         if norm_deg(p.get("degree", "")) == norm_sch_deg
                         or degree_level == "Any"]
    if not matching_programs:
        matching_programs = u["programs"][:1]  # fallback to first program

    for prog in matching_programs:
        existing = prog.get("scholarship_ids", [])
        if scholarship_slug not in existing:
            existing.append(scholarship_slug)
        db.universities.update_one(
            {"slug": university_slug, "programs.name": prog.get("name")},
            {"$set": {"programs.$.scholarship_ids": existing}}
        )

    # Maintain scholarship_slugs on the university (top-level canonical store)
    current_slugs = u.get("scholarship_slugs", [])
    if scholarship_slug not in current_slugs:
        db.universities.update_one(
            {"slug": university_slug},
            {"$push": {"scholarship_slugs": scholarship_slug}}
        )

    # Maintain linked_university_slugs on the scholarship
    sch = await db.scholarships.find_one({"slug": scholarship_slug}, {"_id": 0, "linked_university_slugs": 1})
    if sch:
        linked = sch.get("linked_university_slugs", [])
        if university_slug not in linked:
            db.scholarships.update_one(
                {"slug": scholarship_slug},
                {"$push": {"linked_university_slugs": university_slug}}
            )


async def _unlink_scholarship_from_university(university_slug: str, scholarship_slug: str, degree_level: str):
    """Remove a scholarship slug from a university's program(s) scholarship_ids and scholarship_slugs,
    and update the scholarship's linked_university_slugs."""
    u = await db.universities.find_one({"slug": university_slug}, {"_id": 0, "programs": 1, "scholarship_slugs": 1})
    if not u or not u.get("programs"):
        return

    def norm_deg(d):
        return d.replace("'s", "").strip() if d else ""

    norm_sch_deg = norm_deg(degree_level)
    matching_programs = [p for p in u["programs"]
                         if norm_deg(p.get("degree", "")) == norm_sch_deg
                         or degree_level == "Any"]
    if not matching_programs:
        matching_programs = u["programs"]

    for prog in matching_programs:
        existing = prog.get("scholarship_ids", [])
        if scholarship_slug in existing:
            existing.remove(scholarship_slug)
            db.universities.update_one(
                {"slug": university_slug, "programs.name": prog.get("name")},
                {"$set": {"programs.$.scholarship_ids": existing}}
            )

    # Remove from scholarship_slugs on the university
    current_slugs = u.get("scholarship_slugs", [])
    if scholarship_slug in current_slugs:
        db.universities.update_one(
            {"slug": university_slug},
            {"$pull": {"scholarship_slugs": scholarship_slug}}
        )

    # Remove from linked_university_slugs on the scholarship
    db.scholarships.update_one(
        {"slug": scholarship_slug},
        {"$pull": {"linked_university_slugs": university_slug}}
    )


def _generate_custom_slug(user_id: str, name: str) -> str:
    """Generate a unique slug for a custom entry."""
    raw = f"{user_id}-{_slugify(name)}"
    short_hash = hashlib.md5(raw.encode()).hexdigest()[:6]
    return f"custom-{_slugify(name)}-{short_hash}"


async def _fit_for_custom_university(prof: dict, university: dict, want_all_programs=False) -> dict | List[dict]:
    """Fit score for custom universities.
    Uses full program-level scoring when programs exist; falls back to lightweight
    university-level scoring (location + ranking) for universities without programs.
    Returns a single dict when want_all_programs=False and programs exist,
    or a list of {program, fit, scholarships} dicts when want_all_programs=True."""
    programs = university.get("programs", [])

    # No programs — lightweight university-level scoring only
    if not programs:
        from matching import score_location, score_ranking
        cats = {
            "location": score_location(prof, university),
            "ranking": score_ranking(university),
        }
        adjusted_weights = {"location": 0.40, "ranking": 0.60}
        total = sum(cats[k]["score"] * adjusted_weights[k] for k in adjusted_weights)
        breakdown = []
        for key in ["location", "ranking"]:
            breakdown.append({
                "key": key, "label": key.replace("_", " ").title(), "weight": round(adjusted_weights[key] * 100),
                "score": cats[key]["score"], "confidence": cats[key]["confidence"],
                "explanation": cats[key]["explanation"],
            })
        return {
            "fit_score": round(total),
            "overall_confidence": "Estimated",
            "confidence_pct": 30,
            "estimated_categories": 2,
            "breakdown": breakdown,
            "note": "Custom university — program-level scoring unavailable",
        }

    # Has programs — use full program-level scoring, same as curated universities
    results = []
    for p in programs:
        sch = await _get_program_scholarships(p, p["degree"], p["field"], university)
        fit = compute_fit(prof, university, p, sch)
        results.append({"program": p, "fit": fit, "scholarships": sch})

    results.sort(key=lambda r: r["fit"]["fit_score"], reverse=True)

    if want_all_programs:
        return results

    # Return just the fit dict (not the wrapper) so the shape is consistent
    # with the no-programs path
    return results[0]["fit"]


# ---------------- Recommendations / Matching ----------------
def _best_program(prof: dict, university: dict):
    degree = prof.get("degree_level")
    programs = university.get("programs", [])
    candidates = [p for p in programs if (not degree or p["degree"] == degree)] or programs
    return candidates


async def _fit_for_university(prof: dict, university: dict, want_all_programs=False):
    programs = _best_program(prof, university)
    results = []
    for p in programs:
        sch = await _get_program_scholarships(p, p["degree"], p["field"], university)
        fit = compute_fit(prof, university, p, sch)
        results.append({"program": p, "fit": fit, "scholarships": sch})
    results.sort(key=lambda r: r["fit"]["fit_score"], reverse=True)
    if not results:
        return None
    if want_all_programs:
        return results
    return results[0]


@router.get("/recommendations")
async def recommendations(user: dict = Depends(get_current_user),
                          country: Optional[str] = None, field: Optional[str] = None,
                          min_fit: int = 0, sort: str = "fit"):
    prof = await _get_or_create_profile(user["id"])
    q: dict = {}
    if country:
        q["country"] = country
    # Curated universities
    curated_unis = await db.universities.find(q, {"_id": 0}).to_list(500)
    # User's custom universities
    custom_q = {"user_id": user["id"]}
    if country:
        custom_q["country"] = country
    custom_unis = await db.custom_universities.find(custom_q, {"_id": 0}).to_list(100)
    out = []
    for u in curated_unis:
        top = await _fit_for_university(prof, u)
        if not top:
            continue
        if field and top["program"]["field"] != field:
            alt = [p for p in u.get("programs", []) if p["field"] == field]
            if not alt:
                continue
        if top["fit"]["fit_score"] < min_fit:
            continue
        out.append({
            "university": {**({k: u.get(k) for k in ("slug", "name", "country", "city", "type",
                                                     "qs_ranking", "image_url", "acceptance_rate",
                                                     "verified")}), "source": "curated"},
            "top_program": top["program"],
            "fit": top["fit"],
            "eligible_scholarships": [s for s in top["scholarships"]
                                      if estimate_eligibility(prof, s)["verdict"] != "Not Eligible"],
        })
    # Custom universities — full program scoring when programs exist
    for u in custom_unis:
        has_programs = bool(u.get("programs"))
        if has_programs:
            all_results = await _fit_for_custom_university(prof, u, want_all_programs=True)
            if not all_results:
                continue
            top_result = all_results[0]
            if top_result["fit"]["fit_score"] < min_fit:
                continue
            out.append({
                "university": {k: u.get(k) for k in ("slug", "name", "country", "city", "type",
                                                         "qs_ranking", "image_url", "website", "source", "verified")},
                "top_program": top_result["program"],
                "fit": top_result["fit"],
                "eligible_scholarships": [],
            })
        else:
            fit = await _fit_for_custom_university(prof, u)
            if fit["fit_score"] < min_fit:
                continue
            out.append({
                "university": {k: u.get(k) for k in ("slug", "name", "country", "city", "type",
                                                         "qs_ranking", "image_url", "website", "source", "verified")},
                "top_program": None,
                "fit": fit,
                "eligible_scholarships": [],
            })
    if sort == "fit":
        out.sort(key=lambda r: r["fit"]["fit_score"], reverse=True)
    elif sort == "ranking":
        out.sort(key=lambda r: r["university"].get("qs_ranking") or 9999)
    return {"total": len(out), "completeness": _completeness(prof), "items": out}


@router.get("/recommendations/{slug}")
async def recommendation_detail(slug: str, user: dict = Depends(get_current_user)):
    prof = await _get_or_create_profile(user["id"])
    # Check curated universities first
    u = await db.universities.find_one({"slug": slug}, {"_id": 0})
    is_custom = False
    if not u:
        # Check user's custom universities
        u = await db.custom_universities.find_one({"slug": slug, "user_id": user["id"]}, {"_id": 0})
        is_custom = True
    if not u:
        raise HTTPException(status_code=404, detail="University not found")
    if is_custom:
        result = await _fit_for_custom_university(prof, u, want_all_programs=True)
        if isinstance(result, list):
            programs_out = result
            fit = result[0]["fit"] if result else await _fit_for_custom_university(prof, u)
        else:
            # no programs — lightweight scoring
            programs_out = []
            fit = result
        return {"university": u, "programs": programs_out, "fit": fit,
                "completeness": _completeness(prof)}
    programs = await _fit_for_university(prof, u, want_all_programs=True)
    return {"university": u, "programs": programs or [], "completeness": _completeness(prof)}


@router.post("/compare")
async def compare(payload: dict, user: dict = Depends(get_current_user)):
    slugs: List[str] = payload.get("slugs", [])
    if not (2 <= len(slugs) <= 5):
        raise HTTPException(status_code=400, detail="Select between 2 and 5 universities to compare")
    prof = await _get_or_create_profile(user["id"])
    out = []
    for slug in slugs:
        # Check curated universities first
        u = await db.universities.find_one({"slug": slug}, {"_id": 0})
        if u:
            top = await _fit_for_university(prof, u)
            u_with_source = dict(u, source="curated")
            out.append({"university": u_with_source, "top_program": top["program"] if top else None,
                        "fit": top["fit"] if top else None,
                        "scholarships": top["scholarships"] if top else []})
            continue
        # Check user's custom universities
        cu = await db.custom_universities.find_one({"slug": slug, "user_id": user["id"]}, {"_id": 0})
        if cu:
            fit = await _fit_for_custom_university(prof, cu)
            top_program = None
            # If custom university has programs, attach the top-scoring one
            if cu.get("programs"):
                all_programs = await _fit_for_custom_university(prof, cu, want_all_programs=True)
                if all_programs:
                    top_program = all_programs[0]["program"]
                    fit = all_programs[0]["fit"]
            out.append({"university": cu, "top_program": top_program,
                        "fit": fit, "scholarships": []})
    return {"items": out}


# ---------------- Saved ----------------
@router.get("/saved")
async def list_saved(user: dict = Depends(get_current_user)):
    prof = await _get_or_create_profile(user["id"])
    docs = await db.saved.find({"user_id": user["id"]}).to_list(200)
    out = []
    for d in docs:
        d["id"] = str(d.pop("_id"))
        u = await db.universities.find_one({"slug": d["university_slug"]}, {"_id": 0})
        if u:
            top = await _fit_for_university(prof, u)
            d["university"] = {k: u[k] for k in ("slug", "name", "country", "city",
                                                 "qs_ranking", "image_url")}
            d["fit_score"] = top["fit"]["fit_score"] if top else None
        out.append(d)
    return {"items": out}


@router.post("/saved")
async def add_saved(body: SaveRequest, user: dict = Depends(get_current_user)):
    exists = await db.saved.find_one({"user_id": user["id"], "university_slug": body.university_slug})
    if exists:
        raise HTTPException(status_code=400, detail="Already in your shortlist")
    doc = {"user_id": user["id"], "university_slug": body.university_slug,
           "note": body.note, "status": body.status, "created_at": now_iso()}
    res = await db.saved.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc


@router.patch("/saved/{saved_id}")
async def update_saved(saved_id: str, body: SaveUpdate, user: dict = Depends(get_current_user)):
    from bson import ObjectId
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    await db.saved.update_one({"_id": ObjectId(saved_id), "user_id": user["id"]}, {"$set": update})
    return {"message": "Updated"}


@router.delete("/saved/{saved_id}")
async def delete_saved(saved_id: str, user: dict = Depends(get_current_user)):
    from bson import ObjectId
    await db.saved.delete_one({"_id": ObjectId(saved_id), "user_id": user["id"]})
    return {"message": "Removed"}


# ---------------- Timeline ----------------
@router.get("/timeline")
async def timeline(user: dict = Depends(get_current_user)):
    prof = await _get_or_create_profile(user["id"])
    saved = await db.saved.find({"user_id": user["id"]}).to_list(200)
    events = []
    for s in saved:
        u = await db.universities.find_one({"slug": s["university_slug"]}, {"_id": 0})
        if not u:
            continue
        for p in _best_program(prof, u):
            dl = p.get("application_deadline", {})
            if dl.get("value"):
                events.append({"type": "Application", "date": dl["value"],
                               "title": f"{u['name']} — {p['name']}", "university_slug": u["slug"],
                               "status": dl.get("status", "Estimated"), "source": dl.get("source")})
            for sslug in p.get("scholarship_ids", []):
                sc = await db.scholarships.find_one({"slug": sslug}, {"_id": 0})
                if sc and sc.get("deadline", {}).get("value"):
                    events.append({"type": "Scholarship", "date": sc["deadline"]["value"],
                                   "title": f"{sc['name']} ({u['name']})",
                                   "university_slug": u["slug"],
                                   "status": sc["deadline"].get("status", "Estimated"),
                                   "source": sc["deadline"].get("source")})
    # dedupe
    seen = set()
    uniq = []
    for e in events:
        key = (e["type"], e["title"], e["date"])
        if key not in seen:
            seen.add(key)
            uniq.append(e)
    uniq.sort(key=lambda e: e["date"])
    return {"items": uniq}


# ====================== CUSTOM USER ENTRIES ======================

def _val(value, status="Estimated", source=None):
    return {"value": value, "status": status, "source": source, "note": None}


def _custom_program_to_program(cp: CustomProgramCreate) -> dict:
    """Convert a CustomProgramCreate input into the stored Program dict format.
    Matches the Program model schema so existing matching/scoring code works unchanged."""
    import uuid
    return {
        "id": str(uuid.uuid4())[:8],
        "name": cp.name,
        "degree": cp.degree,
        "field": cp.field or "General",
        "duration_years": cp.duration_years,
        "language": cp.language,
        "tuition_per_year": _val(cp.tuition_per_year, "Estimated", "User-added"),
        "living_cost_per_year": _val(cp.living_cost_per_year, "Estimated", "User-added"),
        "intake": cp.intake,
        "application_deadline": _val(cp.application_deadline, "Estimated", "User-added"),
        "requirements": {
            "min_gpa": _val(cp.min_gpa, "Estimated", "User-added") if cp.min_gpa is not None else None,
            "ielts": _val(cp.ielts, "Estimated", "User-added") if cp.ielts is not None else None,
            "toefl": _val(cp.toefl, "Estimated", "User-added") if cp.toefl is not None else None,
            "other": cp.other,
        },
        "scholarship_ids": [],
    }


# ---- Custom Universities (stored in main universities collection) ----

@router.get("/custom/universities")
async def list_custom_universities(user: dict = Depends(get_current_user)):
    docs = await db.universities.find(
        {"user_id": user["id"]}, {"_id": 0}).to_list(500)
    for d in docs:
        d["id"] = str(d.pop("_id")) if "_id" in d else d.get("id")
    return {"items": docs}


@router.post("/custom/universities")
async def create_custom_university(body: CustomUniversityCreate, user: dict = Depends(get_current_user)):
    slug = _generate_custom_slug(user["id"], body.name)
    programs = [_custom_program_to_program(p) for p in body.programs]
    doc = {
        **body.model_dump(exclude={"programs"}),
        "programs": programs,
        "slug": slug,
        "source": "custom",
        "verified": False,
        "added_by_user_id": user["id"],
        "user_id": user["id"],
        "created_at": now_iso(),
    }
    await db.universities.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/custom/universities/{slug}")
async def update_custom_university(slug: str, body: CustomUniversityCreate, user: dict = Depends(get_current_user)):
    existing = await db.universities.find_one({"slug": slug, "user_id": user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="University not found")
    programs = [_custom_program_to_program(p) for p in body.programs]
    update = body.model_dump(exclude={"programs"})
    update["programs"] = programs
    update["slug"] = slug
    update["user_id"] = user["id"]
    await db.universities.replace_one({"slug": slug}, update)
    update.pop("_id", None)
    return update


@router.delete("/custom/universities/{slug}")
async def delete_custom_university(slug: str, user: dict = Depends(get_current_user)):
    result = await db.universities.delete_one({"slug": slug, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custom university not found")
    return {"message": "Deleted"}


# ---- Custom University Programs ----

@router.post("/custom/universities/{slug}/programs")
async def add_custom_program(slug: str, body: CustomProgramCreate, user: dict = Depends(get_current_user)):
    """Add a program to an existing custom university."""
    uni = await db.universities.find_one({"slug": slug, "user_id": user["id"]})
    if not uni:
        raise HTTPException(status_code=404, detail="Custom university not found")
    program = _custom_program_to_program(body)
    await db.universities.update_one(
        {"slug": slug}, {"$push": {"programs": program}}
    )
    return {"message": "Program added", "program": program}


@router.delete("/custom/universities/{slug}/programs/{program_id}")
async def remove_custom_program(slug: str, program_id: str, user: dict = Depends(get_current_user)):
    """Remove a program from a custom university by its id."""
    uni = await db.universities.find_one({"slug": slug, "user_id": user["id"]})
    if not uni:
        raise HTTPException(status_code=404, detail="Custom university not found")
    result = await db.universities.update_one(
        {"slug": slug}, {"$pull": {"programs": {"id": program_id}}}
    )
    return {"message": "Program removed"}


# ---- Custom Scholarships (stored in main scholarships collection) ----

@router.get("/custom/scholarships")
async def list_custom_scholarships(user: dict = Depends(get_current_user)):
    docs = await db.scholarships.find(
        {"user_id": user["id"]}, {"_id": 0}).to_list(500)
    for d in docs:
        d["id"] = str(d.pop("_id")) if "_id" in d else d.get("id")
    return {"items": docs}


@router.get("/custom/scholarships/estimate")
async def estimate_custom_scholarships(user: dict = Depends(get_current_user)):
    """Return custom scholarships with real eligibility estimation, matching /scholarships/estimate format."""
    prof = await _get_or_create_profile(user["id"])
    docs = await db.scholarships.find(
        {"user_id": user["id"]}, {"_id": 0}).to_list(500)
    out = []
    for s in docs:
        est = estimate_eligibility(prof, s)
        out.append({**s, "eligibility_result": est})
    order = {"Likely Eligible": 0, "Possibly Eligible": 1, "Not Eligible": 2}
    out.sort(key=lambda x: order.get(x["eligibility_result"]["verdict"], 3))
    return {"total": len(out), "items": out}


@router.post("/custom/scholarships")
async def create_custom_scholarship(body: CustomScholarshipCreate, user: dict = Depends(get_current_user)):
    slug = _generate_custom_slug(user["id"], body.name)
    deadline = body.deadline
    # Build structured eligibility object (same shape as curated scholarships)
    eligibility = {}
    if body.min_gpa is not None:
        eligibility["min_gpa"] = body.min_gpa
    if body.min_ielts is not None:
        eligibility["min_ielts"] = body.min_ielts
    if body.min_toefl is not None:
        eligibility["min_toefl"] = body.min_toefl
    if body.need_based:
        eligibility["need_based"] = True
    if body.merit_based:
        eligibility["merit_based"] = True
    if body.citizenship:
        eligibility["citizenship"] = body.citizenship

    # university_slugs stores the list of linked university slugs for custom scholarships
    linked_slugs = body.university_slug or []
    doc = {
        "name": body.name,
        "provider": body.provider,
        "university_slug": None,           # singular field kept for backwards compat (always None for custom)
        "university_slugs": linked_slugs,  # list of linked university slugs
        "custom_university_name": body.custom_university_name,
        "coverage_type": body.coverage_type,
        "coverage_text": body.coverage_text,
        "amount_per_year": body.amount_per_year,
        "degree_level": body.degree_level,
        "field": body.field,
        "deadline": _val(deadline, "Estimated", "User-added") if deadline else _val(None),
        "requirements_text": body.requirements_text,
        "link": body.link,
        "eligibility": eligibility,
        "slug": slug,
        "source": "custom",
        "verified": body.verified,
        "added_by_user_id": user["id"],
        "user_id": user["id"],
        "created_at": now_iso(),
    }
    await db.scholarships.insert_one(doc)

    # If verified and linked to universities, add this scholarship to each university's programs
    if body.verified and linked_slugs:
        for us in linked_slugs:
            await _link_scholarship_to_university(us, slug, body.degree_level, user["id"])

    doc.pop("_id", None)
    return doc


@router.delete("/custom/scholarships/{slug}")
async def delete_custom_scholarship(slug: str, user: dict = Depends(get_current_user)):
    result = await db.scholarships.delete_one({"slug": slug, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custom scholarship not found")
    return {"message": "Deleted"}


@router.put("/custom/scholarships/{slug}")
async def update_custom_scholarship(slug: str, body: CustomScholarshipCreate, user: dict = Depends(get_current_user)):
    existing = await db.scholarships.find_one({"slug": slug, "user_id": user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Scholarship not found")

    update = body.model_dump()
    update["slug"] = slug
    update["user_id"] = user["id"]
    update["source"] = "custom"
    # university_slug stays None for custom; university_slugs holds the list
    update["university_slug"] = None
    update["university_slugs"] = body.university_slug or []
    # Store deadline as ValuedField (same as create)
    deadline_str = body.deadline
    if isinstance(deadline_str, dict):
        deadline_str = deadline_str.get("value") if deadline_str.get("value") else None
    update["deadline"] = _val(deadline_str, "Estimated", "User-added") if deadline_str else _val(None)
    # Rebuild structured eligibility object (same logic as create)
    eligibility = {}
    if body.min_gpa is not None:
        eligibility["min_gpa"] = body.min_gpa
    if body.min_ielts is not None:
        eligibility["min_ielts"] = body.min_ielts
    if body.min_toefl is not None:
        eligibility["min_toefl"] = body.min_toefl
    if body.need_based:
        eligibility["need_based"] = True
    if body.merit_based:
        eligibility["merit_based"] = True
    if body.citizenship:
        eligibility["citizenship"] = body.citizenship
    update["eligibility"] = eligibility
    await db.scholarships.replace_one({"slug": slug}, update)

    # ---- Handle university linking on update ----
    old_slugs = set(existing.get("linked_university_slugs") or existing.get("university_slugs") or [])
    new_slugs = set(body.university_slug or [])
    removed = old_slugs - new_slugs
    added = new_slugs - old_slugs

    if existing.get("verified", False):
        for us in removed:
            await _unlink_scholarship_from_university(us, slug, existing.get("degree_level", "Any"))
        for us in added:
            if body.verified:
                await _link_scholarship_to_university(us, slug, body.degree_level, user["id"])

    # Handle verified toggle
    was_verified = existing.get("verified", False)
    if body.verified and not was_verified and new_slugs:
        for us in new_slugs:
            await _link_scholarship_to_university(us, slug, body.degree_level, user["id"])
    elif not body.verified and was_verified:
        for us in old_slugs:
            await _unlink_scholarship_from_university(us, slug, existing.get("degree_level", "Any"))

    # Re-link if verified and universities didn't change (ensure correctness)
    if body.verified and new_slugs and not removed and not added and was_verified:
        for us in new_slugs:
            await _link_scholarship_to_university(us, slug, body.degree_level, user["id"])

    update.pop("_id", None)
    return update
    return {"message": "Deleted"}


# ====================== USER SETTINGS ======================
@router.get("/settings", response_model=UserSettingsResponse)
async def get_settings(user: dict = Depends(get_current_user)):
    """Get current user's settings including API key status."""
    from bson import ObjectId
    db_user = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    serp_key = db_user.get("serp_api_key") or ""
    has_key = bool(serp_key and serp_key.strip())
    masked = None
    if has_key:
        raw_key = serp_key.strip()
        if len(raw_key) > 10:
            masked = f"{raw_key[:5]}•••••{raw_key[-4:]}"
        else:
            masked = "••••••••"

    return UserSettingsResponse(
        serp_api_key_set=has_key,
        serp_api_key_masked=masked,
        searches_used_today=db_user.get("searches_used_today", 0),
        searches_limit=db_user.get("searches_limit", 100),
        global_key_set=_is_global_key_configured(),
        custom_countries=db_user.get("custom_countries", []),
    )


@router.put("/settings")
async def update_settings(
    settings: UserSettingsUpdate,
    user: dict = Depends(get_current_user),
):
    """Update user settings. Pass serp_api_key to set your own key, or "" to clear it."""
    update = {}

    if settings.serp_api_key is not None:
        key = settings.serp_api_key.strip()
        if key == "":
            update["serp_api_key"] = None
            # Also reset their daily searches when they change the key
            update["searches_used_today"] = 0
        else:
            update["serp_api_key"] = key

    if settings.custom_countries is not None:
        update["custom_countries"] = [
            c.strip() for c in settings.custom_countries if c.strip()
        ]

    if update:
        from bson import ObjectId
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": update})

    return {"ok": True}

@router.get("/settings/", response_model=UserSettingsResponse, include_in_schema=False)
async def get_settings_slash(user: dict = Depends(get_current_user)):
    return await get_settings(user)

@router.put("/settings/", include_in_schema=False)
async def update_settings_slash(settings: UserSettingsUpdate, user: dict = Depends(get_current_user)):
    return await update_settings(settings, user)


# # ====================== WEB RESEARCH ======================

# @router.get("/research/limits")
# async def research_limits(user: dict = Depends(get_current_user)):
#     """Return the calling user's own search limits and API key status."""
#     from bson import ObjectId
#     db_user = await db.users.find_one({"_id": ObjectId(user["id"])})
#     searches_used = db_user.get("searches_used_today", 0) if db_user else 0
#     searches_limit = db_user.get("searches_limit", 100) if db_user else 100
#     user_api_key = (db_user.get("serp_api_key") or "") if db_user else ""
#     return get_limits(
#         searches_used=searches_used,
#         searches_limit=searches_limit,
#         user_api_key=user_api_key.strip() or None,
#     )


# @router.get("/research/scholarships")
# async def research_scholarships(
#     country: str = Query(..., min_length=1),
#     field: str = Query(default="Any"),
#     degree: str = Query(default="Any"),
#     query: str = Query(default=None),
#     num: int = Query(default=10, ge=1, le=50),
#     user: dict = Depends(get_current_user),
# ):
#     """Search the web for scholarships. Uses the user's own API key if set,
#     otherwise the global SERP_API_KEY env var. Falls back to scholarshipportal.com
#     scraping when no API key is configured."""
#     from models import User
#     from bson import ObjectId
#     db_user = await db.users.find_one({"_id": ObjectId(user["id"])})
#     user_api_key = (db_user.get("serp_api_key") or "").strip() if db_user else ""
#     searches_used = db_user.get("searches_used_today", 0) if db_user else 0
#     searches_limit = db_user.get("searches_limit", 100) if db_user else 100

#     results, limits = search_scholarships(
#         country=country,
#         field=field,
#         degree=degree,
#         query=query,
#         num_results=num,
#         user_api_key=user_api_key or None,
#         searches_used=searches_used,
#         searches_limit=searches_limit,
#     )

#     # Increment per-user search count if a real API key was used (not the fallback)
#     if limits.api_key_source in ("user", "global"):
#         new_used = searches_used + 1
#         await db.users.update_one(
#             {"_id": ObjectId(user["id"])},
#             {"$set": {"searches_used_today": new_used}},
#         )
#         limits = get_limits(
#             searches_used=new_used,
#             searches_limit=searches_limit,
#             user_api_key=user_api_key or None,
#         )

#     global_key_ok = _is_global_key_configured()
#     setup_needed = not user_api_key and not global_key_ok

#     return {
#         "results": [r.model_dump() for r in results],
#         "limits": limits.model_dump(),
#         "setup_needed": setup_needed,
#         "using_user_key": bool(user_api_key),
#     }
# ---------------- Dashboard ----------------
@router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    prof = await _get_or_create_profile(user["id"])
    comp = _completeness(prof)
    # top matches (limit 3)
    unis = await db.universities.find({}, {"_id": 0}).to_list(500)
    matches = []
    for u in unis:
        top = await _fit_for_university(prof, u)
        if top:
            matches.append({
                "university": {k: u[k] for k in ("slug", "name", "country", "city",
                                                 "qs_ranking", "image_url")},
                "top_program": top["program"],
                "fit": top["fit"],
            })
    matches.sort(key=lambda r: r["fit"]["fit_score"], reverse=True)
    saved = await db.saved.find({"user_id": user["id"]}).to_list(200)
    tl = await timeline(user)
    from datetime import date
    today = date.today().isoformat()
    upcoming = [e for e in tl["items"] if e["date"] >= today][:5]
    return {
        "completeness": comp,
        "top_matches": matches[:3],
        "saved_count": len(saved),
        "upcoming_deadlines": upcoming,
        "profile": prof,
    }
