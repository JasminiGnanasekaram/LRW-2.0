import os
import sys
import unittest
from unittest.mock import patch

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

    def test_detects_pdf_content_independent_of_filename(self):
        self.assertTrue(extraction.is_pdf_content(b"%PDF-1.7\ncontent"))
        self.assertTrue(extraction.is_pdf_content(b" " * 20 + b"%PDF-1.7"))
        self.assertFalse(extraction.is_pdf_content(b"\x89PNG\r\n\x1a\n"))

    @patch.object(extraction, "extract_from_pdf", return_value="PDF text")
    def test_image_upload_with_pdf_bytes_uses_pdf_extractor(self, extract_pdf):
        result = extraction.extract("image", content=b"%PDF-1.7\ncontent", filename="scan.bin")

        self.assertEqual(result, "PDF text")
        extract_pdf.assert_called_once_with(b"%PDF-1.7\ncontent")

    def test_detects_legacy_tamil_and_sinhala_pdf_fonts(self):
        class FakePage:
            def __init__(self, font_name):
                self.font_name = font_name

            def get_fonts(self):
                return [(0, 0, 0, self.font_name)]

        self.assertEqual(extraction._page_legacy_language(FakePage("ABC+Bamini")), "tam")
        self.assertEqual(extraction._page_legacy_language(FakePage("FMAbhaya")), "sin")
        self.assertIsNone(extraction._page_legacy_language(FakePage("ArialUnicodeMS")))

    def test_detects_unrecognized_legacy_font_without_flagging_standard_english(self):
        class FakePage:
            def __init__(self, font_name):
                self.font_name = font_name

            def get_fonts(self):
                return [(0, 0, 0, self.font_name)]

        encoded_tamil = "ngNyhg;gplhR " * 3
        self.assertTrue(
            extraction._page_may_have_legacy_encoding(FakePage("CustomType1"), encoded_tamil)
        )
        self.assertFalse(
            extraction._page_may_have_legacy_encoding(
                FakePage("ABCDEF+ArialMT"),
                "This is a normal English PDF text paragraph with enough characters.",
            )
        )

    def test_detects_unknown_legacy_font_mixed_with_unicode_script(self):
        class FakePage:
            def get_fonts(self):
                return [(0, 0, 0, "CustomType1")]

        mixed_text = "தமிழ் உரை கலந்து உள்ளது " + "ngNyhg;gplhR " * 3
        self.assertTrue(extraction._page_may_have_legacy_encoding(FakePage(), mixed_text))

    def test_detects_full_page_scan_with_only_a_watermark_text_layer(self):
        class FakeRect:
            x0, y0, x1, y1 = 0, 0, 600, 800
            width, height = 600, 800

        class FakePage:
            rect = FakeRect()

            def get_fonts(self):
                return [(0, 0, 0, "Helvetica")]

            def get_image_info(self, xrefs=True):
                return [{"bbox": (0, 0, 600, 800)}]

        page = FakePage()
        watermark = "Digitized by Noolaham Foundation. noolaham.org | aavanaham.org"
        self.assertGreaterEqual(extraction._page_image_coverage(page), 0.99)
        self.assertTrue(extraction._page_requires_ocr(page, watermark))

    def test_keeps_real_unicode_text_even_with_full_page_image(self):
        class FakeRect:
            x0, y0, x1, y1 = 0, 0, 600, 800
            width, height = 600, 800

        class FakePage:
            rect = FakeRect()

            def get_fonts(self):
                return [(0, 0, 0, "Helvetica")]

            def get_image_info(self, xrefs=True):
                return [{"bbox": (0, 0, 600, 800)}]

        page = FakePage()
        tamil_text = "தமிழ் மொழி மாணவர்கள் படிக்கின்றனர்."
        self.assertFalse(extraction._page_requires_ocr(page, tamil_text))

    def test_prefers_ocr_only_when_it_recovers_missing_script_text(self):
        original = "தமிழ் உரை மட்டும்"
        self.assertFalse(extraction._ocr_has_better_script_text("தமிழ் உரை மட்டும்", original))
        self.assertTrue(
            extraction._ocr_has_better_script_text(
                "தமிழ் மொழி மாணவர்கள் படிக்கின்றனர்.", original
            )
        )

    @patch.object(extraction.pytesseract, "get_languages", return_value=["eng", "tam"])
    def test_ocr_language_selection_requires_legacy_document_language(self, _get_languages):
        self.assertEqual(extraction._get_ocr_languages(("tam",)), "eng+tam")
        with self.assertRaisesRegex(RuntimeError, "requires Tesseract language data for sin"):
            extraction._get_ocr_languages(("sin",))

    @patch("PIL.Image.open")
    @patch.object(extraction, "_ocr_image", return_value="தமிழ் உரை")
    @patch.object(extraction.fitz, "open")
    def test_extract_from_legacy_tamil_pdf_uses_unicode_ocr(
        self, open_pdf, ocr_image, open_image
    ):
        class FakePage:
            def get_text(self):
                return "legacy font text"

            def get_fonts(self):
                return [(0, 0, 0, "Bamini")]

            def get_pixmap(self, matrix):
                class FakePixmap:
                    def tobytes(self, _format):
                        return b"image"

                return FakePixmap()

        class FakeDocument:
            def __iter__(self):
                return iter([FakePage()])

            def close(self):
                pass

        image = object()
        open_image.return_value.__enter__.return_value = image
        open_pdf.return_value = FakeDocument()

        result = extraction.extract_from_pdf(b"pdf")

        self.assertEqual(result, "தமிழ் உரை")
        ocr_image.assert_called_once_with(image, required_languages=("tam",))

    @patch("PIL.Image.open")
    @patch.object(extraction, "_ocr_image", return_value="தமிழ் மொழி மாணவர்கள் படிக்கின்றனர்.")
    @patch.object(extraction.fitz, "open")
    def test_extract_from_unknown_legacy_font_prefers_tamil_ocr(
        self, open_pdf, ocr_image, open_image
    ):
        class FakePage:
            def get_text(self):
                return "தமிழ் உரை கலந்து உள்ளது " + "ngNyhg;gplhR " * 3

            def get_fonts(self):
                return [(0, 0, 0, "CustomType1")]

            def get_pixmap(self, matrix):
                class FakePixmap:
                    def tobytes(self, _format):
                        return b"image"

                return FakePixmap()

        class FakeDocument:
            def __iter__(self):
                return iter([FakePage()])

            def close(self):
                pass

        image = object()
        open_image.return_value.__enter__.return_value = image
        open_pdf.return_value = FakeDocument()

        result = extraction.extract_from_pdf(b"pdf")

        self.assertEqual(result, "தமிழ் மொழி மாணவர்கள் படிக்கின்றனர்.")
        ocr_image.assert_called_once_with(image, required_languages=())


if __name__ == "__main__":
    unittest.main()
