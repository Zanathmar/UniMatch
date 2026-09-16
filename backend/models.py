from datetime import datetime, timezone
from typing import Annotated, Any, List, Literal, Optional, Union
from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, EmailStr


def _to_str_id(v: Any) -> Any:
    if isinstance(v, ObjectId):
        return str(v)
    return v


PyObjectId = Annotated[str, BeforeValidator(_to_str_id)]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc: dict):
        if not doc:
            return None
        return cls(**doc)

    def to_mongo(self, exclude_id: bool = True) -> dict:
        data = self.model_dump(by_alias=True, exclude_none=False)
        if exclude_id and "_id" in data:
            data.pop("_id", None)
        return data


# ---------- Data-point wrappers (carry source + verification) ----------
class ValuedField(BaseModel):
    """A data point that carries a source and a Verified/Estimated status."""
    value: Optional[Any] = None
    status: str = "Estimated"  # "Verified" | "Estimated"
    source: Optional[str] = None
    note: Optional[str] = None


# ---------- Auth ----------
class User(BaseDocument):
    email: EmailStr
    password_hash: str
    name: str = ""
    role: str = "student"
    created_at: str = Field(default_factory=now_iso)
    # Per-user SerpAPI key for web research (optional)
    serp_api_key: Optional[str] = None
    searches_used_today: int = 0          # resets at midnight UTC
    searches_limit: int = 100             # per-user daily limit (matches global default)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=6)


# ---------- University / Program ----------
class Requirement(BaseModel):
    min_gpa: Optional[ValuedField] = None          # value is on 4.0 scale
    ielts: Optional[ValuedField] = None            # value overall band
    toefl: Optional[ValuedField] = None            # ibt total
    other: Optional[str] = None                    # free text (SAT, portfolio, etc.)


class Program(BaseModel):
    id: str
    name: str
    degree: str                    # "Bachelor" | "Master"
    field: str                     # study interest category
    duration_years: float = 4
    language: str = "English"
    tuition_per_year: ValuedField  # {value: USD int}
    living_cost_per_year: ValuedField
    intake: List[str] = []
    application_deadline: ValuedField  # {value: ISO date str}
    requirements: Requirement = Field(default_factory=Requirement)
    scholarship_ids: List[str] = []


class University(BaseDocument):
    slug: str
    name: str
    country: str
    city: str
    type: str = "Public"           # Public | Private
    qs_ranking: Optional[int] = None
    the_ranking: Optional[int] = None
    acceptance_rate: Optional[float] = None
    description: str = ""
    image_url: str = ""
    website: str = ""
    programs: List[Program] = []
    scholarship_slugs: List[str] = []   # all scholarship slugs linked to this university (canonical store)
    # --- custom-entry fields ---
    source: Literal["curated", "custom"] = "curated"
    verified: bool = True
    added_by_user_id: Optional[str] = None
    user_id: Optional[str] = None    # None = seed/curated; set = user-owned
    # --------------------------
    created_at: str = Field(default_factory=now_iso)


class Scholarship(BaseDocument):
    slug: str
    name: str
    provider: str
    university_slug: Optional[str] = None   # link to a university (by slug), None = external/global (seed)
    university_slugs: List[str] = []       # list of linked university slugs (custom scholarships)
    linked_university_slugs: List[str] = [] # canonical: all universities this scholarship is linked to
    coverage_type: str = "Partial"          # Full | Partial | Stipend
    coverage_text: str = ""
    amount_per_year: Optional[int] = None   # USD, None if variable
    degree_level: str = "Any"               # Bachelor | Master | Any
    field: str = "Any"
    eligibility: dict = Field(default_factory=dict)  # {min_gpa, min_ielts, need_based, merit_based, nationalities}
    deadline: ValuedField = Field(default_factory=ValuedField)
    requirements_text: str = ""
    link: str = ""
    # --- custom-entry fields ---
    source: Literal["curated", "custom"] = "curated"
    verified: bool = True
    added_by_user_id: Optional[str] = None
    user_id: Optional[str] = None            # None = seed/curated; set = user-owned
    # --------------------------
    created_at: str = Field(default_factory=now_iso)


# ---------- Student Profile ----------
class StudentProfile(BaseDocument):
    user_id: str
    # personal
    full_name: Optional[str] = None
    nationality: Optional[str] = None
    current_country: Optional[str] = None
    # academics
    gpa: Optional[float] = None
    gpa_scale: float = 4.0
    education_level: Optional[str] = None   # "High School" | "Bachelor"
    graduation_year: Optional[int] = None
    # english
    english_test: Optional[str] = None      # "IELTS" | "TOEFL" | "None"
    english_score: Optional[float] = None
    # study interest
    field_of_study: Optional[str] = None
    degree_level: Optional[str] = None       # "Bachelor" | "Master"
    # destinations
    preferred_countries: List[str] = []
    # budget
    budget_per_year: Optional[int] = None    # USD max tuition willing/able
    needs_funding: bool = False
    completed_steps: List[str] = []
    updated_at: str = Field(default_factory=now_iso)


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    nationality: Optional[str] = None
    current_country: Optional[str] = None
    gpa: Optional[float] = None
    gpa_scale: Optional[float] = None
    education_level: Optional[str] = None
    graduation_year: Optional[int] = None
    english_test: Optional[str] = None
    english_score: Optional[float] = None
    field_of_study: Optional[str] = None
    degree_level: Optional[str] = None
    preferred_countries: Optional[List[str]] = None
    budget_per_year: Optional[int] = None
    needs_funding: Optional[bool] = None
    completed_steps: Optional[List[str]] = None


class SavedUniversity(BaseDocument):
    user_id: str
    university_slug: str
    note: str = ""
    status: str = "Considering"   # Considering | Applying | Submitted
    created_at: str = Field(default_factory=now_iso)


class SaveRequest(BaseModel):
    university_slug: str
    note: str = ""
    status: str = "Considering"


class SaveUpdate(BaseModel):
    note: Optional[str] = None
    status: Optional[str] = None


# ---------- Custom User-Added Entries ----------
class CustomUniversityCreate(BaseModel):
    name: str
    country: str
    city: str = ""
    type: str = "Public"
    website: str = ""
    qs_ranking: Optional[int] = None
    description: str = ""
    image_url: str = ""
    programs: List["CustomProgramCreate"] = []


class CustomProgramCreate(BaseModel):
    """Simplified program schema for user-added programs on custom universities."""
    name: str
    degree: str = "Bachelor"           # "Bachelor" | "Master"
    field: str = ""
    duration_years: float = 4
    language: str = "English"
    tuition_per_year: Optional[int] = None   # USD — user enters raw number
    living_cost_per_year: Optional[int] = None
    intake: List[str] = []
    application_deadline: Optional[str] = None  # ISO date string
    # requirements (all optional for user-friendliness)
    min_gpa: Optional[float] = None   # on 4.0 scale
    ielts: Optional[float] = None
    toefl: Optional[int] = None
    other: Optional[str] = None
    scholarship_ids: List[str] = []


class CustomUniversityResponse(BaseDocument):
    slug: str
    name: str
    country: str
    city: str = ""
    type: str = "Public"
    website: str = ""
    qs_ranking: Optional[int] = None
    description: str = ""
    programs: List["Program"] = []   # stored in same format as curated universities
    source: Literal["custom"] = "custom"
    verified: bool = False
    added_by_user_id: str
    user_id: str
    created_at: str = Field(default_factory=now_iso)


class CustomScholarshipCreate(BaseModel, extra="ignore"):
    name: str
    provider: str = ""
    university_slug: Optional[List[str]] = None
    custom_university_name: Optional[str] = None
    coverage_type: str = "Partial"
    coverage_text: str = ""
    amount_per_year: Optional[int] = None
    degree_level: str = "Any"
    field: str = "Any"
    deadline: Optional[Union[str, dict]] = None  # dict = ValuedField from storage, str = API input
    requirements_text: str = ""
    link: str = ""
    verified: bool = False
    # Structured eligibility fields (mirrors curated scholarship schema)
    min_gpa: Optional[float] = None
    min_ielts: Optional[float] = None
    min_toefl: Optional[int] = None
    need_based: bool = False
    merit_based: bool = False
    citizenship: str = ""  # e.g. "Open to all", "EU citizens only", "ASEAN countries"


class CustomScholarshipResponse(BaseDocument):
    slug: str
    name: str
    provider: str = ""
    university_slug: Optional[List[str]] = None
    custom_university_name: Optional[str] = None
    coverage_type: str = "Partial"
    coverage_text: str = ""
    amount_per_year: Optional[int] = None
    degree_level: str = "Any"
    field: str = "Any"
    deadline: ValuedField = Field(default_factory=ValuedField)
    requirements_text: str = ""
    link: str = ""
    source: Literal["custom"] = "custom"
    verified: bool = False
    added_by_user_id: str
    created_at: str = Field(default_factory=now_iso)


# ---------- Web Research ----------
class ResearchResult(BaseModel):
    title: str
    snippet: str
    link: str
    source: str = "google"
    domain: str = ""


class ResearchLimits(BaseModel):
    searches_used: int = 0
    searches_limit: int = 100
    resets_at: str = ""  # ISO date string
    api_key_source: Optional[str] = None  # "user" | "global" | "none" | None


# ---------- User Settings ----------
class UserSettingsUpdate(BaseModel):
    serp_api_key: Optional[str] = None   # None = don't change; "" = clear key
    custom_countries: Optional[List[str]] = None  # None = don't change; [] = clear


class UserSettingsResponse(BaseModel):
    serp_api_key_set: bool               # True if user has their own key
    serp_api_key_masked: Optional[str] = None  # e.g. "sk_•••••_3f2a" or None
    searches_used_today: int
    searches_limit: int
    global_key_set: bool                 # whether SERP_API_KEY env var is configured
    custom_countries: List[str] = []    # user's custom countries
