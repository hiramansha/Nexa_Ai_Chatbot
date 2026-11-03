
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    // Allowed frontend origins
    const allowedOrigins = new Set(
      [
        env.FRONTEND_URL,
        ...(env.FRONTEND_URLS || "").split(","),
        "https://nexa-ai-chatbot-sigma.vercel.app",
        "https://nexa-ai-chatbot-git-main-hira10.vercel.app",
        "http://localhost:5173"
      ]
        .map((value) => (value || "").trim().replace(/\/+$/, ""))
        .filter(Boolean)
    );

    const originAllowed = origin
      ? allowedOrigins.has(origin.replace(/\/+$/, ""))
      : false;

    const corsHeaders = {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };

    if (originAllowed) {
      corsHeaders["Access-Control-Allow-Origin"] = origin;
    }

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders
        }
      });

    // CORS preflight
    if (request.method === "OPTIONS") {
      if (!originAllowed) {
        return json({ error: "Origin not allowed." }, 403);
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Health check
    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({
        success: true,
        status: "ok",
        provider: "Cloudflare Workers AI",
        aiBindingAvailable: Boolean(env.AI),
        frontendConfigured: allowedOrigins.size > 0,
        imageSupport: true,
        textModel: "@cf/meta/llama-3.1-8b-instruct-fast",
        imageModel: "@cf/moondream/moondream3.1-9B-A2B"
      });
    }

    // Unknown routes
    if (url.pathname !== "/api/chat") {
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return json({ error: "Route not found." }, 404);
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    if (!originAllowed) {
      return json({ error: "Origin not allowed." }, 403);
    }

    if (!env.AI) {
      return json({
        error: "Cloudflare Workers AI binding is missing."
      }, 500);
    }

    // Read request body
    let body;

    try {
      const rawBody = await request.text();

      if (rawBody.length > 8_000_000) {
        return json({
          error: "Request is too large. Please use a smaller image or file."
        }, 413);
      }

      body = JSON.parse(rawBody);
    } catch {
      return json({
        error: "Request body must contain valid JSON."
      }, 400);
    }

    const messages = body?.messages;

    if (
      !Array.isArray(messages) ||
      messages.length === 0 ||
      messages.length > 30 ||
      messages[messages.length - 1]?.role !== "user"
    ) {
      return json({ error: "Invalid messages." }, 400);
    }

    let invalidMessage = false;
    let imageDataUri = "";
    let containsImage = false;

    // Validate and prepare recent conversation messages.
    // Images from older messages are not sent again.
    const recentMessages = messages.slice(-20);

    const safeMessages = recentMessages.map((message, index) => {
      if (
        !message ||
        !["user", "assistant"].includes(message.role)
      ) {
        invalidMessage = true;
        return null;
      }

      if (typeof message.content === "string") {
        if (
          !message.content.trim() ||
          message.content.length > 12000
        ) {
          invalidMessage = true;
          return null;
        }

        return {
          role: message.role,
          content: message.content
        };
      }

      if (
        message.role !== "user" ||
        !Array.isArray(message.content) ||
        message.content.length === 0 ||
        message.content.length > 6
      ) {
        invalidMessage = true;
        return null;
      }

      const parts = [];

      for (const part of message.content) {
        if (
          part?.type === "text" &&
          typeof part.text === "string" &&
          part.text.length <= 12000
        ) {
          if (part.text.trim()) {
            parts.push({
              type: "text",
              text: part.text
            });
          }

          continue;
        }

        if (
          part?.type === "image_url" &&
          typeof part.image_url?.url === "string"
        ) {
          // Only the latest message's image is analyzed.
          if (index !== recentMessages.length - 1) {
            continue;
          }

          const dataUri = part.image_url.url;

          const match = dataUri.match(
            /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$/i
          );

          if (!match || dataUri.length > 5_500_000 || containsImage) {
            invalidMessage = true;
            continue;
          }

          containsImage = true;
          imageDataUri = match[2].replace(/\s/g, "");

          continue;
        }

        invalidMessage = true;
      }

      if (invalidMessage) {
        return null;
      }

      const textContent = parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");

      if (containsImage && index === recentMessages.length - 1) {
        return {
          role: "user",
          content: textContent || "Please analyze this image."
        };
      }

      if (!textContent.trim()) {
        invalidMessage = true;
        return null;
      }

      return {
        role: message.role,
        content: textContent
      };
    });

    if (
      invalidMessage ||
      safeMessages.some((message) => message === null)
    ) {
      return json({
        error: "Invalid message or attachment format. Please check your message and image."
      }, 400);
    }

    const latestMessage = safeMessages[safeMessages.length - 1];

    if (!latestMessage || latestMessage.role !== "user") {
      return json({ error: "The latest message must be from the user." }, 400);
    }

    // Nexa AI system instructions
    const systemMessage = {
      role: "system",
      content: `
You are Nexa AI, a helpful, intelligent, accurate and multilingual AI assistant.

PERSONALITY:
- Be friendly, natural, respectful and professional.
- Answer the user's actual question directly.
- Explain difficult topics in simple words.
- Keep simple answers short and useful.
- Use conversation history when relevant.
- Avoid unnecessary repetition.
- Never invent facts, statistics or sources.
- Clearly state uncertainty when information is uncertain.

LANGUAGE RULES:

1. English:
- If the user writes in English, reply in natural English.
- If the user requests English, use English.

2. Pakistani Roman Urdu:
- If the user writes in Roman Urdu, reply in Pakistani Roman Urdu.
- Use English alphabets only.
- Never use Urdu script or Hindi/Devanagari script.
- Never respond in Hindi.
- Use natural Pakistani conversational language.

3. Mixed language:
- Match the user's English and Roman Urdu writing style.
- Keep technical terms in English when appropriate.
- Explain difficult technical terms simply.

4. Follow-up instructions:
- Follow the latest language instruction.
- If the user asks for Urdu and then says "make it easier", continue in Roman Urdu.
- If the user asks for English, switch to English.
- Follow requested length and format.

5. Formatting:
- Use normal paragraphs for conversational replies.
- Use bullets when useful.
- Use headings only when needed.
- Do not make simple answers unnecessarily long.

6. Accuracy:
- Do not invent facts about organisations, companies or institutions.
- Distinguish examples from verified facts.
- Admit uncertainty when necessary.

7. Images and files:
- Only describe images actually provided.
- Never pretend to have read an unavailable file.
- Clearly distinguish visible details from assumptions.

8. Greetings:
- If the user says only "Assalam o Alaikum",
  reply "Wa Alaikum Assalam".
- Respond naturally to greetings and thanks.

FINAL RULE:
When Urdu is requested, always use Pakistani Roman Urdu
with English alphabets only.
`
    };

    const textModel = "@cf/meta/llama-3.1-8b-instruct-fast";
    const imageModel = "@cf/moondream/moondream3.1-9B-A2B";

    try {
      let result;
      let model;

      if (containsImage) {
        model = imageModel;

        const question = latestMessage.content.trim() ||
          "Describe this image and explain its visible content.";

        const languageInstructions = `
Read the user's question carefully.

- If the question is in English, answer in English.
- If the question is in Roman Urdu, answer in Pakistani Roman Urdu using English alphabets only.
- Never use Urdu script or Hindi/Devanagari script.
- If the user mixes English and Roman Urdu, match that style.
- Describe only what is visible.
- Do not invent details.
- Keep the answer clear and useful.

User's question:
${question}
`;

        const imageBytes = Uint8Array.from(
          atob(imageDataUri),
          (character) => character.charCodeAt(0)
        );

        result = await env.AI.run(imageModel, {
          image: imageBytes,
          question: languageInstructions,
          task: "query",
          max_tokens: 1024
        });
      } else {
        model = textModel;

        result = await env.AI.run(textModel, {
          messages: [
            systemMessage,
            ...safeMessages
          ],
          max_tokens: 1024
        });
      }

      console.log("AI model:", model);
      console.log("AI output:", JSON.stringify(result ?? null));

      const reply =
        typeof result === "string"
          ? result.trim()
          : typeof result?.answer === "string"
            ? result.answer.trim()
            : typeof result?.response === "string"
              ? result.response.trim()
              : typeof result?.description === "string"
                ? result.description.trim()
                : typeof result?.caption === "string"
                  ? result.caption.trim()
                  : typeof result?.result?.answer === "string"
                    ? result.result.answer.trim()
                    : "";

      if (!reply) {
        console.error("AI returned an empty or unexpected response.");

        return json({
          error: "The AI model returned an empty response. Please try again."
        }, 502);
      }

      return json({
        success: true,
        reply,
        model
      });
    } catch (error) {
      const details =
        error instanceof Error
          ? error.message
          : String(error);

      console.error("Cloudflare Workers AI error:", details);

      return json({
        error: containsImage
          ? "Image analysis failed. Please try another image."
          : "Cloudflare Workers AI request failed.",
        details
      }, 502);
    }
  }
};
