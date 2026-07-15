import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSmsLogs,
  useSendBulkSms,
  useSendTestSms,
  getListSmsLogsQueryKey,
  type BulkSmsInput,
} from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Send, Loader2, Users } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Audience = BulkSmsInput["userType"];

const AUDIENCES: { value: Audience; label: string; description: string }[] = [
  {
    value: "all",
    label: "All users",
    description: "Every user with a registered phone number",
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

export default function SMS() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useListSmsLogs({ page, limit: 20 });
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const totalCount = data?.count ?? 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [audience, setAudience] = useState<Audience | "">("");
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sendBulk = useSendBulkSms();
  const sendTest = useSendTestSms();
  const [testPhone, setTestPhone] = useState("");

  const trimmed = message.trim();
  const trimmedTestPhone = testPhone.trim();
  const canTest =
    trimmedTestPhone.length >= 9 && trimmed.length > 0 && !sendTest.isPending;

  const handleTest = () => {
    if (!canTest) return;
    sendTest.mutate(
      { data: { phone: trimmedTestPhone, message: trimmed } },
      {
        onSuccess: () => {
          toast({
            title: "Test SMS sent",
            description: `Check the phone ${trimmedTestPhone}.`,
          });
        },
        onError: () => {
          toast({
            title: "Test SMS failed",
            description:
              "The SMS could not be sent. Check the phone number (e.g. 07XXXXXXXX) and try again.",
            variant: "destructive",
          });
        },
      },
    );
  };
  const canSend = Boolean(audience) && trimmed.length > 0 && !sendBulk.isPending;
  const selectedAudience = AUDIENCES.find((a) => a.value === audience);

  const handleSend = () => {
    if (!audience || !trimmed) return;
    sendBulk.mutate(
      {
        data: {
          userType: audience,
          message: trimmed,
        },
      },
      {
        onSuccess: (result) => {
          setConfirmOpen(false);
          const total = Number(result?.total ?? 0);
          if (total === 0) {
            toast({
              title: "No recipients",
              description: "No users matched this audience, so nothing was sent.",
            });
          } else {
            toast({
              title: "Bulk SMS started",
              description: `Sending to ${total} user${total === 1 ? "" : "s"} in the background. Delivery will appear in the logs below shortly.`,
            });
          }
          setMessage("");
          setAudience("");
          queryClient.invalidateQueries({ queryKey: getListSmsLogsQueryKey() });
        },
        onError: () => {
          setConfirmOpen(false);
          toast({
            title: "Couldn't send bulk SMS",
            description: "The message could not be sent. Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="SMS Hub" description="Manage platform communications." />

      <Card className="page-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-muted-foreground" />
            Send bulk SMS
          </CardTitle>
          <CardDescription>
            Message every user in an audience at once. Each user receives a
            single message on their registered phone, even if they own multiple
            shops. Sending runs in the background.
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
                  <SelectValue placeholder="Choose who to message" />
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
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="message">Message</Label>
              <span className="text-xs text-muted-foreground">
                {trimmed.length} characters
              </span>
            </div>
            <Textarea
              id="message"
              rows={4}
              placeholder="Type the message your recipients will receive…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-end md:justify-between">
            <div className="w-full space-y-2 md:max-w-sm">
              <Label htmlFor="test-phone">Send a test to yourself first</Label>
              <div className="flex gap-2">
                <Input
                  id="test-phone"
                  type="tel"
                  placeholder="07XXXXXXXX"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
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
                Sends this exact message to one phone number only.
              </p>
            </div>
            <Button disabled={!canSend} onClick={() => setConfirmOpen(true)}>
              {sendBulk.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send bulk SMS
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="page-card">
        <CardHeader>
          <CardTitle>SMS Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-4">Loading logs...</div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data?.map((log) => (
                      <TableRow key={log._id}>
                        <TableCell className="font-medium">{log.phone}</TableCell>
                        <TableCell className="max-w-xs truncate">{log.message}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.status}</Badge>
                        </TableCell>
                        <TableCell>{log.smsType}</TableCell>
                        <TableCell>{formatDate(log.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {data?.data?.length ? (
                  data.data.map((log) => (
                    <div
                      key={log._id}
                      className="rounded-lg border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{log.phone}</p>
                          <p className="text-sm text-muted-foreground">{log.message}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0">{log.status}</Badge>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Type</dt>
                          <dd>{log.smsType}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Date</dt>
                          <dd>{formatDate(log.createdAt)}</dd>
                        </div>
                      </dl>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    No SMS logs found.
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  {totalCount > 0
                    ? `Page ${page} of ${totalPages} · ${totalCount} message${totalCount === 1 ? "" : "s"}`
                    : ""}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || isFetching}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || isFetching}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Send to {selectedAudience?.label ?? "this audience"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This sends the message to every user in the{" "}
              <span className="font-medium">{selectedAudience?.label}</span>{" "}
              audience — one message per user, even if they own several shops.
              This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            {trimmed}
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
