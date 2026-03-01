"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, File, X, Loader2, CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExtractionReview } from "./extraction-review"

export function FileUploader() {
    const [file, setFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadComplete, setUploadComplete] = useState(false)

    // State for the extraction review
    const [reviewData, setReviewData] = useState<any>(null)
    const [fileMeta, setFileMeta] = useState<any>(null)

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0])
            setUploadComplete(false)
        }
    }, [])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "image/*": [".jpeg", ".jpg", ".png"],
            "application/pdf": [".pdf"],
        },
        maxFiles: 1,
    })

    const removeFile = (e: React.MouseEvent) => {
        e.stopPropagation()
        setFile(null)
        setUploadComplete(false)
    }

    const handleUpload = async () => {
        if (!file) return

        setIsUploading(true)

        try {
            const formData = new FormData()
            formData.append("file", file)

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            })

            if (!response.ok) {
                throw new Error("Upload failed")
            }

            const data = await response.json()
            console.log("Success:", data)

            // Switch to Extraction Review mode instead of completing upload
            if (data.extractedData && data.fileMeta) {
                setReviewData(data.extractedData)
                setFileMeta(data.fileMeta)
            } else {
                setUploadComplete(true)
                setTimeout(() => {
                    setFile(null)
                    setUploadComplete(false)
                }, 3000)
            }
        } catch (error) {
            console.error("Error uploading file:", error)
            // Add toast notification here eventually
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <div className="w-full max-w-2xl mx-auto space-y-4">
            <div
                {...getRootProps()}
                className={`group relative overflow-hidden border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300
          ${isDragActive
                        ? "border-primary bg-primary/10 scale-[1.02] shadow-[0_0_30px_rgba(253,224,71,0.15)]"
                        : "border-primary/20 hover:border-primary/50 hover:bg-muted/30 hover:shadow-lg hover:shadow-[0_0_20px_rgba(253,224,71,0.05)] bg-background/50 backdrop-blur-sm"
                    }
        `}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center space-y-4 text-muted-foreground relative z-10">
                    <div className={`p-4 rounded-full shadow-sm ring-1 ring-border/50 transition-all duration-300 ${isDragActive ? 'bg-primary text-primary-foreground scale-110 shadow-[0_0_15px_rgba(253,224,71,0.4)]' : 'bg-background text-primary group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(253,224,71,0.5)]'}`}>
                        <Upload className="h-8 w-8" />
                    </div>
                    {isDragActive ? (
                        <p className="font-medium text-foreground text-lg animate-pulse drop-shadow-[0_0_4px_rgba(253,224,71,0.5)]">Drop the file here...</p>
                    ) : (
                        <div className="space-y-1">
                            <p className="font-medium text-foreground text-lg">
                                Drag & drop a file here, or click to select
                            </p>
                            <p className="text-sm text-primary/70">Supports PDF, JPG, PNG up to 10MB</p>
                        </div>
                    )}
                </div>
            </div>

            {file && (
                <Card className="overflow-hidden bg-muted/30">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-4 overflow-hidden">
                            <div className="bg-background p-2 rounded-md shrink-0">
                                <File className="h-6 w-6 text-primary" />
                            </div>
                            <div className="truncate">
                                <p className="text-sm font-medium truncate">{file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                            {uploadComplete ? (
                                <span className="flex items-center text-sm font-medium text-green-600 dark:text-green-500">
                                    <CheckCircle2 className="mr-1 h-4 w-4" /> Done
                                </span>
                            ) : (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleUpload}
                                        disabled={isUploading}
                                    >
                                        {isUploading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            "Upload & Extract"
                                        )}
                                    </Button>
                                    {!isUploading && (
                                        <Button variant="ghost" size="icon" onClick={removeFile}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Render the Review Component when data is available */}
            {reviewData && fileMeta && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <ExtractionReview
                        initialData={reviewData}
                        fileMeta={fileMeta}
                        onCommitSuccess={() => {
                            setReviewData(null)
                            setFileMeta(null)
                            setFile(null)
                            setUploadComplete(true)
                            setTimeout(() => setUploadComplete(false), 3000)
                        }}
                        onCancel={() => {
                            setReviewData(null)
                            setFileMeta(null)
                        }}
                    />
                </div>
            )}
        </div>
    )
}
