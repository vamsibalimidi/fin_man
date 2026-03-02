"use client"

import { useState, useEffect, useCallback } from "react"
import { AlertTriangle, Trash2, CheckCircle2, Loader2, ArrowLeft, ExternalLink, Play, Check, X, Layers } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ExtractionReview } from "@/components/extraction-review"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import Link from "next/link"

interface Conflict {
    id: string
    fileName: string
    filePath: string
    type: string
    error: string
    extractedData: string
    matches: string
    createdAt: string
}

export default function ConflictsPage() {
    const [conflicts, setConflicts] = useState<Conflict[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [reviewConflict, setReviewConflict] = useState<Conflict | null>(null)

    const fetchConflicts = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await fetch("/api/conflicts")
            const data = await res.json()
            if (res.ok) setConflicts(data)
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchConflicts()
    }, [fetchConflicts])

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch("/api/conflicts", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id })
            })
            if (res.ok) {
                fetchConflicts()
            } else {
                const err = await res.json();
                console.error(`[ConflictsPage] Delete failed:`, err);
            }
        } catch (error) {
            console.error(error)
        }
    }

    const handleSkipAll = async () => {
        if (!confirm("Are you sure you want to discard all conflicts?")) return
        try {
            const res = await fetch("/api/conflicts", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ all: true })
            })
            if (res.ok) fetchConflicts()
        } catch (error) {
            console.error(error)
        }
    }

    const handleKeepAll = async () => {
        if (!confirm("Are you sure you want to keep all conflicts as copies?")) return
        try {
            const res = await fetch("/api/conflicts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ all: true, action: "KEEP_BOTH" })
            })
            if (res.ok) fetchConflicts()
        } catch (error) {
            console.error(error)
        }
    }

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full p-4 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild className="p-0 h-auto gap-1 text-muted-foreground hover:text-foreground mb-1">
                            <Link href="/unprocessed">
                                <ArrowLeft className="h-4 w-4" /> Back to Staging
                            </Link>
                        </Button>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        Conflict Review Queue
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-sm py-0.5">
                            {conflicts.length} Pending
                        </Badge>
                    </h1>
                    <p className="text-muted-foreground">
                        Review documents that matched existing records during batch processing.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10"
                        onClick={handleKeepAll}
                        disabled={conflicts.length === 0}
                    >
                        <Layers className="h-4 w-4" /> Keep All as Copies
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                        onClick={handleSkipAll}
                        disabled={conflicts.length === 0}
                    >
                        <Trash2 className="h-4 w-4" /> Discard All
                    </Button>
                </div>
            </div>

            <Card className="border-amber-500/20 shadow-lg shadow-amber-500/5">
                <CardHeader className="bg-amber-500/5 border-b border-amber-500/10">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Staged Collisions
                    </CardTitle>
                    <CardDescription>
                        Metadata matches require manual confirmation to avoid duplicates.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="h-64 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin opacity-20" />
                        </div>
                    ) : conflicts.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                            <CheckCircle2 className="h-10 w-10 text-emerald-500/50" />
                            <p>All conflicts resolved! Your queue is empty.</p>
                            <Button variant="link" asChild>
                                <Link href="/unprocessed">Back to Unprocessed Documents</Link>
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30">
                                    <TableHead className="w-[300px]">Conflict Info</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Suggested Match</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {conflicts.map((c) => {
                                    const matches = JSON.parse(c.matches || "[]")
                                    return (
                                        <TableRow key={c.id} className="group transition-colors hover:bg-amber-500/[0.02]">
                                            <TableCell>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-semibold text-sm">{c.fileName}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono">{c.id.slice(0, 8)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className={`text-[10px] ${c.type === 'HASH_COLLISION' ? 'bg-red-500/10 text-red-500' :
                                                    c.type === 'SOFT_MATCH' ? 'bg-amber-500/10 text-amber-500 border-amber-500/50' :
                                                        'bg-blue-500/10 text-blue-500'
                                                    }`}>
                                                    {c.type === 'HASH_COLLISION' ? 'EXACT HASH' :
                                                        c.type === 'SOFT_MATCH' ? 'SOFT MATCH' : 'METADATA'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    {matches.map((m: any) => (
                                                        <div key={m.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                            <ExternalLink className="h-3 w-3" />
                                                            <Link href={`/documents?id=${m.id}`} className="hover:text-primary hover:underline truncate max-w-[200px]">
                                                                {m.fileName}
                                                            </Link>
                                                        </div>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                                                        onClick={() => setReviewConflict(c)}
                                                    >
                                                        <Play className="h-3.5 w-3.5 fill-current" /> Review
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                                                        onClick={() => handleDelete(c.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Individual Review Modal */}
            <Dialog open={!!reviewConflict} onOpenChange={(open) => !open && setReviewConflict(null)}>
                <DialogContent className="!max-w-[98vw] sm:max-w-[98vw] w-[98vw] h-[95vh] p-0 overflow-hidden flex flex-col bg-background/95 backdrop-blur-md shadow-2xl rounded-xl border border-white/10">
                    <DialogTitle className="sr-only">Conflict Resolution</DialogTitle>
                    <DialogDescription className="sr-only">Resolve conflict by reviewing data and matching with existing records.</DialogDescription>

                    {reviewConflict && (
                        <div className="flex-1 overflow-y-auto p-2 sm:p-6 w-full h-full">
                            <ExtractionReview
                                initialData={JSON.parse(reviewConflict.extractedData || "{}")}
                                fileMeta={{
                                    fileName: reviewConflict.fileName,
                                    filePath: reviewConflict.filePath,
                                    mimeType: reviewConflict.fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg"
                                }}
                                initialConflict={{
                                    type: reviewConflict.type,
                                    message: reviewConflict.error,
                                    matches: JSON.parse(reviewConflict.matches || "[]")
                                }}
                                onCommitSuccess={async () => {
                                    await handleDelete(reviewConflict.id)
                                    setReviewConflict(null)
                                }}
                                onCancel={() => setReviewConflict(null)}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
