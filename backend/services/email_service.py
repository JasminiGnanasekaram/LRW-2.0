import secrets
import pickle
import base64
import os
from email.utils import formataddr
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta

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

    with open(TOKEN_FILE, "rb") as f:
        creds = pickle.load(f)
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(TOKEN_FILE, "wb") as f:
            pickle.dump(creds, f)
    if not creds or not creds.valid:
        raise RuntimeError(
            "Gmail OAuth token is invalid. Run backend/generate_gmail_token.py again."
        )
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def _gmail_address(service) -> str:
    profile = service.users().getProfile(userId="me").execute()
    address = profile.get("emailAddress")
    if not address:
        raise RuntimeError("Could not determine the Gmail account for the OAuth token.")
    return address


def _send_via_gmail(to: str, msg: MIMEMultipart, service=None, sender=None) -> None:
    service = service or _get_gmail_service()
    sender = sender or _gmail_address(service)
    msg["From"] = formataddr(("Language Resource Workbench", sender))
    msg["To"] = to
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    service.users().messages().send(
        userId="me",
        body={"raw": raw},
    ).execute()
    print(f"[email] Sent via Gmail API to {to}", flush=True)


def send_email(to: str, subject: str, body: str) -> None:
    html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 40px;">
          <div style="max-width: 480px; margin: 0 auto; background: #ffffff;
                      border-radius: 12px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <h2 style="color: #1a3a2a; font-size: 22px; margin-bottom: 8px;">
              Language Resource Workbench
            </h2>
            <hr style="border: none; border-top: 1px solid #e2dbd3; margin-bottom: 24px;">
            <p style="color: #444; font-size: 15px; line-height: 1.6;">
              {body.replace(chr(10), '<br>')}
            </p>
            <hr style="border: none; border-top: 1px solid #e2dbd3; margin-top: 32px;">
            <p style="color: #aaa; font-size: 12px; margin-top: 16px;">
              If you did not create an account, you can safely ignore this email.
            </p>
          </div>
        </body>
        </html>
        """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    _send_via_gmail(to, msg)


def send_verification_email(to: str, token: str, base_url: str = None) -> None:
    url = base_url or settings.APP_BASE_URL
    link = f"{url}/verify-email?token={token}"
    send_email(
        to,
        "Verify your LRW account",
        f"Welcome to the Language Resource Workbench!\n\n"
        f"Please verify your email address by clicking the link below:\n\n"
        f"{link}\n\n"
        f"This link expires in 5 minutes.\n\n"
        f"If you did not register, please ignore this email.",
    )


def send_reset_email(to: str, token: str, base_url: str = None) -> None:
    url = base_url or settings.APP_BASE_URL
    link = f"{url}/reset-password?token={token}"
    send_email(
        to,
        "Reset your LRW password",
        f"You requested a password reset for your LRW account.\n\n"
        f"Click the link below to set a new password:\n\n"
        f"{link}\n\n"
        f"This link expires in 5 minutes.\n\n"
        f"If you did not request this, please ignore this email.",
    )
