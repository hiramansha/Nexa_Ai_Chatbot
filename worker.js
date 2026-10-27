export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowedOrigin = env.FRONTEND_URL;

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
      if (origin && origin !== allowedOrigin) {
        return json({ error: "Origin not allowed" }, 403);
      }
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({ success: true, status: "ok" });
    }

    if (url.pathname !== "/api/chat") {
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (origin && origin !== allowedOrigin) {
      return json({ error: "Origin not allowed" }, 403);
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: "OPENAI_API_KEY secret is missing." }, 500);
    }

    try {
      const body = await request.json();
      const messages = body?.messages;

      if (
        !Array.isArray(messages) ||
        messages.length === 0 ||
        messages.length > 30 ||
        !messages.every(
          (m) =>
            m &&
            ["user", "assistant"].includes(m.role) &&
            typeof m.content === "string" &&
            m.content.trim().length > 0 &&
            m.content.length <= 12000
        ) ||
        messages[messages.length - 1].role !== "user"
      ) {
        return json({ error: "Invalid messages." }, 400);
      }

      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL || "gpt-4.1-mini",
          instructions:
            "You are Nexa AI, a helpful assistant. Reply in the language of the user's latest message. Use Urdu script for Urdu script input, Roman Urdu for Roman Urdu input, and English for English input. Give relevant, accurate answers.",
          input: messages.map(({ role, content }) => ({ role, content }))
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("OpenAI API error:", response.status, result.error);
        return json({
          error: response.status === 429
            ? "AI usage limit reached. Check API billing and limits."
            : "AI request failed. Check the API configuration."
        }, response.status === 429 ? 429 : 502);
      }

      const reply = (result.output || [])
        .flatMap((item) => item.content || [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text)
        .join("\n")
        .trim();

      if (!reply) {
        return json({ error: "Empty AI response." }, 502);
      }

      return json({ reply });
    } catch (error) {
      console.error("Worker error:", error.message);
      return json({ error: "Unable to process your message." }, 500);
    }
  }
};
