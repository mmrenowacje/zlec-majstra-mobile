import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();

export async function stripeRequest<T>(
  path: string,
  body?: URLSearchParams,
): Promise<T> {
  const response = await connectors.proxy("stripe", path, {
    method: body ? "POST" : "GET",
    body,
    headers: body
      ? { "Content-Type": "application/x-www-form-urlencoded" }
      : undefined,
  });
  const payload = (await response.json()) as T & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Stripe: ${response.status}`);
  }
  return payload;
}