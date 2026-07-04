import sqlite3
import os

IS_VERCEL = "VERCEL" in os.environ

if IS_VERCEL:
    DB_PATH = "/tmp/sentiment.db"
else:
    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sentiment.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            review_text TEXT NOT NULL,
            predicted_sentiment TEXT NOT NULL,
            confidence REAL NOT NULL,
            corrected_sentiment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def insert_review(review_text, predicted_sentiment, confidence):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO reviews (review_text, predicted_sentiment, confidence)
        VALUES (?, ?, ?)
    """, (review_text, predicted_sentiment, confidence))
    conn.commit()
    review_id = cursor.lastrowid
    conn.close()
    return review_id

def get_reviews():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, review_text, predicted_sentiment, confidence, corrected_sentiment, created_at
        FROM reviews
        ORDER BY created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def update_review_sentiment(review_id, corrected_sentiment):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # First get the review text to retrain the model if needed
    cursor.execute("SELECT review_text FROM reviews WHERE id = ?", (review_id,))
    row = cursor.fetchone()
    review_text = row["review_text"] if row else None
    
    cursor.execute("""
        UPDATE reviews
        SET corrected_sentiment = ?
        WHERE id = ?
    """, (corrected_sentiment, review_id))
    conn.commit()
    conn.close()
    return review_text

def delete_review(review_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM reviews WHERE id = ?", (review_id,))
    conn.commit()
    conn.close()

def get_sentiment_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # We count based on corrected_sentiment if present, otherwise predicted_sentiment
    cursor.execute("""
        SELECT 
            COALESCE(corrected_sentiment, predicted_sentiment) as sentiment,
            COUNT(*) as count
        FROM reviews
        GROUP BY sentiment
    """)
    rows = cursor.fetchall()
    conn.close()
    
    stats = {"positive": 0, "negative": 0, "neutral": 0, "total": 0}
    for row in rows:
        sentiment = row["sentiment"].lower()
        if sentiment in stats:
            stats[sentiment] = row["count"]
            
    stats["total"] = sum(stats[s] for s in ["positive", "negative", "neutral"])
    return stats
