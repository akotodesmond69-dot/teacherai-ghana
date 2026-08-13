-- ============================================================================
-- TeacherAI Ghana — Phase 11: Teacher AI Assistant tables
-- Run this AFTER phase10_schemes_table.sql
-- ============================================================================

create table assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now()
);

comment on table assistant_conversations is 'One chat thread between a teacher and the AI assistant.';

create table assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references assistant_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

comment on table assistant_messages is 'Individual messages within a conversation, in order by created_at.';

create index idx_assistant_messages_conversation on assistant_messages(conversation_id, created_at);
create index idx_assistant_conversations_teacher on assistant_conversations(teacher_id);

alter table assistant_conversations enable row level security;
alter table assistant_messages enable row level security;

create policy "Teachers can view their own conversations"
  on assistant_conversations for select
  using (auth.uid() = teacher_id);

create policy "Teachers can create their own conversations"
  on assistant_conversations for insert
  with check (auth.uid() = teacher_id);

-- Messages don't have a teacher_id column directly, so their policy checks
-- ownership by looking up the parent conversation's teacher_id instead.
-- WHY this is safe: the subquery itself is also protected by the
-- conversations table's own RLS policy above, so there's no bypass here.
create policy "Teachers can view messages in their own conversations"
  on assistant_messages for select
  using (
    exists (
      select 1 from assistant_conversations
      where assistant_conversations.id = assistant_messages.conversation_id
      and assistant_conversations.teacher_id = auth.uid()
    )
  );

create policy "Teachers can add messages to their own conversations"
  on assistant_messages for insert
  with check (
    exists (
      select 1 from assistant_conversations
      where assistant_conversations.id = assistant_messages.conversation_id
      and assistant_conversations.teacher_id = auth.uid()
    )
  );

alter table teachers add column messages_used_this_month int not null default 0;

-- ============================================================================
-- Testing steps:
-- 1. Apply this migration.
-- 2. As teacher A, create a conversation and a message in it.
-- 3. As teacher B, try to select that conversation's messages.
--    Expected: zero rows — the "exists" subquery policy blocks it.
-- ============================================================================
