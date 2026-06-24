import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, Users, Store, PackageSearch, 
  UserSquare2, ReceiptText, ShoppingCart, Package, 
  CreditCard, MessageSquare, Settings, LogOut,
  Menu
} from "lucide-react";
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

const navItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Platform Users", href: "/users", icon: Users },
  { title: "Shops", href: "/shops", icon: Store },
  { title: "Products", href: "/products", icon: PackageSearch },
  { title: "Attendants", href: "/attendants", icon: UserSquare2 },
  { title: "Sales", href: "/sales", icon: ReceiptText },
  { title: "Purchases", href: "/purchases", icon: ShoppingCart },
  { title: "Packages", href: "/packages", icon: Package },
  { title: "Subscriptions", href: "/subscriptions", icon: CreditCard },
  { title: "SMS Hub", href: "/sms", icon: MessageSquare },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function Shell({ children }: { children: ReactNode }) {
  const { logout, userdata } = useAuth();
  const [location] = useLocation();

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
                      <SidebarMenuButton asChild isActive={location === item.href || (item.href !== "/" && location.startsWith(item.href))}>
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
          <header className="flex h-16 items-center gap-4 border-b bg-background px-6 shadow-sm">
            <SidebarTrigger className="-ml-2 text-muted-foreground hover:text-foreground" />
            <div className="flex-1" />
            {/* Additional header items could go here */}
          </header>
          
          <main className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
