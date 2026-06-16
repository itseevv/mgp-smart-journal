export type AdminAppBaseUrlResolution = {
  baseUrl: string;
  configured: boolean;
  warning?: string;
};

export class AppBaseUrlError extends Error {
  code: "APP_BASE_URL_REQUIRED" | "APP_BASE_URL_INVALID";

  constructor(code: AppBaseUrlError["code"], message: string) {
    super(message);
    this.name = "AppBaseUrlError";
    this.code = code;
  }
}

export function capsulePath(publicToken: string) {
  return `/c/${publicToken}`;
}

export function capsuleUrl(baseUrl: string, publicToken: string) {
  return `${baseUrl.replace(/\/$/, "")}${capsulePath(publicToken)}`;
}

export function normalizeAppBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  const parsed = new URL(trimmed);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppBaseUrlError(
      "APP_BASE_URL_INVALID",
      "APP_BASE_URL must be an absolute http(s) URL.",
    );
  }

  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new AppBaseUrlError(
      "APP_BASE_URL_INVALID",
      "APP_BASE_URL must include only the origin, for example https://yourbrand.com.",
    );
  }

  return parsed.origin;
}

export function resolveAdminAppBaseUrl(input: {
  appBaseUrl?: string;
  requestOrigin: string;
  nodeEnv?: string;
}): AdminAppBaseUrlResolution {
  if (input.appBaseUrl?.trim()) {
    return {
      baseUrl: normalizeAppBaseUrl(input.appBaseUrl),
      configured: true,
    };
  }

  if (input.nodeEnv === "production") {
    throw new AppBaseUrlError(
      "APP_BASE_URL_REQUIRED",
      "APP_BASE_URL is required before generating production QR, NFC, or fulfilment export URLs.",
    );
  }

  return {
    baseUrl: normalizeAppBaseUrl(input.requestOrigin),
    configured: false,
    warning:
      "APP_BASE_URL is not configured. Admin QR/NFC URLs are using the current development origin and may be localhost-only.",
  };
}

export function resolveAdminAppBaseUrlFromRequest(request: Request) {
  return resolveAdminAppBaseUrl({
    appBaseUrl: process.env.APP_BASE_URL,
    requestOrigin: new URL(request.url).origin,
    nodeEnv: process.env.NODE_ENV,
  });
}
