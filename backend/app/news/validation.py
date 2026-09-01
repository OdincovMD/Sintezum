"""Проверка и нормализация структурированного контента новостей."""

import json
from urllib.parse import urlparse

from app.config import settings

MAX_CONTENT_BYTES = 1024 * 1024
_ALLOWED_NODE_TYPES = {"doc", "paragraph", "heading", "text", "image", "hardBreak"}
_ALLOWED_MARK_TYPES = {"bold", "italic", "link"}


def _valid_link(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme.lower() in {"http", "https", "mailto"}


def _valid_image(value: str) -> bool:
    prefixes = {
        settings.S3_PUBLIC_BASE_URL.rstrip("/"),
        settings.S3_LOCALHOST_STORAGE_PREFIX.rstrip("/"),
    }
    return any(value == prefix or value.startswith(f"{prefix}/") for prefix in prefixes if prefix)


def validate_news_image_url(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if not _valid_image(value):
        raise ValueError("Изображение должно быть загружено в хранилище платформы")
    return value


def _clean_marks(raw_marks) -> list[dict]:
    if raw_marks is None:
        return []
    if not isinstance(raw_marks, list):
        raise ValueError("Некорректное форматирование текста")
    result: list[dict] = []
    for mark in raw_marks:
        if not isinstance(mark, dict) or mark.get("type") not in _ALLOWED_MARK_TYPES:
            raise ValueError("Недопустимое форматирование текста")
        mark_type = mark["type"]
        if mark_type == "link":
            href = str((mark.get("attrs") or {}).get("href") or "").strip()
            if not _valid_link(href):
                raise ValueError("Недопустимая ссылка")
            result.append({
                "type": "link",
                "attrs": {
                    "href": href,
                    "target": "_blank",
                    "rel": "noopener noreferrer",
                    "class": None,
                },
            })
        else:
            result.append({"type": mark_type})
    return result


def _clean_node(node: object, *, root: bool = False, depth: int = 0) -> dict:
    if depth > 24:
        raise ValueError("Слишком глубокая структура контента")
    if not isinstance(node, dict):
        raise ValueError("Контент должен содержать объекты")
    node_type = node.get("type")
    if node_type not in _ALLOWED_NODE_TYPES:
        raise ValueError(f"Недопустимый элемент контента: {node_type or 'без типа'}")
    if root and node_type != "doc":
        raise ValueError("Корневой элемент контента должен иметь тип doc")
    if not root and node_type == "doc":
        raise ValueError("Вложенный элемент doc недопустим")

    if node_type == "text":
        text = node.get("text")
        if not isinstance(text, str):
            raise ValueError("Текстовый элемент должен содержать строку")
        cleaned = {"type": "text", "text": text}
        marks = _clean_marks(node.get("marks"))
        if marks:
            cleaned["marks"] = marks
        return cleaned

    if node_type == "image":
        attrs = node.get("attrs") or {}
        src = str(attrs.get("src") or "").strip()
        if not _valid_image(src):
            raise ValueError("Изображения должны быть загружены в хранилище платформы")
        return {
            "type": "image",
            "attrs": {
                "src": src,
                "alt": str(attrs.get("alt") or "")[:255],
                "title": str(attrs.get("title") or "")[:255] or None,
            },
        }

    if node_type == "hardBreak":
        return {"type": "hardBreak"}

    cleaned: dict = {"type": node_type}
    if node_type == "heading":
        level = (node.get("attrs") or {}).get("level")
        if level not in (2, 3):
            raise ValueError("Разрешены только заголовки второго и третьего уровня")
        cleaned["attrs"] = {"level": level}
    raw_content = node.get("content") or []
    if not isinstance(raw_content, list):
        raise ValueError("Некорректное содержимое элемента")
    cleaned["content"] = [_clean_node(child, depth=depth + 1) for child in raw_content]
    return cleaned


def validate_news_content(value: object) -> dict:
    try:
        raw = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise ValueError("Контент должен быть корректным JSON") from exc
    if len(raw) > MAX_CONTENT_BYTES:
        raise ValueError("Текст новости превышает допустимый размер 1 МБ")
    cleaned = _clean_node(value, root=True)
    encoded = json.dumps(cleaned, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(encoded) > MAX_CONTENT_BYTES:
        raise ValueError("Текст новости превышает допустимый размер 1 МБ")
    return cleaned


def content_to_plain_text(content: dict, limit: int = 220) -> str:
    parts: list[str] = []

    def walk(node: object) -> None:
        if not isinstance(node, dict):
            return
        if node.get("type") == "text" and isinstance(node.get("text"), str):
            parts.append(node["text"])
        for child in node.get("content") or []:
            walk(child)

    walk(content)
    text = " ".join(" ".join(parts).split())
    if len(text) <= limit:
        return text
    return f"{text[: limit - 1].rstrip()}…"


def first_image_url(content: dict) -> str | None:
    if not isinstance(content, dict):
        return None
    if content.get("type") == "image":
        src = (content.get("attrs") or {}).get("src")
        return src if isinstance(src, str) else None
    for child in content.get("content") or []:
        found = first_image_url(child)
        if found:
            return found
    return None
