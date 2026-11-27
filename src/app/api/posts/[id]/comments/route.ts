import { NextResponse } from "next/server";
import { isProjectConfigured } from "@/lib/neondatabase/config";
import { getVerifiedUser } from "@/lib/neondatabase/authorization";
import { sql } from "@/lib/neondatabase/admin";

type RouteContext = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: RouteContext) {
  if (!isProjectConfigured()) return jsonError("Comments are not configured.", 503);
  const { id: postId } = await context.params;
  if (!uuidPattern.test(postId)) return jsonError("Post was not found.", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }
  if (typeof body !== "object" || body === null || !("body" in body) || typeof body.body !== "string") {
    return jsonError("Comment text is required.", 400);
  }
  const text = body.body.trim();
  if (text.length < 1 || text.length > 2000) return jsonError("Comments must be 1 to 2000 characters.", 400);

  const user = await getVerifiedUser();
  if (!user) return jsonError("Verify your email or mobile number before commenting.", 401);

  const result = await sql`
    INSERT INTO ll_comments (post_id, author_id, body)
    VALUES (${postId}, ${user.id}, ${text})
    RETURNING id, status
  `;
  if (result.length === 0) return jsonError("Comment could not be submitted.", 503);
  return NextResponse.json({ id: result[0].id, status: result[0].status }, { status: 201, headers: { "Cache-Control": "no-store" } });
}