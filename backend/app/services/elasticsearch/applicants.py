"""
Индексация и поиск соискателей в Elasticsearch.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

from elasticsearch.exceptions import NotFoundError
from elastic_transport import ConnectionTimeout

from app.config import settings

from .client import get_es_client
from .mappings import APPLICANTS_INDEX_MAPPING
from .utils import sort_by_date

logger = logging.getLogger(__name__)


def _education_to_text(education: Any) -> str:
    """Преобразовать education (JSON) в строку для поиска."""
    if not education:
        return ""
    if isinstance(education, str):
        return education
    if not isinstance(education, list):
        return str(education)
    parts = []
    for item in education:
        if isinstance(item, dict):
            inst = item.get("institution") or item.get("institution_name") or ""
            spec = item.get("speciality") or item.get("specialty") or ""
            if inst or spec:
                parts.append(f"{inst} {spec}".strip())
            else:
                parts.append(str(item))
        elif isinstance(item, str):
            parts.append(item)
        else:
            parts.append(str(item))
    return " ".join(parts)


def _applicant_to_doc(user: Any, student: Any, researcher: Any) -> dict:
    """Преобразовать User+Student/Researcher в документ для индекса."""
    role_name = user.role.name if user.role else ""
    profile = student if role_name == "student" else researcher
    full_name = (profile.full_name if profile else None) or user.full_name or ""

    education_text = ""
    skills_text = ""
    research_interests_text = ""
    status_val = ""
    position = ""
    job_search_status = ""
    employment_type_preference = ""
    summary = ""

    if role_name == "student" and student:
        education_text = _education_to_text(getattr(student, "education", None))
        skills = getattr(student, "skills", None) or []
        skills_text = " ".join(str(s) for s in skills) if isinstance(skills, list) else str(skills)
        ri = getattr(student, "research_interests", None) or []
        research_interests_text = " ".join(str(x) for x in ri) if isinstance(ri, list) else str(ri)
        summary = getattr(student, "summary", None) or ""
    elif role_name == "researcher" and researcher:
        education_text = _education_to_text(getattr(researcher, "education", None))
        ri = getattr(researcher, "research_interests", None) or []
        research_interests_text = " ".join(str(x) for x in ri) if isinstance(ri, list) else str(ri)
        position = getattr(researcher, "position", None) or ""
        job_search_status = getattr(researcher, "job_search_status", None) or ""
        employment_type_preference = getattr(researcher, "employment_type_preference", None) or ""
        summary = getattr(researcher, "summary", None) or (getattr(researcher, "job_search_notes", None) or "")[:500]

    # status для фильтра: student — Практика, Трудоустройство, Стажировка; researcher — active, passive, not_active
    if role_name == "student" and student:
        status_val = getattr(student, "status", None) or ""
    elif role_name == "researcher" and researcher:
        status_val = getattr(researcher, "job_search_status", None) or ""

    created = getattr(user, "created_at", None)

    doc = {
        "id": user.id,
        "public_id": getattr(user, "public_id", None) or "",
        "user_id": user.id,
        "role": role_name,
        "full_name": full_name,
        "status": status_val,
        "education_text": education_text,
        "skills_text": skills_text,
        "research_interests_text": research_interests_text,
        "summary": summary,
        "position": position,
        "job_search_status": job_search_status,
        "employment_type_preference": employment_type_preference,
        "photo_url": getattr(user, "photo_url", None),
        "created_at": created.isoformat() if created else None,
    }

    # Completion suggest (document id = user_id, _source содержит public_id, full_name)
    public_id = getattr(user, "public_id", None) or ""
    suggest_inputs = []
    if full_name:
        suggest_inputs.append(full_name)
    if public_id:
        suggest_inputs.append(public_id)
    if suggest_inputs:
        doc["full_name_suggest"] = {"input": suggest_inputs, "weight": 2}
        doc["public_id_suggest"] = {"input": [public_id], "weight": 2}

    skills = getattr(profile, "skills", None) if profile and role_name == "student" else []
    if skills and isinstance(skills, list):
        doc["skills_suggest"] = {"input": [str(s)[:50] for s in skills[:10] if s], "weight": 1}

    ri = getattr(profile, "research_interests", None) if profile else []
    if ri and isinstance(ri, list):
        doc["research_interests_suggest"] = {"input": [str(x)[:50] for x in ri[:10] if x], "weight": 1}

    if position:
        doc["position_suggest"] = {"input": [position], "weight": 1}
    if status_val:
        doc["status_suggest"] = {"input": [status_val], "weight": 1}

    return doc


def _doc_to_applicant_item(doc: dict) -> dict:
    """Преобразовать документ ES в ApplicantListItem."""
    source = doc.get("_source", doc)
    return {
        "public_id": source.get("public_id", ""),
        "full_name": source.get("full_name", ""),
        "photo_url": source.get("photo_url"),
        "role": source.get("role", ""),
        "summary": source.get("summary"),
        "created_at": source.get("created_at"),
    }


async def ensure_applicants_index() -> None:
    """Создать индекс соискателей, если не существует."""
    client = get_es_client()
    index = settings.APPLICANTS_INDEX
    try:
        exists = await client.indices.exists(index=index)
        if not exists:
            await client.indices.create(index=index, body=APPLICANTS_INDEX_MAPPING)
            logger.info("Created Elasticsearch index: %s", index)
        else:
            await client.indices.put_settings(index=index, body={"number_of_replicas": 0})
        await client.cluster.health(
            index=index,
            wait_for_status="yellow",
            timeout=f"{settings.ELASTICSEARCH_REQUEST_TIMEOUT}s",
        )
    except Exception as e:
        logger.warning("Could not ensure applicants index: %s", e)


async def _applicants_index_count() -> int:
    """Количество документов в индексе соискателей."""
    client = get_es_client()
    try:
        resp = await client.count(index=settings.APPLICANTS_INDEX)
        return resp.get("count", 0)
    except Exception:
        return 0


async def index_applicant(user_id: int) -> None:
    """Проиндексировать соискателя. Индексирует только если is_published."""
    from app.queries.orm import Orm

    user = await Orm.get_applicant_user_for_index(user_id)
    if not user:
        await delete_applicant(user_id)
        return

    role_name = user.role.name if user.role else ""
    student = user.student_profile if role_name == "student" else None
    researcher = user.researcher_profile if role_name == "researcher" else None
    profile = student or researcher

    if not profile or not getattr(profile, "is_published", False):
        await delete_applicant(user_id)
        return

    client = get_es_client()
    doc = _applicant_to_doc(user, student, researcher)
    last_err = None
    for attempt in range(3):
        try:
            await client.index(
                index=settings.APPLICANTS_INDEX,
                id=str(user_id),
                document=doc,
                request_timeout=settings.ELASTICSEARCH_REQUEST_TIMEOUT,
            )
            logger.debug("Indexed applicant user_id=%s", user_id)
            return
        except ConnectionTimeout as e:
            last_err = e
            if attempt < 2:
                await asyncio.sleep(2 * (attempt + 1))
        except Exception as e:
            logger.exception("Failed to index applicant user_id=%s: %s", user_id, e)
            return
    logger.warning("Failed to index applicant user_id=%s after retries: %s", user_id, last_err)


async def delete_applicant(user_id: int) -> None:
    """Удалить соискателя из индекса."""
    client = get_es_client()
    try:
        await client.delete(index=settings.APPLICANTS_INDEX, id=str(user_id), ignore=[404])
        logger.debug("Deleted applicant user_id=%s from index", user_id)
    except Exception as e:
        logger.exception("Failed to delete applicant user_id=%s from index: %s", user_id, e)


async def suggest_applicants(q: str = "", limit: int = 8) -> List[Dict[str, Any]]:
    """
    Подсказки для автодополнения (Completion Suggester).
    Возвращает [{text, public_id, full_name}]. Данные из _source документа.
    """
    q = (q or "").strip()
    if len(q) < 2:
        return []
    client = get_es_client()
    index = settings.APPLICANTS_INDEX
    comp = {"size": limit, "skip_duplicates": True, "fuzzy": {"fuzziness": "AUTO"}}
    suggest_body = {
        "name-suggest": {"prefix": q, "completion": {**comp, "field": "full_name_suggest"}},
        "public_id-suggest": {"prefix": q, "completion": {**comp, "field": "public_id_suggest"}},
        "skills-suggest": {"prefix": q, "completion": {**comp, "field": "skills_suggest"}},
        "research-suggest": {"prefix": q, "completion": {**comp, "field": "research_interests_suggest"}},
        "position-suggest": {"prefix": q, "completion": {**comp, "field": "position_suggest"}},
        "status-suggest": {"prefix": q, "completion": {**comp, "field": "status_suggest"}},
    }
    body = {"suggest": suggest_body, "size": 0, "_source": ["public_id", "full_name"]}
    try:
        resp = await client.search(index=index, body=body)
    except NotFoundError:
        return []
    except Exception as e:
        logger.exception("Elasticsearch suggest failed: %s", e)
        return []
    def _display_text(text: str, public_id: str, full_name: str, from_public_id_suggest: bool = False) -> str:
        """Не показывать public_id в подсказках — только осмысленный текст (имя, навык и т.д.)."""
        if from_public_id_suggest or (text and public_id and text == public_id):
            return full_name or text or ""
        return text or full_name or ""

    seen: set = set()
    result: List[Dict[str, Any]] = []
    doc_ids = []  # (doc_id, text, public_id, full_name, from_public_id_suggest)
    for key in ("name-suggest", "public_id-suggest", "skills-suggest", "research-suggest", "position-suggest", "status-suggest"):
        from_public_id = key == "public_id-suggest"
        suggest_data = resp.get("suggest", {}).get(key, [])
        for opt in suggest_data:
            for item in opt.get("options", []):
                text = item.get("text")
                doc_id = item.get("_id")
                source = item.get("_source", {})
                public_id = source.get("public_id") or ""
                full_name = source.get("full_name") or text or ""
                display = _display_text(text, public_id, full_name, from_public_id)
                if not display and from_public_id:
                    continue
                if display and (public_id or doc_id, full_name or text) not in seen:
                    seen.add((public_id or doc_id, full_name or text))
                    if public_id or doc_id:
                        doc_ids.append((doc_id, text, public_id, full_name, from_public_id))
                    else:
                        result.append({"text": display, "public_id": public_id, "full_name": full_name})
                    if len(result) + len(doc_ids) >= limit:
                        break
            if len(result) + len(doc_ids) >= limit:
                break
        if len(result) + len(doc_ids) >= limit:
            break

    # Completion suggester может не возвращать _source в options — получаем документы по id
    if doc_ids and not any(r.get("public_id") for r in result):
        ids_to_fetch = list(dict.fromkeys(did for did, _, _, _, _ in doc_ids))[:limit]
        try:
            mget_resp = await client.mget(index=index, ids=ids_to_fetch, _source=["public_id", "full_name"])
            docs = {d["_id"]: d.get("_source", {}) for d in mget_resp.get("docs", []) if d.get("found")}
            for doc_id, text, public_id, full_name, from_pid in doc_ids:
                if len(result) >= limit:
                    break
                src = docs.get(str(doc_id), {})
                public_id = src.get("public_id") or public_id
                full_name = src.get("full_name") or full_name or text or ""
                display = _display_text(text, public_id, full_name, from_pid)
                if not display and from_pid:
                    continue
                if (public_id or doc_id, full_name or text) not in seen:
                    seen.add((public_id or doc_id, full_name or text))
                    result.append({"text": display or full_name, "public_id": public_id, "full_name": full_name})
        except Exception as e:
            logger.warning("mget for suggest fallback failed: %s", e)
        if not result:
            for _, text, public_id, full_name, from_pid in doc_ids[:limit]:
                display = _display_text(text, public_id, full_name, from_pid)
                if display:
                    result.append({"text": display, "public_id": public_id or "", "full_name": full_name})
    elif doc_ids:
        for _, text, public_id, full_name, from_pid in doc_ids[: limit - len(result)]:
            display = _display_text(text, public_id, full_name or text, from_pid)
            if display:
                result.append({"text": display, "public_id": public_id, "full_name": full_name or text})

    return result[:limit]


async def search_applicants(
    q: str = "",
    page: int = 1,
    size: int = 20,
    role: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: Optional[str] = None,
) -> dict:
    """
    Поиск соискателей по запросу и фильтрам.
    Возвращает {items: [...], total: int, page: int, size: int}.
    """
    client = get_es_client()
    index = settings.APPLICANTS_INDEX
    q = (q or "").strip()
    from_idx = (page - 1) * size

    filters = []
    if role and role in ("student", "researcher"):
        filters.append({"term": {"role": role}})
    if status and status.strip():
        st = status.strip()
        filters.append({"term": {"status": st}})

    if q:
        search_fields = [
            "full_name^2",
            "status",
            "education_text",
            "skills_text",
            "research_interests_text",
            "summary",
            "position",
            "job_search_status",
            "employment_type_preference",
            "public_id",
        ]
        bool_query = {
            "must": [
                {"multi_match": {"query": q, "fields": search_fields, "type": "best_fields", "fuzziness": "AUTO"}},
            ],
        }
        if filters:
            bool_query["filter"] = filters
        query = {"bool": bool_query}
    else:
        bool_query = {"must": [{"match_all": {}}]}
        if filters:
            bool_query["filter"] = filters
        query = {"bool": bool_query}

    sort_clause = sort_by_date(sort_by)
    try:
        resp = await client.search(
            index=index,
            query=query,
            from_=from_idx,
            size=size,
            sort=sort_clause,
        )
    except NotFoundError:
        await reindex_applicants_if_empty()
        try:
            resp = await client.search(
                index=index,
                query=query,
                from_=from_idx,
                size=size,
                sort=sort_clause,
            )
        except Exception as e:
            logger.exception("Elasticsearch search failed after index init: %s", e)
            return {"items": [], "total": 0, "page": page, "size": size}
    except Exception as e:
        logger.exception("Elasticsearch search failed: %s", e)
        return {"items": [], "total": 0, "page": page, "size": size}

    hits = resp.get("hits", {})
    total_val = hits.get("total")
    if isinstance(total_val, dict):
        total = total_val.get("value", 0)
    else:
        total = total_val or 0

    items = [_doc_to_applicant_item(h) for h in hits.get("hits", [])]
    return {"items": items, "total": total, "page": page, "size": size}


async def reindex_applicants_if_empty() -> None:
    """Первичная индексация: если индекс пуст — загрузить всех опубликованных соискателей."""
    await _reindex_applicants(force=False)


async def _reindex_applicants(force: bool = False) -> int:
    """Переиндексация соискателей из PostgreSQL. force=False — только если индекс пуст."""
    from app.queries.orm import Orm

    await ensure_applicants_index()
    count = await _applicants_index_count()
    if not force and count > 0:
        logger.debug("Applicants index already has %d documents, skipping reindex", count)
        return count
    users = await Orm.list_all_published_applicant_users()
    logger.info("Applicants reindex: %d published applicants", len(users))
    indexed = 0
    for u in users:
        try:
            await index_applicant(u.id)
            indexed += 1
        except Exception as e:
            logger.warning("Failed to index applicant user_id=%s: %s", u.id, e)
    logger.info("Reindex completed: %d applicants indexed", indexed)
    return indexed
