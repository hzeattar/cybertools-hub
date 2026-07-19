import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

process.env.STORAGE_DRIVER = "json";
delete process.env.DATABASE_URL;

async function workspaceStore() {
  return import("../src/lib/ai-workspace-store.ts");
}

test("conversation titles preserve Arabic and trim long prompts", async () => {
  const { deriveConversationTitle } = await workspaceStore();
  assert.equal(deriveConversationTitle("   راجع نطاق برنامج Bug Bounty للتطبيق   "), "راجع نطاق برنامج Bug Bounty للتطبيق");
  assert.equal(deriveConversationTitle("x".repeat(70)).length, 54);
});

test("memory suggestions require stable non-secret context", async () => {
  const { suggestMemoryFromMessage } = await workspaceStore();
  const suggestion = suggestMemoryFromMessage("Remember my project stack uses Next.js, Railway, and Postgres.");
  assert.ok(suggestion);
  assert.equal(suggestion.reason.length > 0, true);
  assert.equal(suggestMemoryFromMessage("remember sk-test-secret-api-key password private key"), null);
  assert.equal(suggestMemoryFromMessage("short note"), null);
});

test("workspace store keeps conversations, messages, memory approval, and owner boundaries", async () => {
  const {
    appendMessage,
    approveMemoryCandidate,
    createConversation,
    createMemoryCandidate,
    getConversationForUser,
    listMemories,
    listMessagesForConversation,
    searchAiContext,
  } = await workspaceStore();
  const userId = `user-${crypto.randomUUID()}`;
  const otherUserId = `user-${crypto.randomUUID()}`;

  const conversation = await createConversation({ userId, agentId: "api-risk-mapper" });
  assert.equal(conversation.userId, userId);
  assert.equal(await getConversationForUser(otherUserId, conversation.id), null);

  const message = await appendMessage({
    userId,
    conversationId: conversation.id,
    role: "user",
    content: "Remember my project stack uses Next.js APIs and Railway Postgres for security reviews.",
  });
  const messages = await listMessagesForConversation(userId, conversation.id);
  assert.equal(messages?.length, 1);
  assert.equal(await listMessagesForConversation(otherUserId, conversation.id), null);

  const candidate = await createMemoryCandidate({
    userId,
    conversationId: conversation.id,
    messageId: message.id,
    content: message.content,
    reason: "Stable project context.",
  });
  const memory = await approveMemoryCandidate(userId, candidate.id);
  assert.equal(memory?.content, message.content);
  assert.equal((await listMemories(userId)).some((item) => item.id === memory?.id), true);

  const context = await searchAiContext(userId, "Rank API invoice endpoints for my Next.js Railway project", 6);
  assert.equal(context.some((match) => match.type === "memory"), true);
  assert.equal(context.some((match) => match.type === "knowledge"), true);
});
