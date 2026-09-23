const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV
    ? "http://localhost/Kasa-Ilaya-Resort/backend/api"
    : "https://kasa-ilaya-resort-back-end.onrender.com/api");

const isLocalHostname = (hostname) => LOCAL_HOSTNAMES.has(hostname.toLowerCase());

const apiAssetBaseUrl = () => {
  try {
    const apiUrl = new URL(API_BASE_URL, typeof window === "undefined" ? "http://localhost" : window.location.href);
    apiUrl.pathname = apiUrl.pathname.replace(/\/api\/?$/i, "").replace(/\/$/, "");
    apiUrl.search = "";
    apiUrl.hash = "";
    return apiUrl.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};

const appBasePath = () => {
  const viteBase = import.meta.env.BASE_URL || "/";
  if (viteBase && viteBase !== "/") {
    return viteBase.endsWith("/") ? viteBase : `${viteBase}/`;
  }

  if (typeof window === "undefined") {
    return "/";
  }

  const projectMatch = window.location.pathname.match(/^\/Kasa-Ilaya-Resort(?:\/|$)/i);
  return projectMatch ? "/Kasa-Ilaya-Resort/" : "/";
};

export const resolveAssetUrl = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed || /^(data|blob):/i.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.replace(/\\/g, "/");

  if (/^img\//i.test(normalized)) {
    return `${appBasePath()}${normalized}`.replace(/\/{2,}/g, "/");
  }

  if (/^\/img\//i.test(normalized) && appBasePath() !== "/") {
    return `${appBasePath()}${normalized.slice(1)}`.replace(/\/{2,}/g, "/");
  }

  if (/^\/uploads\//i.test(normalized)) {
    const assetBase = apiAssetBaseUrl();
    return assetBase ? `${assetBase}${normalized}` : normalized;
  }

  if (/^\/api\/uploads\//i.test(normalized)) {
    const assetBase = apiAssetBaseUrl();
    return assetBase ? `${assetBase}${normalized.replace(/^\/api/i, "")}` : normalized;
  }

  if (typeof window === "undefined" || !/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    const currentUrl = new URL(window.location.href);

    if (!isLocalHostname(url.hostname) || isLocalHostname(currentUrl.hostname)) {
      return normalized;
    }

    const uploadMatch = url.pathname.match(/(?:^|\/)api\/(uploads\/.*)$/i) || url.pathname.match(/(?:^|\/)(uploads\/.*)$/i);
    if (uploadMatch) {
      const assetBase = apiAssetBaseUrl();
      return assetBase ? `${assetBase}/${uploadMatch[1]}${url.search}${url.hash}` : normalized;
    }

    url.protocol = currentUrl.protocol;
    url.host = currentUrl.host;
    return url.toString();
  } catch {
    return normalized;
  }
};

export const resolveAssetUrlsDeep = (value) => {
  if (Array.isArray(value)) {
    return value.map(resolveAssetUrlsDeep);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, resolveAssetUrlsDeep(entryValue)])
    );
  }

  return resolveAssetUrl(value);
};
