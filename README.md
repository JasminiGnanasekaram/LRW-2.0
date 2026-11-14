# Language Resource Workbench (LRW)

A centralized platform to upload, process, analyze, and search language resources.
Implements the SRS document end-to-end: auth + email verification + password reset,
multi-format upload (text/PDF/image/audio/URL), text extraction (PDF parse / OCR /
Whisper STT / web scrape), cleaning, NLP analysis, keyword + filtered search,
admin dashboard, charts, CSV/JSON export, and optional async processing via Celery.

## Tech Stack

- **Frontend:** React (Vite) + React Router + Axios + Recharts
- **Backend:** Python 3.10+ / FastAPI / Uvicorn
- **Database:** MongoDB (motor async driver, pymongo for the worker)
- **Auth:** JWT + bcrypt; email verification + password reset via SMTP (or console in dev)
- **Text Extraction:** pdfplumber (PDF), Pillow + pytesseract (OCR), faster-whisper (audio), BeautifulSoup (URLs)
- **NLP:** spaCy (`en_core_web_sm`)
- **Background jobs (optional):** Celery + Redis

## Prerequisites

1. **Python 3.10+** and **Node.js 18+**
2. **MongoDB** — `docker run -d -p 27017:27017 --name lrw-mongo mongo:7`
3. **Tesseract OCR** (for image uploads):
   - Windows: https://github.com/UB-Mannheim/tesseract/wiki
   - Install the English (`eng`), Tamil (`tam`), and Sinhala (`sin`) language data for multilingual OCR.
   - Legacy-font Tamil and Sinhala PDFs are rendered and OCRed into Unicode; the matching language data must be installed.
   - For scanned Tamil PDFs, install Tesseract to `G:\001\LRW-2.0\Tesseract-OCR\tesseract.exe` (the default `TESSERACT_CMD`), or set `TESSERACT_CMD` in `backend/.env` to another absolute path.
   - macOS: `brew install tesseract`
   - Linux: `sudo apt install tesseract-ocr`
4. **ffmpeg** (for audio uploads via Whisper):
   - Windows: https://www.gyan.dev/ffmpeg/builds/ (add to PATH)
   - macOS: `brew install ffmpeg`
   - Linux: `sudo apt install ffmpeg`
5. **Redis** (only if you enable Celery): `docker run -d -p 6379:6379 --name lrw-redis redis:7`

## Backend Setup

```bash
cd backend
python -m venv venv
# Windows:    venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm

cp .env.example .env   # edit secrets/SMTP if you have them

python main.py
# or: uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API at `http://localhost:8000` (or `http://<your-ip>:8000` for network devices). Swagger UI at `/docs`.

### Optional: Celery worker (async processing)

Set `USE_CELERY=true` in `.env`, then in a second terminal:

```bash
cd backend
# same venv activated
celery -A celery_app.celery worker --loglevel=info
```

Now `/documents/upload` returns a `job_id` immediately; poll `/jobs/{id}` for status.

### Email (Gmail OAuth)

Email verification and password reset messages are sent through the Gmail API
using OAuth; no SMTP password is used. In Google Cloud, enable the Gmail API and
create OAuth client credentials for a desktop application. Save
the downloaded credentials as `backend/gmail_credentials.json`, then run:

```bash
cd backend
python generate_gmail_token.py
```

Authorize the Gmail account in the browser. The generated token is stored under
`backend/gmail/` and is ignored by Git. Set `APP_BASE_URL` for verification and
reset links.

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

UI at `http://localhost:5173`.

## Project Structure

```
lrw/
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── config.py                # Env settings
│   ├── database.py              # MongoDB collections + indexes
│   ├── models.py                # Pydantic request/response schemas
│   ├── celery_app.py            # Celery app
│   ├── tasks.py                 # Celery worker tasks
│   ├── routes/
│   │   ├── auth.py              # /register /verify-email /login /logout /forgot-password /reset-password
│   │   ├── documents.py         # /upload /documents /export
│   │   ├── search.py            # /search with POS/metadata/date filters
│   │   ├── admin.py             # /admin/users /admin/stats /admin/licenses
│   │   └── jobs.py              # /jobs/{id} status
│   ├── services/
│   │   ├── extraction.py        # text / PDF / OCR / Whisper / URL
│   │   ├── cleaning.py          # NFC normalize, whitespace, dedupe
│   │   ├── nlp.py               # tokens, POS, lemmas, top words
│   │   ├── csv_export.py        # token-level + summary CSV
│   │   └── email_service.py     # SMTP + dev console
│   └── utils/security.py        # JWT + bcrypt + role guards
└── frontend/
    └── src/
        ├── App.jsx              # routes + topbar
        ├── api.js               # axios client + helpers
        └── pages/
            ├── Login.jsx
            ├── Register.jsx
            ├── VerifyEmail.jsx
            ├── ForgotPassword.jsx
            ├── ResetPassword.jsx
            ├── Dashboard.jsx
            ├── Upload.jsx
            ├── Search.jsx       # with POS/source/license/domain/date filters
            ├── DocumentView.jsx # tabs: cleaned / raw / nlp / charts / metadata
            └── Admin.jsx        # stats, user role/block/delete
```

## Implemented (per SRS)

- [x] User registration with **real email verification** + login + logout (JWT)
- [x] **Forgot / reset password** flow
- [x] Document upload: text, PDF, image, **audio (Whisper STT)**, URL
- [x] Text extraction (PDF parse, Tesseract OCR, faster-whisper, BeautifulSoup scraping)
- [x] Cleaning & normalization (NFC, control-char strip, dedupe lines, whitespace)
- [x] NLP analysis (tokens, POS, lemmas, POS distribution, top words)
- [x] Metadata + license per document
- [x] Keyword search + **filters: POS / source type / license / domain / date range**
- [x] **Charts on document view**: POS pie + top-words bar (Recharts)
- [x] **JSON + CSV export** (single doc and bulk summary)
- [x] **Admin dashboard**: system stats, user role/block/delete, license catalog
- [x] **Optional Celery + Redis** background processing with job-status polling
- [x] Role-based access (admin / researcher / student / guest)

## Default Admin

There's no seeded admin — the first user can register with role `admin` from the
register page (verify the email link printed to the console). In production, lock
this down (e.g., remove the role selector and promote via the admin endpoint).

## Next Ideas

- Morphological analysis (deeper spaCy lemma + tag breakdown), NER
- Bulk file upload / drag-and-drop
- WebSocket job status updates instead of polling
- Per-document version history
- Public datasets and guest browse view
```
