"use client";

import { ArrowLeft, Check, CircleAlert, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import LifeLedgerMark from "@/components/lifeledger-mark";

type PaymentStatusProps = { orderId: string; proof: string; cancelled: boolean };

export default function PaymentStatus({ orderId, proof, cancelled }: PaymentStatusProps) {
  const [status, setStatus] = useState(
    cancelled ? "cancelled" : !orderId || !proof ? "invalid" : "checking",
  );

  useEffect(() => {
    if (cancelled || !orderId || !proof) return;

    let active = true;
    fetch("/api/paypal/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, proof }),
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Payment could not be confirmed.");
        if (active) setStatus("paid");
      })
      .catch(() => {
        if (active) setStatus("failed");
      });

    return () => {
      active = false;
    };
  }, [cancelled, orderId, proof]);

  const paid = status === "paid";
  const waiting = status === "checking";
  const cancelledPayment = status === "cancelled";
  return (
    <main className="payment-result-page">
      <Link className="brand" href="/">
        <LifeLedgerMark />
        <span>Life<span className="brand-light">Ledger</span></span>
      </Link>
      <section className="payment-result-panel">
        <span className={`payment-result-icon ${paid ? "result-paid" : ""}`}>
          {waiting ? <LoaderCircle size={22} className="result-spinner" /> : paid ? <Check size={24} /> : <CircleAlert size={22} />}
        </span>
        <span className="eyebrow">PAYPAL CHECKOUT</span>
        <h1>{waiting ? "Confirming your payment" : paid ? "Payment received." : cancelledPayment ? "Checkout cancelled." : "Payment not confirmed."}</h1>
        <p>
          {waiting
            ? "We’re verifying the ₱250 payment with PayPal. This usually takes a few seconds."
            : paid
              ? "Your ₱250 ad submission is paid and awaiting review. It will not appear publicly until approved."
              : cancelledPayment
                ? "No payment was taken. Your ad submission was not completed."
                : "We couldn’t verify this PayPal payment. No ad has been published."}
        </p>
        <Link className="payment-return-link" href="/"><ArrowLeft size={15} /> Return to LifeLedger</Link>
      </section>
    </main>
  );
}