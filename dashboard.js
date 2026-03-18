import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as echarts from 'https://cdn.jsdelivr.net/npm/echarts@6.0.0/dist/echarts.esm.min.js'

// -------------------
// Supabase setup
// -------------------
const supabase = createClient(
            "https://acdxqepchqvfrmsvxdqg.supabase.co",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjZHhxZXBjaHF2ZnJtc3Z4ZHFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MTg0NzQsImV4cCI6MjA4ODA5NDQ3NH0.q6GZMi0AuQngltrrQJC0Ra7rD7crEwBdNyVTL4y_Qk8"
)

let state = {
    session: null,
    questions: [],
    charts: {}
}

let editingQuestionId = null

// Detect environment to set correct redirect URL
const REDIRECT_URL = window.location.hostname.includes("localhost")
  ? "http://localhost:3000"
  : "https://glitchmancer-g.github.io/poll-dashboard/"

const SURVEY_ID = "735cd0e2-2300-4bdb-bb35-9a1188d33854"

// -------------------
// Google Login
// -------------------
document.getElementById("google-login").onclick = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: REDIRECT_URL
    }
  })
  if (error) console.error("Login error:", error.message)
}

// -------------------
// Check session
// -------------------
async function checkSession(){
    const { data } = await supabase.auth.getSession()
    if(data.session){
        document.getElementById("google-login").style.display="none"
        document.getElementById("dashboard").style.display="block"
        await loadQuestions()
        await loadStats()
        await loadResults()
    }
}

checkSession()

// -------------------
// Question CRUD
// -------------------
const questionList = document.getElementById("questions-list")
const questionEditor = document.getElementById("question-editor")
const questionTextInput = document.getElementById("question-text")
const answersContainer = document.getElementById("answers-container")
const saveBtn = document.getElementById("save-question")
const cancelBtn = document.getElementById("cancel-edit")
const addAnswerBtn = document.getElementById("add-answer")
const addQuestionBtn = document.getElementById("add-question")

function addAnswerField(value=""){
    const row=document.createElement("div")
    row.className="answer-row"
    row.innerHTML=`
        <input class="answer-input" value="${value}">
        <button class="remove-answer">✕</button>
    `
    row.querySelector(".remove-answer").onclick=()=>row.remove()
    answersContainer.appendChild(row)
}

// Load all questions
async function loadQuestions(){
    const { data } = await supabase.from("questions").select("*").order("order_index").eq("survey_id",SURVEY_ID);
    state.questions = data
    renderQuestionList()
}

// Render question list
function renderQuestionList(){
    questionList.innerHTML=""
    state.questions.forEach(q=>{
        const li=document.createElement("li")
        li.className="question-row"
        li.innerHTML=`
            <span class="question-text">${q.question_text}</span>
            <button class="edit">Edit</button>
            <button class="duplicate">Duplicate</button>
            <button class="delete">Delete</button>
        `
        li.querySelector(".edit").onclick=()=>editQuestion(q)
        li.querySelector(".duplicate").onclick=()=>duplicateQuestion(q.id)
        li.querySelector(".delete").onclick=()=>deleteQuestion(q.id)
        questionList.appendChild(li)
    })
}

// Edit question
function editQuestion(q){
    editingQuestionId = q.id
    questionEditor.style.display="block"
    questionTextInput.value = q.question_text
    answersContainer.innerHTML=""
    q.data_label.forEach(a=>addAnswerField(a))
}

// Save question
saveBtn.onclick = async ()=>{
    const text = questionTextInput.value
    const answers = [...document.querySelectorAll(".answer-input")].map(a=>a.value)
    if(editingQuestionId){
        await supabase.from("questions").update({
            question_text:text,
            data_label:answers,
            data_answer:answers
        }).eq("id",editingQuestionId)
    } else {
        await supabase.from("questions").eq("survey_id", SURVEY_ID).insert({
            question_text:text,
            data_label:answers,
            data_answer:answers,
            order_index:state.questions.length
        })
    }
    questionEditor.style.display="none"
    editingQuestionId = null
    await loadQuestions()
}

// Cancel edit
cancelBtn.onclick=()=>{ questionEditor.style.display="none"; editingQuestionId=null }

// Add answer field
addAnswerBtn.onclick=()=>addAnswerField()

// Add new question
addQuestionBtn.onclick=()=>{ editingQuestionId=null; questionEditor.style.display="block"; questionTextInput.value=""; answersContainer.innerHTML=""; addAnswerField() }

// Duplicate question
async function duplicateQuestion(id){
    const { data } = await supabase.from("questions").select("*").eq("id",id).single()
    const copy = {...data}
    delete copy.id
    copy.question_text+=" (copy)"
    await supabase.from("questions").insert(copy)
    await loadQuestions()
}

// Delete question
async function deleteQuestion(id){
    await supabase.from("questions").delete().eq("id",id)
    await loadQuestions()
}

// -------------------
// Votes counter + participation stats
// -------------------
async function loadStats(){
    const { data:votes } = await supabase.from("responses").select("*").where(`question_id.in.(select id from questions where survey_id='${SURVEY_ID}')`)
    const { data:sessions } = await supabase.from("survey_sessions").select("*").eq("survey_id",SURVEY_ID)
    const { data:questions } = await supabase.from("questions").select("*").eq("survey_id",SURVEY_ID)
    document.getElementById("votes").innerText=votes.length
    document.getElementById("participants").innerText=sessions.length
    document.getElementById("questions-count").innerText=questions.length
}

// -------------------
// Live Results Charts
// -------------------
const chartsContainer = document.getElementById("charts-container")
async function loadResults(){
    chartsContainer.innerHTML=""
    for(let q of state.questions){
        const div = document.createElement("div")
        div.id="chart-"+q.id
        div.style.height="250px"
        div.style.background="white"
        div.style.borderRadius="6px"
        div.style.boxShadow="0 0 4px rgba(0,0,0,0.1)"
        chartsContainer.appendChild(div)
        await drawChart(q)
    }
}

async function drawChart(q){
    const { data } = await supabase.from("responses").select("*").eq("question_id",q.id)
    const counts = {}
    q.data_answer.forEach(a=>counts[a]=0)
    data.forEach(r=>counts[r.answer]=(counts[r.answer]||0)+1)
    const chart = echarts.init(document.getElementById("chart-"+q.id))
    chart.setOption({
        tooltip:{trigger:"item",formatter:"{b}: {c} ({d}%)"},
        series:[{
            type:"pie",
            radius:["40%","70%"],
            data:q.data_label.map((label,i)=>({name:label,value:counts[q.data_answer[i]]||0})),
            animation:true,
            animationDuration:1200,
            animationEasing:"elasticOut",
            animationDelay:(idx)=>idx*150
        }]
    })
    state.charts[q.id]=chart
}

// -------------------
// Export CSV
// -------------------
document.getElementById("export-csv").onclick=async ()=>{
    const { data:responses } = await supabase.from("responses").select("*").eq("survey_id",SURVEY_ID)
    let csv="question_id,answer,session_id\n"
    responses.forEach(r=>{ csv+=`${r.question_id},${r.answer},${r.session_id}\n` })
    const blob = new Blob([csv],{type:"text/csv"})
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href=url
    a.download="responses.csv"
    a.click()
    URL.revokeObjectURL(url)
}

// -------------------
// Real-time updates
// -------------------
supabase.channel("admin-live")
.on("postgres_changes",{event:"INSERT",schema:"public",table:"responses"},payload=>{
    loadResults()
    loadStats()
}).subscribe()