import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Find document to get the file path
        const document = await prisma.document.findUnique({
            where: { id }
        });

        if (!document) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        // 1. Pre-deletion hook: Restore "UNPAID" status to any Bills this document paid for
        const linkDocs = await prisma.documentLink.findMany({
            where: {
                sourceDocumentId: id,
                relationshipType: "PAYS_FOR"
            }
        });

        if (linkDocs.length > 0) {
            const targetIds = linkDocs.map(link => link.targetDocumentId);
            await prisma.document.updateMany({
                where: {
                    id: { in: targetIds }
                },
                data: {
                    paymentStatus: "UNPAID"
                } as any
            });
            console.log(`Restored paymentStatus to UNPAID for ${linkDocs.length} bills.`);
        }

        // 2. Delete the database record
        // By schema definition, this will Cascade delete associated ExtractedItems and DocumentLinks
        await prisma.document.delete({
            where: { id }
        });

        // 2. Delete the physical file asynchronously
        try {
            if (document.filePath) {
                // filePath usually looks like "/processed/filename.pdf"
                // Needs to be joined with public to be recognized by fs
                const physicalPath = path.join(process.cwd(), "public", document.filePath.replace(/^\//, ''));
                await fs.unlink(physicalPath);
            }
        } catch (fileError: any) {
            console.warn("Failed to delete physical file during document deletion:", fileError);
            // We ignore ENOENT strictly to allow DB teardown even if file is missing.
            if (fileError.code !== "ENOENT") {
                console.error("File deletion caught unexpected error:", fileError);
            }
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Document DELETION error:", error);
        return NextResponse.json(
            { error: "Failed to delete document from database" },
            { status: 500 }
        );
    }
}
