import os
import json
from typing import Optional
import psycopg2
import psycopg2.extras
from urllib.parse import urlparse, urlunparse
from dotenv import load_dotenv

load_dotenv()

def clean_dsn(url: str) -> str:
    """Remove unsupported query params (like schema) from PostgreSQL DSN."""
    parsed = urlparse(url)
    clean = parsed._replace(query='')
    return urlunparse(clean)

RAW_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5434/policylens")
DATABASE_URL = clean_dsn(RAW_DATABASE_URL)

_conn = None

def get_connection():
    global _conn
    if _conn is None or _conn.closed:
        _conn = psycopg2.connect(DATABASE_URL)
        _conn.autocommit = True
    return _conn

def store_chunks(document_id: str, chunks_with_index: list) -> list:
    """
    Store chunks in DocumentChunk table.
    chunks_with_index: list of (chunk_index, chunk_text)
    Returns list of chunk ids.
    """
    conn = get_connection()
    cursor = conn.cursor()
    chunk_ids = []
    
    for idx, chunk_text in chunks_with_index:
        cursor.execute(
            """
            INSERT INTO "DocumentChunk" (id, "documentId", "chunkText", embedding)
            VALUES (gen_random_uuid()::text, %s, %s, %s)
            RETURNING id
            """,
            (document_id, chunk_text, json.dumps({"idx": idx}))
        )
        chunk_id = cursor.fetchone()[0]
        chunk_ids.append(chunk_id)
    
    cursor.close()
    return chunk_ids

def get_chunks(document_id: str) -> list:
    """
    Retrieve all chunks for a document.
    Returns list of (chunk_index, chunk_text, chunk_id)
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        """
        SELECT id, "chunkText", embedding
        FROM "DocumentChunk"
        WHERE "documentId" = %s
        ORDER BY id
        """,
        (document_id,)
    )
    
    rows = cursor.fetchall()
    cursor.close()
    
    chunks = []
    for chunk_id, chunk_text, embedding_json in rows:
        try:
            emb = json.loads(embedding_json) if embedding_json else {}
            idx = emb.get("idx", 0)
        except (json.JSONDecodeError, TypeError):
            idx = 0
        chunks.append((idx, chunk_text, chunk_id))
    
    return chunks

def store_chat_message(document_id: str, role: str, content: str,
                       grounded_in_document: Optional[bool] = None,
                       cited_clause_id: Optional[str] = None) -> str:
    """Store a chat message and return its id."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        """
        INSERT INTO "ChatMessage" (id, "documentId", role, content,
                                   "groundedInDocument", "citedClauseId")
        VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (document_id, role, content, grounded_in_document, cited_clause_id)
    )
    msg_id = cursor.fetchone()[0]
    cursor.close()
    return msg_id

def get_clauses_for_document(document_id: str) -> list:
    """Retrieve all extracted clauses for a document."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cursor.execute(
        """
        SELECT id, "rawText", "pageNumber", "fieldsJson"
        FROM "ExtractedClause"
        WHERE "documentId" = %s
        """,
        (document_id,)
    )
    
    rows = cursor.fetchall()
    cursor.close()
    return rows

def get_document_text(document_id: str) -> str:
    """Get concatenated document text from all clauses."""
    clauses = get_clauses_for_document(document_id)
    texts = [c["rawText"] for c in clauses if c["rawText"]]
    return "\n\n".join(texts) if texts else ""