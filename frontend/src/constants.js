/**
 * Default placeholder image for entities without photos.
 * Used for: employees, vacancies, queries, organizations, laboratories, applicants.
 * Also serves as favicon (see index.html).
 */
export const DEFAULT_PLACEHOLDER_IMAGE = "/images/placeholder.png";

const parsedNewEntityThresholdDays = Number(import.meta.env.VITE_NEW_ENTITY_THRESHOLD_DAYS);

/** Number of exact 24-hour periods during which an entity is considered new. */
export const NEW_ENTITY_THRESHOLD_DAYS =
  Number.isFinite(parsedNewEntityThresholdDays) && parsedNewEntityThresholdDays > 0
    ? parsedNewEntityThresholdDays
    : 2;
