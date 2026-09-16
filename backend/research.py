"""Web research for scholarships via SerpAPI (Google). Fallback: scholarshipportal.com."""
import os
import logging
from datetime import datetime, timezone
from typing import List, Optional

from models import ResearchResult, ResearchLimits

logger = logging.getLogger("unimatch.research")

_DAILY_LIMIT = 100


def _mask_key(key: str) -> str:
    """Show first 3 and last 4 chars of a SerpAPI key, e.g. sk_•••••_3f2a."""
    if not key or len(key) < 10:
        return "••••••••"
    return f"{key[:5]}•••••{key[-4:]}"


def _is_global_key_configured() -> bool:
    return bool(os.environ.get("SERP_API_KEY", "").strip())


def _reset_if_new_day(last_reset: str) -> bool:
    """Return True if the daily reset has passed (midnight UTC)."""
    if not last_reset:
        return True
    try:
        reset_dt = datetime.fromisoformat(last_reset.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        return now.date() > reset_dt.date()
    except Exception:
        return True


def search_scholarships(
    country: str,
    field: str = "Any",
    degree: str = "Any",
    query: Optional[str] = None,
    num_results: int = 10,
    user_api_key: Optional[str] = None,
    searches_used: int = 0,
    searches_limit: int = 100,
) -> tuple[List[ResearchResult], ResearchLimits]:
    """Search Google for scholarships via SerpAPI (user key or global key).

    Args:
        user_api_key: per-user SerpAPI key (takes priority over global key)
        searches_used: how many searches this user has used today
        searches_limit: this user's daily limit (default 100)

    Returns (results, limits). Results may be empty if no API key or quota exhausted.
    """
    api_key = (user_api_key or os.environ.get("SERP_API_KEY", "")).strip()
    api_key_source: Optional[str] = "user" if user_api_key else ("global" if api_key else None)

    if not api_key:
        # Fallback: scrape scholarshipportal.com (no quota hit)
        results = _scrape_scholarship_portal(country, field, degree, num_results)
        limits = ResearchLimits(
            searches_used=searches_used,
            searches_limit=searches_limit,
            resets_at=_next_reset(),
        )
        return results, limits

    if searches_used >= searches_limit:
        limits = ResearchLimits(
            searches_used=searches_used,
            searches_limit=searches_limit,
            resets_at=_next_reset(),
        )
        return [], limits

    try:
        from serpapi import GoogleSearch

        q = _build_query(country, field, degree, query)
        params = {
            "q": q,
            "num": num_results,
            "api_key": api_key,
        }
        client = GoogleSearch(params)
        raw = client.get_json()

        searches_used += 1

        organic = raw.get("organic_results", [])
        results = []
        for item in organic[:num_results]:
            results.append(ResearchResult(
                title=item.get("title", ""),
                snippet=item.get("snippet", ""),
                link=item.get("link", ""),
                source="google",
                domain=_parse_domain(item.get("link", "")),
            ))

        limits = ResearchLimits(
            searches_used=searches_used,
            searches_limit=searches_limit,
            resets_at=_next_reset(),
        )
        return results, limits

    except Exception as exc:
        logger.warning("SerpAPI search failed: %s", exc)
        results = _scrape_scholarship_portal(country, field, degree, num_results)
        limits = ResearchLimits(
            searches_used=searches_used,
            searches_limit=searches_limit,
            resets_at=_next_reset(),
        )
        return results, limits


def _build_query(country: str, field: str, degree: str, query: Optional[str]) -> str:
    parts = []
    if query:
        parts.append(query)
    else:
        parts.append(f"{country} scholarship")
        if field and field != "Any":
            parts.append(field)
        if degree and degree != "Any":
            parts.append(degree)
        parts.append("international students")
    return " ".join(parts)


def _parse_domain(link: str) -> str:
    try:
        from urllib.parse import urlparse
        return urlparse(link).netloc.replace("www.", "")
    except Exception:
        return ""


def _scrape_scholarship_portal(
    country: str,
    field: str,
    degree: str,
    num_results: int,
) -> List[ResearchResult]:
    """Fallback: scrape scholarshipportal.com for scholarship listings."""
    try:
        import httpx
    except ImportError:
        return []

    country_slug = country.lower().replace(" ", "-")
    url = f"https://www.scholarshipportal.com/scholarships?country={country_slug}"
    if field and field != "Any":
        url += f"&study_field={field.lower().replace(' ', '-')}"

    try:
        resp = httpx.get(url, timeout=10.0, follow_redirects=True)
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("ScholarshipPortal scrape failed: %s", exc)
        return []

    from bs4 import BeautifulSoup
    soup = BeautifulSoup(resp.text, "html.parser")
    results = []

    for item in soup.select(".scholarship-item, .scholarship-card, article")[:num_results]:
        a_tag = item.select_one("a")
        if not a_tag:
            continue
        title = (item.get_text(separator=" ", strip=True) or a_tag.get_text(strip=True))[:200]
        link = a_tag.get("href", "")
        if not link:
            continue
        if not link.startswith("http"):
            link = "https://www.scholarshipportal.com" + link
        results.append(ResearchResult(
            title=title,
            snippet="",
            link=link,
            source="scholarshipportal",
            domain="scholarshipportal.com",
        ))

    return results


def _next_reset() -> str:
    """ISO date for when the daily limit resets (midnight UTC)."""
    now = datetime.now(timezone.utc)
    tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return tomorrow.isoformat()


def get_limits(
    searches_used: int = 0,
    searches_limit: int = 100,
    user_api_key: Optional[str] = None,
) -> ResearchLimits:
    return ResearchLimits(
        searches_used=searches_used,
        searches_limit=searches_limit,
        resets_at=_next_reset(),
        api_key_source="user" if user_api_key else ("global" if _is_global_key_configured() else "none"),
    )
