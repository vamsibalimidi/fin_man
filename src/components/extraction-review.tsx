"use client"

import { useState } from "react"
import { Check, Edit2, Loader2, FileText, Calculator, ZoomIn, ZoomOut, Maximize, Code } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

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
export function ExtractionReview({ initialData, fileMeta, onCommitSuccess, onCancel }: ExtractionReviewProps) {
    const [data, setData] = useState(initialData)
    const [isCommitting, setIsCommitting] = useState(false)
    const [scale, setScale] = useState(1)

    // Make sure we have a reliable array to map over. 
    // Sometimes Gemini populates `transactions` instead of `line_items` even if it's a RECEIPT.
    const items = (data.line_items && data.line_items.length > 0)
        ? data.line_items
        : (data.transactions || [])

    const handleCommit = async () => {
        setIsCommitting(true)
        try {
            const response = await fetch("/api/commit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileMeta, extractedData: data })
            })

            if (!response.ok) throw new Error("Commit failed")

            onCommitSuccess()
        } catch (error) {
            console.error(error)
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

    const isImage = fileMeta.mimeType.startsWith('image/')

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[4fr_6fr] gap-4 w-full max-w-full mx-auto h-[85vh] min-h-[600px]">
            {/* Left Pane: Full Height Document Viewer */}
            <Card className="flex flex-col h-full bg-muted/20 shadow-sm border-primary/10 overflow-hidden relative group">
                <CardHeader className="py-2 px-3 border-b shrink-0 bg-muted/30">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
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
            <Card className="flex flex-col h-full overflow-hidden shadow-lg border-primary/20">
                <CardHeader className="py-3 px-4 border-b bg-muted/30 shrink-0">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-1.5 rounded-md">
                                <Calculator className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Extraction Review</CardTitle>
                                <CardDescription className="text-xs">Verify AI extractions</CardDescription>
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
                    <Button onClick={handleCommit} disabled={isCommitting} size="sm" className="min-w-[120px] text-xs h-8">
                        {isCommitting ? (
                            <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Saving...</>
                        ) : (
                            <><Check className="mr-2 h-3.5 w-3.5" /> Approve & Save</>
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
