"""Text cleaning and normalization for English, Tamil, Sinhala, and multilingual documents."""

import re
import unicodedata

ZWNJ = "\u200c"
ZWJ = "\u200d"

KEPT_CONTROL_CHARS = frozenset({"\n", "\r", "\t", ZWNJ, ZWJ})

SAFE_SYMBOLS = frozenset(".,!?:;\"'()[]{}<>-–—/\\@#%&*+=_~^`|।॥\u0DF4") | KEPT_CONTROL_CHARS | {" "}

HTML_TAG_RE = re.compile(r"<!--.*?-->|</?[A-Za-z!][^>]*>", re.DOTALL)
EMOJI_RE = re.compile("[\U0001F300-\U0001F6FF\U0001F900-\U0001F9FF\U0001FA70-\U0001FAFF\u2700-\u27BF\ufe0f]")
HYPHEN_BREAK_RE = re.compile(r"(?<=[\w\u0B80-\u0BFF\u0D80-\u0DFF])-[ \t]*\n[ \t]*(?=\w)")

DOUBLE_QUOTES_RE = re.compile(r"[“”«»„‟˝`´]+")
SINGLE_QUOTES_RE = re.compile(r"[‘’‛‚]+")
DASHES_RE = re.compile(r"[–—]+")
BULLETS_RE = re.compile(r"[•●▪▫◆◦◾◽◼★☆✓✔✕✖✗✘✙✚✜✠]+")
LONG_ELLIPSIS_RE = re.compile(r"\.{4,}")
REPEATED_MARKS_RE = re.compile(r"([!?]){2,}")

HORIZONTAL_SPACE_RE = re.compile(r"[ \t]+")
LINE_EDGE_SPACE_RE = re.compile(r" ?\n ?")
EXCESS_NEWLINES_RE = re.compile(r"\n{3,}")


def normalize_unicode(text: str) -> str:
    """NFC-normalize and drop control/format characters, keeping ZWJ and ZWNJ.

    ZWJ (U+200D) and ZWNJ (U+200C) are required for Sinhala conjuncts and Tamil text.
    """
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text)
    return "".join(
        ch for ch in text if ch in KEPT_CONTROL_CHARS or not unicodedata.category(ch).startswith("C")
    )


def remove_html_tags(text: str) -> str:
    """Replace HTML/XML tags and comments with a space, keeping their content."""
    return HTML_TAG_RE.sub(" ", text)


def remove_emojis(text: str) -> str:
    """Replace decorative emoji glyphs (and their variation selectors) with a space."""
    return EMOJI_RE.sub(" ", text)


def remove_hyphenated_line_breaks(text: str) -> str:
    """Rejoin words split across lines with a hyphen ('infor-\\nmation' -> 'information')."""
    return HYPHEN_BREAK_RE.sub("", text)


def normalize_punctuation(text: str) -> str:
    """Normalize quotes, dashes, ellipses, and bullets without touching decimals or abbreviations."""
    text = DOUBLE_QUOTES_RE.sub('"', text)
    text = SINGLE_QUOTES_RE.sub("'", text)
    text = DASHES_RE.sub("-", text)
    text = BULLETS_RE.sub(" ", text)
    text = text.replace("…", "...")
    text = LONG_ELLIPSIS_RE.sub("...", text)
    return REPEATED_MARKS_RE.sub(r"\1", text)


def remove_unwanted_chars(text: str) -> str:
    """Keep letters, numbers, combining marks, currency signs, and common punctuation.

    Combining marks are kept so Tamil and Sinhala vowel signs survive. Unicode space
    separators (such as a non-breaking space) become a normal space.
    """
    kept = []
    for ch in text:
        category = unicodedata.category(ch)
        if ch in SAFE_SYMBOLS or category[0] in "LNM" or category == "Sc":
            kept.append(ch)
        elif category == "Zs":
            kept.append(" ")
    return "".join(kept)


def collapse_whitespace(text: str) -> str:
    """Collapse spaces and limit paragraph breaks to a single blank line."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = HORIZONTAL_SPACE_RE.sub(" ", text)
    text = LINE_EDGE_SPACE_RE.sub("\n", text)
    text = EXCESS_NEWLINES_RE.sub("\n\n", text)
    return text.strip()


PIPELINE = (
    normalize_unicode,
    remove_html_tags,
    remove_emojis,
    remove_hyphenated_line_breaks,
    normalize_punctuation,
    remove_unwanted_chars,
    collapse_whitespace,
)


def clean(text: str) -> str:
    """Run the full Unicode-safe cleaning pipeline without transliterating or dropping diacritics."""
    if not text or not text.strip():
        return ""
    for step in PIPELINE:
        text = step(text)
    return text