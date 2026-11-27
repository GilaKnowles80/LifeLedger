"use client";

import React, { useState } from "react";
import Image from "next/image";
import { KeyRound, LoaderCircle } from "lucide-react";
import { generateMfaSecretAction, verifyAndSaveMfaAction } from "../actions"; // Your Server Actions

interface MfaEnrollmentProps {
  verified: boolean;
}

export default function MfaEnrollment({ verified }: MfaEnrollmentProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function beginEnrollment() {
    setBusy(true);
    setError("");
    try {
      // 1. Call server action to generate a secret and get a QR code from Neon context
      const response = await generateMfaSecretAction();
      if (response.error) throw new Error(response.error);
      
      setQrCodeUrl(response.qrCodeUrl || "");
      setMessage("Scan this QR code in your authenticator app, then enter the 6-digit token.");
    } catch (err: unknown) {
      setError((err as Error).message || "Could not start authentication setup.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      // 2. Pass code to server action to securely verify and store it in Neon
      const success = await verifyAndSaveMfaAction(code);
      if (!success) throw new Error("Invalid verification code.");
      
      setMessage("MFA Enrolled successfully!");
    } catch (err: unknown) {
      setError((err as Error).message || "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <KeyRound className="w-5 h-5" /> Two-Factor Authentication
      </h2>
      
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {message && <p className="text-green-600 text-sm">{message}</p>}

      {!qrCodeUrl && !verified && (
        <button
          onClick={beginEnrollment}
          disabled={busy}
          className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50 flex justify-center items-center gap-2"
        >
          {busy && <LoaderCircle className="animate-spin w-4 h-4" />}
          Enable MFA
        </button>
      )}

      {qrCodeUrl && (
        <form onSubmit={verifyCode} className="space-y-4">
          <div className="flex justify-center bg-gray-100 p-4 rounded">
            <Image src={qrCodeUrl} alt="MFA QR Code" width={200} height={200} />
          </div>
          <input
            type="text"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full p-2 border rounded text-center tracking-widest text-lg"
            maxLength={6}
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-green-600 text-white py-2 rounded disabled:opacity-50"
          >
            Verify & Save
          </button>
        </form>
      )}
    </div>
  );
}