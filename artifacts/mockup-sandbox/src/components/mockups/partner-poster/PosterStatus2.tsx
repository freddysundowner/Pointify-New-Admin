import { CheckCircle2, Phone, Smartphone } from "lucide-react";
import qrUrl from "./qr.svg";

export function PosterStatus2() {
  const scale = Number(
    new URLSearchParams(window.location.search).get("scale") ?? "1",
  );
  return (
    <div className="flex items-start justify-center bg-neutral-200">
      <div
        className="relative overflow-hidden"
        style={{
          zoom: scale,
          width: 1080,
          height: 1920,
          background: "#faf8f5",
          color: "#1e1b2e",
          fontFamily:
            "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top angled band */}
        <div
          className="absolute left-0 top-0 w-full"
          style={{
            height: 480,
            background:
              "linear-gradient(120deg, #2e1065 0%, #5b21b6 60%, #7c3aed 100%)",
            clipPath: "polygon(0 0, 100% 0, 100% 78%, 0 100%)",
          }}
        />
        {/* Amber accent stripe */}
        <div
          className="absolute left-0 w-full"
          style={{
            top: 430,
            height: 26,
            background: "#f59e0b",
            clipPath: "polygon(0 60%, 100% 0, 100% 40%, 0 100%)",
          }}
        />
        {/* Bottom decorative circle */}
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

        {/* Content */}
        <div className="relative flex h-full flex-col px-20 pb-16 pt-16">
          {/* Brand on purple band */}
          <div className="flex items-center gap-5 text-white">
            <div
              className="flex items-center justify-center rounded-2xl bg-white font-extrabold"
              style={{ width: 76, height: 76, color: "#7c3aed", fontSize: 46 }}
            >
              P
            </div>
            <div>
              <div className="text-4xl font-extrabold tracking-tight">
                Pointify POS
              </div>
              <div className="mt-1 text-2xl font-medium text-violet-200">
                Partner Program
              </div>
            </div>
          </div>

          {/* Headline on band */}
          <h1
            className="mt-14 font-extrabold uppercase leading-[1.08] tracking-tight text-white"
            style={{ fontSize: 88 }}
          >
            Looking for
            <br />
            <span style={{ color: "#fbbf24" }}>Extra Income?</span>
          </h1>

          {/* Body */}
          <div className="mt-28">
            <p
              className="max-w-4xl text-[42px] leading-snug"
              style={{ color: "#3b3452" }}
            >
              Know a shop owner who still struggles with stock management,
              tracking profits, or recording sales?
            </p>
            <p
              className="mt-10 max-w-4xl text-[42px] font-bold leading-snug"
              style={{ color: "#2e1065" }}
            >
              Introduce them to Pointify POS and get rewarded for every
              successful referral.
            </p>
          </div>

          {/* Benefits card */}
          <div
            className="mt-16 rounded-3xl px-14 py-12"
            style={{
              background: "#ffffff",
              boxShadow: "0 20px 50px rgba(46,16,101,0.12)",
              border: "2px solid #ede9fe",
            }}
          >
            <div className="space-y-10">
              {[
                "Free Registration",
                "No Capital Needed",
                "Work From Anywhere",
                "Paid via M-Pesa",
              ].map((title) => (
                <div key={title} className="flex items-center gap-6">
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

          {/* CTA */}
          <div className="mt-auto">
            <div
              className="flex items-center justify-between gap-8 rounded-3xl px-12 py-10 text-white"
              style={{
                background:
                  "linear-gradient(120deg, #2e1065 0%, #5b21b6 55%, #7c3aed 100%)",
                boxShadow: "0 24px 60px rgba(46,16,101,0.35)",
              }}
            >
              <div>
                <div
                  className="inline-block rounded-full px-9 py-4 text-4xl font-extrabold uppercase tracking-wide"
                  style={{ background: "#f59e0b", color: "#2e1065" }}
                >
                  Join Today
                </div>
                <div className="mt-6 text-3xl font-bold text-violet-200">
                  partner.pointifypos.com
                </div>
                <div className="mt-6 flex items-center gap-4 text-4xl font-extrabold">
                  <span
                    className="flex items-center justify-center rounded-full bg-white"
                    style={{ width: 56, height: 56 }}
                  >
                    <Phone
                      style={{ width: 30, height: 30, color: "#7c3aed" }}
                    />
                  </span>
                  0720 044 055
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-2xl bg-white p-4">
                  <img
                    src={qrUrl}
                    alt="QR code for partner.pointifypos.com"
                    style={{ width: 220, height: 220 }}
                  />
                </div>
                <div className="text-xl font-bold text-violet-200">
                  Scan to join
                </div>
              </div>
            </div>
            <div
              className="mt-6 flex items-center justify-center gap-3 text-2xl"
              style={{ color: "#6b6480" }}
            >
              <Smartphone style={{ width: 28, height: 28 }} />
              Scan the QR code or visit partner.pointifypos.com
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
