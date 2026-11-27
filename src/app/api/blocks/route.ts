import { NextResponse } from "next/server";
import { isProjectConfigured } from "@/lib/neondatabase/config";
import { getVerifiedUser } from "@/lib/neondatabase/authorization";
import { sql } from "@/lib/neondatabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!isProjectConfigured()) return NextResponse.json({ error: "Blocking is not configured." }, { status: 503 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || !("userId" in body) || typeof body.userId !== "string" || !uuidPattern.test(body.userId)) {
    return NextResponse.json({ error: "Choose a valid member to block." }, { status: 400 });
  }

  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Sign in with a verified account to block members." }, { status: 401 });
  if (body.userId === user.id) return NextResponse.json({ error: "You cannot block your own account." }, { status: 400 });

  await sql`
    INSERT INTO ll_blocks (blocker_id, blocked_user_id)
    VALUES (${user.id}, ${body.userId})
    ON CONFLICT (blocker_id, blocked_user_id) DO NOTHING
  `;
  return NextResponse.json({ blocked: true });
}

export async function DELETE(request: Request) {
  if (!isProjectConfigured()) return NextResponse.json({ error: "Blocking is not configured." }, { status: 503 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || !("userId" in body) || typeof body.userId !== "string" || !uuidPattern.test(body.userId)) {
    return NextResponse.json({ error: "Choose a valid member to unblock." }, { status: 400 });
  }

  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Sign in with a verified account to manage blocks." }, { status: 401 });
  await sql`
    DELETE FROM ll_blocks
    WHERE blocker_id = ${user.id} AND blocked_user_id = ${body.userId}
  `;
  return NextResponse.json({ blocked: false });
}