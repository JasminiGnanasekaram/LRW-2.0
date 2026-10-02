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
        lemmas = {item["token"]: item["lemma"] for item in token_details}
        self.assertEqual(lemmas["பல்கலைக்கழகத்தில்"], "பல்கலைக்கழகம்")
        self.assertEqual(lemmas["பெற்றார்கள்"], "பெறு")

    def test_tamil_pos_for_common_sentence_forms(self):
        text = "முயன்றால் முடியாது இல்லை! ஒரு அழகான"
        tokens = {
            item["token"]: item["pos"]
            for item in nlp.tokenize_and_tag(text)["token_details"]
        }
        self.assertEqual(tokens["முயன்றால்"], "VERB")
        self.assertEqual(tokens["முடியாது"], "VERB")
        self.assertEqual(tokens["இல்லை"], "VERB")
        self.assertEqual(tokens["ஒரு"], "DET")
        self.assertEqual(tokens["அழகான"], "ADJ")

    def test_tamil_pos_handles_zero_width_forms(self):
        self.assertEqual(nlp._analyze_tamil_word("முயன்றால்\u200c")[0], "VERB")
        self.assertEqual(nlp._analyze_tamil_word("முடியாதது")[0], "VERB")
        tokens = {
            item["token"]: item["pos"]
            for item in nlp.tokenize_and_tag("முயன்றால்\u200c முடியாதது")["token_details"]
        }
        self.assertEqual(tokens["முயன்றால்"], "VERB")
        self.assertEqual(tokens["முடியாதது"], "VERB")

    def test_tamil_lemma_restores_noun_base_after_case_suffix(self):
        _, _, lemma, morph = nlp._analyze_tamil_word("பல்கலைக்கழகத்தில்")
        self.assertEqual(lemma, "பல்கலைக்கழகம்")
        self.assertEqual(morph, "Case=Loc|Number=Sing")

        _, _, lemma, morph = nlp._analyze_tamil_word("மாணவர்கள்")
        self.assertEqual(lemma, "மாணவர்")
        self.assertEqual(morph, "Case=Nom|Number=Plur")

    def test_tamil_lemma_correction_dictionary_applies_irregular_forms(self):
        self.assertEqual(nlp.correct_tamil_lemma("காலத்துல", "காலம்துலம்"), "காலம்")
        self.assertEqual(nlp.correct_tamil_lemma("நாட்டை", "நாட்டை"), "நாடு")
        self.assertEqual(nlp.correct_tamil_lemma("சொத்துல்", "சொத்துல்"), "சொத்து")

        result = nlp.tokenize_and_tag("காலத்துல நாட்டை சொத்துல்")
        lemmas = {item["token"]: item["lemma"] for item in result["token_details"]}
        self.assertEqual(lemmas["காலத்துல"], "காலம்")
        self.assertEqual(lemmas["நாட்டை"], "நாடு")
        self.assertEqual(lemmas["சொத்துல்"], "சொத்து")

    def test_tamil_lemma_strips_common_suffixes_automatically(self):
        self.assertEqual(nlp._analyze_tamil_word("சவலித்தபடத்தில்")[2], "சவலித்தபடம்")
        self.assertEqual(nlp._analyze_tamil_word("நடத்தை")[2], "நடை")
        self.assertEqual(nlp._analyze_tamil_word("சதணங்கன்னு")[2], "சதனம்")

    def test_tamil_lemma_corrects_stanza_intermediate_forms(self):
        self.assertEqual(nlp.correct_tamil_lemma("பாடத்தை", "பாடத்"), "பாடம்")
        self.assertEqual(nlp.correct_tamil_lemma("கற்க", "கற்கு"), "கல்")
        self.assertEqual(nlp.correct_tamil_lemma("கற்றுக்", "கற்று"), "கல்")
        self.assertEqual(nlp.correct_tamil_lemma("மறுத்தால்", "மறுத்தா"), "மறு")
        self.assertEqual(nlp.correct_tamil_lemma("ஆசிரியர்கள்", "ஆசிரியர்"), "ஆசிரியர்")
        self.assertEqual(nlp.correct_tamil_lemma("முயன்றால்", "முயன்றா"), "முயல்")
        self.assertEqual(nlp.correct_tamil_lemma("முடியாதது", "முடியாதது"), "முடி")

    def test_sinhala_lemma_normalizes_common_inflections(self):
        cases = {
            "විශ්වවිද්‍යාලයේ": "විශ්වවිද්‍යාලය",
            "හොඳින්": "හොඳ",
            "ලබා": "ලබ",
            "කළහ": "කර",
        }
        for word, expected_lemma in cases.items():
            with self.subTest(word=word):
                self.assertEqual(nlp._analyze_sinhala_word(word)[2], expected_lemma)

    def test_tokenization_excludes_punctuation_from_nlp_results(self):
        result = nlp.tokenize_and_tag("முயன்றால், முடியாதது! (வா?)")
        self.assertEqual(result["tokens"], ["முயன்றால்", "முடியாதது", "வா"])
        self.assertTrue(all(item["pos"] != "PUNCT" for item in result["token_details"]))
        self.assertNotIn("PUNCT", result["pos_distribution"])

    def test_sinhala_nlp_analysis(self):
        text = "ශිෂ්‍යයන් විශ්වවිද්‍යාලයේ ඉතා හොඳින් අධ්‍යාපනය ලබා ජයග්‍රහණය කළහ."
        res = nlp.analyze(text)
        self.assertEqual(res["language"], "Sinhala")
        self.assertGreater(res["token_count"], 0)
        self.assertIn("NOUN", res["pos_distribution"])
        
        token_details = res["token_details"]
        self.assertTrue(any(t["language"] == "si" for t in token_details))
        lemmas = {item["token"]: item["lemma"] for item in token_details}
        self.assertEqual(lemmas["විශ්වවිද්‍යාලයේ"], "විශ්වවිද්‍යාලය")
        self.assertEqual(lemmas["හොඳින්"], "හොඳ")

    def test_mixed_document_nlp_analysis(self):
        text = (
            "Education is very important. "
            "கல்வி மிகவும் முக்கியமானது. "
            "අධ්‍යාපනය ඉතා වැදගත් වේ."
        )
        res = nlp.analyze(text)
        self.assertNotIn("language_detection", res)
        self.assertNotIn("language_display", res)
        self.assertNotIn("entities", res)
        self.assertNotIn("sentiment", res)
        self.assertNotIn("classification", res)
        self.assertGreater(res["token_count"], 5)
        self.assertEqual(len(res["sentences"]), 3)

    def test_nlp_analysis_includes_corpus_statistics(self):
        text = "This is a short English sentence for analysis."
        res = nlp.analyze(text)
        stats = res["statistics"]
        self.assertEqual(stats["characters"], len(text))
        self.assertEqual(stats["characters_without_spaces"], len(text.replace(" ", "")))
        self.assertEqual(stats["tokens"], res["token_count"])
        self.assertEqual(stats["unique_tokens"], res["unique_tokens"])
        self.assertEqual(stats["sentences"], res["sentence_count"])
        self.assertEqual(stats["paragraphs"], 1)

    def test_corpus_statistics_count_paragraphs_and_empty_text(self):
        text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
        token_data = {"token_count": 6, "unique_tokens": 5, "sentence_count": 3}
        stats = nlp.compute_statistics(text, token_data)
        self.assertEqual(stats["paragraphs"], 3)
        self.assertEqual(stats["characters"], len(text))

        empty_stats = nlp.compute_statistics("", {})
        self.assertEqual(empty_stats["characters"], 0)
        self.assertEqual(empty_stats["paragraphs"], 0)

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
                "token_count": 5,
                "unique_tokens": 5,
                "sentence_count": 1,
                "top_keywords": ["தமிழ்", "கணினி"],
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
        self.assertIn("தமிழ்", csv_str)
        self.assertIn("=== DOCUMENT SUMMARY ===", csv_str)
        self.assertNotIn("கொழும்பு", csv_str)
        self.assertNotIn("NAMED ENTITIES", csv_str)
        self.assertNotIn("SENTIMENT", csv_str)
        self.assertNotIn("CLASSIFICATION", csv_str)


if __name__ == "__main__":
    unittest.main()
