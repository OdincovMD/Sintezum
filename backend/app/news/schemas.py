"""Pydantic-схемы API новостей."""

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.news.validation import (
    validate_news_content,
    validate_news_file_url,
    validate_news_image_url,
)

NewsScope = Literal["platform", "organization", "laboratory"]
NewsStatus = Literal["draft", "published", "blocked"]
MAX_GALLERY_IMAGES = 20
MAX_ATTACHMENTS = 10


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


class NewsAttachment(BaseModel):
    url: str
    name: str = Field(min_length=1, max_length=255)
    size: int = Field(ge=0, le=10 * 1024 * 1024)
    content_type: str = Field(default="application/octet-stream", max_length=128)

    @field_validator("url")
    @classmethod
    def clean_url(cls, value: str) -> str:
        return validate_news_file_url(value)

    @field_validator("name", "content_type")
    @classmethod
    def clean_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Название и тип файла не могут быть пустыми")
        return value


def _clean_gallery_urls(value: Optional[list[str]]) -> Optional[list[str]]:
    if value is None:
        return None
    unique_urls = list(dict.fromkeys(value))
    if len(unique_urls) > MAX_GALLERY_IMAGES:
        raise ValueError(f"В фотоальбом можно добавить не более {MAX_GALLERY_IMAGES} изображений")
    cleaned_urls = [validate_news_image_url(url) for url in unique_urls]
    if any(url is None for url in cleaned_urls):
        raise ValueError("Адрес фотографии не может быть пустым")
    return cleaned_urls


def _clean_attachments(
    value: Optional[list[NewsAttachment]],
) -> Optional[list[NewsAttachment]]:
    if value is None:
        return None
    if len(value) > MAX_ATTACHMENTS:
        raise ValueError(f"К новости можно прикрепить не более {MAX_ATTACHMENTS} файлов")
    urls = [attachment.url for attachment in value]
    if len(urls) != len(set(urls)):
        raise ValueError("Один и тот же файл прикреплён несколько раз")
    return value


class NewsCreate(BaseModel):
    scope: NewsScope
    organization_id: Optional[int] = None
    laboratory_id: Optional[int] = None
    title: str = Field(min_length=1, max_length=255)
    content: dict[str, Any]
    cover_url: Optional[str] = None
    gallery_urls: list[str] = Field(default_factory=list)
    attachments: list[NewsAttachment] = Field(default_factory=list)
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

    @field_validator("gallery_urls")
    @classmethod
    def clean_gallery_urls(cls, value: list[str]) -> list[str]:
        return _clean_gallery_urls(value) or []

    @field_validator("attachments")
    @classmethod
    def clean_attachments(cls, value: list[NewsAttachment]) -> list[NewsAttachment]:
        return _clean_attachments(value) or []

    @field_validator("employee_ids")
    @classmethod
    def clean_employee_ids(cls, value: list[int]) -> list[int]:
        return _clean_employee_ids(value) or []


class NewsUpdate(BaseModel):
    scope: Optional[NewsScope] = None
    organization_id: Optional[int] = None
    laboratory_id: Optional[int] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    content: Optional[dict[str, Any]] = None
    cover_url: Optional[str] = None
    gallery_urls: Optional[list[str]] = None
    attachments: Optional[list[NewsAttachment]] = None
    employee_ids: Optional[list[int]] = None

    @model_validator(mode="after")
    def validate_source_patch(self):
        source_fields = {"scope", "organization_id", "laboratory_id"}
        if not (self.model_fields_set & source_fields):
            return self
        if "scope" not in self.model_fields_set or self.scope is None:
            raise ValueError("Источник новости должен передаваться целиком")
        valid = (
            (self.scope == "platform" and self.organization_id is None and self.laboratory_id is None)
            or (self.scope == "organization" and self.organization_id is not None and self.laboratory_id is None)
            or (self.scope == "laboratory" and self.organization_id is None and self.laboratory_id is not None)
        )
        if not valid:
            raise ValueError("Некорректный источник новости")
        return self

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

    @field_validator("gallery_urls")
    @classmethod
    def clean_gallery_urls(cls, value: Optional[list[str]]) -> Optional[list[str]]:
        return _clean_gallery_urls(value)

    @field_validator("attachments")
    @classmethod
    def clean_attachments(
        cls,
        value: Optional[list[NewsAttachment]],
    ) -> Optional[list[NewsAttachment]]:
        return _clean_attachments(value)

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
    gallery_urls: list[str] = Field(default_factory=list)
    attachments: list[NewsAttachment] = Field(default_factory=list)
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
    gallery_urls: list[str] = Field(default_factory=list)
    attachments: list[NewsAttachment] = Field(default_factory=list)
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
