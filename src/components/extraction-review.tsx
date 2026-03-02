"use client"

import { useState } from "react"
import { Check, Edit2, Loader2, FileText, Calculator, ZoomIn, ZoomOut, Maximize, Code, AlertTriangle, ExternalLink, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { FileIcon } from "@/components/file-icon"
import { generateNormalizedFilename } from "@/lib/normalization-utils"

interface FileMeta {
    fileName: string
    filePath: string
    mimeType: string
}

interface ExtractionReviewProps {
    initialData: any
    fileMeta: FileMeta
    onCommitSuccess: () => void
    onCancel: () => void
    initialConflict?: { type: string, message: string, existingId?: string, matches?: any[] } | null
}

/**
 * ExtractionReview - Dual-Pane Human-In-The-Loop Modal
 * 
 * This component launches after a user drops a file into the upload zone or clicks
 * 'Manual Process' in the staging queue. It renders the source document (PDF/Image) 
 * on the left side, and a form on the right pre-filled with Gemini's AI extraction.
 * 
 * The user can manually correct any AI hallucinations before clicking "Commit", 
 * which saves the finalized JSON to the SQLite database.
 */
export function ExtractionReview({ initialData, fileMeta, onCommitSuccess, onCancel, initialConflict }: ExtractionReviewProps) {
    const [data, setData] = useState(initialData)
    const [isCommitting, setIsCommitting] = useState(false)
    const [scale, setScale] = useState(1)
    const [compareScale, setCompareScale] = useState(1)
    const [conflict, setConflict] = useState<{ type: any, message: string, existingId?: string, matches?: any[] } | null>(initialConflict || null)
    const [customFileName, setCustomFileName] = useState<string | null>(null)
    const [showCompare, setShowCompare] = useState(!!initialConflict)
    const [compareFile, setCompareFile] = useState<{ path: string, name: string } | null>(
        initialConflict?.matches?.length ? { path: initialConflict.matches[0].filePath, name: initialConflict.matches[0].fileName } : null
    )

    const [showComparisonDetails, setShowComparisonDetails] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Make sure we have a reliable array to map over. 
    // Sometimes Gemini populates `transactions` instead of `line_items` even if it's a RECEIPT.
    const items = (data.line_items && data.line_items.length > 0)
        ? data.line_items
        : (data.transactions || [])

    const handleCommit = async (force: boolean = false) => {
        setIsCommitting(true)
        setConflict(null)
        setError(null)
        try {
            const response = await fetch("/api/commit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileMeta, extractedData: data, force, customFileName })
            })

            const result = await response.json();

            if (response.status === 409) {
                setConflict({
                    type: result.type,
                    message: result.error,
                    existingId: result.existingId,
                    matches: result.matches
                });
                return;
            }

            if (!response.ok) throw new Error(result.error || "Commit failed");

            onCommitSuccess()
        } catch (err: any) {
            console.error(err)
            setError(err.message || "An unexpected error occurred during save.")
        } finally {
            setIsCommitting(false)
        }
    }

    const updateField = (field: string, value: string | number) => {
        setData((prev: any) => ({ ...prev, [field]: value }))
    }

    const updateItem = (index: number, field: string, value: string | number) => {
        setData((prev: any) => {
            const newData = { ...prev }
            const arrayName = (prev.line_items && prev.line_items.length > 0) ? "line_items" : "transactions"

            if (newData[arrayName]) {
                const newItems = [...newData[arrayName]]
                newItems[index] = { ...newItems[index], [field]: value }
                newData[arrayName] = newItems
            }
            return newData
        })
    }

    const formatDateForInput = (dateStr: string | undefined | null) => {
        if (!dateStr) return "";
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toISOString().split('T')[0];
        } catch {
            return dateStr;
        }
    }

    const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 5))
    const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.25))
    const handleZoomReset = () => setScale(1)

    const handleCompareZoomIn = () => setCompareScale(s => Math.min(s + 0.25, 5))
    const handleCompareZoomOut = () => setCompareScale(s => Math.max(s - 0.25, 0.25))
    const handleCompareZoomReset = () => setCompareScale(1)

    const isImage = fileMeta.mimeType.startsWith('image/')

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[4fr_6fr] gap-4 w-full max-w-full mx-auto h-[85vh] min-h-[600px]">
            {/* Left Pane: Full Height Document Viewer */}
            <Card className="flex flex-col h-full bg-muted/20 shadow-sm border-primary/10 overflow-hidden relative group">
                <CardHeader className="py-2 px-3 border-b shrink-0 bg-muted/30">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileIcon id={fileMeta.fileName} className="w-5 h-5" />
                            Source Document
                        </div>
                        {isImage && (
                            <div className="flex items-center gap-1 bg-background/50 backdrop-blur-sm p-1 border rounded-md shadow-sm">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleZoomOut} title="Zoom Out">
                                    <ZoomOut className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleZoomReset} title="Reset Zoom">
                                    <Maximize className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleZoomIn} title="Zoom In">
                                    <ZoomIn className="h-3 w-3" />
                                </Button>
                                <span className="text-[10px] font-mono px-1 w-10 text-center text-muted-foreground">{Math.round(scale * 100)}%</span>
                            </div>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 relative overflow-auto bg-background/50">
                    {isImage ? (
                        <div className="w-full h-full p-4 overflow-auto">
                            <div
                                style={{
                                    width: `${scale * 100}%`,
                                    height: `${scale * 100}%`,
                                    minHeight: '100%',
                                    transition: 'width 0.1s ease-out, height 0.1s ease-out'
                                }}
                                className="flex items-center justify-center relative origin-top-left"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={fileMeta.filePath}
                                    alt="Document preview"
                                    className="max-w-full max-h-full object-contain drop-shadow-sm"
                                />
                            </div>
                        </div>
                    ) : (
                        <object
                            data={fileMeta.filePath}
                            type={fileMeta.mimeType}
                            className="w-full h-full absolute inset-0"
                        >
                            <div className="p-4 text-center flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                                <p className="text-sm">Preview not supported natively.</p>
                                <a href={fileMeta.filePath} target="_blank" rel="noreferrer" className="text-primary underline font-medium text-sm">Download / Open</a>
                            </div>
                        </object>
                    )}
                </CardContent>
            </Card>

            {/* Right Pane: Compressed Data Editor */}
            <div className="flex flex-col h-full overflow-hidden">
                {conflict && (
                    <Alert variant="destructive" className="mb-4 bg-amber-500/10 border-amber-500/50 text-amber-500 animate-in fade-in slide-in-from-top-4 shrink-0">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <div className="ml-2 w-full">
                            <AlertTitle className="font-bold flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {conflict.type === "HASH_COLLISION" ? "Exact Duplicate Detected" : "Potential Data Collision"}
                                    {conflict.matches && conflict.matches.length > 0 && conflict.type !== "HASH_COLLISION" && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-[9px] uppercase tracking-wider bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/20"
                                            onClick={() => setShowComparisonDetails(!showComparisonDetails)}
                                        >
                                            {showComparisonDetails ? "Hide Details" : "Show Errors"}
                                        </Button>
                                    )}
                                </div>
                                {conflict.matches && conflict.matches.length > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[10px] bg-amber-500/20 border-amber-500/40 hover:bg-amber-500/30"
                                        onClick={() => setShowCompare(!showCompare)}
                                    >
                                        {showCompare ? "Close Comparison" : "Side-by-Side View"}
                                    </Button>
                                )}
                            </AlertTitle>
                            <AlertDescription className="text-xs opacity-90">
                                {conflict.message}
                                {conflict.matches && conflict.matches.length > 0 && showComparisonDetails && (
                                    <div className="mt-2 space-y-3">
                                        <p className="font-semibold text-[10px] uppercase tracking-wider opacity-70">Matching Records:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {conflict.matches.map((match: any) => (
                                                <div key={match.id} className="flex flex-col gap-2 p-2 border rounded-md bg-amber-500/5 border-amber-500/20 w-full max-w-md">
                                                    <div className="flex items-center justify-between">
                                                        <Button variant="outline" size="sm" asChild className="h-7 px-2 text-[10px] bg-white/5 border-amber-500/30 text-amber-600 hover:bg-amber-500/10">
                                                            <Link href={`/documents?id=${match.id}`} className="flex items-center gap-1">
                                                                <ExternalLink className="h-3 w-3" />
                                                                {match.fileName.length > 30 ? match.fileName.slice(0, 30) + '...' : match.fileName}
                                                            </Link>
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-[10px] text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                                                            onClick={() => {
                                                                setCompareFile({ path: match.filePath, name: match.fileName })
                                                                setShowCompare(true)
                                                            }}
                                                        >
                                                            Compare View
                                                        </Button>
                                                    </div>

                                                    {match.comparison && (
                                                        <div className="grid grid-cols-3 gap-1 pt-1 border-t border-amber-500/10 text-[10px]">
                                                            <div className="font-bold opacity-60">Field</div>
                                                            <div className="font-bold border-l pl-2">Current</div>
                                                            <div className="font-bold border-l pl-2">Existing</div>

                                                            <div className="opacity-80">Category</div>
                                                            <div className="truncate border-l pl-2">{match.comparison.category.current || "---"}</div>
                                                            <div className="truncate border-l pl-2 font-medium">{match.comparison.category.stored || "---"}</div>

                                                            <div className="opacity-80">Type</div>
                                                            <div className="truncate border-l pl-2">{match.comparison.type.current || "---"}</div>
                                                            <div className="truncate border-l pl-2 font-medium">{match.comparison.type.stored || "---"}</div>

                                                            {match.comparison.patientName && (
                                                                <>
                                                                    <div className="opacity-80">Patient</div>
                                                                    <div className="truncate border-l pl-2">{match.comparison.patientName.current || "---"}</div>
                                                                    <div className="truncate border-l pl-2 font-medium">{match.comparison.patientName.stored || "---"}</div>
                                                                </>
                                                            )}

                                                            <div className="opacity-80">Merchant</div>
                                                            <div className="truncate border-l pl-2">{match.comparison.merchant.current || "---"}</div>
                                                            <div className="truncate border-l pl-2 font-medium">{match.comparison.merchant.stored || "---"}</div>

                                                            <div className="opacity-80">Date</div>
                                                            <div className="border-l pl-2">{match.comparison.date.current ? new Date(match.comparison.date.current).toLocaleDateString() : "---"}</div>
                                                            <div className="border-l pl-2 font-medium">{match.comparison.date.stored ? new Date(match.comparison.date.stored).toLocaleDateString() : "---"}</div>

                                                            <div className="opacity-80">Amount</div>
                                                            <div className="border-l pl-2">${(match.comparison.amount.current || 0).toFixed(2)}</div>
                                                            <div className="border-l pl-2 font-medium">${(match.comparison.amount.stored || 0).toFixed(2)}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {conflict.type === "METADATA_COLLISION" && !showCompare && (
                                    <p className="mt-1 italic opacity-80">
                                        This might be a different photo of the same receipt or a regular recurring payment.
                                    </p>
                                )}
                            </AlertDescription>
                        </div>
                    </Alert>
                )}

                {error && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {showCompare && compareFile && (
                    <div className="flex-1 grid grid-cols-2 gap-4 mb-4 overflow-hidden border rounded-lg bg-slate-950/50 p-2 border-amber-500/20">
                        <div className="flex flex-col h-full overflow-hidden border rounded bg-background">
                            <div className="p-2 border-b bg-muted/50 text-[10px] font-bold uppercase tracking-tight flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-2">
                                    <span>Current Upload</span>
                                    <Badge variant="outline" className="text-[9px] h-4 px-1">NEW</Badge>
                                </div>
                                {isImage && (
                                    <div className="flex items-center gap-1 bg-background/50 p-0.5 border rounded-md">
                                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleZoomOut}><ZoomOut className="h-2.5 w-2.5" /></Button>
                                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleZoomReset}><Maximize className="h-2.5 w-2.5" /></Button>
                                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleZoomIn}><ZoomIn className="h-2.5 w-2.5" /></Button>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 overflow-auto bg-slate-100 p-2 relative">
                                {isImage ? (
                                    <div className="w-full h-full overflow-auto">
                                        <div style={{ width: `${scale * 100}%`, transition: 'width 0.1s ease-out' }} className="origin-top-left">
                                            <img src={fileMeta.filePath} alt="Current" className="max-w-full object-contain mx-auto" />
                                        </div>
                                    </div>
                                ) : (
                                    <object data={fileMeta.filePath} type={fileMeta.mimeType} className="w-full h-full" />
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col h-full overflow-hidden border rounded bg-background">
                            <div className="p-2 border-b bg-muted/50 text-[10px] font-bold uppercase tracking-tight flex justify-between items-center shrink-0">
                                <span className="truncate max-w-[150px]">Existing: {compareFile.name}</span>
                                <div className="flex items-center gap-1">
                                    {compareFile.name.match(/\.(png|jpe?g|gif|webp)$/i) && (
                                        <div className="flex items-center gap-1 bg-background/50 p-0.5 border rounded-md mr-1">
                                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCompareZoomOut}><ZoomOut className="h-2.5 w-2.5" /></Button>
                                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCompareZoomReset}><Maximize className="h-2.5 w-2.5" /></Button>
                                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCompareZoomIn}><ZoomIn className="h-2.5 w-2.5" /></Button>
                                        </div>
                                    )}
                                    <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => setShowCompare(false)}><X className="h-3 w-3" /></Button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto bg-slate-100 p-2 relative">
                                {compareFile.name.match(/\.(png|jpe?g|gif|webp)$/i) ? (
                                    <div className="w-full h-full overflow-auto">
                                        <div style={{ width: `${compareScale * 100}%`, transition: 'width 0.1s ease-out' }} className="origin-top-left">
                                            <img src={compareFile.path} alt="Existing" className="max-w-full object-contain mx-auto" />
                                        </div>
                                    </div>
                                ) : (
                                    <object data={compareFile.path} type="application/pdf" className="w-full h-full" />
                                )}
                            </div>
                        </div>
                    </div>
                )}
                <Card className="flex-1 flex flex-col h-full overflow-hidden shadow-lg border-primary/20">
                    <CardHeader className="py-3 px-4 border-b bg-muted/30 shrink-0">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <FileIcon id={fileMeta.fileName} className="w-7 h-7" />
                                <div>
                                    <CardTitle className="text-base">Extraction Review</CardTitle>
                                    <div className="flex flex-col">
                                        <CardDescription className="text-[10px] truncate max-w-[200px] opacity-60">Original: {fileMeta.fileName}</CardDescription>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-semibold uppercase opacity-50">Target:</span>
                                            <Input
                                                className="h-6 text-[10px] font-mono py-0 px-2 w-[220px] bg-primary/5 border-primary/20 focus-visible:ring-primary/30"
                                                value={customFileName ?? generateNormalizedFilename({
                                                    date: data.date,
                                                    merchant: data.merchant_or_provider,
                                                    category: data.documentCategory,
                                                    originalName: fileMeta.fileName
                                                })}
                                                onChange={(e) => setCustomFileName(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* JSON Viewer Modal Trigger */}
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                                        <Code className="h-3.5 w-3.5" />
                                        Raw JSON
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col bg-slate-950 border-slate-800 text-slate-50">
                                    <DialogHeader>
                                        <DialogTitle className="text-slate-200 flex items-center gap-2">
                                            <Code className="h-4 w-4 text-indigo-400" />
                                            Raw API Payload
                                        </DialogTitle>
                                    </DialogHeader>
                                    <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-700 bg-slate-900/50 p-4 rounded-md border border-slate-800">
                                        <pre className="text-xs font-mono text-indigo-100/80 whitespace-pre-wrap leading-relaxed">
                                            {JSON.stringify(initialData, null, 2)}
                                        </pre>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardHeader>

                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 text-sm border-b">
                        <div className="font-semibold text-primary/80 flex items-center gap-2 pb-2 border-b">
                            <FileText className="h-4 w-4" /> Extracted Properties
                        </div>
                        {/* Top Level Metadata - Compressed */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Category</Label>
                                <Select value={data.documentCategory} onValueChange={(val: string) => updateField("documentCategory", val)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="RECEIPT">Receipt</SelectItem>
                                        <SelectItem value="BILL">Bill</SelectItem>
                                        <SelectItem value="STATEMENT">Statement</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Type</Label>
                                <Select value={data.documentType} onValueChange={(val: string) => updateField("documentType", val)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Grocery">Grocery</SelectItem>
                                        <SelectItem value="Medical">Medical</SelectItem>
                                        <SelectItem value="Utility">Utility</SelectItem>
                                        <SelectItem value="Restaurant">Restaurant</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            {data.documentCategory === "BILL" && (
                                <div className="space-y-1.5 flex-1 min-w-[120px]">
                                    <Label className="text-xs">Status</Label>
                                    <Select value={data.paymentStatus || "UNPAID"} onValueChange={(val: string) => updateField("paymentStatus", val)}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="UNPAID">Unpaid</SelectItem>
                                            <SelectItem value="PAID">Paid</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            {data.documentCategory === "BILL" && (
                                <div className="space-y-1.5 flex-1 min-w-[120px]">
                                    <Label className="text-xs">Due Date</Label>
                                    <Input type="date" className="h-8 text-xs p-2" value={formatDateForInput(data.dueDate)} onChange={(e) => updateField("dueDate", e.target.value)} />
                                </div>
                            )}
                            {data.documentType === "Medical" && (
                                <div className="space-y-1.5 flex-[2] min-w-[180px]">
                                    <Label className="text-xs">Patient</Label>
                                    <Select value={data.patientName || ""} onValueChange={(val: string) => updateField("patientName", val)}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Vamsi Balimidi">Vamsi Balimidi</SelectItem>
                                            <SelectItem value="Lakshmi Balimidi">Lakshmi Balimidi</SelectItem>
                                            <SelectItem value="Neha Balimidi">Neha Balimidi</SelectItem>
                                            <SelectItem value="Siddharth Balimidi">Siddharth Balimidi</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-[2fr_1fr] gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Merchant / Provider</Label>
                                <Input className="h-8 text-xs" value={data.merchant_or_provider || ""} onChange={(e) => updateField("merchant_or_provider", e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Date</Label>
                                <Input type="date" className="h-8 text-xs px-2" value={formatDateForInput(data.date)} onChange={(e) => updateField("date", e.target.value)} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Total Amount</Label>
                                <div className="relative">
                                    <span className="absolute left-2.5 top-1.5 text-muted-foreground text-xs">$</span>
                                    <Input type="number" step="0.01" className="h-8 text-xs pl-6" value={data.total_amount || ""} onChange={(e) => updateField("total_amount", parseFloat(e.target.value) || 0)} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Tax</Label>
                                <div className="relative">
                                    <span className="absolute left-2.5 top-1.5 text-muted-foreground text-xs">$</span>
                                    <Input type="number" step="0.01" className="h-8 text-xs pl-6" value={data.tax || ""} onChange={(e) => updateField("tax", parseFloat(e.target.value) || 0)} />
                                </div>
                            </div>
                        </div>

                        {/* Line Items Grid - Very Compressed */}
                        <div className="space-y-2 pt-2">
                            <Label className="text-xs font-semibold flex justify-between border-b pb-1">
                                Line Items
                                <span className="bg-primary/10 text-primary px-1.5 rounded-sm">{items.length}</span>
                            </Label>
                            <div className="border rounded bg-background shadow-sm overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50 h-8">
                                        <TableRow className="h-8 hover:bg-transparent">
                                            <TableHead className="h-8 py-1 px-2 text-xs">Description</TableHead>
                                            <TableHead className="h-8 py-1 px-2 text-xs w-[60px] text-center">Qty</TableHead>
                                            <TableHead className="h-8 py-1 px-2 text-xs w-[90px] text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.length === 0 ? (
                                            <TableRow><TableCell colSpan={3} className="h-20 text-center text-muted-foreground text-xs">No line items.</TableCell></TableRow>
                                        ) : (
                                            items.map((item: any, i: number) => {
                                                const metadataQty = item.metadata?.quantity
                                                const itemQty = item.quantity
                                                const displayQty = itemQty !== undefined ? itemQty : (metadataQty !== undefined ? metadataQty : 1)

                                                return (
                                                    <TableRow key={i} className="h-auto">
                                                        <TableCell className="p-1 border-r">
                                                            <Input className="h-7 text-xs border-transparent focus-visible:ring-1 bg-transparent px-1 min-w-[120px]" value={item.description || ""} onChange={(e) => updateItem(i, "description", e.target.value)} />
                                                        </TableCell>
                                                        <TableCell className="p-1 border-r">
                                                            <Input type="number" step="1" className="h-7 text-xs border-transparent focus-visible:ring-1 bg-transparent text-center px-0 text-muted-foreground" value={displayQty} onChange={(e) => updateItem(i, "quantity", parseInt(e.target.value))} />
                                                        </TableCell>
                                                        <TableCell className="p-1">
                                                            <Input type="number" step="0.01" className="h-7 text-xs border-transparent focus-visible:ring-1 bg-transparent text-right px-1 font-mono text-emerald-500" value={item.amount || ""} onChange={(e) => updateItem(i, "amount", parseFloat(e.target.value) || 0)} />
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="py-3 px-4 border-t bg-muted/10 shrink-0 gap-3 justify-end">
                        <Button variant="outline" size="sm" onClick={onCancel} disabled={isCommitting} className="text-xs h-8">
                            Discard
                        </Button>

                        {conflict?.type === "METADATA_COLLISION" || conflict?.type === "SOFT_MATCH" || conflict?.type === "NAME_COLLISION" || conflict?.type === "HASH_COLLISION" ? (
                            <Button
                                size="sm"
                                onClick={() => handleCommit(true)}
                                disabled={isCommitting}
                                className="bg-amber-600 hover:bg-amber-700 text-white min-w-[120px] text-xs h-8 shadow-lg shadow-amber-900/20"
                            >
                                {isCommitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : (conflict?.type === "NAME_COLLISION" ? <Check className="h-3.5 w-3.5 mr-2" /> : <AlertTriangle className="h-3.5 w-3.5 mr-2" />)}
                                {isCommitting ? "Saving..." : (conflict?.type === "NAME_COLLISION" || conflict?.type === "HASH_COLLISION" ? "Force Save" : "Keep Both (Copy)")}
                            </Button>
                        ) : (
                            <Button
                                onClick={() => handleCommit(false)}
                                disabled={isCommitting}
                                size="sm"
                                className="min-w-[120px] text-xs h-8"
                            >
                                {isCommitting ? (
                                    <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Saving...</>
                                ) : (
                                    <><Check className="mr-2 h-3.5 w-3.5" /> Approve & Save</>
                                )}
                            </Button>
                        )}
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
