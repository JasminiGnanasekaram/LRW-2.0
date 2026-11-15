"""Multilingual NLP analysis for English, Tamil, and Sinhala."""

import re
import unicodedata
from collections import Counter
from functools import lru_cache
from itertools import groupby, islice

try:
    from .lemmatizer import (
        analyze_sinhala_word,
        analyze_tamil_word,
        lemmatize_english,
        refine_english_lemma,
    )
except ImportError:
    from lemmatizer import (
        analyze_sinhala_word,
        analyze_tamil_word,
        lemmatize_english,
        refine_english_lemma,
    )


NLP_RULES_VERSION = "3.2"
ENGLISH_BATCH_SIZE = 512

LANGUAGE_CODES = {
    "English": "en",
    "Tamil": "ta",
    "Sinhala": "si",
}

# Sentence-ending punctuation may be followed by closing quotes or brackets.
SENTENCE_BOUNDARY = re.compile(
    r"([.!?।॥]+[\"'’”»)\]}]*)(?=\s|$|\w)"
)
PARAGRAPH_BOUNDARY = re.compile(r"\n[ \t]*\n+")
ABBREVIATION_END = re.compile(
    r"\b(?:Dr|Mr|Mrs|Ms|Prof|Rev|Hon|Capt|Col|Gen|Gov|Sgt|St|Jr|Sr|"
    r"Ltd|Plc|Pvt|Co|Corp|Inc|Dept|No|Nos|Rs|LKR|vs|approx|fig|vol|etc)\.$"
    r"|\b(?:[A-Za-z]\.)+[A-Za-z]\.$",
    re.IGNORECASE,
)
TITLE_ABBREVIATION_END = re.compile(
    r"\b(?:Dr|Mr|Mrs|Ms|Prof|Rev|Hon|Capt|Col|Gen|Gov|Sgt|St)\.$",
    re.IGNORECASE,
)
INITIAL_END = re.compile(r"\b[A-Z]\.$")
TRAILING_CLOSERS = str.maketrans("", "", "\"'’”»)]}")


def iter_word_tokens(text):
    """Yield each word, preserving its original spelling and order."""
    start = None

    for index, char in enumerate(text):
        if char.isalnum():
            if start is None:
                start = index
            continue

        # Keep dependent vowel signs and other combining marks attached.
        # Tamil and Sinhala words can also contain Unicode joiners.
        if start is not None and (
            unicodedata.category(char).startswith("M")
            or char in ("\u200c", "\u200d")
        ):
            continue

        if start is not None:
            yield text[start:index]
            start = None

    if start is not None:
        yield text[start:]


def normalize_word(word):
    """Group case variants and equivalent Unicode spellings together."""
    return unicodedata.normalize("NFC", word.casefold())


def _count_scripts(text):
    counts = {"English": 0, "Tamil": 0, "Sinhala": 0}

    for char in text:
        if "\u0b80" <= char <= "\u0bff":
            counts["Tamil"] += 1
        elif "\u0d80" <= char <= "\u0dff":
            counts["Sinhala"] += 1
        elif "A" <= char <= "Z" or "a" <= char <= "z":
            counts["English"] += 1

    return counts


def detect_languages(text):
    counts = _count_scripts(text or "")
    total = sum(counts.values())

    if total == 0:
        breakdown = [
            {"language": "English", "code": "en", "percentage": 100.0}
        ]
    else:
        breakdown = [
            {
                "language": language,
                "code": LANGUAGE_CODES[language],
                "percentage": round(count * 100 / total, 1),
            }
            for language, count in counts.items()
            if count > 0
        ]
        breakdown.sort(
            key=lambda item: counts[item["language"]],
            reverse=True,
        )

    primary = breakdown[0]

    return {
        "primary_language": primary["language"],
        "primary_code": primary["code"],
        "is_multilingual": sum(
            item["percentage"] >= 5 for item in breakdown
        ) > 1,
        "languages_detected": breakdown,
        "script_counts": counts,
    }


def detect_language(text):
    return detect_languages(text)["primary_language"]


def detect_sentence_language(sentence):
    counts = _count_scripts(sentence or "")
    return max(counts, key=counts.get)


def _word_language(word):
    for char in word:
        if "\u0b80" <= char <= "\u0bff":
            return "Tamil"
        if "\u0d80" <= char <= "\u0dff":
            return "Sinhala"

    return "English"


def segment_sentences(text):
    if not text or not text.strip():
        return []

    sentences = []
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")

    for paragraph in PARAGRAPH_BOUNDARY.split(normalized):
        paragraph = re.sub(r"\s+", " ", paragraph).strip()
        if not paragraph:
            continue

        start = 0
        for match in SENTENCE_BOUNDARY.finditer(paragraph):
            ending = match.group(1).translate(TRAILING_CLOSERS)
            if ending.endswith("."):
                next_char = paragraph[match.end():match.end() + 1]
                previous_char = paragraph[match.start() - 1:match.start()]
                if previous_char.isdigit() and next_char.isdigit():
                    continue

                context = paragraph[max(start, match.start() - 32):match.start(1)] + ending
                next_text = paragraph[match.end():].lstrip()
                next_word = re.match(r"\S+", next_text)
                next_word = next_word.group(0) if next_word else ""
                is_abbreviation = ABBREVIATION_END.search(context) or INITIAL_END.search(context)
                if is_abbreviation:
                    if TITLE_ABBREVIATION_END.search(context):
                        continue
                    if INITIAL_END.search(context) and next_word and next_word[0].isupper():
                        continue
                    if next_word and (next_word[0].islower() or next_word[0].isdigit()):
                        continue

            sentence = paragraph[start:match.end()].strip()
            if sentence:
                sentences.append(sentence)
            start = match.end()

        last_sentence = paragraph[start:].strip()
        if last_sentence:
            sentences.append(last_sentence)

    return sentences


@lru_cache(maxsize=1)
def _get_english_nlp():
    """Use the installed English spaCy model when available."""
    try:
        import spacy
    except ImportError:
        return None

    try:
        return spacy.load("en_core_web_sm")
    except OSError:
        return None


def _annotate_batch(words, language):
    """Return one annotation for each word in the supplied batch."""
    if language in ("Tamil", "Sinhala"):
        analyzer = (
            analyze_tamil_word
            if language == "Tamil"
            else analyze_sinhala_word
        )

        for word in words:
            pos, tag, lemma, morph = analyzer(word)
            yield pos, tag, lemma, morph, False

        return

    nlp = _get_english_nlp()

    if nlp is None:
        for word in words:
            pos = "NUM" if word.isdigit() else "NOUN"
            yield pos, pos, lemmatize_english(word, pos), "", False

        return

    from spacy.tokens import Doc

    # Give spaCy the exact words produced by our tokenizer. This keeps
    # the POS rows, lemma rows, and Word / Count table aligned.
    doc = nlp(Doc(nlp.vocab, words=words))

    for token in doc:
        pos = token.pos_ or "X"
        lemma = refine_english_lemma(token.text, token.lemma_, pos)

        yield (
            pos,
            token.tag_ or pos,
            lemma,
            str(token.morph),
            bool(token.is_stop),
        )


def tokenize_and_tag(text):
    sentences = segment_sentences(text)
    tokens = []
    lemmas = []
    token_details = []
    frequencies = Counter()
    pos_counts = Counter()

    for sentence_id, sentence in enumerate(sentences, start=1):
        words = iter_word_tokens(sentence)

        # A single sentence may contain English, Tamil, and Sinhala.
        for language, group in groupby(words, key=_word_language):
            code = LANGUAGE_CODES[language]

            while True:
                batch = list(islice(group, ENGLISH_BATCH_SIZE))
                if not batch:
                    break

                annotations = _annotate_batch(batch, language)

                for word, annotation in zip(batch, annotations):
                    pos, tag, lemma, morph, is_stop = annotation
                    normalized = normalize_word(word)

                    # Count every occurrence, including words like "the".
                    frequencies[normalized] += 1
                    pos_counts[pos] += 1

                    tokens.append(word)
                    lemmas.append(lemma)
                    token_details.append({
                        "token": word,
                        "text": word,
                        "normalized": normalized,
                        "lemma": lemma,
                        "pos": pos,
                        "tag": tag,
                        "morph": morph,
                        "language": code,
                        "sentence_id": sentence_id,
                        "is_stop": is_stop,
                    })

    return {
        "tokens": tokens,
        "token_count": len(tokens),
        "unique_tokens": len(frequencies),
        "lemmas": lemmas,
        "token_details": token_details,
        "pos_distribution": dict(pos_counts),

        # All distinct words, in the order they first occur.
        "word_counts": list(frequencies.items()),

        # These shorter lists are for the existing summary charts.
        "top_words": frequencies.most_common(50),
        "top_keywords": [
            word for word, _ in frequencies.most_common(5)
        ],
        "sentences": sentences,
        "sentence_count": len(sentences),
    }


def compute_statistics(text, token_data, lang_data=None):
    if lang_data is None:
        lang_data = detect_languages(text)

    paragraphs = [
        paragraph
        for paragraph in re.split(r"\r?\n[ \t]*\r?\n", text)
        if paragraph.strip()
    ]

    return {
        "characters": len(text),
        "characters_without_spaces": sum(
            not char.isspace() for char in text
        ),
        "tokens": token_data.get("token_count", len(token_data.get("tokens") or [])),
        "unique_tokens": token_data.get(
            "unique_tokens",
            len(token_data.get("word_counts") or token_data.get("top_words") or [])
            or len({str(t).lower() for t in (token_data.get("tokens") or [])}),
        ),
        "sentences": token_data.get(
            "sentence_count", len(token_data.get("sentences") or [])
        ),
        "paragraphs": len(paragraphs),
        "language_distribution": {
            item["language"]: item["percentage"]
            for item in lang_data["languages_detected"]
        },
        "pos_distribution": token_data.get("pos_distribution") or {},
    }


def analyze(text: str, max_chars=None):
    """Analyze the full text. Accept max_chars for older project callers."""
    text = text or ""
    lang_data = detect_languages(text)
    result = tokenize_and_tag(text)
    primary = lang_data["primary_language"]

    if lang_data["is_multilingual"]:
        parts = [
            f"{item['language']} ({item['percentage']}%)"
            for item in lang_data["languages_detected"]
        ]
        display = "Multilingual: " + ", ".join(parts)
    else:
        display = primary

    return {
        **result,
        "language": primary,
        "language_display": display,
        "statistics": compute_statistics(text, result, lang_data),
    }