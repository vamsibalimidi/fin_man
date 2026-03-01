"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Database, RefreshCw, Search, Table2 } from "lucide-react"
import { Button } from "@/components/ui/button"

const TABLES = [
    {
        id: "document",
        label: "Document",
        description: "Uploaded files and their categories",
        color: "bg-blue-500/10 text-blue-400 ring-blue-500/20"
    },
    {
        id: "extractedItem",
        label: "ExtractedItem",
        description: "Line items extracted by AI from documents",
        color: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
    },
    {
        id: "documentLink",
        label: "DocumentLink",
        description: "Relationships between documents (e.g. receipt pays bill)",
        color: "bg-purple-500/10 text-purple-400 ring-purple-500/20"
    },
]

export default function DevPage() {
    const [selectedTable, setSelectedTable] = useState<string>("document")
    const [rows, setRows] = useState<any[]>([])
    const [filtered, setFiltered] = useState<any[]>([])
    const [columns, setColumns] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState("")

    const fetchTable = useCallback(async (table: string) => {
        setLoading(true)
        setError(null)
        setSearch("")
        try {
            const res = await fetch(`/api/dev?table=${table}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setRows(data.rows)
            setFiltered(data.rows)
            setColumns(data.columns || [])
        } catch (e: any) {
            setError(e.message)
            setRows([])
            setFiltered([])
            setColumns([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchTable(selectedTable)
    }, [selectedTable, fetchTable])

    useEffect(() => {
        if (!search.trim()) {
            setFiltered(rows)
            return
        }
        const q = search.toLowerCase()
        setFiltered(rows.filter(row =>
            Object.values(row).some(v => String(v).toLowerCase().includes(q))
        ))
    }, [search, rows])

    const tableInfo = TABLES.find(t => t.id === selectedTable)!

    const formatCell = (val: any) => {
        if (val === null || val === undefined) return <span className="text-muted-foreground/40 italic text-xs">null</span>
        if (typeof val === "boolean") return <Badge variant={val ? "default" : "secondary"} className="text-xs">{String(val)}</Badge>
        const str = String(val)
        // Highlight IDs (UUID-like)
        if (/^[0-9a-f-]{36}$/i.test(str)) return <span className="font-mono text-xs text-muted-foreground/70">{str.slice(0, 8)}…</span>
        // Highlight dates
        if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return <span className="font-mono text-xs text-cyan-400">{new Date(str).toLocaleString()}</span>
        // Highlight numbers
        if (!isNaN(Number(str)) && str !== "") return <span className="font-mono text-emerald-400">{str}</span>
        // Long strings get truncated
        if (str.length > 80) return <span title={str} className="truncate max-w-[200px] inline-block text-xs">{str.slice(0, 80)}…</span>
        return <span className="text-xs">{str}</span>
    }

    return (
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/20 p-2 rounded-lg">
                        <Database className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Developer Console</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">Browse raw database tables</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchTable(selectedTable)} disabled={loading} className="gap-2">
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {/* Table selector dropdown */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Table2 className="h-4 w-4" />
                    <span>Table:</span>
                </div>
                <Select value={selectedTable} onValueChange={setSelectedTable}>
                    <SelectTrigger className="w-60 bg-muted/20">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {TABLES.map(t => (
                            <SelectItem key={t.id} value={t.id}>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ring-1 ring-inset font-medium ${t.color}`}>{t.label}</span>
                                    <span className="text-xs text-muted-foreground">{t.description}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Data table */}
            <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-3 bg-muted/30 border-b gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <CardTitle className="text-base font-mono truncate">{tableInfo.label}</CardTitle>
                        <Badge variant="outline" className="font-mono text-xs shrink-0">{filtered.length} rows</Badge>
                    </div>
                    <div className="relative w-full max-w-xs">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Filter rows..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-8 h-8 text-xs bg-background"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="h-48 flex items-center justify-center text-muted-foreground gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Loading...
                        </div>
                    ) : error ? (
                        <div className="h-48 flex items-center justify-center text-destructive text-sm">{error}</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/20">
                                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-8">#</th>
                                        {columns.map(col => (
                                            <th key={col} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={columns.length + 1} className="h-48 text-center text-muted-foreground text-sm">
                                                No rows found.
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map((row, i) => (
                                            <tr key={i} className="border-b border-border/30 hover:bg-primary/5 transition-colors group">
                                                <td className="px-3 py-2 text-xs text-muted-foreground/50 font-mono">{i + 1}</td>
                                                {columns.map(col => (
                                                    <td key={col} className="px-3 py-2 max-w-[220px]">
                                                        {formatCell(row[col])}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Column legend */}
            {columns.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold">Columns:</span>
                    {columns.map(col => (
                        <code key={col} className="bg-muted/40 px-1.5 py-0.5 rounded font-mono">{col}</code>
                    ))}
                </div>
            )}
        </div>
    )
}
