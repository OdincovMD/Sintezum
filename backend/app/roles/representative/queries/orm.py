"""
Orm — асинхронный слой для домена организаций (asyncpg, SQLAlchemy AsyncSession).
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy import insert, select, delete, exists, func, or_, and_, cast, distinct, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.sql import literal
from sqlalchemy.orm import selectinload
from sqlalchemy.types import String
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app import models
from app.database import async_session_factory
from app.config import settings
from app.core.queries.orm import Orm as CoreOrm
from app.roles.representative.queries import helpers
from app.roles.representative import ranking


class Orm:
    # =============================
    #        ORGANIZATIONS (native async)
    # =============================

    @staticmethod
    async def create_organization(
        name: str,
        avatar_url: Optional[str] = None,
        description: Optional[str] = None,
        address: Optional[str] = None,
        website: Optional[str] = None,
    ) -> models.Organization:
        async with async_session_factory() as session:
            org = models.Organization(
                name=name,
                avatar_url=avatar_url,
                description=description,
                address=address,
                website=website,
            )
            session.add(org)
            await session.flush()
            if not org.public_id:
                org.public_id = await helpers.ensure_unique_org_public_id(session)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            await session.refresh(org)
            return org

    @staticmethod
    async def get_organization(org_id: int) -> Optional[models.Organization]:
        async with async_session_factory() as session:
            stmt = select(models.Organization).where(models.Organization.id == org_id)
            result = await session.execute(stmt)
            org = result.scalars().first()
            if org and not org.public_id:
                org.public_id = await helpers.ensure_unique_org_public_id(session)
                try:
                    await session.commit()
                except SQLAlchemyError:
                    await session.rollback()
                await session.refresh(org)
            return org

    @staticmethod
    async def get_organization_by_public_id(public_id: str) -> Optional[models.Organization]:
        async with async_session_factory() as session:
            stmt = (
                select(models.Organization)
                .options(selectinload(models.Organization.creator))
                .where(models.Organization.public_id == public_id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def update_organization_ror(organization_id: int, ror_id: Optional[str]) -> models.Organization:
        async with async_session_factory() as session:
            org = await session.get(models.Organization, organization_id)
            if not org:
                raise ValueError("Organization not found")
            org.ror_id = ror_id
            await session.commit()
            await session.refresh(org)
            return org

    @staticmethod
    async def get_organizations_with_ror() -> List[models.Organization]:
        async with async_session_factory() as session:
            stmt = select(models.Organization).where(models.Organization.ror_id.isnot(None))
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def update_organization_fields(
        organization_id: int,
        name: Optional[str] = None,
        avatar_url: Optional[str] = None,
        address: Optional[str] = None,
        website: Optional[str] = None,
    ) -> Optional[models.Organization]:
        async with async_session_factory() as session:
            org = await session.get(models.Organization, organization_id)
            if not org:
                return None
            if name is not None:
                org.name = name
            if avatar_url is not None:
                org.avatar_url = avatar_url
            if address is not None:
                org.address = address
            if website is not None:
                org.website = website
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            await session.refresh(org)
            return org

    @staticmethod
    async def list_organizations() -> List[models.Organization]:
        async with async_session_factory() as session:
            stmt = select(models.Organization)
            result = await session.execute(stmt)
            orgs = list(result.scalars().all())
            needs_update = False
            for org in orgs:
                if not org.public_id:
                    org.public_id = await helpers.ensure_unique_org_public_id(session)
                    needs_update = True
            if needs_update:
                try:
                    await session.commit()
                except SQLAlchemyError:
                    await session.rollback()
            return orgs

    @staticmethod
    async def list_published_organizations() -> List[models.Organization]:
        async with async_session_factory() as session:
            stmt = select(models.Organization).where(models.Organization.is_published.is_(True))
            result = await session.execute(stmt)
            orgs = list(result.scalars().all())
            needs_update = False
            for org in orgs:
                if not org.public_id:
                    org.public_id = await helpers.ensure_unique_org_public_id(session)
                    needs_update = True
            if needs_update:
                try:
                    await session.commit()
                except SQLAlchemyError:
                    await session.rollback()
            return orgs

    @staticmethod
    async def get_organizations_by_ids(org_ids: list) -> list:
        if not org_ids:
            return []
        async with async_session_factory() as session:
            stmt = (
                select(models.Organization)
                .options(
                    selectinload(models.Organization.laboratories).selectinload(
                        models.OrganizationLaboratory.employees
                    ),
                    selectinload(models.Organization.laboratories).selectinload(
                        models.OrganizationLaboratory.equipment
                    ),
                    selectinload(models.Organization.laboratories).selectinload(
                        models.OrganizationLaboratory.head_employee
                    ),
                    selectinload(models.Organization.employees),
                    selectinload(models.Organization.equipment),
                    selectinload(models.Organization.vacancies),
                    selectinload(models.Organization.queries),
                )
                .where(
                    models.Organization.id.in_(org_ids),
                    models.Organization.is_published.is_(True),
                )
            )
            result = await session.execute(stmt)
            orgs = list(result.scalars().all())
            id_order = {oid: i for i, oid in enumerate(org_ids)}
            orgs.sort(key=lambda o: id_order.get(o.id, 999))
            return orgs

    @staticmethod
    async def get_organization_analytics_30d(
        public_ids: List[str],
    ) -> dict:
        """
        Для каждой организации (public_id) вернуть unique_views_30d и avg_time_on_page_sec
        за последние 30 дней (page_view / page_leave, без учёта просмотров создателя).
        Возвращает: { public_id: {"unique_views_30d": int, "avg_time_on_page_sec": float|None} }
        """
        if not public_ids:
            return {}
        out = {pid: {"unique_views_30d": 0, "avg_time_on_page_sec": None} for pid in public_ids}
        if not hasattr(models, "AnalyticsEvent"):
            return out
        since = datetime.now(timezone.utc) - timedelta(days=30)
        async with async_session_factory() as session:
            ae = models.AnalyticsEvent
            org = models.Organization
            join_cond = (ae.entity_id == org.public_id) & (ae.entity_type == "organization")
            creator_filter = (ae.user_id.is_(None)) | (ae.user_id != org.creator_user_id)
            # Unique viewers (distinct user_id/session_id) for page_view in last 30 days
            viewer_key = func.coalesce(cast(ae.user_id, String), ae.session_id)
            stmt_uv = (
                select(ae.entity_id, func.count(distinct(viewer_key)).label("uv"))
                .select_from(ae)
                .join(org, join_cond)
                .where(
                    ae.event_type == "page_view",
                    ae.entity_type == "organization",
                    ae.entity_id.in_(public_ids),
                    ae.created_at >= since,
                    creator_filter,
                )
                .group_by(ae.entity_id)
            )
            res = await session.execute(stmt_uv)
            for row in res.all():
                if row.entity_id:
                    out[row.entity_id]["unique_views_30d"] = row.uv
            # Avg time on page from page_leave (duration_sec or time_spent_sec in payload)
            time_sql = text("""
                SELECT ae.entity_id, AVG((COALESCE(ae.payload->>'duration_sec', ae.payload->>'time_spent_sec'))::float) AS avg_sec
                FROM analytics_events ae
                JOIN organizations o ON ae.entity_id = o.public_id AND ae.entity_type = 'organization'
                WHERE ae.event_type = 'page_leave' AND ae.entity_type = 'organization'
                  AND ae.entity_id = ANY(:public_ids)
                  AND ae.created_at >= :since
                  AND (ae.user_id IS NULL OR ae.user_id != o.creator_user_id)
                  AND (ae.payload->>'duration_sec' IS NOT NULL OR ae.payload->>'time_spent_sec' IS NOT NULL)
                GROUP BY ae.entity_id
            """)
            try:
                res = await session.execute(
                    time_sql,
                    {"public_ids": public_ids, "since": since},
                )
                for row in res.all():
                    if row.entity_id and row.avg_sec is not None:
                        out[row.entity_id]["avg_time_on_page_sec"] = round(float(row.avg_sec), 1)
            except Exception:
                pass
        return out

    @staticmethod
    async def get_laboratory_analytics_30d(
        public_ids: List[str],
    ) -> dict:
        """
        За последние 30 дней по лабораториям: unique_views_30d, avg_time_on_page_sec, cta_clicks_30d.
        Возвращает: { public_id: {"unique_views_30d": int, "avg_time_on_page_sec": float|None, "cta_clicks_30d": int} }
        """
        if not public_ids:
            return {}
        out = {
            pid: {"unique_views_30d": 0, "avg_time_on_page_sec": None, "cta_clicks_30d": 0}
            for pid in public_ids
        }
        if not hasattr(models, "AnalyticsEvent"):
            return out
        since = datetime.now(timezone.utc) - timedelta(days=30)
        async with async_session_factory() as session:
            ae = models.AnalyticsEvent
            lo = models.OrganizationLaboratory
            join_cond = (ae.entity_id == lo.public_id) & (ae.entity_type == "laboratory")
            creator_filter = (ae.user_id.is_(None)) | (ae.user_id != lo.creator_user_id)
            viewer_key = func.coalesce(cast(ae.user_id, String), ae.session_id)
            stmt_uv = (
                select(ae.entity_id, func.count(distinct(viewer_key)).label("uv"))
                .select_from(ae)
                .join(lo, join_cond)
                .where(
                    ae.event_type == "page_view",
                    ae.entity_type == "laboratory",
                    ae.entity_id.in_(public_ids),
                    ae.created_at >= since,
                    creator_filter,
                )
                .group_by(ae.entity_id)
            )
            res = await session.execute(stmt_uv)
            for row in res.all():
                if row.entity_id:
                    out[row.entity_id]["unique_views_30d"] = row.uv
            time_sql_lab = text("""
                SELECT ae.entity_id, AVG((COALESCE(ae.payload->>'duration_sec', ae.payload->>'time_spent_sec'))::float) AS avg_sec
                FROM analytics_events ae
                JOIN laboratories_organizations lo ON ae.entity_id = lo.public_id AND ae.entity_type = 'laboratory'
                WHERE ae.event_type = 'page_leave' AND ae.entity_type = 'laboratory'
                  AND ae.entity_id = ANY(:public_ids)
                  AND ae.created_at >= :since
                  AND (ae.user_id IS NULL OR ae.user_id != lo.creator_user_id)
                  AND (ae.payload->>'duration_sec' IS NOT NULL OR ae.payload->>'time_spent_sec' IS NOT NULL)
                GROUP BY ae.entity_id
            """)
            try:
                res = await session.execute(
                    time_sql_lab,
                    {"public_ids": public_ids, "since": since},
                )
                for row in res.all():
                    if row.entity_id and row.avg_sec is not None:
                        out[row.entity_id]["avg_time_on_page_sec"] = round(float(row.avg_sec), 1)
            except Exception:
                pass
            stmt_cta = (
                select(ae.entity_id, func.count(ae.id).label("cta"))
                .where(
                    ae.event_type == "button_click",
                    ae.entity_type == "laboratory",
                    ae.entity_id.in_(public_ids),
                    ae.created_at >= since,
                )
                .group_by(ae.entity_id)
            )
            res = await session.execute(stmt_cta)
            for row in res.all():
                if row.entity_id:
                    out[row.entity_id]["cta_clicks_30d"] = row.cta
        return out

    @staticmethod
    async def get_vacancy_analytics_30d(
        public_ids: List[str],
        vacancy_ids: Optional[List[int]] = None,
    ) -> dict:
        """
        За последние 30 дней по вакансиям: unique_viewers_30d, avg_time_on_page_sec.
        response_count — все отклики по вакансии (all-time).
        Возвращает: { public_id: {"unique_viewers_30d": int, "response_count": int, "avg_time_on_page_sec": float|None} }
        """
        if not public_ids:
            return {}
        out = {
            pid: {"unique_viewers_30d": 0, "response_count": 0, "avg_time_on_page_sec": None}
            for pid in public_ids
        }
        since = datetime.now(timezone.utc) - timedelta(days=30)
        async with async_session_factory() as session:
            if vacancy_ids is None:
                stmt_pid = (
                    select(models.VacancyOrganization.id)
                    .where(models.VacancyOrganization.public_id.in_(public_ids))
                )
                res = await session.execute(stmt_pid)
                vacancy_ids = [row.id for row in res.all()]
            if vacancy_ids and hasattr(models, "AnalyticsEvent"):
                ae = models.AnalyticsEvent
                vo = models.VacancyOrganization
                join_cond = (ae.entity_id == vo.public_id) & (ae.entity_type == "vacancy")
                creator_filter = (ae.user_id.is_(None)) | (ae.user_id != vo.creator_user_id)
                viewer_key = func.coalesce(cast(ae.user_id, String), ae.session_id)
                stmt_uv = (
                    select(ae.entity_id, func.count(distinct(viewer_key)).label("uv"))
                    .select_from(ae)
                    .join(vo, join_cond)
                    .where(
                        ae.event_type == "page_view",
                        ae.entity_type == "vacancy",
                        ae.entity_id.in_(public_ids),
                        ae.created_at >= since,
                        creator_filter,
                    )
                    .group_by(ae.entity_id)
                )
                res = await session.execute(stmt_uv)
                for row in res.all():
                    if row.entity_id:
                        out[row.entity_id]["unique_viewers_30d"] = row.uv
                time_sql = text("""
                    SELECT ae.entity_id, AVG((COALESCE(ae.payload->>'duration_sec', ae.payload->>'time_spent_sec'))::float) AS avg_sec
                    FROM analytics_events ae
                    JOIN vacancies_organizations vo ON ae.entity_id = vo.public_id AND ae.entity_type = 'vacancy'
                    WHERE ae.event_type = 'page_leave' AND ae.entity_type = 'vacancy'
                      AND ae.entity_id = ANY(:public_ids)
                      AND ae.created_at >= :since
                      AND (ae.user_id IS NULL OR ae.user_id != vo.creator_user_id)
                      AND (ae.payload->>'duration_sec' IS NOT NULL OR ae.payload->>'time_spent_sec' IS NOT NULL)
                    GROUP BY ae.entity_id
                """)
                try:
                    res = await session.execute(
                        time_sql,
                        {"public_ids": public_ids, "since": since},
                    )
                    for row in res.all():
                        if row.entity_id and row.avg_sec is not None:
                            out[row.entity_id]["avg_time_on_page_sec"] = round(float(row.avg_sec), 1)
                except Exception:
                    pass
            if vacancy_ids:
                stmt_resp = (
                    select(models.VacancyResponse.vacancy_id, func.count(models.VacancyResponse.id).label("cnt"))
                    .where(models.VacancyResponse.vacancy_id.in_(vacancy_ids))
                    .group_by(models.VacancyResponse.vacancy_id)
                )
                res = await session.execute(stmt_resp)
                vid_to_cnt = {row.vacancy_id: row.cnt for row in res.all()}
                stmt_pid = (
                    select(models.VacancyOrganization.id, models.VacancyOrganization.public_id)
                    .where(models.VacancyOrganization.id.in_(vacancy_ids))
                )
                res = await session.execute(stmt_pid)
                for row in res.all():
                    if row.public_id and row.id in vid_to_cnt:
                        out[row.public_id]["response_count"] = vid_to_cnt[row.id]
        return out

    @staticmethod
    async def get_query_analytics_30d(public_ids: List[str]) -> dict:
        """
        За последние 30 дней по запросам: unique_views_30d, avg_time_on_page_sec.
        Возвращает: { public_id: {"unique_views_30d": int, "avg_time_on_page_sec": float|None} }
        """
        if not public_ids:
            return {}
        out = {pid: {"unique_views_30d": 0, "avg_time_on_page_sec": None} for pid in public_ids}
        if not hasattr(models, "AnalyticsEvent"):
            return out
        since = datetime.now(timezone.utc) - timedelta(days=30)
        async with async_session_factory() as session:
            ae = models.AnalyticsEvent
            oq = models.OrganizationQuery
            join_cond = (ae.entity_id == oq.public_id) & (ae.entity_type == "query")
            creator_filter = (ae.user_id.is_(None)) | (ae.user_id != oq.creator_user_id)
            viewer_key = func.coalesce(cast(ae.user_id, String), ae.session_id)
            stmt_uv = (
                select(ae.entity_id, func.count(distinct(viewer_key)).label("uv"))
                .select_from(ae)
                .join(oq, join_cond)
                .where(
                    ae.event_type == "page_view",
                    ae.entity_type == "query",
                    ae.entity_id.in_(public_ids),
                    ae.created_at >= since,
                    creator_filter,
                )
                .group_by(ae.entity_id)
            )
            res = await session.execute(stmt_uv)
            for row in res.all():
                if row.entity_id:
                    out[row.entity_id]["unique_views_30d"] = row.uv
            time_sql_q = text("""
                SELECT ae.entity_id, AVG((COALESCE(ae.payload->>'duration_sec', ae.payload->>'time_spent_sec'))::float) AS avg_sec
                FROM analytics_events ae
                JOIN organization_queries oq ON ae.entity_id = oq.public_id AND ae.entity_type = 'query'
                WHERE ae.event_type = 'page_leave' AND ae.entity_type = 'query'
                  AND ae.entity_id = ANY(:public_ids)
                  AND ae.created_at >= :since
                  AND (ae.user_id IS NULL OR ae.user_id != oq.creator_user_id)
                  AND (ae.payload->>'duration_sec' IS NOT NULL OR ae.payload->>'time_spent_sec' IS NOT NULL)
                GROUP BY ae.entity_id
            """)
            try:
                res = await session.execute(
                    time_sql_q,
                    {"public_ids": public_ids, "since": since},
                )
                for row in res.all():
                    if row.entity_id and row.avg_sec is not None:
                        out[row.entity_id]["avg_time_on_page_sec"] = round(float(row.avg_sec), 1)
            except Exception:
                pass
        return out

    @staticmethod
    async def upsert_organization_for_user(
        user_id: int,
        name: Optional[str] = None,
        avatar_url: Optional[str] = None,
        description: Optional[str] = None,
        address: Optional[str] = None,
        website: Optional[str] = None,
        ror_id: Optional[str] = None,
        hidden_public_sections: Optional[List[str]] = None,
    ) -> models.Organization:
        async with async_session_factory() as session:
            user = await session.get(models.User, user_id)
            if not user:
                raise ValueError("User not found")

            org = None
            if user.organization_id:
                org = await session.get(models.Organization, user.organization_id)

            if not org:
                # Запретить создание организации, если пользователь уже создал сущности как представитель лаборатории
                has_lab_entities = select(literal(1)).where(
                    or_(
                        exists(
                            select(1).where(
                                models.Employee.creator_user_id == user_id,
                                models.Employee.organization_id.is_(None),
                            )
                        ),
                        exists(
                            select(1).where(
                                models.OrganizationEquipment.creator_user_id == user_id,
                                models.OrganizationEquipment.organization_id.is_(None),
                            )
                        ),
                        exists(
                            select(1).where(
                                models.OrganizationLaboratory.creator_user_id == user_id,
                                models.OrganizationLaboratory.organization_id.is_(None),
                            )
                        ),
                        exists(
                            select(1).where(
                                models.OrganizationTaskSolution.creator_user_id == user_id,
                                models.OrganizationTaskSolution.organization_id.is_(None),
                            )
                        ),
                        exists(
                            select(1).where(
                                models.OrganizationQuery.creator_user_id == user_id,
                                models.OrganizationQuery.organization_id.is_(None),
                            )
                        ),
                    )
                ).limit(1)
                if (await session.execute(has_lab_entities)).scalar() is not None:
                    raise ValueError(
                        "Невозможно создать организацию: вы уже создали сущности как представитель лаборатории "
                        "(лаборатории, сотрудники, оборудование, заявки и т.д.). "
                        "Создание организации заблокировано, чтобы вы не потеряли доступ к этим данным."
                    )
                org = models.Organization(
                    name=name or "Организация",
                    avatar_url=avatar_url,
                    description=description,
                    address=address,
                    website=website,
                    hidden_public_sections=list(hidden_public_sections or []),
                    creator_user_id=user.id,
                )
                session.add(org)
                await session.flush()
                if not org.public_id:
                    org.public_id = await helpers.ensure_unique_org_public_id(session)
                user.organization_id = org.id
            else:
                if name is not None:
                    org.name = name
                if avatar_url is not None:
                    org.avatar_url = avatar_url
                if description is not None:
                    org.description = description
                if address is not None:
                    org.address = address
                if website is not None:
                    org.website = website
                if ror_id is not None:
                    org.ror_id = ror_id
                if hidden_public_sections is not None:
                    org.hidden_public_sections = list(hidden_public_sections)

            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            await session.refresh(org)
            return org

    @staticmethod
    async def get_organization_for_user(user_id: int) -> Optional[models.Organization]:
        async with async_session_factory() as session:
            user = await session.get(models.User, user_id)
            if not user or not user.organization_id:
                return None
            return await session.get(models.Organization, user.organization_id)

    @staticmethod
    async def get_organization_representative_user_ids(org_id: int) -> List[int]:
        async with async_session_factory() as session:
            stmt = select(models.User.id).where(models.User.organization_id == org_id)
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def set_organization_published(org_id: int, is_published: bool) -> Optional[models.Organization]:
        async with async_session_factory() as session:
            org = await session.get(models.Organization, org_id)
            if not org:
                return None
            org.is_published = bool(is_published)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            await session.refresh(org)
            return org

    # =============================
    #        EMPLOYEES (native async)
    # =============================

    @staticmethod
    async def list_employees_for_org(organization_id: int) -> List[models.Employee]:
        async with async_session_factory() as session:
            stmt = (
                select(models.Employee)
                .options(selectinload(models.Employee.laboratories))
                .where(models.Employee.organization_id == organization_id)
                .order_by(models.Employee.id.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def list_employees_for_creator(creator_user_id: int) -> List[models.Employee]:
        async with async_session_factory() as session:
            stmt = (
                select(models.Employee)
                .options(selectinload(models.Employee.laboratories))
                .where(models.Employee.creator_user_id == creator_user_id)
                .order_by(models.Employee.id.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def get_employee(employee_id: int, organization_id: int) -> Optional[models.Employee]:
        async with async_session_factory() as session:
            stmt = (
                select(models.Employee)
                .options(selectinload(models.Employee.laboratories))
                .where(
                    models.Employee.id == employee_id,
                    models.Employee.organization_id == organization_id,
                )
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def get_employee_for_creator(
        employee_id: int, creator_user_id: int
    ) -> Optional[models.Employee]:
        async with async_session_factory() as session:
            stmt = (
                select(models.Employee)
                .options(selectinload(models.Employee.laboratories))
                .where(
                    models.Employee.id == employee_id,
                    models.Employee.creator_user_id == creator_user_id,
                )
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def create_employee_for_org(
        organization_id: Optional[int],
        full_name: str,
        creator_user_id: Optional[int] = None,
        positions: Optional[List[str]] = None,
        academic_degree: Optional[str] = None,
        photo_url: Optional[str] = None,
        research_interests: Optional[List[str]] = None,
        education: Optional[List[str]] = None,
        publications: Optional[List[dict]] = None,
        hindex_wos: Optional[int] = None,
        hindex_scopus: Optional[int] = None,
        hindex_rsci: Optional[int] = None,
        hindex_openalex: Optional[int] = None,
        contacts: Optional[dict] = None,
        laboratory_ids: Optional[List[int]] = None,
    ) -> models.Employee:
        async with async_session_factory() as session:
            employee = models.Employee(
                organization_id=organization_id,
                creator_user_id=creator_user_id,
                full_name=full_name,
                position=positions or [],
                academic_degree=academic_degree,
                photo_url=photo_url,
                research_interests=research_interests or [],
                education=education or [],
                publications=publications or [],
                hindex_wos=hindex_wos,
                hindex_scopus=hindex_scopus,
                hindex_rsci=hindex_rsci,
                hindex_openalex=hindex_openalex,
                contacts=contacts or {},
            )
            session.add(employee)
            await session.flush()
            if laboratory_ids is not None:
                if organization_id is not None:
                    labs = await helpers.get_labs_by_ids(
                        session, organization_id, laboratory_ids
                    )
                else:
                    labs = await helpers.get_labs_by_ids_for_creator(
                        session, creator_user_id, laboratory_ids
                    )
                if labs:
                    await session.execute(
                        insert(models.employee_laboratories),
                        [
                            {"employee_id": employee.id, "laboratory_id": lab.id}
                            for lab in labs
                        ],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.Employee)
                .options(selectinload(models.Employee.laboratories))
                .where(models.Employee.id == employee.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def update_employee(
        employee_id: int,
        organization_id: int,
        full_name: Optional[str] = None,
        positions: Optional[List[str]] = None,
        academic_degree: Optional[str] = None,
        photo_url: Optional[str] = None,
        research_interests: Optional[List[str]] = None,
        education: Optional[List[str]] = None,
        publications: Optional[List[dict]] = None,
        hindex_wos: Optional[int] = None,
        hindex_scopus: Optional[int] = None,
        hindex_rsci: Optional[int] = None,
        hindex_openalex: Optional[int] = None,
        contacts: Optional[dict] = None,
        laboratory_ids: Optional[List[int]] = None,
    ) -> Optional[models.Employee]:
        async with async_session_factory() as session:
            stmt = select(models.Employee).where(
                models.Employee.id == employee_id,
                models.Employee.organization_id == organization_id,
            )
            result = await session.execute(stmt)
            employee = result.scalars().first()
            if not employee:
                return None
            if full_name is not None:
                employee.full_name = full_name
            if positions is not None:
                employee.position = positions
            if academic_degree is not None:
                employee.academic_degree = academic_degree
            if photo_url is not None:
                employee.photo_url = photo_url
            if research_interests is not None:
                employee.research_interests = research_interests
            if education is not None:
                employee.education = education
            if publications is not None:
                employee.publications = publications
            if hindex_wos is not None:
                employee.hindex_wos = hindex_wos
            if hindex_scopus is not None:
                employee.hindex_scopus = hindex_scopus
            if hindex_rsci is not None:
                employee.hindex_rsci = hindex_rsci
            if hindex_openalex is not None:
                employee.hindex_openalex = hindex_openalex
            if contacts is not None:
                employee.contacts = contacts
            if laboratory_ids is not None:
                await session.execute(
                    delete(models.employee_laboratories).where(
                        models.employee_laboratories.c.employee_id == employee.id
                    )
                )
                labs = await helpers.get_labs_by_ids(
                    session, organization_id, laboratory_ids
                )
                if labs:
                    await session.execute(
                        insert(models.employee_laboratories),
                        [
                            {"employee_id": employee.id, "laboratory_id": lab.id}
                            for lab in labs
                        ],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.Employee)
                .options(selectinload(models.Employee.laboratories))
                .where(models.Employee.id == employee.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def _detach_researcher_from_employee_laboratories(
        session, employee: models.Employee
    ) -> List[str]:
        """Снять исследователя с лабораторий сотрудника перед удалением профиля сотрудника."""
        lab_names: List[str] = []
        if not employee.user_id:
            return lab_names
        stmt_res = select(models.Researcher).where(models.Researcher.user_id == employee.user_id)
        res_res = await session.execute(stmt_res)
        researcher = res_res.scalars().first()
        if not researcher:
            return lab_names
        for lab in (employee.laboratories or []):
            await session.execute(
                delete(models.researcher_laboratories).where(
                    models.researcher_laboratories.c.researcher_id == researcher.id,
                    models.researcher_laboratories.c.laboratory_id == lab.id,
                )
            )
            stmt_req = select(models.LabJoinRequest).where(
                models.LabJoinRequest.researcher_id == researcher.id,
                models.LabJoinRequest.laboratory_id == lab.id,
                models.LabJoinRequest.status == "approved",
            )
            req_res = await session.execute(stmt_req)
            req = req_res.scalars().first()
            if req:
                req.status = "removed"
            lab_names.append(lab.name or "Лаборатория")
        return lab_names

    @staticmethod
    async def delete_employee(employee_id: int, organization_id: int) -> Tuple[bool, Optional[int], List[str]]:
        async with async_session_factory() as session:
            stmt = (
                select(models.Employee)
                .options(selectinload(models.Employee.laboratories))
                .where(
                    models.Employee.id == employee_id,
                    models.Employee.organization_id == organization_id,
                )
            )
            result = await session.execute(stmt)
            employee = result.scalars().first()
            if not employee:
                return (False, None, [])
            lab_names = await Orm._detach_researcher_from_employee_laboratories(session, employee)
            user_id_to_notify = employee.user_id
            await session.delete(employee)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return (True, user_id_to_notify, lab_names)

    @staticmethod
    async def update_employee_for_creator(
        employee_id: int,
        creator_user_id: int,
        full_name: Optional[str] = None,
        positions: Optional[List[str]] = None,
        academic_degree: Optional[str] = None,
        photo_url: Optional[str] = None,
        research_interests: Optional[List[str]] = None,
        education: Optional[List[str]] = None,
        publications: Optional[List[dict]] = None,
        hindex_wos: Optional[int] = None,
        hindex_scopus: Optional[int] = None,
        hindex_rsci: Optional[int] = None,
        hindex_openalex: Optional[int] = None,
        contacts: Optional[dict] = None,
        laboratory_ids: Optional[List[int]] = None,
    ) -> Optional[models.Employee]:
        async with async_session_factory() as session:
            stmt = select(models.Employee).where(
                models.Employee.id == employee_id,
                models.Employee.creator_user_id == creator_user_id,
            )
            result = await session.execute(stmt)
            employee = result.scalars().first()
            if not employee:
                return None
            if full_name is not None:
                employee.full_name = full_name
            if positions is not None:
                employee.position = positions
            if academic_degree is not None:
                employee.academic_degree = academic_degree
            if photo_url is not None:
                employee.photo_url = photo_url
            if research_interests is not None:
                employee.research_interests = research_interests
            if education is not None:
                employee.education = education
            if publications is not None:
                employee.publications = publications
            if hindex_wos is not None:
                employee.hindex_wos = hindex_wos
            if hindex_scopus is not None:
                employee.hindex_scopus = hindex_scopus
            if hindex_rsci is not None:
                employee.hindex_rsci = hindex_rsci
            if hindex_openalex is not None:
                employee.hindex_openalex = hindex_openalex
            if contacts is not None:
                employee.contacts = contacts
            if laboratory_ids is not None:
                await session.execute(
                    delete(models.employee_laboratories).where(
                        models.employee_laboratories.c.employee_id == employee.id
                    )
                )
                labs = await helpers.get_labs_by_ids_for_creator(
                    session, creator_user_id, laboratory_ids
                )
                if labs:
                    await session.execute(
                        insert(models.employee_laboratories),
                        [
                            {"employee_id": employee.id, "laboratory_id": lab.id}
                            for lab in labs
                        ],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.Employee)
                .options(selectinload(models.Employee.laboratories))
                .where(models.Employee.id == employee.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def delete_employee_for_creator(
        employee_id: int, creator_user_id: int
    ) -> Tuple[bool, Optional[int], List[str]]:
        async with async_session_factory() as session:
            stmt = (
                select(models.Employee)
                .options(selectinload(models.Employee.laboratories))
                .where(
                    models.Employee.id == employee_id,
                    models.Employee.creator_user_id == creator_user_id,
                )
            )
            result = await session.execute(stmt)
            employee = result.scalars().first()
            if not employee:
                return (False, None, [])
            lab_names = await Orm._detach_researcher_from_employee_laboratories(session, employee)
            user_id_to_notify = employee.user_id
            await session.delete(employee)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return (True, user_id_to_notify, lab_names)

    @staticmethod
    async def admin_delete_employee(employee_id: int) -> Tuple[bool, Optional[int], List[str]]:
        """Удаление сотрудника по id (панель администратора, в т.ч. «осиротевшие» записи)."""
        async with async_session_factory() as session:
            stmt = (
                select(models.Employee)
                .options(selectinload(models.Employee.laboratories))
                .where(models.Employee.id == employee_id)
            )
            result = await session.execute(stmt)
            employee = result.scalars().first()
            if not employee:
                return (False, None, [])
            lab_names = await Orm._detach_researcher_from_employee_laboratories(session, employee)
            user_id_to_notify = employee.user_id
            await session.delete(employee)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return (True, user_id_to_notify, lab_names)

    # =============================
    #   EQUIPMENT (ORG PROFILE) — native async
    # =============================

    @staticmethod
    async def list_equipment_for_org(organization_id: int) -> List[models.OrganizationEquipment]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationEquipment)
                .options(selectinload(models.OrganizationEquipment.laboratories))
                .where(models.OrganizationEquipment.organization_id == organization_id)
                .order_by(models.OrganizationEquipment.id.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def list_equipment_for_creator(
        creator_user_id: int,
    ) -> List[models.OrganizationEquipment]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationEquipment)
                .options(selectinload(models.OrganizationEquipment.laboratories))
                .where(models.OrganizationEquipment.creator_user_id == creator_user_id)
                .order_by(models.OrganizationEquipment.id.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def create_equipment_for_org(
        organization_id: Optional[int],
        name: str,
        creator_user_id: Optional[int] = None,
        description: Optional[str] = None,
        characteristics: Optional[str] = None,
        image_urls: Optional[List[str]] = None,
        laboratory_ids: Optional[List[int]] = None,
    ) -> models.OrganizationEquipment:
        async with async_session_factory() as session:
            equipment = models.OrganizationEquipment(
                organization_id=organization_id,
                creator_user_id=creator_user_id,
                name=name,
                description=description,
                characteristics=characteristics,
                image_urls=image_urls or [],
            )
            session.add(equipment)
            await session.flush()
            if laboratory_ids is not None:
                if organization_id is not None:
                    labs = await helpers.get_labs_by_ids(
                        session, organization_id, laboratory_ids
                    )
                else:
                    labs = await helpers.get_labs_by_ids_for_creator(
                        session, creator_user_id, laboratory_ids
                    )
                if labs:
                    await session.execute(
                        insert(models.laboratory_equipment),
                        [
                            {"laboratory_id": lab.id, "equipment_id": equipment.id}
                            for lab in labs
                        ],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationEquipment)
                .options(selectinload(models.OrganizationEquipment.laboratories))
                .where(models.OrganizationEquipment.id == equipment.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def get_equipment(equipment_id: int, organization_id: int) -> Optional[models.OrganizationEquipment]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationEquipment)
                .options(selectinload(models.OrganizationEquipment.laboratories))
                .where(
                    models.OrganizationEquipment.id == equipment_id,
                    models.OrganizationEquipment.organization_id == organization_id,
                )
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def get_equipment_for_creator(
        equipment_id: int, creator_user_id: int
    ) -> Optional[models.OrganizationEquipment]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationEquipment)
                .options(selectinload(models.OrganizationEquipment.laboratories))
                .where(
                    models.OrganizationEquipment.id == equipment_id,
                    models.OrganizationEquipment.creator_user_id == creator_user_id,
                )
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def update_equipment(
        equipment_id: int,
        organization_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        characteristics: Optional[str] = None,
        image_urls: Optional[List[str]] = None,
        laboratory_ids: Optional[List[int]] = None,
    ) -> Optional[models.OrganizationEquipment]:
        async with async_session_factory() as session:
            stmt = select(models.OrganizationEquipment).where(
                models.OrganizationEquipment.id == equipment_id,
                models.OrganizationEquipment.organization_id == organization_id,
            )
            result = await session.execute(stmt)
            equipment = result.scalars().first()
            if not equipment:
                return None
            if name is not None:
                equipment.name = name
            if description is not None:
                equipment.description = description
            if characteristics is not None:
                equipment.characteristics = characteristics
            if image_urls is not None:
                equipment.image_urls = image_urls
            if laboratory_ids is not None:
                await session.execute(
                    delete(models.laboratory_equipment).where(
                        models.laboratory_equipment.c.equipment_id == equipment.id
                    )
                )
                labs = await helpers.get_labs_by_ids(
                    session, organization_id, laboratory_ids
                )
                if labs:
                    await session.execute(
                        insert(models.laboratory_equipment),
                        [
                            {"laboratory_id": lab.id, "equipment_id": equipment.id}
                            for lab in labs
                        ],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationEquipment)
                .options(selectinload(models.OrganizationEquipment.laboratories))
                .where(models.OrganizationEquipment.id == equipment.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def delete_equipment(equipment_id: int, organization_id: int) -> bool:
        async with async_session_factory() as session:
            stmt = select(models.OrganizationEquipment).where(
                models.OrganizationEquipment.id == equipment_id,
                models.OrganizationEquipment.organization_id == organization_id,
            )
            result = await session.execute(stmt)
            equipment = result.scalars().first()
            if not equipment:
                return False
            await session.delete(equipment)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return True

    @staticmethod
    async def update_equipment_for_creator(
        equipment_id: int,
        creator_user_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        characteristics: Optional[str] = None,
        image_urls: Optional[List[str]] = None,
        laboratory_ids: Optional[List[int]] = None,
    ) -> Optional[models.OrganizationEquipment]:
        async with async_session_factory() as session:
            stmt = select(models.OrganizationEquipment).where(
                models.OrganizationEquipment.id == equipment_id,
                models.OrganizationEquipment.creator_user_id == creator_user_id,
            )
            result = await session.execute(stmt)
            equipment = result.scalars().first()
            if not equipment:
                return None
            if name is not None:
                equipment.name = name
            if description is not None:
                equipment.description = description
            if characteristics is not None:
                equipment.characteristics = characteristics
            if image_urls is not None:
                equipment.image_urls = image_urls
            if laboratory_ids is not None:
                await session.execute(
                    delete(models.laboratory_equipment).where(
                        models.laboratory_equipment.c.equipment_id == equipment.id
                    )
                )
                labs = await helpers.get_labs_by_ids_for_creator(
                    session, creator_user_id, laboratory_ids
                )
                if labs:
                    await session.execute(
                        insert(models.laboratory_equipment),
                        [
                            {"laboratory_id": lab.id, "equipment_id": equipment.id}
                            for lab in labs
                        ],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationEquipment)
                .options(selectinload(models.OrganizationEquipment.laboratories))
                .where(models.OrganizationEquipment.id == equipment.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def delete_equipment_for_creator(equipment_id: int, creator_user_id: int) -> bool:
        async with async_session_factory() as session:
            stmt = select(models.OrganizationEquipment).where(
                models.OrganizationEquipment.id == equipment_id,
                models.OrganizationEquipment.creator_user_id == creator_user_id,
            )
            result = await session.execute(stmt)
            equipment = result.scalars().first()
            if not equipment:
                return False
            await session.delete(equipment)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return True

    # =============================
    #   LABORATORIES (ORG PROFILE) — native async
    # =============================

    @staticmethod
    def _lab_select_options():
        """Общие selectinload для лабораторий с полными связями (избегаем lazy load после закрытия сессии)."""
        return (
            selectinload(models.OrganizationLaboratory.organization),
            selectinload(models.OrganizationLaboratory.head_employee),
            selectinload(models.OrganizationLaboratory.employees),
            selectinload(models.OrganizationLaboratory.researchers),
            selectinload(models.OrganizationLaboratory.queries),
            selectinload(models.OrganizationLaboratory.equipment).selectinload(
                models.OrganizationEquipment.laboratories
            ),
            selectinload(models.OrganizationLaboratory.task_solutions).selectinload(
                models.OrganizationTaskSolution.laboratories
            ),
        )

    @staticmethod
    async def list_laboratories_for_org(organization_id: int) -> List[models.OrganizationLaboratory]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationLaboratory)
                .options(*Orm._lab_select_options())
                .where(models.OrganizationLaboratory.organization_id == organization_id)
                .order_by(models.OrganizationLaboratory.id.desc())
            )
            result = await session.execute(stmt)
            labs = list(result.scalars().all())
            needs_update = False
            for lab in labs:
                if not lab.public_id:
                    lab.public_id = await helpers.ensure_unique_lab_public_id(session)
                    needs_update = True
            if needs_update:
                try:
                    await session.commit()
                except SQLAlchemyError:
                    await session.rollback()
            return labs

    @staticmethod
    async def count_standalone_labs_for_creator(creator_user_id: int) -> int:
        """Count standalone labs (organization_id is None) for a creator."""
        async with async_session_factory() as session:
            stmt = select(func.count()).select_from(models.OrganizationLaboratory).where(
                models.OrganizationLaboratory.creator_user_id == creator_user_id,
                models.OrganizationLaboratory.organization_id.is_(None),
            )
            result = await session.execute(stmt)
            return result.scalar() or 0

    @staticmethod
    async def count_vacancies_for_creator(creator_user_id: int) -> int:
        """Count total vacancies by creator (для лимита Basic)."""
        async with async_session_factory() as session:
            stmt = select(func.count()).select_from(models.VacancyOrganization).where(
                models.VacancyOrganization.creator_user_id == creator_user_id,
            )
            result = await session.execute(stmt)
            return result.scalar() or 0

    @staticmethod
    async def count_queries_for_creator(creator_user_id: int) -> int:
        """Count total queries by creator (для лимита Basic)."""
        async with async_session_factory() as session:
            stmt = select(func.count()).select_from(models.OrganizationQuery).where(
                models.OrganizationQuery.creator_user_id == creator_user_id,
            )
            result = await session.execute(stmt)
            return result.scalar() or 0

    @staticmethod
    async def list_laboratories_for_creator(
        creator_user_id: int,
    ) -> List[models.OrganizationLaboratory]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationLaboratory)
                .options(*Orm._lab_select_options())
                .where(models.OrganizationLaboratory.creator_user_id == creator_user_id)
                .order_by(models.OrganizationLaboratory.id.desc())
            )
            result = await session.execute(stmt)
            labs = list(result.scalars().all())
            needs_update = False
            for lab in labs:
                if not lab.public_id:
                    lab.public_id = await helpers.ensure_unique_lab_public_id(session)
                    needs_update = True
            if needs_update:
                try:
                    await session.commit()
                except SQLAlchemyError:
                    await session.rollback()
            return labs

    @staticmethod
    async def list_published_laboratories_for_org(
        organization_id: int,
    ) -> List[models.OrganizationLaboratory]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationLaboratory)
                .options(*Orm._lab_select_options())
                .where(
                    models.OrganizationLaboratory.organization_id == organization_id,
                    models.OrganizationLaboratory.is_published.is_(True),
                )
                .order_by(models.OrganizationLaboratory.id.desc())
            )
            result = await session.execute(stmt)
            labs = list(result.scalars().all())
            needs_update = False
            for lab in labs:
                if not lab.public_id:
                    lab.public_id = await helpers.ensure_unique_lab_public_id(session)
                    needs_update = True
            if needs_update:
                try:
                    await session.commit()
                except SQLAlchemyError:
                    await session.rollback()
            return labs

    @staticmethod
    async def list_published_laboratories() -> List[models.OrganizationLaboratory]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationLaboratory)
                .options(*Orm._lab_select_options())
                .where(models.OrganizationLaboratory.is_published.is_(True))
                .order_by(models.OrganizationLaboratory.id.desc())
            )
            result = await session.execute(stmt)
            labs = list(result.scalars().all())
            needs_update = False
            for lab in labs:
                if not lab.public_id:
                    lab.public_id = await helpers.ensure_unique_lab_public_id(session)
                    needs_update = True
            if needs_update:
                try:
                    await session.commit()
                except SQLAlchemyError:
                    await session.rollback()
            return labs

    @staticmethod
    async def get_laboratories_by_ids(lab_ids: List[int]) -> List[models.OrganizationLaboratory]:
        if not lab_ids:
            return []
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationLaboratory)
                .options(*Orm._lab_select_options())
                .where(
                    models.OrganizationLaboratory.id.in_(lab_ids),
                    models.OrganizationLaboratory.is_published.is_(True),
                )
            )
            result = await session.execute(stmt)
            labs = list(result.scalars().all())
            id_order = {lid: i for i, lid in enumerate(lab_ids)}
            labs.sort(key=lambda l: id_order.get(l.id, 999))
            return labs

    @staticmethod
    async def get_laboratory_by_public_id(public_id: str) -> Optional[models.OrganizationLaboratory]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationLaboratory)
                .options(
                    selectinload(models.OrganizationLaboratory.organization).selectinload(
                        models.Organization.creator
                    ),
                    selectinload(models.OrganizationLaboratory.head_employee).selectinload(
                        models.Employee.user
                    ),
                    selectinload(models.OrganizationLaboratory.creator),
                    selectinload(models.OrganizationLaboratory.employees).selectinload(
                        models.Employee.laboratories
                    ),
                    selectinload(models.OrganizationLaboratory.researchers),
                    selectinload(models.OrganizationLaboratory.equipment).selectinload(
                        models.OrganizationEquipment.laboratories
                    ),
                    selectinload(models.OrganizationLaboratory.task_solutions).selectinload(
                        models.OrganizationTaskSolution.laboratories
                    ),
                )
                .where(models.OrganizationLaboratory.public_id == public_id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def create_laboratory_for_org(
        organization_id: Optional[int],
        name: str,
        creator_user_id: Optional[int] = None,
        description: Optional[str] = None,
        activities: Optional[str] = None,
        image_urls: Optional[List[str]] = None,
        employee_ids: Optional[List[int]] = None,
        head_employee_id: Optional[int] = None,
        equipment_ids: Optional[List[int]] = None,
        task_solution_ids: Optional[List[int]] = None,
        hidden_public_sections: Optional[List[str]] = None,
    ) -> models.OrganizationLaboratory:
        # Basic tier limit: up to N standalone labs (organization_id is None)
        if organization_id is None and creator_user_id is not None:
            tier = await CoreOrm.get_subscription_tier(creator_user_id)
            if tier == "basic":
                standalone_count = await Orm.count_standalone_labs_for_creator(creator_user_id)
                limit = settings.BASIC_MAX_STANDALONE_LABS
                if standalone_count >= limit:
                    raise ValueError(
                        f"Тариф Basic ограничивает до {limit} самостоятельных лабораторий. "
                        "Перейдите на Pro для неограниченного количества."
                    )
        async with async_session_factory() as session:
            lab = models.OrganizationLaboratory(
                organization_id=organization_id,
                creator_user_id=creator_user_id,
                name=name,
                description=description,
                activities=activities,
                image_urls=image_urls or [],
                hidden_public_sections=list(hidden_public_sections or []),
            )
            session.add(lab)
            await session.flush()
            if not lab.public_id:
                lab.public_id = await helpers.ensure_unique_lab_public_id(session)
            eids = list(employee_ids) if employee_ids is not None else []
            if head_employee_id is not None:
                lab.head_employee_id = head_employee_id
                if head_employee_id not in eids:
                    eids = list(set(eids) | {head_employee_id})
            if employee_ids is not None or head_employee_id is not None:
                if organization_id is not None:
                    emps = await helpers.get_employees_by_ids(session, organization_id, eids)
                elif creator_user_id is not None:
                    emps = await helpers.get_employees_by_ids_for_creator(
                        session, creator_user_id, eids
                    )
                else:
                    emps = []
                if emps:
                    await session.execute(
                        insert(models.employee_laboratories),
                        [{"employee_id": e.id, "laboratory_id": lab.id} for e in emps],
                    )
            if equipment_ids is not None:
                if organization_id is not None:
                    eqs = await helpers.get_equipment_by_ids(
                        session, organization_id, equipment_ids
                    )
                elif creator_user_id is not None:
                    eqs = await helpers.get_equipment_by_ids_for_creator(
                        session, creator_user_id, equipment_ids
                    )
                else:
                    eqs = []
                if eqs:
                    await session.execute(
                        insert(models.laboratory_equipment),
                        [{"laboratory_id": lab.id, "equipment_id": e.id} for e in eqs],
                    )
            if task_solution_ids is not None:
                if organization_id is not None:
                    tss = await helpers.get_task_solutions_by_ids(
                        session, organization_id, task_solution_ids
                    )
                elif creator_user_id is not None:
                    tss = await helpers.get_task_solutions_by_ids_for_creator(
                        session, creator_user_id, task_solution_ids
                    )
                else:
                    tss = []
                if tss:
                    await session.execute(
                        insert(models.task_solution_laboratories),
                        [
                            {"laboratory_id": lab.id, "task_solution_id": ts.id}
                            for ts in tss
                        ],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationLaboratory)
                .options(*Orm._lab_select_options())
                .where(models.OrganizationLaboratory.id == lab.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def update_laboratory(
        laboratory_id: int,
        organization_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        activities: Optional[str] = None,
        image_urls: Optional[List[str]] = None,
        employee_ids: Optional[List[int]] = None,
        head_employee_id: Optional[int] = None,
        equipment_ids: Optional[List[int]] = None,
        task_solution_ids: Optional[List[int]] = None,
        hidden_public_sections: Optional[List[str]] = None,
    ) -> Optional[models.OrganizationLaboratory]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationLaboratory)
                .options(selectinload(models.OrganizationLaboratory.employees))
                .where(
                    models.OrganizationLaboratory.id == laboratory_id,
                    models.OrganizationLaboratory.organization_id == organization_id,
                )
            )
            result = await session.execute(stmt)
            lab = result.scalars().first()
            if not lab:
                return None
            if name is not None:
                lab.name = name
            if description is not None:
                lab.description = description
            if activities is not None:
                lab.activities = activities
            if image_urls is not None:
                lab.image_urls = image_urls
            if hidden_public_sections is not None:
                lab.hidden_public_sections = list(hidden_public_sections)
            if employee_ids is not None or head_employee_id is not None:
                eids = list(employee_ids) if employee_ids is not None else [e.id for e in lab.employees]
                if head_employee_id is not None:
                    lab.head_employee_id = head_employee_id
                    if head_employee_id not in eids:
                        eids = list(set(eids) | {head_employee_id})
                else:
                    lab.head_employee_id = None
                await session.execute(
                    delete(models.employee_laboratories).where(
                        models.employee_laboratories.c.laboratory_id == lab.id
                    )
                )
                emps = await helpers.get_employees_by_ids(session, organization_id, eids)
                if emps:
                    await session.execute(
                        insert(models.employee_laboratories),
                        [{"employee_id": e.id, "laboratory_id": lab.id} for e in emps],
                    )
            if equipment_ids is not None:
                await session.execute(
                    delete(models.laboratory_equipment).where(
                        models.laboratory_equipment.c.laboratory_id == lab.id
                    )
                )
                eqs = await helpers.get_equipment_by_ids(
                    session, organization_id, equipment_ids
                )
                if eqs:
                    await session.execute(
                        insert(models.laboratory_equipment),
                        [{"laboratory_id": lab.id, "equipment_id": e.id} for e in eqs],
                    )
            if task_solution_ids is not None:
                await session.execute(
                    delete(models.task_solution_laboratories).where(
                        models.task_solution_laboratories.c.laboratory_id == lab.id
                    )
                )
                tss = await helpers.get_task_solutions_by_ids(
                    session, organization_id, task_solution_ids
                )
                if tss:
                    await session.execute(
                        insert(models.task_solution_laboratories),
                        [
                            {"laboratory_id": lab.id, "task_solution_id": ts.id}
                            for ts in tss
                        ],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationLaboratory)
                .options(*Orm._lab_select_options())
                .where(models.OrganizationLaboratory.id == laboratory_id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def delete_laboratory(
        laboratory_id: int, organization_id: int
    ) -> Tuple[bool, Optional[int], str, bool]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationLaboratory)
                .options(
                    selectinload(models.OrganizationLaboratory.equipment),
                    selectinload(models.OrganizationLaboratory.employees),
                    selectinload(models.OrganizationLaboratory.task_solutions),
                    selectinload(models.OrganizationLaboratory.queries),
                )
                .where(
                    models.OrganizationLaboratory.id == laboratory_id,
                    models.OrganizationLaboratory.organization_id == organization_id,
                )
            )
            result = await session.execute(stmt)
            lab = result.scalars().first()
            if not lab:
                return (False, None, "", False)
            lab_name = lab.name or "Лаборатория"
            lab_rep_user_id = lab.creator_user_id
            await helpers.close_lab_join_requests_for_lab(session, laboratory_id)
            await helpers.unlink_lab_from_org(session, lab)
            stmt_org_req = select(models.OrgJoinRequest).where(
                models.OrgJoinRequest.laboratory_id == laboratory_id,
                models.OrgJoinRequest.organization_id == organization_id,
                models.OrgJoinRequest.status == "approved",
            )
            result_req = await session.execute(stmt_org_req)
            req = result_req.scalars().first()
            if req:
                req.status = "left"
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return (True, lab_rep_user_id, lab_name, False)

    @staticmethod
    async def update_laboratory_for_creator(
        laboratory_id: int,
        creator_user_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        activities: Optional[str] = None,
        image_urls: Optional[List[str]] = None,
        employee_ids: Optional[List[int]] = None,
        head_employee_id: Optional[int] = None,
        equipment_ids: Optional[List[int]] = None,
        task_solution_ids: Optional[List[int]] = None,
        hidden_public_sections: Optional[List[str]] = None,
    ) -> Optional[models.OrganizationLaboratory]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationLaboratory)
                .options(selectinload(models.OrganizationLaboratory.employees))
                .where(
                    models.OrganizationLaboratory.id == laboratory_id,
                    models.OrganizationLaboratory.creator_user_id == creator_user_id,
                )
            )
            result = await session.execute(stmt)
            lab = result.scalars().first()
            if not lab:
                return None
            if name is not None:
                lab.name = name
            if description is not None:
                lab.description = description
            if activities is not None:
                lab.activities = activities
            if image_urls is not None:
                lab.image_urls = image_urls
            if hidden_public_sections is not None:
                lab.hidden_public_sections = list(hidden_public_sections)
            if employee_ids is not None or head_employee_id is not None:
                eids = list(employee_ids) if employee_ids is not None else [e.id for e in lab.employees]
                if head_employee_id is not None:
                    lab.head_employee_id = head_employee_id
                    if head_employee_id not in eids:
                        eids = list(set(eids) | {head_employee_id})
                else:
                    lab.head_employee_id = None
                await session.execute(
                    delete(models.employee_laboratories).where(
                        models.employee_laboratories.c.laboratory_id == lab.id
                    )
                )
                emps = await helpers.get_employees_by_ids_for_creator(
                    session, creator_user_id, eids
                )
                if emps:
                    await session.execute(
                        insert(models.employee_laboratories),
                        [{"employee_id": e.id, "laboratory_id": lab.id} for e in emps],
                    )
            if equipment_ids is not None:
                await session.execute(
                    delete(models.laboratory_equipment).where(
                        models.laboratory_equipment.c.laboratory_id == lab.id
                    )
                )
                eqs = await helpers.get_equipment_by_ids_for_creator(
                    session, creator_user_id, equipment_ids
                )
                if eqs:
                    await session.execute(
                        insert(models.laboratory_equipment),
                        [{"laboratory_id": lab.id, "equipment_id": e.id} for e in eqs],
                    )
            if task_solution_ids is not None:
                await session.execute(
                    delete(models.task_solution_laboratories).where(
                        models.task_solution_laboratories.c.laboratory_id == lab.id
                    )
                )
                tss = await helpers.get_task_solutions_by_ids_for_creator(
                    session, creator_user_id, task_solution_ids
                )
                if tss:
                    await session.execute(
                        insert(models.task_solution_laboratories),
                        [
                            {"laboratory_id": lab.id, "task_solution_id": ts.id}
                            for ts in tss
                        ],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationLaboratory)
                .options(*Orm._lab_select_options())
                .where(models.OrganizationLaboratory.id == laboratory_id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def set_laboratory_published_for_creator(
        laboratory_id: int,
        creator_user_id: int,
        is_published: bool,
    ) -> Optional[models.OrganizationLaboratory]:
        async with async_session_factory() as session:
            stmt = select(models.OrganizationLaboratory).where(
                models.OrganizationLaboratory.id == laboratory_id,
                models.OrganizationLaboratory.creator_user_id == creator_user_id,
            )
            result = await session.execute(stmt)
            lab = result.scalars().first()
            if not lab:
                return None
            lab.is_published = bool(is_published)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationLaboratory)
                .options(*Orm._lab_select_options())
                .where(
                    models.OrganizationLaboratory.id == laboratory_id,
                    models.OrganizationLaboratory.creator_user_id == creator_user_id,
                )
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def delete_laboratory_for_creator(
        laboratory_id: int, creator_user_id: int
    ) -> Tuple[bool, Optional[int], str, bool]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationLaboratory)
                .options(
                    selectinload(models.OrganizationLaboratory.equipment),
                    selectinload(models.OrganizationLaboratory.employees),
                    selectinload(models.OrganizationLaboratory.task_solutions),
                    selectinload(models.OrganizationLaboratory.queries),
                )
                .where(
                    models.OrganizationLaboratory.id == laboratory_id,
                    models.OrganizationLaboratory.creator_user_id == creator_user_id,
                )
            )
            result = await session.execute(stmt)
            lab = result.scalars().first()
            if not lab:
                return (False, None, "", False)
            lab_name = lab.name or "Лаборатория"
            lab_rep_user_id = lab.creator_user_id
            await helpers.close_lab_join_requests_for_lab(session, laboratory_id)
            fully_deleted = False
            if lab.organization_id is not None:
                await helpers.unlink_lab_from_org(session, lab)
            else:
                await session.delete(lab)
                fully_deleted = True
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return (True, lab_rep_user_id, lab_name, fully_deleted)

    @staticmethod
    async def delete_laboratory_orphan(laboratory_id: int) -> Tuple[bool, Optional[int], str, bool]:
        """Полное удаление лаборатории без organization_id и creator_user_id (админ)."""
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationLaboratory)
                .options(
                    selectinload(models.OrganizationLaboratory.equipment),
                    selectinload(models.OrganizationLaboratory.employees),
                    selectinload(models.OrganizationLaboratory.task_solutions),
                    selectinload(models.OrganizationLaboratory.queries),
                )
                .where(models.OrganizationLaboratory.id == laboratory_id)
            )
            result = await session.execute(stmt)
            lab = result.scalars().first()
            if not lab:
                return (False, None, "", False)
            if lab.organization_id is not None or lab.creator_user_id is not None:
                return (False, None, "", False)
            lab_name = lab.name or "Лаборатория"
            lab_rep_user_id = lab.creator_user_id
            await helpers.close_lab_join_requests_for_lab(session, laboratory_id)
            await session.delete(lab)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return (True, lab_rep_user_id, lab_name, True)

    @staticmethod
    async def admin_delete_laboratory(laboratory_id: int) -> Tuple[bool, Optional[int], str, bool]:
        """Удаление лаборатории для админки: по фактическим organization_id / creator_user_id или сирота."""
        lab = await Orm.get_laboratory_by_id(laboratory_id)
        if not lab:
            return (False, None, "", False)
        if lab.organization_id is not None:
            return await Orm.delete_laboratory(laboratory_id, lab.organization_id)
        if lab.creator_user_id is not None:
            return await Orm.delete_laboratory_for_creator(laboratory_id, lab.creator_user_id)
        return await Orm.delete_laboratory_orphan(laboratory_id)

    # =============================
    #   TASK SOLUTIONS (ORG) — native async
    # =============================

    @staticmethod
    async def list_task_solutions_for_org(
        organization_id: int,
    ) -> List[models.OrganizationTaskSolution]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationTaskSolution)
                .options(selectinload(models.OrganizationTaskSolution.laboratories))
                .where(models.OrganizationTaskSolution.organization_id == organization_id)
                .order_by(models.OrganizationTaskSolution.id.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def list_task_solutions_for_creator(
        creator_user_id: int,
    ) -> List[models.OrganizationTaskSolution]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationTaskSolution)
                .options(selectinload(models.OrganizationTaskSolution.laboratories))
                .where(models.OrganizationTaskSolution.creator_user_id == creator_user_id)
                .order_by(models.OrganizationTaskSolution.id.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def create_task_solution_for_org(
        organization_id: Optional[int],
        title: str,
        creator_user_id: Optional[int] = None,
        task_description: Optional[str] = None,
        solution_description: Optional[str] = None,
        article_links: Optional[List[str]] = None,
        solution_deadline: Optional[str] = None,
        grant_info: Optional[str] = None,
        cost: Optional[str] = None,
        external_solutions: Optional[str] = None,
        laboratory_ids: Optional[List[int]] = None,
    ) -> models.OrganizationTaskSolution:
        async with async_session_factory() as session:
            task = models.OrganizationTaskSolution(
                organization_id=organization_id,
                creator_user_id=creator_user_id,
                title=title,
                task_description=task_description,
                solution_description=solution_description,
                article_links=article_links or [],
                solution_deadline=solution_deadline,
                grant_info=grant_info,
                cost=cost,
                external_solutions=external_solutions,
            )
            session.add(task)
            await session.flush()
            if laboratory_ids is not None:
                if organization_id is not None:
                    labs = await helpers.get_labs_by_ids(
                        session, organization_id, laboratory_ids
                    )
                else:
                    labs = await helpers.get_labs_by_ids_for_creator(
                        session, creator_user_id, laboratory_ids
                    )
                if labs:
                    await session.execute(
                        insert(models.task_solution_laboratories),
                        [
                            {"task_solution_id": task.id, "laboratory_id": lab.id}
                            for lab in labs
                        ],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationTaskSolution)
                .options(selectinload(models.OrganizationTaskSolution.laboratories))
                .where(models.OrganizationTaskSolution.id == task.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def update_task_solution(
        task_id: int,
        organization_id: int,
        title: Optional[str] = None,
        task_description: Optional[str] = None,
        solution_description: Optional[str] = None,
        article_links: Optional[List[str]] = None,
        solution_deadline: Optional[str] = None,
        grant_info: Optional[str] = None,
        cost: Optional[str] = None,
        external_solutions: Optional[str] = None,
        laboratory_ids: Optional[List[int]] = None,
    ) -> Optional[models.OrganizationTaskSolution]:
        async with async_session_factory() as session:
            stmt = select(models.OrganizationTaskSolution).where(
                models.OrganizationTaskSolution.id == task_id,
                models.OrganizationTaskSolution.organization_id == organization_id,
            )
            result = await session.execute(stmt)
            task = result.scalars().first()
            if not task:
                return None
            if title is not None:
                task.title = title
            if task_description is not None:
                task.task_description = task_description
            if solution_description is not None:
                task.solution_description = solution_description
            if article_links is not None:
                task.article_links = article_links
            if solution_deadline is not None:
                task.solution_deadline = solution_deadline
            if grant_info is not None:
                task.grant_info = grant_info
            if cost is not None:
                task.cost = cost
            if external_solutions is not None:
                task.external_solutions = external_solutions
            if laboratory_ids is not None:
                await session.execute(
                    delete(models.task_solution_laboratories).where(
                        models.task_solution_laboratories.c.task_solution_id == task.id
                    )
                )
                labs = await helpers.get_labs_by_ids(
                    session, organization_id, laboratory_ids
                )
                if labs:
                    await session.execute(
                        insert(models.task_solution_laboratories),
                        [
                            {"task_solution_id": task.id, "laboratory_id": lab.id}
                            for lab in labs
                        ],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationTaskSolution)
                .options(selectinload(models.OrganizationTaskSolution.laboratories))
                .where(models.OrganizationTaskSolution.id == task.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def delete_task_solution(task_id: int, organization_id: int) -> bool:
        async with async_session_factory() as session:
            stmt = select(models.OrganizationTaskSolution).where(
                models.OrganizationTaskSolution.id == task_id,
                models.OrganizationTaskSolution.organization_id == organization_id,
            )
            result = await session.execute(stmt)
            task = result.scalars().first()
            if not task:
                return False
            await session.delete(task)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return True

    @staticmethod
    async def update_task_solution_for_creator(
        task_id: int,
        creator_user_id: int,
        title: Optional[str] = None,
        task_description: Optional[str] = None,
        solution_description: Optional[str] = None,
        article_links: Optional[List[str]] = None,
        solution_deadline: Optional[str] = None,
        grant_info: Optional[str] = None,
        cost: Optional[str] = None,
        external_solutions: Optional[str] = None,
        laboratory_ids: Optional[List[int]] = None,
    ) -> Optional[models.OrganizationTaskSolution]:
        async with async_session_factory() as session:
            stmt = select(models.OrganizationTaskSolution).where(
                models.OrganizationTaskSolution.id == task_id,
                models.OrganizationTaskSolution.creator_user_id == creator_user_id,
            )
            result = await session.execute(stmt)
            task = result.scalars().first()
            if not task:
                return None
            if title is not None:
                task.title = title
            if task_description is not None:
                task.task_description = task_description
            if solution_description is not None:
                task.solution_description = solution_description
            if article_links is not None:
                task.article_links = article_links
            if solution_deadline is not None:
                task.solution_deadline = solution_deadline
            if grant_info is not None:
                task.grant_info = grant_info
            if cost is not None:
                task.cost = cost
            if external_solutions is not None:
                task.external_solutions = external_solutions
            if laboratory_ids is not None:
                await session.execute(
                    delete(models.task_solution_laboratories).where(
                        models.task_solution_laboratories.c.task_solution_id == task.id
                    )
                )
                labs = await helpers.get_labs_by_ids_for_creator(
                    session, creator_user_id, laboratory_ids
                )
                if labs:
                    await session.execute(
                        insert(models.task_solution_laboratories),
                        [
                            {"task_solution_id": task.id, "laboratory_id": lab.id}
                            for lab in labs
                        ],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationTaskSolution)
                .options(selectinload(models.OrganizationTaskSolution.laboratories))
                .where(models.OrganizationTaskSolution.id == task.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def delete_task_solution_for_creator(task_id: int, creator_user_id: int) -> bool:
        async with async_session_factory() as session:
            stmt = select(models.OrganizationTaskSolution).where(
                models.OrganizationTaskSolution.id == task_id,
                models.OrganizationTaskSolution.creator_user_id == creator_user_id,
            )
            result = await session.execute(stmt)
            task = result.scalars().first()
            if not task:
                return False
            await session.delete(task)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return True

    @staticmethod
    async def admin_delete_task_solution(task_id: int) -> bool:
        """Удаление решения задачи по id (админ, в т.ч. без org/creator)."""
        async with async_session_factory() as session:
            stmt = select(models.OrganizationTaskSolution).where(
                models.OrganizationTaskSolution.id == task_id
            )
            result = await session.execute(stmt)
            task = result.scalars().first()
            if not task:
                return False
            await session.delete(task)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return True

    # =============================
    #        QUERIES (ORG) — native async
    # =============================

    @staticmethod
    async def list_queries_for_org(organization_id: int) -> List[models.OrganizationQuery]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationQuery)
                .options(
                    selectinload(models.OrganizationQuery.organization),
                    selectinload(models.OrganizationQuery.laboratories),
                    selectinload(models.OrganizationQuery.employees),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.laboratory
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.contact_employee
                    ).selectinload(models.Employee.laboratories),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.organization
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.query
                    ),
                    selectinload(models.OrganizationQuery.linked_task_solution).selectinload(
                        models.OrganizationTaskSolution.laboratories
                    ),
                )
                .where(models.OrganizationQuery.organization_id == organization_id)
                .order_by(models.OrganizationQuery.id.desc())
            )
            result = await session.execute(stmt)
            queries = list(result.scalars().all())
            needs_update = False
            for query in queries:
                if not query.public_id:
                    query.public_id = await helpers.ensure_unique_query_public_id(session)
                    needs_update = True
            if needs_update:
                try:
                    await session.commit()
                except SQLAlchemyError:
                    await session.rollback()
            return queries

    @staticmethod
    async def list_queries_for_creator(
        creator_user_id: int,
    ) -> List[models.OrganizationQuery]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationQuery)
                .options(
                    selectinload(models.OrganizationQuery.organization),
                    selectinload(models.OrganizationQuery.laboratories),
                    selectinload(models.OrganizationQuery.employees),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.laboratory
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.contact_employee
                    ).selectinload(models.Employee.laboratories),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.organization
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.query
                    ),
                    selectinload(models.OrganizationQuery.linked_task_solution).selectinload(
                        models.OrganizationTaskSolution.laboratories
                    ),
                )
                .where(models.OrganizationQuery.creator_user_id == creator_user_id)
                .order_by(models.OrganizationQuery.id.desc())
            )
            result = await session.execute(stmt)
            queries = list(result.scalars().all())
            needs_update = False
            for query in queries:
                if not query.public_id:
                    query.public_id = await helpers.ensure_unique_query_public_id(session)
                    needs_update = True
            if needs_update:
                try:
                    await session.commit()
                except SQLAlchemyError:
                    await session.rollback()
            for query in queries:
                if query.organization_id is None:
                    query.organization = None
            return queries

    @staticmethod
    async def list_published_queries_for_org(organization_id: int) -> List[models.OrganizationQuery]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationQuery)
                .options(
                    selectinload(models.OrganizationQuery.organization),
                    selectinload(models.OrganizationQuery.laboratories),
                    selectinload(models.OrganizationQuery.employees),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.laboratory
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.contact_employee
                    ).selectinload(models.Employee.laboratories),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.organization
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.query
                    ),
                    selectinload(models.OrganizationQuery.linked_task_solution).selectinload(
                        models.OrganizationTaskSolution.laboratories
                    ),
                )
                .where(
                    models.OrganizationQuery.organization_id == organization_id,
                    models.OrganizationQuery.is_published.is_(True),
                )
                .order_by(models.OrganizationQuery.id.desc())
            )
            result = await session.execute(stmt)
            queries = list(result.scalars().all())
            needs_update = False
            for query in queries:
                if not query.public_id:
                    query.public_id = await helpers.ensure_unique_query_public_id(session)
                    needs_update = True
            if needs_update:
                try:
                    await session.commit()
                except SQLAlchemyError:
                    await session.rollback()
            return queries

    @staticmethod
    async def list_published_queries() -> List[models.OrganizationQuery]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationQuery)
                .options(
                    selectinload(models.OrganizationQuery.organization),
                    selectinload(models.OrganizationQuery.laboratories),
                    selectinload(models.OrganizationQuery.employees),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.laboratory
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.contact_employee
                    ).selectinload(models.Employee.laboratories),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.organization
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.query
                    ),
                    selectinload(models.OrganizationQuery.linked_task_solution).selectinload(
                        models.OrganizationTaskSolution.laboratories
                    ),
                )
                .where(models.OrganizationQuery.is_published.is_(True))
                .order_by(models.OrganizationQuery.id.desc())
            )
            result = await session.execute(stmt)
            queries = list(result.scalars().all())
            needs_update = False
            for query in queries:
                if not query.public_id:
                    query.public_id = await helpers.ensure_unique_query_public_id(session)
                    needs_update = True
            if needs_update:
                try:
                    await session.commit()
                except SQLAlchemyError:
                    await session.rollback()
            for q in queries:
                _ = list(q.vacancies or [])
            for q in queries:
                if q.organization_id is None:
                    q.organization = None
            return queries

    @staticmethod
    async def get_query_by_public_id(public_id: str) -> Optional[models.OrganizationQuery]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationQuery)
                .options(
                    selectinload(models.OrganizationQuery.organization),
                    selectinload(models.OrganizationQuery.laboratories),
                    selectinload(models.OrganizationQuery.employees).selectinload(
                        models.Employee.laboratories
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.laboratory
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.contact_employee
                    ).selectinload(models.Employee.laboratories),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.organization
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.query
                    ),
                    selectinload(models.OrganizationQuery.linked_task_solution).selectinload(
                        models.OrganizationTaskSolution.laboratories
                    ),
                )
                .where(models.OrganizationQuery.public_id == public_id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def create_query_for_org(
        organization_id: Optional[int],
        title: str,
        creator_user_id: Optional[int] = None,
        task_description: Optional[str] = None,
        completed_examples: Optional[str] = None,
        grant_info: Optional[str] = None,
        budget: Optional[str] = None,
        deadline: Optional[str] = None,
        status: Optional[str] = None,
        linked_task_solution_id: Optional[int] = None,
        laboratory_ids: Optional[List[int]] = None,
        employee_ids: Optional[List[int]] = None,
    ) -> models.OrganizationQuery:
        # Basic tier limit: максимум N запросов
        if creator_user_id is not None:
            tier = await CoreOrm.get_subscription_tier(creator_user_id)
            if tier == "basic":
                count = await Orm.count_queries_for_creator(creator_user_id)
                limit = settings.BASIC_MAX_QUERIES
                if count >= limit:
                    raise ValueError(
                        f"Тариф Basic ограничивает до {limit} запросов. "
                        "Перейдите на Pro для неограниченного количества."
                    )
        async with async_session_factory() as session:
            query = models.OrganizationQuery(
                organization_id=organization_id,
                creator_user_id=creator_user_id,
                title=title,
                task_description=task_description,
                completed_examples=completed_examples,
                grant_info=grant_info,
                budget=budget,
                deadline=deadline,
                linked_task_solution_id=linked_task_solution_id,
            )
            if status is not None:
                query.status = status
            session.add(query)
            await session.flush()
            if organization_id is not None:
                if laboratory_ids is not None:
                    labs = await helpers.get_labs_by_ids(
                        session, organization_id, laboratory_ids
                    )
                    if labs:
                        await session.execute(
                            insert(models.query_laboratories),
                            [
                                {"query_id": query.id, "laboratory_id": lab.id}
                                for lab in labs
                            ],
                        )
                if employee_ids is not None:
                    emps = await helpers.get_employees_by_ids(
                        session, organization_id, employee_ids
                    )
                    if emps:
                        await session.execute(
                            insert(models.query_employees),
                            [
                                {"query_id": query.id, "employee_id": e.id}
                                for e in emps
                            ],
                        )
            elif creator_user_id is not None:
                if laboratory_ids is not None:
                    labs = await helpers.get_labs_by_ids_for_creator(
                        session, creator_user_id, laboratory_ids
                    )
                    if labs:
                        await session.execute(
                            insert(models.query_laboratories),
                            [
                                {"query_id": query.id, "laboratory_id": lab.id}
                                for lab in labs
                            ],
                        )
                if employee_ids is not None:
                    emps = await helpers.get_employees_by_ids_for_creator(
                        session, creator_user_id, employee_ids
                    )
                    if emps:
                        await session.execute(
                            insert(models.query_employees),
                            [
                                {"query_id": query.id, "employee_id": e.id}
                                for e in emps
                            ],
                        )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationQuery)
                .options(
                    selectinload(models.OrganizationQuery.organization),
                    selectinload(models.OrganizationQuery.laboratories),
                    selectinload(models.OrganizationQuery.employees),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.laboratory
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.contact_employee
                    ).selectinload(models.Employee.laboratories),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.organization
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.query
                    ),
                    selectinload(models.OrganizationQuery.linked_task_solution).selectinload(
                        models.OrganizationTaskSolution.laboratories
                    ),
                )
                .where(models.OrganizationQuery.id == query.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def update_query(
        query_id: int,
        organization_id: int,
        title: Optional[str] = None,
        task_description: Optional[str] = None,
        completed_examples: Optional[str] = None,
        grant_info: Optional[str] = None,
        budget: Optional[str] = None,
        deadline: Optional[str] = None,
        status: Optional[str] = None,
        linked_task_solution_id: Optional[int] = None,
        laboratory_ids: Optional[List[int]] = None,
        employee_ids: Optional[List[int]] = None,
    ) -> Optional[models.OrganizationQuery]:
        async with async_session_factory() as session:
            stmt = select(models.OrganizationQuery).where(
                models.OrganizationQuery.id == query_id,
                models.OrganizationQuery.organization_id == organization_id,
            )
            result = await session.execute(stmt)
            query = result.scalars().first()
            if not query:
                return None
            if title is not None:
                query.title = title
            if task_description is not None:
                query.task_description = task_description
            if completed_examples is not None:
                query.completed_examples = completed_examples
            if grant_info is not None:
                query.grant_info = grant_info
            if budget is not None:
                query.budget = budget
            if deadline is not None:
                query.deadline = deadline
            if status is not None:
                query.status = status
            if linked_task_solution_id is not None:
                query.linked_task_solution_id = linked_task_solution_id
            if laboratory_ids is not None:
                await session.execute(
                    delete(models.query_laboratories).where(
                        models.query_laboratories.c.query_id == query.id
                    )
                )
                labs = await helpers.get_labs_by_ids(
                    session, organization_id, laboratory_ids
                )
                if labs:
                    await session.execute(
                        insert(models.query_laboratories),
                        [
                            {"query_id": query.id, "laboratory_id": lab.id}
                            for lab in labs
                        ],
                    )
            if employee_ids is not None:
                await session.execute(
                    delete(models.query_employees).where(
                        models.query_employees.c.query_id == query.id
                    )
                )
                emps = await helpers.get_employees_by_ids(
                    session, organization_id, employee_ids
                )
                if emps:
                    await session.execute(
                        insert(models.query_employees),
                        [
                            {"query_id": query.id, "employee_id": e.id}
                            for e in emps
                        ],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationQuery)
                .options(
                    selectinload(models.OrganizationQuery.organization),
                    selectinload(models.OrganizationQuery.laboratories),
                    selectinload(models.OrganizationQuery.employees),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.laboratory
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.contact_employee
                    ).selectinload(models.Employee.laboratories),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.organization
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.query
                    ),
                    selectinload(models.OrganizationQuery.linked_task_solution).selectinload(
                        models.OrganizationTaskSolution.laboratories
                    ),
                )
                .where(models.OrganizationQuery.id == query.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def get_query_for_org(
        query_id: int, organization_id: int
    ) -> Optional[models.OrganizationQuery]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationQuery)
                .options(selectinload(models.OrganizationQuery.laboratories))
                .where(
                    models.OrganizationQuery.id == query_id,
                    models.OrganizationQuery.organization_id == organization_id,
                )
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def get_query_for_creator(
        query_id: int, creator_user_id: int
    ) -> Optional[models.OrganizationQuery]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationQuery)
                .options(selectinload(models.OrganizationQuery.laboratories))
                .where(
                    models.OrganizationQuery.id == query_id,
                    models.OrganizationQuery.creator_user_id == creator_user_id,
                )
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def set_query_published(
        query_id: int,
        organization_id: int,
        is_published: bool,
    ) -> Optional[models.OrganizationQuery]:
        async with async_session_factory() as session:
            stmt = select(models.OrganizationQuery).where(
                models.OrganizationQuery.id == query_id,
                models.OrganizationQuery.organization_id == organization_id,
            )
            result = await session.execute(stmt)
            query = result.scalars().first()
            if not query:
                return None
            query.is_published = bool(is_published)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationQuery)
                .options(
                    selectinload(models.OrganizationQuery.organization),
                    selectinload(models.OrganizationQuery.laboratories),
                    selectinload(models.OrganizationQuery.employees),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.laboratory
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.contact_employee
                    ).selectinload(models.Employee.laboratories),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.organization
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.query
                    ),
                    selectinload(models.OrganizationQuery.linked_task_solution).selectinload(
                        models.OrganizationTaskSolution.laboratories
                    ),
                )
                .where(models.OrganizationQuery.id == query.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def delete_query(query_id: int, organization_id: int) -> bool:
        async with async_session_factory() as session:
            stmt = select(models.OrganizationQuery).where(
                models.OrganizationQuery.id == query_id,
                models.OrganizationQuery.organization_id == organization_id,
            )
            result = await session.execute(stmt)
            query = result.scalars().first()
            if not query:
                return False
            await session.delete(query)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return True

    @staticmethod
    async def update_query_for_creator(
        query_id: int,
        creator_user_id: int,
        title: Optional[str] = None,
        task_description: Optional[str] = None,
        completed_examples: Optional[str] = None,
        grant_info: Optional[str] = None,
        budget: Optional[str] = None,
        deadline: Optional[str] = None,
        status: Optional[str] = None,
        linked_task_solution_id: Optional[int] = None,
        laboratory_ids: Optional[List[int]] = None,
        employee_ids: Optional[List[int]] = None,
    ) -> Optional[models.OrganizationQuery]:
        async with async_session_factory() as session:
            stmt = select(models.OrganizationQuery).where(
                models.OrganizationQuery.id == query_id,
                models.OrganizationQuery.creator_user_id == creator_user_id,
            )
            result = await session.execute(stmt)
            query = result.scalars().first()
            if not query:
                return None
            if title is not None:
                query.title = title
            if task_description is not None:
                query.task_description = task_description
            if completed_examples is not None:
                query.completed_examples = completed_examples
            if grant_info is not None:
                query.grant_info = grant_info
            if budget is not None:
                query.budget = budget
            if deadline is not None:
                query.deadline = deadline
            if status is not None:
                query.status = status
            if linked_task_solution_id is not None:
                query.linked_task_solution_id = linked_task_solution_id
            if laboratory_ids is not None:
                await session.execute(
                    delete(models.query_laboratories).where(
                        models.query_laboratories.c.query_id == query.id
                    )
                )
                labs = await helpers.get_labs_by_ids_for_creator(
                    session, creator_user_id, laboratory_ids
                )
                if labs:
                    await session.execute(
                        insert(models.query_laboratories),
                        [
                            {"query_id": query.id, "laboratory_id": lab.id}
                            for lab in labs
                        ],
                    )
            if employee_ids is not None:
                await session.execute(
                    delete(models.query_employees).where(
                        models.query_employees.c.query_id == query.id
                    )
                )
                emps = await helpers.get_employees_by_ids_for_creator(
                    session, creator_user_id, employee_ids
                )
                if emps:
                    await session.execute(
                        insert(models.query_employees),
                        [
                            {"query_id": query.id, "employee_id": e.id}
                            for e in emps
                        ],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationQuery)
                .options(
                    selectinload(models.OrganizationQuery.organization),
                    selectinload(models.OrganizationQuery.laboratories),
                    selectinload(models.OrganizationQuery.employees),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.laboratory
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.contact_employee
                    ).selectinload(models.Employee.laboratories),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.organization
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.query
                    ),
                    selectinload(models.OrganizationQuery.linked_task_solution).selectinload(
                        models.OrganizationTaskSolution.laboratories
                    ),
                )
                .where(models.OrganizationQuery.id == query.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def set_query_published_for_creator(
        query_id: int,
        creator_user_id: int,
        is_published: bool,
    ) -> Optional[models.OrganizationQuery]:
        async with async_session_factory() as session:
            stmt = select(models.OrganizationQuery).where(
                models.OrganizationQuery.id == query_id,
                models.OrganizationQuery.creator_user_id == creator_user_id,
            )
            result = await session.execute(stmt)
            query = result.scalars().first()
            if not query:
                return None
            query.is_published = bool(is_published)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationQuery)
                .options(
                    selectinload(models.OrganizationQuery.organization),
                    selectinload(models.OrganizationQuery.laboratories),
                    selectinload(models.OrganizationQuery.employees),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.laboratory
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.contact_employee
                    ).selectinload(models.Employee.laboratories),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.organization
                    ),
                    selectinload(models.OrganizationQuery.vacancies).selectinload(
                        models.VacancyOrganization.query
                    ),
                    selectinload(models.OrganizationQuery.linked_task_solution).selectinload(
                        models.OrganizationTaskSolution.laboratories
                    ),
                )
                .where(models.OrganizationQuery.id == query.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def delete_query_for_creator(query_id: int, creator_user_id: int) -> bool:
        async with async_session_factory() as session:
            stmt = select(models.OrganizationQuery).where(
                models.OrganizationQuery.id == query_id,
                models.OrganizationQuery.creator_user_id == creator_user_id,
            )
            result = await session.execute(stmt)
            query = result.scalars().first()
            if not query:
                return False
            await session.delete(query)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return True

    @staticmethod
    async def admin_delete_organization_query(query_id: int) -> bool:
        """Удаление запроса по id (админ, в т.ч. без org/creator)."""
        async with async_session_factory() as session:
            stmt = select(models.OrganizationQuery).where(models.OrganizationQuery.id == query_id)
            result = await session.execute(stmt)
            query = result.scalars().first()
            if not query:
                return False
            await session.delete(query)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return True

    @staticmethod
    async def set_laboratory_published(
        laboratory_id: int,
        organization_id: int,
        is_published: bool,
    ) -> Optional[models.OrganizationLaboratory]:
        async with async_session_factory() as session:
            stmt = select(models.OrganizationLaboratory).where(
                models.OrganizationLaboratory.id == laboratory_id,
                models.OrganizationLaboratory.organization_id == organization_id,
            )
            result = await session.execute(stmt)
            lab = result.scalars().first()
            if not lab:
                return None
            lab.is_published = bool(is_published)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationLaboratory)
                .options(*Orm._lab_select_options())
                .where(
                    models.OrganizationLaboratory.id == laboratory_id,
                    models.OrganizationLaboratory.organization_id == organization_id,
                )
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    # =============================
    #      VACANCIES (ORG) — native async
    # =============================

    @staticmethod
    async def create_vacancy(
        organization_id: Optional[int],
        name: str,
        creator_user_id: Optional[int] = None,
        requirements: Optional[str] = None,
        description: Optional[str] = None,
        employment_type: Optional[str] = None,
        query_id: Optional[int] = None,
        laboratory_id: Optional[int] = None,
        contact_employee_id: Optional[int] = None,
        contact_email: Optional[str] = None,
        contact_phone: Optional[str] = None,
    ) -> models.VacancyOrganization:
        # Basic tier limit: максимум N вакансий
        if creator_user_id is not None:
            tier = await CoreOrm.get_subscription_tier(creator_user_id)
            if tier == "basic":
                count = await Orm.count_vacancies_for_creator(creator_user_id)
                limit = settings.BASIC_MAX_VACANCIES
                if count >= limit:
                    raise ValueError(
                        f"Тариф Basic ограничивает до {limit} вакансий. "
                        "Перейдите на Pro для неограниченного количества."
                    )
        async with async_session_factory() as session:
            vacancy = models.VacancyOrganization(
                organization_id=organization_id,
                creator_user_id=creator_user_id,
                query_id=query_id,
                laboratory_id=laboratory_id,
                contact_employee_id=contact_employee_id,
                contact_email=contact_email,
                contact_phone=contact_phone,
                name=name,
                requirements=requirements,
                description=description,
                employment_type=employment_type,
            )
            session.add(vacancy)
            await session.flush()
            if not vacancy.public_id:
                vacancy.public_id = await helpers.ensure_unique_vacancy_public_id(session)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.VacancyOrganization)
                .options(
                    selectinload(models.VacancyOrganization.organization),
                    selectinload(models.VacancyOrganization.query),
                    selectinload(models.VacancyOrganization.laboratory),
                    selectinload(models.VacancyOrganization.contact_employee).selectinload(
                        models.Employee.laboratories
                    ),
                )
                .where(models.VacancyOrganization.id == vacancy.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def get_vacancy(vacancy_id: int) -> Optional[models.VacancyOrganization]:
        async with async_session_factory() as session:
            stmt = (
                select(models.VacancyOrganization)
                .options(
                    selectinload(models.VacancyOrganization.organization),
                    selectinload(models.VacancyOrganization.query),
                    selectinload(models.VacancyOrganization.laboratory),
                    selectinload(models.VacancyOrganization.contact_employee).selectinload(
                        models.Employee.laboratories
                    ),
                )
                .where(models.VacancyOrganization.id == vacancy_id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def has_published_vacancies_as_contact_for_employee(employee_id: int) -> bool:
        async with async_session_factory() as session:
            result = await session.execute(
                select(func.count()).select_from(models.VacancyOrganization).where(
                    models.VacancyOrganization.contact_employee_id == employee_id,
                    models.VacancyOrganization.is_published.is_(True),
                )
            )
            count = result.scalar() or 0
            return count > 0

    @staticmethod
    async def get_vacancy_for_org(
        vacancy_id: int, organization_id: int
    ) -> Optional[models.VacancyOrganization]:
        async with async_session_factory() as session:
            stmt = select(models.VacancyOrganization).where(
                models.VacancyOrganization.id == vacancy_id,
                models.VacancyOrganization.organization_id == organization_id,
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def get_vacancy_for_creator(
        vacancy_id: int, creator_user_id: int
    ) -> Optional[models.VacancyOrganization]:
        async with async_session_factory() as session:
            stmt = select(models.VacancyOrganization).where(
                models.VacancyOrganization.id == vacancy_id,
                models.VacancyOrganization.creator_user_id == creator_user_id,
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def has_published_vacancies_or_queries_for_lab(laboratory_id: int) -> bool:
        async with async_session_factory() as session:
            result = await session.execute(
                select(func.count()).select_from(models.VacancyOrganization).where(
                    models.VacancyOrganization.laboratory_id == laboratory_id,
                    models.VacancyOrganization.is_published.is_(True),
                )
            )
            vac_count = result.scalar() or 0
            if vac_count > 0:
                return True
            ql = models.query_laboratories
            result = await session.execute(
                select(
                    exists().where(
                        ql.c.laboratory_id == laboratory_id,
                        models.OrganizationQuery.id == ql.c.query_id,
                        models.OrganizationQuery.is_published.is_(True),
                    )
                )
            )
            return bool(result.scalar())

    @staticmethod
    async def get_vacancy_by_public_id(public_id: str) -> Optional[models.VacancyOrganization]:
        async with async_session_factory() as session:
            stmt = (
                select(models.VacancyOrganization)
                .options(
                    selectinload(models.VacancyOrganization.organization),
                    selectinload(models.VacancyOrganization.query),
                    selectinload(models.VacancyOrganization.laboratory),
                    selectinload(models.VacancyOrganization.contact_employee).selectinload(
                        models.Employee.laboratories
                    ),
                    selectinload(models.VacancyOrganization.contact_employee).selectinload(
                        models.Employee.user
                    ),
                    selectinload(models.VacancyOrganization.creator),
                )
                .where(models.VacancyOrganization.public_id == public_id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def list_vacancies() -> List[models.VacancyOrganization]:
        async with async_session_factory() as session:
            stmt = (
                select(models.VacancyOrganization)
                .options(
                    selectinload(models.VacancyOrganization.organization),
                    selectinload(models.VacancyOrganization.query),
                    selectinload(models.VacancyOrganization.laboratory),
                    selectinload(models.VacancyOrganization.contact_employee).selectinload(
                        models.Employee.laboratories
                    ),
                )
                .order_by(models.VacancyOrganization.id.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def list_published_vacancies() -> List[models.VacancyOrganization]:
        async with async_session_factory() as session:
            stmt = (
                select(models.VacancyOrganization)
                .options(
                    selectinload(models.VacancyOrganization.organization),
                    selectinload(models.VacancyOrganization.query),
                    selectinload(models.VacancyOrganization.laboratory),
                    selectinload(models.VacancyOrganization.contact_employee).selectinload(
                        models.Employee.laboratories
                    ),
                )
                .where(models.VacancyOrganization.is_published.is_(True))
                .order_by(models.VacancyOrganization.id.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def list_vacancies_for_org(organization_id: int) -> List[models.VacancyOrganization]:
        async with async_session_factory() as session:
            stmt = (
                select(models.VacancyOrganization)
                .options(
                    selectinload(models.VacancyOrganization.organization),
                    selectinload(models.VacancyOrganization.query),
                    selectinload(models.VacancyOrganization.laboratory),
                    selectinload(models.VacancyOrganization.contact_employee).selectinload(
                        models.Employee.laboratories
                    ),
                )
                .where(models.VacancyOrganization.organization_id == organization_id)
                .order_by(models.VacancyOrganization.id.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def list_vacancies_for_creator(
        creator_user_id: int,
    ) -> List[models.VacancyOrganization]:
        async with async_session_factory() as session:
            stmt = (
                select(models.VacancyOrganization)
                .options(
                    selectinload(models.VacancyOrganization.organization),
                    selectinload(models.VacancyOrganization.query),
                    selectinload(models.VacancyOrganization.laboratory),
                    selectinload(models.VacancyOrganization.contact_employee).selectinload(
                        models.Employee.laboratories
                    ),
                )
                .where(models.VacancyOrganization.creator_user_id == creator_user_id)
                .order_by(models.VacancyOrganization.id.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def get_vacancy_stats_for_user(user_id: int) -> List[dict]:
        """
        Для представителя возвращает по каждой его вакансии: view_count (page_view из аналитики) и response_count.
        """
        org = await Orm.get_organization_for_user(user_id)
        async with async_session_factory() as session:
            if org:
                stmt = select(
                    models.VacancyOrganization.id,
                    models.VacancyOrganization.public_id,
                    models.VacancyOrganization.name,
                ).where(models.VacancyOrganization.organization_id == org.id)
            else:
                stmt = select(
                    models.VacancyOrganization.id,
                    models.VacancyOrganization.public_id,
                    models.VacancyOrganization.name,
                ).where(models.VacancyOrganization.creator_user_id == user_id)
            result = await session.execute(stmt)
            vacancy_rows = list(result.all())
        if not vacancy_rows:
            return []
        public_ids = [r[1] for r in vacancy_rows if r[1]]
        vacancy_ids = [r[0] for r in vacancy_rows]
        view_counts: dict = {}
        response_counts: dict = {}
        async with async_session_factory() as session:
            if public_ids and hasattr(models, "AnalyticsEvent"):
                ae = models.AnalyticsEvent
                vo = models.VacancyOrganization
                join_cond = (ae.entity_id == vo.public_id) & (ae.entity_type == "vacancy")
                creator_filter = (ae.user_id.is_(None)) | (ae.user_id != vo.creator_user_id)
                stmt = (
                    select(ae.entity_id, func.count(ae.id).label("cnt"))
                    .select_from(ae)
                    .join(vo, join_cond)
                    .where(
                        ae.event_type == "page_view",
                        ae.entity_id.in_(public_ids),
                        creator_filter,
                    )
                    .group_by(ae.entity_id)
                )
                res = await session.execute(stmt)
                for row in res.all():
                    view_counts[row.entity_id] = row.cnt
            stmt_resp = (
                select(models.VacancyResponse.vacancy_id, func.count(models.VacancyResponse.id).label("cnt"))
                .where(models.VacancyResponse.vacancy_id.in_(vacancy_ids))
                .group_by(models.VacancyResponse.vacancy_id)
            )
            res = await session.execute(stmt_resp)
            for row in res.all():
                response_counts[row.vacancy_id] = row.cnt
        return [
            {
                "vacancy_id": r[0],
                "public_id": r[1],
                "name": r[2],
                "view_count": view_counts.get(r[1], 0) if r[1] else 0,
                "response_count": response_counts.get(r[0], 0),
            }
            for r in vacancy_rows
        ]

    @staticmethod
    async def get_employer_dashboard_data(user_id: int) -> dict:
        """
        Данные дашборда представителя: сводка по вакансиям/откликам, по вакансиям/лабораториям/запросам
        (просмотры, уникальные зрители, время на странице), плюс ряды по дням для графиков.
        """
        org = await Orm.get_organization_for_user(user_id)
        if org:
            laboratories = await Orm.list_laboratories_for_org(org.id)
            async with async_session_factory() as session:
                stmt = select(
                    models.VacancyOrganization.id,
                    models.VacancyOrganization.public_id,
                    models.VacancyOrganization.name,
                    models.VacancyOrganization.is_published,
                    models.VacancyOrganization.created_at,
                ).where(models.VacancyOrganization.organization_id == org.id)
                result = await session.execute(stmt)
                vacancy_rows = list(result.all())
                stmt_q = select(
                    models.OrganizationQuery.id,
                    models.OrganizationQuery.public_id,
                    models.OrganizationQuery.title,
                ).where(models.OrganizationQuery.organization_id == org.id)
                result_q = await session.execute(stmt_q)
                query_rows = list(result_q.all())
        else:
            laboratories = await Orm.list_laboratories_for_creator(user_id)
            async with async_session_factory() as session:
                stmt = select(
                    models.VacancyOrganization.id,
                    models.VacancyOrganization.public_id,
                    models.VacancyOrganization.name,
                    models.VacancyOrganization.is_published,
                    models.VacancyOrganization.created_at,
                ).where(models.VacancyOrganization.creator_user_id == user_id)
                result = await session.execute(stmt)
                vacancy_rows = list(result.all())
                stmt_q = select(
                    models.OrganizationQuery.id,
                    models.OrganizationQuery.public_id,
                    models.OrganizationQuery.title,
                ).where(models.OrganizationQuery.creator_user_id == user_id)
                result_q = await session.execute(stmt_q)
                query_rows = list(result_q.all())
        query_public_ids = [row[1] for row in query_rows if row[1]]
        vacancy_ids = [r[0] for r in vacancy_rows]
        vacancy_public_ids = [r[1] for r in vacancy_rows if r[1]]
        lab_public_ids = [lab.public_id for lab in laboratories if lab.public_id]
        published_count = sum(1 for r in vacancy_rows if r[3])
        view_counts: dict = {}
        unique_viewers: dict = {}
        avg_time_on_page: dict = {}
        lab_view_counts: dict = {}
        lab_unique_viewers: dict = {}
        lab_avg_time: dict = {}
        lab_cta_clicks_30d: dict = {}
        query_view_counts: dict = {}
        query_unique_viewers: dict = {}
        query_avg_time: dict = {}
        response_counts: dict = {}
        status_counts = {"new": 0, "accepted": 0, "rejected": 0}
        first_response_at: dict = {}
        first_acceptance_at: dict = {}
        views_over_time: List[dict] = []
        responses_over_time: List[dict] = []

        full_vacancies: dict = {}
        full_queries: dict = {}
        since_30d = datetime.now(timezone.utc) - timedelta(days=30)
        async with async_session_factory() as session:
            if vacancy_ids:
                stmt_v = select(models.VacancyOrganization).where(
                    models.VacancyOrganization.id.in_(vacancy_ids)
                )
                res_v = await session.execute(stmt_v)
                full_vacancies = {v.id: v for v in res_v.scalars().all()}
            if query_rows:
                query_ids = [r[0] for r in query_rows]
                stmt_q = select(models.OrganizationQuery).options(
                    selectinload(models.OrganizationQuery.laboratories)
                ).where(models.OrganizationQuery.id.in_(query_ids))
                res_q = await session.execute(stmt_q)
                full_queries = {q.id: q for q in res_q.scalars().all()}

            if vacancy_public_ids and hasattr(models, "AnalyticsEvent"):
                ae = models.AnalyticsEvent
                vo = models.VacancyOrganization
                join_cond = (ae.entity_id == vo.public_id) & (ae.entity_type == "vacancy")
                creator_filter = (ae.user_id.is_(None)) | (ae.user_id != vo.creator_user_id)
                stmt_view = (
                    select(ae.entity_id, func.count(ae.id).label("cnt"))
                    .select_from(ae)
                    .join(vo, join_cond)
                    .where(
                        ae.event_type == "page_view",
                        ae.entity_id.in_(vacancy_public_ids),
                        ae.created_at >= since_30d,
                        creator_filter,
                    )
                    .group_by(ae.entity_id)
                )
                res = await session.execute(stmt_view)
                for row in res.all():
                    view_counts[row.entity_id] = row.cnt
                viewer_key = func.coalesce(cast(ae.user_id, String), ae.session_id)
                stmt_uv = (
                    select(ae.entity_id, func.count(distinct(viewer_key)).label("uv"))
                    .select_from(ae)
                    .join(vo, join_cond)
                    .where(
                        ae.event_type == "page_view",
                        ae.entity_id.in_(vacancy_public_ids),
                        ae.created_at >= since_30d,
                        creator_filter,
                    )
                    .group_by(ae.entity_id)
                )
                res = await session.execute(stmt_uv)
                for row in res.all():
                    unique_viewers[row.entity_id] = row.uv
                time_sql = text("""
                    SELECT ae.entity_id, AVG((COALESCE(ae.payload->>'duration_sec', ae.payload->>'time_spent_sec'))::float) AS avg_sec
                    FROM analytics_events ae
                    JOIN vacancies_organizations vo ON ae.entity_id = vo.public_id AND ae.entity_type = 'vacancy'
                    WHERE ae.event_type = 'page_leave' AND ae.entity_type = 'vacancy'
                      AND ae.entity_id = ANY(:public_ids)
                      AND ae.created_at >= :since
                      AND (ae.payload->>'duration_sec' IS NOT NULL OR ae.payload->>'time_spent_sec' IS NOT NULL)
                    GROUP BY ae.entity_id
                """)
                try:
                    res = await session.execute(
                        time_sql,
                        {"public_ids": vacancy_public_ids, "since": since_30d},
                    )
                    for row in res.all():
                        if row.avg_sec is not None:
                            avg_time_on_page[row.entity_id] = round(float(row.avg_sec), 1)
                except Exception:
                    pass

            if lab_public_ids and hasattr(models, "AnalyticsEvent"):
                ae = models.AnalyticsEvent
                lo = models.OrganizationLaboratory
                join_cond = (ae.entity_id == lo.public_id) & (ae.entity_type == "laboratory")
                creator_filter = (ae.user_id.is_(None)) | (ae.user_id != lo.creator_user_id)
                stmt = (
                    select(ae.entity_id, func.count(ae.id).label("cnt"))
                    .select_from(ae)
                    .join(lo, join_cond)
                    .where(
                        ae.event_type == "page_view",
                        ae.entity_id.in_(lab_public_ids),
                        ae.created_at >= since_30d,
                        creator_filter,
                    )
                    .group_by(ae.entity_id)
                )
                res = await session.execute(stmt)
                for row in res.all():
                    lab_view_counts[row.entity_id] = row.cnt
                viewer_key = func.coalesce(cast(ae.user_id, String), ae.session_id)
                stmt_uv = (
                    select(ae.entity_id, func.count(distinct(viewer_key)).label("uv"))
                    .select_from(ae)
                    .join(lo, join_cond)
                    .where(
                        ae.event_type == "page_view",
                        ae.entity_id.in_(lab_public_ids),
                        ae.created_at >= since_30d,
                        creator_filter,
                    )
                    .group_by(ae.entity_id)
                )
                res = await session.execute(stmt_uv)
                for row in res.all():
                    lab_unique_viewers[row.entity_id] = row.uv
                time_sql_lab = text("""
                    SELECT ae.entity_id, AVG((COALESCE(ae.payload->>'duration_sec', ae.payload->>'time_spent_sec'))::float) AS avg_sec
                    FROM analytics_events ae
                    JOIN laboratories_organizations lo ON ae.entity_id = lo.public_id AND ae.entity_type = 'laboratory'
                    WHERE ae.event_type = 'page_leave' AND ae.entity_type = 'laboratory'
                      AND ae.entity_id = ANY(:public_ids)
                      AND ae.created_at >= :since
                      AND (ae.payload->>'duration_sec' IS NOT NULL OR ae.payload->>'time_spent_sec' IS NOT NULL)
                    GROUP BY ae.entity_id
                """)
                try:
                    res = await session.execute(
                        time_sql_lab,
                        {"public_ids": lab_public_ids, "since": since_30d},
                    )
                    for row in res.all():
                        if row.avg_sec is not None:
                            lab_avg_time[row.entity_id] = round(float(row.avg_sec), 1)
                except Exception:
                    pass
                stmt_cta = (
                    select(ae.entity_id, func.count(ae.id).label("cta"))
                    .where(
                        ae.event_type == "button_click",
                        ae.entity_type == "laboratory",
                        ae.entity_id.in_(lab_public_ids),
                        ae.created_at >= since_30d,
                    )
                    .group_by(ae.entity_id)
                )
                res = await session.execute(stmt_cta)
                for row in res.all():
                    if row.entity_id:
                        lab_cta_clicks_30d[row.entity_id] = row.cta

            if query_public_ids and hasattr(models, "AnalyticsEvent"):
                ae = models.AnalyticsEvent
                oq = models.OrganizationQuery
                join_cond = (ae.entity_id == oq.public_id) & (ae.entity_type == "query")
                creator_filter = (ae.user_id.is_(None)) | (ae.user_id != oq.creator_user_id)
                stmt = (
                    select(ae.entity_id, func.count(ae.id).label("cnt"))
                    .select_from(ae)
                    .join(oq, join_cond)
                    .where(
                        ae.event_type == "page_view",
                        ae.entity_id.in_(query_public_ids),
                        ae.created_at >= since_30d,
                        creator_filter,
                    )
                    .group_by(ae.entity_id)
                )
                res = await session.execute(stmt)
                for row in res.all():
                    query_view_counts[row.entity_id] = row.cnt
                viewer_key = func.coalesce(cast(ae.user_id, String), ae.session_id)
                stmt_uv = (
                    select(ae.entity_id, func.count(distinct(viewer_key)).label("uv"))
                    .select_from(ae)
                    .join(oq, join_cond)
                    .where(
                        ae.event_type == "page_view",
                        ae.entity_id.in_(query_public_ids),
                        ae.created_at >= since_30d,
                        creator_filter,
                    )
                    .group_by(ae.entity_id)
                )
                res = await session.execute(stmt_uv)
                for row in res.all():
                    query_unique_viewers[row.entity_id] = row.uv
                time_sql_q = text("""
                    SELECT ae.entity_id, AVG((COALESCE(ae.payload->>'duration_sec', ae.payload->>'time_spent_sec'))::float) AS avg_sec
                    FROM analytics_events ae
                    JOIN organization_queries oq ON ae.entity_id = oq.public_id AND ae.entity_type = 'query'
                    WHERE ae.event_type = 'page_leave' AND ae.entity_type = 'query'
                      AND ae.entity_id = ANY(:public_ids)
                      AND ae.created_at >= :since
                      AND (ae.payload->>'duration_sec' IS NOT NULL OR ae.payload->>'time_spent_sec' IS NOT NULL)
                    GROUP BY ae.entity_id
                """)
                try:
                    res = await session.execute(
                        time_sql_q,
                        {"public_ids": query_public_ids, "since": since_30d},
                    )
                    for row in res.all():
                        if row.avg_sec is not None:
                            query_avg_time[row.entity_id] = round(float(row.avg_sec), 1)
                except Exception:
                    pass

            stmt_resp = (
                select(
                    models.VacancyResponse.vacancy_id,
                    func.count(models.VacancyResponse.id).label("cnt"),
                )
                .where(models.VacancyResponse.vacancy_id.in_(vacancy_ids))
                .group_by(models.VacancyResponse.vacancy_id)
            )
            res = await session.execute(stmt_resp)
            for row in res.all():
                response_counts[row.vacancy_id] = row.cnt
            stmt_status = (
                select(
                    models.VacancyResponse.status,
                    func.count(models.VacancyResponse.id).label("cnt"),
                )
                .where(models.VacancyResponse.vacancy_id.in_(vacancy_ids))
                .group_by(models.VacancyResponse.status)
            )
            res = await session.execute(stmt_status)
            for row in res.all():
                if row.status in status_counts:
                    status_counts[row.status] = row.cnt
            stmt_first = (
                select(
                    models.VacancyResponse.vacancy_id,
                    func.min(models.VacancyResponse.created_at).label("first_at"),
                )
                .where(models.VacancyResponse.vacancy_id.in_(vacancy_ids))
                .group_by(models.VacancyResponse.vacancy_id)
            )
            res = await session.execute(stmt_first)
            for row in res.all():
                first_response_at[row.vacancy_id] = row.first_at
            stmt_first_acc = (
                select(
                    models.VacancyResponse.vacancy_id,
                    func.min(models.VacancyResponse.created_at).label("first_at"),
                )
                .where(
                    models.VacancyResponse.vacancy_id.in_(vacancy_ids),
                    models.VacancyResponse.status == "accepted",
                )
                .group_by(models.VacancyResponse.vacancy_id)
            )
            res = await session.execute(stmt_first_acc)
            for row in res.all():
                first_acceptance_at[row.vacancy_id] = row.first_at

            if hasattr(models, "AnalyticsEvent"):
                since_dt = datetime.now(timezone.utc) - timedelta(days=30)
                since = since_dt.date()
                since_ts = since_dt
                dates_needed = [since + timedelta(days=i) for i in range(31)]
                date_strs = [d.strftime("%Y-%m-%d") for d in dates_needed]
                vac_by_date: dict = {}
                lab_by_date: dict = {}
                q_by_date: dict = {}
                for d in date_strs:
                    vac_by_date[d] = 0
                    lab_by_date[d] = 0
                    q_by_date[d] = 0
                if vacancy_public_ids:
                    sql_v = text("""
                        SELECT (ae.created_at AT TIME ZONE 'UTC')::date AS d, COUNT(*) AS count
                        FROM analytics_events ae
                        JOIN vacancies_organizations vo ON ae.entity_id = vo.public_id AND ae.entity_type = 'vacancy'
                        WHERE ae.event_type = 'page_view' AND ae.entity_id = ANY(:pids)
                          AND (ae.user_id IS NULL OR ae.user_id != vo.creator_user_id)
                          AND ae.created_at >= :since
                        GROUP BY 1
                    """)
                    res = await session.execute(sql_v, {"pids": vacancy_public_ids, "since": since_ts})
                    for row in res.all():
                        vac_by_date[row.d.strftime("%Y-%m-%d")] = row.count
                if lab_public_ids:
                    sql_l = text("""
                        SELECT (ae.created_at AT TIME ZONE 'UTC')::date AS d, COUNT(*) AS count
                        FROM analytics_events ae
                        JOIN laboratories_organizations lo ON ae.entity_id = lo.public_id AND ae.entity_type = 'laboratory'
                        WHERE ae.event_type = 'page_view' AND ae.entity_id = ANY(:pids)
                          AND (ae.user_id IS NULL OR ae.user_id != lo.creator_user_id)
                          AND ae.created_at >= :since
                        GROUP BY 1
                    """)
                    res = await session.execute(sql_l, {"pids": lab_public_ids, "since": since_ts})
                    for row in res.all():
                        lab_by_date[row.d.strftime("%Y-%m-%d")] = row.count
                if query_public_ids:
                    sql_q = text("""
                        SELECT (ae.created_at AT TIME ZONE 'UTC')::date AS d, COUNT(*) AS count
                        FROM analytics_events ae
                        JOIN organization_queries oq ON ae.entity_id = oq.public_id AND ae.entity_type = 'query'
                        WHERE ae.event_type = 'page_view' AND ae.entity_id = ANY(:pids)
                          AND (ae.user_id IS NULL OR ae.user_id != oq.creator_user_id)
                          AND ae.created_at >= :since
                        GROUP BY 1
                    """)
                    res = await session.execute(sql_q, {"pids": query_public_ids, "since": since_ts})
                    for row in res.all():
                        q_by_date[row.d.strftime("%Y-%m-%d")] = row.count
                for d in date_strs:
                    vc, lc, qc = vac_by_date.get(d, 0), lab_by_date.get(d, 0), q_by_date.get(d, 0)
                    views_over_time.append({
                        "date": d,
                        "total": vc + lc + qc,
                        "by_entity_type": {"vacancy": vc, "laboratory": lc, "query": qc},
                    })
                resp_by_date = {d: 0 for d in date_strs}
                if vacancy_ids:
                    sql_r = text("""
                        SELECT (created_at AT TIME ZONE 'UTC')::date AS d, COUNT(*) AS count
                        FROM vacancy_responses
                        WHERE vacancy_id = ANY(:vids) AND created_at >= :since
                        GROUP BY 1
                    """)
                    res = await session.execute(sql_r, {"vids": vacancy_ids, "since": since_ts})
                    for row in res.all():
                        resp_by_date[row.d.strftime("%Y-%m-%d")] = row.count
                for d in date_strs:
                    responses_over_time.append({"date": d, "count": resp_by_date.get(d, 0)})

        total_responses = sum(response_counts.values())
        new_count = status_counts["new"]
        accepted_count = status_counts["accepted"]
        rejected_count = status_counts["rejected"]
        vacancies_with_zero = sum(1 for vid in vacancy_ids if response_counts.get(vid, 0) == 0)
        avg_responses = (total_responses / len(vacancy_rows)) if vacancy_rows else 0.0
        decided = accepted_count + rejected_count
        accepted_rate = (accepted_count / decided) if decided else None
        if accepted_rate is not None:
            accepted_rate = round(accepted_rate * 100, 1)
        days_to_first_list = []
        for r in vacancy_rows:
            first_at = first_response_at.get(r[0])
            if first_at and r[4]:
                delta = (first_at - r[4]).total_seconds() / 86400
                days_to_first_list.append(delta)
        avg_days_to_first_response = round(sum(days_to_first_list) / len(days_to_first_list), 1) if days_to_first_list else None
        days_to_accept_list = []
        for r in vacancy_rows:
            first_at = first_acceptance_at.get(r[0])
            if first_at and r[4]:
                delta = (first_at - r[4]).total_seconds() / 86400
                days_to_accept_list.append(delta)
        avg_days_to_first_acceptance = round(sum(days_to_accept_list) / len(days_to_accept_list), 1) if days_to_accept_list else None

        subscription_row = await CoreOrm.get_active_subscription(user_id)
        subscription = (
            {
                "active": True,
                "tier": getattr(subscription_row, "tier", None) or "pro",
                "expires_at": subscription_row.expires_at.isoformat() if subscription_row.expires_at else None,
                "trial_ends_at": subscription_row.trial_ends_at.isoformat() if getattr(subscription_row, "trial_ends_at", None) else None,
                "status": subscription_row.status or "active",
                "started_at": subscription_row.started_at.isoformat() if subscription_row.started_at else None,
            }
            if subscription_row
            else {"active": False, "tier": None, "expires_at": None, "trial_ends_at": None, "status": "none", "started_at": None}
        )

        org_ranking = None
        if org:
            employees_count = len(
                set(
                    e.id
                    for lab in laboratories
                    for e in (getattr(lab, "employees", None) or [])
                )
            )
            org_analytics = {}
            if org.public_id:
                org_analytics_map = await Orm.get_organization_analytics_30d([org.public_id])
                org_analytics = org_analytics_map.get(org.public_id, {})
            published_vacancies = sum(1 for r in vacancy_rows if r[3])
            org_doc = ranking.build_doc_from_org(
                org,
                laboratories_count=len(laboratories),
                employees_count=employees_count,
                vacancies_count=published_vacancies,
                queries_count=len(query_rows),
                unique_views_30d=org_analytics.get("unique_views_30d", 0),
                avg_time_on_page_sec=org_analytics.get("avg_time_on_page_sec"),
            )
            org_ranking = {
                "score": ranking.get_organization_score(org_doc),
                "tips": ranking.get_organization_tips(org_doc),
            }

        by_vacancy = []
        for r in vacancy_rows:
            vid, v_public_id, v_name, _v_pub, v_created_at = r[0], r[1], r[2], r[3], r[4]
            view_count = view_counts.get(v_public_id, 0) if v_public_id else 0
            response_count = response_counts.get(vid, 0)
            uv = unique_viewers.get(v_public_id, 0) if v_public_id else 0
            conversion_rate = None
            if uv and uv > 0:
                conversion_rate = round(response_count / uv, 4)
            avg_sec = avg_time_on_page.get(v_public_id) if v_public_id else None
            first_at = first_response_at.get(vid)
            days_to_first = None
            if first_at and v_created_at:
                days_to_first = round((first_at - v_created_at).total_seconds() / 86400, 1)
            vac = full_vacancies.get(vid)
            rank_score = 0.0
            tips = []
            if vac:
                v_doc = ranking.build_doc_from_vacancy(
                    vac,
                    unique_viewers_30d=uv,
                    response_count=response_count,
                    avg_time_on_page_sec=avg_sec,
                )
                rank_score = ranking.get_vacancy_score(v_doc)
                tips = ranking.get_vacancy_tips(v_doc)
            by_vacancy.append({
                "vacancy_id": vid,
                "public_id": v_public_id,
                "name": v_name,
                "view_count": view_count,
                "response_count": response_count,
                "unique_viewers": uv,
                "conversion_rate": conversion_rate,
                "avg_time_on_page_sec": avg_sec,
                "days_to_first_response": days_to_first,
                "rank_score": round(rank_score, 1),
                "tips": tips,
            })
        by_laboratory = []
        for lab in laboratories:
            view_count = lab_view_counts.get(lab.public_id, 0) if lab.public_id else 0
            uv = lab_unique_viewers.get(lab.public_id, 0) if lab.public_id else 0
            avg_sec = lab_avg_time.get(lab.public_id) if lab.public_id else None
            lab_doc = ranking.build_doc_from_lab(
                lab,
                employees_count=len(getattr(lab, "employees", None) or []),
                researchers_count=len(getattr(lab, "researchers", None) or []),
                equipment_count=len(getattr(lab, "equipment", None) or []),
                unique_views_30d=uv,
                avg_time_on_page_sec=avg_sec,
                cta_clicks_30d=lab_cta_clicks_30d.get(lab.public_id, 0) if lab.public_id else 0,
            )
            rank_score = ranking.get_laboratory_score(lab_doc)
            tips = ranking.get_laboratory_tips(lab_doc)
            by_laboratory.append({
                "laboratory_id": lab.id,
                "public_id": lab.public_id,
                "name": lab.name,
                "view_count": view_count,
                "unique_viewers": uv,
                "avg_time_on_page_sec": avg_sec,
                "rank_score": round(rank_score, 1),
                "tips": tips,
            })
        by_query = []
        for row in query_rows:
            qid, q_public_id, q_title = row[0], row[1], row[2]
            view_count = query_view_counts.get(q_public_id, 0) if q_public_id else 0
            uv = query_unique_viewers.get(q_public_id, 0) if q_public_id else 0
            avg_sec = query_avg_time.get(q_public_id) if q_public_id else None
            q = full_queries.get(qid)
            rank_score = 0.0
            tips = []
            if q:
                q_doc = ranking.build_doc_from_query(
                    q,
                    unique_views_30d=uv,
                    avg_time_on_page_sec=avg_sec,
                )
                rank_score = ranking.get_query_score(q_doc)
                tips = ranking.get_query_tips(q_doc)
            by_query.append({
                "query_id": qid,
                "public_id": q_public_id,
                "title": q_title,
                "view_count": view_count,
                "unique_viewers": uv,
                "avg_time_on_page_sec": avg_sec,
                "rank_score": round(rank_score, 1),
                "tips": tips,
            })
        return {
            "summary": {
                "total_vacancies_published": published_count,
                "total_responses": total_responses,
                "new_count": new_count,
                "accepted_count": accepted_count,
                "rejected_count": rejected_count,
                "vacancies_with_zero_responses": vacancies_with_zero,
                "avg_responses_per_vacancy": round(avg_responses, 1),
                "avg_days_to_first_response": avg_days_to_first_response,
                "avg_days_to_first_acceptance": avg_days_to_first_acceptance,
                "accepted_rate": accepted_rate,
            },
            "by_status": [
                {"status": "new", "count": new_count},
                {"status": "accepted", "count": accepted_count},
                {"status": "rejected", "count": rejected_count},
            ],
            "by_vacancy": by_vacancy,
            "by_laboratory": by_laboratory,
            "by_query": by_query,
            "views_over_time": views_over_time,
            "responses_over_time": responses_over_time,
            "subscription": subscription,
            "org_ranking": org_ranking,
        }

    @staticmethod
    async def get_extended_analytics_for_user(user_id: int) -> dict:
        """Расширенная аналитика для Pro: просмотры 7/30 дн., конверсия, сравнительный контекст."""
        dashboard = await Orm.get_employer_dashboard_data(user_id)
        since_7d = datetime.now(timezone.utc) - timedelta(days=7)
        views_7d_org = 0
        views_7d_lab = 0
        views_7d_vacancy = 0
        views_7d_query = 0
        org_public_id = None
        org = await Orm.get_organization_for_user(user_id)
        if org:
            org_public_id = org.public_id
        lab_public_ids = [lb.get("public_id") for lb in dashboard.get("by_laboratory", []) if lb.get("public_id")]
        vacancy_public_ids = [v.get("public_id") for v in dashboard.get("by_vacancy", []) if v.get("public_id")]
        query_public_ids = [q.get("public_id") for q in dashboard.get("by_query", []) if q.get("public_id")]
        if hasattr(models, "AnalyticsEvent"):
            ae = models.AnalyticsEvent
            async with async_session_factory() as session:
                if org_public_id:
                    stmt = (
                        select(func.count(ae.id))
                        .where(
                            ae.event_type == "page_view",
                            ae.entity_type == "organization",
                            ae.entity_id == org_public_id,
                            ae.created_at >= since_7d,
                        )
                    )
                    res = await session.execute(stmt)
                    views_7d_org = res.scalar() or 0
                if lab_public_ids:
                    stmt = (
                        select(func.count(ae.id))
                        .where(
                            ae.event_type == "page_view",
                            ae.entity_type == "laboratory",
                            ae.entity_id.in_(lab_public_ids),
                            ae.created_at >= since_7d,
                        )
                    )
                    res = await session.execute(stmt)
                    views_7d_lab = res.scalar() or 0
                if vacancy_public_ids:
                    stmt = (
                        select(func.count(ae.id))
                        .where(
                            ae.event_type == "page_view",
                            ae.entity_type == "vacancy",
                            ae.entity_id.in_(vacancy_public_ids),
                            ae.created_at >= since_7d,
                        )
                    )
                    res = await session.execute(stmt)
                    views_7d_vacancy = res.scalar() or 0
                if query_public_ids:
                    stmt = (
                        select(func.count(ae.id))
                        .where(
                            ae.event_type == "page_view",
                            ae.entity_type == "query",
                            ae.entity_id.in_(query_public_ids),
                            ae.created_at >= since_7d,
                        )
                    )
                    res = await session.execute(stmt)
                    views_7d_query = res.scalar() or 0
        total_views_30d = (
            sum(v.get("view_count", 0) for v in dashboard.get("by_vacancy", []))
            + sum(lab.get("view_count", 0) for lab in dashboard.get("by_laboratory", []))
            + sum(q.get("view_count", 0) for q in dashboard.get("by_query", []))
        )
        org_views_30d = 0
        if org_public_id and org:
            org_analytics = await Orm.get_organization_analytics_30d([org_public_id])
            org_views_30d = org_analytics.get(org_public_id, {}).get("unique_views_30d", 0) or 0
        total_responses = dashboard.get("summary", {}).get("total_responses", 0)
        total_uv = sum(
            v.get("unique_viewers", 0) for v in dashboard.get("by_vacancy", [])
        )
        conversion_pct = round(100 * total_responses / total_uv, 1) if total_uv else 0
        return {
            **dashboard,
            "extended": {
                "views_7d": {
                    "organization": views_7d_org,
                    "laboratories": views_7d_lab,
                    "vacancies": views_7d_vacancy,
                    "queries": views_7d_query,
                    "total": views_7d_org + views_7d_lab + views_7d_vacancy + views_7d_query,
                },
                "views_30d_total": total_views_30d + org_views_30d,
                "org_views_30d": org_views_30d,
                "conversion_rate_pct": conversion_pct,
                "benchmark_note": "Сравните ваши показатели с средними по платформе. Чем выше полнота карточек и конверсия — тем лучше позиция в выдаче.",
            },
        }

    @staticmethod
    async def list_published_vacancies_for_org(
        organization_id: int,
    ) -> List[models.VacancyOrganization]:
        async with async_session_factory() as session:
            stmt = (
                select(models.VacancyOrganization)
                .options(
                    selectinload(models.VacancyOrganization.organization),
                    selectinload(models.VacancyOrganization.query),
                    selectinload(models.VacancyOrganization.laboratory),
                    selectinload(models.VacancyOrganization.contact_employee).selectinload(
                        models.Employee.laboratories
                    ),
                )
                .where(
                    models.VacancyOrganization.organization_id == organization_id,
                    models.VacancyOrganization.is_published.is_(True),
                )
                .order_by(models.VacancyOrganization.id.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def list_published_vacancies_for_laboratory(
        laboratory_id: int,
    ) -> List[models.VacancyOrganization]:
        async with async_session_factory() as session:
            stmt = (
                select(models.VacancyOrganization)
                .options(
                    selectinload(models.VacancyOrganization.organization),
                    selectinload(models.VacancyOrganization.query),
                    selectinload(models.VacancyOrganization.laboratory),
                    selectinload(models.VacancyOrganization.contact_employee).selectinload(
                        models.Employee.laboratories
                    ),
                )
                .where(
                    models.VacancyOrganization.laboratory_id == laboratory_id,
                    models.VacancyOrganization.is_published.is_(True),
                )
                .order_by(models.VacancyOrganization.id.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def update_vacancy(
        vacancy_id: int,
        organization_id: int,
        name: Optional[str] = None,
        requirements: Optional[str] = None,
        description: Optional[str] = None,
        employment_type: Optional[str] = None,
        query_id: Optional[int] = None,
        laboratory_id: Optional[int] = None,
        contact_employee_id: Optional[int] = None,
        contact_email: Optional[str] = None,
        contact_phone: Optional[str] = None,
        patch: Optional[dict] = None,
    ) -> Optional[models.VacancyOrganization]:
        async with async_session_factory() as session:
            stmt = select(models.VacancyOrganization).where(
                models.VacancyOrganization.id == vacancy_id,
                models.VacancyOrganization.organization_id == organization_id,
            )
            result = await session.execute(stmt)
            vacancy = result.scalars().first()
            if not vacancy:
                return None
            if name is not None:
                vacancy.name = name
            if requirements is not None:
                vacancy.requirements = requirements
            if description is not None:
                vacancy.description = description
            if employment_type is not None:
                vacancy.employment_type = employment_type
            if query_id is not None:
                vacancy.query_id = query_id
            if laboratory_id is not None:
                vacancy.laboratory_id = laboratory_id
            if contact_employee_id is not None:
                vacancy.contact_employee_id = contact_employee_id
            if contact_email is not None:
                vacancy.contact_email = contact_email
            if contact_phone is not None:
                vacancy.contact_phone = contact_phone
            if patch:
                for key in ("query_id", "laboratory_id", "contact_employee_id", "contact_email", "contact_phone"):
                    if key in patch:
                        setattr(vacancy, key, patch[key])
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.VacancyOrganization)
                .options(
                    selectinload(models.VacancyOrganization.organization),
                    selectinload(models.VacancyOrganization.query),
                    selectinload(models.VacancyOrganization.laboratory),
                    selectinload(models.VacancyOrganization.contact_employee).selectinload(
                        models.Employee.laboratories
                    ),
                )
                .where(models.VacancyOrganization.id == vacancy.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def set_vacancy_published(
        vacancy_id: int,
        organization_id: int,
        is_published: bool,
    ) -> Optional[models.VacancyOrganization]:
        async with async_session_factory() as session:
            stmt = select(models.VacancyOrganization).where(
                models.VacancyOrganization.id == vacancy_id,
                models.VacancyOrganization.organization_id == organization_id,
            )
            result = await session.execute(stmt)
            vacancy = result.scalars().first()
            if not vacancy:
                return None
            vacancy.is_published = bool(is_published)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.VacancyOrganization)
                .options(
                    selectinload(models.VacancyOrganization.organization),
                    selectinload(models.VacancyOrganization.query),
                    selectinload(models.VacancyOrganization.laboratory),
                    selectinload(models.VacancyOrganization.contact_employee).selectinload(
                        models.Employee.laboratories
                    ),
                )
                .where(models.VacancyOrganization.id == vacancy_id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def delete_vacancy(vacancy_id: int, organization_id: int) -> bool:
        async with async_session_factory() as session:
            stmt = select(models.VacancyOrganization).where(
                models.VacancyOrganization.id == vacancy_id,
                models.VacancyOrganization.organization_id == organization_id,
            )
            result = await session.execute(stmt)
            vacancy = result.scalars().first()
            if not vacancy:
                return False
            await session.delete(vacancy)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return True

    @staticmethod
    async def update_vacancy_for_creator(
        vacancy_id: int,
        creator_user_id: int,
        name: Optional[str] = None,
        requirements: Optional[str] = None,
        description: Optional[str] = None,
        employment_type: Optional[str] = None,
        query_id: Optional[int] = None,
        laboratory_id: Optional[int] = None,
        contact_employee_id: Optional[int] = None,
        contact_email: Optional[str] = None,
        contact_phone: Optional[str] = None,
        patch: Optional[dict] = None,
    ) -> Optional[models.VacancyOrganization]:
        async with async_session_factory() as session:
            stmt = select(models.VacancyOrganization).where(
                models.VacancyOrganization.id == vacancy_id,
                models.VacancyOrganization.creator_user_id == creator_user_id,
            )
            result = await session.execute(stmt)
            vacancy = result.scalars().first()
            if not vacancy:
                return None
            if name is not None:
                vacancy.name = name
            if requirements is not None:
                vacancy.requirements = requirements
            if description is not None:
                vacancy.description = description
            if employment_type is not None:
                vacancy.employment_type = employment_type
            if query_id is not None:
                vacancy.query_id = query_id
            if laboratory_id is not None:
                vacancy.laboratory_id = laboratory_id
            if contact_employee_id is not None:
                vacancy.contact_employee_id = contact_employee_id
            if contact_email is not None:
                vacancy.contact_email = contact_email
            if contact_phone is not None:
                vacancy.contact_phone = contact_phone
            if patch:
                for key in ("query_id", "laboratory_id", "contact_employee_id", "contact_email", "contact_phone"):
                    if key in patch:
                        setattr(vacancy, key, patch[key])
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.VacancyOrganization)
                .options(
                    selectinload(models.VacancyOrganization.organization),
                    selectinload(models.VacancyOrganization.query),
                    selectinload(models.VacancyOrganization.laboratory),
                    selectinload(models.VacancyOrganization.contact_employee).selectinload(
                        models.Employee.laboratories
                    ),
                )
                .where(models.VacancyOrganization.id == vacancy.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def set_vacancy_published_for_creator(
        vacancy_id: int,
        creator_user_id: int,
        is_published: bool,
    ) -> Optional[models.VacancyOrganization]:
        async with async_session_factory() as session:
            stmt = select(models.VacancyOrganization).where(
                models.VacancyOrganization.id == vacancy_id,
                models.VacancyOrganization.creator_user_id == creator_user_id,
            )
            result = await session.execute(stmt)
            vacancy = result.scalars().first()
            if not vacancy:
                return None
            vacancy.is_published = bool(is_published)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.VacancyOrganization)
                .options(
                    selectinload(models.VacancyOrganization.organization),
                    selectinload(models.VacancyOrganization.query),
                    selectinload(models.VacancyOrganization.laboratory),
                    selectinload(models.VacancyOrganization.contact_employee).selectinload(
                        models.Employee.laboratories
                    ),
                )
                .where(models.VacancyOrganization.id == vacancy.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def delete_vacancy_for_creator(vacancy_id: int, creator_user_id: int) -> bool:
        async with async_session_factory() as session:
            stmt = select(models.VacancyOrganization).where(
                models.VacancyOrganization.id == vacancy_id,
                models.VacancyOrganization.creator_user_id == creator_user_id,
            )
            result = await session.execute(stmt)
            vacancy = result.scalars().first()
            if not vacancy:
                return False
            await session.delete(vacancy)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return True

    @staticmethod
    async def admin_delete_vacancy(vacancy_id: int) -> bool:
        """Удаление вакансии по id (админ, в т.ч. без org/creator)."""
        async with async_session_factory() as session:
            stmt = select(models.VacancyOrganization).where(
                models.VacancyOrganization.id == vacancy_id
            )
            result = await session.execute(stmt)
            vacancy = result.scalars().first()
            if not vacancy:
                return False
            await session.delete(vacancy)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return True

    @staticmethod
    async def create_vacancy_response(user_id: int, vacancy_id: int) -> models.VacancyResponse:
        async with async_session_factory() as session:
            vacancy = await session.get(
                models.VacancyOrganization,
                vacancy_id,
                options=[selectinload(models.VacancyOrganization.creator)],
            )
            if not vacancy:
                raise ValueError("Вакансия не найдена")
            if not getattr(vacancy, "is_published", False):
                raise ValueError("Вакансия не опубликована")
            if vacancy.creator_user_id == user_id:
                raise ValueError("Нельзя откликнуться на свою вакансию")
            stmt = select(models.VacancyResponse).where(
                models.VacancyResponse.user_id == user_id,
                models.VacancyResponse.vacancy_id == vacancy_id,
            )
            result = await session.execute(stmt)
            existing = result.scalars().first()
            if existing:
                raise ValueError("Вы уже откликнулись на эту вакансию")
            resp = models.VacancyResponse(user_id=user_id, vacancy_id=vacancy_id, status="new")
            session.add(resp)
            try:
                await session.commit()
                await session.refresh(resp)
            except SQLAlchemyError:
                await session.rollback()
                raise
            return resp

    @staticmethod
    async def get_my_response_for_vacancy(user_id: int, vacancy_id: int):
        async with async_session_factory() as session:
            stmt = select(models.VacancyResponse).where(
                models.VacancyResponse.user_id == user_id,
                models.VacancyResponse.vacancy_id == vacancy_id,
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def list_vacancy_responses_for_employer(creator_user_id: int):
        async with async_session_factory() as session:
            user = await session.get(models.User, creator_user_id)
            org_id = user.organization_id if user else None
            vac = models.VacancyOrganization
            lab = models.OrganizationLaboratory
            conditions = [vac.creator_user_id == creator_user_id]
            if org_id is not None:
                conditions.append(vac.organization_id == org_id)
                conditions.append(
                    (vac.laboratory_id.isnot(None)) & (lab.organization_id == org_id)
                )
            stmt = (
                select(models.VacancyResponse)
                .options(
                    selectinload(models.VacancyResponse.user),
                    selectinload(models.VacancyResponse.vacancy),
                )
                .join(vac, models.VacancyResponse.vacancy_id == vac.id)
                .outerjoin(lab, vac.laboratory_id == lab.id)
                .where(or_(*conditions))
                .order_by(models.VacancyResponse.created_at.desc())
            )
            result = await session.execute(stmt)
            rows = list(result.scalars().unique().all())
            out = []
            for r in rows:
                applicant_name = (
                    getattr(r.user, "full_name", None)
                    or getattr(r.user, "mail", "")
                    or "?"
                )
                preview_parts = []
                stmt_res = select(models.Researcher).where(
                    models.Researcher.user_id == r.user_id
                )
                res_res = await session.execute(stmt_res)
                researcher = res_res.scalars().first()
                if researcher:
                    if getattr(researcher, "research_interests", None):
                        preview_parts.append(
                            "Направления: "
                            + ", ".join((researcher.research_interests or [])[:3])
                        )
                    if (
                        getattr(researcher, "education", None)
                        and isinstance(researcher.education, list)
                        and researcher.education
                    ):
                        first_edu = researcher.education[0]
                        edu_str = (
                            first_edu.get("institution", "")
                            if isinstance(first_edu, dict)
                            else str(first_edu)
                        )
                        preview_parts.append("Образование: " + (edu_str or ""))
                else:
                    stmt_st = select(models.Student).where(
                        models.Student.user_id == r.user_id
                    )
                    st_res = await session.execute(stmt_st)
                    student = st_res.scalars().first()
                    if student:
                        preview_parts.append("Студент")
                        if getattr(student, "direction", None):
                            preview_parts.append(student.direction or "")
                applicant_preview = "; ".join(preview_parts) if preview_parts else None
                out.append({
                    "id": r.id,
                    "user_id": r.user_id,
                    "vacancy_id": r.vacancy_id,
                    "status": r.status,
                    "created_at": r.created_at,
                    "updated_at": r.updated_at,
                    "vacancy_name": r.vacancy.name if r.vacancy else None,
                    "vacancy_public_id": getattr(r.vacancy, "public_id", None) if r.vacancy else None,
                    "applicant_name": applicant_name,
                    "applicant_preview": applicant_preview or None,
                    "applicant_public_id": getattr(r.user, "public_id", None) if r.user else None,
                })
            return out

    @staticmethod
    async def list_vacancy_responses_admin(
        page: int = 1,
        size: int = 20,
        vacancy_id: Optional[int] = None,
        status_filter: Optional[str] = None,
    ) -> Tuple[List[dict], int]:
        """List vacancy responses for admin with pagination. Returns (items, total)."""
        async with async_session_factory() as session:
            conditions = []
            if vacancy_id is not None:
                conditions.append(models.VacancyResponse.vacancy_id == vacancy_id)
            if status_filter:
                conditions.append(models.VacancyResponse.status == status_filter)
            base_stmt = select(models.VacancyResponse.id)
            if conditions:
                base_stmt = base_stmt.where(and_(*conditions))
            count_stmt = select(func.count()).select_from(base_stmt.subquery())
            total = (await session.execute(count_stmt)).scalar() or 0
            stmt = (
                select(models.VacancyResponse)
                .options(
                    selectinload(models.VacancyResponse.user),
                    selectinload(models.VacancyResponse.vacancy),
                )
                .order_by(models.VacancyResponse.created_at.desc())
            )
            if conditions:
                stmt = stmt.where(and_(*conditions))
            stmt = stmt.offset((page - 1) * size).limit(size)
            result = await session.execute(stmt)
            rows = list(result.unique().scalars().all())
            items = []
            for r in rows:
                applicant_name = (
                    getattr(r.user, "full_name", None)
                    or getattr(r.user, "mail", "")
                    or "?"
                )
                items.append({
                    "id": r.id,
                    "user_id": r.user_id,
                    "user_full_name": applicant_name,
                    "user_public_id": getattr(r.user, "public_id", None) if r.user else None,
                    "vacancy_id": r.vacancy_id,
                    "vacancy_name": r.vacancy.name if r.vacancy else None,
                    "vacancy_public_id": getattr(r.vacancy, "public_id", None) if r.vacancy else None,
                    "status": r.status,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                })
            return items, int(total)

    @staticmethod
    async def list_my_vacancy_responses(user_id: int):
        async with async_session_factory() as session:
            stmt = (
                select(models.VacancyResponse)
                .options(selectinload(models.VacancyResponse.vacancy))
                .where(models.VacancyResponse.user_id == user_id)
                .order_by(models.VacancyResponse.created_at.desc())
            )
            result = await session.execute(stmt)
            rows = list(result.scalars().unique().all())
            return [
                {
                    "id": r.id,
                    "user_id": r.user_id,
                    "vacancy_id": r.vacancy_id,
                    "status": r.status,
                    "created_at": r.created_at,
                    "updated_at": r.updated_at,
                    "vacancy_name": r.vacancy.name if r.vacancy else None,
                    "vacancy_public_id": getattr(r.vacancy, "public_id", None) if r.vacancy else None,
                    "applicant_name": None,
                    "applicant_preview": None,
                }
                for r in rows
            ]

    @staticmethod
    async def update_vacancy_response_status(
        response_id: int, employer_user_id: int, status: str
    ):
        allowed = ("new", "accepted", "rejected")
        if status not in allowed:
            return None
        async with async_session_factory() as session:
            user = await session.get(models.User, employer_user_id)
            org_id = user.organization_id if user else None
            vac = models.VacancyOrganization
            lab = models.OrganizationLaboratory
            cond_creator = vac.creator_user_id == employer_user_id
            conditions = [cond_creator]
            if org_id is not None:
                conditions.append(vac.organization_id == org_id)
                conditions.append(
                    (vac.laboratory_id.isnot(None)) & (lab.organization_id == org_id)
                )
            stmt = (
                select(models.VacancyResponse)
                .options(
                    selectinload(models.VacancyResponse.user),
                    selectinload(models.VacancyResponse.vacancy),
                )
                .where(models.VacancyResponse.id == response_id)
                .join(vac, models.VacancyResponse.vacancy_id == vac.id)
                .outerjoin(lab, vac.laboratory_id == lab.id)
                .where(or_(*conditions))
            )
            result = await session.execute(stmt)
            resp = result.scalars().unique().first()
            if not resp:
                return None
            resp.status = status
            try:
                await session.commit()
                await session.refresh(resp)
            except SQLAlchemyError:
                await session.rollback()
                raise
            applicant_name = (
                getattr(resp.user, "full_name", None)
                or getattr(resp.user, "mail", "")
                or "?"
            )
            return {
                "id": resp.id,
                "user_id": resp.user_id,
                "vacancy_id": resp.vacancy_id,
                "status": resp.status,
                "created_at": resp.created_at,
                "updated_at": resp.updated_at,
                "vacancy_name": resp.vacancy.name if resp.vacancy else None,
                "vacancy_public_id": getattr(resp.vacancy, "public_id", None) if resp.vacancy else None,
                "applicant_name": applicant_name,
                "applicant_preview": None,
            }

    @staticmethod
    async def count_platform_stats() -> dict:
        async with async_session_factory() as session:
            labs_result = await session.execute(
                select(func.count()).select_from(models.OrganizationLaboratory).where(
                    models.OrganizationLaboratory.is_published.is_(True)
                )
            )
            labs_count = labs_result.scalar() or 0
            vac_result = await session.execute(
                select(func.count()).select_from(models.VacancyOrganization).where(
                    models.VacancyOrganization.is_published.is_(True)
                )
            )
            vac_count = vac_result.scalar() or 0
            orgs_result = await session.execute(
                select(func.count()).select_from(models.Organization).where(
                    models.Organization.is_published.is_(True)
                )
            )
            orgs_count = orgs_result.scalar() or 0
            int_result = await session.execute(
                select(models.Employee.research_interests).where(
                    models.Employee.research_interests.isnot(None)
                )
            )
            rows = int_result.scalars().all()
            seen = set()
            interests = []
            for ri in rows:
                if not ri or not isinstance(ri, (list, tuple)):
                    continue
                for item in ri:
                    if isinstance(item, str) and item.strip() and item.strip() not in seen:
                        seen.add(item.strip())
                        interests.append(item.strip())
            resp_result = await session.execute(
                select(func.count()).select_from(models.VacancyResponse)
            )
            responses_count = resp_result.scalar() or 0
            return {
                "laboratories": labs_count,
                "vacancies": vac_count,
                "organizations": orgs_count,
                "responses": responses_count,
                "research_interests": interests,
            }

    @staticmethod
    async def get_admin_dashboard_stats() -> dict:
        """Admin dashboard: counts for organizations, labs, vacancies, queries, users, pending requests."""
        async with async_session_factory() as session:
            orgs_r = await session.execute(
                select(func.count()).select_from(models.Organization).where(
                    models.Organization.is_published.is_(True)
                )
            )
            labs_r = await session.execute(
                select(func.count()).select_from(models.OrganizationLaboratory).where(
                    models.OrganizationLaboratory.is_published.is_(True)
                )
            )
            vac_r = await session.execute(
                select(func.count()).select_from(models.VacancyOrganization).where(
                    models.VacancyOrganization.is_published.is_(True)
                )
            )
            q_r = await session.execute(
                select(func.count()).select_from(models.OrganizationQuery).where(
                    models.OrganizationQuery.is_published.is_(True)
                )
            )
            users_r = await session.execute(select(func.count()).select_from(models.User))
            sub_req_r = await session.execute(
                select(func.count()).select_from(models.SubscriptionRequest).where(
                    models.SubscriptionRequest.status == "pending"
                )
            )
            lab_join_r = await session.execute(
                select(func.count()).select_from(models.LabJoinRequest).where(
                    models.LabJoinRequest.status == "pending"
                )
            )
            org_join_r = await session.execute(
                select(func.count()).select_from(models.OrgJoinRequest).where(
                    models.OrgJoinRequest.status == "pending"
                )
            )
            return {
                "organizations": orgs_r.scalar() or 0,
                "laboratories": labs_r.scalar() or 0,
                "vacancies": vac_r.scalar() or 0,
                "queries": q_r.scalar() or 0,
                "users_count": users_r.scalar() or 0,
                "pending_subscription_requests": sub_req_r.scalar() or 0,
                "pending_lab_join_requests": lab_join_r.scalar() or 0,
                "pending_org_join_requests": org_join_r.scalar() or 0,
            }

    # =============================
    #   LAB JOIN REQUESTS — native async
    # =============================

    @staticmethod
    async def create_lab_join_request(
        researcher_id: int, laboratory_id: int
    ) -> models.LabJoinRequest:
        async with async_session_factory() as session:
            stmt = select(models.LabJoinRequest).where(
                models.LabJoinRequest.researcher_id == researcher_id,
                models.LabJoinRequest.laboratory_id == laboratory_id,
            )
            result = await session.execute(stmt)
            existing = result.scalars().first()
            if existing:
                if existing.status == "approved":
                    raise ValueError("Вы уже являетесь участником этой лаборатории")
                if existing.status == "pending":
                    raise ValueError(
                        "Заявка в эту лабораторию уже отправлена и ожидает рассмотрения"
                    )
                existing.status = "pending"
                try:
                    await session.commit()
                except SQLAlchemyError:
                    await session.rollback()
                    raise
                await session.refresh(existing)
                return existing
            req = models.LabJoinRequest(
                researcher_id=researcher_id,
                laboratory_id=laboratory_id,
                status="pending",
            )
            session.add(req)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            await session.refresh(req)
            return req

    @staticmethod
    async def get_lab_join_requests_for_researcher(
        researcher_id: int,
    ) -> List[models.LabJoinRequest]:
        async with async_session_factory() as session:
            stmt = (
                select(models.LabJoinRequest)
                .options(selectinload(models.LabJoinRequest.laboratory))
                .where(models.LabJoinRequest.researcher_id == researcher_id)
                .order_by(models.LabJoinRequest.created_at.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def leave_laboratory(researcher_id: int, laboratory_id: int) -> bool:
        async with async_session_factory() as session:
            result = await session.execute(
                delete(models.researcher_laboratories).where(
                    models.researcher_laboratories.c.researcher_id == researcher_id,
                    models.researcher_laboratories.c.laboratory_id == laboratory_id,
                )
            )
            if result.rowcount and result.rowcount > 0:
                researcher = await session.get(models.Researcher, researcher_id)
                lab = await session.get(models.OrganizationLaboratory, laboratory_id)
                if researcher and lab:
                    stmt = (
                        select(models.Employee)
                        .options(selectinload(models.Employee.laboratories))
                        .where(models.Employee.user_id == researcher.user_id)
                    )
                    if lab.organization_id is not None:
                        stmt = stmt.where(
                            models.Employee.organization_id == lab.organization_id
                        )
                    else:
                        stmt = stmt.where(
                            models.Employee.organization_id.is_(None),
                            models.Employee.creator_user_id == lab.creator_user_id,
                        )
                    res = await session.execute(stmt)
                    employee = res.scalars().first()
                    if employee and lab in employee.laboratories:
                        employee.laboratories.remove(lab)
                try:
                    await session.commit()
                except SQLAlchemyError:
                    await session.rollback()
                    raise
                return True
            stmt = select(models.LabJoinRequest).where(
                models.LabJoinRequest.researcher_id == researcher_id,
                models.LabJoinRequest.laboratory_id == laboratory_id,
                models.LabJoinRequest.status == "approved",
            )
            res = await session.execute(stmt)
            req = res.scalars().first()
            if req:
                req.status = "left"
                try:
                    await session.commit()
                except SQLAlchemyError:
                    await session.rollback()
                    raise
                return True
            return False

    @staticmethod
    async def get_lab_join_requests_for_org(
        organization_id: int,
    ) -> List[models.LabJoinRequest]:
        async with async_session_factory() as session:
            stmt = (
                select(models.LabJoinRequest)
                .options(
                    selectinload(models.LabJoinRequest.researcher),
                    selectinload(models.LabJoinRequest.laboratory),
                )
                .join(models.OrganizationLaboratory)
                .where(
                    models.OrganizationLaboratory.organization_id == organization_id,
                    models.LabJoinRequest.status == "pending",
                )
                .order_by(models.LabJoinRequest.created_at.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def get_lab_join_requests_for_creator(
        creator_user_id: int,
    ) -> List[models.LabJoinRequest]:
        async with async_session_factory() as session:
            stmt = (
                select(models.LabJoinRequest)
                .options(
                    selectinload(models.LabJoinRequest.researcher),
                    selectinload(models.LabJoinRequest.laboratory),
                )
                .join(models.OrganizationLaboratory)
                .where(
                    models.OrganizationLaboratory.creator_user_id == creator_user_id,
                    models.LabJoinRequest.status == "pending",
                )
                .order_by(models.LabJoinRequest.created_at.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def approve_lab_join_request(
        request_id: int,
    ) -> Optional[models.LabJoinRequest]:
        async with async_session_factory() as session:
            req = await session.get(models.LabJoinRequest, request_id)
            if not req or req.status != "pending":
                return None
            researcher = await session.get(models.Researcher, req.researcher_id)
            lab = await session.get(models.OrganizationLaboratory, req.laboratory_id)
            if not researcher or not lab:
                return None
            await session.execute(
                pg_insert(models.researcher_laboratories)
                .values(
                    researcher_id=req.researcher_id,
                    laboratory_id=req.laboratory_id,
                )
                .on_conflict_do_nothing(
                    index_elements=["researcher_id", "laboratory_id"]
                )
            )
            await helpers.ensure_employee_from_researcher_in_lab(session, researcher, lab)
            req.status = "approved"
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            await session.refresh(req)
            return req

    @staticmethod
    async def reject_lab_join_request(
        request_id: int,
    ) -> Optional[models.LabJoinRequest]:
        async with async_session_factory() as session:
            req = await session.get(models.LabJoinRequest, request_id)
            if not req or req.status != "pending":
                return None
            req.status = "rejected"
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            await session.refresh(req)
            return req

    @staticmethod
    async def get_lab_join_request_by_id(
        request_id: int,
    ) -> Optional[models.LabJoinRequest]:
        async with async_session_factory() as session:
            stmt = (
                select(models.LabJoinRequest)
                .options(
                    selectinload(models.LabJoinRequest.researcher),
                    selectinload(models.LabJoinRequest.laboratory),
                )
                .where(models.LabJoinRequest.id == request_id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def list_all_lab_join_requests_admin(
        status_filter: Optional[str] = None,
        limit: int = 100,
    ) -> List[models.LabJoinRequest]:
        """List all lab join requests for admin. status_filter: 'pending' or None for all."""
        async with async_session_factory() as session:
            stmt = (
                select(models.LabJoinRequest)
                .options(
                    selectinload(models.LabJoinRequest.researcher),
                    selectinload(models.LabJoinRequest.laboratory).selectinload(models.OrganizationLaboratory.organization),
                )
                .order_by(models.LabJoinRequest.created_at.desc())
                .limit(limit)
            )
            if status_filter == "pending":
                stmt = stmt.where(models.LabJoinRequest.status == "pending")
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def list_all_org_join_requests_admin(
        status_filter: Optional[str] = None,
        limit: int = 100,
    ) -> List[models.OrgJoinRequest]:
        """List all org join requests for admin. status_filter: 'pending' or None for all."""
        async with async_session_factory() as session:
            stmt = (
                select(models.OrgJoinRequest)
                .options(
                    selectinload(models.OrgJoinRequest.laboratory),
                    selectinload(models.OrgJoinRequest.organization),
                )
                .order_by(models.OrgJoinRequest.created_at.desc())
                .limit(limit)
            )
            if status_filter == "pending":
                stmt = stmt.where(models.OrgJoinRequest.status == "pending")
            result = await session.execute(stmt)
            return list(result.scalars().all())

    # =============================
    #   ORG JOIN REQUESTS — native async
    # =============================

    @staticmethod
    async def create_org_join_request(
        laboratory_id: int, organization_id: int
    ) -> models.OrgJoinRequest:
        async with async_session_factory() as session:
            stmt = select(models.OrgJoinRequest).where(
                models.OrgJoinRequest.laboratory_id == laboratory_id,
                models.OrgJoinRequest.organization_id == organization_id,
            )
            result = await session.execute(stmt)
            existing = result.scalars().first()
            if existing:
                if existing.status == "approved":
                    raise ValueError("Лаборатория уже привязана к этой организации")
                if existing.status == "pending":
                    raise ValueError(
                        "Заявка на привязку к этой организации уже отправлена и ожидает рассмотрения"
                    )
                existing.status = "pending"
                try:
                    await session.commit()
                except SQLAlchemyError:
                    await session.rollback()
                    raise
                await session.refresh(existing)
                return existing
            req = models.OrgJoinRequest(
                laboratory_id=laboratory_id,
                organization_id=organization_id,
                status="pending",
            )
            session.add(req)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            await session.refresh(req)
            return req

    @staticmethod
    async def get_org_join_requests_for_researcher_or_lab_rep(
        user_id: int,
    ) -> List[models.OrgJoinRequest]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrgJoinRequest)
                .options(
                    selectinload(models.OrgJoinRequest.laboratory),
                    selectinload(models.OrgJoinRequest.organization),
                )
                .join(models.OrganizationLaboratory)
                .where(models.OrganizationLaboratory.creator_user_id == user_id)
                .order_by(models.OrgJoinRequest.created_at.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def get_org_join_requests_for_org(
        organization_id: int,
    ) -> List[models.OrgJoinRequest]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrgJoinRequest)
                .options(
                    selectinload(models.OrgJoinRequest.laboratory),
                    selectinload(models.OrgJoinRequest.organization),
                )
                .where(
                    models.OrgJoinRequest.organization_id == organization_id,
                    models.OrgJoinRequest.status == "pending",
                )
                .order_by(models.OrgJoinRequest.created_at.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    async def approve_org_join_request(
        request_id: int,
    ) -> Optional[models.OrgJoinRequest]:
        async with async_session_factory() as session:
            req = await session.get(models.OrgJoinRequest, request_id)
            if not req or req.status != "pending":
                return None
            stmt = (
                select(models.OrganizationLaboratory)
                .options(
                    selectinload(models.OrganizationLaboratory.equipment),
                    selectinload(models.OrganizationLaboratory.employees),
                    selectinload(models.OrganizationLaboratory.task_solutions),
                    selectinload(models.OrganizationLaboratory.queries),
                )
                .where(models.OrganizationLaboratory.id == req.laboratory_id)
            )
            res = await session.execute(stmt)
            lab = res.scalars().first()
            org = await session.get(models.Organization, req.organization_id)
            if not lab or not org:
                return None
            lab.organization_id = org.id
            for item in lab.equipment or []:
                item.organization_id = org.id
            for item in lab.employees or []:
                item.organization_id = org.id
            for item in lab.task_solutions or []:
                item.organization_id = org.id
            for item in lab.queries or []:
                item.organization_id = org.id
            vac_stmt = select(models.VacancyOrganization).where(
                models.VacancyOrganization.laboratory_id == lab.id
            )
            vac_res = await session.execute(vac_stmt)
            vacs = vac_res.scalars().all()
            for v in vacs:
                v.organization_id = org.id
            req.status = "approved"
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            await session.refresh(req)
            return req

    @staticmethod
    async def reject_org_join_request(
        request_id: int,
    ) -> Optional[models.OrgJoinRequest]:
        async with async_session_factory() as session:
            req = await session.get(models.OrgJoinRequest, request_id)
            if not req or req.status != "pending":
                return None
            req.status = "rejected"
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            await session.refresh(req)
            return req

    @staticmethod
    async def leave_organization(
        request_id: int, creator_user_id: int
    ) -> Optional[dict]:
        async with async_session_factory() as session:
            req = await session.get(models.OrgJoinRequest, request_id)
            if not req or req.status != "approved":
                return None
            stmt = (
                select(models.OrganizationLaboratory)
                .options(
                    selectinload(models.OrganizationLaboratory.equipment),
                    selectinload(models.OrganizationLaboratory.employees),
                    selectinload(models.OrganizationLaboratory.task_solutions),
                    selectinload(models.OrganizationLaboratory.queries),
                )
                .where(models.OrganizationLaboratory.id == req.laboratory_id)
            )
            res = await session.execute(stmt)
            lab = res.scalars().first()
            org = await session.get(models.Organization, req.organization_id)
            if not lab or not org or lab.creator_user_id != creator_user_id:
                return None
            lab.organization_id = None
            for item in lab.equipment or []:
                item.organization_id = None
            for item in lab.employees or []:
                item.organization_id = None
            for item in lab.task_solutions or []:
                item.organization_id = None
            for item in lab.queries or []:
                item.organization_id = None
            vac_stmt = select(models.VacancyOrganization).where(
                models.VacancyOrganization.laboratory_id == lab.id
            )
            vac_res = await session.execute(vac_stmt)
            vacs = vac_res.scalars().all()
            for v in vacs:
                v.organization_id = None
            req.status = "left"
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return {
                "lab_id": lab.id,
                "lab_name": lab.name or "",
                "org_id": org.id,
                "org_name": org.name or "",
            }

    @staticmethod
    async def get_org_join_request_by_id(
        request_id: int,
    ) -> Optional[models.OrgJoinRequest]:
        async with async_session_factory() as session:
            stmt = (
                select(models.OrgJoinRequest)
                .options(
                    selectinload(models.OrgJoinRequest.laboratory),
                    selectinload(models.OrgJoinRequest.organization),
                )
                .where(models.OrgJoinRequest.id == request_id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    # =============================
    #        ADMIN (platform_admin)
    # =============================

    @staticmethod
    async def list_organizations_admin(
        page: int = 1,
        size: int = 20,
    ) -> Tuple[List[models.Organization], int]:
        """List all organizations with pagination. Returns (items, total)."""
        async with async_session_factory() as session:
            count_stmt = select(func.count()).select_from(models.Organization)
            total = (await session.execute(count_stmt)).scalar() or 0
            stmt = (
                select(models.Organization)
                .order_by(models.Organization.id.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
            result = await session.execute(stmt)
            items = list(result.scalars().all())
            return items, total

    @staticmethod
    async def admin_update_organization(
        org_id: int,
        name: Optional[str] = None,
        avatar_url: Optional[str] = None,
        description: Optional[str] = None,
        address: Optional[str] = None,
        website: Optional[str] = None,
        ror_id: Optional[str] = None,
        is_published: Optional[bool] = None,
        hidden_public_sections: Optional[List[str]] = None,
    ) -> Optional[models.Organization]:
        """Update organization by id (admin, no ownership check)."""
        async with async_session_factory() as session:
            org = await session.get(models.Organization, org_id)
            if not org:
                return None
            if name is not None:
                org.name = name
            if avatar_url is not None:
                org.avatar_url = avatar_url
            if description is not None:
                org.description = description
            if address is not None:
                org.address = address
            if website is not None:
                org.website = website
            if ror_id is not None:
                org.ror_id = ror_id
            if is_published is not None:
                org.is_published = bool(is_published)
            if hidden_public_sections is not None:
                org.hidden_public_sections = list(hidden_public_sections)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            await session.refresh(org)
            return org

    @staticmethod
    async def list_laboratories_admin(
        page: int = 1,
        size: int = 20,
    ) -> Tuple[List[models.OrganizationLaboratory], int]:
        """List all laboratories with pagination. Returns (items, total)."""
        async with async_session_factory() as session:
            count_stmt = select(func.count()).select_from(models.OrganizationLaboratory)
            total = (await session.execute(count_stmt)).scalar() or 0
            stmt = (
                select(models.OrganizationLaboratory)
                .options(
                    selectinload(models.OrganizationLaboratory.organization),
                    selectinload(models.OrganizationLaboratory.head_employee),
                    selectinload(models.OrganizationLaboratory.employees),
                    selectinload(models.OrganizationLaboratory.equipment),
                    selectinload(models.OrganizationLaboratory.task_solutions),
                )
                .order_by(models.OrganizationLaboratory.id.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
            result = await session.execute(stmt)
            return list(result.scalars().all()), total

    @staticmethod
    async def get_laboratory_by_id(lab_id: int) -> Optional[models.OrganizationLaboratory]:
        """Get laboratory by internal id."""
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationLaboratory)
                .options(
                    selectinload(models.OrganizationLaboratory.organization),
                    selectinload(models.OrganizationLaboratory.head_employee),
                    selectinload(models.OrganizationLaboratory.employees),
                    selectinload(models.OrganizationLaboratory.equipment),
                    selectinload(models.OrganizationLaboratory.task_solutions),
                )
                .where(models.OrganizationLaboratory.id == lab_id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def admin_update_laboratory(
        lab_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        activities: Optional[str] = None,
        image_urls: Optional[List[str]] = None,
        is_published: Optional[bool] = None,
        employee_ids: Optional[List[int]] = None,
        head_employee_id: Optional[int] = None,
        equipment_ids: Optional[List[int]] = None,
        task_solution_ids: Optional[List[int]] = None,
        hidden_public_sections: Optional[List[str]] = None,
    ) -> Optional[models.OrganizationLaboratory]:
        """Update laboratory by id (admin, no ownership check)."""
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationLaboratory)
                .options(selectinload(models.OrganizationLaboratory.employees))
                .where(models.OrganizationLaboratory.id == lab_id)
            )
            result = await session.execute(stmt)
            lab = result.scalars().first()
            if not lab:
                return None
            org_id = lab.organization_id
            creator_id = lab.creator_user_id
            if name is not None:
                lab.name = name
            if description is not None:
                lab.description = description
            if activities is not None:
                lab.activities = activities
            if image_urls is not None:
                lab.image_urls = image_urls
            if hidden_public_sections is not None:
                lab.hidden_public_sections = list(hidden_public_sections)
            if is_published is not None:
                lab.is_published = bool(is_published)
            if employee_ids is not None or head_employee_id is not None:
                eids = list(employee_ids) if employee_ids is not None else [e.id for e in (lab.employees or [])]
                if head_employee_id is not None:
                    lab.head_employee_id = head_employee_id
                    if head_employee_id not in eids:
                        eids = list(set(eids) | {head_employee_id})
                else:
                    lab.head_employee_id = None
                await session.execute(
                    delete(models.employee_laboratories).where(
                        models.employee_laboratories.c.laboratory_id == lab.id
                    )
                )
                if org_id is not None:
                    emps = await helpers.get_employees_by_ids(session, org_id, eids)
                elif creator_id is not None:
                    emps = await helpers.get_employees_by_ids_for_creator(session, creator_id, eids)
                else:
                    emps = []
                if emps:
                    await session.execute(
                        insert(models.employee_laboratories),
                        [{"employee_id": e.id, "laboratory_id": lab.id} for e in emps],
                    )
            if equipment_ids is not None:
                await session.execute(
                    delete(models.laboratory_equipment).where(
                        models.laboratory_equipment.c.laboratory_id == lab.id
                    )
                )
                if org_id is not None:
                    eqs = await helpers.get_equipment_by_ids(session, org_id, equipment_ids)
                elif creator_id is not None:
                    eqs = await helpers.get_equipment_by_ids_for_creator(session, creator_id, equipment_ids)
                else:
                    eqs = []
                if eqs:
                    await session.execute(
                        insert(models.laboratory_equipment),
                        [{"laboratory_id": lab.id, "equipment_id": e.id} for e in eqs],
                    )
            if task_solution_ids is not None:
                await session.execute(
                    delete(models.task_solution_laboratories).where(
                        models.task_solution_laboratories.c.laboratory_id == lab.id
                    )
                )
                if org_id is not None:
                    tss = await helpers.get_task_solutions_by_ids(session, org_id, task_solution_ids)
                elif creator_id is not None:
                    tss = await helpers.get_task_solutions_by_ids_for_creator(session, creator_id, task_solution_ids)
                else:
                    tss = []
                if tss:
                    await session.execute(
                        insert(models.task_solution_laboratories),
                        [{"laboratory_id": lab.id, "task_solution_id": ts.id} for ts in tss],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationLaboratory)
                .options(*Orm._lab_select_options())
                .where(models.OrganizationLaboratory.id == lab_id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def list_vacancies_admin(
        page: int = 1,
        size: int = 20,
    ) -> Tuple[List[models.VacancyOrganization], int]:
        """List all vacancies with pagination. Returns (items, total)."""
        async with async_session_factory() as session:
            count_stmt = select(func.count()).select_from(models.VacancyOrganization)
            total = (await session.execute(count_stmt)).scalar() or 0
            stmt = (
                select(models.VacancyOrganization)
                .options(
                    selectinload(models.VacancyOrganization.organization),
                    selectinload(models.VacancyOrganization.laboratory),
                    selectinload(models.VacancyOrganization.query),
                )
                .order_by(models.VacancyOrganization.id.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
            result = await session.execute(stmt)
            return list(result.scalars().all()), total

    @staticmethod
    async def admin_update_vacancy(
        vacancy_id: int,
        name: Optional[str] = None,
        requirements: Optional[str] = None,
        description: Optional[str] = None,
        employment_type: Optional[str] = None,
        is_published: Optional[bool] = None,
        query_id: Optional[int] = None,
        laboratory_id: Optional[int] = None,
        contact_employee_id: Optional[int] = None,
        contact_email: Optional[str] = None,
        contact_phone: Optional[str] = None,
    ) -> Optional[models.VacancyOrganization]:
        """Update vacancy by id (admin, no ownership check)."""
        async with async_session_factory() as session:
            vacancy = await session.get(models.VacancyOrganization, vacancy_id)
            if not vacancy:
                return None
            if name is not None:
                vacancy.name = name
            if requirements is not None:
                vacancy.requirements = requirements
            if description is not None:
                vacancy.description = description
            if employment_type is not None:
                vacancy.employment_type = employment_type
            if is_published is not None:
                vacancy.is_published = bool(is_published)
            if query_id is not None:
                vacancy.query_id = query_id
            if laboratory_id is not None:
                vacancy.laboratory_id = laboratory_id
            if contact_employee_id is not None:
                vacancy.contact_employee_id = contact_employee_id
            if contact_email is not None:
                vacancy.contact_email = contact_email
            if contact_phone is not None:
                vacancy.contact_phone = contact_phone
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.VacancyOrganization)
                .options(
                    selectinload(models.VacancyOrganization.organization),
                    selectinload(models.VacancyOrganization.laboratory),
                    selectinload(models.VacancyOrganization.query),
                )
                .where(models.VacancyOrganization.id == vacancy_id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def list_queries_admin(
        page: int = 1,
        size: int = 20,
    ) -> Tuple[List[models.OrganizationQuery], int]:
        """List all queries with pagination. Returns (items, total)."""
        async with async_session_factory() as session:
            count_stmt = select(func.count()).select_from(models.OrganizationQuery)
            total = (await session.execute(count_stmt)).scalar() or 0
            stmt = (
                select(models.OrganizationQuery)
                .options(
                    selectinload(models.OrganizationQuery.organization),
                    selectinload(models.OrganizationQuery.laboratories),
                    selectinload(models.OrganizationQuery.employees),
                )
                .order_by(models.OrganizationQuery.id.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
            result = await session.execute(stmt)
            return list(result.scalars().all()), total

    @staticmethod
    async def get_query_by_id(query_id: int) -> Optional[models.OrganizationQuery]:
        """Get query by internal id."""
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationQuery)
                .options(
                    selectinload(models.OrganizationQuery.organization),
                    selectinload(models.OrganizationQuery.laboratories),
                    selectinload(models.OrganizationQuery.employees),
                )
                .where(models.OrganizationQuery.id == query_id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def admin_update_query(
        query_id: int,
        title: Optional[str] = None,
        task_description: Optional[str] = None,
        completed_examples: Optional[str] = None,
        grant_info: Optional[str] = None,
        budget: Optional[str] = None,
        deadline: Optional[str] = None,
        status: Optional[str] = None,
        linked_task_solution_id: Optional[int] = None,
        laboratory_ids: Optional[List[int]] = None,
        employee_ids: Optional[List[int]] = None,
        is_published: Optional[bool] = None,
    ) -> Optional[models.OrganizationQuery]:
        """Update query by id (admin, no ownership check)."""
        async with async_session_factory() as session:
            query = await session.get(models.OrganizationQuery, query_id)
            if not query:
                return None
            org_id = query.organization_id
            creator_id = query.creator_user_id
            if title is not None:
                query.title = title
            if task_description is not None:
                query.task_description = task_description
            if completed_examples is not None:
                query.completed_examples = completed_examples
            if grant_info is not None:
                query.grant_info = grant_info
            if budget is not None:
                query.budget = budget
            if deadline is not None:
                query.deadline = deadline
            if status is not None:
                query.status = status
            if linked_task_solution_id is not None:
                query.linked_task_solution_id = linked_task_solution_id
            if is_published is not None:
                query.is_published = bool(is_published)
            if laboratory_ids is not None:
                await session.execute(
                    delete(models.query_laboratories).where(
                        models.query_laboratories.c.query_id == query.id
                    )
                )
                if org_id is not None:
                    labs = await helpers.get_labs_by_ids(session, org_id, laboratory_ids)
                elif creator_id is not None:
                    labs = await helpers.get_labs_by_ids_for_creator(session, creator_id, laboratory_ids)
                else:
                    labs = []
                if labs:
                    await session.execute(
                        insert(models.query_laboratories),
                        [{"query_id": query.id, "laboratory_id": lab.id} for lab in labs],
                    )
            if employee_ids is not None:
                await session.execute(
                    delete(models.query_employees).where(
                        models.query_employees.c.query_id == query.id
                    )
                )
                if org_id is not None:
                    emps = await helpers.get_employees_by_ids(session, org_id, employee_ids)
                elif creator_id is not None:
                    emps = await helpers.get_employees_by_ids_for_creator(session, creator_id, employee_ids)
                else:
                    emps = []
                if emps:
                    await session.execute(
                        insert(models.query_employees),
                        [{"query_id": query.id, "employee_id": e.id} for e in emps],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationQuery)
                .options(
                    selectinload(models.OrganizationQuery.organization),
                    selectinload(models.OrganizationQuery.laboratories),
                    selectinload(models.OrganizationQuery.employees),
                )
                .where(models.OrganizationQuery.id == query_id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def list_equipment_admin(
        page: int = 1,
        size: int = 20,
    ) -> Tuple[List[models.OrganizationEquipment], int]:
        """List all equipment with pagination (admin)."""
        async with async_session_factory() as session:
            count_stmt = select(func.count()).select_from(models.OrganizationEquipment)
            total = (await session.execute(count_stmt)).scalar() or 0
            stmt = (
                select(models.OrganizationEquipment)
                .options(
                    selectinload(models.OrganizationEquipment.laboratories),
                    selectinload(models.OrganizationEquipment.organization),
                )
                .order_by(models.OrganizationEquipment.id.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
            result = await session.execute(stmt)
            return list(result.scalars().all()), total

    @staticmethod
    async def admin_get_equipment(equipment_id: int) -> Optional[models.OrganizationEquipment]:
        """Get equipment by id (admin, no org check)."""
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationEquipment)
                .options(
                    selectinload(models.OrganizationEquipment.laboratories),
                    selectinload(models.OrganizationEquipment.organization),
                )
                .where(models.OrganizationEquipment.id == equipment_id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def admin_update_equipment(
        equipment_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        characteristics: Optional[str] = None,
        image_urls: Optional[List[str]] = None,
        laboratory_ids: Optional[List[int]] = None,
    ) -> Optional[models.OrganizationEquipment]:
        """Update equipment by id (admin, no org check)."""
        async with async_session_factory() as session:
            stmt = select(models.OrganizationEquipment).where(models.OrganizationEquipment.id == equipment_id)
            result = await session.execute(stmt)
            equipment = result.scalars().first()
            if not equipment:
                return None
            if name is not None:
                equipment.name = name
            if description is not None:
                equipment.description = description
            if characteristics is not None:
                equipment.characteristics = characteristics
            if image_urls is not None:
                equipment.image_urls = image_urls
            if laboratory_ids is not None:
                await session.execute(
                    delete(models.laboratory_equipment).where(
                        models.laboratory_equipment.c.equipment_id == equipment.id
                    )
                )
                if equipment.organization_id is not None:
                    labs = await helpers.get_labs_by_ids(session, equipment.organization_id, laboratory_ids)
                elif equipment.creator_user_id is not None:
                    labs = await helpers.get_labs_by_ids_for_creator(
                        session, equipment.creator_user_id, laboratory_ids
                    )
                else:
                    labs = []
                if labs:
                    await session.execute(
                        insert(models.laboratory_equipment),
                        [
                            {"laboratory_id": lab.id, "equipment_id": equipment.id}
                            for lab in labs
                        ],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationEquipment)
                .options(selectinload(models.OrganizationEquipment.laboratories))
                .where(models.OrganizationEquipment.id == equipment.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def admin_delete_equipment(equipment_id: int) -> bool:
        """Удаление оборудования по id (админ, в т.ч. без organization_id и creator_user_id)."""
        async with async_session_factory() as session:
            stmt = select(models.OrganizationEquipment).where(
                models.OrganizationEquipment.id == equipment_id
            )
            result = await session.execute(stmt)
            equipment = result.scalars().first()
            if not equipment:
                return False
            await session.delete(equipment)
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            return True

    @staticmethod
    async def list_task_solutions_admin(
        page: int = 1,
        size: int = 20,
    ) -> Tuple[List[models.OrganizationTaskSolution], int]:
        """List all task solutions with pagination (admin)."""
        async with async_session_factory() as session:
            count_stmt = select(func.count()).select_from(models.OrganizationTaskSolution)
            total = (await session.execute(count_stmt)).scalar() or 0
            stmt = (
                select(models.OrganizationTaskSolution)
                .options(
                    selectinload(models.OrganizationTaskSolution.laboratories),
                    selectinload(models.OrganizationTaskSolution.organization),
                )
                .order_by(models.OrganizationTaskSolution.id.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
            result = await session.execute(stmt)
            return list(result.scalars().all()), total

    @staticmethod
    async def admin_get_task_solution(task_id: int) -> Optional[models.OrganizationTaskSolution]:
        """Get task solution by id (admin, no org check)."""
        async with async_session_factory() as session:
            stmt = (
                select(models.OrganizationTaskSolution)
                .options(
                    selectinload(models.OrganizationTaskSolution.laboratories),
                    selectinload(models.OrganizationTaskSolution.organization),
                )
                .where(models.OrganizationTaskSolution.id == task_id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def admin_update_task_solution(
        task_id: int,
        title: Optional[str] = None,
        task_description: Optional[str] = None,
        solution_description: Optional[str] = None,
        article_links: Optional[List[str]] = None,
        solution_deadline: Optional[str] = None,
        grant_info: Optional[str] = None,
        cost: Optional[str] = None,
        external_solutions: Optional[str] = None,
        laboratory_ids: Optional[List[int]] = None,
    ) -> Optional[models.OrganizationTaskSolution]:
        """Update task solution by id (admin, no org check)."""
        async with async_session_factory() as session:
            stmt = select(models.OrganizationTaskSolution).where(models.OrganizationTaskSolution.id == task_id)
            result = await session.execute(stmt)
            task = result.scalars().first()
            if not task:
                return None
            if title is not None:
                task.title = title
            if task_description is not None:
                task.task_description = task_description
            if solution_description is not None:
                task.solution_description = solution_description
            if article_links is not None:
                task.article_links = article_links
            if solution_deadline is not None:
                task.solution_deadline = solution_deadline
            if grant_info is not None:
                task.grant_info = grant_info
            if cost is not None:
                task.cost = cost
            if external_solutions is not None:
                task.external_solutions = external_solutions
            if laboratory_ids is not None:
                await session.execute(
                    delete(models.task_solution_laboratories).where(
                        models.task_solution_laboratories.c.task_solution_id == task.id
                    )
                )
                if task.organization_id is not None:
                    labs = await helpers.get_labs_by_ids(session, task.organization_id, laboratory_ids)
                elif task.creator_user_id is not None:
                    labs = await helpers.get_labs_by_ids_for_creator(
                        session, task.creator_user_id, laboratory_ids
                    )
                else:
                    labs = []
                if labs:
                    await session.execute(
                        insert(models.task_solution_laboratories),
                        [
                            {"task_solution_id": task.id, "laboratory_id": lab.id}
                            for lab in labs
                        ],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.OrganizationTaskSolution)
                .options(selectinload(models.OrganizationTaskSolution.laboratories))
                .where(models.OrganizationTaskSolution.id == task.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def list_employees_admin(
        page: int = 1,
        size: int = 20,
    ) -> Tuple[List[models.Employee], int]:
        """List all employees with pagination (admin)."""
        async with async_session_factory() as session:
            count_stmt = select(func.count()).select_from(models.Employee)
            total = (await session.execute(count_stmt)).scalar() or 0
            stmt = (
                select(models.Employee)
                .options(
                    selectinload(models.Employee.laboratories),
                    selectinload(models.Employee.organization),
                )
                .order_by(models.Employee.id.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
            result = await session.execute(stmt)
            return list(result.scalars().all()), total

    @staticmethod
    async def admin_get_employee(employee_id: int) -> Optional[models.Employee]:
        """Get employee by id (admin, no org check)."""
        async with async_session_factory() as session:
            stmt = (
                select(models.Employee)
                .options(
                    selectinload(models.Employee.laboratories),
                    selectinload(models.Employee.organization),
                )
                .where(models.Employee.id == employee_id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()

    @staticmethod
    async def admin_update_employee(
        employee_id: int,
        full_name: Optional[str] = None,
        positions: Optional[List[str]] = None,
        academic_degree: Optional[str] = None,
        photo_url: Optional[str] = None,
        research_interests: Optional[List[str]] = None,
        education: Optional[List[str]] = None,
        publications: Optional[List[dict]] = None,
        hindex_wos: Optional[int] = None,
        hindex_scopus: Optional[int] = None,
        hindex_rsci: Optional[int] = None,
        hindex_openalex: Optional[int] = None,
        contacts: Optional[dict] = None,
        laboratory_ids: Optional[List[int]] = None,
    ) -> Optional[models.Employee]:
        """Update employee by id (admin, no org check)."""
        async with async_session_factory() as session:
            stmt = select(models.Employee).where(models.Employee.id == employee_id)
            result = await session.execute(stmt)
            employee = result.scalars().first()
            if not employee:
                return None
            if full_name is not None:
                employee.full_name = full_name
            if positions is not None:
                employee.position = positions
            if academic_degree is not None:
                employee.academic_degree = academic_degree
            if photo_url is not None:
                employee.photo_url = photo_url
            if research_interests is not None:
                employee.research_interests = research_interests
            if education is not None:
                employee.education = education
            if publications is not None:
                employee.publications = publications
            if hindex_wos is not None:
                employee.hindex_wos = hindex_wos
            if hindex_scopus is not None:
                employee.hindex_scopus = hindex_scopus
            if hindex_rsci is not None:
                employee.hindex_rsci = hindex_rsci
            if hindex_openalex is not None:
                employee.hindex_openalex = hindex_openalex
            if contacts is not None:
                employee.contacts = contacts
            if laboratory_ids is not None:
                await session.execute(
                    delete(models.employee_laboratories).where(
                        models.employee_laboratories.c.employee_id == employee.id
                    )
                )
                if employee.organization_id is not None:
                    labs = await helpers.get_labs_by_ids(
                        session, employee.organization_id, laboratory_ids
                    )
                elif employee.creator_user_id is not None:
                    labs = await helpers.get_labs_by_ids_for_creator(
                        session, employee.creator_user_id, laboratory_ids
                    )
                else:
                    labs = []
                if labs:
                    await session.execute(
                        insert(models.employee_laboratories),
                        [
                            {"employee_id": employee.id, "laboratory_id": lab.id}
                            for lab in labs
                        ],
                    )
            try:
                await session.commit()
            except SQLAlchemyError:
                await session.rollback()
                raise
            stmt = (
                select(models.Employee)
                .options(selectinload(models.Employee.laboratories))
                .where(models.Employee.id == employee.id)
            )
            result = await session.execute(stmt)
            return result.scalars().first()
