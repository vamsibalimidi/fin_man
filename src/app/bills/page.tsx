import { getBills } from "@/lib/actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BillsTable } from "@/components/bills-table";

export const dynamic = "force-dynamic";

/**
 * Bills & Statements Explorer
 * 
 * A Server Component that queries the database for all Documents, filtering out
 * anything that isn't a "BILL". 
 * 
 * It also accepts an optional `?type=` URL parameter (e.g. `?type=Medical`) to 
 * filter the BillsTable down to a specific category.
 */
export default async function BillsPage({
    searchParams,
}: {
    searchParams: Promise<{ type?: string }>;
}) {
    const { type } = await searchParams;
    const allBills = await getBills();

    // Filter by documentType if a type query param is provided
    const bills = type
        ? allBills.filter((b) => b.documentType?.toLowerCase() === type.toLowerCase())
        : allBills;

    const totalBills = bills.length;
    const unpaidBills = bills.filter(b => b.paymentStatus !== "PAID").length;

    const pageTitle = type ? `${type} Bills` : "Bills & Statements";
    const pageDescription = type === "Medical"

        ? "Track your medical bills and insurance payments."
        : type === "Regular"
            ? "Track your utility, subscription, and other regular bills."
            : "Track your medical and utility bills, monitor payment statuses, and ensure everything is paid on time.";

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto h-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
                    <p className="text-muted-foreground mt-2">{pageDescription}</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-background/50 backdrop-blur-sm border-border/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-secondary-foreground">Total Bills Processed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold tracking-tight text-foreground drop-shadow-md">{totalBills}</div>
                    </CardContent>
                </Card>
                <Card className="bg-background/50 backdrop-blur-sm border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.05)]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-rose-400">Unpaid Bills — Action Required</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold tracking-tight text-rose-500 drop-shadow-md">{unpaidBills}</div>
                        <p className="text-xs text-rose-500/80 mt-1">Bills waiting for payment</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/40 rounded-t-xl border-b space-y-0">
                    <div>
                        <CardTitle className="text-lg">Bills Tracker</CardTitle>
                        <CardDescription>
                            {type ? `Showing ${type} bills only` : "All extracted bills"}
                        </CardDescription>
                    </div>
                    <Button size="sm" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        <Link href="/unprocessed">Upload Bill</Link>
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <BillsTable documents={bills} />
                </CardContent>
            </Card>
        </div>
    );
}
