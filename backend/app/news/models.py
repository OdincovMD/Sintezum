"""SQLAlchemy-модель новостей."""

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, Table, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.database import BaseModel


news_employees = Table(
    "news_employees",
    BaseModel.metadata,
    Column("news_id", ForeignKey("news.id", ondelete="CASCADE"), primary_key=True),
    Column("employee_id", ForeignKey("employees.id", ondelete="CASCADE"), primary_key=True),
    Index("idx_news_employees_employee", "employee_id"),
)


class News(BaseModel):
    __tablename__ = "news"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(32), nullable=False, unique=True, index=True)
    scope = Column(String(20), nullable=False)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
    )
    laboratory_id = Column(
        Integer,
        ForeignKey("laboratories_organizations.id", ondelete="CASCADE"),
        nullable=True,
    )
    author_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    title = Column(String(255), nullable=False)
    content = Column(JSONB, nullable=False)
    cover_url = Column(Text, nullable=True)
    gallery_urls = Column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    attachments = Column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    status = Column(String(20), nullable=False, server_default="draft")
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    employees = relationship("Employee", secondary=news_employees)

    __table_args__ = (
        CheckConstraint(
            "scope IN ('platform', 'organization', 'laboratory')",
            name="ck_news_scope",
        ),
        CheckConstraint(
            "status IN ('draft', 'published', 'blocked')",
            name="ck_news_status",
        ),
        CheckConstraint(
            "(scope = 'platform' AND organization_id IS NULL AND laboratory_id IS NULL) OR "
            "(scope = 'organization' AND organization_id IS NOT NULL AND laboratory_id IS NULL) OR "
            "(scope = 'laboratory' AND organization_id IS NULL AND laboratory_id IS NOT NULL)",
            name="ck_news_owner",
        ),
        Index("idx_news_status_published", "status", "published_at"),
        Index("idx_news_organization", "organization_id", "status", "published_at"),
        Index("idx_news_laboratory", "laboratory_id", "status", "published_at"),
    )
