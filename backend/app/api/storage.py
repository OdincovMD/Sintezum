"""
Direct upload endpoints for S3-compatible storage.
"""

import asyncio
import logging
import os
import secrets

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.api.deps import get_current_user

logger = logging.getLogger(__name__)
from app.schemas import StorageUploadResponse
from app.storage.s3 import upload_bytes

router = APIRouter(prefix="/storage", tags=["storage"])

ALLOWED_CATEGORIES = {"equipment", "laboratory", "employee", "organization", "researcher", "student", "user", "feedback", "news"}
ALLOWED_MIME_PREFIXES = ("image/",)
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
}
ALLOWED_EXTS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv"}
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

# Magic bytes for allowed file types. Office formats share signatures and cannot be
# distinguished by magic alone — we use filename/declared type for validation.
_OFFICE_OPEN_XML = frozenset({
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
})
_OFFICE_OLE = frozenset({
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
})

_MAGIC_SIGNATURES: list[tuple[bytes, int, str | frozenset, bool]] = [
    (b"%PDF", 0, "application/pdf", False),
    (b"\x89PNG\r\n\x1a\n", 0, "image/png", False),
    (b"\xff\xd8\xff", 0, "image/jpeg", False),
    (b"GIF87a", 0, "image/gif", False),
    (b"GIF89a", 0, "image/gif", False),
    (b"RIFF", 0, "image/webp", False),  # WebP: RIFF....WEBP at offset 8
    (b"BM", 0, "image/bmp", False),
    (b"PK\x03\x04", 0, _OFFICE_OPEN_XML, True),  # Office Open XML: has [Content_Types]
    (b"\xd0\xcf\x11\xe0", 0, _OFFICE_OLE, False),  # OLE: doc/xls/ppt, no [Content_Types]
]


def _detect_mime_from_magic(data: bytes) -> str | frozenset | None:
    """Detect MIME type from file magic bytes. Returns str, frozenset of allowed mimes, or None."""
    if len(data) < 16:
        return None
    for sig, offset, mime, require_content_types in _MAGIC_SIGNATURES:
        if len(data) <= offset + len(sig):
            continue
        if data[offset : offset + len(sig)] != sig:
            continue
        if mime == "image/webp":
            if len(data) < 12 or data[8:12] != b"WEBP":
                continue
        elif require_content_types:
            if b"[Content_Types]" not in data[: min(2000, len(data))]:
                continue
        return mime
    return None


def _is_text_file(data: bytes) -> bool:
    """Heuristic: file is likely text (no null bytes, valid-ish encoding)."""
    if b"\x00" in data[:8192]:
        return False
    try:
        data[:4096].decode("utf-8")
        return True
    except UnicodeDecodeError:
        return False


def _is_allowed_upload(file: UploadFile) -> bool:
    content_type = (file.content_type or "").lower()
    if any(content_type.startswith(prefix) for prefix in ALLOWED_MIME_PREFIXES):
        return True
    if content_type in ALLOWED_MIME_TYPES:
        return True
    ext = os.path.splitext(file.filename or "")[1].lower()
    return ext in ALLOWED_EXTS


def _validate_file_content(data: bytes, declared_content_type: str, filename: str) -> None:
    """
    Verify file content matches declared type using magic bytes.
    Raises ValueError if content does not match (MIME spoofing attempt).
    """
    declared = (declared_content_type or "").lower().split(";")[0].strip()
    ext = os.path.splitext(filename or "")[1].lower()

    detected = _detect_mime_from_magic(data)
    if detected:
        # Binary format: must match
        if declared.startswith("image/"):
            if isinstance(detected, frozenset):
                raise ValueError("File content does not match declared image type")
            if not detected.startswith("image/"):
                raise ValueError("File content does not match declared image type")
        elif declared in ALLOWED_MIME_TYPES:
            if isinstance(detected, frozenset):
                if declared not in detected:
                    raise ValueError("File content does not match declared type")
            elif detected != declared:
                raise ValueError("File content does not match declared type")
    else:
        # No magic (e.g. text): allow text/plain, text/csv if content looks like text
        if declared in ("text/plain", "text/csv"):
            if not _is_text_file(data):
                raise ValueError("File content does not appear to be valid text")
        elif declared.startswith("image/"):
            raise ValueError("File content does not match declared image type")


@router.post("/upload", response_model=StorageUploadResponse)
async def upload_image(
    category: str = Form(...),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported category")
    if not _is_allowed_upload(file):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type")

    data = await file.read()
    if len(data) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum of {MAX_UPLOAD_SIZE_BYTES // (1024*1024)} MB",
        )
    try:
        _validate_file_content(data, file.content_type or "", file.filename or "")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    try:
        upload_filename = file.filename or "image"
        if category == "news":
            upload_filename = f"{secrets.token_hex(8)}_{upload_filename}"
        public_url, key = await asyncio.to_thread(
            upload_bytes,
            category,
            current_user.id,
            upload_filename,
            file.content_type or "application/octet-stream",
            data,
        )
        logger.info(
            "File uploaded: user_id=%s category=%s key=%s size=%d content_type=%s",
            current_user.id,
            category,
            key,
            len(data),
            file.content_type or "application/octet-stream",
        )
        return StorageUploadResponse(public_url=public_url, key=key)
    except Exception as e:
        logger.exception("Upload failed for user_id=%s category=%s: %s", current_user.id, category, e)
        raise
