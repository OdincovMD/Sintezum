"""Публичный API новостей."""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.news.repository import NewsNotFoundError, NewsRepository
from app.news.schemas import NewsDetail, NewsListResponse

router = APIRouter(prefix="/news", tags=["news"])


@router.get("", response_model=NewsListResponse)
async def list_news(
    page: int = Query(1, ge=1),
    size: int = Query(12, ge=1, le=100),
    organization_id: Optional[int] = Query(None, ge=1),
    laboratory_id: Optional[int] = Query(None, ge=1),
):
    if organization_id is not None and laboratory_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите только организацию или лабораторию",
        )
    items, total = await NewsRepository.list_public(
        page=page,
        size=size,
        organization_id=organization_id,
        laboratory_id=laboratory_id,
    )
    return {"items": items, "total": total, "page": page, "size": size}


@router.get("/public/{public_id}", response_model=NewsDetail)
async def get_news(public_id: str):
    try:
        return await NewsRepository.get_public(public_id)
    except NewsNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Новость не найдена",
        )
