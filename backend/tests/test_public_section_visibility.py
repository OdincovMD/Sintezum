import pytest
from pydantic import ValidationError

from app.roles.representative.schemas import (
    OrganizationLaboratoryCreate,
    OrganizationLaboratoryUpdate,
    OrganizationUpdate,
)


def test_organization_visibility_accepts_known_sections():
    payload = OrganizationUpdate(
        hidden_public_sections=["news", "queries", "task_solutions"],
    )

    assert payload.hidden_public_sections == ["news", "queries", "task_solutions"]


def test_organization_visibility_rejects_unknown_section():
    with pytest.raises(ValidationError):
        OrganizationUpdate(hidden_public_sections=["photos"])


def test_laboratory_visibility_defaults_to_all_sections_visible():
    first = OrganizationLaboratoryCreate(name="Первая")
    second = OrganizationLaboratoryCreate(name="Вторая")

    first.hidden_public_sections.append("photos")

    assert second.hidden_public_sections == []


def test_laboratory_visibility_accepts_known_sections_and_rejects_unknown():
    payload = OrganizationLaboratoryUpdate(
        hidden_public_sections=["photos", "documents", "employees"],
    )
    assert payload.hidden_public_sections == ["photos", "documents", "employees"]

    with pytest.raises(ValidationError):
        OrganizationLaboratoryUpdate(hidden_public_sections=["laboratories"])
