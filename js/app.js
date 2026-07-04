// API endpoints
const API_BASE = ""; 

// Global Application State
let historyData = [];
let chartInstance = null;
let currentActiveReview = null; // Stores currently analyzed review {id, text, predicted}

// DOM Elements
const reviewInput = document.getElementById("review-input");
const charCount = document.getElementById("char-count");
const analyzeBtn = document.getElementById("analyze-btn");
const resultPanel = document.getElementById("result-panel");
const resultBadge = document.getElementById("result-badge");
const confidencePercentage = document.getElementById("confidence-percentage");
const confidenceBar = document.getElementById("confidence-bar");

const correctBtn = document.getElementById("correct-btn");
const incorrectDropdownBtn = document.getElementById("incorrect-dropdown-btn");
const feedbackDropdown = document.getElementById("feedback-dropdown");

const searchInput = document.getElementById("search-input");
const sentimentFilter = document.getElementById("sentiment-filter");
const historyTbody = document.getElementById("history-tbody");

const chartPlaceholder = document.getElementById("chart-placeholder");
const chartContainer = document.querySelector(".chart-container");

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
    init();
});

function init() {
    // Initial Lucide Icons rendering
    lucide.createIcons();
    
    // Character Counter
    reviewInput.addEventListener("input", () => {
        const len = reviewInput.value.length;
        charCount.textContent = len;
    });

    // Analyze Button click
    analyzeBtn.addEventListener("click", handleAnalyze);

    // Thumbs-up (Correct) for active analysis
    correctBtn.addEventListener("click", () => {
        if (currentActiveReview) {
            submitFeedback(currentActiveReview.id, currentActiveReview.predicted);
            // Hide result panel or show visual success state
            showFeedbackApplied();
        }
    });

    // Toggle Correction dropdown
    incorrectDropdownBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        feedbackDropdown.classList.toggle("hidden");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", () => {
        feedbackDropdown.classList.add("hidden");
    });

    // Bind dropdown feedback options
    document.querySelectorAll(".feedback-opt").forEach(opt => {
        opt.addEventListener("click", (e) => {
            e.stopPropagation();
            const sentiment = opt.dataset.sentiment;
            if (currentActiveReview && sentiment) {
                submitFeedback(currentActiveReview.id, sentiment);
                showFeedbackApplied(sentiment);
            }
            feedbackDropdown.classList.add("hidden");
        });
    });

    // Filter and Search Listeners
    searchInput.addEventListener("input", filterHistoryTable);
    sentimentFilter.addEventListener("change", filterHistoryTable);

    // Initial load
    loadDashboard();
}

// Fetch all dashboard data
async function loadDashboard() {
    try {
        const [historyRes, statsRes] = await Promise.all([
            fetch(`${API_BASE}/api/history`),
            fetch(`${API_BASE}/api/stats`)
        ]);

        if (historyRes.ok && statsRes.ok) {
            historyData = await historyRes.json();
            const stats = await statsRes.json();
            
            updateStatsCards(stats);
            renderHistoryTable(historyData);
            updateChart(stats);
        } else {
            console.error("Failed to load dashboard data");
        }
    } catch (err) {
        console.error("Error fetching dashboard data:", err);
    }
}

// Update the Top Stats Cards
function updateStatsCards(stats) {
    const totalEl = document.querySelector("#stat-total .stat-value");
    const posValEl = document.querySelector("#stat-positive .stat-value");
    const posCountEl = document.querySelector("#stat-positive .stat-count");
    const negValEl = document.querySelector("#stat-negative .stat-value");
    const negCountEl = document.querySelector("#stat-negative .stat-count");
    const neuValEl = document.querySelector("#stat-neutral .stat-value");
    const neuCountEl = document.querySelector("#stat-neutral .stat-count");

    totalEl.textContent = stats.total;

    if (stats.total > 0) {
        const posPct = ((stats.positive / stats.total) * 100).toFixed(0);
        const negPct = ((stats.negative / stats.total) * 100).toFixed(0);
        const neuPct = ((stats.neutral / stats.total) * 100).toFixed(0);

        posValEl.textContent = `${posPct}%`;
        negValEl.textContent = `${negPct}%`;
        neuValEl.textContent = `${neuPct}%`;
    } else {
        posValEl.textContent = "0%";
        negValEl.textContent = "0%";
        neuValEl.textContent = "0%";
    }

    posCountEl.textContent = `${stats.positive} reviews`;
    negCountEl.textContent = `${stats.negative} reviews`;
    neuCountEl.textContent = `${stats.neutral} reviews`;
}

// Render the History Table rows
function renderHistoryTable(data) {
    historyTbody.innerHTML = "";

    if (data.length === 0) {
        historyTbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">
                    No analysis history found. Start by entering a review above.
                </td>
            </tr>
        `;
        return;
    }

    data.forEach(item => {
        const tr = document.createElement("tr");
        tr.dataset.id = item.id;

        // Format Date
        const dateObj = new Date(item.created_at + "Z"); // SQLite dates are UTC
        // Fallback if Date parsing yields invalid date (Safari / different locales)
        const dateStr = isNaN(dateObj.getTime()) ? item.created_at : dateObj.toLocaleString();

        // Calculate sentiment displays
        const finalSentiment = item.corrected_sentiment || item.predicted_sentiment;
        const isCorrected = item.corrected_sentiment !== null;

        let badgeClass = "badge-neutral";
        if (finalSentiment === "positive") badgeClass = "badge-positive";
        if (finalSentiment === "negative") badgeClass = "badge-negative";

        const confidencePct = (item.confidence * 100).toFixed(0) + "%";

        tr.innerHTML = `
            <td class="date-cell">${dateStr}</td>
            <td class="review-text-cell">${escapeHTML(item.review_text)}</td>
            <td>
                <span class="badge ${badgeClass}">${finalSentiment}</span>
                ${isCorrected ? `<span class="feedback-tag-corrected">(Corrected from ${item.predicted_sentiment})</span>` : ""}
            </td>
            <td class="confidence-cell">${confidencePct}</td>
            <td>
                <div class="action-buttons">
                    ${!isCorrected ? `
                        <button class="action-btn approve-btn" title="Confirm Prediction">
                            <i data-lucide="check"></i>
                        </button>
                    ` : ""}
                    <div class="dropdown-wrapper">
                        <button class="action-btn correct-btn" title="Override/Correct Sentiment">
                            <i data-lucide="edit-3"></i>
                        </button>
                        <div class="dropdown-content hidden">
                            <button class="table-feedback-opt" data-sentiment="positive"><i data-lucide="smile"></i> Positive</button>
                            <button class="table-feedback-opt" data-sentiment="negative"><i data-lucide="frown"></i> Negative</button>
                            <button class="table-feedback-opt" data-sentiment="neutral"><i data-lucide="meh"></i> Neutral</button>
                        </div>
                    </div>
                    <button class="action-btn delete-btn" title="Delete Review">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </td>
        `;

        // Bind Row Specific Event Listeners
        const approveBtn = tr.querySelector(".approve-btn");
        const correctBtnTable = tr.querySelector(".correct-btn");
        const rowDropdown = tr.querySelector(".dropdown-content");
        const deleteBtn = tr.querySelector(".delete-btn");

        if (approveBtn) {
            approveBtn.addEventListener("click", () => {
                submitFeedback(item.id, item.predicted_sentiment);
            });
        }

        correctBtnTable.addEventListener("click", (e) => {
            e.stopPropagation();
            // Close other dropdowns first
            document.querySelectorAll(".dropdown-content").forEach(d => {
                if(d !== rowDropdown) d.classList.add("hidden");
            });
            rowDropdown.classList.toggle("hidden");
        });

        // Make sure clicking options inside table row dropdown submits feedback
        rowDropdown.querySelectorAll(".table-feedback-opt").forEach(opt => {
            opt.addEventListener("click", (e) => {
                e.stopPropagation();
                const sentiment = opt.dataset.sentiment;
                submitFeedback(item.id, sentiment);
                rowDropdown.classList.add("hidden");
            });
        });

        deleteBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to delete this analysis review?")) {
                deleteReview(item.id);
            }
        });

        historyTbody.appendChild(tr);
    });

    // Render newly added Lucide icons
    lucide.createIcons();
}

// Filter history table based on search input and sentiment filter
function filterHistoryTable() {
    const query = searchInput.value.toLowerCase().strip();
    const filter = sentimentFilter.value;

    const filtered = historyData.filter(item => {
        const textMatch = item.review_text.toLowerCase().includes(query);
        const finalSentiment = item.corrected_sentiment || item.predicted_sentiment;
        const sentimentMatch = (filter === "all" || finalSentiment === filter);
        return textMatch && sentimentMatch;
    });

    renderHistoryTable(filtered);
}

// Handle Single Review Analysis submission
async function handleAnalyze() {
    const text = reviewInput.value.trim();
    if (!text) {
        alert("Please enter review text to analyze!");
        return;
    }

    // Button loading state
    analyzeBtn.disabled = true;
    const btnSpan = analyzeBtn.querySelector("span");
    const originalText = btnSpan.textContent;
    btnSpan.textContent = "Analyzing...";

    try {
        const res = await fetch(`${API_BASE}/api/analyze`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text })
        });

        if (res.ok) {
            const data = await res.json();
            
            // Set current active state
            currentActiveReview = {
                id: data.id,
                text: data.review_text,
                predicted: data.predicted_sentiment
            };

            // Display Prediction Results
            displayPredictionResults(data);
            
            // Reload historical list & graphs
            await loadDashboard();
        } else {
            const err = await res.json();
            alert(`Error: ${err.error || "Failed to analyze review"}`);
        }
    } catch (err) {
        console.error("Error analyzing:", err);
        alert("Failed to connect to API backend.");
    } finally {
        analyzeBtn.disabled = false;
        btnSpan.textContent = originalText;
    }
}

// Display Prediction Results in the card
function displayPredictionResults(data) {
    resultPanel.classList.remove("hidden");
    
    // Set Badge Text & Colors
    resultBadge.textContent = data.predicted_sentiment;
    resultBadge.className = "badge"; // reset classes
    
    let colorClass = "badge-neutral";
    let barColorClass = "bar-neutral";
    if (data.predicted_sentiment === "positive") {
        colorClass = "badge-positive";
        barColorClass = "bar-positive";
    } else if (data.predicted_sentiment === "negative") {
        colorClass = "badge-negative";
        barColorClass = "bar-negative";
    }
    
    resultBadge.classList.add(colorClass);

    // Set Confidence Score
    const confPercentageStr = (data.confidence * 100).toFixed(1) + "%";
    confidencePercentage.textContent = confPercentageStr;
    confidenceBar.style.width = confPercentageStr;
    confidenceBar.className = "meter-bar " + barColorClass;

    // Reset feedback UI buttons
    correctBtn.disabled = false;
    correctBtn.innerHTML = '<i data-lucide="thumbs-up"></i> Yes, Correct';
    incorrectDropdownBtn.disabled = false;
    incorrectDropdownBtn.innerHTML = '<i data-lucide="thumbs-down"></i> No, Correct it';
    lucide.createIcons();

    // Scroll slightly to let the user see the result panel
    resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Visual confirmation once feedback is submitted
function showFeedbackApplied(correctedTo = null) {
    correctBtn.disabled = true;
    incorrectDropdownBtn.disabled = true;
    
    if (correctedTo) {
        correctBtn.innerHTML = `<i data-lucide="check-circle"></i> Retrained model!`;
        incorrectDropdownBtn.textContent = `Corrected to ${correctedTo}`;
    } else {
        correctBtn.innerHTML = `<i data-lucide="check-circle"></i> Confirmed!`;
    }
    lucide.createIcons();
}

// Submit sentiment correction / approval feedback
async function submitFeedback(id, correctedSentiment) {
    try {
        const res = await fetch(`${API_BASE}/api/feedback`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ id, corrected_sentiment: correctedSentiment })
        });

        if (res.ok) {
            // Success - refresh details
            loadDashboard();
        } else {
            console.error("Failed to submit feedback");
        }
    } catch (err) {
        console.error("Error submitting feedback:", err);
    }
}

// Delete Analysis item
async function deleteReview(id) {
    try {
        const res = await fetch(`${API_BASE}/api/review/${id}`, {
            method: "DELETE"
        });

        if (res.ok) {
            // If the deleted item is the currently shown active review, hide result card
            if (currentActiveReview && currentActiveReview.id === id) {
                resultPanel.classList.add("hidden");
                currentActiveReview = null;
            }
            loadDashboard();
        } else {
            console.error("Failed to delete review");
        }
    } catch (err) {
        console.error("Error deleting review:", err);
    }
}

// Update / Render ChartJS Doughnut Graph
function updateChart(stats) {
    if (stats.total === 0) {
        chartPlaceholder.classList.remove("hidden");
        chartContainer.classList.add("hidden");
        return;
    }

    chartPlaceholder.classList.add("hidden");
    chartContainer.classList.remove("hidden");

    const ctx = document.getElementById("sentimentChart").getContext("2d");

    const data = {
        labels: ["Positive", "Negative", "Neutral"],
        datasets: [{
            data: [stats.positive, stats.negative, stats.neutral],
            backgroundColor: [
                "#10b981", // Positive - Emerald
                "#f43f5e", // Negative - Rose
                "#f59e0b"  // Neutral - Amber
            ],
            borderColor: "#121826",
            borderWidth: 2,
            hoverOffset: 4
        }]
    };

    if (chartInstance) {
        chartInstance.data = data;
        chartInstance.update();
    } else {
        chartInstance = new Chart(ctx, {
            type: "doughnut",
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            color: "#9ca3af",
                            font: {
                                family: "Outfit",
                                size: 12
                            },
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const val = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((val / total) * 100).toFixed(1) + "%";
                                return ` ${context.label}: ${val} (${pct})`;
                            }
                        }
                    }
                },
                cutout: "70%"
            }
        });
    }
}

// Escape HTML utility helper
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// String polyfill helper
if (!String.prototype.strip) {
    String.prototype.strip = function() {
        return this.replace(/^\s+|\s+$/g, '');
    };
}
