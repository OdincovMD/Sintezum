"""
Фоновая проверка истекших подписок.
Вызывается APScheduler раз в день.
Помечает истёкшие подписки и отправляет уведомления пользователям.
"""

import logging

from app.queries.orm import Orm

logger = logging.getLogger(__name__)


async def _check_expired_subscriptions_async() -> None:
    """Найти истёкшие подписки, пометить их и уведомить пользователей."""
    logger.info("Subscription expiry check started")
    items = await Orm.list_expired_subscriptions_to_notify()
    for item in items:
        try:
            await Orm.create_notification(
                item["user_id"],
                "subscription_expired",
                {
                    "subscription_id": item["id"],
                    "tier": item["tier"],
                    "expires_at": item["expires_at"].isoformat() if item["expires_at"] else None,
                    "trial_ends_at": item["trial_ends_at"].isoformat() if item["trial_ends_at"] else None,
                },
            )
        except Exception as e:
            logger.warning("Subscription expiry notification failed sub_id=%s: %s", item["id"], e)
    logger.info("Subscription expiry check completed: %d expired", len(items))


async def check_subscription_expiry() -> None:
    """Запустить проверку в event loop FastAPI/AsyncIOScheduler."""
    await _check_expired_subscriptions_async()
