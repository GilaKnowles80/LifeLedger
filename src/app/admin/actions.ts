"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/neondatabase/admin";
import { auth } from "@/auth";

const entityTypes = ["post", "comment", "advertisement", "report"] as const;
const decisions = ["approve", "reject", "remove", "resolve", "dismiss"] as const;

export async function moderateContent(formData: FormData) {
  const entityType = String(formData.get("entityType") || "");
  const entityId = String(formData.get("entityId") || "");
  const decision = String(formData.get("decision") || "");
  const moderationNote = String(formData.get("moderationNote") || "").trim().slice(0, 1000);

  if (!entityTypes.includes(entityType as (typeof entityTypes)[number]) || !decisions.includes(decision as (typeof decisions)[number]) || !entityId) {
    redirect("/admin?error=invalid");
  }

  const session = await auth();
  if (!session || !session.user) {
    redirect("/register/login");
  }
  if (!(session.user as { is_admin: boolean }).is_admin) {
    redirect("/account?error=admin");
  }

  // Verify admin status via Neon
  const adminRows = await sql`
    SELECT is_admin FROM user_security WHERE email = ${session.user.email} LIMIT 1
  `;
  if (adminRows.length === 0 || adminRows[0].is_admin !== true) {
    redirect("/register/login?error=admin");
  }

  // Record moderation action in Neon
  await sql`
    INSERT INTO moderation_actions (entity_type, entity_id, decision, moderation_note, moderator_email, created_at)
    VALUES (${entityType}, ${entityId}, ${decision}, ${moderationNote || null}, ${session.user.email}, NOW())
  `;

  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin?notice=reviewed");
}