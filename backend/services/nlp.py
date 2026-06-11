"""NLP analysis: tokenization, POS tagging, morphological analysis."""
from functools import lru_cache
from collections import Counter


@lru_cache(maxsize=1)
def _get_nlp():
    import spacy
    try:
        return spacy.load("en_core_web_sm")
    except OSError:
        # Fall back to blank pipeline if model not downloaded
        return spacy.blank("en")


def analyze(text: str, max_chars: int = 100_000) -> dict:
    """Return tokens, POS tags, lemmas, and basic stats."""
    nlp = _get_nlp()
    doc = nlp(text[:max_chars])

    tokens = []
    pos_counter = Counter()
    for token in doc:
        if token.is_space:
            continue
        tok = {
            "text": token.text,
            "lemma": token.lemma_ or token.text,
            "pos": token.pos_ or "X",
            "tag": token.tag_ or "",
            "is_stop": bool(token.is_stop),
        }
        tokens.append(tok)
        pos_counter[tok["pos"]] += 1

    word_freq = Counter(t["lemma"].lower() for t in tokens if t["pos"] not in ("PUNCT", "SPACE", "X"))

    return {
        "token_count": len(tokens),
        "tokens": tokens[:5000],  # cap to keep payload sane
        "pos_distribution": dict(pos_counter),
        "top_words": word_freq.most_common(50),
    }
