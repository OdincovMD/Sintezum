"""
Роуты FastAPI для профиля представителя (организация, лаборатории, оборудование и т.д.).
Объединяет все представления (views): equipment, laboratories, employees, tasks, queries, vacancies.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError

from app.api.deps import get_current_user
from app.services.elasticsearch import (
    reindex_laboratories_by_ids,
    delete_organization,
    reindex_organizations_by_ids,
)
from app.roles.representative.schemas import (
    OrganizationRead,
    OrganizationUpdate,
    OrganizationEquipmentCreate,
    OrganizationEquipmentRead,
    OrganizationEquipmentUpdate,
    OrganizationLaboratoryCreate,
    OrganizationLaboratoryRead,
    OrganizationLaboratoryUpdate,
    OrganizationTaskSolutionCreate,
    OrganizationTaskSolutionRead,
    OrganizationTaskSolutionUpdate,
    OrganizationQueryCreate,
    OrganizationQueryRead,
    OrganizationQueryUpdate,
    VacancyOrganizationCreate,
    VacancyOrganizationRead,
    VacancyOrganizationUpdate,
    EmployeeCreate,
    EmployeeRead,
    EmployeeUpdate,
)
from app.queries.orm import Orm

from .equipment import router as equipment_router
from .laboratories import router as laboratories_router
from .employees import router as employees_router
from .tasks import router as tasks_router
from .queries import router as queries_router
from .vacancies import router as vacancies_router
from .profile_analytics import router as profile_analytics_router

router = APIRouter()

# Include view subfolders
router.include_router(equipment_router, tags=["profile-equipment"])
router.include_router(laboratories_router, tags=["profile-laboratories"])
router.include_router(employees_router, tags=["profile-employees"])
router.include_router(tasks_router, tags=["profile-tasks"])
router.include_router(queries_router, tags=["profile-queries"])
router.include_router(vacancies_router, tags=["profile-vacancies"])
router.include_router(profile_analytics_router)


# =========================
#    ORGANIZATION PROFILE
# =========================

class SubscriptionRequestCreate(BaseModel):
    tier: str = "pro"  # basic | pro
    is_trial: bool = False


@router.get("/subscription")
async def get_my_subscription(current_user=Depends(get_current_user)):
    """
    Текущая подписка пользователя. Для отображения статуса в дашборде и шапке.
    """
    sub = await Orm.get_active_subscription(current_user.id)
    my_pending = await Orm.get_pending_subscription_requests_for_user(current_user.id)
    pending_by_key = {f"{r.tier}_{r.is_trial}": r for r in my_pending}
    has_used_trial = await Orm.has_ever_had_trial_subscription(current_user.id)
    has_ever_had_paid = await Orm.has_ever_had_paid_subscription(current_user.id)
    base = {
        "pending_requests": {k: {"id": r.id, "created_at": r.created_at.isoformat() if r.created_at else None} for k, r in pending_by_key.items()},
        "has_used_trial": has_used_trial,
        "has_ever_had_paid": has_ever_had_paid,
    }
    if not sub:
        return {
            **base,
            "active": False,
            "expires_at": None,
            "trial_ends_at": None,
            "tier": None,
            "status": "none",
            "started_at": None,
        }
    return {
        **base,
        "active": True,
        "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
        "trial_ends_at": sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
        "tier": sub.tier or "pro",
        "status": sub.status or "active",
        "started_at": sub.started_at.isoformat() if sub.started_at else None,
    }


@router.post("/subscription/request")
async def create_subscription_request(
    body: SubscriptionRequestCreate,
    current_user=Depends(get_current_user),
):
    """
    Запросить подключение подписки. Админ получит уведомление.
    Ограничения: нельзя при активной платной подписке; нельзя дублировать запрос по одному тарифу.
    """
    if body.tier not in ("basic", "pro"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="tier must be basic or pro")
    if body.is_trial:
        if await Orm.has_ever_had_trial_subscription(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пробная подписка подключается только один раз",
            )
        if await Orm.has_ever_had_paid_subscription(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Триал недоступен, если ранее была подключена платная подписка (Basic или Pro)",
            )
    has_active_paid = await Orm.has_active_paid_subscription(current_user.id)
    if has_active_paid:
        current_sub = await Orm.get_active_subscription(current_user.id)
        current_tier = (current_sub and current_sub.tier) or "basic"
        # Разрешаем только апгрейд Basic → Pro
        if not (current_tier == "basic" and body.tier == "pro"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Нельзя запросить подписку при активной платной подписке. Доступен только переход на Pro.",
            )
    existing = await Orm.get_pending_subscription_request(
        current_user.id, "representative", body.tier, body.is_trial
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Уже есть ожидающий запрос на этот тариф",
        )
    try:
        req = await Orm.create_subscription_request(
            user_id=current_user.id,
            audience="representative",
            tier=body.tier,
            is_trial=body.is_trial,
        )
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Дублирующий запрос (уже есть ожидающий запрос на этот тариф)",
        )
    await Orm.create_notification(
        current_user.id,
        "subscription_request_sent",
        {
            "request_id": req.id,
            "tier": body.tier,
            "is_trial": body.is_trial,
        },
    )
    admin_ids = await Orm.get_platform_admin_user_ids()
    for aid in admin_ids:
        await Orm.create_notification(
            aid,
            "subscription_request_created",
            {
                "request_id": req.id,
                "user_id": current_user.id,
                "user_full_name": current_user.full_name or current_user.mail,
                "user_mail": current_user.mail,
                "tier": body.tier,
                "is_trial": body.is_trial,
            },
        )
    return {
        "id": req.id,
        "tier": req.tier,
        "is_trial": req.is_trial,
        "status": req.status,
        "created_at": req.created_at.isoformat() if req.created_at else None,
    }


@router.get("/organization", response_model=OrganizationRead | None)
async def get_org_profile(current_user=Depends(get_current_user)):
    org = await Orm.get_organization_for_user(current_user.id)
    return org


@router.put("/organization", response_model=OrganizationRead)
async def upsert_org_profile(
    payload: OrganizationUpdate,
    current_user=Depends(get_current_user),
):
    try:
        org = await Orm.upsert_organization_for_user(
            current_user.id,
            name=payload.name,
            avatar_url=payload.avatar_url,
            description=payload.description,
            address=payload.address,
            website=payload.website,
            ror_id=payload.ror_id,
            hidden_public_sections=payload.hidden_public_sections,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if org and org.id:
        labs = await Orm.list_published_laboratories_for_org(org.id)
        if labs:
            try:
                await reindex_laboratories_by_ids([l.id for l in labs])
            except Exception as e:
                logging.getLogger(__name__).warning(
                    "Laboratory reindex failed after org profile update: org_id=%s %s", org.id, e
                )
        try:
            await reindex_organizations_by_ids([org.id])
        except Exception as e:
            logging.getLogger(__name__).warning(
                "Organization reindex failed after profile update: org_id=%s %s", org.id, e
            )
    return org


class PublishToggle(BaseModel):
    is_published: bool


@router.put("/organization/publish", response_model=OrganizationRead)
async def set_org_publish_state(
    payload: PublishToggle,
    current_user=Depends(get_current_user),
):
    org = await Orm.get_organization_for_user(current_user.id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization profile not found")
    if payload.is_published and (not org.name or not str(org.name).strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала заполните и сохраните профиль организации.",
        )
    updated = await Orm.set_organization_published(org.id, payload.is_published)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization profile not found")
    try:
        if payload.is_published:
            await reindex_organizations_by_ids([org.id])
        else:
            await delete_organization(org.id)
    except Exception as e:
        logging.getLogger(__name__).warning(
            "Organization index sync failed after publish toggle: org_id=%s %s", org.id, e
        )
    return updated
