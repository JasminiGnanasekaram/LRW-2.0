import secrets
import sys
import pickle
import base64
import os
import ssl
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta

from config import get_settings

settings = get_settings()

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
GMAIL_DIR = os.path.join(os.path.dirname(__file__), "..", "gmail")
TOKEN_FILE = os.path.join(GMAIL_DIR, "gmail_token.pickle")
CREDS_FILE = os.path.join(GMAIL_DIR, "gmail_credentials.json")


def generate_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def expiry(minutes: int = 60) -> datetime:
    return datetime.utcnow() + timedelta(minutes=minutes)


def _get_gmail_service(Request, build):
    creds = None
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "rb") as f:
            creds = pickle.load(f)
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(TOKEN_FILE, "wb") as f:
            pickle.dump(creds, f)
    if not creds or not creds.valid:
        raise Exception("Gmail token missing. Run generate_gmail_token.py first.")
    return build("gmail", "v1", credentials=creds)


def _send_via_smtp(to: str, msg: MIMEMultipart) -> None:
    smtp_host = settings.SMTP_HOST.strip()
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USER.strip()
    smtp_password = settings.SMTP_PASSWORD
    from_addr = settings.SMTP_FROM or smtp_user or "no-reply@lrw.local"

    msg["From"] = f"Language Resource Workbench <{from_addr}>"
    msg["To"] = to

    context = ssl.create_default_context()
    if smtp_port == 465:
        with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context, timeout=10) as server:
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.sendmail(from_addr, [to], msg.as_string())
    else:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.ehlo()
            if smtp_port == 587:
                server.starttls(context=context)
                server.ehlo()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.sendmail(from_addr, [to], msg.as_string())

    print(f"[email] Ô£à Sent via SMTP to {to}", flush=True)


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

    if settings.SMTP_HOST:
        try:
            _send_via_smtp(to, msg)
            return
        except Exception as e:
            print(f"[email SMTP ERROR] ÔØî {e}", flush=True)

    if os.path.exists(TOKEN_FILE):
        try:
            from google.auth.transport.requests import Request
            from googleapiclient.discovery import build

            msg["From"] = f"Language Resource Workbench <{settings.SMTP_FROM}>"
            msg["To"] = to
            msg["Subject"] = subject
            raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
            service = _get_gmail_service(Request, build)
            service.users().messages().send(
                userId="me",
                body={"raw": raw}
            ).execute()
            print(f"[email] Ô£à Sent '{subject}' to {to}", flush=True)
            return
        except Exception as e:
            print(f"[email GMAIL ERROR] ÔØî {e}", flush=True)

    print("\n" + "="*50, flush=True)
    print("­ƒôº  DEV EMAIL ÔÇö copy the link below", flush=True)
    print("="*50, flush=True)
    print(f"To:      {to}", flush=True)
    print(f"Subject: {subject}", flush=True)
    print("-"*50, flush=True)
    print(body, flush=True)
    print("="*50 + "\n", flush=True)
    sys.stdout.flush()


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
