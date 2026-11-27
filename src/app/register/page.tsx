"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { isAppConfigured } from "@/lib/neondatabase/config";
import LifeLedgerMark from "@/components/lifeledger-mark";

export default function RegisterPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const productionCaptchaReady = true;
  const configured = isAppConfigured();

  async function handleSignIn() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await signIn("google", { callbackUrl: "/account" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="payment-result-page login-page">
      <Link className="brand" href="/">
        <LifeLedgerMark />
        <span>Life<span className="brand-light">Ledger</span></span>
      </Link>
      <section className="payment-result-panel login-panel auth-panel">
        <span className="payment-result-icon result-paid"><ShieldCheck size={22} /></span>
        <span className="eyebrow">SECURE LIFELEDGER ACCOUNT</span>
        <h1>Sign in or join.</h1>
        <p>Verify your email or mobile number each time. LifeLedger will never ask you to share a sign-in code.</p>

        {!configured ? (
          <div className="login-config-note">LifeLedger is not configured. Add the required environment variables to the deployment environment.</div>
        ) : !productionCaptchaReady ? (
          <div className="login-config-note">Turnstile is required for production sign-in. Configure `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.</div>
        ) : (
          <>
            <button className="ad-submit-button" type="button" disabled={busy} onClick={handleSignIn}>
              {busy ? "Signing in..." : <>Sign in with Google <ArrowRight size={16} /></>}
            </button>
            {error && <p className="auth-message auth-error" role="alert">{error}</p>}
            {message && <p className="auth-message" role="status">{message}</p>}
          </>
        )}
        <Link className="payment-return-link" href="/"><ArrowLeft size={15} /> Back to LifeLedger</Link>
      </section>
    </main>
  );
}