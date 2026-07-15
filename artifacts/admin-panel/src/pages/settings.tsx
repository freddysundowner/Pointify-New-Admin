import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSettings,
  useSaveSettings,
  getGetSettingsQueryKey,
  useGetWhatsNew,
  useSaveWhatsNew,
  getGetWhatsNewQueryKey,
  type SettingsInput,
  type WhatsNewEntry,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Plus, X, Trash2, ExternalLink, Sparkles } from "lucide-react";

function WhatsNewSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetWhatsNew();
  const saveMutation = useSaveWhatsNew();

  const [editing, setEditing] = useState(false);
  const [draftEntries, setDraftEntries] = useState<WhatsNewEntry[]>([]);

  const entries = data?.entries ?? [];

  const startEditing = () => {
    setDraftEntries(entries.map((e) => ({ ...e })));
    setEditing(true);
  };

  const updateEntry = (i: number, patch: Partial<WhatsNewEntry>) => {
    setDraftEntries((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    );
  };

  const save = () => {
    const cleaned = draftEntries
      .map((e) => ({
        title: e.title.trim(),
        body: e.body?.trim() || undefined,
        date: e.date?.trim() || undefined,
      }))
      .filter((e) => e.title.length > 0);
    saveMutation.mutate(
      { data: { entries: cleaned } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetWhatsNewQueryKey() });
          toast({ title: "What's New updated" });
          setEditing(false);
        },
        onError: (err: unknown) => {
          const msg =
            (err as { data?: { message?: string } } | undefined)?.data
              ?.message ?? "Please try again.";
          toast({
            title: "Save failed",
            description: msg,
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Card className="page-card">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            See What&apos;s New
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            What people see when they click &ldquo;See What&apos;s New&rdquo; in
            your emails. Public page:{" "}
            <a
              href="/whats-new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
            >
              /whats-new <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={saveMutation.isPending}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={startEditing}
            disabled={isLoading}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : editing ? (
          <>
            {draftEntries.map((entry, i) => (
              <div
                key={i}
                className="space-y-2 rounded-lg border p-4"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Update title (e.g. New sales report)"
                      value={entry.title}
                      onChange={(e) => updateEntry(i, { title: e.target.value })}
                    />
                    <Input
                      placeholder="Date shown to readers (e.g. July 2026) — optional"
                      value={entry.date ?? ""}
                      onChange={(e) => updateEntry(i, { date: e.target.value })}
                    />
                    <Textarea
                      rows={3}
                      placeholder="Describe the update in a friendly way — optional"
                      value={entry.body ?? ""}
                      onChange={(e) => updateEntry(i, { body: e.target.value })}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() =>
                      setDraftEntries((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setDraftEntries((prev) => [
                  { title: "", body: "", date: "" },
                  ...prev,
                ])
              }
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add update
            </Button>
          </>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No updates published yet. Click Edit to add your first one — it will
            appear on the public What&apos;s New page.
          </p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, i) => (
              <div key={i} className="rounded-lg border p-4">
                {entry.date ? (
                  <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {entry.date}
                  </div>
                ) : null}
                <div className="font-medium">{entry.title}</div>
                {entry.body ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {entry.body}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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

type Path = (string | number)[];

function setIn(root: unknown, path: Path, value: unknown): unknown {
  if (path.length === 0) return value;
  const [key, ...rest] = path;
  if (typeof key === "number") {
    const arr = Array.isArray(root) ? root.slice() : [];
    arr[key] = setIn(arr[key], rest, value);
    return arr;
  }
  const obj = isPlainObject(root) ? { ...root } : {};
  obj[key] = setIn(obj[key], rest, value);
  return obj;
}

function removeAtIndex<T>(arr: T[], index: number): T[] {
  const copy = arr.slice();
  copy.splice(index, 1);
  return copy;
}

type NewFieldType = "text" | "number" | "boolean" | "object" | "list";

function valueForType(type: NewFieldType): unknown {
  switch (type) {
    case "number":
      return 0;
    case "boolean":
      return false;
    case "object":
      return {};
    case "list":
      return [];
    default:
      return "";
  }
}

function emptyLike(sample: unknown): unknown {
  if (typeof sample === "boolean") return false;
  if (typeof sample === "number") return 0;
  if (Array.isArray(sample)) return [];
  if (isPlainObject(sample)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(sample)) out[k] = emptyLike(v);
    return out;
  }
  return "";
}

function PrimitiveField({
  value,
  path,
  onChange,
}: {
  value: string | number | boolean | null;
  path: Path;
  onChange: (path: Path, value: unknown) => void;
}) {
  if (typeof value === "boolean") {
    return (
      <Switch
        checked={value}
        onCheckedChange={(checked) => onChange(path, checked)}
      />
    );
  }
  if (typeof value === "number") {
    return (
      <Input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(path, raw === "" ? 0 : Number(raw));
        }}
      />
    );
  }
  const str = value == null ? "" : String(value);
  if (str.length > 60) {
    return (
      <Textarea
        value={str}
        rows={3}
        onChange={(e) => onChange(path, e.target.value)}
      />
    );
  }
  return (
    <Input value={str} onChange={(e) => onChange(path, e.target.value)} />
  );
}

function AddFieldRow({ onAdd }: { onAdd: (key: string, value: unknown) => void }) {
  const [key, setKey] = useState("");
  const [type, setType] = useState<NewFieldType>("text");
  const submit = () => {
    const k = key.trim();
    if (!k) return;
    onAdd(k, valueForType(type));
    setKey("");
    setType("text");
  };
  return (
    <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center">
      <Input
        placeholder="New field name"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        className="sm:max-w-[220px]"
      />
      <Select value={type} onValueChange={(v) => setType(v as NewFieldType)}>
        <SelectTrigger className="sm:w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="text">Text</SelectItem>
          <SelectItem value="number">Number</SelectItem>
          <SelectItem value="boolean">On / Off</SelectItem>
          <SelectItem value="object">Group</SelectItem>
          <SelectItem value="list">List</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={submit}
        disabled={!key.trim()}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add field
      </Button>
    </div>
  );
}

function ObjectEditor({
  value,
  path,
  onChange,
}: {
  value: Record<string, unknown>;
  path: Path;
  onChange: (path: Path, value: unknown) => void;
}) {
  const entries = Object.entries(value);
  const addField = (key: string, fieldValue: unknown) => {
    if (key in value) return;
    onChange(path, { ...value, [key]: fieldValue });
  };
  const removeField = (key: string) => {
    const copy = { ...value };
    delete copy[key];
    onChange(path, copy);
  };
  return (
    <div className="space-y-4">
      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No fields yet.</p>
      )}
      {entries.map(([k, v]) => {
        const nested = isPlainObject(v) || Array.isArray(v);
        return (
          <div
            key={k}
            className={
              nested
                ? "space-y-2"
                : "grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:items-center sm:gap-4"
            }
          >
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-foreground">
                {humanize(k)}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => removeField(k)}
                aria-label={`Remove ${k}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className={nested ? "" : "sm:col-span-2"}>
              <FieldEditor value={v} path={[...path, k]} onChange={onChange} />
            </div>
          </div>
        );
      })}
      <AddFieldRow onAdd={addField} />
    </div>
  );
}

function ArrayEditor({
  value,
  path,
  onChange,
}: {
  value: unknown[];
  path: Path;
  onChange: (path: Path, value: unknown) => void;
}) {
  const allPrimitive = value.every(
    (v) => !isPlainObject(v) && !Array.isArray(v),
  );
  const sample = value.length > 0 ? value[0] : "";
  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No items.</p>
      )}
      {value.map((item, i) =>
        allPrimitive ? (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-1">
              <PrimitiveField
                value={item as string | number | boolean | null}
                path={[...path, i]}
                onChange={onChange}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange(path, removeAtIndex(value, i))}
              aria-label="Remove item"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div key={i} className="rounded-md border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Item {i + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onChange(path, removeAtIndex(value, i))}
                aria-label="Remove item"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <FieldEditor value={item} path={[...path, i]} onChange={onChange} />
          </div>
        ),
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange(path, [...value, emptyLike(sample)])}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add item
      </Button>
    </div>
  );
}

function FieldEditor({
  value,
  path,
  onChange,
}: {
  value: unknown;
  path: Path;
  onChange: (path: Path, value: unknown) => void;
}) {
  if (Array.isArray(value)) {
    return <ArrayEditor value={value} path={path} onChange={onChange} />;
  }
  if (isPlainObject(value)) {
    return <ObjectEditor value={value} path={path} onChange={onChange} />;
  }
  return (
    <PrimitiveField
      value={value as string | number | boolean | null}
      path={path}
      onChange={onChange}
    />
  );
}

export default function Settings() {
  const { data, isLoading, isError } = useGetSettings({});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const saveMutation = useSaveSettings();

  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [isNewSection, setIsNewSection] = useState(false);
  const [draft, setDraft] = useState<unknown>(null);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");

  const groups = isPlainObject(data) ? Object.entries(data) : [];
  const displayGroups: [string, unknown][] =
    isNewSection && editingGroup
      ? [...groups, [editingGroup, draft]]
      : groups;
  const currentTab =
    activeTab && displayGroups.some(([n]) => n === activeTab)
      ? activeTab
      : displayGroups[0]?.[0];

  const toJson = (value: unknown) => JSON.stringify(value ?? null, null, 2);

  const startEdit = (name: string, value: unknown) => {
    const cloned =
      typeof structuredClone === "function"
        ? structuredClone(value)
        : JSON.parse(JSON.stringify(value ?? null));
    setEditingGroup(name);
    setIsNewSection(false);
    setDraft(cloned);
    setJsonMode(false);
    setJsonText(toJson(cloned));
    setJsonError(null);
  };

  const resetEdit = () => {
    setEditingGroup(null);
    setIsNewSection(false);
    setDraft(null);
    setJsonMode(false);
    setJsonText("");
    setJsonError(null);
  };

  const cancelEdit = () => {
    const wasNew = isNewSection;
    resetEdit();
    if (wasNew) setActiveTab(groups[0]?.[0]);
  };

  const handleFieldChange = (path: Path, value: unknown) => {
    setDraft((prev: unknown) => {
      const next = setIn(prev, path, value);
      setJsonText(toJson(next));
      return next;
    });
  };

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      setDraft(parsed);
      setJsonError(null);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };

  const toggleMode = (toJsonMode: boolean) => {
    // Regenerate the JSON text from the last valid draft in both directions.
    // Leaving JSON view therefore discards any invalid/unparsed text and reverts
    // to the last good state the form already reflects, so an invalid edit can
    // never sneak through by switching views.
    setJsonText(toJson(draft));
    setJsonError(null);
    setJsonMode(toJsonMode);
  };

  const openNewSection = () => {
    setNewSectionName("");
    setSectionDialogOpen(true);
  };

  const confirmNewSection = () => {
    const name = newSectionName.trim();
    if (!name) return;
    if (groups.some(([n]) => n === name)) {
      toast({ title: "Section already exists", variant: "destructive" });
      return;
    }
    setSectionDialogOpen(false);
    setEditingGroup(name);
    setIsNewSection(true);
    setDraft({});
    setJsonMode(false);
    setJsonText("{}");
    setJsonError(null);
    setActiveTab(name);
  };

  const saveGroup = (name: string) => {
    if (jsonMode && jsonError) {
      toast({ title: "Fix the JSON before saving", variant: "destructive" });
      return;
    }
    const body = { name, setting: draft } as SettingsInput;
    saveMutation.mutate(
      { data: body },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetSettingsQueryKey({}),
          });
          toast({ title: "Settings saved", description: humanize(name) });
          resetEdit();
          setActiveTab(name);
        },
        onError: () =>
          toast({ title: "Save failed", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Settings"
        description="Global platform settings."
        actions={
          !isLoading && !isError ? (
            <Button
              variant="outline"
              size="sm"
              onClick={openNewSection}
              disabled={editingGroup !== null}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New section
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-4 md:space-y-6">
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
        <Card className="page-card">
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
      ) : displayGroups.length === 0 ? (
        <Card className="page-card">
          <CardContent className="py-10">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No settings configured</EmptyTitle>
                <EmptyDescription>
                  There are no global platform settings yet. Use “New section” to
                  create one.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Tabs
          value={currentTab}
          onValueChange={setActiveTab}
          className="space-y-4 md:space-y-6"
        >
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            {displayGroups.map(([name]) => (
              <TabsTrigger key={name} value={name}>
                {humanize(name)}
                {isNewSection && editingGroup === name ? " *" : ""}
              </TabsTrigger>
            ))}
          </TabsList>
          {displayGroups.map(([name, value]) => {
            const isEditing = editingGroup === name;
            const isSaving = saveMutation.isPending && isEditing;
            return (
              <TabsContent key={name} value={name} className="mt-0">
                <Card className="page-card">
                  <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                    <CardTitle>{humanize(name)}</CardTitle>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleMode(!jsonMode)}
                          disabled={isSaving}
                        >
                          {jsonMode ? "Form view" : "JSON view"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={cancelEdit}
                          disabled={isSaving}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => saveGroup(name)}
                          disabled={isSaving || (jsonMode && jsonError !== null)}
                        >
                          {isSaving ? "Saving…" : "Save changes"}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(name, value)}
                        disabled={editingGroup !== null}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      jsonMode ? (
                        <div className="space-y-2">
                          <Textarea
                            value={jsonText}
                            onChange={(e) => handleJsonChange(e.target.value)}
                            rows={16}
                            spellCheck={false}
                            className="font-mono text-xs"
                          />
                          {jsonError ? (
                            <p className="text-sm text-destructive">
                              Invalid JSON: {jsonError}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Edit the raw data directly. Anything valid here will
                              be saved.
                            </p>
                          )}
                        </div>
                      ) : (
                        <FieldEditor
                          value={draft}
                          path={[]}
                          onChange={handleFieldChange}
                        />
                      )
                    ) : isPlainObject(value) || Array.isArray(value) ? (
                      <ValueRenderer value={value} />
                    ) : (
                      <div className="text-sm">
                        <PrimitiveValue value={value} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      <WhatsNewSection />

      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New settings section</DialogTitle>
            <DialogDescription>
              Give the section a name. You can add any fields you want inside it
              after creating it.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="e.g. APP_SETTINGS"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmNewSection();
              }
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSectionDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmNewSection}
              disabled={!newSectionName.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
