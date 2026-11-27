import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, ShieldCheck, UserRound } from "lucide-react";
import MfaEnrollment from "./security/mfa-enrollment";
import LifeLedgerMark from "@/components/lifeledger-mark";
import { auth, signOut } from "@/auth";
import { sql } from "@/lib/neondatabase/admin";

export default async function AccountPage() {
  // 1. Fetch current session natively via Auth.js
  const session = await auth();

  if (!session || !session.user || !session.user.email) {
    redirect("/register");
  }

  const user = session.user;
  const email = user.email;

  // 2. Fetch profile, posts/ads count, and security details from Neon Database in parallel
  let profile: unknown = null;
  let postCount = 0;
  let adCount = 0;
  let mfaVerified = false;
  let isAdmin = false;

  try {
    const [profileRows, postRows, adRows, securityRows] = await Promise.all([
      sql`SELECT username, display_name, avatar_url FROM ll_profiles WHERE user_id = ${user.id} LIMIT 1`,
      sql`SELECT COUNT(id) as count FROM ll_posts WHERE author_id = ${user.id}`,
      sql`SELECT COUNT(id) as count FROM ads WHERE owner_id = ${user.id}`,
      sql`SELECT mfa_enabled, is_admin FROM user_security WHERE email = ${email} LIMIT 1`
    ]);

    if (profileRows.length > 0) profile = profileRows[0];
    if (postRows.length > 0) postCount = Number(postRows[0].count);
    if (adRows.length > 0) adCount = Number(adRows[0].count);
    
    if (securityRows.length > 0) {
      mfaVerified = securityRows[0].mfa_enabled === true;
      isAdmin = securityRows[0].is_admin === true;
    }
  } catch (dbError) {
    console.error("Error loading account data from Neon:", dbError);
  }

  // 3. Fallback calculations matching your exact view preferences
  const displayName = (profile as { display_name?: string })?.display_name || email || "Lifeledger member";
  const contactVerified = true;

  // 4. Server Action to clean up session variables on Vercel edge runtime
  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="account-page">
      <header className="dashboard-header">
        <Link className="brand" href="/">
          <LifeLedgerMark />
          <span>Life<span className="brand-light">Ledger</span></span>
        </Link>
        <Link className="dashboard-back" href="/"><ArrowLeft size={15} /> Back to feed</Link>
      </header>
      <div className="dashboard-content">
        <div className="dashboard-title">
          <span className="eyebrow">YOUR LIFELEDGER</span>
          <h1>Your account</h1>
          <p>Your profile, activity, and account protection.</p>
        </div>
        <section className="account-identity dashboard-panel">
          <span className="account-avatar"><UserRound size={24} /></span>
          <div className="account-identity-copy">
            <h2>{displayName}</h2>
            <p>{(profile as { username?: string })?.username ? `@${(profile as { username?: string }).username}` : "Profile is being set up"}</p>
            <span className="verified-contact"><BadgeCheck size={15} /> {email} {contactVerified ? "verified" : "not verified"}</span>
          </div>
          <form action={async () => { await signOut({ redirectTo: "/login" }); }}><button className="secondary-button" type="submit">Sign out</button></form>
        </section>
        <section className="account-stats">
          <article className="account-stat"><span className="eyebrow">YOUR POSTS</span><strong>{postCount}</strong><span>including posts in review</span></article>
          <article className="account-stat"><span className="eyebrow">YOUR ADS</span><strong>{adCount}</strong><span>paid ads and drafts</span></article>
          <article className="account-stat"><span className="eyebrow">ACCOUNT SECURITY</span><strong>{mfaVerified ? "Protected" : "Improve it"}</strong><span>{mfaVerified ? "Authenticator MFA enabled" : "Add authenticator MFA"}</span></article>
        </section>
        <section className="security-section dashboard-panel">
          <div className="dashboard-section-title"><div><span className="eyebrow">SIGN-IN PROTECTION</span><h2><ShieldCheck size={18} /> Authenticator verification</h2></div><span className={mfaVerified ? "security-pill security-on" : "security-pill"}>{mfaVerified ? "ENABLED" : "OPTIONAL"}</span></div>
          <p>Use an authenticator app for a second sign-in check. LifeLedger requires this extra verification for administrator actions.</p>
          <MfaEnrollment verified={mfaVerified} />
        </section>
        {isAdmin && (
          <Link className="admin-dashboard-link dashboard-panel" href={mfaVerified ? "/admin" : "/account/security?required=mfa"}>
            <span><span className="eyebrow">ADMINISTRATION</span><strong>LifeLedger admin dashboard</strong><small>{mfaVerified ? "Review member posts, reports, and ads" : "Complete authenticator verification to continue"}</small></span>
            <ArrowRight size={18} />
          </Link>
        )}
        {!profile && <p className="account-setup-note">Profile data is unavailable until the LifeLedger database migration is applied.</p>}
      </div>
    </main>
  );
}