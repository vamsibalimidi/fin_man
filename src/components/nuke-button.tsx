"use client"

import { useState } from "react"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function NukeButton() {
    const [isDeleting, setIsDeleting] = useState(false)
    const router = useRouter()

    const handleNuke = async () => {
        setIsDeleting(true)
        try {
            const res = await fetch("/api/nuke", {
                method: "DELETE",
            })
            if (!res.ok) throw new Error("Failed to nuke")

            // Reload page to reflect empty state
            router.refresh()
            window.location.reload()
        } catch (error) {
            console.error(error)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2 border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive hover:text-white transition-all duration-300">
                    <Trash2 className="h-4 w-4" />
                    Nuke All Data
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-destructive/50">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        Are you completely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete
                        <strong> ALL</strong> documents, extracted items, tracked transactions,
                        and remove all physical files from the local server directory.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault()
                            handleNuke()
                        }}
                        disabled={isDeleting}
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Nuking...
                            </>
                        ) : (
                            "Yes, delete everything"
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
