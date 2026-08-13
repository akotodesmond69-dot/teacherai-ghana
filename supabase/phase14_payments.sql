-- ============================================================================
-- TeacherAI Ghana — Phase 14: Subscriptions & Payments (Paystack)
-- Run this AFTER phase13_community_curriculum.sql
-- ============================================================================

-- WHY subscription_expires_at, not just subscription_tier: "paid" isn't
-- forever — a teacher pays per term. Without an expiry date, we'd have no
-- way to know when to quietly drop someone back to the free tier once
-- their term-based subscription lapses.
alter table teachers add column subscription_expires_at timestamptz;

-- ----------------------------------------------------------------------------
-- payments: one row per payment attempt. WHY we log every attempt, not just
-- successful ones: this is our idempotency record (never process the same
-- Paystack reference twice) and our audit trail if a teacher disputes a
-- charge or a payment gets stuck.
-- ----------------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  paystack_reference text not null unique,
  amount_pesewas int not null,       -- Ghana's smallest currency unit (like kobo/cents)
  plan text not null,                -- e.g. 'teacher_premium_term'
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  created_at timestamptz not null default now()
);

comment on table payments is 'Log of every Paystack payment attempt — the unique paystack_reference prevents double-processing the same payment.';

create index idx_payments_teacher on payments(teacher_id);
create index idx_payments_reference on payments(paystack_reference);

alter table payments enable row level security;

create policy "Teachers can view their own payments"
  on payments for select
  using (auth.uid() = teacher_id);

-- WHY no insert/update policy for teachers here: payments are only ever
-- written by our server code using the service_role key (in the payment
-- initiation action and the webhook handler) — never directly by a
-- teacher's browser session. This is the same reasoning as the Phase 5
-- seed script needing the service key: this table must not be writable
-- by a client, even the legitimate owner of the row.

-- ============================================================================
-- Testing steps:
-- 1. Apply this migration.
-- 2. Confirm teachers has a new subscription_expires_at column (nullable).
-- 3. Confirm the payments table exists with RLS enabled and only a SELECT
--    policy — try inserting a row as a normal teacher (not service role)
--    and confirm it's rejected.
-- ============================================================================
