# Deploy miễn phí lên Render

Hướng dẫn này dùng Render Free để chạy một service duy nhất:

- FastAPI backend phục vụ API.
- React frontend được build vào `BE_vpn/app/static`.
- PostgreSQL dùng Render Postgres Free.
- Miền miễn phí là subdomain dạng `https://<ten-app>.onrender.com`.

> Lưu ý: Render Free phù hợp demo/đồ án. Web service free có thể ngủ sau một thời gian không có traffic; Postgres Free có giới hạn và có thể hết hạn theo chính sách Render.
>
> Deploy này public được website, API, admin, auth, billing demo và database. Phần VPN/OpenVPN/GPU máy chơi thật cần hạ tầng riêng có server/VM/GPU/network phù hợp; Render Free không thay thế phần hạ tầng game/VPN thật.

## 1. Chuẩn bị GitHub

1. Commit toàn bộ code.
2. Push repo lên GitHub.
3. Đảm bảo repo có các file:
   - `Dockerfile.render`
   - `render.yaml`

## 2. Tạo Blueprint trên Render

1. Vào https://dashboard.render.com/
2. Chọn **New +** -> **Blueprint**.
3. Connect GitHub repo của dự án.
4. Render sẽ đọc `render.yaml` và tạo:
   - `vpn-gaming` web service
   - `vpn-gaming-db` Postgres database
5. Khi Render hỏi secret `SEED_ADMIN_PASSWORD`, nhập mật khẩu admin mạnh, ví dụ tự tạo bằng:

```bash
python -c "import secrets; print(secrets.token_urlsafe(24))"
```

## 3. Sửa URL sau khi biết domain thật

Sau deploy lần đầu, Render sẽ cấp URL, ví dụ:

```text
https://vpn-gaming-abcd.onrender.com
```

Vào service `vpn-gaming` -> **Environment** và sửa các biến này theo URL thật:

```env
APP_BASE_URL=https://vpn-gaming-abcd.onrender.com
CORS_ORIGINS=https://vpn-gaming-abcd.onrender.com
MOMO_REDIRECT_URL=https://vpn-gaming-abcd.onrender.com/app/topup/result
MOMO_IPN_URL=https://vpn-gaming-abcd.onrender.com/payments/momo/ipn
```

Sau đó bấm **Manual Deploy** -> **Deploy latest commit**.

## 4. Kiểm tra sau deploy

Mở:

```text
https://vpn-gaming-abcd.onrender.com/health
```

Kết quả đúng:

```json
{"status":"ok"}
```

Mở trang:

```text
https://vpn-gaming-abcd.onrender.com
```

Admin portal:

```text
https://vpn-gaming-abcd.onrender.com/admin-portal/login
```

Tài khoản admin:

```text
Email: admin@vpngaming.com
Password: mật khẩu bạn nhập ở SEED_ADMIN_PASSWORD
```

## 5. Đăng nhập, đăng ký, Google OAuth

Mặc định bản Render Free có thể chưa có SMTP và Google OAuth. Ứng dụng sẽ tự xử lý như sau:

- Luôn giữ nút **Tiếp tục với Google** trên màn đăng nhập/đăng ký.
- Nếu chưa có `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, bấm nút Google sẽ báo cần cấu hình OAuth.
- Ẩn **Quên mật khẩu?** nếu chưa có SMTP thật.
- Tự kích hoạt tài khoản mới sau khi đăng ký nếu chưa có SMTP, để demo/deploy free dùng được ngay.
- Tài khoản đã lỡ ở trạng thái pending trước đó sẽ được kích hoạt khi đăng nhập đúng mật khẩu nếu chưa có SMTP.

Nếu muốn bật xác thực email và quên mật khẩu, vào service `vpn-gaming` -> **Environment** và thêm:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=no-reply@your-domain.com
SMTP_USE_TLS=true
```

Nếu muốn bật Google OAuth, thêm:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://vpn-gaming.onrender.com/auth/google/callback
```

Trong Google Cloud Console, OAuth Client phải có **Authorized redirect URI** đúng y hệt:

```text
https://vpn-gaming.onrender.com/auth/google/callback
```

Sau khi thêm biến môi trường, bấm **Manual Deploy** -> **Deploy latest commit**.

## 6. Nếu muốn dùng miền miễn phí khác

Render đã cho miền miễn phí `*.onrender.com`, dễ nhất và có HTTPS sẵn.

Nếu bạn có VPS/home server riêng thì có thể dùng DuckDNS để lấy subdomain miễn phí dạng:

```text
ten-ban-chon.duckdns.org
```

Với Render Free, nên dùng luôn `*.onrender.com`; không cần DuckDNS.
