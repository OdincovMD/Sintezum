"""
Фоновая синхронизация данных OpenAlex.
Вызывается APScheduler раз в день (03:00).
Использует app.queries.Orm (Core + Researcher + Representative, native async).
"""

import logging

from app.queries.orm import Orm
from app.services.openalex import (
    fetch_author_by_orcid,
    fetch_author_by_id,
    fetch_author_works,
    map_author_to_researcher,
    fetch_institution_by_ror,
    map_institution_to_organization,
)

logger = logging.getLogger(__name__)


def _extract_openalex_id(val: str) -> str:
    if not val:
        return ""
    return val.split("/")[-1] if "/" in val else val


async def _sync_openalex_data_async() -> None:
    """Синхронизация исследователей и организаций из OpenAlex (async)."""
    logger.info("OpenAlex sync started")
    users = await Orm.get_users_with_openalex_or_orcid()
    for user in users:
        try:
            author = None
            openalex_id = user.openalex_id
            if openalex_id:
                author = fetch_author_by_id(openalex_id)
            elif user.orcid:
                author = fetch_author_by_orcid(user.orcid)
                if author:
                    oa_id = _extract_openalex_id(author.get("id", ""))
                    if oa_id:
                        await Orm.update_user_openalex(user.id, oa_id)
                        openalex_id = oa_id
            if not author:
                continue
            if not openalex_id:
                openalex_id = _extract_openalex_id(author.get("id", ""))
            if user.role and user.role.name == "researcher":
                works = fetch_author_works(openalex_id, per_page=25)
                mapped = map_author_to_researcher(author, works)
                await Orm.upsert_researcher_profile(
                    user.id,
                    full_name=mapped.get("full_name"),
                    research_interests=mapped.get("research_interests"),
                    education=mapped.get("education"),
                    publications=mapped.get("publications"),
                    hindex_openalex=mapped.get("hindex_openalex"),
                )
        except Exception as e:
            logger.warning("OpenAlex sync user %s: %s", user.id, e)

    orgs = await Orm.get_organizations_with_ror()
    for org in orgs:
        try:
            institution = fetch_institution_by_ror(org.ror_id)
            if not institution:
                continue
            mapped = map_institution_to_organization(institution)
            await Orm.update_organization_fields(
                org.id,
                name=mapped.get("name"),
                avatar_url=mapped.get("avatar_url"),
                address=mapped.get("address"),
                website=mapped.get("website"),
            )
        except Exception as e:
            logger.warning("OpenAlex sync org %s: %s", org.id, e)

    logger.info("OpenAlex sync completed")


async def sync_openalex_data() -> None:
    """Запустить синхронизацию в event loop FastAPI/AsyncIOScheduler."""
    await _sync_openalex_data_async()
