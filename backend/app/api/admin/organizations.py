"""Admin API: organizations CRUD."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError

from app import models
from app.api.deps import get_current_user
from app.api.admin.deps import require_admin
from app.queries.orm import Orm
from app.database import async_session_factory
from app.services.elasticsearch import (
    reindex_organizations_by_ids,
    delete_organization as es_delete_organization,
)
from app.roles.representative.schemas import OrganizationRead, OrganizationUpdate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["admin-organizations"])


def _org_to_read(org):
    """Serialize Organization for admin response."""
    return {
        "id": org.id,
        "public_id": org.public_id,
        "name": org.name or "",
        "avatar_url": org.avatar_url,
        "description": org.description,
        "address": org.address,
        "website": org.website,
        "ror_id": org.ror_id,
        "is_published": getattr(org, "is_published", False),
        "hidden_public_sections": getattr(org, "hidden_public_sections", None) or [],
        "created_at": org.created_at,
    }


@router.get("/organizations")
async def list_organizations_admin(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
):
    """List all organizations (admin only)."""
    require_admin(current_user)
    items, total = await Orm.list_organizations_admin(page=page, size=size)
    return {"items": [_org_to_read(o) for o in items], "total": total, "page": page, "size": size}


@router.get("/organizations/{org_id}")
async def get_organization_admin(
    org_id: int,
    current_user=Depends(get_current_user),
):
    """Get organization by id (admin only)."""
    require_admin(current_user)
    org = await Orm.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return _org_to_read(org)


@router.put("/organizations/{org_id}", response_model=OrganizationRead)
async def update_organization_admin(
    org_id: int,
    payload: OrganizationUpdate,
    current_user=Depends(get_current_user),
):
    """Update organization (admin only)."""
    require_admin(current_user)
    patch = payload.model_dump(exclude_unset=True)
    is_pub = patch.pop("is_published", None)
    org = await Orm.admin_update_organization(org_id, **patch)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    if is_pub is not None:
        org = await Orm.set_organization_published(org_id, is_pub)
        try:
            if is_pub:
                await reindex_organizations_by_ids([org_id])
            else:
                await es_delete_organization(org_id)
        except Exception as e:
            logger.warning("ES sync failed for org %s: %s", org_id, e)
    else:
        try:
            await reindex_organizations_by_ids([org_id])
        except Exception as e:
            logger.warning("ES reindex failed for org %s: %s", org_id, e)
    return OrganizationRead.model_validate(org)


@router.delete("/organizations/{org_id}")
async def delete_organization_admin(
    org_id: int,
    current_user=Depends(get_current_user),
):
    """Delete organization (admin only)."""
    require_admin(current_user)
    async with async_session_factory() as session:
        org = await session.get(models.Organization, org_id)
        if not org:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
        await session.delete(org)
        try:
            await session.commit()
        except SQLAlchemyError:
            await session.rollback()
            raise
    try:
        await es_delete_organization(org_id)
    except Exception as e:
        logger.warning("ES delete failed for org %s: %s", org_id, e)
    return {"ok": True}


@router.get("/organizations/{org_id}/laboratories")
async def list_org_laboratories_admin(
    org_id: int,
    current_user=Depends(get_current_user),
):
    """List laboratories of an organization (admin only, for form lab selection)."""
    require_admin(current_user)
    org = await Orm.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    labs = await Orm.list_laboratories_for_org(org_id)
    return {
        "items": [
            {"id": lab.id, "public_id": lab.public_id, "name": lab.name}
            for lab in labs
        ]
    }


@router.get("/organizations/{org_id}/queries")
async def list_org_queries_admin(
    org_id: int,
    current_user=Depends(get_current_user),
):
    """List queries of an organization (admin only, for form query selection)."""
    require_admin(current_user)
    org = await Orm.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    queries = await Orm.list_queries_for_org(org_id)
    return {
        "items": [
            {"id": q.id, "public_id": q.public_id, "title": q.title or ""}
            for q in queries
        ]
    }


@router.get("/organizations/{org_id}/employees")
async def list_org_employees_admin(
    org_id: int,
    current_user=Depends(get_current_user),
):
    """List employees of an organization (admin only, for form employee selection)."""
    require_admin(current_user)
    org = await Orm.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    employees = await Orm.list_employees_for_org(org_id)
    return {
        "items": [
            {"id": e.id, "full_name": e.full_name or ""}
            for e in employees
        ]
    }


@router.get("/organizations/{org_id}/equipment")
async def list_org_equipment_admin(
    org_id: int,
    current_user=Depends(get_current_user),
):
    """List equipment of an organization (admin only, for laboratory form)."""
    require_admin(current_user)
    org = await Orm.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    equipment = await Orm.list_equipment_for_org(org_id)
    return {
        "items": [
            {"id": e.id, "name": e.name or ""}
            for e in equipment
        ]
    }


@router.get("/organizations/{org_id}/tasks")
async def list_org_tasks_admin(
    org_id: int,
    current_user=Depends(get_current_user),
):
    """List task solutions of an organization (admin only, for linked_task_solution selection)."""
    require_admin(current_user)
    org = await Orm.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    tasks = await Orm.list_task_solutions_for_org(org_id)
    return {
        "items": [
            {"id": t.id, "title": t.title or ""}
            for t in tasks
        ]
    }
