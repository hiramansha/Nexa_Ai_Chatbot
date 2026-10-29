import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  Sparkles, Plus, History, Search, Settings, CircleHelp,
  Crown, MessageCircle, Code2, Plane, Lightbulb, Paperclip,
  Image as ImageIcon, Brain, Mic, Send, Menu, X, ChevronDown,
  MoreHorizontal, Sun, Moon, Copy, Check, RefreshCw, Trash2,
  LogOut
} from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const STORAGE_KEY = "nexa-ai-chats-v1";
const API_URL = "https://nexa-ai-chatbot.23-st-028.workers.dev/api/chat";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_EXTRACTED_TEXT = 10000;
const MAX_PDF_PAGES = 30;
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

async function readPdfFile(file) {
  const buffer = await file.arrayBuffer();
  let pdfDocument;

  try {
    pdfDocument = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pageCount = Math.min(pdfDocument.numPages, MAX_PDF_PAGES);
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await pdfDocument.getPage(pageNumber);
      const pageContent = await page.getTextContent();
      const pageText = pageContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" ");

      pages.push(`Page ${pageNumber}:\n${pageText}`);

      if (pages.join("\n\n").length >= MAX_EXTRACTED_TEXT) break;
    }

    let extractedText = pages.join("\n\n").trim();

    if (!extractedText) {
      throw new Error(
        `${file.name} does not contain selectable text. Scanned PDFs need OCR, which is not enabled yet.`
      );
    }

    if (extractedText.length > MAX_EXTRACTED_TEXT) {
      extractedText = extractedText.slice(0, MAX_EXTRACTED_TEXT);
    }

    if (pdfDocument.numPages > MAX_PDF_PAGES) {
      extractedText += `\n\n[Note: Only the first ${MAX_PDF_PAGES} pages were processed.]`;
    }

    return extractedText;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("does not contain selectable text")
    ) {
      throw error;
    }

    throw new Error(
      `Could not read ${file.name}. Please make sure it is a valid, text-based PDF.`
    );
  } finally {
    pdfDocument?.destroy();
  }
}

async function readTextFile(file) {
  try {
    const extension = "." + file.name.split(".").pop().toLowerCase();
    const content = extension === ".pdf"
      ? await readPdfFile(file)
      : await file.text();

    const text = String(content || "");

    if (!text.trim()) {
      throw new Error(`${file.name} does not contain readable text.`);
    }

    return text.length > MAX_EXTRACTED_TEXT
      ? `${text.slice(0, MAX_EXTRACTED_TEXT)}\n\n[Note: Text was shortened to fit the AI request.]`
      : text;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Could not read ")) {
      throw error;
    }

    throw new Error(
      error instanceof Error ? error.message : `Could not read ${file.name}.`
    );
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
const [listening, setListening] = useState(false);
const recognitionRef = useRef(null);

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
    clearAttachments();
    setSidebarOpen(false);
    setNotice("");
    textareaRef.current?.focus();
  }

  function openChat(id) {
    setActiveId(id);
    setInput("");
    clearAttachments();
    setSidebarOpen(false);
    setNotice("");
  }

  function deleteChat(id) {
    setChats((previous) => previous.filter((chat) => chat.id !== id));

    if (activeId === id) {
      setActiveId(null);
      clearAttachments();
    }

    setNotice("Conversation deleted.");
  }

  function renameChat(chatOrId) {
    const id = typeof chatOrId === "string" ? chatOrId : chatOrId?.id;
    const chat = chats.find((item) => item.id === id);
    if (!chat) return;

    const nextTitle = window.prompt("Enter a new conversation name:", chat.title);

    if (nextTitle?.trim()) {
      updateChat(id, (item) => ({
        ...item,
        title: nextTitle.trim().slice(0, 100)
      }));
    }
  }

  function handleFileSelection(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length) return;

    const acceptedExtensions = [
      ".txt", ".md", ".csv", ".json", ".pdf"
    ];

    const newFiles = [];
    const errors = [];

    for (const file of files) {
      const extension = "." + file.name.split(".").pop().toLowerCase();

      if (!acceptedExtensions.includes(extension)) {
        errors.push(`${file.name}: unsupported file type.`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: maximum file size is 5 MB.`);
        continue;
      }

      if (attachedFilesRef.current.some((item) => item.file.name === file.name)) {
        errors.push(`${file.name}: already attached.`);
        continue;
      }

      if (attachedFilesRef.current.length + newFiles.length >= MAX_FILES) {
        errors.push(`You can attach up to ${MAX_FILES} documents at a time.`);
        break;
      }

      newFiles.push({ id: makeId(), file });
    }

    if (newFiles.length) {
      const nextFiles = [...attachedFilesRef.current, ...newFiles];
      attachedFilesRef.current = nextFiles;
      setAttachedFiles(nextFiles);
      setNotice(
        `${newFiles.length} document(s) added. PDFs will be read when you send your message.`
      );
    } else if (errors.length) {
      setNotice(errors.join(" "));
    }
  }

  function removeAttachedFile(id) {
    const nextFiles = attachedFilesRef.current.filter((item) => item.id !== id);
    attachedFilesRef.current = nextFiles;
    setAttachedFiles(nextFiles);
  }

  function handleImageSelection(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length) return;

    const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
    const newImages = [];
    const errors = [];

    for (const file of files) {
      if (!acceptedTypes.includes(file.type)) {
        errors.push(`${file.name}: use JPG, PNG, or WEBP.`);
        continue;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        errors.push(`${file.name}: image size must be under 4 MB.`);
        continue;
      }

      if (selectedImagesRef.current.length + newImages.length >= MAX_IMAGES) {
        errors.push(`You can select up to ${MAX_IMAGES} images.`);
        break;
      }

      newImages.push({
        id: makeId(),
        file,
        name: file.name,
        preview: URL.createObjectURL(file)
      });
    }

    if (newImages.length) {
      const nextImages = [...selectedImagesRef.current, ...newImages];
      selectedImagesRef.current = nextImages;
      setSelectedImages(nextImages);
      setNotice(`${newImages.length} image(s) added.`);
    } else if (errors.length) {
      setNotice(errors.join(" "));
    }
  }

  function removeSelectedImage(id) {
    setSelectedImages((previous) => {
      const image = previous.find((item) => item.id === id);

      if (image) URL.revokeObjectURL(image.preview);

      return previous.filter((item) => item.id !== id);
    });
  }

  async function copyMessage(messageOrText, id) {
    const message = typeof messageOrText === "object" ? messageOrText : null;
    const text = message ? getMessageText(message.content) : String(messageOrText ?? "");
    const messageId = message?.id ?? id;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setNotice("Copy failed. Please select and copy the text manually.");
    }
  }

  async function sendMessage(customPrompt) {
    if (busyRef.current) return;

    const prompt = (customPrompt ?? input).trim();
    const filesToSend = [...attachedFilesRef.current];
    const imagesToSend = [...selectedImagesRef.current];

    if (!prompt && !filesToSend.length && !imagesToSend.length) return;

    busyRef.current = true;
    setThinking(true);
    setInput("");
    setNotice("");

    const chatId = activeId || makeId();
    const existingChat = chats.find((chat) => chat.id === chatId);

    const userMessage = {
      id: makeId(),
      role: "user",
      content: prompt || "Please read and analyse my attachment.",
      attachments: [
        ...filesToSend.map(({ file }) => ({
          name: file.name,
          type: file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "document"
        })),
        ...imagesToSend.map((image) => ({
          name: image.name,
          type: "image"
        }))
      ],
      createdAt: Date.now()
    };

    const previousMessages = existingChat?.messages || [];

    const updatedChat = {
      id: chatId,
      title: existingChat?.title ||
        (prompt || filesToSend[0]?.file?.name || imagesToSend[0]?.name || "New conversation")
          .slice(0, 55),
      updatedAt: Date.now(),
      messages: [...previousMessages, userMessage]
    };

    setChats((previous) => {
      const withoutChat = previous.filter((chat) => chat.id !== chatId);
      return [updatedChat, ...withoutChat];
    });

    setActiveId(chatId);
    clearAttachments();

    try {
      const documentParts = [];

      for (const item of filesToSend) {
        const file = item.file;
        const text = await readTextFile(file);

        documentParts.push(
          `DOCUMENT: ${file.name}\n` +
          `The following is extracted text from the user's document. ` +
          `Use it as source material when answering the user's question.\n\n` +
          text
        );
      }

      const imageParts = [];

      for (const image of imagesToSend) {
        const dataUrl = await fileToDataUrl(image.file);

        imageParts.push({
          type: "image_url",
          image_url: { url: dataUrl }
        });
      }

      const userText = [
        prompt,
        ...documentParts
      ].filter(Boolean).join("\n\n");

      const content = [
        { type: "text", text: userText || "Please analyse the attached image." },
        ...imageParts
      ];

      const apiMessages = [
        ...previousMessages.slice(-18).map((message) => ({
          role: message.role,
          content: getMessageText(message.content)
        })),
        {
          role: "user",
          content: imageParts.length ? content : userText
        }
      ];

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages })
      });

      const data = await response.json();

      if (!response.ok || !data.reply) {
        throw new Error(data.error || "Nexa AI could not generate a response.");
      }

      const assistantMessage = {
        id: makeId(),
        role: "assistant",
        content: data.reply,
        createdAt: Date.now()
      };

      updateChat(chatId, (chat) => ({
        ...chat,
        updatedAt: Date.now(),
        messages: [...chat.messages, assistantMessage]
      }));
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      busyRef.current = false;
      setThinking(false);
      textareaRef.current?.focus();
    }
  }
    async function regenerate(messageIndex) {
    const currentMessages =
      chats.find((chat) => chat.id === activeId)?.messages || [];

    const previousUserMessage = currentMessages
      .slice(0, messageIndex)
      .reverse()
      .find((message) => message.role === "user");

    if (!previousUserMessage || thinking || !activeId) return;

    const chatId = activeId;

    const history = currentMessages
      .slice(0, messageIndex)
      .filter((message) =>
        ["user", "assistant"].includes(message.role)
      )
      .map(({ role, content }) => ({
        role,
        content:
          typeof content === "string"
            ? content
            : getMessageText(content)
      }));

    setThinking(true);
    setNotice("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: history
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || `AI request failed (${response.status}).`
        );
      }

      if (typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("The AI returned an empty response.");
      }

      updateChat(chatId, (chat) => ({
        ...chat,
        updatedAt: Date.now(),
        messages: [
          ...chat.messages.slice(0, messageIndex),
          {
            id: makeId(),
            role: "assistant",
            content: data.reply
          }
        ]
      }));
   
  function startVoiceInput() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setNotice(
        "Voice input is not supported in this browser. Please try a supported browser."
      );
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      setListening(true);
      setNotice("Listening... Speak now.");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;

      setInput((previous) =>
        previous.trim()
          ? `${previous.trim()} ${transcript}`
          : transcript
      );

      setNotice(
        "Voice converted to text. Review it and press Send."
      );
    };

    recognition.onerror = (event) => {
      setNotice(
        event.error === "not-allowed"
          ? "Microphone permission denied. Allow microphone access in your browser."
          : `Voice input error: ${event.error}`
      );
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setListening(false);
      setNotice("Could not start the microphone. Please try again.");
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (thinking) return;

    sendMessage();
  }

  function handleKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent?.isComposing
    ) {
      event.preventDefault();
      handleSubmit(event);
    }
  }
    const visibleChats = chats
    .filter((chat) =>
      chat.title.toLowerCase().includes(search.toLowerCase())
    )
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
                <div className="brand-name">
                  Nexa <span>AI</span>
                </div>
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

            <button
              type="button"
              className="primary-btn"
              onClick={newChat}
            >
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
                  className={`recent-item ${
                    chat.id === activeId ? "active" : ""
                  }`}
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
                <div className="empty-history">
                  No matching conversations.
                </div>
              )}
            </div>

            <div className="sidebar-bottom">
              <button
                type="button"
                className="side-link"
                onClick={() =>
                  setNotice("Theme and chat preferences are available here.")
                }
              >
                <Settings size={19} /> Settings
              </button>

              <button
                type="button"
                className="side-link"
                onClick={() =>
                  setNotice(
                    "Nexa AI support: check the backend status and try again."
                  )
                }
              >
                <CircleHelp size={19} /> Help & Support
              </button>

              <div className="upgrade">
                <div className="upgrade-heading">
                  <span className="upgrade-icon">
                    <Crown size={20} />
                  </span>
                  Upgrade to Pro
                </div>

                <p>
                  Explore a premium AI experience with more possibilities
                  and powerful features.
                </p>

                <button
                  type="button"
                  className="primary-btn"
                  onClick={() =>
                    setNotice(
                      "Pro plans are a future feature. No payment is being taken."
                    )
                  }
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
              <div
                style={{
                  display: "flex",
                  gap: 9,
                  alignItems: "center"
                }}
              >
                <button
                  type="button"
                  className="icon-btn mobile-menu"
                  title="Open sidebar"
                  onClick={() =>
                    setSidebarOpen((value) => !value)
                  }
                >
                  <Menu size={20} />
                </button>

                <button
                  type="button"
                  className="model-select"
                  onClick={() =>
                    setNotice(
                      "Nexa AI is using the configured Cloudflare AI backend."
                    )
                  }
                >
                  <Sparkles size={17} />
                  Nexa AI
                  <ChevronDown size={15} />
                </button>
              </div>

              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  className="more-btn"
                  title="More options"
                  onClick={() =>
                    setShowMenu((value) => !value)
                  }
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
                      {lightMode ? (
                        <Moon size={16} />
                      ) : (
                        <Sun size={16} />
                      )}
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

                <h1>
                  Welcome to{" "}
                  <span className="gradient-text">Nexa AI</span>
                </h1>

                <p className="subtitle">
                  Your ideas. Your AI. Your next step.
                </p>

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
                          <span className="suggestion-icon">
                            <Icon size={22} />
                          </span>
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
                    className={`message ${
                      message.role === "user" ? "user" : ""
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="message-avatar">
                        <Sparkles size={18} />
                      </div>
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
                          {message.attachments.map((attachment, attachmentIndex) => {
                            const attachmentName =
                              typeof attachment === "string"
                                ? attachment
                                : attachment?.name || "Attachment";

                            return (
                              <span
                                key={`${attachmentName}-${attachmentIndex}`}
                                className="attachment-item"
                              >
                                <Paperclip size={14} /> {attachmentName}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {message.role === "assistant" && (
                        <div className="message-actions">
                          <button
                            type="button"
                            onClick={() => copyMessage(message)}
                          >
                            {copiedId === message.id ? (
                              <Check size={14} />
                            ) : (
                              <Copy size={14} />
                            )}
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
                    <div className="message-avatar">
                      <Sparkles size={18} />
                    </div>

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
                accept=".txt,.md,.csv,.json,.pdf"
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

              {(attachedFiles.length > 0 ||
                selectedImages.length > 0) && (
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
                    disabled={
                      thinking || selectedImages.length >= MAX_IMAGES
                    }
                  >
                    <ImageIcon size={16} /> Images
                  </button>

                  <button
                    type="button"
                    className={`tool-pill ${thinking ? "selected" : ""}`}
                    onClick={() =>
                      setNotice(
                        "Thinking mode uses the configured AI model."
                      )
                    }
                  >
                    <Brain size={16} /> Thinking
                  </button>
                </div>

                <div className="composer-spacer" />

                <button
                  type="button"
                  className="icon-btn"
                  title="Voice input is not enabled yet"
                  onClick={() =>
                    setNotice(
                      "Voice input is planned for a future update."
                    )
                  }
                >
                  <Mic size={18} />
                </button>

                <button
                  type="submit"
                  className="send-btn"
                  title="Send message"
                  disabled={
                    thinking ||
                    (!input.trim() &&
                      attachedFiles.length === 0 &&
                      selectedImages.length === 0)
                  }
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </main>
        </div>
      </div>
    </div>
  );
}
