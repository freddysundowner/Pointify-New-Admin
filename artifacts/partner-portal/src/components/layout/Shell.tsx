import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Store,
  Users,
  Target,
  ArrowRightLeft,
  Banknote,
  UserCircle,
  Handshake,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useGetPortalProfile } from "@workspace/api-client-react";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Target },
  { href: "/users", label: "Referred Users", icon: Users },
  { href: "/shops", label: "Referred Shops", icon: Store },
  { href: "/team", label: "My Partners", icon: Handshake, masterOnly: true },
  { href: "/transactions", label: "Transactions", icon: ArrowRightLeft },
  { href: "/withdraw", label: "Withdraw", icon: Banknote },
  { href: "/profile", label: "My Profile", icon: UserCircle },
];

// Primary destinations shown in the mobile bottom tab bar (short labels).
const BOTTOM_NAV = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Target },
  { href: "/shops", label: "Shops", icon: Store },
  { href: "/users", label: "Users", icon: Users },
  { href: "/team", label: "Partners", icon: Handshake, masterOnly: true },
  { href: "/transactions", label: "Activity", icon: ArrowRightLeft },
  { href: "/withdraw", label: "Withdraw", icon: Banknote },
];

export function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { logout, userdata } = useAuth();
  // Sub-partners (accounts with a parent) don't manage their own sub-partners,
  // so hide the "My Partners" destination for them.
  const { data: profile } = useGetPortalProfile();
  const isSubPartner = Boolean(profile?.parent);
  const navLinks = NAV_LINKS.filter((l) => !(l.masterOnly && isSubPartner));
  const bottomNav = BOTTOM_NAV.filter((l) => !(l.masterOnly && isSubPartner));

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
          {navLinks.map((link) => {
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

      {/* Mobile App Shell & Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top app bar */}
        <header
          className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex items-center gap-2 font-bold text-lg text-primary">
            <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-sm">P</div>
            Pointify
          </div>
          <Link
            href="/profile"
            aria-label="My Profile"
            aria-current={location === "/profile" ? "page" : undefined}
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full font-bold uppercase transition-colors ${
                location === "/profile"
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {userdata?.email?.[0] || "U"}
            </div>
          </Link>
        </header>

        <main className="flex-1 overflow-auto p-4 pb-24 md:p-8 md:pb-8">
          <div className="w-full">
            {children}
          </div>
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className={bottomNav.length === 7 ? "grid grid-cols-7" : "grid grid-cols-6"}>
            {bottomNav.map((link) => {
              const Icon = link.icon;
              const isActive = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                >
                  <div
                    className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${
                        isActive ? "bg-primary/10" : "bg-transparent"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </span>
                    {link.label}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
