import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Share2, Copy, Check, MessageCircle } from "lucide-react";

const DOWNLOAD_BASE = "https://pointifypos.com/download";

function buildLink(code: string) {
  return `${DOWNLOAD_BASE}?ref=${encodeURIComponent(code)}`;
}

function buildMessage(code: string, link: string) {
  const intro =
    "Run your shop the easy way with Pointify POS. Download the app here:";
  return `${intro}\n${link}\n\nUse my referral code ${code} when you sign up.`;
}

export function ShareReferralCard({ code }: { code?: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!code) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Share2 className="h-5 w-5 text-primary" />
            Share &amp; earn
          </CardTitle>
          <CardDescription>
            Your referral code isn't available yet. Please reload, or contact support if this continues — you need a code for signups to count toward your commissions.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const link = buildLink(code);
  const message = buildMessage(code, link);

  const copyLink = async () => {
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: "Link copied", description: "Share it with shop owners to start earning." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy", description: "Please select the link above and copy it manually.", variant: "destructive" });
    }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Pointify POS", text: message, url: link });
      } catch {
        // user dismissed the share sheet — no action needed
      }
    } else {
      copyLink();
    }
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Share2 className="h-5 w-5 text-primary" />
          Share &amp; earn
        </CardTitle>
        <CardDescription>
          Send your download link to shop owners. When they sign up with your code, you earn commissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1 truncate rounded-lg border bg-background px-3 py-2 font-mono text-sm text-muted-foreground">
            {link}
          </div>
          <Button variant="outline" onClick={copyLink} className="shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={shareWhatsApp} className="flex-1 bg-[#25D366] text-white border-[#1da851]">
            <MessageCircle className="h-4 w-4" />
            Share on WhatsApp
          </Button>
          <Button variant="secondary" onClick={share} className="flex-1">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
