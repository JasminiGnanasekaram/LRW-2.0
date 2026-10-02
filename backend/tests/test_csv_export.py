import inspect
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from routes.documents import router, list_documents
from services.csv_export import document_to_csv


class CsvExportTests(unittest.TestCase):
    def test_document_to_csv_includes_context_and_readable_columns(self):
        doc = {
            "filename": "sample.pdf",
            "file_type": "pdf",
            "nlp": {
                "language_display": "English",
                "token_details": [
                    {"text": "Hello", "lemma": "hello", "pos": "INTJ", "tag": "INTJ", "is_stop": False, "morph": ""},
                    {"text": "world", "lemma": "world", "pos": "NOUN", "tag": "NOUN", "is_stop": False, "morph": ""},
                ],
            },
        }

        csv_text = document_to_csv(doc)

        csv_lower = csv_text.lower()
        self.assertIn("filename", csv_lower)
        self.assertIn("language", csv_lower)
        self.assertIn("token", csv_lower)
        self.assertIn("hello", csv_lower)
        self.assertIn("world", csv_lower)
        self.assertNotIn("language breakdown", csv_lower)
        self.assertNotIn("named entities", csv_lower)
        self.assertNotIn("sentiment", csv_lower)
        self.assertNotIn("classification", csv_lower)

    def test_export_routes_are_not_duplicated_and_list_documents_supports_limit(self):
        export_paths = [route.path for route in router.routes if route.path and "export" in route.path]
        self.assertEqual(export_paths.count("/documents/{document_id}/export"), 1)
        self.assertIn("limit", inspect.signature(list_documents).parameters)


if __name__ == "__main__":
    unittest.main()
