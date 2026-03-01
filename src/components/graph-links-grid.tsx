"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, FileText } from "lucide-react"
import { DocumentViewerSheet, useDocumentViewer } from "@/components/document-viewer-sheet"

export function GraphLinksGrid({ links }: { links: any[] }) {
    const { viewerFile, openViewer, closeViewer } = useDocumentViewer()

    if (links.length === 0) {
        return (
            <div className="col-span-full h-40 flex items-center justify-center border-2 border-dashed rounded-xl text-muted-foreground bg-muted/20">
                No document links discovered yet. Upload more related files and run the linker.
            </div>
        )
    }

    return (
        <>
            <DocumentViewerSheet
                open={!!viewerFile}
                filePath={viewerFile?.path ?? null}
                fileName={viewerFile?.name ?? null}
                onClose={closeViewer}
            />
            {links.map((link) => (
                <Card key={link.id} className="flex flex-col">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <Badge variant="outline" className="font-mono text-xs">
                                {link.relationshipType}
                            </Badge>
                            <Badge
                                variant={link.confidenceScore > 0.8 ? "default" : "secondary"}
                                className="text-xs"
                            >
                                {Math.round(link.confidenceScore * 100)}% Match
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between">
                        <div className="space-y-4">
                            {/* Source */}
                            <button
                                onClick={() => openViewer(link.sourceDocument.filePath, link.sourceDocument.fileName)}
                                className="w-full text-left bg-primary/5 border rounded-lg p-3 hover:bg-primary/10 hover:border-primary/30 transition-colors group"
                            >
                                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                                    Receipt
                                </p>
                                <p className="font-medium text-sm truncate flex items-center gap-1.5 group-hover:text-primary transition-colors">
                                    <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                    {link.sourceDocument.fileName}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {link.sourceDocument.documentCategory}
                                </p>
                            </button>

                            <div className="flex justify-center -my-2 relative z-10">
                                <div className="bg-background rounded-full p-1 border shadow-sm">
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                            </div>

                            {/* Target */}
                            <button
                                onClick={() => openViewer(link.targetDocument.filePath, link.targetDocument.fileName)}
                                className="w-full text-left bg-secondary/20 border rounded-lg p-3 hover:bg-secondary/40 hover:border-secondary/60 transition-colors group"
                            >
                                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                                    Bill
                                </p>
                                <p className="font-medium text-sm truncate flex items-center gap-1.5 group-hover:text-foreground transition-colors">
                                    <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                    {link.targetDocument.fileName}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {link.targetDocument.documentCategory}
                                </p>
                            </button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </>
    )
}
