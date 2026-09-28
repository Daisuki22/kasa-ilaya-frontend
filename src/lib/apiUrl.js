const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const candidateApiUrl = import.meta.env.DEV
  ? configuredApiUrl || "/api"
  : "/api";

const isLocalApiUrl = (value) => {
  if (!/^https?:\/\//i.test(value)) {
    return false;
  }

  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(value, "http://localhost").hostname);
  } catch {
    return false;
  }
};

const normalizedApiUrl = candidateApiUrl.replace(/\/+$/, "");

export const API_BASE_URL = !import.meta.env.DEV && isLocalApiUrl(normalizedApiUrl)
  ? "/api"
  : /\/api$/i.test(normalizedApiUrl)
    ? normalizedApiUrl
    : `${normalizedApiUrl}/api`;

export const getApiAssetBaseUrl = () => {
  try {
    const apiUrl = new URL(API_BASE_URL, window.location.href);
    apiUrl.pathname = apiUrl.pathname.replace(/\/api\/?$/i, "").replace(/\/$/, "");
    apiUrl.search = "";
    apiUrl.hash = "";
    return apiUrl.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};
