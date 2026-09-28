const PRODUCTION_API_URL = "https://kasa-ilaya-resort-back-end.onrender.com/api";

const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const candidateApiUrl = configuredApiUrl || (import.meta.env.DEV ? "/api" : PRODUCTION_API_URL);

const isLocalApiUrl = (value) => {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(value, "http://localhost").hostname);
  } catch {
    return false;
  }
};

const normalizedApiUrl = candidateApiUrl.replace(/\/+$/, "");

export const API_BASE_URL = !import.meta.env.DEV && isLocalApiUrl(normalizedApiUrl)
  ? PRODUCTION_API_URL
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
