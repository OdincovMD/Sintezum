"""
SQLAlchemy ORM-модели для платформы Synthesum.
Сохранён совместимый импорт через re-export.
"""

from app.core.models import *  # noqa: F403
from app.roles.student.models import *  # noqa: F403
from app.roles.researcher.models import *  # noqa: F403
from app.roles.representative.models import *  # noqa: F403
from app.news.models import *  # noqa: F403
