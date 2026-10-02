// The disabled desk can be previewed before the database migration. This
// per-instance limiter is never used for a tracking/trading-enabled desk.
const limits = new Map<string, { count: number; expires: number }>();
export function previewLoginAllowed(key: string, now = Date.now()) {
  for (const [id, row] of limits) if (row.expires <= now) limits.delete(id);
  if (limits.size > 10000 && !limits.has(key)) return false;
  const bucket = Math.floor(now / 900000), prefix = `${bucket}:`;
  for (const [id, max] of [['global', 100], [key, 10]] as const) {
    const idKey = `${prefix}${id}`, row = limits.get(idKey) || { count: 0, expires: (bucket + 1) * 900000 };
    row.count++; limits.set(idKey, row);
    if (row.count > max) return false;
  }
  return true;
}
