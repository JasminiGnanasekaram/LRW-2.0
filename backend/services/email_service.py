"""Email sending utility (SMTP) and token generation for verification / password reset.

In dev (no SMTP_HOST), emails are printed to the console so you can copy the link.
"""
import secrets
import smtplib
from email.message import EmailMessage
from datetime import datetime, timedelta

from config import get_settings

settings = get_settings()


def generate_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def expiry(hours: int = 24) -> datetime:
    return datetime.utcnow() + timedelta(hours=hours)


def send_email(to: str, subject: str, body: str) -> None:
    """Send an email; in dev, just print it."""
    if not settings.SMTP_HOST:
        print("\n--- DEV EMAIL (SMTP not configured) ---")
        print(f"To: {to}\nSubject: {subject}\n\n{body}")
        print("--- END EMAIL ---\n")
        return

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
        smtp.starttls()
        if settings.SMTP_USER:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(msg)


def send_verification_email(to: str, token: str) -> None:
    link = f"{settings.APP_BASE_URL}/verify-email?token={token}"
    send_email(
        to,
        "Verify your LRW account",
        f"Welcome to the Language Resource Workbench!\n\nVerify your email by clicking:\n{link}\n\nThis link expires in 24 hours.",
    )


def send_reset_email(to: str, token: str) -> None:
    link = f"{settings.APP_BASE_URL}/reset-password?token={token}"
    send_email(
        to,
        "Reset your LRW password",
        f"You requested a password reset.\n\nClick to set a new password:\n{link}\n\nThis link expires in 1 hour. Ignore if you didn't request this.",
    )
