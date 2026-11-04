
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
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

    // Supabase configuration
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      return json({
        error: "Authentication service is not configured."
      }, 500);
    }

    // Verify authentication
    const authorization = request.headers.get("Authorization") || "";
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!token) {
      return json({
        error: "Please sign in to use Nexa AI."
      }, 401);
    }

    try {
      const authResponse = await fetch(
        `${env.SUPABASE_URL.replace(/\/+$/, "")}/auth/v1/user`,
        {
          headers: {
            apikey: env.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!authResponse.ok) {
        return json({
          error: "Your session is invalid or expired. Please sign in again."
        }, 401);
      }
    } catch (error) {
      console.error("Supabase verification error:", error);

      return json({
        error: "Unable to verify your session. Please try again."
      }, 503);
    }

    // Cloudflare AI binding
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

    // Image and message validation
    let invalidMessage = false;
    let imageDataUri = "";
    let containsImage = false;

    const recentMessages = messages.slice(-20);

    const safeMessages = recentMessages.map((message, index) => {
      if (
        !message ||
        !["user", "assistant"].includes(message.role)
      ) {
        invalidMessage = true;
        return null;
      }

      // Normal text messages
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

      // Image messages
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
          // Only analyze the latest message's image
          if (index !== recentMessages.length - 1) {
            continue;
          }

          const dataUri = part.image_url.url;

          const match = dataUri.match(
            /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$/i
          );

          if (
            !match ||
            dataUri.length > 5_500_000 ||
            containsImage
          ) {
            invalidMessage = true;
            continue;
          }

          containsImage = true;

          // IMPORTANT:
          // Preserve the complete base64 data URI.
          imageDataUri = dataUri;

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
      return json({
        error: "The latest message must be from the user."
      }, 400);
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
- If the user writes in Roman Urdu, understand it as Urdu and reply in proper Urdu script.
- Never reply in Roman Urdu.
- If the user writes in Urdu script, reply in natural Urdu script.
- Use correct Pakistani Urdu vocabulary, spelling and grammar.
- Never use Hindi or Devanagari script.

3. Mixed language:
- If the user mixes English and Urdu, use a natural mix of English and Urdu script.
- Write Urdu words in Urdu script and English words in English.
- Keep technical terms in English when appropriate.

4. Follow-up instructions:
- Follow the latest language instruction.
- If the user asks for Urdu and then says "make it easier", continue in Urdu script.
- If the user asks for English, switch to English.
- Follow requested length and format.

5. Formatting:
- Use normal paragraphs for conversational replies.
- Use bullets when useful.
- Use headings only when needed.
- Do not make simple answers unnecessarily long.

6. Accuracy and relevance:
- Understand the user's exact question before answering.
- Answer the actual task directly. Never introduce unrelated activities, topics or suggestions.
- Follow every requested subject, format, duration and number of items.
- For study plans, include realistic study sessions, subjects, short breaks and revision.
- Never replace study activities with exercise, standing or unrelated daily tasks unless requested.
- Do not invent information or make unsupported assumptions.
- Use clear, natural and grammatically correct language.
- Avoid repetitive sentences and unnecessary greetings.
- If essential information is missing, ask one brief clarification.
- Admit uncertainty instead of inventing an answer.

7. Images and files:
- Only describe images actually provided.
- Never pretend to have read an unavailable file.
- Clearly distinguish visible details from assumptions.

8. Greetings:
- If the user says only "Assalam o Alaikum",
  reply "Wa Alaikum Assalam".
- Respond naturally to greetings and thanks.

FINAL RULE:
Roman Urdu input means Urdu script output.
English input means English output.
Urdu script input means Urdu script output.
Mixed input means natural English and Urdu script.
Never use Roman Urdu in responses.
`
    };

    // AI models
    const textModel = "@cf/meta/llama-3.1-8b-instruct-fast";
    const imageModel = "@cf/moondream/moondream3.1-9B-A2B";

    try {
      let result;
      let model;

      // IMAGE ANALYSIS
      if (containsImage) {
        model = imageModel;

        const question = latestMessage.content.trim() ||
          "Describe this image and explain its visible content.";

        const languageInstructions = `
Read and analyze the provided image carefully.

LANGUAGE RULES:
- English question: answer in English.
- Roman Urdu question: understand it as Urdu and answer in proper Urdu script.
- Urdu script question: answer in natural Urdu script.
- Mixed language: use natural English and Urdu script.
- Never use Roman Urdu.
- Never use Hindi or Devanagari script.

IMAGE ANALYSIS:
- Describe only details visible in the image.
- Read visible text when possible.
- Explain diagrams, objects and screenshots clearly.
- Do not invent missing information.
- If something is unclear, mention it.
- Give a useful and accurate answer.

User's question:
${question}
`;

        if (!imageDataUri) {
          return json({
            error: "Image data is missing. Please upload the image again."
          }, 400);
        }

        // Pass the complete base64 data URI to Moondream
        result = await env.AI.run(imageModel, {
          image: imageDataUri,
          question: languageInstructions,
          task: "query"
        });

      } else {
        // NORMAL TEXT CHAT
        model = textModel;

        result = await env.AI.run(textModel, {
          messages: [
            systemMessage,
            ...safeMessages
          ],
          max_tokens: 1024
        });
      }

      // Extract AI response
      console.log("AI model:", model);

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
        console.error(
          "AI returned an empty or unexpected response:",
          JSON.stringify(result ?? null)
        );

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
          ? "Image analysis failed. Please check the image or try again later."
          : "Cloudflare Workers AI request failed.",
        details
      }, 502);
    }
  }
};
