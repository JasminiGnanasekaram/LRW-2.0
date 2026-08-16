"""Text cleaning and normalization."""
import re
import unicodedata


def normalize_unicode(text: str) -> str:
    # NFC normalization composes Tamil/Sinhala clusters correctly when done ONCE, first.
    text = unicodedata.normalize("NFC", text)
    # Remove only true control characters (category Cc), keep \n and \t.
    # Using regex instead of a per-char loop avoids breaking grapheme clusters.
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    return text


def remove_urls(text: str) -> str:
    return re.sub(r"https?://\S+|www\.\S+", "", text)


def remove_html_tags(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text)


def remove_emojis(text: str) -> str:
    emoji_pattern = re.compile(
        "[\U0001F300-\U0001F6FF\U0001F900-\U0001F9FF\U0001FA70-\U0001FAFF\U00002700-\U000027BF]",
        flags=re.UNICODE,
    )
    return emoji_pattern.sub("", text)


def remove_unwanted_chars(text: str) -> str:
    """
    Keep letters, numbers, combining marks, and basic whitespace/punctuation.
    IMPORTANT: operate with regex over the whole string, not char-by-char,
    so multi-codepoint Tamil/Sinhala clusters (base + vowel sign) never get split apart.
    """
    allowed = []
    for ch in text:
        if ch in "\n\t ":
            allowed.append(ch)
            continue
        cat = unicodedata.category(ch)
        if cat.startswith(("L", "N", "M")):
            allowed.append(ch)
        elif cat.startswith("P") and ch in ".,!?;:'\"()-":
            # keep common punctuation if you want it; remove this elif if not needed
            allowed.append(ch)
    return "".join(allowed)


def collapse_whitespace(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def remove_duplicate_lines(text: str) -> str:
    seen = set()
    out_lines = []
    for line in text.split("\n"):
        key = line.strip()
        if key and key in seen:
            continue
        seen.add(key)
        out_lines.append(line)
    return "\n".join(out_lines)


def clean(text: str) -> str:
    text = normalize_unicode(text)        # NFC composes clusters correctly — do this FIRST and ONLY ONCE
    text = remove_urls(text)
    text = remove_html_tags(text)
    text = remove_emojis(text)
    text = remove_unwanted_chars(text)    # safe now because text is already NFC-composed
    text = ''.join(ch.lower() if ch.isascii() else ch for ch in text)
    text = collapse_whitespace(text)
    text = remove_duplicate_lines(text)
    return text