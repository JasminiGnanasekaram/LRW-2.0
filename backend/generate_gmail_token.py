import os
import pickle
import shutil
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]

# Align paths with email_service.py
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
GMAIL_DIR = os.path.join(BACKEND_DIR, "gmail")
os.makedirs(GMAIL_DIR, exist_ok=True)

# Path to the source credentials file
# We check for both "gmail_credentials.json" and "gmail_credentials.json.json" in the backend directory
creds_source = os.path.join(BACKEND_DIR, "gmail_credentials.json")
if not os.path.exists(creds_source):
    alt_source = os.path.join(BACKEND_DIR, "gmail_credentials.json.json")
    if os.path.exists(alt_source):
        creds_source = alt_source

dest_creds = os.path.join(GMAIL_DIR, "gmail_credentials.json")
dest_token = os.path.join(GMAIL_DIR, "gmail_token.pickle")

# Copy credentials file to backend/gmail/gmail_credentials.json if needed
if os.path.exists(creds_source) and creds_source != dest_creds:
    shutil.copy2(creds_source, dest_creds)
    print(f"Copied credentials to {dest_creds}")

if not os.path.exists(dest_creds):
    raise FileNotFoundError(
        f"Please place your 'gmail_credentials.json' file in {BACKEND_DIR} or {GMAIL_DIR}"
    )

flow = InstalledAppFlow.from_client_secrets_file(dest_creds, SCOPES)
creds = flow.run_local_server(port=0)

with open(dest_token, "wb") as f:
    pickle.dump(creds, f)

print(f"✅ Token saved to {dest_token}")