import { useGetSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

function humanize(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!spaced) return key;
  return spaced
    .split(" ")
    .map((w) =>
      w.length <= 3 && w === w.toUpperCase()
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function PrimitiveValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground italic">Not set</span>;
  }
  if (typeof value === "boolean") {
    return (
      <Badge variant={value ? "default" : "secondary"}>
        {value ? "Enabled" : "Disabled"}
      </Badge>
    );
  }
  const str = String(value);
  if (typeof value === "string" && isUrl(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 break-all"
      >
        {str}
      </a>
    );
  }
  return <span className="break-words">{str}</span>;
}

function ValueRenderer({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground italic">None</span>;
    }
    const allPrimitive = value.every(
      (v) => !isPlainObject(v) && !Array.isArray(v),
    );
    if (allPrimitive) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <Badge key={i} variant="outline">
              {String(v)}
            </Badge>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {value.map((v, i) => (
          <div
            key={i}
            className="rounded-md border bg-muted/30 p-3"
          >
            <ValueRenderer value={v} />
          </div>
        ))}
      </div>
    );
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span className="text-muted-foreground italic">Empty</span>;
    }
    return (
      <dl className="divide-y">
        {entries.map(([k, v]) => {
          const nested = isPlainObject(v) || Array.isArray(v);
          return (
            <div
              key={k}
              className={
                nested
                  ? "py-3 space-y-2"
                  : "py-3 grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-4"
              }
            >
              <dt className="text-sm font-medium text-foreground">
                {humanize(k)}
              </dt>
              <dd className="text-sm text-muted-foreground sm:col-span-2">
                <ValueRenderer value={v} />
              </dd>
            </div>
          );
        })}
      </dl>
    );
  }

  return <PrimitiveValue value={value} />;
}

export default function Settings() {
  const { data, isLoading, isError } = useGetSettings({});

  const groups = isPlainObject(data) ? Object.entries(data) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Global platform settings.</p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-10">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Couldn't load settings</EmptyTitle>
                <EmptyDescription>
                  Something went wrong fetching the platform settings. Please try
                  again.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No settings configured</EmptyTitle>
                <EmptyDescription>
                  There are no global platform settings to display yet.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={groups[0]?.[0]} className="space-y-6">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            {groups.map(([name]) => (
              <TabsTrigger key={name} value={name}>
                {humanize(name)}
              </TabsTrigger>
            ))}
          </TabsList>
          {groups.map(([name, value]) => (
            <TabsContent key={name} value={name} className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>{humanize(name)}</CardTitle>
                </CardHeader>
                <CardContent>
                  {isPlainObject(value) || Array.isArray(value) ? (
                    <ValueRenderer value={value} />
                  ) : (
                    <div className="text-sm">
                      <PrimitiveValue value={value} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
