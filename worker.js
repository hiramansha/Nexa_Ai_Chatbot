
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.FRONTEND_URL?.replace(/\/$/, "");

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

    // Handle browser CORS preflight requests
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
        provider: "Cloudflare Workers AI"
      });
    }

    // Serve frontend assets for non-chat routes
    if (url.pathname !== "/api/chat") {
      return env.ASSETS.fetch(request);
    }

    // Chat endpoint accepts POST only
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    // Validate frontend origin
    if (!origin || origin !== allowedOrigin) {
      return json({ error: "Origin not allowed" }, 403);
    }

    // Check Cloudflare AI binding
    if (!env.AI) {
      console.error("Cloudflare AI binding is missing.");

      return json({
        error: "AI service is not configured. Check the AI binding."
      }, 500);
    }

    // Parse request body
    let body;

    try {
      body = await request.json();
    } catch {
      return json({
        error: "Request body must contain valid JSON."
      }, 400);
    }

    const messages = body?.messages;

    // Validate chat messages
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

    // Keep recent conversation history
    const chatMessages = messages.slice(-20).map(
      ({ role, content }) => ({
        role,
        content: content.slice(0, 12000)
      })
    );

    // Add Nexa's instructions for multilingual replies
    const modelMessages = [
      {
        role: "system",
        content:
          "You are Nexa AI, a helpful and accurate assistant. Reply in the language of the user's latest message. Use Urdu script for Urdu script input, Roman Urdu for Roman Urdu input, and English for English input. Keep answers relevant, clear, and friendly."
      },
      ...chatMessages
    ];

    try {
      // Generate a reply using Cloudflare Workers AI
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
          error: "The AI model returned an empty response. Please try again."
        }, 502);
      }

      return json({ reply });
    } catch (error) {
      console.error("Cloudflare Workers AI error:", error?.message || error);

      return json({
        error:
          "Cloudflare AI request failed. Check the Worker logs and AI usage limits."
      }, 502);
    }
  }
};
