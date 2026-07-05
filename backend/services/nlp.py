"""NLP analysis: tokenization, POS tagging, morphological analysis."""
from functools import lru_cache
from collections import Counter
import re


def _detect_language(text: str) -> str:
    # Check Unicode blocks first for Sinhala and Tamil as standard langdetect lacks Sinhala support
    sinhala_chars = sum(1 for char in text[:10000] if '\u0d80' <= char <= '\u0dff')
    tamil_chars = sum(1 for char in text[:10000] if '\u0b80' <= char <= '\u0bff')
    
    if sinhala_chars > 0 and sinhala_chars > tamil_chars:
        return "Sinhala"
    if tamil_chars > 0 and tamil_chars > sinhala_chars:
        return "Tamil"

    try:
        from langdetect import detect
        code = detect(text[:10000])
        return {
            "en": "English",
            "ta": "Tamil",
            "si": "Sinhala",
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
        "NOUN": "பெயர்ச்சொல்", "VERB": "வினைச்சொல்", "ADJ": "பெயரடை",
        "ADV": "வினையடை", "PRON": "பெயர்வினைச் சொல்", "NUM": "எண்",
        "PUNCT": "இலக்கணம்",
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
            "text": token,
            "lemma": token,
            "pos": pos,
            "tag": POS_LABELS.get(pos, pos),
            "is_stop": False,
        })

    sentences = [s.strip() for s in re.split(r'[.!।?]\s*', text) if s.strip()]
    sentence_count = len(sentences)

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
        "sentences": sentences,
        "sentence_count": sentence_count,
    }


def _analyze_sinhala(text: str, max_chars: int = 100_000) -> dict:
    """Sinhala NLP using simple whitespace tokenization + suffix-based POS."""
    print("DEBUG: _analyze_sinhala called")
    print("DEBUG: first 100 chars:", text[:100])

    raw_tokens = text[:max_chars].split()

    def get_sinhala_pos(word: str) -> str:
        # Punctuation
        if all(c in '.,!?;:।॥\'"()[]{}' for c in word):
            return "PUNCT"
        # Numbers
        if word.isdigit():
            return "NUM"

        # Pronouns
        pronouns = [
            "මම", "අපි", "ඔයා", "ඔබ", "ඔහු", "ඇය", "එයා", "එය", "ඔවුන්",
            "මේ", "මෙය", "මෙයා", "ඒ", "එය", "අර", "මොකක්ද", "කවුද", "කුමක්ද"
        ]
        if word in pronouns:
            return "PRON"

        # Verb suffixes (longest first)
        verb_suffixes = [
            "නවා", "නෙවා", "න්නම්", "න්නෙමු", "න්නෙමි", "න්නෙහිය",
            "නවාය", "නවාද", "න්නට", "න්න", "ති", "තී", "තෙමු", "තෙමි",
            "ගත්තා", "ගත්තෙමි", "ගත්තෙමු", "කළා", "කරන", "කරපු", "කරලා",
            "ලැබේ", "ලැබූ", "වෙයි", "වෙන්න", "යයි", "යති", "යමු", "යමි"
        ]
        for s in verb_suffixes:
            if word.endswith(s) and len(word) > len(s):
                return "VERB"

        # Adjective suffixes or words
        adjectives = [
            "ලස්සන", "හොඳ", "නරක", "අලුත්", "පරණ", "ලොකු", "කුඩා", "මහත්",
            "දුප්පත්", "පොහොසත්", "ලෙහෙසි", "අමාරු", "ප්‍රධාන", "විශේෂ"
        ]
        if word in adjectives:
            return "ADJ"
            
        adj_suffixes = ["සහගත", "ශීලී", "පූර්ණ", "මය"]
        for s in adj_suffixes:
            if word.endswith(s) and len(word) > len(s):
                return "ADJ"

        # Adverb suffixes or words
        adverbs = [
            "ඉක්මනින්", "හොඳින්", "සෙමින්", "ලෙස", "නිතරම", "කවදාවත්",
            "පමණක්", "නැවත", "දැන්", "පසුව", "එතැන", "මෙතැන"
        ]
        if word in adverbs:
            return "ADV"

        adv_suffixes = ["ලෙස", "ආකාරයෙන්"]
        for s in adv_suffixes:
            if word.endswith(s) and len(word) > len(s):
                return "ADV"

        # Noun suffixes
        noun_suffixes = [
            "වල්", "වල්වල", "වල්වලට", "වල්වලින්", "ගේ", "ට", "ගෙන්",
            "මෙන්", "ක්", "ක", "කු", "ගැන", "ළඟ", "සමඟ", "මත", "තුළ"
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
        "NOUN": "නාමපද", "VERB": "ක්‍රියාපද", "ADJ": "නාමවිශේෂණ",
        "ADV": "ක්‍රියාවිශේෂණ", "PRON": "සර්වනාම", "NUM": "සංඛ්‍යා",
        "PUNCT": "ලකුණු",
    }

    for token in raw_tokens:
        token = token.strip()
        if not token:
            continue

        pos = get_sinhala_pos(token)

        if pos != "PUNCT":
            token_texts.append(token)
            word_freq[token.lower()] += 1

        pos_counter[pos] += 1
        token_details.append({
            "text": token,
            "lemma": token,
            "pos": pos,
            "tag": POS_LABELS.get(pos, pos),
            "is_stop": False,
        })

    sentences = [s.strip() for s in re.split(r'[.!।?]\s*', text) if s.strip()]
    sentence_count = len(sentences)

    unique_tokens = len({t.lower() for t in token_texts})
    top_keywords = [word for word, _ in word_freq.most_common(5)]

    return {
        "language": "Sinhala",
        "tokens": token_texts,
        "token_count": len(token_texts),
        "unique_tokens": unique_tokens,
        "lemmas": token_texts,
        "top_keywords": top_keywords,
        "token_details": token_details[:5000],
        "pos_distribution": dict(pos_counter),
        "top_words": word_freq.most_common(50),
        "sentences": sentences,
        "sentence_count": sentence_count,
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

    sentences = [sent.text.strip() for sent in doc.sents if sent.text.strip()]
    sentence_count = len(sentences)

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
        "sentences": sentences,
        "sentence_count": sentence_count,
    }


def _get_sentiment(text: str, lang: str) -> dict:
    try:
        from routes.summarize import get_groq_client, MODEL
        client = get_groq_client()
        
        system_content = (
            "You are a sentiment analysis assistant. Analyze the sentiment of the provided text. "
            "Determine if it is positive, negative, or neutral. "
            "Respond ONLY with a JSON object containing these keys:\n"
            "- 'label_en': 'positive' or 'negative' or 'neutral'\n"
            "- 'label': The label translated to the text's language (Tamil: 'நேர்மறை'/'எதிர்மறை'/'நடுநிலை', Sinhala: 'ධනාත්මක'/'සෘණාත්මක'/'මධ්‍යස්ථ', English: 'Positive'/'Negative'/'Neutral')\n"
            "- 'score': A float between 0.0 and 1.0 representing confidence."
        )
        
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": text[:2000]}
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=100
        )
        
        import json
        res = json.loads(response.choices[0].message.content)
        return {
            "label_en": res.get("label_en", "neutral"),
            "label": res.get("label", "Neutral"),
            "score": float(res.get("score", 0.5))
        }
    except Exception as e:
        import logging
        logging.getLogger("uvicorn.error").warning(f"Error in sentiment analysis: {e}")
        # Fallback to a neutral dictionary
        lbl = "Neutral"
        if lang == "Tamil":
            lbl = "நடுநிலை"
        elif lang == "Sinhala":
            lbl = "මධ්‍යස්ථ"
        return {
            "label_en": "neutral",
            "label": lbl,
            "score": 0.5
        }


def _get_classification(text: str, lang: str) -> dict:
    try:
        from routes.summarize import get_groq_client, MODEL
        client = get_groq_client()
        
        system_content = (
            "You are a text classification assistant. Analyze the provided text and classify it into 3-5 relevant categories or topics. "
            "Respond ONLY with a JSON object containing a single key 'all', which is a list of objects. "
            "Each object must have:\n"
            "- 'label': The name of the category/topic, translated to the text's language (Tamil: e.g. 'தொழில்நுட்பம்', Sinhala: e.g. 'තාක්ෂණය', English: e.g. 'Technology').\n"
            "- 'score': A float between 0.0 and 1.0 representing confidence. "
            "Sort the list in descending order of score."
        )
        
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": text[:2000]}
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=150
        )
        
        import json
        res = json.loads(response.choices[0].message.content)
        items = res.get("all", [])
        processed = []
        for item in items:
            if isinstance(item, dict) and "label" in item:
                processed.append({
                    "label": str(item["label"]),
                    "score": float(item.get("score", 0.5))
                })
        if not processed:
            lbl = "General"
            if lang == "Tamil":
                lbl = "பொதுவானது"
            elif lang == "Sinhala":
                lbl = "පොදු"
            processed = [{"label": lbl, "score": 1.0}]
            
        return {"all": processed}
    except Exception as e:
        import logging
        logging.getLogger("uvicorn.error").warning(f"Error in text classification: {e}")
        lbl = "General"
        if lang == "Tamil":
            lbl = "பொதுவானது"
        elif lang == "Sinhala":
            lbl = "පොදු"
        return {"all": [{"label": lbl, "score": 1.0}]}


def _get_entities(text: str, lang: str) -> list:
    try:
        from routes.summarize import get_groq_client, MODEL
        client = get_groq_client()
        
        system_content = (
            "You are a named entity recognition (NER) assistant. Extract all named entities from the text. "
            "Respond ONLY with a JSON object containing a single key 'entities', which is a list of objects. "
            "Each object must have:\n"
            "- 'text': The exact entity text from the source text (e.g. 'Colombo', 'John Doe').\n"
            "- 'label_en': The category code: 'PER' (Person), 'ORG' (Organization), 'LOC' (Location), 'DATE' (Date/Time), 'MONEY' (Money), or 'MISC' (Other).\n"
            "- 'label': The category name translated to the text's language:\n"
            "  * English: 'Person'/'Organization'/'Location'/'Date'/'Money'/'Other'\n"
            "  * Tamil: 'நபர்'/'நிறுவனம்'/'இடம்'/'தேதி'/'பணம்'/'மற்றவை'\n"
            "  * Sinhala: 'පුද්ගල'/'සංවිධාන'/'ස්ථාන'/'දිනය'/'මුදල්'/'වෙනත්'\n"
            "- 'score': 1.0 (confidence score).\n"
            "Do not include any explanation or markdown formatting."
        )
        
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": text[:2000]}
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=250
        )
        
        import json
        res = json.loads(response.choices[0].message.content)
        items = res.get("entities", [])
        processed = []
        for item in items:
            if isinstance(item, dict) and "text" in item and "label_en" in item:
                processed.append({
                    "text": str(item["text"]),
                    "label_en": str(item["label_en"]),
                    "label": str(item.get("label", "Other")),
                    "score": float(item.get("score", 1.0))
                })
        return processed
    except Exception as e:
        import logging
        logging.getLogger("uvicorn.error").warning(f"Error in NER extraction: {e}")
        return []


def analyze(text: str, max_chars: int = 100_000) -> dict:
    """Auto-detect language and run appropriate NLP pipeline."""
    lang = _detect_language(text)
    print("DEBUG: detected language:", lang)
    
    if lang == "Tamil":
        res = _analyze_tamil(text, max_chars)
    elif lang == "Sinhala":
        res = _analyze_sinhala(text, max_chars)
    else:
        res = _analyze_english(text, max_chars)
        
    # Inject sentiment analysis
    res["sentiment"] = _get_sentiment(text, lang)
    # Inject text classification
    res["classification"] = _get_classification(text, lang)
    # Inject named entities
    res["entities"] = _get_entities(text, lang)
    return res