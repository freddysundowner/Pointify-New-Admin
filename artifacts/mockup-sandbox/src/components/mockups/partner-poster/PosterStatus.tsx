import { CheckCircle2, Phone, Smartphone } from "lucide-react";
import qrUrl from "./qr.svg";

export function PosterStatus() {
  const scale = Number(
    new URLSearchParams(window.location.search).get("scale") ?? "1",
  );
  return (
    <div className="flex items-start justify-center bg-neutral-200">
      <div
        className="relative overflow-hidden text-white"
        style={{
          zoom: scale,
          width: 1080,
          height: 1920,
          background:
            "linear-gradient(160deg, #2e1065 0%, #4c1d95 35%, #6d28d9 70%, #7c3aed 100%)",
          fontFamily:
            "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Decorative circles */}
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

        {/* Content */}
        <div className="relative flex h-full flex-col px-20 py-20">
          {/* Brand */}
          <div className="flex items-center gap-5">
            <div
              className="flex items-center justify-center rounded-2xl bg-white font-extrabold"
              style={{ width: 84, height: 84, color: "#7c3aed", fontSize: 52 }}
            >
              P
            </div>
            <div>
              <div className="text-5xl font-extrabold tracking-tight">
                Pointify POS
              </div>
              <div className="mt-1 text-2xl font-medium text-violet-200">
                Partner Program
              </div>
            </div>
          </div>

          {/* Headline */}
          <div className="mt-20">
            <h1
              className="font-extrabold leading-[1.05] tracking-tight"
              style={{ fontSize: 104 }}
            >
              Turn Your
              <br />
              Contacts Into
              <br />
              <span className="text-violet-300">Income.</span>
            </h1>
            <p className="mt-10 max-w-3xl text-4xl leading-snug text-violet-100">
              Do you know shop owners or businesses around you that struggle to
              track stock, sales, profits, or expenses?
            </p>
            <p className="mt-8 max-w-3xl text-4xl font-semibold leading-snug">
              Introduce them to Pointify POS and earn commissions when they
              subscribe.
            </p>
          </div>

          {/* Benefits */}
          <div className="mt-16 space-y-9">
            {[
              "Free to Join",
              "No Capital Needed",
              "Work From Anywhere",
              "Paid via M-Pesa",
            ].map((title) => (
              <div key={title} className="flex items-center gap-6">
                <CheckCircle2
                  className="shrink-0 text-violet-300"
                  style={{ width: 56, height: 56 }}
                />
                <div className="text-4xl font-bold">{title}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-auto">
            <div
              className="flex items-center justify-between gap-8 rounded-3xl bg-white px-12 py-10"
              style={{ color: "#2e1065" }}
            >
              <div>
                <div
                  className="inline-block rounded-2xl px-8 py-4 text-5xl font-extrabold uppercase tracking-wide text-white"
                  style={{
                    background:
                      "linear-gradient(90deg, #7c3aed 0%, #a855f7 100%)",
                    boxShadow: "0 12px 30px rgba(124,58,237,0.45)",
                  }}
                >
                  Join Now!
                </div>
                <div
                  className="mt-5 text-3xl font-bold"
                  style={{ color: "#7c3aed" }}
                >
                  partner.pointifypos.com
                </div>
                <div
                  className="mt-7 text-2xl font-bold uppercase tracking-wider"
                  style={{ color: "#6d28d9" }}
                >
                  Or Call Us Today
                </div>
                <div className="mt-3 flex items-center gap-4 text-4xl font-extrabold">
                  <span
                    className="flex items-center justify-center rounded-full"
                    style={{ width: 58, height: 58, background: "#7c3aed" }}
                  >
                    <Phone
                      className="text-white"
                      style={{ width: 30, height: 30 }}
                    />
                  </span>
                  0720 044 055
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div
                  className="rounded-2xl border-4 bg-white p-4"
                  style={{ borderColor: "#7c3aed" }}
                >
                  <img
                    src={qrUrl}
                    alt="QR code for partner.pointifypos.com"
                    style={{ width: 230, height: 230 }}
                  />
                </div>
                <div className="text-xl font-bold" style={{ color: "#7c3aed" }}>
                  Scan to join
                </div>
              </div>
            </div>
            <div className="mt-7 flex items-center justify-center gap-3 text-2xl text-violet-200">
              <Smartphone style={{ width: 28, height: 28 }} />
              Scan the QR code or visit partner.pointifypos.com
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
