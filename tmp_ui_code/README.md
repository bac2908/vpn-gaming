# VPN Gaming UI Mockup Components

Có 2 file React:

1. `GamingAppDashboard.jsx`  
   - Trang `/app` kiểu Mini Shadow PC / Cloud Gaming Dashboard.

2. `SessionLauncherPage.jsx`  
   - Trang khởi tạo phiên cloud rig: Boot VM → VPN route → Sunshine → Moonlight.

## Cài icon

```bash
npm install lucide-react
```

## Cách dùng

Copy 2 file vào:

```text
FE_vpn/src/pages/
```

Ví dụ trong `App.jsx`:

```jsx
import GamingAppDashboard from "./pages/GamingAppDashboard";
import SessionLauncherPage from "./pages/SessionLauncherPage";

export default function App() {
  return <GamingAppDashboard />;
}
```

Hoặc dùng router để map:
- `/app` → `GamingAppDashboard`
- `/wizard` hoặc `/launch` → `SessionLauncherPage`
```
