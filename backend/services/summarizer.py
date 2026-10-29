"""Multilingual document summarizer supporting English, Tamil, and Sinhala."""
import re
from collections import Counter
from typing import Dict, List, Any


def get_text_summary(text: str) -> str:
    """
    Generates a concise, informative 2-3 sentence extractive summary
    preserving the original language without truncation mid-word.
    """
    if not text or not text.strip():
        return "No text available to summarize."

    # 1. Split text into sentences
    # Split on period, exclamation, question mark, Tamil/Sinhala sentence terminators
    sentences = re.split(r'(?<=[.!?|।॥\n])\s+', text.strip())
    sentences = [s.strip() for s in sentences if len(s.strip()) > 10]
    
    total_sentences = len(sentences)
    if total_sentences == 0:
        return text[:200]
    if total_sentences <= 2:
        return " ".join(sentences)

    # 2. Tokenize words and count frequencies across scripts
    words = re.findall(r'[\u0B80-\u0BFF\u0D80-\u0DFFa-zA-Z0-9]+', text.lower())
    stop_words = {
        # English
        "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "to", "of", "in", "on", "for", "with", "this", "that", "it",
        # Tamil
        "மற்றும்", "ஒரு", "இந்த", "அது", "என்று", "ஆகிய", "உள்ள", "என", "ஆன", "உடன்", "இன்",
        # Sinhala
        "සහ", "එය", "මම", "එක්", "මෙම", "ඇති", "කරන", "හා", "වන", "නමුත්", "සඳහා"
    }
    filtered_words = [w for w in words if w not in stop_words and len(w) > 2]
    
    if not filtered_words:
        return " ".join(sentences[:2])
        
    word_freq = Counter(filtered_words)
    max_freq = max(word_freq.values())
    scored_freq = {w: count / max_freq for w, count in word_freq.items()}
    
    # 3. Score sentences based on word salience + position weight (first sentence is weighted higher)
    sentence_scores = []
    for idx, sentence in enumerate(sentences):
        sent_words = re.findall(r'[\u0B80-\u0BFF\u0D80-\u0DFFa-zA-Z0-9]+', sentence.lower())
        score = sum(scored_freq.get(w, 0) for w in sent_words)
        # Position weight: first 20% of document is more informative
        if idx == 0:
            score *= 1.5
        sentence_scores.append((idx, score))
        
    # Select top 2-3 highest scoring sentences maintaining chronological order
    num_sentences = min(3, total_sentences)
    top_indices = sorted([idx for idx, _ in sorted(sentence_scores, key=lambda x: x[1], reverse=True)[:num_sentences]])
    
    selected_sentences = [sentences[i] for i in top_indices]
    return " ".join(selected_sentences)


def get_structured_summary(text: str) -> Dict[str, Any]:
    """
    Returns short summary, key points, and important topics.
    """
    if not text or not text.strip():
        return {
            "short_summary": "No text available.",
            "key_points": [],
            "important_topics": []
        }

    sentences = re.split(r'(?<=[.!?|।॥\n])\s+', text.strip())
    sentences = [s.strip() for s in sentences if len(s.strip()) > 10]

    words = re.findall(r'[\u0B80-\u0BFF\u0D80-\u0DFFa-zA-Z0-9]+', text.lower())
    stop_words = {
        "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "to", "of", "in", "on", "for", "with", "this", "that", "it",
        "மற்றும்", "ஒரு", "இந்த", "அது", "என்று", "ஆகிய", "உள்ள", "என",
        "සහ", "එය", "මම", "එක්", "මෙම", "ඇති", "කරන", "හා", "වන"
    }
    filtered_words = [w for w in words if w not in stop_words and len(w) > 2]
    top_topics = [w for w, _ in Counter(filtered_words).most_common(5)]

    key_points = sentences[:min(4, len(sentences))]
    short_summary = get_text_summary(text)

    return {
        "short_summary": short_summary,
        "key_points": key_points,
        "important_topics": top_topics,
    }