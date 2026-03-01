"use client"

import { useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { FileText } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { DocumentViewerSheet, useDocumentViewer } from "@/components/document-viewer-sheet"

/**
 * SearchTable
 * 
 * Unlike DocumentsTable or BillsTable (which render parent Document arrays),
 * this table renders raw child `ExtractedItem` arrays retrieved via the
 * global line-item search route. 
 * 
 * It joins back to the parent Document to dynamically open the slider viewer
 * for context.
 */
export function SearchTable({ items }: { items: any[] }) {
    const { viewerFile, openViewer, closeViewer } = useDocumentViewer()

    return (
        <>
            <DocumentViewerSheet
                open={!!viewerFile}
                filePath={viewerFile?.path ?? null}
                fileName={viewerFile?.name ?? null}
                onClose={closeViewer}
            />
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Merchant / Provider</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Source File</TableHead>
                        <TableHead>Metadata</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={7}
                                className="h-32 text-center text-muted-foreground"
                            >
                                No line items found. Try a different search.
                            </TableCell>
                        </TableRow>
                    ) : (
                        items.map((item: any) => (
                            <TableRow
                                key={item.id}
                                className="hover:bg-primary/10 transition-colors cursor-default group"
                            >
                                <TableCell suppressHydrationWarning className="whitespace-nowrap font-medium text-muted-foreground group-hover:text-primary-foreground transition-colors">
                                    {item.date ? new Date(item.date).toLocaleDateString("en-US") : "Unknown"}
                                </TableCell>
                                <TableCell className="font-medium max-w-[200px] truncate text-foreground group-hover:text-primary-foreground">
                                    {item.description}
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate text-muted-foreground group-hover:text-primary-foreground">
                                    {item.document.merchant_or_provider || "—"}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground group-hover:text-primary-foreground transition-colors">
                                    {item.quantity}
                                </TableCell>
                                <TableCell className="text-right font-medium text-emerald-400 group-hover:text-emerald-300 transition-colors drop-shadow-sm">
                                    {item.amount != null
                                        ? `$${item.amount.toFixed(2)}`
                                        : "—"}
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                    <button
                                        onClick={() => openViewer(item.document.filePath, item.document.fileName)}
                                        className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors group-hover:drop-shadow-[0_0_8px_rgba(253,224,71,0.5)] hover:underline underline-offset-4 text-left"
                                        title="View original document"
                                    >
                                        <FileText className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{item.document.fileName}</span>
                                    </button>
                                </TableCell>
                                <TableCell className="max-w-[200px] text-xs text-muted-foreground p-2">
                                    {item.metadata ? (
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <button
                                                    className="bg-secondary/50 hover:bg-primary/20 hover:text-primary border border-border/50 hover:border-primary/50 px-2 py-1.5 rounded-md text-left truncate w-full transition-all duration-200 font-mono cursor-pointer hover:drop-shadow-[0_0_8px_rgba(253,224,71,0.3)] text-muted-foreground"
                                                    title="Click to view full metadata"
                                                >
                                                    {item.metadata.length > 40
                                                        ? item.metadata.substring(0, 40) + "..."
                                                        : item.metadata}
                                                </button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-2xl bg-background text-foreground border-primary/20 shadow-[-10px_-10px_30px_4px_rgba(0,0,0,0.1),_10px_10px_30px_4px_rgba(45,212,191,0.15)]">
                                                <DialogHeader>
                                                    <DialogTitle className="text-secondary-foreground flex items-center gap-2 drop-shadow-[0_0_8px_rgba(253,224,71,0.5)]">
                                                        <FileText className="h-4 w-4 text-primary" />
                                                        Line Item Metadata
                                                    </DialogTitle>
                                                </DialogHeader>
                                                <div className="overflow-auto max-h-[60vh] scrollbar-thin scrollbar-thumb-primary/50 mt-2 bg-secondary p-4 rounded-md border border-primary/20 shadow-inner">
                                                    <pre className="text-xs font-mono text-indigo-100/90 whitespace-pre-wrap leading-relaxed">
                                                        {(() => {
                                                            try {
                                                                const parsed = JSON.parse(item.metadata);
                                                                return JSON.stringify(parsed, null, 2);
                                                            } catch {
                                                                return item.metadata;
                                                            }
                                                        })()}
                                                    </pre>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    ) : (
                                        <span className="pl-2 group-hover:text-foreground transition-colors">—</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </>
    )
}
