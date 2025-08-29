// server.js (CommonJS version)
const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const fetch = require("node-fetch");
const cors = require("cors");
const multer = require ("multer");
const fs = require("fs");
const OpenAI = require("openai");
const { createClient } = require("@deepgram/sdk");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// const upload = multer({ storage: multer.memoryStorage() });

const allowedOrigins = [
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "https://data-experience-lab.github.io",
  "https://data-experience-lab.github.io/conversation-timelines"
];

app.use(cors({
  origin: function (origin, callback) {
    console.log("CORS origin check:", origin);

    // Allow requests with no origin (like curl, or some local dev tools)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("CORS blocked:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// ==================
// OpenAI Proxy Route
// ==================
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

// ==================
// OpenAI Whisper Route
// ==================
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: formData
        });
    console.log(response)

    // res.json(transcription);

    // 1. Whisper transcription
    // const whisperResult = await openai.audio.transcriptions.create({
    //   file: fs.createReadStream(req.file.path),
    //   model: "whisper-1",
    //   response_format: "verbose_json", // returns segments
    // });

    // 2. Deepgram diarization
    const dgResponse = await deepgram.listen.prerecorded.transcribeFile(
      fs.readFileSync(req.file.path),
      {
        model: "nova", // accurate diarization model
        diarize: true,
        speaker_count: 2 // optional, set null to auto-detect
      }
    );

    console.log(dgResponse)

    const paragraphs = dgResponse.result?.channel?.alternatives?.[0]?.paragraphs?.paragraphs || [];

    // 3. Merge Whisper segments with Deepgram speaker labels
    const merged = whisperResult.segments.map(seg => {
      const speaker = paragraphs.find(p =>
        seg.start >= p.sentences[0]?.start &&
        seg.end <= p.sentences[p.sentences.length - 1]?.end
      )?.speaker ?? "Unknown";

      return {
        speaker: `Speaker ${speaker}`,
        text: seg.text.trim(),
        start: seg.start,
        end: seg.end
      };
    });

    console.log(merged)

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      summary: merged.map(m => `${m.speaker}: ${m.text}`).join(" "),
      segments: merged
    });

  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: "Failed to transcribe audio" });
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
