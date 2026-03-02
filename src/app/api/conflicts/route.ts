import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

/**
 * GET /api/conflicts
 * Returns all staged conflicts for review.
 */
export async function GET() {
    try {
        const conflicts = await (prisma as any).conflict.findMany({
            orderBy: { createdAt: "desc" }
        });
        return NextResponse.json(conflicts);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch conflicts" }, { status: 500 });
    }
}

/**
 * DELETE /api/conflicts
 * Deletes one or all conflicts (Skip/Bin).
 */
export async function DELETE(req: NextRequest) {
    try {
        const { id, all = false } = await req.json();

        if (all) {
            const conflicts = await (prisma as any).conflict.findMany();
            for (const c of conflicts) {
                const filePath = path.join(process.cwd(), "public", c.filePath);
                try { await fs.unlink(filePath); } catch (e) { }
            }
            await (prisma as any).conflict.deleteMany();
            return NextResponse.json({ success: true });
        }

        if (!id) return NextResponse.json({ error: "Missing conflict ID" }, { status: 400 });

        const conflict = await (prisma as any).conflict.findUnique({ where: { id } });
        if (!conflict) return NextResponse.json({ error: "Conflict not found" }, { status: 404 });

        const filePath = path.join(process.cwd(), "public", conflict.filePath);
        try { await fs.unlink(filePath); } catch (e) { }

        await (prisma as any).conflict.delete({ where: { id } });
        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({ error: "Failed to delete conflict(s)" }, { status: 500 });
    }
}

/**
 * POST /api/conflicts
 * Resolves a conflict by committing it (Keep Both) or updating existing (Merge).
 * 
 * NOTE: For simple "Keep Both", we basically call /api/commit with force=true.
 */
export async function POST(req: NextRequest) {
    try {
        const { id, all = false, action } = await req.json();

        if (action !== "KEEP_BOTH") {
            return NextResponse.json({ error: "Only KEEP_BOTH action is supported currently" }, { status: 400 });
        }

        const resolveConflict = async (c: any) => {
            // Re-use logic from /api/commit but for bulk
            // 1. Path resolution
            const oldPath = path.join(process.cwd(), "public", c.filePath);
            const processedDir = path.join(process.cwd(), "public", "processed");
            await fs.mkdir(processedDir, { recursive: true });

            const extractedData = JSON.parse(c.extractedData || "{}");

            // 2. Generate unique filename
            let finalFileName = c.fileName;
            let uniqueName = finalFileName;
            let counter = 1;
            const lastDotIndex = finalFileName.lastIndexOf(".");
            const base = lastDotIndex !== -1 ? finalFileName.substring(0, lastDotIndex) : finalFileName;
            const ext = lastDotIndex !== -1 ? finalFileName.substring(lastDotIndex) : "";

            while (true) {
                try {
                    await fs.access(path.join(processedDir, uniqueName));
                    uniqueName = `${base}-${counter}${ext}`;
                    counter++;
                } catch { break; }
            }
            finalFileName = uniqueName;
            const newPath = path.join(processedDir, finalFileName);
            const finalUrlPath = `/processed/${finalFileName}`;

            // 3. Move file
            await fs.rename(oldPath, newPath);

            // 4. Create DB Entry
            try {
                const totalAmount = extractedData.total_amount ? parseFloat(String(extractedData.total_amount).replace(/[^0-9.-]+/g, "")) : null;
                const items = (extractedData.line_items || extractedData.transactions || []);

                await (prisma.document as any).create({
                    data: {
                        fileName: finalFileName,
                        filePath: finalUrlPath,
                        documentCategory: extractedData.documentCategory || "OTHER",
                        documentType: extractedData.documentType || null,
                        merchant_or_provider: extractedData.merchant_or_provider ?? null,
                        merchant_address: extractedData.merchant_address ?? null,
                        paymentStatus: extractedData.paymentStatus || "UNPAID",
                        dueDate: extractedData.dueDate ?? null,
                        patientName: extractedData.patientName ?? null,
                        rawJson: c.extractedData,
                        date: extractedData.date ?? null,
                        totalAmount: isNaN(totalAmount || 0) ? null : totalAmount,
                        hash: null, // We reset hash for forced "Keep Both" to avoid unique constraint if we didn't use index correctly, 
                        // actually Document table has hash as non-unique index so it's fine.
                        // Let's try to calculate it if we want accuracy.
                        extractedItems: {
                            create: items.map((item: any) => ({
                                description: item.description || "No description",
                                amount: item.amount ? parseFloat(String(item.amount).replace(/[^0-9.-]+/g, "")) : null,
                                category: item.category || "Uncategorized",
                                type: item.type || "EXPENSE",
                                date: item.date || extractedData.date || null,
                                merchant: item.merchant || extractedData.merchant_or_provider || null,
                            }))
                        }
                    }
                });

                // 5. Delete conflict record
                await (prisma as any).conflict.delete({ where: { id: c.id } });
            } catch (dbError) {
                // Rollback file move on Failure
                try { await fs.unlink(newPath); } catch (e) { }
                throw dbError;
            }
        };

        if (all) {
            const conflicts = await (prisma as any).conflict.findMany();
            for (const c of conflicts) {
                try { await resolveConflict(c); } catch (e) { console.error(`Failed to bulk resolve ${c.id}:`, e); }
            }
            return NextResponse.json({ success: true });
        }

        if (!id) return NextResponse.json({ error: "Missing conflict ID" }, { status: 400 });
        const conflict = await (prisma as any).conflict.findUnique({ where: { id } });
        if (!conflict) return NextResponse.json({ error: "Conflict not found" }, { status: 404 });

        await resolveConflict(conflict);
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Conflict resolution error:", error);
        return NextResponse.json({ error: error.message || "Failed to resolve conflict" }, { status: 500 });
    }
}
