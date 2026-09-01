"""Управление новостями организации и лабораторий в профиле."""

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user
from app.news.repository import (
    NewsConflictError,
    NewsForbiddenError,
    NewsNotFoundError,
    NewsRepository,
)
from app.news.schemas import (
    NewsCreate,
    NewsEmployee,
    NewsManageItem,
    NewsManageListResponse,
    NewsPublishUpdate,
    NewsUpdate,
)
from app.roles.representative.api._helpers import require_lab_admin_or_representative

router = APIRouter(prefix="/news", tags=["profile-news"])


def _translate_error(exc: Exception) -> None:
    if isinstance(exc, NewsNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Новость или её источник не найдены")
    if isinstance(exc, NewsConflictError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc) or "Новость снята администратором и не может быть опубликована автором",
        )
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав для этой новости")


@router.get("", response_model=NewsManageListResponse)
async def list_profile_news(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
):
    require_lab_admin_or_representative(current_user)
    items, total = await NewsRepository.list_manage(current_user, page=page, size=size)
    return {"items": items, "total": total, "page": page, "size": size}


@router.get("/eligible-employees", response_model=list[NewsEmployee])
async def list_profile_news_employees(
    scope: Literal["organization", "laboratory"] = Query(...),
    organization_id: Optional[int] = Query(None, ge=1),
    laboratory_id: Optional[int] = Query(None, ge=1),
    current_user=Depends(get_current_user),
):
    require_lab_admin_or_representative(current_user)
    try:
        return await NewsRepository.list_eligible_employees(
            current_user,
            scope=scope,
            organization_id=organization_id,
            laboratory_id=laboratory_id,
        )
    except (NewsNotFoundError, NewsForbiddenError, NewsConflictError) as exc:
        _translate_error(exc)


@router.post("", response_model=NewsManageItem, status_code=status.HTTP_201_CREATED)
async def create_profile_news(payload: NewsCreate, current_user=Depends(get_current_user)):
    require_lab_admin_or_representative(current_user)
    try:
        return await NewsRepository.create(current_user, payload)
    except (NewsNotFoundError, NewsForbiddenError, NewsConflictError) as exc:
        _translate_error(exc)


@router.put("/{news_id:int}", response_model=NewsManageItem)
async def update_profile_news(
    news_id: int,
    payload: NewsUpdate,
    current_user=Depends(get_current_user),
):
    require_lab_admin_or_representative(current_user)
    try:
        return await NewsRepository.update(news_id, current_user, payload)
    except (NewsNotFoundError, NewsForbiddenError, NewsConflictError) as exc:
        _translate_error(exc)


@router.put("/{news_id:int}/publish", response_model=NewsManageItem)
async def publish_profile_news(
    news_id: int,
    payload: NewsPublishUpdate,
    current_user=Depends(get_current_user),
):
    require_lab_admin_or_representative(current_user)
    try:
        return await NewsRepository.set_published(
            news_id,
            current_user,
            payload.is_published,
        )
    except (NewsNotFoundError, NewsForbiddenError, NewsConflictError) as exc:
        _translate_error(exc)


@router.delete("/{news_id:int}")
async def delete_profile_news(news_id: int, current_user=Depends(get_current_user)):
    require_lab_admin_or_representative(current_user)
    try:
        await NewsRepository.delete(news_id, current_user)
        return {"status": "ok"}
    except (NewsNotFoundError, NewsForbiddenError) as exc:
        _translate_error(exc)
