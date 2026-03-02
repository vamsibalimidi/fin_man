import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/db";
import { GEMINI_PROMPT } from "@/lib/prompt";
import fs from "fs/promises";
import path from "path";
import { calculateHash } from "@/lib/hash-utils";
import { isMerchantDuplicate, generateNormalizedFilename } from "@/lib/normalization-utils";
import { detectConflict } from "@/lib/conflict-utils";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
const UPLOADS_DIR = path.join(process.cwd(), "public/uploads");
const PROCESSED_DIR = path.join(process.cwd(), "public/processed");
const CONFLICTS_DIR = path.join(process.cwd(), "public/conflicts");

export async function POST(req: NextRequest) {
    try {
        await fs.mkdir(PROCESSED_DIR, { recursive: true });
        await fs.mkdir(CONFLICTS_DIR, { recursive: true });

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
        const seenHashes = new Set<string>(); // Tracker for deduplication within the current batch

        // 2. Loop through and process each one
        for (const fileName of filesToProcess) {
            try {
                const filePath = path.join(UPLOADS_DIR, fileName);
                const buffer = await fs.readFile(filePath);
                const fileHash = calculateHash(buffer);

                // 1. Phase 1: Hash Collision Check (Database + Current Batch)
                const hashConflict = await detectConflict(fileHash, {});
                if (hashConflict || seenHashes.has(fileHash)) {
                    const conflictPath = path.join(CONFLICTS_DIR, fileName);
                    await fs.rename(filePath, conflictPath);

                    const errorMsg = seenHashes.has(fileHash)
                        ? "Duplicate of another file in this batch"
                        : (hashConflict?.message || "Exact file duplicate detected");

                    const conflictMatches = hashConflict?.matches || [];

                    await (prisma as any).conflict.create({
                        data: {
                            fileName,
                            filePath: `/conflicts/${fileName}`,
                            type: "HASH_COLLISION",
                            error: errorMsg,
                            extractedData: "{}",
                            matches: JSON.stringify(conflictMatches)
                        }
                    });

                    errors.push({
                        fileName,
                        type: "HASH_COLLISION",
                        error: errorMsg,
                        matches: conflictMatches
                    });
                    continue;
                }

                // Mark this hash as seen so we don't process it again in this batch
                seenHashes.add(fileHash);

                // 2. Extract Data using Gemini
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

                // 3. Phase 2: Metadata Collision Check (using same centralized logic)
                const metaConflict = await detectConflict(fileHash, extractedData);
                if (metaConflict && metaConflict.type !== "HASH_COLLISION") {
                    const conflictPath = path.join(CONFLICTS_DIR, fileName);
                    await fs.rename(filePath, conflictPath);

                    await (prisma as any).conflict.create({
                        data: {
                            fileName,
                            filePath: `/conflicts/${fileName}`,
                            type: metaConflict.type,
                            error: metaConflict.message,
                            extractedData: text,
                            matches: JSON.stringify(metaConflict.matches)
                        }
                    });

                    errors.push({
                        fileName,
                        type: metaConflict.type,
                        error: metaConflict.message,
                        matches: metaConflict.matches
                    });
                    continue;
                }

                // 4. No collisions - Commit
                const items = (extractedData.line_items && extractedData.line_items.length > 0)
                    ? extractedData.line_items
                    : (extractedData.transactions || []);

                // Sanitize numeric totals
                const sanitizeNum = (val: any) => {
                    if (val === undefined || val === null || val === "") return null;
                    const parsed = parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
                    return isNaN(parsed) ? null : parsed;
                };

                const totalAmount = sanitizeNum(extractedData.total_amount);

                // Generate Normalized Filename
                let finalFileName = generateNormalizedFilename({
                    date: extractedData.date,
                    merchant: extractedData.merchant_or_provider,
                    category: extractedData.documentCategory,
                    originalName: fileName
                });

                const processedDir = path.join(process.cwd(), "public", "processed");
                let uniqueName = finalFileName;
                let counter = 1;
                const lastDotIndex = finalFileName.lastIndexOf(".");
                const base = lastDotIndex !== -1 ? finalFileName.substring(0, lastDotIndex) : finalFileName;
                const extSuffix = lastDotIndex !== -1 ? finalFileName.substring(lastDotIndex) : "";

                while (true) {
                    try {
                        await fs.access(path.join(processedDir, uniqueName));
                        uniqueName = `${base}-${counter}${extSuffix}`;
                        counter++;
                    } catch {
                        break;
                    }
                }
                finalFileName = uniqueName;
                const newPath = path.join(processedDir, finalFileName);

                await fs.rename(filePath, newPath);
                const finalUrlPath = `/processed/${finalFileName}`;

                try {
                    await (prisma as any).document.create({
                        data: {
                            fileName: finalFileName,
                            filePath: finalUrlPath,
                            documentCategory: extractedData.documentCategory,
                            documentType: extractedData.documentType,
                            merchant_or_provider: extractedData.merchant_or_provider ?? null,
                            merchant_address: extractedData.merchant_address ?? null,
                            paymentStatus: extractedData.paymentStatus || "UNPAID",
                            dueDate: extractedData.dueDate ?? null,
                            patientName: extractedData.patientName ?? null,
                            rawJson: text,
                            date: extractedData.date ?? null,
                            totalAmount: totalAmount,
                            hash: fileHash,
                            extractedItems: {
                                create: items.map((item: any) => ({
                                    description: item.description || "No description",
                                    amount: sanitizeNum(item.amount),
                                    category: item.category || "Uncategorized",
                                    type: item.type || "EXPENSE",
                                    date: item.date || extractedData.date || null,
                                    merchant: item.merchant || extractedData.merchant_or_provider || null,
                                }))
                            }
                        }
                    });
                } catch (dbError) {
                    // CRITICAL: If DB write fails, we MUST remove the renamed file
                    // or it will orphan in the processed folder and cause suffixing bugs later.
                    try { await fs.unlink(newPath); } catch (unlinkErr) { console.error("Failed to cleanup orphaned file:", unlinkErr); }
                    throw dbError;
                }

                successCount++;
            } catch (err: any) {
                console.error(`Failed to process ${fileName}:`, err);
                errors.push({ fileName, error: err.message || "Unknown error" });
            }
        }

        // 4. Trigger Linker if any files were successfully processed
        if (successCount > 0) {
            fetch(`${new URL(req.url).origin}/api/linker`, {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            }).catch(err => console.error("Linker trigger failed during batch:", err));
        }

        return NextResponse.json({
            success: true,
            total: filesToProcess.length,
            successCount,
            errors
        });

    } catch (error: any) {
        console.error("Batch process error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
