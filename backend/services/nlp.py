"""NLP analysis: tokenization, POS tagging, morphological analysis."""
from functools import lru_cache
from collections import Counter



def _detect_language(text: str) -> str:
    try:
        from langdetect import detect
        code = detect(text[:10000])
        return {
            "en": "English",
            "ta": "Tamil",
            "es": "Spanish",
            "fr": "French",
            "de": "German",
            "it": "Italian",
            "pt": "Portuguese",
            "nl": "Dutch",
            "zh-cn": "Chinese",
            "zh-tw": "Chinese",
        }.get(code, code)
    except Exception:
        return "English"


@lru_cache(maxsize=1)
def _get_english_nlp():
    import spacy
    try:
        return spacy.load("en_core_web_sm")
    except OSError:
        from spacy.cli import download
        download("en_core_web_sm")
        return spacy.load("en_core_web_sm")


def _analyze_tamil(text: str, max_chars: int = 100_000) -> dict:
    """Tamil NLP using simple whitespace tokenization + improved suffix-based POS."""
    print("DEBUG: _analyze_tamil called")
    print("DEBUG: first 100 chars:", text[:100])

    # Simple split — skip indic-nlp normalizer (it corrupts Tamil chars)
    raw_tokens = text[:max_chars].split()

    # Improved Tamil POS suffix rules
    def get_tamil_pos(word: str) -> str:
        # Punctuation
        if all(c in '.,!?;:।॥\'"()[]{}' for c in word):
            return "PUNCT"
        # Numbers
        if word.isdigit():
            return "NUM"

        # Verb suffixes (ordered longest first to avoid partial matches)
        verb_suffixes = [
            "கிறார்கள்", "கிறார்", "கிறான்", "கிறாள்", "கிறது",
            "கின்றார்கள்", "கின்றார்", "கின்றான்", "கின்றாள்", "கின்றது",
            "கிறேன்", "கின்றேன்", "கிறோம்", "கின்றோம்",
            "விட்டான்", "விட்டாள்", "விட்டார்", "விட்டது",
            "ந்தான்", "ந்தாள்", "ந்தார்", "ந்தது", "ந்தேன்",
            "வான்", "வாள்", "வார்", "வேன்", "வோம்",
            "டான்", "டாள்", "டார்", "டது",
            "றான்", "றாள்", "றார்", "றது", "றேன்",
            "யான்", "யாள்", "யார்", "யது",
            "க்கிறது", "க்கிறான்", "க்கிறாள்",
            "க்கின்றது", "க்கின்றான்",
            "ட்டான்", "ட்டாள்", "ட்டார்", "ட்டது",
            "உகிறது", "உகிறான்",
            "கிறது", "கிறான்",
            "றன்", "யன்",
        ]

        # Adjective suffixes
        adj_suffixes = [
            "இல்லாத", "உள்ள", "ஆன", "வான", "மான",
            "யான", "கான", "றான", "தான",
            "அழகான", "நல்ல", "கெட்ட",
        ]

        # Adverb suffixes
        adv_suffixes = [
            "யாக", "வாக", "றாக", "ஆக",
            "மாக", "காக", "தாக",
        ]

        # Pronoun list
        pronouns = [
            "நான்", "நீ", "அவன்", "அவள்", "அவர்", "அது", "அவை",
            "நாம்", "நாங்கள்", "நீங்கள்", "அவர்கள்", "இது", "இவன்",
            "இவள்", "இவர்", "எது", "யார்", "என்ன",
        ]

        if word in pronouns:
            return "PRON"

        for s in verb_suffixes:
            if word.endswith(s):
                return "VERB"
        for s in adj_suffixes:
            if word.endswith(s):
                return "ADJ"
        for s in adv_suffixes:
            if word.endswith(s):
                return "ADV"

        # Noun suffixes (check last so verbs/adj take priority)
        noun_suffixes = [
            "கள்", "இன்", "களும்", "களை", "களில்", "களுக்கு",
            "இல்", "இலும்", "இலிருந்து", "உக்கு", "ஐ", "ஆல்",
            "ம்", "ன்", "ண்", "ர்", "து", "டு", "று",
        ]
        for s in noun_suffixes:
            if word.endswith(s) and len(word) > len(s):
                return "NOUN"

        return "NOUN"  # default

    token_details = []
    token_texts = []
    pos_counter = Counter()
    word_freq = Counter()

    POS_LABELS = {
        "NOUN": "Noun", "VERB": "Verb", "ADJ": "Adjective",
        "ADV": "Adverb", "PRON": "Pronoun", "NUM": "Number",
        "PUNCT": "Punctuation",
    }

    for token in raw_tokens:
        token = token.strip()
        if not token:
            continue

        pos = get_tamil_pos(token)

        if pos != "PUNCT":
            token_texts.append(token)
            word_freq[token.lower()] += 1

        pos_counter[pos] += 1
        token_details.append({
            "text": token,        # ✅ original word preserved
            "lemma": token,
            "pos": pos,
            "tag": POS_LABELS.get(pos, pos),
            "is_stop": False,
        })

    unique_tokens = len({t.lower() for t in token_texts})
    top_keywords = [word for word, _ in word_freq.most_common(5)]

    return {
        "language": "Tamil",
        "tokens": token_texts,
        "token_count": len(token_texts),
        "unique_tokens": unique_tokens,
        "lemmas": token_texts,
        "top_keywords": top_keywords,
        "token_details": token_details[:5000],
        "pos_distribution": dict(pos_counter),
        "top_words": word_freq.most_common(50),
    }

def _analyze_english(text: str, max_chars: int = 100_000) -> dict:
    """English NLP using spaCy."""
    nlp = _get_english_nlp()
    doc = nlp(text[:max_chars])

    token_texts = []
    token_details = []
    lemmas = []
    pos_counter = Counter()
    word_freq = Counter()

    for token in doc:
        if token.is_space or token.is_punct:
            continue

        pos_value = token.pos_ or "X"
        token_texts.append(token.text)
        lemmas.append(token.lemma_ or token.text)
        token_details.append({
            "text": token.text,
            "lemma": token.lemma_ or token.text,
            "pos": pos_value,
            "tag": token.tag_ or "",
            "is_stop": bool(token.is_stop),
        })
        pos_counter[pos_value] += 1
        word_freq[(token.lemma_ or token.text).lower()] += 1

    unique_tokens = len({t.lower() for t in token_texts})
    top_keywords = [word for word, _ in word_freq.most_common(5)]

    return {
        "language": "English",
        "tokens": token_texts,
        "token_count": len(token_texts),
        "unique_tokens": unique_tokens,
        "lemmas": lemmas,
        "top_keywords": top_keywords,
        "token_details": token_details[:5000],
        "pos_distribution": dict(pos_counter),
        "top_words": word_freq.most_common(50),
    }


def analyze(text: str, max_chars: int = 100_000) -> dict:
    """Auto-detect language and run appropriate NLP pipeline."""
    lang = _detect_language(text)
    print("DEBUG: detected language:", lang)  # ← add this line
    if lang == "Tamil":
        return _analyze_tamil(text, max_chars)
    return _analyze_english(text, max_chars)