import { NextResponse } from "next/server";
import { isProjectConfigured } from "@/lib/neondatabase/config";
import { getVerifiedUser } from "@/lib/neondatabase/authorization";
import { sql } from "@/lib/neondatabase/admin";

const entityTypes = ["post", "comment", "profile", "advertisement"];
const reasons = ["spam", "harassment", "threats", "hate", "fraud", "sexual_content", "violence", "self_harm", "impersonation", "other"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  if (!isProjectConfigured()) return NextResponse.json({ error: "Reporting is not configured." }, { status: 503 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!isRecord(body) || typeof body.entityType !== "string" || !entityTypes.includes(body.entityType) || typeof body.entityId !== "string" || typeof body.reason !== "string" || !reasons.includes(body.reason)) {
    return NextResponse.json({ error: "Choose a valid item and report reason." }, { status: 400 });
  }
  const details = typeof body.details === "string" ? body.details.trim() : "";
  if (details.length > 1000) return NextResponse.json({ error: "Report details are limited to 1000 characters." }, { status: 400 });

  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Verify your account before submitting a report." }, { status: 401 });

  const result = await sql`
    INSERT INTO ll_reports (reporter_id, entity_type, entity_id, reason, details)
    VALUES (${user.id}, ${body.entityType}, ${body.entityId}, ${body.reason}, ${details})
    RETURNING id
  `;
  if (result.length === 0) return NextResponse.json({ error: "Report could not be submitted." }, { status: 503 });
  return NextResponse.json({ id: result[0].id, status: "open" }, { status: 201 });
}