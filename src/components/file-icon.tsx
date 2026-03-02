"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface FileIconProps {
    id: string
    className?: string
}

/**
 * FileIcon - Generates a stable visual "fingerprint" (gradient) for a file.
 * This helps users identify identical files visually rather than just by name.
 */
export function FileIcon({ id, className }: FileIconProps) {
    // Simple deterministic hash for the string
    const getHash = (str: string) => {
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash)
        }
        return Math.abs(hash)
    }

    const hash = getHash(id)

    // Curated premium color palettes (HSL for harmony)
    const palettes = [
        ["hsl(210, 100%, 50%)", "hsl(280, 100%, 50%)"], // Blue to Purple
        ["hsl(150, 100%, 40%)", "hsl(200, 100%, 50%)"], // Emerald to Sky
        ["hsl(330, 100%, 50%)", "hsl(10, 100%, 60%)"],  // Pink to Orange
        ["hsl(180, 100%, 35%)", "hsl(140, 100%, 45%)"], // Teal to Green
        ["hsl(260, 100%, 60%)", "hsl(300, 100%, 50%)"], // Violet to Fuchsia
        ["hsl(45, 100%, 50%)", "hsl(15, 100%, 50%)"],   // Gold to Rust
    ]

    const palette = palettes[hash % palettes.length]
    const angle = (hash % 8) * 45 // 0, 45, 90, etc.

    return (
        <div
            className={cn("w-8 h-8 rounded-md shadow-sm border border-white/10 shrink-0 flex items-center justify-center overflow-hidden", className)}
            style={{
                background: `linear-gradient(${angle}deg, ${palette[0]}, ${palette[1]})`
            }}
        >
            <div className="text-[10px] font-bold text-white/40 select-none">
                {id.slice(-2).toUpperCase()}
            </div>
        </div>
    )
}
