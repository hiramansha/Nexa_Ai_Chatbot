
import { useEffect, useRef, useState } from "react";
import {
  Sparkles, Plus, History, Search, Settings, CircleHelp,
  Crown, MessageCircle, Code2, Plane, Lightbulb, Paperclip,
  Image as ImageIcon, Brain, Mic, Send, Menu, X, ChevronDown,
  MoreHorizontal, Sun, Moon, Copy, Check, RefreshCw, Trash2,
  LogOut
} from "lucide-react";

const STORAGE_KEY = "nexa-ai-chats-v1";

const suggestions = [
  {
    title: "Explain Code",
    description: "Learn coding step by step.",
    icon: Code2,
    prompt: "Explain JavaScript with a simple example."
  },
  {
    title: "Plan a Trip",
    description: "Create a budget-friendly itinerary.",
    icon: Plane,
    prompt: "Create a 5-day budget-friendly trip plan for Lahore."
  },
  {
    title: "Write Something",
    description: "Draft a professional message or email.",
    icon: Lightbulb,
    prompt: "Write a professional email asking my teacher for feedback."
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

/* Detect Urdu script, Roman Urdu, or English */
function detectLanguage(prompt) {
  if (/[\u0600-\u06FF]/.test(prompt)) return "urdu";

  const romanUrdu =
    /\b(assalam|alaikum|walaikum|salam|kya|kesy|kaise|krdo|kardo|kro|mujhe|mujhy|mera|meri|main|mein|hai|hain|ho|hona|chahiye|btao|batao|likho|likhdo|urdu|acha|achha|nhi|nahin|kyun|kyu|aur|ap|aap|ka|ki|ke|liye|bhi|madad|jawab|sawal|shukriya|karna|kren|bnao|samjhao|samjha|raha|rahi|rha|rhi|konsa|konsi|kitna|kahan|kab|theek|thik|hai\?)\b/i;

  return romanUrdu.test(prompt) ? "roman-urdu" : "english";
}

/* Rule-based demo responses.
   Connect a real AI backend for intelligent, open-ended answers. */
function demoReply(prompt) {
  const language = detectLanguage(prompt);
  const text = prompt.toLowerCase().trim();

  const has = (...words) =>
    words.some((word) => text.includes(word));

  const greeting =
    /^(hi|hello|hey|salam|assalam|assalam o alaikum|asalam o alaikum|good morning|good afternoon|good evening|السلام علیکم|ہیلو)[!.،\s]*$/i.test(text);

  if (greeting) {
    if (language === "urdu") {
      return "وعلیکم السلام! 😊\n\nنیکسا اے آئی میں خوش آمدید۔ آج میں آپ کی کس طرح مدد کر سکتا ہوں؟";
    }

    if (language === "roman-urdu") {
      return "Wa Alaikum Assalam! 😊\n\nNexa AI mein khush aamdeed! Aaj main aapki kis tarah madad kar sakta hoon?";
    }

    return "Hello! 👋 Welcome to Nexa AI. How can I help you today?";
  }

  if (has("thank you", "thanks", "thanku", "shukriya", "sukriya", "شکریہ")) {
    if (language === "urdu") {
      return "آپ کا خیرمقدم ہے! 😊 اگر آپ کو مزید مدد چاہیے تو ضرور بتائیں۔";
    }
    if (language === "roman-urdu") {
      return "Aapka khair maqdam hai! 😊 Mazeed madad chahiye ho to zaroor batayein.";
    }
    return "You're welcome! 😊 Let me know if you need help with anything else.";
  }

  const writingTask = has(
    "write a message", "write message", "draft a message",
    "write an email", "draft an email", "compose an email",
    "write a letter", "draft a letter", "professional email",
    "professional message", "reply to", "message bna",
    "message bana", "msg bna", "msg bana", "email likh",
    "letter likh", "paigham likh", "پیغام لکھ", "ای میل لکھ", "خط لکھ"
  );

  if (writingTask) {
    if (language === "urdu") {
      return "**پیغام کا مسودہ**\n\nمحترم/محترمہ،\n\n[یہاں اپنے پیغام کی تفصیلات لکھیں۔]\n\nآپ کے وقت اور تعاون کا شکریہ۔\n\nنیک تمنائیں،\n[آپ کا نام]";
    }

    if (language === "roman-urdu") {
      return "**Message Draft**\n\nAssalam o Alaikum,\n\n[Apne message ka maqsad aur zaroori tafseel yahan likhein.]\n\nAapke waqt aur taawun ka shukriya.\n\nBest regards,\n[Apna naam]";
    }

    return "**Subject:** [Your subject]\n\nDear [Name],\n\nI hope you are doing well.\n\n[Write the purpose of your message here, including any important details.]\n\nThank you for your time and consideration.\n\nBest regards,\n[Your Name]\n\n*Share the recipient and purpose for a more personalized draft.*";
  }

  const coding = has(
    "javascript", "react", "html", "css", "python",
    "programming", "coding", "code", "function", "error",
    "bug", "api", "backend", "frontend"
  );

  if (coding) {
    if (language === "urdu") {
      return "میں آپ کے پروگرامنگ سوال میں مدد کر سکتا ہوں۔\n\n1. اپنا کوڈ شیئر کریں۔\n2. بتائیں کہ آپ کیا بنانا چاہتے ہیں۔\n3. اگر کوئی ایرر ہے تو اس کا پیغام بھی بھیجیں۔\n\nاس کے بعد ہم مسئلے کو مرحلہ وار سمجھیں گے۔";
    }

    if (language === "roman-urdu") {
      return "Main aapke coding question mein madad kar sakta hoon!\n\n1. Apna code share karein.\n2. Batayein ke aap kya banana chahte hain.\n3. Agar error aa raha hai to uska exact message bhejein.\n\nPhir hum problem ko step by step samjhenge.";
    }

    return "I can help with your coding question!\n\n1. Share the relevant code.\n2. Explain what you want it to do.\n3. Include the exact error message, if there is one.\n\nI'll help you understand the issue and work through a solution.";
  }

  const explanation = has(
    "explain", "what is", "meaning", "how does",
    "samjhao", "matlab", "kya hota", "کیا ہے", "مطلب"
  );

  if (explanation) {
    if (language === "urdu") {
      return "میں اس موضوع کو آسان الفاظ میں سمجھانے میں مدد کر سکتا ہوں۔\n\nبراہِ کرم اپنے سوال یا موضوع کی مکمل تفصیل بتائیں تاکہ میں متعلقہ وضاحت اور مثال دے سکوں۔";
    }

    if (language === "roman-urdu") {
      return "Main aapko is topic ko asaan alfaaz mein samjha sakta hoon.\n\nApna poora sawal ya topic share karein, taake main relevant explanation aur example de sakoon.";
    }

    return "I'd be happy to explain this topic clearly.\n\nShare the specific concept or question, and I can help break it down into simpler steps with an example.";
  }

  if (language === "urdu") {
    return "آپ کے سوال کا شکریہ!\n\nمیں آپ کی مدد کرنا چاہتا ہوں۔ براہِ کرم اپنے سوال یا مطلوبہ کام کی تھوڑی مزید تفصیل بتائیں تاکہ میں آپ کو زیادہ متعلقہ جواب دے سکوں۔";
  }

  if (language === "roman-urdu") {
    return "Aapke sawal ka shukriya!\n\nMain aapki madad karna chahta hoon. Apne sawal ya kaam ki thori si tafseel bata dein, taake main aapko zyada relevant jawab de sakoon.";
  }

  return "Thanks for your question!\n\nI'd like to help. Please share a little more detail about what you want to know or accomplish so I can give you a more relevant answer.\n\n*Note: Nexa AI is currently running in demo mode. Connect a real AI API for intelligent, question-specific responses.*";
}

export default function App() {
  const [chats, setChats] = useState(readChats);
  const [activeId, setActiveId] = useState(() => readChats()[0]?.id || null);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lightMode, setLightMode] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [notice, setNotice] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const activeChat = chats.find((chat) => chat.id === activeId);
  const messages = activeChat?.messages || [];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, thinking]);

  function updateChat(id, updater) {
    setChats((previous) =>
      previous.map((chat) => chat.id === id ? updater(chat) : chat)
    );
  }

  function newChat() {
    const chat = makeChat();
    setChats((previous) => [chat, ...previous]);
    setActiveId(chat.id);
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
    if (activeId === id) setActiveId(remaining[0]?.id || null);
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

  function sendMessage(text = input) {
    const prompt = text.trim();
    if (!prompt || thinking) return;

    let chatId = activeId;
    let currentChat = chats.find((chat) => chat.id === chatId);

    if (!currentChat) {
      currentChat = makeChat();
      chatId = currentChat.id;
      setActiveId(chatId);
    }

    const userMessage = {
      id: makeId(),
      role: "user",
      content: prompt
    };

    const assistantMessage = {
      id: makeId(),
      role: "assistant",
      content: demoReply(prompt)
    };

    const updatedChat = {
      ...currentChat,
      title: currentChat.messages.length === 0
        ? prompt.slice(0, 36) + (prompt.length > 36 ? "…" : "")
        : currentChat.title,
      updatedAt: Date.now(),
      messages: [...currentChat.messages, userMessage, assistantMessage]
    };

    setChats((previous) => [
      updatedChat,
      ...previous.filter((chat) => chat.id !== chatId)
    ]);

    setActiveId(chatId);
    setInput("");
    setThinking(false);
    setNotice("");
    setSidebarOpen(false);
  }

  function regenerate(messageIndex) {
    if (thinking || !activeId) return;

    const chat = chats.find((item) => item.id === activeId);
    if (!chat) return;

    const previousUserMessage = chat.messages
      .slice(0, messageIndex)
      .reverse()
      .find((message) => message.role === "user");

    if (!previousUserMessage) return;

    const answer = {
      id: makeId(),
      role: "assistant",
      content: demoReply(previousUserMessage.content)
    };

    updateChat(activeId, (current) => ({
      ...current,
      updatedAt: Date.now(),
      messages: [
        ...current.messages.slice(0, messageIndex),
        answer
      ]
    }));
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
          <div className="traffic"><span /><span /><span /></div>
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
              <button className="icon-btn" style={{ marginLeft: "auto" }}
                onClick={() => setSidebarOpen(false)} title="Close sidebar">
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
              <button className="icon-btn" title="Search conversations"
                onClick={() => setSearchOpen((value) => !value)}>
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
                  width: "100%", padding: 11, color: "inherit",
                  background: "#151a35", border: "1px solid var(--border)",
                  borderRadius: 10
                }}
              />
            )}

            <div className="recent-list">
              {visibleChats.map((chat) => (
                <div key={chat.id}
                  className={`recent-item ${chat.id === activeId ? "active" : ""}`}>
                  <button className="icon-btn" onClick={() => openChat(chat.id)}
                    title="Open conversation">
                    <MessageCircle size={17} />
                  </button>
                  <button onClick={() => openChat(chat.id)} style={{
                    flex: 1, minWidth: 0, textAlign: "left", border: 0,
                    padding: 0, background: "transparent", color: "inherit"
                  }}>
                    <span className="recent-title">{chat.title}</span>
                    <span className="recent-date">
                      {new Date(chat.updatedAt).toLocaleDateString()}
                    </span>
                  </button>
                  <button className="icon-btn" title="Rename conversation"
                    onClick={() => renameChat(chat)}>
                    <MoreHorizontal size={17} />
                  </button>
                  <button className="icon-btn" title="Delete conversation"
                    onClick={() => deleteChat(chat.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {visibleChats.length === 0 &&
                <div className="empty-history">No matching conversations.</div>}
            </div>

            <div className="sidebar-bottom">
              <button className="side-link"
                onClick={() => setNotice("Settings will be available in a future update.")}>
                <Settings size={19} /> Settings
              </button>
              <button className="side-link"
                onClick={() => setNotice("Nexa AI demo. Real AI integration is the next step.")}>
                <CircleHelp size={19} /> Help & Support
              </button>
              <div className="upgrade">
                <div className="upgrade-heading">
                  <span className="upgrade-icon"><Crown size={20} /></span>
                  Upgrade to Pro
                </div>
                <p>Explore a premium AI experience with more possibilities and powerful features.</p>
                <button className="primary-btn"
                  onClick={() => setNotice("Pro plans are a future feature. No payment is being taken.")}>
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
                <button className="icon-btn mobile-menu" title="Open sidebar"
                  onClick={() => setSidebarOpen((value) => !value)}>
                  <Menu size={20} />
                </button>
                <button className="model-select"
                  onClick={() => setNotice("Real AI model selection requires an AI backend.")}>
                  <Sparkles size={17} /> Nexa AI <ChevronDown size={15} />
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <button className="more-btn" title="More options"
                  onClick={() => setShowMenu((value) => !value)}>
                  <MoreHorizontal size={21} />
                </button>
                {showMenu && (
                  <div style={{
                    position: "absolute", right: 0, top: 49, zIndex: 5,
                    width: 180, padding: 8, border: "1px solid var(--border)",
                    borderRadius: 12, background: "#121831",
                    boxShadow: "0 10px 35px #0006"
                  }}>
                    <button className="side-link" onClick={newChat}>
                      <Plus size={16} /> New conversation
                    </button>
                    <button className="side-link"
                      onClick={() => { setLightMode((value) => !value); setShowMenu(false); }}>
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
                      <button className="suggestion" key={item.title}
                        onClick={() => sendMessage(item.prompt)}>
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
                  <div key={message.id}
                    className={`message ${message.role === "user" ? "user" : ""}`}>
                    {message.role === "assistant" &&
                      <div className="message-avatar"><Sparkles size={18} /></div>}
                    <div className="message-body">
                      <div className="message-role">
                        {message.role === "user" ? "You" : "Nexa AI · Demo"}
                      </div>
                      <div className="message-content" style={{ whiteSpace: "pre-wrap" }}>
                        {message.content}
                      </div>
                      {message.role === "assistant" && (
                        <div className="message-actions">
                          <button onClick={() => copyMessage(message)}>
                            {copiedId === message.id
                              ? <Check size={14} /> : <Copy size={14} />}
                            {copiedId === message.id ? "Copied" : "Copy"}
                          </button>
                          <button onClick={() => regenerate(index)} disabled={thinking}>
                            <RefreshCw size={13} /> Regenerate
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}

            {notice && (
              <div role="status" style={{
                position: "absolute", top: 76, left: "50%",
                transform: "translateX(-50%)", zIndex: 4,
                width: "max-content", maxWidth: "90%", padding: "11px 15px",
                color: "#e8dcff", background: "#27204a",
                border: "1px solid #8c5cff75", borderRadius: 12, fontSize: 12
              }}>
                {notice}
                <button className="icon-btn"
                  style={{ display: "inline-grid", marginLeft: 8, verticalAlign: "middle" }}
                  onClick={() => setNotice("")} title="Dismiss">
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
                  <button type="button" className="tool-pill"
                    onClick={() => setNotice("File uploads are not implemented yet.")}>
                    <Paperclip size={16} /> Attach
                  </button>
                  <button type="button" className="tool-pill"
                    onClick={() => setNotice("Image uploads are not implemented yet.")}>
                    <ImageIcon size={16} /> Images
                  </button>
                  <button type="button" className="tool-pill"
                    onClick={() => setNotice("Advanced reasoning requires a connected AI backend.")}>
                    <Brain size={16} /> Thinking
                  </button>
                </div>
                <div className="composer-spacer" />
                <button type="button" className="icon-btn" title="Voice input not enabled"
                  onClick={() => setNotice("Voice input is planned for a future update.")}>
                  <Mic size={19} />
                </button>
                <button type="submit" className="send-btn"
                  title="Send message" disabled={!input.trim() || thinking}>
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
