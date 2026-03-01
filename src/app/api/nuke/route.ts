import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function DELETE() {
    try {
        console.log("Nuking all database entries...");

        // 1. Delete all database records (relations cascade down)
        // Due to Prisma's foreign key constraints, we delete from the dependent models first,
        // or we can just delete Documents which should cascade if configured,
        // but for safety in SQLite we explicitly delete everything.
        await prisma.extractedItem.deleteMany({});
        await prisma.documentLink.deleteMany({});
        await prisma.document.deleteMany({});

        // 2. Delete all uploaded files 
        console.log("Nuking all uploaded files...");
        const uploadsDir = path.join(process.cwd(), "public/uploads");
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            for (const file of files) {
                // Keep a dummy file if you want, or just wipe everything
                if (file !== ".gitkeep") {
                    fs.unlinkSync(path.join(uploadsDir, file));
                }
            }
        }

        return NextResponse.json({ success: true, message: "System fully reset." });

    } catch (error) {
        console.error("Failed to nuke database:", error);
        return NextResponse.json(
            { error: "Failed to reset system" },
            { status: 500 }
        );
    }
}
