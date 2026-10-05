"""Text cleaning and normalization supporting English, Tamil, Sinhala, and multilingual documents."""
import re
import unicodedata


def normalize_unicode(text: str) -> str:
    """
    NFC normalize and strip non-essential control characters.
    CRITICAL: Preserves Zero-Width Joiner (U+200D) and Zero-Width Non-Joiner (U+200C)
    which are required for Sinhala conjunct consonants (e.g. ශ්‍රී, ප්‍රවෘත්ති) and Tamil.
    """
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text)
    
    # Allowed control chars: \n, \r, \t, and format characters ZWJ (\u200d) & ZWNJ (\u200c)
    cleaned_chars = []
    for ch in text:
        if ch in ("\n", "\r", "\t", "\u200c", "\u200d"):
            cleaned_chars.append(ch)
        elif not unicodedata.category(ch).startswith("C"):
            cleaned_chars.append(ch)
    return "".join(cleaned_chars)


def remove_html_tags(text: str) -> str:
    """Remove HTML/XML tags while preserving content."""
    return re.sub(r"<[^>]+>", " ", text)


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
    allowed = []
    # Common punctuation and currency signs used in English, Tamil, and Sinhala
    safe_symbols = set(".,!?:;\"'()[]{}<>-–—/\\@#$%&*+=_~^`|।॥\n\r\t \u200c\u200d\u0BF9\u0DF4₹$€£¥")
    for ch in text:
        if ch in safe_symbols:
            allowed.append(ch)
            continue
        cat = unicodedata.category(ch)
        # L = Letters, N = Numbers, M = Combining Marks (crucial for Tamil & Sinhala vowel modifiers)
        if cat.startswith(("L", "N", "M")):
            allowed.append(ch)
    return "".join(allowed)


def normalize_punctuation(text: str) -> str:
    """
    Normalize quotes, dashes, and visual noise without breaking decimal numbers (e.g. 3.14)
    or standard abbreviations (e.g. Dr., Rs., Mr.).
    """
    text = re.sub(r"[“”«»„‟˝`´]+", '"', text)
    text = re.sub(r"[‘’‛‚]+", "'", text)
    text = re.sub(r"[–—]+", "-", text)
    text = re.sub(r"[•●▪◆◦◾◽◼★☆✓✔✕✖✗✘✙✚✜✠\u2022\u25aa\u25ab]+", " ", text)
    # Deduplicate repeated dots/exclamation/question marks (keep ellipsis as max 3 dots)
    text = re.sub(r"\.{4,}", "...", text)
    text = re.sub(r"([!?]){2,}", r"\1", text)
    return text


def remove_hyphenated_line_breaks(text: str) -> str:
    """Fix words broken across line endings with hyphens (e.g. 'infor-\nmation' -> 'information')."""
    return re.sub(r"(\w+)-\s*\n\s*(\w+)", r"\1\2", text)


def collapse_whitespace(text: str) -> str:
    """Normalize whitespace while maintaining paragraph breaks (max 2 consecutive newlines)."""
    # Replace carriage returns with newlines
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
    text = normalize_unicode(text)
    text = remove_html_tags(text)
    text = remove_emojis(text)
    text = remove_hyphenated_line_breaks(text)
    text = normalize_punctuation(text)
    text = remove_unwanted_chars(text)
    text = collapse_whitespace(text)
    return text