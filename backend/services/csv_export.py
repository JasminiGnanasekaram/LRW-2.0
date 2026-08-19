"""CSV export utilities for processed documents with UTF-8 BOM for Excel compatibility."""
import csv
import io
from typing import List


def document_to_csv(doc: dict) -> str:
    """Export a single document as a structured, spreadsheet-friendly CSV with UTF-8 BOM."""
    buf = io.StringIO()
    # Prepend UTF-8 Byte Order Mark (BOM) so Excel on Windows recognizes Tamil/Sinhala UTF-8 properly
    buf.write("\ufeff")
    writer = csv.writer(buf)

    nlp = doc.get("nlp") or {}
    meta = doc.get("metadata") or {}
    tokens = nlp.get("token_details") or []
    sentences = nlp.get("sentences") or []
    entities = nlp.get("entities") or []
    sentiment = nlp.get("sentiment") or {}
    classif = nlp.get("classification") or {}
    stats = nlp.get("statistics") or {}
    lang_det = nlp.get("language_detection") or {}

    # Section 1: Document Summary & Metadata
    writer.writerow(["=== DOCUMENT SUMMARY ==="])
    writer.writerow(["Field", "Value"])
    writer.writerow(["Filename", doc.get("filename", "")])
    writer.writerow(["File Type", doc.get("file_type", "")])
    writer.writerow(["Primary Language", nlp.get("language", "")])
    writer.writerow(["Language Breakdown", nlp.get("language_display", "")])
    writer.writerow(["Is Multilingual", "Yes" if lang_det.get("is_multilingual") else "No"])
    writer.writerow(["Token Count", nlp.get("token_count", "")])
    writer.writerow(["Unique Tokens", nlp.get("unique_tokens", "")])
    writer.writerow(["Sentence Count", nlp.get("sentence_count", "")])
    writer.writerow(["Character Count", stats.get("characters", "")])
    writer.writerow(["Characters (No Spaces)", stats.get("characters_without_spaces", "")])
    writer.writerow(["Paragraph Count", stats.get("paragraphs", "")])
    writer.writerow(["Overall Sentiment", sentiment.get("label", "")])
    writer.writerow(["Sentiment Score", sentiment.get("score", "")])
    writer.writerow(["Predicted Category", classif.get("predicted_category", classif.get("label_en", ""))])
    writer.writerow(["Category Score", classif.get("score", "")])
    writer.writerow(["Source", meta.get("source", "")])
    writer.writerow(["Domain", meta.get("domain", "")])
    writer.writerow(["License", meta.get("license", "")])
    writer.writerow(["Author", meta.get("author", "")])
    writer.writerow(["Publication Date", meta.get("publication_date", "")])
    writer.writerow(["Created At", doc.get("created_at", "")])
    writer.writerow([])

    # Section 2: Top Keywords
    keywords = nlp.get("top_keywords") or []
    if keywords:
        writer.writerow(["=== TOP KEYWORDS ==="])
        writer.writerow(["#", "Keyword"])
        for i, kw in enumerate(keywords, 1):
            writer.writerow([i, kw])
        writer.writerow([])

    # Section 3: Text Classification
    all_cats = classif.get("all") or []
    if all_cats:
        writer.writerow(["=== TEXT CLASSIFICATION ==="])
        writer.writerow(["Category", "Category (Native)", "Score / Probability"])
        for c in all_cats:
            writer.writerow([
                c.get("label_en", ""),
                c.get("label", ""),
                c.get("score", ""),
            ])
        writer.writerow([])

    # Section 4: Named Entities
    if entities:
        writer.writerow(["=== NAMED ENTITIES ==="])
        writer.writerow(["#", "Entity Text", "Category Code", "Category", "Confidence"])
        for i, e in enumerate(entities, 1):
            writer.writerow([
                i,
                e.get("text", ""),
                e.get("label_en", ""),
                e.get("label", ""),
                e.get("score", ""),
            ])
        writer.writerow([])

    # Section 5: Sentence-Level Sentiment & Analysis
    sent_list = sentiment.get("sentences") or []
    if sent_list:
        writer.writerow(["=== SENTENCE-LEVEL SENTIMENT ==="])
        writer.writerow(["#", "Sentence", "Language", "Sentiment", "Confidence"])
        for i, s_item in enumerate(sent_list, 1):
            writer.writerow([
                i,
                s_item.get("sentence", ""),
                s_item.get("language", ""),
                s_item.get("sentiment", ""),
                s_item.get("confidence", ""),
            ])
        writer.writerow([])
    elif sentences:
        writer.writerow(["=== SENTENCES ==="])
        writer.writerow(["#", "Sentence"])
        for i, s in enumerate(sentences[:100], 1):
            writer.writerow([i, s if isinstance(s, str) else ""])
        writer.writerow([])

    # Section 6: POS Distribution
    pos_dist = nlp.get("pos_distribution") or {}
    if pos_dist:
        writer.writerow(["=== PART-OF-SPEECH DISTRIBUTION ==="])
        writer.writerow(["POS Tag", "Count"])
        for pos, count in sorted(pos_dist.items(), key=lambda x: x[1], reverse=True):
            writer.writerow([pos, count])
        writer.writerow([])

    # Section 7: Top Words Frequency
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

    # Section 8: Detailed Token Analysis
    if tokens:
        writer.writerow(["=== TOKEN-LEVEL ANALYSIS ==="])
        writer.writerow([
            "Index",
            "Token",
            "Normalized",
            "Lemma",
            "POS",
            "Tag",
            "Language",
            "Sentence ID",
            "Morphology",
            "Is Stop Word",
        ])
        for i, token in enumerate(tokens, 1):
            if isinstance(token, dict):
                writer.writerow([
                    i,
                    token.get("token") or token.get("text", ""),
                    token.get("normalized", ""),
                    token.get("lemma", ""),
                    token.get("pos", ""),
                    token.get("tag", ""),
                    token.get("language", ""),
                    token.get("sentence_id", ""),
                    token.get("morph", ""),
                    "Yes" if token.get("is_stop") else "No",
                ])
            else:
                writer.writerow([i, str(token), "", "", "", "", "", "", "", ""])

    return buf.getvalue()


def documents_summary_csv(docs: List[dict]) -> str:
    """Export a summary table of multiple documents with UTF-8 BOM."""
    buf = io.StringIO()
    buf.write("\ufeff")
    writer = csv.writer(buf)

    writer.writerow([
        "ID",
        "Filename",
        "File Type",
        "Primary Language",
        "Language Breakdown",
        "Token Count",
        "Unique Tokens",
        "Sentence Count",
        "Character Count",
        "Sentiment",
        "Sentiment Score",
        "Top Category",
        "Category Score",
        "Top Keywords",
        "Source",
        "Domain",
        "License",
        "Author",
        "Publication Date",
        "Created At",
    ])

    for d in docs:
        meta = d.get("metadata") or {}
        nlp = d.get("nlp") or {}
        sentiment = nlp.get("sentiment") or {}
        classif = nlp.get("classification") or {}
        stats = nlp.get("statistics") or {}
        keywords = nlp.get("top_keywords") or []

        writer.writerow([
            d.get("id", ""),
            d.get("filename", ""),
            d.get("file_type", ""),
            nlp.get("language", ""),
            nlp.get("language_display", ""),
            nlp.get("token_count", ""),
            nlp.get("unique_tokens", ""),
            nlp.get("sentence_count", ""),
            stats.get("characters", ""),
            sentiment.get("label", ""),
            sentiment.get("score", ""),
            classif.get("predicted_category", classif.get("label_en", "")),
            classif.get("score", ""),
            ", ".join(keywords[:5]) if keywords else "",
            meta.get("source", ""),
            meta.get("domain", ""),
            meta.get("license", ""),
            meta.get("author", ""),
            meta.get("publication_date", ""),
            d.get("created_at", ""),
        ])

    return buf.getvalue()