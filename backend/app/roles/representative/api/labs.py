"""
Роуты FastAPI для работы с организациями (лабораториями).
POST / — создание организации,
GET / — список организаций (с поиском и фильтрами через ES),
GET /suggest — подсказки для автодополнения,
GET /{org_id} — получение организации по ID.
"""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status, Depends

from app.roles.representative.schemas import (
    OrganizationCreate,
    OrganizationRead,
    OrganizationDetails,
    OrganizationListResponse,
)
from app.queries.orm import Orm
from app.api.deps import get_current_user
from app.services.elasticsearch import search_organizations, suggest_organizations

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/labs", tags=["labs"])


@router.post("/", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
async def create_lab(lab_in: OrganizationCreate, _user=Depends(get_current_user)):
    """Создание новой организации."""
    try:
        org = await Orm.create_organization(
            name=lab_in.name,
            avatar_url=lab_in.avatar_url,
            description=lab_in.description,
            address=lab_in.address,
            website=lab_in.website,
        )
        logger.info("Organization created: id=%s name=%s", org.id, org.name)
        return org
    except Exception as e:
        logger.warning("Organization creation failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "LAB_CREATION_FAILURE", "message": str(e)},
        )


@router.get("/", response_model=OrganizationListResponse)
async def list_labs(
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    min_laboratories: Optional[int] = Query(None, ge=0),
    min_employees: Optional[int] = Query(None, ge=0),
    sort_by: Optional[str] = Query(None),
):
    """
    Список опубликованных организаций для публичного каталога.
    Всегда через Elasticsearch для корректной сортировки: paid_active, rank_score, created_at.
    """
    try:
        result = await search_organizations(
            q=(q or "").strip(),
            page=page,
            size=size,
            min_laboratories=min_laboratories,
            min_employees=min_employees,
            sort_by=sort_by,
        )
        items = result.get("items", [])
        org_ids = [it["id"] for it in items if it.get("id") is not None]
        if org_ids:
            orgs = await Orm.get_organizations_by_ids(org_ids)
            return OrganizationListResponse(
                items=orgs,
                total=result.get("total", 0),
                page=result.get("page", page),
                size=result.get("size", size),
            )
        return OrganizationListResponse(
            items=[],
            total=result.get("total", 0),
            page=result.get("page", page),
            size=result.get("size", size),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "ORGANIZATION_SEARCH_FAILURE", "message": str(e)},
        )


@router.get("/suggest")
async def suggest_labs(
    q: str = Query(""),
    limit: int = Query(10, ge=1, le=20),
):
    """Подсказки для автодополнения поиска организаций."""
    suggestions = await suggest_organizations(q=q, limit=limit)
    return {"suggestions": suggestions}


@router.get("/{org_id}", response_model=OrganizationRead)
async def get_lab(org_id: int):
    """Получение организации по ID."""
    org = await Orm.get_organization(org_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    return org


@router.get("/public/{public_id}/details", response_model=OrganizationDetails)
async def get_lab_details(public_id: str):
    org = await Orm.get_organization_by_public_id(public_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    if not getattr(org, "is_published", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization not published",
        )
    equipment, laboratories, employees, task_solutions, queries, vacancies = await asyncio.gather(
        Orm.list_equipment_for_org(org.id),
        Orm.list_published_laboratories_for_org(org.id),
        Orm.list_employees_for_org(org.id),
        Orm.list_task_solutions_for_org(org.id),
        Orm.list_published_queries_for_org(org.id),
        Orm.list_published_vacancies_for_org(org.id),
    )
    for lab in laboratories:
        employee_user_ids = {e.user_id for e in (lab.employees or []) if getattr(e, "user_id", None)}
        lab.researchers = [r for r in (lab.researchers or []) if getattr(r, "user_id", None) not in employee_user_ids]
    representative_email = None
    if getattr(org, "creator", None) and getattr(org.creator, "mail", None):
        mail = (org.creator.mail or "").strip()
        if mail:
            representative_email = mail

    return OrganizationDetails(
        id=org.id,
        public_id=org.public_id,
        name=org.name,
        avatar_url=org.avatar_url,
        description=org.description,
        address=org.address,
        website=org.website,
        created_at=org.created_at,
        hidden_public_sections=org.hidden_public_sections or [],
        equipment=equipment,
        laboratories=laboratories,
        employees=employees,
        task_solutions=task_solutions,
        queries=queries,
        vacancies=vacancies,
        representative_email=representative_email,
    )
