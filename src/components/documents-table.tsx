"use client"

import { useState } from "react"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { FileText, Link as LinkIcon, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Loader2 } from "lucide-react"
import Link from "next/link"
import { DocumentViewerSheet, useDocumentViewer } from "@/components/document-viewer-sheet"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Code } from "lucide-react"

type SortColumn = "fileName" | "merchant" | "documentCategory" | "documentType" | "uploadDate" | "receiptDate" | "totalAmount" | "extractedItemsCount"
type SortDirection = "asc" | "desc"

interface DocumentsTableProps { documents: any[] }

/**
 * DocumentsTable
 * 
 * The primary view for all successfully parsed records in the system.
 * It expects a \`documents\` array of standard Prisma Document objects.
 * 
 * Features:
 * - Dynamic column sorting (ASC/DESC) on click.
 * - Handles asynchronous physical file deletion + database cascading wipes.
 * - Triggers the generic \`DocumentViewerSheet\` when a user clicks the document icon.
 */
export function DocumentsTable({ documents }: DocumentsTableProps) {
    const [sortColumn, setSortColumn] = useState<SortColumn>("uploadDate")
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
    const [isDeleting, setIsDeleting] = useState<string | null>(null)
    const [documentToDelete, setDocumentToDelete] = useState<{ id: string, fileName: string } | null>(null)
    const [selectedJson, setSelectedJson] = useState<string | null>(null)
    const { viewerFile, openViewer, closeViewer } = useDocumentViewer()
    const router = useRouter()

    const handleSort = (column: SortColumn) => {
        if (sortColumn === column) setSortDirection(sortDirection === "asc" ? "desc" : "asc")
        else { setSortColumn(column); setSortDirection("asc") }
    }

    const confirmDelete = async () => {
        if (!documentToDelete) return;
        const { id } = documentToDelete;
        setIsDeleting(id);
        try {
            const res = await fetch(`/api/documents/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                console.error("Failed to delete document");
                alert("Failed to delete document. Check console for details.");
            } else {
                router.refresh();
            }
        } catch (err) {
            console.error("Error calling delete API:", err);
            alert("Error deleting document.");
        } finally {
            setIsDeleting(null);
            setDocumentToDelete(null);
        }
    }

    const sortedDocuments = [...documents].sort((a, b) => {
        let valA: any, valB: any
        switch (sortColumn) {
            case "fileName": valA = a.fileName.toLowerCase(); valB = b.fileName.toLowerCase(); break
            case "merchant": valA = (a.merchant_or_provider || "").toLowerCase(); valB = (b.merchant_or_provider || "").toLowerCase(); break
            case "documentCategory": valA = a.documentCategory.toLowerCase(); valB = b.documentCategory.toLowerCase(); break
            case "documentType": valA = (a.documentType || "").toLowerCase(); valB = (b.documentType || "").toLowerCase(); break
            case "uploadDate": valA = new Date(a.uploadDate).getTime(); valB = new Date(b.uploadDate).getTime(); break
            case "receiptDate": valA = a.date ? new Date(a.date).getTime() : 0; valB = b.date ? new Date(b.date).getTime() : 0; break
            case "totalAmount": valA = a.extractedItems.reduce((s: number, i: any) => s + (i.amount || 0), 0); valB = b.extractedItems.reduce((s: number, i: any) => s + (i.amount || 0), 0); break
            case "extractedItemsCount": valA = a.extractedItems.length; valB = b.extractedItems.length; break
            default: valA = 0; valB = 0
        }
        if (valA < valB) return sortDirection === "asc" ? -1 : 1
        if (valA > valB) return sortDirection === "asc" ? 1 : -1
        return 0
    })

    const SortIcon = ({ column }: { column: SortColumn }) => {
        if (sortColumn !== column) return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />
        return sortDirection === "asc" ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : <ArrowDown className="ml-2 h-4 w-4 text-primary" />
    }

    const SortHead = ({ column, label, className }: { column: SortColumn; label: string; className?: string }) => (
        <TableHead className={`cursor-pointer hover:bg-muted/50 transition-colors ${className ?? ""}`} onClick={() => handleSort(column)}>
            <div className={`flex items-center ${className?.includes("text-right") ? "justify-end" : ""}`}>
                {label}<SortIcon column={column} />
            </div>
        </TableHead>
    )

    return (
        <>
            <DocumentViewerSheet open={!!viewerFile} filePath={viewerFile?.path ?? null} fileName={viewerFile?.name ?? null} onClose={closeViewer} />
            <Dialog open={selectedJson !== null} onOpenChange={(open) => { if (!open) setSelectedJson(null) }}>
                <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Code className="h-5 w-5 text-primary" /> Raw Extracted JSON</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto rounded-md bg-muted p-4 border relative">
                        <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words min-w-full">
                            {selectedJson ? JSON.stringify(JSON.parse(selectedJson), null, 2) : ""}
                        </pre>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={documentToDelete !== null} onOpenChange={(open) => { if (!open) setDocumentToDelete(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete <strong>{documentToDelete?.fileName}</strong> from the database and remove the physical file. All AI extracted details and relationships will be wiped.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting !== null}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault(); // prevent dialog from closing instantly
                                confirmDelete();
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white"
                            disabled={isDeleting !== null}
                        >
                            {isDeleting !== null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isDeleting !== null ? "Deleting..." : "Delete Menu"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Table>
                <TableHeader>
                    <TableRow>
                        <SortHead column="fileName" label="File Name" />
                        <SortHead column="merchant" label="Merchant" />
                        <SortHead column="documentCategory" label="Category" />
                        <SortHead column="documentType" label="Type" />
                        <SortHead column="uploadDate" label="Upload Date" />
                        <SortHead column="receiptDate" label="Receipt Date" />
                        <SortHead column="totalAmount" label="Amount" className="text-right" />
                        <SortHead column="extractedItemsCount" label="Item #" className="text-right" />
                        <TableHead className="text-center">Raw Data</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedDocuments.length === 0 ? (
                        <TableRow><TableCell colSpan={9} className="h-32 text-center text-muted-foreground">No documents found. Upload one to get started.</TableCell></TableRow>
                    ) : (
                        sortedDocuments.map((doc) => (
                            <TableRow key={doc.id}>
                                <TableCell className="font-medium">
                                    <button onClick={() => openViewer(doc.filePath, doc.fileName)} className="flex items-center gap-2 hover:underline hover:text-primary transition-colors cursor-pointer text-left">
                                        <FileText className="h-4 w-4 text-primary shrink-0" />
                                        {doc.fileName}
                                    </button>
                                </TableCell>
                                {/* merchant_or_provider now lives on the Document row */}
                                <TableCell className="max-w-[150px] truncate" title={doc.merchant_or_provider || "—"}>{doc.merchant_or_provider || "—"}</TableCell>
                                <TableCell>
                                    <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground ring-1 ring-inset ring-secondary/20">
                                        {doc.documentCategory}
                                    </span>
                                </TableCell>
                                <TableCell>{doc.documentType || "Unknown"}</TableCell>
                                <TableCell suppressHydrationWarning>{new Date(doc.uploadDate).toLocaleDateString()}</TableCell>
                                <TableCell suppressHydrationWarning>{doc.date ? new Date(doc.date).toLocaleDateString() : "—"}</TableCell>
                                <TableCell className="text-right font-mono">
                                    {doc.extractedItems.length > 0 ? `$${doc.extractedItems.reduce((sum: number, i: any) => sum + (i.amount || 0), 0).toFixed(2)}` : "—"}
                                </TableCell>
                                <TableCell className="text-right font-medium">{doc.extractedItems.length}</TableCell>
                                <TableCell className="text-center w-12">
                                    {doc.rawJson ? (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => setSelectedJson(doc.rawJson)} title="View Raw JSON">
                                            <Code className="h-4 w-4" />
                                        </Button>
                                    ) : (
                                        <span className="text-muted-foreground text-xs italic">—</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right space-x-1 whitespace-nowrap">
                                    <Button variant="ghost" size="icon" onClick={() => openViewer(doc.filePath, doc.fileName)} title="View document" disabled={isDeleting === doc.id}><FileText className="h-4 w-4 text-muted-foreground" /></Button>
                                    <Button variant="ghost" size="icon" asChild title="View Line Items" className={isDeleting === doc.id ? "pointer-events-none opacity-50" : ""}><Link href={`/search?q=${encodeURIComponent(doc.fileName)}`}><LinkIcon className="h-4 w-4 text-muted-foreground" /></Link></Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                        title="Delete document"
                                        onClick={() => setDocumentToDelete({ id: doc.id, fileName: doc.fileName })}
                                        disabled={isDeleting === doc.id}
                                    >
                                        {isDeleting === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </>
    )
}
