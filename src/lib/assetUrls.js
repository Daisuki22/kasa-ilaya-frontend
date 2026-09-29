const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
import { getApiAssetBaseUrl } from "@/lib/apiUrl";

const isLocalHostname = (hostname) => LOCAL_HOSTNAMES.has(hostname.toLowerCase());

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

  const relativeUpload = normalized.match(/^(?:\.\/)?(?:(?:api)\/)?(uploads|payment_proofs|profile_images|package_images)\/(.+)$/i);
  if (relativeUpload) {
    const assetBase = getApiAssetBaseUrl();
    const relativePath = relativeUpload[1].toLowerCase() === "uploads"
      ? `uploads/${relativeUpload[2]}`
      : `uploads/${relativeUpload[1]}/${relativeUpload[2]}`;
    return assetBase ? `${assetBase}/${relativePath}` : `/${relativePath}`;
  }

  // Normalize common relative image paths returned by the API.
  if (/^(?:\.\/)?img\//i.test(normalized)) {
    const imagePath = normalized.replace(/^\.\//, "");
    return `${appBasePath()}${imagePath}`.replace(/\/{2,}/g, "/");
  }

  if (/^img\//i.test(normalized)) {
    return `${appBasePath()}${normalized}`.replace(/\/{2,}/g, "/");
  }

  if (/^\/img\//i.test(normalized) && appBasePath() !== "/") {
    return `${appBasePath()}${normalized.slice(1)}`.replace(/\/{2,}/g, "/");
  }

  if (/^\/uploads\//i.test(normalized)) {
    const assetBase = getApiAssetBaseUrl();
    return assetBase ? `${assetBase}${normalized}` : normalized;
  }

  if (/^\/api\/uploads\//i.test(normalized)) {
    const assetBase = getApiAssetBaseUrl();
    return assetBase ? `${assetBase}${normalized.replace(/^\/api/i, "")}` : normalized;
  }

  if (typeof window === "undefined" || !/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    const currentUrl = new URL(window.location.href);

    const uploadMatch = url.pathname.match(/(?:^|\/)api\/(uploads\/.*)$/i) || url.pathname.match(/(?:^|\/)(uploads\/.*)$/i);
    if (uploadMatch) {
      const assetBase = getApiAssetBaseUrl();
      return assetBase ? `${assetBase}/${uploadMatch[1]}${url.search}${url.hash}` : normalized;
    }

    if (!isLocalHostname(url.hostname) || isLocalHostname(currentUrl.hostname)) {
      return normalized;
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
