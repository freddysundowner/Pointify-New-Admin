import { useEffect, useState } from "react";
import { useUpdateAdmin, type AdminUpdate } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function AccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { userdata, updateUserdata } = useAuth();
  const { toast } = useToast();
  const update = useUpdateAdmin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // Reset the form to the current account each time the dialog opens.
  useEffect(() => {
    if (open) {
      setEmail(userdata?.email ?? "");
      setPassword("");
      setConfirm("");
    }
  }, [open, userdata?.email]);

  const trimmedEmail = email.trim();
  const emailChanged = trimmedEmail !== (userdata?.email ?? "");
  const wantsPasswordChange = password.length > 0 || confirm.length > 0;

  const handleSave = () => {
    if (!userdata?._id) return;

    if (emailChanged && !isValidEmail(trimmedEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    if (wantsPasswordChange) {
      if (password.length < 6) {
        toast({
          title: "Password too short",
          description: "Use at least 6 characters.",
          variant: "destructive",
        });
        return;
      }
      if (password !== confirm) {
        toast({
          title: "Passwords don't match",
          description: "Re-enter the same password in both fields.",
          variant: "destructive",
        });
        return;
      }
    }

    const data: AdminUpdate = {};
    if (emailChanged) data.email = trimmedEmail;
    if (wantsPasswordChange) data.password = password;

    if (Object.keys(data).length === 0) {
      toast({ title: "Nothing to update" });
      return;
    }

    update.mutate(
      { id: userdata._id, data },
      {
        onSuccess: (result) => {
          // Upstream updateAdmin returns HTTP 200 with `{ error: "..." }` on
          // logical failures (e.g. a duplicate email), so detect that here
          // rather than trusting the 2xx status.
          const failure = (result as { error?: unknown })?.error;
          if (failure) {
            toast({
              title: "Couldn't update account",
              description:
                typeof failure === "string"
                  ? failure
                  : "That email may already be in use.",
              variant: "destructive",
            });
            return;
          }
          // Reflect the new email locally without persisting any sensitive
          // fields the upstream may echo back (e.g. the password hash).
          if (emailChanged) updateUserdata({ email: trimmedEmail });
          toast({
            title: "Account updated",
            description: wantsPasswordChange
              ? "Your changes have been saved."
              : undefined,
          });
          onOpenChange(false);
        },
        onError: () =>
          toast({
            title: "Couldn't update account",
            description: "Please try again.",
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>My account</DialogTitle>
          <DialogDescription>
            Update your email address or change your password.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account-email">Email</Label>
            <Input
              id="account-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-password">New password</Label>
            <Input
              id="account-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-confirm">Confirm new password</Label>
            <Input
              id="account-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter new password"
              autoComplete="new-password"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={update.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
