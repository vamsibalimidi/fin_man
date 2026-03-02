"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Upload, FileText, CheckCircle2, Loader2, Play, RefreshCw, CalendarIcon, Zap, Trash2, AlertTriangle, ArrowRight, ChevronDown, ChevronUp, AlertCircle } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExtractionReview } from "@/components/extraction-review"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { DocumentViewerSheet, useDocumentViewer } from "@/components/document-viewer-sheet"
import { FileIcon } from "@/components/file-icon"
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from "@/components/ui/dialog"

interface StagingFile {
    fileName: string
    filePath: string
    size: number
    createdAt: string
    isDuplicate?: boolean
    duplicateId?: string
}

interface FileMeta {
    fileName: string
    filePath: string
    mimeType: string
}

/**
 * Unprocessed (Staging) Page
 * 
 * A Next.js Client Component (`use client`) that manages the local `public/uploads` directory.
 * 
 * Responsibilities:
 * - Local physical file Drag-&-Drop uploading.
 * - Manual trigger for Gemini extraction (opens the ExtractionReview modal).
 * - "Process Selected / Process All Automatically" loop, which skips human review and hits `/api/process-all`.
 */
export default function UnprocessedPage() {
    // Staging List state
    const [files, setFiles] = useState<StagingFile[]>([])
    const [conflictCount, setConflictCount] = useState(0)
    const [isLoadingFiles, setIsLoadingFiles] = useState(true)
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

    // Document Viewer
    const { viewerFile, openViewer, closeViewer } = useDocumentViewer()

    // Upload state
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Extraction / Review state
    const [isExtracting, setIsExtracting] = useState<string | null>(null) // holds fileName being extracted
    const [isDeleting, setIsDeleting] = useState<string | null>(null) // holds fileName being deleted
    const [reviewData, setReviewData] = useState<any | null>(null)
    const [reviewConflict, setReviewConflict] = useState<any | null>(null)
    const [fileMeta, setFileMeta] = useState<FileMeta | null>(null)

    // Auto-Process state
    const [isAutoProcessing, setIsAutoProcessing] = useState(false)
    const [autoProcessStatus, setAutoProcessStatus] = useState<string>("")
    const [progress, setProgress] = useState<{ current: number, total: number } | null>(null)
    const [batchSummary, setBatchSummary] = useState<{
        total: number,
        success: number,
        duplicates: number,
        conflicts: number,
        errors: number,
        errorDetails?: { fileName: string, error: string }[]
    } | null>(null)
    const [showErrorDetails, setShowErrorDetails] = useState(false)

    const fetchFiles = useCallback(async () => {
        setIsLoadingFiles(true)
        try {
            const res = await fetch("/api/unprocessed")
            const data = await res.json()
            if (res.ok) {
                const filesWithDupes = await Promise.all((data.files || []).map(async (file: StagingFile) => {
                    try {
                        const dupeRes = await fetch("/api/check-duplicate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ fileName: file.fileName })
                        });
                        const dupeData = await dupeRes.json();
                        return { ...file, isDuplicate: dupeData.duplicate, duplicateId: dupeData.existingId };
                    } catch (e) {
                        return file;
                    }
                }));
                setFiles(filesWithDupes)
            }

            // Also fetch conflict count
            const confRes = await fetch("/api/conflicts")
            if (confRes.ok) {
                const confData = await confRes.json()
                setConflictCount(confData.length || 0)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoadingFiles(false)
        }
    }, [])

    const toggleSelection = (fileName: string) => {
        const next = new Set(selectedFiles)
        if (next.has(fileName)) next.delete(fileName)
        else next.add(fileName)
        setSelectedFiles(next)
    }

    const toggleAll = () => {
        if (selectedFiles.size === files.length) setSelectedFiles(new Set())
        else setSelectedFiles(new Set(files.map(f => f.fileName)))
    }

    useEffect(() => {
        fetchFiles()
    }, [fetchFiles])

    // --- Upload Handlers ---
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
    const handleDragLeave = () => setIsDragging(false)
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const droppedFiles = Array.from(e.dataTransfer.files)
        if (droppedFiles.length > 0) handleUpload(droppedFiles)
    }
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleUpload(Array.from(e.target.files))
        }
    }

    const handleUpload = async (uploadFiles: File[]) => {
        setIsUploading(true)
        try {
            for (const file of uploadFiles) {
                const formData = new FormData()
                formData.append("file", file)
                await fetch("/api/unprocessed", { method: "POST", body: formData })
            }
            // Refresh list after upload
            await fetchFiles()
        } catch (error) {
            console.error("Upload error", error)
        } finally {
            setIsUploading(false)
        }
    }

    // --- Extraction Handler ---
    const handleProcess = async (fileName: string) => {
        setIsExtracting(fileName)
        try {
            const res = await fetch("/api/extract", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileName })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setReviewData(data.extractedData)
            setReviewConflict(data.conflict)
            setFileMeta(data.fileMeta)
        } catch (error) {
            console.error("Extraction failed:", error)
        } finally {
            setIsExtracting(null)
        }
    }

    const handleDelete = async (fileName: string) => {
        setIsDeleting(fileName)
        try {
            const res = await fetch(`/api/unprocessed?fileName=${encodeURIComponent(fileName)}`, { method: "DELETE" })
            if (res.ok) {
                // Instantly remove it from UI array without a heavy refetch
                setFiles(prev => prev.filter(f => f.fileName !== fileName))
                setSelectedFiles(prev => {
                    const next = new Set(prev)
                    if (next.has(fileName)) next.delete(fileName)
                    return next
                })
            } else {
                console.error("Failed to delete", fileName)
            }
        } catch (error) {
            console.error("Delete failed:", error)
        } finally {
            setIsDeleting(null)
        }
    }

    // --- Backend Auto-Process ---
    const handleProcessAll = async () => {
        setIsAutoProcessing(true)

        // If no files are selected, process all of them
        const filesToProcess = selectedFiles.size > 0
            ? files.filter(f => selectedFiles.has(f.fileName))
            : files;

        const total = filesToProcess.length;
        setProgress({ current: 0, total });

        let successCount = 0;
        let duplicateCount = 0;
        let conflictCount = 0;
        let errorCount = 0;
        let errorDetails: { fileName: string, error: string }[] = [];

        try {
            for (let i = 0; i < filesToProcess.length; i++) {
                const file = filesToProcess[i];
                setAutoProcessStatus(file.fileName);
                setProgress({ current: i + 1, total });

                const res = await fetch("/api/process-all", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fileName: file.fileName })
                });

                const result = await res.json();

                if (res.ok) {
                    if (result.errors && result.errors.length > 0) {
                        const err = result.errors[0];
                        if (err.type === "HASH_COLLISION") duplicateCount++;
                        else if (err.type === "METADATA_COLLISION" || err.type === "SOFT_MATCH") conflictCount++;
                        else {
                            errorCount++;
                            errorDetails.push({ fileName: file.fileName, error: err.error || "Unknown error" });
                        }
                    } else {
                        successCount++;
                    }
                } else {
                    errorCount++;
                    errorDetails.push({ fileName: file.fileName, error: result.error || "Auto-process failed" });
                    console.error("Auto-process failed for", file.fileName);
                }

                // Refresh list quickly as items disappear, and remove from selection
                setSelectedFiles(prev => {
                    const next = new Set(prev)
                    next.delete(file.fileName)
                    return next
                })
                await fetchFiles();
            }

            setBatchSummary({
                total,
                success: successCount,
                duplicates: duplicateCount,
                conflicts: conflictCount,
                errors: errorCount,
                errorDetails
            });
        } catch (error) {
            console.error("Process all error:", error)
        } finally {
            setIsAutoProcessing(false)
            setAutoProcessStatus("")
            setProgress(null)
            fetchFiles()
        }
    }

    // --- Helpers ---
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024, dm = 2, sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
    }

    // --- Render UI ---
    return (
        <>
            <DocumentViewerSheet open={!!viewerFile} filePath={viewerFile?.path ?? null} fileName={viewerFile?.name ?? null} onClose={closeViewer} />

            {/* Batch Summary Dialog */}
            <Dialog open={!!batchSummary} onOpenChange={(open) => !open && setBatchSummary(null)}>
                <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-md border-white/10 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            Batch Process Complete
                        </DialogTitle>
                        <DialogDescription>
                            Finished processing {batchSummary?.total} documents.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-center">
                            <div className="text-2xl font-bold text-emerald-500">{batchSummary?.success}</div>
                            <div className="text-[10px] uppercase tracking-wider text-emerald-500/70 font-bold">Imported</div>
                        </div>
                        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-center">
                            <div className="text-2xl font-bold text-amber-500">{batchSummary?.duplicates}</div>
                            <div className="text-[10px] uppercase tracking-wider text-amber-500/70 font-bold">Files Skipped</div>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-center">
                            <div className="text-2xl font-bold text-blue-500">{batchSummary?.conflicts}</div>
                            <div className="text-[10px] uppercase tracking-wider text-blue-500/70 font-bold">Metadata Conflicts</div>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-center">
                            <div className="text-2xl font-bold text-red-500">{batchSummary?.errors}</div>
                            <div className="text-[10px] uppercase tracking-wider text-red-500/70 font-bold">Failed</div>
                        </div>
                    </div>

                    {batchSummary?.errors && batchSummary.errors > 0 && (
                        <div className="mb-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-between text-xs text-muted-foreground hover:text-foreground p-0 h-auto"
                                onClick={() => setShowErrorDetails(!showErrorDetails)}
                            >
                                <span className="flex items-center gap-2">
                                    <AlertCircle className="h-3 w-3 text-red-500" />
                                    {showErrorDetails ? "Hide Error Details" : `View ${batchSummary.errors} Failure Cause${batchSummary.errors > 1 ? 's' : ''}`}
                                </span>
                                {showErrorDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </Button>
                            {showErrorDetails && (
                                <div className="mt-2 max-h-[150px] overflow-y-auto border rounded-md bg-red-500/5 border-red-500/10 divide-y divide-red-500/10">
                                    {batchSummary.errorDetails?.map((err, i) => (
                                        <div key={i} className="p-2 text-[10px] space-y-0.5">
                                            <div className="font-bold text-red-500 truncate">{err.fileName}</div>
                                            <div className="text-muted-foreground italic leading-tight">{err.error}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        {batchSummary && (batchSummary.conflicts > 0 || batchSummary.duplicates > 0) && (
                            <Button asChild variant="outline" className="w-full sm:w-auto border-blue-500/50 text-blue-500 hover:bg-blue-500/10 gap-2">
                                <Link href="/conflicts">
                                    Review Conflicts <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        )}
                        <Button onClick={() => { setBatchSummary(null); setShowErrorDetails(false); }} className="w-full sm:w-auto font-bold">
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={!!(reviewData && fileMeta)} onOpenChange={(open) => {
                if (!open) { setReviewData(null); setFileMeta(null); fetchFiles(); }
            }}>
                <DialogContent
                    className="!max-w-[98vw] sm:max-w-[98vw] w-[98vw] h-[95vh] p-0 overflow-hidden flex flex-col bg-background/95 backdrop-blur-md shadow-2xl rounded-xl border border-white/10"
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <DialogTitle className="sr-only">Document Extraction Review</DialogTitle>
                    <DialogDescription className="sr-only">Review the AI extracted document data and confirm its accuracy.</DialogDescription>

                    {reviewData && fileMeta && (
                        <div className="flex-1 overflow-y-auto p-2 sm:p-6 w-full h-full">
                            <ExtractionReview
                                initialData={reviewData}
                                fileMeta={fileMeta!}
                                initialConflict={reviewConflict}
                                onCommitSuccess={() => {
                                    setReviewData(null)
                                    setReviewConflict(null)
                                    setFileMeta(null)
                                    fetchFiles()
                                }}
                                onCancel={() => {
                                    setReviewData(null)
                                    setReviewConflict(null)
                                    setFileMeta(null)
                                }}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Unprocessed Documents</h1>
                        <p className="text-muted-foreground mt-2">
                            Files in your staging directory ready for AI extraction.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            size="lg"
                            className="relative group overflow-hidden rounded-full font-bold shadow-lg shadow-purple-900/40 hover:shadow-purple-900/60 transition-all hover:scale-105 px-8"
                            onClick={handleProcessAll}
                            disabled={isLoadingFiles || files.length === 0 || isAutoProcessing || isExtracting !== null}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 animate-gradient-x group-hover:opacity-90 transition-opacity" />
                            <span className="relative z-10 flex items-center gap-2 text-white">
                                {isAutoProcessing ? (
                                    <><Loader2 className="h-5 w-5 text-white animate-spin" /> Processing {progress ? `(${progress.current} of ${progress.total})` : "..."}</>
                                ) : (
                                    <><Zap className="h-5 w-5 text-yellow-300 fill-current animate-pulse" /> {selectedFiles.size > 0 ? `Process Selected (${selectedFiles.size})` : "Process All Automatically"}</>
                                )}
                            </span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={fetchFiles} disabled={isLoadingFiles || isAutoProcessing} className="gap-2">
                            <RefreshCw className={`h-4 w-4 ${isLoadingFiles ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                        {conflictCount > 0 && (
                            <Button asChild variant="outline" size="sm" className="gap-2 border-amber-500/50 text-amber-500 hover:bg-amber-500/10">
                                <Link href="/conflicts" className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    Conflict Queue
                                    <Badge variant="secondary" className="bg-amber-500/20 text-amber-500 border-none h-4 px-1 text-[10px]">{conflictCount}</Badge>
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-[1fr_300px]">
                    {/* Main List */}
                    <Card className="flex flex-col shadow-sm">
                        <CardHeader className="border-b bg-muted/20 pb-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Checkbox
                                        checked={files.length > 0 && selectedFiles.size === files.length}
                                        onCheckedChange={toggleAll}
                                        disabled={files.length === 0 || isAutoProcessing}
                                        className="h-5 w-5 rounded-sm"
                                    />
                                    <CardTitle className="text-lg">Staging Queue</CardTitle>
                                    <Badge variant="secondary" className="font-mono text-xs">{files.length}</Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 relative">
                            {isLoadingFiles && !isAutoProcessing ? (
                                <div className="h-48 flex items-center justify-center text-muted-foreground gap-2">
                                    <Loader2 className="h-5 w-5 animate-spin opacity-50" /> Loading files...
                                </div>
                            ) : files.length === 0 ? (
                                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-3">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />
                                    <p>No unprocessed files. You{"'"}re all caught up!</p>
                                </div>
                            ) : (
                                <div className="divide-y border-b">
                                    {files.map((file) => (
                                        <div key={file.fileName} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 transition-colors gap-4 ${autoProcessStatus === file.fileName ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/10'}`}>
                                            <div className="flex items-start gap-4 overflow-hidden">
                                                <div className="mt-1 flex items-center justify-center h-full">
                                                    <Checkbox
                                                        checked={selectedFiles.has(file.fileName)}
                                                        onCheckedChange={() => toggleSelection(file.fileName)}
                                                        disabled={isAutoProcessing || isExtracting !== null}
                                                        className="h-5 w-5 rounded-sm"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => openViewer(`/uploads/${file.fileName}`, file.fileName)}
                                                    className="shrink-0 mt-0.5 hover:scale-105 transition-transform cursor-pointer relative group"
                                                    title="View Document"
                                                >
                                                    <FileIcon id={file.fileName} className="h-9 w-9" />
                                                    <div className="absolute inset-0 bg-primary/20 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <FileText className="h-4 w-4 text-white" />
                                                    </div>
                                                </button>
                                                <div className="min-w-0">
                                                    <button onClick={() => openViewer(`/uploads/${file.fileName}`, file.fileName)} className="font-medium text-sm truncate hover:text-primary hover:underline transition-colors text-left" title={file.fileName}>
                                                        {file.fileName}
                                                    </button>
                                                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                        <span>{formatBytes(file.size)}</span>
                                                        <span className="flex items-center gap-1">
                                                            <CalendarIcon className="h-3 w-3" />
                                                            {new Date(file.createdAt).toLocaleString()}
                                                        </span>
                                                        {file.isDuplicate && (
                                                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-500/50 text-amber-500 bg-amber-500/10 gap-1">
                                                                <AlertTriangle className="h-2.5 w-2.5" />
                                                                DUPLICATE
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {autoProcessStatus === file.fileName ? (
                                                    <Button disabled variant="outline" size="icon" className="bg-primary/20 text-primary border-primary/20">
                                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                    </Button>
                                                ) : isExtracting === file.fileName ? (
                                                    <Button disabled variant="outline" size="icon" className="border-primary/20 bg-primary/10">
                                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        size="icon"
                                                        onClick={() => handleProcess(file.fileName)}
                                                        disabled={isExtracting !== null || isAutoProcessing || isDeleting !== null}
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-900/20"
                                                        title="Process Manually"
                                                    >
                                                        <Play className="h-4 w-4 fill-current" />
                                                    </Button>
                                                )}

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(file.fileName)}
                                                    disabled={isExtracting !== null || isAutoProcessing || isDeleting === file.fileName}
                                                    className="text-red-500 hover:bg-red-500/10 hover:text-red-600 transition-colors"
                                                    title="Delete File"
                                                >
                                                    {isDeleting === file.fileName ? <Loader2 className="h-4 w-4 animate-spin text-red-500" /> : <Trash2 className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Sidebar Dropzone */}
                    <Card className="h-fit">
                        <CardHeader>
                            <CardTitle className="text-base text-primary flex items-center gap-2">
                                <Upload className="h-4 w-4" /> Quick Add
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                You can drop files directly into the <code>public/uploads</code> OS folder, or upload them here.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div
                                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${isDragging ? "border-primary bg-primary/10 scale-[1.02]" : "border-border/60 hover:border-primary/50 hover:bg-muted/50"
                                    } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    multiple
                                />
                                {isUploading ? (
                                    <div className="flex flex-col items-center justify-center space-y-3 py-4">
                                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                        <p className="text-sm font-medium">Uploading to staging...</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center space-y-3 py-4 cursor-pointer">
                                        <div className="bg-background shadow-sm border p-3 rounded-full">
                                            <Upload className="h-6 w-6 text-primary" />
                                        </div>
                                        <p className="text-sm font-medium">Drop files to stage</p>
                                        <p className="text-xs text-muted-foreground">PDF, JPEG, or PNG</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    )
}
