import { NextResponse } from "next/server";
import { isProjectConfigured } from "@/lib/neondatabase/config";
import { getVerifiedUser } from "@/lib/neondatabase/authorization";
import { sql } from "@/lib/neondatabase/admin";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    if (!isProjectConfigured()) return jsonError("Community data is not configured.", 503);
    const data = await sql`SELECT * FROM ll_get_feed()`;
    return NextResponse.json({ posts: data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Feed GET error:", error);
    return jsonError("The community feed is temporarily unavailable.", 503);
  }
}

export async function POST(request: Request) {
  if (!isProjectConfigured()) return jsonError("Community posting is not configured.", 503);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }
  if (typeof body !== "object" || body === null || !("body" in body) || typeof body.body !== "string") {
    return jsonError("Post text is required.", 400);
  }
  const text = body.body.trim();
  if (text.length < 1 || text.length > 5000) return jsonError("Posts must be 1 to 5000 characters.", 400);

  const user = await getVerifiedUser();
  if (!user) return jsonError("Verify your email or mobile number before posting.", 401);

  const result = await sql`
    INSERT INTO ll_posts (author_id, body)
    VALUES (${user.id}, ${text})
    RETURNING id, status
  `;
  if (result.length === 0) {
    return jsonError("Post could not be submitted.", 503);
  }
  return NextResponse.json({ id: result[0].id, status: result[0].status }, { status: 201, headers: { "Cache-Control": "no-store" } });
}