export const CLIENT_TOOL_LINKS = {
    openvpn: 'https://openvpn.net/client/',
    moonlight: 'https://moonlight-stream.org/',
    openvpnGuide: '/app/support#guide-openvpn',
    moonlightGuide: '/app/support#guide-moonlight',
}

export const CLIENT_TOOL_STEPS = [
    {
        id: 'openvpn',
        title: 'Cài OpenVPN Connect',
        desc: 'Dùng để import file .ovpn của từng phiên và bật VPN trước khi ghép máy.',
    },
    {
        id: 'moonlight',
        title: 'Cài Moonlight',
        desc: 'Dùng để thêm PC bằng IP local và stream game từ máy cloud về thiết bị của bạn.',
    },
    {
        id: 'ovpn',
        title: 'Tải file .ovpn theo phiên',
        desc: 'Mỗi phiên có profile riêng. Tải xong thì import vào OpenVPN Connect rồi bật Connected.',
    },
    {
        id: 'pair',
        title: 'Pair bằng IP local',
        desc: 'Sau khi VPN online, mở Moonlight, nhập IP local, lấy PIN và xác nhận trên Sunshine Web.',
    },
]

export const SUNSHINE_HOST_NOTE = 'Sunshine đã chạy trên máy cloud. Người chơi chỉ cần mở Sunshine Web khi Moonlight yêu cầu nhập PIN, không cần tải Sunshine về máy cá nhân.'
