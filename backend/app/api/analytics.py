"""
Приём событий аналитики с фронта (page_view, page_leave, button_click).
Авторизация опциональна: при наличии JWT подставляется user_id.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Request

from app.api.deps import get_current_user_optional
from app.queries.orm import Orm
from app.rate_limit import limiter
from app.core.models import User

router = APIRouter(prefix="/analytics", tags=["analytics"])

ALLOWED_EVENT_TYPES = {"page_view", "page_leave", "button_click"}
ALLOWED_ENTITY_TYPES = {"vacancy", "organization", "laboratory", "query", "news", "profile", "home", "list"}
MAX_EVENTS_PER_REQUEST = 50


@router.post("/events")
@limiter.limit("60/minute")
async def post_events(
    request: Request,
    body: dict,
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Принять массив событий аналитики.
    Тело: { "events": [ { "event_type", "session_id", "entity_type", "entity_id?", "payload?" } ] }
    """
    raw = body.get("events")
    if not isinstance(raw, list):
        return {"accepted": 0}

    events = []
    user_id = current_user.id if current_user else None

    for item in raw[:MAX_EVENTS_PER_REQUEST]:
        if not isinstance(item, dict):
            continue
        event_type = item.get("event_type")
        if event_type not in ALLOWED_EVENT_TYPES:
            continue
        entity_type = item.get("entity_type")
        if entity_type is not None and entity_type not in ALLOWED_ENTITY_TYPES:
            continue
        session_id = item.get("session_id")
        if isinstance(session_id, str) and len(session_id) > 64:
            session_id = session_id[:64]
        entity_id = item.get("entity_id")
        if entity_id is not None and isinstance(entity_id, str) and len(entity_id) > 32:
            entity_id = entity_id[:32]
        payload = item.get("payload")
        if payload is not None and not isinstance(payload, dict):
            payload = None
        events.append({
            "event_type": event_type,
            "user_id": user_id,
            "session_id": session_id or None,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "payload": payload,
        })

    if not events:
        return {"accepted": 0}

    accepted = await Orm.insert_analytics_events(events)
    return {"accepted": accepted}
