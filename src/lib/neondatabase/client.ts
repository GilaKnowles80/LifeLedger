"use client";

import { signIn, signOut } from "next-auth/react";

/**
 * Initiates an Auth.js OAuth sign-in flow from a client component.
 * @param provider The ID of the provider (e.g., 'github', 'google')
 */
export async function handleSignIn(provider: string) {
  await signIn(provider, { redirectTo: "/dashboard" });
}

/**
 * Logs the user out completely from the client side.
 */
export async function handleSignOut() {
  await signOut({ redirectTo: "/" });
}