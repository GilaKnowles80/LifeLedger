"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  Compass,
  Flag,
  Globe2,
  Heart,
  ImagePlus,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { isAppConfigured } from "@/lib/neondatabase/config";
import LifeLedgerMark from "@/components/lifeledger-mark";

type Post = {
  id: number | string;
  authorId?: string;
  name: string;
  handle: string;
  initials: string;
  avatarColor: string;
  location: string;
  time: string;
  text: string;
  likes: number;
  comments: number;
  image?: string;
  imageAlt?: string;
  sponsored?: boolean;
};

type MarketListing = {
  id: number;
  title: string;
  seller: string;
  location: string;
  price: string;
  category: string;
  image: string;
  imageAlt: string;
};

const startingPosts: Post[] = [
  {
    id: 1,
    name: "Mara Villanueva",
    handle: "marav",
    initials: "MV",
    avatarColor: "rose",
    location: "Cebu City, Philippines",
    time: "18 min",
    text: "A little reminder that the best things we build are the ones we share. Our neighborhood pantry is open this weekend. Bring a jar, take what you need, leave what you can. 🌱",
    likes: 48,
    comments: 12,
    image:
      "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1100&q=85",
    imageAlt: "Fresh produce arranged at a neighborhood market",
  },
  {
    id: 2,
    name: "Northline Coffee Co.",
    handle: "northlinecoffee",
    initials: "NC",
    avatarColor: "green",
    location: "Vancouver, Canada",
    time: "1 hr",
    text: "Meet our new single-origin morning ritual. Sourced with care from small farms in Davao, roasted here in Vancouver. First harvest is in the shop today.",
    likes: 126,
    comments: 23,
    sponsored: true,
    image:
      "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1100&q=85",
    imageAlt: "Pour-over coffee being prepared in a cafe",
  },
  {
    id: 3,
    name: "Darius Mensah",
    handle: "dariusmakes",
    initials: "DM",
    avatarColor: "blue",
    location: "Accra, Ghana",
    time: "3 hr",
    text: "Just finished the first batch of these handwoven baskets with the Kente Circle makers. Every piece has a story, and this one travels from Accra with love. Sharing the collection in Marketplace.",
    likes: 89,
    comments: 17,
    image:
      "https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=1100&q=85",
    imageAlt: "Handwoven natural fiber basket",
  },
];

const listings: MarketListing[] = [
  {
    id: 1,
    title: "Davao single-origin coffee",
    seller: "Northline Coffee Co.",
    location: "Vancouver, Canada",
    price: "CA$18",
    category: "Food & drink",
    image:
      "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Freshly brewed coffee in a ceramic cup",
  },
  {
    id: 2,
    title: "Woven market basket",
    seller: "Kente Circle",
    location: "Accra, Ghana",
    price: "GH₵240",
    category: "Home & craft",
    image:
      "https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Handwoven natural fiber basket",
  },
  {
    id: 3,
    title: "Sunday flower bunch",
    seller: "Petal & Stem",
    location: "London, UK",
    price: "£22",
    category: "Plants & flowers",
    image:
      "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Seasonal flowers in warm afternoon light",
  },
];

const storyPeople = [
  { initials: "MV", name: "Mara", color: "rose" },
  { initials: "OS", name: "Omar", color: "gold" },
  { initials: "JL", name: "Jules", color: "blue" },
  { initials: "AK", name: "Asha", color: "green" },
  { initials: "DM", name: "Darius", color: "violet" },
  { initials: "NC", name: "Northline", color: "coral" },
];

const navItems = [
  { label: "Home feed", icon: Compass },
  { label: "Marketplace", icon: Store },
  { label: "Communities", icon: Users },
  { label: "Saved", icon: Bookmark },
];

const emptyAdForm = {
  companyName: "",
  contactEmail: "",
  title: "",
  description: "",
  website: "",
  category: "Product advertisement",
  region: "Worldwide",
};

export default function Home() {
  const [activePage, setActivePage] = useState("Home feed");
  const [posts, setPosts] = useState(startingPosts);
  const [viewer, setViewer] = useState<{ id: string; email: string | null; phone: string | null } | null>(null);
  const [likedPosts, setLikedPosts] = useState<Array<number | string>>([]);
  const [savedPosts, setSavedPosts] = useState<Array<number | string>>([]);
  const [commentPost, setCommentPost] = useState<number | string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [search, setSearch] = useState("");
  const [composerText, setComposerText] = useState("");
  const [showAdDialog, setShowAdDialog] = useState(false);
  const [adForm, setAdForm] = useState(emptyAdForm);
  const [adMessage, setAdMessage] = useState("");
  const [adSending, setAdSending] = useState(false);
  const [feedMessage, setFeedMessage] = useState("");
  const [reportPost, setReportPost] = useState<Post | null>(null);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [blockReportedMember, setBlockReportedMember] = useState(false);

  const sessionData = useSession() ?? { data: null };
  const session = sessionData.data;

  useEffect(() => {
    if (!isAppConfigured()) return;
    if (session?.user?.id) {
      setViewer({ id: session.user.id, email: session.user.email || null, phone: null });
    } else {
      setViewer(null);
    }
    void fetch("/api/posts", { cache: "no-store" })
      .then(async (response) => {
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error("The community feed is temporarily unavailable.");
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "The community feed is unavailable.");
        if (!Array.isArray(result.posts)) return;
        const savedPosts: Post[] = result.posts.map((item: Record<string, unknown>, index: number) => {
          const name = typeof item.author_name === "string" ? item.author_name : "LifeLedger member";
          return {
            id: typeof item.id === "string" ? item.id : index,
            authorId: typeof item.author_id === "string" ? item.author_id : undefined,
            name,
            handle: typeof item.author_username === "string" ? item.author_username : "member",
            initials: name.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase(),
            avatarColor: "green",
            location: "LifeLedger community",
            time: "recently",
            text: typeof item.body === "string" ? item.body : "",
            likes: Number(item.appreciation_count || 0),
            comments: Number(item.comment_count || 0),
            image: typeof item.image_url === "string" ? item.image_url : undefined,
            imageAlt: "Community post image",
          };
        });
        setPosts(savedPosts);
        setLikedPosts(result.posts.filter((item: Record<string, unknown>) => item.liked_by_me === true).map((item: Record<string, unknown>) => item.id as string));
      })
      .catch((error: unknown) => {
        setFeedMessage(error instanceof Error ? error.message : "The community feed is unavailable.");
      });
  }, [session]);

  const marketplaceResults = listings.filter((listing) =>
    `${listing.title} ${listing.seller} ${listing.location} ${listing.category}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const viewerName = viewer?.email?.split("@")[0] || viewer?.phone || "Welcome";
  const viewerInitials = viewer?.email?.slice(0, 2).toUpperCase() || "LL";

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = composerText.trim();
    if (!text) return;
    if (isAppConfigured()) {
      if (!viewer) {
        setFeedMessage("Sign in with a verified email or mobile number to post.");
        return;
      }
      try {
        const response = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Post could not be submitted.");
        setComposerText("");
        setFeedMessage("Your post is in the private review queue. It will appear after an admin approves it.");
      } catch (error) {
        setFeedMessage(error instanceof Error ? error.message : "Post could not be submitted.");
      }
      return;
    }
    setPosts((current) => [
      {
        id: Date.now(),
        name: "Alex Morgan",
        handle: "alexmorgan",
        initials: "AM",
        avatarColor: "green",
        location: "Manila, Philippines",
        time: "just now",
        text,
        likes: 0,
        comments: 0,
      },
      ...current,
    ]);
    setComposerText("");
  }

  async function toggleLike(postId: number | string) {
    const isLiked = likedPosts.includes(postId);
    if (isAppConfigured()) {
      if (!viewer || typeof postId !== "string") {
        setFeedMessage("Sign in with a verified account to appreciate community posts.");
        return;
      }
      try {
        const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/reactions`, { method: isLiked ? "DELETE" : "POST" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Reaction could not be saved.");
      } catch (error) {
        setFeedMessage(error instanceof Error ? error.message : "Reaction could not be saved.");
        return;
      }
    }
    setLikedPosts((current) =>
      isLiked ? current.filter((id) => id !== postId) : [...current, postId],
    );
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? { ...post, likes: post.likes + (isLiked ? -1 : 1) }
          : post,
      ),
    );
  }

  function toggleSaved(postId: number | string) {
    setSavedPosts((current) =>
      current.includes(postId)
        ? current.filter((id) => id !== postId)
        : [...current, postId],
    );
  }

  async function addComment(event: FormEvent<HTMLFormElement>, postId: number | string) {
    event.preventDefault();
    const body = commentDraft.trim();
    if (!body) return;
    if (isAppConfigured()) {
      if (!viewer || typeof postId !== "string") {
        setFeedMessage("Sign in with a verified account to comment.");
        return;
      }
      try {
        const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Comment could not be submitted.");
        setCommentDraft("");
        setCommentPost(null);
        setFeedMessage("Your comment is in the private review queue. It will appear after an admin approves it.");
      } catch (error) {
        setFeedMessage(error instanceof Error ? error.message : "Comment could not be submitted.");
      }
      return;
    }
    setPosts((current) =>
      current.map((post) =>
        post.id === postId ? { ...post, comments: post.comments + 1 } : post,
      ),
    );
    setCommentDraft("");
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reportPost || typeof reportPost.id !== "string") return;
    if (!viewer) {
      setFeedMessage("Sign in with a verified account to report content.");
      return;
    }
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "post", entityId: reportPost.id, reason: reportReason, details: reportDetails }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Report could not be submitted.");
      if (blockReportedMember && reportPost.authorId) {
        await fetch("/api/blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: reportPost.authorId }),
        });
      }
      setFeedMessage("Report sent to the LifeLedger safety team.");
      setReportPost(null);
      setReportDetails("");
      setBlockReportedMember(false);
    } catch (error) {
      setFeedMessage(error instanceof Error ? error.message : "Report could not be submitted.");
    }
  }

  async function submitAdvertisement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdSending(true);
    setAdMessage("");
    try {
      const response = await fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adForm),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to submit ad.");
      if (typeof result.checkoutUrl !== "string") {
        throw new Error("PayPal did not return a checkout link.");
      }
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setAdMessage(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setAdSending(false);
    }
  }

  const isMarketplace = activePage === "Marketplace";

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" onClick={() => setActivePage("Home feed")}>
          <LifeLedgerMark />
          <span>Life<span className="brand-light">Ledger</span></span>
        </a>
        <label className="global-search">
          <Search size={17} strokeWidth={1.8} />
          <input
            aria-label="Search LifeLedger"
            placeholder="Search people, places, and good things"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <kbd>⌘ K</kbd>
        </label>
        <div className="top-actions">
          <button className="icon-button notification-button" aria-label="Notifications">
            <Bell size={19} strokeWidth={1.8} />
            <span className="notification-dot" />
          </button>
          <Link className="profile-button" href={viewer ? "/account" : "/register"} aria-label={viewer ? "Open your dashboard" : "Sign in or create account"}>
            <span className="avatar avatar-green">{viewerInitials}</span>
            <ChevronDown size={15} />
          </Link>
        </div>
      </header>

      <div className="workspace">
        <aside className="left-rail">
          <div className="profile-summary">
            <span className="avatar avatar-green avatar-large">AM</span>
            <div>
              <strong>{viewerName}</strong>
              <span>{viewer?.email || viewer?.phone || "Sign in to join"}</span>
            </div>
            <button className="icon-button quiet-icon" aria-label="Profile options">
              <MoreHorizontal size={19} />
            </button>
          </div>
          <div className="rail-divider" />
          <p className="eyebrow rail-label">YOUR SPACE</p>
          <nav className="primary-nav" aria-label="Main navigation">
            {navItems.map(({ label, icon: Icon }) => (
              <button
                className={`nav-item ${activePage === label ? "nav-active" : ""}`}
                key={label}
                onClick={() => setActivePage(label)}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{label}</span>
                {label === "Communities" && <span className="nav-count">4</span>}
              </button>
            ))}
          </nav>
          <div className="rail-divider" />
          <div className="rail-section-heading">
            <p className="eyebrow">YOUR CIRCLES</p>
            <button className="small-icon-button" aria-label="Add a circle"><Plus size={16} /></button>
          </div>
          <div className="circle-list">
            <button className="circle-item"><span className="circle-symbol circle-orange">G</span><span>Good Neighbors</span><span className="circle-unread" /></button>
            <button className="circle-item"><span className="circle-symbol circle-blue">✳</span><span>Slow Living Club</span></button>
            <button className="circle-item"><span className="circle-symbol circle-green">↗</span><span>Local Makers</span></button>
          </div>
          <div className="rail-bottom">
            <div className="worldwide-note"><Globe2 size={17} /><span>Connected, worldwide</span></div>
            <button className="help-link">About LifeLedger <ArrowUpRight size={13} /></button>
          </div>
        </aside>

        <main className="main-column">
          <div className="mobile-heading">
            <div>
              <p className="eyebrow">SATURDAY, OCTOBER 3</p>
              <h1>{isMarketplace ? "The Marketplace" : "Your world, in good company."}</h1>
            </div>
            <span className="avatar avatar-green">AM</span>
          </div>
          {!isMarketplace ? (
            <>
              <section className="stories-section" aria-label="Stories from your circles">
                <div className="section-topline">
                  <div><span className="eyebrow">AROUND YOUR CIRCLES</span><span className="live-note"><span /> LIVE</span></div>
                  <button className="text-button">See all <ArrowRight size={14} /></button>
                </div>
                <div className="stories-row">
                  <button className="story story-add"><span className="story-add-ring"><Plus size={20} /></span><span>Your story</span></button>
                  {storyPeople.map((person) => (
                    <button className="story" key={person.name}>
                      <span className={`story-ring ring-${person.color}`}><span className={`avatar avatar-${person.color}`}>{person.initials}</span></span>
                      <span>{person.name}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="composer panel">
                <div className="composer-top">
                  <span className="avatar avatar-green">{viewerInitials}</span>
                  <form className="composer-form" onSubmit={submitPost}>
                    <label className="sr-only" htmlFor="post-text">Share something with your circles</label>
                    <textarea
                      id="post-text"
                      placeholder="What’s happening in your corner of the world?"
                      value={composerText}
                      onChange={(event) => setComposerText(event.target.value)}
                      rows={2}
                    />
                    <div className="composer-tools">
                      <div className="composer-attachments">
                        <button type="button" className="tool-button"><ImagePlus size={16} /> <span>Photo</span></button>
                        <button type="button" className="tool-button"><MapPin size={15} /> <span>Check in</span></button>
                        <button type="button" className="tool-button"><Globe2 size={15} /> <span>Everyone</span></button>
                      </div>
                      <button type="submit" className="post-button" disabled={!composerText.trim()}>Submit for review <ArrowRight size={15} /></button>
                    </div>
                  </form>
                </div>
              </section>
              {feedMessage && <p className="feed-notice" role="status">{feedMessage} {!viewer && <Link href="/register">Create a verified account</Link>}</p>}

              <div className="feed-heading">
                <div><h2>Your feed</h2><span className="feed-subtitle">Notes from people and places you care about</span></div>
                <button className="feed-filter">Most recent <ChevronDown size={14} /></button>
              </div>

              <div className="post-list">
                {posts.map((post) => {
                  const liked = likedPosts.includes(post.id);
                  const saved = savedPosts.includes(post.id);
                  return (
                    <article className="post panel" key={post.id}>
                      <div className="post-header">
                        <span className={`avatar avatar-${post.avatarColor}`}>{post.initials}</span>
                        <div className="post-author">
                          <div className="author-line"><strong>{post.name}</strong>{post.sponsored && <span className="sponsored-tag">SPONSORED</span>}</div>
                          <span>{post.location} <span className="meta-dot">·</span> {post.time} ago</span>
                        </div>
                        <button className="icon-button quiet-icon" aria-label="More post options"><MoreHorizontal size={20} /></button>
                      </div>
                      <p className="post-copy">{post.text}</p>
                      {post.image && <div className="post-photo" role="img" aria-label={post.imageAlt} style={{ backgroundImage: `url("${post.image}")` }} />}
                      <div className="post-counts"><span>{post.likes} appreciations</span><button onClick={() => setCommentPost(commentPost === post.id ? null : post.id)}>{post.comments} comments</button></div>
                      <div className="post-actions">
                        <button className={`post-action ${liked ? "action-liked" : ""}`} onClick={() => toggleLike(post.id)}><Heart size={17} fill={liked ? "currentColor" : "none"} /> <span>{liked ? "Appreciated" : "Appreciate"}</span></button>
                        <button className="post-action" onClick={() => setCommentPost(commentPost === post.id ? null : post.id)}><MessageCircle size={17} /> <span>Comment</span></button>
                        <button className="post-action report-action" onClick={() => { setReportPost(reportPost?.id === post.id ? null : post); setFeedMessage(""); }}><Flag size={16} /> <span>Report</span></button>
                        <button className={`post-action post-save ${saved ? "action-saved" : ""}`} onClick={() => toggleSaved(post.id)} aria-label={saved ? "Remove saved post" : "Save post"}><Bookmark size={17} fill={saved ? "currentColor" : "none"} /><span className="save-label">{saved ? "Saved" : "Save"}</span></button>
                      </div>
                      {commentPost === post.id && (
                        <form className="comment-form" onSubmit={(event) => addComment(event, post.id)}>
                          <span className="avatar avatar-green avatar-small">AM</span>
                          <input aria-label="Write a comment" placeholder="Leave a thoughtful note..." value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} />
                          <button aria-label="Send comment" disabled={!commentDraft.trim()}><Send size={16} /></button>
                        </form>
                      )}
                      {reportPost?.id === post.id && (
                        <form className="report-form" onSubmit={submitReport}>
                          <div className="report-form-heading"><strong>Report this post</strong><button type="button" onClick={() => setReportPost(null)}>Cancel</button></div>
                          <label>Reason<select value={reportReason} onChange={(event) => setReportReason(event.target.value)}><option value="spam">Spam or misleading</option><option value="harassment">Harassment</option><option value="threats">Threats</option><option value="hate">Hateful content</option><option value="fraud">Fraud or scam</option><option value="sexual_content">Sexual content</option><option value="violence">Violence</option><option value="self_harm">Self-harm concern</option><option value="impersonation">Impersonation</option><option value="other">Other</option></select></label>
                          <label>Additional details<textarea rows={2} maxLength={1000} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} placeholder="Add context for the review team (optional)." /></label>
                          {post.authorId && <label className="block-member-option"><input type="checkbox" checked={blockReportedMember} onChange={(event) => setBlockReportedMember(event.target.checked)} /> Block this member and hide their posts</label>}
                          <button className="report-submit" type="submit" disabled={!viewer}>Send to safety team</button>
                          {!viewer && <p className="report-signin-note">Sign in with a verified account to submit a report.</p>}
                        </form>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <section className="marketplace-view">
              <div className="market-hero">
                <div className="market-hero-copy"><span className="eyebrow">INDEPENDENT, INTERCONNECTED</span><h2>Good things,<br />from everywhere.</h2><p>Discover thoughtful finds from small businesses and makers around the world.</p><button className="market-hero-button" onClick={() => setShowAdDialog(true)}>Introduce your business <ArrowUpRight size={16} /></button></div>
                <div className="market-hero-image" role="img" aria-label="Colorful flowers from a local market" />
                <div className="market-stamp"><Globe2 size={19} /><span>GOOD FINDS<br />HAVE NO BORDERS</span></div>
              </div>
              <div className="market-heading"><div><span className="eyebrow">AROUND THE WORLD</span><h2>Made with care</h2></div><span className="market-count">{marketplaceResults.length} FINDS</span></div>
              <div className="market-filters"><button className="filter-chip filter-selected">For you</button><button className="filter-chip">Home & craft</button><button className="filter-chip">Food & drink</button><button className="filter-chip">Plants & flowers</button></div>
              <div className="market-grid">{marketplaceResults.map((listing) => <article className="market-card" key={listing.id}><div className="market-card-image" role="img" aria-label={listing.imageAlt} style={{ backgroundImage: `url("${listing.image}")` }}><span className="market-category">{listing.category}</span><button className="market-heart" aria-label={`Save ${listing.title}`}><Heart size={17} /></button></div><div className="market-card-info"><span className="market-seller">{listing.seller}</span><h3>{listing.title}</h3><div className="market-card-meta"><span>{listing.price}</span><span><MapPin size={12} /> {listing.location}</span></div></div></article>)}</div>
              {marketplaceResults.length === 0 && <div className="empty-search">No finds match “{search}”. Try a place or category.</div>}
            </section>
          )}
        </main>

        <aside className="right-rail">
          <section className="welcome-note"><span className="eyebrow">A NOTE FOR TODAY</span><div className="welcome-spark"><Sparkles size={18} /></div><h2>Small moments<br />make a life.</h2><p>Keep track of the good things, wherever you find them.</p><span className="welcome-byline">Your LifeLedger, together.</span></section>
          <section className="right-section">
            <div className="right-heading"><h3>Trending circles</h3><button className="text-button">Explore</button></div>
            <button className="trend-row"><span className="trend-icon trend-terracotta"><span>G</span></span><span className="trend-name"><strong>Good Neighbors</strong><small>2.4k members</small></span><TrendingUp size={15} className="trend-up" /></button>
            <button className="trend-row"><span className="trend-icon trend-sage"><span>✳</span></span><span className="trend-name"><strong>Slow Living Club</strong><small>1.8k members</small></span><TrendingUp size={15} className="trend-up" /></button>
            <button className="trend-row"><span className="trend-icon trend-sky"><span>↗</span></span><span className="trend-name"><strong>Local Makers</strong><small>986 members</small></span><TrendingUp size={15} className="trend-up" /></button>
          </section>
          <section className="market-promo">
            <div className="promo-image" role="img" aria-label="Small-batch handmade ceramics" />
            <div className="promo-content"><span className="eyebrow">LIFELEDGER MARKETPLACE</span><h3>Made slowly.<br />Found by you.</h3><p>Meet the people behind the things you love.</p><button onClick={() => setActivePage("Marketplace")}>Explore the market <ArrowRight size={14} /></button></div>
            <span className="promo-corner">01 / 04</span>
          </section>
          <section className="ad-callout"><div className="ad-callout-icon"><ShieldCheck size={17} /></div><div><strong>Building something good?</strong><p>Introduce your company to a worldwide community for ₱250.</p><button onClick={() => { setAdMessage(""); setShowAdDialog(true); }}>Create an advertisement <ArrowUpRight size={13} /></button></div></section>
          <footer className="site-footer"><span>About</span><span>Community guidelines</span><span>Privacy</span><span>© 2026 LifeLedger</span></footer>
        </aside>
      </div>

      <button className="mobile-ad-button" onClick={() => setShowAdDialog(true)} aria-label="Create advertisement"><Plus size={22} /></button>

      {showAdDialog && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAdDialog(false); }}>
          <section className="ad-dialog" role="dialog" aria-modal="true" aria-labelledby="ad-dialog-title">
            <div className="dialog-header"><div><span className="eyebrow">LIFELEDGER MARKETPLACE</span><h2 id="ad-dialog-title">Put your good thing<br />out into the world.</h2></div><button className="icon-button" onClick={() => setShowAdDialog(false)} aria-label="Close advertisement form"><X size={19} /></button></div>
            <div className="price-strip"><span><Globe2 size={17} /> Worldwide community reach</span><strong>₱250 <small>/ ad</small></strong></div>
            {adMessage && <div className={`ad-message ${adMessage.startsWith("Draft") ? "ad-message-success" : "ad-message-error"}`}><span>{adMessage.startsWith("Draft") ? <Check size={17} /> : <X size={17} />}</span><p>{adMessage}</p></div>}
            <form className="ad-form" onSubmit={submitAdvertisement}>
              <div className="field-row"><label>Company or seller name<input required maxLength={100} value={adForm.companyName} onChange={(event) => setAdForm({ ...adForm, companyName: event.target.value })} placeholder="e.g. Sunday Goods Studio" /></label><label>Contact email<input required type="email" maxLength={254} value={adForm.contactEmail} onChange={(event) => setAdForm({ ...adForm, contactEmail: event.target.value })} placeholder="you@yourcompany.com" /></label></div>
              <label>Advertisement type<select value={adForm.category} onChange={(event) => setAdForm({ ...adForm, category: event.target.value })}><option>Product advertisement</option><option>Company advertisement</option><option>Marketplace listing</option></select></label>
              <label>Headline<input required maxLength={120} value={adForm.title} onChange={(event) => setAdForm({ ...adForm, title: event.target.value })} placeholder="What would you like the world to know?" /></label>
              <label>Tell us about it<textarea required maxLength={1000} rows={3} value={adForm.description} onChange={(event) => setAdForm({ ...adForm, description: event.target.value })} placeholder="A short, welcoming introduction..." /></label>
              <div className="field-row"><label>Website <span className="optional-label">OPTIONAL</span><input type="url" maxLength={300} value={adForm.website} onChange={(event) => setAdForm({ ...adForm, website: event.target.value })} placeholder="https://yourcompany.com" /></label><label>Audience region<select value={adForm.region} onChange={(event) => setAdForm({ ...adForm, region: event.target.value })}><option>Worldwide</option><option>Philippines</option><option>North America</option><option>Europe</option><option>Asia Pacific</option><option>Africa</option><option>Latin America</option></select></label></div>
              <div className="checkout-note"><ShieldCheck size={16} /><span>Pay securely through PayPal. Your ad is submitted for review after the ₱250 payment is confirmed.</span></div>
              <button className="ad-submit-button" disabled={adSending}>{adSending ? "Opening PayPal..." : <>Continue to PayPal · ₱250 <ArrowRight size={16} /></>}</button>
              <p className="global-note">Price shown in Philippine pesos. Ads remain unpublished until reviewed.</p>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
