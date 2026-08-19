// Serverless function (deploys automatically on Vercel from /api).
// Keeps ANTHROPIC_API_KEY server-side — the browser never sees it.
//
// Local dev: run with `vercel dev` (recommended, runs this alongside the
// Vite frontend) — see README.md. Plain `npm run dev` serves only the
// frontend; the AI assistant panel will show a connection error until
// you're running through `vercel dev` or have deployed to Vercel.

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error:
        "ANTHROPIC_API_KEY is not configured. Add it to your Vercel project's environment variables (or .env for `vercel dev`) — see .env.example.",
    });
    return;
  }

  try {
    const { system, messages } = req.body ?? {};
    if (!messages) {
      res.status(400).json({ error: "Missing 'messages' in request body" });
      return;
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system,
        messages,
      }),
    });

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "Upstream request to Anthropic API failed" });
  }
}
