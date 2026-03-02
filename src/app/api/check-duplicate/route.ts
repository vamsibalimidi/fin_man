import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import { calculateHash } from "@/lib/hash-utils";

/**
 * POST /api/check-duplicate
 * 
 * Lightweight endpoint for the frontend to check if a file in staging
 * already exists in the main Document database (by Hash).
 */
export async function POST(req: NextRequest) {
    try {
        const { fileName } = await req.json();
        if (!fileName) return NextResponse.json({ error: "Missing fileName" }, { status: 400 });

        const filePath = path.join(process.cwd(), "public/uploads", fileName);
        const buffer = await fs.readFile(filePath);
        const hash = calculateHash(buffer);

        const existing = await prisma.document.findFirst({
            where: { hash: hash }
        });

        if (existing) {
            return NextResponse.json({
                duplicate: true,
                type: "HASH_COLLISION",
                existingId: existing.id,
                existingFileName: existing.fileName
            });
        }

        return NextResponse.json({ duplicate: false });
    } catch (error) {
        console.error("Check duplicate error:", error);
        return NextResponse.json({ error: "Failed to check duplicate" }, { status: 500 });
    }
}
