from uuid import UUID
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError

from app import models, schemas
from app.config import get_settings
from app.repositories.machine_repository import MachineRepository


class MachineService:
    def __init__(self, db):
        self.repo = MachineRepository(db)

    def list_machines(
        self,
        page: int,
        page_size: int,
        region: str | None,
        gpu: str | None,
        status_filter: str | None,
        min_ping: int | None,
        max_ping: int | None,
        sort: str,
    ) -> schemas.MachinesPage:
        try:
            items, total = self.repo.list_machines(
                page=page,
                page_size=page_size,
                region=region,
                gpu=gpu,
                status=status_filter,
                min_ping=min_ping,
                max_ping=max_ping,
                sort=sort,
            )
            return schemas.MachinesPage(items=items, total=total, page=page, page_size=page_size)
        except SQLAlchemyError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Khong doc duoc danh sach may (kiem tra quyen DB)",
            ) from exc

    def get_machine_detail(self, machine_id: UUID, current_user: models.User) -> schemas.MachineDetailOut:
        machine = self.repo.get_machine_by_id(machine_id)
        if not machine:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay may")

        active_session = self.repo.get_active_session_for_machine(machine_id)
        last_session = self.repo.get_last_ended_session_for_user_machine(machine_id, current_user.id)

        return schemas.MachineDetailOut(
            machine=machine,
            active_session=active_session,
            last_session=last_session,
        )

    def get_active_user_session(self, current_user: models.User) -> schemas.SessionOut | None:
        return self.repo.get_active_session_for_user(current_user.id)

    def start_machine_session(self, machine_id: UUID, current_user: models.User) -> schemas.SessionOut:
        machine = self.repo.get_machine_by_id(machine_id)
        if not machine:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay may")
        if machine.status != "idle":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="May dang ban")

        session = self.repo.create_active_session(user_id=current_user.id, machine_id=machine.id)
        self.repo.set_machine_status(machine, "busy")
        self.repo.commit()
        self.repo.refresh(session)
        return session

    def stop_user_session(self, session_id: UUID, current_user: models.User) -> schemas.SessionOut:
        session = self.repo.get_session_by_id(session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay session")
        if session.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Khong co quyen dung session nay")
        if session.status != "active" or session.ended_at is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session khong dang active")

        session.status = "stopped"
        session.ended_at = datetime.utcnow()
        self.repo.db.add(session)

        if session.machine_id:
            machine = self.repo.get_machine_by_id(session.machine_id)
            if machine and machine.status == "busy":
                self.repo.set_machine_status(machine, "idle")

        self.repo.commit()
        self.repo.refresh(session)
        return session

    def build_session_ovpn(self, session_id: UUID, current_user: models.User) -> tuple[str, str]:
        session = self.repo.get_session_by_id(session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay session")
        if session.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Khong co quyen tai VPN file")
        if session.status != "active" or session.ended_at is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session khong dang active")
        if not session.machine_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session chua gan may")

        machine = self.repo.get_machine_by_id(session.machine_id)
        if not machine:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay may")

        filename = self._ovpn_filename(machine, session)
        content = self._render_ovpn_profile(machine, session, current_user)
        return filename, content

    def verify_vpn_connection(self, session_id: UUID, current_user: models.User) -> schemas.SessionOut:
        session = self.repo.get_session_by_id(session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay session")
        if session.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Khong co quyen kiem tra VPN")
        if session.status != "active" or session.ended_at is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session khong dang active")

        if not session.ip_address:
            session.ip_address = self._session_local_ip(session)

        self.repo.db.add(session)
        self.repo.commit()
        self.repo.refresh(session)
        return session

    def mark_sunshine_paired(self, session_id: UUID, current_user: models.User) -> schemas.SessionOut:
        session = self.repo.get_session_by_id(session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay session")
        if session.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Khong co quyen cap nhat Sunshine")
        if session.status != "active" or session.ended_at is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session khong dang active")
        if not session.machine_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session chua gan may")
        if not session.ip_address:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can ket noi VPN truoc khi ghep Sunshine")

        if not self.repo.has_session_log(session.id, "sunshine_paired"):
            self.repo.add_session_log(
                machine_id=session.machine_id,
                session_id=session.id,
                message="sunshine_paired",
            )

        self.repo.commit()
        self.repo.refresh(session)
        return session

    def _ovpn_filename(self, machine: models.Machine, session: models.VpnSession) -> str:
        machine_code = "".join(
            ch.lower() for ch in machine.code if ch.isascii() and (ch.isalnum() or ch in ("-", "_"))
        )
        if not machine_code:
            machine_code = "machine"
        return f"vpngaming-{machine_code}-{str(session.id)[:8]}.ovpn"

    def _render_ovpn_profile(
        self,
        machine: models.Machine,
        session: models.VpnSession,
        current_user: models.User,
    ) -> str:
        settings = get_settings()
        proto = settings.openvpn_protocol.lower()
        if proto not in {"udp", "tcp", "tcp-client"}:
            proto = "udp"

        ca_block = (
            f"\n<ca>\n{settings.openvpn_ca_cert.strip()}\n</ca>\n"
            if settings.openvpn_ca_cert
            else "\n# OPENVPN_CA_CERT is not configured. Add the real VPN CA in backend env before production.\n"
        )
        tls_crypt_block = (
            f"\n<tls-crypt>\n{settings.openvpn_tls_crypt_key.strip()}\n</tls-crypt>\n"
            if settings.openvpn_tls_crypt_key
            else ""
        )

        lines = [
            "# VPN Gaming OpenVPN profile",
            f"# Session: {session.id}",
            f"# User: {current_user.id}",
            f"# Machine: {machine.code}",
            f"# Region: {machine.region or 'unknown'}",
            "client",
            "dev tun",
            f"proto {proto}",
            f"remote {settings.openvpn_remote_host} {settings.openvpn_remote_port}",
            "resolv-retry infinite",
            "nobind",
            "persist-key",
            "persist-tun",
            "remote-cert-tls server",
            "cipher AES-256-GCM",
            "auth SHA256",
            "auth-nocache",
            "verb 3",
            "mute-replay-warnings",
            "pull-filter ignore redirect-gateway",
            "auth-user-pass",
            f"setenv UV_SESSION_ID {session.id}",
            f"setenv UV_MACHINE_ID {machine.id}",
            f"setenv UV_MACHINE_CODE {machine.code}",
            "",
            "# Production note: provision per-session credentials/certificates from OpenVPN/PKI service.",
        ]
        return "\n".join(lines) + ca_block + tls_crypt_block

    def _session_local_ip(self, session: models.VpnSession) -> str:
        # Software adapter: replace this with a real OpenVPN/pfSense lease lookup later.
        host_octet = (session.id.int % 230) + 20
        return f"10.8.0.{host_octet}"

    def resume_machine_session(self, machine_id: UUID, current_user: models.User) -> schemas.SessionOut:
        machine = self.repo.get_machine_by_id(machine_id)
        if not machine:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay may")
        if machine.status != "idle":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="May dang ban")

        last_session = self.repo.get_last_ended_session_for_user_machine(machine_id, current_user.id)
        if not last_session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chua co snapshot de tiep tuc")

        session = self.repo.create_active_session(user_id=current_user.id, machine_id=machine.id)
        self.repo.set_machine_status(machine, "busy")
        self.repo.commit()
        self.repo.refresh(session)
        return session
