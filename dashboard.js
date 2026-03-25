import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// import * as echarts from 'https://cdn.jsdelivr.net/npm/echarts@6.0.0/dist/echarts.esm.min.js'
const echarts = window.echarts
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let state = {
    session: null,
    questions: [],
    charts: {}
}
 
let editingQuestionId = null
 
const REDIRECT_URL = window.location.hostname.includes("localhost")
    ? "http://localhost:3000"
    : "https://glitchmancer-g.github.io/poll-dashboard/"
 
const SURVEY_ID = "735cd0e2-2300-4bdb-bb35-9a1188d33854"
 
// -------------------
// Google Login
// -------------------
document.getElementById("google-login").onclick = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: REDIRECT_URL }
    })
    if (error) console.error("Login error:", error.message)
}
 
// -------------------
// Check session
// -------------------
async function checkSession() {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
        document.getElementById("login-prompt").style.display = "none"
        document.getElementById("dashboard").classList.remove("hidden")
        await loadQuestions()
        await loadStats()
        await loadResults()
    }
}
 
checkSession()
 
// -------------------
// Question CRUD
// -------------------
const questionList       = document.getElementById("questions-list")
const questionEditor     = document.getElementById("question-editor")
const questionTextInput  = document.getElementById("question-text")
const answersContainer   = document.getElementById("answers-container")
const saveBtn            = document.getElementById("save-question")
const cancelBtn          = document.getElementById("cancel-edit")
const addAnswerBtn       = document.getElementById("add-answer")
const addQuestionBtn     = document.getElementById("add-question")
const questionTypeSelect = document.getElementById("question-type")
 
function addAnswerField(value = "") {
    const row = document.createElement("div")
    row.className = "answer-row flex items-center gap-2"
    row.innerHTML = `
        <input type="text" value="${value}" placeholder="Option label"
            class="answer-input flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:border-amber-400 dark:focus:border-amber-400/50 focus:outline-none text-zinc-900 dark:text-zinc-100 text-sm rounded-lg px-3 py-2 placeholder-zinc-400 dark:placeholder-zinc-600 transition-colors">
        <button class="remove-answer shrink-0 w-8 h-8 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 hover:border-red-300 dark:hover:border-red-500/50 hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 rounded-lg text-xs transition-all duration-150 cursor-pointer">✕</button>
    `
    row.querySelector(".remove-answer").onclick = () => row.remove()
    answersContainer.appendChild(row)
}
 
questionTypeSelect.addEventListener("change", () => {
    const isText = questionTypeSelect.value === "text"
    document.getElementById("answers-section").classList.toggle("hidden", isText)
})
 
async function loadQuestions() {
    const { data } = await supabase
        .from("questions").select("*")
        .order("order_index").eq("survey_id", SURVEY_ID)
    state.questions = data || []
    renderQuestionList()
}
 
function renderQuestionList() {
    questionList.innerHTML = ""
    state.questions.forEach((q, index) => {
        const li = document.createElement("li")
        li.className = "question-row flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 rounded-xl transition-all duration-150 group shadow-sm dark:shadow-none"
        li.dataset.id = q.id
        li.draggable = true
 
        const isText = q.question_type === "text"
        const typeTag = isText
            ? `<span class="mono text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shrink-0 uppercase tracking-wide">Text</span>`
            : `<span class="mono text-[10px] font-medium px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 shrink-0 uppercase tracking-wide">MCQ</span>`
 
        li.innerHTML = `
            <span class="drag-handle mono text-lg text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-400 dark:group-hover:text-zinc-500 transition-colors cursor-grab active:cursor-grabbing select-none shrink-0 leading-none">⠿</span>
            <span class="mono text-xs text-zinc-400 dark:text-zinc-600 w-5 shrink-0 text-right">${index + 1}</span>
            ${typeTag}
            <span class="flex-1 text-sm text-zinc-700 dark:text-zinc-300 truncate">${q.question_text}</span>
            <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <button class="btn-edit w-7 h-7 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg text-xs transition-all duration-150 cursor-pointer" title="Edit">✎</button>
                <button class="btn-duplicate w-7 h-7 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg text-xs transition-all duration-150 cursor-pointer" title="Duplicate">⧉</button>
                <button class="btn-delete w-7 h-7 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 hover:border-red-300 dark:hover:border-red-500/50 hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 rounded-lg text-xs transition-all duration-150 cursor-pointer" title="Delete">🗑</button>
            </div>
        `
 
        li.querySelector(".btn-edit").onclick      = () => editQuestion(q)
        li.querySelector(".btn-duplicate").onclick = () => duplicateQuestion(q.id)
        li.querySelector(".btn-delete").onclick    = () => deleteQuestion(q.id)
 
        attachDragEvents(li)
        questionList.appendChild(li)
    })
}
 
// -------------------
// Drag-to-reorder
// -------------------
let dragSrcEl = null
 
function attachDragEvents(el) {
    el.addEventListener("dragstart", onDragStart)
    el.addEventListener("dragover",  onDragOver)
    el.addEventListener("dragleave", onDragLeave)
    el.addEventListener("drop",      onDrop)
    el.addEventListener("dragend",   onDragEnd)
}
 
function onDragStart(e) {
    dragSrcEl = this
    this.classList.add("dragging")
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", this.dataset.id)
}
 
function onDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (this !== dragSrcEl) this.classList.add("drag-over")
}
 
function onDragLeave() { this.classList.remove("drag-over") }
 
function onDrop(e) {
    e.stopPropagation()
    e.preventDefault()
    this.classList.remove("drag-over")
    if (dragSrcEl === this) return
 
    const srcIdx = state.questions.findIndex(q => q.id === dragSrcEl.dataset.id)
    const tgtIdx = state.questions.findIndex(q => q.id === this.dataset.id)
    if (srcIdx === -1 || tgtIdx === -1) return
 
    const [moved] = state.questions.splice(srcIdx, 1)
    state.questions.splice(tgtIdx, 0, moved)
 
    renderQuestionList()
    saveOrder()
}
 
function onDragEnd() {
    document.querySelectorAll(".question-row").forEach(el => {
        el.classList.remove("dragging", "drag-over")
    })
    dragSrcEl = null
}
 
async function saveOrder() {
    const indicator = document.getElementById("save-indicator")
    const dot       = document.getElementById("save-dot")
    const text      = document.getElementById("save-text")
 
    indicator.style.opacity = "1"
    dot.className  = "w-1.5 h-1.5 rounded-full bg-amber-400 inline-block transition-colors"
    text.className = "text-amber-500 dark:text-amber-400"
    text.textContent = "Saving…"
 
    await Promise.all(
        state.questions.map((q, i) =>
            supabase.from("questions").update({ order_index: i }).eq("id", q.id)
        )
    )
 
    dot.className  = "w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block transition-colors"
    text.className = "text-emerald-600 dark:text-emerald-400"
    text.textContent = "Saved"
 
    setTimeout(() => { indicator.style.opacity = "0" }, 1500)
}
 
// -------------------
// Edit / Save
// -------------------
function openEditor(title) {
    document.getElementById("editor-title").textContent = title
    questionEditor.classList.remove("hidden")
    questionEditor.scrollIntoView({ behavior: "smooth", block: "nearest" })
}
 
function editQuestion(q) {
    editingQuestionId = q.id
    questionTextInput.value = q.question_text
    questionTypeSelect.value = q.question_type || "mcq"
 
    const isText = q.question_type === "text"
    document.getElementById("answers-section").classList.toggle("hidden", isText)
 
    answersContainer.innerHTML = ""
    if (!isText) q.data_label.forEach(a => addAnswerField(a))
 
    openEditor("Edit Question")
}
 
saveBtn.onclick = async () => {
    const text = questionTextInput.value.trim()
    if (!text) return alert("Please enter a question.")
 
    const type = questionTypeSelect.value
    const answers = type === "text"
        ? []
        : [...document.querySelectorAll(".answer-input")]
            .map(a => a.value.trim()).filter(Boolean)
 
    const payload = {
        question_text: text,
        question_type: type,
        data_label: answers,
        data_answer: answers,
    }
 
    if (editingQuestionId) {
        await supabase.from("questions").update(payload).eq("id", editingQuestionId)
    } else {
        await supabase.from("questions").insert({
            ...payload,
            order_index: state.questions.length,
            survey_id: SURVEY_ID
        })
    }
 
    questionEditor.classList.add("hidden")
    editingQuestionId = null
    await loadQuestions()
}
 
cancelBtn.onclick = () => {
    questionEditor.classList.add("hidden")
    editingQuestionId = null
}
 
addAnswerBtn.onclick = () => addAnswerField()
 
addQuestionBtn.onclick = () => {
    editingQuestionId = null
    questionTextInput.value = ""
    answersContainer.innerHTML = ""
    questionTypeSelect.value = "mcq"
    document.getElementById("answers-section").classList.remove("hidden")
    addAnswerField()
    openEditor("New Question")
}
 
async function duplicateQuestion(id) {
    const { data } = await supabase.from("questions").select("*").eq("id", id).single()
    const copy = { ...data }
    delete copy.id
    copy.question_text += " (copy)"
    copy.order_index = state.questions.length
    await supabase.from("questions").insert(copy)
    await loadQuestions()
}
 
async function deleteQuestion(id) {
    if (!confirm("Delete this question and all its responses?")) return
    await supabase.from("questions").delete().eq("id", id)
    await loadQuestions()
}
 
// -------------------
// Stats
// -------------------
async function loadStats() {
    const { data: questions } = await supabase.from("questions").select("*").eq("survey_id", SURVEY_ID)
    const ids = (questions || []).map(q => q.id)
    const { data: votes    } = await supabase.from("responses").select("*").in("question_id", ids)
    const { data: sessions } = await supabase.from("survey_sessions").select("*").eq("survey_id", SURVEY_ID)
    document.getElementById("votes").textContent           = (votes    || []).length
    document.getElementById("participants").textContent    = (sessions || []).length
    document.getElementById("questions-count").textContent = (questions || []).length
}
 
// -------------------
// Live Results
// -------------------
const chartsContainer = document.getElementById("charts-container")
 
async function loadResults() {
    // how to wait for the innerHTML assignment to complete?
    await new Promise(resolve => {
        chartsContainer.innerHTML = ""
        requestAnimationFrame(resolve)
    })

    for (let q of state.questions) {
        const card = document.createElement("div")
        card.className = "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm dark:shadow-none"
 
        const title = document.createElement("p")
        title.className = "text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-3 truncate"
        title.textContent = q.question_text
 
        const chartDiv = document.createElement("div")
        chartDiv.id = "chart-" + q.id
        // Only fix height for chart-based questions
        if (q.question_type !== "text") chartDiv.style.height = "200px"
 
        card.appendChild(title)
        card.appendChild(chartDiv)
        chartsContainer.appendChild(card)
        await drawChart(q)
    }
}
 
function isDark() {
    return document.documentElement.classList.contains("dark")
}
 
async function drawChart(q) {
    const { data } = await supabase.from("responses").select("*").eq("question_id", q.id)
 
    if (q.question_type === "text") {
        const chartDiv = document.getElementById("chart-" + q.id);
        const chartData = document.createElement("p");
        chartData.className = "text-sm text-zinc-700 dark:text-zinc-300"
        chartData.textContent = data.map(r => r.answer).filter(Boolean).join("<br/>") || "No responses yet."
        chartDiv.appendChild(chartData)        
        return
    }
 
    const counts = {}
    q.data_answer.forEach(a => counts[a] = 0)
    data.forEach(r => counts[r.answer] = (counts[r.answer] || 0) + 1)
 
    const chart = echarts.init(document.getElementById("chart-" + q.id))
    chart.setOption({
        backgroundColor: "transparent",
        tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
        series: [{
            type: "pie",
            radius: ["40%", "70%"],
            padAngle: 4,
            itemStyle: { borderRadius: 6 },
            label: {
                color: isDark() ? "#a1a1aa" : "#71717a",
                fontSize: 11
            },
            data: q.data_label.map((label, i) => ({
                name: label,
                value: counts[q.data_answer[i]] || 0
            })),
            animationDuration: 1200,
            animationEasing: "elasticOut",
        }]
    })
    state.charts[q.id] = chart
}
 
// Re-render charts when theme changes so label colours update
document.getElementById("theme-toggle").addEventListener("click", () => {
    // Small delay to let the DOM class update first
    setTimeout(() => loadResults(), 50)
})
 
// -------------------
// Export Excel
// -------------------
document.getElementById("export-csv").onclick = async () => {
    const btn = document.getElementById("export-csv")
    btn.textContent = "⏳ Exporting…"
    btn.disabled = true

    if (!window.XLSX) {
        await new Promise((resolve, reject) => {
            const s = document.createElement("script")
            s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
            s.onload = resolve; s.onerror = reject
            document.head.appendChild(s)
        })
    }

    const questionIds = state.questions.map(q => q.id)

    const [{ data: sessions }, { data: responses }] = await Promise.all([
        supabase.from("survey_sessions").select("*").eq("survey_id", SURVEY_ID).order("created_at"),
        supabase.from("responses").select("*").in("question_id", questionIds)
    ])

    const wb = XLSX.utils.book_new()

    // ── Sheet 1: Submissions (one row per session) ────────────────────────
    const answerMap = {}
    ;(responses || []).forEach(r => {
        if (!answerMap[r.session_id]) answerMap[r.session_id] = {}
        answerMap[r.session_id][r.question_id] = r.answer
    })

    const subHeader = [
        "Session ID",
        "Submitted At",
        ...state.questions.map((q, i) => `Q${i + 1}: ${q.question_text}`)
    ]

    const subRows = (sessions || []).map(s => [
        s.id,
        s.created_at ? new Date(s.created_at).toLocaleString() : "",
        ...state.questions.map(q => answerMap[s.id]?.[q.id] ?? "")
    ])

    const rawWs = XLSX.utils.aoa_to_sheet([subHeader, ...subRows])
    rawWs["!freeze"] = { xSplit: 0, ySplit: 1 }
    rawWs["!cols"] = [
        { wch: 38 },
        { wch: 20 },
        ...state.questions.map(() => ({ wch: 32 }))
    ]
    XLSX.utils.book_append_sheet(wb, rawWs, "Submissions")

    // ── Sheet 2: Summary ──────────────────────────────────────────────────
    const summaryRows = []

    state.questions.forEach((q, i) => {
        const qResponses = (responses || []).filter(r => r.question_id === q.id)

        summaryRows.push([`Q${i + 1}`, q.question_text])
        summaryRows.push([])

        if (q.question_type === "text") {
            summaryRows.push(["#", "Answer"])
            if (qResponses.length === 0) {
                summaryRows.push(["", "(no answers yet)"])
            } else {
                qResponses.forEach((r, idx) => summaryRows.push([idx + 1, r.answer]))
            }
        } else {
            const counts = {}
            q.data_answer.forEach(a => counts[a] = 0)
            qResponses.forEach(r => { if (counts[r.answer] !== undefined) counts[r.answer]++ })
            const total = qResponses.length

            summaryRows.push(["Option", "Votes", "Percentage"])
            q.data_label.forEach((label, li) => {
                const votes = counts[q.data_answer[li]] || 0
                const pct   = total > 0 ? (votes / total * 100).toFixed(1) + "%" : "0%"
                summaryRows.push([label, votes, pct])
            })
            summaryRows.push(["Total", total, ""])
        }

        summaryRows.push([])
        summaryRows.push([])
    })

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows)
    summaryWs["!cols"] = [{ wch: 4 }, { wch: 44 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary")

    XLSX.writeFile(wb, "poll-results.xlsx")

    btn.textContent = "↓ Export Excel"
    btn.disabled = false
}

 
// -------------------
// Realtime
// -------------------
supabase.channel("admin-live")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "responses" }, () => {
        loadResults()
        loadStats()
    })
    .subscribe()
 