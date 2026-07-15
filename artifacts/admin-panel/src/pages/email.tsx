import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  useGetEmailStatus,
  useSendBulkEmail,
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
import { Textarea } from "@/components/ui/textarea";
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
];

export default function Email() {
  const { toast } = useToast();
  const { data: status, isLoading: statusLoading } = useGetEmailStatus();
  const configured = status?.configured === true;

  const [audience, setAudience] = useState<Audience | "">("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sendBulk = useSendBulkEmail();

  const trimmedSubject = subject.trim();
  const trimmedMessage = message.trim();
  const canSend =
    configured &&
    Boolean(audience) &&
    trimmedSubject.length > 0 &&
    trimmedMessage.length > 0 &&
    !sendBulk.isPending;
  const selectedAudience = AUDIENCES.find((a) => a.value === audience);

  const handleSend = () => {
    if (!audience || !trimmedSubject || !trimmedMessage) return;
    sendBulk.mutate(
      {
        data: {
          userType: audience,
          subject: trimmedSubject,
          message: trimmedMessage,
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
          setMessage("");
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
            <div className="flex items-center justify-between">
              <Label htmlFor="message">Message</Label>
              <span className="text-xs text-muted-foreground">
                {trimmedMessage.length} characters
              </span>
            </div>
            <Textarea
              id="message"
              rows={8}
              placeholder="Type the email your recipients will receive… Line breaks are kept."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
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
          <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
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
