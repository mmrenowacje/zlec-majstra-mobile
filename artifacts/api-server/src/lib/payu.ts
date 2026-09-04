import { createHash, timingSafeEqual } from "node:crypto";

const DEFAULT_PAYU_BASE_URL = "https://secure.payu.com";
const DEFAULT_PAYU_SANDBOX_BASE_URL = "https://secure.snd.payu.com";

export type PayuPlatform = "web" | "mobile";

export type PayuOrderInput = {
  extOrderId: string;
  customerIp: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  continueUrl: string;
  notifyUrl: string;
  totalAmount: number;
  description: string;
};

export type PayuOrderResponse = {
  orderId: string;
  redirectUri: string;
  status?: { statusCode?: string; statusDesc?: string };
};

function requiredSecret(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Brak wymaganej konfiguracji PayU: ${name}`);
  return value;
}

function isSandbox(): boolean {
  const environment = process.env.PAYU_ENVIRONMENT ?? "production";
  if (environment !== "production" && environment !== "sandbox") {
    throw new Error(`Nieobsługiwane środowisko PayU: ${environment}`);
  }
  return environment === "sandbox";
}

function payuConfig() {
  const sandbox = isSandbox();
  const prefix = sandbox ? "PAYU_SANDBOX" : "PAYU";
  const configuredBaseUrl =
    process.env[`${prefix}_API_BASE_URL`] ??
    (sandbox ? DEFAULT_PAYU_SANDBOX_BASE_URL : DEFAULT_PAYU_BASE_URL);
  const parsedBaseUrl = new URL(configuredBaseUrl);
  if (sandbox && parsedBaseUrl.hostname !== "secure.snd.payu.com") {
    throw new Error(
      "Test PayU może łączyć się wyłącznie z secure.snd.payu.com",
    );
  }
  return {
    baseUrl: configuredBaseUrl.replace(/\/$/, ""),
    clientId: requiredSecret(`${prefix}_CLIENT_ID`),
    clientSecret: requiredSecret(`${prefix}_CLIENT_SECRET`),
    posId: requiredSecret(`${prefix}_POS_ID`),
    md5Key: requiredSecret(`${prefix}_MD5_KEY`),
  };
}

function payuMd5Key(): string {
  const prefix = isSandbox() ? "PAYU_SANDBOX" : "PAYU";
  return requiredSecret(`${prefix}_MD5_KEY`);
}

async function getAccessToken(): Promise<string> {
  const config = payuConfig();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const response = await fetch(
    `${config.baseUrl}/pl/standard/user/oauth/authorize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  const payload = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(
      `PayU OAuth odrzucił żądanie: ${payload.error_description ?? payload.error ?? response.status}`,
    );
  }
  return payload.access_token;
}

export async function createPayuOrder(
  input: PayuOrderInput,
): Promise<PayuOrderResponse> {
  const config = payuConfig();
  const token = await getAccessToken();
  const response = await fetch(`${config.baseUrl}/api/v2_1/orders`, {
    method: "POST",
    redirect: "manual",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      notifyUrl: input.notifyUrl,
      continueUrl: input.continueUrl,
      customerIp: input.customerIp,
      merchantPosId: config.posId,
      description: input.description,
      currencyCode: "PLN",
      totalAmount: String(input.totalAmount),
      extOrderId: input.extOrderId,
      buyer: {
        email: input.email,
        phone: input.phone,
        firstName: input.firstName,
        lastName: input.lastName,
        language: "pl",
      },
      products: [
        {
          name: input.description,
          unitPrice: String(input.totalAmount),
          quantity: "1",
        },
      ],
      ...(isSandbox() && process.env.PAYU_SANDBOX_E2E === "true"
        ? {
            payMethods: {
              payMethod: {
                type: "PBL",
                value: "blik",
              },
            },
          }
        : {}),
    }),
  });

  const responseText = await response.text();
  let payload: Partial<PayuOrderResponse> = {};
  if (responseText) {
    try {
      payload = JSON.parse(responseText) as Partial<PayuOrderResponse>;
    } catch {
      payload = {};
    }
  }
  const redirectUri = payload.redirectUri ?? response.headers.get("location") ?? "";
  if (
    ![200, 201, 302].includes(response.status) ||
    !payload.orderId ||
    !redirectUri
  ) {
    throw new Error(
      `PayU nie utworzył zamówienia: ${payload.status?.statusDesc ?? response.status}`,
    );
  }
  return { orderId: payload.orderId, redirectUri, status: payload.status };
}

export function verifyPayuNotification(
  rawBody: Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader || rawBody.length === 0) return false;
  const parts = Object.fromEntries(
    signatureHeader
      .split(";")
      .map((part) => part.trim().split("=", 2))
      .filter(([key, value]) => Boolean(key && value)),
  );
  if (parts.algorithm?.toUpperCase() !== "MD5" || !parts.signature) return false;

  const expected = createHash("md5")
    .update(rawBody)
    .update(payuMd5Key())
    .digest("hex");
  const received = parts.signature.toLowerCase();
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export function payuContinueUrl(
  platform: PayuPlatform,
  extOrderId: string,
  publicUrl: string,
): string {
  if (platform === "mobile") {
    return `zlemajstra://billing?payment=return&order=${encodeURIComponent(extOrderId)}`;
  }
  return `${publicUrl.replace(/\/$/, "")}/billing?payment=return&order=${encodeURIComponent(extOrderId)}`;
}
