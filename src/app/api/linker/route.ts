import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/linker
 * 
 * The Universal Three-way Linker Engine.
 * 
 * This background chronological matching algorithm looks at the global SQLite database.
 * 
 * Pass 1 (Bills): It scans all UNPAID Bills. If it finds a Receipt with the exact same
 * Float amount, uploaded within 45 days of the Bill's date, it creates a `PAYS_FOR` edge
 * in the graph and retroactively marks the Bill as "PAID".
 * 
 * Pass 2 (Statements): It scans Statement Line-Items. If it finds a standalone Receipt
 * matching the transaction amount within 10 days, it creates an `APPEARS_ON_STATEMENT` edge.
 */
export async function POST() {
    try {
        const allDocuments = await prisma.document.findMany({
            include: { extractedItems: true },
        });

        const bills = allDocuments.filter((d) => d.documentCategory === "BILL");
        const receipts = allDocuments.filter((d) => d.documentCategory === "RECEIPT");
        const statements = allDocuments.filter((d) => d.documentCategory === "STATEMENT");

        let newLinksCount = 0;

        // --- Pass 1: Match RECEIPTS to BILLS ---
        for (const receipt of receipts) {
            if (!receipt.extractedItems || receipt.extractedItems.length === 0) continue;

            const receiptTotal = receipt.extractedItems.reduce((sum: number, i) => sum + (i.amount || 0), 0);
            const receiptDate = new Date((receipt as any).date || receipt.uploadDate);

            for (const bill of bills) {
                if (!bill.extractedItems || bill.extractedItems.length === 0) continue;

                const billNetTotal = bill.extractedItems.reduce((sum: number, i) => sum + (i.amount || 0), 0);
                const billDate = new Date((bill as any).date || bill.uploadDate);

                if (Math.abs(billNetTotal - receiptTotal) < 0.05) {
                    const daysDiff = (receiptDate.getTime() - billDate.getTime()) / (1000 * 3600 * 24);

                    if (daysDiff >= -45 && daysDiff <= 45) {
                        const existing = await prisma.documentLink.findFirst({
                            where: {
                                sourceDocumentId: receipt.id,
                                targetDocumentId: bill.id,
                                relationshipType: "PAYS_FOR"
                            }
                        });

                        if (!existing) {
                            await prisma.documentLink.create({
                                data: {
                                    sourceDocumentId: receipt.id,
                                    targetDocumentId: bill.id,
                                    relationshipType: "PAYS_FOR",
                                    confidenceScore: 0.85
                                }
                            });

                            // Update the bill Document's paymentStatus (not ExtractedItem)
                            await prisma.document.update({
                                where: { id: bill.id },
                                data: { paymentStatus: "PAID" }
                            });

                            newLinksCount++;
                        }
                    }
                }
            }
        }

        // --- Pass 2: Match STATEMENTS to RECEIPTS ---
        for (const statement of statements) {
            if (!statement.extractedItems || statement.extractedItems.length === 0) continue;

            for (const transaction of statement.extractedItems) {
                const txAmount = transaction.amount || 0;
                const txDate = new Date((transaction as any).date || statement.uploadDate);

                for (const receipt of receipts) {
                    if (!receipt.extractedItems || receipt.extractedItems.length === 0) continue;

                    const receiptTotal = Math.max(...receipt.extractedItems.map(i => i.amount || 0), 0);
                    if (Math.abs(txAmount - receiptTotal) < 0.05 || Math.abs(txAmount - (receiptTotal * -1)) < 0.05) {
                        const receiptDate = new Date((receipt as any).date || receipt.uploadDate);
                        const daysDiff = (txDate.getTime() - receiptDate.getTime()) / (1000 * 3600 * 24);

                        if (daysDiff >= -2 && daysDiff <= 10) {
                            const existing = await prisma.documentLink.findFirst({
                                where: {
                                    sourceDocumentId: statement.id,
                                    targetDocumentId: receipt.id,
                                    relationshipType: "APPEARS_ON_STATEMENT"
                                }
                            });

                            if (!existing) {
                                await prisma.documentLink.create({
                                    data: {
                                        sourceDocumentId: statement.id,
                                        targetDocumentId: receipt.id,
                                        relationshipType: "APPEARS_ON_STATEMENT",
                                        confidenceScore: 0.90
                                    }
                                });
                                newLinksCount++;
                            }
                        }
                    }
                }
            }
        }

        return NextResponse.json({ success: true, newLinksCreated: newLinksCount });
    } catch (error) {
        console.error("Linker error:", error);
        return NextResponse.json({ error: "Failed to run linker" }, { status: 500 });
    }
}
