# VPN Gaming graduation project flow

Tai lieu nay dung de giai thich phien ban MVP/prototype cua du an.
He thong co backend, database, auth, vi tien, session, billing va lich su that.
Phan ha tang VM/VPN/Moonlight duoc boc qua simulation adapters de co the thay bang provider that khi trien khai production.

## Flow chuan

1. User chon may.
2. User bam Khoi tao may.
3. Backend kiem tra quyen, goi dich vu, so du va trial quota.
4. Backend tao active session va goi VM adapter.
5. VM adapter dua session sang `vm_running`, `waiting_vpn`, `waiting_stream`.
6. User tai file `.ovpn`.
7. Backend ghi log `vpn_profile_generated`.
8. User import OpenVPN va bam VPN da ket noi.
9. VPN adapter gan IP local va dua session sang `vpn_connected`.
10. User mo Moonlight/Sunshine va xac nhan da pair.
11. Streaming adapter dua session sang `playing` va `streaming`.
12. Backend set `billing_started_at` tai thoi diem stream ready.
13. Background billing moi phut tru vi hoac tru trial quota.
14. User dung phien.
15. Backend dong session, tra may ve idle/cooldown, luu billing event va lich su.

## Phan that trong do an

- Dang ky, dang nhap, JWT va phan quyen user/admin.
- Danh sach may, chi tiet may, trang thai may va cooldown.
- Kiem tra goi dich vu, trial quota, so du vi va daily cap.
- Tao session, dung session, resume snapshot theo goi.
- Sinh file OpenVPN profile theo session.
- Ghi log cac moc: VM running, VPN profile, VPN connected, Sunshine paired, Moonlight ready, billing started.
- Billing theo phut sau khi stream ready, khong tinh tien ngay luc boot VM.
- Lich su phien, so phut mien phi, so tien da tru, refund khi fail som.
- Frontend realtime flow voi loading, success, timestamp va trang thai san sang.
- May trial mac dinh cho demo: `VN-01`, `VN-02`, `SG-01` va cac ma `*-TRIAL-*` neu database co seed.

## Phan mo phong co chu dich

- `SimulatedVmProvider`: mo phong viec start/stop cloud VM.
- `SimulatedVpnProvider`: mo phong OpenVPN lease/route check va gan IP local.
- `SimulatedStreamingProvider`: mo phong Sunshine/Moonlight pairing result.

Day khong phai fake UI. Day la tang adapter cua backend. Khi co ha tang that, chi can thay cac adapter nay bang:

- Proxmox, VMware, AWS EC2, GCP Compute Engine hoac Hetzner API cho VM.
- OpenVPN Access Server, pfSense, WireGuard controller hoac lease database cho VPN.
- Sunshine API, Moonlight discovery/pairing workflow hoac agent chay tren VM cho streaming.

## Trang thai session nen bao cao

- `provisioning`: backend vua tao session.
- `vm_running`: VM da duoc start qua adapter.
- `waiting_vpn`: cho user tai va connect VPN.
- `vpn_connected`: VPN da co IP local.
- `waiting_stream`: chua tinh gio choi.
- `playing`: Moonlight/Sunshine ready, bat dau tinh billing.
- `grace_disconnected`: mat ket noi trong grace window.
- `idle_warning`: stream idle qua nguong canh bao.
- `stopped`: phien ket thuc binh thuong.
- `failed`: phien loi, co the refund neu fail som.

## Du de lam do an tot nghiep chua?

Du neu bao cao la "nen tang quan ly cloud gaming va billing, co simulation adapter cho ha tang".
Chua du neu tu nhan la "cloud gaming production that" vi con thieu VM provider that, VPN gateway that va Sunshine/Moonlight automation that.

De nang cap len production, uu tien:

1. Cai agent tren VM de bao cao heartbeat, stream activity va Sunshine status.
2. Tich hop mot VM provider that.
3. Tich hop VPN gateway that de doc lease/session thay vi gan IP mo phong.
4. Tu dong pair hoac huong dan pair Moonlight bang API/agent.
5. Them monitoring va audit log cho admin.
