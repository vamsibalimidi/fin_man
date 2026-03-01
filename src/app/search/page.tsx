import { getExtractedItems } from "@/lib/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchIcon } from "lucide-react";
import { SearchTable } from "@/components/search-table";

/**
 * Global Search Page
 * 
 * A Server Component that retrieves all child `ExtractedItem` strings from the database.
 * If a `?q=` URL parameter is passed via the SearchBar, it filters the items by 
 * description, merchant name, filename, or metadata before passing them down to the 
 * SearchTable client component.
 */
export default async function SearchPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>;
}) {
    const resolvedParams = await searchParams;
    const query = resolvedParams.q || "";
    let items = await getExtractedItems();

    if (query) {
        const lowerQuery = query.toLowerCase();
        items = items.filter(
            (item: any) =>
                item.description?.toLowerCase().includes(lowerQuery) ||
                item.merchant_or_provider?.toLowerCase().includes(lowerQuery) ||
                item.document.fileName.toLowerCase().includes(lowerQuery) ||
                item.metadata?.toLowerCase().includes(lowerQuery)
        );
    }

    return (
        <div className="flex flex-col gap-6 max-w-7xl mx-auto h-full w-full">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Database Search</h1>
                <p className="text-muted-foreground mt-2">
                    Search across all extracted line items and transactions.
                </p>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/40 rounded-t-xl border-b gap-4">
                    <CardTitle className="text-lg whitespace-nowrap">Extracted Data</CardTitle>
                    <form className="relative w-full max-w-sm">
                        <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            name="q"
                            placeholder="Search descriptions, merchants..."
                            defaultValue={query}
                            className="w-full bg-background pl-8"
                        />
                    </form>
                </CardHeader>
                <CardContent className="p-0">
                    <SearchTable items={items} />
                </CardContent>
            </Card>
        </div>
    );
}
