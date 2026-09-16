import logging
import os

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from db import db, client
from auth import router as auth_router, seed_admin
from routes import router as core_router
from seed import seed_data

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("unimatch")

app = FastAPI(title="UniMatch API")


@app.get("/api/")
async def root():
    return {"message": "UniMatch API running"}


app.include_router(auth_router)
app.include_router(core_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await db.universities.create_index("slug", unique=True)
    await db.universities.create_index([("user_id", 1), ("slug", 1)])
    await db.universities.create_index([("user_id", 1), ("country", 1)])
    await db.scholarships.create_index("slug", unique=True)
    await db.scholarships.create_index([("user_id", 1), ("slug", 1)])
    await db.scholarships.create_index([("user_id", 1), ("degree_level", 1)])
    await db.profiles.create_index("user_id", unique=True)
    await db.saved.create_index([("user_id", 1), ("university_slug", 1)])
    await seed_admin()
    await seed_data()
    logger.info("Startup complete: admin seeded, data seeded.")


@app.on_event("shutdown")
async def shutdown():
    client.close()
