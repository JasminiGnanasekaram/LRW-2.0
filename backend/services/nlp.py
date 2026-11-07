"""
nlp_pipeline.py
Multilingual NLP Pipeline: Language Detection, Sentence Boundary Detection,
POS Tagging, Lemmatization, and Corpus Statistics for English, Tamil, and Sinhala.
"""

import re
from collections import Counter
from functools import lru_cache
from typing import Any, Dict, List, Tuple

try:
    from lemmatizer import (
        analyze_sinhala_word,
        analyze_tamil_word,
        lemmatize_english,
        refine_english_lemma,
    )
except ImportError:
    from .lemmatizer import (
        analyze_sinhala_word,
        analyze_tamil_word,
        lemmatize_english,
        refine_english_lemma,
    )

NLP_RULES_VERSION = "2.0"

# Precompiled Regexes
_RE_URL_OR_EMAIL = re.compile(r"(https?://\S+|www\.\S+|\S+@\S+\.\S+)")
_RE_DECIMAL = re.compile(r"(\d+)\.(\d+)")
_RE_INITIALS_1 = re.compile(r"(?<=\b[A-Za-z])\.(?=\s+[A-Za-z]\b)")
_RE_INITIALS_2 = re.compile(r"(?<=\b[A-Za-z])\.(?=\s+[A-Z][a-z])")
_RE_TITLE_ABBR = re.compile(
    r"\b(Dr|Mr|Mrs|Ms|Prof|Rev|Hon|Capt|Col|Gen|Gov|Sgt|St|Jr|Sr|Ltd|Plc|Pvt|Co|Corp|Inc|"
    r"Dept|approx|est|fig|No|Nos|vs|vol|vols|e\.g|i\.e|etc|al|Rs|LKR|min|sec|hr|km|cm|mm|kg)\.(?=\s+)",
    re.IGNORECASE,
)
_RE_SENT_SPLIT = re.compile(r"(?<=[.!?|।॥\n])\s+")

_RE_TA_TOKENS = re.compile(r"[\u0B80-\u0BFF\u200C\u200D]+|[a-zA-Z0-9]+|[^\w\s]")
_RE_SI_TOKENS = re.compile(r"[\u0D80-\u0DFF\u200C\u200D]+|[a-zA-Z0-9]+|[^\w\s]")
_RE_EN_FALLBACK_TOKENS = re.compile(r"[A-Za-z0-9]+(?:'[A-Za-z]+)?|[^\w\s]")
_PUNCT_CHARS = frozenset(".,!?;:|।॥'\"()[]{}<>-–—/\\@#$%&*+=_~^`")


def _count_scripts(text: str) -> Tuple[int, int, int]:
    """Return character counts for (Sinhala, Tamil, English)."""
    si = sum(1 for ch in text if "\u0d80" <= ch <= "\u0dff")
    ta = sum(1 for ch in text if "\u0b80" <= ch <= "\u0bff")
    en = sum(1 for ch in text if "a" <= ch <= "z" or "A" <= ch <= "Z")
    return si, ta, en


def detect_languages(text: str) -> Dict[str, Any]:
    """Detect language distribution by character scripts."""
    default_resp = {
        "primary_language": "English",
        "primary_code": "en",
        "is_multilingual": False,
        "languages_detected": [{"language": "English", "code": "en", "percentage": 100.0}],
        "script_counts": {"English": 0, "Tamil": 0, "Sinhala": 0},
    }
    if not text or not text.strip():
        return default_resp

    sample = text[:50000]
    si_count, ta_count, en_count = _count_scripts(sample)
    total_alpha = si_count + ta_count + en_count

    if total_alpha == 0:
        return default_resp

    breakdown = []
    for lang, code, cnt in (("Tamil", "ta", ta_count), ("Sinhala", "si", si_count), ("English", "en", en_count)):
        pct = round(cnt / total_alpha * 100, 1)
        if pct > 0:
            breakdown.append({"language": lang, "code": code, "percentage": pct})

    breakdown.sort(key=lambda x: x["percentage"], reverse=True)
    primary = breakdown[0]["language"] if breakdown else "English"
    primary_code = breakdown[0]["code"] if breakdown else "en"
    is_multi = len([b for b in breakdown if b["percentage"] >= 5.0]) > 1

    return {
        "primary_language": primary,
        "primary_code": primary_code,
        "is_multilingual": is_multi,
        "languages_detected": breakdown,
        "script_counts": {"English": en_count, "Tamil": ta_count, "Sinhala": si_count},
    }


def detect_sentence_language(sentence: str) -> str:
    """Classify the dominant script of a single sentence."""
    if not sentence or not sentence.strip():
        return "English"
    si, ta, en = _count_scripts(sentence)
    if si >= ta and si >= en and si > 0:
        return "Sinhala"
    if ta >= si and ta >= en and ta > 0:
        return "Tamil"
    return "English"


def segment_sentences(text: str) -> List[str]:
    """Segment document into sentences without splitting on decimals, initials, or abbreviations."""
    if not text or not text.strip():
        return []

    protected = text.replace("\r\n", "\n").replace("\r", "\n")
    protected = _RE_DECIMAL.sub(r"\1<DECIMAL_DOT>\2", protected)
    protected = _RE_URL_OR_EMAIL.sub(lambda m: m.group(0).replace(".", "<URL_DOT>"), protected)
    protected = _RE_INITIALS_1.sub("<INITIAL_DOT>", protected)
    protected = _RE_INITIALS_2.sub("<INITIAL_DOT>", protected)
    protected = _RE_TITLE_ABBR.sub(r"\1<ABBR_DOT>", protected)

    raw_sents = _RE_SENT_SPLIT.split(protected)
    cleaned = []
    for s in raw_sents:
        s = (
            s.replace("<DECIMAL_DOT>", ".")
            .replace("<URL_DOT>", ".")
            .replace("<INITIAL_DOT>", ".")
            .replace("<ABBR_DOT>", ".")
            .strip()
        )
        if len(s) > 1:
            cleaned.append(s)

    return cleaned or [text.strip()]


@lru_cache(maxsize=1)
def _get_english_nlp():
    """Load spaCy model with safety download fallback."""
    try:
        import spacy
        return spacy.load("en_core_web_sm")
    except Exception:
        try:
            import spacy
            from spacy.cli import download
            download("en_core_web_sm")
            return spacy.load("en_core_web_sm")
        except Exception:
            return None


def _record_token(
    tok: str,
    pos: str,
    tag: str,
    lemma: str,
    morph: str,
    lang: str,
    sent_id: int,
    is_punct: bool,
    token_texts: List[str],
    word_freq: Counter,
    pos_counter: Counter,
    lemmas: List[str],
    token_details: List[Dict[str, Any]],
    is_stop: bool = False,
):
    """Helper to maintain uniform token bookkeeping."""
    if not is_punct:
        token_texts.append(tok)
        word_freq[tok.lower()] += 1

    pos_counter[pos] += 1
    lemmas.append(lemma)
    token_details.append({
        "token": tok,
        "text": tok,
        "normalized": tok.lower(),
        "lemma": lemma,
        "pos": pos,
        "tag": tag,
        "morph": morph,
        "language": lang,
        "sentence_id": sent_id,
        "is_stop": is_stop,
    })


def tokenize_and_tag(text: str) -> Dict[str, Any]:
    """Tokenize, tag POS, and lemmatize sentences based on detected language."""
    sentences = segment_sentences(text)
    token_details: List[Dict[str, Any]] = []
    token_texts: List[str] = []
    lemmas: List[str] = []
    pos_counter: Counter = Counter()
    word_freq: Counter = Counter()
    en_nlp = _get_english_nlp()

    for sent_id, sent in enumerate(sentences, 1):
        sent_lang = detect_sentence_language(sent)

        if sent_lang == "English" and en_nlp is not None:
            doc = en_nlp(sent)
            for token in doc:
                text_clean = token.text.strip()
                if not text_clean:
                    continue
                pos = token.pos_ or "X"
                lemma = refine_english_lemma(text_clean, token.lemma_, pos)
                _record_token(
                    tok=text_clean,
                    pos=pos,
                    tag=token.tag_ or pos,
                    lemma=lemma,
                    morph=str(token.morph) if token.morph else "",
                    lang="en",
                    sent_id=sent_id,
                    is_punct=token.is_punct or token.is_space,
                    token_texts=token_texts,
                    word_freq=word_freq,
                    pos_counter=pos_counter,
                    lemmas=lemmas,
                    token_details=token_details,
                    is_stop=bool(token.is_stop),
                )
        else:
            # Route to respective analyzer
            if sent_lang == "Tamil":
                raw_tokens = _RE_TA_TOKENS.findall(sent)
                analyzer = analyze_tamil_word
                lang_code = "ta"
            elif sent_lang == "Sinhala":
                raw_tokens = _RE_SI_TOKENS.findall(sent)
                analyzer = analyze_sinhala_word
                lang_code = "si"
            else:
                raw_tokens = _RE_EN_FALLBACK_TOKENS.findall(sent)
                analyzer = None
                lang_code = "en"

            for raw_tok in raw_tokens:
                tok = raw_tok.strip()
                if not tok:
                    continue

                if analyzer:
                    pos, tag, lemma, morph = analyzer(tok)
                    is_punct = (pos == "PUNCT")
                else:
                    is_punct = all(c in _PUNCT_CHARS for c in tok)
                    pos = "PUNCT" if is_punct else "NUM" if tok.isdigit() else "NOUN"
                    tag = pos
                    lemma = tok if is_punct else lemmatize_english(tok, pos)
                    morph = ""

                _record_token(
                    tok=tok,
                    pos=pos,
                    tag=tag,
                    lemma=lemma,
                    morph=morph,
                    lang=lang_code,
                    sent_id=sent_id,
                    is_punct=is_punct,
                    token_texts=token_texts,
                    word_freq=word_freq,
                    pos_counter=pos_counter,
                    lemmas=lemmas,
                    token_details=token_details,
                )

    top_words = [[w, count] for w, count in word_freq.most_common(50)]
    return {
        "tokens": token_texts,
        "token_count": len(token_texts),
        "unique_tokens": len(word_freq),
        "lemmas": lemmas,
        "token_details": token_details[:5000],
        "pos_distribution": dict(pos_counter),
        "top_words": top_words,
        "top_keywords": [w for w, _ in top_words[:5]],
        "sentences": sentences,
        "sentence_count": len(sentences),
    }


def compute_statistics(text: str, token_data: Dict[str, Any], lang_data: Dict[str, Any] = None) -> Dict[str, Any]:
    """Compute high-level corpus & document statistics."""
    chars = len(text)
    chars_no_spaces = len(re.sub(r"\s+", "", text))
    paragraphs = [p for p in text.split("\n\n") if p.strip()]
    if lang_data is None:
        lang_data = detect_languages(text[:50000])
    lang_dist = {b["language"]: b["percentage"] for b in lang_data.get("languages_detected", [])}

    return {
        "characters": chars,
        "characters_without_spaces": chars_no_spaces,
        "tokens": token_data.get("token_count", 0),
        "unique_tokens": token_data.get("unique_tokens", 0),
        "sentences": token_data.get("sentence_count", 0),
        "paragraphs": max(len(paragraphs), 1),
        "language_distribution": lang_dist,
        "pos_distribution": token_data.get("pos_distribution", {}),
    }


def analyze(text: str, max_chars: int = 100000) -> Dict[str, Any]:
    """
    Main entry point for NLP processing pipeline:
    1. Detects languages
    2. Segments sentences
    3. Analyzes POS, morphology, and lemmas
    4. Computes statistics
    """
    sample = (text or "")[:max_chars]
    lang_data = detect_languages(sample)
    primary_lang = lang_data["primary_language"]
    token_results = tokenize_and_tag(sample)
    stats = compute_statistics(sample, token_data=token_results, lang_data=lang_data)

    if lang_data.get("is_multilingual"):
        display_parts = [f"{b['language']} ({b['percentage']}%)" for b in lang_data.get("languages_detected", [])]
        lang_display = "Multilingual: " + ", ".join(display_parts)
    else:
        lang_display = primary_lang

    return {
        "language": primary_lang,
        "language_display": lang_display,
        "tokens": token_results.get("tokens", []),
        "token_count": token_results.get("token_count", 0),
        "unique_tokens": token_results.get("unique_tokens", 0),
        "lemmas": token_results.get("lemmas", []),
        "top_keywords": token_results.get("top_keywords", []),
        "token_details": token_results.get("token_details", []),
        "pos_distribution": token_results.get("pos_distribution", {}),
        "top_words": token_results.get("top_words", []),
        "sentences": token_results.get("sentences", []),
        "sentence_count": token_results.get("sentence_count", 0),
        "statistics": stats,
    }


def detect_language(text: str) -> str:
    """Helper returning only the primary language name."""
    return detect_languages(text).get("primary_language", "English")
