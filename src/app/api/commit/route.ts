import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

/**
 * POST /api/commit
 * 
 * Invoked by the Human-In-The-Loop review modal.
 * 
 * 1. Takes the user-approved JSON payload and the physical file's staging location.
 * 2. Physically moves the file from `public/uploads/` (staging) to `public/processed/` (permanent).
 * 3. Maps the structured JSON exactly to the Prisma SQLite schema, converting numeric strings 
 *    (like "$40.00") into true floats.
 * 4. Asynchronously triggers the `/api/linker` route in the background so the user doesn't have 
 *    to wait for the relational engine algorithms to finish before the modal closes.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { fileMeta, extractedData } = body;

        if (!fileMeta || !extractedData) {
            return NextResponse.json(
                { error: "Missing required payload" },
                { status: 400 }
            );
        }

        const items = (extractedData.line_items && extractedData.line_items.length > 0)
            ? extractedData.line_items
            : (extractedData.transactions || []);

        // Move file from uploads/ staging to processed/
        const oldPath = path.join(process.cwd(), "public", "uploads", fileMeta.fileName);
        const newPath = path.join(process.cwd(), "public", "processed", fileMeta.fileName);

        try {
            await fs.rename(oldPath, newPath);
        } catch (e: any) {
            console.error("Failed to move file to processed directory:", e);
            // We ignore ENOENT strictly to allow committing even if the file was somehow already moved or missing.
            if (e.code !== "ENOENT") throw e;
        }

        const finalUrlPath = `/processed/${fileMeta.fileName}`;

        const dbDoc = await prisma.document.create({
            data: {
                fileName: fileMeta.fileName,
                filePath: finalUrlPath,
                documentCategory: extractedData.documentCategory,
                documentType: extractedData.documentType,
                // Document-level fields (belong on the document, not per line item)
                merchant_or_provider: extractedData.merchant_or_provider ?? null,
                merchant_address: extractedData.merchant_address ?? null,
                paymentStatus: extractedData.paymentStatus || "UNPAID",
                dueDate: extractedData.dueDate ?? null,
                patientName: extractedData.patientName ?? null,
                rawJson: JSON.stringify(extractedData),
                date: extractedData.date ?? null,
                totalAmount: (extractedData.total_amount !== undefined && extractedData.total_amount !== null && extractedData.total_amount !== "") ? parseFloat(String(extractedData.total_amount).replace(/[^0-9.-]+/g, "")) : null,
                tax: (extractedData.tax !== undefined && extractedData.tax !== null && extractedData.tax !== "") ? parseFloat(String(extractedData.tax).replace(/[^0-9.-]+/g, "")) : null,
                // Line items — clean, purely transactional data
                extractedItems: {
                    create: items.map((item: any) => {
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

                        return {
                            description: item.description,
                            amount: (typeof parsedAmount === 'number' && !isNaN(parsedAmount)) ? parsedAmount : null,
                            quantity: (typeof parsedQty === 'number' && !isNaN(parsedQty)) ? parsedQty : 1,
                            metadata: item.metadata ? JSON.stringify(item.metadata) : null,
                        };
                    }),
                }
            } as any,
            include: { extractedItems: true }
        });

        // Fire the Linker asynchronously
        try {
            const baseUrl = req.nextUrl.origin;
            fetch(`${baseUrl}/api/linker`, { method: "POST" }).catch(e => console.error("Linker background failure:", e));
        } catch (e) {
            console.error("Failed to trigger auto-linker from manual commit", e);
        }

        return NextResponse.json({ success: true, document: dbDoc });

    } catch (error: any) {
        console.error("Commit error:", error);
        return NextResponse.json(
            { error: "Failed to save document to database", details: error?.message || String(error) },
            { status: 500 }
        );
    }
}
