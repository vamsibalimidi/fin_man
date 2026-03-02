import { prisma } from "./db";
import { isMerchantDuplicate } from "./normalization-utils";

export interface ConflictMatch {
    id: string;
    fileName: string;
    filePath: string;
    reason: string;
    comparison?: {
        merchant: { current: string | null; stored: string | null };
        date: { current: string | null; stored: string | null };
        amount: { current: number | null; stored: number | null };
        category: { current: string | null; stored: string | null };
        type: { current: string | null; stored: string | null };
        patientName?: { current: string | null; stored: string | null };
    };
}

export interface ConflictResult {
    type: "HASH_COLLISION" | "METADATA_COLLISION" | "SOFT_MATCH";
    message: string;
    matches: ConflictMatch[];
}

/**
 * Detects conflicts (hash or metadata) against the database.
 * 
 * @param fileHash SHA-256 hash of the file content
 * @param extractedData The JSON data extracted by Gemini
 * @returns ConflictResult if a collision is found, otherwise null
 */
export async function detectConflict(
    fileHash: string,
    extractedData: any
): Promise<ConflictResult | null> {
    // 1. Hash Collision (Exact Duplicate)
    const existingByHash = await (prisma.document as any).findMany({
        where: { hash: fileHash }
    });

    if (existingByHash.length > 0) {
        return {
            type: "HASH_COLLISION",
            message: "Exact file duplicate detected in database.",
            matches: existingByHash.map((d: any) => ({
                id: d.id,
                fileName: d.fileName,
                filePath: d.filePath,
                reason: "Exact hash match"
            }))
        };
    }

    // 2. Metadata Collision (Detection Logic)
    const totalAmount = (extractedData.total_amount !== undefined && extractedData.total_amount !== null && extractedData.total_amount !== "")
        ? parseFloat(String(extractedData.total_amount).replace(/[^0-9.-]+/g, ""))
        : null;

    if (!extractedData.merchant_or_provider) return null;

    // Find potential matches by date or amount range
    const conditions: any[] = [];
    if (extractedData.date) conditions.push({ date: extractedData.date });
    if (totalAmount !== null) {
        conditions.push({
            totalAmount: {
                gte: totalAmount - 1.00,
                lte: totalAmount + 1.00
            }
        });
    }

    if (conditions.length === 0) return null;

    const potentialMatches = await prisma.document.findMany({
        where: { OR: conditions }
    });

    const results = potentialMatches.map((d: any) => {
        const isMerchantMatch = d.merchant_or_provider && isMerchantDuplicate(d.merchant_or_provider, extractedData.merchant_or_provider);
        const isCategoryMatch = d.documentCategory === extractedData.documentCategory;
        const isTypeMatch = d.documentType === extractedData.documentType;
        const isPatientMatch = extractedData.documentType === "Medical"
            ? d.patientName === extractedData.patientName
            : true;

        if (!isMerchantMatch || !isCategoryMatch || !isTypeMatch || !isPatientMatch) return null;

        const dateMatch = d.date === extractedData.date;
        const amountDiff = totalAmount !== null ? Math.abs((d.totalAmount || 0) - totalAmount) : null;
        const isStrictAmount = amountDiff !== null && amountDiff <= 0.01;
        const isSoftAmount = amountDiff !== null && amountDiff <= 1.00;

        const comparison: any = {
            merchant: { current: String(extractedData.merchant_or_provider || ""), stored: d.merchant_or_provider },
            date: { current: String(extractedData.date || ""), stored: d.date },
            amount: { current: totalAmount, stored: d.totalAmount },
            category: { current: String(extractedData.documentCategory || ""), stored: d.documentCategory },
            type: { current: String(extractedData.documentType || ""), stored: d.documentType },
            patientName: extractedData.documentType === "Medical" ? { current: String(extractedData.patientName || ""), stored: d.patientName } : undefined
        };

        if (dateMatch && isStrictAmount) {
            return {
                id: d.id,
                fileName: d.fileName,
                filePath: d.filePath,
                reason: "Strict match (merchant, date, and amount)",
                comparison
            } as ConflictMatch;
        } else if (isSoftAmount) {
            return {
                id: d.id,
                fileName: d.fileName,
                filePath: d.filePath,
                reason: `Amount Match (merchant and amount near-identical${dateMatch ? "" : ", different date"})`,
                comparison
            } as ConflictMatch;
        } else if (dateMatch) {
            return {
                id: d.id,
                fileName: d.fileName,
                filePath: d.filePath,
                reason: "Date Match (merchant and date identical, different amount)",
                comparison
            } as ConflictMatch;
        }
        return null;
    });

    const matchesWithReasons = results.filter((m): m is ConflictMatch => m !== null);

    if (matchesWithReasons.length > 0) {
        const hasStrict = matchesWithReasons.some(m => m.reason.startsWith("Strict match"));
        return {
            type: hasStrict ? "METADATA_COLLISION" : "SOFT_MATCH",
            message: matchesWithReasons[0].reason,
            matches: matchesWithReasons
        };
    }

    return null;
}
