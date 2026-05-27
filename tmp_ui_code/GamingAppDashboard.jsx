import {
  Gamepad2,
  Clock3,
  Wallet,
  Plus,
  User,
  ChevronDown,
  Server,
  Monitor,
  Cpu,
  ShieldCheck,
  Gauge,
  Wifi,
  CheckCircle2,
  CreditCard,
  Settings,
  FileText,
  Camera,
  Activity,
} from "lucide-react";

const machines = [
  { id: 1, flag: "🇻🇳", name: "Việt Nam", code: "VN-01", gpu: "RTX 3070", ping: 20, active: true },
  { id: 2, flag: "🇻🇳", name: "Việt Nam", code: "VN-02", gpu: "RTX 3070", ping: 22, active: false },
  { id: 3, flag: "🇸🇬", name: "Singapore", code: "SG-01", gpu: "RTX 4080", ping: 28, active: false },
];

const securityCards = [
  { tag: "Active", title: "Tài khoản", desc: "Rate-limit đăng nhập, lockout tạm thời và chính sách mật khẩu mạnh.", icon: ShieldCheck },
  { tag: "Session accepted", title: "VPN profile", desc: "File VPN được cấp theo từng phiên, tránh dùng lại profile cũ giữa các session.", icon: FileText },
  { tag: "Snapshot", title: "Cloud rig", desc: "Dừng phiên để trả máy, ghi nhận thời gian kết thúc và giữ trạng thái snapshot.", icon: Camera },
  { tag: "Minimal", title: "Log kỹ thuật", desc: "Chỉ lưu thông tin cần thiết cho vận hành, hỗ trợ và kiểm tra sự cố kết nối.", icon: Activity },
];

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-cyan-400/15 bg-[#061116]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 via-cyan-400 to-blue-700 text-lg font-black text-white shadow-lg shadow-cyan-500/20">
            VG
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">VPN Gaming</h1>
            <p className="text-sm text-slate-400">Cloud play network</p>
          </div>
        </div>

        <nav className="hidden items-center gap-3 lg:flex">
          <button className="rounded-2xl border border-cyan-300/40 bg-cyan-400/10 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/10">
            <Gamepad2 className="mr-2 inline h-4 w-4 text-cyan-300" />
            Play Center
          </button>
          {["Máy", "Khởi tạo"].map((item) => (
            <button key={item} className="rounded-2xl px-5 py-3 text-sm font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white">
              {item}
            </button>
          ))}
          <button className="flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-white">
            Menu <ChevronDown className="h-4 w-4" />
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-cyan-300 md:flex">
            <Clock3 className="h-4 w-4" /> 180m
          </div>
          <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-emerald-300 md:flex">
            <Wallet className="h-4 w-4" /> 50.000đ
          </div>
          <button className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/30 transition hover:scale-[1.03] active:scale-95">
            <Plus className="h-4 w-4" /> Nạp tiền
          </button>
          <button className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/10 md:flex">
            <User className="h-4 w-4" /> Tài khoản <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function MachineVisual() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-cyan-300/15 bg-[#0b1724] p-6 shadow-2xl shadow-cyan-950/20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_25%,rgba(34,211,238,0.22),transparent_32%),radial-gradient(circle_at_75%_45%,rgba(168,85,247,0.18),transparent_30%)]" />
      <div className="relative grid gap-5">
        <div className="flex items-center justify-between">
          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">
            MÁY HIỆN TẠI
          </span>
          <span className="flex items-center gap-2 text-sm text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_#34d399]" /> Đang chạy
          </span>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="grid h-36 flex-1 place-items-center rounded-3xl border border-cyan-300/10 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(168,85,247,0.14))]">
            <Cpu className="h-16 w-16 text-cyan-300 drop-shadow-[0_0_24px_rgba(34,211,238,.75)]" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-black text-white">Việt Nam • RTX 3070</h2>
            <p className="mt-2 text-sm text-slate-400">Route đề xuất cho cloud gaming</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Metric label="Ping" value="20 ms" />
              <Metric label="Ổn định" value="99%" />
              <Metric label="Mất gói" value="0%" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-t border-white/10 pt-5 md:grid-cols-4">
          <Spec label="GPU" value="NVIDIA RTX 3070" />
          <Spec label="CPU" value="AMD Ryzen 7 5700X" />
          <Spec label="RAM" value="32 GB DDR4" />
          <Spec label="SSD" value="1 TB NVMe" />
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-bold text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> Phiên đang hoạt động
          </span>
          <span className="text-sm text-slate-300">Uptime 01:32:45</span>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-cyan-300">{value}</p>
    </div>
  );
}

function Spec({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

export default function GamingAppDashboard() {
  return (
    <div className="min-h-screen bg-[#070b13] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(244,63,94,.13),transparent_30%),radial-gradient(circle_at_82%_8%,rgba(34,211,238,.18),transparent_36%)]" />
      <Navbar />

      <main className="relative mx-auto max-w-7xl space-y-5 px-6 py-6">
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-cyan-400/15 bg-[#0c1320]/90 p-10 shadow-2xl shadow-cyan-950/20">
            <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300">
              Cloud gaming control center
            </span>
            <h1 className="mt-6 max-w-xl text-5xl font-black leading-tight tracking-tight">
              Phiên cloud của bạn <span className="bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-transparent">đang chạy</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-400">
              Chọn route ping thấp, bật VPN, ghép Moonlight và vào game từ một luồng duy nhất.
            </p>
            <div className="mt-7 flex gap-4">
              <button className="rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3 font-bold shadow-lg shadow-red-500/25">
                ▶ Tiếp tục phiên
              </button>
              <button className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-slate-300 hover:bg-white/10">
                Chọn máy
              </button>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Hệ thống hoạt động ổn định
            </p>
          </div>
          <MachineVisual />
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <StatusCard dot="bg-emerald-400" title="Cloud PC" value="KR-01" icon={Server} />
          <StatusCard dot="bg-yellow-400" title="VPN" value="Chưa kết nối" icon={ShieldCheck} />
          <StatusCard dot="bg-yellow-400" title="Moonlight" value="Chờ pairing" icon={Monitor} />
          <StatusCard dot="bg-emerald-400" title="Gói / số dư" value="Gói Cơ Bản • 50.000đ" icon={CreditCard} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="rounded-3xl border border-white/10 bg-[#111827]/90 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Route ping thấp</p>
                <h2 className="text-xl font-black">Máy nên chọn</h2>
              </div>
              <button className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">Xem tất cả</button>
            </div>

            <div className="space-y-3">
              {machines.map((m) => (
                <div
                  key={m.id}
                  className={`grid grid-cols-[52px_1fr_120px_110px_90px] items-center gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/35 ${
                    m.active ? "border-cyan-300/35 bg-cyan-400/8" : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 text-sm font-bold text-cyan-300">
                    #{m.id}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{m.flag}</span>
                    <div>
                      <p className="font-black">{m.name}</p>
                      <p className="text-sm text-slate-500">{m.code}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400">{m.gpu}</p>
                  <p className="flex items-center gap-2 font-bold text-emerald-300">
                    <Wifi className="h-4 w-4" /> {m.ping} ms
                  </p>
                  <button className="rounded-xl border border-white/10 px-4 py-2 font-bold text-slate-300 hover:bg-white/10">
                    Chọn
                  </button>
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-5">
            <SidePanel title="Phiên hiện tại" heading="Đang hoạt động" desc="Quay lại wizard để tải VPN, kiểm tra kết nối và mở Moonlight." button="Mở wizard" />
            <SidePanel title="Dịch vụ" heading="Gói Cơ Bản" desc="Hết hạn 19/06/2026" button="Quản lý gói" />
          </aside>
        </section>

        <section className="grid gap-4 rounded-3xl border border-white/10 bg-[#111827]/90 p-5 lg:grid-cols-[1fr_4fr]">
          <div>
            <p className="text-sm text-slate-500">An tâm trải nghiệm</p>
            <h2 className="mt-2 text-xl font-black">Chính sách & bảo mật</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Các lớp bảo vệ cho tài khoản, phiên VPN và cloud rig khi chơi từ xa.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {securityCards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-xs font-bold text-emerald-300">{card.tag}</span>
                <h3 className="mt-4 font-black">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{card.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatusCard({ dot, title, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111827]/90 p-5">
      <div className="flex items-center justify-between">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <Icon className="h-5 w-5 text-slate-500" />
      </div>
      <p className="mt-4 text-sm text-slate-400">{title}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}

function SidePanel({ title, heading, desc, button }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#111827]/90 p-5">
      <p className="text-sm text-slate-500">{title}</p>
      <h3 className="mt-3 text-xl font-black">{heading}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-400">{desc}</p>
      <button className="mt-5 w-full rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 font-bold text-cyan-300 hover:bg-cyan-400/15">
        {button}
      </button>
    </div>
  );
}
