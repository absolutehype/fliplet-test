import express from "express";

const app = express();

app.use(express.json());

const FLIPLET_API_BASE = "https://api.fliplet.com/v1";

app.all("/api/fliplet/*splat", async (req, res) => {
  const apiKey = process.env.FLIPLET_API_KEY;

  if (!apiKey) {
    res.status(500).json({ error: "FLIPLET_API_KEY is not configured" });
    return;
  }

  const flipletPath = req.params.splat;
  const queryString = new URLSearchParams(
    req.query as Record<string, string>
  ).toString();
  const url = `${FLIPLET_API_BASE}/${flipletPath}${queryString ? `?${queryString}` : ""}`;

  const headers: Record<string, string> = {
    "Auth-token": apiKey,
    "Content-Type": "application/json",
  };

  const fetchOptions: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
    fetchOptions.body = JSON.stringify(req.body);
  }

  try {
    const response = await fetch(url, fetchOptions);

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      const text = await response.text().catch(() => "");
      res.status(502).json({
        error: "Unexpected response from Fliplet API",
        detail: text.slice(0, 200),
      });
      return;
    }

    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({
      error: "Failed to reach Fliplet API",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

export default app;
