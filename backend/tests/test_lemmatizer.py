"""Unit tests for the rule-based lemmatizer covering English, Tamil, and Sinhala."""

import unittest
from services.lemmatizer import (
    analyze_tamil_word,
    analyze_sinhala_word,
    lemmatize_english,
    refine_english_lemma,
)


class TestEnglishLemmatization(unittest.TestCase):
    def test_irregular_verbs(self):
        self.assertEqual(lemmatize_english("went", "VERB"), "go")
        self.assertEqual(lemmatize_english("bought", "VERB"), "buy")
        self.assertEqual(lemmatize_english("seen", "VERB"), "see")
        self.assertEqual(lemmatize_english("wrote", "VERB"), "write")

    def test_regular_verbs(self):
        self.assertEqual(lemmatize_english("running", "VERB"), "run")
        self.assertEqual(lemmatize_english("cried", "VERB"), "cry")
        self.assertEqual(lemmatize_english("plays", "VERB"), "play")
        self.assertEqual(lemmatize_english("watched", "VERB"), "watch")

    def test_irregular_nouns(self):
        self.assertEqual(lemmatize_english("children", "NOUN"), "child")
        self.assertEqual(lemmatize_english("feet", "NOUN"), "foot")
        self.assertEqual(lemmatize_english("mice", "NOUN"), "mouse")
        self.assertEqual(lemmatize_english("women", "NOUN"), "woman")

    def test_regular_nouns(self):
        self.assertEqual(lemmatize_english("cats", "NOUN"), "cat")
        self.assertEqual(lemmatize_english("cities", "NOUN"), "city")
        self.assertEqual(lemmatize_english("boxes", "NOUN"), "box")

    def test_invariants(self):
        self.assertEqual(lemmatize_english("news", "NOUN"), "news")
        self.assertEqual(lemmatize_english("series", "NOUN"), "series")
        self.assertEqual(lemmatize_english("species", "NOUN"), "species")

    def test_irregular_adjectives(self):
        self.assertEqual(lemmatize_english("better", "ADJ"), "good")
        self.assertEqual(lemmatize_english("best", "ADJ"), "good")
        self.assertEqual(lemmatize_english("worse", "ADJ"), "bad")

    def test_refine_english_lemma(self):
        self.assertEqual(refine_english_lemma("better", "better", "ADJ"), "good")
        self.assertEqual(refine_english_lemma("Them", "-PRON-", "PRON"), "them")
        self.assertEqual(refine_english_lemma("Running", "Running", "VERB"), "run")


class TestTamilLemmatization(unittest.TestCase):
    def test_pronouns(self):
        pos, tag, lemma, morph = analyze_tamil_word("நான்")
        self.assertEqual(pos, "PRON")
        self.assertEqual(lemma, "நான்")

        pos, tag, lemma, morph = analyze_tamil_word("என்னை")
        self.assertEqual(pos, "PRON")
        self.assertEqual(lemma, "நான்")

    def test_verbs(self):
        pos, tag, lemma, morph = analyze_tamil_word("பெற்றார்கள்")
        self.assertEqual(pos, "VERB")
        self.assertEqual(lemma, "பெறு")
        self.assertIn("Tense=Past", morph)

        pos, tag, lemma, morph = analyze_tamil_word("படித்து")
        self.assertEqual(pos, "VERB")
        self.assertEqual(lemma, "படி")

        pos, tag, lemma, morph = analyze_tamil_word("வந்தார்")
        self.assertEqual(pos, "VERB")
        self.assertEqual(lemma, "வா")

    def test_nouns_and_cases(self):
        pos, tag, lemma, morph = analyze_tamil_word("மாணவர்கள்")
        self.assertEqual(pos, "NOUN")
        self.assertEqual(lemma, "மாணவர்")
        self.assertIn("Number=Plur", morph)

        pos, tag, lemma, morph = analyze_tamil_word("பல்கலைக்கழகத்தில்")
        self.assertEqual(pos, "NOUN")
        self.assertEqual(lemma, "பல்கலைக்கழகம்")
        self.assertIn("Case=Loc", morph)


class TestSinhalaLemmatization(unittest.TestCase):
    def test_pronouns(self):
        pos, tag, lemma, morph = analyze_sinhala_word("මම")
        self.assertEqual(pos, "PRON")
        self.assertEqual(lemma, "මම")

        pos, tag, lemma, morph = analyze_sinhala_word("මට")
        self.assertEqual(pos, "PRON")
        self.assertEqual(lemma, "මම")

    def test_verbs(self):
        pos, tag, lemma, morph = analyze_sinhala_word("කළා")
        self.assertEqual(pos, "VERB")
        self.assertEqual(lemma, "කරනවා")

        pos, tag, lemma, morph = analyze_sinhala_word("ගියා")
        self.assertEqual(pos, "VERB")
        self.assertEqual(lemma, "යනවා")

        pos, tag, lemma, morph = analyze_sinhala_word("කරනවා")
        self.assertEqual(pos, "VERB")
        self.assertEqual(lemma, "කරනවා")

    def test_nouns(self):
        pos, tag, lemma, morph = analyze_sinhala_word("පොත")
        self.assertEqual(pos, "NOUN")
        self.assertEqual(lemma, "පොත")

    def test_zero_width_joiner_preservation(self):
        # Ensure zero-width joiner \u200d is preserved in word like ශිෂ්‍යයා
        word = "ශිෂ්‍\u200dයයා"
        pos, tag, lemma, morph = analyze_sinhala_word(word)
        self.assertEqual(pos, "NOUN")
        self.assertIn("\u200d", lemma)


if __name__ == "__main__":
    unittest.main()
