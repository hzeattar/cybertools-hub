"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Check,
  Clipboard,
  Code2,
  Cpu,
  Crosshair,
  Database,
  FileText,
  Loader2,
  Lock,
  MessageSquare,
  Network,
  Paperclip,
  Plus,
  Radar,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { aiAgents, type AiAgent } from "@/lib/ai-agents";

type Props = {
  signedIn: boolean;
  pro: boolean;
};

type Conversation = {
  id: string;
  title: string;
  agentId: string;
  updatedAt: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  providerLabel?: string;
  provider?: string;
  fallback?: boolean;
  createdAt: string;
};

type MemoryCandidate = {
  id: string;
  content: string;
  reason: string;
};

type Memory = {
  id: string;
  content: string;
};

type WorkspaceError = {
  error?: string;
};

type ConversationResponse = WorkspaceError & {
  conversations?: Conversation[];
  conversation?: Conversation;
  agents?: AiAgent[];
};

type MessagesResponse = WorkspaceError & {
  messages?: Message[];
  memoryCandidates?: MemoryCandidate[];
  context?: { type: string; title: string; score: number }[];
  providerLabel?: string;
  fallback?: boolean;
  plan?: "free" | "pro";
  usage?: { used: number; limit: number };
};

type MemoriesResponse = WorkspaceError & {
  memories?: Memory[];
  pending?: MemoryCandidate[];
};

const starterPrompts = [
  {
    title: "API endpoint triage",
    prompt:
      "Review this authorized API surface and rank security review priority:\nGET /api/users/{id}\nPOST /api/admin/invites\nGET /api/invoices/{id}/download\nPATCH /api/accounts/{accountId}/billing",
  },
  {
    title: "Scope guard",
    prompt:
      "Convert this bug bounty policy into allowed, blocked, unclear, and safe next steps:\nIn scope: app.example.com and api.example.com\nOut of scope: employee systems, DoS, social engineering\nRate limits: keep testing low noise",
  },
  {
    title: "Report writer",
    prompt:
      "Turn these notes into an evidence-first vulnerability report:\nIssue: user can download another user's invoice by changing id\nScope: authorized test accounts only\nEvidence: redacted request and response\nImpact: invoice data exposure",
  },
];

const iconMap: Record<AiAgent["icon"], LucideIcon> = {
  shield: ShieldCheck,
  code: Code2,
  scope: Crosshair,
  report: FileText,
  threat: Radar,
  api: Network,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}

function AgentIcon({ agent }: { agent: AiAgent }) {
  const Icon = iconMap[agent.icon] ?? ShieldCheck;
  return <Icon size={16} />;
}

export function CyberAiClient({ signedIn, pro }: Props) {
  const [agents, setAgents] = useState<AiAgent[]>(aiAgents);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [pendingMemories, setPendingMemories] = useState<MemoryCandidate[]>([]);
  const [agentId, setAgentId] = useState<string>(aiAgents[0].id);
  const [input, setInput] = useState(starterPrompts[0].prompt);
  const [status, setStatus] = useState(signedIn ? "Workspace ready" : "Login required");
  const [provider, setProvider] = useState("Provider chain ready");
  const [contextLabels, setContextLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
  const activeAgent = agents.find((agent) => agent.id === agentId) ?? agents[0];
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");

  const groupedConversations = useMemo(
    () =>
      conversations.map((conversation) => ({
        ...conversation,
        age: formatDate(conversation.updatedAt),
      })),
    [conversations],
  );

  useEffect(() => {
    if (!signedIn) return;
    void refreshWorkspace();
    // The workspace should bootstrap only when auth state changes, not after every conversation state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  async function refreshWorkspace(selectConversationId?: string) {
    setLoading(true);
    setStatus("Loading conversations and memory...");
    try {
      const [conversationResponse, memoryResponse] = await Promise.all([
        fetch("/api/ai/conversations", { cache: "no-store" }),
        fetch("/api/ai/memories", { cache: "no-store" }),
      ]);
      const conversationData = (await conversationResponse.json().catch(() => ({}))) as ConversationResponse;
      const memoryData = (await memoryResponse.json().catch(() => ({}))) as MemoriesResponse;
      if (!conversationResponse.ok) throw new Error(conversationData.error ?? "Could not load conversations.");
      if (!memoryResponse.ok) throw new Error(memoryData.error ?? "Could not load memories.");

      const nextConversations = conversationData.conversations ?? [];
      setAgents(conversationData.agents?.length ? conversationData.agents : aiAgents);
      setConversations(nextConversations);
      setMemories(memoryData.memories ?? []);
      setPendingMemories(memoryData.pending ?? []);

      const nextActiveId = selectConversationId || activeConversationId || nextConversations[0]?.id || "";
      setActiveConversationId(nextActiveId);
      const nextActiveConversation = nextConversations.find((conversation) => conversation.id === nextActiveId);
      if (nextActiveConversation) setAgentId(nextActiveConversation.agentId);
      if (nextActiveId) await loadMessages(nextActiveId);
      else setMessages([]);
      setStatus(nextActiveId ? "Conversation loaded" : "Start a new security conversation");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function createNewConversation(nextAgentId = agentId) {
    setLoading(true);
    setStatus("Creating conversation...");
    try {
      const response = await fetch("/api/ai/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId: nextAgentId }),
      });
      const data = (await response.json().catch(() => ({}))) as ConversationResponse;
      if (!response.ok || !data.conversation) throw new Error(data.error ?? "Could not create conversation.");
      setConversations((current) => [data.conversation as Conversation, ...current]);
      setActiveConversationId(data.conversation.id);
      setMessages([]);
      setContextLabels([]);
      setAgentId(data.conversation.agentId);
      setStatus("New conversation ready");
      return data.conversation;
    } catch (error) {
      setStatus((error as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(conversationId: string) {
    const response = await fetch(`/api/ai/conversations/${encodeURIComponent(conversationId)}/messages`, {
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as MessagesResponse;
    if (!response.ok) throw new Error(data.error ?? "Could not load messages.");
    setMessages(data.messages ?? []);
    const conversation = conversations.find((item) => item.id === conversationId);
    if (conversation) setAgentId(conversation.agentId);
  }

  async function selectConversation(conversation: Conversation) {
    setActiveConversationId(conversation.id);
    setAgentId(conversation.agentId);
    setContextLabels([]);
    setStatus("Loading conversation...");
    try {
      await loadMessages(conversation.id);
      setStatus("Conversation loaded");
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!signedIn) {
      setStatus("Login is required before using Cyber AI.");
      return;
    }
    const cleanInput = input.trim();
    if (cleanInput.length < 8 || sending || loading) return;

    setSending(true);
    setStatus("Routing to defensive analyst...");
    try {
      let conversation = activeConversation;
      if (!conversation) conversation = (await createNewConversation(agentId)) ?? undefined;
      if (!conversation) throw new Error("Could not create a conversation.");

      const response = await fetch(`/api/ai/conversations/${encodeURIComponent(conversation.id)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: cleanInput, agentId }),
      });
      const data = (await response.json().catch(() => ({}))) as MessagesResponse;
      if (!response.ok) throw new Error(data.error ?? "Cyber AI request failed.");

      setMessages((current) => [...current, ...(data.messages ?? [])]);
      setPendingMemories((current) => [...(data.memoryCandidates ?? []), ...current]);
      setContextLabels((data.context ?? []).map((item) => `${item.type}: ${item.title}`));
      setProvider(`${data.providerLabel ?? "Cyber AI"}${data.fallback ? " fallback" : ""}`);
      const usageStatus = `${data.plan === "pro" ? "AI Pro" : "Free"} usage ${data.usage?.used ?? "?"}/${
        data.usage?.limit ?? "?"
      }`;
      setInput("");
      await refreshWorkspace(conversation.id);
      setStatus(usageStatus);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function approveMemory(candidateId: string) {
    const response = await fetch(`/api/ai/memories/${encodeURIComponent(candidateId)}/approve`, { method: "POST" });
    const data = (await response.json().catch(() => ({}))) as MemoriesResponse & { memory?: Memory };
    if (!response.ok || !data.memory) {
      setStatus(data.error ?? "Could not approve memory.");
      return;
    }
    setPendingMemories((current) => current.filter((candidate) => candidate.id !== candidateId));
    setMemories((current) => [data.memory as Memory, ...current]);
    setStatus("Memory approved and will be used as context.");
  }

  async function deleteMemory(candidateId: string) {
    const response = await fetch(`/api/ai/memories/${encodeURIComponent(candidateId)}/delete`, { method: "POST" });
    const data = (await response.json().catch(() => ({}))) as WorkspaceError;
    if (!response.ok) {
      setStatus(data.error ?? "Could not delete memory.");
      return;
    }
    setPendingMemories((current) => current.filter((candidate) => candidate.id !== candidateId));
    setStatus("Memory suggestion deleted.");
  }

  async function copyLastAnswer() {
    if (!lastAssistant) return;
    await navigator.clipboard.writeText(lastAssistant.content);
    setStatus("Latest analyst answer copied.");
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void sendMessage();
    }
  }

  if (!signedIn) {
    return (
      <div className="ai-chat-shell ai-chat-locked">
        <section className="panel ai-locked-panel">
          <Lock size={28} />
          <h2>Login required</h2>
          <p className="muted">
            Cyber AI Workspace keeps conversations, approved memories, and entitlements tied to your account.
          </p>
          <div className="button-row">
            <Link className="btn primary" href="/login?next=/assistant/cyber-ai">
              Login to use Cyber AI
            </Link>
            <Link className="btn secondary" href="/register?next=/assistant/cyber-ai">
              Create account
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="ai-chat-shell" data-testid="ai-workspace">
      <aside className="ai-chat-sidebar panel" aria-label="AI conversations">
        <div className="workspace-mini-header">
          <span className="ai-badge">
            <MessageSquare size={16} />
            Chats
          </span>
          <button className="icon-button" type="button" onClick={() => void refreshWorkspace()} aria-label="Refresh">
            <RefreshCcw size={16} />
          </button>
        </div>
        <button className="btn primary full-width" type="button" onClick={() => void createNewConversation()}>
          <Plus size={16} />
          New conversation
        </button>
        <div className="conversation-list">
          {groupedConversations.length ? (
            groupedConversations.map((conversation) => (
              <button
                className={`conversation-item ${conversation.id === activeConversationId ? "active" : ""}`}
                key={conversation.id}
                type="button"
                onClick={() => void selectConversation(conversation)}
              >
                <span>{conversation.title}</span>
                <small>{conversation.age}</small>
              </button>
            ))
          ) : (
            <div className="empty-state compact">
              <MessageSquare size={18} />
              <span>No conversations yet.</span>
            </div>
          )}
        </div>
      </aside>

      <section className="ai-chat-main panel">
        <header className="ai-chat-header">
          <div>
            <p className="eyebrow">{activeAgent.name}</p>
            <h2>{activeConversation?.title ?? "New Cyber AI conversation"}</h2>
          </div>
          <div className="provider-status">
            <Cpu size={15} />
            <span>{provider}</span>
          </div>
        </header>

        <div className="message-timeline" aria-live="polite">
          {messages.length ? (
            messages.map((message) => (
              <article className={`chat-message ${message.role}`} key={message.id}>
                <div className="message-avatar">{message.role === "user" ? <User size={16} /> : <Bot size={16} />}</div>
                <div className="message-bubble">
                  <div className="message-meta">
                    <strong>{message.role === "user" ? "You" : message.providerLabel ?? "Cyber AI"}</strong>
                    <span>{formatDate(message.createdAt)}</span>
                    {message.fallback ? <span className="tag teal">fallback</span> : null}
                  </div>
                  <p>{message.content}</p>
                </div>
              </article>
            ))
          ) : (
            <div className="ai-empty-board">
              <Sparkles size={28} />
              <h3>Start with a defensive security brief</h3>
              <p className="muted">
                Paste code, headers, OpenAPI routes, scope policy, or report notes. Prompts are not stored as long-term
                memory unless you approve a suggestion.
              </p>
              <div className="starter-grid">
                {starterPrompts.map((starter) => (
                  <button className="starter-card" key={starter.title} type="button" onClick={() => setInput(starter.prompt)}>
                    <strong>{starter.title}</strong>
                    <span>{starter.prompt.slice(0, 86)}...</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {sending ? (
            <article className="chat-message assistant">
              <div className="message-avatar">
                <Loader2 className="spin" size={16} />
              </div>
              <div className="message-bubble">
                <div className="message-meta">
                  <strong>Cyber AI</strong>
                  <span>working</span>
                </div>
                <p>Routing through providers, applying safety policy, and retrieving approved context.</p>
              </div>
            </article>
          ) : null}
        </div>

        <form className="composer" onSubmit={sendMessage}>
          <textarea
            aria-label="Message Cyber AI"
            placeholder={activeAgent.starterPrompt}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onComposerKeyDown}
          />
          <div className="composer-toolbar">
            <label className="agent-select-label">
              Agent
              <select className="select compact-select" value={agentId} onChange={(event) => setAgentId(event.target.value)}>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn secondary" type="button" disabled title="Attachments are planned for a later release.">
              <Paperclip size={16} />
              Attach
            </button>
            <button className="btn secondary" type="button" onClick={copyLastAnswer} disabled={!lastAssistant}>
              <Clipboard size={16} />
              Copy last
            </button>
            <button className="btn primary" type="submit" disabled={loading || sending || input.trim().length < 8}>
              <Send size={16} />
              Send
            </button>
          </div>
          <div className="ai-status-line">
            <Database size={15} />
            <span>
              {status}
              {loading ? "..." : ""}
            </span>
          </div>
        </form>
      </section>

      <aside className="ai-context-rail panel" aria-label="AI workspace context">
        <div className="rail-section">
          <div className="workspace-mini-header">
            <span className="ai-badge cyan">
              <Sparkles size={16} />
              {pro ? "AI Pro" : "Free"}
            </span>
            <span className="tag teal">{pro ? "100/day" : "20/day"}</span>
          </div>
          <p className="muted">
            Approved memory and local knowledge are retrieved before each answer. Private prompts are not auto-saved as
            permanent memory.
          </p>
        </div>

        <div className="rail-section">
          <h3>Agents</h3>
          <div className="agent-list">
            {agents.map((agent) => (
              <button
                className={`agent-card ${agent.id === agentId ? "active" : ""}`}
                key={agent.id}
                type="button"
                onClick={() => setAgentId(agent.id)}
              >
                <span className="agent-icon">
                  <AgentIcon agent={agent} />
                </span>
                <span>
                  <strong>{agent.shortName}</strong>
                  <small>{agent.description}</small>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rail-section">
          <h3>Memory suggestions</h3>
          {pendingMemories.length ? (
            pendingMemories.slice(0, 4).map((candidate) => (
              <article className="memory-card" key={candidate.id}>
                <p>{candidate.content}</p>
                <small>{candidate.reason}</small>
                <div className="button-row tight">
                  <button className="icon-button approve" type="button" onClick={() => void approveMemory(candidate.id)} aria-label="Approve memory">
                    <Check size={15} />
                  </button>
                  <button className="icon-button danger" type="button" onClick={() => void deleteMemory(candidate.id)} aria-label="Delete memory">
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="muted">No pending memory suggestions.</p>
          )}
        </div>

        <div className="rail-section">
          <h3>Approved memory</h3>
          {memories.length ? (
            memories.slice(0, 5).map((memory) => (
              <article className="memory-card approved" key={memory.id}>
                <p>{memory.content}</p>
              </article>
            ))
          ) : (
            <p className="muted">Approve a suggestion to reuse stable context in later chats.</p>
          )}
        </div>

        <div className="rail-section">
          <h3>Retrieved context</h3>
          {contextLabels.length ? (
            <div className="tag-row">
              {contextLabels.map((label) => (
                <span className="tag" key={label}>
                  {label}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">Relevant knowledge and approved memory will appear after a message.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
