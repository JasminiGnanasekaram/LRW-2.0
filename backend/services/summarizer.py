"""Multilingual extractive summarizer for English, Tamil and Sinhala."""

import math
import re
from collections import Counter
from typing import Any, Dict, List, Tuple

INDIC_CLASS = "\u0B80-\u0BFF\u0D80-\u0DFF\u200C\u200D"

_WORD_RE = re.compile(rf"[{INDIC_CLASS}]+|[A-Za-z0-9]+")
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?।॥])\s+|(?<=[.!?।॥][\"'”’)])\s+|\n+")
_DECIMAL_RE = re.compile(r"(?<=\d)\.(?=\d)")
_TITLE_RE = re.compile(r"\b(?:Dr|Mr|Mrs|Ms|Prof|Rev|Hon|Jr|Sr|Ltd|Co|Inc|vs|Rs)\.(?=\s)")
_DOT = "\uE000"

MIN_SENTENCE_CHARS = 10
MIN_WORD_CHARS = 3
MAX_SUMMARY_SENTENCES = 3
MAX_KEY_POINTS = 4
MAX_TOPICS = 5
MAX_FALLBACK_CHARS = 200
REDUNDANCY_THRESHOLD = 0.6

STOP_WORDS = {
    "the", "and", "but", "are", "was", "were", "for", "with", "this", "that", "its", "has", "have", "had",
    "மற்றும்", "ஒரு", "இந்த", "அது", "என்று", "ஆகிய", "உள்ள", "என", "ஆன", "உடன்", "இன்",
    "සහ", "එය", "මම", "එක්", "මෙම", "ඇති", "කරන", "හා", "වන", "නමුත්", "සඳහා",
}


def _words(text: str) -> List[str]:
    return _WORD_RE.findall(text.lower())


def _content_words(text: str) -> List[str]:
    return [w for w in _words(text) if len(w) >= MIN_WORD_CHARS and w not in STOP_WORDS]


def _split_sentences(text: str) -> List[str]:
    protected = _DECIMAL_RE.sub(_DOT, text.replace("\r\n", "\n").replace("\r", "\n"))
    protected = _TITLE_RE.sub(lambda m: m.group(0).replace(".", _DOT), protected)
    sentences = (part.replace(_DOT, ".").strip() for part in _SENTENCE_SPLIT_RE.split(protected))
    return [s for s in sentences if len(s) > MIN_SENTENCE_CHARS]


def _truncate(text: str, limit: int = MAX_FALLBACK_CHARS) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    if not text[limit].isspace() and " " in cut:
        cut = cut.rsplit(" ", 1)[0]
    return cut.rstrip(" ,;:") + "…"


def _score_sentences(sentences: List[str], word_freq: Counter) -> List[float]:
    peak = max(word_freq.values())
    scores = []
    for idx, sentence in enumerate(sentences):
        words = _content_words(sentence)
        if not words:
            scores.append(0.0)
            continue
        score = sum(word_freq[w] / peak for w in words) / math.sqrt(len(words))
        if idx == 0:
            score *= 1.5
        scores.append(score)
    return scores


def _overlap(a: str, b: str) -> float:
    set_a, set_b = set(_content_words(a)), set(_content_words(b))
    if not set_a or not set_b:
        return 0.0
    return len(set_a & set_b) / len(set_a | set_b)


def _select(sentences: List[str], scores: List[float], limit: int) -> List[str]:
    chosen: List[int] = []
    for idx in sorted(range(len(sentences)), key=lambda i: scores[i], reverse=True):
        if len(chosen) >= limit:
            break
        if any(_overlap(sentences[idx], sentences[j]) > REDUNDANCY_THRESHOLD for j in chosen):
            continue
        chosen.append(idx)
    return [sentences[i] for i in sorted(chosen)]


def _analyze(text: str) -> Tuple[List[str], Counter, List[float]]:
    sentences = _split_sentences(text)
    word_freq = Counter(_content_words(text))
    scores = _score_sentences(sentences, word_freq) if sentences and word_freq else []
    return sentences, word_freq, scores


def _summarize(text: str, sentences: List[str], scores: List[float]) -> str:
    if not sentences:
        return _truncate(text)
    if len(sentences) <= 2:
        return " ".join(sentences)
    if not scores:
        return " ".join(sentences[:2])
    return " ".join(_select(sentences, scores, MAX_SUMMARY_SENTENCES))


def get_text_summary(text: str) -> str:
    if not text or not text.strip():
        return "No text available to summarize."
    sentences, _, scores = _analyze(text)
    return _summarize(text, sentences, scores)


def get_structured_summary(text: str) -> Dict[str, Any]:
    if not text or not text.strip():
        return {"short_summary": "No text available.", "key_points": [], "important_topics": []}

    sentences, word_freq, scores = _analyze(text)

    if scores:
        key_points = _select(sentences, scores, MAX_KEY_POINTS)
    else:
        key_points = sentences[:MAX_KEY_POINTS]

    return {
        "short_summary": _summarize(text, sentences, scores),
        "key_points": key_points,
        "important_topics": [w for w, _ in word_freq.most_common(MAX_TOPICS)],
    }