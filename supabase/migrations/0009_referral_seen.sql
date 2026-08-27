-- ============================================================================
-- 0009_referral_seen — referral reward notifier (Session 23)
-- The referrer earns XP the moment their invitee finishes the taste sim, but is
-- almost never in the app then (cross-user credit from the invitee's session).
-- This flag lets /learn show a persisted, dismissible banner for rewards the
-- referrer has not acknowledged yet, so a reward earned while they were away is
-- never missed. Dismiss = markReferralRewardsSeen() sets the flag true.
--
-- The INVITEE side needs no persistence: they see an inline line on their own
-- taste-sim celebration, where they already are.
-- ============================================================================

alter table public.referral_rewards
  add column if not exists seen_by_referrer boolean not null default false;

-- The banner query is "unseen grants for this referrer" — a partial index keeps
-- it cheap and shrinks to near-nothing once rewards are acknowledged.
create index if not exists referral_rewards_unseen_idx
  on public.referral_rewards (referrer_id)
  where seen_by_referrer = false;
