
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

    // Handle browser preflight requests
    if (request.method === "OPTIONS") {
      if (!origin || origin !== allowedOrigin) {
        return json({ error: "Origin not allowed" }, 403);
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Health check
    if (
      url.pathname === "/api/health" &&
      request.method === "GET"
    ) {
      return json({
        success: true,
        status: "ok",
        provider: "Cloudflare Workers AI",
        aiBindingAvailable: Boolean(env.AI),
        frontendConfigured: Boolean(allowedOrigin)
      });
    }

    // Chat endpoint
    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, 405);
      }

      if (!origin || origin !== allowedOrigin) {
        return json({ error: "Origin not allowed" }, 403);
      }

      if (!env.AI) {
        console.error("Missing Cloudflare AI binding.");

        return json({
          error: "Cloudflare AI binding is missing."
        }, 500);
      }

      let body;

      try {
        body = await request.json();
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
        !messages.every(
          (message) =>
            message &&
            ["user", "assistant"].includes(message.role) &&
            typeof message.content === "string" &&
            message.content.trim().length > 0 &&
            message.content.length <= 12000
        ) ||
        messages[messages.length - 1].role !== "user"
      ) {
        return json({ error: "Invalid messages." }, 400);
      }

      const chatMessages = messages.slice(-20).map(
        ({ role, content }) => ({
          role,
          content: content.slice(0, 12000)
        })
      );

      
const modelMessages = [
  {
    role: "system",
    content: `
You are Nexa AI, a multilingual, general-purpose AI assistant.

LANGUAGE:
- Understand and respond in any language you can reliably support.
- Reply in the user's language and writing style.
- Follow an explicitly requested language.
- Understand mixed-language messages where possible.

ANSWER QUALITY:
- Answer the exact question directly and accurately.
- Help with all topics within your knowledge and capabilities.
- Give relevant answers, not unrelated conversation.
- Keep simple answers short and explain complex topics step by step.
- Understand previous messages and follow-up questions.
- Provide complete code when appropriate for coding requests.
- Never invent facts or sources.
- If uncertain, say so honestly.
- Ask clarifying questions only when necessary.
- Respond naturally to greetings and thanks.
- If the user says "Assalam o Alaikum", reply "Wa Alaikum Assalam".
- Use clear formatting when helpful.

Be respectful, helpful, accurate, and relevant.
`
  },
  ...chatMessages
];


      try {
        const result = await env.AI.run(
          "@cf/meta/llama-3.1-8b-instruct-fast",
          {
            messages: modelMessages,
            max_tokens: 1024
          }
        );

        const reply =
          typeof result?.response === "string"
            ? result.response.trim()
            : "";

        if (!reply) {
          console.error(
            "Workers AI returned an empty response:",
            JSON.stringify(result)
          );

          return json({
            error: "The AI model returned an empty response."
          }, 502);
        }

        return json({ reply });
      } catch (error) {
        const details =
          error instanceof Error
            ? error.message
            : String(error);

        console.error("Cloudflare Workers AI error:", details);

        return json({
          error: "Cloudflare Workers AI request failed.",
          details
        }, 502);
      }
    }

    // Serve other frontend assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return json({ error: "Route not found." }, 404);
  }
};
