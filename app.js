
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

const realToday=new Date();
const logDate=new Date(Date.now()-86400000);

const calKey=k(realToday);
const logKey=k(logDate);

let selected=logKey;

let store=JSON.parse(localStorage.getItem("habitV251"))||{};

function k(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")}
function p(key){const [y,m]=key.split("-").map(Number);return new Date(y,m-1,1)}
function fmtDate(d){return d.getDate()+" "+M[d.getMonth()]+" "+d.getFullYear()}
function fmtMonth(key){const d=p(key);return M[d.getMonth()]+" "+d.getFullYear()}
function days(key){const d=p(key);return new Date(d.getFullYear(),d.getMonth()+1,0).getDate()}
function esc(t){return String(t).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}
function clone(o){return JSON.parse(JSON.stringify(o))}
function prev(key){const d=p(key);d.setMonth(d.getMonth()-1);return k(d)}

function ensure(key){
if(store[key]) return;
const pk=prev(key);
store[key]={habits:clone(store[pk]?.habits||def),days:{},weight:{},moments:{}}
}

ensure(logKey);
ensure(calKey);

function save(){
localStorage.setItem("habitV251",JSON.stringify(store))
}

function data(key=selected){
ensure(key);
return store[key]
}

function activeToday(h){
const day=displayDate().getDay();
const weekend=(day===0||day===6);
if(h.type==="work" && weekend) return false;
return true;
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

function editDay(){
return selected===logKey?logDate.getDate():1
}

function displayDate(){
return selected===logKey?logDate:p(selected)
}

function showToday(){

const d=data();
const day=editDay();

let h=`<div class="card"><strong>Yesterday</strong><br>${fmtDate(displayDate())}</div>`;

d.habits
.filter(x=>!x.archived && activeToday(x))
.forEach(x=>{

const done=d.days[day]?.includes(x.name);

h+=`
<div class="habit" onclick='toggleHabit(${JSON.stringify(x.name)},${day})'>
<div style="display:flex;align-items:center;gap:10px;">
<div class="dot ${done?"done":""}"></div>
<span>${esc(x.name)}</span>
</div>
</div>`;

});

h+=`<div class="card">
<h3>Weight</h3>
<input type="number" step="0.1" onchange="setWeight(this.value,${day})">
<h3>Memorable Moment</h3>
<textarea onchange="setMoment(this.value,${day})"></textarea>
</div>`;

document.getElementById("content").innerHTML=h;
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

function showProgress(){

const d=data();

let h=`<div class="card"><h3>Weight Log</h3>`;

const e=Object.keys(d.weight).sort((a,b)=>b-a);

if(!e.length){
h+=`<div class="muted">No weight entries yet.</div>`;
}else{

e.forEach(i=>{
const dt=p(selected);
dt.setDate(Number(i));
h+=`<div class="list-line">${fmtDate(dt)} : ${d.weight[i]} kg</div>`;
});

}

h+=`</div>`;

document.getElementById("content").innerHTML=h;
}

function showLife(){

const d=data();

let h=`<div class="card"><h3>Memorable Moments</h3>`;

const e=Object.keys(d.moments).sort((a,b)=>b-a);

if(!e.length){
h+=`<div class="muted">No memorable moments yet.</div>`;
}else{

e.forEach(i=>{
const dt=p(selected);
dt.setDate(Number(i));
h+=`<div class="list-line"><strong>${fmtDate(dt)}</strong><br>${esc(d.moments[i])}</div>`;
});

}

h+=`</div>`;

document.getElementById("content").innerHTML=h;
}

function archiveHabit(i){
const d=data();
d.habits[i].archived=true;
save();
showSettings();
}

function restoreHabit(i){
const d=data();
d.habits[i].archived=false;
save();
showSettings();
}

function addHabit(){

const input=document.getElementById("newHabit");
const type=document.getElementById("habitType");

const v=input.value.trim();
if(!v) return;

const d=data();

d.habits.push({
name:v,
archived:false,
type:type.value
});

save();
showSettings();
}

function showSettings(){

const d=data();

let personal=d.habits.filter(x=>!x.archived && x.type!=="work");
let work=d.habits.filter(x=>!x.archived && x.type==="work");

let h=`<div class="card"><h3>Personal Habits</h3>`;

personal.forEach((x,i)=>{
h+=`<div class="row-actions"><div>${esc(x.name)}</div>
<button class="btn archive" onclick="archiveHabit(${i})">Archive</button></div>`
});

h+=`<h3>Work Habits</h3>`;

work.forEach((x,i)=>{
h+=`<div class="row-actions"><div>${esc(x.name)}</div>
<button class="btn archive" onclick="archiveHabit(${i})">Archive</button></div>`
});

h+=`
<h3>Add Habit</h3>
<input id="newHabit" type="text" placeholder="New habit">

<select id="habitType">
<option value="personal">Personal</option>
<option value="work">Work</option>
</select>

<button class="btn" onclick="addHabit()">Add Habit</button>
</div>`;

document.getElementById("content").innerHTML=h;
}

save();
showToday();
