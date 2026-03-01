import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "public/uploads");

export async function GET() {
    try {
        // Ensure directory exists
        await fs.mkdir(UPLOADS_DIR, { recursive: true });

        const files = await fs.readdir(UPLOADS_DIR);
        const fileList = [];

        for (const file of files) {
            // Ignore hidden files like .DS_Store
            if (file.startsWith(".")) continue;

            const filePath = path.join(UPLOADS_DIR, file);
            const stats = await fs.stat(filePath);

            // Just return basic info for the UI
            fileList.push({
                fileName: file,
                filePath: `/uploads/${file}`,
                size: stats.size,
                createdAt: stats.birthtime,
            });
        }

        // Sort newest first
        fileList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        return NextResponse.json({ success: true, files: fileList });
    } catch (error) {
        console.error("Error reading unprocessed dir:", error);
        return NextResponse.json({ error: "Failed to list unprocessed files" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        const filePath = path.join(UPLOADS_DIR, file.name);

        await fs.writeFile(filePath, buffer);

        return NextResponse.json({ success: true, fileName: file.name });
    } catch (error) {
        console.error("Upload to staging error:", error);
        return NextResponse.json({ error: "Failed to save file to staging" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const fileName = searchParams.get("fileName");

        if (!fileName) {
            return NextResponse.json({ error: "No fileName provided" }, { status: 400 });
        }

        const filePath = path.join(UPLOADS_DIR, fileName);
        await fs.unlink(filePath);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Failed to delete staging file:", error);
        // Ignore ENOENT if the file is already gone
        if (error.code === 'ENOENT') {
            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: "Failed to delete staging file" }, { status: 500 });
    }
}
