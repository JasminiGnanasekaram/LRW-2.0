import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services import extraction


class ExtractionOcrTests(unittest.TestCase):
    def test_get_ocr_languages_returns_non_empty_tesseract_language_string(self):
        languages = extraction._get_ocr_languages()
        self.assertIsInstance(languages, str)
        self.assertTrue(languages)
        self.assertNotIn("+ +", languages)

    def test_readable_pdf_text_is_preserved_without_ocr_overwrite(self):
        readable = "தமிழ் மொழி மாணவர்கள் படிக்கின்றனர்."
        self.assertTrue(extraction._has_readable_pdf_text(readable))
        self.assertFalse(extraction._has_readable_pdf_text("!!! --- ###"))


if __name__ == "__main__":
    unittest.main()
