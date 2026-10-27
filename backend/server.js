
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      "http://localhost:5173"
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed"));
  }
}));

app.use(express.json({ limit: "30kb" }));

app.get("/", (_req, res) => {
  res.json({ message: "Nexa AI backend is running!" });
});

app.get("/api/health", (_req, res) => {
  res.json({ success: true, status: "ok" });
});

app.post("/api/chat", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "AI API key is not configured."
      });
    }

    const { messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Please send a message."
      });
    }

    const validMessages = messages.every(
      (message) =>
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string" &&
        message.content.trim().length > 0 &&
        message.content.length <= 12000
    );

    if (!validMessages || messages.length > 30) {
      return res.status(400).json({
        error: "Invalid messages or conversation too long."
      });
    }

    if (messages[messages.length - 1].role !== "user") {
      return res.status(400).json({
        error: "The last message must be from the user."
      });
    }

    const openai = new OpenAI({ apiKey });

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions: `
You are Nexa AI, a helpful AI assistant.

Language:
- Urdu script input: respond in Urdu script.
- Roman Urdu input: respond in Roman Urdu.
- English input: respond in English.
- Follow the language of the latest user message unless they request another language.

Give relevant, clear and accurate answers.
Explain coding questions step by step.
When asked to write an email, message or letter, provide a properly formatted draft.
Avoid generic replies when the question is clear.
If unsure, be honest.
      `.trim(),
      input: messages.map(({ role, content }) => ({
        role,
        content
      }))
    });

    const reply = response.output_text?.trim();

    if (!reply) {
      return res.status(502).json({
        error: "The AI returned an empty response."
      });
    }

    return res.json({ reply });
  } catch (error) {
    console.error("Nexa AI error:", error.message);

    if (error.status === 429) {
      return res.status(429).json({
        error: "AI usage limit reached. Check API usage and billing."
      });
    }

    return res.status(500).json({
      error: "Nexa AI could not generate a response. Check server logs."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Nexa AI backend listening on port ${PORT}`);
});
