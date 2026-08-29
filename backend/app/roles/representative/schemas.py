from __future__ import annotations

"""
Pydantic-схемы для роли представителя (организация, лаборатории, оборудование и т.д.).
"""

from datetime import datetime
from typing import Optional, List, Dict, Any

from pydantic import BaseModel

from app.common import ORMModel


# =========================
#       ORGANIZATIONS
# =========================

class OrganizationBase(BaseModel):
    name: str
    avatar_url: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    is_published: Optional[bool] = False


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationRead(ORMModel, OrganizationBase):
    id: int
    public_id: Optional[str] = None
    ror_id: Optional[str] = None
    created_at: datetime


class OrganizationListResponse(BaseModel):
    """Response: items, total, page, size."""

    items: List["OrganizationRead"]
    total: int
    page: int
    size: int


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    ror_id: Optional[str] = None
    is_published: Optional[bool] = None


class StorageUploadResponse(BaseModel):
    public_url: str
    key: str


# =========================
#     VACANCIES (ORG)
# =========================

class VacancyOrganizationBase(BaseModel):
    organization_id: Optional[int] = None
    query_id: Optional[int] = None
    laboratory_id: Optional[int] = None
    contact_employee_id: Optional[int] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    name: str
    requirements: Optional[str] = None
    description: Optional[str] = None
    employment_type: Optional[str] = None
    is_published: Optional[bool] = False


class VacancyOrganizationCreate(VacancyOrganizationBase):
    pass


class VacancyOrganizationRead(ORMModel, VacancyOrganizationBase):
    id: int
    public_id: Optional[str] = None
    created_at: datetime
    laboratory: Optional["OrganizationLaboratoryShort"] = None
    contact_employee: Optional["EmployeeRead"] = None
    organization: Optional["OrganizationShort"] = None
    query: Optional["OrganizationQueryShort"] = None


class VacancyOrganizationUpdate(BaseModel):
    query_id: Optional[int] = None
    laboratory_id: Optional[int] = None
    contact_employee_id: Optional[int] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    name: Optional[str] = None
    requirements: Optional[str] = None
    description: Optional[str] = None
    employment_type: Optional[str] = None
    is_published: Optional[bool] = None

class VacancyListResponse(BaseModel):
    """Response: items, total, page, size."""

    items: List[VacancyOrganizationRead]
    total: int
    page: int
    size: int

# =========================
#     VACANCY RESPONSES
# =========================

class VacancyResponseStatusUpdate(BaseModel):
    status: str  # "new" | "accepted" | "rejected"


class VacancyResponseRead(ORMModel):
    id: int
    user_id: int
    vacancy_id: int
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    vacancy_name: Optional[str] = None
    vacancy_public_id: Optional[str] = None
    applicant_name: Optional[str] = None
    applicant_preview: Optional[str] = None
    applicant_public_id: Optional[str] = None


# =========================
#        EQUIPMENT
# =========================

class OrganizationEquipmentBase(BaseModel):
    name: str
    description: Optional[str] = None
    characteristics: Optional[str] = None
    image_urls: Optional[List[str]] = None


class OrganizationEquipmentCreate(OrganizationEquipmentBase):
    organization_id: Optional[int] = None
    laboratory_ids: Optional[List[int]] = None


class OrganizationEquipmentRead(ORMModel, OrganizationEquipmentBase):
    id: int
    created_at: Optional[datetime] = None
    organization_id: Optional[int] = None
    laboratories: Optional[List["OrganizationLaboratoryShort"]] = None


class OrganizationEquipmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    characteristics: Optional[str] = None
    image_urls: Optional[List[str]] = None
    laboratory_ids: Optional[List[int]] = None


# =========================
#       LABORATORIES
# =========================

class OrganizationLaboratoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    activities: Optional[str] = None
    image_urls: Optional[List[str]] = None
    is_published: Optional[bool] = False


class OrganizationLaboratoryCreate(OrganizationLaboratoryBase):
    organization_id: Optional[int] = None
    employee_ids: Optional[List[int]] = None
    head_employee_id: Optional[int] = None
    equipment_ids: Optional[List[int]] = None
    task_solution_ids: Optional[List[int]] = None


class EmployeeShort(ORMModel):
    id: int
    created_at: Optional[datetime] = None
    full_name: str
    positions: Optional[List[str]] = None
    academic_degree: Optional[str] = None
    photo_url: Optional[str] = None


class ResearcherShort(ORMModel):
    """Исследователь, присоединившийся к лаборатории по заявке."""
    id: int
    full_name: str


class OrganizationLaboratoryRead(ORMModel, OrganizationLaboratoryBase):
    id: int
    public_id: Optional[str] = None
    created_at: datetime
    organization_id: Optional[int] = None
    head_employee_id: Optional[int] = None
    head_employee: Optional[EmployeeShort] = None
    employees: Optional[List[EmployeeShort]] = None
    researchers: Optional[List[ResearcherShort]] = None
    equipment: Optional[List[OrganizationEquipmentRead]] = None
    organization: Optional["OrganizationShort"] = None
    task_solutions: Optional[List["OrganizationTaskSolutionRead"]] = None


class OrganizationLaboratoryShort(ORMModel, OrganizationLaboratoryBase):
    id: int
    public_id: Optional[str] = None
    created_at: datetime
    organization_id: Optional[int] = None


class LaboratoryListResponse(BaseModel):
    """Response: items, total, page, size."""

    items: List[OrganizationLaboratoryRead]
    total: int
    page: int
    size: int


class OrganizationShort(ORMModel):
    id: int
    public_id: Optional[str] = None
    name: str
    avatar_url: Optional[str] = None


class OrganizationQueryShort(ORMModel):
    id: int
    public_id: Optional[str] = None
    title: str


class LaboratoryDetails(ORMModel, OrganizationLaboratoryBase):
    id: int
    public_id: Optional[str] = None
    created_at: datetime
    organization: Optional[OrganizationShort] = None
    head_employee: Optional[EmployeeShort] = None
    employees: List["EmployeeRead"] = []
    researchers: List[ResearcherShort] = []
    equipment: List[OrganizationEquipmentRead] = []
    task_solutions: List["OrganizationTaskSolutionRead"] = []
    queries: List["OrganizationQueryRead"] = []
    vacancies: List[VacancyOrganizationRead] = []
    contact_email: Optional[str] = None


class OrganizationLaboratoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    activities: Optional[str] = None
    image_urls: Optional[List[str]] = None
    employee_ids: Optional[List[int]] = None
    head_employee_id: Optional[int] = None
    is_published: Optional[bool] = None
    equipment_ids: Optional[List[int]] = None
    task_solution_ids: Optional[List[int]] = None


# =========================
#     TASK SOLUTIONS (ORG)
# =========================

class OrganizationTaskSolutionBase(BaseModel):
    title: str
    task_description: Optional[str] = None
    solution_description: Optional[str] = None
    article_links: Optional[List[str]] = None
    solution_deadline: Optional[str] = None
    grant_info: Optional[str] = None
    cost: Optional[str] = None
    external_solutions: Optional[str] = None


class OrganizationTaskSolutionCreate(OrganizationTaskSolutionBase):
    organization_id: Optional[int] = None
    laboratory_ids: Optional[List[int]] = None


class OrganizationTaskSolutionRead(ORMModel, OrganizationTaskSolutionBase):
    id: int
    organization_id: Optional[int] = None
    created_at: datetime
    laboratories: Optional[List[OrganizationLaboratoryShort]] = None


class OrganizationTaskSolutionUpdate(BaseModel):
    title: Optional[str] = None
    task_description: Optional[str] = None
    solution_description: Optional[str] = None
    article_links: Optional[List[str]] = None
    solution_deadline: Optional[str] = None
    grant_info: Optional[str] = None
    cost: Optional[str] = None
    external_solutions: Optional[str] = None
    laboratory_ids: Optional[List[int]] = None


# =========================
#      ORG QUERIES
# =========================

class OrganizationQueryBase(BaseModel):
    title: str
    task_description: Optional[str] = None
    completed_examples: Optional[str] = None
    grant_info: Optional[str] = None
    budget: Optional[str] = None
    deadline: Optional[str] = None
    status: Optional[str] = "active"
    linked_task_solution_id: Optional[int] = None
    is_published: Optional[bool] = False


class OrganizationQueryCreate(OrganizationQueryBase):
    organization_id: Optional[int] = None
    laboratory_ids: Optional[List[int]] = None
    employee_ids: Optional[List[int]] = None


class OrganizationQueryRead(ORMModel, OrganizationQueryBase):
    id: int
    public_id: Optional[str] = None
    organization_id: Optional[int] = None
    created_at: datetime
    organization: Optional[OrganizationShort] = None
    laboratories: Optional[List[OrganizationLaboratoryShort]] = None
    employees: Optional[List[EmployeeShort]] = None
    linked_task_solution: Optional[OrganizationTaskSolutionRead] = None
    vacancies: Optional[List[VacancyOrganizationRead]] = None


class OrganizationQueryUpdate(BaseModel):
    title: Optional[str] = None
    task_description: Optional[str] = None
    completed_examples: Optional[str] = None
    grant_info: Optional[str] = None
    budget: Optional[str] = None
    deadline: Optional[str] = None
    status: Optional[str] = None
    linked_task_solution_id: Optional[int] = None
    laboratory_ids: Optional[List[int]] = None
    employee_ids: Optional[List[int]] = None
    is_published: Optional[bool] = None



# =========================
#          EMPLOYEES
# =========================

class PublicationItem(BaseModel):
    title: str
    link: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None


class EmployeeBase(BaseModel):
    user_id: Optional[int] = None
    full_name: str
    positions: Optional[List[str]] = None
    academic_degree: Optional[str] = None
    photo_url: Optional[str] = None
    research_interests: Optional[List[str]] = None
    education: Optional[List[str]] = None
    publications: Optional[List[PublicationItem]] = None
    hindex_wos: Optional[int] = None
    hindex_scopus: Optional[int] = None
    hindex_rsci: Optional[int] = None
    hindex_openalex: Optional[int] = None
    contacts: Optional[Dict[str, Any]] = None


class EmployeeCreate(EmployeeBase):
    laboratory_ids: Optional[List[int]] = None


class EmployeeRead(ORMModel, EmployeeBase):
    id: int
    created_at: Optional[datetime] = None
    organization_id: Optional[int] = None
    laboratories: Optional[List[OrganizationLaboratoryShort]] = None


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    positions: Optional[List[str]] = None
    academic_degree: Optional[str] = None
    photo_url: Optional[str] = None
    research_interests: Optional[List[str]] = None
    education: Optional[List[str]] = None
    publications: Optional[List[PublicationItem]] = None
    hindex_wos: Optional[int] = None
    hindex_scopus: Optional[int] = None
    hindex_rsci: Optional[int] = None
    hindex_openalex: Optional[int] = None
    contacts: Optional[Dict[str, Any]] = None
    laboratory_ids: Optional[List[int]] = None


class OrganizationDetails(OrganizationRead):
    equipment: List[OrganizationEquipmentRead] = []
    laboratories: List[OrganizationLaboratoryRead] = []
    employees: List[EmployeeRead] = []
    task_solutions: List[OrganizationTaskSolutionRead] = []
    queries: List[OrganizationQueryRead] = []
    vacancies: List[VacancyOrganizationRead] = []
    representative_email: Optional[str] = None


# =========================
#       APPLICANTS (public view for lab_admin/lab_representative)
# =========================

class LabShort(BaseModel):
    """Краткая информация о лаборатории."""

    public_id: Optional[str] = None
    name: str


class ApplicantListItem(BaseModel):
    public_id: str
    full_name: str
    photo_url: Optional[str] = None
    role: str
    summary: Optional[str] = None
    created_at: Optional[datetime] = None


class ApplicantDetail(BaseModel):
    """Детальная карточка соискателя."""

    public_id: str
    full_name: str
    photo_url: Optional[str] = None
    role: str
    mail: Optional[str] = None
    contacts: Optional[Dict[str, Any]] = None
    # Student
    status: Optional[str] = None
    summary: Optional[str] = None
    education: Optional[List[str]] = None
    skills: Optional[List[str]] = None
    research_interests: Optional[List[str]] = None
    resume_url: Optional[str] = None
    document_urls: Optional[List[str]] = None
    # Researcher
    position: Optional[str] = None
    academic_degree: Optional[str] = None
    publications: Optional[List[Dict[str, Any]]] = None
    hindex_wos: Optional[int] = None
    hindex_scopus: Optional[int] = None
    hindex_rsci: Optional[int] = None
    hindex_openalex: Optional[int] = None
    laboratories: Optional[List[LabShort]] = None
    # Поиск работы
    job_search_status: Optional[str] = None
    desired_positions: Optional[str] = None
    employment_type_preference: Optional[str] = None
    preferred_region: Optional[str] = None
    availability_date: Optional[str] = None
    salary_expectation: Optional[str] = None
    job_search_notes: Optional[str] = None


class ApplicantListResponse(BaseModel):
    items: List[ApplicantListItem]
    total: int
    page: int
    size: int


# Resolve forward refs
VacancyOrganizationRead.model_rebuild()
LaboratoryDetails.model_rebuild()
