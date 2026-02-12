import OpenAI from "openai";

function sendJson(res, status, payload) {
  if (typeof res.status === "function") {
    return res.status(status).json(payload);
  }

  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
  return undefined;
}

function parseModelJson(rawText) {
  const raw = (rawText || "").trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {}

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return {};

  try {
    return JSON.parse(match[0]);
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Use POST" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 500, { error: "Missing OPENAI_API_KEY" });
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0,
      timeout: 15000,
    });
    const { text } = req.body || {};
    const ingredient = typeof text === "string" ? text.trim().slice(0, 160) : "";

    if (!ingredient) {
      return sendJson(res, 400, { error: "Missing ingredient text" });
    }

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      instructions:
        "You estimate calories for a single ingredient line the user typed. " +
        "Return ONLY valid JSON with keys: calories (number), notes (string). " +
        "Make a reasonable assumption for quantity if unclear. Assume no added oil unless stated.",
      input: `Ingredient line: "${ingredient}"\nReturn JSON now.`,
      max_output_tokens: 120,
    });

    const parsed = parseModelJson(response.output_text);

    const calories = Math.max(0, Math.round(Number(parsed.calories) || 0));
    const notes = typeof parsed.notes === "string" ? parsed.notes : "";

    return sendJson(res, 200, { calories, notes });
  } catch (error) {
    const status = Number(error?.status);
    const safeStatus = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
    const rawMessage =
      error?.error?.message ||
      error?.message ||
      "AI suggestion failed";
    const code = error?.error?.code || error?.code;
    const message =
      code === "insufficient_quota"
        ? "OpenAI quota exceeded. Add billing/credits, then retry."
        : rawMessage;
    const isProd = process.env.NODE_ENV === "production";
    return sendJson(res, safeStatus, { error: isProd ? "AI suggestion failed" : message });
  }
}
