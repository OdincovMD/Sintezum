const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isEntityNew(createdAt, thresholdDays, nowMs = Date.now()) {
  if (!createdAt || !Number.isFinite(thresholdDays) || thresholdDays <= 0) return false;

  const createdAtMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) return false;

  const ageMs = nowMs - createdAtMs;
  return ageMs >= 0 && ageMs <= thresholdDays * MS_PER_DAY;
}
