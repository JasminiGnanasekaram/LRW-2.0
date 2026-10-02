"""
Comprehensive Multilingual NLP Engine for English, Tamil, and Sinhala.
Provides:
- Language Detection (Document-level & Sentence-level)
- Sentence Segmentation (Abbreviation & Decimal safe)
- Language-Aware Tokenization & Unicode Handling
- Part-of-Speech (POS) Tagging with Fallbacks
- Lemmatization & Morphological Feature Extraction
- Named Entity Recognition (NER) (Local Gazetteer + Rule-based + Optional LLM)
- Sentiment Analysis (Overall & Sentence-by-Sentence)
- Domain Text Classification with Probability Distribution
- Detailed Corpus & Document Statistics
"""

import re
import unicodedata
from collections import Counter
from functools import lru_cache
from typing import Dict, List, Any, Optional, Tuple

NLP_RULES_VERSION = 8


# ==============================================================================
# 1. LANGUAGE DETECTION
# ==============================================================================

def detect_languages(text: str) -> Dict[str, Any]:
    """
    Detect languages and their distribution based on script characters and vocabulary.
    Returns:
    {
        "primary_language": "Tamil",
        "primary_code": "ta",
        "is_multilingual": True,
        "languages_detected": [
            {"language": "Tamil", "code": "ta", "percentage": 72.5},
            {"language": "English", "code": "en", "percentage": 20.1},
            {"language": "Sinhala", "code": "si", "percentage": 7.4}
        ],
        "script_counts": {"Tamil": 450, "English": 125, "Sinhala": 46}
    }
    """
    if not text or not text.strip():
        return {
            "primary_language": "English",
            "primary_code": "en",
            "is_multilingual": False,
            "languages_detected": [{"language": "English", "code": "en", "percentage": 100.0}],
            "script_counts": {"English": 0, "Tamil": 0, "Sinhala": 0},
        }

    sample = text[:50000]
    
    sinhala_count = sum(1 for ch in sample if '\u0D80' <= ch <= '\u0DFF')
    tamil_count = sum(1 for ch in sample if '\u0B80' <= ch <= '\u0BFF')
    english_count = sum(1 for ch in sample if ('a' <= ch <= 'z') or ('A' <= ch <= 'Z'))

    total_alpha = sinhala_count + tamil_count + english_count

    if total_alpha == 0:
        return {
            "primary_language": "English",
            "primary_code": "en",
            "is_multilingual": False,
            "languages_detected": [{"language": "English", "code": "en", "percentage": 100.0}],
            "script_counts": {"English": 0, "Tamil": 0, "Sinhala": 0},
        }

    si_pct = round((sinhala_count / total_alpha) * 100, 1)
    ta_pct = round((tamil_count / total_alpha) * 100, 1)
    en_pct = round((english_count / total_alpha) * 100, 1)

    breakdown = []
    if ta_pct > 0:
        breakdown.append({"language": "Tamil", "code": "ta", "percentage": ta_pct})
    if si_pct > 0:
        breakdown.append({"language": "Sinhala", "code": "si", "percentage": si_pct})
    if en_pct > 0:
        breakdown.append({"language": "English", "code": "en", "percentage": en_pct})

    # Sort descending by percentage
    breakdown.sort(key=lambda x: x["percentage"], reverse=True)

    primary = breakdown[0]["language"] if breakdown else "English"
    primary_code = breakdown[0]["code"] if breakdown else "en"

    # Multilingual if secondary language is at least 5%
    is_multi = len([b for b in breakdown if b["percentage"] >= 5.0]) > 1

    return {
        "primary_language": primary,
        "primary_code": primary_code,
        "is_multilingual": is_multi,
        "languages_detected": breakdown,
        "script_counts": {
            "English": english_count,
            "Tamil": tamil_count,
            "Sinhala": sinhala_count,
        }
    }


def detect_sentence_language(sentence: str) -> str:
    """Detect language of a single sentence or phrase."""
    if not sentence or not sentence.strip():
        return "English"
    
    si = sum(1 for ch in sentence if '\u0D80' <= ch <= '\u0DFF')
    ta = sum(1 for ch in sentence if '\u0B80' <= ch <= '\u0BFF')
    en = sum(1 for ch in sentence if ('a' <= ch <= 'z') or ('A' <= ch <= 'Z'))

    if si >= ta and si >= en and si > 0:
        return "Sinhala"
    if ta >= si and ta >= en and ta > 0:
        return "Tamil"
    if en > 0:
        return "English"
    return "English"


# ==============================================================================
# 2. MULTILINGUAL SENTENCE SEGMENTATION
# ==============================================================================

def segment_sentences(text: str) -> List[str]:
    """
    Multilingual sentence boundary detector.
    Splits text on ., !, ?, ।, ॥, and newlines without breaking:
    - Decimal numbers (e.g., 3.14, 10.50, Rs. 500.00)
    - Honorifics and common abbreviations (Dr., Mr., Mrs., Prof., Rs., etc.)
    - Person initials (e.g. A. B. Perera, J. R. Jayewardene)
    - URLs & Emails
    """
    if not text or not text.strip():
        return []

    # Normalize newlines
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    protected = normalized
    
    # 1. Protect decimals (digits.digits)
    protected = re.sub(r'(\d+)\.(\d+)', r'\1<DECIMAL_DOT>\2', protected)
    
    # 2. Protect URLs & emails
    def _mask_url(m):
        return m.group(0).replace('.', '<URL_DOT>')
    protected = re.sub(r'(https?://\S+|www\.\S+|\S+@\S+\.\S+)', _mask_url, protected)
    
    # 3. Protect initials (e.g. "A. B. ", "J. R. ")
    protected = re.sub(r'(?<=\b[A-Za-z])\.(?=\s+[A-Za-z]\b)', '<INITIAL_DOT>', protected)
    protected = re.sub(r'(?<=\b[A-Za-z])\.(?=\s+[A-Z][a-z])', '<INITIAL_DOT>', protected)
    
    # 4. Protect common title abbreviations (only when followed by names/words)
    title_abbr_pattern = re.compile(
        r'\b(Dr|Mr|Mrs|Ms|Prof|Rev|Hon|Capt|Col|Gen|Gov|Sgt|St|Jr|Sr|Ltd|Plc|Pvt|Co|Corp|Inc|Dept|approx|est|fig|No|Nos|vs|vol|vols|e\.g|i\.e|etc|al|Rs|LKR|min|sec|hr|km|cm|mm|kg)\.(?=\s+)',
        re.IGNORECASE
    )
    protected = title_abbr_pattern.sub(r'\1<ABBR_DOT>', protected)

    # 5. Split on sentence boundaries: ., !, ?, ।, ॥, or line-breaks
    raw_sents = re.split(r'(?<=[.!?|।॥\n])\s+', protected)
    
    cleaned_sents = []
    for s in raw_sents:
        # Restore placeholders
        s = s.replace('<DECIMAL_DOT>', '.')
        s = s.replace('<URL_DOT>', '.')
        s = s.replace('<INITIAL_DOT>', '.')
        s = s.replace('<ABBR_DOT>', '.')
        s = s.strip()
        if s and len(s) > 1:
            cleaned_sents.append(s)
            
    return cleaned_sents if cleaned_sents else [text.strip()]


# ==============================================================================
# 3. SPACY & ENGLISH NLP
# ==============================================================================

@lru_cache(maxsize=1)
def _get_english_nlp():
    """Load spaCy model with safety fallback."""
    try:
        import spacy
        return spacy.load("en_core_web_sm")
    except Exception:
        try:
            import spacy
            from spacy.cli import download
            download("en_core_web_sm")
            return spacy.load("en_core_web_sm")
        except Exception:
            return None


@lru_cache(maxsize=1)
def _get_tamil_nlp():
    """Load the local Stanza Tamil tokenizer/POS/lemma model using the correct Stanza API."""
    try:
        import stanza
        try:
            stanza.download("ta", processors="tokenize,mwt,pos,lemma")
        except Exception:
            pass
        return stanza.Pipeline(
            "ta",
            processors="tokenize,mwt,pos,lemma",
            download_method=None,
            verbose=False,
        )
    except Exception:
        return None


def _tokenize_english_regex(text: str) -> List[str]:
    """Fallback regex tokenizer for English."""
    return re.findall(r"[A-Za-z0-9]+(?:'[A-Za-z]+)?|[^\w\s]", text)


def _is_punctuation_token(token: str) -> bool:
    return bool(token) and all(c in '.,!?;:|।॥\'"()[]{}<>-–—/\\@#$%&*+=_~^`' for c in token)


# ==============================================================================
# 4. TAMIL NLP ENGINE (Tokenization, POS, Lemmatization, Morphology)
# ==============================================================================

# Tamil POS & Morphological dictionaries
TAMIL_PRONOUNS = {
    "நான்": ("PRON", "நான்", "Case=Nom|Number=Sing|Person=1"),
    "நாம்": ("PRON", "நாம்", "Case=Nom|Number=Plur|Person=1"),
    "நாங்கள்": ("PRON", "நாங்கள்", "Case=Nom|Number=Plur|Person=1"),
    "நீ": ("PRON", "நீ", "Case=Nom|Number=Sing|Person=2"),
    "நீங்கள்": ("PRON", "நீங்கள்", "Case=Nom|Number=Plur|Person=2"),
    "அவன்": ("PRON", "அவன்", "Case=Nom|Gender=Masc|Number=Sing|Person=3"),
    "அவள்": ("PRON", "அவள்", "Case=Nom|Gender=Fem|Number=Sing|Person=3"),
    "அவர்": ("PRON", "அவர்", "Case=Nom|Number=Sing|Person=3|Polite=Yes"),
    "அவர்கள்": ("PRON", "அவர்கள்", "Case=Nom|Number=Plur|Person=3"),
    "அது": ("PRON", "அது", "Case=Nom|Gender=Neut|Number=Sing|Person=3"),
    "அவை": ("PRON", "அவை", "Case=Nom|Gender=Neut|Number=Plur|Person=3"),
    "இது": ("PRON", "இது", "Case=Nom|Gender=Neut|Number=Sing|Person=3"),
    "இவை": ("PRON", "இவை", "Case=Nom|Gender=Neut|Number=Plur|Person=3"),
    "இவன்": ("PRON", "இவன்", "Case=Nom|Gender=Masc|Number=Sing|Person=3"),
    "இவள்": ("PRON", "இவள்", "Case=Nom|Gender=Fem|Number=Sing|Person=3"),
    "இவர்": ("PRON", "இவர்", "Case=Nom|Number=Sing|Person=3|Polite=Yes"),
    "யார்": ("PRON", "யார்", "PronType=Int"),
    "என்ன": ("PRON", "என்ன", "PronType=Int"),
    "எது": ("PRON", "எது", "PronType=Int"),
    "தான்": ("PRON", "தான்", "PronType=Prs|Reflex=Yes"),
    "தாம்": ("PRON", "தாம்", "PronType=Prs|Reflex=Yes"),
}

TAMIL_CONJUNCTIONS = {
    "மற்றும்", "ஆனால்", "அல்லது", "எனவே", "ஆகையால்", "ஆயினும்",
    "மேலும்", "எனினும்", "ஆனாலும்", "ஆகவே", "உடன்", "என்று",
}

TAMIL_POSTPOSITIONS = {
    "இடம்", "குறித்து", "பற்றி", "பொழுது", "போது", "வரை", "பின்", "முன்",
    "உள்", "வெளியே", "மேல்", "கீழ்", "இடையே", "நடுவில்", "சார்பாக",
}

TAMIL_DETERMINERS = {
    "ஒரு", "இந்த", "அந்த", "எந்த", "இவ்வொரு", "அவ்வொரு",
}

TAMIL_ADJECTIVES = {
    "அழகான", "புதிய", "பழைய", "நல்ல", "சிறந்த", "பெரிய", "சிறிய",
    "முக்கியமான", "மிகப்பெரிய", "நவீன", "தமிழ்",
}

TAMIL_VERB_ROOTS = {
    "செய்": "செய்", "படி": "படி", "எழுது": "எழுது", "பார்": "பார்",
    "முன்னேறு": "முன்னேறு", "முன்னேறுங்": "முன்னேறு", "முன்னேறுங்கள்": "முன்னேறு",
    "வலுப்படுத்து": "வலுப்படுத்து", "வலுப்படுத்தும்": "வலுப்படுத்து",
    "மற": "மற", "மறக்க": "மற", "மறக்காதீர்": "மற", "மறக்காதீர்கள்": "மற",
    "மாறு": "மாறு", "மாறும்": "மாறு", "மாற்று": "மாற்று", "மாற்றும்": "மாற்று",
    "வாழ்": "வாழ்", "வாழ": "வாழ்", "வாழும்": "வாழ்", "வாழ்க": "வாழ்",
    "கடினமாகு": "கடினமாகு", "கடினமாகும்": "கடினமாகு",
    "சுலபமாகு": "சுலபமாகு", "சாத்தியமாகு": "சாத்தியமாகு", "தெளிவாகு": "தெளிவாகு",
    "ஆரோக்கியமாகு": "ஆரோக்கியமாகு", "ஆரோக்கியமாகும்": "ஆரோக்கியமாகு", "ஆரோக்கியமாக": "ஆரோக்கியமாகு", "ஆரோக்கியமா": "ஆரோக்கியமாகு",
    "வா": "வா", "போ": "போ", "இரு": "இரு", "கொள்": "கொள்", "கொடு": "கொடு",
    "சொல்": "சொல்", "கூறு": "கூறு", "நட": "நட", "நில்": "நில்", "கேள்": "கேள்",
    "உருவாக்கு": "உருவாக்கு", "பயன்படுத்து": "பயன்படுத்து", "தெரிவி": "தெரிவி",
    "முயல்": "முயல்", "முயன்று": "முயல்", "முயன்றால்": "முயல்",
}

TAMIL_COMMON_VERBS = {
    "ஆரோக்கியமாக": ("VERB", "ஆரோக்கியமாகு", "VerbForm=Inf"),
    "ஆரோக்கியமா": ("VERB", "ஆரோக்கியமாகு", "VerbForm=Inf"),
    "ஆரோக்கியமாகும்": ("VERB", "ஆரோக்கியமாகு", "Tense=Fut|VerbForm=Part"),
    "ஆரோக்கியமாகிறது": ("VERB", "ஆரோக்கியமாகு", "Tense=Pres|Gender=Neut|Number=Sing|Person=3"),
    "ஆரோக்கியமானது": ("VERB", "ஆரோக்கியமாகு", "Tense=Past|Gender=Neut|Number=Sing"),
    "ஆரோக்கியமாகி": ("VERB", "ஆரோக்கியமாகு", "VerbForm=Part|Aspect=Perf"),
    "கடினமாகும்": ("VERB", "கடினமாகு", "Tense=Fut|VerbForm=Part"),
    "கடினமாகிறது": ("VERB", "கடினமாகு", "Tense=Pres|Gender=Neut|Number=Sing|Person=3"),
    "கடினமானது": ("VERB", "கடினமாகு", "Tense=Past|Gender=Neut|Number=Sing"),
    "கடினமாகி": ("VERB", "கடினமாகு", "VerbForm=Part|Aspect=Perf"),
    "கடினமாக": ("VERB", "கடினமாகு", "VerbForm=Inf"),
    "சுலபமாகும்": ("VERB", "சுலபமாகு", "Tense=Fut|VerbForm=Part"),
    "சாத்தியமாகும்": ("VERB", "சாத்தியமாகு", "Tense=Fut|VerbForm=Part"),
    "தெளிவாகும்": ("VERB", "தெளிவாகு", "Tense=Fut|VerbForm=Part"),
    "அவசியமாகும்": ("VERB", "அவசியமாகு", "Tense=Fut|VerbForm=Part"),
    "வாழக்கூடாது": ("VERB", "வாழ்", "Mood=Proh|Polarity=Neg"),
    "வாழலாம்": ("VERB", "வாழ்", "Mood=Pot"),
    "வாழ்க": ("VERB", "வாழ்", "Mood=Opt"),
    "வாழ்கிறார்": ("VERB", "வாழ்", "Tense=Pres|Number=Sing|Person=3|Polite=Yes"),
    "வாழ்கிறார்கள்": ("VERB", "வாழ்", "Tense=Pres|Number=Plur|Person=3"),
    "வாழ்கிறது": ("VERB", "வாழ்", "Tense=Pres|Gender=Neut|Number=Sing|Person=3"),
    "வாழ்ந்தார்": ("VERB", "வாழ்", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
    "வாழ்ந்தார்கள்": ("VERB", "வாழ்", "Tense=Past|Number=Plur|Person=3"),
    "வாழ்ந்தது": ("VERB", "வாழ்", "Tense=Past|Gender=Neut|Number=Sing"),
    "வாழ்ந்து": ("VERB", "வாழ்", "VerbForm=Part|Aspect=Perf"),
    "வாழ": ("VERB", "வாழ்", "VerbForm=Inf"),
    "வாழும்": ("VERB", "வாழ்", "Tense=Fut|VerbForm=Part"),
    "வாழுங்கள்": ("VERB", "வாழ்", "Mood=Imp|Number=Plur|Person=2|Polite=Yes"),
    "வாழ்": ("VERB", "வாழ்", "Mood=Imp|Number=Sing|Person=2"),
    "செய்யக்கூடாது": ("VERB", "செய்", "Mood=Proh|Polarity=Neg"),
    "போகக்கூடாது": ("VERB", "போ", "Mood=Proh|Polarity=Neg"),
    "வரக்கூடாது": ("VERB", "வா", "Mood=Proh|Polarity=Neg"),
    "பார்க்கக்கூடாது": ("VERB", "பார்", "Mood=Proh|Polarity=Neg"),
    "படிக்கக்கூடாது": ("VERB", "படி", "Mood=Proh|Polarity=Neg"),
    "மாறும்": ("VERB", "மாறு", "Tense=Fut|VerbForm=Part"),
    "மாறுகிறது": ("VERB", "மாறு", "Tense=Pres|Gender=Neut|Number=Sing|Person=3"),
    "மாறுகிறார்": ("VERB", "மாறு", "Tense=Pres|Number=Sing|Person=3|Polite=Yes"),
    "மாறுகிறார்கள்": ("VERB", "மாறு", "Tense=Pres|Number=Plur|Person=3"),
    "மாறியது": ("VERB", "மாறு", "Tense=Past|Gender=Neut|Number=Sing"),
    "மாறினார்": ("VERB", "மாறு", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
    "மாறினர்": ("VERB", "மாறு", "Tense=Past|Number=Plur|Person=3"),
    "மாறி": ("VERB", "மாறு", "VerbForm=Part|Aspect=Perf"),
    "மாற": ("VERB", "மாறு", "VerbForm=Inf"),
    "மாறு": ("VERB", "மாறு", "Mood=Imp|Number=Sing|Person=2"),
    "மாறுங்கள்": ("VERB", "மாறு", "Mood=Imp|Number=Plur|Person=2|Polite=Yes"),
    "மாற்றும்": ("VERB", "மாற்று", "Tense=Fut|VerbForm=Part"),
    "மாற்றுகிறது": ("VERB", "மாற்று", "Tense=Pres|Gender=Neut|Number=Sing|Person=3"),
    "மாற்றினார்": ("VERB", "மாற்று", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
    "மாற்றி": ("VERB", "மாற்று", "VerbForm=Part|Aspect=Perf"),
    "மாற்ற": ("VERB", "மாற்று", "VerbForm=Inf"),
    "வலுப்படுத்தும்": ("VERB", "வலுப்படுத்து", "Tense=Fut|VerbForm=Part"),
    "வலுப்படுத்துகிறது": ("VERB", "வலுப்படுத்து", "Tense=Pres|Gender=Neut|Number=Sing|Person=3"),
    "வலுப்படுத்துகிறார்": ("VERB", "வலுப்படுத்து", "Tense=Pres|Number=Sing|Person=3|Polite=Yes"),
    "வலுப்படுத்துகிறார்கள்": ("VERB", "வலுப்படுத்து", "Tense=Pres|Number=Plur|Person=3"),
    "வலுப்படுத்தியது": ("VERB", "வலுப்படுத்து", "Tense=Past|Gender=Neut|Number=Sing|Person=3"),
    "வலுப்படுத்தினார்": ("VERB", "வலுப்படுத்து", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
    "வலுப்படுத்தினர்": ("VERB", "வலுப்படுத்து", "Tense=Past|Number=Plur|Person=3"),
    "வலுப்படுத்தி": ("VERB", "வலுப்படுத்து", "VerbForm=Part|Aspect=Perf"),
    "வலுப்படுத்த": ("VERB", "வலுப்படுத்து", "VerbForm=Inf"),
    "வலுப்படுத்து": ("VERB", "வலுப்படுத்து", "Mood=Imp|Number=Sing|Person=2"),
    "வலுப்படுத்துங்கள்": ("VERB", "வலுப்படுத்து", "Mood=Imp|Number=Plur|Person=2|Polite=Yes"),
    "மறக்காதீர்கள்": ("VERB", "மற", "Mood=Imp|Polarity=Neg|Number=Plur|Person=2|Polite=Yes"),
    "மறக்காதீர்": ("VERB", "மற", "Mood=Imp|Polarity=Neg|Number=Sing|Person=2|Polite=Yes"),
    "மறக்காதே": ("VERB", "மற", "Mood=Imp|Polarity=Neg|Number=Sing|Person=2"),
    "மறக்காமல்": ("VERB", "மற", "VerbForm=Part|Polarity=Neg"),
    "மறந்து": ("VERB", "மற", "VerbForm=Part|Aspect=Perf"),
    "மறந்தார்": ("VERB", "மற", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
    "மறந்தார்கள்": ("VERB", "மற", "Tense=Past|Number=Plur|Person=3"),
    "மறந்தது": ("VERB", "மற", "Tense=Past|Gender=Neut|Number=Sing"),
    "மறக்கிறார்": ("VERB", "மற", "Tense=Pres|Number=Sing|Person=3|Polite=Yes"),
    "மறக்கிறார்கள்": ("VERB", "மற", "Tense=Pres|Number=Plur|Person=3"),
    "மறக்கும்": ("VERB", "மற", "Tense=Fut|VerbForm=Part"),
    "மறக்க": ("VERB", "மற", "VerbForm=Inf"),
    "முன்னேறுங்கள்": ("VERB", "முன்னேறு", "Mood=Imp|Number=Plur|Person=2|Polite=Yes"),
    "முன்னேறுங்": ("VERB", "முன்னேறு", "Mood=Imp|Number=Plur|Person=2"),
    "முன்னேறு": ("VERB", "முன்னேறு", "Mood=Imp|Number=Sing|Person=2"),
    "முன்னேறி": ("VERB", "முன்னேறு", "VerbForm=Part|Aspect=Perf"),
    "முன்னேறியது": ("VERB", "முன்னேறு", "Tense=Past|Gender=Neut|Number=Sing"),
    "முன்னேறினார்": ("VERB", "முன்னேறு", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
    "முன்னேறினார்கள்": ("VERB", "முன்னேறு", "Tense=Past|Number=Plur|Person=3"),
    "முன்னேறினர்": ("VERB", "முன்னேறு", "Tense=Past|Number=Plur|Person=3"),
    "முன்னேறுகிறார்": ("VERB", "முன்னேறு", "Tense=Pres|Number=Sing|Person=3|Polite=Yes"),
    "முன்னேறுகிறார்கள்": ("VERB", "முன்னேறு", "Tense=Pres|Number=Plur|Person=3"),
    "முன்னேறும்": ("VERB", "முன்னேறு", "Tense=Fut|VerbForm=Part"),
    "முன்னேற": ("VERB", "முன்னேறு", "VerbForm=Inf"),
    "செய்யுங்கள்": ("VERB", "செய்", "Mood=Imp|Number=Plur|Person=2|Polite=Yes"),
    "படியுங்கள்": ("VERB", "படி", "Mood=Imp|Number=Plur|Person=2|Polite=Yes"),
    "எழுதுங்கள்": ("VERB", "எழுது", "Mood=Imp|Number=Plur|Person=2|Polite=Yes"),
    "வாருங்கள்": ("VERB", "வா", "Mood=Imp|Number=Plur|Person=2|Polite=Yes"),
    "பாருங்கள்": ("VERB", "பார்", "Mood=Imp|Number=Plur|Person=2|Polite=Yes"),
    "செய்து": ("VERB", "செய்", "VerbForm=Part|Aspect=Perf"),
    "செய்தார்": ("VERB", "செய்", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
    "செய்தனர்": ("VERB", "செய்", "Tense=Past|Number=Plur|Person=3"),
    "செய்தான்": ("VERB", "செய்", "Tense=Past|Gender=Masc|Number=Sing|Person=3"),
    "செய்தாள்": ("VERB", "செய்", "Tense=Past|Gender=Fem|Number=Sing|Person=3"),
    "செய்தது": ("VERB", "செய்", "Tense=Past|Gender=Neut|Number=Sing|Person=3"),
    "செய்கிறார்": ("VERB", "செய்", "Tense=Pres|Number=Sing|Person=3|Polite=Yes"),
    "செய்கிறார்கள்": ("VERB", "செய்", "Tense=Pres|Number=Plur|Person=3"),
    "செய்கிறது": ("VERB", "செய்", "Tense=Pres|Gender=Neut|Number=Sing|Person=3"),
    "செய்வார்": ("VERB", "செய்", "Tense=Fut|Number=Sing|Person=3|Polite=Yes"),
    "செய்வார்கள்": ("VERB", "செய்", "Tense=Fut|Number=Plur|Person=3"),
    "செய்ய": ("VERB", "செய்", "VerbForm=Inf"),
    "செய்யும்": ("VERB", "செய்", "Tense=Fut|VerbForm=Part"),
    "படித்து": ("VERB", "படி", "VerbForm=Part|Aspect=Perf"),
    "படித்தார்": ("VERB", "படி", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
    "படித்தார்கள்": ("VERB", "படி", "Tense=Past|Number=Plur|Person=3"),
    "படிக்க": ("VERB", "படி", "VerbForm=Inf"),
    "எழுதி": ("VERB", "எழுது", "VerbForm=Part|Aspect=Perf"),
    "எழுதினார்": ("VERB", "எழுது", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
    "எழுதினார்கள்": ("VERB", "எழுது", "Tense=Past|Number=Plur|Person=3"),
    "பெற்று": ("VERB", "பெறு", "VerbForm=Part|Aspect=Perf"),
    "பெற்றார்": ("VERB", "பெறு", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
    "பெற்றார்கள்": ("VERB", "பெறு", "Tense=Past|Number=Plur|Person=3"),
    "பெற்றனர்": ("VERB", "பெறு", "Tense=Past|Number=Plur|Person=3"),
    "வந்து": ("VERB", "வா", "VerbForm=Part|Aspect=Perf"),
    "வந்தார்": ("VERB", "வா", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
    "வந்தார்கள்": ("VERB", "வா", "Tense=Past|Number=Plur|Person=3"),
    "வருகிறார்": ("VERB", "வா", "Tense=Pres|Number=Sing|Person=3|Polite=Yes"),
    "வருவார்": ("VERB", "வா", "Tense=Fut|Number=Sing|Person=3|Polite=Yes"),
    "வர": ("VERB", "வா", "VerbForm=Inf"),
    "போய்": ("VERB", "போ", "VerbForm=Part|Aspect=Perf"),
    "சென்று": ("VERB", "செல்", "VerbForm=Part|Aspect=Perf"),
    "சென்றார்": ("VERB", "செல்", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
    "சென்றார்கள்": ("VERB", "செல்", "Tense=Past|Number=Plur|Person=3"),
    "பார்த்து": ("VERB", "பார்", "VerbForm=Part|Aspect=Perf"),
    "பார்த்தார்": ("VERB", "பார்", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
    "இரு": ("VERB", "இரு", "Mood=Imp|Number=Sing|Person=2"),
    "இருங்கள்": ("VERB", "இரு", "Mood=Imp|Number=Plur|Person=2|Polite=Yes"),
    "இருக்க": ("VERB", "இரு", "VerbForm=Inf"),
    "இருந்து": ("VERB", "இரு", "VerbForm=Part|Aspect=Perf"),
    "இருந்தார்": ("VERB", "இரு", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
    "இருந்தார்கள்": ("VERB", "இரு", "Tense=Past|Number=Plur|Person=3"),
    "இருந்தது": ("VERB", "இரு", "Tense=Past|Gender=Neut|Number=Sing"),
    "இருந்தனர்": ("VERB", "இரு", "Tense=Past|Number=Plur|Person=3"),
    "இருக்கிறார்": ("VERB", "இரு", "Tense=Pres|Number=Sing|Person=3|Polite=Yes"),
    "இருக்கிறார்கள்": ("VERB", "இரு", "Tense=Pres|Number=Plur|Person=3"),
    "இருக்கிறது": ("VERB", "இரு", "Tense=Pres|Gender=Neut|Number=Sing|Person=3"),
    "இருக்கின்றன": ("VERB", "இரு", "Tense=Pres|Gender=Neut|Number=Plur|Person=3"),
    "இருப்பார்": ("VERB", "இரு", "Tense=Fut|Number=Sing|Person=3|Polite=Yes"),
    "இருப்பார்கள்": ("VERB", "இரு", "Tense=Fut|Number=Plur|Person=3"),
    "இருக்கும்": ("VERB", "இரு", "Tense=Fut|VerbForm=Part"),
    "இருக்கலாம்": ("VERB", "இரு", "Mood=Pot"),
    "இருக்கக்கூடாது": ("VERB", "இரு", "Mood=Proh|Polarity=Neg"),
    "உள்ளது": ("VERB", "உள்", "Tense=Pres|Gender=Neut|Number=Sing|Person=3"),
    "உள்ளன": ("VERB", "உள்", "Tense=Pres|Gender=Neut|Number=Plur|Person=3"),
    "இல்லை": ("VERB", "இல்", "Polarity=Neg"),
    "வேண்டும்": ("VERB", "வேண்டு", "Mood=Des"),
    "முடியும்": ("VERB", "முடி", "Mood=Pot"),
    "முடியாது": ("VERB", "முடி", "Mood=Pot|Polarity=Neg"),
    "முடியாதது": ("VERB", "முடி", "Mood=Pot|Polarity=Neg|Gender=Neut|Number=Sing"),
    "முயன்றால்": ("VERB", "முயல்", "Mood=Cond|Tense=Past"),
    "முயன்று": ("VERB", "முயல்", "VerbForm=Part"),
}

TAMIL_COMMON_NOUNS = {
    "உனக்காக": ("NOUN", "நீ", "Case=Ben|Number=Sing|Person=2"),
    "உனக்கு": ("NOUN", "நீ", "Case=Dat|Number=Sing|Person=2"),
    "உன்னை": ("NOUN", "நீ", "Case=Acc|Number=Sing|Person=2"),
    "உன்னால்": ("NOUN", "நீ", "Case=Ins|Number=Sing|Person=2"),
    "உன்னுடன்": ("NOUN", "நீ", "Case=Com|Number=Sing|Person=2"),
    "உன்னில்": ("NOUN", "நீ", "Case=Loc|Number=Sing|Person=2"),
    "உன்": ("NOUN", "நீ", "Case=Gen|Number=Sing|Person=2"),
    "எனக்காக": ("NOUN", "நான்", "Case=Ben|Number=Sing|Person=1"),
    "எனக்கு": ("NOUN", "நான்", "Case=Dat|Number=Sing|Person=1"),
    "என்னை": ("NOUN", "நான்", "Case=Acc|Number=Sing|Person=1"),
    "என்னால்": ("NOUN", "நான்", "Case=Ins|Number=Sing|Person=1"),
    "உங்களுக்காக": ("NOUN", "நீங்கள்", "Case=Ben|Number=Plur|Person=2"),
    "உங்களுக்கு": ("NOUN", "நீங்கள்", "Case=Dat|Number=Plur|Person=2"),
    "ஆரோக்கியம்": ("NOUN", "ஆரோக்கியம்", "Case=Nom|Number=Sing"),
    "ஆரோக்கியத்தை": ("NOUN", "ஆரோக்கியம்", "Case=Acc|Number=Sing"),
    "ஆரோக்கியத்திற்கு": ("NOUN", "ஆரோக்கியம்", "Case=Dat|Number=Sing"),
    "ஆரோக்கியத்தில்": ("NOUN", "ஆரோக்கியம்", "Case=Loc|Number=Sing"),
    "ஆரோக்கியத்துடன்": ("NOUN", "ஆரோக்கியம்", "Case=Com|Number=Sing"),
    "ஆரோக்கியத்தின்": ("NOUN", "ஆரோக்கியம்", "Case=Gen|Number=Sing"),
    "கவனம்": ("NOUN", "கவனம்", "Case=Nom|Number=Sing"),
    "கவனமாக": ("ADV", "கவனம்", ""),
    "கவனமா": ("ADV", "கவனம்", ""),
    "கவனத்தை": ("NOUN", "கவனம்", "Case=Acc|Number=Sing"),
    "கவனத்துடன்": ("NOUN", "கவனம்", "Case=Com|Number=Sing"),
    "கவனத்தில்": ("NOUN", "கவனம்", "Case=Loc|Number=Sing"),
    "கவனத்திற்கு": ("NOUN", "கவனம்", "Case=Dat|Number=Sing"),
    "கவனத்தின்": ("NOUN", "கவனம்", "Case=Gen|Number=Sing"),
}

TAMIL_LEMMA_OVERRIDES = {
    "மாணவர்கள்": ("NOUN", "NOUN", "மாணவர்", "Case=Nom|Number=Plur"),
    "மாணவர்களை": ("NOUN", "NOUN", "மாணவர்", "Case=Acc|Number=Plur"),
    "மாணவர்களுக்கு": ("NOUN", "NOUN", "மாணவர்", "Case=Dat|Number=Plur"),
    "மாணவர்களின்": ("NOUN", "NOUN", "மாணவர்", "Case=Gen|Number=Plur"),
    "மாணவர்களால்": ("NOUN", "NOUN", "மாணவர்", "Case=Ins|Number=Plur"),
}

TAMIL_LEMMA_CORRECTIONS = {
    "காலத்துல": "காலம்",
    "காலத்தில்": "காலம்",
    "காலத்தை": "காலம்",
    "காலத்திற்கு": "காலம்",
    "நாட்டை": "நாடு",
    "நாட்டில்": "நாடு",
    "நாட்டின்": "நாடு",
    "ஆட்சியில்": "ஆட்சி",
    "ஆட்சியை": "ஆட்சி",
    "ஆட்சிக்கு": "ஆட்சி",
    "அந்தப்": "அந்த",
    "அந்தனை": "அந்த",
    "பயராசுக்கு": "பயராசு",
    "வாழ்ந்துட்டு": "வாழ்",
    "சென்றுள்ளது": "செல்",
    "வந்துள்ளது": "வா",
    "செய்துள்ளது": "செய்",
    "சவலித்தபடத்தில்": "சவலித்தபடம்",
    "சவலித்தபடத்தில": "சவலித்தபடம்",
    "சதனங்கன்னு": "சதனம்",
    "சதணங்கன்னு": "சதனம்",
    "நடத்தை": "நடை",
    "சொத்துல்": "சொத்து",
    "சொத்துல": "சொத்து",
    "பகத்துல": "பக்கம்",
    "பகத்துள்": "பக்கம்",
    "கற்றுக்": "கல்",
    "கற்று": "கல்",
    "கற்க": "கல்",
    "கற்கும்": "கல்",
    "கற்கை": "கல்",
    "பாடத்தை": "பாடம்",
    "பாடத்த": "பாடம்",
    "பாடத்": "பாடம்",
    "கொடுக்காத": "கொடு",
    "கொடுக": "கொடு",
    "கொடுத்து": "கொடு",
    "மறுத்தால்": "மறு",
    "மறுத்தா": "மறு",
    "மறுத்த": "மறு",
    "ஆசிரியர்கள்": "ஆசிரியர்",
    "ஆசிரியர": "ஆசிரியர்",
    "கற்றுக்கொடுக்கும்": "கற்றுக் கொடு",
    "கற்றுக்கொடு": "கற்றுக் கொடு",
    "கற்றுக்கொண்ட": "கற்றுக் கொடு",
}


def _strip_common_tamil_suffix(word: str) -> str:
    """Strip common Tamil noun/verb suffixes to recover the root form automatically."""
    clean = (word or "").strip("\u200c\u200d\ufeff")
    if not clean or len(clean) <= 2:
        return clean

    suffix_replacements = [
        ("த்துல்", "ம்"), ("த்துல", "ம்"), ("த்துள்", "ம்"), ("த்தில்", "ம்"),
        ("துல்", ""), ("தில்", "ம்"), ("வில்", "ம்"), ("லில்", "ம்"),
        ("ளில்", ""), ("ரில்", ""), ("யில்", ""), ("ஆல்", ""),
        ("களுக்காக", ""), ("களுக்கு", ""), ("களின்", ""), ("களை", ""),
        ("களால்", ""), ("களுடன்", ""), ("களில்", ""), ("களே", ""),
        ("க்கு", ""), ("அக்கு", ""), ("இல்", ""), ("ல்", ""),
        ("டை", ""), ("தை", ""), ("யை", ""), ("னை", ""), ("இன்", ""),
        ("ன்", ""), ("கள்", ""), ("ன்றால்", "ல்"), ("ந்தால்", ""),
        ("த்தால்", ""), ("னால்", ""), ("வார்", ""), ("த்தார்", ""),
        ("ந்தார்", ""), ("னார்", ""), ("த்தது", ""), ("ன்றது", ""),
        ("ந்தது", ""), ("னது", ""), ("வார்கள்", ""), ("கிறார்கள்", ""),
        ("கின்றார்கள்", ""), ("கிறது", ""), ("கின்றது", ""), ("ாதது", ""),
        ("ஆகிறது", ""), ("மாகிறது", ""), ("யாக", "")
    ]

    for suffix, replacement in suffix_replacements:
        if clean.endswith(suffix):
            base = clean[:-len(suffix)]
            if len(base) <= 1:
                continue
            candidate = base + replacement if replacement else base
            if len(candidate) >= 2:
                return candidate

    return clean


def _lookup_known_tamil_lemma(candidate: str) -> Optional[str]:
    """Resolve a Tamil form against the project’s known lemma dictionaries."""
    if not candidate:
        return None

    normalized = candidate.strip("\u200c\u200d\ufeff")
    if not normalized:
        return None

    if normalized in TAMIL_LEMMA_CORRECTIONS:
        return TAMIL_LEMMA_CORRECTIONS[normalized]

    if normalized in TAMIL_COMMON_VERBS:
        return TAMIL_COMMON_VERBS[normalized][1]

    if normalized in TAMIL_COMMON_NOUNS:
        return TAMIL_COMMON_NOUNS[normalized][1]

    if normalized in TAMIL_LEMMA_OVERRIDES:
        return TAMIL_LEMMA_OVERRIDES[normalized][2]

    if normalized in TAMIL_VERB_ROOTS:
        return TAMIL_VERB_ROOTS[normalized]

    if normalized.endswith("க்கு") and normalized[:-2] in TAMIL_LEMMA_CORRECTIONS:
        return TAMIL_LEMMA_CORRECTIONS[normalized[:-2]]

    stripped = _strip_common_tamil_suffix(normalized)
    if stripped != normalized and stripped not in ("", normalized):
        return stripped

    return None


def correct_tamil_lemma(word: str, stanza_lemma: str) -> str:
    """Return the best Tamil lemma using Stanza output first, then morphological/dictionary resolution."""
    normalized = (word or "").strip("\u200c\u200d\ufeff")
    stanza_value = (stanza_lemma or "").strip("\u200c\u200d\ufeff")

    if not normalized:
        return stanza_value or ""

    ordered_candidates = []
    for candidate in [stanza_value, normalized]:
        if candidate and candidate not in ordered_candidates:
            ordered_candidates.append(candidate)

    for candidate in ordered_candidates:
        if candidate in TAMIL_LEMMA_CORRECTIONS:
            return TAMIL_LEMMA_CORRECTIONS[candidate]

        known = _lookup_known_tamil_lemma(candidate)
        if known:
            return known

    stripped = _strip_common_tamil_suffix(normalized)
    if stripped != normalized and stripped not in ("", normalized):
        return stripped

    return stanza_value or normalized


def _analyze_tamil_word(word: str) -> Tuple[str, str, str, str]:
    """
    Returns (pos, tag, lemma, morph_features) for a Tamil word.
    """
    # Tamil text may contain invisible joiners after a token.
    word = word.strip("\u200c\u200d\ufeff")

    if word in TAMIL_LEMMA_OVERRIDES:
        return TAMIL_LEMMA_OVERRIDES[word]

    if word in TAMIL_LEMMA_CORRECTIONS:
        return ("NOUN", "NOUN", TAMIL_LEMMA_CORRECTIONS[word], "Case=Nom|Number=Sing")

    # 1. Punctuation
    if all(c in '.,!?;:|।॥\'"()[]{}<>-–—/\\@#$%&*+=_~^`' for c in word):
        return ("PUNCT", "PUNCT", word, "")
    
    # 2. Number
    if word.isdigit() or re.match(r'^\d+[\d,.]*$', word):
        return ("NUM", "NUM", word, "NumType=Card")

    # 3. Exact Pronoun lookup
    if word in TAMIL_PRONOUNS:
        pos, lemma, morph = TAMIL_PRONOUNS[word]
        return (pos, pos, lemma, morph)

    # 4. Exact Conjunction lookup
    if word in TAMIL_CONJUNCTIONS:
        return ("CONJ", "CCONJ", word, "")

    # 5. Exact Postposition lookup
    if word in TAMIL_POSTPOSITIONS:
        return ("ADP", "POSTP", word, "")

    # 6. Exact determiner and adjective lookup
    if word in TAMIL_DETERMINERS:
        return ("DET", "DET", word, "PronType=Art")

    if word in TAMIL_ADJECTIVES:
        return ("ADJ", "ADJ", word, "")

    # 7. Exact Common Noun lookup
    if word in TAMIL_COMMON_NOUNS:
        pos, lemma, morph = TAMIL_COMMON_NOUNS[word]
        return (pos, pos, lemma, morph)

    # 8. Exact Common Verb lookup
    if word in TAMIL_COMMON_VERBS:
        pos, lemma, morph = TAMIL_COMMON_VERBS[word]
        return (pos, pos, lemma, morph)

    # 7. Verb Suffix Analysis
    verb_suffixes = [
        ("கொண்டிருக்கிறார்கள்", "Tense=Pres|Aspect=Prog|Number=Plur|Person=3"),
        ("கொண்டிருக்கிறார்", "Tense=Pres|Aspect=Prog|Number=Sing|Person=3|Polite=Yes"),
        ("கொண்டிருந்தது", "Tense=Past|Aspect=Prog|Gender=Neut|Number=Sing"),
        ("கொண்டிருந்தனர்", "Tense=Past|Aspect=Prog|Number=Plur|Person=3"),
        ("கின்றார்கள்", "Tense=Pres|Number=Plur|Person=3"),
        ("கிறார்கள்", "Tense=Pres|Number=Plur|Person=3"),
        ("க்கிறார்கள்", "Tense=Pres|Number=Plur|Person=3"),
        ("கின்றார்", "Tense=Pres|Number=Sing|Person=3|Polite=Yes"),
        ("கிறார்", "Tense=Pres|Number=Sing|Person=3|Polite=Yes"),
        ("க்கிறார்", "Tense=Pres|Number=Sing|Person=3|Polite=Yes"),
        ("கின்றது", "Tense=Pres|Gender=Neut|Number=Sing|Person=3"),
        ("கிறது", "Tense=Pres|Gender=Neut|Number=Sing|Person=3"),
        ("க்கிறது", "Tense=Pres|Gender=Neut|Number=Sing|Person=3"),
        ("விட்டார்கள்", "Tense=Past|Aspect=Perf|Number=Plur|Person=3"),
        ("விட்டனர்", "Tense=Past|Aspect=Perf|Number=Plur|Person=3"),
        ("விட்டார்", "Tense=Past|Aspect=Perf|Number=Sing|Person=3|Polite=Yes"),
        ("ட்டார்கள்", "Tense=Past|Number=Plur|Person=3"),
        ("ந்தார்கள்", "Tense=Past|Number=Plur|Person=3"),
        ("னார்கள்", "Tense=Past|Number=Plur|Person=3"),
        ("வார்கள்", "Tense=Fut|Number=Plur|Person=3"),
        ("ப்பார்கள்", "Tense=Fut|Number=Plur|Person=3"),
        ("த்தார்", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
        ("ந்தார்", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
        ("னார்", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
        ("வார்", "Tense=Fut|Number=Sing|Person=3|Polite=Yes"),
        ("ப்பார்", "Tense=Fut|Number=Sing|Person=3|Polite=Yes"),
        ("ந்தது", "Tense=Past|Gender=Neut|Number=Sing"),
        ("ட்டது", "Tense=Past|Gender=Neut|Number=Sing"),
        ("னது", "Tense=Past|Gender=Neut|Number=Sing"),
        ("வில்லை", "Polarity=Neg"),
        ("க்கப்பட", "Voice=Pass|VerbForm=Inf"),
        ("ப்பட்டது", "Voice=Pass|Tense=Past|Gender=Neut|Number=Sing"),
        ("பட்டது", "Voice=Pass|Tense=Past|Gender=Neut|Number=Sing"),
        ("க்காதீர்கள்", "Mood=Imp|Polarity=Neg|Number=Plur|Person=2|Polite=Yes"),
        ("ாதீர்கள்", "Mood=Imp|Polarity=Neg|Number=Plur|Person=2|Polite=Yes"),
        ("க்காதீர்", "Mood=Imp|Polarity=Neg|Number=Sing|Person=2|Polite=Yes"),
        ("ாதீர்", "Mood=Imp|Polarity=Neg|Number=Sing|Person=2|Polite=Yes"),
        ("க்காதே", "Mood=Imp|Polarity=Neg|Number=Sing|Person=2"),
        ("ாதே", "Mood=Imp|Polarity=Neg|Number=Sing|Person=2"),
        ("க்காமல்", "VerbForm=Part|Polarity=Neg"),
        ("ாமல்", "VerbForm=Part|Polarity=Neg"),
        ("ப்படுத்தும்", "Tense=Fut|VerbForm=Part"),
        ("ப்படுத்துகிறது", "Tense=Pres|Gender=Neut|Number=Sing|Person=3"),
        ("ப்படுத்துகிறார்", "Tense=Pres|Number=Sing|Person=3|Polite=Yes"),
        ("ப்படுத்துகிறார்கள்", "Tense=Pres|Number=Plur|Person=3"),
        ("ப்படுத்தியது", "Tense=Past|Gender=Neut|Number=Sing"),
        ("ப்படுத்தினார்", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
        ("ப்படுத்தினர்", "Tense=Past|Number=Plur|Person=3"),
        ("ப்படுத்தி", "VerbForm=Part|Aspect=Perf"),
        ("ப்படுத்த", "VerbForm=Inf"),
        ("ப்படுத்து", "Mood=Imp|Number=Sing|Person=2"),
        ("ப்படுத்துங்கள்", "Mood=Imp|Number=Plur|Person=2|Polite=Yes"),
        ("மாகும்", "Tense=Fut|VerbForm=Part"),
        ("ஆகும்", "Tense=Fut|VerbForm=Part"),
        ("மாகிறது", "Tense=Pres|Gender=Neut|Number=Sing|Person=3"),
        ("ஆகிறது", "Tense=Pres|Gender=Neut|Number=Sing|Person=3"),
        ("மாகி", "VerbForm=Part|Aspect=Perf"),
        ("ஆகி", "VerbForm=Part|Aspect=Perf"),
        ("ுங்கள்", "Mood=Imp|Number=Plur|Person=2|Polite=Yes"),
        ("ுங்", "Mood=Imp|Number=Plur|Person=2"),
        ("க்கக்கூடாது", "Mood=Proh|Polarity=Neg"),
        ("க்கூடாது", "Mood=Proh|Polarity=Neg"),
        ("க்கலாம்", "Mood=Pot"),
        ("லாம்", "Mood=Pot"),
        ("க்க", "VerbForm=Inf"),
        ("க", "VerbForm=Inf"),
    ]

    for suffix, morph in verb_suffixes:
        if word.endswith(suffix) and len(word) > len(suffix) + 1:
            base = word[:-len(suffix)]
            if base in TAMIL_VERB_ROOTS:
                base = TAMIL_VERB_ROOTS[base]
            elif (base + "ு") in TAMIL_VERB_ROOTS:
                base = TAMIL_VERB_ROOTS[base + "ு"]
            return ("VERB", "VERB", base, morph)

    # 8. Adjective Suffixes
    adj_suffixes = ["ஆன", "வான", "மான", "யான", "கான", "இல்லாத", "உள்ள", "நல்ல"]
    for s in adj_suffixes:
        if word.endswith(s) and len(word) > len(s):
            base = word[:-len(s)]
            if s == "மான" and (base + "ம்") in TAMIL_COMMON_NOUNS:
                base = base + "ம்"
            return ("ADJ", "ADJ", base if len(base) >= 2 else word, "")

    # 9. Adverb Suffixes
    adv_suffixes = ["யாக", "வாக", "றாக", "ஆக", "மாக", "காக", "தாக", "ாகக்", "உடன்"]
    for s in adv_suffixes:
        if word.endswith(s) and len(word) > len(s):
            base = word[:-len(s)]
            if s == "மாக" and (base + "ம்") in TAMIL_COMMON_NOUNS:
                base = base + "ம்"
            return ("ADV", "ADV", base if len(base) >= 2 else word, "")

    # 10. Noun Suffixes / Case Endings
    noun_cases = [
        # Tamil nouns ending in ம் change to த்த் before case suffixes.
        ("த்திலிருந்து", "Case=Abl|Number=Sing", "ம்"),
        ("த்துடன்", "Case=Com|Number=Sing", "ம்"),
        ("த்தினால்", "Case=Ins|Number=Sing", "ம்"),
        ("த்தால்", "Case=Ins|Number=Sing", "ம்"),
        ("த்திற்கு", "Case=Dat|Number=Sing", "ம்"),
        ("த்தில்", "Case=Loc|Number=Sing", "ம்"),
        ("த்தின்", "Case=Gen|Number=Sing", "ம்"),
        ("களிலிருந்து", "Case=Abl|Number=Plur"),
        ("களுக்கு", "Case=Dat|Number=Plur"),
        ("களுடன்", "Case=Com|Number=Plur"),
        ("களில்", "Case=Loc|Number=Plur"),
        ("களை", "Case=Acc|Number=Plur"),
        ("களும்", "Case=Nom|Number=Plur|Definiteness=Def"),
        ("கள்", "Case=Nom|Number=Plur"),
        ("இலிருந்து", "Case=Abl|Number=Sing"),
        ("உக்கு", "Case=Dat|Number=Sing"),
        ("க்கு", "Case=Dat|Number=Sing"),
        ("உடன்", "Case=Com|Number=Sing"),
        ("இல்", "Case=Loc|Number=Sing"),
        ("இன்", "Case=Gen|Number=Sing"),
        ("ஆல்", "Case=Ins|Number=Sing"),
        ("ஐ", "Case=Acc|Number=Sing"),
    ]
    for case in noun_cases:
        s, morph = case[:2]
        if word.endswith(s) and len(word) > len(s) + 1:
            lemma = word[:-len(s)]
            if len(case) == 3:
                lemma += case[2]
            return ("NOUN", "NOUN", lemma, morph)

    stripped = _strip_common_tamil_suffix(word)
    if stripped != word and stripped:
        return ("NOUN", "NOUN", stripped, "Case=Nom|Number=Sing")

    # Default Noun
    return ("NOUN", "NOUN", word, "Case=Nom|Number=Sing")


def _analyze_tamil_sentence(sentence: str) -> Optional[List[Dict[str, str]]]:
    """Return Stanza Tamil POS results, or None when its local model is unavailable."""
    tamil_nlp = _get_tamil_nlp()
    if tamil_nlp is None:
        return None

    try:
        normalized_sentence = sentence.translate(str.maketrans("", "", "\u200c\u200d\ufeff"))
        doc = tamil_nlp(normalized_sentence)
        results = []
        for stanza_sentence in doc.sentences:
            for word in stanza_sentence.words:
                lemma = correct_tamil_lemma(word.text, word.lemma or word.text)
                results.append({
                    "token": word.text,
                    "pos": word.upos or "X",
                    "lemma": lemma,
                    "morph": word.feats or "",
                    "tag": word.xpos or word.upos or "X",
                })
        return results
    except Exception:
        return None


# ==============================================================================
# 5. SINHALA NLP ENGINE (Tokenization, POS, Lemmatization, Morphology)
# ==============================================================================

SINHALA_PRONOUNS = {
    "මම": ("PRON", "මම", "Case=Nom|Number=Sing|Person=1"),
    "අපි": ("PRON", "අපි", "Case=Nom|Number=Plur|Person=1"),
    "ඔයා": ("PRON", "ඔයා", "Case=Nom|Number=Sing|Person=2"),
    "ඔබ": ("PRON", "ඔබ", "Case=Nom|Number=Sing|Person=2|Polite=Yes"),
    "ඔබලා": ("PRON", "ඔබ", "Case=Nom|Number=Plur|Person=2"),
    "ඔහු": ("PRON", "ඔහු", "Case=Nom|Gender=Masc|Number=Sing|Person=3"),
    "ඇය": ("PRON", "ඇය", "Case=Nom|Gender=Fem|Number=Sing|Person=3"),
    "එයා": ("PRON", "එයා", "Case=Nom|Number=Sing|Person=3"),
    "එය": ("PRON", "එය", "Case=Nom|Gender=Neut|Number=Sing|Person=3"),
    "ඔවුන්": ("PRON", "ඔවුන්", "Case=Nom|Number=Plur|Person=3"),
    "මේ": ("PRON", "මේ", "PronType=Dem"),
    "මෙය": ("PRON", "මෙය", "PronType=Dem|Number=Sing"),
    "මේවා": ("PRON", "මේවා", "PronType=Dem|Number=Plur"),
    "ඒ": ("PRON", "ඒ", "PronType=Dem"),
    "අර": ("PRON", "අර", "PronType=Dem"),
    "කවුද": ("PRON", "කවුද", "PronType=Int"),
    "මොකක්ද": ("PRON", "මොකක්ද", "PronType=Int"),
    "කුමක්ද": ("PRON", "කුමක්ද", "PronType=Int"),
}

SINHALA_CONJUNCTIONS = {
    "සහ", "හා", "නමුත්", "එහෙත්", "නැතහොත්", "හෝ", "එබැවින්",
    "එමනිසා", "නිසා", "නම්", "විට", "පසු", "මෙන්", "සේ",
}

SINHALA_POSTPOSITIONS = {
    "ගැන", "පිළිබඳ", "සඳහා", "වෙනුවෙන්", "මත", "තුළ", "යට",
    "අතර", "ළඟ", "සමඟ", "සහිත", "කෙරෙහි", "වෙත", "දක්වා",
}

SINHALA_ADJECTIVES = {
    "හොඳ", "නරක", "ලස්සන", "අලුත්", "පරණ", "ලොකු", "කුඩා", "මහත්",
    "ප්‍රධාන", "විශේෂ", "වැදගත්", "ජාතික", "ජාත්‍යන්තර", "රාජ්‍ය", "පෞද්ගලික",
    "නව", "උසස්", "දුප්පත්", "පොහොසත්", "ශක්තිමත්",
}

SINHALA_ADVERBS = {
    "ඉක්මනින්", "හොඳින්", "සෙමින්", "නිතරම", "කවදාවත්", "පමණක්",
    "නැවත", "දැන්", "පසුව", "එතැන", "මෙතැන", "ඉතා", "බොහෝ", "වඩාත්",
}

SINHALA_LEMMA_OVERRIDES = {
    "විශ්වවිද්‍යාලයේ": ("NOUN", "විශ්වවිද්‍යාලය", "Case=Loc|Number=Sing"),
    "හොඳින්": ("ADV", "හොඳ", ""),
    "ලබා": ("VERB", "ලබ", "VerbForm=Part|Aspect=Perf"),
    "කළහ": ("VERB", "කර", "Tense=Past|Number=Plur|Person=3"),
    "කළා": ("VERB", "කර", "Tense=Past|Aspect=Perf"),
    "කරනවා": ("VERB", "කර", "Tense=Pres|Mood=Ind"),
    "කරන": ("VERB", "කර", "VerbForm=Part|Tense=Pres"),
    "කරලා": ("VERB", "කර", "VerbForm=Part|Aspect=Perf"),
    "කරපු": ("VERB", "කර", "VerbForm=Part|Tense=Past"),
    "කරමින්": ("VERB", "කර", "VerbForm=Part|Aspect=Prog"),
    "වූයේය": ("VERB", "වෙ", "Tense=Past|Person=3"),
    "විය": ("VERB", "වෙ", "Tense=Past|Person=3"),
    "වෙයි": ("VERB", "වෙ", "Tense=Pres|Mood=Ind"),
    "ලැබේ": ("VERB", "ලබ", "Tense=Pres|Voice=Pass"),
    "ලැබූ": ("VERB", "ලබ", "Tense=Past|Voice=Pass"),
}
SINHALA_LEMMA_OVERRIDES_NORMALIZED = {
    key.translate(str.maketrans("", "", "\u200c\u200d\ufeff")): value
    for key, value in SINHALA_LEMMA_OVERRIDES.items()
}


def _analyze_sinhala_word(word: str) -> Tuple[str, str, str, str]:
    """
    Returns (pos, tag, lemma, morph_features) for a Sinhala word.
    """
    lookup_word = word.translate(str.maketrans("", "", "\u200c\u200d\ufeff"))
    if lookup_word in SINHALA_LEMMA_OVERRIDES_NORMALIZED:
        pos, lemma, morph = SINHALA_LEMMA_OVERRIDES_NORMALIZED[lookup_word]
        return (pos, pos, lemma, morph)

    # 1. Punctuation
    if all(c in '.,!?;:|।॥\'"()[]{}<>-–—/\\@#$%&*+=_~^`' for c in word):
        return ("PUNCT", "PUNCT", word, "")
    
    # 2. Number
    if word.isdigit() or re.match(r'^\d+[\d,.]*$', word):
        return ("NUM", "NUM", word, "NumType=Card")

    # 3. Exact Pronoun lookup
    if word in SINHALA_PRONOUNS:
        pos, lemma, morph = SINHALA_PRONOUNS[word]
        return (pos, pos, lemma, morph)

    # 4. Exact Conjunction lookup
    if word in SINHALA_CONJUNCTIONS:
        return ("CONJ", "CCONJ", word, "")

    # 5. Exact Postposition lookup
    if word in SINHALA_POSTPOSITIONS:
        return ("ADP", "POSTP", word, "")

    # 6. Exact Adjective lookup
    if word in SINHALA_ADJECTIVES:
        return ("ADJ", "ADJ", word, "")

    # 7. Exact Adverb lookup
    if word in SINHALA_ADVERBS:
        return ("ADV", "ADV", word, "")

    # 8. Verb Suffix Analysis
    verb_suffixes = [
        ("ගත්තෙමු", "Tense=Past|Number=Plur|Person=1"),
        ("ගත්තෙමි", "Tense=Past|Number=Sing|Person=1"),
        ("ගත්තා", "Tense=Past|Aspect=Perf"),
        ("න්නෙමු", "Tense=Fut|Number=Plur|Person=1"),
        ("න්නෙමි", "Tense=Fut|Number=Sing|Person=1"),
        ("නවාය", "Tense=Pres|Mood=Ind"),
        ("නවා", "Tense=Pres|Mood=Ind"),
        ("නෙවා", "Tense=Pres|Mood=Ind"),
        ("කළා", "Tense=Past|Mood=Ind"),
        ("කරනවා", "Tense=Pres|Mood=Ind"),
        ("කරන", "VerbForm=Part|Tense=Pres"),
        ("කරලා", "VerbForm=Part|Aspect=Perf"),
        ("කරපු", "VerbForm=Part|Tense=Past"),
        ("කරමින්", "VerbForm=Part|Aspect=Prog"),
        ("ලැබේ", "Tense=Pres|Voice=Pass"),
        ("ලැබූ", "Tense=Past|Voice=Pass"),
        ("වෙයි", "Tense=Pres|Mood=Ind"),
        ("වෙන්න", "VerbForm=Inf"),
        ("වූයේය", "Tense=Past|Person=3"),
        ("විය", "Tense=Past|Person=3"),
        ("යයි", "Tense=Pres|Person=3"),
        ("යති", "Tense=Pres|Number=Plur|Person=3"),
        ("න්නට", "VerbForm=Inf"),
        ("න්න", "VerbForm=Inf"),
        ("ති", "Tense=Pres|Number=Plur|Person=3"),
        ("තී", "Tense=Pres|Gender=Fem|Number=Sing|Person=3"),
    ]

    for s, morph in verb_suffixes:
        if word.endswith(s) and len(word) > len(s) + 1:
            lemma = word[:-len(s)]
            return ("VERB", "VERB", lemma, morph)

    # 9. Adjective Suffixes
    adj_suffixes = ["සහගත", "ශීලී", "පූර්ණ", "මය", "කාරී", "මයවූ"]
    for s in adj_suffixes:
        if word.endswith(s) and len(word) > len(s):
            return ("ADJ", "ADJ", word[:-len(s)], "")

    # 10. Adverb Suffixes
    adv_suffixes = ["ආකාරයෙන්", "ලෙස", "පරිද්දෙන්", "අයුරින්"]
    for s in adv_suffixes:
        if word.endswith(s) and len(word) > len(s):
            return ("ADV", "ADV", word[:-len(s)], "")

    # 11. Noun Cases & Plurals
    noun_cases = [
        ("වල්වලින්", "Case=Abl|Number=Plur"),
        ("වල්වලට", "Case=Dat|Number=Plur"),
        ("වල්වල", "Case=Gen|Number=Plur"),
        ("වල්", "Number=Plur"),
        ("යන්ට", "Case=Dat|Number=Plur"),
        ("යන්ගේ", "Case=Gen|Number=Plur"),
        ("යන්", "Number=Plur"),
        ("ගෙන්", "Case=Abl|Number=Sing"),
        ("ගේ", "Case=Gen|Number=Sing"),
        ("ට", "Case=Dat|Number=Sing"),
        ("ගැන", "Case=Loc|Number=Sing"),
        ("ක්", "Definiteness=Indef|Number=Sing"),
        ("ක", "Definiteness=Indef|Case=Gen"),
        ("කු", "Definiteness=Indef|Gender=Masc"),
    ]
    for s, morph in noun_cases:
        if word.endswith(s) and len(word) > len(s) + 1:
            lemma = word[:-len(s)]
            return ("NOUN", "NOUN", lemma, morph)

    # Default Noun
    return ("NOUN", "NOUN", word, "Case=Nom|Number=Sing")


# ==============================================================================
# 6. MULTILINGUAL TOKENIZER & SENTENCE PROCESSOR
# ==============================================================================

def tokenize_and_tag(text: str) -> Dict[str, Any]:
    """
    Language-aware multilingual tokenization, POS tagging, and morphology.
    Processes mixed-language documents sentence-by-sentence.
    """
    sentences = segment_sentences(text)
    token_details = []
    token_texts = []
    lemmas = []
    pos_counter = Counter()
    word_freq = Counter()

    en_nlp = _get_english_nlp()

    for sent_id, sent in enumerate(sentences, 1):
        sent_lang = detect_sentence_language(sent)

        if sent_lang == "English" and en_nlp is not None:
            doc = en_nlp(sent)
            for token in doc:
                pos = token.pos_ or "X"
                text_clean = token.text.strip()
                if not text_clean:
                    continue

                if token.is_punct or token.is_space:
                    continue

                token_texts.append(text_clean)
                word_freq[text_clean.lower()] += 1

                pos_counter[pos] += 1
                lemmas.append(token.lemma_ or text_clean)
                token_details.append({
                    "token": text_clean,
                    "text": text_clean,
                    "normalized": text_clean.lower(),
                    "lemma": token.lemma_ or text_clean,
                    "pos": pos,
                    "tag": token.tag_ or pos,
                    "morph": str(token.morph) if token.morph else "",
                    "language": "en",
                    "sentence_id": sent_id,
                    "is_stop": bool(token.is_stop),
                })

        elif sent_lang == "Tamil":
            stanza_tokens = _analyze_tamil_sentence(sent)
            if stanza_tokens is None:
                # Extract Tamil words, numbers, English tokens, punctuation.
                stanza_tokens = []
                raw_tokens = re.findall(r'[\u0B80-\u0BFF\u200C\u200D]+|[a-zA-Z0-9]+|[^\w\s]', sent)
                for raw_tok in raw_tokens:
                    tok = raw_tok.strip()
                    if not tok:
                        continue
                    pos, tag, lemma, morph = _analyze_tamil_word(tok)
                    stanza_tokens.append({
                        "token": tok, "pos": pos, "tag": tag,
                        "lemma": lemma, "morph": morph,
                    })

            for stanza_token in stanza_tokens:
                tok = stanza_token["token"].strip()
                tok = tok.strip("\u200c\u200d\ufeff")
                if not tok:
                    continue

                if _is_punctuation_token(tok):
                    continue

                pos = stanza_token["pos"]
                tag = stanza_token["tag"]
                lemma = correct_tamil_lemma(stanza_token.get("token", tok), stanza_token["lemma"])
                morph = stanza_token["morph"]
                if (
                    tok in TAMIL_PRONOUNS
                    or tok in TAMIL_CONJUNCTIONS
                    or tok in TAMIL_POSTPOSITIONS
                    or tok in TAMIL_DETERMINERS
                    or tok in TAMIL_ADJECTIVES
                    or tok in TAMIL_COMMON_NOUNS
                    or tok in TAMIL_COMMON_VERBS
                    or tok in TAMIL_LEMMA_OVERRIDES
                ):
                    pos, tag, lemma, morph = _analyze_tamil_word(tok)
                if pos == "AUX":
                    pos = "VERB"
                    tag = "VERB"
                if pos == "PUNCT":
                    continue

                token_texts.append(tok)
                word_freq[tok] += 1

                pos_counter[pos] += 1
                lemmas.append(lemma)
                token_details.append({
                    "token": tok,
                    "text": tok,
                    "normalized": tok,
                    "lemma": lemma,
                    "pos": pos,
                    "tag": tag,
                    "morph": morph,
                    "language": "ta",
                    "sentence_id": sent_id,
                    "is_stop": False,
                })

        elif sent_lang == "Sinhala":
            # Extract Sinhala words (including ZWJ \u200D), numbers, English tokens, punctuation
            raw_tokens = re.findall(r'[\u0D80-\u0DFF\u200C\u200D]+|[a-zA-Z0-9]+|[^\w\s]', sent)
            for raw_tok in raw_tokens:
                tok = raw_tok.strip()
                if not tok:
                    continue

                pos, tag, lemma, morph = _analyze_sinhala_word(tok)
                if _is_punctuation_token(tok) or pos == "PUNCT":
                    continue

                token_texts.append(tok)
                word_freq[tok] += 1

                pos_counter[pos] += 1
                lemmas.append(lemma)
                token_details.append({
                    "token": tok,
                    "text": tok,
                    "normalized": tok,
                    "lemma": lemma,
                    "pos": pos,
                    "tag": tag,
                    "morph": morph,
                    "language": "si",
                    "sentence_id": sent_id,
                    "is_stop": False,
                })

        else: # Fallback English / Latin regex
            raw_tokens = _tokenize_english_regex(sent)
            for raw_tok in raw_tokens:
                tok = raw_tok.strip()
                if not tok:
                    continue
                is_punct = _is_punctuation_token(tok)
                pos = "PUNCT" if is_punct else ("NUM" if tok.isdigit() else "NOUN")
                if is_punct:
                    continue

                token_texts.append(tok)
                word_freq[tok.lower()] += 1

                pos_counter[pos] += 1
                lemmas.append(tok)
                token_details.append({
                    "token": tok,
                    "text": tok,
                    "normalized": tok.lower(),
                    "lemma": tok,
                    "pos": pos,
                    "tag": pos,
                    "morph": "",
                    "language": "en",
                    "sentence_id": sent_id,
                    "is_stop": False,
                })

    unique_tokens = len({t.lower() for t in token_texts})
    top_words = [[w, count] for w, count in word_freq.most_common(50)]
    top_keywords = [w for w, _ in top_words[:5]]

    return {
        "tokens": token_texts,
        "token_count": len(token_texts),
        "unique_tokens": unique_tokens,
        "lemmas": lemmas,
        "token_details": token_details[:5000],
        "pos_distribution": dict(pos_counter),
        "top_words": top_words,
        "top_keywords": top_keywords,
        "sentences": sentences,
        "sentence_count": len(sentences),
    }


# ==============================================================================
# 7. MULTILINGUAL NAMED ENTITY RECOGNITION (NER)
# ==============================================================================

# Gazetteers for Sri Lanka and International Entities
SRI_LANKAN_LOCATIONS = {
    # English
    "colombo", "sri lanka", "jaffna", "kandy", "galle", "batticaloa", "trincomalee",
    "negombo", "anuradhapura", "polonnaruwa", "matara", "badulla", "ratnapura",
    "nuwara eliya", "kurunegala", "kalutara", "gampaha", "puttalam", "vavuniya",
    "mannar", "kilinochchi", "mullaitivu", "ampara", "hambantota", "monaragala",
    "kegalle", "matale", "moratuwa", "dehiwala", "kotte", "katunayake", "sigiriya",
    # Tamil
    "கொழும்பு", "இலங்கை", "யாழ்ப்பாணம்", "கண்டி", "காலி", "மட்டக்களப்பு", "திருகோணமலை",
    "நீர்கொழும்பு", "அனுராதபுரம்", "பொலன்னறுவை", "மாத்தறை", "பதுளை", "இரத்தினபுரி",
    "நுவரெலியா", "குருநாகல்", "களுத்துறை", "கம்பஹா", "புத்தளம்", "வவுனியா",
    "மன்னார்", "கிளிநொச்சி", "முல்லைத்தீவு", "அம்பாறை", "அம்பாந்தோட்டை", "மொனராகலை",
    "கேகாலை", "மாத்தளை", "மொறட்டுவ", "தெகிவளை", "கோட்டே", "சீகிரியா",
    # Sinhala
    "කොළඹ", "ශ්‍රී ලංකාව", "ශ්‍රී ලංකා", "යාපනය", "මහනුවර", "ගාල්ල", "මඩකලපුව", "ත්‍රිකුණාමලය",
    "මීගමුව", "අනුරාධපුරය", "පොළොන්නරුව", "මාතර", "බදුල්ල", "රත්නපුරය",
    "නුවරඑළිය", "කුරුණෑගල", "කළුතර", "ගම්පහ", "පුත්තලම", "වවුනියාව",
    "මන්නාරම", "කිලිනොච්චිය", "මුලතිව්", "අම්පාර", "හම්බන්තොට", "මොණරාගල",
    "කෑගල්ල", "මාතලේ", "මොරටුව", "දෙහිවල", "කෝට්ටේ", "කටුනායක", "සීගිරිය",
}

GLOBAL_LOCATIONS = {
    "india", "united states", "usa", "uk", "china", "japan", "australia", "canada",
    "london", "new york", "delhi", "chennai", "tamil nadu", "singapore", "malaysia",
    "இந்தியா", "அமெரிக்கா", "சீனா", "ஜப்பான்", "லண்டன்", "சென்னை", "தமிழ்நாடு",
    "ඉන්දියාව", "ඇමරිකාව", "චීනය", "ජපානය", "ලන්ඩන්", "චෙන්නායි", "සිංගප්පූරුව",
}

ORGANIZATION_KEYWORDS = {
    # English
    "university", "ministry", "department", "bank", "parliament", "hospital", "institute",
    "corporation", "authority", "commission", "board", "plc", "ltd", "un", "who", "unesco",
    # Tamil
    "பல்கலைக்கழகம்", "அமைச்சு", "திணைக்களம்", "வங்கி", "பாராளுமன்றம்", "வைத்தியசாலை",
    "நிறுவனம்", "ஆணைக்குழு", "சபை", "கூட்டுத்தாபனம்",
    # Sinhala
    "විශ්වවිද්‍යාලය", "අමාත්‍යාංශය", "දෙපාර්තමේන්තුව", "බැංකුව", "පාර්ලිමේන්තුව",
    "රෝහල", "ආයතනය", "කොමිසම", "මණ්ඩලය", "සංස්ථාව", "සභාව",
}

PERSON_HONORIFICS = {
    # English
    "mr.", "mr", "mrs.", "mrs", "ms.", "ms", "dr.", "dr", "prof.", "prof", "rev.", "rev", "hon.", "hon", "president", "prime minister",
    # Tamil
    "திரு", "திருமதி", "செல்வி", "மருத்துவர்", "பேராசிரியர்", "அதிபர்", "ஜனாதிபதி", "பிரதமர்",
    # Sinhala
    "මහතා", "මිය", "මෙනවිය", "ආචාර්ය", "මහාචාර්ය", "පූජ්‍ය", "ජනාධිපති", "අගමැති",
}


def extract_entities(text: str, lang: str = "English") -> List[Dict[str, Any]]:
    """
    Multilingual NER: Extracts PERSON, LOCATION, ORGANIZATION, DATE, TIME, MONEY, and EVENT.
    Uses rule-based gazetteers + patterns for English, Tamil, and Sinhala, supplemented with LLM if available.
    """
    entities = []
    seen = set()

    def _add(text_val: str, label_en: str, label_ta: str, label_si: str, label_default: str):
        key = (text_val.strip().lower(), label_en)
        if key in seen or len(text_val.strip()) < 2:
            return
        seen.add(key)
        
        # Select translated label based on context
        if lang == "Tamil":
            label_disp = label_ta
        elif lang == "Sinhala":
            label_disp = label_si
        else:
            label_disp = label_default

        entities.append({
            "text": text_val.strip(),
            "label_en": label_en,
            "label": label_disp,
            "score": 0.95,
        })

    # 1. Location Recognition
    all_locations = SRI_LANKAN_LOCATIONS | GLOBAL_LOCATIONS
    for loc in all_locations:
        pattern = re.compile(rf'\b{re.escape(loc)}\b', re.IGNORECASE)
        for match in pattern.finditer(text):
            _add(match.group(0), "LOC", "இடம்", "ස්ථාන", "Location")

    # 2. Money Recognition
    # e.g. Rs. 500, Rs. 1,000.50, LKR 50M, $100, €50, ரூ. 500, රු. 1000
    money_pattern = re.compile(r'(?:Rs\.?|LKR|\$|€|£|¥|₹|ரூ\.?|රු\.?)\s*[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|crore|lakh|M|B|K|மில்லியன்|මිලියන))?', re.IGNORECASE)
    for match in money_pattern.finditer(text):
        _add(match.group(0), "MONEY", "பணம்", "මුදල්", "Money")

    # 3. Date & Time Recognition
    # e.g. 2026-08-19, 19/08/2026, August 19, 2026, 10:30 AM
    date_pattern = re.compile(r'\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,\s+\d{4})?|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})\b', re.IGNORECASE)
    for match in date_pattern.finditer(text):
        _add(match.group(0), "DATE", "தேதி", "දිනය", "Date")

    time_pattern = re.compile(r'\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b')
    for match in time_pattern.finditer(text):
        _add(match.group(0), "TIME", "நேரம்", "වේලාව", "Time")

    # 4. Organizations
    # Look for capitalized multi-word phrases with org keywords
    for keyword in ORGANIZATION_KEYWORDS:
        pattern = re.compile(rf'([A-Za-z\u0B80-\u0BFF\u0D80-\u0DFF\s]{{2,30}}\b{re.escape(keyword)}\b[A-Za-z\u0B80-\u0BFF\u0D80-\u0DFF\s]{{0,20}})', re.IGNORECASE)
        for match in pattern.finditer(text):
            chunk = match.group(0).strip()
            # keep reasonable length
            if 3 <= len(chunk.split()) <= 6:
                _add(chunk, "ORG", "நிறுவனம்", "සංවිධාන", "Organization")

    # 5. Persons via Honorific Patterns
    for honorific in PERSON_HONORIFICS:
        # e.g. "Dr. Perera", "திரு. ரமணன்", "මහතා සිරිසේන"
        pattern = re.compile(rf'\b{re.escape(honorific)}\.?\s+([A-Z\u0B80-\u0BFF\u0D80-\u0DFF][a-zA-Z\u0B80-\u0BFF\u0D80-\u0DFF\s]{{2,30}})', re.IGNORECASE)
        for match in pattern.finditer(text):
            full_match = match.group(0).strip()
            name_part = full_match.split()[1:]
            if 1 <= len(name_part) <= 4:
                _add(full_match, "PER", "நபர்", "පුද්ගල", "Person")

    # 6. Try Groq AI NER if configured (complements local gazetteer)
    try:
        from routes.summarize import get_groq_client, MODEL
        client = get_groq_client()
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract named entities from the text. Respond ONLY with JSON:\n"
                        '{"entities": [{"text": "...", "label_en": "PER"|"ORG"|"LOC"|"DATE"|"TIME"|"MONEY"|"EVENT"|"MISC", "score": 1.0}]}'
                    )
                },
                {"role": "user", "content": text[:3000]}
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=512
        )
        import json
        data = json.loads(resp.choices[0].message.content)
        for ent in data.get("entities", []):
            if isinstance(ent, dict) and "text" in ent and "label_en" in ent:
                label_map = {
                    "PER": ("நபர்", "පුද්ගල", "Person"),
                    "LOC": ("இடம்", "ස්ථාන", "Location"),
                    "ORG": ("நிறுவனம்", "සංවිධාන", "Organization"),
                    "DATE": ("தேதி", "දිනය", "Date"),
                    "TIME": ("நேரம்", "වේලාව", "Time"),
                    "MONEY": ("பணம்", "මුදල්", "Money"),
                    "EVENT": ("நிகழ்வு", "සිදුවීම", "Event"),
                    "MISC": ("மற்றவை", "වෙනත්", "Other"),
                }
                ta_l, si_l, en_l = label_map.get(ent["label_en"], ("மற்றவை", "වෙනත්", "Other"))
                _add(ent["text"], ent["label_en"], ta_l, si_l, en_l)
    except Exception:
        pass

    return entities[:100]


# ==============================================================================
# 8. MULTILINGUAL SENTENCE & DOCUMENT SENTIMENT ANALYSIS
# ==============================================================================

POSITIVE_WORDS = {
    # English
    "good", "great", "excellent", "positive", "success", "successful", "progress", "growth",
    "happy", "best", "wonderful", "improvement", "win", "benefit", "advance", "support", "joy",
    # Tamil
    "நல்ல", "சிறந்த", "வெற்றி", "வளர்ச்சி", "மகிழ்ச்சி", "முன்னேற்றம்", "நன்மை", "உயர்",
    "அழகு", "பாராட்டு", "சாதனை", "நலம்", "முயற்சி", "ஆதரவு", "மகிழ்வு", "இனிமை",
    # Sinhala
    "හොඳ", "විශිෂ්ට", "ජයග්‍රහණ", "ජයග්‍රහණය", "දියුණුව", "දියුණු", "සතුටු", "සතුට", "ප්‍රගති", "ප්‍රගතිය", "වාසි", "වාසිය",
    "උසස්", "ලස්සන", "ප්‍රශංසා", "සාර්ථක", "යහපත්", "සහයෝග", "සහයෝගය", "ප්‍රීති", "ප්‍රීතිමත්", "වාසනාවන්ත", "වාසනා",
}

NEGATIVE_WORDS = {
    # English
    "bad", "terrible", "negative", "failure", "failed", "loss", "problem", "crisis",
    "damage", "danger", "poor", "decline", "corruption", "violence", "threat", "attack",
    # Tamil
    "மோசம்", "தோல்வி", "இழப்பு", "பிரச்சனை", "நெருக்கடி", "சேதம்", "ஆபத்து", "வீழ்ச்சி",
    "ஊழல்", "வன்முறை", "அச்சுறுத்தல்", "துன்பம்", "நோய்", "கவலை", "குறைவு",
    # Sinhala
    "නරක", "අසාර්ථක", "පාඩු", "පාඩුව", "ගැටලු", "ගැටලුව", "අර්බුද", "අර්බුදය", "හානි", "හානිය", "අනතුරු", "අනතුර",
    "පිරිහීම", "දූෂණ", "දූෂණය", "ප්‍රචණ්ඩ", "ප්‍රචණ්ඩත්වය", "තර්ජන", "තර්ජනය", "දුක්", "දුක", "රෝග", "රෝගය", "කරදර",
}


def analyze_sentiment(text: str, lang: str = "English", sentences: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Multilingual sentiment analysis at document and sentence level.
    Returns:
    {
        "label": "Positive" | "Negative" | "Neutral",
        "label_en": "positive" | "negative" | "neutral",
        "score": 0.85,
        "confidence": 0.85,
        "distribution": {"positive": 60.0, "neutral": 30.0, "negative": 10.0},
        "sentences": [
            {"sentence": "...", "language": "Tamil", "sentiment": "Positive", "confidence": 0.82, "score": 0.82}
        ]
    }
    """
    if not text or not text.strip():
        lbl = "நடுநிலை" if lang == "Tamil" else ("මධ්‍යස්ථ" if lang == "Sinhala" else "Neutral")
        return {
            "label": lbl, "label_en": "neutral", "score": 0.5, "confidence": 0.5,
            "distribution": {"positive": 0.0, "neutral": 100.0, "negative": 0.0},
            "sentences": []
        }

    if sentences is None:
        sentences = segment_sentences(text)

    sentence_sentiments = []
    total_pos = 0
    total_neg = 0
    total_neu = 0

    for s in sentences:
        s_lang = detect_sentence_language(s)
        words = re.findall(r'[\u0B80-\u0BFF\u0D80-\u0DFFa-zA-Z]+', s.lower())
        
        pos_hits = sum(1 for w in words if any(pw in w for pw in POSITIVE_WORDS))
        neg_hits = sum(1 for w in words if any(nw in w for nw in NEGATIVE_WORDS))

        if pos_hits > neg_hits:
            s_label = "Positive"
            conf = min(0.65 + (pos_hits - neg_hits) * 0.1, 0.98)
            total_pos += 1
        elif neg_hits > pos_hits:
            s_label = "Negative"
            conf = min(0.65 + (neg_hits - pos_hits) * 0.1, 0.98)
            total_neg += 1
        else:
            s_label = "Neutral"
            conf = 0.60
            total_neu += 1

        sentence_sentiments.append({
            "sentence": s,
            "language": s_lang,
            "sentiment": s_label,
            "confidence": round(conf, 2),
            "score": round(conf, 2),
        })

    total_sents = max(len(sentences), 1)
    pos_pct = round((total_pos / total_sents) * 100, 1)
    neg_pct = round((total_neg / total_sents) * 100, 1)
    neu_pct = round((total_neu / total_sents) * 100, 1)

    if total_pos > total_neg and total_pos >= total_neu:
        overall_en = "positive"
        overall_score = min(0.65 + (total_pos / total_sents) * 0.35, 0.99)
    elif total_neg > total_pos and total_neg >= total_neu:
        overall_en = "negative"
        overall_score = min(0.65 + (total_neg / total_sents) * 0.35, 0.99)
    else:
        overall_en = "neutral"
        overall_score = 0.60

    # Translate overall label
    if lang == "Tamil":
        overall_label = "நேர்மறை" if overall_en == "positive" else ("எதிர்மறை" if overall_en == "negative" else "நடுநிலை")
    elif lang == "Sinhala":
        overall_label = "ධනාත්මක" if overall_en == "positive" else ("සෘණාත්මක" if overall_en == "negative" else "මධ්‍යස්ථ")
    else:
        overall_label = overall_en.capitalize()

    # Optional LLM refinement for overall sentiment
    try:
        from routes.summarize import get_groq_client, MODEL
        client = get_groq_client()
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": 'Classify sentiment. Respond ONLY with JSON: {"label_en": "positive"|"negative"|"neutral", "score": float}'
                },
                {"role": "user", "content": text[:2000]}
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=128
        )
        import json
        res = json.loads(resp.choices[0].message.content)
        llm_label_en = res.get("label_en", overall_en).lower()
        if llm_label_en in ("positive", "negative", "neutral"):
            overall_en = llm_label_en
            overall_score = float(res.get("score", overall_score))
            if lang == "Tamil":
                overall_label = "நேர்மறை" if overall_en == "positive" else ("எதிர்மறை" if overall_en == "negative" else "நடுநிலை")
            elif lang == "Sinhala":
                overall_label = "ධනාත්මක" if overall_en == "positive" else ("සෘණාත්මක" if overall_en == "negative" else "මධ්‍යස්ථ")
            else:
                overall_label = overall_en.capitalize()
    except Exception:
        pass

    return {
        "label": overall_label,
        "label_en": overall_en,
        "score": round(overall_score, 2),
        "confidence": round(overall_score, 2),
        "distribution": {
            "positive": pos_pct,
            "negative": neg_pct,
            "neutral": neu_pct,
        },
        "sentences": sentence_sentiments[:100],
    }


# ==============================================================================
# 9. MULTILINGUAL TEXT CLASSIFICATION
# ==============================================================================

DOMAIN_PROFILES = {
    "Politics": {
        "en": ["government", "election", "parliament", "minister", "president", "policy", "political", "vote", "party", "cabinet"],
        "ta": ["அரசாங்கம்", "தேர்தல்", "பாராளுமன்றம்", "அமைச்சர்", "ஜனாதிபதி", "கொள்கை", "அரசியல்", "வாக்களிப்பு", "கட்சி"],
        "si": ["රජය", "මැතිවරණය", "පාර්ලිමේන්තුව", "ඇමති", "ජනාධිපති", "ප්‍රතිපත්තිය", "දේශපාලන", "ඡන්දය", "පක්ෂය"],
    },
    "Sports": {
        "en": ["cricket", "football", "match", "game", "team", "player", "tournament", "score", "cup", "champion", "sports"],
        "ta": ["கிரிக்கெட்", "கால்பந்து", "போட்டி", "விளையாட்டு", "அணி", "வீரர்", "கிண்ணம்", "வெற்றி"],
        "si": ["ක්‍රිකට්", "පාපන්දු", "තරගය", "ක්‍රීඩාව", "කණ්ඩායම", "ක්‍රීඩකයා", "කුසලානය", "ජයග්‍රහණය"],
    },
    "Business": {
        "en": ["economy", "business", "market", "stock", "trade", "investment", "company", "bank", "profit", "finance", "money"],
        "ta": ["பொருளாதாரம்", "வணிகம்", "சந்தை", "பங்கு", "வர்த்தகம்", "முதலீடு", "நிறுவனம்", "வங்கி", "லாபம்", "நிதி"],
        "si": ["ආර්ථිකය", "ව්‍යාපාරය", "වෙළඳපොළ", "කොටස්", "වෙළඳාම", "ආයෝජනය", "සමාගම", "බැංකුව", "ලාභය", "මූල්‍ය"],
    },
    "Technology": {
        "en": ["technology", "software", "computer", "internet", "ai", "digital", "system", "data", "cyber", "mobile", "app"],
        "ta": ["தொழில்நுட்பம்", "மென்பொருள்", "கணினி", "இணையம்", "டிஜிட்டல்", "அமைப்பு", "தரவு", "செயலி"],
        "si": ["තාක්ෂණය", "මෘදුකාංග", "පරිගණක", "අන්තර්ජාලය", "ඩිජිටල්", "පද්ධතිය", "දත්ත", "යෙදුම"],
    },
    "Education": {
        "en": ["school", "university", "student", "education", "teacher", "exam", "learning", "academic", "degree", "college"],
        "ta": ["பாடசாலை", "பல்கலைக்கழகம்", "மாணவர்", "கல்வி", "ஆசிரியர்", "பரீட்சை", "கற்றல்", "பட்டப்படிப்பு"],
        "si": ["පාසල", "විශ්වවිද්‍යාලය", "ශිෂ්‍යයා", "අධ්‍යාපනය", "ගුරුවරයා", "විභාගය", "ඉගෙනීම", "උපාධිය"],
    },
    "Science": {
        "en": ["science", "research", "scientific", "experiment", "climate", "space", "physics", "biology", "planet", "energy"],
        "ta": ["அறிவியல்", "ஆராய்ச்சி", "பரிசோதனை", "காலநிலை", "விண்வெளி", "சக்தி", "இயற்கை"],
        "si": ["විද්‍යාව", "පර්යේෂණ", "පරීක්ෂණය", "දේශගුණය", "අභ්‍යවකාශය", "ශක්තිය", "ස්වභාවධර්මය"],
    },
    "Health": {
        "en": ["health", "hospital", "doctor", "medical", "disease", "patient", "treatment", "medicine", "virus", "vaccine"],
        "ta": ["சுகாதாரம்", "வைத்தியசாலை", "மருத்துவர்", "நோய்", "நோயாளி", "சிகிச்சை", "மருந்து", "தடுப்பூசி"],
        "si": ["සෞඛ්‍යය", "රෝහල", "වෛද්‍යවරයා", "රෝගය", "රෝගියා", "ප්‍රතිකාර", "ඖෂධ", "එන්නත"],
    },
    "Law": {
        "en": ["court", "law", "judge", "legal", "police", "justice", "case", "crime", "lawyer", "rights"],
        "ta": ["நீதிமன்றம்", "சட்டம்", "நீதிபதி", "பொலிஸ்", "நீதி", "வழக்கு", "குற்றம்", "சட்டத்தரணி", "உரிமைகள்"],
        "si": ["උසාවිය", "නීතිය", "විනිසුරු", "පොලිසිය", "යුක්තිය", "නඩුව", "අපරාධය", "නීතිඥයා", "අයිතිවාසිකම්"],
    },
    "Entertainment": {
        "en": ["cinema", "movie", "actor", "music", "song", "film", "culture", "art", "drama", "festival"],
        "ta": ["சினிமா", "திரைப்படம்", "நடிகர்", "இசை", "பாடல்", "கலாச்சாரம்", "கலை", "நாடகம்", "திருவிழா"],
        "si": ["සිනමාව", "චිත්‍රපටය", "නළුවා", "සංගීතය", "ගීතය", "සංස්කෘතිය", "කලාව", "නාට්‍යය", "උත්සවය"],
    },
}

DOMAIN_TRANSLATIONS = {
    "Politics": {"ta": "அரசியல்", "si": "දේශපාලන", "en": "Politics"},
    "Sports": {"ta": "விளையாட்டு", "si": "ක්‍රීඩා", "en": "Sports"},
    "Business": {"ta": "வணிகம்", "si": "ව්‍යාපාරික", "en": "Business"},
    "Technology": {"ta": "தொழில்நுட்பம்", "si": "තාක්ෂණය", "en": "Technology"},
    "Education": {"ta": "கல்வி", "si": "අධ්‍යාපනය", "en": "Education"},
    "Science": {"ta": "அறிவியல்", "si": "විද්‍යාත්මක", "en": "Science"},
    "Health": {"ta": "சுகாதாரம்", "si": "සෞඛ්‍යය", "en": "Health"},
    "Law": {"ta": "சட்டம்", "si": "නීතිය", "en": "Law"},
    "Entertainment": {"ta": "பொழுதுபோக்கு", "si": "විනෝදාස්වාදය", "en": "Entertainment"},
    "Other": {"ta": "பொதுவானது", "si": "වෙනත්", "en": "Other"},
}


def classify_text(text: str, lang: str = "English") -> Dict[str, Any]:
    """
    Multilingual text classification with full probability distribution.
    """
    if not text or not text.strip():
        other_lbl = DOMAIN_TRANSLATIONS["Other"].get("ta" if lang == "Tamil" else ("si" if lang == "Sinhala" else "en"), "Other")
        return {
            "predicted_category": "Other",
            "predicted_label": other_lbl,
            "score": 1.0,
            "probabilities": {"Other": 1.0},
            "all": [{"label": other_lbl, "label_en": "Other", "score": 1.0}],
        }

    text_lower = text.lower()
    scores = {}

    for domain, lang_dict in DOMAIN_PROFILES.items():
        score = 0
        for l_key, words in lang_dict.items():
            for w in words:
                score += text_lower.count(w.lower())
        scores[domain] = score

    total_score = sum(scores.values())

    if total_score == 0:
        scores["Other"] = 1
        total_score = 1
    else:
        scores["Other"] = 0.5

    # Normalize to probabilities
    norm_probs = {d: round(s / total_score, 4) for d, s in scores.items()}
    # Sort descending
    sorted_domains = sorted(norm_probs.items(), key=lambda x: x[1], reverse=True)
    top_domain, top_prob = sorted_domains[0]

    all_list = []
    for d_name, d_score in sorted_domains:
        d_trans = DOMAIN_TRANSLATIONS.get(d_name, {}).get("ta" if lang == "Tamil" else ("si" if lang == "Sinhala" else "en"), d_name)
        all_list.append({
            "label": d_trans,
            "label_en": d_name,
            "score": round(d_score, 4),
        })

    # Optional LLM refinement
    try:
        from routes.summarize import get_groq_client, MODEL
        client = get_groq_client()
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Classify the text into top 3-5 categories. Respond ONLY with JSON:\n"
                        '{"all": [{"label_en": "Politics"|"Sports"|"Business"|"Technology"|"Education"|"Science"|"Health"|"Law"|"Entertainment"|"Other", "score": float}]}'
                    )
                },
                {"role": "user", "content": text[:3000]}
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=256
        )
        import json
        llm_data = json.loads(resp.choices[0].message.content)
        llm_all = llm_data.get("all", [])
        if llm_all and isinstance(llm_all, list):
            all_list = []
            for item in llm_all:
                l_en = item.get("label_en", "Other")
                l_trans = DOMAIN_TRANSLATIONS.get(l_en, {}).get("ta" if lang == "Tamil" else ("si" if lang == "Sinhala" else "en"), l_en)
                all_list.append({
                    "label": l_trans,
                    "label_en": l_en,
                    "score": float(item.get("score", 0.5)),
                })
            top_domain = all_list[0]["label_en"]
            top_prob = all_list[0]["score"]
    except Exception:
        pass

    top_label_disp = DOMAIN_TRANSLATIONS.get(top_domain, {}).get("ta" if lang == "Tamil" else ("si" if lang == "Sinhala" else "en"), top_domain)

    return {
        "predicted_category": top_domain,
        "predicted_label": top_label_disp,
        "score": top_prob,
        "probabilities": {item["label_en"]: item["score"] for item in all_list},
        "all": all_list,
    }


# ==============================================================================
# 10. DOCUMENT STATISTICS COMPUTATION
# ==============================================================================

def compute_statistics(text: str, token_data: Dict[str, Any]) -> Dict[str, Any]:
    """Compute structural document statistics without language/entity/sentiment analysis."""
    normalized_text = text or ""
    paragraphs = [p for p in re.split(r"\n\s*\n", normalized_text.strip()) if p.strip()]
    return {
        "characters": len(normalized_text),
        "characters_without_spaces": len(re.sub(r"\s+", "", normalized_text)),
        "tokens": token_data.get("token_count", 0),
        "unique_tokens": token_data.get("unique_tokens", 0),
        "sentences": token_data.get("sentence_count", 0),
        "paragraphs": len(paragraphs),
    }


# ==============================================================================
# 11. MAIN NLP PIPELINE ENTRYPOINT
# ==============================================================================

def analyze(text: str, max_chars: int = 100_000) -> Dict[str, Any]:
    """
    Complete language-aware NLP processing pipeline for English, Tamil, and Sinhala.
    1. Sentence Segmentation & Language-Aware Tokenization
    2. POS Tagging, Lemmatization, and Morphology
    3. Language-aware token and corpus analysis
    """
    if not text:
        text = ""

    truncated_text = text[:max_chars]

    # Select a primary language internally for language-aware processing.
    lang_data = detect_languages(truncated_text)
    primary_lang = lang_data["primary_language"]

    # Tokenize, POS Tag, Lemmatize, and extract Morphological features
    token_results = tokenize_and_tag(truncated_text)
    statistics = compute_statistics(truncated_text, token_results)

    return {
        "language": primary_lang,
        "tokens": token_results.get("tokens", []),
        "token_count": token_results.get("token_count", 0),
        "unique_tokens": token_results.get("unique_tokens", 0),
        "lemmas": token_results.get("lemmas", []),
        "top_keywords": token_results.get("top_keywords", []),
        "token_details": token_results.get("token_details", []),
        "pos_distribution": token_results.get("pos_distribution", {}),
        "top_words": token_results.get("top_words", []),
        "sentences": token_results.get("sentences", []),
        "sentence_count": token_results.get("sentence_count", 0),
        "statistics": statistics,
    }


def detect_language(text: str) -> str:
    """Backward compatibility helper."""
    return detect_languages(text).get("primary_language", "English")