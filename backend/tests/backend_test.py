"""UniMatch backend end-to-end pytest suite.

Covers: auth (register/login/me/logout/forgot+reset), profile completeness,
meta, universities (list/filter/sort/detail/404), recommendations
determinism + missing-data confidence, recommendation detail, compare
(2..5 validation), scholarships estimator, saved CRUD + dup guard,
timeline, dashboard.
"""
import os
import time
import uuid

import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def unique_email():
    return f"test_{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture(scope="session")
def registered_user(unique_email):
    r = requests.post(f"{API}/auth/register",
                      json={"email": unique_email, "password": "Test@1234", "name": "Test Student"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data and data["user"]["email"] == unique_email
    return {"email": unique_email, "password": "Test@1234", "token": data["access_token"],
            "user": data["user"]}


@pytest.fixture(scope="session")
def auth_headers(registered_user):
    return {"Authorization": f"Bearer {registered_user['token']}"}


# ---------- Auth ----------
class TestAuth:
    def test_me_with_bearer(self, registered_user, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == registered_user["email"]

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_login(self, registered_user):
        r = requests.post(f"{API}/auth/login",
                          json={"email": registered_user["email"], "password": registered_user["password"]})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_bad_password(self, registered_user):
        r = requests.post(f"{API}/auth/login",
                          json={"email": registered_user["email"], "password": "WRONG!!"})
        assert r.status_code == 401

    def test_logout(self, auth_headers):
        r = requests.post(f"{API}/auth/logout", headers=auth_headers)
        assert r.status_code == 200

    def test_forgot_and_reset_password(self, registered_user):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": registered_user["email"]})
        assert r.status_code == 200
        token = r.json().get("debug_token")
        assert token
        new_pw = "NewPw@1234"
        r2 = requests.post(f"{API}/auth/reset-password", json={"token": token, "password": new_pw})
        assert r2.status_code == 200
        # login with new
        r3 = requests.post(f"{API}/auth/login",
                           json={"email": registered_user["email"], "password": new_pw})
        assert r3.status_code == 200
        # update fixture password so subsequent tests keep passing
        registered_user["password"] = new_pw
        registered_user["token"] = r3.json()["access_token"]


# ---------- Meta ----------
class TestMeta:
    def test_meta(self):
        r = requests.get(f"{API}/meta")
        assert r.status_code == 200
        d = r.json()
        for k in ("countries", "fields", "degree_levels"):
            assert k in d and isinstance(d[k], list) and len(d[k]) > 0
        assert "Bachelor" in d["degree_levels"] and "Master" in d["degree_levels"]


# ---------- Profile ----------
class TestProfile:
    def test_get_profile_autocreates(self, auth_headers):
        r = requests.get(f"{API}/profile", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert "completeness" in d and "percent" in d["completeness"]
        assert d["completeness"]["percent"] < 100

    def test_partial_update_keeps_prior(self, auth_headers):
        r1 = requests.put(f"{API}/profile", headers=auth_headers,
                          json={"full_name": "John Test"})
        assert r1.status_code == 200
        r2 = requests.put(f"{API}/profile", headers=auth_headers,
                          json={"nationality": "IN"})
        assert r2.status_code == 200
        assert r2.json().get("full_name") == "John Test"

    def test_full_update_to_100(self, auth_headers):
        # Get available meta for valid values
        meta = requests.get(f"{API}/meta").json()
        payload = {
            "full_name": "John Test",
            "nationality": "IN",
            "current_country": meta["countries"][0],
            "gpa": 3.6,
            "gpa_scale": 4.0,
            "education_level": "High School",
            "graduation_year": 2025,
            "english_test": "IELTS",
            "english_score": 7.5,
            "field_of_study": meta["fields"][0],
            "degree_level": "Bachelor",
            "preferred_countries": meta["countries"][:2],
            "budget_per_year": 30000,
            "needs_funding": True,
        }
        r = requests.put(f"{API}/profile", headers=auth_headers, json=payload)
        assert r.status_code == 200
        assert r.json()["completeness"]["percent"] == 100


# ---------- Universities ----------
class TestUniversities:
    def test_list(self):
        r = requests.get(f"{API}/universities")
        assert r.status_code == 200
        d = r.json()
        assert d["total"] >= 1 and len(d["items"]) >= 1

    def test_filter_country(self):
        meta = requests.get(f"{API}/meta").json()
        country = meta["countries"][0]
        r = requests.get(f"{API}/universities", params={"country": country})
        assert r.status_code == 200
        for u in r.json()["items"]:
            assert u["country"] == country

    def test_sort_tuition_low(self):
        r = requests.get(f"{API}/universities", params={"sort": "tuition_low"})
        assert r.status_code == 200

    def test_search(self):
        r = requests.get(f"{API}/universities", params={"search": "a"})
        assert r.status_code == 200

    def test_detail_ok(self):
        lst = requests.get(f"{API}/universities").json()["items"]
        slug = lst[0]["slug"]
        r = requests.get(f"{API}/universities/{slug}")
        assert r.status_code == 200
        d = r.json()
        assert d["slug"] == slug and "programs" in d and "scholarships" in d

    def test_detail_404(self):
        r = requests.get(f"{API}/universities/does-not-exist-xyz")
        assert r.status_code == 404


# ---------- Recommendations ----------
class TestRecommendations:
    def test_recommendations_shape_and_sort(self, auth_headers):
        r = requests.get(f"{API}/recommendations", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] >= 1
        scores = [it["fit"]["fit_score"] for it in d["items"]]
        assert scores == sorted(scores, reverse=True)
        first = d["items"][0]
        assert "fit" in first
        f = first["fit"]
        assert "breakdown" in f and len(f["breakdown"]) == 7
        keys = {b["key"] for b in f["breakdown"]}
        assert keys == {"academic", "budget", "scholarship", "requirements",
                        "program", "location", "ranking"}
        weight_sum = sum(b["weight"] for b in f["breakdown"])
        assert weight_sum == 100
        for b in f["breakdown"]:
            assert b["confidence"] in ("Verified", "Estimated")
            assert isinstance(b["explanation"], str) and b["explanation"]
        assert "overall_confidence" in f and "confidence_pct" in f

    def test_determinism(self, auth_headers):
        r1 = requests.get(f"{API}/recommendations", headers=auth_headers).json()
        r2 = requests.get(f"{API}/recommendations", headers=auth_headers).json()
        s1 = [(x["university"]["slug"], x["fit"]["fit_score"]) for x in r1["items"]]
        s2 = [(x["university"]["slug"], x["fit"]["fit_score"]) for x in r2["items"]]
        assert s1 == s2

    def test_missing_data_estimated_confidence(self):
        # Register a fresh user with empty profile
        email = f"empty_{uuid.uuid4().hex[:8]}@example.com"
        rr = requests.post(f"{API}/auth/register",
                           json={"email": email, "password": "Test@1234", "name": "Empty"})
        assert rr.status_code == 200
        tok = rr.json()["access_token"]
        h = {"Authorization": f"Bearer {tok}"}
        r = requests.get(f"{API}/recommendations", headers=h)
        assert r.status_code == 200
        item = r.json()["items"][0]
        by_key = {b["key"]: b for b in item["fit"]["breakdown"]}
        for k in ("academic", "requirements", "budget"):
            assert by_key[k]["confidence"] == "Estimated", f"{k} should be Estimated when profile empty"

    def test_recommendation_detail(self, auth_headers):
        lst = requests.get(f"{API}/universities").json()["items"]
        slug = lst[0]["slug"]
        r = requests.get(f"{API}/recommendations/{slug}", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["university"]["slug"] == slug
        assert isinstance(d["programs"], list) and len(d["programs"]) >= 1
        prog0 = d["programs"][0]
        assert "fit" in prog0 and "scholarships" in prog0 and "program" in prog0


# ---------- Compare ----------
class TestCompare:
    def test_compare_ok(self, auth_headers):
        lst = requests.get(f"{API}/universities").json()["items"]
        slugs = [u["slug"] for u in lst[:3]]
        r = requests.post(f"{API}/compare", headers=auth_headers, json={"slugs": slugs})
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == 3
        for it in items:
            assert "top_program" in it and "fit" in it

    def test_compare_too_few(self, auth_headers):
        r = requests.post(f"{API}/compare", headers=auth_headers, json={"slugs": ["a"]})
        assert r.status_code == 400

    def test_compare_too_many(self, auth_headers):
        lst = requests.get(f"{API}/universities").json()["items"]
        slugs = [u["slug"] for u in lst[:6]]
        r = requests.post(f"{API}/compare", headers=auth_headers, json={"slugs": slugs})
        assert r.status_code == 400


# ---------- Scholarship estimator ----------
class TestScholarshipsEstimate:
    def test_estimate_sorted(self, auth_headers):
        r = requests.get(f"{API}/scholarships/estimate", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) > 0
        order = {"Likely Eligible": 0, "Possibly Eligible": 1, "Not Eligible": 2}
        ranks = [order.get(x["eligibility_result"]["verdict"], 3) for x in items]
        assert ranks == sorted(ranks)
        for it in items:
            assert it["eligibility_result"]["verdict"] in order
            assert isinstance(it["eligibility_result"]["reasons"], list)


# ---------- Saved ----------
class TestSaved:
    saved_id = None
    slug = None

    def test_add(self, auth_headers):
        lst = requests.get(f"{API}/universities").json()["items"]
        TestSaved.slug = lst[0]["slug"]
        r = requests.post(f"{API}/saved", headers=auth_headers,
                          json={"university_slug": TestSaved.slug, "note": "x", "status": "Considering"})
        assert r.status_code == 200
        TestSaved.saved_id = r.json()["id"]

    def test_dup_400(self, auth_headers):
        r = requests.post(f"{API}/saved", headers=auth_headers,
                          json={"university_slug": TestSaved.slug})
        assert r.status_code == 400

    def test_list_with_fit(self, auth_headers):
        r = requests.get(f"{API}/saved", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 1
        assert "university" in items[0] and "fit_score" in items[0]

    def test_patch(self, auth_headers):
        r = requests.patch(f"{API}/saved/{TestSaved.saved_id}", headers=auth_headers,
                           json={"note": "updated", "status": "Applying"})
        assert r.status_code == 200

    def test_delete(self, auth_headers):
        r = requests.delete(f"{API}/saved/{TestSaved.saved_id}", headers=auth_headers)
        assert r.status_code == 200


# ---------- Timeline / Dashboard ----------
class TestTimelineDashboard:
    def test_timeline(self, auth_headers):
        # add one first
        lst = requests.get(f"{API}/universities").json()["items"]
        slug = lst[0]["slug"]
        requests.post(f"{API}/saved", headers=auth_headers, json={"university_slug": slug})
        r = requests.get(f"{API}/timeline", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()["items"]
        # sorted by date
        dates = [e["date"] for e in items]
        assert dates == sorted(dates)
        types = {e["type"] for e in items}
        assert types.issubset({"Application", "Scholarship"})

    def test_dashboard(self, auth_headers):
        r = requests.get(f"{API}/dashboard", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("completeness", "top_matches", "saved_count", "upcoming_deadlines"):
            assert k in d
        assert len(d["top_matches"]) <= 3
