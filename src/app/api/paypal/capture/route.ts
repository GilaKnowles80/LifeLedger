import { NextResponse } from "next/server";
import { getAd, updateAd } from "@/lib/ad-store";
import { hasPaypalConfiguration, paypalRequest, verifyAdPaymentProof } from "@/lib/paypal";

type PaypalAmount = { currency_code: string; value: string };
type PaypalCapture = { id: string; status: string; amount: PaypalAmount };
type PaypalPurchaseUnit = {
  custom_id?: string;
  reference_id?: string;
  amount?: PaypalAmount;
  payments?: { captures?: PaypalCapture[] };
};
type PaypalOrder = { id: string; status: string; purchase_units?: PaypalPurchaseUnit[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExpectedAmount(amount?: PaypalAmount) {
  return amount?.currency_code === "PHP" && amount.value === "250.00";
}

function getMatchingUnit(order: PaypalOrder, adId: string) {
  return order.purchase_units?.find((unit) => unit.custom_id === adId && unit.reference_id === adId);
}

export async function POST(request: Request) {
  if (!hasPaypalConfiguration()) {
    return NextResponse.json({ error: "PayPal is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!isRecord(body) || typeof body.orderId !== "string" || typeof body.proof !== "string") {
    return NextResponse.json({ error: "A PayPal order and payment proof are required." }, { status: 400 });
  }

  const [adId] = body.proof.split(".");
  try {
    if (!adId || !verifyAdPaymentProof(body.proof, adId)) {
      return NextResponse.json({ error: "Payment confirmation could not be verified." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Payment confirmation could not be verified." }, { status: 400 });
  }

  const ad = await getAd(adId);
  if (!ad || ad.paypalOrderId !== body.orderId) {
    return NextResponse.json({ error: "The PayPal order does not match this advertisement." }, { status: 404 });
  }

  try {
    const order = await paypalRequest<PaypalOrder>(`/v2/checkout/orders/${encodeURIComponent(body.orderId)}`);
    const unit = getMatchingUnit(order, ad.id);
    if (!unit || !hasExpectedAmount(unit.amount)) {
      return NextResponse.json({ error: "The PayPal order amount could not be verified." }, { status: 409 });
    }

    let captureId = ad.paypalCaptureId;
    if (order.status !== "COMPLETED") {
      if (order.status !== "APPROVED") {
        return NextResponse.json({ error: "PayPal has not approved this payment yet." }, { status: 409 });
      }
      const captured = await paypalRequest<PaypalOrder>(
        `/v2/checkout/orders/${encodeURIComponent(body.orderId)}/capture`,
        { method: "POST", body: {}, headers: { "PayPal-Request-Id": `capture-${ad.id}` } },
      );
      const capturedUnit = getMatchingUnit(captured, ad.id);
      const capture = capturedUnit?.payments?.captures?.find(
        (item) => item.status === "COMPLETED" && hasExpectedAmount(item.amount),
      );
      if (captured.status !== "COMPLETED" || !capture) {
        return NextResponse.json({ error: "PayPal did not confirm the ₱250 payment." }, { status: 409 });
      }
      captureId = capture.id;
    } else if (!captureId) {
      captureId = unit.payments?.captures?.find(
        (item) => item.status === "COMPLETED" && hasExpectedAmount(item.amount),
      )?.id || null;
    }

    if (!captureId) {
      return NextResponse.json({ error: "PayPal did not return a completed capture." }, { status: 409 });
    }
    await updateAd(ad.id, {
      status: "awaiting_review",
      paymentStatus: "paid",
      paypalCaptureId: captureId,
      paidAt: new Date().toISOString(),
    });
    return NextResponse.json({ status: "paid", adStatus: "awaiting_review", captureId });
  } catch (error) {
    console.error("Unable to capture PayPal order:", error);
    return NextResponse.json({ error: "Unable to verify PayPal payment." }, { status: 502 });
  }
}