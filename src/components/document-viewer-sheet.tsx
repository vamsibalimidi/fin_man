"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, Maximize } from "lucide-react"

interface DocumentViewerSheetProps {
    filePath: string | null
    fileName: string | null
    open: boolean
    onClose: () => void
}

/**
 * DocumentViewerSheet
 * 
 * A sliding drawer (Shadcn Sheet) that overlays the current page, allowing users 
 * to view the source PDF or Image of a processed document without navigating away
 * from their data tables. It includes basic zoom controls for image parsing.
 */
export function DocumentViewerSheet({ filePath, fileName, open, onClose }: DocumentViewerSheetProps) {
    const isImage = filePath ? /\.(png|jpe?g|gif|webp|svg)$/i.test(filePath) : false
    const [scale, setScale] = useState(1)

    const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 5))
    const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.25))
    const handleZoomReset = () => setScale(1)

    return (
        <Sheet open={open} onOpenChange={(v) => {
            if (!v) {
                onClose()
                setTimeout(() => setScale(1), 300) // reset zoom after close transition
            }
        }}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-2xl lg:max-w-3xl flex flex-col p-0 gap-0"
            >
                <SheetHeader className="px-5 py-3 border-b shrink-0 bg-muted/30">
                    <SheetTitle className="text-sm font-medium truncate">
                        {fileName || "Document Viewer"}
                    </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-hidden bg-muted/10 relative">
                    {!filePath ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                            No document to display.
                        </div>
                    ) : isImage ? (
                        <div className="h-full w-full relative group">
                            <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 bg-background/80 backdrop-blur-md p-1 border rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut} title="Zoom Out">
                                    <ZoomOut className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomReset} title="Reset Zoom">
                                    <Maximize className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn} title="Zoom In">
                                    <ZoomIn className="h-4 w-4" />
                                </Button>
                                <span className="text-xs font-mono px-2 text-muted-foreground">{Math.round(scale * 100)}%</span>
                            </div>
                            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={filePath}
                                    alt={fileName || "Document"}
                                    style={{ transform: `scale(${scale})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out' }}
                                    className="max-w-full max-h-full object-contain drop-shadow"
                                />
                            </div>
                        </div>
                    ) : (
                        <object
                            data={filePath}
                            type="application/pdf"
                            className="w-full h-full absolute inset-0"
                        >
                            <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
                                <p>Preview not supported for this file type.</p>
                                <a
                                    href={filePath}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary underline text-sm"
                                >
                                    Open in new tab
                                </a>
                            </div>
                        </object>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}

/**
 * Custom Hook: useDocumentViewer
 * 
 * Manages the state for opening and closing the Slide-Out Document Panel
 * from within any Table component.
 */
export function useDocumentViewer() {
    const [viewerFile, setViewerFile] = useState<{ path: string; name: string } | null>(null)

    const openViewer = (path: string, name: string) => setViewerFile({ path, name })
    const closeViewer = () => setViewerFile(null)

    return { viewerFile, openViewer, closeViewer }
}
