"""Rule-based lemmatization for English, Tamil, and Sinhala.

Public API:
    lemmatize_english(word, pos=None) -> str
    refine_english_lemma(text, spacy_lemma, pos) -> str
    analyze_tamil_word(word)          -> (pos, tag, lemma, morph)
    analyze_sinhala_word(word)        -> (pos, tag, lemma, morph)

Closed classes and irregular forms come from lexicons. Suffix stripping only fires
when there is real evidence; anything uncertain is returned unchanged. Zero-width
joiners are ignored when matching and preserved in every returned lemma.
"""

import re
import unicodedata
from typing import Dict, List, Optional, Tuple

__all__ = [
    "analyze_sinhala_word",
    "analyze_tamil_word",
    "lemmatize_english",
    "refine_english_lemma",
]

Analysis = Tuple[str, str, str, str]

JOINERS = "\u200c\u200d"
_JOINER_RE = re.compile(f"[{JOINERS}]")
_PUNCT = frozenset(".,!?;:|।॥'\"()[]{}<>-–—/\\@#$%&*+=_~^`…")
_LATIN_RE = re.compile(r"[A-Za-z][A-Za-z0-9'’-]*")
_NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)*")


def _key(word: str) -> str:
    return _JOINER_RE.sub("", unicodedata.normalize("NFC", word))


def _chop(word: str, n: int) -> str:
    i = len(word)
    while n > 0 and i > 0:
        i -= 1
        if word[i] not in JOINERS:
            n -= 1
    return word[:i]


def _is_punct(word: str) -> bool:
    return bool(word) and all(c in _PUNCT for c in word)


def _is_number(word: str) -> bool:
    return bool(_NUMBER_RE.fullmatch(word))


_NON_LEXICAL_POS = frozenset({"PROPN", "NUM", "SYM", "X", "PUNCT", "SPACE"})
_UNINFLECTED_POS = frozenset({"ADV", "ADP", "DET", "CCONJ", "SCONJ", "PART", "INTJ"})


_EN_IRREGULAR_VERBS_SPEC = (
    "be:am,is,are,was,were,been,being; have:has,had,having; do:does,did,done,doing; "
    "go:goes,went,gone,going; say:said; get:got,gotten; make:made; know:knew,known; "
    "think:thought; take:took,taken; see:saw,seen; come:came; give:gave,given; find:found; "
    "tell:told; become:became; leave:left; feel:felt; bring:brought; begin:began,begun; "
    "keep:kept; hold:held; write:wrote,written; stand:stood; hear:heard; mean:meant; "
    "meet:met; run:ran; pay:paid; sit:sat; speak:spoke,spoken; lie:lay,lain; lead:led; "
    "grow:grew,grown; lose:lost; fall:fell,fallen; send:sent; build:built; "
    "understand:understood; draw:drew,drawn; break:broke,broken; spend:spent; "
    "rise:rose,risen; drive:drove,driven; buy:bought; wear:wore,worn; choose:chose,chosen; "
    "seek:sought; throw:threw,thrown; catch:caught; deal:dealt; win:won; "
    "forget:forgot,forgotten; eat:ate,eaten; fly:flew,flown; teach:taught; sell:sold; "
    "show:shown; sing:sang,sung; swim:swam,swum; sleep:slept; stick:stuck; "
    "hang:hung; shake:shook,shaken; steal:stole,stolen; hide:hid,hidden; "
    "lend:lent; bend:bent; wake:woke,woken; ride:rode,ridden; tear:tore,torn; "
    "bear:bore,borne; beat:beaten; bite:bit,bitten; blow:blew,blown; "
    "burn:burnt; dig:dug; feed:fed; fight:fought; forgive:forgave,forgiven; "
    "freeze:froze,frozen; lay:laid; light:lit; shoot:shot; strike:struck; "
    "swear:swore,sworn; undertake:undertook,undertaken; withdraw:withdrew,withdrawn; "
    "overcome:overcame; foresee:foresaw,foreseen; mistake:mistook,mistaken; "
    "outdo:outdid,outdone; rebuild:rebuilt; rewrite:rewrote,rewritten; "
    "retake:retook,retaken; undo:undid,undone; misunderstand:misunderstood"
)

_EN_IRREGULAR_VERBS: Dict[str, str] = {
    form: lemma
    for lemma, forms in (entry.strip().split(":") for entry in _EN_IRREGULAR_VERBS_SPEC.split(";"))
    for form in forms.split(",")
}

_EN_IRREGULAR_NOUNS = {
    "children": "child", "men": "man", "women": "woman", "people": "person",
    "feet": "foot", "teeth": "tooth", "mice": "mouse", "geese": "goose", "lice": "louse",
    "oxen": "ox", "lives": "life", "wives": "wife", "knives": "knife", "leaves": "leaf",
    "wolves": "wolf", "halves": "half", "shelves": "shelf", "selves": "self",
    "thieves": "thief", "loaves": "loaf", "calves": "calf", "analyses": "analysis",
    "crises": "crisis", "theses": "thesis", "hypotheses": "hypothesis",
    "diagnoses": "diagnosis", "parentheses": "parenthesis", "phenomena": "phenomenon",
    "criteria": "criterion", "indices": "index", "matrices": "matrix",
    "vertices": "vertex", "appendices": "appendix", "corpora": "corpus",
    "bacteria": "bacterium", "curricula": "curriculum", "alumni": "alumnus",
    "fungi": "fungus", "cacti": "cactus", "nuclei": "nucleus", "syllabi": "syllabus",
    "stimuli": "stimulus", "quizzes": "quiz", "buses": "bus", "gases": "gas",
    "biases": "bias", "atlases": "atlas", "shoes": "shoe", "toes": "toe",
    "movies": "movie", "cookies": "cookie", "calories": "calorie", "rookies": "rookie",
    "ties": "tie", "pies": "pie", "lies": "lie", "dies": "die", "species": "species",
    "series": "series", "means": "means", "news": "news",
}

_EN_IRREGULAR_ADJ = {
    "better": "good", "best": "good", "worse": "bad", "worst": "bad",
    "further": "far", "furthest": "far", "farther": "far", "farthest": "far",
    "less": "little", "least": "little", "more": "much", "most": "much",
    "elder": "old", "eldest": "old",
}

_EN_PRONOUNS = {
    "me": "I", "i": "I", "us": "we", "him": "he", "them": "they",
    "myself": "myself", "yourself": "yourself", "himself": "himself",
    "herself": "herself", "itself": "itself", "themselves": "themselves",
}

_EN_ADJ_BASES = frozenset((
    "big small large long short tall high low old young new fast slow quick hot cold "
    "warm cool hard soft easy simple happy sad angry busy early late heavy light dark "
    "bright clean clear cheap rich poor strong weak wide narrow thick thin deep shallow "
    "near close safe wise nice fine brave kind proud loud quiet smart sharp smooth rough "
    "tight loose full empty flat fresh sweet sour tiny lucky friendly pretty funny crazy "
    "dirty noisy sunny windy healthy wealthy greedy hungry lazy ugly silly gentle able "
    "noble cruel pure rare brief grave polite severe tame vague white free true blue rude "
    "wild mild grand plain tough calm damp dry wet fat slim mad glad red neat tidy fair "
    "huge mean pale plump sick sore stiff stale steep strict sure tender fit cute dull "
    "dear keen lean bold cozy few"
).split())

_EN_INVARIANT = frozenset((
    "news series species means mathematics physics economics politics statistics "
    "linguistics status bus gas lens bias always perhaps this his has was is does yes "
    "across us plus as its thus pass chaos analysis basis crisis thesis focus corpus "
    "virus campus bonus census genius canvas atlas alias access address business class "
    "process success progress congress express illness kindness glass mass boss loss "
    "cross dress press stress less unless princess witness fitness weakness darkness "
    "happiness sadness goodness madness awareness"
).split())

_EN_ING_NON_VERBS = frozenset((
    "morning evening ceiling spring nothing something anything everything string "
    "during darling"
).split())

_EN_ING_AMBIGUOUS = frozenset((
    "building feeling meaning beginning ending painting drawing wedding clothing "
    "training setting warning opening reading writing heading listing booking parking"
).split())

_EN_EED = frozenset("speed breed bleed proceed succeed exceed indeed greed creed".split())

_EN_E_STEMS = frozenset((
    "chang arrang challeng exchang us caus paus accus refus amus confus excus ignor "
    "restor explor stor scor bor ador adher interfer referr involv solv serv reserv "
    "observ receiv believ achiev leav mov improv approv remov prov driv hav giv liv "
    "lov shav sav wav behav carv curv nam tim lik mak tak writ rat hat lat dat cop "
    "hop tap typ scrap wip grip strip slid hid rid provid decid includ exclud conclud "
    "divid guid"
).split())

_EN_NO_E_STEMS = frozenset((
    "visit limit edit credit exhibit inhibit prohibit benefit profit audit gallop "
    "develop envelop open happen listen offer suffer differ enter answer order cover "
    "discover consider remember wonder gather bother deliver render monitor honor "
    "favor color visitor target market budget focus bias total label model travel "
    "cancel level signal channel panel tunnel format pilot stop shop drop plan ban "
    "beg bar tag log map jam"
).split())

_VOWELS = "aeiou"


def _vowel_groups(s: str) -> int:
    return len(re.findall(r"[aeiouy]+", s))


def _fix_stem(stem: str) -> str:
    """Repair a stem left over after stripping -ing / -ed."""
    if len(stem) < 2 or stem in _EN_NO_E_STEMS:
        return stem
    if stem[-1] == stem[-2] and stem[-1].isalpha() and stem[-1] not in "lszaeiou":
        return stem[:-1]
    needs_e = (
        stem in _EN_E_STEMS
        or stem[-1] in "vz"
        or re.search(r"[^aeiou]c$", stem)
        or re.search(r"[^aeiou][aui]r$", stem)
        or stem.endswith(("rg", "dg", "lg"))
        or (len(stem) > 3 and (re.search(r"[^aeiou]at$", stem) or stem.endswith("is")))
        or (len(stem) == 2 and stem[0] in _VOWELS and stem[1] not in _VOWELS + "wxy")
        or (
            len(stem) <= 4
            and _vowel_groups(stem) == 1
            and re.search(r"[^aeiou][aeiou][^aeiouwxy]$", stem)
        )
    )
    return stem + "e" if needs_e else stem


def _verb_lemma(w: str, pos_known: bool = True) -> str:
    if w in _EN_IRREGULAR_VERBS:
        return _EN_IRREGULAR_VERBS[w]
    if w in {"dying", "lying", "tying", "vying"}:
        return w[:-4] + "ie"
    if w.endswith(("ies", "ied")) and len(w) > 4:
        return w[:-3] + "y"
    if w.endswith("ing") and len(w) > 5:
        if w in _EN_ING_NON_VERBS or (not pos_known and w in _EN_ING_AMBIGUOUS):
            return w
        stem = w[:-3]
        return _fix_stem(stem) if re.search(r"[aeiouy]", stem) else w
    if w.endswith("ed") and len(w) > 4:
        if w.endswith("eed"):
            return w if w in _EN_EED else w[:-1]
        return _fix_stem(w[:-2])
    if w.endswith(("sses", "shes", "ches", "xes", "zzes", "oes")) and len(w) > 4:
        return w[:-2]
    if w.endswith("s") and not w.endswith(("ss", "us", "is")) and len(w) > 3:
        return w[:-1]
    return w


def _noun_lemma(w: str) -> str:
    if w in _EN_IRREGULAR_NOUNS:
        return _EN_IRREGULAR_NOUNS[w]
    if w in _EN_INVARIANT or len(w) <= 3 or not w.endswith("s"):
        return w
    if w.endswith("ies") and len(w) > 4:
        return w[:-3] + "y"
    if w.endswith(("sses", "shes", "ches", "xes", "zzes")):
        return w[:-2]
    if w.endswith("oes") and w not in {"foes", "canoes", "oboes"}:
        return w[:-2]
    if w.endswith(("ss", "us", "is", "ics")):
        return w
    return w[:-1]


def _adjective_lemma(w: str) -> str:
    if w in _EN_IRREGULAR_ADJ:
        return _EN_IRREGULAR_ADJ[w]
    for suffix in ("est", "er"):
        if not w.endswith(suffix) or len(w) < len(suffix) + 3:
            continue
        stem = w[: -len(suffix)]
        candidates = [stem, stem + "e"]
        if stem[-1] == stem[-2]:
            candidates.append(stem[:-1])
        if stem.endswith("i"):
            candidates.append(stem[:-1] + "y")
        for candidate in candidates:
            if candidate in _EN_ADJ_BASES:
                return candidate
    return w


def lemmatize_english(word: str, pos: Optional[str] = None) -> str:
    """Return the base form of an English word.

    `pos` uses Universal POS tags. Without a POS, irregular forms are tried first,
    followed by the most conservative verb/noun suffix rules.
    """
    if not word:
        return word
    if pos in _NON_LEXICAL_POS:
        return word
    if not word.isalpha():
        return word.lower()
    w = word.lower()

    if pos == "PRON" or w in _EN_PRONOUNS:
        return _EN_PRONOUNS.get(w, w)
    if pos in {"VERB", "AUX"}:
        return _verb_lemma(w)
    if pos == "NOUN":
        return _noun_lemma(w)
    if pos == "ADJ":
        return _adjective_lemma(w)
    if pos in _UNINFLECTED_POS:
        return w

    if w in _EN_IRREGULAR_VERBS:
        return _EN_IRREGULAR_VERBS[w]
    if w in _EN_IRREGULAR_NOUNS:
        return _EN_IRREGULAR_NOUNS[w]
    if w in _EN_INVARIANT:
        return w
    if w.endswith(("ing", "ed")) and len(w) > 4:
        return _verb_lemma(w, pos_known=False)
    if w.endswith("s"):
        return _noun_lemma(w)
    return w


def refine_english_lemma(text: str, spacy_lemma: Optional[str], pos: str) -> str:
    """Clean up a spaCy lemma and repair obvious misses."""
    lemma = (spacy_lemma or "").strip()
    if not lemma or lemma == "-PRON-":
        lemma = text
    if pos in _NON_LEXICAL_POS:
        return lemma
    if lemma.lower() == text.lower() and pos in {"NOUN", "VERB", "AUX", "ADJ"} and text.isalpha():
        rule_based = lemmatize_english(text, pos)
        if rule_based != text.lower():
            return rule_based
    return lemma if lemma == "I" else lemma.lower()


def _latin_token(word: str) -> Analysis:
    """Latin-script token inside a Tamil or Sinhala sentence."""
    if word[0].isupper():
        return ("X" if word.isupper() else "PROPN", "X", word, "")
    return ("NOUN", "NOUN", lemmatize_english(word, "NOUN"), "")


_TA_CONS = frozenset(chr(c) for c in range(0x0B95, 0x0BBA))
_TA_SIGNS = frozenset("ாிீுூெேைொோௌ")
_TA_VOWELS = frozenset(chr(c) for c in range(0x0B85, 0x0B95))
_PULLI = "\u0bcd"
_SONORANTS = frozenset("மனணலளரழ")
_GLIDES = frozenset("யவ")


def _ta_syllables(s: str) -> int:
    count = 0
    for i, ch in enumerate(s):
        if ch in _TA_VOWELS:
            count += 1
        elif ch in _TA_CONS and (i + 1 == len(s) or s[i + 1] != _PULLI):
            count += 1
    return count


def _ta_bare_candidates(stem: str) -> List[Tuple[str, str]]:
    """Possible lemmas for a stem ending in a bare consonant, as (lemma, evidence)."""
    if len(stem) < 2 or stem[-1] not in _TA_CONS:
        return []
    last, head = stem[-1], stem[:-1]

    if stem.endswith("த்த") and len(stem) > 3:
        return [(stem[:-3] + "ம்", "gem")]
    for geminate, single, cluster in (("ட்ட", "டு", "ட்டு"), ("ற்ற", "று", "ற்று")):
        if stem.endswith(geminate) and len(stem) > 3:
            pre = stem[:-3]
            options = [(pre + single, "gem"), (pre + cluster, "gem")]
            return options if _ta_syllables(pre) <= 1 else options[::-1]

    if last in _GLIDES and head and head[-1] != _PULLI and head[-1] not in _TA_CONS:
        alternative = stem + "ு" if last == "வ" else head + "ய்"
        return [(head, "glide"), (alternative, "glide-alt")]
    if last in _SONORANTS:
        return [(stem + _PULLI, "son")]
    return [(stem + "ு", "stop")]


def _ta_plural_lemmas(stem: str) -> List[str]:
    """Singular candidates for a plural stem with 'கள்' removed."""
    if stem.endswith("ங்"):
        return [stem[:-2] + "ம்"]
    if stem.endswith("க்") and len(stem) >= 3 and (stem[-3] in _TA_SIGNS or stem[-3] in _TA_VOWELS):
        return [stem[:-2], stem]
    return [stem]


_TA_NOUNS = (
    "மரம் வீடு நாடு காடு ஆறு காற்று பூ பழம் புத்தகம் பள்ளி பள்ளிக்கூடம் கல்லூரி "
    "பல்கலைக்கழகம் மாணவன் மாணவி மாணவர் ஆசிரியர் ஆசிரியை மனிதன் மனிதர் மனம் உடல் "
    "ஆரோக்கியம் கவனம் நேரம் வாழ்க்கை வேலை வழி மொழி சொல் வார்த்தை ஆவணம் கோப்பு "
    "தரவு தகவல் தொகுப்பு பணியிடம் இடம் ஊர் நகரம் கிராமம் அரசு அரசாங்கம் தேர்தல் "
    "கட்சி சட்டம் நீதிமன்றம் வழக்கு பொருளாதாரம் வணிகம் சந்தை வங்கி நிறுவனம் கல்வி "
    "அறிவியல் ஆராய்ச்சி தொழில்நுட்பம் கணினி இணையம் மென்பொருள் செயலி விளையாட்டு "
    "போட்டி அணி வீரர் திரைப்படம் இசை பாடல் கலை நூல் கதை கட்டுரை செய்தி பத்திரிகை "
    "மக்கள் குழந்தை பெண் ஆண் தாய் தந்தை அம்மா அப்பா நண்பன் நண்பர் கடவுள் உலகம் "
    "நாள் வாரம் மாதம் ஆண்டு வருடம் காலை மாலை இரவு பணம் விலை கடை பேருந்து வாகனம் "
    "தண்ணீர் உணவு மருத்துவர் மருத்துவமனை நோய் மருந்து சிகிச்சை பாதை சாலை கடல் மலை "
    "வானம் நிலம் மண் கண் கை கால் தலை முகம் பாடம் தேர்வு கேள்வி பதில் பிரச்சனை "
    "தீர்வு முயற்சி வெற்றி தோல்வி மகிழ்ச்சி உரிமை உரிமம் சேவை திட்டம் அறிக்கை "
    "முடிவு தேவை பயன் பயன்பாடு விரைவு தெளிவு சிறப்பு கடினம் சுலபம் சாத்தியம் "
    "அவசியம் உயரம் பொருள் அர்த்தம் மகன் மகள் கதவு பாட்டு பதிவு பகுப்பாய்வு "
    "வகை மாதிரி அமைப்பு செயல் செயல்முறை பங்கு அனுமதி பயனர் கணக்கு கடவுச்சொல் "
    "மின்னஞ்சல் முகவரி படம் ஒலி உரை எழுத்து வாக்கியம் சொற்றொடர் அகராதி மனிதநேயம் "
    "அரசியல் பொறுப்பு நம்பிக்கை எதிர்காலம் நிகழ்காலம் கடந்தகாலம் ஆய்வு ஆய்வாளர் "
    "தாய்மொழி தமிழ் சிங்களம் ஆங்கிலம் இலங்கை இந்தியா"
).split()

_TA_NOUN_LEX: Dict[str, str] = {_key(w): w for w in _TA_NOUNS}

_TA_VERB_LEMMAS_EXTRA = {
    "இல்லை": ("இல்லை", "Polarity=Neg"),
    "உள்ளது": ("உள்", "Tense=Pres|Gender=Neut|Number=Sing|Person=3"),
    "உள்ளன": ("உள்", "Tense=Pres|Gender=Neut|Number=Plur|Person=3"),
    "வேண்டும்": ("வேண்டு", "Mood=Des"),
    "முடியாது": ("முடி", "Mood=Pot|Polarity=Neg"),
    "கூடாது": ("கூடு", "Mood=Proh|Polarity=Neg"),
    "வேண்டாம்": ("வேண்டு", "Mood=Des|Polarity=Neg"),
}

_TA_PRON_SPEC = {
    "நான்": ("Person=1|Number=Sing", "என் என்னை எனக்கு எனக்காக என்னால் என்னுடன் என்னுடைய என்னில் என்னிடம் என்னிடமிருந்து எனது என்னோடு"),
    "நாம்": ("Person=1|Number=Plur", "நம் நம்மை நமக்கு நமக்காக நம்மால் நம்முடன் நம்முடைய நம்மில் நம்மிடம் நமது"),
    "நாங்கள்": ("Person=1|Number=Plur", "எங்கள் எங்களை எங்களுக்கு எங்களுக்காக எங்களால் எங்களுடன் எங்களுடைய எங்களில் எங்களிடம் எங்களது"),
    "நீ": ("Person=2|Number=Sing", "உன் உன்னை உனக்கு உனக்காக உன்னால் உன்னுடன் உன்னுடைய உன்னில் உன்னிடம் உனது உன்னோடு"),
    "நீங்கள்": ("Person=2|Number=Plur", "உங்கள் உங்களை உங்களுக்கு உங்களுக்காக உங்களால் உங்களுடன் உங்களுடைய உங்களில் உங்களிடம் உங்களது"),
    "அவன்": ("Person=3|Gender=Masc|Number=Sing", "அவனை அவனுக்கு அவனுக்காக அவனால் அவனுடன் அவனுடைய அவனிடம் அவனது அவனோடு"),
    "அவள்": ("Person=3|Gender=Fem|Number=Sing", "அவளை அவளுக்கு அவளுக்காக அவளால் அவளுடன் அவளுடைய அவளிடம் அவளது அவளோடு"),
    "அவர்": ("Person=3|Number=Sing|Polite=Yes", "அவரை அவருக்கு அவருக்காக அவரால் அவருடன் அவருடைய அவரிடம் அவரது அவரோடு"),
    "அவர்கள்": ("Person=3|Number=Plur", "அவர்களை அவர்களுக்கு அவர்களுக்காக அவர்களால் அவர்களுடன் அவர்களுடைய அவர்களிடம் அவர்களது அவர்களின் அவர்களில் அவர்களோடு"),
    "இவன்": ("Person=3|Gender=Masc|Number=Sing", "இவனை இவனுக்கு இவனால் இவனுடன் இவனுடைய இவனிடம் இவனது"),
    "இவள்": ("Person=3|Gender=Fem|Number=Sing", "இவளை இவளுக்கு இவளால் இவளுடன் இவளுடைய இவளிடம் இவளது"),
    "இவர்": ("Person=3|Number=Sing|Polite=Yes", "இவரை இவருக்கு இவரால் இவருடன் இவருடைய இவரிடம் இவரது"),
    "இவர்கள்": ("Person=3|Number=Plur", "இவர்களை இவர்களுக்கு இவர்களால் இவர்களுடன் இவர்களுடைய இவர்களிடம் இவர்களது"),
    "அது": ("Person=3|Gender=Neut|Number=Sing", "அதை அதனை அதற்கு அதற்காக அதனால் அதனுடன் அதன் அதில் அதனில் அதனிடம் அதனுடைய அதனோடு"),
    "இது": ("Person=3|Gender=Neut|Number=Sing", "இதை இதனை இதற்கு இதற்காக இதனால் இதனுடன் இதன் இதில் இதனில் இதனிடம் இதனுடைய"),
    "அவை": ("Person=3|Gender=Neut|Number=Plur", "அவற்றை அவற்றுக்கு அவற்றால் அவற்றின் அவற்றில் அவற்றுடன்"),
    "இவை": ("Person=3|Gender=Neut|Number=Plur", "இவற்றை இவற்றுக்கு இவற்றால் இவற்றின் இவற்றில் இவற்றுடன்"),
    "யார்": ("PronType=Int", "யாரை யாருக்கு யாரால் யாருடன் யாருடைய யாரிடம்"),
    "எது": ("PronType=Int", "எதை எதற்கு எதனால் எதில் எதன்"),
    "என்ன": ("PronType=Int", ""),
    "தான்": ("PronType=Prs|Reflex=Yes", "தன் தன்னை தனக்கு தன்னால் தன்னுடன்"),
    "தாம்": ("PronType=Prs|Reflex=Yes", "தம் தம்மை தமக்கு தம்மால் தம்முடன்"),
}

_TA_CONJUNCTIONS = "மற்றும் ஆனால் அல்லது எனவே ஆகையால் ஆயினும் மேலும் எனினும் ஆனாலும் ஆகவே என்று".split()
_TA_POSTPOSITIONS = (
    "குறித்து பற்றி பொழுது போது வரை பின் முன் உள் வெளியே மேல் கீழ் இடையே நடுவில் "
    "சார்பாக உடன் பிறகு முன்பு பின்னர் முன்னர் வரையில் மூலம் காரணமாக"
).split()
_TA_ADVERBS = (
    "மிகவும் மிக இன்னும் இங்கே அங்கே இப்போது அப்போது எப்போது எப்படி எங்கே ஏன் மீண்டும் "
    "உடனே மட்டும் கூட தான் எப்பொழுதும் எப்போதும் இன்று நேற்று நாளை"
).split()
_TA_DETERMINERS = "ஒரு இந்த அந்த எந்த இத்தகைய அத்தகைய".split()
_TA_ADJECTIVES = "நல்ல பெரிய சிறிய புதிய பழைய பெரும் சிறு அழகிய முக்கிய மிகுந்த".split()
_TA_NUMBERS = "ஒன்று இரண்டு மூன்று நான்கு ஐந்து ஏழு எட்டு ஒன்பது பத்து நூறு ஆயிரம் லட்சம்".split()

_TA_VERB_CLASSES = {
    "U": lambda r: dict(past=[r[:-1] + "ின"], pres=[r + "கிற"], fut=[r + "வ"], inf=[r[:-1]], rel=[r + "ம்"]),
    "T": lambda r: dict(past=[r + "த்த"], pres=[r + "க்கிற"], fut=[r + "ப்ப"], inf=[r + "க்க"], rel=[r + "க்கும்"]),
    "I": lambda r: dict(past=[r + "த்த"], pres=[r + "க்கிற"], fut=[r + "ப்ப"], inf=[r + "க்க"], rel=[r + "க்கும்"]),
    "S": lambda r: dict(past=[r + "த்த"], pres=[r + "க்கிற"], fut=[r + "ப்ப"], inf=[r + "க்க"], rel=[r + "க்கும்"]),
    "W": lambda r: dict(past=[r + "த"], pres=[r + "கிற"], fut=[r + "வ"], inf=[r + "ய"], rel=[r + "யும்"]),
    "N": lambda r: dict(past=[r + "ந்த"], pres=[r + "கிற"], fut=[r + "வ"], inf=[r[:-1]], rel=[r[:-1] + "ும்"]),
    "Ni": lambda r: dict(past=[r + "ந்த"], pres=[r + "கிற"], fut=[r + "வ"], inf=[r + "ய"], rel=[r + "யும்"]),
    "A": lambda r: dict(past=[r + "ந்த"], pres=[r + "க்கிற"], fut=[r + "ப்ப"], inf=[r + "க்க"], rel=[r + "க்கும்"]),
}

_TA_REGULAR_VERBS = {
    "U": "எழுது பாடு ஓடு பேசு தேடு மாற்று முன்னேறு உருவாக்கு பயன்படுத்து வலுப்படுத்து "
         "பதிவேற்று பதிவிறக்கு வகைப்படுத்து நீக்கு கூறு அனுப்பு மூடு ஏற்று ஏறு",
    "T": "கொடு எடு தேர்ந்தெடு",
    "I": "படி தெரிவி சேமி சேகரி இணை வை அறிவி",
    "S": "பார் சரிபார்",
    "W": "செய்",
    "N": "வாழ் சேர் பகிர் ஆராய்",
    "Ni": "அறி புரி தெரி முடி",
    "A": "நட மற இரு திற",
}

_TA_IRREGULAR_VERBS = {
    "வா": dict(past=["வந்த"], pres=["வருகிற", "வருகின்ற"], fut=["வருவ"], inf=["வர"], rel=["வரும்"], extra={"வந்து": "VerbForm=Part|Aspect=Perf", "வாருங்கள்": "Mood=Imp|Number=Plur|Person=2|Polite=Yes"}),
    "போ": dict(past=["போன"], pres=["போகிற", "போகின்ற"], fut=["போவ"], inf=["போக"], rel=["போகும்"], extra={"போய்": "VerbForm=Part|Aspect=Perf", "போங்கள்": "Mood=Imp|Number=Plur|Person=2|Polite=Yes"}),
    "தா": dict(past=["தந்த"], pres=["தருகிற"], fut=["தருவ"], inf=["தர"], rel=["தரும்"], extra={"தந்து": "VerbForm=Part|Aspect=Perf"}),
    "பெறு": dict(past=["பெற்ற"], pres=["பெறுகிற"], fut=["பெறுவ"], inf=["பெற"], rel=["பெறும்"]),
    "ஆகு": dict(past=["ஆன"], pres=["ஆகிற"], fut=["ஆவ"], inf=["ஆக"], rel=["ஆகும்"], extra={"ஆகி": "VerbForm=Part|Aspect=Perf"}),
    "செல்": dict(past=["சென்ற"], pres=["செல்கிற"], fut=["செல்வ"], inf=["செல்ல"], rel=["செல்லும்"]),
    "நில்": dict(past=["நின்ற"], pres=["நிற்கிற"], fut=["நிற்ப"], inf=["நிற்க"], rel=["நிற்கும்"]),
    "சொல்": dict(past=["சொன்ன"], pres=["சொல்கிற"], fut=["சொல்வ"], inf=["சொல்ல"], rel=["சொல்லும்"]),
    "காண்": dict(past=["கண்ட"], pres=["காண்கிற"], fut=["காண்ப"], inf=["காண"], rel=["காணும்"]),
    "கொள்": dict(past=["கொண்ட"], pres=["கொள்கிற"], fut=["கொள்வ"], inf=["கொள்ள"], rel=["கொள்ளும்"]),
    "கேள்": dict(past=["கேட்ட"], pres=["கேட்கிற"], fut=["கேட்ப"], inf=["கேட்க"], rel=["கேட்கும்"]),
    "உண்": dict(past=["உண்ட"], pres=["உண்கிற"], fut=["உண்ப"], inf=["உண்ண"], rel=["உண்ணும்"]),
    "விடு": dict(past=["விட்ட"], pres=["விடுகிற"], fut=["விடுவ"], inf=["விட"], rel=["விடும்"]),
    "சாப்பிடு": dict(past=["சாப்பிட்ட"], pres=["சாப்பிடுகிற"], fut=["சாப்பிடுவ"], inf=["சாப்பிட"], rel=["சாப்பிடும்"]),
    "கல்": dict(past=["கற்ற"], pres=["கற்கிற"], fut=["கற்ப"], inf=["கற்க"], rel=["கற்கும்"]),
}

_TA_PNG = sorted(
    [
        ("ார்கள்", "Number=Plur|Person=3"),
        ("ீர்கள்", "Number=Plur|Person=2|Polite=Yes"),
        ("ான்", "Gender=Masc|Number=Sing|Person=3"),
        ("ாள்", "Gender=Fem|Number=Sing|Person=3"),
        ("ார்", "Number=Sing|Person=3|Polite=Yes"),
        ("னர்", "Number=Plur|Person=3"),
        ("ேன்", "Number=Sing|Person=1"),
        ("ோம்", "Number=Plur|Person=1"),
        ("ாய்", "Number=Sing|Person=2"),
        ("ீர்", "Number=Sing|Person=2|Polite=Yes"),
        ("து", "Gender=Neut|Number=Sing|Person=3"),
        ("ன", "Gender=Neut|Number=Plur|Person=3"),
    ],
    key=lambda item: -len(item[0]),
)
_TA_HUMAN_PNG = frozenset({"ார்கள்", "ீர்கள்", "ான்", "ாள்", "ார்", "னர்", "ேன்", "ோம்", "ாய்", "ீர்"})

_TA_MARKERS = [
    ("க்கின்ற", "plain", "Pres"), ("ுகின்ற", "u", "Pres"), ("கின்ற", "plain", "Pres"),
    ("க்கிற", "plain", "Pres"), ("ுகிற", "u", "Pres"), ("கிற", "plain", "Pres"),
    ("த்த", "plain", "Past"), ("ந்த", "plain", "Past"), ("ட்ட", "ttu", "Past"),
    ("ற்ற", "ru", "Past"), ("ின", "u", "Past"), ("ப்ப", "plain", "Fut"), ("ுவ", "u", "Fut"),
]
_TA_MARKER_ROOTS = {
    "plain": lambda base: base,
    "u": lambda base: base + "ு",
    "ttu": lambda base: base + "டு",
    "ru": lambda base: base + "று",
}

_TA_CASES = sorted(
    [
        ("ிலிருந்து", "Case=Abl", "L"), ("ிடமிருந்து", "Case=Abl", "L"),
        ("க்காக", "Case=Ben", "L"), ("ற்காக", "Case=Ben", "L"),
        ("ுடைய", "Case=Gen", "L"), ("ினுடைய", "Case=Gen", "L"), ("ினது", "Case=Gen", "L"),
        ("ினால்", "Case=Ins", "L"), ("ுடன்", "Case=Com", "L"), ("ோடு", "Case=Com", "L"),
        ("ிடம்", "Case=Loc", "L"), ("ிற்கு", "Case=Dat", "L"), ("ினை", "Case=Acc", "L"),
        ("ால்", "Case=Ins", "S"), ("ற்கு", "Case=Dat", "S"), ("க்கு", "Case=Dat", "S"),
        ("ை", "Case=Acc", "S"), ("ின்", "Case=Gen", "S"), ("ில்", "Case=Loc", "S"),
    ],
    key=lambda item: -len(item[0]),
)

_TA_ADJ_SUFFIXES = [("மான", "L"), ("ான", "S")]
_TA_ADV_SUFFIXES = [("மாக", "L"), ("ாக", "S")]


def _build_tamil_pronoun_tables() -> Tuple[Dict[str, Tuple[str, str]], Dict[str, str]]:
    forms: Dict[str, Tuple[str, str]] = {}
    lemmas: Dict[str, str] = {}
    for lemma, (feat, variants) in _TA_PRON_SPEC.items():
        lemmas[_key(lemma)] = feat
        for form in variants.split():
            forms[_key(form)] = (lemma, feat)
    return forms, lemmas


def _build_tamil_verb_tables():
    specs: Dict[str, dict] = {}
    for cls, roots in _TA_REGULAR_VERBS.items():
        for root in roots.split():
            specs[_key(root)] = _TA_VERB_CLASSES[cls](_key(root))
    for root, spec in _TA_IRREGULAR_VERBS.items():
        specs[_key(root)] = {
            name: [_key(x) for x in value] if isinstance(value, list) else value
            for name, value in spec.items()
        }

    tensed: Dict[str, Tuple[str, str]] = {}
    exact: Dict[str, Tuple[str, str]] = {}
    infinitives: Dict[str, str] = {}

    for root, spec in specs.items():
        pres = list(spec["pres"])
        pres += [p[:-3] + "கின்ற" for p in spec["pres"] if p.endswith("கிற")]

        for tag, stems in (("Past", spec["past"]), ("Pres", pres), ("Fut", spec["fut"])):
            for stem in stems:
                tensed[stem] = (root, tag)

        for past in spec["past"]:
            exact[past] = (root, "VerbForm=Part|Tense=Past")
            if past.endswith("ின"):
                exact[past[:-1] + "ய"] = (root, "VerbForm=Part|Tense=Past")
                exact[past[:-1]] = (root, "VerbForm=Part|Aspect=Perf")
            else:
                exact[past + "ு"] = (root, "VerbForm=Part|Aspect=Perf")
        for stem in pres:
            exact[stem] = (root, "VerbForm=Part|Tense=Pres")
        for inf in spec["inf"]:
            infinitives[inf] = root
            exact[inf] = (root, "VerbForm=Inf")
        for rel in spec["rel"]:
            exact[rel] = (root, "Tense=Fut|VerbForm=Part")
        for form, feat in spec.get("extra", {}).items():
            exact[_key(form)] = (root, feat)

    for form, entry in _TA_VERB_LEMMAS_EXTRA.items():
        exact[_key(form)] = entry

    return frozenset(specs), tensed, exact, infinitives


def _build_tamil_closed_forms() -> Dict[str, Analysis]:
    groups = (
        (_TA_CONJUNCTIONS, "CONJ", "CCONJ", ""),
        (_TA_POSTPOSITIONS, "ADP", "POSTP", ""),
        (_TA_ADVERBS, "ADV", "ADV", ""),
        (_TA_DETERMINERS, "DET", "DET", ""),
        (_TA_ADJECTIVES, "ADJ", "ADJ", ""),
        (_TA_NUMBERS, "NUM", "NUM", "NumType=Card"),
    )
    return {
        _key(w): (pos, tag, w, morph)
        for words, pos, tag, morph in groups
        for w in words
    }


_TA_PRON_FORMS, _TA_PRON_LEMMAS = _build_tamil_pronoun_tables()
_TA_VERB_ROOTS, _TA_TENSED, _TA_VERB_EXACT, _TA_INF = _build_tamil_verb_tables()
_TA_CLOSED_FORMS = _build_tamil_closed_forms()


def _ta_root_from_bare(stem: str) -> List[str]:
    """Verb-root candidates from a stem whose tense/mood suffix has been removed."""
    out: List[str] = []
    if stem.endswith(("க்க", "ப்ப")):
        out.append(stem[:-3])
    if stem.endswith("ய") and len(stem) > 2:
        out.append(stem[:-1])
    if stem and stem[-1] in _TA_CONS:
        out.append(stem + _PULLI)
        out.append(stem + "ு")
    out.append(stem)
    return out


def _ta_verb(key: str) -> Optional[Tuple[str, str]]:
    """Return (root, morph) for a verb form, or None."""
    if key in _TA_VERB_EXACT:
        return _TA_VERB_EXACT[key]

    for png, png_feat in _TA_PNG:
        if key.endswith(png) and len(key) > len(png) + 1:
            hit = _TA_TENSED.get(key[: -len(png)])
            if hit:
                return hit[0], f"Tense={hit[1]}|{png_feat}"

    for suffix, feat in (
        ("வில்லை", "Tense=Past|Polarity=Neg"),
        ("க்கூடாது", "Mood=Proh|Polarity=Neg"),
        ("லாம்", "Mood=Pot"),
    ):
        if key.endswith(suffix):
            root = _TA_INF.get(key[: -len(suffix)])
            if root:
                return root, feat

    for suffix, feat in (
        ("ாதீர்கள்", "Mood=Imp|Polarity=Neg|Number=Plur|Person=2|Polite=Yes"),
        ("ாதீர்", "Mood=Imp|Polarity=Neg|Number=Sing|Person=2|Polite=Yes"),
        ("ாதே", "Mood=Imp|Polarity=Neg|Number=Sing|Person=2"),
        ("ாமல்", "VerbForm=Part|Polarity=Neg"),
        ("ுங்கள்", "Mood=Imp|Number=Plur|Person=2|Polite=Yes"),
    ):
        if key.endswith(suffix) and len(key) > len(suffix) + 1:
            for candidate in _ta_root_from_bare(key[: -len(suffix)]):
                if candidate in _TA_VERB_ROOTS:
                    return candidate, feat

    idx = key.find("கொண்டிரு")
    if idx > 1:
        head = key[:idx]
        if head.endswith("க்"):
            head = head[:-2]
        for form in (head, head + "ு"):
            hit = _TA_VERB_EXACT.get(form)
            if hit and hit[1].startswith("VerbForm=Part|Aspect=Perf"):
                return hit[0], "Aspect=Prog"

    for png, png_feat in _TA_PNG:
        if not key.endswith(png) or len(key) <= len(png) + 2:
            continue
        stem = key[: -len(png)]
        for marker, kind, tense in _TA_MARKERS:
            if not stem.endswith(marker) or len(stem) <= len(marker) + 1:
                continue
            if tense == "Fut" and png not in _TA_HUMAN_PNG:
                continue
            if tense == "Fut" and png in ("து", "ன"):
                continue
            root = _TA_MARKER_ROOTS[kind](stem[: -len(marker)])
            return root, f"Tense={tense}|{png_feat}"
    return None


def _ta_noun_candidates(key: str, allow_clitic: bool = True) -> List[Tuple[str, str, int]]:
    """Return (lemma, morph, score) candidates for a noun-like word."""
    results: List[Tuple[str, str, int]] = []

    def lex_bonus(lemma: str) -> int:
        k = _key(lemma)
        return 3 if (k in _TA_NOUN_LEX or k in _TA_PRON_LEMMAS) else 0

    def add(lemma: str, feats: List[str], base_score: int) -> None:
        results.append((lemma, "|".join(f for f in feats if f), base_score + lex_bonus(lemma)))

    def from_bare(bare: str, feats: List[str], base_score: int) -> None:
        if bare.endswith("கள") and len(bare) > 3:
            for lemma in _ta_plural_lemmas(bare[:-2]):
                add(lemma, feats + ["Number=Plur"], base_score + 2)
        for lemma, evidence in _ta_bare_candidates(bare):
            add(lemma, feats, base_score + (1 if evidence in ("gem", "glide") else 0))

    if key.endswith("கள்") and len(key) > 4:
        for lemma in _ta_plural_lemmas(key[:-3]):
            add(lemma, ["Number=Plur"], 2)

    for suffix, feat, strength in _TA_CASES:
        if not key.endswith(suffix) or len(key) <= len(suffix) + 1:
            continue
        stem = key[: -len(suffix)]
        strength_score = 2 if strength == "L" else 1
        if stem[-1] == "ு":
            from_bare(stem[:-1], [feat], strength_score)
            add(stem, [feat], strength_score - 1)
        elif stem[-1] in _TA_CONS:
            from_bare(stem, [feat], strength_score)
        else:
            add(stem, [feat], strength_score - 1)

    if allow_clitic and key.endswith("ும்") and len(key) > 4:
        bare = key[:-3]
        for inner, _evidence in _ta_bare_candidates(bare):
            for lemma, morph, score in _ta_noun_candidates(inner, allow_clitic=False):
                results.append((lemma, morph, score + 1))
            add(inner, [], 0)
    return results


def _ta_best(candidates: List[Tuple[str, str, int]], threshold: int = 2) -> Optional[Tuple[str, str, int]]:
    best = max(candidates, key=lambda c: c[2], default=None)
    return best if best and best[2] >= threshold else None


def _ta_pos_for(lemma: str) -> str:
    return "PRON" if _key(lemma) in _TA_PRON_LEMMAS else "NOUN"


def _ta_derived(key: str, suffixes: List[Tuple[str, str]], pos: str) -> Optional[Analysis]:
    """Adjective (…ான) and adverb (…ாக) derivation back to the base noun."""
    for suffix, strength in suffixes:
        if not key.endswith(suffix) or len(key) <= len(suffix) + 1:
            continue
        stem = key[: -len(suffix)]
        if not suffix.startswith("ா"):
            stem += suffix[0]
        for lemma, evidence in _ta_bare_candidates(stem):
            if evidence == "glide":
                continue
            if (strength == "S" or evidence == "glide-alt") and _key(lemma) not in _TA_NOUN_LEX:
                continue
            return (pos, pos, lemma, "")
    return None


def analyze_tamil_word(word: str) -> Analysis:
    """Return (pos, tag, lemma, morph) for a Tamil token."""
    if not word or _is_punct(word):
        return ("PUNCT", "PUNCT", word, "")
    if _is_number(word):
        return ("NUM", "NUM", word, "NumType=Card")
    if _LATIN_RE.fullmatch(word):
        return _latin_token(word)

    key = _key(word)

    if key in _TA_CLOSED_FORMS:
        return _TA_CLOSED_FORMS[key]
    if key in _TA_PRON_LEMMAS:
        return ("PRON", "PRON", word, _TA_PRON_LEMMAS[key])
    if key in _TA_PRON_FORMS:
        lemma, feat = _TA_PRON_FORMS[key]
        return ("PRON", "PRON", lemma, feat)
    if key in _TA_NOUN_LEX:
        return ("NOUN", "NOUN", _TA_NOUN_LEX[key], "Case=Nom|Number=Sing")

    verb = _ta_verb(key)
    if verb:
        return ("VERB", "VERB", verb[0], verb[1])
    if key in _TA_VERB_ROOTS:
        return ("VERB", "VERB", key, "Mood=Imp|Number=Sing|Person=2")

    for suffix, morph in (
        ("ாகும்", "Tense=Fut|VerbForm=Part"),
        ("ாகிறது", "Tense=Pres|Gender=Neut|Number=Sing|Person=3"),
    ):
        if key.endswith(suffix) and len(key) > len(suffix) + 2:
            return ("VERB", "VERB", "ஆகு", morph)

    best = _ta_best(_ta_noun_candidates(key))
    if best:
        lemma, morph, _score = best
        pos = _ta_pos_for(lemma)
        return (pos, pos, lemma, morph or "Case=Nom|Number=Sing")

    derived = _ta_derived(key, _TA_ADJ_SUFFIXES, "ADJ") or _ta_derived(key, _TA_ADV_SUFFIXES, "ADV")
    if derived:
        return derived

    return ("NOUN", "NOUN", word, "Case=Nom|Number=Sing")


_SI_PRONOUNS = {
    "මම": "Case=Nom|Number=Sing|Person=1", "අපි": "Case=Nom|Number=Plur|Person=1",
    "ඔයා": "Case=Nom|Number=Sing|Person=2", "ඔබ": "Case=Nom|Number=Sing|Person=2|Polite=Yes",
    "ඔහු": "Case=Nom|Gender=Masc|Number=Sing|Person=3", "ඇය": "Case=Nom|Gender=Fem|Number=Sing|Person=3",
    "එයා": "Case=Nom|Number=Sing|Person=3", "එය": "Case=Nom|Gender=Neut|Number=Sing|Person=3",
    "ඔවුන්": "Case=Nom|Number=Plur|Person=3", "මෙය": "PronType=Dem|Number=Sing",
    "මේවා": "PronType=Dem|Number=Plur", "කවුද": "PronType=Int", "මොකක්ද": "PronType=Int",
    "කුමක්ද": "PronType=Int",
}
_SI_PRONOUN_FORMS = {
    "මට": "මම", "මගේ": "මම", "මාව": "මම", "මා": "මම", "මගෙන්": "මම",
    "අපට": "අපි", "අපේ": "අපි", "අපව": "අපි", "අපෙන්": "අපි",
    "ඔබට": "ඔබ", "ඔබේ": "ඔබ", "ඔබව": "ඔබ", "ඔබෙන්": "ඔබ",
    "ඔයාට": "ඔයා", "ඔයාගේ": "ඔයා", "ඔහුට": "ඔහු", "ඔහුගේ": "ඔහු", "ඔහුව": "ඔහු",
    "ඇයට": "ඇය", "ඇයගේ": "ඇය", "ඇයව": "ඇය", "එයට": "එය", "එයින්": "එය", "එහි": "එය",
    "ඔවුන්ට": "ඔවුන්", "ඔවුන්ගේ": "ඔවුන්", "ඔවුන්ව": "ඔවුන්", "මෙයට": "මෙය", "මෙයින්": "මෙය",
}
_SI_CONJUNCTIONS = "සහ හා නමුත් එහෙත් නැතහොත් හෝ එබැවින් එමනිසා නිසා නම් විට පසු මෙන් සේ".split()
_SI_POSTPOSITIONS = "ගැන පිළිබඳ සඳහා වෙනුවෙන් මත තුළ යට අතර ළඟ සමඟ සහිත කෙරෙහි වෙත දක්වා".split()
_SI_ADJECTIVES = (
    "හොඳ නරක ලස්සන අලුත් පරණ ලොකු කුඩා මහත් ප්\u200dරධාන විශේෂ වැදගත් ජාතික "
    "ජාත්\u200dයන්තර රාජ්\u200dය පෞද්ගලික නව උසස් දුප්පත් පොහොසත් ශක්තිමත්"
).split()
_SI_ADVERBS = (
    "ඉක්මනින් හොඳින් සෙමින් නිතරම කවදාවත් පමණක් නැවත දැන් පසුව එතැන මෙතැන ඉතා බොහෝ වඩාත්"
).split()

_SI_NOUNS = (
    "පොත ගස ගෙදර ළමයා ගුරුවරයා මිනිසා පුතා දුව පාසල රට ගම නගරය රජය ආණ්ඩුව "
    "මැතිවරණය පක්ෂය නීතිය උසාවිය නඩුව ආර්ථිකය බැංකුව සමාගම අධ්\u200dයාපනය විද්\u200dයාව "
    "තාක්ෂණය පරිගණකය ක්\u200dරීඩාව තරගය කණ්ඩායම චිත්\u200dරපටය සංගීතය ගීතය ගොනුව ලේඛනය "
    "දත්ත තොරතුරු භාෂාව වචනය වාක්\u200dයය පෙළ අත පය ඇස හිස නම දිනය මාසය වර්ෂය දවස "
    "මුදල මිල කඩය ආහාර වතුර රෝගය ඖෂධය රෝහල මාර්ගය මුහුද කන්ද අහස ශිෂ්\u200dයයා "
    "වෛද්\u200dයවරයා මව පියා මිතුරා සතා ගවයා බල්ලා පූසා ඉලක්කම අංකය ගණන වැඩය වැඩ "
    "කාලය වේලාව ස්ථානය ජීවිතය මනස ශරීරය සෞඛ්\u200dයය පාඩම විභාගය ප්\u200dරශ්නය පිළිතුර"
).split()

_SI_VERB_SPEC = {
    "කරනවා": "කළා කළේ කළෙමු කළෙමි කළ කළාද කරපු කරලා කරමින්",
    "යනවා": "ගියා ගියේ ගියෙමු ගියෙමි ගිය ගිහින් ගිහිල්ලා",
    "එනවා": "ආවා ආවේ ආවෙමු ආව ඇවිත් ඇවිල්ලා",
    "කනවා": "කෑවා කෑවේ කාලා කා කෑ",
    "බොනවා": "බිව්වා බිව්වේ බීලා බී",
    "දෙනවා": "දුන්නා දුන්නේ දීලා දී දුන්",
    "ගන්නවා": "ගත්තා ගත්තේ අරන් අරගෙන ගෙන ගත්",
    "බලනවා": "බැලුවා බැලුවේ බලලා බලා බැලූ",
    "කියනවා": "කිව්වා කිව්වේ කියලා කියා කීවා කී",
    "දකිනවා": "දැක්කා දැක්කේ දැකලා දැක දැක්ක",
    "ලියනවා": "ලිව්වා ලිව්වේ ලියලා ලියා ලීවා",
    "කියවනවා": "කියෙව්වා කියෙව්වේ කියවලා කියවා",
    "ඉන්නවා": "හිටියා හිටියේ හිටිය ඉඳලා",
    "වෙනවා": "වුණා වුණේ වෙලා වී",
    "තියෙනවා": "තිබුණා තිබුණේ තිබිලා",
    "අහනවා": "ඇහුවා ඇහුවේ අහලා අසා",
    "හදනවා": "හැදුවා හැදුවේ හදලා හදා",
    "තෝරනවා": "තෝරුවා තෝරලා තෝරා",
    "ඉගෙනගන්නවා": "ඉගෙනගත්තා ඉගෙනගත්තේ ඉගෙනගෙන",
    "දන්නවා": "දැනගත්තා දැනගෙන",
    "ඇතුළත්කරනවා": "ඇතුළත්කළා",
    "උඩුගතකරනවා": "උඩුගතකළා",
    "සොයනවා": "සෙව්වා සෙව්වේ සොයලා සොයා",
    "සොයාගන්නවා": "සොයාගත්තා සොයාගෙන",
    "ලබනවා": "ලැබුවා ලබලා ලබා",
    "වැඩකරනවා": "වැඩකළා",
}

_SI_PRESENT_SUFFIXES = ["නවා", "නවද", "නවාද", "න්නේ", "න්නෙ", "න්න", "න", "මින්", "ලා", "මු", "මි", "යි", "ති"]
_SI_PRESENT_SUFFIXES_VIRAMA = ["නවා", "නවද", "නවාද", "නේ", "නෙ", "න"]
_SI_VERB_ENDINGS = ("නවාද", "නවද", "නවා")

_SI_NOUN_RULES = sorted(
    [
        ("වල්වලින්", "", "Case=Abl|Number=Plur"), ("වල්වලට", "", "Case=Dat|Number=Plur"),
        ("වලින්", "", "Case=Abl|Number=Plur"), ("වලට", "", "Case=Dat|Number=Plur"),
        ("වල", "", "Case=Gen|Number=Plur"), ("වල්", "", "Number=Plur"),
        ("යින්ගෙන්", "යා", "Case=Abl|Number=Plur"), ("යින්ගේ", "යා", "Case=Gen|Number=Plur"),
        ("යින්ට", "යා", "Case=Dat|Number=Plur"), ("යින්", "යා", "Number=Plur"),
        ("ුන්ගෙන්", "ා|යා", "Case=Abl|Number=Plur"), ("ුන්ගේ", "ා|යා", "Case=Gen|Number=Plur"),
        ("ුන්ට", "ා|යා", "Case=Dat|Number=Plur"), ("ුන්", "ා|යා", "Number=Plur"),
        ("යෝ", "යා", "Number=Plur"), ("යි", "යා", "Number=Plur"), ("ු", "යා", "Number=Plur"),
        ("ෙක්", "ා", "Definiteness=Indef|Number=Sing"),
        ("ගෙන්", "", "Case=Abl|Number=Sing"), ("ගේ", "", "Case=Gen|Number=Sing"),
        ("ෙන්", "", "Case=Abl|Number=Sing"), ("ෙහි", "", "Case=Loc|Number=Sing"),
        ("ක්", "", "Definiteness=Indef|Number=Sing"), ("ට", "", "Case=Dat|Number=Sing"),
        ("ේ", "", "Case=Loc|Number=Sing"), ("්", "", "Number=Plur"),
    ],
    key=lambda item: -len(item[0]),
)

_SI_NOUN_LEX: Dict[str, str] = {_key(w): w for w in _SI_NOUNS}
_SI_PRONOUN_LEX: Dict[str, Tuple[str, str]] = {_key(w): (w, feat) for w, feat in _SI_PRONOUNS.items()}
_SI_PRONOUN_FORM_LEX: Dict[str, str] = {_key(form): lemma for form, lemma in _SI_PRONOUN_FORMS.items()}
_SI_CONJ_KEYS = frozenset(_key(w) for w in _SI_CONJUNCTIONS)
_SI_POSTP_KEYS = frozenset(_key(w) for w in _SI_POSTPOSITIONS)
_SI_ADJ_KEYS = frozenset(_key(w) for w in _SI_ADJECTIVES)
_SI_ADV_KEYS = frozenset(_key(w) for w in _SI_ADVERBS)


def _build_sinhala_verb_forms() -> Dict[str, str]:
    forms: Dict[str, str] = {}
    for citation, past_forms in _SI_VERB_SPEC.items():
        root = citation[:-3]
        suffixes = _SI_PRESENT_SUFFIXES_VIRAMA if root.endswith("්") else _SI_PRESENT_SUFFIXES
        for suffix in suffixes:
            forms[_key(root + suffix)] = citation
        for form in past_forms.split():
            forms[_key(form)] = citation
    return forms


_SI_VERB_FORMS = _build_sinhala_verb_forms()


def _si_noun(word: str, key: str) -> Optional[Tuple[str, str]]:
    for suffix, tail, morph in _SI_NOUN_RULES:
        if not key.endswith(suffix) or len(key) <= len(suffix) + 1:
            continue
        stem = _key(_chop(word, len(suffix)))
        for t in tail.split("|") if tail else [""]:
            for candidate in dict.fromkeys((stem + t, stem.rstrip("්") + t, stem + "ය" + t)):
                if candidate in _SI_NOUN_LEX:
                    return _SI_NOUN_LEX[candidate], morph
    return None


def analyze_sinhala_word(word: str) -> Analysis:
    """Return (pos, tag, lemma, morph) for a Sinhala token."""
    if not word or _is_punct(word):
        return ("PUNCT", "PUNCT", word, "")
    if _is_number(word):
        return ("NUM", "NUM", word, "NumType=Card")
    if _LATIN_RE.fullmatch(word):
        return _latin_token(word)

    key = _key(word)

    if key in _SI_PRONOUN_LEX:
        lemma, feat = _SI_PRONOUN_LEX[key]
        return ("PRON", "PRON", lemma, feat)
    if key in _SI_PRONOUN_FORM_LEX:
        return ("PRON", "PRON", _SI_PRONOUN_FORM_LEX[key], "")
    if key in _SI_CONJ_KEYS:
        return ("CONJ", "CCONJ", word, "")
    if key in _SI_POSTP_KEYS:
        return ("ADP", "POSTP", word, "")
    if key in _SI_ADJ_KEYS:
        return ("ADJ", "ADJ", word, "")
    if key in _SI_ADV_KEYS:
        return ("ADV", "ADV", word, "")
    if key in _SI_NOUN_LEX:
        return ("NOUN", "NOUN", _SI_NOUN_LEX[key], "Case=Nom|Number=Sing")
    if key in _SI_VERB_FORMS:
        return ("VERB", "VERB", _SI_VERB_FORMS[key], "Mood=Ind")

    for suffix in _SI_VERB_ENDINGS:
        if key.endswith(suffix) and len(key) > len(suffix) + 1:
            return ("VERB", "VERB", _chop(word, len(suffix)) + "නවා", "Tense=Pres|Mood=Ind")

    noun = _si_noun(word, key)
    if noun:
        return ("NOUN", "NOUN", noun[0], noun[1])

    for suffix in ("සහගත", "ශීලී", "පූර්ණ", "කාරී"):
        if key.endswith(suffix) and len(key) > len(suffix) + 1:
            return ("ADJ", "ADJ", word, "")
    for suffix in ("ආකාරයෙන්", "ලෙස", "පරිද්දෙන්", "අයුරින්"):
        if key.endswith(suffix) and len(key) > len(suffix) + 1:
            return ("ADV", "ADV", _chop(word, len(suffix)), "")

    return ("NOUN", "NOUN", word, "Case=Nom|Number=Sing")