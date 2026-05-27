import {
  Gamepad2,
  Clock3,
  Wallet,
  Plus,
  User,
  ChevronDown,
  CloudLightning,
  Server,
  ShieldCheck,
  Sun,
  Moon,
  CheckCircle2,
  Circle,
  Loader2,
  Wifi,
  Lock,
  Rocket,
  FileText,
  Gamepad,
  ArrowRight,
  Cpu,
} from "lucide-react";

const rigs = [
  { flag: "🇰🇷", name: "Seoul - KR-01", spec: "RTX 3080 • 32GB RAM • 1TB NVMe", ping: 55, selected: true },
  { flag: "🇸🇬", name: "Singapore - SG-01", spec: "RTX 4080 • 32GB RAM • 1TB NVMe", ping: 28 },
  { flag: "🇯🇵", name: "Tokyo - JP-01", spec: "RTX 3070 • 16GB RAM • 1TB NVMe", ping: 65 },
  { flag: "🇩🇪", name: "Frankfurt - DE-01", spec: "RTX 3080 • 32GB RAM • 1TB NVMe", ping: 78 },
];

const steps = [
  { id: 1, title: "Cloud rig", sub: "Chọn máy", state: "done" },
  { id: 2, title: "Boot VM", sub: "Khởi động", state: "active" },
  { id: 3, title: "VPN route", sub: "Kết nối", state: "locked" },
  { id: 4, title: "Moonlight", sub: "Vào chơi", state: "locked" },
];

const logs = [
  "[19:22:01] VM KR-01 is powering on ... OK",
  "[19:22:03] System initialization ... OK",
  "[19:22:04] Creating VPN profile ... OK",
  "[19:22:05] Connecting to VPN server ...",
];

function Navbar() {
  return (
    <header className="border-b border-cyan-400/15 bg-[#060b13]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-red-500 via-violet-500 to-cyan-500 font-black">
            VG
          </div>
          <div>
            <h1 className="text-lg font-black">VPN Gaming</h1>
            <p className="text-sm text-slate-400">Cloud play network</p>
          </div>
        </div>

        <nav className="hidden items-center gap-3 lg:flex">
          {["Play Center", "Máy", "Khởi tạo", "Lịch sử", "Gói dịch vụ", "Hỗ trợ"].map((item) => (
            <button
              key={item}
              className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                item === "Khởi tạo"
                  ? "border border-cyan-300/40 bg-cyan-400/10 text-white shadow-lg shadow-cyan-500/10"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Pill icon={Clock3} text="180m" color="text-cyan-300" />
          <Pill icon={Wallet} text="50.000đ" color="text-emerald-300" />
          <button className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-3 font-bold shadow-lg shadow-red-500/30">
            <Plus className="h-4 w-4" /> Nạp tiền
          </button>
          <button className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 md:flex">
            <User className="h-5 w-5 text-cyan-300" />
            <span className="text-sm font-bold">Nguyễn Văn A</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Pill({ icon: Icon, text, color }) {
  return (
    <div className={`hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black ${color} md:flex`}>
      <Icon className="h-4 w-4" /> {text}
    </div>
  );
}

export default function SessionLauncherPage() {
  return (
    <div className="min-h-screen bg-[#060b13] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(59,130,246,.16),transparent_28%),radial-gradient(circle_at_80%_16%,rgba(168,85,247,.14),transparent_30%)]" />
      <Navbar />

      <main className="relative mx-auto max-w-7xl space-y-5 px-6 py-6">
        <section className="grid gap-5 lg:grid-cols-[1.2fr_.9fr]">
          <div className="relative overflow-hidden rounded-3xl border border-cyan-400/15 bg-[#0b1220]/90 p-10">
            <CloudLightning className="absolute left-8 top-8 h-40 w-40 text-cyan-400/20 blur-[1px]" />
            <div className="relative">
              <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase text-cyan-300">
                Session launcher
              </span>
              <h1 className="mt-6 max-w-xl text-5xl font-black leading-tight">
                Đưa cloud rig vào <span className="bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-transparent">trạng thái chơi</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-400">
                Boot máy, tải VPN profile, xác nhận route và pair Moonlight trong một flow duy nhất.
              </p>
              <div className="mt-7 flex gap-4">
                <button className="rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-7 py-3 font-black shadow-lg shadow-red-500/30">
                  ▶ Khởi tạo phiên
                </button>
                <button className="rounded-2xl border border-white/10 bg-white/5 px-7 py-3 font-bold text-slate-300 hover:bg-white/10">
                  Chọn máy khác
                </button>
              </div>
            </div>
          </div>

          <CurrentMachine />
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          {steps.map((s) => (
            <StepCard key={s.id} step={s} />
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[380px_1fr_430px]">
          <RigSelector />
          <BootProcess />
          <Readiness />
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#0f1725]/90 p-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
            <div>
              <p className="mb-4 text-sm font-black uppercase text-slate-400">Luồng kỹ thuật</p>
              <div className="grid gap-3 md:grid-cols-5">
                <FlowItem icon={Rocket} title="Boot VM" desc="Khởi động máy ảo" />
                <FlowItem icon={FileText} title="VPN profile" desc="Tải và import profile" />
                <FlowItem icon={ShieldCheck} title="VPN check" desc="Kiểm tra kết nối" />
                <FlowItem icon={Sun} title="Sunshine pair" desc="Ghép nối Sunshine" />
                <FlowItem icon={Gamepad} title="Moonlight stream" desc="Bắt đầu stream" />
              </div>
            </div>
            <div className="border-t border-white/10 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <h3 className="text-xl font-black text-cyan-300">Ghi chú</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">Giữ ứng dụng chạy nền để duy trì phiên ổn định.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function CurrentMachine() {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0f1725]/90 p-6">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-sm font-black uppercase text-cyan-300">Máy hiện tại</span>
        <span className="flex items-center gap-2 text-sm text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Đang chạy</span>
      </div>

      <div className="grid gap-6 md:grid-cols-[170px_1fr]">
        <div className="grid h-32 place-items-center rounded-3xl border border-cyan-300/15 bg-[radial-gradient(circle,rgba(34,211,238,.22),transparent_60%)]">
          <Cpu className="h-16 w-16 text-cyan-300 drop-shadow-[0_0_20px_rgba(34,211,238,.7)]" />
        </div>
        <div>
          <h2 className="text-2xl font-black">RTX 3080</h2>
          <p className="mt-1 text-slate-400">10GB GDDR6X</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Metric title="Ping" value="55 ms" />
            <Metric title="Jitter" value="2 ms" />
            <Metric title="Loss" value="0%" />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-3">
        <Spec label="CPU" value="AMD Ryzen 7 5700X" />
        <Spec label="RAM" value="32 GB DDR4" />
        <Spec label="SSD" value="1 TB NVMe" />
        <Spec label="Session ID" value="26d73a98" />
        <Spec label="IP Local" value="10.10.0.15" />
        <Spec label="Uptime" value="01:32:45" />
      </div>
    </div>
  );
}

function Metric({ title, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-1 text-lg font-black text-cyan-300">{value}</p>
    </div>
  );
}

function Spec({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function StepCard({ step }) {
  const isDone = step.state === "done";
  const isActive = step.state === "active";
  return (
    <div className={`flex items-center gap-4 rounded-3xl border p-5 ${isActive ? "border-cyan-300/60 bg-cyan-400/10 shadow-lg shadow-cyan-500/10" : isDone ? "border-emerald-400/25 bg-emerald-400/10" : "border-white/10 bg-white/[0.03]"}`}>
      <div className={`grid h-10 w-10 place-items-center rounded-2xl font-black ${isActive ? "bg-cyan-400 text-black" : isDone ? "bg-emerald-400 text-black" : "bg-white/10 text-slate-400"}`}>
        {step.id}
      </div>
      <div className="flex-1">
        <p className="font-black">{step.title}</p>
        <p className="text-sm text-slate-400">{step.sub}</p>
      </div>
      {isDone ? <CheckCircle2 className="text-emerald-300" /> : isActive ? <Loader2 className="animate-spin text-cyan-300" /> : <Lock className="text-slate-500" />}
    </div>
  );
}

function RigSelector() {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0f1725]/90 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-black uppercase text-cyan-300">Chọn máy</h2>
        <button className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300">Tất cả vùng</button>
      </div>
      <div className="space-y-3">
        {rigs.map((rig) => (
          <div key={rig.name} className={`flex items-center gap-4 rounded-2xl border p-4 ${rig.selected ? "border-cyan-300/60 bg-cyan-400/10" : "border-white/10 bg-white/[0.03]"}`}>
            <span className="text-3xl">{rig.flag}</span>
            <div className="flex-1">
              <p className="font-black">{rig.name}</p>
              <p className="text-sm text-slate-400">{rig.spec}</p>
            </div>
            <span className={`font-black ${rig.ping <= 35 ? "text-emerald-300" : rig.ping <= 65 ? "text-yellow-300" : "text-red-300"}`}>
              <Wifi className="mr-1 inline h-4 w-4" /> {rig.ping} ms
            </span>
            {rig.selected ? <CheckCircle2 className="text-cyan-300" /> : <Circle className="text-slate-600" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function BootProcess() {
  const rows = [
    ["Boot VM", "Khởi động máy ảo", "19:22:01", "done"],
    ["VPN routing", "Kết nối VPN và thiết lập route", "19:22:04", "active"],
    ["Sunshine pairing", "Ghép nối Sunshine", "--:--:--", "wait"],
    ["Moonlight stream", "Sẵn sàng vào chơi", "--:--:--", "wait"],
  ];

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0f1725]/90 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-black uppercase text-cyan-300">Quá trình khởi tạo</h2>
        <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-sm font-bold text-emerald-300">● Live</span>
      </div>

      <div className="space-y-3">
        {rows.map(([title, desc, time, state]) => (
          <div key={title} className="grid grid-cols-[40px_1fr_90px] items-center rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            {state === "done" ? <CheckCircle2 className="text-emerald-300" /> : state === "active" ? <Loader2 className="animate-spin text-cyan-300" /> : <Circle className="text-slate-600" />}
            <div>
              <p className="font-black">{title}</p>
              <p className={`text-sm ${state === "active" ? "text-cyan-300" : "text-slate-400"}`}>{desc}</p>
            </div>
            <p className="text-sm text-slate-400">{time}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-4 font-mono text-sm leading-6 text-emerald-300">
        {logs.map((log) => <p key={log}>{log}</p>)}
      </div>
    </div>
  );
}

function Readiness() {
  const checks = [
    ["VM đang chạy", "Máy ảo đã khởi động thành công", "Sẵn sàng", "done", Server],
    ["VPN chưa online", "Đang kết nối VPN...", "Đang kết nối", "active", ShieldCheck],
    ["Sunshine chờ pairing", "Chờ ghép nối Sunshine", "Chờ xử lý", "wait", Sun],
    ["Moonlight chưa sẵn sàng", "Chưa thể stream", "Chờ xử lý", "wait", Moon],
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-[#0f1725]/90 p-5">
        <h2 className="mb-4 font-black uppercase text-cyan-300">Kiểm tra sẵn sàng</h2>
        <div className="space-y-4">
          {checks.map(([title, desc, label, state, Icon]) => (
            <div key={title} className="flex items-center gap-4">
              <Icon className={state === "done" ? "text-emerald-300" : state === "active" ? "text-yellow-300" : "text-slate-500"} />
              <div className="flex-1">
                <p className="font-black">{title}</p>
                <p className="text-sm text-slate-400">{desc}</p>
              </div>
              <span className={state === "done" ? "text-emerald-300" : state === "active" ? "text-yellow-300" : "text-slate-400"}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#0f1725]/90 p-5">
        <p className="text-sm font-black uppercase text-slate-500">Tiếp theo</p>
        <h3 className="mt-3 text-xl font-black">Kết nối VPN</h3>
        <p className="mt-3 text-sm leading-6 text-slate-400">Tải VPN profile, import vào OpenVPN và quay lại xác nhận.</p>
        <button className="mt-5 rounded-2xl border border-violet-300/30 bg-violet-400/10 px-5 py-3 font-bold text-violet-300">
          Mở Moonlight ↗
        </button>
      </div>
    </div>
  );
}

function FlowItem({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-center gap-4">
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-300">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="font-black">{title}</p>
        <p className="text-sm text-slate-400">{desc}</p>
      </div>
      <ArrowRight className="hidden text-cyan-300 md:block" />
    </div>
  );
}
