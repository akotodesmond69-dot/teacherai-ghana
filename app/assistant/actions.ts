// Purpose: Handles sending a message in the Teacher AI Assistant chat —
// creates a conversation if needed, saves the user's message, fetches
// history, calls the AI, saves and returns its reply.
// Folder: app/assistant/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActivePremium } from '@/lib/payments/plans'
import { generateAssistantReply, type ChatMessage } from '@/lib/assistant/generateAssistantReply'

const FREE_TIER_MONTHLY_LIMIT = 30 // higher than lessons/assessments —
                                    // chat messages are a lighter-weight action

export async function sendAssistantMessageAction(
  conversationId: string | null,
  userMessage: string
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to use the assistant.' }

  const { data: teacher } = await supabase
    .from('teachers')
    .select('subscription_tier, subscription_expires_at, messages_used_this_month')
    .eq('id', user.id)
    .single()

  if (!teacher) return { error: 'Could not load your account.' }

  const isPremium = hasActivePremium(teacher)
  if (
    !isPremium &&
    teacher.messages_used_this_month >= FREE_TIER_MONTHLY_LIMIT
  ) {
    return { error: `You've used all ${FREE_TIER_MONTHLY_LIMIT} free assistant messages this month.` }
  }

  // Create a new conversation on the very first message, otherwise use the
  // existing one — same "first message of a thread" pattern most chat
  // apps use.
  let activeConversationId = conversationId
  if (!activeConversationId) {
    const { data: newConversation, error } = await supabase
      .from('assistant_conversations')
      .insert({ teacher_id: user.id, title: userMessage.slice(0, 60) })
      .select('id')
      .single()

    if (error || !newConversation) return { error: 'Could not start a new conversation.' }
    activeConversationId = newConversation.id
  }

  // Save the teacher's message first — so it's never lost even if the AI
  // call below fails.
  await supabase.from('assistant_messages').insert({
    conversation_id: activeConversationId,
    role: 'user',
    content: userMessage,
  })

  // Fetch the recent history to give the AI conversational context.
  const { data: history } = await supabase
    .from('assistant_messages')
    .select('role, content')
    .eq('conversation_id', activeConversationId)
    .order('created_at', { ascending: true })
    .limit(20) // cap history length — keeps requests fast and affordable
               // as a conversation grows long

  let replyText: string
  try {
    replyText = await generateAssistantReply((history ?? []) as ChatMessage[])
  } catch {
    return {
      conversationId: activeConversationId,
      error: 'Something went wrong getting a response. Please try again.',
    }
  }

  await supabase.from('assistant_messages').insert({
    conversation_id: activeConversationId,
    role: 'assistant',
    content: replyText,
  })

  await supabase
    .from('teachers')
    .update({ messages_used_this_month: teacher.messages_used_this_month + 1 })
    .eq('id', user.id)

  return { conversationId: activeConversationId, reply: replyText }
}

// Testing steps:
// 1. Send a first message with conversationId = null.
//    Expected: a new conversation is created, both messages saved,
//    { conversationId, reply } returned.
// 2. Send a follow-up with that same conversationId.
//    Expected: the AI's reply shows awareness of the earlier message
//    (e.g. "as I mentioned...") — confirms history is being passed correctly.
