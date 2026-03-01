"use server";

import { prisma } from "./db";

// -- Documents --
export async function getDocuments() {
    return prisma.document.findMany({
        orderBy: { uploadDate: "desc" },
        include: { extractedItems: true },
    });
}

export async function getBills() {
    return prisma.document.findMany({
        where: { documentCategory: "BILL" },
        orderBy: { uploadDate: "desc" },
        include: {
            extractedItems: true,
            // targetLinks: links where this bill is the target; source is the paying receipt
            targetLinks: {
                where: { relationshipType: "PAYS_FOR" },
                include: { sourceDocument: true },
            },
        },
    });
}

export async function getDocumentById(id: string) {
    return prisma.document.findUnique({
        where: { id },
        include: {
            extractedItems: true,
            sourceLinks: { include: { targetDocument: true } },
            targetLinks: { include: { sourceDocument: true } },
        },
    });
}

// -- Extracted Items --
export async function getExtractedItems() {
    return prisma.extractedItem.findMany({
        include: { document: true },
    });
}

// -- Links --
export async function getDocumentLinks() {
    return prisma.documentLink.findMany({
        include: {
            sourceDocument: true,
            targetDocument: true,
        },
        orderBy: { createdAt: "desc" },
    });
}
