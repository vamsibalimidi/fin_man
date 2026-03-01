"use client"

import { useState } from "react"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { FileText, Link as LinkIcon, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import Link from "next/link"
import { DocumentViewerSheet, useDocumentViewer } from "@/components/document-viewer-sheet"

type SortColumn = "fileName" | "merchant" | "documentType" | "uploadDate" | "receiptDate" | "dueDate" | "totalAmount" | "paymentStatus" | "patientName"
type SortDirection = "asc" | "desc"

interface BillsTableProps { documents: any[] }

/**
 * BillsTable
 * 
 * A specialized data table designed exclusively for Documents categorized as "BILL".
 * 
 * Features:
 * - Specific column sorts (Due Date, Patient Name).
 * - Renders a green link button to directly open a paying RECEIPT's raw image if the
 *   backend Linker engine has successfully resolved the relationship.
 */
export function BillsTable({ documents }: BillsTableProps) {
    const [sortColumn, setSortColumn] = useState<SortColumn>("uploadDate")
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
    const { viewerFile, openViewer, closeViewer } = useDocumentViewer()

    const handleSort = (column: SortColumn) => {
        if (sortColumn === column) setSortDirection(sortDirection === "asc" ? "desc" : "asc")
        else { setSortColumn(column); setSortDirection("asc") }
    }

    const sortedDocuments = [...documents].sort((a, b) => {
        let valA: any, valB: any
        switch (sortColumn) {
            case "fileName": valA = a.fileName.toLowerCase(); valB = b.fileName.toLowerCase(); break
            case "merchant": valA = (a.merchant_or_provider || "").toLowerCase(); valB = (b.merchant_or_provider || "").toLowerCase(); break
            case "documentType": valA = (a.documentType || "").toLowerCase(); valB = (b.documentType || "").toLowerCase(); break
            case "uploadDate": valA = new Date(a.uploadDate).getTime(); valB = new Date(b.uploadDate).getTime(); break
            case "receiptDate": valA = a.date ? new Date(a.date).getTime() : 0; valB = b.date ? new Date(b.date).getTime() : 0; break
            case "dueDate": valA = a.dueDate ? new Date(a.dueDate).getTime() : 0; valB = b.dueDate ? new Date(b.dueDate).getTime() : 0; break
            case "totalAmount": valA = a.extractedItems.reduce((s: number, i: any) => s + (i.amount || 0), 0); valB = b.extractedItems.reduce((s: number, i: any) => s + (i.amount || 0), 0); break
            case "paymentStatus": valA = (a.paymentStatus || "UNPAID").toLowerCase(); valB = (b.paymentStatus || "UNPAID").toLowerCase(); break
            case "patientName": valA = (a.patientName || "").toLowerCase(); valB = (b.patientName || "").toLowerCase(); break
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
            <Table>
                <TableHeader>
                    <TableRow>
                        <SortHead column="fileName" label="File Name" />
                        <SortHead column="merchant" label="Merchant" />
                        <SortHead column="documentType" label="Type" />
                        <SortHead column="patientName" label="Patient Name" />
                        <SortHead column="uploadDate" label="Upload Date" />
                        <SortHead column="receiptDate" label="Bill Date" />
                        <SortHead column="dueDate" label="Due Date" />
                        <SortHead column="totalAmount" label="Amount" className="text-right" />
                        <SortHead column="paymentStatus" label="Status" className="text-center" />
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedDocuments.length === 0 ? (
                        <TableRow><TableCell colSpan={10} className="h-32 text-center text-muted-foreground">No bills found. Upload a bill to get started.</TableCell></TableRow>
                    ) : (
                        sortedDocuments.map((doc) => {
                            const isPaid = doc.paymentStatus === "PAID"
                            const receiptDoc = doc.targetLinks?.[0]?.sourceDocument
                            return (
                                <TableRow key={doc.id}>
                                    <TableCell className="font-medium">
                                        <button onClick={() => openViewer(doc.filePath, doc.fileName)} className="flex items-center gap-2 hover:underline hover:text-primary transition-colors cursor-pointer text-left">
                                            <FileText className="h-4 w-4 text-primary shrink-0" />
                                            {doc.fileName}
                                        </button>
                                    </TableCell>
                                    <TableCell className="max-w-[150px] truncate" title={doc.merchant_or_provider || "—"}>{doc.merchant_or_provider || "—"}</TableCell>
                                    <TableCell>{doc.documentType || "Unknown"}</TableCell>
                                    <TableCell className="max-w-[150px] truncate">{doc.patientName || "—"}</TableCell>
                                    <TableCell suppressHydrationWarning>{new Date(doc.uploadDate).toLocaleDateString()}</TableCell>
                                    <TableCell suppressHydrationWarning>{doc.date ? new Date(doc.date).toLocaleDateString() : "—"}</TableCell>
                                    <TableCell suppressHydrationWarning>{doc.dueDate ? new Date(doc.dueDate).toLocaleDateString() : "—"}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {doc.extractedItems.length > 0 ? `$${doc.extractedItems.reduce((sum: number, i: any) => sum + (i.amount || 0), 0).toFixed(2)}` : "—"}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {isPaid && receiptDoc ? (
                                            <button onClick={() => openViewer(receiptDoc.filePath, receiptDoc.fileName)} title="Click to view paying receipt" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset bg-emerald-500/10 text-emerald-400 ring-emerald-500/20 hover:bg-emerald-500/20 transition-colors cursor-pointer">
                                                PAID <LinkIcon className="h-3 w-3 opacity-70" />
                                            </button>
                                        ) : (
                                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${isPaid ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" : "bg-rose-500/10 text-rose-400 ring-rose-500/20"}`}>
                                                {doc.paymentStatus || "UNPAID"}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="icon" onClick={() => openViewer(doc.filePath, doc.fileName)} title="View document"><FileText className="h-4 w-4 text-muted-foreground" /></Button>
                                        <Button variant="ghost" size="icon" asChild title="View Line Items"><Link href={`/search?q=${encodeURIComponent(doc.fileName)}`}><LinkIcon className="h-4 w-4 text-muted-foreground" /></Link></Button>
                                    </TableCell>
                                </TableRow>
                            )
                        })
                    )}
                </TableBody>
            </Table>
        </>
    )
}
