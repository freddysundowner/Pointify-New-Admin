import { ReactNode, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AccountDialog } from "@/components/AccountDialog";
import { Link, useLocation } from "wouter";
import { Store, LogOut, UserCog, ArrowLeft } from "lucide-react";
import { navItems, isNavActive } from "./nav-items";
import { MobileNav } from "./MobileNav";
import { useMobileHeader } from "@/lib/mobile-header";
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
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Shell({ children }: { children: ReactNode }) {
  const { logout, userdata } = useAuth();
  const [location, navigate] = useLocation();
  const { header } = useMobileHeader();
  const [accountOpen, setAccountOpen] = useState(false);

  const isDashboard = location === "/";
  const goBack = () => {
    if (header?.backHref) {
      navigate(header.backHref);
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate("/");
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "A";
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/40">
        <Sidebar collapsible="icon">
          <SidebarHeader className="flex h-16 items-center border-b border-sidebar-border px-4 py-0">
            <div className="flex items-center gap-2 font-bold text-sidebar-primary-foreground tracking-tight">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Store className="h-5 w-5" />
              </div>
              <span className="text-lg group-data-[collapsible=icon]:hidden">Pointify Admin</span>
            </div>
          </SidebarHeader>
          
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Platform Control</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isNavActive(location, item.href)}>
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border border">
                          {getInitials(userdata?.username || userdata?.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold text-sidebar-foreground">{userdata?.username || "Admin"}</span>
                        <span className="truncate text-xs text-sidebar-foreground/60">{userdata?.email}</span>
                      </div>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" side="right" sideOffset={4}>
                    <DropdownMenuLabel className="p-0 font-normal">
                      <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                        <Avatar className="h-8 w-8 rounded-lg">
                          <AvatarFallback className="rounded-lg">{getInitials(userdata?.username || userdata?.email)}</AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                          <span className="truncate font-semibold">{userdata?.username || "Admin"}</span>
                          <span className="truncate text-xs text-muted-foreground">{userdata?.email}</span>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setAccountOpen(true)} className="cursor-pointer">
                      <UserCog className="mr-2 h-4 w-4" />
                      My account
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-destructive focus:bg-destructive/10 cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-1 flex-col overflow-hidden">
          <header
            className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b bg-background px-4 shadow-sm md:min-h-16 md:px-6"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            {/* Desktop: collapse/expand the sidebar. Hidden on mobile (bottom nav replaces it). */}
            <SidebarTrigger className="-ml-1 hidden text-muted-foreground hover:text-foreground md:flex" />
            {/* Mobile app bar: brand on the dashboard, back + page title elsewhere (native style). */}
            {isDashboard ? (
              <div className="flex items-center gap-2 font-bold tracking-tight md:hidden">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Store className="h-5 w-5" />
                </div>
                <span className="text-base">Pointify Admin</span>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-1 md:hidden">
                <button
                  type="button"
                  onClick={goBack}
                  aria-label="Go back"
                  className="-ml-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <span className="truncate text-lg font-semibold tracking-tight">
                  {header?.title ?? ""}
                </span>
              </div>
            )}
            <div className="flex-1" />
            {/* Mobile account menu (the sidebar footer is hidden on mobile) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="md:hidden">
                <button type="button" aria-label="Open account menu" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {getInitials(userdata?.username || userdata?.email)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">{getInitials(userdata?.username || userdata?.email)}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{userdata?.username || "Admin"}</span>
                      <span className="truncate text-xs text-muted-foreground">{userdata?.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setAccountOpen(true)} className="cursor-pointer">
                  <UserCog className="mr-2 h-4 w-4" />
                  My account
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:bg-destructive/10 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6">
            {children}
          </main>
        </div>

        <MobileNav />
      </div>
      <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
    </SidebarProvider>
  );
}
