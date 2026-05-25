import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { checkVpnConnection, downloadOvpn, getActiveSession, getMachine, markSunshinePaired, stopSession } from '../api/machines'

const steps = [
    {
        title: 'Chọn máy',
        desc: 'Chọn máy trống với ping tốt nhất.',
    },
    {
        title: 'Resume hoặc clone',
        desc: 'Kiểm tra snapshot gần nhất; nếu không có sẽ clone golden image.',
    },
    {
        title: 'Start VM',
        desc: 'qm start <vmid>, hiển thị loading.',
    },
    {
        title: 'VPN & Sunshine',
        desc: 'Cung cấp file .ovpn, kiểm tra online, ghép pin Sunshine.',
    },
    {
        title: 'Stream qua Moonlight',
        desc: 'Hiển thị IP local và hướng dẫn connect.',
    },
]

const guideContent = {
    setup: {
        eyebrow: 'Hướng dẫn kết nối',
        title: 'VPN & Sunshine pairing',
        tipLabel: 'Lưu ý',
        tip: 'Nếu VPN đã kết nối nhưng hệ thống vẫn báo chưa online, hãy đợi 5-10 giây rồi nhấn "Đã kết nối" để kiểm tra lại. IP local thường có dạng <strong>10.8.0.x</strong>.',
        steps: [
            {
                icon: '🔒',
                title: 'Bước 1 — Tải file VPN',
                color: '#00b8d9',
                items: [
                    'Bấm <strong>Tải file .ovpn</strong> để lấy cấu hình của phiên hiện tại.',
                    'Nếu có QR/link tải, dùng đúng file được tạo cho phiên này.',
                    'Không dùng lại file .ovpn từ phiên cũ vì IP hoặc credential có thể đã đổi.',
                ],
            },
            {
                icon: '🧩',
                title: 'Bước 2 — Import vào OpenVPN',
                color: '#7dd3fc',
                items: [
                    'Mở <strong>OpenVPN Connect</strong> trên máy tính hoặc điện thoại.',
                    'Import file .ovpn vừa tải, sau đó nhấn <strong>Connect</strong>.',
                    'Chờ trạng thái OpenVPN chuyển sang <strong>Connected</strong>.',
                ],
            },
            {
                icon: '📡',
                title: 'Bước 3 — Xác nhận VPN online',
                color: '#00e396',
                items: [
                    'Quay lại web và bấm <strong>Đã kết nối</strong> để hệ thống re-check.',
                    'Sau khi online, web sẽ hiển thị IP local của máy cloud.',
                    'Dùng IP local này để mở Sunshine hoặc thêm máy trong Moonlight.',
                ],
            },
            {
                icon: '☀️',
                title: 'Bước 4 — Ghép pin Sunshine',
                color: '#ffd700',
                items: [
                    'Mở <strong>https://&lt;IP_máy&gt;:47990</strong> sau khi VPN đã online.',
                    'Đăng nhập Sunshine bằng tài khoản được hệ thống cấp hoặc tài khoản mặc định nếu có.',
                    'Nhập PIN từ Moonlight vào Sunshine và nhấn <strong>Pair</strong> để lưu pairing.',
                ],
            },
        ],
    },
    play: {
        eyebrow: 'Hướng dẫn chơi',
        title: 'Stream qua Moonlight',
        tipLabel: 'Mẹo',
        tip: 'Nếu hình bị giật hoặc delay, giảm bitrate trước rồi mới giảm độ phân giải. Với mạng ổn định, <strong>1080p @ 60fps / 20 Mbps</strong> là điểm khởi đầu dễ dùng.',
        steps: [
            {
                icon: '🌙',
                title: 'Bước 1 — Mở Moonlight',
                color: '#a78bfa',
                items: [
                    'Đảm bảo OpenVPN vẫn đang ở trạng thái <strong>Connected</strong>.',
                    'Mở ứng dụng <strong>Moonlight</strong> trên thiết bị chơi.',
                    'Nếu Moonlight chưa thấy máy, bấm <strong>+</strong> và nhập IP local hiển thị trên web.',
                ],
            },
            {
                icon: '🔢',
                title: 'Bước 2 — Nhập PIN nếu được hỏi',
                color: '#ffd700',
                items: [
                    'Moonlight sẽ hiện PIN 4 số ở lần kết nối đầu tiên.',
                    'Nhập PIN đó vào trang Sunshine rồi nhấn <strong>Pair</strong>.',
                    'Sau khi ghép thành công, các lần sau thường không cần nhập lại PIN.',
                ],
            },
            {
                icon: '🎛️',
                title: 'Bước 3 — Chọn chất lượng stream',
                color: '#00b8d9',
                items: [
                    'Mở Settings trong Moonlight để chỉnh <strong>Resolution</strong>, <strong>FPS</strong> và <strong>Bitrate</strong>.',
                    'Mạng 30+ Mbps: thử 1080p, 60fps, 20 Mbps.',
                    'Nếu mạng yếu hơn, giảm bitrate xuống 10-15 Mbps để ưu tiên độ ổn định.',
                ],
            },
            {
                icon: '🎮',
                title: 'Bước 4 — Vào Desktop hoặc game',
                color: '#00e396',
                items: [
                    'Chọn <strong>Desktop</strong> hoặc game/app được Sunshine publish.',
                    'Khi chơi xong, thoát stream trong Moonlight trước.',
                    'Quay lại web và dừng phiên để stop VM, lưu snapshot và tránh tính giờ thêm.',
                ],
            },
        ],
    },
}

function GuideModal({ guide, onClose }) {
    const content = guide || guideContent.setup

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '20px',
                backdropFilter: 'blur(4px)',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'linear-gradient(145deg, #16213e 0%, #0f172a 100%)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px',
                    padding: '32px',
                    maxWidth: '680px',
                    width: '100%',
                    maxHeight: '85vh',
                    overflowY: 'auto',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                    position: 'relative',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>{content.eyebrow}</p>
                        <h3 style={{ margin: '4px 0 0', fontSize: '1.4rem', color: '#fff' }}>{content.title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '50%', width: '36px', height: '36px',
                            color: '#fff', cursor: 'pointer', fontSize: '1.1rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.2s',
                            flexShrink: 0,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                    >
                        ✕
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {content.steps.map((step, idx) => (
                        <div
                            key={idx}
                            style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: `1px solid rgba(255,255,255,0.07)`,
                                borderLeft: `3px solid ${step.color}`,
                                borderRadius: '12px',
                                padding: '18px 20px',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                <span style={{ fontSize: '1.3rem' }}>{step.icon}</span>
                                <h4 style={{ margin: 0, color: step.color, fontSize: '0.95rem', fontWeight: '700' }}>{step.title}</h4>
                            </div>
                            <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {step.items.map((item, i) => (
                                    <li key={i} style={{ color: '#cbd5e1', fontSize: '0.875rem', lineHeight: '1.5' }}
                                        dangerouslySetInnerHTML={{ __html: item }}
                                    />
                                ))}
                            </ol>
                        </div>
                    ))}
                </div>

                <div style={{
                    marginTop: '20px', padding: '14px 18px',
                    background: 'rgba(244,93,72,0.08)', border: '1px solid rgba(244,93,72,0.2)',
                    borderRadius: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start',
                }}>
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>💡</span>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#fca5a5', lineHeight: '1.5' }}>
                        <strong>{content.tipLabel}:</strong>{' '}
                        <span dangerouslySetInnerHTML={{ __html: content.tip }} />
                    </p>
                </div>
            </div>
        </div>
    )
}

function MoonlightModal({
    session,
    sunshinePaired,
    pairingSunshine,
    onClose,
    onCopyIp,
    onOpenSunshine,
    onMarkSunshinePaired,
}) {
    const ipAddress = session?.ip_address

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '20px',
                backdropFilter: 'blur(4px)',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'linear-gradient(145deg, #16213e 0%, #0f172a 100%)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px',
                    padding: '28px',
                    maxWidth: '720px',
                    width: '100%',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="section-head" style={{ marginBottom: '18px' }}>
                    <div>
                        <p className="muted">Moonlight / Sunshine</p>
                        <h3>Sẵn sàng kết nối máy cloud</h3>
                    </div>
                    <button type="button" className="btn ghost" onClick={onClose}>Đóng</button>
                </div>

                <div className="grid grid-2">
                    <div className="card info">
                        <p className="muted">IP local máy cloud</p>
                        <h2 style={{ margin: '6px 0 14px' }}>{ipAddress || 'Chưa có IP'}</h2>
                        <div className="actions">
                            <button type="button" className="btn secondary" onClick={onCopyIp} disabled={!ipAddress}>
                                Copy IP
                            </button>
                            <button type="button" className="btn ghost" onClick={onOpenSunshine} disabled={!ipAddress}>
                                Mở Sunshine
                            </button>
                        </div>
                    </div>

                    <div className="card info">
                        <p className="muted">Trạng thái</p>
                        <div className="status-list" style={{ marginTop: '10px' }}>
                            <div className="status">
                                <span className="dot success" /> VPN online
                            </div>
                            <div className="status">
                                <span className={`dot ${sunshinePaired ? 'success' : 'warning'}`} />
                                {sunshinePaired ? 'Sunshine đã ghép pin' : 'Sunshine chưa ghép pin'}
                            </div>
                            <div className="status">
                                <span className={`dot ${sunshinePaired ? 'success' : 'muted'}`} />
                                {sunshinePaired ? 'Sẵn sàng chơi qua Moonlight' : 'Chờ xác nhận pairing'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card border" style={{ marginTop: '16px' }}>
                    <h4>Các bước trong Moonlight</h4>
                    <ol className="bullet">
                        <li>Mở Moonlight trên thiết bị của bạn.</li>
                        <li>Nếu Moonlight chưa tự thấy máy, bấm dấu cộng và nhập IP local ở trên.</li>
                        <li>Nếu Moonlight hiện mã PIN, mở Sunshine rồi nhập mã PIN đó để ghép thiết bị.</li>
                        <li>Sau khi ghép pin thành công, bấm nút xác nhận bên dưới để web đánh dấu phiên sẵn sàng chơi.</li>
                    </ol>
                    <div className="actions">
                        <button
                            type="button"
                            className="btn primary"
                            onClick={onMarkSunshinePaired}
                            disabled={!ipAddress || sunshinePaired || pairingSunshine}
                        >
                            {sunshinePaired ? 'Đã ghép pin' : pairingSunshine ? 'Đang cập nhật...' : 'Tôi đã ghép pin thành công'}
                        </button>
                        <button type="button" className="btn ghost" onClick={onClose}>
                            Xong
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function Wizard({ ctx }) {
    const location = useLocation()
    const navigate = useNavigate()
    const [machine, setMachine] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [session, setSession] = useState(null)
    const [activeGuide, setActiveGuide] = useState(null)
    const [actionMessage, setActionMessage] = useState('')
    const [stopping, setStopping] = useState(false)
    const [downloadingOvpn, setDownloadingOvpn] = useState(false)
    const [checkingVpn, setCheckingVpn] = useState(false)
    const [pairingSunshine, setPairingSunshine] = useState(false)
    const [moonlightOpen, setMoonlightOpen] = useState(false)

    const params = useMemo(() => new URLSearchParams(location.search), [location.search])
    const machineId = params.get('machineId')
    const sessionId = params.get('sessionId')

    useEffect(() => {
        let cancelled = false
        async function load() {
            setError('')
            setLoading(true)
            try {
                let sessionData = session
                if (!sessionData) {
                    const raw = localStorage.getItem('active_session')
                    sessionData = raw ? JSON.parse(raw) : null
                    if (!sessionData && ctx?.token) {
                        sessionData = await getActiveSession(ctx.token)
                        if (sessionData) localStorage.setItem('active_session', JSON.stringify(sessionData))
                    }
                    if (!cancelled) setSession(sessionData)
                }

                const resolvedMachineId = machineId || sessionData?.machine_id
                if (resolvedMachineId) {
                    const data = await getMachine(resolvedMachineId, ctx?.token)
                    if (!cancelled) setMachine(data.machine)
                } else if (!cancelled) {
                    setError('Chưa chọn máy. Vui lòng quay lại trang Máy & phiên.')
                }
            } catch (err) {
                if (!cancelled) setError(err.message || 'Không tải được thông tin máy')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        load()
        return () => {
            cancelled = true
        }
    }, [machineId, sessionId, ctx?.token, session])

    const isActiveSession = session?.status === 'active' && !session?.ended_at
    const vpnOnline = Boolean(session?.ip_address)
    const sunshinePaired = Boolean(session?.sunshine_paired)
    const moonlightReady = vpnOnline && sunshinePaired

    const handleDownloadOvpn = async () => {
        if (!session?.id || !isActiveSession) {
            setError('Chưa có phiên active để tải file .ovpn.')
            return
        }

        setError('')
        setActionMessage('')
        setDownloadingOvpn(true)
        try {
            const { blob, filename } = await downloadOvpn(session.id, ctx?.token)
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = filename
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
            setActionMessage('Đã tải file .ovpn cho phiên hiện tại.')
        } catch (err) {
            setError(err.message || 'Không thể tải file .ovpn')
        } finally {
            setDownloadingOvpn(false)
        }
    }

    const handleCheckVpnConnection = async () => {
        if (!session?.id || !isActiveSession) {
            setError('Chưa có phiên active để kiểm tra VPN.')
            return
        }

        setError('')
        setActionMessage('')
        setCheckingVpn(true)
        try {
            const checked = await checkVpnConnection(session.id, ctx?.token)
            setSession(checked)
            localStorage.setItem('active_session', JSON.stringify(checked))
            setActionMessage(`VPN đã online. IP local máy: ${checked.ip_address || 'đang cập nhật'}.`)
        } catch (err) {
            setError(err.message || 'Không thể kiểm tra kết nối VPN')
        } finally {
            setCheckingVpn(false)
        }
    }

    const handleCopyIp = async () => {
        if (!session?.ip_address) {
            setError('Chưa có IP local để copy.')
            return
        }

        try {
            await navigator.clipboard.writeText(session.ip_address)
            setError('')
            setActionMessage(`Đã copy IP local: ${session.ip_address}.`)
        } catch (err) {
            setError('Không thể copy tự động. Bạn hãy copy IP local trực tiếp trên màn hình.')
        }
    }

    const handleOpenSunshine = () => {
        if (!session?.ip_address) {
            setError('Chưa có IP local để mở Sunshine.')
            return
        }

        window.open(`https://${session.ip_address}:47990`, '_blank', 'noopener,noreferrer')
        setError('')
        setActionMessage('Đã mở trang Sunshine. Nếu trình duyệt báo chứng chỉ không tin cậy, hãy tiếp tục theo hướng dẫn nội bộ.')
    }

    const handleOpenMoonlightFlow = () => {
        if (!vpnOnline) {
            setError('Hãy kết nối VPN trước khi mở hướng dẫn Moonlight.')
            return
        }

        setError('')
        setMoonlightOpen(true)
    }

    const handleMarkSunshinePaired = async () => {
        if (!session?.id || !vpnOnline) {
            setError('Cần VPN online trước khi đánh dấu Sunshine đã ghép pin.')
            return
        }

        setError('')
        setActionMessage('')
        setPairingSunshine(true)
        try {
            const paired = await markSunshinePaired(session.id, ctx?.token)
            setSession(paired)
            localStorage.setItem('active_session', JSON.stringify(paired))
            setActionMessage('Đã ghi nhận Sunshine pairing. Phiên đã sẵn sàng chơi qua Moonlight.')
        } catch (err) {
            setError(err.message || 'Không thể cập nhật trạng thái Sunshine')
        } finally {
            setPairingSunshine(false)
        }
    }

    const handleStopSession = async () => {
        if (!session?.id) {
            setError('Chưa có phiên active để dừng.')
            return
        }

        const confirmed = window.confirm('Bạn chắc chắn muốn dừng phiên hiện tại? Hệ thống sẽ trả máy về trạng thái trống và ghi lại thời gian kết thúc.')
        if (!confirmed) return

        setError('')
        setActionMessage('')
        setStopping(true)
        try {
            const stopped = await stopSession(session.id, ctx?.token)
            localStorage.removeItem('active_session')
            setSession(stopped)
            setMachine((prev) => prev ? { ...prev, status: 'idle' } : prev)
            setActionMessage('Đã dừng phiên. Máy đã được trả về trạng thái trống.')
        } catch (err) {
            setError(err.message || 'Không thể dừng phiên')
        } finally {
            setStopping(false)
        }
    }

    return (
        <div className="stack">
            {activeGuide && <GuideModal guide={guideContent[activeGuide]} onClose={() => setActiveGuide(null)} />}
            {moonlightOpen && (
                <MoonlightModal
                    session={session}
                    sunshinePaired={sunshinePaired}
                    pairingSunshine={pairingSunshine}
                    onClose={() => setMoonlightOpen(false)}
                    onCopyIp={handleCopyIp}
                    onOpenSunshine={handleOpenSunshine}
                    onMarkSunshinePaired={handleMarkSunshinePaired}
                />
            )}
            
            <div className="section-head">
                <div>
                    <p className="muted">Luồng khởi tạo</p>
                    <h2>Wizard chuẩn hoá</h2>
                </div>
                <div className="actions">
                    <button className="btn ghost" onClick={() => navigate('/app/machines')}>Chọn máy khác</button>
                    <button className="btn primary" onClick={() => navigate('/app/machines')}>Quay lại máy</button>
                </div>
            </div>

            <div className="card">
                <div className="section-head">
                    <div>
                        <p className="muted">Phiên đang chơi</p>
                        <h3>{machine ? `${machine.region || 'N/A'} · ${machine.code}` : 'Chưa chọn máy'}</h3>
                    </div>
                    {machine && (
                        <div className="actions">
                            <span className={`badge ${machine.status === 'idle' ? 'success' : 'warning'}`}>
                                {machine.status === 'idle' ? 'Trống' : 'Đang bận'}
                            </span>
                            {isActiveSession && (
                                <button type="button" className="btn ghost" onClick={handleStopSession} disabled={stopping}>
                                    {stopping ? 'Đang dừng...' : 'Dừng phiên'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
                {loading && <p className="muted">Đang tải thông tin máy...</p>}
                {!loading && error && <div className="alert error">{error}</div>}
                {!loading && actionMessage && <div className="alert success">{actionMessage}</div>}
                {!loading && !error && machine && (
                    <div className="grid grid-3">
                        <div>
                            <p className="muted">GPU</p>
                            <h4>{machine.gpu || 'N/A'}</h4>
                        </div>
                        <div>
                            <p className="muted">Ping</p>
                            <h4>{machine.ping_ms ?? '?'} ms</h4>
                        </div>
                        <div>
                            <p className="muted">Session</p>
                            <h4>{session?.id ? session.id.slice(0, 8) : 'N/A'}</h4>
                            <span className={`pill ghost ${isActiveSession ? '' : 'muted'}`}>
                                {session?.status || 'Chưa có phiên'}
                            </span>
                        </div>
                        <div>
                            <p className="muted">IP local</p>
                            <h4>{session?.ip_address || 'Chưa online'}</h4>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-5 timeline">
                {steps.map((step, idx) => (
                    <div key={step.title} className="card border">
                        <span className="pill ghost">Bước {idx + 1}</span>
                        <h4>{step.title}</h4>
                        <p className="muted">{step.desc}</p>
                    </div>
                ))}
            </div>

            <div className="card">
                <h4>Checklist vận hành</h4>
                <ul className="bullet">
                    <li>Verify còn giờ chơi trước khi khởi tạo.</li>
                    <li>Nếu có snapshot: resume; nếu không: clone từ golden image.</li>
                    <li>Hiển thị progress rõ: Clone/Resume → Start VM → VPN file → Kiểm tra online → Sunshine pin → Moonlight connect.</li>
                    <li>Khi user bấm dừng: dừng đếm giờ, stop VM, convert disk lưu snapshot.</li>
                    <li>Hiển thị log tóm tắt: VMID, IP local, ping, thời gian khởi tạo.</li>
                </ul>
            </div>

            <div className="grid grid-2">
                <div className="card">
                    <h4>VPN & kết nối</h4>
                    <ol className="bullet">
                        <li>Tải file .ovpn (link/QR).</li>
                        <li>Kết nối VPN, nhấn “Đã kết nối” để re-check.</li>
                        <li>Hiển thị IP local máy sau khi online.</li>
                        <li>Ghép pin Sunshine lần đầu, lưu pairing.</li>
                    </ol>
                    <div className="actions">
                        <button
                            type="button"
                            className="btn secondary"
                            onClick={handleDownloadOvpn}
                            disabled={!isActiveSession || downloadingOvpn}
                        >
                            {downloadingOvpn ? 'Đang tải...' : 'Tải file .ovpn'}
                        </button>
                        <button
                            type="button"
                            className="btn primary"
                            onClick={handleCheckVpnConnection}
                            disabled={!isActiveSession || checkingVpn}
                        >
                            {checkingVpn ? 'Đang kiểm tra...' : 'Đã kết nối VPN'}
                        </button>
                        <button type="button" className="btn ghost" onClick={() => setActiveGuide('setup')}>Hướng dẫn chi tiết</button>
                    </div>
                </div>
                <div className="card">
                    <h4>Kiểm tra trạng thái</h4>
                    <div className="status-list">
                        <div className="status">
                            <span className="dot success" /> VM đã start
                        </div>
                        <div className="status">
                            <span className={`dot ${vpnOnline ? 'success' : 'warning'}`} />
                            {vpnOnline ? `VPN online · ${session.ip_address}` : 'VPN chưa online'}
                        </div>
                        <div className="status">
                            <span className={`dot ${sunshinePaired ? 'success' : vpnOnline ? 'warning' : 'muted'}`} />
                            {sunshinePaired ? 'Sunshine đã ghép pin' : vpnOnline ? 'Sẵn sàng ghép pin Sunshine' : 'Sunshine chờ VPN online'}
                        </div>
                        <div className="status">
                            <span className={`dot ${moonlightReady ? 'success' : 'muted'}`} />
                            {moonlightReady ? 'Sẵn sàng chơi qua Moonlight' : 'Moonlight chưa sẵn sàng'}
                        </div>
                    </div>
                    <div className="actions">
                        <button type="button" className="btn primary" onClick={handleOpenMoonlightFlow} disabled={!vpnOnline}>Mở Moonlight</button>
                        {vpnOnline && !sunshinePaired && (
                            <button type="button" className="btn secondary" onClick={handleMarkSunshinePaired} disabled={pairingSunshine}>
                                {pairingSunshine ? 'Đang cập nhật...' : 'Đã ghép Sunshine'}
                            </button>
                        )}
                        <button type="button" className="btn ghost" onClick={() => setActiveGuide('play')}>Xem hướng dẫn chơi</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Wizard
