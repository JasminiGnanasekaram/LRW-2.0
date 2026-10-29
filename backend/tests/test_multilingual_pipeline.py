"""Tests for the multilingual document processing and NLP pipeline."""

import unittest

from services import cleaning, csv_export, nlp, summarizer

ZWJ = "\u200d"


class TestCleaning(unittest.TestCase):
    def test_preserves_sinhala_zero_width_joiner(self):
        cleaned = cleaning.clean("ශ්‍රී ලංකා ප්‍රවෘත්ති විකාශය")
        self.assertIn(ZWJ, cleaned)
        self.assertIn("ශ්‍රී ලංකා", cleaned)

    def test_preserves_tamil_combining_marks(self):
        cleaned = cleaning.clean("தமிழ் மொழி உலகின் மிகத் தொன்மையான மொழிகளில் ஒன்றாகும்.")
        for word in ("தமிழ்", "மொழிகளில்", "ஒன்றாகும்"):
            self.assertIn(word, cleaned)

    def test_preserves_decimals_abbreviations_and_paragraphs(self):
        cleaned = cleaning.clean(
            "The budget is Rs. 1500.50 million.\n\nDr. A. B. Perera announced the result."
        )
        self.assertIn("1500.50", cleaned)
        self.assertIn("Dr.", cleaned)
        self.assertIn("\n\n", cleaned)


class TestLanguageDetection(unittest.TestCase):
    def test_single_language_documents(self):
        cases = {
            "English": ("en", "The central bank announced new interest rates for commercial banks."),
            "Tamil": ("ta", "கொழும்பு பல்கலைக்கழகத்தில் புதிய தமிழ் மொழி ஆய்வு மையம் ஆரம்பிக்கப்பட்டுள்ளது."),
            "Sinhala": ("si", "ශ්‍රී ලංකාවේ අධ්‍යාපන ක්ෂේත්‍රයේ නව සංවර්ධන ව්‍යාපෘති කිහිපයක් ආරම්භ කර ඇත."),
        }
        for language, (code, text) in cases.items():
            with self.subTest(language=language):
                result = nlp.detect_languages(text)
                self.assertEqual(result["primary_language"], language)
                self.assertEqual(result["primary_code"], code)
                self.assertFalse(result["is_multilingual"])

    def test_mixed_language_document(self):
        result = nlp.detect_languages(
            "Sri Lanka is a beautiful island. "
            "இலங்கை ஒரு அழகான தீவு ஆகும். "
            "ශ්‍රී ලංකාව ඉතා සුන්දර දූපතකි."
        )
        self.assertTrue(result["is_multilingual"])
        detected = {item["language"] for item in result["languages_detected"]}
        self.assertEqual(detected, {"English", "Tamil", "Sinhala"})

    def test_empty_input_defaults_to_english(self):
        result = nlp.detect_languages("   ")
        self.assertEqual(result["primary_language"], "English")
        self.assertFalse(result["is_multilingual"])


class TestSentenceSegmentation(unittest.TestCase):
    def test_splits_across_scripts_without_breaking_abbreviations(self):
        sentences = nlp.segment_sentences(
            "Dr. Silva visited Colombo at 10.30 AM. "
            "அவர் கொழும்பு பல்கலைக்கழகத்திற்கு சென்றார். "
            "ඔහු එහිදී නව පර්යේෂණ ආරම්භ කළේය."
        )
        self.assertEqual(len(sentences), 3)
        self.assertIn("Dr. Silva", sentences[0])
        self.assertIn("10.30", sentences[0])
        self.assertIn("கொழும்பு", sentences[1])
        self.assertIn("පර්යේෂණ", sentences[2])

    def test_keeps_decimal_numbers_intact(self):
        sentences = nlp.segment_sentences("The rate is 3.5 percent. It rose again.")
        self.assertEqual(len(sentences), 2)
        self.assertIn("3.5", sentences[0])

    def test_empty_input_returns_no_sentences(self):
        self.assertEqual(nlp.segment_sentences(""), [])


class TestNlpAnalysis(unittest.TestCase):
    def test_tamil_analysis(self):
        result = nlp.analyze("மாணவர்கள் கொழும்பு பல்கலைக்கழகத்தில் வேகமாகப் படித்து வெற்றி பெற்றார்கள்.")
        self.assertEqual(result["language"], "Tamil")
        self.assertGreater(result["token_count"], 0)
        self.assertIn("NOUN", result["pos_distribution"])
        self.assertIn("VERB", result["pos_distribution"])

        details = result["token_details"]
        self.assertTrue(any(t["language"] == "ta" for t in details))
        self.assertTrue(any("Tense=" in (t.get("morph") or "") for t in details))

    def test_sinhala_analysis(self):
        result = nlp.analyze("ශිෂ්‍යයන් විශ්වවිද්‍යාලයේ ඉතා හොඳින් අධ්‍යාපනය ලබා ජයග්‍රහණය කළහ.")
        self.assertEqual(result["language"], "Sinhala")
        self.assertGreater(result["token_count"], 0)
        self.assertIn("NOUN", result["pos_distribution"])
        self.assertTrue(any(t["language"] == "si" for t in result["token_details"]))

    def test_mixed_document_analysis(self):
        result = nlp.analyze(
            "Education is very important. "
            "கல்வி மிகவும் முக்கியமானது. "
            "අධ්‍යාපනය ඉතා වැදගත් වේ."
        )
        self.assertTrue(result["language_detection"]["is_multilingual"])
        self.assertGreater(result["token_count"], 5)
        self.assertEqual(len(result["sentences"]), 3)
        self.assertEqual(len(result["sentiment"]["sentences"]), 3)


class TestEntityRecognition(unittest.TestCase):
    def test_extracts_entities_across_scripts(self):
        entities = nlp.extract_entities(
            "Dr. Perera arrived in Colombo on August 19, 2026 and paid Rs. 50000. "
            "திரு. ரமணன் யாழ்ப்பாணம் சென்றார். "
            "මහාචාර්ය ජයවර්ධන මහනුවර සංචාරය කළේය."
        )
        found = {(e["text"], e["label_en"]) for e in entities}
        expected = {
            ("Dr. Perera", "PER"),
            ("Colombo", "LOC"),
            ("August 19, 2026", "DATE"),
            ("Rs. 50000", "MONEY"),
            ("திரு. ரமணன்", "PER"),
            ("யாழ்ப்பாணம்", "LOC"),
            ("මහාචාර්ය ජයවර්ධන", "PER"),
            ("මහනුවර", "LOC"),
        }
        self.assertLessEqual(expected, found)

    def test_does_not_treat_common_words_as_entities(self):
        entities = nlp.extract_entities("Who said the main plan failed? Nobody knows.")
        self.assertEqual(entities, [])


class TestSentimentAndClassification(unittest.TestCase):
    def test_positive_tamil_sentiment(self):
        result = nlp.analyze_sentiment(
            "இந்த திட்டம் மக்களுக்கு மிகப்பெரிய நன்மைகளையும் வெற்றியையும் மகிழ்ச்சியையும் தந்துள்ளது.",
            lang="Tamil",
        )
        self.assertEqual(result["label_en"], "positive")
        self.assertEqual(result["label"], "நேர்மறை")
        self.assertGreaterEqual(result["score"], 0.6)

    def test_positive_sinhala_sentiment(self):
        result = nlp.analyze_sentiment(
            "මෙම නව ව්‍යාපෘතිය ජනතාවට විශාල ජයග්‍රහණයක් සහ සතුටක් ගෙන දුන්නේය.",
            lang="Sinhala",
        )
        self.assertEqual(result["label_en"], "positive")
        self.assertEqual(result["label"], "ධනාත්මක")
        self.assertGreaterEqual(result["score"], 0.6)

    def test_classifies_technology_text(self):
        result = nlp.classify_text(
            "The new software application uses artificial intelligence and modern computer systems."
        )
        self.assertEqual(result["predicted_category"], "Technology")
        self.assertIn("Technology", result["probabilities"])
        self.assertAlmostEqual(sum(result["probabilities"].values()), 1.0, places=2)

    def test_classification_ignores_substring_matches(self):
        result = nlp.classify_text("He said the main plan failed.")
        self.assertEqual(result["predicted_category"], "Other")


class TestSummarizer(unittest.TestCase):
    def test_tamil_summary_is_extractive(self):
        document = (
            "கொழும்பு பல்கலைக்கழகத்தில் புதிய கணினி ஆய்வு கூடம் திறக்கப்பட்டுள்ளது. "
            "மாணவர்கள் இதன் மூலம் நவீன தொழில்நுட்பங்களை கற்றுக்கொள்ள முடியும். "
            "ஆராய்ச்சியாளர்கள் பல புதிய மென்பொருட்களை உருவாக்க திட்டமிட்டுள்ளனர்."
        )
        summary = summarizer.get_text_summary(document)
        self.assertGreater(len(summary), 10)
        self.assertTrue(
            any(sentence in document for sentence in nlp.segment_sentences(summary))
        )

    def test_empty_input_returns_placeholder(self):
        self.assertEqual(summarizer.get_text_summary(""), "No text available to summarize.")


class TestCsvExport(unittest.TestCase):
    @staticmethod
    def _sample_document():
        return {
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
                "pos_distribution": {"NOUN": 3, "VERB": 2},
                "sentences": ["தமிழ் வாழ்க."],
                "token_details": [{
                    "token": "தமிழ்", "normalized": "தமிழ்", "lemma": "தமிழ்", "pos": "NOUN",
                    "tag": "NOUN", "language": "ta", "sentence_id": 1, "morph": "Case=Nom",
                }],
                "statistics": {"characters": 50, "characters_without_spaces": 40, "paragraphs": 1},
            },
        }

    def test_csv_has_utf8_bom_and_preserves_unicode(self):
        csv_str = csv_export.document_to_csv(self._sample_document())
        self.assertTrue(csv_str.startswith("\ufeff"))
        self.assertIn("நேர்மறை", csv_str)
        self.assertIn("தமிழ்", csv_str)
        self.assertIn("=== DOCUMENT SUMMARY ===", csv_str)


if __name__ == "__main__":
    unittest.main()