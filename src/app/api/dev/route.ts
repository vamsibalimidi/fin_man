import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const ALLOWED_TABLES = ["document", "extractedItem", "documentLink"] as const;
type TableName = typeof ALLOWED_TABLES[number];

export async function GET(req: NextRequest) {
    const table = req.nextUrl.searchParams.get("table") as TableName | null;

    if (!table || !ALLOWED_TABLES.includes(table)) {
        return NextResponse.json({ error: "Invalid or missing table name" }, { status: 400 });
    }

    try {
        let rows: any[];
        if (table === "document") {
            rows = await (prisma.document as any).findMany({ orderBy: { uploadDate: "desc" } });
        } else if (table === "extractedItem") {
            rows = await (prisma.extractedItem as any).findMany();
        } else {
            rows = await (prisma.documentLink as any).findMany({ orderBy: { createdAt: "desc" } });
        }

        const mappedTableName = table === "document" ? "Document" : table === "extractedItem" ? "ExtractedItem" : "DocumentLink";
        const columnsInfo = await prisma.$queryRawUnsafe(`PRAGMA table_info("${mappedTableName}")`) as any[];
        const columns = columnsInfo.map(c => c.name);

        return NextResponse.json({ rows, columns });
    } catch (error) {
        console.error("Dev API error:", error);
        return NextResponse.json({ error: "Failed to query table" }, { status: 500 });
    }
}
