# tmp_ui_code - UI prototypes

Thư mục này chứa các component React thử nghiệm được dùng làm bản nháp giao diện cho VPN Gaming. Đây không phải source production đang chạy.

## File hiện có

| File | Vai trò |
| --- | --- |
| `GamingAppDashboard.jsx` | Mockup dashboard người dùng kiểu cloud gaming/play center. |
| `SessionLauncherPage.jsx` | Mockup màn khởi tạo phiên: boot VM, VPN route, Sunshine và Moonlight. |

## Source production nằm ở đâu

Các màn hình thật của frontend hiện nằm trong:

```text
FE_vpn/src/pages/Dashboard.jsx
FE_vpn/src/pages/Machines.jsx
FE_vpn/src/pages/Wizard.jsx
FE_vpn/src/pages/History.jsx
FE_vpn/src/pages/Subscriptions.jsx
FE_vpn/src/pages/Support.jsx
FE_vpn/src/pages/Admin.jsx
```

Router thật nằm trong:

```text
FE_vpn/src/App.jsx
```

## Khi nào dùng thư mục này

Dùng `tmp_ui_code/` như tài liệu tham khảo thiết kế hoặc nơi lấy lại ý tưởng UI cũ. Không nên copy nguyên file vào `FE_vpn/src/pages/` nếu chưa đối chiếu với:

- API wrapper hiện tại trong `FE_vpn/src/api/`;
- auth/session state trong `FE_vpn/src/App.jsx`;
- style chính trong `FE_vpn/src/App.css`, `src/index.css` và các CSS theo page;
- route thật: `/app`, `/app/machines`, `/app/wizard`, `/app/history`, `/app/subscriptions`, `/admin-portal/*`.

## Nếu muốn preview prototype

Các component này là React component độc lập và cần package icon:

```powershell
cd FE_vpn
npm install
```

`lucide-react` đã có trong frontend hiện tại, nên thường không cần cài thêm. Nếu muốn thử lại prototype, hãy import tạm trong môi trường dev và không commit việc thay route production nếu chỉ để xem giao diện.

## Ghi chú

- Prototype có thể lệch với API/backend hiện tại.
- Prototype có thể thiếu flow mới như billing PAYG, trial, snapshot/resume, topup history chỉ hiển thị giao dịch đã cộng ví.
- Khi cần sửa giao diện đang chạy, sửa trực tiếp trong `FE_vpn/src/pages/` và CSS tương ứng.
