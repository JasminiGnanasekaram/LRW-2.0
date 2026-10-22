"""Compact multilingual NLP helpers for English, Tamil, and Sinhala."""

import re
import unicodedata
from collections import Counter
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

NLP_RULES_VERSION = 8


def _normalize_text(text: str) -> str:
    if not text:
        return ""
    return unicodedata.normalize("NFC", text).replace("\u200c", "").replace("\u200d", "").replace("\ufeff", "")


def detect_languages(text: str) -> Dict[str, Any]:
    if not text or not text.strip():
        return {
            "primary_language": "English",
            "primary_code": "en",
            "is_multilingual": False,
            "languages_detected": [{"language": "English", "code": "en", "percentage": 100.0}],
            "script_counts": {"English": 0, "Tamil": 0, "Sinhala": 0},
        }

    sample = text[:50000]
    sinhala_count = sum(1 for ch in sample if "\u0D80" <= ch <= "\u0DFF")
    tamil_count = sum(1 for ch in sample if "\u0B80" <= ch <= "\u0BFF")
    english_count = sum(1 for ch in sample if ("a" <= ch <= "z") or ("A" <= ch <= "Z"))
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
    breakdown.sort(key=lambda x: x["percentage"], reverse=True)

    primary = breakdown[0]["language"] if breakdown else "English"
    primary_code = breakdown[0]["code"] if breakdown else "en"
    is_multi = len([b for b in breakdown if b["percentage"] >= 5.0]) > 1

    return {
        "primary_language": primary,
        "primary_code": primary_code,
        "is_multilingual": is_multi,
        "languages_detected": breakdown,
        "script_counts": {"English": english_count, "Tamil": tamil_count, "Sinhala": sinhala_count},
    }


def detect_sentence_language(sentence: str) -> str:
    if not sentence or not sentence.strip():
        return "English"
    si = sum(1 for ch in sentence if "\u0D80" <= ch <= "\u0DFF")
    ta = sum(1 for ch in sentence if "\u0B80" <= ch <= "\u0BFF")
    en = sum(1 for ch in sentence if ("a" <= ch <= "z") or ("A" <= ch <= "Z"))
    if si >= ta and si >= en and si > 0:
        return "Sinhala"
    if ta >= si and ta >= en and ta > 0:
        return "Tamil"
    if en > 0:
        return "English"
    return "English"


def segment_sentences(text: str) -> List[str]:
    if not text or not text.strip():
        return []
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    protected = normalized
    protected = re.sub(r"(\d+)\.(\d+)", r"\1<DECIMAL_DOT>\2", protected)

    def _mask_url(match):
        return match.group(0).replace(".", "<URL_DOT>")

    protected = re.sub(r"(https?://\S+|www\.\S+|\S+@\S+\.\S+)", _mask_url, protected)
    protected = re.sub(r"(?<=\b[A-Za-z])\.(?=\s+[A-Za-z]\b)", "<INITIAL_DOT>", protected)
    protected = re.sub(r"(?<=\b[A-Za-z])\.(?=\s+[A-Z][a-z])", "<INITIAL_DOT>", protected)
    pattern = re.compile(r"\b(Dr|Mr|Mrs|Ms|Prof|Rev|Hon|Capt|Col|Gen|Gov|Sgt|St|Jr|Sr|Ltd|Plc|Pvt|Co|Corp|Inc|Dept|approx|est|fig|No|Nos|vs|vol|vols|e\.g|i\.e|etc|al|Rs|LKR|min|sec|hr|km|cm|mm|kg)\.(?=\s+)", re.IGNORECASE)
    protected = pattern.sub(r"\1<ABBR_DOT>", protected)
    raw_sents = re.split(r"(?<=[.!?|।॥\n])\s+", protected)
    cleaned: List[str] = []
    for sent in raw_sents:
        sent = sent.replace("<DECIMAL_DOT>", ".").replace("<URL_DOT>", ".").replace("<INITIAL_DOT>", ".").replace("<ABBR_DOT>", ".")
        sent = sent.strip()
        if sent and len(sent) > 1:
            cleaned.append(sent)
    return cleaned if cleaned else [text.strip()]


@lru_cache(maxsize=1)
def _get_english_nlp():
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
    try:
        import stanza
        try:
            stanza.download("ta", processors="tokenize,mwt,pos,lemma")
        except Exception:
            pass
        return stanza.Pipeline("ta", processors="tokenize,mwt,pos,lemma", download_method=None, verbose=False)
    except Exception:
        return None


def _tokenize_english_regex(text: str) -> List[str]:
    return re.findall(r"[A-Za-z0-9]+(?:'[A-Za-z]+)?|[^\w\s]", text)


def _is_punctuation_token(token: str) -> bool:
    return bool(token) and all(c in '.,!?;:|।॥\'"()[]{}<>-–—/\\@#$%&*+=_~^`' for c in token)


TAMIL_PRONOUNS = {
    "நான்": ("PRON", "நான்", "Case=Nom|Number=Sing|Person=1"),
    "நாம்": ("PRON", "நாம்", "Case=Nom|Number=Plur|Person=1"),
    "நீ": ("PRON", "நீ", "Case=Nom|Number=Sing|Person=2"),
    "நீங்கள்": ("PRON", "நீங்கள்", "Case=Nom|Number=Plur|Person=2"),
    "அவன்": ("PRON", "அவன்", "Case=Nom|Gender=Masc|Number=Sing|Person=3"),
    "அவள்": ("PRON", "அவள்", "Case=Nom|Gender=Fem|Number=Sing|Person=3"),
    "அவர்": ("PRON", "அவர்", "Case=Nom|Number=Sing|Person=3|Polite=Yes"),
    "அவர்கள்": ("PRON", "அவர்கள்", "Case=Nom|Number=Plur|Person=3"),
    "அது": ("PRON", "அது", "Case=Nom|Gender=Neut|Number=Sing|Person=3"),
    "அவை": ("PRON", "அவை", "Case=Nom|Gender=Neut|Number=Plur|Person=3"),
    "இது": ("PRON", "இது", "Case=Nom|Gender=Neut|Number=Sing|Person=3"),
    "என்ன": ("PRON", "என்ன", "PronType=Int"),
    "யார்": ("PRON", "யார்", "PronType=Int"),
    "தான்": ("PRON", "தான்", "PronType=Prs|Reflex=Yes"),
}
TAMIL_CONJUNCTIONS = {"மற்றும்", "ஆனால்", "அல்லது", "எனவே", "மேலும்", "என்று"}
TAMIL_POSTPOSITIONS = {"பற்றி", "போது", "முன்", "பின்", "மீது", "மேல்", "கீழ்", "இடையே"}
TAMIL_DETERMINERS = {"ஒரு", "இந்த", "அந்த", "எந்த"}
TAMIL_ADJECTIVES = {"அழகான", "புதிய", "பழைய", "நல்ல", "சிறந்த", "பெரிய", "சிறிய", "தமிழ்"}

TAMIL_COMMON_NOUNS = {
    "உன்": ("NOUN", "நீ", "Case=Gen|Number=Sing|Person=2"),
    "என்": ("NOUN", "நான்", "Case=Gen|Number=Sing|Person=1"),
    "உன்னை": ("NOUN", "நீ", "Case=Acc|Number=Sing|Person=2"),
    "என்னை": ("NOUN", "நான்", "Case=Acc|Number=Sing|Person=1"),
    "மாணவர்": ("NOUN", "மாணவர்", "Case=Nom|Number=Sing"),
    "மாணவர்கள்": ("NOUN", "மாணவர்", "Case=Nom|Number=Plur"),
    "பல்கலைக்கழகம்": ("NOUN", "பல்கலைக்கழகம்", "Case=Nom|Number=Sing"),
    "பல்கலைக்கழகத்தில்": ("NOUN", "பல்கலைக்கழகம்", "Case=Loc|Number=Sing"),
    "விவசாயி": ("NOUN", "விவசாயி", "Case=Nom|Number=Sing"),
    "விவசாயிக்கு": ("NOUN", "விவசாயி", "Case=Dat|Number=Sing"),
    "கிராமம்": ("NOUN", "கிராமம்", "Case=Nom|Number=Sing"),
    "கிராமத்தில்": ("NOUN", "கிராமம்", "Case=Loc|Number=Sing"),
    "பழங்காலம்": ("NOUN", "பழங்காலம்", "Case=Nom|Number=Sing"),
    "பழங்காலத்தில்": ("NOUN", "பழங்காலம்", "Case=Loc|Number=Sing"),
    "ஒன்று": ("NUM", "ஒன்று", "NumType=Card"),
    "வாத்து": ("NOUN", "வாத்து", "Case=Nom|Number=Sing"),
    "முட்டை": ("NOUN", "முட்டை", "Case=Nom|Number=Sing"),
    "முட்டையை": ("NOUN", "முட்டை", "Case=Acc|Number=Sing"),
    "காலம்": ("NOUN", "காலம்", "Case=Nom|Number=Sing"),
    "காலத்தில்": ("NOUN", "காலம்", "Case=Loc|Number=Sing"),
    "நாடு": ("NOUN", "நாடு", "Case=Nom|Number=Sing"),
    "நாட்டை": ("NOUN", "நாடு", "Case=Acc|Number=Sing"),
    "சொத்து": ("NOUN", "சொத்து", "Case=Nom|Number=Sing"),
    "சொத்துல்": ("NOUN", "சொத்து", "Case=Nom|Number=Sing"),
    "தங்கம்": ("NOUN", "தங்கம்", "Case=Nom|Number=Sing"),
    "வாழ்": ("VERB", "வாழ்", "VerbForm=Inf"),
    "வாழ்ந்து": ("VERB", "வாழ்", "VerbForm=Part|Aspect=Perf"),
    "வந்தான்": ("VERB", "வா", "Tense=Past|Gender=Masc|Number=Sing|Person=3"),
    "இருந்தது": ("VERB", "இரு", "Tense=Past|Gender=Neut|Number=Sing"),
    "கொண்டு": ("VERB", "கொள்", "VerbForm=Part|Aspect=Perf"),
    "வந்து": ("VERB", "வா", "VerbForm=Part|Aspect=Perf"),
    "முயன்றால்": ("VERB", "முயல்", "Mood=Cond|Tense=Past"),
    "முடியாது": ("VERB", "முடி", "Mood=Pot|Polarity=Neg"),
    "முடியாதது": ("VERB", "முடி", "Mood=Pot|Polarity=Neg|Gender=Neut|Number=Sing"),
    "இல்லை": ("VERB", "இல்லை", "Polarity=Neg"),
    "அழகான": ("ADJ", "அழகான", ""),
    "ஒரு": ("DET", "ஒரு", "PronType=Art"),
}

TAMIL_LEMMA_OVERRIDES = {"மாணவர்கள்": ("NOUN", "மாணவர்", "Case=Nom|Number=Plur")}
TAMIL_LEMMA_CORRECTIONS = {
    "காலத்துல": "காலம்", "காலத்தில்": "காலம்", "காலத்தை": "காலம்", "காலத்திற்கு": "காலம்",
    "நாட்டை": "நாடு", "நாட்டில்": "நாடு", "நாட்டின்": "நாடு",
    "சொத்துல்": "சொத்து", "சொத்துல": "சொத்து",
    "முட்டை": "முட்டை", "முட்டையை": "முட்டை",
    "தங்கக்": "தங்கம்", "தங்கத்தைய்": "தங்கம்", "தங்கத்தை": "தங்கம்", "தங்கத்தைக்": "தங்கம்",
    "இடும்": "இடு", "இட்டது": "இடு", "இட்டான்": "இடு", "இடுகிறது": "இடு",
    "பழங்காலத்தில்": "பழங்காலம்", "கிராமத்தில்": "கிராமம்",
    "வாழ்ந்து": "வாழ்", "வந்தான்": "வா", "இருந்தது": "இரு", "கொண்டு": "கொள்", "வந்து": "வா",
    "விற்கும்": "விற்க", "நாளடைவில்": "நாளடைவு", "தனது": "தன்",
    "நீங்கி": "நீங்கு", "செல்வச்": "செல்வம்", "செழிப்புடன்": "செழிப்பு",
    "நாட்கள்": "நாள்", "செல்ல": "செல்", "விவசாயிக்கு": "விவசாயி",
    "பேராசை": "பேராசை", "அதிகரித்தது": "அதிகரி", "முட்டைதான்": "முட்டை",
    "தருகிறது": "தரு", "நிறைந்த": "நிறை", "இருக்க்கும்": "இரு",
    "ஒரே": "ஒரு", "நாளில்": "நாள்", "அத்தனை": "அத்தனை",
    "எடுத்துக்கொள்ளக்": "எடு", "கூடாது": "கூடு", "சிந்தித்தான்": "சிந்தி",
    "என்பதை": "என்று", "அறியாத": "அறி", "கூர்மைய்": "கூர்மை",
    "கத்தியை": "கத்தி", "எடுத்துக்கொண்டு": "எடு", "வாத்தை": "வாத்து",
    "வெட்டினான்": "வெட்டு", "வயிற்றுக்கு": "வயிறு", "சாதாரணப்": "சாதாரணம்",
    "பறவைகளைப்": "பறவை", "சாதாரண": "சாதாரணம்", "இரத்த்": "இரத்தம்",
    "இருந்தன": "இரு", "புரிந்தது": "புரி", "பெற்ற": "பெறு",
    "பொக்கிஷத்தைய்": "பொக்கிஷம்", "ஆசைப்பட்டால்": "ஆசை", "இழக்க": "இழக்கு",
    "நேரிடும்": "நேரிடு", "சிறுகதைகள்": "சிறுகதை",
    "கற்றுக்": "கல்", "கற்று": "கல்", "கற்க": "கல்", "கற்கும்": "கல்",
    "பாடத்தை": "பாடம்", "பாடத்த": "பாடம்", "பாடத்": "பாடம்",
    "மறுத்தால்": "மறு", "மறுத்தா": "மறு", "மறுத்த": "மறு",
    "ஆசிரியர்கள்": "ஆசிரியர்", "ஆசிரியர": "ஆசிரியர்",
    "முயன்றால்": "முயல்", "முடியாதது": "முடி",
}


def _strip_common_tamil_suffix(word: str) -> str:
    clean = (word or "").strip("\u200c\u200d\ufeff")
    if not clean or len(clean) <= 2:
        return clean
    suffix_replacements = [
        ("த்துல்", "ம்"), ("த்துல", "ம்"), ("த்துள்", "ம்"), ("த்தில்", "ம்"), ("துல்", ""), ("தில்", "ம்"), ("வில்", "ம்"), ("லில்", "ம்"),
        ("ளில்", ""), ("ரில்", ""), ("யில்", ""), ("ஆல்", ""), ("களுக்காக", ""), ("களுக்கு", ""), ("களின்", ""), ("களை", ""),
        ("களால்", ""), ("களுடன்", ""), ("களில்", ""), ("களே", ""), ("க்கு", ""), ("அக்கு", ""), ("இல்", ""), ("ல்", ""),
        ("இன்", ""), ("ன்றால்", "ல்"), ("ந்தால்", ""), ("த்தால்", ""), ("னால்", ""), ("வார்", ""), ("த்தார்", ""), ("ந்தார்", ""),
        ("னார்", ""), ("த்தது", ""), ("ன்றது", ""), ("ந்தது", ""), ("னது", ""), ("வார்கள்", ""), ("கிறார்கள்", ""), ("கின்றார்கள்", ""),
        ("கிறது", ""), ("கின்றது", ""), ("ஆகிறது", ""), ("மாகிறது", ""), ("யாக", "")
    ]
    for suffix, replacement in suffix_replacements:
        if clean.endswith(suffix):
            base = clean[: -len(suffix)]
            candidate = base + replacement if replacement else base
            if len(candidate) >= 2:
                return candidate
    return clean


def _lookup_known_tamil_lemma(candidate: str) -> Optional[str]:
    if not candidate:
        return None
    normalized = candidate.strip("\u200c\u200d\ufeff")
    if not normalized:
        return None
    if normalized in TAMIL_LEMMA_CORRECTIONS:
        return TAMIL_LEMMA_CORRECTIONS[normalized]
    if normalized in TAMIL_COMMON_NOUNS:
        return TAMIL_COMMON_NOUNS[normalized][1]
    if normalized in TAMIL_LEMMA_OVERRIDES:
        return TAMIL_LEMMA_OVERRIDES[normalized][2]
    if normalized.endswith("க்கு") and normalized[:-2] in TAMIL_LEMMA_CORRECTIONS:
        return TAMIL_LEMMA_CORRECTIONS[normalized[:-2]]
    stripped = _strip_common_tamil_suffix(normalized)
    if stripped != normalized and stripped not in ("", normalized):
        return stripped
    return None


def correct_tamil_lemma(word: str, stanza_lemma: str) -> str:
    normalized = (word or "").strip("\u200c\u200d\ufeff")
    stanza_value = (stanza_lemma or "").strip("\u200c\u200d\ufeff")
    if not normalized:
        return stanza_value or ""
    for candidate in [normalized, stanza_value]:
        if not candidate:
            continue
        if candidate in TAMIL_LEMMA_CORRECTIONS:
            return TAMIL_LEMMA_CORRECTIONS[candidate]
        known = _lookup_known_tamil_lemma(candidate)
        if known:
            return known
    stripped = _strip_common_tamil_suffix(normalized)
    if stripped != normalized and stripped not in ("", normalized):
        return stripped
    return stanza_value or normalized


TAMIL_VERB_ROOTS = {"வாழ்": "வாழ்", "செய்": "செய்", "முடி": "முடி", "முயல்": "முயல்", "வா": "வா", "இரு": "இரு", "கொள்": "கொள்", "செல்": "செல்", "போ": "போ", "பார்": "பார்"}


def _analyze_tamil_word(word: str) -> Tuple[str, str, str, str]:
    word = (word or "").strip("\u200c\u200d\ufeff")
    if not word:
        return ("X", "X", "", "")
    if word in TAMIL_LEMMA_OVERRIDES:
        return ("NOUN", "NOUN", TAMIL_LEMMA_OVERRIDES[word][2], "Case=Nom|Number=Sing")
    if word in TAMIL_LEMMA_CORRECTIONS:
        return ("NOUN", "NOUN", TAMIL_LEMMA_CORRECTIONS[word], "Case=Nom|Number=Sing")
    if all(c in '.,!?;:|।॥\'"()[]{}<>-–—/\\@#$%&*+=_~^`' for c in word):
        return ("PUNCT", "PUNCT", word, "")
    if word.isdigit() or re.match(r"^\d+[\d,.]*$", word):
        return ("NUM", "NUM", word, "NumType=Card")
    if word in TAMIL_PRONOUNS:
        pos, lemma, morph = TAMIL_PRONOUNS[word]
        return (pos, pos, lemma, morph)
    if word in TAMIL_CONJUNCTIONS:
        return ("CONJ", "CCONJ", word, "")
    if word in TAMIL_POSTPOSITIONS:
        return ("ADP", "POSTP", word, "")
    if word in TAMIL_DETERMINERS:
        return ("DET", "DET", word, "PronType=Art")
    if word in TAMIL_ADJECTIVES:
        return ("ADJ", "ADJ", word, "")
    if word in TAMIL_COMMON_NOUNS:
        pos, lemma, morph = TAMIL_COMMON_NOUNS[word]
        return (pos, pos, lemma, morph)

    for suffix, morph in [
        ("கொண்டிருக்கிறார்கள்", "Tense=Pres|Aspect=Prog|Number=Plur|Person=3"),
        ("கொண்டிருக்கிறார்", "Tense=Pres|Aspect=Prog|Number=Sing|Person=3|Polite=Yes"),
        ("கிறார்கள்", "Tense=Pres|Number=Plur|Person=3"),
        ("கிறார்", "Tense=Pres|Number=Sing|Person=3|Polite=Yes"),
        ("கிறது", "Tense=Pres|Gender=Neut|Number=Sing|Person=3"),
        ("விட்டார்கள்", "Tense=Past|Aspect=Perf|Number=Plur|Person=3"),
        ("விட்டார்", "Tense=Past|Aspect=Perf|Number=Sing|Person=3|Polite=Yes"),
        ("ந்தார்கள்", "Tense=Past|Number=Plur|Person=3"), ("னார்கள்", "Tense=Past|Number=Plur|Person=3"),
        ("த்தார்", "Tense=Past|Number=Sing|Person=3|Polite=Yes"), ("னார்", "Tense=Past|Number=Sing|Person=3|Polite=Yes"),
        ("ந்தது", "Tense=Past|Gender=Neut|Number=Sing"), ("னது", "Tense=Past|Gender=Neut|Number=Sing"),
        ("வில்லை", "Polarity=Neg"), ("க்கூடாது", "Mood=Proh|Polarity=Neg"), ("லாம்", "Mood=Pot"),
        ("த்தால்", "Case=Ins|Number=Sing"), ("க்கு", "Case=Dat|Number=Sing"), ("த்தில்", "Case=Loc|Number=Sing"),
        ("மை", "Case=Acc|Number=Sing"), ("யை", "Case=Acc|Number=Sing"), ("ன்", "Case=Nom|Number=Sing"),
        ("வார்கள்", "Tense=Fut|Number=Plur|Person=3"), ("க்க", "VerbForm=Inf"),
    ]:
        if word.endswith(suffix) and len(word) > len(suffix) + 1:
            base = word[: -len(suffix)]
            return ("VERB", "VERB", base if base else word, morph)

    if re.search(r"(ன்|ல்|ம்)$", word):
        base = re.sub(r"(ன்|ல்|ம்)$", "", word)
        return ("NOUN", "NOUN", base if base else word, "Case=Nom|Number=Sing")

    return ("NOUN", "NOUN", word, "Case=Nom|Number=Sing")


SINHALA_PRONOUNS = {"මම": ("PRON", "මම", "Case=Nom|Number=Sing|Person=1"), "අපි": ("PRON", "අපි", "Case=Nom|Number=Plur|Person=1"), "ඔබ": ("PRON", "ඔබ", "Case=Nom|Number=Sing|Person=2|Polite=Yes")}
SINHALA_CONJUNCTIONS = {"සහ", "හා", "නමුත්", "එහෙත්", "හෝ"}
SINHALA_POSTPOSITIONS = {"ගැන", "මත", "තුළ", "සමඟ", "වෙනුවෙන්"}
SINHALA_ADJECTIVES = {"හොඳ", "නරක", "ලස්සන", "අලුත්", "පරණ", "ලොකු", "කුඩා"}
SINHALA_ADVERBS = {"ඉක්මනින්", "හොඳින්", "දැන්", "ඉතා", "බොහෝ"}
SINHALA_LEMMA_OVERRIDES = {
    "විශ්වවිද්‍යාලයේ": ("NOUN", "විශ්වවිද්‍යාලය", "Case=Loc|Number=Sing"),
    "හොඳින්": ("ADV", "හොඳ", ""),
    "කළහ": ("VERB", "කර", "Tense=Past|Number=Plur|Person=3"),
    "කළා": ("VERB", "කර", "Tense=Past|Aspect=Perf"),
    "කරනවා": ("VERB", "කර", "Tense=Pres|Mood=Ind"),
    "කරන": ("VERB", "කර", "VerbForm=Part|Tense=Pres"),
    "ලැබේ": ("VERB", "ලබ", "Tense=Pres|Voice=Pass"),
    "ලැබූ": ("VERB", "ලබ", "Tense=Past|Voice=Pass"),
}
SINHALA_LEMMA_OVERRIDES_NORMALIZED = {k.translate(str.maketrans("", "", "\u200c\u200d\ufeff")): v for k, v in SINHALA_LEMMA_OVERRIDES.items()}


def _analyze_sinhala_word(word: str) -> Tuple[str, str, str, str]:
    lookup_word = word.translate(str.maketrans("", "", "\u200c\u200d\ufeff"))
    if lookup_word in SINHALA_LEMMA_OVERRIDES_NORMALIZED:
        pos, lemma, morph = SINHALA_LEMMA_OVERRIDES_NORMALIZED[lookup_word]
        return (pos, pos, lemma, morph)
    if all(c in '.,!?;:|।॥\'"()[]{}<>-–—/\\@#$%&*+=_~^`' for c in word):
        return ("PUNCT", "PUNCT", word, "")
    if word.isdigit() or re.match(r"^\d+[\d,.]*$", word):
        return ("NUM", "NUM", word, "NumType=Card")
    if word in SINHALA_PRONOUNS:
        pos, lemma, morph = SINHALA_PRONOUNS[word]
        return (pos, pos, lemma, morph)
    if word in SINHALA_CONJUNCTIONS:
        return ("CONJ", "CCONJ", word, "")
    if word in SINHALA_POSTPOSITIONS:
        return ("ADP", "POSTP", word, "")
    if word in SINHALA_ADJECTIVES:
        return ("ADJ", "ADJ", word, "")
    if word in SINHALA_ADVERBS:
        return ("ADV", "ADV", word, "")
    for suffix, morph in [("කළා", "Tense=Past|Mood=Ind"), ("කරනවා", "Tense=Pres|Mood=Ind"), ("කරන", "VerbForm=Part|Tense=Pres"), ("වෙයි", "Tense=Pres|Mood=Ind"), ("විය", "Tense=Past|Person=3"), ("ති", "Tense=Pres|Number=Plur|Person=3"), ("න්න", "VerbForm=Inf")]:
        if word.endswith(suffix) and len(word) > len(suffix) + 1:
            return ("VERB", "VERB", word[: -len(suffix)], morph)
    return ("NOUN", "NOUN", word, "Case=Nom|Number=Sing")


def tokenize_and_tag(text: str) -> Dict[str, Any]:
    sentences = segment_sentences(text)
    token_details: List[Dict[str, Any]] = []
    token_texts: List[str] = []
    lemmas: List[str] = []
    pos_counter = Counter()
    word_freq = Counter()

    en_nlp = _get_english_nlp()

    for sent_id, sent in enumerate(sentences, 1):
        lang = detect_sentence_language(sent)
        if lang == "English" and en_nlp is not None:
            doc = en_nlp(sent)
            for token in doc:
                if token.is_punct or token.is_space:
                    continue
                text_clean = token.text.strip()
                if not text_clean:
                    continue
                token_texts.append(text_clean)
                word_freq[text_clean.lower()] += 1
                pos_counter[token.pos_ or "X"] += 1
                lemmas.append(token.lemma_ or text_clean)
                token_details.append({
                    "token": text_clean,
                    "text": text_clean,
                    "normalized": text_clean.lower(),
                    "lemma": token.lemma_ or text_clean,
                    "pos": token.pos_ or "X",
                    "tag": token.tag_ or (token.pos_ or "X"),
                    "morph": str(token.morph) if token.morph else "",
                    "language": "en",
                    "sentence_id": sent_id,
                    "is_stop": bool(token.is_stop),
                })
        else:
            raw_tokens = re.findall(r"[\u0B80-\u0BFF\u0D80-\u0DFF]+|[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)?|[^\w\s]", sent)
            for raw in raw_tokens:
                tok = raw.strip()
                if not tok or _is_punctuation_token(tok):
                    continue
                if detect_sentence_language(tok) == "Tamil" or any(ord(ch) in range(ord("\u0B80"), ord("\u0BFF") + 1) for ch in tok):
                    pos, tag, lemma, morph = _analyze_tamil_word(tok)
                    language = "ta"
                else:
                    pos, tag, lemma, morph = _analyze_sinhala_word(tok)
                    language = "si"
                token_texts.append(tok)
                word_freq[tok.lower()] += 1
                pos_counter[pos] += 1
                lemmas.append(lemma)
                token_details.append({
                    "token": tok,
                    "text": tok,
                    "normalized": tok.lower(),
                    "lemma": lemma,
                    "pos": pos,
                    "tag": tag,
                    "morph": morph,
                    "language": language,
                    "sentence_id": sent_id,
                    "is_stop": False,
                })

    top_words = [item[0] for item in word_freq.most_common(10)]
    pos_distribution = dict(sorted(pos_counter.items()))
    return {
        "tokens": token_texts,
        "token_count": len(token_texts),
        "unique_tokens": len(set(token_texts)),
        "lemmas": lemmas,
        "top_keywords": top_words,
        "token_details": token_details,
        "pos_distribution": pos_distribution,
        "top_words": top_words,
        "sentences": sentences,
        "sentence_count": len(sentences),
    }


def extract_entities(text: str, lang: str = "English") -> List[Dict[str, Any]]:
    entities: List[Dict[str, Any]] = []
    cleaned = text or ""
    for pat, ent_type in [
        (r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", "PERSON"),
        (r"\b(?:Colombo|Kandy|Galle|Jaffna|Negombo|Gampaha|Peradeniya|Sri Lanka|Tamil Nadu)\b", "LOCATION"),
        (r"\b(?:Rs\.|LKR|USD|EUR)\s*\d+[\d,\.]*\b", "MONEY"),
        (r"\b\d{4}\b", "YEAR"),
        (r"[\u0B80-\u0BFF\u0D80-\u0DFF]{3,}", "TEXT"),
    ]:
        for match in re.finditer(pat, cleaned, flags=re.IGNORECASE):
            token = match.group(0)
            if token.strip():
                entities.append({"text": token, "label": ent_type, "start": match.start(), "end": match.end()})
    return entities


def analyze_sentiment(text: str, lang: str = "English", sentences: Optional[List[str]] = None) -> Dict[str, Any]:
    sample = text or ""
    positive = {"positive", "happy", "good", "success", "excellent", "great", "நேர்மறை", "மகிழ்ச்சி", "வெற்றி", "சிறப்பு", "ධනාත්මක"}
    negative = {"negative", "bad", "fail", "poor", "problem", "sad", "துரதிர்ஷ்டம்", "மோசம்", "தோல்வி", "பிரச்சனை", "අවාධි"}
    lowered = sample.lower()
    score = 0.0
    for word in positive:
        if word in lowered:
            score += 0.5
    for word in negative:
        if word in lowered:
            score -= 0.5
    if score > 0:
        return {"label": "நேர்மறை" if lang.lower() in {"tamil", "sinhala"} else "positive", "label_en": "positive", "score": min(1.0, max(0.0, 0.5 + score / 6.0)), "positive": score, "negative": 0.0}
    if score < 0:
        return {"label": "எதிர்மறை" if lang.lower() in {"tamil", "sinhala"} else "negative", "label_en": "negative", "score": min(1.0, max(0.0, 0.5 + score / 6.0)), "positive": 0.0, "negative": -score}
    return {"label": "நடுநிலை" if lang.lower() in {"tamil", "sinhala"} else "neutral", "label_en": "neutral", "score": 0.5, "positive": 0.0, "negative": 0.0}


def classify_text(text: str, lang: str = "English") -> Dict[str, Any]:
    categories = {
        "Technology": {"software", "ai", "computer", "digital", "system", "application", "data", "technology", "programming"},
        "Business": {"market", "sales", "finance", "profit", "budget", "company", "trade", "business"},
        "Education": {"school", "student", "teacher", "learning", "education", "training", "study"},
        "Health": {"health", "doctor", "medical", "care", "hospital", "patient", "wellness"},
        "General": {"news", "community", "people", "story", "report", "culture"},
    }
    lowered = (text or "").lower()
    probs = {}
    for name, words in categories.items():
        score = sum(1 for w in words if w in lowered)
        probs[name] = score
    if not any(probs.values()):
        probs["General"] = 1
    predicted = max(probs, key=probs.get)
    total = sum(probs.values()) or 1
    return {"predicted_category": predicted, "probabilities": {k: round(v / total, 3) for k, v in probs.items()}} 


def compute_statistics(text: str, token_data: Dict[str, Any]) -> Dict[str, Any]:
    normalized = text or ""
    paragraphs = [p for p in re.split(r"\n\s*\n", normalized.strip()) if p.strip()]
    return {
        "characters": len(normalized),
        "characters_without_spaces": len(re.sub(r"\s+", "", normalized)),
        "tokens": token_data.get("token_count", 0),
        "unique_tokens": token_data.get("unique_tokens", 0),
        "sentences": token_data.get("sentence_count", 0),
        "paragraphs": len(paragraphs),
    }


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