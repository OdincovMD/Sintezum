import React from "react";
import { Link } from "react-router-dom";
import { User, GraduationCap, Briefcase, ChevronRight } from "lucide-react";
import NewEntityBadge from "../NewEntityBadge";
import { Card, Button, EntityAvatar } from "../ui";

const ROLE_LABELS = { student: "Студент", researcher: "Исследователь" };
const DESCRIPTION_MAX = 140;

export default function ApplicantCard({ applicant, onOpen }) {
  const hasLink = !!applicant.public_id;
  const roleLabel = ROLE_LABELS[applicant.role] || applicant.role;
  const displayName = applicant.full_name || "Соискатель";
  const summary = applicant.summary || "";
  const truncatedDesc =
    summary.length > DESCRIPTION_MAX ? `${summary.slice(0, DESCRIPTION_MAX)}…` : summary;
  const RoleIcon = applicant.role === "researcher" ? Briefcase : GraduationCap;

  return (
    <Card
      variant="solid"
      as="article"
      padding="none"
      className="modern-entity-card modern-entity-card--applicant"
      onClick={() => hasLink && onOpen(applicant.public_id)}
      role={hasLink ? "button" : undefined}
      tabIndex={hasLink ? 0 : undefined}
      onKeyDown={(e) => {
        if (hasLink && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen(applicant.public_id);
        }
      }}
    >
      <div className="modern-entity-card__media">
        <EntityAvatar src={applicant.photo_url} alt="" loading="lazy" />
      </div>

      <div className="modern-entity-card__body">
        <div className="modern-entity-card__info">
          <div className="modern-entity-card__title-row">
            <div className="modern-entity-card__title-icon">
              <User size={18} />
            </div>
            <div className="entity-title-with-badge">
              <h3 className="modern-entity-card__title">
                {hasLink ? (
                  <Link
                    to={`/applicants/${applicant.public_id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {displayName}
                  </Link>
                ) : (
                  <span>{displayName}</span>
                )}
              </h3>
              <NewEntityBadge createdAt={applicant.created_at} />
            </div>
          </div>

          {roleLabel && (
            <div className="modern-entity-card__meta modern-entity-card__meta--with-icons">
              <div className="modern-entity-card__meta-row">
                <RoleIcon size={14} className="modern-entity-card__meta-icon" />
                <span className="modern-entity-card__meta-item modern-entity-card__meta-item--muted">
                  {roleLabel}
                </span>
              </div>
            </div>
          )}

          {truncatedDesc && (
            <p className="modern-entity-card__desc" title={summary}>
              {truncatedDesc}
            </p>
          )}
        </div>

        {hasLink && (
          <div className="modern-entity-card__actions">
            <Button
              variant="ghost"
              size="small"
              to={`/applicants/${applicant.public_id}`}
              className="nowrap-btn modern-entity-card__cta-btn"
              onClick={(e) => e.stopPropagation()}
            >
              <span>Открыть профиль</span>
              <ChevronRight size={14} />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
