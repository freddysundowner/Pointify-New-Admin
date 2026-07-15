import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Phone, Smartphone } from "lucide-react";

export type PosterDesign = "purple" | "light";

export interface PosterTexts {
  brandTitle: string;
  brandSubtitle: string;
  headline: string;
  accent: string;
  body1: string;
  body2: string;
  benefits: string[];
  cta: string;
  website: string;
  callLabel: string;
  phone: string;
  scanLabel: string;
  footer: string;
}

const SHARED_TEXTS = {
  brandTitle: "Pointify POS",
  brandSubtitle: "Partner Program",
  website: "partner.pointifypos.com",
  callLabel: "Or Call Us Today",
  scanLabel: "Scan to join",
  footer: "Scan the QR code or visit partner.pointifypos.com",
};

export const DEFAULT_TEXTS: Record<PosterDesign, PosterTexts> = {
  purple: {
    ...SHARED_TEXTS,
    headline: "Turn Your\nContacts Into",
    accent: "Income.",
    body1:
      "Do you know shop owners or businesses around you that struggle to track stock, sales, profits, or expenses?",
    body2:
      "Introduce them to Pointify POS and earn commissions when they subscribe.",
    benefits: [
      "Free to Join",
      "No Capital Needed",
      "Work From Anywhere",
      "Paid via M-Pesa",
    ],
    cta: "Join Now!",
    phone: "0720 044 055",
  },
  light: {
    ...SHARED_TEXTS,
    headline: "Looking for",
    accent: "Extra Income?",
    body1:
      "Do you know a shop owner who still struggles with stock management, tracking profits, or recording sales?",
    body2:
      "Introduce them to Pointify POS and get rewarded for every successful referral.",
    benefits: [
      "Free Registration",
      "No Capital Needed",
      "Work From Anywhere",
      "Paid via M-Pesa",
    ],
    cta: "Join Today!",
    phone: "0720 044 055",
  },
};

/** Poster copy aimed at shop owners (used with the app download link). */
export const USER_DEFAULT_TEXTS: Record<PosterDesign, PosterTexts> = {
  purple: {
    ...SHARED_TEXTS,
    brandSubtitle: "Point of Sale",
    headline: "Run Your Shop\nThe",
    accent: "Smart Way.",
    body1:
      "Still tracking stock, sales, and profits on paper or by memory? There is an easier way.",
    body2:
      "Download Pointify POS and manage your whole business from your phone.",
    benefits: [
      "Track Stock & Sales",
      "See Profits Daily",
      "Manage Attendants",
      "Works on Your Phone",
    ],
    cta: "Download Now!",
    website: "pointifypos.com",
    phone: "0720 044 055",
    scanLabel: "Scan to download",
    footer: "Scan the QR code or visit pointifypos.com",
  },
  light: {
    ...SHARED_TEXTS,
    brandSubtitle: "Point of Sale",
    headline: "Your Shop,",
    accent: "In Your Pocket.",
    body1:
      "Do you struggle with stock management, tracking profits, or recording sales in your shop?",
    body2:
      "Get Pointify POS today and run your business with confidence.",
    benefits: [
      "Easy to Use",
      "Track Stock & Sales",
      "Daily Profit Reports",
      "Affordable Plans",
    ],
    cta: "Get Started!",
    website: "pointifypos.com",
    phone: "0720 044 055",
    scanLabel: "Scan to download",
    footer: "Scan the QR code or visit pointifypos.com",
  },
};

interface InvitePosterProps {
  inviteLink: string;
  design: PosterDesign;
  texts: PosterTexts;
}

function HeadlineLines({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          <br />
        </span>
      ))}
    </>
  );
}

function CtaCard({
  inviteLink,
  texts,
}: {
  inviteLink: string;
  texts: PosterTexts;
}) {
  return (
    <div
      className="flex items-center justify-between gap-8 rounded-3xl bg-white px-12 py-10"
      style={{
        color: "#2e1065",
        boxShadow: "0 24px 60px rgba(46,16,101,0.2)",
        border: "2px solid #ede9fe",
      }}
    >
      <div>
        <div
          className="inline-block rounded-2xl px-8 py-4 text-5xl font-extrabold uppercase tracking-wide text-white"
          style={{
            background: "linear-gradient(90deg, #7c3aed 0%, #a855f7 100%)",
            boxShadow: "0 12px 30px rgba(124,58,237,0.45)",
          }}
        >
          {texts.cta}
        </div>
        <div className="mt-5 text-3xl font-bold" style={{ color: "#7c3aed" }}>
          {texts.website}
        </div>
        <div
          className="mt-7 text-2xl font-bold uppercase tracking-wider"
          style={{ color: "#6d28d9" }}
        >
          {texts.callLabel}
        </div>
        <div className="mt-3 flex items-center gap-4 text-4xl font-extrabold">
          <span
            className="flex items-center justify-center rounded-full"
            style={{ width: 58, height: 58, background: "#7c3aed" }}
          >
            <Phone className="text-white" style={{ width: 30, height: 30 }} />
          </span>
          {texts.phone}
        </div>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div
          className="rounded-2xl border-4 bg-white p-4"
          style={{ borderColor: "#7c3aed" }}
        >
          <QRCodeSVG
            value={inviteLink}
            size={230}
            level="M"
            bgColor="#ffffff"
            fgColor="#2e1065"
          />
        </div>
        <div className="text-xl font-bold" style={{ color: "#7c3aed" }}>
          {texts.scanLabel}
        </div>
      </div>
    </div>
  );
}

export const InvitePoster = forwardRef<HTMLDivElement, InvitePosterProps>(
  function InvitePoster({ inviteLink, design, texts }, ref) {
    if (design === "purple") {
      return (
        <div
          ref={ref}
          className="relative overflow-hidden text-white"
          style={{
            width: 1080,
            height: 1920,
            background:
              "linear-gradient(160deg, #2e1065 0%, #4c1d95 35%, #6d28d9 70%, #7c3aed 100%)",
            fontFamily:
              "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: 720,
              height: 720,
              right: -260,
              top: -260,
              background:
                "radial-gradient(circle, rgba(196,181,253,0.25) 0%, rgba(196,181,253,0) 70%)",
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: 600,
              height: 600,
              left: -220,
              bottom: -200,
              background:
                "radial-gradient(circle, rgba(167,139,250,0.2) 0%, rgba(167,139,250,0) 70%)",
            }}
          />
          <div
            className="absolute rounded-full border border-white/10"
            style={{ width: 380, height: 380, right: 50, top: 460 }}
          />

          <div className="relative flex h-full flex-col px-20 py-20">
            <div className="flex items-center gap-5">
              <div
                className="flex items-center justify-center rounded-2xl bg-white font-extrabold"
                style={{ width: 84, height: 84, color: "#7c3aed", fontSize: 52 }}
              >
                P
              </div>
              <div>
                <div className="text-5xl font-extrabold tracking-tight">
                  {texts.brandTitle}
                </div>
                <div className="mt-1 text-2xl font-medium text-violet-200">
                  {texts.brandSubtitle}
                </div>
              </div>
            </div>

            <div className="mt-20">
              <h1
                className="font-extrabold leading-[1.05] tracking-tight"
                style={{ fontSize: 104 }}
              >
                <HeadlineLines text={texts.headline} />
                <span className="text-violet-300">{texts.accent}</span>
              </h1>
              <p className="mt-10 max-w-3xl text-4xl leading-snug text-violet-100">
                {texts.body1}
              </p>
              <p className="mt-8 max-w-3xl text-4xl font-semibold leading-snug">
                {texts.body2}
              </p>
            </div>

            <div className="mt-16 space-y-9">
              {texts.benefits.map((title, i) => (
                <div key={i} className="flex items-center gap-6">
                  <CheckCircle2
                    className="shrink-0 text-violet-300"
                    style={{ width: 56, height: 56 }}
                  />
                  <div className="text-4xl font-bold">{title}</div>
                </div>
              ))}
            </div>

            <div className="mt-auto">
              <CtaCard inviteLink={inviteLink} texts={texts} />
              <div className="mt-7 flex items-center justify-center gap-3 text-2xl text-violet-200">
                <Smartphone style={{ width: 28, height: 28 }} />
                {texts.footer}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className="relative overflow-hidden"
        style={{
          width: 1080,
          height: 1920,
          background: "#faf8f5",
          color: "#1e1b2e",
          fontFamily:
            "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          className="absolute left-0 top-0 w-full"
          style={{
            height: 480,
            background:
              "linear-gradient(120deg, #2e1065 0%, #5b21b6 60%, #7c3aed 100%)",
            clipPath: "polygon(0 0, 100% 0, 100% 78%, 0 100%)",
          }}
        />
        <div
          className="absolute left-0 w-full"
          style={{
            top: 430,
            height: 26,
            background: "#f59e0b",
            clipPath: "polygon(0 60%, 100% 0, 100% 40%, 0 100%)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 520,
            height: 520,
            right: -200,
            bottom: -180,
            background:
              "radial-gradient(circle, rgba(124,58,237,0.12) 0%, rgba(124,58,237,0) 70%)",
          }}
        />

        <div className="relative flex h-full flex-col px-20 pb-16 pt-16">
          <div className="flex items-center gap-5 text-white">
            <div
              className="flex items-center justify-center rounded-2xl bg-white font-extrabold"
              style={{ width: 76, height: 76, color: "#7c3aed", fontSize: 46 }}
            >
              P
            </div>
            <div>
              <div className="text-4xl font-extrabold tracking-tight">
                {texts.brandTitle}
              </div>
              <div className="mt-1 text-2xl font-medium text-violet-200">
                {texts.brandSubtitle}
              </div>
            </div>
          </div>

          <h1
            className="mt-14 font-extrabold uppercase leading-[1.08] tracking-tight text-white"
            style={{ fontSize: 88 }}
          >
            <HeadlineLines text={texts.headline} />
            <span style={{ color: "#fbbf24" }}>{texts.accent}</span>
          </h1>

          <div className="mt-28">
            <p
              className="max-w-4xl text-[42px] leading-snug"
              style={{ color: "#3b3452" }}
            >
              {texts.body1}
            </p>
            <p
              className="mt-10 max-w-4xl text-[42px] font-bold leading-snug"
              style={{ color: "#2e1065" }}
            >
              {texts.body2}
            </p>
          </div>

          <div
            className="mt-16 rounded-3xl px-14 py-12"
            style={{
              background: "#ffffff",
              boxShadow: "0 20px 50px rgba(46,16,101,0.12)",
              border: "2px solid #ede9fe",
            }}
          >
            <div className="space-y-10">
              {texts.benefits.map((title, i) => (
                <div key={i} className="flex items-center gap-6">
                  <CheckCircle2
                    className="shrink-0"
                    style={{ width: 58, height: 58, color: "#16a34a" }}
                  />
                  <div
                    className="text-4xl font-bold"
                    style={{ color: "#1e1b2e" }}
                  >
                    {title}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto">
            <CtaCard inviteLink={inviteLink} texts={texts} />
            <div
              className="mt-6 flex items-center justify-center gap-3 text-2xl"
              style={{ color: "#6b6480" }}
            >
              <Smartphone style={{ width: 28, height: 28 }} />
              {texts.footer}
            </div>
          </div>
        </div>
      </div>
    );
  },
);
