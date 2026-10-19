const normalize = (value) => String(value || "").toLowerCase();

export const buildActivityLogStats = (logs = []) => {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  const lastHourCount = logs.filter((log) => {
    if (!log?.created_date) {
      return false;
    }

    const value = new Date(log.created_date).getTime();
    return Number.isFinite(value) && value >= oneHourAgo;
  }).length;

  const uniqueUsers = new Set(logs.map((log) => log.user_email || log.user_name).filter(Boolean)).size;

  return {
    total: logs.length,
    lastHourCount,
    uniqueUsers,
  };
};

export const matchesActivityLogSearch = (log, query) => {
  const normalizedQuery = normalize(query);

  return [
    log?.user_name,
    log?.user_email,
    log?.action,
    log?.entity_type,
    log?.details,
  ].some((value) => normalize(value).includes(normalizedQuery));
};
