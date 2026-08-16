import secrets
import smtplib
import sys
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta

from config import get_settings

settings = get_settings()


def generate_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def expiry(minutes: int = 1440) -> datetime:
    """Default 1440 minutes = 24 hours"""
    return datetime.utcnow() + timedelta(minutes=minutes)


def send_email(to: str, subject: str, body: str) -> None:
    """Send email via SMTP. Falls back to terminal print in dev mode."""

    # Dev mode — print to terminal if SMTP not configured
    if not settings.SMTP_HOST or not settings.SMTP_PASSWORD:
        print("\n" + "="*60, flush=True)
        print("📧  DEV EMAIL — copy the link below", flush=True)
        print("="*60, flush=True)
        print(f"To:      {to}", flush=True)
        print(f"Subject: {subject}", flush=True)
        print("-"*60, flush=True)
        print(body, flush=True)
        print("="*60 + "\n", flush=True)
        sys.stdout.flush()
        return

    try:
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
        msg["From"] = f"Language Resource Workbench <{settings.SMTP_FROM}>"
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, int(settings.SMTP_PORT)) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, to, msg.as_string())

        print(f"[email] ✅ Sent '{subject}' to {to}", flush=True)

    except Exception as e:
        print(f"[email ERROR] ❌ {e}", flush=True)


def send_verification_email(to: str, token: str, base_url: str = None) -> None:
    url = base_url or settings.APP_BASE_URL
    link = f"{url}/verify-email?token={token}"
    send_email(
        to,
        "Verify your LRW account",
        f"Welcome to the Language Resource Workbench!\n\n"
        f"Please verify your email address by clicking the link below:\n\n"
        f"{link}\n\n"
        f"This link expires in 24 hours.\n\n"
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
        f"This link expires in 1 hour.\n\n"
        f"If you did not request this, please ignore this email.",
    )