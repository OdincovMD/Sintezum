"""Pydantic-схемы API новостей."""

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.news.validation import validate_news_content, validate_news_image_url

NewsScope = Literal["platform", "organization", "laboratory"]
NewsStatus = Literal["draft", "published", "blocked"]


def _clean_employee_ids(value: Optional[list[int]]) -> Optional[list[int]]:
    if value is None:
        return None
    unique_ids = list(dict.fromkeys(value))
    if len(unique_ids) > 20:
        raise ValueError("К новости можно привязать не более 20 сотрудников")
    if any(employee_id <= 0 for employee_id in unique_ids):
        raise ValueError("Некорректный идентификатор сотрудника")
    return unique_ids


class NewsOwner(BaseModel):
    type: NewsScope
    id: Optional[int] = None
    public_id: Optional[str] = None
    name: str


class NewsEmployee(BaseModel):
    id: int
    full_name: str
    positions: list[str] = Field(default_factory=list)
    academic_degree: Optional[str] = None
    photo_url: Optional[str] = None


class NewsCreate(BaseModel):
    scope: NewsScope
    organization_id: Optional[int] = None
    laboratory_id: Optional[int] = None
    title: str = Field(min_length=1, max_length=255)
    content: dict[str, Any]
    cover_url: Optional[str] = None
    employee_ids: list[int] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Заголовок обязателен")
        return value

    @field_validator("content")
    @classmethod
    def clean_content(cls, value: dict[str, Any]) -> dict[str, Any]:
        return validate_news_content(value)

    @field_validator("cover_url")
    @classmethod
    def clean_cover_url(cls, value: Optional[str]) -> Optional[str]:
        return validate_news_image_url(value)

    @field_validator("employee_ids")
    @classmethod
    def clean_employee_ids(cls, value: list[int]) -> list[int]:
        return _clean_employee_ids(value) or []


class NewsUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    content: Optional[dict[str, Any]] = None
    cover_url: Optional[str] = None
    employee_ids: Optional[list[int]] = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Заголовок обязателен")
        return value

    @field_validator("content")
    @classmethod
    def clean_content(cls, value: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
        return validate_news_content(value) if value is not None else None

    @field_validator("cover_url")
    @classmethod
    def clean_cover_url(cls, value: Optional[str]) -> Optional[str]:
        return validate_news_image_url(value)

    @field_validator("employee_ids")
    @classmethod
    def clean_employee_ids(cls, value: Optional[list[int]]) -> Optional[list[int]]:
        return _clean_employee_ids(value)


class NewsPublishUpdate(BaseModel):
    is_published: bool


class NewsListItem(BaseModel):
    id: int
    public_id: str
    title: str
    excerpt: str
    preview_image_url: Optional[str] = None
    owner: NewsOwner
    employees: list[NewsEmployee] = Field(default_factory=list)
    published_at: datetime


class NewsDetail(NewsListItem):
    content: dict[str, Any]
    cover_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class NewsManageItem(BaseModel):
    id: int
    public_id: str
    scope: NewsScope
    organization_id: Optional[int] = None
    laboratory_id: Optional[int] = None
    title: str
    content: dict[str, Any]
    cover_url: Optional[str] = None
    status: NewsStatus
    owner: NewsOwner
    employees: list[NewsEmployee] = Field(default_factory=list)
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class NewsListResponse(BaseModel):
    items: list[NewsListItem]
    total: int
    page: int
    size: int


class NewsManageListResponse(BaseModel):
    items: list[NewsManageItem]
    total: int
    page: int
    size: int
