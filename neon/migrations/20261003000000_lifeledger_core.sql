create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists public.ll_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null default 'LifeLedger member',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.ll_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  image_url text,
  status text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);

create table if not exists public.ll_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.ll_posts (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.ll_reactions (
  post_id uuid not null references public.ll_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.ll_ads (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  company_name text not null check (char_length(company_name) between 1 and 100),
  contact_email text not null check (char_length(contact_email) <= 254),
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 1000),
  website text,
  category text not null check (category in ('Product advertisement', 'Company advertisement', 'Marketplace listing')),
  region text not null check (region in ('Worldwide', 'Philippines', 'North America', 'Europe', 'Asia Pacific', 'Africa', 'Latin America')),
  amount_cents integer not null default 25000 check (amount_cents = 25000),
  currency text not null default 'PHP' check (currency = 'PHP'),
  status text not null default 'pending_payment' check (status in ('pending_payment', 'checkout_failed', 'payment_failed', 'awaiting_review', 'approved', 'rejected')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed')),
  paypal_order_id text unique,
  paypal_capture_id text unique,
  moderation_note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  reviewed_at timestamptz
);

create table if not exists private.ll_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on table private.ll_admins from public, anon, authenticated;

create or replace function private.is_lifeledger_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.ll_admins
    where user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_lifeledger_admin() from public, anon;
grant execute on function private.is_lifeledger_admin() to authenticated;

create or replace function private.create_lifeledger_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
begin
  base_username := left(
    regexp_replace(lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, ''), '@', 1))), '[^a-z0-9_]', '', 'g'),
    20
  );
  insert into public.ll_profiles (user_id, username, display_name)
  values (
    new.id,
    coalesce(nullif(base_username, ''), 'member') || '_' || left(replace(new.id::text, '-', ''), 8),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'LifeLedger member')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_lifeledger_auth_user_created on auth.users;
create trigger on_lifeledger_auth_user_created
  after insert on auth.users
  for each row execute function private.create_lifeledger_profile();

create or replace function public.ll_get_feed()
returns table (
  id uuid,
  body text,
  image_url text,
  created_at timestamptz,
  author_id uuid,
  author_name text,
  author_username text,
  author_avatar_url text,
  appreciation_count bigint,
  comment_count bigint,
  liked_by_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.body,
    p.image_url,
    p.created_at,
    p.author_id,
    coalesce(profile.display_name, 'LifeLedger member'),
    coalesce(profile.username, 'member'),
    profile.avatar_url,
    (select count(*) from public.ll_reactions r where r.post_id = p.id),
    (select count(*) from public.ll_comments c where c.post_id = p.id),
    exists (
      select 1 from public.ll_reactions mine
      where mine.post_id = p.id and mine.user_id = (select auth.uid())
    )
  from public.ll_posts p
  left join public.ll_profiles profile on profile.user_id = p.author_id
  where p.status = 'published'
  order by p.created_at desc
  limit 100;
$$;
revoke all on function public.ll_get_feed() from public;
grant execute on function public.ll_get_feed() to anon, authenticated;

create index if not exists ll_posts_feed_idx on public.ll_posts (status, created_at desc);
create index if not exists ll_comments_post_idx on public.ll_comments (post_id, created_at);
create index if not exists ll_reactions_user_idx on public.ll_reactions (user_id, post_id);
create index if not exists ll_ads_review_idx on public.ll_ads (status, created_at desc);
create index if not exists ll_ads_owner_idx on public.ll_ads (owner_id, created_at desc);

alter table public.ll_profiles enable row level security;
alter table public.ll_posts enable row level security;
alter table public.ll_comments enable row level security;
alter table public.ll_reactions enable row level security;
alter table public.ll_ads enable row level security;

revoke all on table public.ll_profiles, public.ll_posts, public.ll_comments, public.ll_reactions, public.ll_ads from anon, authenticated;
grant select on table public.ll_profiles, public.ll_posts, public.ll_comments, public.ll_ads to anon, authenticated;
grant update (display_name, avatar_url) on table public.ll_profiles to authenticated;
grant insert, update, delete on table public.ll_posts to authenticated;
grant insert, delete on table public.ll_comments to authenticated;
grant select, insert, delete on table public.ll_reactions to authenticated;
grant insert on table public.ll_ads to authenticated;
grant update (status, moderation_note, reviewed_at) on table public.ll_ads to authenticated;
grant select on table private.ll_admins to authenticated;

drop policy if exists "Public can read LifeLedger profiles" on public.ll_profiles;
create policy "Public can read LifeLedger profiles"
  on public.ll_profiles for select to anon, authenticated using (true);
drop policy if exists "Members update their own profile" on public.ll_profiles;
create policy "Members update their own profile"
  on public.ll_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Public can read published posts" on public.ll_posts;
create policy "Public can read published posts"
  on public.ll_posts for select to anon, authenticated
  using (status = 'published' or (select auth.uid()) = author_id);
drop policy if exists "Members create their own posts" on public.ll_posts;
create policy "Members create their own posts"
  on public.ll_posts for insert to authenticated
  with check ((select auth.uid()) = author_id and status in ('draft', 'published'));
drop policy if exists "Members update their own posts" on public.ll_posts;
create policy "Members update their own posts"
  on public.ll_posts for update to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);
drop policy if exists "Members delete their own posts" on public.ll_posts;
create policy "Members delete their own posts"
  on public.ll_posts for delete to authenticated
  using ((select auth.uid()) = author_id);

drop policy if exists "Public can read comments on published posts" on public.ll_comments;
create policy "Public can read comments on published posts"
  on public.ll_comments for select to anon, authenticated
  using (exists (select 1 from public.ll_posts p where p.id = post_id and p.status = 'published'));
drop policy if exists "Members add their own comments" on public.ll_comments;
create policy "Members add their own comments"
  on public.ll_comments for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (select 1 from public.ll_posts p where p.id = post_id and p.status = 'published')
  );
drop policy if exists "Members delete their own comments" on public.ll_comments;
create policy "Members delete their own comments"
  on public.ll_comments for delete to authenticated
  using ((select auth.uid()) = author_id);

drop policy if exists "Members read their own reactions" on public.ll_reactions;
create policy "Members read their own reactions"
  on public.ll_reactions for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Members react as themselves" on public.ll_reactions;
create policy "Members react as themselves"
  on public.ll_reactions for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Members remove their own reactions" on public.ll_reactions;
create policy "Members remove their own reactions"
  on public.ll_reactions for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Public can read approved advertisements" on public.ll_ads;
create policy "Public can read approved advertisements"
  on public.ll_ads for select to anon, authenticated
  using (status = 'approved');
drop policy if exists "Advertisers read their own ads" on public.ll_ads;
create policy "Advertisers read their own ads"
  on public.ll_ads for select to authenticated
  using ((select auth.uid()) = owner_id);
drop policy if exists "Admins read all advertisements" on public.ll_ads;
create policy "Admins read all advertisements"
  on public.ll_ads for select to authenticated
  using ((select private.is_lifeledger_admin()));
drop policy if exists "Members submit their own advertisements" on public.ll_ads;
create policy "Members submit their own advertisements"
  on public.ll_ads for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and status = 'pending_payment'
    and payment_status = 'pending'
    and paypal_order_id is null
    and paypal_capture_id is null
    and amount_cents = 25000
    and currency = 'PHP'
  );
drop policy if exists "Admins review paid advertisements" on public.ll_ads;
create policy "Admins review paid advertisements"
  on public.ll_ads for update to authenticated
  using ((select private.is_lifeledger_admin()) and status = 'awaiting_review')
  with check (
    (select private.is_lifeledger_admin())
    and status in ('approved', 'rejected')
    and (status <> 'approved' or payment_status = 'paid')
  );

drop policy if exists "Members can verify their admin membership" on private.ll_admins;
create policy "Members can verify their admin membership"
  on private.ll_admins for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function private.protect_lifeledger_ad_payment_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') not in ('service_role', 'postgres') then
    if tg_op = 'UPDATE' and (
      new.payment_status is distinct from old.payment_status
      or new.paypal_order_id is distinct from old.paypal_order_id
      or new.paypal_capture_id is distinct from old.paypal_capture_id
      or new.amount_cents is distinct from old.amount_cents
      or new.currency is distinct from old.currency
      or new.paid_at is distinct from old.paid_at
    ) then
      raise exception 'Payment fields are managed by the server';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_lifeledger_ad_payment_fields on public.ll_ads;
create trigger protect_lifeledger_ad_payment_fields
  before update on public.ll_ads
  for each row execute function private.protect_lifeledger_ad_payment_fields();