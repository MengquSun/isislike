from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import molecules

app = FastAPI(
    title="ISISlike Cheminformatics API",
    description="RDKit microservice — canonicalizes all chemical strings before Supabase",
    version="0.1.0",
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_origin_regex=r"https://([a-z0-9-]+\.)*netlify\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(molecules.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "cheminformatics"}
