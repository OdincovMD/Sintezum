import React from "react";
import { NEW_ENTITY_THRESHOLD_DAYS } from "../constants";
import { isEntityNew } from "../utils/entityFreshness";
import { Badge } from "./ui";

export default function NewEntityBadge({ createdAt, className = "" }) {
  if (!isEntityNew(createdAt, NEW_ENTITY_THRESHOLD_DAYS)) return null;

  return (
    <Badge
      variant="accent"
      className={["new-entity-badge", className].filter(Boolean).join(" ")}
      title={`Добавлено менее ${NEW_ENTITY_THRESHOLD_DAYS * 24} часов назад`}
    >
      Новое
    </Badge>
  );
}
