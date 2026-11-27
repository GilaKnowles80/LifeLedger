-- Run once in the Supabase SQL Editor after creating and verifying your owner account.
-- Replace the email with the verified address used by that account.
insert into private.ll_admins (user_id)
select id
from auth.users
where lower(email) = lower('replace-with-your-verified-email@example.com')
limit 1
on conflict (user_id) do nothing;

-- Check that the owner was added before closing the SQL Editor:
select p.display_name, p.username, a.created_at
from private.ll_admins a
join public.ll_profiles p on p.user_id = a.user_id;