from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.queue.job_store import init_db, reset_stale_jobs
from app.storage.paths import ensure_dirs
from app.api.upload import router as upload_router
from app.api.jobs import router as jobs_router
from app.api.results import router as results_router

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    ensure_dirs()
    init_db()
    reset_count = reset_stale_jobs(timeout_minutes=15)
    if reset_count:
        logging.getLogger(__name__).warning(
            "Reset %d stale job(s) left in 'running' state from a previous worker crash.", reset_count
        )
    yield
    # Shutdown — nothing to tear down yet


app = FastAPI(title="Financial Extractor", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # Allow the React dev server (Phase 7) to call the API
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)
app.include_router(jobs_router)
app.include_router(results_router)


@app.get("/health")
def health():
    return {"status": "ok"}
