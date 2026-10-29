"use strict";

const STORAGE_KEY = "studentResults";
const LEGACY_STORAGE_KEY = "results";
const THEME_KEY = "studentResultsTheme";
const form = document.getElementById("resultForm");
const resultBox = document.getElementById("resultBox");
const historyTable = document.getElementById("history");
const modeBtn = document.getElementById("modeBtn");
const emptyDashboard = document.getElementById("emptyDashboard");
const formMessage = document.getElementById("formMessage");
const storageMessage = document.getElementById("storageMessage");
const historySearch = document.getElementById("historySearch");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const printBtn = document.getElementById("printBtn");
const chart = document.getElementById("chart");
const chartFallback = document.getElementById("chartFallback");
const subjects = ["Mathematics", "Physics", "Chemistry"];
let results = [];
let currentResult = null;

function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle("error-message", isError);
}

function readResults() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
        if (!saved) return [];

        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) {
            throw new Error("Saved result data is not a list.");
        }

        return parsed
            .filter((record) =>
                record &&
                typeof record.name === "string" &&
                typeof record.roll === "string" &&
                Number.isFinite(Number(record.percentage)) &&
                Number.isFinite(Number(record.cgpa))
            )
            .map((record, index) => ({
                id: typeof record.id === "string" ? record.id : `saved-${index}`,
                name: record.name,
                roll: record.roll,
                percentage: Number(record.percentage),
                cgpa: Number(record.cgpa),
                status: record.status === "FAIL" || (!record.status && Number(record.percentage) < 40) ? "FAIL" : "PASS",
                marks: Array.isArray(record.marks) ? record.marks.map(Number) : [],
                createdAt: typeof record.createdAt === "string" ? record.createdAt : ""
            }));
    } catch (error) {
        showMessage(storageMessage, `Could not read saved results: ${error.message}`, true);
        return [];
    }
}

function saveResults() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
        showMessage(storageMessage, "");
        return true;
    } catch (error) {
        showMessage(storageMessage, `Results could not be saved in this browser: ${error.message}`, true);
        return false;
    }
}

function createResult(name, roll, marks) {
    const total = marks.reduce((sum, mark) => sum + mark, 0);
    const percentage = Number(((total / (subjects.length * 100)) * 100).toFixed(2));
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name,
        roll,
        marks,
        percentage,
        cgpa: Number((percentage / 10).toFixed(2)),
        status: percentage >= 40 ? "PASS" : "FAIL",
        createdAt: new Date().toISOString()
    };
}

function renderCurrentResult(result) {
    currentResult = result;
    document.getElementById("resultName").textContent = result.name;
    document.getElementById("resultRoll").textContent = result.roll;
    document.getElementById("percent").textContent = `${result.percentage}%`;
    document.getElementById("cgpa").textContent = result.cgpa.toFixed(2);

    const status = document.getElementById("status");
    status.textContent = result.status;
    status.classList.toggle("failed", result.status === "FAIL");
    status.classList.toggle("passed", result.status === "PASS");

    resultBox.classList.remove("hidden");
    emptyDashboard.classList.add("hidden");
    printBtn.classList.remove("hidden");
    if (result.marks.length === subjects.length && result.marks.every(Number.isFinite)) {
        drawGraph(result.marks);
    } else {
        chart.classList.add("hidden");
        chartFallback.classList.remove("hidden");
        chartFallback.textContent = "Subject marks are unavailable for this saved record.";
    }
}

function drawGraph(marks) {
    const context = chart.getContext("2d");
    if (!context) {
        chart.classList.add("hidden");
        chartFallback.classList.remove("hidden");
        chartFallback.replaceChildren();
        subjects.forEach((subject, index) => {
            const item = document.createElement("p");
            item.textContent = `${subject}: ${marks[index] ?? "Not available"}`;
            chartFallback.append(item);
        });
        return;
    }

    chart.classList.remove("hidden");
    chartFallback.classList.add("hidden");
    const width = chart.clientWidth || 420;
    const height = 220;
    const scale = window.devicePixelRatio || 1;
    chart.width = width * scale;
    chart.height = height * scale;
    context.scale(scale, scale);
    context.clearRect(0, 0, width, height);

    const styles = getComputedStyle(document.body);
    const muted = styles.getPropertyValue("--muted").trim() || "#64748b";
    const grid = styles.getPropertyValue("--border").trim() || "#e2e8f0";
    const accent = styles.getPropertyValue("--accent").trim() || "#10b981";
    const plotTop = 12;
    const plotBottom = 176;
    const plotHeight = plotBottom - plotTop;
    const left = 34;
    const right = 12;
    const plotWidth = width - left - right;

    context.font = "12px Segoe UI, sans-serif";
    context.textAlign = "right";
    context.textBaseline = "middle";
    for (let tick = 0; tick <= 100; tick += 25) {
        const y = plotBottom - (tick / 100) * plotHeight;
        context.beginPath();
        context.strokeStyle = grid;
        context.moveTo(left, y);
        context.lineTo(width - right, y);
        context.stroke();
        context.fillStyle = muted;
        context.fillText(String(tick), left - 8, y);
    }

    const slot = plotWidth / subjects.length;
    const barWidth = Math.min(54, slot * 0.48);
    marks.forEach((mark, index) => {
        const x = left + slot * index + (slot - barWidth) / 2;
        const barHeight = (mark / 100) * plotHeight;
        context.fillStyle = accent;
        context.fillRect(x, plotBottom - barHeight, barWidth, barHeight);
        context.fillStyle = muted;
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(subjects[index], x + barWidth / 2, plotBottom + 14);
        context.fillStyle = styles.getPropertyValue("--text").trim() || "#1f2937";
        context.fillText(String(mark), x + barWidth / 2, Math.max(plotTop, plotBottom - barHeight - 18));
    });
}

function createCell(text, className = "") {
    const cell = document.createElement("td");
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
}

function renderHistory() {
    historyTable.replaceChildren();
    const query = historySearch.value.trim().toLocaleLowerCase();
    const visibleResults = results.filter((result) =>
        `${result.name} ${result.roll}`.toLocaleLowerCase().includes(query)
    );
    document.getElementById("recordCount").textContent = String(results.length);
    clearHistoryBtn.disabled = results.length === 0;

    if (visibleResults.length === 0) {
        const row = document.createElement("tr");
        const cell = createCell(query ? "No matching results found." : "No results saved yet.");
        cell.colSpan = 6;
        cell.className = "table-empty";
        row.append(cell);
        historyTable.append(row);
        return;
    }

    visibleResults.slice().reverse().forEach((result) => {
        const row = document.createElement("tr");
        row.append(
            createCell(result.name, "student-cell"),
            createCell(result.roll),
            createCell(`${result.percentage.toFixed(2)}%`),
            createCell(result.cgpa.toFixed(2)),
            createCell(result.status, `table-status ${result.status.toLowerCase()}`)
        );

        const actionCell = document.createElement("td");
        const viewButton = document.createElement("button");
        viewButton.type = "button";
        viewButton.className = "row-action";
        viewButton.textContent = "View";
        viewButton.setAttribute("aria-label", `View result for ${result.name}`);
        viewButton.addEventListener("click", () => {
            renderCurrentResult(result);
        });
        actionCell.append(viewButton);
        row.append(actionCell);
        historyTable.append(row);
    });
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.getElementById("name").value.trim();
    const roll = document.getElementById("roll").value.trim();
    const marks = ["sub1", "sub2", "sub3"].map((id) => Number(document.getElementById(id).value));

    if (!name || !roll || marks.some((mark) => !Number.isFinite(mark) || mark < 0 || mark > 100)) {
        showMessage(formMessage, "Enter a name, roll number, and valid marks from 0 to 100.", true);
        return;
    }

    const result = createResult(name, roll, marks);
    results.push(result);
    renderCurrentResult(result);
    renderHistory();
    const saved = saveResults();
    showMessage(formMessage, saved ? "Result generated and saved." : "Result generated, but could not be saved.");
    form.reset();
});

historySearch.addEventListener("input", renderHistory);

clearHistoryBtn.addEventListener("click", () => {
    if (results.length === 0 || !window.confirm("Clear all saved results? This cannot be undone.")) return;
    const previousResults = results;
    results = [];
    if (saveResults()) {
        renderHistory();
        currentResult = null;
        resultBox.classList.add("hidden");
        printBtn.classList.add("hidden");
        emptyDashboard.classList.remove("hidden");
        showMessage(formMessage, "Result history cleared.");
    } else {
        results = previousResults;
        renderHistory();
    }
});

modeBtn.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark");
    modeBtn.textContent = isDark ? "☀️" : "🌙";
    modeBtn.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
    modeBtn.title = `Switch to ${isDark ? "light" : "dark"} mode`;
    try {
        localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    } catch (error) {
        showMessage(storageMessage, `Theme preference could not be saved: ${error.message}`, true);
    }
});

printBtn.addEventListener("click", () => window.print());
window.addEventListener("resize", () => {
    if (currentResult && currentResult.marks.length === subjects.length) {
        drawGraph(currentResult.marks);
    }
});

try {
    if (localStorage.getItem(THEME_KEY) === "dark") {
        document.body.classList.add("dark");
        modeBtn.textContent = "☀️";
        modeBtn.setAttribute("aria-label", "Switch to light mode");
        modeBtn.title = "Switch to light mode";
    }
} catch (error) {
    showMessage(storageMessage, `Theme preference could not be read: ${error.message}`, true);
}

results = readResults();
renderHistory();
