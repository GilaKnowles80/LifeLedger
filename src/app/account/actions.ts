"use server";

import { auth } from "@/auth";
import { sql } from "@/lib/neondatabase/admin";
import { generateSecret, verifyToken } from "node-2fa";

interface ActionResponse {
  qrCodeUrl?: string;
  error?: string;
  success?: boolean;
}

/**
 * Step 1: Generates an MFA secret key and a QR code URL for the authenticator app.
 * Stores a temporary secret in the Neon Database until verified.
 */
export async function generateMfaSecretAction(): Promise<ActionResponse> {
  try {
    // 1. Authenticate the connection via Auth.js
    const session = await auth();
    if (!session || !session.user || !session.user.email) {
      return { error: "Unauthorized. Please log in to enable MFA." };
    }

    const email = session.user.email;

    // 2. Generate a secure TOTP secret key pair
    const mfaData = generateSecret({
      name: "Lifeledger",
      account: email,
    });

    // 3. Upsert a temporary record containing the unverified secret into Neon
    await sql`
      INSERT INTO user_security (email, temp_mfa_secret, mfa_enabled, updated_at)
      VALUES (${email}, ${mfaData.secret}, false, NOW())
      ON CONFLICT (email) DO UPDATE
      SET temp_mfa_secret = EXCLUDED.temp_mfa_secret, updated_at = NOW();
    `;

    // 4. Return the QR code visual generation details securely to the client UI
    return { qrCodeUrl: mfaData.qr };
  } catch (error) {
    console.error("MFA Generation Error:", error);
    return { error: "Failed to initialize secure multi-factor components." };
  }
}

/**
 * Step 2: Validates the 6-digit pin entered by the user.
 * Activates MFA permanently in the database if the token passes verification.
 */
export async function verifyAndSaveMfaAction(token: string): Promise<boolean> {
  try {
    // 1. Authenticate the request session
    const session = await auth();
    if (!session || !session.user || !session.user.email) {
      return false;
    }

    const email = session.user.email;

    // 2. Retrieve the temporary secret out of Neon for validation execution
    const rows = await sql`
      SELECT temp_mfa_secret FROM user_security WHERE email = ${email} LIMIT 1
    `;

    if (rows.length === 0 || !rows[0].temp_mfa_secret) {
      return false;
    }

    const tempSecret = rows[0].temp_mfa_secret;

    // 3. Verify the user-supplied 6-digit pin token against the secret
    const verification = verifyToken(tempSecret, token);

    // If the token matches (delta 0 means exact timing window)
    if (verification && verification.delta === 0) {
      // 4. Finalize activation: Promote temp_secret to active status and clear temp column
      await sql`
        UPDATE user_security
        SET mfa_secret = temp_mfa_secret,
            temp_mfa_secret = NULL,
            mfa_enabled = true,
            updated_at = NOW()
        WHERE email = ${email};
      `;
      return true;
    }

    return false;
  } catch (error) {
    console.error("MFA Verification Error:", error);
    return false;
  }
}