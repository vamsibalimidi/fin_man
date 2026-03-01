import { getDocumentLinks } from "@/lib/actions";
import { SyncButton } from "./sync-button";
import { GraphLinksGrid } from "@/components/graph-links-grid";

export default async function GraphPage() {
    const links = await getDocumentLinks();

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto h-full w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Document Links</h1>
                    <p className="text-muted-foreground mt-2">
                        View connections automatically discovered by the Document Graph engine. Click any document name to preview it.
                    </p>
                </div>
                <SyncButton />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <GraphLinksGrid links={links} />
            </div>
        </div>
    );
}
