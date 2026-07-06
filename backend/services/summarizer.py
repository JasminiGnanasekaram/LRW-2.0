# services/summarizer.py
import re
from collections import Counter

def get_text_summary(text: str) -> str:
    """
    Generates a strict 2-line summary. Truncates long sentences to keep it clean.
    """
    if not text.strip():
        return "No text available to summarize."

    # 1. Split text into sentences
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    sentences = [s.strip() for s in sentences if len(s.strip()) > 5]
    
    total_sentences = len(sentences)
    
    if total_sentences <= 2:
        summary = " ".join(sentences)
    else:
        # 2. Tokenize words and count frequencies
        words = re.findall(r'\w+', text.lower())
        stop_words = {
            "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "to", "of", "in", "on", "for", "with", "this", "that", "it",
            "மற்றும்", "ஒரு", "இந்த", "அது", "என்று", "ஆகிய", "உள்ள",
            "සහ", "එය", "මම", "එක්", "මෙම", "ඇති", "කරන"
        }
        filtered_words = [w for w in words if w not in stop_words and len(w) > 2]
        
        if not filtered_words:
            summary = " ".join([sentences[0], sentences[-1]])
        else:
            word_freq = Counter(filtered_words)
            max_freq = max(word_freq.values())
            for word in word_freq:
                word_freq[word] = word_freq[word] / max_freq
                
            # Score sentences
            sentence_scores = []
            for idx, sentence in enumerate(sentences):
                sentence_words = re.findall(r'\w+', sentence.lower())
                score = sum(word_freq.get(w, 0) for w in sentence_words)
                sentence_scores.append((idx, score))
                
            # Take one sentence from each half of the document
            midpoint = total_sentences // 2
            sec1 = sentence_scores[:midpoint]
            sec2 = sentence_scores[midpoint:]
            
            best_indices = []
            if sec1: best_indices.append(max(sec1, key=lambda x: x[1])[0])
            if sec2: best_indices.append(max(sec2, key=lambda x: x[1])[0])
            best_indices.sort()
            
            # Truncate each sentence to 100 characters so they don't look long
            short_sentences = []
            for idx in best_indices:
                s = sentences[idx]
                if len(s) > 100:
                    s = s[:97] + "..."
                short_sentences.append(s)
            summary = " ".join(short_sentences)

    # Strict total length check (cap at 200 characters to guarantee it takes 2 lines)
    if len(summary) > 200:
        summary = summary[:197] + "..."
        
    return summary