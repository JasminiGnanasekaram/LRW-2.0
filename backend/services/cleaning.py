"""Text cleaning and normalization supporting English, Tamil, Sinhala, and multilingual documents."""
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
    """
    NFC normalize and strip non-essential control characters.
    CRITICAL: Preserves Zero-Width Joiner (U+200D) and Zero-Width Non-Joiner (U+200C)
    which are required for Sinhala conjunct consonants (e.g. ශ්‍රී, ප්‍රවෘත්ති) and Tamil.
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
    """Remove standalone decorative emoji glyphs."""
    emoji_pattern = re.compile(
        "[\U0001F300-\U0001F6FF\U0001F900-\U0001F9FF\U0001FA70-\U0001FAFF\U00002700-\U000027BF]",
        flags=re.UNICODE,
    )
    return emoji_pattern.sub(" ", text)


def remove_unwanted_chars(text: str) -> str:
    """
    Keep letters (L), numbers (N), combining marks / vowel signs (M),
    format characters (ZWJ/ZWNJ), standard punctuation, quotes, brackets, and currency signs.
    Preserves English, Tamil, and Sinhala scripts without corruption.
    """
    kept = []
    for ch in text:
        category = unicodedata.category(ch)
        if ch in SAFE_SYMBOLS or category[0] in "LNM" or category == "Sc":
            kept.append(ch)
        elif category == "Zs":
            kept.append(" ")
    return "".join(kept)


def remove_urls(text: str) -> str:
    """Strip web URLs from text."""
    return re.sub(r"https?://\S+|www\.\S+", "", text)


def collapse_whitespace(text: str) -> str:
    """Collapse spaces and limit paragraph breaks to a single blank line."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Replace multiple spaces/tabs with single space on each line
    text = re.sub(r"[ \t]+", " ", text)
    # Collapse lines with only whitespace
    text = re.sub(r"\n\s+\n", "\n\n", text)
    # Collapse 3 or more newlines into double newline (paragraph break)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def clean(text: str) -> str:
    """
    Run the complete, Unicode-safe multilingual cleaning pipeline.
    Preserves Tamil, Sinhala, and English text without transliteration or loss of diacritics.
    """
    if not text or not text.strip():
        return ""
    for step in PIPELINE:
        text = step(text)
    return text