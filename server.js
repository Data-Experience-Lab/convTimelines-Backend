// server.js (CommonJS version)
const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const fetch = require("node-fetch");
const cors = require("cors");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  console.log("Incoming origin:", req.headers.origin);
  next();
});

// app.use((req, res, next) => {
//   const origin = req.headers.origin;

//   const allowedOrigins = [
//     "http://127.0.0.1:5500",
//     "http://localhost:3000",
//     "https://data-experience-lab.github.io",
//     "https://data-experience-lab.github.io/conversation-timelines"
//   ];

//   if (!origin || allowedOrigins.includes(origin)) {
//     res.setHeader("Access-Control-Allow-Origin", origin || "http://127.0.0.1:5500");
//     res.setHeader("Access-Control-Allow-Methods", "GET, POST");
//     res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
//     next();
//   } else {
//     console.log("Blocked request with origin:", origin);
//     res.status(403).send("CORS blocked this request");
//   }
// });

app.use((req, res, next) => {
  const origin = req.headers.origin || "http://127.0.0.1:5500";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});


app.use(express.json());

// OpenAI Proxy Route
app.post("/api/chat", async (req, res) => {
  try {
    console.log("Received /api/chat with body:", req.body);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    console.log("OpenAI status:", response.status);
    console.log("OpenAI response:", data);

    res.status(response.status).json(data);
  } catch (err) {
    console.error("OpenAI API error:", err);
    res.status(500).json({ error: "Failed to call OpenAI API" });
  }
});

// Azure Speech Config Route (returns region only)
app.get("/api/speech-config", (req, res) => {
  const region = process.env.AZURE_REGION;

  if (!region) {
    return res.status(500).json({ error: "Azure region not set" });
  }

  res.json({ region });
});

// Azure Token Route
app.post("/api/speech-token", async (req, res) => {
  try {
    const region = process.env.AZURE_REGION;
    const key = process.env.AZURE_API_KEY;

    const response = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Length": "0",
      }
    });

    const token = await response.text();
    res.status(200).json({ token, region });
  } catch (err) {
    console.error("Azure Speech error:", err);
    res.status(500).json({ error: "Failed to retrieve Azure token" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
