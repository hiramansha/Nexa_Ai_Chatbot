
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
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

    // Handle browser preflight requests
    if (request.method === "OPTIONS") {
      if (origin && origin !== allowedOrigin) {
        return json({ error: "Origin not allowed" }, 403);
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Health check
    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({ success: true, status: "ok" });
    }

    // Serve frontend assets for non-API routes
    if (url.pathname !== "/api/chat") {
      return env.ASSETS.fetch(request);
    }

    // Chat endpoint accepts POST only
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (origin && origin !== allowedOrigin) {
      return json({ error: "Origin not allowed" }, 403);
    }

    if (!env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY secret is missing.");
      return json({ error: "AI service is not configured." }, 500);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Request body must contain valid JSON." }, 400);
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

    try {
      const response = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: env.OPENAI_MODEL || "gpt-4.1-mini",
            instructions:
              "You are Nexa AI, a helpful assistant. Reply in the language of the user's latest message. Use Urdu script for Urdu script input, Roman Urdu for Roman Urdu input, and English for English input. Give relevant, accurate answers.",
            input: messages.map(({ role, content }) => ({
              role,
              content
            }))
          })
        }
      );

      let result;

      try {
        result = await response.json();
      } catch {
        console.error("OpenAI returned an invalid JSON response.");
        return json({ error: "Invalid response from AI service." }, 502);
      }

      if (!response.ok) {
        console.error("OpenAI API error:", response.status, result.error);

        if (response.status === 429) {
          return json({
            error: "AI usage limit reached. Check API billing and limits."
          }, 429);
        }

        return json({
          error: "AI service request failed. Check the Worker logs."
        }, 502);
      }

      const reply = (result.output || [])
        .flatMap((item) => item.content || [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text)
        .join("\n")
        .trim();

      if (!reply) {
        console.error("OpenAI response did not contain output text.");
        return json({ error: "Empty AI response." }, 502);
      }

      return json({ reply });
    } catch (error) {
      console.error("Worker error:", error.message);
      return json({ error: "Unable to process your message." }, 500);
    }
  }
};
