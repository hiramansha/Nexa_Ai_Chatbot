
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
        return json({ error: "Origin not allowed" }, 403);
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
        attachmentSupport: "Text content supplied by frontend"
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
          const imageUrl = part.image_url.url;

          // Accept only embedded image data, not external URLs.
          const match = imageUrl.match(
            /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$/i
          );

          if (!match || imageUrl.length > 5_500_000) {
            invalidMessage = true;
            return null;
          }

          containsImage = true;

          return {
            type: "image_url",
            image_url: { url: imageUrl }
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
        error: "Invalid message or attachment format."
      }, 400);
    }

    const systemMessage = {
      role: "system",
      content: `
You are Nexa AI, a helpful, multilingual general-purpose assistant.

- Answer the user's actual question directly.
- Reply in the user's language and writing style.
- Follow explicit language requests.
- Understand follow-up messages using conversation history.
- Keep simple answers concise and explain complex topics clearly.
- When an image is provided, examine it and answer questions about its visible content.
- Never claim to have read an attachment unless its text is provided.
- Be honest when information is uncertain.
- Respond naturally to greetings and thanks.
- If the user says only "Assalam o Alaikum", reply "Wa Alaikum Assalam".
- Stay relevant, respectful, and accurate.
`
    };

    const modelMessages = [
      systemMessage,
      ...safeMessages
    ];

    const model = containsImage
      ? "@cf/meta/llama-3.2-11b-vision-instruct"
      : "@cf/meta/llama-3.1-8b-instruct-fast";

    try {
      const result = await env.AI.run(model, {
        messages: modelMessages,
        max_tokens: 1024
      });

      const reply =
        typeof result?.response === "string"
          ? result.response.trim()
          : "";

      if (!reply) {
        console.error("Workers AI returned an empty response.");

        return json({
          error: "The AI model returned an empty response."
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
          ? "Image analysis failed. The vision model may require licence acceptance or may be unavailable."
          : "Cloudflare Workers AI request failed.",
        details
      }, 502);
    }
  }
};
