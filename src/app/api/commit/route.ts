import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import { calculateHash } from "@/lib/hash-utils";
import { isMerchantDuplicate, generateNormalizedFilename } from "@/lib/normalization-utils";
import { detectConflict } from "@/lib/conflict-utils";

/**
 * POST /api/commit
 * 
 * Invoked by the Human-In-The-Loop review modal.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { fileMeta, extractedData, force = false, customFileName = null } = body;

        if (!fileMeta || !extractedData) {
            return NextResponse.json({ error: "Missing required payload" }, { status: 400 });
        }

        const items = (extractedData.line_items && extractedData.line_items.length > 0)
            ? extractedData.line_items
            : (extractedData.transactions || []);

        const processedDir = path.join(process.cwd(), "public", "processed");
        await fs.mkdir(processedDir, { recursive: true });

        // 1. Resolve source file path (could be in uploads or conflicts)
        let oldPath = path.join(process.cwd(), "public", "uploads", fileMeta.fileName);
        if (fileMeta.filePath && fileMeta.filePath.startsWith("/conflicts/")) {
            oldPath = path.join(process.cwd(), "public", fileMeta.filePath);
        }

        // 1. Calculate Hash
        const fileBuffer = await fs.readFile(oldPath);
        const fileHash = calculateHash(fileBuffer);

        // 2. Check for Conflicts (Metadata/Hash) unless forced
        if (!force) {
            const conflict = await detectConflict(fileHash, extractedData);
            if (conflict) {
                return NextResponse.json({
                    error: conflict.message,
                    type: conflict.type,
                    matches: conflict.matches
                }, { status: 409 });
            }

            // Also check for name collision if a custom name was provided
            if (customFileName) {
                try {
                    await fs.access(path.join(processedDir, customFileName));
                    return NextResponse.json({
                        error: "A file with this name already exists. Please choose a different name or force save.",
                        type: "NAME_COLLISION"
                    }, { status: 409 });
                } catch {
                    // Not found, proceed
                }
            }
        }

        // 3. Generate Final Filename
        let finalFileName = customFileName || generateNormalizedFilename({
            date: extractedData.date,
            merchant: extractedData.merchant_or_provider,
            category: extractedData.documentCategory,
            originalName: fileMeta.fileName
        });

        // Always ensure unique name in processed directory unless the user MANUALLY chose a name AND opted to overwrite
        // For our "Keep Both (Copy)" flow, force is true, so we should always auto-suffix if taken.
        let uniqueName = finalFileName;
        let counter = 1;
        const lastDotIndex = finalFileName.lastIndexOf(".");
        const base = lastDotIndex !== -1 ? finalFileName.substring(0, lastDotIndex) : finalFileName;
        const ext = lastDotIndex !== -1 ? finalFileName.substring(lastDotIndex) : "";

        while (true) {
            try {
                await fs.access(path.join(processedDir, uniqueName));
                // If it exists, we must suffix it
                uniqueName = `${base}-${counter}${ext}`;
                counter++;
            } catch {
                break;
            }
        }

        finalFileName = uniqueName;
        const newPath = path.join(processedDir, finalFileName);

        // 4. Move file
        try {
            await fs.rename(oldPath, newPath);
        } catch (e: any) {
            console.error("Failed to move file to processed directory:", e);
            if (e.code !== "ENOENT") throw e;
        }

        // 5. Database Entry
        const sanitizeNum = (val: any) => {
            if (val === undefined || val === null || val === "") return null;
            const parsed = parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
            return isNaN(parsed) ? null : parsed;
        };

        const totalAmount = sanitizeNum(extractedData.total_amount);

        const finalUrlPath = `/processed/${finalFileName}`;

        let dbDoc;
        try {
            dbDoc = await (prisma.document as any).create({
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
                    rawJson: JSON.stringify(extractedData),
                    date: extractedData.date ?? null,
                    totalAmount: totalAmount,
                    tax: sanitizeNum(extractedData.tax),
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
            // CRITICAL: Cleanup orphaned file if DB creation fails
            try { await fs.unlink(newPath); } catch (unlinkErr) { console.error("Failed to cleanup orphaned file:", unlinkErr); }
            throw dbError;
        }

        // Trigger linker
        fetch(`${new URL(req.url).origin}/api/linker`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId: dbDoc.id })
        }).catch(err => console.error("Linker trigger failed:", err));

        return NextResponse.json({ success: true, document: dbDoc });

    } catch (error: any) {
        console.error("Commit error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
