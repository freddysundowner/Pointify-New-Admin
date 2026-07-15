import { useRef, useState } from "react";
import { toJpeg } from "html-to-image";
import {
  InvitePoster,
  DEFAULT_TEXTS,
  type PosterDesign,
  type PosterTexts,
} from "@/components/InvitePoster";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useListPortalSubPartners,
  getListPortalSubPartnersQueryKey,
  useCreatePortalSubPartner,
  useUpdatePortalSubPartner,
  useGetPortalProfile,
  type SubPartner,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Loader2,
  Plus,
  Pencil,
  Phone,
  Mail,
  Percent,
  Link2,
  Copy,
  Check,
  ImageDown,
  Download,
} from "lucide-react";

function formatKes(n: unknown): string {
  const num = Number(n);
  return `KES ${Number.isFinite(num) ? num.toLocaleString("en-KE") : "0"}`;
}

function formatDate(raw: unknown): string {
  if (!raw) return "—";
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

function StatusBadge({ partner }: { partner: SubPartner }) {
  if (partner.blocked) {
    return <Badge variant="destructive">Suspended</Badge>;
  }
  return (
    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
      Active
    </Badge>
  );
}

type CreateDraft = {
  name: string;
  email: string;
  phonenumber: string;
  country: string;
  subCommission: string;
  password: string;
};

const EMPTY_DRAFT: CreateDraft = {
  name: "",
  email: "",
  phonenumber: "",
  country: "Kenya",
  subCommission: "",
  password: "",
};

export default function SubPartners() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: partners, isLoading, isError } = useListPortalSubPartners();
  const { data: profile } = useGetPortalProfile();
  const [copied, setCopied] = useState(false);

  const isMaster = Boolean(profile?._id) && !profile?.parent;
  const inviteLink =
    isMaster && profile?.code
      ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/register?ref=${encodeURIComponent(profile.code)}`
      : "";

  const [posterOpen, setPosterOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const posterRef = useRef<HTMLDivElement | null>(null);
  const [posterDesign, setPosterDesign] = useState<PosterDesign>("light");
  const [posterTexts, setPosterTexts] = useState<
    Record<PosterDesign, PosterTexts>
  >(() => JSON.parse(JSON.stringify(DEFAULT_TEXTS)));

  const currentTexts = posterTexts[posterDesign];
  const setField = (field: keyof PosterTexts, value: string | string[]) => {
    setPosterTexts((prev) => ({
      ...prev,
      [posterDesign]: { ...prev[posterDesign], [field]: value },
    }));
  };

  const downloadPoster = async () => {
    const node = posterRef.current;
    if (!node) return;
    setDownloading(true);
    try {
      // Make sure webfonts are loaded so the export doesn't fall back to system fonts.
      await document.fonts?.ready;
      // pixelRatio 1.5 -> 1620x2880 output for a crisp share on WhatsApp.
      const dataUrl = await toJpeg(node, {
        quality: 0.92,
        pixelRatio: 1.5,
        backgroundColor: "#faf8f5",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "pointify-partner-poster.jpg";
      a.click();
    } catch {
      toast({
        title: "Download failed",
        description: "Could not generate the poster. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Could not copy",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  };

  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<CreateDraft>(EMPTY_DRAFT);

  const [editing, setEditing] = useState<SubPartner | null>(null);
  const [editShare, setEditShare] = useState("");
  const [editSuspended, setEditSuspended] = useState(false);
  const [editPassword, setEditPassword] = useState("");

  const createMutation = useCreatePortalSubPartner();
  const updateMutation = useUpdatePortalSubPartner();

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getListPortalSubPartnersQueryKey() });

  const shareInvalid = (value: string) => {
    const n = Number(value);
    return !Number.isFinite(n) || n < 1 || n > 99;
  };

  const submitCreate = () => {
    if (!draft.name.trim() || !draft.email.trim() || !draft.phonenumber.trim()) {
      toast({ title: "Name, email and phone number are required", variant: "destructive" });
      return;
    }
    if (shareInvalid(draft.subCommission)) {
      toast({ title: "Share percentage must be between 1 and 99", variant: "destructive" });
      return;
    }
    createMutation.mutate(
      {
        data: {
          name: draft.name.trim(),
          email: draft.email.trim(),
          phonenumber: draft.phonenumber.trim(),
          subCommission: Number(draft.subCommission),
          ...(draft.country.trim() ? { country: draft.country.trim() } : {}),
          ...(draft.password ? { password: draft.password } : {}),
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Partner added",
            description: draft.password
              ? `${draft.name.trim()} can now log in to this portal.`
              : `${draft.name.trim()} will receive their login details by email.`,
          });
          setCreateOpen(false);
          setDraft(EMPTY_DRAFT);
          refresh();
        },
        onError: (error: unknown) => {
          const message =
            (error as { body?: { error?: string; message?: string } })?.body?.error ??
            (error as { body?: { error?: string; message?: string } })?.body?.message ??
            "Could not add the partner. The email may already be registered.";
          toast({ title: "Adding partner failed", description: message, variant: "destructive" });
        },
      },
    );
  };

  const openEdit = (partner: SubPartner) => {
    setEditing(partner);
    setEditShare(String(partner.subCommission ?? ""));
    setEditSuspended(Boolean(partner.blocked));
    setEditPassword("");
  };

  const submitEdit = () => {
    if (!editing) return;
    if (shareInvalid(editShare)) {
      toast({ title: "Share percentage must be between 1 and 99", variant: "destructive" });
      return;
    }
    const password = editPassword.trim();
    if (password && password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    updateMutation.mutate(
      {
        id: editing._id,
        data: {
          subCommission: Number(editShare),
          blocked: editSuspended,
          ...(password ? { password } : {}),
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Partner updated",
            description: password
              ? `${editing.name ?? "The partner"} was emailed their new password.`
              : undefined,
          });
          setEditing(null);
          setEditPassword("");
          refresh();
        },
        onError: () =>
          toast({ title: "Update failed", description: "Please try again.", variant: "destructive" }),
      },
    );
  };

  const rows = partners ?? [];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Partners</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add partners under you. They share their own referral code, and when their
            customers subscribe, they receive their share of your commission automatically.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add partner
        </Button>
      </div>

      {inviteLink && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  <Link2 className="h-4 w-4 text-primary" />
                  Your invite link
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Share this link — anyone who registers through it is automatically
                  added to your team with a 50% share (you can change it afterwards).
                </p>
                <p className="mt-2 break-all rounded-md bg-background px-3 py-2 font-mono text-xs text-foreground border">
                  {inviteLink}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={copyInviteLink}>
                  {copied ? (
                    <>
                      <Check className="mr-1.5 h-4 w-4 text-green-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-4 w-4" />
                      Copy link
                    </>
                  )}
                </Button>
                <Button size="sm" onClick={() => setPosterOpen(true)}>
                  <ImageDown className="mr-1.5 h-4 w-4" />
                  Get my poster
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Poster preview + download dialog */}
      <Dialog open={posterOpen} onOpenChange={setPosterOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Your recruitment poster</DialogTitle>
            <DialogDescription>
              The QR code opens your personal invite link, so everyone who
              scans it and registers joins your team automatically. Pick a
              design and edit the text to make it yours.
            </DialogDescription>
          </DialogHeader>
          {inviteLink && (
            <div className="grid gap-6 sm:grid-cols-[270px_1fr]">
              <div className="flex justify-center sm:justify-start">
                <div
                  className="shrink-0 overflow-hidden rounded-lg border shadow-sm"
                  style={{ width: 270, height: 480 }}
                >
                  <div
                    style={{
                      transform: "scale(0.25)",
                      transformOrigin: "top left",
                      width: 1080,
                      height: 1920,
                    }}
                  >
                    <InvitePoster
                      inviteLink={inviteLink}
                      design={posterDesign}
                      texts={currentTexts}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <Tabs
                  value={posterDesign}
                  onValueChange={(v) => setPosterDesign(v as PosterDesign)}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="light">Light design</TabsTrigger>
                    <TabsTrigger value="purple">Purple design</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Brand name</Label>
                    <Input
                      value={currentTexts.brandTitle}
                      onChange={(e) => setField("brandTitle", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Brand tagline</Label>
                    <Input
                      value={currentTexts.brandSubtitle}
                      onChange={(e) =>
                        setField("brandSubtitle", e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Headline</Label>
                  <Textarea
                    rows={2}
                    value={currentTexts.headline}
                    onChange={(e) => setField("headline", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Highlighted line</Label>
                  <Input
                    value={currentTexts.accent}
                    onChange={(e) => setField("accent", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>First paragraph</Label>
                  <Textarea
                    rows={3}
                    value={currentTexts.body1}
                    onChange={(e) => setField("body1", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Second paragraph</Label>
                  <Textarea
                    rows={3}
                    value={currentTexts.body2}
                    onChange={(e) => setField("body2", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Benefits (one per line)</Label>
                  <Textarea
                    rows={4}
                    value={currentTexts.benefits.join("\n")}
                    onChange={(e) =>
                      setField(
                        "benefits",
                        e.target.value
                          .split("\n")
                          .filter((l) => l.trim().length > 0),
                      )
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Button text</Label>
                    <Input
                      value={currentTexts.cta}
                      onChange={(e) => setField("cta", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone number</Label>
                    <Input
                      value={currentTexts.phone}
                      onChange={(e) => setField("phone", e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Website line</Label>
                    <Input
                      value={currentTexts.website}
                      onChange={(e) => setField("website", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>"Call us" label</Label>
                    <Input
                      value={currentTexts.callLabel}
                      onChange={(e) => setField("callLabel", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Under the QR code</Label>
                  <Input
                    value={currentTexts.scanLabel}
                    onChange={(e) => setField("scanLabel", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Bottom line</Label>
                  <Input
                    value={currentTexts.footer}
                    onChange={(e) => setField("footer", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setPosterTexts((prev) => ({
                  ...prev,
                  [posterDesign]: JSON.parse(
                    JSON.stringify(DEFAULT_TEXTS[posterDesign]),
                  ),
                }))
              }
            >
              Reset text
            </Button>
            <Button onClick={downloadPoster} disabled={downloading}>
              {downloading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              Download poster
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offscreen full-size poster used for the JPEG export */}
      {posterOpen && inviteLink && (
        <div
          aria-hidden
          style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}
        >
          <InvitePoster
            ref={posterRef}
            inviteLink={inviteLink}
            design={posterDesign}
            texts={currentTexts}
          />
        </div>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-5/6" />
            <Skeleton className="h-5 w-2/3" />
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Couldn't load your partners. Please try again.
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">No partners yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first partner to grow your network. You set what percentage of
                your commission they earn.
              </p>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add partner
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Referral code</TableHead>
                    <TableHead className="text-right">Share of your commission</TableHead>
                    <TableHead className="text-right">Referred users</TableHead>
                    <TableHead className="text-right">Wallet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p._id}>
                      <TableCell className="font-medium">{p.name ?? "—"}</TableCell>
                      <TableCell>
                        <div className="text-sm">{p.email ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{p.phonenumber ?? ""}</div>
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{p.code ?? "—"}</code>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {p.subCommission != null ? `${p.subCommission}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right">{p.userCount ?? 0}</TableCell>
                      <TableCell className="text-right">{formatKes(p.wallet)}</TableCell>
                      <TableCell>
                        <StatusBadge partner={p} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(p.createAt)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="Edit partner">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((p) => (
              <Card key={p._id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{p.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">Joined {formatDate(p.createAt)}</p>
                    </div>
                    <StatusBadge partner={p} />
                  </div>
                  <div className="space-y-1 text-sm">
                    {p.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        {p.email}
                      </div>
                    )}
                    {p.phonenumber && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {p.phonenumber}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Percent className="h-3.5 w-3.5" />
                      {p.subCommission != null ? `${p.subCommission}% of your commission` : "Share not set"}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3 text-sm">
                    <div className="flex gap-4">
                      <span>
                        <span className="font-medium">{p.userCount ?? 0}</span>{" "}
                        <span className="text-muted-foreground">users</span>
                      </span>
                      <span className="font-medium">{formatKes(p.wallet)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{p.code ?? "—"}</code>
                      <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => !createMutation.isPending && setCreateOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a partner</DialogTitle>
            <DialogDescription>
              They get their own referral code and portal login. You choose what percentage
              of your commission they earn on their referrals.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sp-name">Full name</Label>
              <Input
                id="sp-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-email">Email</Label>
              <Input
                id="sp-email"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sp-phone">Phone number</Label>
                <Input
                  id="sp-phone"
                  value={draft.phonenumber}
                  onChange={(e) => setDraft({ ...draft, phonenumber: e.target.value })}
                  placeholder="07..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp-country">Country</Label>
                <Input
                  id="sp-country"
                  value={draft.country}
                  onChange={(e) => setDraft({ ...draft, country: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-share">Their share of your commission (%)</Label>
              <Input
                id="sp-share"
                type="number"
                min={1}
                max={99}
                value={draft.subCommission}
                onChange={(e) => setDraft({ ...draft, subCommission: e.target.value })}
                placeholder="e.g. 30"
              />
              <p className="text-xs text-muted-foreground">
                Example: if your commission on a sale is KES 1,000 and their share is 30%,
                they get KES 300 and you keep KES 700.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-password">Password (optional)</Label>
              <Input
                id="sp-password"
                type="password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                placeholder="Leave blank to email them one"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submitCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Add partner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editing !== null} onOpenChange={(open) => !updateMutation.isPending && !open && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit {editing?.name ?? "partner"}</DialogTitle>
            <DialogDescription>
              Change their share of your commission, set a new password, or
              suspend their account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sp-edit-share">Share of your commission (%)</Label>
              <Input
                id="sp-edit-share"
                type="number"
                min={1}
                max={99}
                value={editShare}
                onChange={(e) => setEditShare(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-edit-password">New password (optional)</Label>
              <Input
                id="sp-edit-password"
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep current password"
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                They'll receive an email with the new password.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Suspended</p>
                <p className="text-xs text-muted-foreground">
                  A suspended partner cannot log in or withdraw.
                </p>
              </div>
              <Switch checked={editSuspended} onCheckedChange={setEditSuspended} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submitEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
