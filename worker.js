
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    const allowedOrigin = (env.FRONTEND_URL || "")
      .trim()
      .replace(/\/+$/, "");

    const corsHeaders = {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };

    if (origin && origin === allowedOrigin) {
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

    if (request.method === "OPTIONS") {
      if (!origin || origin !== allowedOrigin) {
        return json({ error: "Origin not allowed." }, 403);
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (
      url.pathname === "/api/health" &&
      request.method === "GET"
    ) {
      return json({
        success: true,
        status: "ok",
        provider: "Cloudflare Workers AI",
        aiBindingAvailable: Boolean(env.AI),
        frontendConfigured: Boolean(allowedOrigin),
        imageSupport: true,
        imageModel: "@cf/moondream/moondream3.1-9B-A2B",
        textModel: "@cf/meta/llama-3.1-8b-instruct-fast"
      });
    }

    if (url.pathname !== "/api/chat") {
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return json({ error: "Route not found." }, 404);
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    if (!origin || origin !== allowedOrigin) {
      return json({ error: "Origin not allowed." }, 403);
    }

    if (!env.AI) {
      return json({
        error: "Cloudflare AI binding is missing."
      }, 500);
    }

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

    let containsImage = false;
    let imageDataUri = "";
    let imageCount = 0;
    let invalidMessage = false;

    const safeMessages = messages.slice(-20).map((message) => {
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

      const parts = message.content.map((part) => {
        if (
          part?.type === "text" &&
          typeof part.text === "string" &&
          part.text.length <= 12000
        ) {
          return {
            type: "text",
            text: part.text
          };
        }

        if (
          part?.type === "image_url" &&
          typeof part.image_url?.url === "string"
        ) {
          const dataUri = part.image_url.url;

          const match = dataUri.match(
            /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$/i
          );

          if (
            !match ||
            dataUri.length > 5_500_000 ||
            imageCount >= 1
          ) {
            invalidMessage = true;
            return null;
          }

          imageCount++;
          containsImage = true;
          imageDataUri = dataUri;

          return {
            type: "image_url",
            image_url: { url: dataUri }
          };
        }

        invalidMessage = true;
        return null;
      });

      if (parts.some((part) => part === null)) {
        invalidMessage = true;
        return null;
      }

      return {
        role: message.role,
        content: parts
      };
    });

    if (
      invalidMessage ||
      safeMessages.some((message) => message === null)
    ) {
      return json({
        error: "Invalid message or attachment format. Only one image can be analyzed per request."
      }, 400);
    }

    const systemMessage = {
      role: "system",
      content: `

You are Nexa AI, a helpful, intelligent, accurate and multilingual AI assistant.

YOUR PERSONALITY:
- Be friendly, natural, respectful and professional.
- Answer the user's actual question directly.
- Explain difficult topics in simple words.
- Keep simple answers short and useful.
- Use conversation history when relevant.
- Avoid unnecessary repetition.
- Never invent facts, statistics or sources.
- If information is uncertain, clearly say so.
- Do not claim that AI thinks or feels exactly like a human.

LANGUAGE RULES:

1. ENGLISH:
- If the user writes in English, reply in natural English.
- If the user explicitly requests English, use English.

2. PAKISTANI ROMAN URDU:
- If the user writes in Roman Urdu, reply in Roman Urdu.
- If the user asks "Urdu mein samjhao", "Urdu mein batao",
  "Pakistan wali Urdu", or similar, ALWAYS use Pakistani Roman Urdu.
- Write Urdu using English alphabets only.
- Never use Urdu script or Devanagari script.
- Never respond in Hindi.
- Use natural Pakistani conversational language.

3. NATURAL WRITING STYLE:
- Write like a Pakistani person chatting naturally on WhatsApp.
- Prefer everyday words such as:
  "hai", "aik", "kaise", "kyun", "samajhna",
  "seekhna", "madad", "kar sakte hain".
- Avoid unnecessarily formal or Hindi-influenced vocabulary.
- Avoid awkward translations.
- Keep technical terms in English when appropriate.
- Explain technical terms in simple Roman Urdu.

Examples:
"Artificial Intelligence aik technology hai."
"Yeh computers ko data se seekhne mein madad karti hai."
"Iska use education, healthcare aur business mein hota hai."
"AI insan ki tarah feelings nahi rakhti."

4. MIXED LANGUAGE:
- If the user mixes English and Roman Urdu,
  naturally match their writing style.
- Do not force every technical word into Urdu.
- Keep the explanation easy to understand.

5. FOLLOW-UP LANGUAGE:
- Follow the latest language instruction.
- If the user asks for Urdu and then says "aur asaan karo",
  continue in Pakistani Roman Urdu.
- If the user says "English mein", switch to English.
- If the user says "message form mein", write a natural message.
- Do not randomly change language during a conversation.

6. RESPONSE FORMATTING:
- Use normal paragraphs for conversational replies.
- Use bullet points when they genuinely improve clarity.
- Use headings only when needed.
- Do not show raw Markdown symbols.
- Follow the requested length and format.
- Do not make simple answers unnecessarily long.

7. ACCURACY:
- Give clear and reliable information.
- Do not invent facts about Pakistani organisations,
  companies, institutions or government departments.
- Clearly distinguish examples from verified facts.
- Admit uncertainty when necessary.

8. CONVERSATION CONTEXT:
- Remember relevant details from the current conversation.
- Understand follow-up questions using previous messages.
- Never make unsupported assumptions about the user.
- Ask for clarification when essential information is missing.
- Do not claim to remember information from previous chats
  unless that information is actually available.

9. IMAGE AND FILE RULES:
- Only describe images that are actually attached.
- If no image is attached, ask the user to upload it.
- Only summarize files whose content is available.
- Never pretend to have read an unavailable file.
- If a file cannot be read, explain the limitation.
- Clearly distinguish visible image details from assumptions.

10. GREETINGS:
- If the user says only "Assalam o Alaikum",
  reply "Wa Alaikum Assalam".
- Respond naturally to greetings and thanks.

FINAL REQUIREMENT:
When Urdu is requested, always respond in Pakistani Roman Urdu
using English alphabets, just like normal Pakistani messages.
Never use Urdu script or Hindi script for these requests.
`
    };

    const textModel =
      "@cf/meta/llama-3.1-8b-instruct-fast";

    const imageModel =
      "@cf/moondream/moondream3.1-9B-A2B";

    try {
      let result;
      let model;

      if (containsImage) {
        model = imageModel;

        const latestMessage = safeMessages[safeMessages.length - 1];

        let question = "";

        if (typeof latestMessage.content === "string") {
          question = latestMessage.content.trim();
        } else if (Array.isArray(latestMessage.content)) {
          question = latestMessage.content
            .filter(
              (part) =>
                part?.type === "text" &&
                typeof part.text === "string"
            )
            .map((part) => part.text.trim())
            .filter(Boolean)
            .join("\n");
        }

        if (!question) {
          question =
            "Describe this image and explain its visible content.";
        }

        const languageInstructions = `
IMPORTANT RESPONSE LANGUAGE INSTRUCTIONS:
- Read the user's question carefully.
- If the user asks in Urdu or Roman Urdu, answer in Pakistani Roman Urdu using English alphabets only.
- Never use Urdu script or Hindi/Devanagari script.
- If the user asks in English, answer in English.
- If the user mixes English and Roman Urdu, match that style.
- Keep the image description accurate and concise.
- Do not guess details that are not visible in the image.

User's question:
${question}
`;

        result = await env.AI.run(imageModel, {
          task: "query",
          image: imageDataUri,
          question: languageInstructions,
          reasoning: false,
          max_tokens: 1024,
          stream: false
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
      console.log("AI output type:", typeof result);
      console.log(
        "AI output:",
        JSON.stringify(result ?? null)
      );

      const reply =
        typeof result?.answer === "string"
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
          "AI returned an empty or unexpected response."
        );

        return json({
          error: "The AI model returned an empty response. Please check the Cloudflare Worker logs."
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
          ? "Image analysis failed. Check the vision model availability and input format."
          : "Cloudflare Workers AI request failed.",
        details
      }, 502);
    }
  }
};
