"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Zap, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

type Result = { newLinksCreated: number } | null;

export function SyncButton() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [result, setResult] = useState<Result>(null);
    const [error, setError] = useState(false);
    const router = useRouter();

    const handleSync = async () => {
        setIsSyncing(true);
        setResult(null);
        setError(false);
        try {
            const res = await fetch("/api/linker", { method: "POST" });
            const data = await res.json();
            setResult(data);
            // Always refresh so the page shows latest links
            router.refresh();
        } catch {
            setError(true);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="flex flex-col items-end gap-2">
            <Button
                onClick={handleSync}
                disabled={isSyncing}
                className="w-full md:w-auto gap-2"
            >
                {isSyncing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                    <Zap className="h-4 w-4" />
                )}
                {isSyncing ? "Running Linker..." : "Run Linker"}
            </Button>

            {/* Inline result feedback */}
            {result !== null && !isSyncing && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    {result.newLinksCreated === 0
                        ? "No new links found — everything is already up to date."
                        : `${result.newLinksCreated} new link${result.newLinksCreated > 1 ? "s" : ""} created and bills updated.`}
                </p>
            )}
            {error && !isSyncing && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Linker failed. Check server logs.
                </p>
            )}
        </div>
    );
}
