import { type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

type FilterBarProps = {
  children: ReactNode;
  /** Layout classes for the inline (desktop) filter row. */
  className?: string;
  /** When true, the mobile "Filters" button shows an active indicator. */
  active?: boolean;
  /** Title shown at the top of the mobile filter sheet. */
  title?: string;
};

export function FilterBar({
  children,
  className,
  active = false,
  title = "Filters",
}: FilterBarProps) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className="pb-4">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="w-full justify-start">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filters
            {active && (
              <span className="ml-2 h-2 w-2 rounded-full bg-primary" aria-hidden />
            )}
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl"
        >
          <SheetHeader className="text-left">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div
            className="mt-4 flex flex-col gap-4"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {children}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
