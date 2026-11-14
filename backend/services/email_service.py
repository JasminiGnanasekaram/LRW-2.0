import base64
import os
import pickle
import secrets
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from html import escape

import requests

from config import get_settings


settings = get_settings()

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
GMAIL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "gmail"))
TOKEN_FILE = os.path.join(GMAIL_DIR, "gmail_token.pickle")


def generate_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def expiry(minutes: int = 60) -> datetime:
    return datetime.utcnow() + timedelta(minutes=minutes)


def _get_gmail_service():
    try:
        from google.auth.transport.requests import Request
        from googleapiclient.discovery import build
    except ImportError as exc:
        raise RuntimeError(
            "Gmail delivery dependencies are missing. Install backend requirements."
        ) from exc

    if not os.path.isfile(TOKEN_FILE):
        raise RuntimeError(
            "Gmail OAuth is not configured. Add Gmail OAuth credentials and run "
            "backend/generate_gmail_token.py."
        )

    with open(TOKEN_FILE, "rb") as token_file:
        creds = pickle.load(token_file)

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(TOKEN_FILE, "wb") as token_file:
            pickle.dump(creds, token_file)

    if not creds or not creds.valid:
        raise RuntimeError(
            "Gmail OAuth token is invalid. Run backend/generate_gmail_token.py again."
        )

    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def _gmail_address(service) -> str:
    # Set GMAIL_FROM to the authorized Gmail address for a send-only token.
    sender = os.getenv("GMAIL_FROM", "").strip()
    if sender:
        return sender

    profile = service.users().getProfile(userId="me").execute()
    address = profile.get("emailAddress")
    if not address:
        raise RuntimeError("Could not determine the Gmail sender. Set GMAIL_FROM.")

    return address


def _send_via_gmail(
    to: str,
    msg: MIMEMultipart,
    service=None,
    sender=None,
) -> None:
    service = service or _get_gmail_service()
    sender = sender or _gmail_address(service)

    msg["From"] = formataddr(("Language Resource Workbench", sender))
    msg["To"] = to

    raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")
    service.users().messages().send(
        userId="me",
        body={"raw": raw_message},
    ).execute()


def _send_via_brevo(to: str, subject: str, html_content: str) -> None:
    response = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={
            "api-key": settings.BREVO_API_KEY,
            "Content-Type": "application/json",
            "accept": "application/json",
        },
        json={
            "sender": {
                "name": "Language Resource Workbench",
                "email": settings.EMAIL_FROM,
            },
            "to": [{"email": to}],
            "subject": subject,
            "htmlContent": html_content,
        },
        timeout=20,
    )
    response.raise_for_status()


def send_email(to: str, subject: str, body: str) -> None:
    formatted_body = escape(body).replace("\n", "<br>")
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 40px;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff;
                    border-radius: 12px; padding: 40px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <h2 style="color: #1a3a2a; font-size: 22px; margin-bottom: 8px;">
            Language Resource Workbench
          </h2>
          <hr style="border: none; border-top: 1px solid #e2dbd3; margin-bottom: 24px;">
          <p style="color: #444; font-size: 15px; line-height: 1.6;">
            {formatted_body}
          </p>
        </div>
      </body>
    </html>
    """

    if settings.BREVO_API_KEY and settings.EMAIL_FROM:
        try:
            _send_via_brevo(to, subject, html_body)
            return
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status is None or not 400 <= status < 500 or status == 408:
                raise RuntimeError("Could not confirm Brevo email delivery.") from exc
            if not os.path.isfile(TOKEN_FILE):
                raise RuntimeError(
                    f"Brevo rejected the email (HTTP {status}) and Gmail is not configured."
                ) from exc
        except requests.RequestException as exc:
            raise RuntimeError("Could not confirm Brevo email delivery.") from exc

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    _send_via_gmail(to, msg)


def send_verification_email(to: str, token: str, base_url: str = None) -> None:
    url = (base_url or settings.APP_BASE_URL).rstrip("/")
    link = f"{url}/verify-email?token={token}"

    send_email(
        to,
        "Verify your LRW account",
        "Welcome to the Language Resource Workbench!\n\n"
        "Please verify your email address by clicking the link below:\n\n"
        f"{link}\n\n"
        "This link expires in 5 minutes.\n\n"
        "If you did not register, please ignore this email.",
    )


def send_reset_email(to: str, token: str, base_url: str = None) -> None:
    url = (base_url or settings.APP_BASE_URL).rstrip("/")
    link = f"{url}/reset-password?token={token}"

    send_email(
        to,
        "Reset your LRW password",
        "You requested a password reset for your LRW account.\n\n"
        "Click the link below to set a new password:\n\n"
        f"{link}\n\n"
        "This link expires in 5 minutes.\n\n"
        "If you did not request this, please ignore this email.",
    )