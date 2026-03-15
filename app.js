const M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const def=[
{name:"Exercise",archived:false,type:"personal"},
{name:"Walk",archived:false,type:"personal"},
{name:"Read",archived:false,type:"personal"},
{name:"Podcast",archived:false,type:"personal"},
{name:"Sleep 7+",archived:false,type:"personal"},
{name:"Cold Shower",archived:false,type:"personal"},
{name:"No Alcohol",archived:false,type:"personal"},
{name:"Plan Day",archived:false,type:"work"}
];

const logDate=new Date(Date.now()-86400000);
const logKey=k(logDate);
let selected=logKey;

let store=JSON.parse(localStorage.getItem("habitV251"))||{};
let meta=JSON.parse(localStorage.getItem("habitMetaV34"))||{baselineWeight:"",goals:[]};

function k(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")}
function p(key){const [y,m]=key.split("-").map(Number);return new Date(y,m-1,1)}
function daysInMonth(key){const d=p(key);return new Date(d.getFullYear(),d.getMonth()+1,0).getDate()}
function fmtDate(d){return d.getDate()+" "+M[d.getMonth()]+" "+d.getFullYear()}
function fmtMonth(key){const d=p(key);return M[d.getMonth()]+" "+d.getFullYear()}
function esc(t){return String(t).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}
function clone(o){return JSON.parse(JSON.stringify(o))}
function prev(key){const d=p(key);d.setMonth(d.getMonth()-1);return k(d)}
function monthKeys(){return Object.keys(store).sort().reverse()}

function ensure(key){
  if(store[key]) {
    if(!store[key].habits) store[key].habits=clone(def);
    if(!store[key].days) store[key].days={};
    if(!store[key].weight) store[key].weight={};
    if(!store[key].moments) store[key].moments={};
    store[key].habits.forEach(h=>{ if(!h.type) h.type="personal"; if(h.archived===undefined) h.archived=false; });
    return;
  }
  const pk=prev(key);
  const prevHabits=clone(store[pk]?.habits||def);
  prevHabits.forEach(h=>{ if(!h.type) h.type="personal"; if(h.archived===undefined) h.archived=false; });
  store[key]={habits:prevHabits,days:{},weight:{},moments:{}}
}

ensure(logKey);
if(!Array.isArray(meta.goals)) meta.goals=[];

function save(){
  localStorage.setItem("habitV251",JSON.stringify(store));
  localStorage.setItem("habitMetaV34",JSON.stringify(meta));
}

function data(key=selected){
  ensure(key);
  return store[key];
}

function activeForDate(h,dateObj){
  const day=dateObj.getDay();
  const weekend=(day===0||day===6);
  if(h.type==="work" && weekend) return false;
  return true;
}

function activeToday(h){
  return activeForDate(h, logDate);
}

function toggleHabit(name,day){
  const d=data();
  d.days[day]=d.days[day]||[];
  d.days[day]=d.days[day].includes(name)
  ?d.days[day].filter(x=>x!==name)
  :[...d.days[day],name];
  save();
  showToday();
}

function setWeight(v,day){
  const d=data();
  d.weight[day]=v;
  save();
}

function setMoment(v,day){
  const d=data();
  d.moments[day]=v;
  save();
}

function monthSelector(){
  const keys=monthKeys();
  return `<div class="card month-picker"><label><strong>Month</strong></label><select onchange="changeMonth(this.value)">${keys.map(x=>`<option value="${x}" ${x===selected?'selected':''}>${fmtMonth(x)}</option>`).join("")}</select></div>`;
}

function maxLoggedDay(key){
  if(key===logKey) return logDate.getDate();
  return daysInMonth(key);
}

function score(key=selected){
  const d=data(key);
  let total=0, done=0;
  for(let i=1;i<=maxLoggedDay(key);i++){
    const dateObj=p(key); dateObj.setDate(i);
    const habits=d.habits.filter(h=>!h.archived && activeForDate(h,dateObj));
    habits.forEach(h=>{
      total++;
      if(d.days[i]?.includes(h.name)) done++;
    });
  }
  return total?Math.round(done/total*100):0;
}

function dayComplete(key,day){
  const d=data(key);
  const dateObj=p(key); dateObj.setDate(day);
  const habits=d.habits.filter(h=>!h.archived && activeForDate(h,dateObj));
  return habits.length>0 && habits.every(h=>d.days[day]?.includes(h.name));
}

function curStreak(key=selected){
  let s=0;
  for(let i=maxLoggedDay(key);i>=1;i--){
    if(dayComplete(key,i)) s++;
    else break;
  }
  return s;
}

function bestStreak(key=selected){
  let b=0,c=0;
  for(let i=1;i<=maxLoggedDay(key);i++){
    if(dayComplete(key,i)){ c++; if(c>b) b=c; }
    else c=0;
  }
  return b;
}

function summaryCards(){
  return `<div class="score-grid">
    <div class="metric">${score()}%<small>Month Score</small></div>
    <div class="metric">${curStreak()}<small>Current Streak</small></div>
    <div class="metric">${bestStreak()}<small>Best Streak</small></div>
  </div>`;
}

function showToday(){
  const d=data();
  const day=logDate.getDate();
  let h=`<div class="card"><strong>Yesterday</strong><br>${fmtDate(logDate)}</div>`;

  const personal=d.habits.filter(x=>!x.archived && x.type!=="work" && activeToday(x));
  const work=d.habits.filter(x=>!x.archived && x.type==="work" && activeToday(x));

  if(personal.length){
    h+=`<div class="section-title">PERSONAL</div>`;
    personal.forEach(x=>{
      const done=d.days[day]?.includes(x.name);
      h+=`<div class="habit" onclick='toggleHabit(${JSON.stringify(x.name)},${day})'>
      <div class="dot ${done?"done":""}"></div>
      <div>${esc(x.name)}</div>
      </div>`;
    });
  }

  if(work.length){
    h+=`<div class="section-title">WORK</div>`;
    work.forEach(x=>{
      const done=d.days[day]?.includes(x.name);
      h+=`<div class="habit" onclick='toggleHabit(${JSON.stringify(x.name)},${day})'>
      <div class="dot ${done?"done":""}"></div>
      <div>${esc(x.name)}</div>
      </div>`;
    });
  }

  h+=`<div class="card">
  <h3>Weight</h3>
  <input type="number" step="0.1" value="${d.weight[day]||""}" onchange="setWeight(this.value,${day})">
  <h3>Memorable Moment</h3>
  <textarea onchange="setMoment(this.value,${day})">${d.moments[day]||""}</textarea>
  </div>`;

  document.getElementById("content").innerHTML=h;
}

function weightSummary(){
  const d=data();
  const entries=Object.keys(d.weight).sort((a,b)=>Number(a)-Number(b)).filter(k=>String(d.weight[k]).trim()!=="");
  const current=entries.length?Number(d.weight[entries[entries.length-1]]):null;
  const baseline=meta.baselineWeight!==""?Number(meta.baselineWeight):null;
  let change=null;
  if(current!==null && baseline!==null && !Number.isNaN(current) && !Number.isNaN(baseline)){
    change=(current-baseline).toFixed(1);
  }
  return {entries,current,baseline,change};
}

function weightCards(){
  const {current,baseline,change}=weightSummary();
  return `<div class="card">
    <h3>Weight</h3>
    <div class="weight-grid">
      <div class="metric">${current!==null && !Number.isNaN(current)?current.toFixed(1):"—"}<small>Current</small></div>
      <div class="metric">${baseline!==null && !Number.isNaN(baseline)?baseline.toFixed(1):"—"}<small>Baseline</small></div>
      <div class="metric">${change!==null?(change>0?"+":"")+change:"—"}<small>Change</small></div>
    </div>
  </div>`;
}

function weightChart(){
  const d=data();
  const entries=Object.keys(d.weight).sort((a,b)=>Number(a)-Number(b)).filter(k=>String(d.weight[k]).trim()!=="");
  if(entries.length<2){
    return `<div class="card"><h3>Weight Trend</h3><div class="muted">Add at least 2 weight entries to see a trend.</div></div>`;
  }
  const values=entries.map(k=>Number(d.weight[k])).filter(v=>!Number.isNaN(v));
  if(values.length<2){
    return `<div class="card"><h3>Weight Trend</h3><div class="muted">Not enough valid weight entries yet.</div></div>`;
  }
  const min=Math.min(...values);
  const max=Math.max(...values);
  const range=max-min || 1;
  const width=320, height=180, pad=18;
  const points=values.map((v,i)=>{
    const x=pad + (i*(width-pad*2))/Math.max(values.length-1,1);
    const y=height-pad - ((v-min)/range)*(height-pad*2);
    return `${x},${y}`;
  }).join(" ");
  const circles=values.map((v,i)=>{
    const x=pad + (i*(width-pad*2))/Math.max(values.length-1,1);
    const y=height-pad - ((v-min)/range)*(height-pad*2);
    return `<circle cx="${x}" cy="${y}" r="3" fill="#007AFF"></circle>`;
  }).join("");
  return `<div class="card"><h3>Weight Trend</h3>
    <svg class="chart" viewBox="0 0 320 180" preserveAspectRatio="none">
      <line x1="18" y1="162" x2="302" y2="162" stroke="#ddd" stroke-width="1"></line>
      <polyline fill="none" stroke="#007AFF" stroke-width="3" points="${points}"></polyline>
      ${circles}
    </svg>
    <div class="muted">Latest ${values.length} entries this month.</div>
  </div>`;
}

function goalCard(){
  if(!meta.goals.length){
    return `<div class="card"><h3>Goals</h3><div class="muted">No goals added yet.</div></div>`;
  }
  return `<div class="card"><h3>Goals</h3>${meta.goals.map((g,i)=>`
    <div class="goal-row">
      <div>${esc(g.text)}<div class="goal-chip">${g.progress || ""}</div></div>
      <div>${g.done?"✅":"•"}</div>
    </div>
  `).join("")}</div>`;
}

function monthGrid(){
  const d=data();
  let h=`<div class="card"><h3>Month View</h3><div class="muted">Scroll sideways to see the whole month.</div></div>`;
  h+=`<div class="grid-wrap"><table><tr><th class="habit-name"></th>`;
  for(let i=1;i<=daysInMonth(selected);i++) h+=`<th>${i}</th>`;
  h+=`</tr>`;
  const hi=selected===logKey?logDate.getDate():-1;
  d.habits.filter(h=>!h.archived).forEach(x=>{
    h+=`<tr><th class="habit-name">${esc(x.name)}</th>`;
    for(let i=1;i<=daysInMonth(selected);i++){
      const done=d.days[i]?.includes(x.name);
      h+=`<td class="cell ${done?'done-cell':'empty-cell'} ${i===hi?'today-cell':''}">${done?'•':''}</td>`;
    }
    h+=`</tr>`;
  });
  h+=`</table></div>`;
  return h;
}

function showProgress(){
  let h=monthSelector();
  h+=summaryCards();
  h+=goalCard();
  h+=weightCards();
  h+=weightChart();
  h+=monthGrid();
  document.getElementById("content").innerHTML=h;
}

function showLife(){
  const d=data();
  let h=monthSelector()+`<div class="card"><h3>Memorable Moments</h3>`;
  const e=Object.keys(d.moments).sort((a,b)=>Number(b)-Number(a));
  let hasRows=false;
  e.forEach(i=>{
    if(!String(d.moments[i]).trim()) return;
    hasRows=true;
    const dt=p(selected); dt.setDate(Number(i));
    h+=`<div class="list-line"><strong>${fmtDate(dt)}</strong><br>${esc(d.moments[i])}</div>`;
  });
  if(!hasRows) h+=`<div class="muted">No memorable moments yet.</div>`;
  h+=`</div>`;
  document.getElementById("content").innerHTML=h;
}

function toggleHabitType(i){
  const d=data();
  d.habits[i].type=d.habits[i].type==="work"?"personal":"work";
  save();
  showSettings();
}

function archiveHabit(i){
  const d=data();
  d.habits[i].archived=true;
  save();
  showSettings();
}

function addHabit(){
  const name=document.getElementById("newHabit").value.trim();
  const type=document.getElementById("habitType").value;
  if(!name) return;
  const d=data();
  d.habits.push({name:name,archived:false,type:type});
  save();
  showSettings();
}

function exportData(){
  const payload={store:store,meta:meta};
  const s="data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(payload));
  const a=document.createElement("a");
  a.href=s;
  a.download="habit-backup.json";
  a.click();
}

function importData(e){
  const file=e.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=function(){
    const parsed=JSON.parse(reader.result);
    if(parsed.store){
      store=parsed.store;
      meta=parsed.meta || meta;
    }else{
      store=parsed;
    }
    Object.keys(store).forEach(key=>ensure(key));
    ensure(logKey);
    if(!meta || typeof meta!=="object") meta={baselineWeight:"",goals:[]};
    if(!Array.isArray(meta.goals)) meta.goals=[];
    save();
    alert("Backup imported successfully");
    showToday();
  };
  reader.readAsText(file);
}

function setBaselineWeight(v){
  meta.baselineWeight=v;
  save();
}

function saveGoals(){
  const text=document.getElementById("goalsText").value;
  const progress=document.getElementById("goalsProgress").value;
  const lines=text.split("\n").map(x=>x.trim()).filter(Boolean);
  const prog=progress.split("\n").map(x=>x.trim());
  meta.goals=lines.map((line,i)=>({
    text:line,
    progress:prog[i]||"",
    done:false
  }));
  save();
  showSettings();
}

function markGoalDone(i){
  meta.goals[i].done=!meta.goals[i].done;
  save();
  showSettings();
}

function showSettings(){
  const d=data();
  let h=`<div class="card"><h3>Habits</h3>`;
  d.habits.forEach((x,i)=>{
    h+=`<div class="row-actions">
    <div>${esc(x.name)}</div>
    <button class="btn secondary" onclick="toggleHabitType(${i})">${x.type==="work"?"Move to Personal":"Move to Work"}</button>
    <button class="btn archive" onclick="archiveHabit(${i})">Archive</button>
    </div>`;
  });
  h+=`<h3>Add Habit</h3>
  <input id="newHabit" type="text" placeholder="New habit">
  <select id="habitType">
    <option value="personal">Personal</option>
    <option value="work">Work</option>
  </select>
  <button class="btn" onclick="addHabit()">Add Habit</button>

  <h3>Goals</h3>
  <div class="muted">One goal per line. Add optional tracking notes in the second box.</div>
  <textarea id="goalsText" placeholder="Read 20 books&#10;Build 2 apps&#10;Run half marathon">${meta.goals.map(g=>g.text).join("\n")}</textarea>
  <textarea id="goalsProgress" placeholder="6 / 20&#10;1 / 2&#10;Training weekly">${meta.goals.map(g=>g.progress||"").join("\n")}</textarea>
  <button class="btn" onclick="saveGoals()">Save Goals</button>
  ${meta.goals.length?meta.goals.map((g,i)=>`<div class="goal-row"><div>${esc(g.text)}</div><button class="btn secondary" onclick="markGoalDone(${i})">${g.done?"Mark Active":"Mark Done"}</button></div>`).join(""):""}

  <h3>Baseline Weight</h3>
  <input type="number" step="0.1" value="${meta.baselineWeight||""}" onchange="setBaselineWeight(this.value)" placeholder="e.g. 80.0">

  <h3>Backup</h3>
  <button class="btn secondary" onclick="exportData()">Export Backup</button>
  <input type="file" onchange="importData(event)">

  <div class="muted">Version 3.4</div>
  </div>`;
  document.getElementById("content").innerHTML=h;
}

function changeMonth(key){
  selected=key;
  ensure(key);
  save();
  showProgress();
}

save();
showToday();
