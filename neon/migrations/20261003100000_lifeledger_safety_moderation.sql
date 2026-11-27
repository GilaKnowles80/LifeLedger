create table if not exists public.ll_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null check (entity_type in ('post', 'comment', 'profile', 'advertisement')),
  entity_id text not null,
  reason text not null check (reason in ('spam', 'harassment', 'threats', 'hate', 'fraud', 'sexual_content', 'violence', 'self_harm', 'impersonation', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by uuid references auth.users (id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (reporter_id, entity_type, entity_id)
);

create table if not exists public.ll_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_user_id),
  constraint ll_blocks_not_self check (blocker_id <> blocked_user_id)
);

create table if not exists public.ll_moderation_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete restrict,
  actor_kind text not null default 'admin' check (actor_kind in ('admin', 'system')),
  entity_type text not null check (entity_type in ('post', 'comment', 'report', 'advertisement')),
  entity_id text not null,
  action text not null check (action in ('approve', 'reject', 'remove', 'restore', 'resolve', 'dismiss', 'auto_hold', 'auto_reject')),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists private.ll_content_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  window_started timestamptz not null default now(),
  request_count integer not null default 0,
  primary key (user_id, action)
);
revoke all on table private.ll_content_rate_limits from public, anon, authenticated;

alter table public.ll_posts drop constraint if exists ll_posts_status_check;
update public.ll_posts set status = 'pending_review' where status = 'published';
alter table public.ll_posts alter column status set default 'pending_review';
alter table public.ll_posts add column if not exists moderation_note text;
alter table public.ll_posts
  add constraint ll_posts_status_check
  check (status in ('draft', 'pending_review', 'published', 'rejected', 'removed'));

alter table public.ll_comments add column if not exists status text not null default 'pending_review';
alter table public.ll_comments add column if not exists moderation_note text;
alter table public.ll_comments
  add constraint ll_comments_status_check
  check (status in ('pending_review', 'published', 'rejected', 'removed'));

alter table public.ll_moderation_events alter column actor_id drop not null;
alter table public.ll_moderation_events add column if not exists actor_kind text not null default 'admin';
alter table public.ll_moderation_events drop constraint if exists ll_moderation_events_action_check;
alter table public.ll_moderation_events add constraint ll_moderation_events_action_check
  check (action in ('approve', 'reject', 'remove', 'restore', 'resolve', 'dismiss', 'auto_hold', 'auto_reject'));

create or replace function private.ll_content_status(content text)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  normalized text := lower(coalesce(content, ''));
begin
  if normalized ~ '<\s*(script|iframe|object|embed)|javascript\s*:|data\s*:\s*text/html|on[a-z]+\s*='
    or normalized ~ '\m(send|share|tell|provide|give)\M.{0,80}\m(password|one[- ]time code|verification code|seed phrase|recovery phrase|private key)\M'
  then
    return 'rejected';
  end if;

  if normalized ~* '(https?://|www[.])'
    or normalized ~* '(guaranteed (returns|profit)|double your (money|crypto)|account (will be|has been) (suspended|locked))'
    or normalized ~* '\m(kill|hurt|attack|shoot) you\M'
  then
    return 'pending_review';
  end if;

  return 'published';
end;
$$;
revoke all on function private.ll_content_status(text) from public, anon;
grant execute on function private.ll_content_status(text) to authenticated;

create or replace function private.ll_auto_moderate_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.status := private.ll_content_status(new.body);
  new.moderation_note := case new.status
    when 'rejected' then 'Automatically blocked by a high-confidence script or credential-solicitation rule.'
    when 'pending_review' then 'Automatically held for moderator review because it contains a link or safety-sensitive pattern.'
    else null
  end;
  return new;
end;
$$;
revoke all on function private.ll_auto_moderate_content() from public, anon, authenticated;

create or replace function private.ll_record_auto_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('pending_review', 'rejected') then
    insert into public.ll_moderation_events (actor_id, actor_kind, entity_type, entity_id, action, note)
    values (
      null,
      'system',
      case when tg_table_name = 'll_posts' then 'post' else 'comment' end,
      new.id::text,
      case when new.status = 'rejected' then 'auto_reject' else 'auto_hold' end,
      new.moderation_note
    );
  end if;
  return new;
end;
$$;
revoke all on function private.ll_record_auto_moderation() from public, anon, authenticated;

drop trigger if exists ll_posts_auto_moderation on public.ll_posts;
create trigger ll_posts_auto_moderation before insert on public.ll_posts
  for each row execute function private.ll_auto_moderate_content();
drop trigger if exists ll_comments_auto_moderation on public.ll_comments;
create trigger ll_comments_auto_moderation before insert on public.ll_comments
  for each row execute function private.ll_auto_moderate_content();
drop trigger if exists ll_posts_auto_moderation_audit on public.ll_posts;
create trigger ll_posts_auto_moderation_audit after insert on public.ll_posts
  for each row execute function private.ll_record_auto_moderation();
drop trigger if exists ll_comments_auto_moderation_audit on public.ll_comments;
create trigger ll_comments_auto_moderation_audit after insert on public.ll_comments
  for each row execute function private.ll_record_auto_moderation();

create index if not exists ll_reports_queue_idx on public.ll_reports (status, created_at desc);
create index if not exists ll_reports_reporter_idx on public.ll_reports (reporter_id, created_at desc);
create index if not exists ll_blocks_blocked_user_idx on public.ll_blocks (blocked_user_id, blocker_id);
create index if not exists ll_moderation_events_entity_idx on public.ll_moderation_events (entity_type, entity_id, created_at desc);

create or replace function private.ll_is_blocked(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.ll_blocks b
    where (b.blocker_id = (select auth.uid()) and b.blocked_user_id = target_user_id)
       or (b.blocked_user_id = (select auth.uid()) and b.blocker_id = target_user_id)
  );
$$;
revoke all on function private.ll_is_blocked(uuid) from public;
grant execute on function private.ll_is_blocked(uuid) to anon, authenticated;
grant usage on schema private to anon;
grant execute on function private.is_lifeledger_admin() to anon;

create or replace function public.ll_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_lifeledger_admin();
$$;
revoke all on function public.ll_is_admin() from public, anon;
grant execute on function public.ll_is_admin() to authenticated;

create or replace view private.ll_reaction_counts
with (security_invoker = false)
as
  select post_id, count(*)::bigint as appreciation_count
  from public.ll_reactions
  group by post_id;
revoke all on table private.ll_reaction_counts from public;
grant select on table private.ll_reaction_counts to anon, authenticated;

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
security invoker
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
    coalesce(counts.appreciation_count, 0),
    (select count(*) from public.ll_comments c where c.post_id = p.id and c.status = 'published'),
    exists (
      select 1 from public.ll_reactions mine
      where mine.post_id = p.id and mine.user_id = (select auth.uid())
    )
  from public.ll_posts p
  left join public.ll_profiles profile on profile.user_id = p.author_id
  left join private.ll_reaction_counts counts on counts.post_id = p.id
  where p.status = 'published'
    and not private.ll_is_blocked(p.author_id)
  order by p.created_at desc
  limit 100;
$$;
revoke all on function public.ll_get_feed() from public;
grant execute on function public.ll_get_feed() to anon, authenticated;

create or replace function private.ll_enforce_content_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  action_name text;
  max_requests integer;
  window_size interval;
  current_count integer;
begin
  if tg_table_name = 'll_reports' then
    actor_id := new.reporter_id;
  else
    actor_id := new.author_id;
  end if;

  if actor_id is null or actor_id is distinct from (select auth.uid()) then
    raise exception 'Content author must match the authenticated user';
  end if;

  if tg_table_name = 'll_posts' then
    action_name := 'post';
    max_requests := 5;
    window_size := interval '10 minutes';
  elsif tg_table_name = 'll_comments' then
    action_name := 'comment';
    max_requests := 15;
    window_size := interval '10 minutes';
  else
    action_name := 'report';
    max_requests := 5;
    window_size := interval '1 hour';
  end if;

  insert into private.ll_content_rate_limits (user_id, action, window_started, request_count)
  values (actor_id, action_name, now(), 1)
  on conflict (user_id, action) do update
  set window_started = case
        when private.ll_content_rate_limits.window_started <= now() - window_size then now()
        else private.ll_content_rate_limits.window_started
      end,
      request_count = case
        when private.ll_content_rate_limits.window_started <= now() - window_size then 1
        else private.ll_content_rate_limits.request_count + 1
      end
  returning request_count into current_count;

  if current_count > max_requests then
    raise exception 'Content rate limit exceeded';
  end if;

  return new;
end;
$$;
revoke all on function private.ll_enforce_content_rate_limit() from public, anon, authenticated;

drop trigger if exists ll_posts_rate_limit on public.ll_posts;
create trigger ll_posts_rate_limit before insert on public.ll_posts
  for each row execute function private.ll_enforce_content_rate_limit();
drop trigger if exists ll_comments_rate_limit on public.ll_comments;
create trigger ll_comments_rate_limit before insert on public.ll_comments
  for each row execute function private.ll_enforce_content_rate_limit();
drop trigger if exists ll_reports_rate_limit on public.ll_reports;
create trigger ll_reports_rate_limit before insert on public.ll_reports
  for each row execute function private.ll_enforce_content_rate_limit();

alter table public.ll_posts enable row level security;
alter table public.ll_comments enable row level security;
alter table public.ll_reports enable row level security;
alter table public.ll_blocks enable row level security;
alter table public.ll_moderation_events enable row level security;

revoke all on table public.ll_posts, public.ll_comments, public.ll_reports, public.ll_blocks, public.ll_moderation_events from anon, authenticated;
grant select on table public.ll_posts, public.ll_comments to anon, authenticated;
grant insert (author_id, body, image_url) on table public.ll_posts to authenticated;
grant update (body, image_url, status, moderation_note) on table public.ll_posts to authenticated;
grant delete on table public.ll_posts to authenticated;
revoke select on table public.ll_reactions from anon, authenticated;
grant select (post_id, user_id) on table public.ll_reactions to anon, authenticated;
grant select on table public.ll_reports, public.ll_blocks, public.ll_moderation_events to authenticated;
grant insert (reporter_id, entity_type, entity_id, reason, details) on table public.ll_reports to authenticated;
grant update (status, reviewed_by, review_note, reviewed_at) on table public.ll_reports to authenticated;
grant insert, delete on table public.ll_blocks to authenticated;
grant insert on table public.ll_moderation_events to authenticated;

drop policy if exists "Public can read published posts" on public.ll_posts;
drop policy if exists "Members create their own posts" on public.ll_posts;
drop policy if exists "Members update their own posts" on public.ll_posts;
drop policy if exists "Members delete their own posts" on public.ll_posts;
create policy "Published posts are visible unless blocked"
  on public.ll_posts for select to anon, authenticated
  using (
    (status = 'published' and not private.ll_is_blocked(author_id))
    or (select auth.uid()) = author_id
    or private.is_lifeledger_admin()
  );
create policy "Members submit posts for review"
  on public.ll_posts for insert to authenticated
  with check ((select auth.uid()) = author_id and status = private.ll_content_status(body));
create policy "Members edit only their pending posts"
  on public.ll_posts for update to authenticated
  using ((select auth.uid()) = author_id and status = 'pending_review')
  with check ((select auth.uid()) = author_id and status = 'pending_review');
create policy "Members delete their own posts"
  on public.ll_posts for delete to authenticated
  using ((select auth.uid()) = author_id);
create policy "AAL2 admins moderate pending posts"
  on public.ll_posts for update to authenticated
  using (
    private.is_lifeledger_admin()
    and status in ('pending_review', 'published')
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    private.is_lifeledger_admin()
    and status in ('published', 'rejected', 'removed')
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

drop policy if exists "Public can read comments on published posts" on public.ll_comments;
drop policy if exists "Members add their own comments" on public.ll_comments;
drop policy if exists "Members delete their own comments" on public.ll_comments;
create policy "Published comments are visible on published posts"
  on public.ll_comments for select to anon, authenticated
  using (
    (status = 'published' and exists (
      select 1 from public.ll_posts p
      where p.id = post_id and p.status = 'published' and not private.ll_is_blocked(p.author_id)
    ))
    or (select auth.uid()) = author_id
    or private.is_lifeledger_admin()
  );
create policy "Members submit comments for review"
  on public.ll_comments for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and status = private.ll_content_status(body)
    and exists (
      select 1 from public.ll_posts p
      where p.id = post_id and p.status = 'published' and not private.ll_is_blocked(p.author_id)
    )
  );
create policy "Members delete their own comments"
  on public.ll_comments for delete to authenticated
  using ((select auth.uid()) = author_id);
create policy "AAL2 admins moderate pending comments"
  on public.ll_comments for update to authenticated
  using (
    private.is_lifeledger_admin()
    and status in ('pending_review', 'published')
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    private.is_lifeledger_admin()
    and status in ('published', 'rejected', 'removed')
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

drop policy if exists "Members read their own reactions" on public.ll_reactions;
create policy "Members read their own reactions"
  on public.ll_reactions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Reports are private to the reporter and admins" on public.ll_reports;
create policy "Reports are private to the reporter and admins"
  on public.ll_reports for select to authenticated
  using ((select auth.uid()) = reporter_id or private.is_lifeledger_admin());
create policy "Members report content"
  on public.ll_reports for insert to authenticated
  with check ((select auth.uid()) = reporter_id and status = 'open');
create policy "AAL2 admins resolve reports"
  on public.ll_reports for update to authenticated
  using (private.is_lifeledger_admin() and status in ('open', 'reviewing') and (select auth.jwt() ->> 'aal') = 'aal2')
  with check (
    private.is_lifeledger_admin()
    and status in ('reviewing', 'resolved', 'dismissed')
    and reviewed_by = (select auth.uid())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

drop policy if exists "Members manage their own blocks" on public.ll_blocks;
create policy "Members read their own blocks"
  on public.ll_blocks for select to authenticated
  using ((select auth.uid()) = blocker_id);
create policy "Members block other users"
  on public.ll_blocks for insert to authenticated
  with check ((select auth.uid()) = blocker_id and blocker_id <> blocked_user_id);
create policy "Members unblock users"
  on public.ll_blocks for delete to authenticated
  using ((select auth.uid()) = blocker_id);

drop policy if exists "AAL2 admins read moderation events" on public.ll_moderation_events;
create policy "AAL2 admins read moderation events"
  on public.ll_moderation_events for select to authenticated
  using (private.is_lifeledger_admin() and (select auth.jwt() ->> 'aal') = 'aal2');
create policy "AAL2 admins append moderation events"
  on public.ll_moderation_events for insert to authenticated
  with check (actor_id = (select auth.uid()) and private.is_lifeledger_admin() and (select auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "Admins review paid advertisements" on public.ll_ads;
drop policy if exists "AAL2 admins review paid advertisements" on public.ll_ads;
create policy "AAL2 admins review paid advertisements"
  on public.ll_ads for update to authenticated
  using (
    private.is_lifeledger_admin()
    and status in ('awaiting_review', 'approved')
    and payment_status = 'paid'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    private.is_lifeledger_admin()
    and status in ('approved', 'rejected')
    and payment_status = 'paid'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create or replace function public.ll_moderate_content(
  p_entity_type text,
  p_entity_id text,
  p_decision text,
  p_moderation_note text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  next_status text;
begin
  if actor_id is null
    or not private.is_lifeledger_admin()
    or (select auth.jwt() ->> 'aal') <> 'aal2' then
    raise exception 'Administrator authenticator verification required';
  end if;

  if char_length(coalesce(p_moderation_note, '')) > 1000 then
    raise exception 'Moderation note is too long';
  end if;

  if p_decision not in ('approve', 'reject', 'remove', 'resolve', 'dismiss') then
    raise exception 'Unsupported moderation decision';
  end if;

  if p_entity_type = 'post' and p_decision in ('approve', 'reject', 'remove') then
    next_status := case p_decision when 'approve' then 'published' when 'reject' then 'rejected' else 'removed' end;
    update public.ll_posts
      set status = next_status, moderation_note = nullif(p_moderation_note, '')
      where id = p_entity_id::uuid
        and status in ('pending_review', 'published');
  elsif p_entity_type = 'comment' and p_decision in ('approve', 'reject', 'remove') then
    next_status := case p_decision when 'approve' then 'published' when 'reject' then 'rejected' else 'removed' end;
    update public.ll_comments
      set status = next_status, moderation_note = nullif(p_moderation_note, '')
      where id = p_entity_id::uuid
        and status in ('pending_review', 'published');
  elsif p_entity_type = 'advertisement' and p_decision in ('approve', 'reject', 'remove') then
    next_status := case p_decision when 'approve' then 'approved' else 'rejected' end;
    update public.ll_ads
      set status = next_status,
          moderation_note = nullif(p_moderation_note, ''),
          reviewed_at = now()
      where id = p_entity_id and status in ('awaiting_review', 'approved') and payment_status = 'paid';
  elsif p_entity_type = 'report' and p_decision in ('resolve', 'dismiss') then
    next_status := case p_decision when 'resolve' then 'resolved' else 'dismissed' end;
    update public.ll_reports
      set status = next_status,
          reviewed_by = actor_id,
          review_note = nullif(p_moderation_note, ''),
          reviewed_at = now()
      where id = p_entity_id::uuid and status in ('open', 'reviewing');
  else
    raise exception 'Decision does not match the selected content type';
  end if;

  if not found then
    raise exception 'Content was already reviewed or is no longer available';
  end if;

  insert into public.ll_moderation_events (actor_id, actor_kind, entity_type, entity_id, action, note)
  values (actor_id, 'admin', p_entity_type, p_entity_id, p_decision, nullif(p_moderation_note, ''));
end;
$$;
revoke all on function public.ll_moderate_content(text, text, text, text) from public, anon;
grant execute on function public.ll_moderate_content(text, text, text, text) to authenticated;