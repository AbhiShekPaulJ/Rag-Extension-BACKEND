const express = require("express");
const cors = require("cors");
// const fetch = require("node-fetch");
// const OpenAI = require("openai");
require("dotenv").config();
const app = express();
console.log(process.env.AZURE_OPENAI_KEY);

// const client = new OpenAI({
//   apiKey: process.env.AZURE_OPENAI_KEY,
//   baseURL: "https://rag-extension-resource.openai.azure.com/openai",
//   defaultQuery: {
//     "api-version": "2024-02-15-preview"
//   },
//   defaultHeaders: {
//     "api-key": process.env.AZURE_OPENAI_KEY
//   }
// });

const allowedOrigins = [
    "http://localhost:9000",
    "http://localhost:3000",
    "http://localhost:5678",
    "chrome-extension://fikemdlphoepnlaoggginimdbipckena",
    "chrome-extension://pnenelckjcbklhgccndndokphjgojkcn",
    "chrome-extension://eoafokieliajmlckjjdmplokomojngao"
];

// Allow Chrome extension origin if provided
if (process.env.CHROME_EXTENSION_ID) {
    allowedOrigins.push(`chrome-extension://${process.env.CHROME_EXTENSION_ID}`);
}

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            return callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
// app.use(express.json());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// // Proxy endpoint for external API to bypass CORS
// app.post("/proxy/pdp-detector", async (req, res) => {
//     try {
//         const response = await fetch("https://extension.flash.co/api/extension/pdp-detector", {
//             method: "POST",
//             headers: {
//                 "Content-Type": "application/json",
//                 ...req.headers // Forward any additional headers if needed
//             },
//             body: JSON.stringify(req.body)
//         });
//         const data = await response.json();
//         res.json(data);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

app.get("/", (req, res) => {
    res.send("Server is running 🚀");
});

app.get("/query", (req, res) => {
    res.json({
        answer: `GET request successful. Backend is connected ${req.body}`
    });
});

app.post("/query", async (req, res) => {
    const { query, context, mode } = req.body;

    try {
        // const chunks = context.split("\n").filter(line => line.trim() !== "");
        const MAX_CHUNK_SIZE = 1000;

        let blocksArray =
            typeof context === "string" ? [{ text: context }] : context;

        const chunks = [];
        let current = "";
        let currentHeading = "";

        for (let block of blocksArray) {
            let text = "";

            // 🔥 Handle both object & string
            if (typeof block === "string") {
                text = block;
            } else if (block && typeof block === "object") {
                text = `${block.heading || ""} ${block.text || ""}`;
            }

            text = text.trim();

            if (!text) continue;

            if ((current + text).length < MAX_CHUNK_SIZE) {
                current += " " + text;
            } else {
                chunks.push(current.trim());
                current = text;
            }
        }

        if (current) chunks.push(current.trim());

        // overlap (important)
        const overlappedChunks = [];

        for (let i = 0; i < chunks.length; i++) {
            const prev = chunks[i - 1] || "";
            overlappedChunks.push(prev.slice(-200) + " " + chunks[i]);
        }

        const safeChunks = overlappedChunks.slice(0, 5);

        const chunkEmbeddings = await Promise.all(
            safeChunks.slice(0, 10).map(async (chunk) => {
                const embRes = await fetch(
                    "https://rag-extension-resource.openai.azure.com/openai/deployments/text-embedding-3-small/embeddings?api-version=2024-02-15-preview",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${process.env.AZURE_OPENAI_KEY}`
                        },
                        body: JSON.stringify({ input: chunk })
                    }
                );

                const embData = await embRes.json();

                if (!embData.data) {
                    console.error("Embedding error:", embData);
                    throw new Error("Embedding failed");
                }

                return {
                    text: chunk,
                    embedding: embData.data[0].embedding
                };
            })
        );

        console.log("ALL CHUNKS:");
        chunks.forEach((c, i) => {
            console.log(`Chunk ${i}:`, c);
        });

        // 🔹 3. Query embedding
        const queryEmbRes = await fetch(
            "https://rag-extension-resource.openai.azure.com/openai/deployments/text-embedding-3-small/embeddings?api-version=2024-02-15-preview",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.AZURE_OPENAI_KEY}`
                },
                body: JSON.stringify({ input: query })
            }
        );

        const queryEmbData = await queryEmbRes.json();
        const queryEmbedding = queryEmbData.data[0].embedding;

        // 🔹 4. Cosine similarity
        const cosineSimilarity = (a, b) => {
            const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
            const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
            const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
            return dot / (magA * magB);
        };
        const cleanedChunks = chunks.filter(c => {
            const text = c.trim();

            // removing very short junk
            if (text.length < 15) return false;

            // 3. must contain meaningful sentence structure
            const wordCount = text.split(" ").length;
            if (wordCount < 4) return false;

            // 4. must contain verbs / natural language
            if (!/[a-zA-Z]/.test(text)) return false;

            return true;
        });

        // 🔹 5. Rank chunks
        const topChunks = chunkEmbeddings
            .map(c => ({
                text: c.text,
                score: cosineSimilarity(queryEmbedding, c.embedding)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 100);

        // const finalContext = [
        //     // ...importantChunks,
        //     ...cleanedChunks,
        //     ...topChunks.map(c => c.text)
        // ].join("\n");
        const finalContext = topChunks
            .map(c => c.text)
            .join("\n");

        console.log("🔥 TOP CHUNKS:");
        topChunks.forEach((c, i) => {
            console.log(`\n--- Chunk ${i + 1} (score: ${c.score}) ---`);
            console.log(c.text);
        });
        console.log("\n✅ FINAL CONTEXT SENT TO LLM:\n");
        console.log(finalContext);

        // System prompt 

        let systemPrompt = "";

        if (mode === "summarize") {
            systemPrompt = "Summarize the content clearly.";
        } else if (mode === "keypoints") {
            systemPrompt = "Extract key points in bullet format.";
        } else {
            systemPrompt = "Answer the question using the context.";
        }

        // 🔹 6. GPT-4o call
        const chatRes = await fetch(
            "https://rag-extension-resource.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-02-15-preview",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.AZURE_OPENAI_KEY}`
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt || "You are an assistant extracting information from a webpage. Use the provided context to answer the question."
                        },
                        {
                            role: "user",
                            content: `Context:\n${finalContext}\n\nQuestion:\n${query}`
                        }
                    ]
                })
            }
        );

        const chatData = await chatRes.json();

        if (!chatData.choices) {
            console.error("Chat error:", chatData);
            throw new Error("Chat failed");
        }
        let answer = chatData.choices[0].message.content;

        // fallback
        if (
            !answer ||
            answer.toLowerCase().includes("can't") ||
            answer.toLowerCase().includes("not able")
        ) {
            answer = `I found this on the page:\n${finalContext}`;
        }

        res.json({ answer });

    } catch (err) {
        console.error("❌ ERROR:", err);
        res.status(500).json({
            answer: "Azure RAG error"
        });
    }
});

const PORT = 5678;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});