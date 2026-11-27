import { NextResponse } from "next/server";
import { isProjectConfigured } from "@/lib/neondatabase/config";
import { getVerifiedUser } from "@/lib/neondatabase/authorization";
import { sql } from "@/lib/neondatabase/admin";

type RouteContext = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requestContext(context: RouteContext) {
  if (!isProjectConfigured()) return { response: NextResponse.json({ error: "Reactions are not configured." }, { status: 503 }) };
  const { id: postId } = await context.params;
  if (!uuidPattern.test(postId)) return { response: NextResponse.json({ error: "Post was not found." }, { status: 404 }) };
  const user = await getVerifiedUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in with a verified account to appreciate posts." }, { status: 401 }) };
  return { postId, user };
}

export async function POST(_request: Request, context: RouteContext) {
  const result = await requestContext(context);
  if ("response" in result) return result.response;
  await sql`
    INSERT INTO ll_reactions (post_id, user_id)
    VALUES (${result.postId}, ${result.user.id})
    ON CONFLICT (post_id, user_id) DO NOTHING
  `;
  return NextResponse.json({ appreciated: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const result = await requestContext(context);
  if ("response" in result) return result.response;
  await sql`
    DELETE FROM ll_reactions
    WHERE post_id = ${result.postId} AND user_id = ${result.user.id}
  `;
  return NextResponse.json({ appreciated: false });
}