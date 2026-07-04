import os
import pickle
import numpy as np
from textblob import TextBlob

# Graceful fallback if scikit-learn is not installed (e.g. in Vercel serverless environment)
try:
    from sklearn.linear_model import SGDClassifier
    from sklearn.feature_extraction.text import HashingVectorizer
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    print("Warning: scikit-learn not available. Falling back to TextBlob Lexicon only.")

IS_VERCEL = "VERCEL" in os.environ

if IS_VERCEL:
    MODEL_PATH = "/tmp/sentiment_classifier.pkl"
else:
    MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sentiment_classifier.pkl")

# Predefined classes
CLASSES = ["negative", "neutral", "positive"]

# A tiny seed dataset to initialize the ML model
SEED_DATA = [
    # Positive
    ("I love this product, it is amazing!", "positive"),
    ("Excellent service and highly recommended.", "positive"),
    ("This is the best experience I have had.", "positive"),
    ("Very helpful and friendly staff.", "positive"),
    ("Works perfectly, extremely satisfied.", "positive"),
    ("Great quality, beautiful design.", "positive"),
    # Negative
    ("This is terrible and doesn't work at all.", "negative"),
    ("Worst service ever, very disappointed.", "negative"),
    ("Waste of money and time.", "negative"),
    ("It is broken and crashes constantly.", "negative"),
    ("Extremely poor quality and bad support.", "negative"),
    ("Terrible performance, avoid this.", "negative"),
    # Neutral
    ("It is okay, nothing special.", "neutral"),
    ("Average product, does the job.", "neutral"),
    ("It works as expected, neutral feeling.", "neutral"),
    ("Not good, not bad, just average.", "neutral"),
    ("It is a standard item.", "neutral"),
    ("Does what it says, average experience.", "neutral")
]

class SentimentEngine:
    def __init__(self):
        if SKLEARN_AVAILABLE:
            self.vectorizer = HashingVectorizer(n_features=2**12, alternate_sign=False)
            self.classifier = None
            self.load_or_init_model()
        else:
            self.vectorizer = None
            self.classifier = None

    def load_or_init_model(self):
        """Load the pickled model, or initialize and train it on seed data if it doesn't exist."""
        if os.path.exists(MODEL_PATH):
            try:
                with open(MODEL_PATH, "rb") as f:
                    data = pickle.load(f)
                    self.classifier = data["classifier"]
                return
            except Exception as e:
                print(f"Error loading model, reinitializing: {e}")
        
        # Initialize and pre-train on seed data
        self.classifier = SGDClassifier(loss="log_loss", penalty="l2", alpha=0.001, random_state=42)
        X_seed = [item[0] for item in SEED_DATA]
        y_seed = [item[1] for item in SEED_DATA]
        X_vect = self.vectorizer.transform(X_seed)
        
        # Fit on seed data
        self.classifier.fit(X_vect, y_seed)
        self.save_model()

    def save_model(self):
        """Save the classifier to disk."""
        try:
            with open(MODEL_PATH, "wb") as f:
                pickle.dump({"classifier": self.classifier}, f)
        except Exception as e:
            print(f"Error saving model: {e}")

    def predict_lexicon(self, text):
        """Analyze sentiment using TextBlob lexicon."""
        blob = TextBlob(text)
        polarity = blob.sentiment.polarity
        subjectivity = blob.sentiment.subjectivity
        
        # Classify polarity
        if polarity > 0.15:
            sentiment = "positive"
        elif polarity < -0.15:
            sentiment = "negative"
        else:
            sentiment = "neutral"
            
        # Calculate a pseudo-confidence score based on polarity intensity
        # Neutral scores are less polarity-intense, so we use subjectivity and distance from boundaries
        if sentiment == "neutral":
            confidence = 1.0 - min(abs(polarity) * 2, 0.5)
        else:
            confidence = min(0.5 + abs(polarity) * 0.5, 0.99)
            
        return sentiment, round(float(confidence), 3)

    def predict_ml(self, text):
        """Analyze sentiment using our SGDClassifier."""
        if not SKLEARN_AVAILABLE or self.classifier is None:
            return self.predict_lexicon(text)
        X_vect = self.vectorizer.transform([text])
        probs = self.classifier.predict_proba(X_vect)[0]
        max_idx = np.argmax(probs)
        sentiment = self.classifier.classes_[max_idx]
        confidence = probs[max_idx]
        return sentiment, round(float(confidence), 3)

    def predict(self, text):
        """Hybrid prediction: Combined lexicon + ML logic."""
        if not text.strip():
            return "neutral", 1.0
            
        lex_sent, lex_conf = self.predict_lexicon(text)
        
        if not SKLEARN_AVAILABLE or self.classifier is None:
            return lex_sent, lex_conf
            
        ml_sent, ml_conf = self.predict_ml(text)
        
        # If the ML model is highly confident, we trust it.
        # Otherwise, we use a weighted combination or fallback to Lexicon.
        # This prevents the ML model from drifting too easily on small inputs.
        if ml_conf > 0.65:
            return ml_sent, ml_conf
        
        # Fallback to TextBlob Lexicon
        return lex_sent, lex_conf

    def update_model(self, text, correct_sentiment):
        """Train the classifier on a user correction (Online Learning)."""
        if not SKLEARN_AVAILABLE or self.classifier is None:
            return
        if not text.strip() or correct_sentiment not in CLASSES:
            return
            
        # Run a partial fit with the single corrected example
        X_vect = self.vectorizer.transform([text])
        self.classifier.partial_fit(X_vect, [correct_sentiment], classes=CLASSES)
        self.save_model()
