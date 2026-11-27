import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

/**
 * Auth.js middleware wrapper.
 * This automatically decodes sessions and manages security cookies on Vercel.
 */
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { nextUrl } = req;

  // Define public routes that don't require authentication
  const isPublicRoute = 
    nextUrl.pathname === "/" || 
    nextUrl.pathname.startsWith("/login") || 
    nextUrl.pathname.startsWith("/register") ||
    nextUrl.pathname.startsWith("/api/") ||
    nextUrl.pathname.startsWith("/ads/complete");

  // If the user is not logged in and tries to access a protected route, redirect to login
  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  return NextResponse.next();
});

/**
 * Next.js Middleware Configuration
 * This ensures the authentication check runs on all application paths
 * except for static assets, optimization files, and images.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};