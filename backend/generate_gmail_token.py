import os
import pickle
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
BASE_DIR = os.path.dirname(__file__)
GMAIL_DIR = os.path.join(BASE_DIR, "gmail")
CREDENTIALS_PATH = os.path.join(GMAIL_DIR, "gmail_credentials.json")
TOKEN_PATH = os.path.join(GMAIL_DIR, "gmail_token.pickle")

os.makedirs(GMAIL_DIR, exist_ok=True)

if not os.path.exists(CREDENTIALS_PATH):
    raise FileNotFoundError(
        "gmail_credentials.json not found. Place the Google OAuth client secret JSON in backend/gmail/gmail_credentials.json."
    )

flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
creds = flow.run_local_server(port=0)

with open(TOKEN_PATH, "wb") as f:
    pickle.dump(creds, f)

print(f"Ô£à Token saved to {TOKEN_PATH}")
