import math
import re
from typing import List, Tuple, Dict, Any

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> List[str]:
    """
    Split text into overlapping chunks, respecting sentence boundaries where possible.
    """
    if not text:
        return []
    
    # Split into sentences
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    
    chunks = []
    i = 0
    while i < len(sentences):
        # Collect sentences until we reach chunk_size
        chunk_sentences = []
        chunk_len = 0
        j = i
        
        while j < len(sentences) and chunk_len < chunk_size:
            sentence = sentences[j]
            sentence_len = len(sentence) + 1  # +1 for space/punctuation
            if chunk_len + sentence_len > chunk_size and chunk_sentences:
                break
            chunk_sentences.append(sentence)
            chunk_len += sentence_len
            j += 1
            
        if chunk_sentences:
            chunk = '. '.join(chunk_sentences) + '.'
            chunks.append(chunk)
            
        # Move to next chunk with overlap
        # Find approximate sentence index for overlap
        overlap_chars = 0
        k = i
        while k < j and overlap_chars < overlap:
            overlap_chars += len(sentences[k]) + 1
            k += 1
        i = max(i + 1, k) if k > i else i + 1
        
        # If we're not making progress, force advance
        if i >= len(sentences):
            break
            
    return chunks

def build_bm25_index(chunks: List[str]) -> Dict[str, Any]:
    """
    Build a simplified BM25 index for retrieval.
    Returns term frequencies and document frequencies for scoring.
    """
    if not chunks:
        return {'doc_term_freqs': [], 'term_doc_freqs': {}, 'avg_doc_len': 0}
    
    doc_term_freqs = []
    term_doc_freqs = {}
    total_terms = 0
    
    for chunk in chunks:
        # Simple tokenization
        terms = re.findall(r'\b\w+\b', chunk.lower())
        total_terms += len(terms)
        
        # Count term frequencies in this document
        term_freq = {}
        for term in terms:
            term_freq[term] = term_freq.get(term, 0) + 1
            
        doc_term_freqs.append(term_freq)
        
        # Update document frequencies
        for term in set(terms):
            term_doc_freqs[term] = term_doc_freqs.get(term, 0) + 1
    
    avg_doc_len = total_terms / len(chunks) if chunks else 0
    
    return {
        'doc_term_freqs': doc_term_freqs,
        'term_doc_freqs': term_doc_freqs,
        'avg_doc_len': avg_doc_len,
        'num_docs': len(chunks)
    }

def retrieve(query: str, index: Dict[str, Any], top_k: int = 5) -> List[Tuple[int, float]]:
    """
    Retrieve top-k chunks using BM25 scoring.
    Returns list of (chunk_index, score) tuples.
    """
    if not query or not index or index['num_docs'] == 0:
        return []
    
    # Simple tokenization of query
    query_terms = re.findall(r'\b\w+\b', query.lower())
    if not query_terms:
        return []
    
    doc_term_freqs = index['doc_term_freqs']
    term_doc_freqs = index['term_doc_freqs']
    avg_doc_len = index['avg_doc_len']
    num_docs = index['num_docs']
    
    # BM25 parameters
    k1 = 1.5
    b = 0.75
    
    scores = []
    
    for doc_idx, term_freq in enumerate(doc_term_freqs):
        doc_len = sum(term_freq.values())
        score = 0.0
        
        for term in query_terms:
            if term in term_freq:
                # Term frequency in document
                tf = term_freq[term]
                
                # Document frequency of term
                df = term_doc_freqs.get(term, 0)
                
                # Inverse document frequency
                idf = math.log((num_docs - df + 0.5) / (df + 0.5) + 1.0)
                
                # BM25 term scoring
                numerator = tf * (k1 + 1)
                denominator = tf + k1 * (1 - b + b * (doc_len / avg_doc_len))
                term_score = idf * (numerator / denominator)
                
                score += term_score
        
        scores.append((doc_idx, score))
    
    # Sort by score descending and take top_k
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:top_k]

# Example usage:
# chunks = chunk_text("Your long document text here...")
# index = build_bm25_index(chunks)
# results = retrieve("your query", index, top_k=3)
# top_chunk_indices = [idx for idx, score in results]