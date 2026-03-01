import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/db";
import { GEMINI_PROMPT } from "@/lib/prompt";
import fs from "fs";
import path from "path";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

/**
 * POST /api/upload
 * 
 * Handles multi-part raw file uploads from the frontend Drag & Drop zone.
 * It immediately saves the physical file buffer to the local `public/uploads` staging folder,
 * then fires off a request to Gemini 2.5 Flash for data extraction. 
 * 
 * Returns the raw parsed JSON back to the client for human-in-the-loop review.
 */
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            );
        }

        // 1. Save file locally (in a real app, use S3 or cloud storage)
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Ensure uploads directory exists
        const uploadsDir = path.join(process.cwd(), "public/uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const filePath = path.join(uploadsDir, file.name);
        fs.writeFileSync(filePath, buffer);
        const relativePath = `/uploads/${file.name}`;

        // 2. Determine mime type
        const mimeType = file.type || "application/octet-stream";

        const modelName = 'gemini-2.5-flash';
        console.log(`Extracting data using ${modelName} for ${file.name}`);

        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                responseMimeType: "application/json",
            }
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

        // 4. Return the data to the frontend for Interactive Review instead of saving directly
        return NextResponse.json({
            success: true,
            extractedData: object,
            fileMeta: {
                fileName: file.name,
                filePath: relativePath,
                mimeType: mimeType
            }
        });

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { error: "Failed to process document" },
            { status: 500 }
        );
    }
}
