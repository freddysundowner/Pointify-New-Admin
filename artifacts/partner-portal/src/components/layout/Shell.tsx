import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Store, 
  Users, 
  ArrowRightLeft, 
  Banknote, 
  UserCircle,
  LogOut,
  Menu
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Referred Users", icon: Users },
  { href: "/shops", label: "Referred Shops", icon: Store },
  { href: "/transactions", label: "Transactions", icon: ArrowRightLeft },
  { href: "/withdraw", label: "Withdraw", icon: Banknote },
  { href: "/profile", label: "My Profile", icon: UserCircle },
];

export function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { logout, userdata } = useAuth();

  const NavItems = () => (
    <>
      {NAV_LINKS.map((link) => {
        const Icon = link.icon;
        const isActive = location === link.href;
        return (
          <Link key={link.href} href={link.href}>
            <div
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{link.label}</span>
            </div>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-sidebar">
        <div className="h-14 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2 font-bold text-lg text-sidebar-primary">
            <div className="w-6 h-6 rounded-md bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center text-xs">P</div>
            Pointify Partners
          </div>
        </div>
        <div className="flex-1 overflow-auto py-4 px-3 space-y-1">
          <NavItems />
        </div>
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold uppercase">
              {userdata?.email?.[0] || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{userdata?.email}</p>
              <p className="text-xs text-muted-foreground truncate">Wallet: KES {userdata?.wallet || 0}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start gap-2" onClick={logout}>
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Header & Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center justify-between md:justify-end px-4 border-b bg-card">
          <div className="md:hidden flex items-center gap-2 font-bold text-lg text-primary">
            <div className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs">P</div>
            Pointify
          </div>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 flex flex-col">
              <div className="h-14 flex items-center px-6 border-b">
                <span className="font-bold text-lg">Menu</span>
              </div>
              <div className="flex-1 overflow-auto py-4 px-3 space-y-1">
                <NavItems />
              </div>
              <div className="p-4 border-t">
                <Button variant="outline" className="w-full justify-start gap-2" onClick={logout}>
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
