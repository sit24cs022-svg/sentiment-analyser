from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os

import database
from model import SentimentEngine

# Configure Flask app to serve the frontend from the root directory
app = Flask(__name__, static_folder="../", static_url_path="")
CORS(app)  # Enable Cross-Origin Resource Sharing

# Initialize model engine
model_engine = SentimentEngine()

# Initialize DB on startup
database.init_db()

@app.route("/")
def index():
    return app.send_static_file("index.html")

@app.route("/api/analyze", methods=["POST"])
def analyze_sentiment():
    data = request.get_json()
    if not data or "text" not in data or not data["text"].strip():
        return jsonify({"error": "Text is required"}), 400
        
    text = data["text"].strip()
    
    # Predict sentiment using the engine
    sentiment, confidence = model_engine.predict(text)
    
    # Save to SQLite database
    review_id = database.insert_review(text, sentiment, confidence)
    
    return jsonify({
        "id": review_id,
        "review_text": text,
        "predicted_sentiment": sentiment,
        "confidence": confidence,
        "corrected_sentiment": None
    }), 201

@app.route("/api/history", methods=["GET"])
def get_history():
    history = database.get_reviews()
    return jsonify(history)

@app.route("/api/feedback", methods=["POST"])
def submit_feedback():
    data = request.get_json()
    if not data or "id" not in data or "corrected_sentiment" not in data:
        return jsonify({"error": "id and corrected_sentiment are required"}), 400
        
    review_id = data["id"]
    corrected_sentiment = data["corrected_sentiment"].strip().lower()
    
    if corrected_sentiment not in ["positive", "negative", "neutral"]:
        return jsonify({"error": "Invalid sentiment value"}), 400
        
    # Update DB and retrieve the review text for incremental training
    review_text = database.update_review_sentiment(review_id, corrected_sentiment)
    
    if review_text:
        # Perform incremental training on the corrected review
        model_engine.update_model(review_text, corrected_sentiment)
        return jsonify({"success": True, "message": "Feedback recorded, model updated."})
    else:
        return jsonify({"error": "Review not found"}), 404

@app.route("/api/review/<int:review_id>", methods=["DELETE"])
def delete_review(review_id):
    database.delete_review(review_id)
    return jsonify({"success": True, "message": "Review deleted."})

@app.route("/api/stats", methods=["GET"])
def get_stats():
    stats = database.get_sentiment_stats()
    return jsonify(stats)

# Support standard static asset routing for frontend subfolders
@app.route("/css/<path:path>")
def send_css(path):
    return send_from_directory(os.path.join(app.static_folder, "css"), path)

@app.route("/js/<path:path>")
def send_js(path):
    return send_from_directory(os.path.join(app.static_folder, "js"), path)

if __name__ == "__main__":
    # Run server on port 5000
    app.run(host="0.0.0.0", port=5000, debug=True)
