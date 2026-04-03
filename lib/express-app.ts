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

  const response = await fetch(url, fetchOptions);
  const data = await response.json();
  res.status(response.status).json(data);
});

export default app;
