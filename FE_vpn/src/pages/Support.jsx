import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

function Support() {
    const location = useLocation()
    const [expandedFaq, setExpandedFaq] = useState(null)

    useEffect(() => {
        if (!location.hash) return
        window.requestAnimationFrame(() => {
            document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
    }, [location.hash])

    const faqs = [
        {
            q: 'Làm sao để nạp tiền?',
            a: 'Bạn có thể nạp tiền bằng cách click vào nút "Nạp tiền" ở thanh menu hoặc sidebar. Hệ thống hỗ trợ thanh toán qua MoMo.'
        },
        {
            q: 'Ping cao có ảnh hưởng gì?',
            a: 'Ping cao sẽ làm tăng độ trễ khi chơi game. Chúng tôi khuyến khích chọn máy có ping dưới 50ms để có trải nghiệm tốt nhất.'
        },
        {
            q: 'Làm sao để kết nối VPN?',
            a: 'Sau khi khởi tạo phiên, tải file .ovpn và import vào OpenVPN client. Sau đó kết nối VPN và nhấn "Đã kết nối" trên hệ thống.'
        },
        {
            q: 'Snapshot là gì?',
            a: 'Snapshot lưu lại trạng thái game của bạn. Lần sau bạn có thể tiếp tục từ snapshot mà không cần setup lại từ đầu.'
        },
        {
            q: 'Tiền nạp có được hoàn lại không?',
            a: 'Số dư tài khoản có thể được hoàn lại trong vòng 7 ngày nếu chưa sử dụng. Vui lòng liên hệ hỗ trợ để được xử lý.'
        }
    ]

    const toggleFaq = (index) => {
        setExpandedFaq(expandedFaq === index ? null : index)
    }

    const scrollToDocs = () => {
        document.getElementById('docs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    return (
        <div className="stack">
            <div className="section-head">
                <div>
                    <p className="muted">Trung tâm hỗ trợ</p>
                    <h2>Hỗ trợ & FAQ</h2>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="support-actions">
                <div className="support-card">
                    <div className="support-icon">📧</div>
                    <h4>Email hỗ trợ</h4>
                    <p className="muted">support@vpngaming.vn</p>
                    <a className="btn secondary" href="mailto:support@vpngaming.vn">Gửi email</a>
                </div>
                <div className="support-card">
                    <div className="support-icon">💬</div>
                    <h4>Zalo/Telegram</h4>
                    <p className="muted">Chat trực tiếp 24/7</p>
                    <a className="btn secondary" href="https://t.me/vpngaming_support" target="_blank" rel="noopener noreferrer">Chat ngay</a>
                </div>
                <div className="support-card">
                    <div className="support-icon">📚</div>
                    <h4>Tài liệu</h4>
                    <p className="muted">Hướng dẫn chi tiết</p>
                    <button className="btn secondary" onClick={scrollToDocs}>Xem tài liệu</button>
                </div>
            </div>

            {/* FAQ Section */}
            <div className="card" id="faq">
                <div className="card-header">
                    <h3>Câu hỏi thường gặp</h3>
                </div>
                <div className="faq-list">
                    {faqs.map((faq, index) => (
                        <div key={index} className={`faq-item ${expandedFaq === index ? 'expanded' : ''}`}>
                            <button className="faq-question" onClick={() => toggleFaq(index)}>
                                <span>{faq.q}</span>
                                <span className="faq-toggle">{expandedFaq === index ? '−' : '+'}</span>
                            </button>
                            {expandedFaq === index && (
                                <div className="faq-answer">
                                    <p>{faq.a}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Tích hợp trực tiếp Tài Liệu Hướng Dẫn */}
            <Documentation />

            {/* Info Cards */}
            <div className="grid grid-2">
                <div className="card info-card" id="security-card">
                    <div className="info-header">
                        <span className="info-icon">🔒</span>
                        <h4>Bảo mật tài khoản</h4>
                    </div>
                    <ul className="info-list">
                        <li>Sử dụng mật khẩu mạnh, ít nhất 8 ký tự</li>
                        <li>Không chia sẻ thông tin đăng nhập</li>
                        <li>Đăng xuất khi dùng máy công cộng</li>
                        <li>Liên hệ ngay nếu phát hiện truy cập lạ</li>
                    </ul>
                </div>
                <div className="card info-card">
                    <div className="info-header">
                        <span className="info-icon">⚡</span>
                        <h4>Mẹo tối ưu trải nghiệm</h4>
                    </div>
                    <ul className="info-list">
                        <li>Chọn máy có ping thấp nhất</li>
                        <li>Sử dụng mạng có dây thay vì WiFi</li>
                        <li>Đóng các ứng dụng không cần thiết</li>
                        <li>Cập nhật Moonlight phiên bản mới nhất</li>
                    </ul>
                </div>
            </div>

            {/* Contact Form */}
            <div className="card">
                <div className="card-header">
                    <h3>Gửi yêu cầu hỗ trợ</h3>
                </div>
                <form className="support-form">
                    <label className="field">
                        Tiêu đề
                        <input type="text" placeholder="Mô tả ngắn vấn đề của bạn" />
                    </label>
                    <label className="field">
                        Loại vấn đề
                        <select>
                            <option value="">Chọn loại vấn đề</option>
                            <option value="payment">Thanh toán / Nạp tiền</option>
                            <option value="technical">Kỹ thuật / Kết nối</option>
                            <option value="account">Tài khoản</option>
                            <option value="other">Khác</option>
                        </select>
                    </label>
                    <label className="field">
                        Mô tả chi tiết
                        <textarea rows="4" placeholder="Mô tả chi tiết vấn đề bạn đang gặp phải..."></textarea>
                    </label>
                    <div className="actions">
                        <button type="submit" className="btn primary">Gửi yêu cầu</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function Documentation() {
  const [activeTab, setActiveTab] = useState('vpn')
  const [expandedFaq, setExpandedFaq] = useState(null)

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index)
  }

  return (
    <div className="card" id="docs">
      <div className="card-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <span>📚</span> Tài liệu hướng dẫn chi tiết
        </h3>
      </div>
      
      {/* Tab Selection using native .tab-nav and .tab-btn styles */}
      <div className="tab-nav" style={{ marginBottom: '20px' }}>
        <button 
          type="button"
          className={`tab-btn ${activeTab === 'vpn' ? 'active' : ''}`}
          onClick={() => setActiveTab('vpn')}
        >
          <span className="tab-icon">🌐</span> VPN
        </button>
        <button 
          type="button"
          className={`tab-btn ${activeTab === 'moonlight' ? 'active' : ''}`}
          onClick={() => setActiveTab('moonlight')}
        >
          <span className="tab-icon">🎮</span> Moonlight
        </button>
        <button 
          type="button"
          className={`tab-btn ${activeTab === 'faq' ? 'active' : ''}`}
          onClick={() => setActiveTab('faq')}
        >
          <span className="tab-icon">🛠</span> Lỗi thường gặp
        </button>
      </div>

      {/* Tab Content Area */}
      <div style={{ padding: '4px' }}>
        {activeTab === 'vpn' && (
          <div className="stack" style={{ gap: '16px' }}>
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
              <h4 style={{ color: 'var(--accent)', margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 600 }}>Mạng riêng ảo VPN tối ưu ping</h4>
              <p className="muted" style={{ fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>
                Kết nối VPN tạo đường truyền riêng siêu tốc giữa thiết bị của bạn và máy ảo chơi game, giúp định tuyến tối ưu nhất để đạt ping cực thấp và ổn định.
              </p>
            </div>

            {/* Vertical Stepper */}
            <div className="stepper-container">
              <div className="stepper-item">
                <div className="stepper-badge">1</div>
                <div className="stepper-content">
                  <h5 className="stepper-title">Tải ứng dụng OpenVPN Connect</h5>
                  <p className="stepper-desc">Tải & cài đặt phần mềm kết nối VPN chính thức phù hợp với máy của bạn.</p>
                  <div className="stepper-actions">
                    <a href="https://openvpn.net/client-connect-vpn-for-windows/" target="_blank" rel="noopener noreferrer" className="btn secondary" style={{ padding: '6px 12px', fontSize: '0.78rem', borderRadius: '6px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                      📥 Windows Client
                    </a>
                    <a href="https://openvpn.net/vpn-client/" target="_blank" rel="noopener noreferrer" className="btn ghost" style={{ padding: '6px 12px', fontSize: '0.78rem', borderRadius: '6px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                      Tải OS khác
                    </a>
                  </div>
                </div>
              </div>

              <div className="stepper-item">
                <div className="stepper-badge">2</div>
                <div className="stepper-content">
                  <h5 className="stepper-title">Khởi tạo và Tải file VPN (.ovpn)</h5>
                  <p className="stepper-desc">Truy cập mục <strong>Khởi tạo phiên</strong>, sau khi tạo máy thành công, bấm nút <strong>Tải File VPN (.ovpn)</strong> để nhận cấu hình kết nối.</p>
                </div>
              </div>

              <div className="stepper-item">
                <div className="stepper-badge">3</div>
                <div className="stepper-content">
                  <h5 className="stepper-title">Import file vào OpenVPN</h5>
                  <p className="stepper-desc">Mở OpenVPN Connect lên, kéo thả hoặc chọn file <code>.ovpn</code> vừa tải về để nhập cấu hình vào ứng dụng.</p>
                </div>
              </div>

              <div className="stepper-item">
                <div className="stepper-badge">4</div>
                <div className="stepper-content">
                  <h5 className="stepper-title">Kết nối và Trải nghiệm</h5>
                  <p className="stepper-desc">Gạt công tắc kết nối trên OpenVPN sang màu xanh lá. Khi biểu tượng hiện chữ Connected, bạn quay lại trang web này và nhấn <strong>Đã kết nối VPN</strong>.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'moonlight' && (
          <div className="stack" style={{ gap: '16px' }}>
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
              <h4 style={{ color: 'var(--accent-2)', margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 600 }}>Truyền phát Moonlight (độ trễ bằng 0)</h4>
              <p className="muted" style={{ fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>
                Moonlight là phần mềm streaming hiệu năng cao tốt nhất hiện nay, cho phép truyền tải hình ảnh 4K HDR siêu mượt mà không có độ trễ cảm nhận được.
              </p>
            </div>

            {/* Vertical Stepper */}
            <div className="stepper-container">
              <div className="stepper-item">
                <div className="stepper-badge">1</div>
                <div className="stepper-content">
                  <h5 className="stepper-title">Cài đặt phần mềm Moonlight</h5>
                  <p className="stepper-desc">Tải Moonlight client về máy khách của bạn (hỗ trợ PC, laptop, điện thoại, máy tính bảng...).</p>
                  <div className="stepper-actions">
                    <a href="https://moonlight-stream.org/" target="_blank" rel="noopener noreferrer" className="btn secondary" style={{ padding: '6px 12px', fontSize: '0.78rem', borderRadius: '6px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                      📥 Tải Moonlight Client
                    </a>
                  </div>
                </div>
              </div>

              <div className="stepper-item">
                <div className="stepper-badge">2</div>
                <div className="stepper-content">
                  <h5 className="stepper-title">Kết nối VPN trước khi mở ứng dụng</h5>
                  <p className="stepper-desc">Bắt buộc phải bật kết nối OpenVPN thành công (màu xanh lá) rồi mới mở ứng dụng Moonlight.</p>
                </div>
              </div>

              <div className="stepper-item">
                <div className="stepper-badge">3</div>
                <div className="stepper-content">
                  <h5 className="stepper-title">Dò tìm và kết nối máy ảo</h5>
                  <p className="stepper-desc">Moonlight sẽ tự động dò thấy máy ảo trong mạng local. Nhấp vào máy ảo đó trên màn hình Moonlight.</p>
                </div>
              </div>

              <div className="stepper-item">
                <div className="stepper-badge">4</div>
                <div className="stepper-content">
                  <h5 className="stepper-title">Nhập mã PIN xác minh bảo mật</h5>
                  <p className="stepper-desc">Một mã PIN gồm 4 chữ số sẽ hiện ra. Bạn hãy điền mã PIN này vào ô xác nhận mã PIN trên giao diện trang Web quản lý phiên và nhấn <strong>Xác nhận PIN</strong> để ghép đôi.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'faq' && (
          <div className="stack" style={{ gap: '12px' }}>
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginBottom: '4px' }}>
              <h4 style={{ color: '#fff', margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 600 }}>Khắc phục sự cố nhanh</h4>
              <p className="muted" style={{ fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>
                Tổng hợp các lỗi phổ biến nhất và giải pháp xử lý cực kỳ nhanh chóng từ đội ngũ kỹ thuật.
              </p>
            </div>

            {/* Accordion FAQ List inside docs */}
            <div className="docs-faq-list">
              <div className={`docs-faq-item error ${expandedFaq === 0 ? 'expanded' : ''}`}>
                <button className="docs-faq-question" onClick={() => toggleFaq(0)}>
                  <span>❌ Không tìm thấy máy ảo trên ứng dụng Moonlight?</span>
                  <span className="docs-faq-toggle-icon">{expandedFaq === 0 ? '▲' : '▼'}</span>
                </button>
                {expandedFaq === 0 && (
                  <div className="docs-faq-answer">
                    Hãy chắc chắn rằng phần mềm OpenVPN Connect đã được kết nối thành công (hiển thị màu xanh lá). Nếu vẫn không quét thấy, hãy thử tắt hoàn toàn ứng dụng Moonlight và mở lại để hệ thống quét lại mạng local. Ngoài ra, bạn cũng có thể bấm vào biểu tượng dấu cộng (+) ở góc trên bên phải Moonlight rồi nhập trực tiếp địa chỉ IP của máy chơi game ảo hiển thị trên trang web.
                  </div>
                )}
              </div>

              <div className={`docs-faq-item warning ${expandedFaq === 1 ? 'expanded' : ''}`}>
                <button className="docs-faq-question" onClick={() => toggleFaq(1)}>
                  <span>⚠️ Trình phát bị giật lag, ping nhảy vọt hoặc nhòe hình?</span>
                  <span className="docs-faq-toggle-icon">{expandedFaq === 1 ? '▲' : '▼'}</span>
                </button>
                {expandedFaq === 1 && (
                  <div className="docs-faq-answer">
                    Hiện tượng này do đường truyền mạng không ổn định. Khuyến nghị bạn sử dụng dây cáp mạng LAN thay vì Wi-Fi. Nếu sử dụng Wi-Fi, hãy ưu tiên băng tần 5GHz thay vì 2.4GHz. Hãy mở mục Cài đặt (Settings) trên Moonlight, giảm Bitrate xuống mức 15-20 Mbps, và chọn độ phân giải là 1080p 60fps để có được sự mượt mà tối đa.
                  </div>
                )}
              </div>

              <div className={`docs-faq-item error ${expandedFaq === 2 ? 'expanded' : ''}`}>
                <button className="docs-faq-question" onClick={() => toggleFaq(2)}>
                  <span>❌ Lỗi kết nối OpenVPN bị timeout / thất bại liên tục?</span>
                  <span className="docs-faq-toggle-icon">{expandedFaq === 2 ? '▲' : '▼'}</span>
                </button>
                {expandedFaq === 2 && (
                  <div className="docs-faq-answer">
                    File cấu hình kết nối VPN cũ đã hết hiệu lực. Bạn chỉ cần tắt kết nối cũ trên ứng dụng OpenVPN Connect đi, nhấn vào nút <strong>Khởi tạo lại phiên</strong> hoặc <strong>Khởi động lại máy</strong> trên trang quản lý web để cập nhật, sau đó tải lại file <code>.ovpn</code> mới về máy khách và import đè lên cấu hình cũ để kết nối lại.
                  </div>
                )}
              </div>

              <div className={`docs-faq-item tip ${expandedFaq === 3 ? 'expanded' : ''}`}>
                <button className="docs-faq-question" onClick={() => toggleFaq(3)}>
                  <span>💡 Làm thế nào để điều khiển hoặc cắm thêm tay cầm chơi game?</span>
                  <span className="docs-faq-toggle-icon">{expandedFaq === 3 ? '▲' : '▼'}</span>
                </button>
                {expandedFaq === 3 && (
                  <div className="docs-faq-answer">
                    Moonlight hỗ trợ tự động nhận diện và ánh xạ (map) hầu hết các loại tay cầm chơi game phổ biến (DualShock, Xbox Controller, Nintendo Switch Pro Controller...) khi bạn kết nối qua cổng USB hoặc Bluetooth với thiết bị khách của mình. Bạn chỉ cần cắm tay cầm trước khi bắt đầu stream game trên Moonlight là có thể trải nghiệm ngay lập tức.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Support
