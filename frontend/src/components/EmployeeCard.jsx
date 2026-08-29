import React from "react";
import { ChevronRight } from "lucide-react";
import NewEntityBadge from "./NewEntityBadge";
import { Card, EntityAvatar } from "./ui";

/**
 * Reusable Employee Card component
 * @param {Object} employee - Employee data object
 * @param {'grid' | 'list'} variant - Layout variant
 * @param {Function} onClick - Click handler
 * @param {string} className - Additional CSS classes
 */
export function EmployeeCard({ 
  employee, 
  variant = "grid", 
  onClick, 
  actions,
  className = "",
  /** When list variant: override internal label. Pass empty string to hide. */
  listLabel,
}) {
  if (!employee) return null;

  const positions = (employee.positions || []).join(", ");
  const meta = [employee.academic_degree, positions].filter(Boolean).join(" · ");
  
  const isList = variant === "list";

  return (
    <Card
      variant="glass"
      padding={isList ? "sm" : "md"}
      className={`employee-card employee-card--${variant} ${className}`}
      onClick={onClick}
      role={onClick ? "button" : "article"}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="employee-card__avatar-container">
        <EntityAvatar
          src={employee.photo_url}
          alt={employee.full_name}
          className="employee-card__avatar"
        />
      </div>

      <div className="employee-card__content">
        {isList && !actions && listLabel !== "" && (
          <span className="employee-card__label">{listLabel ?? "Контактное лицо"}</span>
        )}
        <div className="entity-title-with-badge">
          <h3 className="employee-card__name">{employee.full_name}</h3>
          <NewEntityBadge createdAt={employee.created_at} />
        </div>
        {meta && <p className="employee-card__meta">{meta}</p>}
        {isList && !actions && (
          <span className="employee-card__cta">
            Открыть профиль <ChevronRight size={14} />
          </span>
        )}
        {actions && <div className="employee-card__actions" onClick={e => e.stopPropagation()}>{actions}</div>}
      </div>
    </Card>
  );
}
