import { useEffect, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMobileHeader } from "@/lib/mobile-header";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
};

export function PageHeader({ title, description, actions, backHref }: PageHeaderProps) {
  const { setHeader } = useMobileHeader();

  useEffect(() => {
    setHeader({ title, backHref });
    return () => setHeader(null);
  }, [title, backHref, setHeader]);

  return (
    <div className="flex items-start justify-between gap-4">
      {/* On mobile the title + back button live in the top app bar (native style). */}
      <div className="hidden items-center gap-3 md:flex">
        {backHref && (
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
        )}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 [&>button]:flex-1 md:w-auto md:flex-shrink-0 md:[&>button]:flex-none">
          {actions}
        </div>
      )}
    </div>
  );
}
