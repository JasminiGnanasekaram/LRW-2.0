# -*- coding: utf-8 -*-
"""
Rule-based Tamil lemmatizer (rebuilt).

Design
------
1. Normalise (NFC, strip zero-width chars, strip punctuation).
2. Protect known base words (stoplist + optional lexicon file).
3. Irregular tables (pronoun case forms, irregular verbs).
4. Verb rules: tense + person endings  (படித்தான் -> படி).
5. Noun rules, applied outermost-first in a single pass:
      clitic  ->  case / postposition  ->  plural
   with sandhi repair (மரத்தை -> மரம், வீட்டை -> வீடு, கிளியை -> கிளி).

This is a heuristic stemmer, not a full morphological analyser. Ambiguous
forms (e.g. வீட்டில் vs பட்டில்) can't be resolved without a lexicon, so
`load_lexicon()` lets you plug in a word list that is always trusted.

Public API
----------
    lemmatize_tamil(word)            -> str
    lemmatize_tamil_detail(word)     -> dict(lemma, method)
    lemmatize_tamil_text(text)       -> list[dict(token, lemma, is_tamil)]
    load_lexicon(path_or_iterable)   -> int (number of words loaded)
"""
import re
import unicodedata
from functools import lru_cache

VIRAMA = "\u0BCD"
VOWEL_SIGNS = frozenset("\u0BBE\u0BBF\u0BC0\u0BC1\u0BC2\u0BC6\u0BC7\u0BC8\u0BCA\u0BCB\u0BCC")
NON_SYLLABLE = VOWEL_SIGNS | {VIRAMA, "\u0BD7"}  # \u0BD7 = au length mark
TAMIL_TOKEN_RE = re.compile(r"[\u0B80-\u0BFF]+")
WORD_RE = re.compile(r"[\u0B80-\u0BFF]+|[A-Za-z0-9\u0D80-\u0DFF]+", re.UNICODE)
ZERO_WIDTH = dict.fromkeys(map(ord, "\u200b\u200c\u200d\u2060\ufeff"), None)

RESTORE = object()                     # marker: re-attach virama / final -u
SONORANTS = "னளரலழணமயவஙஞ"            # stems ending here keep the virama
STOPS = "கசடதபற"                       # stems ending here usually end in -u

# ----------------------------------------------------------------------------
# Lexicon / protected words
# ----------------------------------------------------------------------------
_LEXICON = set()

# Words that look inflected but are base forms.
STOPLIST = {
    "விருந்து", "மருந்து", "பந்து", "சந்து", "முட்டை", "சட்டை", "பட்டை",
    "கட்டை", "அத்தை", "கத்தை", "நிலை", "சாலை", "கடை", "மலை", "சிலை",
    "விலை", "வேலை", "தலை", "இலை", "பூனை", "கிளை", "வளை", "களை", "பனை",
    "கரை", "தரை", "அரை", "கதை", "மக்கள்", "நாங்கள்", "நீங்கள்", "அவர்கள்",
    "இவர்கள்", "எங்கள்", "உங்கள்", "தமிழ்", "இலங்கை", "ஆகும்", "இல்லை",
    "என்ன", "ஏன்", "எப்படி", "பணம்", "மரம்", "வீடு", "நாடு", "காடு",
}


def load_lexicon(source):
    """Load trusted base forms from a file path (one word per line,
    first whitespace-separated column used) or an iterable of words."""
    count = 0
    if isinstance(source, str):
        with open(source, encoding="utf-8") as fh:
            words = (ln.split()[0] for ln in fh if ln.strip() and not ln.startswith("#"))
            for w in words:
                _LEXICON.add(_normalize(w))
                count += 1
    else:
        for w in source:
            _LEXICON.add(_normalize(w))
            count += 1
    lemmatize_tamil.cache_clear()
    return count


# ----------------------------------------------------------------------------
# Irregular forms
# ----------------------------------------------------------------------------
PRONOUN_FORMS = {}


def _add(lemma, forms):
    for f in forms.split():
        PRONOUN_FORMS[f] = lemma


_add("நான்", "என் எனது என்னை எனக்கு என்னிடம் என்னுடைய என்னுடன் என்னால் எனக்காக")
_add("நீ", "உன் உனது உன்னை உனக்கு உன்னிடம் உன்னுடைய உன்னுடன் உன்னால் உனக்காக")
_add("நாம்", "நம் நமது நம்மை நமக்கு நம்மிடம் நம்முடைய நம்முடன் நம்மால்")
_add("நாங்கள்", "எங்கள் எங்களை எங்களுக்கு எங்களிடம் எங்களுடைய எங்களுடன் எங்களால்")
_add("நீங்கள்", "உங்கள் உங்களை உங்களுக்கு உங்களிடம் உங்களுடைய உங்களுடன் உங்களால்")
_add("தான்", "தன் தனது தன்னை தனக்கு தன்னிடம் தன்னுடைய தன்னுடன் தன்னால்")
_add("அது", "அதை அதன் அதற்கு அதில் அதனால் அதனை அதிலிருந்து அதற்காக அதுவும்")
_add("இது", "இதை இதன் இதற்கு இதில் இதனால் இதனை இதிலிருந்து இதற்காக இதுவும்")
_add("எது", "எதை எதன் எதற்கு எதில் எதனால் எதிலிருந்து")
_add("யார்", "யாரை யாருக்கு யாரிடம் யாரின் யாருடைய யாருடன் யாரால்")
_add("அவர்", "அவரை அவருக்கு அவரிடம் அவரின் அவருடைய அவருடன் அவரால் அவரது")
_add("அவன்", "அவனை அவனுக்கு அவனிடம் அவனின் அவனுடைய அவனுடன் அவனால் அவனது")
_add("அவள்", "அவளை அவளுக்கு அவளிடம் அவளின் அவளுடைய அவளுடன் அவளால் அவளது")
_add("அவர்", "அவர்களை அவர்களுக்கு அவர்களிடம் அவர்களின் அவர்களுடைய அவர்களுடன் அவர்களால் அவர்களது அவர்களும்")
_add("இவர்", "இவர்களை இவர்களுக்கு இவர்களிடம் இவர்களின் இவர்களுடைய இவர்களுடன் இவர்களால்")

# prefix -> lemma for irregular verbs. Remainder must be a known ending.
IRREGULAR_VERB_PREFIXES = [
    ("வந்த", "வா"), ("வந்து", "வா"), ("வருகி", "வா"), ("வருவ", "வா"),
    ("வரும்", "வா"), ("வர", "வா"),
    ("சென்ற", "செல்"), ("சென்று", "செல்"), ("செல்கி", "செல்"), ("செல்வ", "செல்"),
    ("போன", "போ"), ("போய்", "போ"), ("போகி", "போ"), ("போவ", "போ"), ("போகும்", "போ"),
    ("கேட்ட", "கேள்"), ("கேட்டு", "கேள்"), ("கேட்கி", "கேள்"), ("கேட்ப", "கேள்"),
    ("கண்ட", "காண்"), ("கண்டு", "காண்"), ("காண்கி", "காண்"), ("காண்ப", "காண்"),
    ("கொண்ட", "கொள்"), ("கொண்டு", "கொள்"), ("கொள்கி", "கொள்"), ("கொள்வ", "கொள்"),
    ("நின்ற", "நில்"), ("நின்று", "நில்"), ("நிற்கி", "நில்"), ("நிற்ப", "நில்"),
    ("தின்ற", "தின்"), ("உண்ட", "உண்"), ("உண்டு", "உண்"),
    ("ஆன", "ஆ"), ("ஆகி", "ஆ"), ("ஆவ", "ஆ"),
]
_PERSON = ["ான்", "ாள்", "ார்", "ார்கள்", "ாய்", "ேன்", "ோம்", "ீர்கள்", "ீர்",
           "து", "ன", "னர்", "", "ற", "றான்", "றாள்", "றார்", "றார்கள்",
           "றாய்", "றேன்", "றோம்", "றது", "றன", "றனர்", "ன்றான்", "ன்றாள்",
           "ன்றார்", "ன்றார்கள்", "ன்றது", "ன்றனர்", "ன்றன"]
_IRREG_ENDINGS = set(_PERSON)


# ----------------------------------------------------------------------------
# Rule construction
# ----------------------------------------------------------------------------
# rule = (suffix, replacement, min_syllables_of_stem, allowed_last_chars_of_stem)
def _R(suffix, repl="", min_syl=2, after=None):
    return (suffix, repl, min_syl, after)


def _sorted(rules):
    return sorted(set(rules), key=lambda r: -len(r[0]))


# ---- verbs -----------------------------------------------------------------
_VERB_PERSON = ["ான்", "ாள்", "ார்", "ார்கள்", "ாய்", "ேன்", "ோம்", "ீர்கள்",
                "ீர்", "து", "ன", "னர்"]
_VERB_RULES = []
# past: base + person
for base, repl in [("த்த", ""), ("ந்த", ""), ("ட்ட", "டு"), ("ற்ற", "று"),
                   ("ின", "ு")]:
    for p in _VERB_PERSON:
        if base == "ின" and p in ("து", "ன", "னர்"):
            continue
        _VERB_RULES.append(_R(base + p, repl, 1))
_VERB_RULES += [_R("ியது", "ு", 1), _R("ின்றது", "ு", 1)]
# present: (க்)கிற / (க்)கின்ற + person
for base in ("க்கிற", "கிற", "க்கின்ற", "கின்ற"):
    for p in _VERB_PERSON:
        _VERB_RULES.append(_R(base + p, "", 1))
# future: ப்ப / வ + person
for p in _VERB_PERSON:
    _VERB_RULES.append(_R("ப்ப" + p, "", 1))
for p in ["ான்", "ாள்", "ார்", "ார்கள்", "ாய்", "ேன்", "ோம்", "ீர்கள்", "து"]:
    _VERB_RULES.append(_R("வ" + p, "", 2))
# participles / infinitive / habitual
_VERB_RULES += [
    _R("க்கும்", "", 1), _R("ய்யும்", "ய்", 1),
    _R("த்து", "", 2), _R("ந்து", "", 2), _R("த்த", "", 2), _R("ந்த", "", 2),
    _R("க்க", "", 2), _R("க்காதே", "", 1),
]
VERB_RULES = _sorted(_VERB_RULES)

# ---- nouns -----------------------------------------------------------------
# Case endings that attach to the oblique (-த்த / -ட்ட / -ற்ற) stem.
_OBLIQUE_CASES = ["ை", "ில்", "ின்", "ால்", "ினால்", "ினை", "ுடன்", "ோடு",
                  "ுக்கு", "ிற்கு", "ிடம்", "ிலிருந்து", "ிடமிருந்து",
                  "ின்மீது", "ுக்குள்", "ிலுள்ள", "ுடைய", "ுக்காக", "ிற்காக",
                  "ிலும்", "ையும்", "ும்"]
_CLITICS = [
    _R("ாவது", RESTORE, 2), _R("தான்", "", 2), _R("ேதான்", "", 2),
    _R("ும்", RESTORE, 2, after="னளரலழணயவ"),
]
_CASE_RULES = []
for obl, repl in [("த்த", "ம்"), ("ட்ட", "டு"), ("ற்ற", "று")]:
    for c in _OBLIQUE_CASES:
        _CASE_RULES.append(_R(obl + c, repl, 1))
_VOWEL_CASES = ["ால்", "ில்", "ின்", "ிடம்", "ிற்கு", "ிலிருந்து", "ிடமிருந்து",
                "ினால்", "ினை", "ிற்காக", "ிலிருந்தும்", "ினுடைய", "ிலுள்ள",
                "ாக", "ிலும்", "ாலும்"]
for c in _VOWEL_CASES:
    _CASE_RULES.append(_R(c, RESTORE, 2))
# endings that only follow sonorant-final stems (அவன், மகள், ஊர்...)
for c in ["ை", "ுக்கு", "ுடன்", "ோடு", "ுடைய", "ுக்காக", "ுக்குள்"]:
    _CASE_RULES.append(_R(c, RESTORE, 2, after="னளரலழண"))
# endings that attach directly to vowel-final / -u stems
_CASE_RULES += [
    _R("க்கு", "", 2), _R("க்காக", "", 2), _R("க்கான", "", 2),
    _R("க்குள்", "", 2),
]
# accusative after vowel-final stems carries a glide: கிளி+ய்+ஐ, பூ+வ்+ஐ
_CASE_RULES += [
    _R("யை", "", 2, after="ிீைு"), _R("வை", "", 2, after="ுூிீை"),
]
CLITIC_RULES = _sorted(_CLITICS)
CASE_RULES = _sorted(_CASE_RULES)
PLURAL_RULES = _sorted([
    _R("ங்கள்", "ம்", 1), _R("ற்கள்", "ல்", 1), _R("ட்கள்", "ள்", 1),
    _R("க்கள்", "", 1), _R("கள்", "", 2),
])


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def _normalize(word):
    word = unicodedata.normalize("NFC", word).translate(ZERO_WIDTH)
    return word.strip(" \t\r\n.,;:!?\"'()[]{}<>-_/\\|“”‘’…")


def _syllables(s):
    return sum(1 for ch in s if ch not in NON_SYLLABLE)


def _restore_char(stem):
    """Pick virama (consonant-final stem) or -u (குற்றியலுகரம் stem)."""
    return "ு" if stem and stem[-1] in STOPS else VIRAMA


def _fix_glide(stem):
    """கிளிய் -> கிளி, சாலைய் -> சாலை, பூவ் -> பூ (glides inserted by sandhi)."""
    if len(stem) >= 3 and stem.endswith("ய்") and stem[-3] in "ைிீுூ":
        return stem[:-2]
    if len(stem) >= 3 and stem.endswith("வ்") and stem[-3] in "ிீுூை":
        return stem[:-2]
    return stem


def _apply(word, rules):
    """Return (new_word, rule) for the first matching rule, else (None, None)."""
    for suffix, repl, min_syl, after in rules:
        if not word.endswith(suffix):
            continue
        stem = word[: len(word) - len(suffix)]
        if _syllables(stem) < min_syl:
            continue
        if after is not None and (not stem or stem[-1] not in after):
            continue
        if repl is RESTORE:
            if suffix[0] in VOWEL_SIGNS:
                stem = stem + _restore_char(stem)
            stem = _fix_glide(stem)
            return stem, suffix
        return stem + repl, suffix
    return None, None


def _is_known(word):
    return word in _LEXICON or word in STOPLIST


def _irregular_verb(word):
    for prefix, lemma in IRREGULAR_VERB_PREFIXES:
        if word.startswith(prefix):
            rest = word[len(prefix):]
            if rest in _IRREG_ENDINGS or rest == "" and prefix not in ("வர",):
                return lemma
            # allow person endings after tense, e.g. வந்தான், சென்றார்கள்
            if any(rest == e for e in _VERB_PERSON):
                return lemma
    return None


# ----------------------------------------------------------------------------
# Public API
# ----------------------------------------------------------------------------
@lru_cache(maxsize=50000)
def lemmatize_tamil(word):
    return lemmatize_tamil_detail(word)["lemma"]


def lemmatize_tamil_detail(word):
    w = _normalize(word)
    if not w or not TAMIL_TOKEN_RE.fullmatch(w):
        return {"lemma": w or word, "method": "non_tamil"}
    if _is_known(w):
        return {"lemma": w, "method": "known_base"}
    if w in PRONOUN_FORMS:
        return {"lemma": PRONOUN_FORMS[w], "method": "pronoun_table"}

    irr = _irregular_verb(w)
    if irr:
        return {"lemma": irr, "method": "irregular_verb"}

    # verbs
    if len(w) >= 4:
        new, rule = _apply(w, VERB_RULES)
        if new and new != w and _syllables(new) >= 1:
            return {"lemma": new, "method": "verb:" + rule}

    # nouns: clitic -> case -> plural (outermost first)
    cur, used = w, []
    for stage, rules in (("clitic", CLITIC_RULES), ("case", CASE_RULES),
                         ("plural", PLURAL_RULES)):
        if _is_known(cur):
            break
        new, rule = _apply(cur, rules)
        if new and new != cur:
            cur = new
            used.append(stage + ":" + rule)
    return {"lemma": cur, "method": ",".join(used) if used else "unchanged"}


def lemmatize_tamil_text(text):
    """Tokenise mixed text; lemmatise only the Tamil tokens."""
    out = []
    for m in WORD_RE.finditer(unicodedata.normalize("NFC", text)):
        tok = m.group(0)
        tamil = bool(TAMIL_TOKEN_RE.fullmatch(tok))
        out.append({"token": tok,
                    "lemma": lemmatize_tamil(tok) if tamil else tok,
                    "is_tamil": tamil})
    return out


if __name__ == "__main__":
    import sys
    for arg in sys.argv[1:]:
        print(arg, "->", lemmatize_tamil_detail(arg))