"""Email sending utility (SMTP) and token generation for verification / password reset.

In dev (no SMTP_HOST), emails are printed to the console so you can copy the link.
"""
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
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
        print(f"\n[DEV EMAIL] To: {to}\nSubject: {subject}\n{body}\n")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg.attach(MIMEText(body, "html"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, to, msg.as_string())


def send_verification_email(to: str, token: str) -> None:
    link = f"{settings.APP_BASE_URL}/verify-email?token={token}"
    body = f"""
    <p>Welcome to the Language Resource Workbench!</p>
    <p>Verify your email by clicking the link below:</p>
    <p><a href="{link}">{link}</a></p>
    <p>This link expires in 24 hours.</p>
    """
    send_email(to, "Verify your LRW account", body)


def send_reset_email(to: str, token: str) -> None:
    link = f"{settings.APP_BASE_URL}/reset-password?token={token}"
    body = f"""
    <p>You requested a password reset.</p>
    <p>Click the link below to set a new password:</p>
    <p><a href="{link}">{link}</a></p>
    <p>This link expires in 1 hour. Ignore this email if you didn't request a reset.</p>
    """
    send_email(to, "Reset your LRW password", body)