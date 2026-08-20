"""CSV export utilities for processed documents."""
import csv
import io
from typing import List


def document_to_csv(doc: dict) -> str:
<<<<<<< HEAD
    """Export a single document's tokens (text, lemma, pos, tag) as CSV."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["token_index", "text", "lemma", "pos", "tag", "is_stop"])
    nlp = doc.get("nlp") or {}
    tokens = nlp.get("token_details") or []
    for i, t in enumerate(tokens):
        writer.writerow([i, t.get("text"), t.get("lemma"), t.get("pos"), t.get("tag"), t.get("is_stop")])
=======
    """Export a single document as a structured, spreadsheet-friendly CSV."""
    buf    = io.StringIO()
    writer = csv.writer(buf)

    nlp       = doc.get("nlp") or {}
    tokens    = nlp.get("token_details") or []
    sentences = nlp.get("sentences") or []
    entities  = nlp.get("entities") or []
    sentiment = nlp.get("sentiment") or {}
    classif   = nlp.get("classification") or {}

    # Section 1: Document summary
    writer.writerow(["=== DOCUMENT SUMMARY ==="])
    writer.writerow(["Field", "Value"])
    writer.writerow(["Filename",        doc.get("filename", "")])
    writer.writerow(["File Type",       doc.get("file_type", "")])
    writer.writerow(["Language",        nlp.get("language_display") or nlp.get("language") or ""])
    writer.writerow(["Token Count",     nlp.get("token_count", "")])
    writer.writerow(["Unique Tokens",   nlp.get("unique_tokens", "")])
    writer.writerow(["Sentence Count",  nlp.get("sentence_count", "")])
    writer.writerow(["Sentiment",       sentiment.get("label", "")])
    writer.writerow(["Sentiment Score", sentiment.get("score", "")])
    writer.writerow(["Category",        classif.get("label_en", "")])
    writer.writerow(["Category Score",  classif.get("score", "")])
    writer.writerow(["Exported At",     doc.get("created_at", "")])
    writer.writerow([])

    # Section 2: Top keywords
    keywords = nlp.get("top_keywords") or []
    if keywords:
        writer.writerow(["=== TOP KEYWORDS ==="])
        writer.writerow(["#", "Keyword"])
        for i, kw in enumerate(keywords, 1):
            writer.writerow([i, kw])
        writer.writerow([])

    # Section 3: Classification scores
    all_cats = classif.get("all") or []
    if all_cats:
        writer.writerow(["=== TEXT CLASSIFICATION ==="])
        writer.writerow(["Category", "Category (Native)", "Score"])
        for c in all_cats:
            writer.writerow([
                c.get("label_en", ""),
                c.get("label", ""),
                c.get("score", ""),
            ])
        writer.writerow([])

    # Section 4: Named entities
    if entities:
        writer.writerow(["=== NAMED ENTITIES ==="])
        writer.writerow(["#", "Entity Text", "Label", "Label (Native)", "Score"])
        for i, e in enumerate(entities, 1):
            writer.writerow([
                i,
                e.get("text", ""),
                e.get("label_en", e.get("label", "")),
                e.get("label", ""),
                e.get("score", ""),
            ])
        writer.writerow([])

    # Section 5: POS distribution
    pos_dist = nlp.get("pos_distribution") or {}
    if pos_dist:
        writer.writerow(["=== PART-OF-SPEECH DISTRIBUTION ==="])
        writer.writerow(["POS Tag", "Count"])
        for pos, count in sorted(pos_dist.items(), key=lambda x: x[1], reverse=True):
            writer.writerow([pos, count])
        writer.writerow([])

    # Section 6: Top words
    top_words = nlp.get("top_words") or []
    if top_words:
        writer.writerow(["=== TOP WORDS ==="])
        writer.writerow(["Rank", "Word", "Frequency"])
        for i, item in enumerate(top_words[:50], 1):
            if isinstance(item, (list, tuple)) and len(item) == 2:
                writer.writerow([i, item[0], item[1]])
            elif isinstance(item, dict):
                writer.writerow([i, item.get("word", ""), item.get("count", "")])
        writer.writerow([])

    # Section 7: Sentences
    if sentences:
        writer.writerow(["=== SENTENCES ==="])
        writer.writerow(["#", "Sentence"])
        for i, s in enumerate(sentences[:100], 1):
            writer.writerow([i, s if isinstance(s, str) else ""])
        writer.writerow([])

    # Section 8: Token-level analysis
    if tokens:
        writer.writerow(["=== TOKEN ANALYSIS ==="])
        writer.writerow([
            "Token Index",
            "Token Text",
            "Lemma",
            "POS",
            "POS Tag",
            "Is Stop Word",
            "Morphology",
        ])
        for i, token in enumerate(tokens):
            if isinstance(token, dict):
                token_text = token.get("text", "")
                writer.writerow([
                    i,
                    token_text,
                    token.get("lemma", ""),
                    token.get("pos", ""),
                    token.get("tag", ""),
                    "Yes" if token.get("is_stop") else "No",
                    token.get("morph", ""),
                ])
            else:
                writer.writerow([i, str(token), "", "", "", "", ""])

>>>>>>> origin/kirupaN
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
<<<<<<< HEAD
=======

>>>>>>> origin/kirupaN
    return buf.getvalue()