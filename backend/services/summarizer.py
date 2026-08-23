"""
Summarizer service — used by documents.py to generate short summaries.
Uses Groq AI if API key is set, otherwise falls back to extractive summary.
"""
import os
import re
"""Bridge so documents.py can import get_text_summary."""
from routes.summarize import summarize as get_text_summary

def _extractive_summary(text: str, max_sentences: int = 2) -> str:
    """Simple fallback: extract first 2 meaningful sentences."""
    if not text or not text.strip():
        return "No content available for summary."
    sentences = re.split(r'(?<=[.!?।])\s+', text.strip())
    meaningful = [s.strip() for s in sentences if len(s.strip()) > 20]
    if not meaningful:
        return text.strip()[:200] + ("..." if len(text) > 200 else "")
    summary = " ".join(meaningful[:max_sentences])
    return summary[:300] + "..." if len(summary) > 300 else summary


def get_text_summary(text: str) -> str:
    """
    Generate a 2-sentence summary.
    Uses Groq AI if GROQ_API_KEY is set, else falls back to extractive.
    """
    if not text or not text.strip():
        return "No content available for summary."

    api_key = os.getenv("GROQ_API_KEY", "")

    if api_key:
        try:
            from groq import Groq
            client = Groq(api_key=api_key)
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a summarizer. Respond with exactly 2 informative sentences. Each sentence must be under 20 words. Never exceed 2 sentences."
                    },
                    {
                        "role": "user",
                        "content": f"Summarize the following content in 2 informative sentences:\n\n{text[:5000]}"
                    }
                ],
                max_tokens=80,
                temperature=0.3,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"[Summarizer] Groq failed: {e} — using extractive fallback", flush=True)

    return _extractive_summary(text)