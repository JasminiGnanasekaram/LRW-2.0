"""
Comprehensive Test Suite for Multilingual Document Processing & NLP Pipeline
Uses standard Python unittest.
"""

import unittest
from services import cleaning, nlp, summarizer, csv_export, extraction


class TestMultilingualPipeline(unittest.TestCase):

    # ── 1. Unicode Cleaning & Preservation Tests ─────────────────────────────

    def test_cleaning_preserves_sinhala_zwj(self):
        """Verify that Zero-Width Joiner (U+200D) is preserved for Sinhala conjuncts."""
        raw_sinhala = "ශ්‍රී ලංකා ප්‍රවෘත්ති විකාශය"
        cleaned = cleaning.clean(raw_sinhala)
        self.assertTrue("\u200d" in cleaned or "ශ්‍රී" in cleaned)
        self.assertIn("ශ්‍රී ලංකා", cleaned)

    def test_cleaning_preserves_tamil_combining_marks(self):
        """Verify that Tamil pulli and vowel modifiers are preserved intact."""
        raw_tamil = "தமிழ் மொழி உலகின் மிகத் தொன்மையான மொழிகளில் ஒன்றாகும்."
        cleaned = cleaning.clean(raw_tamil)
        self.assertIn("தமிழ்", cleaned)
        self.assertIn("மொழிகளில்", cleaned)
        self.assertIn("ஒன்றாகும்", cleaned)

    def test_cleaning_preserves_decimals_and_structure(self):
        """Verify decimal numbers, abbreviations, and paragraph breaks are preserved."""
        raw_text = "The budget is Rs. 1500.50 million.\n\nDr. A. B. Perera announced the result."
        cleaned = cleaning.clean(raw_text)
        self.assertIn("1500.50", cleaned)
        self.assertTrue("Dr." in cleaned or "Dr" in cleaned)
        self.assertIn("\n\n", cleaned)

    # ── 2. Language Detection Tests ──────────────────────────────────────────

    def test_language_detection_english(self):
        text = "The central bank announced new interest rates for commercial banks."
        res = nlp.detect_languages(text)
        self.assertEqual(res["primary_language"], "English")
        self.assertEqual(res["primary_code"], "en")
        self.assertFalse(res["is_multilingual"])

    def test_language_detection_tamil(self):
        text = "கொழும்பு பல்கலைக்கழகத்தில் புதிய தமிழ் மொழி ஆய்வு மையம் ஆரம்பிக்கப்பட்டுள்ளது."
        res = nlp.detect_languages(text)
        self.assertEqual(res["primary_language"], "Tamil")
        self.assertEqual(res["primary_code"], "ta")

    def test_language_detection_sinhala(self):
        text = "ශ්‍රී ලංකාවේ අධ්‍යාපන ක්ෂේත්‍රයේ නව සංවර්ධන ව්‍යාපෘති කිහිපයක් ආරම්භ කර ඇත."
        res = nlp.detect_languages(text)
        self.assertEqual(res["primary_language"], "Sinhala")
        self.assertEqual(res["primary_code"], "si")

    def test_language_detection_mixed(self):
        text = (
            "Sri Lanka is a beautiful island. "
            "இலங்கை ஒரு அழகான தீவு ஆகும். "
            "ශ්‍රී ලංකාව ඉතා සුන්දර දූපතකි."
        )
        res = nlp.detect_languages(text)
        self.assertTrue(res["is_multilingual"])
        detected_langs = [d["language"] for d in res["languages_detected"]]
        self.assertIn("English", detected_langs)
        self.assertIn("Tamil", detected_langs)
        self.assertIn("Sinhala", detected_langs)

    # ── 3. Sentence Segmentation Tests ──────────────────────────────────────

    def test_multilingual_sentence_segmentation(self):
        text = (
            "Dr. Silva visited Colombo at 10.30 AM. "
            "அவர் கொழும்பு பல்கலைக்கழகத்திற்கு சென்றார். "
            "ඔහු එහිදී නව පර්යේෂණ ආරම්භ කළේය."
        )
        sentences = nlp.segment_sentences(text)
        self.assertEqual(len(sentences), 3)
        self.assertIn("Dr. Silva", sentences[0])
        self.assertIn("கொழும்பு", sentences[1])
        self.assertIn("පර්යේෂණ", sentences[2])

    # ── 4. Tokenization, POS, Lemmatization, Morphology ─────────────────────

    def test_tamil_nlp_analysis(self):
        text = "மாணவர்கள் கொழும்பு பல்கலைக்கழகத்தில் வேகமாகப் படித்து வெற்றி பெற்றார்கள்."
        res = nlp.analyze(text)
        self.assertEqual(res["language"], "Tamil")
        self.assertGreater(res["token_count"], 0)
        self.assertIn("NOUN", res["pos_distribution"])
        self.assertIn("VERB", res["pos_distribution"])
        
        token_details = res["token_details"]
        self.assertTrue(any(t["language"] == "ta" for t in token_details))
        self.assertTrue(any("Tense=" in (t.get("morph") or "") for t in token_details))

    def test_sinhala_nlp_analysis(self):
        text = "ශිෂ්‍යයන් විශ්වවිද්‍යාලයේ ඉතා හොඳින් අධ්‍යාපනය ලබා ජයග්‍රහණය කළහ."
        res = nlp.analyze(text)
        self.assertEqual(res["language"], "Sinhala")
        self.assertGreater(res["token_count"], 0)
        self.assertIn("NOUN", res["pos_distribution"])
        
        token_details = res["token_details"]
        self.assertTrue(any(t["language"] == "si" for t in token_details))

    def test_mixed_document_nlp_analysis(self):
        text = (
            "Education is very important. "
            "கல்வி மிகவும் முக்கியமானது. "
            "අධ්‍යාපනය ඉතා වැදගත් වේ."
        )
        res = nlp.analyze(text)
        self.assertTrue(res["language_detection"]["is_multilingual"])
        self.assertGreater(res["token_count"], 5)
        self.assertEqual(len(res["sentences"]), 3)
        self.assertIn("sentiment", res)
        self.assertEqual(len(res["sentiment"]["sentences"]), 3)

    # ── 5. Named Entity Recognition (NER) ────────────────────────────────────

    def test_multilingual_ner(self):
        text = (
            "Dr. Perera arrived in Colombo on August 19, 2026 and paid Rs. 50000. "
            "திரு. ரமணன் யாழ்ப்பாணம் சென்றார். "
            "මහාචාර්ය ජයවර්ධන මහනුවර සංචාරය කළේය."
        )
        entities = nlp.extract_entities(text)
        entity_texts = [e["text"] for e in entities]
        
        self.assertTrue(any("Colombo" in e or "கொழும்பு" in e or "Colombo" in entity_texts for e in entity_texts))
        self.assertTrue(any("யாழ்ப்பாணம்" in e for e in entity_texts))
        self.assertTrue(any("මහනුවර" in e for e in entity_texts))
        self.assertTrue(any("Rs." in e or "50000" in e for e in entity_texts))

    # ── 6. Sentiment & Classification ───────────────────────────────────────

    def test_sentiment_positive_tamil(self):
        text = "இந்த திட்டம் மக்களுக்கு மிகப்பெரிய நன்மைகளையும் வெற்றியையும் மகிழ்ச்சியையும் தந்துள்ளது."
        res = nlp.analyze_sentiment(text, lang="Tamil")
        self.assertTrue(res["label"] == "நேர்மறை" or res["label_en"] == "positive")
        self.assertGreaterEqual(res["score"], 0.6)

    def test_sentiment_positive_sinhala(self):
        text = "මෙම නව ව්‍යාපෘතිය ජනතාවට විශාල ජයග්‍රහණයක් සහ සතුටක් ගෙන දුන්නේය."
        res = nlp.analyze_sentiment(text, lang="Sinhala")
        self.assertTrue(res["label"] == "ධනාත්මක" or res["label_en"] == "positive")
        self.assertGreaterEqual(res["score"], 0.6)

    def test_text_classification_technology(self):
        text = "The new software application uses artificial intelligence and modern computer systems."
        res = nlp.classify_text(text)
        self.assertEqual(res["predicted_category"], "Technology")
        self.assertIn("Technology", res["probabilities"])

    # ── 7. Summarization Tests ───────────────────────────────────────────────

    def test_multilingual_summary(self):
        tamil_doc = (
            "கொழும்பு பல்கலைக்கழகத்தில் புதிய கணினி ஆய்வு கூடம் திறக்கப்பட்டுள்ளது. "
            "மாணவர்கள் இதன் மூலம் நவீன தொழில்நுட்பங்களை கற்றுக்கொள்ள முடியும். "
            "ஆராய்ச்சியாளர்கள் பல புதிய மென்பொருட்களை உருவாக்க திட்டமிட்டுள்ளனர்."
        )
        summary = summarizer.get_text_summary(tamil_doc)
        self.assertGreater(len(summary), 10)
        self.assertTrue("பல்கலைக்கழகத்தில்" in summary or "மாணவர்கள்" in summary or "தொழில்நுட்பங்களை" in summary)

    # ── 8. CSV & JSON Export Tests ───────────────────────────────────────────

    def test_csv_export_utf8_bom(self):
        doc = {
            "filename": "test_multilingual.txt",
            "file_type": "text",
            "created_at": "2026-08-19",
            "metadata": {"source": "Test", "domain": "Technology", "license": "MIT"},
            "nlp": {
                "language": "Tamil",
                "language_display": "Tamil (100%)",
                "token_count": 5,
                "unique_tokens": 5,
                "sentence_count": 1,
                "sentiment": {"label": "நேர்மறை", "score": 0.9, "sentences": []},
                "classification": {"predicted_category": "Technology", "score": 0.85, "all": []},
                "top_keywords": ["தமிழ்", "கணினி"],
                "entities": [{"text": "கொழும்பு", "label_en": "LOC", "label": "இடம்", "score": 0.95}],
                "pos_distribution": {"NOUN": 3, "VERB": 2},
                "sentences": ["தமிழ் வாழ்க."],
                "token_details": [
                    {"token": "தமிழ்", "normalized": "தமிழ்", "lemma": "தமிழ்", "pos": "NOUN", "tag": "NOUN", "language": "ta", "sentence_id": 1, "morph": "Case=Nom"}
                ],
                "statistics": {"characters": 50, "characters_without_spaces": 40, "paragraphs": 1},
            }
        }
        csv_str = csv_export.document_to_csv(doc)
        self.assertTrue(csv_str.startswith("\ufeff"))
        self.assertIn("கொழும்பு", csv_str)
        self.assertIn("தமிழ்", csv_str)
        self.assertIn("=== DOCUMENT SUMMARY ===", csv_str)


if __name__ == "__main__":
    unittest.main()
