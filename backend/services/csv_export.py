"""CSV export utilities for processed documents."""
import csv
import io
from typing import List


def document_to_csv(doc: dict) -> str:
    """Export a single document's tokens (text, lemma, pos, tag) as CSV."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["token_index", "text", "lemma", "pos", "tag", "is_stop"])
    tokens = (doc.get("nlp") or {}).get("tokens") or []
    for i, t in enumerate(tokens):
        writer.writerow([i, t.get("text"), t.get("lemma"), t.get("pos"), t.get("tag"), t.get("is_stop")])
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
