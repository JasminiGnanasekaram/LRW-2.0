"""CSV export utilities for processed documents."""
import csv
import io
from typing import List


def document_to_csv(doc: dict) -> str:
    """Export a single document as a structured, spreadsheet-friendly CSV."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "document_filename",
        "document_type",
        "language",
        "token_index",
        "token_text",
        "lemma",
        "pos",
        "tag",
        "is_stop",
        "morph",
        "sentence_index",
    ])

    nlp = doc.get("nlp") or {}
    tokens = nlp.get("token_details") or nlp.get("tokens") or []
    sentences = nlp.get("sentences") or []

    sentence_index = 0
    current_sentence = ""

    for i, token in enumerate(tokens):
        if isinstance(token, dict):
            token_text = token.get("text", "")
            if token_text and token_text in {".", "!", "?", ";", ":"}:
                sentence_index += 1
            if not token_text:
                token_text = ""

            if sentences and i < len(sentences):
                current_sentence = sentences[i] if isinstance(sentences[i], str) else ""
            else:
                current_sentence = ""

            row = [
                doc.get("filename", ""),
                doc.get("file_type", ""),
                nlp.get("language_display") or nlp.get("language") or "",
                i,
                token_text,
                token.get("lemma", ""),
                token.get("pos", ""),
                token.get("tag", ""),
                token.get("is_stop", ""),
                token.get("morph", ""),
                sentence_index,
            ]
        else:
            row = [
                doc.get("filename", ""),
                doc.get("file_type", ""),
                nlp.get("language_display") or nlp.get("language") or "",
                i,
                token,
                "",
                "",
                "",
                "",
                "",
                sentence_index,
            ]
        writer.writerow(row)

    return buf.getvalue()


def documents_summary_csv(docs: List[dict]) -> str:
    """Export a summary table of multiple documents."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "filename", "file_type", "token_count",
        "source", "author", "publication_date", "domain", "category", "license",
        "created_at",
    ])
    for d in docs:
        meta = d.get("metadata") or {}
        nlp = d.get("nlp") or {}
        writer.writerow([
            d.get("id"), d.get("filename"), d.get("file_type"),
            nlp.get("token_count", ""),
            meta.get("source", ""), meta.get("author", ""),
            meta.get("publication_date", ""), meta.get("domain", ""),
            meta.get("category", ""), meta.get("license", ""),
            d.get("created_at", ""),
        ])
    return buf.getvalue()
