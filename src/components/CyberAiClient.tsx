"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  BrainCircuit,
  Check,
  Clipboard,
  Cloud,
  Code2,
  Cpu,
  Crosshair,
  Database,
  Download,
  FileText,
  Fingerprint,
  Layers3,
  LifeBuoy,
  Loader2,
  Lock,
  MessageSquare,
  Network,
  PanelLeftOpen,
  PanelRightOpen,
  Paperclip,
  Plus,
  Radar,
  RefreshCcw,
  Search,
  Send,
  Server,
  ShieldCheck,
  Siren,
  Sparkles,
  Target,
  TerminalSquare,
  Trash2,
  User,
  Wand2,
  X,
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

type ProviderOption = {
  id: string;
  label: string;
  description: string;
  noKey?: boolean;
};

type ProviderAttempt = {
  provider: string;
  label: string;
  status: "success" | "skipped" | "failed";
  detail?: string;
};

type WorkspaceError = {
  error?: string;
};

type ConversationResponse = WorkspaceError & {
  conversations?: Conversation[];
  conversation?: Conversation;
  agents?: AiAgent[];
  providers?: ProviderOption[];
};

type MessagesResponse = WorkspaceError & {
  messages?: Message[];
  memoryCandidates?: MemoryCandidate[];
  context?: { type: string; title: string; score: number }[];
  provider?: string;
  providerLabel?: string;
  fallback?: boolean;
  attempts?: ProviderAttempt[];
  plan?: "free" | "pro";
  usage?: { used: number; limit: number };
};

type MemoriesResponse = WorkspaceError & {
  memories?: Memory[];
  pending?: MemoryCandidate[];
};

const starterPrompts = [
  {
    title: "Build a practical plan",
    prompt:
      "Help me plan the next release for my SaaS. Prioritize what should be built first, what can wait, and what tests should prove it works.",
  },
  {
    title: "Review code",
    prompt:
      "Review this code for bugs, maintainability, and security risks. Give exact issues, fixes, and tests:\n\n```ts\n// paste code here\n```",
  },
  {
    title: "Security report",
    prompt:
      "Turn these notes into a professional vulnerability report with summary, steps, impact, evidence placeholders, and remediation.",
  },
  {
    title: "API risk map",
    prompt:
      "Review this authorized API surface and rank security review priority:\nGET /api/users/{id}\nPOST /api/admin/invites\nGET /api/invoices/{id}/download\nPATCH /api/accounts/{accountId}/billing",
  },
];

const iconMap: Record<AiAgent["icon"], LucideIcon> = {
  spark: Sparkles,
  shield: ShieldCheck,
  code: Code2,
  terminal: TerminalSquare,
  architecture: Layers3,
  scope: Crosshair,
  report: FileText,
  threat: Radar,
  api: Network,
  target: Target,
  cloud: Cloud,
  incident: Siren,
  privacy: Fingerprint,
  ops: Server,
  memory: Database,
};

const defaultProviders: ProviderOption[] = [
  { id: "auto", label: "Auto router", description: "Configured providers, free cloud, then local." },
  { id: "pollinations", label: "Free cloud", description: "No-key cloud LLM fallback.", noKey: true },
  { id: "local", label: "Offline local", description: "Built-in deterministic reasoning.", noKey: true },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}

function deriveClientTitle(message: string) {
  const title = message.replace(/\s+/g, " ").trim();
  return title.length > 52 ? `${title.slice(0, 49)}...` : title;
}

function AgentIcon({ agent }: { agent: AiAgent }) {
  const Icon = iconMap[agent.icon] ?? ShieldCheck;
  return <Icon size={16} />;
}

export function CyberAiClient({ signedIn, pro }: Props) {
  const [agents, setAgents] = useState<AiAgent[]>(aiAgents);
  const [providers, setProviders] = useState<ProviderOption[]>(defaultProviders);
  const [providerPreference, setProviderPreference] = useState("auto");
  const [providerAttempts, setProviderAttempts] = useState<ProviderAttempt[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [pendingMemories, setPendingMemories] = useState<MemoryCandidate[]>([]);
  const [agentId, setAgentId] = useState<string>(aiAgents[0].id);
  const [input, setInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState(signedIn ? "Ready" : "Login required");
  const [provider, setProvider] = useState("Auto router ready");
  const [contextLabels, setContextLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
  const activeAgent = agents.find((agent) => agent.id === agentId) ?? agents[0];
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const lastUser = [...messages].reverse().find((message) => message.role === "user");

  const groupedConversations = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return conversations
      .filter((conversation) => !needle || conversation.title.toLowerCase().includes(needle))
      .map((conversation) => ({ ...conversation, age: formatDate(conversation.updatedAt) }));
  }, [conversations, searchTerm]);

  useEffect(() => {
    if (!signedIn) return;
    void refreshWorkspace();
    // The workspace should bootstrap only when auth state changes, not after every state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  useEffect(() => {
    const syncPanels = () => {
      const compact = window.matchMedia("(max-width: 820px)").matches;
      setSidebarOpen(!compact);
      setInspectorOpen(!compact);
    };
    syncPanels();
    window.addEventListener("resize", syncPanels);
    return () => window.removeEventListener("resize", syncPanels);
  }, []);

  useEffect(() => {
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function refreshWorkspace(selectConversationId?: string) {
    setLoading(true);
    setStatus("Loading workspace...");
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
      setProviders(conversationData.providers?.length ? conversationData.providers : defaultProviders);
      setConversations(nextConversations);
      setMemories(memoryData.memories ?? []);
      setPendingMemories(memoryData.pending ?? []);

      const nextActiveId = selectConversationId || activeConversationId || nextConversations[0]?.id || "";
      setActiveConversationId(nextActiveId);
      const nextConversation = nextConversations.find((conversation) => conversation.id === nextActiveId);
      if (nextConversation) setAgentId(nextConversation.agentId);
      if (nextActiveId) await loadMessages(nextActiveId, nextConversation);
      else setMessages([]);
      setStatus(nextActiveId ? "Conversation loaded" : "Start a new chat");
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
      setProviders(data.providers?.length ? data.providers : providers);
      setConversations((current) => [data.conversation as Conversation, ...current]);
      setActiveConversationId(data.conversation.id);
      setMessages([]);
      setContextLabels([]);
      setProviderAttempts([]);
      setAgentId(data.conversation.agentId);
      setStatus("New chat ready");
      return data.conversation;
    } catch (error) {
      setStatus((error as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(conversationId: string, knownConversation?: Conversation) {
    const response = await fetch(`/api/ai/conversations/${encodeURIComponent(conversationId)}/messages`, {
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as MessagesResponse;
    if (!response.ok) throw new Error(data.error ?? "Could not load messages.");
    setMessages(data.messages ?? []);
    const conversation = knownConversation ?? conversations.find((item) => item.id === conversationId);
    if (conversation) setAgentId(conversation.agentId);
  }

  async function selectConversation(conversation: Conversation) {
    setActiveConversationId(conversation.id);
    setAgentId(conversation.agentId);
    setContextLabels([]);
    setProviderAttempts([]);
    setStatus("Loading conversation...");
    try {
      await loadMessages(conversation.id, conversation);
      setStatus("Conversation loaded");
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>, overrideMessage?: string) {
    event?.preventDefault();
    if (!signedIn) {
      setStatus("Login is required before using CyberTools AI.");
      return;
    }
    const cleanInput = (overrideMessage ?? input).trim();
    if (cleanInput.length < 8 || sending || loading) return;

    setSending(true);
    setStatus("Routing request...");
    try {
      let conversation = activeConversation;
      if (!conversation) conversation = (await createNewConversation(agentId)) ?? undefined;
      if (!conversation) throw new Error("Could not create a conversation.");
      const optimisticUserMessage: Message = {
        id: `optimistic-${Date.now()}`,
        role: "user",
        content: cleanInput,
        createdAt: new Date().toISOString(),
      };
      setMessages((current) => [...current, optimisticUserMessage]);

      const response = await fetch(`/api/ai/conversations/${encodeURIComponent(conversation.id)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: cleanInput, agentId, providerPreference }),
      });
      const data = (await response.json().catch(() => ({}))) as MessagesResponse;
      if (!response.ok) throw new Error(data.error ?? "AI request failed.");

      const nextMessages = data.messages ?? [];
      if (nextMessages.length) {
        setMessages((current) => [
          ...current.filter((message) => message.id !== optimisticUserMessage.id),
          ...nextMessages,
        ]);
      } else {
        setMessages((current) => current.filter((message) => message.id !== optimisticUserMessage.id));
      }
      setPendingMemories((current) => [...(data.memoryCandidates ?? []), ...current]);
      setContextLabels((data.context ?? []).map((item) => `${item.type}: ${item.title}`));
      setProviderAttempts(data.attempts ?? []);
      setProvider(`${data.providerLabel ?? "CyberTools AI"}${data.fallback ? " after fallback" : ""}`);
      const usageStatus = `${data.plan === "pro" ? "AI Pro" : "Free"} usage ${data.usage?.used ?? "?"}/${
        data.usage?.limit ?? "?"
      }`;
      setInput("");
      const now = new Date().toISOString();
      setConversations((current) =>
        current
          .map((item) =>
            item.id === conversation.id
              ? {
                  ...item,
                  title: item.title === "New security chat" ? deriveClientTitle(cleanInput) : item.title,
                  updatedAt: now,
                }
              : item,
          )
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      );
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
    setStatus("Memory approved. It will be reused in future chats.");
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
    setStatus("Latest answer copied.");
  }

  function exportConversation() {
    const title = activeConversation?.title ?? "cybertools-ai-chat";
    const content = messages
      .map((message) => `## ${message.role === "user" ? "You" : message.providerLabel ?? "CyberTools AI"}\n\n${message.content}`)
      .join("\n\n");
    const blob = new Blob([`# ${title}\n\n${content}\n`], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.replace(/[^a-z0-9-]+/gi, "-").toLowerCase() || "chat"}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Conversation exported.");
  }

  async function attachTextFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const clipped = text.slice(0, pro ? 18_000 : 6_000);
    setInput((current) =>
      `${current.trim()}\n\nAttached file: ${file.name}\n\n\`\`\`\n${clipped}\n\`\`\``.trim(),
    );
    setStatus(`${file.name} attached as text.`);
    event.target.value = "";
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void sendMessage();
    }
  }

  if (!signedIn) {
    return (
      <div className="claude-ai-shell locked">
        <section className="claude-lock-panel">
          <div className="lock-orbit">
            <Lock size={28} />
          </div>
          <p className="eyebrow">CyberTools AI Workspace</p>
          <h1>Login to use the full AI workspace</h1>
          <p className="muted">
            Conversations, approved memory, usage limits, orders, and AI Pro access are tied to your account.
          </p>
          <div className="button-row">
            <Link className="btn primary" href="/login?next=/assistant/cyber-ai">
              Login
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
    <div
      className={`claude-ai-shell ${sidebarOpen ? "sidebar-open" : "sidebar-closed"} ${
        inspectorOpen ? "inspector-open" : "inspector-closed"
      }`}
      data-testid="ai-workspace"
    >
      <aside className="claude-sidebar" aria-label="AI conversations">
        <div className="claude-sidebar-head">
          <button className="new-chat-button" type="button" onClick={() => void createNewConversation()}>
            <Plus size={17} />
            New chat
          </button>
          <button className="soft-icon" type="button" onClick={() => void refreshWorkspace()} aria-label="Refresh">
            <RefreshCcw size={16} />
          </button>
        </div>

        <label className="sidebar-search">
          <Search size={15} />
          <input
            aria-label="Search conversations"
            placeholder="Search chats"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <div className="conversation-list claude-list">
          {groupedConversations.length ? (
            groupedConversations.map((conversation) => (
              <button
                className={`conversation-item claude-conversation ${conversation.id === activeConversationId ? "active" : ""}`}
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

        <div className="sidebar-foot">
          <span className="plan-pill">{pro ? "AI Pro 100/day" : "Free 20/day"}</span>
          <Link href="/contact">
            <LifeBuoy size={15} />
            Support
          </Link>
        </div>
      </aside>

      <section className="claude-main">
        <header className="claude-chat-top">
          <button
            className="soft-icon"
            type="button"
            onClick={() => setSidebarOpen((current) => !current)}
            aria-label="Toggle conversations"
          >
            <PanelLeftOpen size={17} />
          </button>
          <div className="chat-title-block">
            <span>{activeAgent.name}</span>
            <strong>{activeConversation?.title ?? "New chat"}</strong>
          </div>
          <div className="chat-top-actions">
            <span className="provider-chip">
              <Cpu size={14} />
              {provider}
            </span>
            <button
              className="soft-icon"
              type="button"
              onClick={() => setInspectorOpen((current) => !current)}
              aria-label="Toggle context panel"
            >
              <PanelRightOpen size={17} />
            </button>
          </div>
        </header>

        <div className="claude-messages" ref={timelineRef} aria-live="polite">
          {messages.length ? (
            messages.map((message) => (
              <article className={`claude-message ${message.role}`} key={message.id}>
                <div className="message-avatar">{message.role === "user" ? <User size={16} /> : <Bot size={16} />}</div>
                <div className="claude-bubble">
                  <div className="message-meta">
                    <strong>{message.role === "user" ? "You" : message.providerLabel ?? "CyberTools AI"}</strong>
                    <span>{formatDate(message.createdAt)}</span>
                    {message.fallback ? <span className="tag coral">fallback</span> : null}
                  </div>
                  <div className="message-content">{message.content}</div>
                </div>
              </article>
            ))
          ) : (
            <div className="claude-empty">
              <span className="ai-mark">
                <BrainCircuit size={22} />
              </span>
              <h1>What should we work on?</h1>
              <p>
                Ask for coding, product planning, writing, learning, or authorized security analysis. Memory is suggested
                first and only saved after approval.
              </p>
              <div className="agent-chip-grid">
                {agents.slice(0, 8).map((agent) => (
                  <button
                    className={`agent-chip ${agent.id === agentId ? "active" : ""}`}
                    key={agent.id}
                    type="button"
                    onClick={() => {
                      setAgentId(agent.id);
                      setInput(agent.starterPrompt);
                    }}
                  >
                    <AgentIcon agent={agent} />
                    <span>{agent.shortName}</span>
                  </button>
                ))}
              </div>
              <div className="starter-grid claude-starters">
                {starterPrompts.map((starter) => (
                  <button className="starter-card" key={starter.title} type="button" onClick={() => setInput(starter.prompt)}>
                    <strong>{starter.title}</strong>
                    <span>{starter.prompt.slice(0, 92)}...</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {sending ? (
            <article className="claude-message assistant">
              <div className="message-avatar">
                <Loader2 className="spin" size={16} />
              </div>
              <div className="claude-bubble">
                <div className="message-meta">
                  <strong>CyberTools AI</strong>
                  <span>working</span>
                </div>
                <div className="message-content">
                  Routing through provider chain, retrieving approved memory, and preparing the response.
                </div>
              </div>
            </article>
          ) : null}
        </div>

        <form className="claude-composer" onSubmit={sendMessage}>
          <textarea
            aria-label="Message Cyber AI"
            placeholder={activeAgent.starterPrompt}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onComposerKeyDown}
          />
          <div className="composer-bottom">
            <div className="composer-selects">
              <label>
                Agent
                <select aria-label="Agent" value={agentId} onChange={(event) => setAgentId(event.target.value)}>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Provider
                <select
                  aria-label="Provider"
                  value={providerPreference}
                  onChange={(event) => setProviderPreference(event.target.value)}
                >
                  {providers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="composer-actions">
              <input ref={fileInputRef} type="file" accept=".txt,.md,.json,.yaml,.yml,.js,.ts,.tsx,.py,.go,.java,.cs,.php,.rb,.rs,.sql,.html,.css,.xml" hidden onChange={attachTextFile} />
              <button className="soft-button" type="button" onClick={() => fileInputRef.current?.click()}>
                <Paperclip size={16} />
                Attach
              </button>
              <button className="soft-button" type="button" onClick={copyLastAnswer} disabled={!lastAssistant}>
                <Clipboard size={16} />
                Copy
              </button>
              <button className="soft-button" type="button" onClick={exportConversation} disabled={!messages.length}>
                <Download size={16} />
                Export
              </button>
              <button
                className="soft-button"
                type="button"
                onClick={() => (lastUser ? void sendMessage(undefined, lastUser.content) : setStatus("No user prompt to retry."))}
                disabled={!lastUser || sending}
              >
                <Wand2 size={16} />
                Retry
              </button>
              <button className="send-button" type="submit" disabled={loading || sending || input.trim().length < 8}>
                {sending ? <Loader2 className="spin" size={17} /> : <Send size={17} />}
                Send
              </button>
            </div>
          </div>
          <div className="composer-status">
            <Database size={14} />
            <span>{status}</span>
          </div>
        </form>
      </section>

      <aside className="claude-inspector" aria-label="AI context and memory">
        <div className="inspector-head">
          <div>
            <span>Workspace</span>
            <strong>Context, memory, agents</strong>
          </div>
          <button className="soft-icon" type="button" onClick={() => setInspectorOpen(false)} aria-label="Close context panel">
            <X size={16} />
          </button>
        </div>

        <section className="inspector-section">
          <h3>Provider Route</h3>
          <p className="muted">
            Auto uses paid/configured providers first, then Free Cloud, then Offline Local only if every external provider fails.
          </p>
          <div className="provider-attempts">
            {providerAttempts.length ? (
              providerAttempts.map((attempt, index) => (
                <div className={`provider-attempt ${attempt.status}`} key={`${attempt.provider}-${index}`}>
                  <span>{attempt.label}</span>
                  <strong>{attempt.status}</strong>
                  {attempt.detail ? <small>{attempt.detail}</small> : null}
                </div>
              ))
            ) : (
              <p className="muted">Send a message to see the provider route.</p>
            )}
          </div>
        </section>

        <section className="inspector-section">
          <h3>Agents</h3>
          <div className="agent-list compact-agents">
            {agents.map((agent) => (
              <button
                className={`agent-card ${agent.id === agentId ? "active" : ""}`}
                key={agent.id}
                type="button"
                onClick={() => {
                  setAgentId(agent.id);
                  setInput((current) => current || agent.starterPrompt);
                }}
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
        </section>

        <section className="inspector-section">
          <h3>Memory Suggestions</h3>
          {pendingMemories.length ? (
            pendingMemories.slice(0, 5).map((candidate) => (
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
        </section>

        <section className="inspector-section">
          <h3>Approved Memory</h3>
          {memories.length ? (
            memories.slice(0, 6).map((memory) => (
              <article className="memory-card approved" key={memory.id}>
                <p>{memory.content}</p>
              </article>
            ))
          ) : (
            <p className="muted">Approve a suggestion to reuse stable preferences, project facts, and scope rules.</p>
          )}
        </section>

        <section className="inspector-section">
          <h3>Retrieved Context</h3>
          {contextLabels.length ? (
            <div className="tag-row">
              {contextLabels.map((label) => (
                <span className="tag" key={label}>
                  {label}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">Relevant memory and knowledge appear here after a message.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
