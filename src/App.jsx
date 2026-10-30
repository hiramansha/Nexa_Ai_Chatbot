import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  Sparkles, Plus, History, Search, Settings, CircleHelp,
  Crown, MessageCircle, Code2, Plane, Lightbulb, Paperclip,
  Image as ImageIcon, Brain, Mic, Send, Menu, X, ChevronDown,
  MoreHorizontal, Sun, Moon, Copy, Check, RefreshCw, Trash2,
  LogOut, Volume2
} from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const STORAGE_KEY = "nexa-ai-chats-v1";
const PREFERENCES_KEY = "nexa-ai-preferences-v1";
const DEFAULT_PREFERENCES = {
  theme: "dark",
  fontSize: "medium",
  responseLanguage: "auto",
  enterToSend: true
};

function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}");
    return { ...DEFAULT_PREFERENCES, ...(saved && typeof saved === "object" ? saved : {}) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}
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
  const [preferences, setPreferences] = useState(readPreferences);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState("not-checked");
  const [checkingBackend, setCheckingBackend] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const lightMode = preferences.theme === "light";

  async function checkBackendStatus() {
    setCheckingBackend(true);
    setBackendStatus("checking");
    try {
      const response = await fetch("https://nexa-ai-chatbot.23-st-028.workers.dev/api/health", {
        method: "GET",
        headers: { Accept: "application/json" }
      });
      const data = await response.json().catch(() => ({}));
      setBackendStatus(response.ok && data.status === "ok" ? "online" : "offline");
    } catch {
      setBackendStatus("offline");
    } finally {
      setCheckingBackend(false);
    }
  }

  async function copySupportDiagnostics() {
    const details = [
      "Nexa AI Support Report",
      `Date: ${new Date().toLocaleString()}`,
      `Page: ${window.location.href}`,
      `Browser: ${navigator.userAgent}`,
      `Backend status: ${backendStatus}`,
      `Issue: ${supportMessage.trim() || "Not specified"}`
    ].join("\n");
    try {
      await navigator.clipboard.writeText(details);
      setNotice("Support details copied. You can paste them into your support message.");
    } catch {
      setNotice("Could not copy automatically. Please describe the issue in your message.");
    }
  }

  function updatePreference(key, value) {
    setPreferences((previous) => {
      const updated = { ...previous, [key]: value };
      try {
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
      } catch {
        setNotice("Could not save preferences in this browser.");
      }
      return updated;
    });
  }
  const [thinking, setThinking] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [notice, setNotice] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [speakingId, setSpeakingId] = useState(null);

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
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences.theme]);

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

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
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
    } catch (error) {
      setNotice(
        error.message || "Unable to regenerate the response."
      );
    } finally {
      setThinking(false);
    }
  }

  function startVoiceInput() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setNotice(
        "Voice input is not supported in this browser. Please try Chrome or Edge."
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
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (!transcript) return;

      setInput((previous) =>
        previous.trim() ? `${previous.trim()} ${transcript}` : transcript
      );
      setNotice("Voice converted to text. Review it and press Send.");
      textareaRef.current?.focus();
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
      recognitionRef.current = null;
      setNotice("Could not start the microphone. Please try again.");
    }
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setSpeakingId(null);
  }

  function speakMessage(message) {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setNotice("Voice response is not supported in this browser. Please try Chrome or Edge.");
      return;
    }

    if (speakingId === message.id) {
      stopSpeaking();
      return;
    }

    window.speechSynthesis.cancel();

    const text = getMessageText(message.content).trim();

    if (!text) {
      setNotice("There is no text available to read aloud.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[\u0600-\u06FF]/.test(text) ? "ur-PK" : "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onstart = () => setSpeakingId(message.id);
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => {
      setSpeakingId(null);
      setNotice("Could not play the voice response. Please try again.");
    };

    setSpeakingId(message.id);
    window.speechSynthesis.speak(utterance);
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
      !event.nativeEvent?.isComposing &&
      preferences.enterToSend
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
      <style>{`
        .nexa-settings-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(3,5,16,.76);backdrop-filter:blur(8px)}
        .nexa-settings-panel{width:min(100%,500px);max-height:90vh;overflow:auto;padding:26px;border:1px solid #51417d;border-radius:22px;background:#11162c;color:#f4f2ff;box-shadow:0 25px 80px #0009}
        .nexa-settings-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:22px}
        .nexa-settings-head h2{margin:0 0 7px;font-size:23px}.nexa-settings-head p{margin:0;color:#a8acc8;font-size:13px}
        .nexa-settings-section{padding:18px 0;border-top:1px solid #ffffff18}.nexa-settings-section h3{margin:0 0 14px;font-size:16px}
        .nexa-settings-section>label{display:block;margin:13px 0 8px;color:#b9bdd5;font-size:13px}
        .nexa-settings-options{display:flex;gap:10px}.nexa-setting-choice{flex:1;display:flex;justify-content:center;align-items:center;gap:8px;padding:12px;border:1px solid #ffffff25;border-radius:11px;background:#191f3a;color:#eee;cursor:pointer}
        .nexa-setting-choice.active{border-color:#a05cff;background:#38215e}
        .nexa-settings-section select{width:100%;padding:12px;border:1px solid #ffffff25;border-radius:10px;background:#191f3a;color:#f4f2ff}
        .nexa-settings-check{display:flex!important;align-items:center;gap:10px;cursor:pointer}.nexa-settings-check input{accent-color:#9147ff;width:17px;height:17px}
        .nexa-settings-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-top:16px;border-top:1px solid #ffffff18}
        .nexa-settings-footer span{display:flex;align-items:center;gap:6px;color:#a9e7c2;font-size:12px}
        .nexa-settings-done{border:0;border-radius:10px;padding:11px 22px;background:linear-gradient(110deg,#9945ff,#6525e8);color:white;font-weight:600;cursor:pointer}
        .app.light-mode .nexa-settings-panel{background:#fff;color:#20233b;border-color:#ddd}.app.light-mode .nexa-settings-head p,.app.light-mode .nexa-settings-section>label{color:#626780}
        .app.light-mode .nexa-setting-choice,.app.light-mode .nexa-settings-section select{background:#f2f3fb;color:#20233b;border-color:#dfe1ed}
        .nexa-help-panel{width:min(100%,620px);max-height:90vh;overflow:auto;padding:26px;border:1px solid #51417d;border-radius:22px;background:#11162c;color:#f4f2ff;box-shadow:0 25px 80px #0009}
        .nexa-pro-hero{position:relative;overflow:hidden;margin:8px 0 18px;padding:24px;border:1px solid #a56bff55;border-radius:18px;background:radial-gradient(circle at 85% 15%,#8b4dff55,transparent 42%),linear-gradient(135deg,#21143f,#171d39 75%)}
        .nexa-pro-hero h3{margin:0 0 8px;font-size:22px}.nexa-pro-hero p{margin:0;color:#c7c0e2;font-size:13px;line-height:1.65}
        .nexa-pro-list{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0}
        .nexa-pro-feature{display:flex;align-items:center;gap:10px;padding:13px;border:1px solid #ffffff20;border-radius:12px;background:#191f3a;color:#e9e5fa;font-size:13px}
        .nexa-pro-feature svg{flex:none;color:#c39aff}
        .nexa-pro-status{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;border:1px solid #ffffff20;border-radius:13px;background:#191f3a}
        .nexa-pro-status strong{display:block;margin-bottom:4px}.nexa-pro-status small{color:#aeb4d0}
        .nexa-pro-badge{padding:6px 10px;border-radius:20px;background:#3b2b17;color:#ffd58b;font-size:11px;font-weight:750;white-space:nowrap}
        .app.light-mode .nexa-pro-hero{background:linear-gradient(135deg,#f0e7ff,#f5f3ff);border-color:#d7c2ff}.app.light-mode .nexa-pro-hero p{color:#5f5877}
        .app.light-mode .nexa-pro-feature,.app.light-mode .nexa-pro-status{background:#f5f5fb;color:#20233b;border-color:#dfe1ed}.app.light-mode .nexa-pro-status small{color:#626780}
        @media(max-width:520px){.nexa-pro-list{grid-template-columns:1fr}}
        .nexa-help-card{margin:12px 0;padding:15px;border:1px solid #ffffff20;border-radius:13px;background:#191f3a}
        .nexa-help-card summary{cursor:pointer;font-weight:650;list-style:none}.nexa-help-card summary::-webkit-details-marker{display:none}.nexa-help-card p{margin:10px 0 0;color:#b9bdd5;font-size:13px;line-height:1.65}
        .nexa-help-status{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px;border:1px solid #ffffff20;border-radius:13px;background:#191f3a}
        .nexa-help-status strong{display:block;margin-bottom:4px}.nexa-help-status small{color:#aeb4d0}
        .nexa-help-action{border:1px solid #ffffff25;border-radius:10px;padding:10px 14px;background:#342052;color:#fff;font-weight:600;cursor:pointer}
        .nexa-help-panel textarea{width:100%;min-height:90px;resize:vertical;padding:12px;border:1px solid #ffffff25;border-radius:10px;background:#191f3a;color:#f4f2ff}
        .app.light-mode .nexa-help-panel{background:#fff;color:#20233b;border-color:#ddd}.app.light-mode .nexa-help-card,.app.light-mode .nexa-help-status,.app.light-mode .nexa-help-panel textarea{background:#f5f5fb;color:#20233b;border-color:#dfe1ed}.app.light-mode .nexa-help-card p,.app.light-mode .nexa-help-status small{color:#626780}
        @media(max-width:520px){.nexa-settings-panel,.nexa-help-panel{padding:19px}.nexa-settings-footer{align-items:flex-start;flex-direction:column}}
      `}</style>

      {settingsOpen && (
        <div className="nexa-settings-overlay" onClick={() => setSettingsOpen(false)}>
          <section className="nexa-settings-panel" role="dialog" aria-modal="true" aria-labelledby="nexa-settings-title" onClick={(event) => event.stopPropagation()}>
            <div className="nexa-settings-head">
              <div><h2 id="nexa-settings-title">Nexa AI Settings</h2><p>Customize your chat experience.</p></div>
              <button type="button" className="icon-btn" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={19}/></button>
            </div>
            <div className="nexa-settings-section">
              <h3>Appearance</h3><label>Choose theme</label>
              <div className="nexa-settings-options">
                <button type="button" className={`nexa-setting-choice ${preferences.theme === "dark" ? "active" : ""}`} onClick={() => updatePreference("theme", "dark")}><Moon size={17}/> Dark</button>
                <button type="button" className={`nexa-setting-choice ${preferences.theme === "light" ? "active" : ""}`} onClick={() => updatePreference("theme", "light")}><Sun size={17}/> Light</button>
              </div>
            </div>
            <div className="nexa-settings-section">
              <h3>Chat Preferences</h3>
              <label htmlFor="nexa-font-size">Message font size</label>
              <select id="nexa-font-size" value={preferences.fontSize} onChange={(event) => updatePreference("fontSize", event.target.value)}>
                <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
              </select>
              <label htmlFor="nexa-response-language">Preferred response language</label>
              <select id="nexa-response-language" value={preferences.responseLanguage} onChange={(event) => updatePreference("responseLanguage", event.target.value)}>
                <option value="auto">Automatic (match my message)</option><option value="english">English</option><option value="roman-urdu">Roman Urdu</option>
              </select>
              <label className="nexa-settings-check"><input type="checkbox" checked={preferences.enterToSend} onChange={(event) => updatePreference("enterToSend", event.target.checked)}/> Press Enter to send messages</label>
            </div>
            <div className="nexa-settings-footer"><span><Check size={15}/> Preferences save automatically</span><button type="button" className="nexa-settings-done" onClick={() => setSettingsOpen(false)}>Done</button></div>
          </section>
        </div>
      )}

      {helpOpen && (
        <div className="nexa-settings-overlay" onClick={() => setHelpOpen(false)}>
          <section className="nexa-help-panel" role="dialog" aria-modal="true" aria-labelledby="nexa-help-title" onClick={(event) => event.stopPropagation()}>
            <div className="nexa-settings-head">
              <div><h2 id="nexa-help-title">Help & Support</h2><p>Find quick answers or check your Nexa AI connection.</p></div>
              <button type="button" className="icon-btn" onClick={() => setHelpOpen(false)} aria-label="Close help"><X size={19}/></button>
            </div>

            <div className="nexa-help-status">
              <div><strong>AI service connection</strong><small>{backendStatus === "online" ? "Backend is responding normally." : backendStatus === "offline" ? "Could not reach the backend. Check your connection and try again." : backendStatus === "checking" ? "Checking the service..." : "Run a quick check to see whether Nexa AI is reachable."}</small></div>
              <button type="button" className="nexa-help-action" onClick={checkBackendStatus} disabled={checkingBackend}>{checkingBackend ? "Checking…" : "Check status"}</button>
            </div>

            <div className="nexa-settings-section">
              <h3>Frequently Asked Questions</h3>
              <details className="nexa-help-card"><summary>Why is Nexa AI not responding?</summary><p>Check your internet connection, then use “Check status” above. If the service is online but chat still fails, refresh the page and try a new chat.</p></details>
              <details className="nexa-help-card"><summary>How do I save my conversations?</summary><p>Conversation history is saved in this browser. Clearing browser site data or using another browser/device may remove or hide this local history.</p></details>
              <details className="nexa-help-card"><summary>Which files can I attach?</summary><p>You can attach supported text documents such as TXT, Markdown, CSV, JSON and text-based PDF files. Images can also be attached in JPG, PNG or WEBP format, subject to the size limits shown by the app.</p></details>
              <details className="nexa-help-card"><summary>How do I change the language or appearance?</summary><p>Open Settings in the sidebar to choose Dark or Light theme, message font size, preferred response language and Enter-to-send behavior.</p></details>
              <details className="nexa-help-card"><summary>Why is voice input unavailable?</summary><p>Use a supported browser such as Chrome or Edge, allow microphone permission for this site, and check that your microphone is connected.</p></details>
            </div>

            <div className="nexa-settings-section">
              <h3>Report an issue</h3>
              <label htmlFor="nexa-support-message">Tell us what went wrong</label>
              <textarea id="nexa-support-message" value={supportMessage} onChange={(event) => setSupportMessage(event.target.value)} placeholder="Describe the problem and what you were doing when it happened…" maxLength={1500}/>
              <div className="nexa-settings-footer" style={{marginTop:14}}>
                <span><Check size={15}/> Copy a diagnostic report to share with support</span>
                <button type="button" className="nexa-settings-done" onClick={copySupportDiagnostics}>Copy support report</button>
              </div>
            </div>
          </section>
        </div>
      )}

      {proOpen && (
        <div className="nexa-settings-overlay" onClick={() => setProOpen(false)}>
          <section
            className="nexa-help-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nexa-pro-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="nexa-settings-head">
              <div>
                <h2 id="nexa-pro-title"><Crown size={22} style={{ verticalAlign: "middle", color: "#c39aff" }} /> Nexa AI Pro</h2>
                <p>Explore a premium AI experience with more possibilities and powerful features.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setProOpen(false)} aria-label="Close Pro window">
                <X size={19} />
              </button>
            </div>

            <div className="nexa-pro-hero">
              <h3>More power for your ideas.</h3>
              <p>We are planning additional tools and enhanced capabilities to make your Nexa AI experience even more useful.</p>
            </div>

            <div className="nexa-pro-list">
              <div className="nexa-pro-feature"><Sparkles size={18} /> Advanced AI capabilities</div>
              <div className="nexa-pro-feature"><RefreshCw size={18} /> Priority response experience</div>
              <div className="nexa-pro-feature"><Paperclip size={18} /> Extended document tools</div>
              <div className="nexa-pro-feature"><Lightbulb size={18} /> More creative features</div>
            </div>

            <div className="nexa-pro-status">
              <div>
                <strong>Pro membership</strong>
                <small>Premium plans are planned for a future update.</small>
              </div>
              <span className="nexa-pro-badge">Coming Soon</span>
            </div>

            <div className="nexa-settings-footer" style={{ marginTop: 18 }}>
              <span><Check size={15} /> No payment is being taken.</span>
              <button type="button" className="nexa-settings-done" onClick={() => setProOpen(false)}>Got it</button>
            </div>
          </section>
        </div>
      )}

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
            onClick={() => updatePreference("theme", lightMode ? "dark" : "light")}
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
                onClick={() => {
                  setSettingsOpen(true);
                  setSidebarOpen(false);
                  setNotice("");
                }}
              >
                <Settings size={19} /> Settings
              </button>

              <button
                type="button"
                className="side-link"
                onClick={() => {
                  setHelpOpen(true);
                  setSidebarOpen(false);
                  setNotice("");
                  setBackendStatus("not-checked");
                }}
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
                  onClick={() => {
                    setProOpen(true);
                    setSidebarOpen(false);
                    setNotice("");
                  }}
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
                        updatePreference("theme", lightMode ? "dark" : "light");
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

                      <div
                        className="message-content"
                        style={{
                          fontSize: preferences.fontSize === "small" ? "14px" : preferences.fontSize === "large" ? "19px" : "16px"
                        }}
                      >
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
                            onClick={() => speakMessage(message)}
                            disabled={thinking}
                            title={speakingId === message.id ? "Stop reading" : "Read response aloud"}
                          >
                            <Volume2 size={14} />
                            {speakingId === message.id ? "Stop" : "Read Aloud"}
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
                  className={`icon-btn ${listening ? "selected" : ""}`}
                  title={listening ? "Stop voice input" : "Start voice input"}
                  aria-label={listening ? "Stop voice input" : "Start voice input"}
                  onClick={startVoiceInput}
                  disabled={thinking}
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
