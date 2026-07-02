"""Text cleaning and normalization."""
import re
import unicodedata


def normalize_unicode(text: str) -> str:
    """NFC normalize and strip control characters."""
    text = unicodedata.normalize("NFC", text)
    # Remove control chars except newline + tab
    text = "".join(ch for ch in text if ch == "\n" or ch == "\t" or not unicodedata.category(ch).startswith("C"))
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
    cleaned = []
    for ch in text:
        if ch in "\n\t ":
            cleaned.append(ch)
            continue
        cat = unicodedata.category(ch)
        # ✅ Added "M" (marks) to preserve Tamil/Indian vowel signs & diacritics
        if cat.startswith(("L", "N", "M")):
            cleaned.append(ch)
    return "".join(cleaned)

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
    """Run the full cleaning pipeline."""
    text = normalize_unicode(text)
    text = remove_urls(text)
    text = remove_html_tags(text)
    text = remove_emojis(text)
    text = remove_unwanted_chars(text)
    # ✅ Only lowercase ASCII, preserve Tamil characters
    text = ''.join(ch.lower() if ch.isascii() else ch for ch in text)
    text = collapse_whitespace(text)
    text = remove_duplicate_lines(text)
    return text