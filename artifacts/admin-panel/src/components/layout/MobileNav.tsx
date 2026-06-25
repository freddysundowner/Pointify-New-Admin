import { useState } from "react";
import { Link, useLocation } from "wouter";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { navItems, isNavActive, primaryMobileHrefs } from "./nav-items";

export function MobileNav() {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = primaryMobileHrefs
    .map((href) => navItems.find((n) => n.href === href))
    .filter((n): n is (typeof navItems)[number] => Boolean(n));

  const moreActive = !primary.some((item) => isNavActive(location, item.href));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid h-16 grid-cols-5">
          {primary.map((item) => {
            const active = isNavActive(location, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:scale-95",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className={cn("h-[22px] w-[22px]", active && "stroke-[2.5]")} />
                <span className="leading-none">{item.title === "Platform Users" ? "Users" : item.title}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More sections"
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:scale-95",
              moreActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <MoreHorizontal className="h-[22px] w-[22px]" />
            <span className="leading-none">More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        >
          <SheetHeader className="text-left">
            <SheetTitle>All sections</SheetTitle>
          </SheetHeader>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {navItems.map((item) => {
              const active = isNavActive(location, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center text-xs font-medium transition-colors active:scale-95",
                    active
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:bg-muted",
                  )}
                >
                  <item.icon className="h-6 w-6" />
                  <span className="leading-tight">{item.title}</span>
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
