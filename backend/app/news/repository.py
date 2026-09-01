"""Изолированный слой доступа к данным новостей."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import selectinload

from app import models
from app.database import async_session_factory
from app.news.schemas import NewsCreate, NewsUpdate
from app.news.validation import content_to_plain_text, first_image_url
from app.roles.representative.queries.helpers import generate_public_id


class NewsNotFoundError(Exception):
    pass


class NewsForbiddenError(Exception):
    pass


class NewsConflictError(Exception):
    pass


class NewsRepository:
    """CRUD и выборки новостей без расширения общего класса Orm."""

    @staticmethod
    def _role_name(user) -> str:
        return getattr(getattr(user, "role", None), "name", "") or ""

    @staticmethod
    def _owner(news, organization=None, laboratory=None) -> dict:
        if news.scope == "organization" and organization is not None:
            return {
                "type": "organization",
                "id": organization.id,
                "public_id": organization.public_id,
                "name": organization.name,
            }
        if news.scope == "laboratory" and laboratory is not None:
            return {
                "type": "laboratory",
                "id": laboratory.id,
                "public_id": laboratory.public_id,
                "name": laboratory.name,
            }
        return {"type": "platform", "id": None, "public_id": None, "name": "Синтезум"}

    @staticmethod
    def _employee(employee) -> dict:
        positions = getattr(employee, "position", None)
        if not isinstance(positions, list):
            positions = [positions] if positions else []
        return {
            "id": employee.id,
            "full_name": employee.full_name,
            "positions": positions,
            "academic_degree": employee.academic_degree,
            "photo_url": employee.photo_url,
        }

    @classmethod
    def _employees(cls, news) -> list[dict]:
        return [
            cls._employee(employee)
            for employee in sorted(
                news.employees or [],
                key=lambda item: ((item.full_name or "").casefold(), item.id),
            )
        ]

    @classmethod
    def _to_list_item(cls, news, organization=None, laboratory=None) -> dict:
        return {
            "id": news.id,
            "public_id": news.public_id,
            "title": news.title,
            "excerpt": content_to_plain_text(news.content),
            "preview_image_url": news.cover_url or first_image_url(news.content),
            "owner": cls._owner(news, organization, laboratory),
            "employees": cls._employees(news),
            "published_at": news.published_at,
        }

    @classmethod
    def _to_detail(cls, news, organization=None, laboratory=None) -> dict:
        return {
            **cls._to_list_item(news, organization, laboratory),
            "content": news.content,
            "cover_url": news.cover_url,
            "created_at": news.created_at,
            "updated_at": news.updated_at,
        }

    @classmethod
    def _to_manage(cls, news, organization=None, laboratory=None) -> dict:
        return {
            "id": news.id,
            "public_id": news.public_id,
            "scope": news.scope,
            "organization_id": news.organization_id,
            "laboratory_id": news.laboratory_id,
            "title": news.title,
            "content": news.content,
            "cover_url": news.cover_url,
            "status": news.status,
            "owner": cls._owner(news, organization, laboratory),
            "employees": cls._employees(news),
            "published_at": news.published_at,
            "created_at": news.created_at,
            "updated_at": news.updated_at,
        }

    @staticmethod
    def _joined_select():
        return (
            select(models.News, models.Organization, models.OrganizationLaboratory)
            .options(selectinload(models.News.employees))
            .outerjoin(models.Organization, models.News.organization_id == models.Organization.id)
            .outerjoin(
                models.OrganizationLaboratory,
                models.News.laboratory_id == models.OrganizationLaboratory.id,
            )
        )

    @staticmethod
    def _public_condition():
        return and_(
            models.News.status == "published",
            models.News.published_at.is_not(None),
            or_(
                models.News.scope == "platform",
                and_(
                    models.News.scope == "organization",
                    models.Organization.is_published.is_(True),
                ),
                and_(
                    models.News.scope == "laboratory",
                    models.OrganizationLaboratory.is_published.is_(True),
                ),
            ),
        )

    @classmethod
    async def list_public(
        cls,
        *,
        page: int,
        size: int,
        organization_id: Optional[int] = None,
        laboratory_id: Optional[int] = None,
    ) -> tuple[list[dict], int]:
        filters = [cls._public_condition()]
        if organization_id is not None:
            filters.append(models.News.organization_id == organization_id)
        if laboratory_id is not None:
            filters.append(models.News.laboratory_id == laboratory_id)

        async with async_session_factory() as session:
            base = cls._joined_select().where(*filters)
            stmt = (
                base.order_by(models.News.published_at.desc(), models.News.id.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
            rows = (await session.execute(stmt)).all()
            count_stmt = (
                select(func.count(models.News.id))
                .select_from(models.News)
                .outerjoin(models.Organization, models.News.organization_id == models.Organization.id)
                .outerjoin(
                    models.OrganizationLaboratory,
                    models.News.laboratory_id == models.OrganizationLaboratory.id,
                )
                .where(*filters)
            )
            total = int((await session.execute(count_stmt)).scalar() or 0)
            return [cls._to_list_item(*row) for row in rows], total

    @classmethod
    async def get_public(cls, public_id: str) -> dict:
        async with async_session_factory() as session:
            stmt = cls._joined_select().where(
                models.News.public_id == public_id,
                cls._public_condition(),
            )
            row = (await session.execute(stmt)).first()
            if not row:
                raise NewsNotFoundError
            return cls._to_detail(*row)

    @classmethod
    def _manageable_condition(cls, user):
        role = cls._role_name(user)
        if role == "platform_admin":
            return models.News.id.is_not(None)
        if role == "lab_admin" and getattr(user, "organization_id", None):
            lab_ids = select(models.OrganizationLaboratory.id).where(
                models.OrganizationLaboratory.organization_id == user.organization_id
            )
            return or_(
                models.News.organization_id == user.organization_id,
                models.News.laboratory_id.in_(lab_ids),
            )
        if role == "lab_representative":
            lab_ids = select(models.OrganizationLaboratory.id).where(
                models.OrganizationLaboratory.creator_user_id == user.id
            )
            return models.News.laboratory_id.in_(lab_ids)
        return models.News.id.is_(None)

    @classmethod
    async def list_manage(
        cls,
        user,
        *,
        page: int,
        size: int,
        status: Optional[str] = None,
        scope: Optional[str] = None,
        admin_all: bool = False,
    ) -> tuple[list[dict], int]:
        if admin_all and cls._role_name(user) != "platform_admin":
            raise NewsForbiddenError
        condition = models.News.id.is_not(None) if admin_all else cls._manageable_condition(user)
        filters = [condition]
        if status:
            filters.append(models.News.status == status)
        if scope:
            filters.append(models.News.scope == scope)
        async with async_session_factory() as session:
            stmt = (
                cls._joined_select()
                .where(*filters)
                .order_by(models.News.updated_at.desc(), models.News.id.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
            rows = (await session.execute(stmt)).all()
            total = int(
                (
                    await session.execute(
                        select(func.count(models.News.id)).where(*filters)
                    )
                ).scalar()
                or 0
            )
            return [cls._to_manage(*row) for row in rows], total

    @staticmethod
    async def _ensure_public_id(session) -> str:
        while True:
            public_id = generate_public_id()
            exists = await session.scalar(
                select(models.News.id).where(models.News.public_id == public_id)
            )
            if exists is None:
                return public_id

    @classmethod
    async def _validate_target(cls, session, user, payload: NewsCreate) -> None:
        role = cls._role_name(user)
        if payload.scope == "platform":
            if role != "platform_admin" or payload.organization_id is not None or payload.laboratory_id is not None:
                raise NewsForbiddenError
            return
        if payload.scope == "organization":
            if payload.organization_id is None or payload.laboratory_id is not None:
                raise NewsForbiddenError
            if role != "lab_admin" or payload.organization_id != getattr(user, "organization_id", None):
                raise NewsForbiddenError
            if await session.get(models.Organization, payload.organization_id) is None:
                raise NewsNotFoundError
            return
        if payload.laboratory_id is None or payload.organization_id is not None:
            raise NewsForbiddenError
        laboratory = await session.get(models.OrganizationLaboratory, payload.laboratory_id)
        if not laboratory:
            raise NewsNotFoundError
        if role == "lab_admin" and laboratory.organization_id == getattr(user, "organization_id", None):
            return
        if role == "lab_representative" and laboratory.creator_user_id == user.id:
            return
        raise NewsForbiddenError

    @classmethod
    async def _eligible_employees(
        cls,
        session,
        *,
        scope: str,
        organization_id: Optional[int],
        laboratory_id: Optional[int],
        employee_ids: Optional[list[int]] = None,
        preserve_employee_ids: Optional[list[int]] = None,
    ) -> list:
        requested_ids = list(dict.fromkeys(employee_ids or []))
        preserved_ids = set(preserve_employee_ids or [])
        if scope == "platform":
            if requested_ids:
                raise NewsConflictError("К платформенной новости нельзя привязать сотрудников")
            return []
        if employee_ids is not None and not requested_ids:
            return []

        if scope == "organization" and organization_id is not None:
            stmt = select(models.Employee).where(
                models.Employee.organization_id == organization_id
            )
        elif scope == "laboratory" and laboratory_id is not None:
            stmt = (
                select(models.Employee)
                .join(
                    models.employee_laboratories,
                    models.Employee.id == models.employee_laboratories.c.employee_id,
                )
                .where(models.employee_laboratories.c.laboratory_id == laboratory_id)
            )
        else:
            raise NewsConflictError("Некорректный источник новости")

        if requested_ids:
            if preserved_ids:
                eligible_ids = stmt.with_only_columns(models.Employee.id)
                stmt = select(models.Employee).where(
                    models.Employee.id.in_(requested_ids),
                    or_(
                        models.Employee.id.in_(eligible_ids),
                        models.Employee.id.in_(preserved_ids),
                    ),
                )
            else:
                stmt = stmt.where(models.Employee.id.in_(requested_ids))
        employees = list(
            (await session.execute(stmt.order_by(models.Employee.full_name, models.Employee.id)))
            .scalars()
            .all()
        )
        if requested_ids and {employee.id for employee in employees} != set(requested_ids):
            raise NewsConflictError("Один или несколько сотрудников не относятся к источнику новости")
        return employees

    @classmethod
    async def list_eligible_employees(
        cls,
        user,
        *,
        scope: str,
        organization_id: Optional[int] = None,
        laboratory_id: Optional[int] = None,
        admin: bool = False,
    ) -> list[dict]:
        async with async_session_factory() as session:
            if admin:
                if cls._role_name(user) != "platform_admin":
                    raise NewsForbiddenError
                if scope == "organization":
                    if organization_id is None or laboratory_id is not None:
                        raise NewsConflictError("Некорректный источник новости")
                    if await session.get(models.Organization, organization_id) is None:
                        raise NewsNotFoundError
                elif scope == "laboratory":
                    if laboratory_id is None or organization_id is not None:
                        raise NewsConflictError("Некорректный источник новости")
                    if await session.get(models.OrganizationLaboratory, laboratory_id) is None:
                        raise NewsNotFoundError
                elif scope != "platform" or organization_id is not None or laboratory_id is not None:
                    raise NewsConflictError("Некорректный источник новости")
            else:
                target = NewsCreate(
                    scope=scope,
                    organization_id=organization_id,
                    laboratory_id=laboratory_id,
                    title="Проверка источника",
                    content={"type": "doc", "content": []},
                )
                await cls._validate_target(session, user, target)
            employees = await cls._eligible_employees(
                session,
                scope=scope,
                organization_id=organization_id,
                laboratory_id=laboratory_id,
            )
            return [cls._employee(employee) for employee in employees]

    @classmethod
    async def create(cls, user, payload: NewsCreate) -> dict:
        async with async_session_factory() as session:
            await cls._validate_target(session, user, payload)
            employees = await cls._eligible_employees(
                session,
                scope=payload.scope,
                organization_id=payload.organization_id,
                laboratory_id=payload.laboratory_id,
                employee_ids=payload.employee_ids,
            )
            news = models.News(
                public_id=await cls._ensure_public_id(session),
                scope=payload.scope,
                organization_id=payload.organization_id,
                laboratory_id=payload.laboratory_id,
                author_user_id=user.id,
                title=payload.title,
                content=payload.content,
                cover_url=payload.cover_url,
                status="draft",
                employees=employees,
            )
            session.add(news)
            await session.commit()
            await session.refresh(news)
            row = (
                await session.execute(
                    cls._joined_select().where(models.News.id == news.id)
                )
            ).first()
            return cls._to_manage(*row)

    @classmethod
    async def _get_for_change(cls, session, news_id: int, user, *, admin: bool = False):
        news = await session.get(
            models.News,
            news_id,
            options=[selectinload(models.News.employees)],
        )
        if not news:
            raise NewsNotFoundError
        if admin:
            if cls._role_name(user) != "platform_admin":
                raise NewsForbiddenError
        else:
            allowed = await session.scalar(
                select(models.News.id).where(
                    models.News.id == news_id,
                    cls._manageable_condition(user),
                )
            )
            if allowed is None:
                raise NewsForbiddenError
        return news

    @classmethod
    async def update(cls, news_id: int, user, payload: NewsUpdate, *, admin: bool = False) -> dict:
        async with async_session_factory() as session:
            news = await cls._get_for_change(session, news_id, user, admin=admin)
            patch = payload.model_dump(exclude_unset=True)
            employee_ids = patch.pop("employee_ids", None)
            if employee_ids is not None:
                existing_employee_ids = [employee.id for employee in news.employees]
                news.employees = await cls._eligible_employees(
                    session,
                    scope=news.scope,
                    organization_id=news.organization_id,
                    laboratory_id=news.laboratory_id,
                    employee_ids=employee_ids,
                    preserve_employee_ids=existing_employee_ids,
                )
            for key, value in patch.items():
                setattr(news, key, value)
            news.updated_at = datetime.now(timezone.utc)
            await session.commit()
            row = (
                await session.execute(
                    cls._joined_select().where(models.News.id == news.id)
                )
            ).first()
            return cls._to_manage(*row)

    @classmethod
    async def set_published(
        cls,
        news_id: int,
        user,
        is_published: bool,
        *,
        admin: bool = False,
    ) -> dict:
        async with async_session_factory() as session:
            news = await cls._get_for_change(session, news_id, user, admin=admin)
            if not admin and news.status == "blocked":
                raise NewsConflictError
            if is_published:
                news.status = "published"
                if news.published_at is None:
                    news.published_at = datetime.now(timezone.utc)
            elif admin and news.scope != "platform":
                news.status = "blocked"
            else:
                news.status = "draft"
            news.updated_at = datetime.now(timezone.utc)
            await session.commit()
            row = (
                await session.execute(
                    cls._joined_select().where(models.News.id == news.id)
                )
            ).first()
            return cls._to_manage(*row)

    @classmethod
    async def delete(cls, news_id: int, user, *, admin_platform_only: bool = False) -> None:
        async with async_session_factory() as session:
            news = await cls._get_for_change(
                session,
                news_id,
                user,
                admin=admin_platform_only,
            )
            if admin_platform_only and news.scope != "platform":
                raise NewsForbiddenError
            await session.delete(news)
            await session.commit()
