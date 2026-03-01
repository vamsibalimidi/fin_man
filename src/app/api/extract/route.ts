import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import path from "path";
import { GEMINI_PROMPT } from "@/lib/prompt";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
const UPLOADS_DIR = path.join(process.cwd(), "public/uploads");

/**
 * POST /api/extract
 * 
 * Takes a filename pointing to a document currently sitting in the local staging folder 
 * (\`public/uploads\`). It passes the file buffer to Google's Gemini 2.5 Flash multimodal AI 
 * alongside the rigorous system prompt to extract strictly enforced JSON strings.
 * 
 * Returns the raw JSON object for Human-In-The-Loop review. Does NOT hit the database.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { fileName } = body;

        if (!fileName) {
            return NextResponse.json({ error: "No fileName provided" }, { status: 400 });
        }

        const filePath = path.join(UPLOADS_DIR, fileName);

        let buffer;
        try {
            buffer = await fs.readFile(filePath);
        } catch {
            return NextResponse.json({ error: "File not found in staging" }, { status: 404 });
        }

        // Extremely basic mime resolution for the prompt
        let mimeType = "application/octet-stream";
        if (fileName.toLowerCase().endsWith(".pdf")) mimeType = "application/pdf";
        else if (fileName.toLowerCase().match(/\.(jpg|jpeg)$/)) mimeType = "image/jpeg";
        else if (fileName.toLowerCase().endsWith(".png")) mimeType = "image/png";

        const modelName = 'gemini-2.5-flash';
        console.log(`Extracting data using ${modelName} for ${fileName}`);

        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = GEMINI_PROMPT;

        const filePart = {
            inlineData: {
                data: buffer.toString("base64"),
                mimeType,
            },
        };

        const result = await model.generateContent([prompt, filePart]);
        const response = await result.response;
        const text = response.text();
        const object = JSON.parse(text);

        return NextResponse.json({
            success: true,
            extractedData: object,
            fileMeta: {
                fileName,
                filePath: `/uploads/${fileName}`,
                mimeType
            }
        });

    } catch (error) {
        console.error("Extraction error:", error);
        return NextResponse.json({ error: "Failed to extract data" }, { status: 500 });
    }
}
