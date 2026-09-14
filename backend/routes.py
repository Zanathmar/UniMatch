from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user
from db import db
from matching import compute_fit, estimate_eligibility
from models import ProfileUpdate, SaveRequest, SaveUpdate
from models import now_iso

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
async def meta():
    unis = await db.universities.find({}, {"_id": 0, "country": 1, "programs.field": 1}).to_list(500)
    countries = sorted({u["country"] for u in unis})
    fields = sorted({p["field"] for u in unis for p in u.get("programs", [])})
    return {"countries": countries, "fields": fields,
            "degree_levels": ["Bachelor", "Master"]}


# ---------------- Universities ----------------
@router.get("/universities")
async def list_universities(country: Optional[str] = None, field: Optional[str] = None,
                            degree: Optional[str] = None, search: Optional[str] = None,
                            sort: str = "ranking", page: int = 1, page_size: int = 24):
    q: dict = {}
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
    # attach linked scholarships
    sch_slugs = set()
    for p in u.get("programs", []):
        sch_slugs.update(p.get("scholarship_ids", []))
    sch = await db.scholarships.find({"slug": {"$in": list(sch_slugs)}}, {"_id": 0}).to_list(100)
    u["scholarships"] = sch
    return u


# ---------------- Scholarships ----------------
async def _get_program_scholarships(program: dict, degree: str, field: str):
    slugs = program.get("scholarship_ids", [])
    linked = await db.scholarships.find({"slug": {"$in": slugs}}, {"_id": 0}).to_list(100)
    globals_ = await db.scholarships.find(
        {"university_slug": None,
         "$or": [{"degree_level": "Any"}, {"degree_level": degree}],
         "$and": [{"$or": [{"field": "Any"}, {"field": field}]}]},
        {"_id": 0}).to_list(100)
    seen = {s["slug"] for s in linked}
    for g in globals_:
        if g["slug"] not in seen:
            linked.append(g)
    return linked


@router.get("/scholarships")
async def list_scholarships(degree: Optional[str] = None, coverage: Optional[str] = None,
                            search: Optional[str] = None):
    q: dict = {}
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
    docs = await db.scholarships.find({}, {"_id": 0}).to_list(500)
    out = []
    for s in docs:
        est = estimate_eligibility(prof, s)
        out.append({**s, "eligibility_result": est})
    order = {"Likely Eligible": 0, "Possibly Eligible": 1, "Not Eligible": 2}
    out.sort(key=lambda x: order.get(x["eligibility_result"]["verdict"], 3))
    return {"total": len(out), "items": out}


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
        sch = await _get_program_scholarships(p, p["degree"], p["field"])
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
    unis = await db.universities.find(q, {"_id": 0}).to_list(500)
    out = []
    for u in unis:
        top = await _fit_for_university(prof, u)
        if not top:
            continue
        if field and top["program"]["field"] != field:
            # try to find a program in that field
            alt = [p for p in u.get("programs", []) if p["field"] == field]
            if not alt:
                continue
        if top["fit"]["fit_score"] < min_fit:
            continue
        out.append({
            "university": {k: u[k] for k in ("slug", "name", "country", "city", "type",
                                             "qs_ranking", "image_url", "acceptance_rate")},
            "top_program": top["program"],
            "fit": top["fit"],
            "eligible_scholarships": [s for s in top["scholarships"]
                                      if estimate_eligibility(prof, s)["verdict"] != "Not Eligible"],
        })
    if sort == "fit":
        out.sort(key=lambda r: r["fit"]["fit_score"], reverse=True)
    elif sort == "ranking":
        out.sort(key=lambda r: r["university"].get("qs_ranking") or 9999)
    return {"total": len(out), "completeness": _completeness(prof), "items": out}


@router.get("/recommendations/{slug}")
async def recommendation_detail(slug: str, user: dict = Depends(get_current_user)):
    prof = await _get_or_create_profile(user["id"])
    u = await db.universities.find_one({"slug": slug}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="University not found")
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
        u = await db.universities.find_one({"slug": slug}, {"_id": 0})
        if not u:
            continue
        top = await _fit_for_university(prof, u)
        out.append({"university": u, "top_program": top["program"] if top else None,
                    "fit": top["fit"] if top else None,
                    "scholarships": top["scholarships"] if top else []})
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
