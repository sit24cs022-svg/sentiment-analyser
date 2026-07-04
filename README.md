# AI-Powered Sentiment Analysis System with Active Learning

📌 **Internship Project for AI & ML at Wyntrix Innovation OPC Private Limited**  
**Developed by:** Kayalvizhi V

An interactive sentiment analysis dashboard that classifies text reviews/comments as **Positive**, **Negative**, or **Neutral** in real-time. It features an active learning feedback loop, allowing the machine learning model to incrementally learn from manual user corrections.

---

## 🚀 Key Features

* **Hybrid AI Sentiment Classifier**:
  * **Lexicon-based**: Uses rule-based polarity scores for reliable out-of-the-box predictions.
  * **Machine Learning**: Uses `scikit-learn`'s `SGDClassifier` and `HashingVectorizer` for feedback-driven classification.
* **Active Learning Feedback Loop**:
  * Users can approve predictions or submit corrections (e.g. marking a neutral prediction as positive).
  * The backend triggers online learning (`partial_fit`) on corrected inputs to immediately update the model's weights.
* **Persistent SQLite History**:
  * Saves reviews, predicted sentiment, confidence scores, and user overrides in a local SQLite database (`sentiment.db`).
* **Premium Glassmorphic Dashboard**:
  * Built with HTML5, CSS3, and Vanilla JavaScript.
  * Displays dynamic statistics cards (Total Analyzed, Positive %, Negative %, Neutral %).
  * Renders a real-time sentiment distribution doughnut chart (using **Chart.js**).
  * Includes a paginated history log with search, filters, quick approvals, and deletions.

---

## 🛠️ Technology Stack

* **Frontend**: HTML5, Vanilla CSS (Glassmorphism), JavaScript (ES6+), Chart.js, Lucide Icons
* **Backend**: Python 3.12+, Flask, Flask-CORS, TextBlob, Scikit-Learn
* **Database**: SQLite3

---

## 📂 Repository Structure

```text
sentiment-analyzer/
├── backend/
│   ├── app.py              # Main Flask server and REST API
│   ├── database.py         # SQLite connection and queries
│   ├── model.py            # Hybrid AI/ML classification engine
│   ├── requirements.txt    # Python package dependencies
│   └── test_backend.py     # Automation verification script
├── frontend/
│   ├── css/
│   │   └── style.css       # Premium styles
│   ├── js/
│   │   └── app.js          # Chart rendering, API requests, events
│   └── index.html          # Main HTML structure
└── README.md               # Documentation
```

---

## 🏃 Setup & Installation

Follow these steps to run the application locally:

### 1. Clone the repository
```bash
git clone https://github.com/sit24cs022-svg/sentiment-analyser.git
cd sentiment-analyser
```

### 2. Install dependencies
Ensure you have Python 3.8+ installed, then install required modules:
```bash
pip install -r backend/requirements.txt
```

### 3. Run Verification Tests (Optional)
Run the sanity check script to verify model and database operations:
```bash
python backend/test_backend.py
```

### 4. Launch the application
Run the Flask server:
```bash
python backend/app.py
```

### 5. Access the Dashboard
Open your web browser and navigate to:
**[http://localhost:5000](http://localhost:5000)**
