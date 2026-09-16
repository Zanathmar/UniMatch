"""Deterministic, testable Fit Score engine. No LLM.
Every category returns a score (0-100), a confidence label (Verified/Estimated)
and a plain-English explanation that cites the underlying data point."""
from typing import List, Optional

WEIGHTS = {
    "academic": 0.25,
    "budget": 0.20,
    "scholarship": 0.20,
    "requirements": 0.15,
    "program": 0.10,
    "location": 0.05,
    "ranking": 0.05,
}
LABELS = {
    "academic": "Academic Fit",
    "budget": "Budget Fit",
    "scholarship": "Scholarship Opportunity",
    "requirements": "Entry Requirements",
    "program": "Program Match",
    "location": "Location Preference",
    "ranking": "Ranking Quality",
}


def _clamp(v, lo=5, hi=100):
    return max(lo, min(hi, v))


def _norm_gpa(gpa, scale):
    if gpa is None or not scale:
        return None
    return round(gpa / scale * 4.0, 2)


def _vf(field):
    """Safely read a ValuedField-like dict."""
    if not field:
        return None, "Estimated", None
    if isinstance(field, dict):
        return field.get("value"), field.get("status", "Estimated"), field.get("source")
    return getattr(field, "value", None), getattr(field, "status", "Estimated"), getattr(field, "source", None)


# ---------------- Category scorers ----------------
def score_academic(profile, program):
    student_gpa = _norm_gpa(profile.get("gpa"), profile.get("gpa_scale") or 4.0)
    req = program.get("requirements", {}) or {}
    min_gpa_v, min_gpa_status, _ = _vf(req.get("min_gpa"))
    if student_gpa is None:
        return dict(score=60, confidence="Estimated",
                    explanation="Your GPA is not in your profile yet, so academic fit is estimated. Add it for an accurate score.")
    if min_gpa_v is None:
        return dict(score=_clamp(round(65 + (student_gpa - 3.0) * 25)), confidence="Estimated",
                    explanation=f"This program's minimum GPA is not published, so we estimated fit against your GPA of {student_gpa}/4.0.")
    diff = student_gpa - float(min_gpa_v)
    score = _clamp(round(75 + diff * 45))
    conf = "Verified" if min_gpa_status == "Verified" else "Estimated"
    if diff >= 0:
        expl = f"Your GPA {student_gpa}/4.0 meets the stated minimum of {min_gpa_v}/4.0 for this program."
    else:
        expl = f"Your GPA {student_gpa}/4.0 is below the stated minimum of {min_gpa_v}/4.0 — admission may be competitive."
    return dict(score=score, confidence=conf, explanation=expl)


def score_budget(profile, program):
    budget = profile.get("budget_per_year")
    tuition_v, t_status, _ = _vf(program.get("tuition_per_year"))
    living_v, l_status, _ = _vf(program.get("living_cost_per_year"))
    tuition_v = tuition_v or 0
    living_v = living_v or 0
    total = tuition_v + living_v
    if budget is None:
        return dict(score=60, confidence="Estimated",
                    explanation="Your annual budget is not set, so budget fit is estimated. Add it to see if you can afford this program.")
    if total == 0:
        return dict(score=60, confidence="Estimated",
                    explanation="Cost data for this program is unavailable, so budget fit is estimated.")
    ratio = budget / total
    score = _clamp(round(min(ratio, 1.2) * 85))
    conf = "Verified" if (t_status == "Verified" and l_status == "Verified") else "Estimated"
    if ratio >= 1:
        expl = f"Your budget of ${budget:,}/yr covers the estimated total cost of ${total:,}/yr (tuition ${tuition_v:,} + living ${living_v:,})."
    else:
        gap = total - budget
        expl = f"Total cost is ${total:,}/yr (tuition ${tuition_v:,} + living ${living_v:,}); your budget of ${budget:,}/yr leaves a gap of ${gap:,}. Scholarships may close it."
    return dict(score=score, confidence=conf, explanation=expl)


def score_scholarship(profile, program, scholarships):
    eligible = [s for s in scholarships if estimate_eligibility(profile, s)["verdict"] != "Not Eligible"]
    if not scholarships:
        return dict(score=40, confidence="Verified",
                    explanation="No scholarships are linked to this program in our verified data.")
    if not eligible:
        return dict(score=45, confidence="Estimated",
                    explanation=f"{len(scholarships)} scholarship(s) linked, but your current profile does not match their basic criteria.")
    has_full = any(s.get("coverage_type") == "Full" for s in eligible)
    score = 100 if has_full else _clamp(round(65 + len(eligible) * 8))
    names = ", ".join(s["name"] for s in eligible[:2])
    expl = f"You appear eligible for {len(eligible)} scholarship(s) here, including {names}."
    return dict(score=score, confidence="Estimated", explanation=expl)


def score_requirements(profile, program):
    test = profile.get("english_test")
    student_score = profile.get("english_score")
    req = program.get("requirements", {}) or {}
    ielts_v, ielts_status, _ = _vf(req.get("ielts"))
    toefl_v, toefl_status, _ = _vf(req.get("toefl"))
    if not test or test == "None" or student_score is None:
        return dict(score=55, confidence="Estimated",
                    explanation="No English test score in your profile, so requirement fit is estimated. Add IELTS/TOEFL to confirm eligibility.")
    if test == "IELTS" and ielts_v is not None:
        diff = student_score - float(ielts_v)
        score = _clamp(round(80 + diff * 20))
        conf = "Verified" if ielts_status == "Verified" else "Estimated"
        met = "meets" if diff >= 0 else "is below"
        return dict(score=score, confidence=conf,
                    explanation=f"Your IELTS {student_score} {met} the required band {ielts_v}.")
    if test == "TOEFL" and toefl_v is not None:
        diff = student_score - float(toefl_v)
        score = _clamp(round(80 + diff * 1.2))
        conf = "Verified" if toefl_status == "Verified" else "Estimated"
        met = "meets" if diff >= 0 else "is below"
        return dict(score=score, confidence=conf,
                    explanation=f"Your TOEFL {int(student_score)} {met} the required {int(toefl_v)}.")
    return dict(score=60, confidence="Estimated",
                explanation="This program's English requirement is not published in a comparable format; requirement fit is estimated.")


def score_program(profile, program):
    field = profile.get("field_of_study")
    if not field:
        return dict(score=60, confidence="Estimated",
                    explanation="Your field of interest is not set, so program match is estimated.")
    if field == program.get("field"):
        return dict(score=100, confidence="Verified",
                    explanation=f"This program is in {program.get('field')}, which matches your stated interest.")
    return dict(score=55, confidence="Verified",
                explanation=f"This program ({program.get('field')}) differs from your interest ({field}).")


def score_location(profile, university):
    prefs = profile.get("preferred_countries") or []
    if not prefs:
        return dict(score=60, confidence="Estimated",
                    explanation="No preferred countries set, so location fit is estimated.")
    if university.get("country") in prefs:
        return dict(score=100, confidence="Verified",
                    explanation=f"{university.get('country')} is one of your preferred destinations.")
    return dict(score=40, confidence="Verified",
                explanation=f"{university.get('country')} is not in your preferred destinations.")


def score_ranking(university):
    qs = university.get("qs_ranking")
    if qs is None:
        return dict(score=55, confidence="Estimated",
                    explanation="This university is not ranked in QS data we hold; ranking quality is estimated.")
    if qs <= 50:
        s = 100
    elif qs <= 100:
        s = 90
    elif qs <= 200:
        s = 80
    elif qs <= 500:
        s = 68
    else:
        s = 52
    return dict(score=s, confidence="Verified",
                explanation=f"Ranked #{qs} globally in QS, indicating strong academic standing.")


# ---------------- Scholarship eligibility (rule-based) ----------------
def estimate_eligibility(profile, scholarship):
    elig = scholarship.get("eligibility", {}) or {}
    reasons = []
    fails = 0
    checks = 0

    min_gpa = elig.get("min_gpa")
    if min_gpa is not None:
        checks += 1
        student_gpa = _norm_gpa(profile.get("gpa"), profile.get("gpa_scale") or 4.0)
        if student_gpa is None:
            reasons.append(f"Requires GPA ≥ {min_gpa}/4.0 — your GPA is not in your profile.")
        elif student_gpa >= min_gpa:
            reasons.append(f"Your GPA {student_gpa}/4.0 meets the required {min_gpa}/4.0.")
        else:
            fails += 1
            reasons.append(f"Your GPA {student_gpa}/4.0 is below the required {min_gpa}/4.0.")

    min_ielts = elig.get("min_ielts")
    if min_ielts is not None:
        checks += 1
        if profile.get("english_test") == "IELTS" and profile.get("english_score") is not None:
            if profile["english_score"] >= min_ielts:
                reasons.append(f"Your IELTS {profile['english_score']} meets the required {min_ielts}.")
            else:
                fails += 1
                reasons.append(f"Your IELTS {profile['english_score']} is below the required {min_ielts}.")
        else:
            reasons.append(f"Requires IELTS ≥ {min_ielts} — no matching score in your profile.")

    level = scholarship.get("degree_level", "Any")
    if level != "Any":
        checks += 1
        if profile.get("degree_level") == level:
            reasons.append(f"Open to {level} applicants — matches your target.")
        elif profile.get("degree_level"):
            fails += 1
            reasons.append(f"Only for {level} applicants; you target {profile.get('degree_level')}.")
        else:
            reasons.append(f"Open to {level} applicants — set your degree level to confirm.")

    if elig.get("need_based"):
        reasons.append("Need-based: your stated funding need strengthens your case." if profile.get("needs_funding")
                       else "Need-based: primarily for students who need financial support.")

    if fails > 0:
        verdict = "Not Eligible"
    elif checks == 0:
        verdict = "Likely Eligible"
    elif _norm_gpa(profile.get("gpa"), profile.get("gpa_scale") or 4.0) is None:
        verdict = "Possibly Eligible"
    else:
        verdict = "Likely Eligible"
    return {"verdict": verdict, "reasons": reasons}


# ---------------- Top-level compute ----------------
def compute_fit(profile, university, program, scholarships):
    cats = {
        "academic": score_academic(profile, program),
        "budget": score_budget(profile, program),
        "scholarship": score_scholarship(profile, program, scholarships),
        "requirements": score_requirements(profile, program),
        "program": score_program(profile, program),
        "location": score_location(profile, university),
        "ranking": score_ranking(university),
    }
    breakdown = []
    total = 0.0
    estimated_count = 0
    for key, w in WEIGHTS.items():
        c = cats[key]
        total += c["score"] * w
        if c["confidence"] == "Estimated":
            estimated_count += 1
        breakdown.append({
            "key": key, "label": LABELS[key], "weight": round(w * 100),
            "score": c["score"], "confidence": c["confidence"],
            "explanation": c["explanation"],
        })
    fit_score = round(total)
    # Confidence: fraction of weight that is verified
    verified_weight = sum(WEIGHTS[b["key"]] for b in breakdown if b["confidence"] == "Verified")
    confidence_pct = round(verified_weight * 100)
    overall_confidence = "Estimated" if estimated_count > 0 else "Verified"
    return {
        "fit_score": fit_score,
        "overall_confidence": overall_confidence,
        "confidence_pct": confidence_pct,
        "estimated_categories": estimated_count,
        "breakdown": breakdown,
    }
