"""Text cleaning and normalization."""
import re
import unicodedata


def normalize_unicode(text: str) -> str:
    """NFC normalize and strip control characters."""
    text = unicodedata.normalize("NFC", text)
    # Remove control chars except newline + tab
    text = "".join(ch for ch in text if ch == "\n" or ch == "\t" or not unicodedata.category(ch).startswith("C"))
    return text


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
    text = collapse_whitespace(text)
    text = remove_duplicate_lines(text)
    return text
