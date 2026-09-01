"""Admin API package. Platform admin endpoints for subscriptions and entity CRUD."""

from fastapi import APIRouter

from .subscriptions import router as subscriptions_router
from .dashboard import router as dashboard_router
from .users import router as users_router
from .join_requests import router as join_requests_router
from .vacancy_responses import router as vacancy_responses_router
from .organizations import router as organizations_router
from .creators import router as creators_router
from .laboratories import router as laboratories_router
from .vacancies import router as vacancies_router
from .queries import router as queries_router
from .equipment import router as equipment_router
from .tasks import router as tasks_router
from .employees import router as employees_router
from .students import router as students_router
from .researchers import router as researchers_router
from .feedback import router as feedback_router
from .news import router as news_router

router = APIRouter(prefix="/admin", tags=["admin"])

router.include_router(subscriptions_router)
router.include_router(dashboard_router)
router.include_router(users_router)
router.include_router(join_requests_router)
router.include_router(vacancy_responses_router)
router.include_router(organizations_router)
router.include_router(creators_router)
router.include_router(laboratories_router)
router.include_router(vacancies_router)
router.include_router(queries_router)
router.include_router(equipment_router)
router.include_router(tasks_router)
router.include_router(employees_router)
router.include_router(students_router)
router.include_router(researchers_router)
router.include_router(feedback_router)
router.include_router(news_router)
