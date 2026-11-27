import { NextResponse } from "next/server";
import { isProjectConfigured } from "@/lib/neondatabase/config";
import { getVerifiedUser } from "@/lib/neondatabase/authorization";
import { sql } from "@/lib/neondatabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_request: Request, context: RouteContext) {
  if (!isProjectConfigured()) return jsonError("Community data is not configured.", 503);
  const { id: postId } = await context.params;
  if (!uuidPattern.test(postId)) return jsonError("Post was not found.", 404);

  const data = await sql`
    SELECT p.id, p.author_id, p.body, p.status, p.created_at,
           pr.username, pr.display_name, pr.avatar_url
    FROM ll_posts p
    LEFT JOIN ll_profiles pr ON pr.user_id = p.author_id
    WHERE p.id = ${postId}
    LIMIT 1
  `;

  if (data.length === 0) return jsonError("Post was not found.", 404);
  return NextResponse.json({ post: data[0] }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isProjectConfigured()) return jsonError("Community data is not configured.", 503);
  const { id: postId } = await context.params;
  if (!uuidPattern.test(postId)) return jsonError("Post was not found.", 404);

  const user = await getVerifiedUser();
  if (!user) return jsonError("Sign in with a verified account to edit posts.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const newBody = typeof body?.body === "string" ? body.body.trim() : "";
  if (newBody.length < 1 || newBody.length > 5000) {
    return jsonError("Post text must be 1 to 5000 characters.", 400);
  }

  const existing = await sql`
    SELECT id FROM ll_posts WHERE id = ${postId} AND author_id = ${user.id} LIMIT 1
  `;
  if (existing.length === 0) return jsonError("Post not found or you do not own it.", 404);

  const result = await sql`
    UPDATE ll_posts
    SET body = ${newBody}, updated_at = NOW()
    WHERE id = ${postId} AND author_id = ${user.id}
    RETURNING id, body, updated_at
  `;

  return NextResponse.json({ post: result[0] }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!isProjectConfigured()) return jsonError("Community data is not configured.", 503);
  const { id: postId } = await context.params;
  if (!uuidPattern.test(postId)) return jsonError("Post was not found.", 404);

  const user = await getVerifiedUser();
  if (!user) return jsonError("Sign in with a verified account to delete posts.", 401);

  const result = await sql`
    DELETE FROM ll_posts
    WHERE id = ${postId} AND author_id = ${user.id}
    RETURNING id
  `;

  if (result.length === 0) return jsonError("Post not found or you do not own it.", 404);
  return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
}