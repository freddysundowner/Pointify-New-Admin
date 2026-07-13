import {
  Smartphone,
  TrendingUp,
  Users,
  Wallet,
  BarChart3,
  ArrowRight,
} from "lucide-react";

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
          style={{ width: 340, height: 340, right: 60, top: 340 }}
        />

        {/* Content */}
        <div className="relative flex h-full flex-col px-20 py-16">
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
          <div className="mt-16">
            <div
              className="inline-block rounded-full bg-white/15 px-6 py-2 text-xl font-semibold tracking-wide text-violet-100"
              style={{ backdropFilter: "blur(4px)" }}
            >
              EARN WITH EVERY SHOP YOU SIGN UP
            </div>
            <h1
              className="mt-6 font-extrabold leading-[1.05] tracking-tight"
              style={{ fontSize: 88 }}
            >
              Become a<br />
              Pointify Partner.
              <br />
              <span className="text-violet-300">Get Paid to Grow.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-3xl leading-snug text-violet-100">
              Introduce shops to Kenya&apos;s smart point-of-sale system and
              earn commission on every subscription — month after month.
            </p>
          </div>

          {/* Benefits */}
          <div className="mt-14 grid grid-cols-2 gap-x-10 gap-y-8">
            {[
              {
                icon: Wallet,
                title: "Commission on every sale",
                text: "Earn when your shops subscribe & renew",
              },
              {
                icon: TrendingUp,
                title: "Recurring income",
                text: "Renewals keep paying you, every cycle",
              },
              {
                icon: Users,
                title: "Build your own team",
                text: "Recruit sub-partners and earn from their sales",
              },
              {
                icon: BarChart3,
                title: "Track everything",
                text: "Leads, signups & earnings in your dashboard",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-5">
                <div
                  className="flex shrink-0 items-center justify-center rounded-xl bg-white/15"
                  style={{ width: 64, height: 64 }}
                >
                  <Icon style={{ width: 34, height: 34 }} />
                </div>
                <div>
                  <div className="text-2xl font-bold">{title}</div>
                  <div className="mt-1 text-xl leading-snug text-violet-200">
                    {text}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-auto">
            <div
              className="flex items-center justify-between rounded-3xl bg-white px-12 py-9"
              style={{ color: "#2e1065" }}
            >
              <div>
                <div className="text-3xl font-extrabold">
                  Start earning today
                </div>
                <div className="mt-1 text-2xl font-semibold" style={{ color: "#7c3aed" }}>
                  partner.pointifypos.com
                </div>
              </div>
              <div
                className="flex items-center gap-3 rounded-2xl px-8 py-5 text-2xl font-bold text-white"
                style={{ background: "#7c3aed" }}
              >
                Join Free <ArrowRight style={{ width: 28, height: 28 }} />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-center gap-3 text-xl text-violet-200">
              <Smartphone style={{ width: 24, height: 24 }} />
              No fees to join · Payouts via M-Pesa · Works anywhere in Kenya
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
