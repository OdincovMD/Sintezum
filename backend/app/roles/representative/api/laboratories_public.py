"""
Роуты FastAPI для работы с лабораториями (публичные страницы).
GET / — список опубликованных лабораторий (с поиском и фильтрами через ES),
GET /suggest — подсказки для автодополнения,
GET /public/{public_id}/details — детали лаборатории по public_id.
"""

import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.roles.representative.schemas import (
    LaboratoryListResponse,
    LaboratoryDetails,
)
from app.queries.orm import Orm
from app.services.elasticsearch import search_laboratories, suggest_laboratories

router = APIRouter(prefix="/laboratories", tags=["laboratories"])


def _resolve_lab_contact_email(lab) -> Optional[str]:
    """Email для кнопки «Связаться»: руководитель (contacts/user), затем создатель организации, затем создатель лаборатории."""
    he = getattr(lab, "head_employee", None)
    if he:
        contacts = getattr(he, "contacts", None) or {}
        if isinstance(contacts, dict):
            email = contacts.get("email") or contacts.get("mail")
            if email and isinstance(email, str) and email.strip():
                return email.strip()
        if getattr(he, "user", None):
            mail = getattr(he.user, "mail", None)
            if mail and isinstance(mail, str) and mail.strip():
                return mail.strip()
    org = getattr(lab, "organization", None)
    if org and getattr(org, "creator", None):
        mail = getattr(org.creator, "mail", None)
        if mail and isinstance(mail, str) and mail.strip():
            return mail.strip()
    if getattr(lab, "creator", None):
        mail = getattr(lab.creator, "mail", None)
        if mail and isinstance(mail, str) and mail.strip():
            return mail.strip()
    return None


def _prepare_labs_for_response(labs):
    """Применить фильтры организации и исследователей к списку лабораторий."""
    for lab in labs:
        org = getattr(lab, "organization", None)
        if org is not None and not getattr(org, "is_published", False):
            lab.organization = None
        employee_user_ids = {e.user_id for e in (lab.employees or []) if getattr(e, "user_id", None)}
        lab.researchers = [
            r for r in (lab.researchers or [])
            if getattr(r, "user_id", None) not in employee_user_ids
        ]
    return labs


@router.get("/", response_model=LaboratoryListResponse)
async def list_laboratories(
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    organization_id: Optional[int] = Query(None),
    without_org: bool = Query(False),
    min_employees: Optional[int] = Query(None, ge=0),
    sort_by: Optional[str] = Query(None),
):
    """
    Список опубликованных лабораторий.
    Всегда через Elasticsearch для корректной сортировки: paid_active, rank_score, created_at.
    """
    try:
        result = await search_laboratories(
            q=(q or "").strip(),
            page=page,
            size=size,
            organization_id=organization_id,
            without_org=without_org,
            min_employees=min_employees,
            sort_by=sort_by,
        )
        items = result.get("items", [])
        lab_ids = [it["id"] for it in items if it.get("id") is not None]
        if lab_ids:
            labs = await Orm.get_laboratories_by_ids(lab_ids)
            labs = _prepare_labs_for_response(labs)
            return LaboratoryListResponse(
                items=labs,
                total=result.get("total", 0),
                page=result.get("page", page),
                size=result.get("size", size),
            )
        return LaboratoryListResponse(
            items=[],
            total=result.get("total", 0),
            page=result.get("page", page),
            size=result.get("size", size),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "LABORATORY_SEARCH_FAILURE", "message": str(e)},
        )


@router.get("/suggest")
async def suggest_laboratories_endpoint(
    q: str = Query(""),
    limit: int = Query(10, ge=1, le=20),
):
    """Подсказки для автодополнения поиска лабораторий."""
    suggestions = await suggest_laboratories(q=q, limit=limit)
    return {"suggestions": suggestions}


@router.get("/public/{public_id}/details", response_model=LaboratoryDetails)
async def get_laboratory_details(public_id: str):
    """Получение детальной информации о лаборатории по public_id."""
    lab = await Orm.get_laboratory_by_public_id(public_id)
    if not lab:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Laboratory not found",
        )
    if not getattr(lab, "is_published", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Laboratory not published",
        )
    
    # Загружаем связанные запросы (queries) и вакансии для этой лаборатории
    org_queries = []
    if lab.organization_id:
        all_queries = await Orm.list_published_queries_for_org(lab.organization_id)
        org_queries = [q for q in all_queries if any(l.id == lab.id for l in (q.laboratories or []))]
    else:
        # Лаборатория без организации (lab representative): запросы по creator / query_laboratories
        all_queries = await Orm.list_published_queries()
        org_queries = [q for q in all_queries if any(l.id == lab.id for l in (q.laboratories or []))]
    vacancies = await Orm.list_published_vacancies_for_laboratory(lab.id)

    # Формируем объект организации для ответа (только если она опубликована)
    org_short = None
    if lab.organization and getattr(lab.organization, "is_published", False):
        org_short = {
            "id": lab.organization.id,
            "public_id": lab.organization.public_id,
            "name": lab.organization.name,
            "avatar_url": lab.organization.avatar_url,
        }

    # Исключаем исследователей, которые уже в сотрудниках (при approve создаётся Employee)
    employee_user_ids = {e.user_id for e in (lab.employees or []) if getattr(e, "user_id", None)}
    researchers_filtered = [r for r in (lab.researchers or []) if getattr(r, "user_id", None) not in employee_user_ids]

    head_short = None
    if getattr(lab, "head_employee", None):
        he = lab.head_employee
        head_short = {
            "id": he.id,
            "created_at": getattr(he, "created_at", None),
            "full_name": he.full_name or "",
            "positions": getattr(he, "positions", None),
            "academic_degree": getattr(he, "academic_degree", None),
            "photo_url": getattr(he, "photo_url", None),
        }

    task_solutions = lab.task_solutions or []
    contact_email = _resolve_lab_contact_email(lab)

    return LaboratoryDetails(
        id=lab.id,
        public_id=lab.public_id,
        name=lab.name,
        description=lab.description,
        activities=lab.activities,
        image_urls=lab.image_urls or [],
        created_at=lab.created_at,
        is_published=lab.is_published,
        organization=org_short,
        head_employee=head_short,
        employees=lab.employees or [],
        researchers=researchers_filtered,
        equipment=lab.equipment or [],
        task_solutions=task_solutions,
        queries=org_queries,
        vacancies=vacancies,
        contact_email=contact_email,
    )
