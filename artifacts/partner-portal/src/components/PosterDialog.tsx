import { useRef, useState } from "react";
import { toJpeg } from "html-to-image";
import {
  InvitePoster,
  type PosterDesign,
  type PosterTexts,
} from "@/components/InvitePoster";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download } from "lucide-react";

interface PosterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: string;
  defaults: Record<PosterDesign, PosterTexts>;
  title: string;
  description: string;
  fileName: string;
}

export function PosterDialog({
  open,
  onOpenChange,
  link,
  defaults,
  title,
  description,
  fileName,
}: PosterDialogProps) {
  const { toast } = useToast();
  const [design, setDesign] = useState<PosterDesign>("light");
  const [texts, setTexts] = useState<Record<PosterDesign, PosterTexts>>(() =>
    JSON.parse(JSON.stringify(defaults)),
  );
  const [downloading, setDownloading] = useState(false);
  const posterRef = useRef<HTMLDivElement | null>(null);

  const currentTexts = { ...defaults[design], ...texts[design] };
  const setField = (field: keyof PosterTexts, value: string | string[]) => {
    setTexts((prev) => ({
      ...prev,
      [design]: { ...defaults[design], ...prev[design], [field]: value },
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
      a.download = fileName;
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {link && (
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
                      inviteLink={link}
                      design={design}
                      texts={currentTexts}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <Tabs
                  value={design}
                  onValueChange={(v) => setDesign(v as PosterDesign)}
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
                setTexts((prev) => ({
                  ...prev,
                  [design]: JSON.parse(JSON.stringify(defaults[design])),
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
      {open && link && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: -20000,
            top: 0,
            pointerEvents: "none",
          }}
        >
          <InvitePoster
            ref={posterRef}
            inviteLink={link}
            design={design}
            texts={currentTexts}
          />
        </div>
      )}
    </>
  );
}
