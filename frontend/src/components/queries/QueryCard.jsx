import React from "react";
import { Link } from "react-router-dom";
import { HelpCircle, Building2, Beaker, Layers, CalendarClock, Wallet, ChevronRight } from "lucide-react";
import NewEntityBadge from "../NewEntityBadge";
import { Card, Badge, Button } from "../ui";

const QUERY_STATUS_LABELS = { active: "Открыт", paused: "На паузе", closed: "Закрыт" };
const DESCRIPTION_MAX = 120;

/** Пытается отформатировать deadline; если это не дата — возвращает как есть. */
function formatDeadline(value) {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed;
  return d.toLocaleDateString("ru-RU");
}

export default function QueryCard({ query, onOpen, navigate }) {
  const hasLink = !!query.public_id;
  const title = query.title || "Запрос";
  const description = query.task_description || "";
  const truncatedDesc =
    description.length > DESCRIPTION_MAX
      ? `${description.slice(0, DESCRIPTION_MAX)}…`
      : description;

  const org = query.organization;
  const lab = query.laboratory;

  return (
    <Card
      variant="solid"
      as="article"
      padding="md"
      className="query-card-modern"
    >
      <div className="query-card-modern__inner">
        <div className="query-card-modern__info">
          <div className="query-card-modern__title-row">
            <div className="query-card-modern__title-icon">
              <HelpCircle size={18} />
            </div>
            <div className="entity-title-with-badge">
              <h3 className="query-card-modern__title">
                {hasLink ? (
                  <Link
                    to={`/queries/${query.public_id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {title}
                  </Link>
                ) : (
                  <span>{title}</span>
                )}
              </h3>
              <NewEntityBadge createdAt={query.created_at} />
            </div>
          </div>

          <div className="query-card-modern__meta query-card-modern__meta--with-icons">
            {org && (
              <div
                className="query-card-modern__meta-row query-card-modern__meta-row--link"
                onClick={(e) => {
                  e.stopPropagation();
                  if (org.public_id) navigate?.(`/organizations/${org.public_id}`);
                }}
                role={org.public_id ? "button" : undefined}
                tabIndex={org.public_id ? 0 : undefined}
                onKeyDown={(e) => {
                  if (org.public_id && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    navigate?.(`/organizations/${org.public_id}`);
                  }
                }}
              >
                <Building2 size={14} className="query-card-modern__meta-icon" />
                <span className="query-card-modern__meta-item">{org.name}</span>
              </div>
            )}
            {lab && !org && (
              <div className="query-card-modern__meta-row">
                <Beaker size={14} className="query-card-modern__meta-icon" />
                <span className="query-card-modern__meta-item">{lab.name}</span>
              </div>
            )}
            {query.research_direction && (
              <div className="query-card-modern__meta-row">
                <Layers size={14} className="query-card-modern__meta-icon" />
                <span className="query-card-modern__meta-item">{query.research_direction}</span>
              </div>
            )}
          </div>

          {truncatedDesc && (
            <p className="query-card-modern__desc" title={description}>
              {truncatedDesc}
            </p>
          )}

          {(query.status || query.deadline || query.budget) && (
            <div className="query-card-modern__badges">
              {query.status && (
                <Badge
                  variant={
                    query.status === "active"
                      ? "success"
                      : query.status === "closed"
                        ? "default"
                        : "default"
                  }
                >
                  {QUERY_STATUS_LABELS[query.status] ?? query.status}
                </Badge>
              )}
              {query.deadline && (
                <span className="query-card-modern__meta-inline">
                  <CalendarClock size={12} className="query-card-modern__meta-inline-icon" />
                  {formatDeadline(query.deadline)}
                </span>
              )}
              {query.budget && (
                <span className="query-card-modern__meta-inline">
                  <Wallet size={12} className="query-card-modern__meta-inline-icon" />
                  {query.budget}
                </span>
              )}
            </div>
          )}
        </div>

        {hasLink && (
          <div className="query-card-modern__actions">
            <Button
              variant="ghost"
              size="small"
              to={`/queries/${query.public_id}`}
              className="nowrap-btn query-card-modern__cta-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpen?.(query.public_id);
              }}
            >
              <span>Подробнее</span>
              <ChevronRight size={14} />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
