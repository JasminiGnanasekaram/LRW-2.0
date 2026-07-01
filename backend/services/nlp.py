"""NLP analysis: tokenization, POS, NER, sentiment, language detection, classification."""
from functools import lru_cache
from collections import Counter
import numpy as np


# ─── Numpy → Python converter ─────────────────────────────────────────

def _to_python(obj):
    """Recursively convert numpy types to native Python types for MongoDB."""
    if isinstance(obj, dict):
        return {k: _to_python(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_python(v) for v in obj]
    if isinstance(obj, tuple):
        return tuple(_to_python(v) for v in obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.ndarray):
        return [_to_python(v) for v in obj.tolist()]
    if isinstance(obj, np.generic):
        return _to_python(obj.item())
    return obj


# ─── Language Detection ───────────────────────────────────────────────

def _detect_language(text: str) -> str:
    sample = text[:10000]
    tamil_chars   = sum(1 for c in sample if "\u0B80" <= c <= "\u0BFF")
    sinhala_chars = sum(1 for c in sample if "\u0D80" <= c <= "\u0DFF")
    letters       = sum(1 for c in sample if c.isalpha())
    if letters > 0:
        if tamil_chars   / letters > 0.3:
            return "Tamil"
        if sinhala_chars / letters > 0.3:
            return "Sinhala"
    try:
        from langdetect import detect
        code = detect(sample)
        return {
            "en": "English", "ta": "Tamil", "si": "Sinhala",
            "es": "Spanish", "fr": "French", "de": "German",
        }.get(code, "English")
    except Exception:
        return "English"


# ─── Model Loaders ────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _get_english_nlp():
    import spacy
    try:
        return spacy.load("en_core_web_sm")
    except OSError:
        from spacy.cli import download
        download("en_core_web_sm")
        return spacy.load("en_core_web_sm")


@lru_cache(maxsize=1)
def _get_tamil_nlp():
    import stanza
    return stanza.Pipeline(
        lang="ta",
        processors="tokenize,pos,lemma",
        use_gpu=False,
        verbose=False,
    )


@lru_cache(maxsize=1)
def _get_sentiment_pipeline():
    from transformers import pipeline
    return pipeline(
        "sentiment-analysis",
        model="cardiffnlp/twitter-xlm-roberta-base-sentiment",
        tokenizer="cardiffnlp/twitter-xlm-roberta-base-sentiment",
        device=-1,
    )


@lru_cache(maxsize=1)
def _get_ner_pipeline():
    from transformers import pipeline
    return pipeline(
        "ner",
        model="Davlan/xlm-roberta-base-ner-hrl",
        aggregation_strategy="simple",
        device=-1,
    )


@lru_cache(maxsize=1)
def _get_classification_pipeline():
    from transformers import pipeline
    return pipeline(
        "zero-shot-classification",
        model="joeddav/xlm-roberta-large-xnli",
        device=-1,
    )


# ─── POS Label Maps ───────────────────────────────────────────────────

TAMIL_POS_LABELS = {
    "NOUN": "பெயர்ச்சொல்",  "VERB": "வினைச்சொல்",       "ADJ":   "பெயரடை",
    "ADV":  "வினையடை",       "PROPN": "சிறப்புப் பெயர்ச்சொல்", "PRON": "பிறவிப்பெயர்",
    "DET":  "சுட்டு",         "ADP":  "வேற்றுமை உருபு",   "CCONJ": "இணைப்பு இடைச்சொல்",
    "SCONJ":"சார்பு இடைச்சொல்","PART":"இடைச்சொல்",        "AUX":   "துணை வினை",
    "NUM":  "எண்",             "PUNCT":"நிறுத்தற்குறி",    "SYM":   "சின்னம்",
    "INTJ": "உணர்ச்சிச்சொல்","X":    "மற்றவை",
}

SINHALA_POS_LABELS = {
    "NOUN": "නාමපදය",         "VERB": "ක්‍රියාපදය",       "ADJ":   "විශේෂණය",
    "ADV":  "ක්‍රියා විශේෂණය","PROPN":"විශේෂ නාමය",        "PRON":  "සර්වනාමය",
    "DET":  "නිශ්චායකය",      "ADP":  "පරිසර්ගය",          "CCONJ": "සම්බන්ධක",
    "SCONJ":"අශ්‍රිත සම්බන්ධක","PART":"ඛණ්ඩය",             "AUX":   "සහායක ක්‍රියාව",
    "NUM":  "සංඛ්‍යාව",        "PUNCT":"විරාම ලකුණ",        "SYM":   "සංකේතය",
    "INTJ": "විස්මය පදය",     "X":    "වෙනත්",
}

EN_POS_LABELS = {
    "NOUN": "Noun",      "VERB":  "Verb",         "ADJ":   "Adjective",
    "ADV":  "Adverb",    "PROPN": "Proper Noun",  "PRON":  "Pronoun",
    "DET":  "Determiner","ADP":   "Preposition",  "CCONJ": "Conjunction",
    "SCONJ":"Subordinating Conjunction",           "PART":  "Particle",
    "AUX":  "Auxiliary Verb",                      "NUM":   "Number",
    "PUNCT":"Punctuation","SYM":  "Symbol",        "INTJ":  "Interjection",
    "X":    "Other",
}


# ─── Shared Helpers ───────────────────────────────────────────────────

def _safe_truncate(text: str, max_chars: int = 400) -> str:
    """Truncate at word boundary, safe for Unicode text."""
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    last_space = truncated.rfind(" ")
    if last_space > max_chars // 2:
        truncated = truncated[:last_space]
    return truncated


def _get_sentiment(text: str, lang: str) -> dict:
    try:
        clf    = _get_sentiment_pipeline()
        result = clf(_safe_truncate(text))[0]
        label  = result["label"].lower()
        label_map = {
            "positive": {"English": "Positive", "Tamil": "நேர்மறை",  "Sinhala": "ධනාත්මක"},
            "negative": {"English": "Negative", "Tamil": "எதிர்மறை", "Sinhala": "ඍණාත්මක"},
            "neutral":  {"English": "Neutral",  "Tamil": "நடுநிலை",  "Sinhala": "උදාසීන"},
        }
        return {
            "label":    label_map.get(label, {}).get(lang, result["label"]),
            "label_en": result["label"],
            "score":    float(round(float(result["score"]), 3)),  # force native float
        }
    except Exception as e:
        print(f"[Sentiment] Failed: {e}", flush=True)
        return {}


def _get_ner(text: str, lang: str) -> list:
    NER_MAP = {
        "PER":  {"English": "Person",        "Tamil": "நபர்",      "Sinhala": "පුද්ගල නාමය"},
        "ORG":  {"English": "Organization",  "Tamil": "நிறுவனம்",  "Sinhala": "සංවිධානය"},
        "LOC":  {"English": "Location",      "Tamil": "இடம்",      "Sinhala": "ස්ථාන නාමය"},
        "MISC": {"English": "Miscellaneous", "Tamil": "இதர",       "Sinhala": "විවිධ"},
    }
    entities = []
    try:
        ner = _get_ner_pipeline()
        for ent in ner(_safe_truncate(text)):
            group = ent["entity_group"]
            entities.append({
                "text":     ent["word"],
                "label":    NER_MAP.get(group, {}).get(lang, group),
                "label_en": group,
                "score":    float(round(float(ent["score"]), 3)),  # force native float
            })
    except Exception as e:
        print(f"[NER] Failed: {e}", flush=True)
    return entities


def _get_classification(text: str, lang: str) -> dict:
    labels_map = {
        "English": ["Politics", "Sports", "Technology", "Health", "Education", "Business", "Entertainment", "Science"],
        "Tamil":   ["அரசியல்", "விளையாட்டு", "தொழில்நுட்பம்", "சுகாதாரம்", "கல்வி", "வணிகம்", "பொழுதுபோக்கு", "அறிவியல்"],
        "Sinhala": ["දේශපාලනය", "ක්‍රීඩා", "තාක්ෂණය", "සෞඛ්‍යය", "අධ්‍යාපනය", "ව්‍යාපාරය", "විනෝදාස්වාදය", "විද්‍යාව"],
    }
    en_labels     = labels_map["English"]
    native_labels = labels_map.get(lang, en_labels)
    try:
        clf    = _get_classification_pipeline()
        result = clf(_safe_truncate(text), candidate_labels=en_labels)
        return {
            "label":    native_labels[en_labels.index(result["labels"][0])],
            "label_en": result["labels"][0],
            "score":    float(round(float(result["scores"][0]), 3)),  # force native float
            "all": [
                {
                    "label":    native_labels[en_labels.index(l)],
                    "label_en": l,
                    "score":    float(round(float(s), 3)),  # force native float
                }
                for l, s in zip(result["labels"], result["scores"])
            ],
        }
    except Exception as e:
        print(f"[Classification] Failed: {e}", flush=True)
        return {}


# ─── Language Pipelines ───────────────────────────────────────────────

def _analyze_tamil(text: str, max_chars: int = 100_000) -> dict:
    print("[NLP] Running Tamil pipeline (Stanza)", flush=True)
    nlp = _get_tamil_nlp()
    doc = nlp(text[:max_chars])

    token_texts, token_details, lemmas = [], [], []
    pos_counter, word_freq = Counter(), Counter()
    sentences = []

    for sentence in doc.sentences:
        sentences.append(sentence.text.strip())
        for word in sentence.words:
            pos       = word.upos or "X"
            pos_label = TAMIL_POS_LABELS.get(pos, pos)
            if pos != "PUNCT":
                token_texts.append(word.text)
                lemma = word.lemma or word.text
                lemmas.append(lemma)
                word_freq[lemma.lower()] += 1
            pos_counter[pos_label] += 1
            token_details.append({
                "text":    word.text,
                "lemma":   word.lemma or word.text,
                "pos":     pos,
                "tag":     pos_label,
                "is_stop": False,
                "morph":   word.feats or "",
            })

    return {
        "language":         "Tamil",
        "language_display": "தமிழ்",
        "tokens":           token_texts,
        "token_count":      len(token_texts),
        "unique_tokens":    len({t.lower() for t in token_texts}),
        "lemmas":           lemmas,
        "top_keywords":     [w for w, _ in word_freq.most_common(10)],
        "token_details":    token_details[:5000],
        "pos_distribution": dict(pos_counter),
        "top_words":        word_freq.most_common(50),
        "sentences":        sentences[:100],
        "sentence_count":   len(sentences),
        "sentiment":        _get_sentiment(text, "Tamil"),
        "entities":         _get_ner(text, "Tamil"),
        "classification":   _get_classification(text, "Tamil"),
        "spelling_corrections": [],
    }


def _sinhala_pos(word: str) -> str:
    if all(c in '.,!?;:\'\"()[]{}' for c in word):
        return "PUNCT"
    if word.isdigit():
        return "NUM"
    pronouns = ["මම", "ඔබ", "ඔහු", "ඇය", "අපි", "ඔවුන්", "එය", "ඒ", "මේ", "ඔය"]
    if word in pronouns:
        return "PRON"
    verb_suffixes = ["කරයි", "කරනවා", "කළා", "යයි", "යනවා", "ගියා", "නවා", "වෙනවා", "වුණා"]
    adj_suffixes  = ["වූ", "ඇති", "නැති", "හොඳ", "ලොකු", "කුඩා"]
    noun_suffixes = ["යා", "යන්", "වල", "ගේ", "ට", "ම", "ක්", "කම"]
    for s in verb_suffixes:
        if word.endswith(s):
            return "VERB"
    for s in adj_suffixes:
        if word.endswith(s):
            return "ADJ"
    for s in noun_suffixes:
        if word.endswith(s) and len(word) > len(s):
            return "NOUN"
    return "NOUN"


def _analyze_sinhala(text: str, max_chars: int = 100_000) -> dict:
    print("[NLP] Running Sinhala pipeline", flush=True)
    raw_tokens = text[:max_chars].split()
    token_texts, token_details = [], []
    pos_counter, word_freq = Counter(), Counter()

    for token in raw_tokens:
        token = token.strip()
        if not token:
            continue
        pos       = _sinhala_pos(token)
        pos_label = SINHALA_POS_LABELS.get(pos, pos)
        if pos != "PUNCT":
            token_texts.append(token)
            word_freq[token.lower()] += 1
        pos_counter[pos_label] += 1
        token_details.append({
            "text": token, "lemma": token, "pos": pos,
            "tag":  pos_label, "is_stop": False, "morph": "",
        })

    return {
        "language":         "Sinhala",
        "language_display": "සිංහල",
        "tokens":           token_texts,
        "token_count":      len(token_texts),
        "unique_tokens":    len({t.lower() for t in token_texts}),
        "lemmas":           token_texts,
        "top_keywords":     [w for w, _ in word_freq.most_common(10)],
        "token_details":    token_details[:5000],
        "pos_distribution": dict(pos_counter),
        "top_words":        word_freq.most_common(50),
        "sentences":        text[:max_chars].split("."),
        "sentence_count":   text[:max_chars].count("."),
        "sentiment":        _get_sentiment(text, "Sinhala"),
        "entities":         _get_ner(text, "Sinhala"),
        "classification":   _get_classification(text, "Sinhala"),
        "spelling_corrections": [],
    }


def _analyze_english(text: str, max_chars: int = 100_000) -> dict:
    print("[NLP] Running English pipeline (spaCy)", flush=True)
    nlp = _get_english_nlp()
    doc = nlp(text[:max_chars])

    token_texts, token_details, lemmas = [], [], []
    pos_counter, word_freq = Counter(), Counter()
    sentences = []

    for token in doc:
        if token.is_space:
            continue
        pos_value = token.pos_ or "X"
        pos_label = EN_POS_LABELS.get(pos_value, pos_value)
        if not token.is_punct:
            token_texts.append(token.text)
            lemma = token.lemma_ or token.text
            lemmas.append(lemma)
            if not token.is_stop:
                word_freq[lemma.lower()] += 1
        pos_counter[pos_label] += 1
        token_details.append({
            "text":    token.text,
            "lemma":   token.lemma_ or token.text,
            "pos":     pos_value,
            "tag":     pos_label,
            "is_stop": bool(token.is_stop),
            "morph":   str(token.morph) if token.morph else "",
        })

    for sent in doc.sents:
        sentences.append(sent.text.strip())

    NER_LABELS = {
        "PERSON": "Person",       "ORG":      "Organization", "GPE":  "Country/City",
        "LOC":    "Location",     "DATE":     "Date",         "TIME": "Time",
        "MONEY":  "Money",        "PERCENT":  "Percentage",   "PRODUCT": "Product",
        "EVENT":  "Event",        "LAW":      "Law",          "LANGUAGE": "Language",
        "NORP":   "Nationality/Group",        "CARDINAL": "Number",
    }
    entities = [
        {
            "text":     ent.text,
            "label":    NER_LABELS.get(ent.label_, ent.label_),
            "label_en": ent.label_,
            "start":    ent.start_char,
            "end":      ent.end_char,
        }
        for ent in doc.ents
    ]

    return {
        "language":         "English",
        "language_display": "English",
        "tokens":           token_texts,
        "token_count":      len(token_texts),
        "unique_tokens":    len({t.lower() for t in token_texts}),
        "lemmas":           lemmas,
        "top_keywords":     [w for w, _ in word_freq.most_common(10)],
        "token_details":    token_details[:5000],
        "pos_distribution": dict(pos_counter),
        "top_words":        word_freq.most_common(50),
        "sentences":        sentences[:100],
        "sentence_count":   len(sentences),
        "entities":         entities[:200],
        "entity_count":     len(entities),
        "sentiment":        _get_sentiment(text, "English"),
        "classification":   _get_classification(text, "English"),
        "spelling_corrections": [],
    }


# ─── Main Entry Point ─────────────────────────────────────────────────

def analyze(text: str, max_chars: int = 100_000) -> dict:
    """Auto-detect language and run full NLP pipeline."""
    if not text or not text.strip():
        return {
            "language": "unknown", "language_display": "Unknown",
            "token_count": 0, "unique_tokens": 0, "top_keywords": [],
            "tokens": [], "token_details": [], "pos_distribution": {},
            "top_words": [], "sentences": [], "sentence_count": 0,
            "sentiment": {}, "entities": [], "classification": {},
            "spelling_corrections": [],
        }

    lang = _detect_language(text)
    print(f"[NLP] Detected language: {lang}", flush=True)

    if lang == "Tamil":
        result = _analyze_tamil(text, max_chars)
    elif lang == "Sinhala":
        result = _analyze_sinhala(text, max_chars)
    else:
        result = _analyze_english(text, max_chars)

    return _to_python(result)  # ← converts ALL numpy types before MongoDB insert