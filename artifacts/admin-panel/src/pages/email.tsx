import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  useGetEmailStatus,
  useSendBulkEmail,
  useSendTestEmail,
  type BulkEmailInput,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/RichTextEditor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Send, Loader2, Users, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Audience = BulkEmailInput["userType"];

const AUDIENCES: { value: Audience; label: string; description: string }[] = [
  {
    value: "all",
    label: "All users",
    description: "Every user with a registered email address",
  },
  {
    value: "trial_active",
    label: "Trial · Active",
    description: "Users with a trial that hasn't expired yet",
  },
  {
    value: "trial_expired",
    label: "Trial · Expired",
    description: "Users whose trial has ended",
  },
  {
    value: "production_active",
    label: "Paid · Active",
    description: "Users on a paid plan that is still active",
  },
  {
    value: "production_expired",
    label: "Paid · Expired",
    description: "Users whose paid plan has lapsed",
  },
  {
    value: "partners",
    label: "Partners",
    description: "Every registered partner (affiliate)",
  },
];

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
}

const TEMPLATES: EmailTemplate[] = [
  {
    id: "grow-sales",
    name: "Grow your sales",
    subject: "Your shop could be selling more \u2014 here\u2019s how",
    html: `<p>Hi {name},</p><p style="font-size:20px; font-weight:bold; color:#111827; margin:0 0 16px 0;">Every sale you don&#8217;t track is money you can&#8217;t see. &#128064;</p><p>Shops using Pointify POS know exactly <b>what&#8217;s selling</b>, <b>what&#8217;s running low</b>, and <b>how much they made today</b> &mdash; right from their phone.</p><ul><li>&#9889; Record sales in seconds</li><li>&#128230; Track stock automatically</li><li>&#128176; See your profit at a glance</li></ul><p style="text-align:center; margin:28px 0;"><a href="https://pointifypos.com/download" style="background-color:#2563eb; color:#ffffff; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:15px; display:inline-block;">Open Pointify Now</a></p><p style="border-top:1px solid #e5e7eb; margin:24px 0 16px 0;"></p><p style="color:#6b7280;">Asante sana,<br/><b style="color:#2563eb;">The Pointify Team</b></p>`,
  },
  {
    id: "trial-upgrade",
    name: "Trial → Paid upgrade",
    subject: "Don\u2019t lose your shop data \u2014 upgrade today",
    html: `<p>Hello {name},</p><p style="font-size:20px; font-weight:bold; color:#111827; margin:0 0 16px 0;">Your business deserves more than a trial. &#128640;</p><p>You&#8217;ve seen what Pointify POS can do. Upgrade now and keep your <b>sales history</b>, <b>stock records</b>, and <b>reports</b> growing with your business &mdash; without interruption.</p><p style="background-color:#eff6ff; border-radius:8px; padding:14px 18px; color:#1e40af;"><b>Upgrading takes less than 2 minutes with M-Pesa.</b> No paperwork, no waiting.</p><p style="text-align:center; margin:28px 0;"><a href="https://pointifypos.com" style="background-color:#2563eb; color:#ffffff; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:15px; display:inline-block;">Upgrade with M-Pesa</a></p><p style="border-top:1px solid #e5e7eb; margin:24px 0 16px 0;"></p><p style="color:#6b7280;">Karibu tena,<br/><b style="color:#2563eb;">The Pointify Team</b></p>`,
  },
  {
    id: "win-back",
    name: "Win back expired users",
    subject: "We kept your shop data safe \u2014 come back anytime",
    html: `<p>Hi {name},</p><p style="font-size:20px; font-weight:bold; color:#111827; margin:0 0 16px 0;">Your shop hasn&#8217;t stopped. Neither should your records. &#127978;</p><p>Your Pointify account is paused, but <b>all your data is still safe</b> &mdash; same products, same reports, zero setup when you return.</p><p>Renew in minutes with M-Pesa and pick up exactly where you left off.</p><p style="text-align:center; margin:28px 0;"><a href="https://pointifypos.com" style="background-color:#2563eb; color:#ffffff; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:15px; display:inline-block;">Renew &amp; Get Back to Business</a></p><p style="border-top:1px solid #e5e7eb; margin:24px 0 16px 0;"></p><p style="color:#6b7280;">Asante sana,<br/><b style="color:#2563eb;">The Pointify Team</b></p>`,
  },
  {
    id: "new-feature",
    name: "New feature announcement",
    subject: "New in Pointify: made for shops like yours",
    html: `<p>Hello {name},</p><p style="font-size:20px; font-weight:bold; color:#111827; margin:0 0 16px 0;">We just made running your shop even easier. &#10024;</p><p>We&#8217;re always improving Pointify POS based on what shop owners like you ask for. Log in to see the latest updates &mdash; built to <b>save you time</b> and <b>help you sell more</b>.</p><p style="text-align:center; margin:28px 0;"><a href="https://pointifypos.com/download" style="background-color:#2563eb; color:#ffffff; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:15px; display:inline-block;">See What&#8217;s New</a></p><p style="color:#6b7280; font-size:13px;">Have an idea for us? Just reply to this email &mdash; we read every message.</p><p style="border-top:1px solid #e5e7eb; margin:24px 0 16px 0;"></p><p style="color:#6b7280;">Asante sana,<br/><b style="color:#2563eb;">The Pointify Team</b></p>`,
  },
  {
    id: "partner-referral",
    name: "Partner push",
    subject: "Earn with every shop you bring to Pointify",
    html: `<p>Hi {name},</p><p style="font-size:20px; font-weight:bold; color:#111827; margin:0 0 16px 0;">Your network is your net worth &mdash; literally. &#128184;</p><p>Every shop you refer to Pointify POS earns you <b>commission on their subscription</b>. The more shops you sign up, the more you earn &mdash; month after month.</p><p style="background-color:#eff6ff; border-radius:8px; padding:14px 18px; text-align:center;">Your referral code<br/><b style="font-size:22px; color:#1e40af; letter-spacing:2px;">{code}</b></p><ul><li>&#128279; Share your personal link: {link}</li><li>&#129309; Help the shop get started</li><li>&#128200; Watch your wallet grow</li></ul><p style="text-align:center; margin:28px 0;"><a href="{link}" style="background-color:#2563eb; color:#ffffff; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:15px; display:inline-block;">Share Your Link</a></p><p style="border-top:1px solid #e5e7eb; margin:24px 0 16px 0;"></p><p style="color:#6b7280;">Asante sana,<br/><b style="color:#2563eb;">The Pointify Team</b></p>`,
  },
];

export default function Email() {
  const { toast } = useToast();
  const { data: status, isLoading: statusLoading } = useGetEmailStatus();
  const configured = status?.configured === true;

  const [audience, setAudience] = useState<Audience | "">("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [plainText, setPlainText] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sendBulk = useSendBulkEmail();
  const sendTest = useSendTestEmail();
  const [testEmail, setTestEmail] = useState("");

  const trimmedSubject = subject.trim();
  const trimmedMessage = plainText.trim();
  const trimmedHtml = trimmedMessage ? html : "";

  const applyTemplate = (id: string) => {
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    setTemplateId(id);
    setSubject(tpl.subject);
    setHtml(tpl.html);
    // Derive plain text from the template HTML for the text-only fallback.
    const el = document.createElement("div");
    el.innerHTML = tpl.html;
    setPlainText(el.innerText);
  };
  const canSend =
    configured &&
    Boolean(audience) &&
    trimmedSubject.length > 0 &&
    trimmedMessage.length > 0 &&
    !sendBulk.isPending;
  const selectedAudience = AUDIENCES.find((a) => a.value === audience);

  const trimmedTestEmail = testEmail.trim();
  const canTest =
    configured &&
    trimmedTestEmail.length > 3 &&
    trimmedTestEmail.includes("@") &&
    trimmedSubject.length > 0 &&
    trimmedMessage.length > 0 &&
    !sendTest.isPending;

  const handleTest = () => {
    if (!canTest) return;
    sendTest.mutate(
      {
        data: {
          to: trimmedTestEmail,
          subject: trimmedSubject,
          message: trimmedMessage,
          ...(trimmedHtml ? { html: trimmedHtml } : {}),
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Test email sent",
            description: `Check the inbox of ${trimmedTestEmail}.`,
          });
        },
        onError: (error) => {
          const detail =
            (error as { data?: { message?: string } })?.data?.message ?? "";
          toast({
            title: "Test email failed",
            description: detail
              ? detail
              : "The provider rejected the send. Check the address and Brevo settings.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleSend = () => {
    if (!audience || !trimmedSubject || !trimmedMessage) return;
    sendBulk.mutate(
      {
        data: {
          userType: audience,
          subject: trimmedSubject,
          message: trimmedMessage,
          ...(trimmedHtml ? { html: trimmedHtml } : {}),
        },
      },
      {
        onSuccess: (result) => {
          setConfirmOpen(false);
          const total = Number(result?.total ?? 0);
          if (result?.status === "dry_run") {
            toast({
              title: "Test run only — no emails sent",
              description: `${total} user${total === 1 ? "" : "s"} matched this audience. Emails are only sent from the live (production) server.`,
            });
          } else if (total === 0) {
            toast({
              title: "No recipients",
              description:
                "No users with a valid email address matched this audience, so nothing was sent.",
            });
          } else {
            toast({
              title: "Bulk email started",
              description: `Sending to ${total} user${total === 1 ? "" : "s"} in the background.`,
            });
          }
          setSubject("");
          setHtml("");
          setPlainText("");
          setTemplateId("");
          setAudience("");
        },
        onError: () => {
          setConfirmOpen(false);
          toast({
            title: "Couldn't send bulk email",
            description: "The email could not be sent. Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Email Hub" description="Send bulk email to your users." />

      {!statusLoading && !configured && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Email sending isn't set up yet</AlertTitle>
          <AlertDescription>
            Add your Brevo API key and sender email in the Settings page
            (Email configuration) before emails can be sent.
          </AlertDescription>
        </Alert>
      )}

      <Card className="page-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-muted-foreground" />
            Send bulk email
          </CardTitle>
          <CardDescription>
            Email every user in an audience at once. Each user receives one
            email on their registered address, even if they own multiple shops.
            Sending runs in the background.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="audience">Audience</Label>
              <Select
                value={audience}
                onValueChange={(v) => setAudience(v as Audience)}
              >
                <SelectTrigger id="audience">
                  <SelectValue placeholder="Choose who to email" />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      <span className="flex flex-col">
                        <span>{a.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {a.description}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Email subject line"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Start from a template (optional)</Label>
            <Select value={templateId} onValueChange={applyTemplate}>
              <SelectTrigger id="template">
                <SelectValue placeholder="Pick a marketing template, then edit it below" />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex flex-col">
                      <span>{t.name}</span>
                      <span className="text-xs text-muted-foreground">{t.subject}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="message">Message</Label>
              <span className="text-xs text-muted-foreground">
                {trimmedMessage.length} characters
              </span>
            </div>
            <RichTextEditor
              id="message"
              value={html}
              placeholder="Type the email your recipients will receive… Use the toolbar for bold, lists and links."
              onChange={(nextHtml, nextText) => {
                setHtml(nextHtml);
                setPlainText(nextText);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Personalize with{" "}
              <code className="rounded bg-muted px-1">{"{name}"}</code> (recipient's
              name),{" "}
              <code className="rounded bg-muted px-1">{"{code}"}</code> (partner
              referral code) and{" "}
              <code className="rounded bg-muted px-1">{"{link}"}</code> (the
              partner's shareable download link). Code and link fill in for the
              Partners audience; test emails use sample values.
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-end md:justify-between">
            <div className="w-full space-y-2 md:max-w-sm">
              <Label htmlFor="test-email">Send a test to yourself first</Label>
              <div className="flex gap-2">
                <Input
                  id="test-email"
                  type="email"
                  placeholder="you@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canTest}
                  onClick={handleTest}
                >
                  {sendTest.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Send test
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Sends this exact email to one address only.
              </p>
            </div>
            <Button disabled={!canSend} onClick={() => setConfirmOpen(true)}>
              {sendBulk.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send bulk email
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Email {selectedAudience?.label ?? "this audience"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This sends the email to every user in the{" "}
              <span className="font-medium">{selectedAudience?.label}</span>{" "}
              audience — one email per user, even if they own several shops.
              This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{trimmedSubject}</p>
            <p className="whitespace-pre-wrap text-muted-foreground">
              {trimmedMessage}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendBulk.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleSend();
              }}
              disabled={sendBulk.isPending}
            >
              {sendBulk.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Send now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
