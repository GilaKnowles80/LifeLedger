import { createHmac, timingSafeEqual } from "node:crypto";

type PaypalRequestOptions = { method?: "GET" | "POST"; body?: unknown; headers?: HeadersInit };

function getPaypalBaseUrl() {
  return process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function getPaypalCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PayPal server credentials are missing.");
  return { clientId, clientSecret };
}

export function hasPaypalConfiguration() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

async function getPaypalAccessToken() {
  const { clientId, clientSecret } = getPaypalCredentials();
  const response = await fetch(`${getPaypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`PayPal authentication failed with status ${response.status}.`);
  const result = (await response.json()) as { access_token: string };
  return result.access_token;
}

export async function paypalRequest<T>(endpoint: string, options: PaypalRequestOptions = {}): Promise<T> {
  const accessToken = await getPaypalAccessToken();
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(`${getPaypalBaseUrl()}${endpoint}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`PayPal request failed with status ${response.status}.`);
  return (await response.json()) as T;
}

export function createAdPaymentProof(adId: string) {
  const expiresAt = Date.now() + 30 * 60 * 1000;
  const payload = `${adId}.${expiresAt}`;
  const signature = createHmac("sha256", getPaypalCredentials().clientSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAdPaymentProof(proof: string, adId: string) {
  const [proofAdId, expiryText, signature, extra] = proof.split(".");
  if (!proofAdId || !expiryText || !signature || extra || proofAdId !== adId) return false;
  const expiresAt = Number(expiryText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < Date.now()) return false;
  const expected = createHmac("sha256", getPaypalCredentials().clientSecret)
    .update(`${proofAdId}.${expiryText}`)
    .digest();
  const received = Buffer.from(signature, "base64url");
  return received.length === expected.length && timingSafeEqual(received, expected);
}