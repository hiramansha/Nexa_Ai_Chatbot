
import { useEffect, useRef, useState } from "react";
import {
  Sparkles, Plus, History, Search, Settings, CircleHelp,
  Crown, MessageCircle, Code2, Plane, Lightbulb, Paperclip,
  Image as ImageIcon, Brain, Mic, Send, Menu, X, ChevronDown,
  MoreHorizontal, Sun, Moon, Copy, Check, RefreshCw, Trash2,
  LogOut
} from "lucide-react";

const STORAGE_KEY = "nexa-ai-chats-v1";
const API_URL = "https://nexa-ai-chatbot.23-st-028.workers.dev/api/chat";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const MAX_FILES = 5;
const MAX_IMAGES = 3;

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
    return "Let's break it down step by step.\n\n1. **Understand the goal:** Identify what the code should accomplish.\n2. **Divide the problem:** Separate it into smaller, manageable tasks.\n3. **Write the logic:** Use variables, functions, and conditions as needed.\n4. **Test the result:** Try different inputs and handle possible errors.\n\nShare your code with me to get a more specific explanation.";
  }

  if (text.includes("trip") || text.includes("travel") || text.includes("lahore")) {
    return "Here's a simple way to organise your trip:\n\n**Day 1:** Explore the historic city centre.\n\n**Day 2:** Visit cultural landmarks and local markets.\n\n**Day 3:** Discover museums, gardens, and local food.\n\n**Day 4:** Explore a new neighbourhood and enjoy local experiences.\n\n**Day 5:** Keep the day flexible for shopping and your return journey.";
  }

  return `Great question! Let's work through this together.\n\n**Your question:** ${prompt}\n\n1. **Define your goal** — decide what you want to achieve.\n2. **Explore your options** — consider a few different approaches.\n3. **Create a plan** — break the next steps into manageable tasks.\n4. **Review and improve** — test your ideas and refine the result.`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function readTextFile(file) {
  try {
    return await file.text();
  } catch {
    throw new Error(`Could not read ${file.name}.`);
  }
}

function getMessageText(content) {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");
  }

  return "";
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
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);

  const textareaRef = useRef(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const attachedFilesRef = useRef([]);
  const selectedImagesRef = useRef([]);
  const busyRef = useRef(false);

  const activeChat = chats.find((chat) => chat.id === activeId);
  const messages = activeChat?.messages || [];

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch {
      setNotice("Chat history could not be saved. Browser storage may be full.");
    }
  }, [chats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, thinking]);

  useEffect(() => {
    attachedFilesRef.current = attachedFiles;
  }, [attachedFiles]);

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(() => {
    return () => {
      selectedImagesRef.current.forEach((image) => {
        URL.revokeObjectURL(image.preview);
      });
    };
  }, []);

  function updateChat(id, updater) {
    setChats((previous) =>
      previous.map((chat) => chat.id === id ? updater(chat) : chat)
    );
  }

  function clearAttachments() {
    selectedImagesRef.current.forEach((image) => {
      URL.revokeObjectURL(image.preview);
    });

    selectedImagesRef.current = [];
    attachedFilesRef.current = [];
    setAttachedFiles([]);
    setSelectedImages([]);
  }

  function newChat() {
    setActiveId(null);
    setInput("");
    setSidebarOpen(false);
    setNotice("");
    setShowMenu(false);
    clearAttachments();
  }

  function openChat(id) {
    setActiveId(id);
    setSidebarOpen(false);
    setNotice("");
    clearAttachments();
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

  function handleFileSelection(event) {
    const files = Array.from(event.target.files || []);
    const allowedExtensions = [".txt", ".md", ".csv", ".json"];
    const validFiles = [];
    const errors = [];

    const remainingSlots = MAX_FILES - attachedFilesRef.current.length;

    for (const file of files) {
      const extension = "." + file.name.split(".").pop().toLowerCase();

      if (!allowedExtensions.includes(extension)) {
        errors.push(`${file.name}: use TXT, MD, CSV or JSON.`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: maximum size is 5 MB.`);
        continue;
      }

      if (validFiles.length >= remainingSlots) {
        errors.push(`You can attach up to ${MAX_FILES} files.`);
        break;
      }

      validFiles.push({ id: makeId(), file });
    }

    const nextFiles = [...attachedFilesRef.current, ...validFiles];
    attachedFilesRef.current = nextFiles;
    setAttachedFiles(nextFiles);
    setNotice(errors.join(" ") || "");
    event.target.value = "";
  }

  function handleImageSelection(event) {
    const files = Array.from(event.target.files || []);
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const validImages = [];
    const errors = [];

    const remainingSlots = MAX_IMAGES - selectedImagesRef.current.length;

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name}: use JPG, PNG or WebP.`);
        continue;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        errors.push(`${file.name}: maximum image size is 4 MB.`);
        continue;
      }

      if (validImages.length >= remainingSlots) {
        errors.push(`You can attach up to ${MAX_IMAGES} images.`);
        break;
      }

      validImages.push({
        id: makeId(),
        file,
        preview: URL.createObjectURL(file)
      });
    }

    const nextImages = [...selectedImagesRef.current, ...validImages];
    selectedImagesRef.current = nextImages;
    setSelectedImages(nextImages);
    setNotice(errors.join(" ") || "");
    event.target.value = "";
  }

  function removeAttachedFile(id) {
    const nextFiles = attachedFilesRef.current.filter((item) => item.id !== id);
    attachedFilesRef.current = nextFiles;
    setAttachedFiles(nextFiles);
  }

  function removeSelectedImage(id) {
    const image = selectedImagesRef.current.find((item) => item.id === id);

    if (image) URL.revokeObjectURL(image.preview);

    const nextImages = selectedImagesRef.current.filter((item) => item.id !== id);
    selectedImagesRef.current = nextImages;
    setSelectedImages(nextImages);
  }

  async function sendMessage(text = input) {
    if (busyRef.current) return;

    const prompt = text.trim();
    const filesToSend = [...attachedFilesRef.current];
    const imagesToSend = [...selectedImagesRef.current];

    if (!prompt && filesToSend.length === 0 && imagesToSend.length === 0) {
      return;
    }

    busyRef.current = true;
    let chatId = activeId;
    let currentChat = chats.find((chat) => chat.id === chatId);

    if (!currentChat) {
      currentChat = makeChat();
      chatId = currentChat.id;
      setActiveId(chatId);
      setChats((previous) => [currentChat, ...previous]);
    }

    const userText = prompt || "Please analyse the attached file(s) and image(s).";

    const attachmentLabels = [
      ...filesToSend.map(({ file }) => file.name),
      ...imagesToSend.map(({ file }) => file.name)
    ];

    const userMessage = {
      id: makeId(),
      role: "user",
      content: userText,
      attachments: attachmentLabels
    };

    const previousMessages = currentChat.messages
      .filter((message) => ["user", "assistant"].includes(message.role))
      .map(({ role, content }) => ({ role, content }));

    updateChat(chatId, (chat) => ({
      ...chat,
      title: chat.messages.length === 0
        ? (userText.slice(0, 36) + (userText.length > 36 ? "…" : ""))
        : chat.title,
      updatedAt: Date.now(),
      messages: [...chat.messages, userMessage]
    }));

    setInput("");
    setThinking(true);
    setNotice("");
    setSidebarOpen(false);

    try {
      const contentParts = [];

      if (prompt) {
        contentParts.push({ type: "text", text: prompt });
      }

      for (const { file } of filesToSend) {
        const content = await readTextFile(file);

        contentParts.push({
          type: "text",
          text: `\n\nAttached file: ${file.name}\n\n${content}`
        });
      }

      for (const { file } of imagesToSend) {
        const dataUrl = await fileToDataUrl(file);

        contentParts.push({
          type: "image_url",
          image_url: { url: dataUrl }
        });
      }

      const currentUserMessage = {
        role: "user",
        content: contentParts.length === 1 && contentParts[0].type === "text"
          ? contentParts[0].text
          : contentParts
      };

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...previousMessages, currentUserMessage]
        })
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
        messages: [
          ...chat.messages,
          {
            id: makeId(),
            role: "assistant",
            content: data.reply
          }
        ]
      }));

      clearAttachments();
    } catch (error) {
      setNotice(
        error.message ||
        "Unable to connect to Nexa AI. Please try again."
      );
    } finally {
      busyRef.current = false;
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
      .map(({ role, content }) => ({
        role,
        content: typeof content === "string" ? content : getMessageText(content)
      }));

    setThinking(true);
    setNotice("");

    updateChat(chatId, (chat) => ({
      ...chat,
      messages: chat.messages.slice(0, messageIndex)
    }));

    try {
      const response = await fetch(API_URL, {
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
        messages: [
          ...chat.messages,
          {
            id: makeId(),
            role: "assistant",
            content: data.reply
          }
        ]
      }));
    } catch (error) {
      setNotice(error.message || "Unable to regenerate the response.");
    } finally {
      setThinking(false);
    }
  }

  async function copyMessage(message) {
    try {
      await navigator.clipboard.writeText(getMessageText(message.content));
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
            type="button"
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
                type="button"
                className="icon-btn"
                style={{ marginLeft: "auto" }}
                onClick={() => setSidebarOpen(false)}
                title="Close sidebar"
              >
                <X size={18} />
              </button>
            </div>

            <button type="button" className="primary-btn" onClick={newChat}>
              <Plus size={19} /> New Chat
            </button>

            <div className="section-label">
              <History size={19} />
              <span>Recent</span>
              <span className="spacer" />

              <button
                type="button"
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
                    type="button"
                    className="icon-btn"
                    onClick={() => openChat(chat.id)}
                    title="Open conversation"
                  >
                    <MessageCircle size={17} />
                  </button>

                  <button
                    type="button"
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
                    type="button"
                    className="icon-btn"
                    title="Rename conversation"
                    onClick={() => renameChat(chat)}
                  >
                    <MoreHorizontal size={17} />
                  </button>

                  <button
                    type="button"
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
                type="button"
                className="side-link"
                onClick={() => setNotice("Theme and chat preferences are available here.")}
              >
                <Settings size={19} /> Settings
              </button>

              <button
                type="button"
                className="side-link"
                onClick={() => setNotice("Nexa AI support: check the backend status and try again.")}
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
                  type="button"
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
                  type="button"
                  className="icon-btn mobile-menu"
                  title="Open sidebar"
                  onClick={() => setSidebarOpen((value) => !value)}
                >
                  <Menu size={20} />
                </button>

                <button
                  type="button"
                  className="model-select"
                  onClick={() => setNotice("Nexa AI is using the configured Cloudflare AI backend.")}
                >
                  <Sparkles size={17} /> Nexa AI <ChevronDown size={15} />
                </button>
              </div>

              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  className="more-btn"
                  title="More options"
                  onClick={() => setShowMenu((value) => !value)}
                >
                  <MoreHorizontal size={21} />
                </button>

                {showMenu && (
                  <div
                    style={{
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
                    }}
                  >
                    <button
                      type="button"
                      className="side-link"
                      onClick={() => {
                        newChat();
                        setShowMenu(false);
                      }}
                    >
                      <Plus size={16} /> New conversation
                    </button>

                    <button
                      type="button"
                      className="side-link"
                      onClick={() => {
                        setLightMode((value) => !value);
                        setShowMenu(false);
                      }}
                    >
                      {lightMode ? <Moon size={16} /> : <Sun size={16} />}
                      Toggle theme
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
                        type="button"
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

                      <div className="message-content">
                        {getMessageText(message.content)}
                      </div>

                      {message.attachments?.length > 0 && (
                        <div className="message-attachments">
                          {message.attachments.map((name) => (
                            <span key={name} className="attachment-item">
                              <Paperclip size={14} /> {name}
                            </span>
                          ))}
                        </div>
                      )}

                      {message.role === "assistant" && (
                        <div className="message-actions">
                          <button type="button" onClick={() => copyMessage(message)}>
                            {copiedId === message.id
                              ? <Check size={14} />
                              : <Copy size={14} />}
                            {copiedId === message.id ? "Copied" : "Copy"}
                          </button>

                          <button
                            type="button"
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
                      <div className="message-content">Thinking…</div>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            )}

            {notice && (
              <div
                role="status"
                style={{
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
                }}
              >
                {notice}

                <button
                  type="button"
                  className="icon-btn"
                  style={{
                    display: "inline-grid",
                    marginLeft: 8,
                    verticalAlign: "middle"
                  }}
                  onClick={() => setNotice("")}
                  title="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <form className="composer" onSubmit={handleSubmit}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.csv,.json"
                multiple
                hidden
                onChange={handleFileSelection}
              />

              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={handleImageSelection}
              />

              {(attachedFiles.length > 0 || selectedImages.length > 0) && (
                <div className="attachment-preview">
                  {attachedFiles.map(({ id, file }) => (
                    <div className="attachment-item" key={id}>
                      <Paperclip size={15} />
                      <span>{file.name}</span>

                      <button
                        type="button"
                        onClick={() => removeAttachedFile(id)}
                        aria-label={`Remove ${file.name}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}

                  {selectedImages.map(({ id, file, preview }) => (
                    <div className="attachment-item" key={id}>
                      <img
                        src={preview}
                        alt={file.name}
                        style={{
                          width: 44,
                          height: 44,
                          objectFit: "cover",
                          borderRadius: 8
                        }}
                      />

                      <span>{file.name}</span>

                      <button
                        type="button"
                        onClick={() => removeSelectedImage(id)}
                        aria-label={`Remove ${file.name}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

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
                    onClick={() => fileInputRef.current?.click()}
                    disabled={thinking || attachedFiles.length >= MAX_FILES}
                  >
                    <Paperclip size={16} /> Attach
                  </button>

                  <button
                    type="button"
                    className="tool-pill"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={thinking || selectedImages.length >= MAX_IMAGES}
                  >
                    <ImageIcon size={16} /> Images
                  </button>

                  <button
                    type="button"
                    className={`tool-pill ${thinking ? "selected" : ""}`}
                    onClick={() => setNotice("Thinking mode uses the configured AI model.")}
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
                  disabled={
                    (!input.trim() &&
                      attachedFiles.length === 0 &&
                      selectedImages.length === 0) ||
                    thinking
                  }
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
