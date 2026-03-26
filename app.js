// Daymark © 2026 Nick Winter. All rights reserved.
// ─── Version & Constants ──────────────────────────────────────────────────────

const APP_VERSION = "4.7";
const STORE_KEY        = "daymarkV4";
const META_KEY         = "daymarkMetaV4";
const AUTO_BACKUP_KEY  = "daymarkAutoBackup"; // stores timestamp of last auto-backup
const AUTO_BACKUP_DAYS = 7;                   // auto-backup every 7 days
const MONTHS      = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const FULL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const CATEGORY_COLORS = ["#007AFF","#34C759","#FF9500","#FF3B30","#AF52DE","#FF2D55","#5AC8FA","#FFCC00","#FF6B35","#30B0C7"];

// Log date is either today (live mode) or yesterday (reflect mode).
// Determined by meta.loggingStyle — set during onboarding, changeable in Settings.
// Call refreshLogDate() whenever loggingStyle changes.
let DEFAULT_LOG_DATE  = new Date(Date.now() - 86400000); // default: reflect (yesterday)
let CURRENT_MONTH_KEY = monthKey(DEFAULT_LOG_DATE);

function refreshLogDate() {
  const style = meta?.loggingStyle || "reflect";
  DEFAULT_LOG_DATE  = style === "live" ? new Date() : new Date(Date.now() - 86400000);
  CURRENT_MONTH_KEY = monthKey(DEFAULT_LOG_DATE);
}

const DEFAULT_CATEGORIES = [
  { id: "personal", name: "Personal", color: "#007AFF" },
  { id: "work",     name: "Work",     color: "#FF9500" }
];

const DEFAULT_HABITS = [
  { id: "h1", name: "Exercise",     categoryId: "personal", frequency: { type: "daily" },    archived: false },
  { id: "h2", name: "Walk",         categoryId: "personal", frequency: { type: "daily" },    archived: false },
  { id: "h3", name: "Read",         categoryId: "personal", frequency: { type: "daily" },    archived: false },
  { id: "h4", name: "Podcast",      categoryId: "personal", frequency: { type: "daily" },    archived: false },
  { id: "h5", name: "Sleep 7+",     categoryId: "personal", frequency: { type: "daily" },    archived: false },
  { id: "h6", name: "Cold Shower",  categoryId: "personal", frequency: { type: "daily" },    archived: false },
  { id: "h7", name: "No Alcohol",   categoryId: "personal", frequency: { type: "daily" },    archived: false },
  { id: "h8", name: "Plan Day",     categoryId: "work",     frequency: { type: "weekdays" }, archived: false }
];

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function monthKey(d)         { return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0"); }
function monthDate(key)      { const [y,m] = key.split("-").map(Number); return new Date(y,m-1,1); }
function daysInMonth(key)    { const d = monthDate(key); return new Date(d.getFullYear(),d.getMonth()+1,0).getDate(); }
function formatDate(d)       { return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear(); }
function formatMonth(key)    { const d = monthDate(key); return MONTHS[d.getMonth()] + " " + d.getFullYear(); }
function formatFullMonth(key){ const d = monthDate(key); return FULL_MONTHS[d.getMonth()] + " " + d.getFullYear(); }
function getDateForDay(key,day){ const d = monthDate(key); d.setDate(day); return d; }
function prevMonthKey(key)   { const d = monthDate(key); d.setMonth(d.getMonth()-1); return monthKey(d); }
function nextMonthKey(key)   { const d = monthDate(key); d.setMonth(d.getMonth()+1); return monthKey(d); }
function weekKey(d)          { const jan1 = new Date(d.getFullYear(),0,1); return d.getFullYear()+"-W"+String(Math.ceil(((d-jan1)/86400000+jan1.getDay()+1)/7)).padStart(2,"0"); }
function maxLoggedDay(key)   { return key===CURRENT_MONTH_KEY ? Math.min(DEFAULT_LOG_DATE.getDate(),daysInMonth(key)) : daysInMonth(key); }
function getSafeDefaultDay(key){ return key===CURRENT_MONTH_KEY ? Math.min(DEFAULT_LOG_DATE.getDate(),daysInMonth(key)) : 1; }
function isWeekend(dateObj)  { return dateObj.getDay()===0||dateObj.getDay()===6; }
function isWeekday(dateObj)  { return !isWeekend(dateObj); }
function yearKeys(year)      { return Array.from({length:12},(_,i)=>year+"-"+String(i+1).padStart(2,"0")); }

// ─── Utilities ────────────────────────────────────────────────────────────────

function uid()    { return Math.random().toString(36).slice(2,10); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function escapeHtml(t) { return String(t).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(()=>fn(...a),ms); }; }
function formatTimestamp() { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")+"-"+String(d.getHours()).padStart(2,"0")+"-"+String(d.getMinutes()).padStart(2,"0"); }

// ─── State ────────────────────────────────────────────────────────────────────

let state = {
  // Log tab
  logMonthKey:      CURRENT_MONTH_KEY,
  logDay:           getSafeDefaultDay(CURRENT_MONTH_KEY),
  // Progress tab
  progressMonthKey: CURRENT_MONTH_KEY,
  // Life tab
  lifeMonthKey:     CURRENT_MONTH_KEY,
  lifeView:         "moments", // "moments" | "reviews" | "books"
  settingsView:     "habits",   // "habits" | "trackers" | "goals" | "data"
  // Stats tab
  statsYear:        DEFAULT_LOG_DATE.getFullYear(),
  statsHabitId:     null,
  // UI
  currentTab:       "log",
  toastState:       null,
  dialog:           null,
  onboarding:       false,
  scoreCache:       {},
  streakCache:      null,
};

// ─── Storage ──────────────────────────────────────────────────────────────────

// store: { [monthKey]: { days: { [day]: [habitId, ...] }, trackers: { [trackerId]: { [day]: number } }, moments: { [day]: string }, skips: { [day]: [habitId,...] } } }
// meta:  { version, habits, categories, goals, trackers: [{id,name,unit,baseline}], weeklyReviews: { [weekKey]: string } }
// Migrated from: weight/{baselineWeight/weightUnit} -> trackers[0]

let store = {};
let meta  = {};

function loadAll() {
  try { store = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch(e) { store = {}; }
  try {
    const raw = JSON.parse(localStorage.getItem(META_KEY)) || {};
    meta = migrateMeta(raw);
  } catch(e) { meta = freshMeta(); }
}

function freshMeta() {
  return {
    version:       APP_VERSION,
    habits:        clone(DEFAULT_HABITS),
    categories:    clone(DEFAULT_CATEGORIES),
    goals:         [],
    trackers: [{ id: "t0", name: "Weight", unit: "kg", baseline: "" }],
    weeklyReviews: {},
    books: [],
    loggingStyle: "reflect" // "reflect" (yesterday) | "live" (today)
  };
}

function migrateMeta(raw, sourceStore) {
  // Migrate from v3.x formats
  if (!raw.version) {
    // Use provided sourceStore (from import) or fall back to localStorage
    const oldStore = sourceStore || {};
    if (!sourceStore) {
      try {
        const os = JSON.parse(localStorage.getItem("habitV251")) || {};
        Object.assign(oldStore, os);
      } catch(e) {}
    }
    const oldMeta = raw; // raw IS the old meta when importing
    // Also try localStorage meta as fallback for on-load migration
    if (!sourceStore) {
      try {
        const om = JSON.parse(localStorage.getItem("habitMetaV35"))
                || JSON.parse(localStorage.getItem("habitMetaV34"))
                || {};
        Object.assign(oldMeta, om);
      } catch(e) {}
    }

    // Migrate old store days (stored by habit name) — convert to ids based on name match
    const migratedHabits = [];
    const firstMonthKey  = Object.keys(oldStore).sort()[0];
    const sourceHabits   = firstMonthKey ? (oldStore[firstMonthKey].habits || []) : [];

    sourceHabits.forEach((h,i) => {
      migratedHabits.push({
        id:         "mh"+i,
        name:       h.name,
        categoryId: h.type === "work" ? "work" : "personal",
        frequency:  h.type === "work" ? { type: "weekdays" } : { type: "daily" },
        archived:   h.archived || false
      });
    });

    // Migrate store — remap name-keyed days to id-keyed days
    Object.keys(oldStore).forEach(mk => {
      const ms = oldStore[mk];
      // Migrate old weight data into trackers format
      const migratedTrackers = {};
      if (ms.weight && Object.keys(ms.weight).length) {
        migratedTrackers["t0"] = ms.weight;
      }
      store[mk] = { days: {}, trackers: migratedTrackers, moments: ms.moments||{}, skips: {} };
      Object.keys(ms.days||{}).forEach(day => {
        store[mk].days[day] = (ms.days[day]||[]).map(name => {
          const h = migratedHabits.find(x => x.name === name);
          return h ? h.id : null;
        }).filter(Boolean);
      });
    });

    return {
      version:       APP_VERSION,
      habits:        migratedHabits.length ? migratedHabits : clone(DEFAULT_HABITS),
      categories:    clone(DEFAULT_CATEGORIES),
      goals:         (oldMeta.goals||[]).map(g => ({ id: uid(), text: g.text||"", progress: g.progress||"", done: g.done||false, dueDate: "" })),
      trackers: [{ id: "t0", name: "Weight", unit: oldMeta.weightUnit||"kg", baseline: oldMeta.baselineWeight||"" }],
      weeklyReviews: {},
      books: [],
      loggingStyle: "reflect"
    };
  }
  // Already v4 format — just ensure all fields exist
  return {
    version:       APP_VERSION,
    habits:        raw.habits        || clone(DEFAULT_HABITS),
    categories:    raw.categories    || clone(DEFAULT_CATEGORIES),
    goals:         raw.goals         || [],
    trackers: raw.trackers || [{ id: "t0", name: "Weight", unit: raw.weightUnit||"kg", baseline: raw.baselineWeight||"" }],
    weeklyReviews: raw.weeklyReviews || {},
    books: raw.books || [],
    loggingStyle: raw.loggingStyle || "reflect"
  };
}

function saveAll() {
  try {
    localStorage.setItem(STORE_KEY,  JSON.stringify(store));
    localStorage.setItem(META_KEY,   JSON.stringify(meta));
    state.scoreCache  = {};
    state.streakCache = null;
  } catch(e) {
    showToast("⚠️ Storage full — export a backup to free up space.", null);
  }
}

// Migrate existing v4.0–4.2 store months that still have old `weight` key
// instead of the new `trackers` format. Runs once on load.
function migrateStoreToTrackers() {
  let changed = false;
  Object.keys(store).forEach(mk => {
    const ms = store[mk];
    if (ms.weight && Object.keys(ms.weight).length > 0) {
      // Move weight data into trackers["t0"]
      if (!ms.trackers) ms.trackers = {};
      if (!ms.trackers["t0"]) {
        ms.trackers["t0"] = ms.weight;
        changed = true;
      }
      // Remove old weight key
      delete ms.weight;
      changed = true;
    }
  });
  if (changed) saveAll();
}

// ─── Month Data ───────────────────────────────────────────────────────────────

function monthExists(key)  { return !!store[key]; }

// Only create a month record when we're about to WRITE to it
function ensureMonthForWrite(key) {
  if (!store[key]) store[key] = { days:{}, trackers:{}, moments:{}, skips:{} };
  if (!store[key].skips)    store[key].skips = {};
  if (!store[key].trackers) store[key].trackers = {};
}

function monthData(key) {
  return store[key] || { days:{}, trackers:{}, moments:{}, skips:{} };
}

function allMonthKeys() { return Object.keys(store).sort().reverse(); }

// ─── Habit & Category Helpers ─────────────────────────────────────────────────

function getHabit(id)      { return meta.habits.find(h=>h.id===id) || null; }
function getCategory(id)   { return meta.categories.find(c=>c.id===id) || null; }
function activeHabits()    { return meta.habits.filter(h=>!h.archived); }
function archivedHabits()  { return meta.habits.filter(h=>h.archived); }

// Is this habit expected on this date given its frequency?
// specificdays uses days array: [0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat]
function habitActiveOnDate(habit, dateObj) {
  const f = habit.frequency || { type: "daily" };
  switch(f.type) {
    case "daily":        return true;
    case "weekdays":     return isWeekday(dateObj);
    case "weekends":     return isWeekend(dateObj);
    case "specificdays": return Array.isArray(f.days) && f.days.includes(dateObj.getDay());
    default:             return true;
  }
}

// Is habit "satisfied" for this date? (used for streak & score)
function habitSatisfied(habitId, key, day) {
  const md      = monthData(key);
  const habit   = getHabit(habitId);
  if (!habit) return false;
  const dateObj = getDateForDay(key, day);
  if (!habitActiveOnDate(habit, dateObj)) return true; // not expected = counts as satisfied
  if (md.skips[day]?.includes(habitId)) return true;   // explicitly skipped (rest day)
  return md.days[day]?.includes(habitId) || false;
}

// Habits that are expected (shown) on a given date
function expectedHabitsForDate(key, day) {
  const dateObj = getDateForDay(key, day);
  return activeHabits().filter(h => habitActiveOnDate(h, dateObj));
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreForMonth(key) {
  if (state.scoreCache[key] !== undefined) return state.scoreCache[key];
  let total=0, done=0;
  for (let day=1; day<=maxLoggedDay(key); day++) {
    expectedHabitsForDate(key, day).forEach(h => {
      total++;
      if (habitSatisfied(h.id, key, day)) done++;
    });
  }
  const s = total ? Math.round(done/total*100) : 0;
  state.scoreCache[key] = s;
  return s;
}

function dayComplete(key, day) {
  const habits = expectedHabitsForDate(key, day);
  return habits.length > 0 && habits.every(h => habitSatisfied(h.id, key, day));
}

function dayPartialCount(key, day) {
  const habits = expectedHabitsForDate(key, day);
  const done   = habits.filter(h => habitSatisfied(h.id, key, day)).length;
  return { done, total: habits.length };
}

// ─── Streaks ──────────────────────────────────────────────────────────────────

function buildStreakData() {
  if (state.streakCache) return state.streakCache;
  const keys = allMonthKeys().sort();
  let current=0, best=0, running=0;
  let lastWasComplete = false;

  keys.forEach(key => {
    for (let day=1; day<=maxLoggedDay(key); day++) {
      if (dayComplete(key,day)) { running++; if (running>best) best=running; lastWasComplete=true; }
      else { running=0; lastWasComplete=false; }
    }
  });
  current = running; // current streak = running count at end of logged days

  state.streakCache = { current, best };
  return state.streakCache;
}

function streakAtRisk() {
  const { current } = buildStreakData();
  if (current === 0) return false;
  return !dayComplete(CURRENT_MONTH_KEY, maxLoggedDay(CURRENT_MONTH_KEY));
}

// ─── Weekly Review ────────────────────────────────────────────────────────────

function currentWeekKey() { return weekKey(DEFAULT_LOG_DATE); }

function weeklyReviewDue() {
  const dow = DEFAULT_LOG_DATE.getDay(); // 0=Sun, 5=Fri, 6=Sat
  if (dow < 5) return false; // Only prompt Friday, Saturday, Sunday
  const wk = currentWeekKey();
  return !meta.weeklyReviews[wk];
}

function saveWeeklyReview(text) {
  meta.weeklyReviews[currentWeekKey()] = { text, savedAt: new Date().toISOString() };
  saveAll();
}

// ─── Habit CRUD ───────────────────────────────────────────────────────────────

function addHabit(name, categoryId, frequency) {
  const id = uid();
  meta.habits.push({ id, name, categoryId, frequency, archived: false });
  saveAll();
  return id;
}

function renameHabit(id, newName) {
  const h = getHabit(id);
  if (!h) return;
  h.name = newName;
  saveAll();
}

function archiveHabit(id) {
  const h = getHabit(id); if (!h) return;
  h.archived = true;
  saveAll();
}

function restoreHabit(id) {
  const h = getHabit(id); if (!h) return;
  h.archived = false;
  saveAll();
}

function deleteHabitPermanently(id) {
  meta.habits = meta.habits.filter(h => h.id !== id);
  // Remove all log entries for this habit across all months
  Object.keys(store).forEach(mk => {
    const md = store[mk];
    Object.keys(md.days||{}).forEach(day => {
      md.days[day] = (md.days[day]||[]).filter(hid => hid !== id);
    });
    Object.keys(md.skips||{}).forEach(day => {
      md.skips[day] = (md.skips[day]||[]).filter(hid => hid !== id);
    });
  });
  saveAll();
}

function moveHabit(id, direction) {
  const idx = meta.habits.findIndex(h=>h.id===id);
  if (idx<0) return;
  const newIdx = idx+direction;
  if (newIdx<0||newIdx>=meta.habits.length) return;
  const tmp = meta.habits[idx]; meta.habits[idx]=meta.habits[newIdx]; meta.habits[newIdx]=tmp;
  saveAll();
  renderSettings();
}

function updateHabitFrequency(id, frequency) {
  const h = getHabit(id); if (!h) return;
  h.frequency = frequency;
  saveAll();
}

function updateHabitCategory(id, categoryId) {
  const h = getHabit(id); if (!h) return;
  h.categoryId = categoryId;
  saveAll();
}

// ─── Category CRUD ────────────────────────────────────────────────────────────

function addCategory(name, color) {
  const id = uid();
  meta.categories.push({ id, name, color });
  saveAll();
  return id;
}

function renameCategory(id, name) {
  const c = getCategory(id); if (!c) return;
  c.name = name; saveAll();
}

function deleteCategory(id) {
  // Move all habits in this category to first remaining category
  const fallback = meta.categories.find(c=>c.id!==id);
  meta.habits.forEach(h => { if (h.categoryId===id) h.categoryId = fallback?.id||"personal"; });
  meta.categories = meta.categories.filter(c=>c.id!==id);
  saveAll();
}

// ─── Goal CRUD ────────────────────────────────────────────────────────────────

function addGoal(text, dueDate="") {
  meta.goals.push({ id: uid(), text, progress:"", done:false, dueDate });
  saveAll();
}

function updateGoal(id, patch) {
  const g = meta.goals.find(g=>g.id===id); if (!g) return;
  Object.assign(g, patch); saveAll();
}

function deleteGoal(id) {
  meta.goals = meta.goals.filter(g=>g.id!==id); saveAll();
}

function toggleGoalDone(id) {
  const g = meta.goals.find(g=>g.id===id); if (!g) return;
  g.done = !g.done; saveAll();
}

// ─── Log Actions ──────────────────────────────────────────────────────────────

function toggleHabit(habitId, key, day) {
  ensureMonthForWrite(key);
  const md = store[key];
  md.days[day] = md.days[day] || [];
  const before = clone(md.days[day]);
  if (md.days[day].includes(habitId)) {
    md.days[day] = md.days[day].filter(x=>x!==habitId);
  } else {
    md.days[day] = [...md.days[day], habitId];
    // Remove skip if was skipped
    if (md.skips[day]) md.skips[day] = md.skips[day].filter(x=>x!==habitId);
  }
  saveAll();
  if (navigator.vibrate) navigator.vibrate(30);
  renderLog();
  showToast("Habit updated", () => {
    md.days[day] = before; saveAll(); renderLog();
  });
}

function toggleSkip(habitId, key, day) {
  ensureMonthForWrite(key);
  const md = store[key];
  md.skips[day] = md.skips[day] || [];
  if (md.skips[day].includes(habitId)) {
    md.skips[day] = md.skips[day].filter(x=>x!==habitId);
  } else {
    md.skips[day] = [...md.skips[day], habitId];
    // Remove done if was done
    if (md.days[day]) md.days[day] = md.days[day].filter(x=>x!==habitId);
  }
  saveAll();
  renderLog();
}

const saveTrackerValue = debounce((trackerId, v, key, day) => {
  ensureMonthForWrite(key);
  if (!store[key].trackers[trackerId]) store[key].trackers[trackerId] = {};
  store[key].trackers[trackerId][day] = v;
  saveAll();
}, 600);
const saveMoment  = debounce((v, key, day) => { ensureMonthForWrite(key); store[key].moments[day] = v; saveAll(); }, 600);

// ─── Export / Import ──────────────────────────────────────────────────────────

// ─── Tracker CRUD ────────────────────────────────────────────────────────────

function getTrackers() { return meta.trackers || []; }

function addTracker(name, unit, baseline) {
  if (getTrackers().length >= 3) { showToast("Maximum 3 trackers", null); return; }
  meta.trackers.push({ id: "t"+uid(), name, unit, baseline: baseline||"" });
  saveAll();
}

function updateTracker(id, patch) {
  const t = meta.trackers.find(t=>t.id===id); if (!t) return;
  Object.assign(t, patch); saveAll();
}

function deleteTracker(id) {
  meta.trackers = meta.trackers.filter(t=>t.id!==id);
  // Remove data from all months
  Object.keys(store).forEach(mk => {
    if (store[mk].trackers) delete store[mk].trackers[id];
  });
  saveAll();
}

function trackerSummary(trackerId, key) {
  const md = monthData(key);
  const data = md.trackers?.[trackerId] || {};
  const entries = Object.keys(data).sort((a,b)=>Number(a)-Number(b))
    .filter(d => String(data[d]).trim() !== "");
  const current = entries.length ? Number(data[entries[entries.length-1]]) : null;
  const tracker = meta.trackers?.find(t=>t.id===trackerId);
  const baseline = tracker?.baseline !== "" ? Number(tracker?.baseline) : null;
  let change = null;
  if (current!==null && baseline!==null && !isNaN(current) && !isNaN(baseline)) {
    change = (current - baseline).toFixed(1);
  }
  return { entries, current, baseline, change, data };
}

function exportJSON() {
  const payload = { version: APP_VERSION, store, meta };
  const uri = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload));
  const a = document.createElement("a");
  a.href = uri; a.download = `daymark-backup-${formatTimestamp()}.json`; a.click();
  // Reset auto-backup timer so we don't double-export shortly after
  resetAutoBackupTimer();
}

// ─── Logging Style ───────────────────────────────────────────────────────────

function setLoggingStyle(style) {
  meta.loggingStyle = style;
  refreshLogDate();
  // Reset log navigation to new default day
  state.logMonthKey = CURRENT_MONTH_KEY;
  state.logDay      = getSafeDefaultDay(CURRENT_MONTH_KEY);
  saveAll();
}

// ─── Books ───────────────────────────────────────────────────────────────────

function getBooks() { return meta.books || []; }

function addBook(title, startDate) {
  meta.books.push({
    id:        uid(),
    title,
    startDate, // "YYYY-MM-DD"
    endDate:   "",
    notes:     "",
    abandoned: false
  });
  saveAll();
}

function updateBook(id, patch) {
  const b = meta.books.find(b=>b.id===id); if (!b) return;
  Object.assign(b, patch); saveAll();
}

function deleteBook(id) {
  meta.books = meta.books.filter(b=>b.id!==id); saveAll();
}

function finishBook(id, endDate) {
  updateBook(id, { endDate });
}

function bookDays(book) {
  if (!book.startDate || !book.endDate) return null;
  const start = new Date(book.startDate);
  const end   = new Date(book.endDate);
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function booksFinishedThisYear(year) {
  return getBooks().filter(b => b.endDate && b.endDate.startsWith(String(year)));
}

function currentlyReading() {
  return getBooks().filter(b => b.startDate && !b.endDate && !b.abandoned);
}

function bookGoalProgress() {
  // Find goals that mention "book" and link count automatically
  const year     = DEFAULT_LOG_DATE.getFullYear();
  const finished = booksFinishedThisYear(year).length;
  const goal     = meta.goals.find(g => /book/i.test(g.text)); // show regardless of done status
  return { finished, goal };
}

// ─── Auto Backup ──────────────────────────────────────────────────────────────

function autoBackupIfDue() {
  // Don't run if there's no real data yet
  if (!allMonthKeys().length) return;

  const lastBackup = localStorage.getItem(AUTO_BACKUP_KEY);
  const now        = Date.now();
  const dayMs      = 86400000;

  if (lastBackup && (now - parseInt(lastBackup)) < AUTO_BACKUP_DAYS * dayMs) return;

  // Due — trigger silent download
  silentExportJSON();
  localStorage.setItem(AUTO_BACKUP_KEY, String(now));
  showToast("📦 Weekly backup saved to your Downloads folder", null);
}

function silentExportJSON() {
  const payload = { version: APP_VERSION, store, meta };
  const uri = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload));
  const a = document.createElement("a");
  a.href = uri;
  a.download = `daymark-backup-${formatTimestamp()}.json`;
  // Small delay so it doesn't fight with page load
  setTimeout(() => a.click(), 1500);
}

function resetAutoBackupTimer() {
  localStorage.setItem(AUTO_BACKUP_KEY, String(Date.now()));
}

function autoBackupStatus() {
  const last = localStorage.getItem(AUTO_BACKUP_KEY);
  if (!last) return "No automatic backup yet";
  const days = Math.floor((Date.now() - parseInt(last)) / 86400000);
  if (days === 0) return "Last auto-backup: today";
  if (days === 1) return "Last auto-backup: yesterday";
  return `Last auto-backup: ${days} days ago`;
}

function exportCSV() {
  const habits = meta.habits.filter(h=>!h.archived);
  const rows   = [["Date","Habit","Category","Done","Skipped"]];
  allMonthKeys().sort().forEach(mk => {
    for (let day=1; day<=maxLoggedDay(mk); day++) {
      const dateObj  = getDateForDay(mk, day);
      const md       = monthData(mk);
      habits.forEach(h => {
        if (!habitActiveOnDate(h, dateObj)) return;
        const done    = md.days[day]?.includes(h.id) || false;
        const skipped = md.skips[day]?.includes(h.id) || false;
        const cat     = getCategory(h.categoryId);
        rows.push([formatDate(dateObj), h.name, cat?.name||"", done?"1":"0", skipped?"1":"0"]);
      });
    }
  });
  const csv = rows.map(r=>r.map(c=>'"'+String(c).replaceAll('"','""')+'"').join(",")).join("\n");
  const uri = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  const a = document.createElement("a");
  a.href = uri; a.download = `daymark-export-${formatTimestamp()}.csv`; a.click();
}

function importJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (parsed.version && parsed.store && parsed.meta) {
        // v4 native format — use directly, then migrate store if needed
        store = parsed.store;
        meta  = parsed.meta;
        // Ensure trackers field exists in meta (v4.0-4.2 backups won't have it)
        if (!meta.trackers) {
          meta.trackers = [{ id: "t0", name: "Weight", unit: meta.weightUnit||"kg", baseline: meta.baselineWeight||"" }];
        }
        // Ensure books field exists (v4.0-4.4 backups won't have it)
        if (!meta.books) meta.books = [];
        // Ensure weeklyReviews exists
        if (!meta.weeklyReviews) meta.weeklyReviews = {};
        // Ensure loggingStyle exists (v4.0-4.5 backups won't have it)
        if (!meta.loggingStyle) meta.loggingStyle = "reflect";
        // Migrate old weight keys to trackers format
        migrateStoreToTrackers();
      } else if (parsed.store) {
        // v3 format — migrate meta AND remap store days from names to IDs
        // migrateMeta writes remapped days into store as a side effect
        store = {};
        meta  = migrateMeta(parsed.meta || {}, parsed.store);
        // Carry over any months migrateMeta didn't touch
        Object.keys(parsed.store).forEach(mk => {
          if (!store[mk]) store[mk] = parsed.store[mk];
        });
      } else {
        showDialog("Import failed", "The file doesn't look like a valid Daymark backup.", [{label:"OK",action:closeDialog}]);
        return;
      }
      state.logMonthKey      = CURRENT_MONTH_KEY;
      state.progressMonthKey = CURRENT_MONTH_KEY;
      state.lifeMonthKey     = CURRENT_MONTH_KEY;
      state.logDay           = getSafeDefaultDay(CURRENT_MONTH_KEY);
      saveAll();
      showToast("Backup imported successfully", null);
      showTab("log");
    } catch(e) {
      showDialog("Import failed", "Could not parse the file. Make sure it's a valid Daymark JSON backup.", [{label:"OK",action:closeDialog}]);
    }
  };
  reader.readAsText(file);
}

async function checkStorageUsage() {
  if (!navigator.storage?.estimate) {
    showDialog("Storage", "Storage estimate not available on this browser.", [{label:"OK",action:closeDialog}]);
    return;
  }
  const est = await navigator.storage.estimate();
  const pct = est.quota ? Math.round((est.usage||0)/est.quota*100) : 0;
  const msg = `Using ${pct}% of available storage (${Math.round((est.usage||0)/1024)}KB of ${Math.round((est.quota||0)/1024/1024)}MB).`
    + (pct>=80 ? "\n\nWarning: you're approaching the storage limit. Export a backup and consider clearing old data." : "");
  showDialog("Storage Usage", msg, [{label:"OK",action:closeDialog}]);
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(message, undoFn) {
  state.toastState = { message, undoFn };
  const old = document.getElementById("toast"); if (old) old.remove();
  const div = document.createElement("div");
  div.id = "toast"; div.className = "toast";
  div.innerHTML = undoFn
    ? `<span>${escapeHtml(message)}</span><button type="button" onclick="undoToast()">Undo</button>`
    : `<span>${escapeHtml(message)}</span>`;
  document.body.appendChild(div);
  setTimeout(() => {
    const live = document.getElementById("toast");
    if (live && state.toastState?.message === message) { state.toastState=null; live.remove(); }
  }, 4000);
}

function clearToast() {
  state.toastState = null;
  const old = document.getElementById("toast"); if (old) old.remove();
}

function undoToast() {
  if (!state.toastState) return;
  const fn = state.toastState.undoFn;
  clearToast(); if (fn) fn();
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

function showDialog(title, message, buttons) {
  closeDialog();
  const overlay = document.createElement("div");
  overlay.id = "dialog-overlay";
  overlay.className = "dialog-overlay";
  overlay.innerHTML = `
    <div class="dialog">
      <div class="dialog-title">${escapeHtml(title)}</div>
      <div class="dialog-body">${escapeHtml(message)}</div>
      <div class="dialog-btns">${
        buttons.map((b,i)=>`<button class="dialog-btn ${b.danger?'danger':''}" onclick="dialogAction(${i})">${escapeHtml(b.label)}</button>`).join("")
      }</div>
    </div>`;
  document.body.appendChild(overlay);
  state.dialog = { buttons };
}

function dialogAction(i) {
  const btn = state.dialog?.buttons[i];
  // Run the action BEFORE closing so the action can still read dialog DOM elements
  if (btn?.action) btn.action();
  closeDialog();
}

function closeDialog() {
  const old = document.getElementById("dialog-overlay"); if (old) old.remove();
  state.dialog = null;
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

function isFirstRun() {
  return !localStorage.getItem(META_KEY) && !localStorage.getItem("habitV251") && !localStorage.getItem(STORE_KEY);
}
