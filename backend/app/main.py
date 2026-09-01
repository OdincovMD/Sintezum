"""
Точка входа FastAPI-приложения.
Инициализирует базу данных, создаёт подключение к s3, создаёт индексы elasticsearch, ставит cron job и регистрирует роутеры.
"""

from apscheduler.schedulers.background import BackgroundScheduler
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.logging_config import setup_logging
from app.rate_limit import limiter
from app.bootstrap import (
    create_tables,
    ensure_storage,
    seed_roles,
    seed_trial_subscriptions,
    ensure_elasticsearch_indexes,
)
from app.middleware import StorageUrlRewriteMiddleware
from app.api import home, profile, storage, analytics, search, feedback, news
from app.api.admin import router as admin_router
from app.core.api import auth, users, roles
from app.jobs.openalex_sync import sync_openalex_data
from app.jobs.subscription_expiry import check_subscription_expiry
from app.roles.representative.api import (
    applicants_public,
    laboratories_public,
    queries_public,
    labs,
    vacancies_public,
    stats,
)

scheduler = BackgroundScheduler()

app = FastAPI(
    title="Синтезум",
    version="release/D-01.006.00.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(StorageUrlRewriteMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    setup_logging()
    await create_tables()
    await seed_roles()
    if settings.ENV.lower() == "development":
        await seed_trial_subscriptions()
    ensure_storage()
    await ensure_elasticsearch_indexes()
    scheduler.add_job(sync_openalex_data, "cron", hour=3, minute=0)
    scheduler.add_job(check_subscription_expiry, "cron", hour=4, minute=0)
    scheduler.start()


@app.get("/health")
def health_check():
    return {"status": "ok"}


app.include_router(home.router, prefix="/api")
app.include_router(labs.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(laboratories_public.router, prefix="/api")
app.include_router(queries_public.router, prefix="/api")
app.include_router(vacancies_public.router, prefix="/api")
app.include_router(applicants_public.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(roles.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(storage.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")
app.include_router(news.router, prefix="/api")
app.include_router(admin_router, prefix="/api")
