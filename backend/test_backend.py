import sys
import os

# Add the current directory to path so we can import local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import database
from model import SentimentEngine

def run_tests():
    print("--- Starting Backend Sanity Verification ---")
    
    # 1. Initialize DB
    print("\n[1/5] Initializing Database...")
    database.init_db()
    if os.path.exists(database.DB_PATH):
        print(f"-> Success: Database created at {database.DB_PATH}")
    else:
        print("-> Error: Database file was not created.")
        return False
        
    # 2. Instantiate ML Engine
    print("\n[2/5] Initializing SentimentEngine...")
    try:
        engine = SentimentEngine()
        print("-> Success: SentimentEngine initialized with active learning.")
    except Exception as e:
        print(f"-> Error: Failed to initialize SentimentEngine: {e}")
        return False

    # 3. Test Predictions
    print("\n[3/5] Testing predictions...")
    test_cases = [
        ("This is the best experience I have ever had! Absolutely amazing.", "positive"),
        ("It was a terrible product, extremely broken and waste of money.", "negative"),
        ("The package arrived on Monday.", "neutral")
    ]
    
    for text, expected in test_cases:
        sent, conf = engine.predict(text)
        print(f"Text: '{text}'")
        print(f"  Predicted: {sent} (Confidence: {conf * 100:.1f}%) [Expected: {expected}]")
        
    # 4. Test Database Operations (Insert & Retrieve)
    print("\n[4/5] Testing Database Operations...")
    test_text = "Highly satisfied with the support quality."
    test_sent, test_conf = engine.predict(test_text)
    review_id = database.insert_review(test_text, test_sent, test_conf)
    print(f"-> Success: Inserted review with ID: {review_id}")
    
    reviews = database.get_reviews()
    inserted_found = any(r["id"] == review_id for r in reviews)
    if inserted_found:
        print("-> Success: Retrieved inserted review from history.")
    else:
        print("-> Error: Could not find inserted review in database.")
        return False
        
    # 5. Test Feedback Loop and Online Learning
    print("\n[5/5] Testing Active Learning Feedback Loop...")
    # Insert a review
    ambiguous_text = "The UI is okay, but it has some minor glitches."
    p_sent, p_conf = engine.predict(ambiguous_text)
    amb_id = database.insert_review(ambiguous_text, p_sent, p_conf)
    print(f"Original Prediction: {p_sent} (Confidence: {p_conf * 100:.1f}%)")
    
    # Correct it to 'negative'
    database.update_review_sentiment(amb_id, "negative")
    engine.update_model(ambiguous_text, "negative")
    print("-> Feedback submitted: Corrected sentiment to 'negative'. Retrained model.")
    
    # Retrieve from DB to verify update
    updated_reviews = database.get_reviews()
    target_review = next((r for r in updated_reviews if r["id"] == amb_id), None)
    if target_review and target_review["corrected_sentiment"] == "negative":
        print("-> Success: Database successfully recorded the corrected sentiment.")
    else:
        print("-> Error: Database did not reflect corrected sentiment.")
        return False
        
    # Test stats
    stats = database.get_sentiment_stats()
    print(f"\nStats Summary: {stats}")
    if stats["total"] >= 2:
        print("-> Success: Statistics calculations are correct.")
    else:
        print("-> Error: Statistics did not match expectation.")
        return False
        
    # Clean up test rows
    database.delete_review(review_id)
    database.delete_review(amb_id)
    print("\n-> Cleaned up test reviews successfully.")
    
    print("\n--- All Backend Sanity Tests Passed! ---")
    return True

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
