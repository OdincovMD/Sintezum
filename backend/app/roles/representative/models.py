"""
SQLAlchemy ORM-модели для роли представителя (организация, лаборатории, оборудование, сотрудники и т.д.).
"""

from sqlalchemy import (
    Table,
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
    JSON,
    UniqueConstraint,
    Index,
    func,
    Boolean,
)
from sqlalchemy.orm import relationship

from app.database import BaseModel

# Ensure Researcher is registered before researcher_laboratories table
import app.roles.researcher.models  # noqa: F401 - ensures researchers table exists


# =========================
#       ORGANIZATIONS
# =========================

class Organization(BaseModel):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(32), unique=True, nullable=True, index=True)
    name = Column(String(255), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    address = Column(String(500), nullable=True)
    website = Column(String(255), nullable=True)
    ror_id = Column(String(20), unique=True, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    first_created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    is_published = Column(Boolean, nullable=False, server_default="false")
    creator_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    creator = relationship("User", foreign_keys=[creator_user_id])
    vacancies = relationship("VacancyOrganization", back_populates="organization", cascade="all, delete-orphan")
    equipment = relationship("OrganizationEquipment", back_populates="organization", cascade="all, delete-orphan")
    laboratories = relationship("OrganizationLaboratory", back_populates="organization", cascade="all, delete-orphan")
    employees = relationship("Employee", back_populates="organization", cascade="all, delete-orphan")
    task_solutions = relationship(
        "OrganizationTaskSolution",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    queries = relationship("OrganizationQuery", back_populates="organization", cascade="all, delete-orphan")
    org_join_requests = relationship(
        "OrgJoinRequest",
        back_populates="organization",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_organizations_creator", "creator_user_id"),
        Index("idx_organizations_public_id", "public_id"),
    )


# =========================
#     VACANCIES (ORG)
# =========================

class VacancyOrganization(BaseModel):
    __tablename__ = "vacancies_organizations"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(32), unique=True, nullable=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    creator_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    query_id = Column(Integer, ForeignKey("organization_queries.id", ondelete="SET NULL"), nullable=True)
    laboratory_id = Column(Integer, ForeignKey("laboratories_organizations.id", ondelete="SET NULL"), nullable=True)
    contact_employee_id = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(100), nullable=True)
    name = Column(String(255), nullable=False)
    requirements = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    employment_type = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    first_created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    is_published = Column(Boolean, nullable=False, server_default="false")

    organization = relationship("Organization", back_populates="vacancies")
    query = relationship("OrganizationQuery", back_populates="vacancies")
    laboratory = relationship("OrganizationLaboratory")
    contact_employee = relationship("Employee")
    creator = relationship("User")

    vacancy_responses = relationship(
        "VacancyResponse",
        back_populates="vacancy",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_vacancies_organization", "organization_id"),
        Index("idx_vacancies_creator", "creator_user_id"),
        Index("idx_vacancies_query", "query_id"),
        Index("idx_vacancies_laboratory", "laboratory_id"),
        Index("idx_vacancies_contact_employee", "contact_employee_id"),
        Index("idx_vacancies_public_id", "public_id"),
    )


# =========================
#   VACANCY RESPONSES (applicant -> vacancy)
# =========================

class VacancyResponse(BaseModel):
    __tablename__ = "vacancy_responses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    vacancy_id = Column(Integer, ForeignKey("vacancies_organizations.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False, server_default="new")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    vacancy = relationship("VacancyOrganization", back_populates="vacancy_responses")

    __table_args__ = (
        UniqueConstraint("user_id", "vacancy_id", name="uq_vacancy_response_user_vacancy"),
        Index("idx_vacancy_response_user", "user_id"),
        Index("idx_vacancy_response_vacancy", "vacancy_id"),
        Index("idx_vacancy_response_status", "status"),
    )


# =========================
#        EQUIPMENT
# =========================

class OrganizationEquipment(BaseModel):
    __tablename__ = "equipment_organizations"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    creator_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    characteristics = Column(Text, nullable=True)
    image_urls = Column(JSON, nullable=True)

    organization = relationship("Organization", back_populates="equipment")
    creator = relationship("User")
    laboratories = relationship(
        "OrganizationLaboratory",
        secondary="laboratory_equipment",
        back_populates="equipment",
    )

    __table_args__ = (
        Index("idx_equipment_organization", "organization_id"),
        Index("idx_equipment_creator", "creator_user_id"),
    )


# =========================
#       LABORATORIES
# =========================

class OrganizationLaboratory(BaseModel):
    __tablename__ = "laboratories_organizations"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(32), unique=True, nullable=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    creator_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    head_employee_id = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    activities = Column(Text, nullable=True)
    image_urls = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    first_created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    is_published = Column(Boolean, nullable=False, server_default="false")

    organization = relationship("Organization", back_populates="laboratories")
    creator = relationship("User")
    head_employee = relationship("Employee", foreign_keys=[head_employee_id])
    employees = relationship(
        "Employee",
        secondary="employee_laboratories",
        back_populates="laboratories",
    )
    researchers = relationship(
        "Researcher",
        secondary="researcher_laboratories",
        back_populates="laboratories",
    )
    queries = relationship(
        "OrganizationQuery",
        secondary="query_laboratories",
        back_populates="laboratories",
    )
    equipment = relationship(
        "OrganizationEquipment",
        secondary="laboratory_equipment",
        back_populates="laboratories",
    )
    task_solutions = relationship(
        "OrganizationTaskSolution",
        secondary="task_solution_laboratories",
        back_populates="laboratories",
    )
    lab_join_requests = relationship(
        "LabJoinRequest",
        back_populates="laboratory",
        cascade="all, delete-orphan",
    )
    org_join_requests = relationship(
        "OrgJoinRequest",
        back_populates="laboratory",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_laboratories_organization", "organization_id"),
        Index("idx_laboratories_creator", "creator_user_id"),
        Index("idx_laboratories_public_id", "public_id"),
        Index("idx_laboratories_head_employee", "head_employee_id"),
    )


employee_laboratories = Table(
    "employee_laboratories",
    BaseModel.metadata,
    Column("employee_id", ForeignKey("employees.id", ondelete="CASCADE"), primary_key=True),
    Column("laboratory_id", ForeignKey("laboratories_organizations.id", ondelete="CASCADE"), primary_key=True),
)


query_laboratories = Table(
    "query_laboratories",
    BaseModel.metadata,
    Column("query_id", ForeignKey("organization_queries.id", ondelete="CASCADE"), primary_key=True),
    Column("laboratory_id", ForeignKey("laboratories_organizations.id", ondelete="CASCADE"), primary_key=True),
)


laboratory_equipment = Table(
    "laboratory_equipment",
    BaseModel.metadata,
    Column("laboratory_id", ForeignKey("laboratories_organizations.id", ondelete="CASCADE"), primary_key=True),
    Column("equipment_id", ForeignKey("equipment_organizations.id", ondelete="CASCADE"), primary_key=True),
)


task_solution_laboratories = Table(
    "task_solution_laboratories",
    BaseModel.metadata,
    Column("task_solution_id", ForeignKey("task_solutions_organizations.id", ondelete="CASCADE"), primary_key=True),
    Column("laboratory_id", ForeignKey("laboratories_organizations.id", ondelete="CASCADE"), primary_key=True),
)


# =========================
#   TASK SOLUTIONS (ORG)
# =========================

class OrganizationTaskSolution(BaseModel):
    __tablename__ = "task_solutions_organizations"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    creator_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    task_description = Column(Text, nullable=True)
    solution_description = Column(Text, nullable=True)
    article_links = Column(JSON, nullable=True)
    solution_deadline = Column(Text, nullable=True)
    grant_info = Column(Text, nullable=True)
    cost = Column(Text, nullable=True)
    external_solutions = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", back_populates="task_solutions")
    creator = relationship("User")
    laboratories = relationship(
        "OrganizationLaboratory",
        secondary="task_solution_laboratories",
        back_populates="task_solutions",
    )

    __table_args__ = (
        Index("idx_task_solution_organization", "organization_id"),
        Index("idx_task_solution_creator", "creator_user_id"),
    )


# =========================
#      ORG QUERIES
# =========================

class OrganizationQuery(BaseModel):
    __tablename__ = "organization_queries"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(32), unique=True, nullable=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    creator_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    task_description = Column(Text, nullable=True)
    completed_examples = Column(Text, nullable=True)
    grant_info = Column(Text, nullable=True)
    budget = Column(String(100), nullable=True)
    deadline = Column(String(100), nullable=True)
    status = Column(String(100), nullable=False, default="active")
    linked_task_solution_id = Column(
        Integer,
        ForeignKey("task_solutions_organizations.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    first_created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    is_published = Column(Boolean, nullable=False, server_default="false")

    organization = relationship("Organization", back_populates="queries")
    creator = relationship("User")
    linked_task_solution = relationship("OrganizationTaskSolution")
    laboratories = relationship(
        "OrganizationLaboratory",
        secondary="query_laboratories",
        back_populates="queries",
    )
    employees = relationship(
        "Employee",
        secondary="query_employees",
        back_populates="queries",
    )
    vacancies = relationship("VacancyOrganization", back_populates="query")

    __table_args__ = (
        Index("idx_org_query_organization", "organization_id"),
        Index("idx_org_query_creator", "creator_user_id"),
        Index("idx_org_query_status", "status"),
        Index("idx_org_query_public_id", "public_id"),
    )





# =========================
#          EMPLOYEES
# =========================

class Employee(BaseModel):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    creator_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, unique=True)
    full_name = Column(String(255), nullable=False)
    position = Column(JSON, nullable=True)
    academic_degree = Column(String(255), nullable=True)
    photo_url = Column(String(500), nullable=True)
    research_interests = Column(JSON, nullable=True)
    education = Column(JSON, nullable=True)
    publications = Column(JSON, nullable=True)
    hindex_wos = Column(Integer, nullable=True)
    hindex_scopus = Column(Integer, nullable=True)
    hindex_rsci = Column(Integer, nullable=True)
    hindex_openalex = Column(Integer, nullable=True)
    contacts = Column(JSON, nullable=True)

    organization = relationship("Organization", back_populates="employees")
    user = relationship("User", back_populates="employee_profile", foreign_keys=[user_id])
    creator = relationship("User", foreign_keys=[creator_user_id])
    laboratories = relationship(
        "OrganizationLaboratory",
        secondary="employee_laboratories",
        back_populates="employees",
    )
    queries = relationship(
        "OrganizationQuery",
        secondary="query_employees",
        back_populates="employees",
    )

    __table_args__ = (
        Index("idx_employee_organization", "organization_id"),
        Index("idx_employee_creator", "creator_user_id"),
        Index("idx_employee_user", "user_id"),
    )


query_employees = Table(
    "query_employees",
    BaseModel.metadata,
    Column("query_id", ForeignKey("organization_queries.id", ondelete="CASCADE"), primary_key=True),
    Column("employee_id", ForeignKey("employees.id", ondelete="CASCADE"), primary_key=True),
)


# =========================
#   RESEARCHER_LABORATORIES (association)
# =========================

researcher_laboratories = Table(
    "researcher_laboratories",
    BaseModel.metadata,
    Column("researcher_id", ForeignKey("researchers.id", ondelete="CASCADE"), primary_key=True),
    Column("laboratory_id", ForeignKey("laboratories_organizations.id", ondelete="CASCADE"), primary_key=True),
)


# =========================
#   LAB JOIN REQUESTS (Researcher -> Laboratory)
# =========================

class LabJoinRequest(BaseModel):
    __tablename__ = "lab_join_requests"

    id = Column(Integer, primary_key=True, index=True)
    researcher_id = Column(Integer, ForeignKey("researchers.id", ondelete="CASCADE"), nullable=False)
    laboratory_id = Column(Integer, ForeignKey("laboratories_organizations.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    researcher = relationship("Researcher", back_populates="lab_join_requests")
    laboratory = relationship("OrganizationLaboratory", back_populates="lab_join_requests")

    __table_args__ = (
        UniqueConstraint("researcher_id", "laboratory_id", name="uq_lab_join_researcher_lab"),
        Index("idx_lab_join_researcher", "researcher_id"),
        Index("idx_lab_join_laboratory", "laboratory_id"),
        Index("idx_lab_join_status", "status"),
    )


# =========================
#   ORG JOIN REQUESTS (Laboratory -> Organization)
# =========================

class OrgJoinRequest(BaseModel):
    __tablename__ = "org_join_requests"

    id = Column(Integer, primary_key=True, index=True)
    laboratory_id = Column(Integer, ForeignKey("laboratories_organizations.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    laboratory = relationship("OrganizationLaboratory", back_populates="org_join_requests")
    organization = relationship("Organization", back_populates="org_join_requests")

    __table_args__ = (
        UniqueConstraint("laboratory_id", "organization_id", name="uq_org_join_lab_org"),
        Index("idx_org_join_laboratory", "laboratory_id"),
        Index("idx_org_join_organization", "organization_id"),
        Index("idx_org_join_status", "status"),
    )
