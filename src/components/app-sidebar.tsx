"use client";

import {
    FileText,
    Home,
    Link as LinkIcon,
    Search,
    Settings,
    Upload,
    Receipt,
    ChevronRight,
    Stethoscope,
    FileStack,
    Terminal,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "./mode-toggle";

const topNavItems = [
    { name: "Dashboard", href: "/", icon: Home },
    { name: "Unprocessed", href: "/unprocessed", icon: Upload },
    { name: "Documents", href: "/documents", icon: FileText },
];

const bottomNavItems = [
    { name: "Search & Grid", href: "/search", icon: Search },
    { name: "Linked Graph", href: "/graph", icon: LinkIcon },
    { name: "Developer", href: "/dev", icon: Terminal },
];

const billSubItems = [
    { name: "All Bills", href: "/bills", icon: FileStack },
    { name: "Medical", href: "/bills?type=Medical", icon: Stethoscope },
    { name: "Regular", href: "/bills?type=Regular", icon: Receipt },
];

export function AppSidebarContent() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [billsOpen, setBillsOpen] = useState(
        pathname === "/bills"
    );

    const isBillsActive = pathname === "/bills" || pathname.startsWith("/bills?");
    const activeType = searchParams.get("type");

    const isSubItemActive = (href: string) => {
        if (href === "/bills") return pathname === "/bills" && !activeType;
        const [, query] = href.split("?");
        const param = new URLSearchParams(query);
        return pathname === "/bills" && activeType === param.get("type");
    };

    const menuButtonClass = "hover:bg-primary/10 hover:text-primary transition-colors data-[active=true]:bg-primary/20 data-[active=true]:text-primary data-[active=true]:drop-shadow-[0_0_4px_rgba(253,224,71,0.3)]";

    return (
        <Sidebar>
            <SidebarHeader className="p-4 bg-background/50 backdrop-blur-md border-b border-border/50">
                <div className="flex items-center gap-2 font-semibold text-lg hover:opacity-80 transition-opacity cursor-default">
                    <div className="bg-primary/20 p-1.5 rounded-lg drop-shadow-[0_0_8px_rgba(253,224,71,0.5)]">
                        <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-yellow-200 drop-shadow-sm">DocTracker</span>
                </div>
            </SidebarHeader>
            <SidebarContent className="pt-2">
                <SidebarGroup>
                    <SidebarGroupLabel className="text-muted-foreground/80">Menu</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {/* Top nav items */}
                            {topNavItems.map((item) => (
                                <SidebarMenuItem key={item.name}>
                                    <SidebarMenuButton asChild isActive={pathname === item.href} className={menuButtonClass}>
                                        <Link href={item.href}>
                                            <item.icon className="h-4 w-4" />
                                            <span>{item.name}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}

                            {/* Bills — collapsible tree */}
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    isActive={isBillsActive}
                                    className={`${menuButtonClass} w-full`}
                                    onClick={() => setBillsOpen((o) => !o)}
                                >
                                    <Receipt className="h-4 w-4" />
                                    <span>Bills</span>
                                    <ChevronRight
                                        className={`ml-auto h-4 w-4 text-muted-foreground transition-transform duration-200 ${billsOpen ? "rotate-90" : ""}`}
                                    />
                                </SidebarMenuButton>

                                {billsOpen && (
                                    <SidebarMenuSub>
                                        {billSubItems.map((sub) => (
                                            <SidebarMenuSubItem key={sub.name}>
                                                <SidebarMenuSubButton
                                                    asChild
                                                    isActive={isSubItemActive(sub.href)}
                                                    className="hover:bg-primary/10 hover:text-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary transition-colors"
                                                >
                                                    <Link href={sub.href}>
                                                        <sub.icon className="h-3.5 w-3.5" />
                                                        <span>{sub.name}</span>
                                                    </Link>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                        ))}
                                    </SidebarMenuSub>
                                )}
                            </SidebarMenuItem>

                            {/* Bottom nav items */}
                            {bottomNavItems.map((item) => (
                                <SidebarMenuItem key={item.name}>
                                    <SidebarMenuButton asChild isActive={pathname === item.href} className={menuButtonClass}>
                                        <Link href={item.href}>
                                            <item.icon className="h-4 w-4" />
                                            <span>{item.name}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="p-4 flex flex-row items-center justify-between border-t border-border/50">
                <ModeToggle />
                <Button variant="ghost" size="icon">
                    <Settings className="h-4 w-4" />
                </Button>
            </SidebarFooter>
        </Sidebar>
    );
}

import { Suspense } from "react";

export function AppSidebar() {
    return (
        <Suspense fallback={
            <Sidebar>
                <div className="p-4 flex items-center justify-center h-full text-muted-foreground">Loading navigation...</div>
            </Sidebar>
        }>
            <AppSidebarContent />
        </Suspense>
    )
}
