import { NextResponse } from "next/server";
import { createAd, updateAd } from "@/lib/ad-store";
import { createAdPaymentProof, hasPaypalConfiguration, paypalRequest } from "@/lib/paypal";

const categories = [
  "Product advertisement",
  "Company advertisement",
  "Marketplace listing",
];

const regions = [
  "Worldwide",
  "Philippines",
  "North America",
  "Europe",
  "Asia Pacific",
  "Africa",
  "Latin America",
];

type PaypalOrder = { id: string; links: { href: string; rel: string }[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(
  body: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | null {
  const value = body[key];
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const companyName = readText(body, "companyName", 100);
  const contactEmail = readText(body, "contactEmail", 254);
  const title = readText(body, "title", 120);
  const description = readText(body, "description", 1000);
  const websiteValue = body.website;
  const website = typeof websiteValue === "string" ? websiteValue.trim() : "";
  const category = body.category;
  const region = body.region;

  if (!companyName || !contactEmail || !title || !description) {
    return NextResponse.json(
      { error: "Name, contact email, headline, and description are required." },
      { status: 400 },
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return NextResponse.json({ error: "Enter a valid contact email." }, { status: 400 });
  }

  if (website && (website.length > 300 || !/^https?:\/\//i.test(website))) {
    return NextResponse.json(
      { error: "Website must be a valid http or https URL." },
      { status: 400 },
    );
  }

  if (typeof category !== "string" || !categories.includes(category)) {
    return NextResponse.json({ error: "Choose a valid advertisement type." }, { status: 400 });
  }

  if (typeof region !== "string" || !regions.includes(region)) {
    return NextResponse.json({ error: "Choose a valid audience region." }, { status: 400 });
  }

  if (!hasPaypalConfiguration()) {
    return NextResponse.json({ error: "PayPal checkout is not configured. Add the server credentials to .env.local." }, { status: 503 });
  }

  const appUrl = (process.env.PAYPAL_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  const ad = {
    id: `LL-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
    companyName,
    contactEmail,
    title,
    description,
    website: website || null,
    category: category as string,
    region: region as string,
    amount: "250.00" as const,
    currency: "PHP" as const,
    status: "pending_payment" as const,
    paymentStatus: "pending" as const,
    paypalOrderId: null as string | null,
    paypalCaptureId: null as string | null,
    createdAt: new Date().toISOString(),
    paidAt: null as string | null,
  };

  try {
    await createAd(ad);
    const proof = createAdPaymentProof(ad.id);
    const order = await paypalRequest<PaypalOrder>("/v2/checkout/orders", {
      method: "POST",
      body: {
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: ad.id,
          custom_id: ad.id,
          description: `${category}: ${title}`.slice(0, 127),
          amount: { currency_code: "PHP", value: ad.amount },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "LifeLedger",
              user_action: "PAY_NOW",
              shipping_preference: "NO_SHIPPING",
              return_url: `${appUrl}/ads/complete?proof=${encodeURIComponent(proof)}`,
              cancel_url: `${appUrl}/?adPayment=cancelled`,
            },
          },
        },
      },
    });
    const checkoutUrl = order.links.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href;
    if (!order.id || !checkoutUrl) throw new Error("PayPal did not return an approval link.");

    await updateAd(ad.id, { paypalOrderId: order.id });
    return NextResponse.json({ adId: ad.id, orderId: order.id, checkoutUrl }, { status: 201 });
  } catch (error) {
    await updateAd(ad.id, { status: "checkout_failed", paymentStatus: "failed" }).catch(() => {});
    console.error("Unable to create PayPal checkout order:", error);
    return NextResponse.json({ error: "Unable to start PayPal checkout. Please try again." }, { status: 502 });
  }
}