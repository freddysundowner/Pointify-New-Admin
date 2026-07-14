import { CheckCircle2, Phone, Smartphone } from "lucide-react";
import qrUrl from "./qr.svg";

export function Poster() {
  return (
    <div className="flex items-start justify-center bg-neutral-200">
      <div
        className="relative overflow-hidden text-white"
        style={{
          width: 1080,
          height: 1350,
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
            width: 620,
            height: 620,
            right: -220,
            top: -220,
            background:
              "radial-gradient(circle, rgba(196,181,253,0.25) 0%, rgba(196,181,253,0) 70%)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 500,
            height: 500,
            left: -180,
            bottom: -160,
            background:
              "radial-gradient(circle, rgba(167,139,250,0.2) 0%, rgba(167,139,250,0) 70%)",
          }}
        />
        <div
          className="absolute rounded-full border border-white/10"
          style={{ width: 340, height: 340, right: 60, top: 300 }}
        />

        {/* Content */}
        <div className="relative flex h-full flex-col px-20 py-14">
          {/* Brand */}
          <div className="flex items-center gap-5">
            <div
              className="flex items-center justify-center rounded-2xl bg-white font-extrabold"
              style={{ width: 72, height: 72, color: "#7c3aed", fontSize: 44 }}
            >
              P
            </div>
            <div>
              <div className="text-4xl font-extrabold tracking-tight">
                Pointify POS
              </div>
              <div className="text-lg font-medium text-violet-200">
                Partner Program
              </div>
            </div>
          </div>

          {/* Headline */}
          <div className="mt-8">
            <h1
              className="font-extrabold leading-[1.05] tracking-tight"
              style={{ fontSize: 80 }}
            >
              Turn Your
              <br />
              Contacts Into
              <br />
              <span className="text-violet-300">Income.</span>
            </h1>
            <p className="mt-6 max-w-3xl text-3xl leading-snug text-violet-100">
              Do you know shop owners or businesses around you that struggle to
              track stock, sales, profits, or expenses?
            </p>
            <p className="mt-5 max-w-3xl text-3xl font-semibold leading-snug">
              Introduce them to Pointify POS and earn commissions when they
              subscribe.
            </p>
          </div>

          {/* Benefits */}
          <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-7">
            {[
              "Free to Join",
              "No Capital Needed",
              "Work From Anywhere",
              "Paid via M-Pesa",
            ].map((title) => (
              <div key={title} className="flex items-center gap-4">
                <CheckCircle2
                  className="shrink-0 text-violet-300"
                  style={{ width: 44, height: 44 }}
                />
                <div className="text-3xl font-bold">{title}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-auto">
            <div
              className="flex items-center justify-between gap-8 rounded-3xl bg-white px-10 py-6"
              style={{ color: "#2e1065" }}
            >
              <div>
                <div className="text-4xl font-extrabold">Join Today</div>
                <div
                  className="mt-2 text-3xl font-bold"
                  style={{ color: "#7c3aed" }}
                >
                  partner.pointifypos.com
                </div>
                <div className="mt-4 flex items-center gap-3 text-2xl font-semibold">
                  <span
                    className="flex items-center justify-center rounded-full"
                    style={{ width: 40, height: 40, background: "#7c3aed" }}
                  >
                    <Phone
                      className="text-white"
                      style={{ width: 22, height: 22 }}
                    />
                  </span>
                  0720 044 055
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div
                  className="rounded-2xl border-4 bg-white p-3"
                  style={{ borderColor: "#7c3aed" }}
                >
                  <img
                    src={qrUrl}
                    alt="QR code for partner.pointifypos.com"
                    style={{ width: 170, height: 170 }}
                  />
                </div>
                <div className="text-lg font-bold" style={{ color: "#7c3aed" }}>
                  Scan to join
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-center gap-3 text-xl text-violet-200">
              <Smartphone style={{ width: 24, height: 24 }} />
              Scan the QR code or visit partner.pointifypos.com
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
