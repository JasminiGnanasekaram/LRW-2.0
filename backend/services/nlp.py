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


def compute_statistics(text: str, token_data: Dict[str, Any], lang_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes comprehensive structural and NLP statistics for the document.
    """
    chars = len(text)
    chars_no_spaces = len(re.sub('\\s+', '', text))
    paragraphs = [p for p in text.split('\n\n') if p.strip()]
    lang_dist = {b['language']: b['percentage'] for b in lang_data.get('languages_detected', [])}
    return {'characters': chars, 'characters_without_spaces': chars_no_spaces, 'tokens': token_data.get('token_count', 0), 'unique_tokens': token_data.get('unique_tokens', 0), 'sentences': token_data.get('sentence_count', 0), 'paragraphs': max(len(paragraphs), 1), 'language_distribution': lang_dist, 'pos_distribution': token_data.get('pos_distribution', {})}

def analyze(text: str, max_chars: int=100000) -> Dict[str, Any]:
    """
    Complete language-aware NLP processing pipeline for English, Tamil, and Sinhala.
    1. Language Detection (multilingual awareness)
    2. Sentence Segmentation & Language-Aware Tokenization
    3. POS Tagging, Lemmatization, and Morphology
    4. Full Corpus Statistics
    """
    if not text:
        text = ''
    truncated_text = text[:max_chars]
    lang_data = detect_languages(truncated_text)
    primary_lang = lang_data['primary_language']
    token_results = tokenize_and_tag(truncated_text)
    stats = compute_statistics(truncated_text, token_data=token_results, lang_data=lang_data)
    if lang_data.get('is_multilingual'):
        display_parts = [f"{b['language']} ({b['percentage']}%)" for b in lang_data.get('languages_detected', [])]
        lang_display = 'Multilingual: ' + ', '.join(display_parts)
    else:
        lang_display = primary_lang
    return {'language': primary_lang, 'language_display': lang_display, 'tokens': token_results.get('tokens', []), 'token_count': token_results.get('token_count', 0), 'unique_tokens': token_results.get('unique_tokens', 0), 'lemmas': token_results.get('lemmas', []), 'top_keywords': token_results.get('top_keywords', []), 'token_details': token_results.get('token_details', []), 'pos_distribution': token_results.get('pos_distribution', {}), 'top_words': token_results.get('top_words', []), 'sentences': token_results.get('sentences', []), 'sentence_count': token_results.get('sentence_count', 0), 'statistics': stats}

def detect_language(text: str) -> str:
    """Backward compatibility helper."""
    return detect_languages(text).get('primary_language', 'English')