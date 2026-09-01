"""Admin API: laboratories CRUD."""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user
from app.api.admin.deps import require_admin
from app.queries.orm import Orm
from app.services.elasticsearch import (
    reindex_laboratories_by_ids,
    reindex_organizations_by_ids,
    delete_laboratory as es_delete_laboratory,
)
from app.roles.representative.schemas import OrganizationLaboratoryUpdate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["admin-laboratories"])


def _lab_to_read(lab):
    """Serialize Laboratory for admin response."""
    org = getattr(lab, "organization", None)
    employees = getattr(lab, "employees", None) or []
    equipment = getattr(lab, "equipment", None) or []
    task_solutions = getattr(lab, "task_solutions", None) or []
    return {
        "id": lab.id,
        "public_id": lab.public_id,
        "name": lab.name or "",
        "description": lab.description,
        "activities": lab.activities,
        "image_urls": lab.image_urls or [],
        "is_published": getattr(lab, "is_published", False),
        "hidden_public_sections": getattr(lab, "hidden_public_sections", None) or [],
        "created_at": lab.created_at,
        "organization_id": lab.organization_id,
        "creator_user_id": getattr(lab, "creator_user_id", None),
        "organization": {"id": org.id, "name": org.name, "public_id": org.public_id} if org else None,
        "head_employee_id": getattr(lab, "head_employee_id", None),
        "employee_ids": [e.id for e in employees],
        "employees": [{"id": e.id, "full_name": e.full_name} for e in employees],
        "equipment_ids": [e.id for e in equipment],
        "equipment": [{"id": e.id, "name": e.name} for e in equipment],
        "task_solution_ids": [t.id for t in task_solutions],
        "task_solutions": [{"id": t.id, "title": t.title} for t in task_solutions],
    }


@router.get("/laboratories")
async def list_laboratories_admin(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
):
    """List all laboratories (admin only)."""
    require_admin(current_user)
    items, total = await Orm.list_laboratories_admin(page=page, size=size)
    return {"items": [_lab_to_read(l) for l in items], "total": total, "page": page, "size": size}


@router.get("/laboratories/{lab_id}")
async def get_laboratory_admin(
    lab_id: int,
    current_user=Depends(get_current_user),
):
    """Get laboratory by id (admin only)."""
    require_admin(current_user)
    lab = await Orm.get_laboratory_by_id(lab_id)
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratory not found")
    return _lab_to_read(lab)


@router.put("/laboratories/{lab_id}")
async def update_laboratory_admin(
    lab_id: int,
    payload: OrganizationLaboratoryUpdate,
    current_user=Depends(get_current_user),
):
    """Update laboratory (admin only)."""
    require_admin(current_user)
    patch = payload.model_dump(exclude_unset=True)
    is_pub = patch.pop("is_published", None)
    lab = await Orm.admin_update_laboratory(
        lab_id,
        name=patch.get("name"),
        description=patch.get("description"),
        activities=patch.get("activities"),
        image_urls=patch.get("image_urls"),
        is_published=is_pub,
        employee_ids=patch.get("employee_ids"),
        head_employee_id=patch.get("head_employee_id"),
        equipment_ids=patch.get("equipment_ids"),
        task_solution_ids=patch.get("task_solution_ids"),
        hidden_public_sections=patch.get("hidden_public_sections"),
    )
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratory not found")
    try:
        if getattr(lab, "is_published", False):
            await reindex_laboratories_by_ids([lab_id])
            if lab.organization_id:
                await reindex_organizations_by_ids([lab.organization_id])
        else:
            await es_delete_laboratory(lab_id)
    except Exception as e:
        logger.warning("ES sync failed for lab %s: %s", lab_id, e)
    return _lab_to_read(lab)


@router.delete("/laboratories/{lab_id}")
async def delete_laboratory_admin(
    lab_id: int,
    current_user=Depends(get_current_user),
):
    """Delete laboratory (admin only)."""
    require_admin(current_user)
    lab = await Orm.get_laboratory_by_id(lab_id)
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratory not found")
    org_id_before = lab.organization_id
    ok, _, _, fully_deleted = await Orm.admin_delete_laboratory(lab_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratory not found")
    try:
        if fully_deleted:
            await es_delete_laboratory(lab_id)
        else:
            await reindex_laboratories_by_ids([lab_id])
            if org_id_before:
                await reindex_organizations_by_ids([org_id_before])
    except Exception as e:
        logger.warning("ES sync failed for lab %s: %s", lab_id, e)
    return {"ok": True}
