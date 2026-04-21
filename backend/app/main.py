from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import auth
from app.routers import containers
from app.routers import container_types
from app.routers import organizations
from app.routers import places
from app.routers import orders
from app.routers import credits
from app.routers import events
from app.routers import references

app = FastAPI(
    title="NUT Traceability API",
    version="0.1.0",
    docs_url="/docs" if settings.ENV == "development" else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(containers.router)
app.include_router(container_types.router, prefix="/container-types", tags=["container-types"])
app.include_router(organizations.router)
app.include_router(places.router)
app.include_router(orders.router)
app.include_router(credits.router)
app.include_router(events.router)
app.include_router(references.router)

@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.ENV}
