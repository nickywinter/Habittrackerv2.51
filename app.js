const M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const def=[{name:"Exercise",archived:false},{name:"Walk",archived:false},{name:"Read",archived:false},{name:"Podcast",archived:false},{name:"Sleep 7+",archived:false},{name:"Cold Shower",archived:false},{name:"No Alcohol",archived:false}];
const realToday=new Date(), logDate=new Date(Date.now()-86400000);
const calKey=k(realToday), logKey=k(logDate); let selected=logKey;
let store=JSON.parse(localStorage.getItem("habitV251"))||{};
function k(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")}
function p(key){const [y,m]=key.split("-").map(Number);return new Date(y,m-1,1)}
function fmtDate(d){return d.getDate()+" "+M[d.getMonth()]+" "+d.getFullYear()}
function fmtMonth(key){const d=p(key);return M[d.getMonth()]+" "+d.getFullYear()}
function days(key){const d=p(key);return new Date(d.getFullYear(),d.getMonth()+1,0).getDate()}
function esc(t){return String(t).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function clone(o){return JSON.parse(JSON.stringify(o))}
function prev(key){const d=p(key);d.setMonth(d.getMonth()-1);return k(d)}
function ensure(key){if(store[key]) return; const pk=prev(key); store[key]={habits:clone(store[pk]?.habits||def),days:{},weight:{},moments:{}}}
ensure(logKey); ensure(calKey);
function save(){localStorage.setItem("habitV251",JSON.stringify(store))}
function data(key=selected){ensure(key); return store[key]}
function maxDay(key){if(key===logKey) return logDate.getDate(); if(key===calKey) return 0; return days(key)}
function score(key=selected){const d=data(key); let total=0,done=0; for(let i=1;i<=maxDay(key);i++){d.habits.filter(h=>!h.archived).forEach(h=>{total++; if(d.days[i]?.includes(h.name)) done++;})} return total?Math.round(done/total*100):0}
function dayComplete(d,day){const a=d.habits.filter(h=>!h.archived); return a.length&&a.every(h=>d.days[day]?.includes(h.name))}
function curStreak(key=selected){const d=data(key); let s=0; for(let i=maxDay(key);i>=1;i--){if(dayComplete(d,i)) s++; else break} return s}
function bestStreak(key=selected){const d=data(key); let b=0,c=0; for(let i=1;i<=maxDay(key);i++){if(dayComplete(d,i)){c++; if(c>b) b=c}else c=0} return b}
function monthSel(){const keys=Object.keys(store).sort().reverse(); return `<div class="card"><label><strong>Month</strong></label><select onchange="changeMonth(this.value)">${keys.map(x=>`<option value="${x}" ${x===selected?'selected':''}>${fmtMonth(x)}</option>`).join("")}</select></div>`}
function summary(){return `<div class="score-grid"><div class="metric">${score()}%<small>Month Score</small></div><div class="metric">${curStreak()}<small>Current Streak</small></div><div class="metric">${bestStreak()}<small>Best Streak</small></div></div>`}
function reminder(){if(selected!==logKey) return ""; const d=data(), n=logDate.getDate(); if((d.days[n]&&d.days[n].length)||d.weight[n]||(d.moments[n]&&String(d.moments[n]).trim())) return ""; return `<div class="notice"><strong>Reminder:</strong> yesterday has not been logged yet.</div>`}
function editDay(){return selected===logKey?logDate.getDate():1}
function displayDate(){return selected===logKey?logDate:p(selected)}
function toggleHabit(name,day){const d=data(); d.days[day]=d.days[day]||[]; d.days[day]=d.days[day].includes(name)?d.days[day].filter(x=>x!==name):[...d.days[day],name]; save(); showToday()}
function setWeight(v,day){const d=data(); d.weight[day]=v; save()}
function setMoment(v,day){const d=data(); d.moments[day]=v; save()}
function showToday(){const d=data(), day=editDay(); let h=monthSel()+reminder()+summary()+`<div class="card"><strong>${selected===logKey?"Logging":"Viewing"}:</strong> ${fmtDate(displayDate())}</div>`; d.habits.filter(x=>!x.archived).forEach(x=>{const c=d.days[day]?.includes(x.name)?"checked":""; h+=`<div class="habit" onclick='toggleHabit(${JSON.stringify(x.name)},${day})'><label>${esc(x.name)}</label><input type="checkbox" ${c} onclick="event.stopPropagation()" onchange='toggleHabit(${JSON.stringify(x.name)},${day})'></div>`}); h+=`<div class="card"><h3>Weight</h3><input type="number" step="0.1" value="${d.weight[day]||""}" onchange="setWeight(this.value,${day})"><h3>Memorable Moment</h3><textarea onchange="setMoment(this.value,${day})">${d.moments[day]||""}</textarea><div class="muted">${selected===logKey?"This logs yesterday.":"Viewing previous month."}</div></div>`; document.getElementById("content").innerHTML=h}
function toggleGrid(name,day){const d=data(); d.days[day]=d.days[day]||[]; d.days[day]=d.days[day].includes(name)?d.days[day].filter(x=>x!==name):[...d.days[day],name]; save(); showMonth()}
function showMonth(){const d=data(), hi=selected===logKey?logDate.getDate():-1; let h=monthSel()+summary()+`<div class="card muted">Scroll sideways to see the whole month.</div><div class="grid-wrap"><table><tr><th class="habit-name"></th>`; for(let i=1;i<=days(selected);i++) h+=`<th>${i}</th>`; h+=`</tr>`; d.habits.forEach(x=>{h+=`<tr><th class="habit-name">${esc(x.name)}${x.archived?' <span class="muted">(archived)</span>':''}</th>`; for(let i=1;i<=days(selected);i++){const done=d.days[i]?.includes(x.name); h+=`<td class="cell ${done?'done':'empty'} ${i===hi?'today':''}" onclick='toggleGrid(${JSON.stringify(x.name)},${i})'>${done?'✓':''}</td>`} h+=`</tr>`}); h+=`</table></div>`; document.getElementById("content").innerHTML=h}
function showWeight(){const d=data(); let h=monthSel()+`<div class="card"><h3>Weight Log</h3>`; const e=Object.keys(d.weight).sort((a,b)=>a-b); if(!e.length) h+=`<div class="muted">No weight entries yet.</div>`; else e.forEach(i=>{const dt=p(selected); dt.setDate(Number(i)); h+=`<div class="list-line">${fmtDate(dt)} : ${d.weight[i]} kg</div>`}); h+=`</div>`; document.getElementById("content").innerHTML=h}
function showMoments(){const d=data(); let h=monthSel()+`<div class="card"><h3>Memorable Moments</h3>`; const e=Object.keys(d.moments).sort((a,b)=>a-b); if(!e.length) h+=`<div class="muted">No memorable moments yet.</div>`; else e.forEach(i=>{const dt=p(selected); dt.setDate(Number(i)); h+=`<div class="list-line"><strong>${fmtDate(dt)}</strong><br>${esc(d.moments[i])}</div>`}); h+=`</div>`; document.getElementById("content").innerHTML=h}
function archiveHabit(i){const d=data(); d.habits[i].archived=true; save(); showSettings()}
function restoreHabit(i){const d=data(); d.habits[i].archived=false; save(); showSettings()}
function addHabit(){const input=document.getElementById("newHabit"), v=input.value.trim(); if(!v) return; const d=data(); d.habits.push({name:v,archived:false}); save(); showSettings()}
function exportData(){const s="data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(store)); const a=document.createElement("a"); a.href=s; a.download="habit-backup.json"; a.click()}
function importData(e){const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=function(){store=JSON.parse(r.result); ensure(logKey); ensure(calKey); save(); alert("Backup imported"); showSettings()}; r.readAsText(f)}
function showSettings(){const d=data(); let h=monthSel()+`<div class="card"><h3>Active Habits</h3>`; const a=d.habits.map((x,i)=>({x,i})).filter(o=>!o.x.archived); if(!a.length) h+=`<div class="muted">No active habits.</div>`; else a.forEach(({x,i})=>h+=`<div class="row-actions"><div>${esc(x.name)}</div><button class="btn archive" onclick="archiveHabit(${i})">Archive</button></div>`); h+=`<h3>Archived Habits</h3>`; const ar=d.habits.map((x,i)=>({x,i})).filter(o=>o.x.archived); if(!ar.length) h+=`<div class="muted">No archived habits.</div>`; else ar.forEach(({x,i})=>h+=`<div class="row-actions"><div>${esc(x.name)}</div><button class="btn restore" onclick="restoreHabit(${i})">Restore</button></div>`); h+=`<h3>Add Habit</h3><input id="newHabit" type="text" placeholder="New habit"><button class="btn" onclick="addHabit()">Add Habit</button><h3>Backup</h3><button class="btn secondary" onclick="exportData()">Export Backup</button><input type="file" onchange="importData(event)"></div>`; document.getElementById("content").innerHTML=h}
function changeMonth(key){selected=key; ensure(key); save(); showToday()}
save(); showToday();