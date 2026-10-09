import re
import unicodedata
from collections import Counter
from functools import lru_cache
from typing import Dict, List, Any, Optional, Tuple

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
        return {'primary_language': 'English', 'primary_code': 'en', 'is_multilingual': False, 'languages_detected': [{'language': 'English', 'code': 'en', 'percentage': 100.0}], 'script_counts': {'English': 0, 'Tamil': 0, 'Sinhala': 0}}
    sample = text[:50000]
    sinhala_count = sum((1 for ch in sample if '\u0d80' <= ch <= '\u0dff'))
    tamil_count = sum((1 for ch in sample if '\u0b80' <= ch <= '\u0bff'))
    english_count = sum((1 for ch in sample if 'a' <= ch <= 'z' or 'A' <= ch <= 'Z'))
    total_alpha = sinhala_count + tamil_count + english_count
    if total_alpha == 0:
        return {'primary_language': 'English', 'primary_code': 'en', 'is_multilingual': False, 'languages_detected': [{'language': 'English', 'code': 'en', 'percentage': 100.0}], 'script_counts': {'English': 0, 'Tamil': 0, 'Sinhala': 0}}
    si_pct = round(sinhala_count / total_alpha * 100, 1)
    ta_pct = round(tamil_count / total_alpha * 100, 1)
    en_pct = round(english_count / total_alpha * 100, 1)
    breakdown = []
    if ta_pct > 0:
        breakdown.append({'language': 'Tamil', 'code': 'ta', 'percentage': ta_pct})
    if si_pct > 0:
        breakdown.append({'language': 'Sinhala', 'code': 'si', 'percentage': si_pct})
    if en_pct > 0:
        breakdown.append({'language': 'English', 'code': 'en', 'percentage': en_pct})
    breakdown.sort(key=lambda x: x['percentage'], reverse=True)
    primary = breakdown[0]['language'] if breakdown else 'English'
    primary_code = breakdown[0]['code'] if breakdown else 'en'
    is_multi = len([b for b in breakdown if b['percentage'] >= 5.0]) > 1
    return {'primary_language': primary, 'primary_code': primary_code, 'is_multilingual': is_multi, 'languages_detected': breakdown, 'script_counts': {'English': english_count, 'Tamil': tamil_count, 'Sinhala': sinhala_count}}

def detect_sentence_language(sentence: str) -> str:
    """Detect language of a single sentence or phrase."""
    if not sentence or not sentence.strip():
        return 'English'
    si = sum((1 for ch in sentence if '\u0d80' <= ch <= '\u0dff'))
    ta = sum((1 for ch in sentence if '\u0b80' <= ch <= '\u0bff'))
    en = sum((1 for ch in sentence if 'a' <= ch <= 'z' or 'A' <= ch <= 'Z'))
    if si >= ta and si >= en and (si > 0):
        return 'Sinhala'
    if ta >= si and ta >= en and (ta > 0):
        return 'Tamil'
    if en > 0:
        return 'English'
    return 'English'

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
    normalized = text.replace('\r\n', '\n').replace('\r', '\n')
    protected = normalized
    protected = re.sub('(\\d+)\\.(\\d+)', '\\1<DECIMAL_DOT>\\2', protected)

    def _mask_url(m):
        return m.group(0).replace('.', '<URL_DOT>')
    protected = re.sub('(https?://\\S+|www\\.\\S+|\\S+@\\S+\\.\\S+)', _mask_url, protected)
    protected = re.sub('(?<=\\b[A-Za-z])\\.(?=\\s+[A-Za-z]\\b)', '<INITIAL_DOT>', protected)
    protected = re.sub('(?<=\\b[A-Za-z])\\.(?=\\s+[A-Z][a-z])', '<INITIAL_DOT>', protected)
    title_abbr_pattern = re.compile('\\b(Dr|Mr|Mrs|Ms|Prof|Rev|Hon|Capt|Col|Gen|Gov|Sgt|St|Jr|Sr|Ltd|Plc|Pvt|Co|Corp|Inc|Dept|approx|est|fig|No|Nos|vs|vol|vols|e\\.g|i\\.e|etc|al|Rs|LKR|min|sec|hr|km|cm|mm|kg)\\.(?=\\s+)', re.IGNORECASE)
    protected = title_abbr_pattern.sub('\\1<ABBR_DOT>', protected)
    raw_sents = re.split('(?<=[.!?|।॥\\n])\\s+', protected)
    cleaned_sents = []
    for s in raw_sents:
        s = s.replace('<DECIMAL_DOT>', '.')
        s = s.replace('<URL_DOT>', '.')
        s = s.replace('<INITIAL_DOT>', '.')
        s = s.replace('<ABBR_DOT>', '.')
        s = s.strip()
        if s and len(s) > 1:
            cleaned_sents.append(s)
    return cleaned_sents if cleaned_sents else [text.strip()]

@lru_cache(maxsize=1)
def _get_english_nlp():
    """Load spaCy model with safety fallback."""
    try:
        import spacy
        return spacy.load('en_core_web_sm')
    except Exception:
        try:
            import spacy
            from spacy.cli import download
            download('en_core_web_sm')
            return spacy.load('en_core_web_sm')
        except Exception:
            return None

def _tokenize_english_regex(text: str) -> List[str]:
    """Fallback regex tokenizer for English."""
    return re.findall("[A-Za-z0-9]+(?:'[A-Za-z]+)?|[^\\w\\s]", text)

try:
    from services.lemmatizer import (
        analyze_tamil_word,
        analyze_sinhala_word,
        lemmatize_english,
        refine_english_lemma,
    )
except ImportError:
    from .lemmatizer import (
        analyze_tamil_word,
        analyze_sinhala_word,
        lemmatize_english,
        refine_english_lemma,
    )

# Backward compatibility aliases for former internal functions
_analyze_tamil_word = analyze_tamil_word
_analyze_sinhala_word = analyze_sinhala_word


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
        if sent_lang == 'English' and en_nlp is not None:
            doc = en_nlp(sent)
            for token in doc:
                pos = token.pos_ or 'X'
                text_clean = token.text.strip()
                if not text_clean:
                    continue
                if not token.is_punct and (not token.is_space):
                    token_texts.append(text_clean)
                    word_freq[text_clean.lower()] += 1
                pos_counter[pos] += 1
                lemma = refine_english_lemma(text_clean, token.lemma_, pos)
                lemmas.append(lemma)
                token_details.append({
                    'token': text_clean,
                    'text': text_clean,
                    'normalized': text_clean.lower(),
                    'lemma': lemma,
                    'pos': pos,
                    'tag': token.tag_ or pos,
                    'morph': str(token.morph) if token.morph else '',
                    'language': 'en',
                    'sentence_id': sent_id,
                    'is_stop': bool(token.is_stop),
                })
        elif sent_lang == 'Tamil':
            raw_tokens = re.findall('[\u0B80-\u0BFF\u200C\u200D]+|[a-zA-Z0-9]+|[^\w\s]', sent)
            for raw_tok in raw_tokens:
                tok = raw_tok.strip()
                if not tok:
                    continue
                pos, tag, lemma, morph = analyze_tamil_word(tok)
                if pos != 'PUNCT':
                    token_texts.append(tok)
                    word_freq[tok] += 1
                pos_counter[pos] += 1
                lemmas.append(lemma)
                token_details.append({
                    'token': tok,
                    'text': tok,
                    'normalized': tok,
                    'lemma': lemma,
                    'pos': pos,
                    'tag': tag,
                    'morph': morph,
                    'language': 'ta',
                    'sentence_id': sent_id,
                    'is_stop': False,
                })
        elif sent_lang == 'Sinhala':
            raw_tokens = re.findall('[\u0D80-\u0DFF\u200C\u200D]+|[a-zA-Z0-9]+|[^\w\s]', sent)
            for raw_tok in raw_tokens:
                tok = raw_tok.strip()
                if not tok:
                    continue
                pos, tag, lemma, morph = analyze_sinhala_word(tok)
                if pos != 'PUNCT':
                    token_texts.append(tok)
                    word_freq[tok] += 1
                pos_counter[pos] += 1
                lemmas.append(lemma)
                token_details.append({
                    'token': tok,
                    'text': tok,
                    'normalized': tok,
                    'lemma': lemma,
                    'pos': pos,
                    'tag': tag,
                    'morph': morph,
                    'language': 'si',
                    'sentence_id': sent_id,
                    'is_stop': False,
                })
        else:
            raw_tokens = _tokenize_english_regex(sent)
            for raw_tok in raw_tokens:
                tok = raw_tok.strip()
                if not tok:
                    continue
                is_punct = all(c in '.,!?;:|।॥\'"()[]{}<>-–—/\\@#$%&*+=_~^`' for c in tok)
                pos = 'PUNCT' if is_punct else 'NUM' if tok.isdigit() else 'NOUN'
                lemma = tok if is_punct else lemmatize_english(tok, pos)
                if not is_punct:
                    token_texts.append(tok)
                    word_freq[tok.lower()] += 1
                pos_counter[pos] += 1
                lemmas.append(lemma)
                token_details.append({
                    'token': tok,
                    'text': tok,
                    'normalized': tok.lower(),
                    'lemma': lemma,
                    'pos': pos,
                    'tag': pos,
                    'morph': '',
                    'language': 'en',
                    'sentence_id': sent_id,
                    'is_stop': False,
                })
    unique_tokens = len({t.lower() for t in token_texts})
    top_words = [[w, count] for w, count in word_freq.most_common(50)]
    top_keywords = [w for w, _ in top_words[:5]]
    return {
        'tokens': token_texts,
        'token_count': len(token_texts),
        'unique_tokens': unique_tokens,
        'lemmas': lemmas,
        'token_details': token_details[:5000],
        'pos_distribution': dict(pos_counter),
        'top_words': top_words,
        'top_keywords': top_keywords,
        'sentences': sentences,
        'sentence_count': len(sentences),
    }

def extract_entities(text: str, lang: str = 'English') -> List[Dict[str, Any]]:
    """Named Entity Recognition has been removed from the NLP pipeline."""
    return []

POSITIVE_WORDS = {'good', 'great', 'excellent', 'positive', 'success', 'successful', 'progress', 'growth', 'happy', 'best', 'wonderful', 'improvement', 'win', 'benefit', 'advance', 'support', 'joy', 'நல்ல', 'சிறந்த', 'வெற்றி', 'வளர்ச்சி', 'மகிழ்ச்சி', 'முன்னேற்றம்', 'நன்மை', 'உயர்', 'அழகு', 'பாராட்டு', 'சாதனை', 'நலம்', 'முயற்சி', 'ஆதரவு', 'மகிழ்வு', 'இனிமை', 'හොඳ', 'විශිෂ්ට', 'ජයග්\u200dරහණ', 'ජයග්\u200dරහණය', 'දියුණුව', 'දියුණු', 'සතුටු', 'සතුට', 'ප්\u200dරගති', 'ප්\u200dරගතිය', 'වාසි', 'වාසිය', 'උසස්', 'ලස්සන', 'ප්\u200dරශංසා', 'සාර්ථක', 'යහපත්', 'සහයෝග', 'සහයෝගය', 'ප්\u200dරීති', 'ප්\u200dරීතිමත්', 'වාසනාවන්ත', 'වාසනා'}
NEGATIVE_WORDS = {'bad', 'terrible', 'negative', 'failure', 'failed', 'loss', 'problem', 'crisis', 'damage', 'danger', 'poor', 'decline', 'corruption', 'violence', 'threat', 'attack', 'மோசம்', 'தோல்வி', 'இழப்பு', 'பிரச்சனை', 'நெருக்கடி', 'சேதம்', 'ஆபத்து', 'வீழ்ச்சி', 'ஊழல்', 'வன்முறை', 'அச்சுறுத்தல்', 'துன்பம்', 'நோய்', 'கவலை', 'குறைவு', 'නරක', 'අසාර්ථක', 'පාඩු', 'පාඩුව', 'ගැටලු', 'ගැටලුව', 'අර්බුද', 'අර්බුදය', 'හානි', 'හානිය', 'අනතුරු', 'අනතුර', 'පිරිහීම', 'දූෂණ', 'දූෂණය', 'ප්\u200dරචණ්ඩ', 'ප්\u200dරචණ්ඩත්වය', 'තර්ජන', 'තර්ජනය', 'දුක්', 'දුක', 'රෝග', 'රෝගය', 'කරදර'}

def analyze_sentiment(text: str, lang: str='English', sentences: Optional[List[str]]=None) -> Dict[str, Any]:
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
        lbl = 'நடுநிலை' if lang == 'Tamil' else 'මධ්\u200dයස්ථ' if lang == 'Sinhala' else 'Neutral'
        return {'label': lbl, 'label_en': 'neutral', 'score': 0.5, 'confidence': 0.5, 'distribution': {'positive': 0.0, 'neutral': 100.0, 'negative': 0.0}, 'sentences': []}
    if sentences is None:
        sentences = segment_sentences(text)
    sentence_sentiments = []
    total_pos = 0
    total_neg = 0
    total_neu = 0
    for s in sentences:
        s_lang = detect_sentence_language(s)
        words = re.findall('[\\u0B80-\\u0BFF\\u0D80-\\u0DFFa-zA-Z]+', s.lower())
        pos_hits = sum((1 for w in words if any((pw in w for pw in POSITIVE_WORDS))))
        neg_hits = sum((1 for w in words if any((nw in w for nw in NEGATIVE_WORDS))))
        if pos_hits > neg_hits:
            s_label = 'Positive'
            conf = min(0.65 + (pos_hits - neg_hits) * 0.1, 0.98)
            total_pos += 1
        elif neg_hits > pos_hits:
            s_label = 'Negative'
            conf = min(0.65 + (neg_hits - pos_hits) * 0.1, 0.98)
            total_neg += 1
        else:
            s_label = 'Neutral'
            conf = 0.6
            total_neu += 1
        sentence_sentiments.append({'sentence': s, 'language': s_lang, 'sentiment': s_label, 'confidence': round(conf, 2), 'score': round(conf, 2)})
    total_sents = max(len(sentences), 1)
    pos_pct = round(total_pos / total_sents * 100, 1)
    neg_pct = round(total_neg / total_sents * 100, 1)
    neu_pct = round(total_neu / total_sents * 100, 1)
    if total_pos > total_neg and total_pos >= total_neu:
        overall_en = 'positive'
        overall_score = min(0.65 + total_pos / total_sents * 0.35, 0.99)
    elif total_neg > total_pos and total_neg >= total_neu:
        overall_en = 'negative'
        overall_score = min(0.65 + total_neg / total_sents * 0.35, 0.99)
    else:
        overall_en = 'neutral'
        overall_score = 0.6
    if lang == 'Tamil':
        overall_label = 'நேர்மறை' if overall_en == 'positive' else 'எதிர்மறை' if overall_en == 'negative' else 'நடுநிலை'
    elif lang == 'Sinhala':
        overall_label = 'ධනාත්මක' if overall_en == 'positive' else 'සෘණාත්මක' if overall_en == 'negative' else 'මධ්\u200dයස්ථ'
    else:
        overall_label = overall_en.capitalize()
    try:
        from routes.summarize import get_groq_client, MODEL
        client = get_groq_client()
        resp = client.chat.completions.create(model=MODEL, messages=[{'role': 'system', 'content': 'Classify sentiment. Respond ONLY with JSON: {"label_en": "positive"|"negative"|"neutral", "score": float}'}, {'role': 'user', 'content': text[:2000]}], response_format={'type': 'json_object'}, temperature=0.1, max_tokens=128)
        import json
        res = json.loads(resp.choices[0].message.content)
        llm_label_en = res.get('label_en', overall_en).lower()
        if llm_label_en in ('positive', 'negative', 'neutral'):
            overall_en = llm_label_en
            overall_score = float(res.get('score', overall_score))
            if lang == 'Tamil':
                overall_label = 'நேர்மறை' if overall_en == 'positive' else 'எதிர்மறை' if overall_en == 'negative' else 'நடுநிலை'
            elif lang == 'Sinhala':
                overall_label = 'ධනාත්මක' if overall_en == 'positive' else 'සෘණාත්මක' if overall_en == 'negative' else 'මධ්\u200dයස්ථ'
            else:
                overall_label = overall_en.capitalize()
    except Exception:
        pass
    return {'label': overall_label, 'label_en': overall_en, 'score': round(overall_score, 2), 'confidence': round(overall_score, 2), 'distribution': {'positive': pos_pct, 'negative': neg_pct, 'neutral': neu_pct}, 'sentences': sentence_sentiments[:100]}
DOMAIN_PROFILES = {'Politics': {'en': ['government', 'election', 'parliament', 'minister', 'president', 'policy', 'political', 'vote', 'party', 'cabinet'], 'ta': ['அரசாங்கம்', 'தேர்தல்', 'பாராளுமன்றம்', 'அமைச்சர்', 'ஜனாதிபதி', 'கொள்கை', 'அரசியல்', 'வாக்களிப்பு', 'கட்சி'], 'si': ['රජය', 'මැතිවරණය', 'පාර්ලිමේන්තුව', 'ඇමති', 'ජනාධිපති', 'ප්\u200dරතිපත්තිය', 'දේශපාලන', 'ඡන්දය', 'පක්ෂය']}, 'Sports': {'en': ['cricket', 'football', 'match', 'game', 'team', 'player', 'tournament', 'score', 'cup', 'champion', 'sports'], 'ta': ['கிரிக்கெட்', 'கால்பந்து', 'போட்டி', 'விளையாட்டு', 'அணி', 'வீரர்', 'கிண்ணம்', 'வெற்றி'], 'si': ['ක්\u200dරිකට්', 'පාපන්දු', 'තරගය', 'ක්\u200dරීඩාව', 'කණ්ඩායම', 'ක්\u200dරීඩකයා', 'කුසලානය', 'ජයග්\u200dරහණය']}, 'Business': {'en': ['economy', 'business', 'market', 'stock', 'trade', 'investment', 'company', 'bank', 'profit', 'finance', 'money'], 'ta': ['பொருளாதாரம்', 'வணிகம்', 'சந்தை', 'பங்கு', 'வர்த்தகம்', 'முதலீடு', 'நிறுவனம்', 'வங்கி', 'லாபம்', 'நிதி'], 'si': ['ආර්ථිකය', 'ව්\u200dයාපාරය', 'වෙළඳපොළ', 'කොටස්', 'වෙළඳාම', 'ආයෝජනය', 'සමාගම', 'බැංකුව', 'ලාභය', 'මූල්\u200dය']}, 'Technology': {'en': ['technology', 'software', 'computer', 'internet', 'ai', 'digital', 'system', 'data', 'cyber', 'mobile', 'app'], 'ta': ['தொழில்நுட்பம்', 'மென்பொருள்', 'கணினி', 'இணையம்', 'டிஜிட்டல்', 'அமைப்பு', 'தரவு', 'செயலி'], 'si': ['තාක්ෂණය', 'මෘදුකාංග', 'පරිගණක', 'අන්තර්ජාලය', 'ඩිජිටල්', 'පද්ධතිය', 'දත්ත', 'යෙදුම']}, 'Education': {'en': ['school', 'university', 'student', 'education', 'teacher', 'exam', 'learning', 'academic', 'degree', 'college'], 'ta': ['பாடசாலை', 'பல்கலைக்கழகம்', 'மாணவர்', 'கல்வி', 'ஆசிரியர்', 'பரீட்சை', 'கற்றல்', 'பட்டப்படிப்பு'], 'si': ['පාසල', 'විශ්වවිද්\u200dයාලය', 'ශිෂ්\u200dයයා', 'අධ්\u200dයාපනය', 'ගුරුවරයා', 'විභාගය', 'ඉගෙනීම', 'උපාධිය']}, 'Science': {'en': ['science', 'research', 'scientific', 'experiment', 'climate', 'space', 'physics', 'biology', 'planet', 'energy'], 'ta': ['அறிவியல்', 'ஆராய்ச்சி', 'பரிசோதனை', 'காலநிலை', 'விண்வெளி', 'சக்தி', 'இயற்கை'], 'si': ['විද්\u200dයාව', 'පර්යේෂණ', 'පරීක්ෂණය', 'දේශගුණය', 'අභ්\u200dයවකාශය', 'ශක්තිය', 'ස්වභාවධර්මය']}, 'Health': {'en': ['health', 'hospital', 'doctor', 'medical', 'disease', 'patient', 'treatment', 'medicine', 'virus', 'vaccine'], 'ta': ['சுகாதாரம்', 'வைத்தியசாலை', 'மருத்துவர்', 'நோய்', 'நோயாளி', 'சிகிச்சை', 'மருந்து', 'தடுப்பூசி'], 'si': ['සෞඛ්\u200dයය', 'රෝහල', 'වෛද්\u200dයවරයා', 'රෝගය', 'රෝගියා', 'ප්\u200dරතිකාර', 'ඖෂධ', 'එන්නත']}, 'Law': {'en': ['court', 'law', 'judge', 'legal', 'police', 'justice', 'case', 'crime', 'lawyer', 'rights'], 'ta': ['நீதிமன்றம்', 'சட்டம்', 'நீதிபதி', 'பொலிஸ்', 'நீதி', 'வழக்கு', 'குற்றம்', 'சட்டத்தரணி', 'உரிமைகள்'], 'si': ['උසාවිය', 'නීතිය', 'විනිසුරු', 'පොලිසිය', 'යුක්තිය', 'නඩුව', 'අපරාධය', 'නීතිඥයා', 'අයිතිවාසිකම්']}, 'Entertainment': {'en': ['cinema', 'movie', 'actor', 'music', 'song', 'film', 'culture', 'art', 'drama', 'festival'], 'ta': ['சினிமா', 'திரைப்படம்', 'நடிகர்', 'இசை', 'பாடல்', 'கலாச்சாரம்', 'கலை', 'நாடகம்', 'திருவிழா'], 'si': ['සිනමාව', 'චිත්\u200dරපටය', 'නළුවා', 'සංගීතය', 'ගීතය', 'සංස්කෘතිය', 'කලාව', 'නාට්\u200dයය', 'උත්සවය']}}
DOMAIN_TRANSLATIONS = {'Politics': {'ta': 'அரசியல்', 'si': 'දේශපාලන', 'en': 'Politics'}, 'Sports': {'ta': 'விளையாட்டு', 'si': 'ක්\u200dරීඩා', 'en': 'Sports'}, 'Business': {'ta': 'வணிகம்', 'si': 'ව්\u200dයාපාරික', 'en': 'Business'}, 'Technology': {'ta': 'தொழில்நுட்பம்', 'si': 'තාක්ෂණය', 'en': 'Technology'}, 'Education': {'ta': 'கல்வி', 'si': 'අධ්\u200dයාපනය', 'en': 'Education'}, 'Science': {'ta': 'அறிவியல்', 'si': 'විද්\u200dයාත්මක', 'en': 'Science'}, 'Health': {'ta': 'சுகாதாரம்', 'si': 'සෞඛ්\u200dයය', 'en': 'Health'}, 'Law': {'ta': 'சட்டம்', 'si': 'නීතිය', 'en': 'Law'}, 'Entertainment': {'ta': 'பொழுதுபோக்கு', 'si': 'විනෝදාස්වාදය', 'en': 'Entertainment'}, 'Other': {'ta': 'பொதுவானது', 'si': 'වෙනත්', 'en': 'Other'}}

def classify_text(text: str, lang: str='English') -> Dict[str, Any]:
    """
    Multilingual text classification with full probability distribution.
    """
    if not text or not text.strip():
        other_lbl = DOMAIN_TRANSLATIONS['Other'].get('ta' if lang == 'Tamil' else 'si' if lang == 'Sinhala' else 'en', 'Other')
        return {'predicted_category': 'Other', 'predicted_label': other_lbl, 'score': 1.0, 'probabilities': {'Other': 1.0}, 'all': [{'label': other_lbl, 'label_en': 'Other', 'score': 1.0}]}
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
        scores['Other'] = 1
        total_score = 1
    else:
        scores['Other'] = 0.5
    norm_probs = {d: round(s / total_score, 4) for d, s in scores.items()}
    sorted_domains = sorted(norm_probs.items(), key=lambda x: x[1], reverse=True)
    top_domain, top_prob = sorted_domains[0]
    all_list = []
    for d_name, d_score in sorted_domains:
        d_trans = DOMAIN_TRANSLATIONS.get(d_name, {}).get('ta' if lang == 'Tamil' else 'si' if lang == 'Sinhala' else 'en', d_name)
        all_list.append({'label': d_trans, 'label_en': d_name, 'score': round(d_score, 4)})
    try:
        from routes.summarize import get_groq_client, MODEL
        client = get_groq_client()
        resp = client.chat.completions.create(model=MODEL, messages=[{'role': 'system', 'content': 'Classify the text into top 3-5 categories. Respond ONLY with JSON:\n{"all": [{"label_en": "Politics"|"Sports"|"Business"|"Technology"|"Education"|"Science"|"Health"|"Law"|"Entertainment"|"Other", "score": float}]}'}, {'role': 'user', 'content': text[:3000]}], response_format={'type': 'json_object'}, temperature=0.1, max_tokens=256)
        import json
        llm_data = json.loads(resp.choices[0].message.content)
        llm_all = llm_data.get('all', [])
        if llm_all and isinstance(llm_all, list):
            all_list = []
            for item in llm_all:
                l_en = item.get('label_en', 'Other')
                l_trans = DOMAIN_TRANSLATIONS.get(l_en, {}).get('ta' if lang == 'Tamil' else 'si' if lang == 'Sinhala' else 'en', l_en)
                all_list.append({'label': l_trans, 'label_en': l_en, 'score': float(item.get('score', 0.5))})
            top_domain = all_list[0]['label_en']
            top_prob = all_list[0]['score']
    except Exception:
        pass
    top_label_disp = DOMAIN_TRANSLATIONS.get(top_domain, {}).get('ta' if lang == 'Tamil' else 'si' if lang == 'Sinhala' else 'en', top_domain)
    return {'predicted_category': top_domain, 'predicted_label': top_label_disp, 'score': top_prob, 'probabilities': {item['label_en']: item['score'] for item in all_list}, 'all': all_list}

def compute_statistics(text: str, token_data: Dict[str, Any], lang_data: Dict[str, Any], sentiment_data: Dict[str, Any], entities: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Computes comprehensive structural and NLP statistics for the document.
    """
    chars = len(text)
    chars_no_spaces = len(re.sub('\\s+', '', text))
    paragraphs = [p for p in text.split('\n\n') if p.strip()]
    lang_dist = {b['language']: b['percentage'] for b in lang_data.get('languages_detected', [])}
    return {'characters': chars, 'characters_without_spaces': chars_no_spaces, 'tokens': token_data.get('token_count', 0), 'unique_tokens': token_data.get('unique_tokens', 0), 'sentences': token_data.get('sentence_count', 0), 'paragraphs': max(len(paragraphs), 1), 'language_distribution': lang_dist, 'pos_distribution': token_data.get('pos_distribution', {}), 'sentiment_distribution': sentiment_data.get('distribution', {})}

def analyze(text: str, max_chars: int=100000) -> Dict[str, Any]:
    """
    Complete language-aware NLP processing pipeline for English, Tamil, and Sinhala.
    1. Language Detection (multilingual awareness)
    2. Sentence Segmentation & Language-Aware Tokenization
    3. POS Tagging, Lemmatization, and Morphology
    4. Sentiment Analysis (Document & Sentence levels)
    5. Text Classification with Probability Distribution
    6. Full Corpus Statistics
    """
    if not text:
        text = ''
    truncated_text = text[:max_chars]
    lang_data = detect_languages(truncated_text)
    primary_lang = lang_data['primary_language']
    token_results = tokenize_and_tag(truncated_text)
    sentiment_results = analyze_sentiment(truncated_text, lang=primary_lang, sentences=token_results.get('sentences', []))
    classif_results = classify_text(truncated_text, lang=primary_lang)
    stats = compute_statistics(truncated_text, token_data=token_results, lang_data=lang_data, sentiment_data=sentiment_results)
    if lang_data.get('is_multilingual'):
        display_parts = [f"{b['language']} ({b['percentage']}%)" for b in lang_data.get('languages_detected', [])]
        lang_display = 'Multilingual: ' + ', '.join(display_parts)
    else:
        lang_display = primary_lang
    return {'language': primary_lang, 'language_display': lang_display, 'language_detection': lang_data, 'tokens': token_results.get('tokens', []), 'token_count': token_results.get('token_count', 0), 'unique_tokens': token_results.get('unique_tokens', 0), 'lemmas': token_results.get('lemmas', []), 'top_keywords': token_results.get('top_keywords', []), 'token_details': token_results.get('token_details', []), 'pos_distribution': token_results.get('pos_distribution', {}), 'top_words': token_results.get('top_words', []), 'sentences': token_results.get('sentences', []), 'sentence_count': token_results.get('sentence_count', 0), 'sentiment': sentiment_results, 'classification': classif_results, 'statistics': stats}

def detect_language(text: str) -> str:
    """Backward compatibility helper."""
    return detect_languages(text).get('primary_language', 'English')