import { calculate, formatNumber } from "../calculator.js";

const MODEL = "gemini-3.8-flash";
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const requests = new Map();

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST for a tiny math overview." });
  }

  const expression = req.body?.expression;
  if (typeof expression !== "string" || expression.length > 120) {
    return res.status(400).json({ error: "Send a short calculator expression." });
  }

  let answer;
  try {
    answer = formatNumber(calculate(expression));
  } catch {
    return res.status(400).json({ error: "That expression is not valid math." });
  }

  const client = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  const now = Date.now();
  const recent = (requests.get(client) || []).filter((timestamp) => now - timestamp < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: "That is a lot of math. Take a tiny breather." });
  }
  requests.set(client, [...recent, now]);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "AI overview is not configured." });

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: "You are the playful, kind narrator for NagarCalc. Explain only the arithmetic just performed. Use plain language and one to five very short lines, at most 45 words total. Be silly without insulting the user. Do not invent context or provide financial, medical, or legal advice. Return plain text only." }],
        },
        contents: [{ parts: [{ text: `Expression: ${expression}\nCorrect answer: ${answer}\nGive a tiny, funny explanation of this calculation.` }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 110,
        },
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) return res.status(502).json({ error: "The AI overview service had a wobble." });
    const payload = await response.json();
    const rawText = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();
    if (!rawText) return res.status(502).json({ error: "The AI overview came back empty." });

    const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 5);
    const overview = lines.join("\n").slice(0, 600);
    return res.status(200).json({ overview, result: answer });
  } catch {
    return res.status(502).json({ error: "The AI overview service is taking a tiny nap." });
  }
}
