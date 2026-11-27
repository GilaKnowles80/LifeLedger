import { NextResponse } from "next/server";
import { findAdByOrderId, updateAd } from "@/lib/ad-store";
import { hasPaypalConfiguration, paypalRequest } from "@/lib/paypal";

type PaypalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    amount?: { currency_code?: string; value?: string };
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId || !hasPaypalConfiguration()) {
    return NextResponse.json({ error: "PayPal webhook verification is not configured." }, { status: 503 });
  }

  let event: unknown;
  try {
    event = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!isRecord(event)) return NextResponse.json({ error: "Invalid PayPal event." }, { status: 400 });

  const headers = {
    auth_algo: request.headers.get("paypal-auth-algo"),
    cert_url: request.headers.get("paypal-cert-url"),
    transmission_id: request.headers.get("paypal-transmission-id"),
    transmission_sig: request.headers.get("paypal-transmission-sig"),
    transmission_time: request.headers.get("paypal-transmission-time"),
  };
  if (Object.values(headers).some((value) => !value)) {
    return NextResponse.json({ error: "PayPal signature headers are missing." }, { status: 400 });
  }

  try {
    const verification = await paypalRequest<{ verification_status: string }>(
      "/v1/notifications/verify-webhook-signature",
      { method: "POST", body: { ...headers, webhook_id: webhookId, webhook_event: event } },
    );
    if (verification.verification_status !== "SUCCESS") {
      return NextResponse.json({ error: "PayPal webhook signature is invalid." }, { status: 400 });
    }

    const paypalEvent = event as PaypalWebhookEvent;
    const resource = paypalEvent.resource;
    const orderId = resource?.supplementary_data?.related_ids?.order_id;
    if (orderId && resource?.amount?.currency_code === "PHP" && resource.amount.value === "250.00") {
      const ad = await findAdByOrderId(orderId);
      if (ad && paypalEvent.event_type === "PAYMENT.CAPTURE.COMPLETED") {
        await updateAd(ad.id, {
          status: "awaiting_review",
          paymentStatus: "paid",
          paypalCaptureId: resource.id || ad.paypalCaptureId,
          paidAt: new Date().toISOString(),
        });
      }
      if (ad && paypalEvent.event_type === "PAYMENT.CAPTURE.DENIED") {
        await updateAd(ad.id, { status: "payment_failed", paymentStatus: "failed" });
      }
    }

    return NextResponse.json({ received: true, eventId: paypalEvent.id || null });
  } catch (error) {
    console.error("Unable to verify PayPal webhook:", error);
    return NextResponse.json({ error: "Unable to verify PayPal webhook." }, { status: 502 });
  }
}