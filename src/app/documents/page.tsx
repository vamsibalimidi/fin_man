import { getDocuments } from "@/lib/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { DocumentsTable } from "@/components/documents-table";

export const dynamic = "force-dynamic";

/**
 * Documents / File Explorer
 * 
 * A Server Component that queries the database for all processed Documents
 * and passes them down into the interactive Client-Side DocumentsTable.
 */
export default async function DocumentsPage() {
    const documents = await getDocuments();

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto h-full">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
                <p className="text-muted-foreground mt-2">
                    View all your uploaded bills, receipts, and statements.
                </p>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/40 rounded-t-xl border-b space-y-0">
                    <CardTitle className="text-lg">Recent Files</CardTitle>
                    <Button size="sm" asChild>
                        <Link href="/unprocessed">Upload New</Link>
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <DocumentsTable documents={documents} />
                </CardContent>
            </Card>
        </div>
    );
}
