import sys
sys.path.insert(0, ".")

from services.email_service import send_verification_email

print("Sending test email...")
send_verification_email("jasminsekar2001@gmail.com", "test-token-123")
print("Done!")