
import { useEffect, useRef, useState } from "react";
import {
  Sparkles, Plus, History, Search, Settings, CircleHelp,
  Crown, MessageCircle, Code2, Plane, Lightbulb, Paperclip,
  Image as ImageIcon, Brain, Mic, Send, Menu, X, ChevronDown,
  MoreHorizontal, Sun, Moon, Copy, Check, RefreshCw, Trash2,
  PanelLeftClose, LogOut
} from "lucide-react";

const STORAGE_KEY = "nexa-ai-chats-v1";

const suggestions = [
  {
    title: "Explain Code",
    description: "Can you explain this code step by step?",
    icon: Code2,
    prompt: "Explain how JavaScript works and show me a simple example."
  },
  {
    title: "Plan a Trip",
    description: "Create a 5-day budget-friendly itinerary.",
    icon: Plane,
    prompt: "Create a detailed 5-day budget-friendly travel itinerary for Lahore."
  },
  {
    title: "Brainstorm Ideas",
    description: "Let's turn an idea into something amazing.",
    icon: Lightbulb,
    prompt: "Give me 5 creative ideas for a modern technology project."
  }
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeChat() {
  return {
    id: makeId(),
    title: "New conversation",
    updatedAt: Date.now(),
    messages: []
  };
}

function readChats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function demoReply(prompt) {
  const text = prompt.toLowerCase();

  if (text.includes("javascript") || text.includes("code")) {
    return "Let's break it down step by step.\n\n1. **Understand the goal:** Identify what the code should accomplish.\n2. **Divide the problem:** Separate it into smaller, manageable tasks.\n3. **Write the logic:** Use variables, functions, and conditions as needed.\n4. **Test the result:** Try different inputs and handle possible errors.\n\nShare your code with me to get a more specific explanation.\n\n*Demo response: connect a secure AI API to enable real AI-generated answers.*";
  }

  if (text.includes("trip") || text.includes("travel") || text.includes("lahore")) {
    return "Here's a simple way to organise your trip:\n\n**Day 1:** Explore the historic city centre.\n\n**Day 2:** Visit cultural landmarks and local markets.\n\n**Day 3:** Discover museums, gardens, and local food.\n\n**Day 4:** Explore a new neighbourhood and enjoy local experiences.\n\n**Day 5:** Keep the day flexible for shopping and your return journey.\n\nSet a daily budget for transport, meals, and entry tickets before you travel.\n\n*Demo response: verify current opening hours, prices, and travel information before your trip.*";
  }

  return `Great question! Let's work through this together.\n\n**Your question:** ${prompt}\n\nHere's a useful approach:\n\n1. **Define your goal** — decide what you want to achieve.\n2. **Explore your options** — consider a few different approaches.\n3. **Create a plan** — break the next steps into manageable tasks.\n4. **Review and improve** — test your ideas and refine the result.\n\nThis is a sample response from the Nexa AI frontend prototype. Connect a real AI API to receive answers generated specifically for your questions.`;
}

export default function App() {
  const [chats, setChats] = useState(readChats);
const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lightMode, setLightMode] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [notice, setNotice] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  const textareaRef = useRef(null);
  const bottomRef = useRef(null);
  const activeChat = chats.find((chat) => chat.id === activeId);
  const messages = activeChat?.messages || [];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function updateChat(id, updater) {
    setChats((previous) =>
      previous.map((chat) => chat.id === id ? updater(chat) : chat)
    );
  }

  function newChat() {
  setActiveId(null);
  setInput("");
  setSidebarOpen(false);
  setNotice("");
  setShowMenu(false);
}

  function openChat(id) {
    setActiveId(id);
    setSidebarOpen(false);
    setNotice("");
  }

  function deleteChat(id) {
    const remaining = chats.filter((chat) => chat.id !== id);
    setChats(remaining);
    if (activeId === id) {
      setActiveId(remaining[0]?.id || null);
    }
  }

  function renameChat(chat) {
    const title = window.prompt("Enter a new conversation title:", chat.title);
    if (!title?.trim()) return;

    updateChat(chat.id, (current) => ({
      ...current,
      title: title.trim(),
      updatedAt: Date.now()
    }));
  }

  async function sendMessage(text = input) {
    const prompt = text.trim();
    if (!prompt || thinking) return;

    let chatId = activeId;
    let currentChat = chats.find((chat) => chat.id === chatId);

    if (!currentChat) {
      currentChat = makeChat();
      chatId = currentChat.id;
      setActiveId(chatId);
      setChats((previous) => [currentChat, ...previous]);
    }

    const userMessage = {
      id: makeId(),
      role: "user",
      content: prompt
    };

    const previousMessages = currentChat.messages
      .filter((message) => ["user", "assistant"].includes(message.role))
      .map(({ role, content }) => ({ role, content }));

    updateChat(chatId, (chat) => ({
      ...chat,
      title: chat.messages.length === 0
        ? prompt.slice(0, 36) + (prompt.length > 36 ? "…" : "")
        : chat.title,
      updatedAt: Date.now(),
      messages: [...chat.messages, userMessage]
    }));

    setInput("");
    setThinking(true);
    setNotice("");
    setSidebarOpen(false);

    try {
     const response = await fetch("https://nexa-ai-chatbot.23-st-028.workers.dev/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...previousMessages, { role: "user", content: prompt }]
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `AI request failed (${response.status}).`);
      }
      if (typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("The AI returned an empty response.");
      }

      const assistantMessage = {
        id: makeId(),
        role: "assistant",
        content: data.reply
      };

      updateChat(chatId, (chat) => ({
        ...chat,
        updatedAt: Date.now(),
        messages: [...chat.messages, assistantMessage]
      }));
    } catch (error) {
      setNotice(error.message || "Unable to connect to Nexa AI. Please try again.");
    } finally {
      setThinking(false);
    }
  }

  async function regenerate(messageIndex) {
    const previousUserMessage = messages
      .slice(0, messageIndex)
      .reverse()
      .find((message) => message.role === "user");

    if (!previousUserMessage || thinking || !activeId) return;

    const chatId = activeId;
    const history = messages
      .slice(0, messageIndex)
      .filter((message) => ["user", "assistant"].includes(message.role))
      .map(({ role, content }) => ({ role, content }));

    setThinking(true);
    setNotice("");
    updateChat(chatId, (chat) => ({
      ...chat,
      messages: chat.messages.slice(0, messageIndex)
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `AI request failed (${response.status}).`);
      }
      if (typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("The AI returned an empty response.");
      }
      updateChat(chatId, (chat) => ({
        ...chat,
        updatedAt: Date.now(),
        messages: [...chat.messages, {
          id: makeId(),
          role: "assistant",
          content: data.reply
        }]
      }));
    } catch (error) {
      setNotice(error.message || "Unable to regenerate the response.");
    } finally {
      setThinking(false);
    }
  }

  async function copyMessage(message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setNotice("Copy is unavailable in this browser context.");
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  const visibleChats = chats
    .filter((chat) => chat.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className={`app ${lightMode ? "light-mode" : ""}`}>
      <div className="browser">
        <div className="browser-bar">
          <div className="traffic">
            <span />
            <span />
            <span />
          </div>
          <div className="address">🔒 &nbsp; nexaai.app</div>
          <button
            className="icon-btn"
            title={lightMode ? "Dark mode" : "Light mode"}
            onClick={() => setLightMode((value) => !value)}
          >
            {lightMode ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>

        <div className="workspace">
          <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
            <div className="brand">
              <div className="brand-mark">N</div>
              <div>
                <div className="brand-name">Nexa <span>AI</span></div>
                <div className="brand-caption">AI Assistant</div>
              </div>
              <button
                className="icon-btn"
                style={{ marginLeft: "auto" }}
                onClick={() => setSidebarOpen(false)}
                title="Close sidebar"
              >
                <X size={18} />
              </button>
            </div>

            <button className="primary-btn" onClick={newChat}>
              <Plus size={19} /> New Chat
            </button>

            <div className="section-label">
              <History size={19} />
              <span>Recent</span>
              <span className="spacer" />
              <button
                className="icon-btn"
                title="Search conversations"
                onClick={() => setSearchOpen((value) => !value)}
              >
                <Search size={18} />
              </button>
            </div>

            {searchOpen && (
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conversations..."
                aria-label="Search conversations"
                style={{
                  width: "100%",
                  padding: 11,
                  color: "inherit",
                  background: "#151a35",
                  border: "1px solid var(--border)",
                  borderRadius: 10
                }}
              />
            )}

            <div className="recent-list">
              {visibleChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`recent-item ${chat.id === activeId ? "active" : ""}`}
                >
                  <button
                    className="icon-btn"
                    onClick={() => openChat(chat.id)}
                    title="Open conversation"
                  >
                    <MessageCircle size={17} />
                  </button>

                  <button
                    onClick={() => openChat(chat.id)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: "left",
                      border: 0,
                      padding: 0,
                      background: "transparent",
                      color: "inherit"
                    }}
                  >
                    <span className="recent-title">{chat.title}</span>
                    <span className="recent-date">
                      {new Date(chat.updatedAt).toLocaleDateString()}
                    </span>
                  </button>

                  <button
                    className="icon-btn"
                    title="Rename conversation"
                    onClick={() => renameChat(chat)}
                  >
                    <MoreHorizontal size={17} />
                  </button>
                  <button
                    className="icon-btn"
                    title="Delete conversation"
                    onClick={() => deleteChat(chat.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}

              {visibleChats.length === 0 && (
                <div className="empty-history">No matching conversations.</div>
              )}
            </div>

            <div className="sidebar-bottom">
              <button
                className="side-link"
                onClick={() => setNotice("Theme and chat preferences are available in this frontend prototype.")}
              >
                <Settings size={19} /> Settings
              </button>
              <button
                className="side-link"
                onClick={() => setNotice("Nexa AI frontend prototype — backend setup comes next.")}
              >
                <CircleHelp size={19} /> Help & Support
              </button>

              <div className="upgrade">
                <div className="upgrade-heading">
                  <span className="upgrade-icon"><Crown size={20} /></span>
                  Upgrade to Pro
                </div>
                <p>Explore a premium AI experience with more possibilities and powerful features.</p>
                <button
                  className="primary-btn"
                  onClick={() => setNotice("Pro plans are a future feature. No payment is being taken.")}
                >
                  Explore Pro <span>→</span>
                </button>
              </div>

              <div className="profile">
                <div className="avatar">N</div>
                <div>
                  <div className="profile-name">Nexa User</div>
                  <div className="profile-email">Guest workspace</div>
                </div>
                <span style={{ marginLeft: "auto", color: "#a6a9ce" }}>
                  <LogOut size={17} />
                </span>
              </div>
            </div>
          </aside>

          <main className="main-panel">
            <div className="top-controls">
              <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                <button
                  className="icon-btn mobile-menu"
                  title="Open sidebar"
                  onClick={() => setSidebarOpen((value) => !value)}
                >
                  <Menu size={20} />
                </button>
                <button
                  className="model-select"
                  onClick={() => setNotice("AI model selection will be enabled when the AI backend is connected.")}
                >
                  <Sparkles size={17} /> Nexa AI <ChevronDown size={15} />
                </button>
              </div>

              <div style={{ position: "relative" }}>
                <button
                  className="more-btn"
                  title="More options"
                  onClick={() => setShowMenu((value) => !value)}
                >
                  <MoreHorizontal size={21} />
                </button>
                {showMenu && (
                  <div style={{
                    position: "absolute",
                    right: 0,
                    top: 49,
                    zIndex: 5,
                    width: 180,
                    padding: 8,
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    background: "#121831",
                    boxShadow: "0 10px 35px #0006"
                  }}>
                    <button className="side-link" onClick={() => { newChat(); setShowMenu(false); }}>
                      <Plus size={16} /> New conversation
                    </button>
                    <button className="side-link" onClick={() => { setLightMode(!lightMode); setShowMenu(false); }}>
                      {lightMode ? <Moon size={16} /> : <Sun size={16} />} Toggle theme
                    </button>
                  </div>
                )}
              </div>
            </div>

            {messages.length === 0 ? (
              <div className="welcome">
                <div className="orb" aria-label="Nexa AI glowing orb">
                  <div className="orb-core" />
                </div>
                <h1>Welcome to <span className="gradient-text">Nexa AI</span></h1>
                <p className="subtitle">Your ideas. Your AI. Your next step.</p>

                <div className="suggestions">
                  {suggestions.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        className="suggestion"
                        key={item.title}
                        onClick={() => sendMessage(item.prompt)}
                      >
                        <div className="suggestion-head">
                          <span className="suggestion-icon"><Icon size={22} /></span>
                          <span>{item.title}</span>
                        </div>
                        <p>“{item.description}”</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="chat-view">
                {messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`message ${message.role === "user" ? "user" : ""}`}
                  >
                    {message.role === "assistant" && (
                      <div className="message-avatar"><Sparkles size={18} /></div>
                    )}

                    <div className="message-body">
                      <div className="message-role">
                        {message.role === "user" ? "You" : "Nexa AI"}
                      </div>
                      <div className="message-content">{message.content}</div>

                      {message.role === "assistant" && (
                        <div className="message-actions">
                          <button onClick={() => copyMessage(message)}>
                            {copiedId === message.id
                              ? <Check size={14} />
                              : <Copy size={14} />}
                            {copiedId === message.id ? "Copied" : "Copy"}
                          </button>
                          <button
                            onClick={() => regenerate(index)}
                            disabled={thinking}
                          >
                            <RefreshCw size={13} /> Regenerate
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {thinking && (
                  <div className="message">
                    <div className="message-avatar"><Sparkles size={18} /></div>
                    <div className="message-body">
                      <div className="message-role">Nexa AI</div>
                      <div className="message-content">Preparing a sample response…</div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}

            {notice && (
              <div role="status" style={{
                position: "absolute",
                top: 76,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 4,
                width: "max-content",
                maxWidth: "90%",
                padding: "11px 15px",
                color: "#e8dcff",
                background: "#27204a",
                border: "1px solid #8c5cff75",
                borderRadius: 12,
                fontSize: 12
              }}>
                {notice}
                <button
                  className="icon-btn"
                  style={{ display: "inline-grid", marginLeft: 8, verticalAlign: "middle" }}
                  onClick={() => setNotice("")}
                  title="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <form className="composer" onSubmit={handleSubmit}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Nexa anything..."
                aria-label="Message Nexa AI"
                rows={2}
              />

              <div className="composer-footer">
                <div className="composer-tools">
                  <button
                    type="button"
                    className="tool-pill"
                    onClick={() => setNotice("File uploads will be added in a later frontend update.")}
                  >
                    <Paperclip size={16} /> Attach
                  </button>
                  <button
                    type="button"
                    className="tool-pill"
                    onClick={() => setNotice("Image uploads will be added in a later frontend update.")}
                  >
                    <ImageIcon size={16} /> Images
                  </button>
                  <button
                    type="button"
                    className={`tool-pill ${thinking ? "selected" : ""}`}
                    onClick={() => setNotice("Advanced reasoning requires a connected AI backend.")}
                  >
                    <Brain size={16} /> Thinking
                  </button>
                </div>

                <div className="composer-spacer" />

                <button
                  type="button"
                  className="icon-btn"
                  title="Voice input is not enabled yet"
                  onClick={() => setNotice("Voice input is planned for a future update.")}
                >
                  <Mic size={19} />
                </button>
                <button
                  type="submit"
                  className="send-btn"
                  title="Send message"
                  disabled={!input.trim() || thinking}
                >
                  <Send size={19} />
                </button>
              </div>
            </form>
          </main>
        </div>
      </div>
    </div>
  );
}
