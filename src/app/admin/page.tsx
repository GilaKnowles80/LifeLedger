import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BadgeCheck, Check, ClipboardCheck, Flag, ShieldAlert } from "lucide-react";
import { moderateContent } from "./actions";
import { auth } from "@/auth";
import { sql } from "@/lib/neondatabase/admin";
import LifeLedgerMark from "@/components/lifeledger-mark";

type AdminPageProps = { searchParams: Promise<{ notice?: string; error?: string }> };

function ReviewActions({ entityType, entityId, decisions }: { entityType: string; entityId: string; decisions: string[] }) {
  return (
    <form className="review-action-form" action={moderateContent}>
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="entityId" value={entityId} />
      <input className="review-note-input" name="moderationNote" maxLength={1000} placeholder="Optional moderator note" aria-label="Optional moderator note" />
      <div className="review-buttons">
        {decisions.map((decision) => <button className={`review-button review-${decision}`} key={decision} name="decision" value={decision}>{decision === "approve" ? <Check size={14} /> : decision === "remove" ? <ShieldAlert size={14} /> : null}{decision.replace(/^./, (letter) => letter.toUpperCase())}</button>)}
      </div>
    </form>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/register");

  const adminRows = await sql`
    SELECT is_admin FROM user_security WHERE email = ${user.email} LIMIT 1
  `;
  if (adminRows.length === 0 || adminRows[0].is_admin !== true) {
    return (
      <main className="dashboard-page">
        <header className="dashboard-header"><Link className="brand" href="/"><LifeLedgerMark /><span>Life<span className="brand-light">Ledger</span></span></Link><Link className="dashboard-back" href="/account"><ArrowLeft size={15} /> My dashboard</Link></header>
        <section className="admin-gate dashboard-panel"><ShieldAlert size={24} /><h1>Admin access is not enabled</h1><p>Your account is signed in, but it has not been granted the administrator role.</p><p>After the moderation migration is applied, add your verified account to user_security with is_admin = true.</p><Link className="post-button" href="/account">Return to your dashboard <ArrowLeft size={15} /></Link></section>
      </main>
    );
  }

  const securityRows = await sql`
    SELECT mfa_enabled FROM user_security WHERE email = ${user.email} LIMIT 1
  `;
  const hasAal2 = securityRows.length > 0 && securityRows[0].mfa_enabled === true;
  if (!hasAal2) {
    return (
      <main className="dashboard-page">
        <header className="dashboard-header"><Link className="brand" href="/"><LifeLedgerMark /><span>Life<span className="brand-light">Ledger</span></span></Link><Link className="dashboard-back" href="/account"><ArrowLeft size={15} /> My dashboard</Link></header>
        <section className="admin-gate dashboard-panel"><ShieldAlert size={24} /><h1>Additional verification required</h1><p>Administrator review requires a verified authenticator code for this session.</p><Link className="post-button" href="/account/security?required=mfa">Set up authenticator <ArrowLeft size={15} /></Link></section>
      </main>
    );
  }

  const [posts, comments, reports, ads, events] = await Promise.all([
    sql`SELECT id, author_id, body, created_at FROM ll_posts WHERE status = 'pending_review' ORDER BY created_at ASC LIMIT 50`,
    sql`SELECT id, post_id, author_id, body, created_at FROM ll_comments WHERE status = 'pending_review' ORDER BY created_at ASC LIMIT 50`,
    sql`SELECT id, reporter_id, entity_type, entity_id, reason, details, created_at FROM ll_reports WHERE status IN ('open', 'reviewing') ORDER BY created_at ASC LIMIT 50`,
    sql`SELECT id, company_name, title, description, category, region, created_at, payment_status FROM ads WHERE status = 'awaiting_review' AND payment_status = 'paid' ORDER BY paid_at ASC LIMIT 50`,
    sql`SELECT id, entity_type, entity_id, action, note, created_at FROM moderation_actions ORDER BY created_at DESC LIMIT 12`,
  ]);

  const queueCount = posts.length + comments.length + reports.length + ads.length;

  return (
    <main className="dashboard-page">
      <header className="dashboard-header"><Link className="brand" href="/"><LifeLedgerMark /><span>Life<span className="brand-light">Ledger</span></span></Link><Link className="dashboard-back" href="/account"><ArrowLeft size={15} /> My dashboard</Link></header>
      <div className="dashboard-content admin-content">
        <div className="dashboard-title"><span className="eyebrow">LIFELEDGER TRUST & SAFETY</span><h1>Admin review</h1><p>Review submissions before they become public.</p></div>
        <div className="admin-summary"><span><ClipboardCheck size={17} /> {queueCount} items awaiting action</span><span className="aal2-pill"><ShieldAlert size={15} /> Authenticator verified</span></div>
        {params.notice === "reviewed" && <p className="auth-message" role="status">Review decision recorded.</p>}
        {params.error && <p className="auth-message auth-error" role="alert">The action could not be completed. Refresh the queue and try again.</p>}
        {params.notice === "reviewed" && <p className="auth-message" role="status">Review decision recorded.</p>}
        {params.error && <p className="auth-message auth-error" role="alert">The action could not be completed. Refresh the queue and try again.</p>}
        <>
          <section className="admin-review-section">
            <div className="admin-section-heading"><h2>Posts awaiting review</h2><span>{posts.length}</span></div>
            {posts.length ? posts.map((post) => <article className="review-card dashboard-panel" key={String(post.id)}><div className="review-card-meta"><span>POST · {new Date(post.created_at).toLocaleString()}</span><span>Member {String(post.author_id).slice(0, 8)}</span></div><p>{post.body}</p><ReviewActions entityType="post" entityId={String(post.id)} decisions={["approve", "reject"]} /></article>) : <p className="queue-empty">No posts are waiting for review.</p>}
          </section>
          <section className="admin-review-section">
            <div className="admin-section-heading"><h2>Comments awaiting review</h2><span>{comments.length}</span></div>
            {comments.length ? comments.map((comment) => <article className="review-card dashboard-panel" key={String(comment.id)}><div className="review-card-meta"><span>COMMENT · {new Date(comment.created_at).toLocaleString()}</span><span>Member {String(comment.author_id).slice(0, 8)}</span></div><p>{comment.body}</p><ReviewActions entityType="comment" entityId={String(comment.id)} decisions={["approve", "reject"]} /></article>) : <p className="queue-empty">No comments are waiting for review.</p>}
          </section>
          <section className="admin-review-section">
            <div className="admin-section-heading"><h2>Paid advertisements</h2><span>{ads.length}</span></div>
            {ads.length ? ads.map((ad) => <article className="review-card dashboard-panel" key={String(ad.id)}><div className="review-card-meta"><span>PAID AD · {ad.category} · {ad.region}</span><span>₱250 PHP</span></div><h3>{ad.title}</h3><p>{ad.company_name} · {ad.description}</p><ReviewActions entityType="advertisement" entityId={String(ad.id)} decisions={["approve", "reject"]} /></article>) : <p className="queue-empty">No paid advertisements are waiting for review.</p>}
          </section>
          <section className="admin-review-section">
            <div className="admin-section-heading"><h2>Member reports</h2><span>{reports.length}</span></div>
            {reports.length ? reports.map((report) => <article className="review-card dashboard-panel" key={String(report.id)}><div className="review-card-meta"><span><Flag size={12} /> {report.entity_type.toUpperCase()} · {report.reason.replaceAll("_", " ")}</span><span>{new Date(report.created_at).toLocaleString()}</span></div><p>{report.details || "No additional details provided."}</p><div className="report-target">Reported item: {report.entity_type} · {report.entity_id}</div><ReviewActions entityType="report" entityId={String(report.id)} decisions={["resolve", "dismiss"]} />{report.entity_type !== "report" && <ReviewActions entityType={report.entity_type} entityId={String(report.entity_id)} decisions={["remove"]} />}</article>) : <p className="queue-empty">No open member reports.</p>}
          </section>
          <section className="admin-review-section">
            <div className="admin-section-heading"><h2>Recent moderation actions</h2><span>{events.length}</span></div>
            <div className="dashboard-panel moderation-audit">{events.length ? events.map((event) => <div className="audit-row" key={String(event.id)}><span>{event.action.toUpperCase()}</span><span>{event.entity_type} · {event.entity_id}</span><time>{new Date(event.created_at).toLocaleString()}</time>{event.note && <small>{event.note}</small>}</div>) : <p className="queue-empty">No moderation actions recorded yet.</p>}</div>
          </section>
        </>
      </div>
    </main>
  );
}