import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, FileText, Activity } from "lucide-react"
import Link from "next/link"
import { NukeButton } from "@/components/nuke-button"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic";

/**
 * Home (Dashboard)
 * 
 * This is a Next.js Server Component (hence `async`). It fetches the top-level
 * metrics directly from Prisma on load without needing a client-side `useEffect`.
 * 
 * It renders the visual entry point for the application.
 */
export default async function Home() {
  const totalDocuments = await prisma.document.count()
  const extractedItems = await prisma.extractedItem.count()

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome to DocTracker. Here is an overview of your financial documents.
          </p>
        </div>
        <NukeButton />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Link href="/documents" className="block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl h-full">
          <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-1 bg-background/50 backdrop-blur-sm border-border/50 cursor-pointer h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-secondary-foreground group-hover:text-foreground transition-colors">Total Documents</CardTitle>
              <div className="p-2 bg-secondary rounded-md group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                <FileText className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold tracking-tight text-foreground drop-shadow-md">{totalDocuments}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalDocuments === 0 ? "Awaiting your first upload" : "Documents processed"}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/search" className="block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl h-full">
          <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-1 bg-background/50 backdrop-blur-sm border-border/50 cursor-pointer h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-secondary-foreground group-hover:text-foreground transition-colors">Extracted Items</CardTitle>
              <div className="p-2 bg-secondary rounded-md group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                <Activity className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold tracking-tight text-foreground drop-shadow-md">{extractedItems}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Transactions & line items found
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/unprocessed" className="block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl h-full">
          <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/40 hover:-translate-y-1 border-primary/50 bg-primary/10 cursor-pointer h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-primary drop-shadow-[0_0_8px_rgba(253,224,71,0.5)]">Upload New</CardTitle>
              <div className="p-2 bg-primary/20 rounded-md text-primary group-hover:scale-110 transition-transform">
                <Upload className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-lg font-medium tracking-tight mt-1 text-primary-foreground drop-shadow-sm">
                Ready to process
              </div>
              <p className="text-xs text-primary/80 mt-1">
                Click to navigate to uploader
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Your most recently processed documents will appear here.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-[300px] flex items-center justify-center text-muted-foreground border-t">
            No recent activity
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Document Graph</CardTitle>
            <CardDescription>
              Connections found between your documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-[300px] flex items-center justify-center text-muted-foreground border-t">
            Not enough data to build graph
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
