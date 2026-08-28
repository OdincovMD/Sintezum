import React from "react";
import { Link } from "react-router-dom";
import { Beaker, Building2, User, ChevronRight } from "lucide-react";
import NewEntityBadge from "../NewEntityBadge";
import { Card, Badge, Button, EntityAvatar } from "../ui";

const DESCRIPTION_MAX = 140;

export default function LabCard({ lab, labImages, onOpen, navigate }) {
  const images = labImages ? labImages(lab.image_urls) : [];
  const avatarUrl = images[0];
  const hasLink = !!lab.public_id;
  const displayName = lab.name || "Лаборатория";
  const description = lab.description || lab.activities || "";
  const truncatedDesc = description.length > DESCRIPTION_MAX ? `${description.slice(0, DESCRIPTION_MAX)}…` : description;

  return (
    <Card
      variant="solid"
      as="article"
      padding="none"
      className="modern-entity-card modern-entity-card--lab"
      onClick={() => hasLink && onOpen(lab.public_id)}
      role={hasLink ? "button" : undefined}
      tabIndex={hasLink ? 0 : undefined}
      onKeyDown={(e) => {
        if (hasLink && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen(lab.public_id);
        }
      }}
    >
      <div className="modern-entity-card__media">
        <EntityAvatar src={avatarUrl} alt="" loading="lazy" />
      </div>

      <div className="modern-entity-card__body">
        <div className="modern-entity-card__info">
          <div className="modern-entity-card__title-row">
            <div className="modern-entity-card__title-icon">
              <Beaker size={18} />
            </div>
            <div className="entity-title-with-badge">
              <h3 className="modern-entity-card__title">
                {hasLink ? (
                  <Link
                    to={`/laboratories/${lab.public_id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {displayName}
                  </Link>
                ) : (
                  <span>{displayName}</span>
                )}
              </h3>
              <NewEntityBadge createdAt={lab.created_at} />
            </div>
          </div>

          <div className="modern-entity-card__meta modern-entity-card__meta--with-icons">
            {lab.organization ? (
              <div
                className="modern-entity-card__meta-row modern-entity-card__meta-row--link"
                onClick={(e) => {
                  e.stopPropagation();
                  if (lab.organization?.public_id) navigate(`/organizations/${lab.organization.public_id}`);
                }}
                role={lab.organization?.public_id ? "button" : undefined}
                tabIndex={lab.organization?.public_id ? 0 : undefined}
                onKeyDown={(e) => {
                  if (lab.organization?.public_id && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/organizations/${lab.organization.public_id}`);
                  }
                }}
              >
                <Building2 size={14} className="modern-entity-card__meta-icon" />
                <span className="modern-entity-card__link modern-entity-card__meta-item--truncate">
                  {lab.organization.name}
                </span>
              </div>
            ) : (
              <div className="modern-entity-card__meta-row">
                <Building2 size={14} className="modern-entity-card__meta-icon" />
                <span className="modern-entity-card__meta-item modern-entity-card__meta-item--muted">
                  Независимая лаборатория
                </span>
              </div>
            )}
            {lab.head_employee && (
              <div className="modern-entity-card__meta-row">
                <User size={14} className="modern-entity-card__meta-icon" />
                <span className="modern-entity-card__meta-item modern-entity-card__meta-item--head modern-entity-card__meta-item--truncate">
                  {lab.head_employee.full_name}
                </span>
              </div>
            )}
          </div>

          {truncatedDesc && (
            <p className="modern-entity-card__desc" title={description}>
              {truncatedDesc}
            </p>
          )}

          {(() => {
            const head = lab.head_employee;
            const headId = head?.id;
            const others = (lab.employees || []).filter((emp) => emp.id !== headId);
            const all = head ? [head, ...others] : others;
            const toShow = all.slice(0, 2);
            const remaining = all.length - 2;
            if (toShow.length === 0) return null;
            return (
              <div className="modern-entity-card__badges">
                {toShow.map((emp) => (
                  <Badge key={emp.id} variant="default">
                    {emp.full_name}
                  </Badge>
                ))}
                {remaining > 0 && <Badge variant="default">+{remaining}</Badge>}
              </div>
            );
          })()}
        </div>

        {hasLink && (
          <div className="modern-entity-card__actions">
            <Button
              variant="ghost"
              size="small"
              to={`/laboratories/${lab.public_id}`}
              className="nowrap-btn modern-entity-card__cta-btn"
              onClick={(e) => e.stopPropagation()}
            >
              <span>В лабораторию</span>
              <ChevronRight size={14} />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
