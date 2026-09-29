import { resolveAssetUrlsDeep } from "@/lib/assetUrls";
import { API_BASE_URL } from "@/lib/apiUrl";
import { normalizeDateOnly } from "@/lib/safeDate";

const createId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const WELCOME_INTRO_SESSION_KEY = "ki-welcome-intro-shown";
const THEME_STORAGE_KEY = "kasa-ilaya-theme";
const AUTH_MARKER_KEY = `ki-authenticated:${API_BASE_URL}`;

let inMemoryAuthMarker = false;

const hasClientAuthMarker = () => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return (
      window.localStorage.getItem(AUTH_MARKER_KEY) === "true" ||
      inMemoryAuthMarker
    );
  } catch {
    return inMemoryAuthMarker;
  }
};

const markClientAuthenticated = () => {
  inMemoryAuthMarker = true;

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(AUTH_MARKER_KEY, "true");
  } catch {
    // The in-memory marker keeps this tab authenticated until it closes.
  }
};

const unauthenticatedError = () => {
  const error = new Error("Not authenticated.");
  error.error = "Not authenticated.";
  error.status = 401;
  return error;
};

const clearClientAuthState = () => {
  if (typeof window === "undefined") {
    return;
  }

  const preservedSession = new Map();
  const preservedLocal = new Map();

  try {
    const welcomeIntroShown = window.sessionStorage.getItem(
      WELCOME_INTRO_SESSION_KEY
    );

    if (welcomeIntroShown !== null) {
      preservedSession.set(
        WELCOME_INTRO_SESSION_KEY,
        welcomeIntroShown
      );
    }
  } catch {}

  try {
    const theme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (theme !== null) {
      preservedLocal.set(THEME_STORAGE_KEY, theme);
    }
  } catch {}

  try {
    window.sessionStorage.clear();
  } catch {}

  try {
    window.localStorage.clear();
  } catch {}

  inMemoryAuthMarker = false;

  preservedSession.forEach((value, key) => {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {}
  });

  preservedLocal.forEach((value, key) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  });
};

const dispatchAuthChange = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth-changed"));
    window.dispatchEvent(new CustomEvent("local-auth-changed"));
  }
};

const buildApiUrl = (path) => `${API_BASE_URL}${path}`;

const buildLoginUrl = (nextUrl) => {
  const params = new URLSearchParams();

  if (nextUrl) {
    params.set("next", nextUrl);
  }

  return `/Login${params.toString() ? `?${params.toString()}` : ""}`;
};

const request = async (path, options = {}) => {
  const { suppressAuthEvent = false, timeoutMs = 20000, ...fetchOptions } = options;

  const headers = { ...(fetchOptions.headers || {}) };
  let body = fetchOptions.body;
  const originalBody = body;
  const requestMethod = fetchOptions.method || "GET";
  const isBookingCreate = requestMethod === "POST" && /\/entities(?:\.php)?\?entity=Booking(?:&|$)/i.test(path);
  const requestUrl = buildApiUrl(path);
  const requestBodyKeys = originalBody instanceof FormData
    ? Array.from(new Set(Array.from(originalBody.keys())))
    : originalBody && typeof originalBody === "object"
      ? Object.keys(originalBody)
      : [];

  if (isBookingCreate && import.meta.env.DEV) {
    console.info("[BOOKING DEBUG] request", {
      url: requestUrl,
      method: requestMethod,
      bodyKeys: requestBodyKeys,
      credentials: "include",
      hasAuthorizationHeader: Boolean(headers.Authorization || headers.authorization),
    });
  }

  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    response = await fetch(requestUrl, {
      credentials: "include",
      cache: "no-store",
      ...fetchOptions,
      signal: fetchOptions.signal || controller.signal,
      headers,
      body,
    });
  } catch (error) {
    window.clearTimeout(timeoutId);
    if (import.meta.env.DEV) {
      console.warn("Kasa Ilaya API request failed", path, error);
    }
    if (isBookingCreate && import.meta.env.DEV) {
      console.error("[BOOKING DEBUG] response", {
        url: requestUrl,
        method: requestMethod,
        status: "network_error",
        error: error?.message || "Request failed before an HTTP response was received.",
      });
    }

    if (error?.name === "AbortError") {
      throw new Error("The server took too long to respond. Please try again.");
    }

    throw new Error("Unable to connect to the resort service. Please try again shortly.");
  }

  const contentType = response.headers.get("content-type") || "";
  let responseText;
  try {
    responseText = await response.text();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("The server took too long to respond. Please try again.");
    }
    throw new Error("The resort service returned an incomplete response. Please try again.");
  } finally {
    window.clearTimeout(timeoutId);
  }

  let payload = responseText;

  if (
    contentType.includes("application/json") ||
    /^[\[{]/.test(responseText.trim())
  ) {
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      payload = {
        error: response.ok
          ? "Server returned an invalid response."
          : responseText
              .replace(/<[^>]*>/g, " ")
              .replace(/\s+/g, " ")
              .trim() || "Request failed.",
      };
    }
  }

  if (!response.ok) {
    const rawMessage =
      typeof payload === "string"
        ? payload
        : payload?.error || "Request failed.";

    if (import.meta.env.DEV) {
      console.warn("Kasa Ilaya API response failed", {
        method: fetchOptions.method || "GET",
        path,
        status: response.status,
        requestId: payload?.request_id,
      });
    }

    if (isBookingCreate && import.meta.env.DEV) {
      console.error("[BOOKING DEBUG] response", {
        url: requestUrl,
        method: requestMethod,
        status: response.status,
        body: typeof payload === "object" && payload !== null
          ? {
              error: payload.error,
              error_code: payload.error_code,
              details: payload.details,
              request_id: payload.request_id,
            }
          : String(payload || "").slice(0, 500),
      });
    }

    const message =
      /SQLSTATE\[HY000\]\s*\[2002\]|target machine actively refused/i.test(
        rawMessage
      )
        ? "Database connection is unavailable. Please start MySQL in XAMPP and try again."
        : rawMessage;

    const error = new Error(message);
    error.status = response.status;
    error.endpoint = requestUrl;
    error.method = requestMethod;

    if (payload && typeof payload === "object") {
      Object.assign(error, payload);
      error.error = message;
    }

    if (response.status === 401) {
      clearClientAuthState();

      if (!suppressAuthEvent) {
        dispatchAuthChange();
      }
    }

    throw error;
  }

  if (isBookingCreate && import.meta.env.DEV) {
    console.info("[BOOKING DEBUG] response", {
      url: requestUrl,
      method: requestMethod,
      status: response.status,
      bodyKeys: payload && typeof payload === "object" ? Object.keys(payload) : [],
    });
  }

  return resolveAssetUrlsDeep(payload);
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const normalizeEntityDates = (entityName, value) => {
  const dateFields = {
    Booking: ["booking_date", "rebooking_original_date", "rebooking_requested_date"],
    UpcomingSchedule: ["schedule_date"],
  }[entityName];

  if (!dateFields || !value || typeof value !== "object") {
    return value;
  }

  const normalizeRecord = (record) => {
    if (!record || typeof record !== "object") return record;
    return dateFields.reduce((normalized, field) => {
      if (normalized[field] !== null && normalized[field] !== undefined) {
        normalized[field] = normalizeDateOnly(normalized[field]);
      }
      return normalized;
    }, { ...record });
  };

  return Array.isArray(value) ? value.map(normalizeRecord) : normalizeRecord(value);
};

const createBookingReference = () => {
  const now = new Date();

  const datePart = `${String(now.getFullYear()).slice(-2)}${String(
    now.getMonth() + 1
  ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  const serial = String(Math.floor(Math.random() * 1000)).padStart(3, "0");

  return `KI-${datePart}-${serial}`;
};

const withEntityDefaults = (entityName, payload) => {
  if (entityName === "Booking") {
    return {
      booking_reference:
        payload.booking_reference || createBookingReference(),
      status: payload.status || "pending",
      payment_status:
        payload.payment_status ||
        (payload.receipt_url ? "pending_verification" : "unpaid"),
      ...payload,
    };
  }

  if (entityName === "Review") {
    return {
      is_approved: payload.is_approved ?? true,
      ...payload,
    };
  }

  return payload;
};

const createEntityHandler = (entityName) => ({
  async unreadCount() {
    if (entityName !== "Notification") throw new Error("Unread counts are only available for notifications.");
    return request("/entities.php?entity=Notification&action=unread-count");
  },

  async markAllRead() {
    if (entityName !== "Notification") throw new Error("Mark all read is only available for notifications.");
    return request("/entities.php?entity=Notification&action=mark-all-read", { method: "PATCH" });
  },

  async publish(id) {
    if (entityName !== "LegalDocument") {
      throw new Error("Only legal documents can be published.");
    }
    const result = await request(
      `/entities.php?entity=LegalDocument&id=${encodeURIComponent(id)}&action=publish`,
      { method: "PATCH", body: {} }
    );
    return result?.data || result;
  },

  async availability(excludeBookingId) {
    if (entityName !== "Booking") {
      throw new Error("Availability is only available for bookings.");
    }

    const params = new URLSearchParams({ entity: "Booking", action: "availability" });
    if (excludeBookingId) params.set("exclude_id", excludeBookingId);
    return request(`/entities.php?${params.toString()}`);
  },

  async list(sortField, limit, offset) {
    const params = new URLSearchParams({
      entity: entityName,
    });

    if (sortField) {
      params.set("sort", sortField);
    }

    if (typeof limit === "number") {
      params.set("limit", String(limit));
    }

    if (typeof offset === "number" && offset > 0) {
      params.set("offset", String(offset));
    }

    return asArray(
      normalizeEntityDates(entityName, await request(`/entities.php?${params.toString()}`))
    );
  },

  async filter(query = {}, sortField, limit) {
    const params = new URLSearchParams({
      entity: entityName,
      filter: JSON.stringify(query),
    });

    if (sortField) {
      params.set("sort", sortField);
    }

    if (typeof limit === "number") {
      params.set("limit", String(limit));
    }

    return asArray(
      normalizeEntityDates(entityName, await request(`/entities.php?${params.toString()}`))
    );
  },

  async create(data) {
    return normalizeEntityDates(entityName, await request(
      `/entities.php?entity=${encodeURIComponent(entityName)}`,
      {
        method: "POST",
        body: {
          id: data.id || createId(entityName.toLowerCase()),
          ...withEntityDefaults(entityName, data),
        },
      }
    ));
  },

  async update(id, data) {
    return normalizeEntityDates(entityName, await request(
      `/entities.php?entity=${encodeURIComponent(
        entityName
      )}&id=${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: data,
      }
    ));
  },

  async accept(id) {
    if (entityName !== "Booking") {
      throw new Error("Only bookings can be accepted.");
    }
    const result = await request(
      `/entities.php?entity=Booking&id=${encodeURIComponent(id)}&action=accept`,
      { method: "PATCH", body: {} }
    );
    return normalizeEntityDates("Booking", result?.data || result);
  },

  async markAdditionalFeePaid(id) {
    if (entityName !== "Booking") {
      throw new Error("Damage fee payment is only available for bookings.");
    }
    const result = await request(
      `/entities.php?entity=Booking&id=${encodeURIComponent(id)}&action=mark-additional-fee-paid`,
      { method: "PATCH", body: {} }
    );
    return normalizeEntityDates("Booking", result?.data || result);
  },

  async reschedule(id, bookingDate, note = "") {
    if (entityName !== "Booking") {
      throw new Error("Rescheduling is only available for bookings.");
    }

    const body = {};
    if (bookingDate) body.booking_date = bookingDate;
    if (note) body.note = note;
    const result = await request(
      `/entities.php?entity=Booking&id=${encodeURIComponent(id)}&action=reschedule`,
      {
        method: "PATCH",
        body,
      }
    );

    return normalizeEntityDates("Booking", result?.data || result);
  },

  async requestReschedule(id, bookingDate, note = "") {
    if (entityName !== "Booking") {
      throw new Error("Rescheduling is only available for bookings.");
    }
    const result = await request(
      `/entities.php?entity=Booking&id=${encodeURIComponent(id)}&action=request-reschedule`,
      {
        method: "PATCH",
        body: { booking_date: bookingDate, note },
      }
    );
    return normalizeEntityDates("Booking", result?.data || result);
  },

  async rejectReschedule(id, note = "") {
    if (entityName !== "Booking") {
      throw new Error("Reschedule decisions are only available for bookings.");
    }
    const result = await request(
      `/entities.php?entity=Booking&id=${encodeURIComponent(id)}&action=resolve-reschedule`,
      {
        method: "PATCH",
        body: { note },
      }
    );
    return normalizeEntityDates("Booking", result?.data || result);
  },

  async delete(id) {
    return request(
      `/entities.php?entity=${encodeURIComponent(
        entityName
      )}&id=${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      }
    );
  },
});

export const baseClient = {
  auth: {
    async me() {
      if (!hasClientAuthMarker()) {
        throw unauthenticatedError();
      }

      return request("/auth.php?action=me", {
        suppressAuthEvent: true,
      });
    },

    async login(data) {
      const payload = await request("/auth.php?action=login", {
        method: "POST",
        body: data,
      });

      if (payload?.user) {
        markClientAuthenticated();
      }

      dispatchAuthChange();

      return payload;
    },

    async getGoogleConfig() {
      return request("/auth.php?action=google-config");
    },

    async getCaptchaChallenge(purpose) {
      return request(
        `/auth.php?action=captcha-challenge&purpose=${encodeURIComponent(
          purpose
        )}`
      );
    },

    async verifyCaptcha(data) {
      return request("/auth.php?action=verify-captcha", {
        method: "POST",
        body: data,
      });
    },

    async completeLoginCaptcha(data) {
      const payload = await request(
        "/auth.php?action=complete-login-captcha",
        {
          method: "POST",
          body: data,
        }
      );

      if (payload?.user) {
        markClientAuthenticated();
      }

      dispatchAuthChange();

      return payload;
    },

    async googleLogin(data) {
      const payload = await request(
        "/auth.php?action=google-login",
        {
          method: "POST",
          body: data,
        }
      );

      if (payload?.user) {
        markClientAuthenticated();
      }

      dispatchAuthChange();

      return payload;
    },

    async register(data) {
      const payload = await request(
        "/auth.php?action=register",
        {
          method: "POST",
          body: data,
        }
      );

      dispatchAuthChange();

      return payload;
    },

    async updateMe(data) {
      const user = await request(
        "/auth.php?action=update-me",
        {
          method: "POST",
          body: data,
        }
      );

      dispatchAuthChange();

      return user;
    },

    async changePassword(data) {
      return request(
        "/auth.php?action=change-password",
        {
          method: "POST",
          body: data,
        }
      );
    },

    async forgotPassword(data) {
      return request(
        "/auth.php?action=forgot-password",
        {
          method: "POST",
          body: data,
        }
      );
    },

    async resendResetOtp(data) {
      return request(
        "/auth.php?action=resend-reset-otp",
        {
          method: "POST",
          body: data,
        }
      );
    },

    async sendRegistrationOtp(data) {
      return request(
        "/auth.php?action=send-registration-otp",
        {
          method: "POST",
          body: data,
        }
      );
    },

    async verifyRegistrationOtp(data) {
      return request(
        "/auth.php?action=verify-registration-otp",
        {
          method: "POST",
          body: data,
        }
      );
    },

    async validateResetToken(token) {
      return request(
        `/auth.php?action=validate-reset-token&token=${encodeURIComponent(
          token
        )}`
      );
    },

    async validateResetCode(data) {
      return request(
        "/auth.php?action=validate-reset-code",
        {
          method: "POST",
          body: data,
        }
      );
    },

    async resetPassword(data) {
      return request(
        "/auth.php?action=reset-password",
        {
          method: "POST",
          body: data,
        }
      );
    },

    redirectToLogin(
      nextUrl =
        typeof window !== "undefined"
          ? window.location.href
          : "/"
    ) {
      if (typeof window !== "undefined") {
        window.location.href = buildLoginUrl(nextUrl);
      }

      return Promise.resolve(null);
    },

    async logout(redirectUrl = "/") {
      clearClientAuthState();
      dispatchAuthChange();

      try {
        await request("/auth.php?action=logout", {
          method: "POST",
          body: {
            redirect_url: redirectUrl,
          },
        });
      } catch {
        // Browser state is already cleared.
      }

      clearClientAuthState();
      dispatchAuthChange();

      if (typeof window !== "undefined") {
        window.location.replace(redirectUrl || "/");
      }

      return {
        success: true,
        redirect_url: redirectUrl || "/",
      };
    },

    logoutServerOnly(redirectUrl = "/") {
      return request("/auth.php?action=logout", {
        method: "POST",
        body: {
          redirect_url: redirectUrl,
        },
      });
    },
  },

  inquiries: {
    async list(status) {
      const params = new URLSearchParams({
        action: "list",
      });

      if (status) {
        params.set("status", status);
      }

      return asArray(
        await request(`/inquiries.php?${params.toString()}`)
      );
    },

    async mine(tokens = []) {
      return asArray(
        await request("/inquiries.php?action=mine", {
          method: "POST",
          body: { tokens },
        })
      );
    },

    async create(data) {
      return request("/inquiries.php?action=create", {
        method: "POST",
        body: data,
      });
    },

    async thread(id, token) {
      return request("/inquiries.php?action=thread", {
        method: "POST",
        body: { id, token },
      });
    },

    async reply(id, data) {
      return request(
        `/inquiries.php?action=reply&id=${encodeURIComponent(id)}`,
        {
          method: "POST",
          body: data,
        }
      );
    },

    async updateStatus(id, status) {
      return request(
        `/inquiries.php?action=status&id=${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: { status },
        }
      );
    },

    async archive(id) {
      return request(
        `/inquiries.php?action=archive&id=${encodeURIComponent(id)}`,
        {
          method: "PATCH",
        }
      );
    },
  },

  entities: {
    ActivityLog: createEntityHandler("ActivityLog"),
    Booking: createEntityHandler("Booking"),
    LegalDocument: createEntityHandler("LegalDocument"),
    FoundItem: createEntityHandler("FoundItem"),
    LostItemReport: createEntityHandler("LostItemReport"),
    Package: createEntityHandler("Package"),
    PaymentQrCode: createEntityHandler("PaymentQrCode"),
    ResortRule: createEntityHandler("ResortRule"),
    SiteSetting: createEntityHandler("SiteSetting"),
    UpcomingSchedule: createEntityHandler("UpcomingSchedule"),
    User: createEntityHandler("User"),
    Review: createEntityHandler("Review"),
    Notification: createEntityHandler("Notification"),
    Payment: createEntityHandler("Payment"),
  },

  integrations: {
    Core: {
      async UploadFile({ file, purpose }) {
        const formData = new FormData();

        formData.append("file", file);

        if (purpose) {
          formData.append("purpose", purpose);
        }

        return request(
          "/integrations.php?action=upload-file",
          {
            method: "POST",
            body: formData,
            timeoutMs: 60000,
          }
        );
      },

      async SendEmail(payload) {
        return request(
          "/integrations.php?action=send-email",
          {
            method: "POST",
            body: payload,
          }
        );
      },

      async InvokeLLM({ prompt }) {
        const response = await request(
          "/integrations.php?action=invoke-llm",
          {
            method: "POST",
            body: { prompt },
          }
        );

        return response.response;
      },
    },
  },
};
