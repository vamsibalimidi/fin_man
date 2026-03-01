import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/db";
import { GEMINI_PROMPT } from "@/lib/prompt";
import fs from "fs/promises";
import path from "path";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
const UPLOADS_DIR = path.join(process.cwd(), "public/uploads");
const PROCESSED_DIR = path.join(process.cwd(), "public/processed");

export async function POST(req: NextRequest) {
    try {
        await fs.mkdir(PROCESSED_DIR, { recursive: true });

        // Try to parse specific file names from the request body if provided
        let requestedFiles: string[] = [];
        try {
            const body = await req.json();
            if (body.fileName) requestedFiles = [body.fileName];
            if (body.fileNames && Array.isArray(body.fileNames)) requestedFiles = body.fileNames;
        } catch (e) {
            // Ignore JSON parse errors for empty bodies
        }

        // 1. Get all files in uploads
        const files = await fs.readdir(UPLOADS_DIR);
        // Filter down to only non-hidden files that were explicitly requested (if a request list was provided)
        const filesToProcess = files.filter(f => !f.startsWith(".") && (requestedFiles.length === 0 || requestedFiles.includes(f)));

        if (filesToProcess.length === 0) {
            return NextResponse.json({ success: true, processedCount: 0 });
        }

        const modelName = 'gemini-2.5-flash';
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = GEMINI_PROMPT;

        let successCount = 0;
        let errors = [];

        // 2. Loop through and process each one
        for (const fileName of filesToProcess) {
            try {
                const filePath = path.join(UPLOADS_DIR, fileName);
                const buffer = await fs.readFile(filePath);

                let mimeType = "application/octet-stream";
                if (fileName.toLowerCase().endsWith(".pdf")) mimeType = "application/pdf";
                else if (fileName.toLowerCase().match(/\.(jpg|jpeg)$/)) mimeType = "image/jpeg";
                else if (fileName.toLowerCase().endsWith(".png")) mimeType = "image/png";

                const filePart = {
                    inlineData: {
                        data: buffer.toString("base64"),
                        mimeType,
                    },
                };

                const result = await model.generateContent([prompt, filePart]);
                const text = (await result.response).text();
                const extractedData = JSON.parse(text);

                // 3. Commit exactly like the manual commit route does
                const items = (extractedData.line_items && extractedData.line_items.length > 0)
                    ? extractedData.line_items
                    : (extractedData.transactions || []);

                const newPath = path.join(PROCESSED_DIR, fileName);
                await fs.rename(filePath, newPath);

                const finalUrlPath = `/processed/${fileName}`;

                const dbDoc = await prisma.document.create({
                    data: {
                        fileName: fileName,
                        filePath: finalUrlPath,
                        documentCategory: extractedData.documentCategory || "OTHER",
                        documentType: extractedData.documentType || "Other",
                        merchant_or_provider: extractedData.merchant_or_provider || null,
                        merchant_address: extractedData.merchant_address || null,
                        paymentStatus: extractedData.paymentStatus || null,
                        dueDate: extractedData.dueDate ? new Date(extractedData.dueDate) : null,
                        patientName: extractedData.patientName || null,
                        rawJson: JSON.stringify(extractedData),
                        date: extractedData.date ?? null,
                        totalAmount: (extractedData.total_amount !== undefined && extractedData.total_amount !== null && extractedData.total_amount !== "") ? parseFloat(String(extractedData.total_amount).replace(/[^0-9.-]+/g, "")) : null,
                        tax: (extractedData.tax !== undefined && extractedData.tax !== null && extractedData.tax !== "") ? parseFloat(String(extractedData.tax).replace(/[^0-9.-]+/g, "")) : null,
                    } as any
                });

                await Promise.all(items.map((item: any) => {
                    let parsedAmount = null;
                    if (item.amount !== undefined && item.amount !== null) {
                        parsedAmount = typeof item.amount === 'string'
                            ? parseFloat(item.amount.replace(/[^0-9.-]+/g, ""))
                            : Number(item.amount);
                    }

                    let parsedQty = 1;
                    const rawQty = item.quantity || item.metadata?.quantity;
                    if (rawQty !== undefined && rawQty !== null) {
                        parsedQty = typeof rawQty === 'string'
                            ? parseInt(rawQty.replace(/[^0-9-]+/g, ""))
                            : Number(rawQty);
                    }

                    return prisma.extractedItem.create({
                        data: {
                            documentId: dbDoc.id,
                            description: item.description,
                            amount: (typeof parsedAmount === 'number' && !isNaN(parsedAmount)) ? parsedAmount : null,
                            quantity: (typeof parsedQty === 'number' && !isNaN(parsedQty)) ? parsedQty : 1,
                            metadata: item.metadata ? JSON.stringify(item.metadata) : null,
                        } as any
                    });
                }));

                successCount++;
            } catch (err: any) {
                console.error(`Failed auto-process for ${fileName}:`, err);
                errors.push({ fileName, error: err.message });
            }
        }

        // 4. Run the Auto-Linker to reconcile the new documents
        try {
            const baseUrl = req.nextUrl.origin;
            await fetch(`${baseUrl}/api/linker`, { method: "POST" }).catch(e => console.error("Linker background failure:", e));
        } catch (e) {
            console.error("Failed to trigger auto-linker from process-all", e);
        }

        return NextResponse.json({
            success: true,
            processedCount: successCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error: any) {
        console.error("Process all error:", error);
        return NextResponse.json({ error: "Failed to run process-all job" }, { status: 500 });
    }
}
