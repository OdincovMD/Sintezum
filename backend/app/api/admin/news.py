"""Административное управление новостями."""

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.admin.deps import require_admin
from app.api.deps import get_current_user
from app.news.repository import NewsConflictError, NewsForbiddenError, NewsNotFoundError, NewsRepository
from app.news.schemas import (
    NewsCreate,
    NewsEmployee,
    NewsManageItem,
    NewsManageListResponse,
    NewsPublishUpdate,
    NewsUpdate,
)

router = APIRouter(prefix="/news", tags=["admin-news"])


def _translate_error(exc: Exception) -> None:
    if isinstance(exc, NewsNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Новость не найдена")
    if isinstance(exc, NewsConflictError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc) or "Некорректная связь новости",
        )
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Операция с новостью запрещена")


@router.get("", response_model=NewsManageListResponse)
async def list_news_admin(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    news_status: Optional[Literal["draft", "published", "blocked"]] = Query(None),
    scope: Optional[Literal["platform", "organization", "laboratory"]] = Query(None),
    current_user=Depends(get_current_user),
):
    require_admin(current_user)
    items, total = await NewsRepository.list_manage(
        current_user,
        page=page,
        size=size,
        status=news_status,
        scope=scope,
        admin_all=True,
    )
    return {"items": items, "total": total, "page": page, "size": size}


@router.get("/eligible-employees", response_model=list[NewsEmployee])
async def list_news_employees_admin(
    scope: Literal["platform", "organization", "laboratory"] = Query(...),
    organization_id: Optional[int] = Query(None, ge=1),
    laboratory_id: Optional[int] = Query(None, ge=1),
    current_user=Depends(get_current_user),
):
    require_admin(current_user)
    try:
        return await NewsRepository.list_eligible_employees(
            current_user,
            scope=scope,
            organization_id=organization_id,
            laboratory_id=laboratory_id,
            admin=True,
        )
    except (NewsNotFoundError, NewsForbiddenError, NewsConflictError) as exc:
        _translate_error(exc)


@router.post("", response_model=NewsManageItem, status_code=status.HTTP_201_CREATED)
async def create_news_admin(payload: NewsCreate, current_user=Depends(get_current_user)):
    require_admin(current_user)
    try:
        return await NewsRepository.create(current_user, payload)
    except (NewsNotFoundError, NewsForbiddenError, NewsConflictError) as exc:
        _translate_error(exc)


@router.put("/{news_id:int}", response_model=NewsManageItem)
async def update_news_admin(
    news_id: int,
    payload: NewsUpdate,
    current_user=Depends(get_current_user),
):
    require_admin(current_user)
    try:
        return await NewsRepository.update(news_id, current_user, payload, admin=True)
    except (NewsNotFoundError, NewsForbiddenError, NewsConflictError) as exc:
        _translate_error(exc)


@router.put("/{news_id:int}/publish", response_model=NewsManageItem)
async def publish_news_admin(
    news_id: int,
    payload: NewsPublishUpdate,
    current_user=Depends(get_current_user),
):
    require_admin(current_user)
    try:
        return await NewsRepository.set_published(
            news_id,
            current_user,
            payload.is_published,
            admin=True,
        )
    except (NewsNotFoundError, NewsForbiddenError) as exc:
        _translate_error(exc)


@router.delete("/{news_id:int}")
async def delete_news_admin(news_id: int, current_user=Depends(get_current_user)):
    require_admin(current_user)
    try:
        await NewsRepository.delete(news_id, current_user, admin_platform_only=True)
        return {"status": "ok"}
    except (NewsNotFoundError, NewsForbiddenError) as exc:
        _translate_error(exc)
