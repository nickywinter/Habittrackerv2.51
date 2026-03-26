// Daymark © 2026 Nick Winter. All rights reserved.
// ─── Tab Routing ──────────────────────────────────────────────────────────────

function showTab(tab) {
  state.currentTab = tab;
  clearToast();
  document.querySelectorAll(".tab").forEach(el => el.classList.toggle("active", el.dataset.tab === tab));
  const fns = { log: renderLog, progress: renderProgress, life: renderLife, stats: renderStats, settings: renderSettings };
  try { fns[tab]?.(); } catch(e) { renderError(e); }
}

function renderError(e) {
  document.getElementById("content").innerHTML =
    `<div class="card"><h3>Something went wrong</h3><div class="muted">Your data is safe. Try refreshing the page.<br><small>${escapeHtml(String(e))}</small></div></div>`;
}

// ─── Shared Fragments ─────────────────────────────────────────────────────────

function monthNavBar(key, prevFn, nextFn, label) {
  const hasPrev = allMonthKeys().includes(prevMonthKey(key)) || key > CURRENT_MONTH_KEY;
  const hasNext = key < CURRENT_MONTH_KEY;
  return `<div class="month-nav">
    <button class="nav-btn" onclick="${prevFn}()" ${hasPrev?'':'disabled'}>‹</button>
    <span class="month-nav-label">${label||formatFullMonth(key)}</span>
    <button class="nav-btn" onclick="${nextFn}()" ${hasNext?'':'disabled'}>›</button>
  </div>`;
}

const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_NAMES_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function freqLabel(f) {
  if (!f) return "Daily";
  switch(f.type) {
    case "daily":        return "Daily";
    case "weekdays":     return "Weekdays";
    case "weekends":     return "Weekends";
    case "specificdays": return Array.isArray(f.days) && f.days.length
      ? f.days.sort((a,b)=>a-b).map(d=>DAY_NAMES[d]).join(", ")
      : "No days set";
    default:             return "Daily";
  }
}

function categoryBadge(categoryId) {
  const cat = getCategory(categoryId);
  return cat ? `<span class="cat-badge" style="background:${cat.color}20;color:${cat.color}">${escapeHtml(cat.name)}</span>` : "";
}

// ─── LOG TAB ──────────────────────────────────────────────────────────────────

function renderLog() {
  const key    = state.logMonthKey;
  const day    = state.logDay;
  const md     = monthData(key);
  const dateObj= getDateForDay(key, day);
  const { done, total } = dayPartialCount(key, day);
  const complete = done === total && total > 0;

  // Group active habits by category
  const habits  = expectedHabitsForDate(key, day);
  const catMap  = {};
  habits.forEach(h => {
    if (!catMap[h.categoryId]) catMap[h.categoryId] = [];
    catMap[h.categoryId].push(h);
  });

  const logStyle = meta.loggingStyle || "reflect";
  const isDefaultDay = key===CURRENT_MONTH_KEY && day===maxLoggedDay(key);
  const styleLabel = isDefaultDay ? (logStyle === "live" ? "Today · " : "Yesterday · ") : "";
  let html = `
    <div class="card day-nav-card">
      <div class="day-nav">
        <button class="nav-btn" onclick="logPrevDay()">‹</button>
        <div class="day-nav-info">
          <div class="day-nav-date">${formatDate(dateObj)}</div>
          <div class="day-nav-sub">${styleLabel}${done} of ${total} done</div>
        </div>
        <button class="nav-btn" onclick="logNextDay()" ${isDefaultDay?'disabled':''}>›</button>
      </div>
      <div class="progress-bar-wrap"><div class="progress-bar" style="width:${total?Math.round(done/total*100):0}%"></div></div>
    </div>`;

  if (complete && total > 0) {
    html += `<div class="card done-day"><strong>✓ Full day complete!</strong><div class="muted">All habits done for ${formatDate(dateObj)}.</div></div>`;
  }

  // Weekly review prompt
  if (weeklyReviewDue() && key===CURRENT_MONTH_KEY && day===maxLoggedDay(key)) {
    const wkReview = meta.weeklyReviews[currentWeekKey()];
    html += `<div class="card review-prompt">
      <strong>📝 Weekly Review</strong>
      <div class="muted">How did your week go? What do you want to change?</div>
      <textarea id="weekly-review-text" placeholder="This week I...">${wkReview?.text||""}</textarea>
      <button class="btn" onclick="submitWeeklyReview()">Save Review</button>
    </div>`;
  }

  // Habits by category
  meta.categories.forEach(cat => {
    const catHabits = catMap[cat.id];
    if (!catHabits?.length) return;
    html += `<div class="section-title" style="color:${cat.color}">${escapeHtml(cat.name.toUpperCase())}</div>`;
    catHabits.forEach(h => {
      const isDone    = md.days[day]?.includes(h.id);
      const isSkipped = md.skips[day]?.includes(h.id);
      const satisfied = habitSatisfied(h.id, key, day);
      // freqNote for specific days — show day abbreviations
      const f = h.frequency;
      let freqNote = "";
      if (f?.type === "specificdays" && f.days?.length) {
        freqNote = `<span class="freq-note">${f.days.sort((a,b)=>a-b).map(d=>DAY_NAMES[d]).join("·")}</span>`;
      }
      html += `<div class="habit-wrap" data-habit-id="${h.id}" data-key="${key}" data-day="${day}">
        <div class="habit ${isSkipped?'habit-skipped':''} ${satisfied&&!isSkipped?'habit-satisfied':''}">
          <div class="dot ${isDone?'done':''} ${isSkipped?'skipped':''}" onclick="toggleHabit('${h.id}','${key}',${day})"></div>
          <div class="habit-info" onclick="toggleHabit('${h.id}','${key}',${day})">
            <div class="habit-name-row">${escapeHtml(h.name)}${freqNote}</div>
          </div>
        </div>
        <div class="habit-swipe-action ${isSkipped?'active':''}">
          <button onclick="toggleSkip('${h.id}','${key}',${day})">${isSkipped?'Unskip':'Rest'}</button>
        </div>
      </div>`;
    });
  });

  // Trackers + Moment
  const trackers = getTrackers();
  if (trackers.length) {
    html += `<div class="card">`;
    trackers.forEach(t => {
      const val = md.trackers?.[t.id]?.[day] || "";
      html += `<h3>${escapeHtml(t.name)} <span class="muted" style="font-size:13px;font-weight:400">${escapeHtml(t.unit)}</span></h3>
        <input type="number" step="0.1" value="${val}" placeholder="Enter value"
          oninput="saveTrackerValue('${t.id}',this.value,'${key}',${day})">`;
    });
    html += `<h3>Memorable Moment</h3>
      <textarea id="moment-input" placeholder="What happened today worth remembering?"
        oninput="saveMoment(this.value,'${key}',${day})">${md.moments[day]||""}</textarea>
    </div>`;
  } else {
    html += `<div class="card">
      <h3>Memorable Moment</h3>
      <textarea id="moment-input" placeholder="What happened today worth remembering?"
        oninput="saveMoment(this.value,'${key}',${day})">${md.moments[day]||""}</textarea>
    </div>`;
  }

  document.getElementById("content").innerHTML = html;
  maybeShowFirstTip();
  initSwipeToSkip();
}

function initSwipeToSkip() {
  document.querySelectorAll(".habit-wrap").forEach(wrap => {
    let startX = 0;
    let isDragging = false;

    wrap.addEventListener("touchstart", e => {
      startX = e.touches[0].clientX;
      isDragging = false;
    }, { passive: true });

    wrap.addEventListener("touchmove", e => {
      const dx = e.touches[0].clientX - startX;
      if (Math.abs(dx) > 8) isDragging = true;
      if (dx < -20) {
        wrap.classList.add("swiped");
      } else if (dx > 20) {
        wrap.classList.remove("swiped");
      }
    }, { passive: true });

    wrap.addEventListener("touchend", () => {
      // If didn't swipe enough, snap back
      if (!wrap.classList.contains("swiped") && isDragging) {
        wrap.classList.remove("swiped");
      }
    });
  });

  // Tap anywhere else closes open swipes
  document.getElementById("content")?.addEventListener("touchstart", e => {
    if (!e.target.closest(".habit-wrap")) {
      document.querySelectorAll(".habit-wrap.swiped").forEach(w => w.classList.remove("swiped"));
    }
  }, { passive: true });
}

function logPrevDay() {
  const key = state.logMonthKey; const day = state.logDay;
  if (day > 1) { state.logDay = day-1; }
  else {
    const pk = prevMonthKey(key);
    if (allMonthKeys().includes(pk) || pk < CURRENT_MONTH_KEY) {
      state.logMonthKey = pk; state.logDay = daysInMonth(pk);
    } else return;
  }
  renderLog();
}

function logNextDay() {
  const key = state.logMonthKey; const day = state.logDay;
  const maxDay = maxLoggedDay(key);
  if (day < maxDay) { state.logDay = day+1; }
  else if (key < CURRENT_MONTH_KEY) {
    state.logMonthKey = nextMonthKey(key); state.logDay = 1;
  }
  renderLog();
}

function submitWeeklyReview() {
  const text = document.getElementById("weekly-review-text")?.value?.trim();
  if (!text) { showToast("Write something first!", null); return; }
  saveWeeklyReview(text);
  showToast("Weekly review saved ✓", null);
  renderLog();
}

// ─── PROGRESS TAB ─────────────────────────────────────────────────────────────

function renderProgress() {
  const key       = state.progressMonthKey;
  const { current, best } = buildStreakData();
  const atRisk    = streakAtRisk();
  const monthScore= scoreForMonth(key);
  const md        = monthData(key);

  // Tracker summaries
  const trackerSummaries = getTrackers().map(t => ({ tracker: t, ...trackerSummary(t.id, key) }));

  let html = `
    ${monthNavBar(key, "progressPrevMonth", "progressNextMonth")}

    <div class="score-grid">
      <div class="metric">${monthScore}%<small>Month Score</small></div>
      <div class="metric ${atRisk?'at-risk':''}">${current}<small>Streak${atRisk?" ⚠️":""}</small></div>
      <div class="metric">${best}<small>Best Streak</small></div>
    </div>

    ${renderGoalCard()}
    ${trackerSummaries.map(s => renderTrackerCard(s, key)).join("")}
    ${renderMonthGrid(key, md)}`;

  document.getElementById("content").innerHTML = html;
}

function progressPrevMonth() {
  const pk = prevMonthKey(state.progressMonthKey);
  if (allMonthKeys().includes(pk)) { state.progressMonthKey = pk; renderProgress(); }
}
function progressNextMonth() {
  const nk = nextMonthKey(state.progressMonthKey);
  if (nk <= CURRENT_MONTH_KEY) { state.progressMonthKey = nk; renderProgress(); }
}

function renderGoalCard() {
  if (!meta.goals.length) return `<div class="card"><h3>Goals</h3><div class="muted">No goals yet — add them in Settings.</div></div>`;
  const active   = meta.goals.filter(g=>!g.done);
  const completed= meta.goals.filter(g=>g.done);
  let html = `<div class="card"><h3>Goals</h3>`;
  active.forEach(g => {
    const due = g.dueDate ? `<span class="goal-due">${g.dueDate}</span>` : "";
    html += `<div class="goal-row">
      <div class="goal-text">${escapeHtml(g.text)}${due}<div class="goal-chip">${escapeHtml(g.progress||"")}</div></div>
      <button class="small-btn small-green" onclick="toggleGoalDone('${g.id}');renderProgress()">✓</button>
    </div>`;
  });
  if (completed.length) {
    html += `<div class="section-title" style="margin-top:8px">COMPLETED</div>`;
    completed.forEach(g => {
      html += `<div class="goal-row done-goal">
        <div class="goal-text"><s>${escapeHtml(g.text)}</s></div>
        <button class="small-btn" onclick="toggleGoalDone('${g.id}');renderProgress()">↩</button>
      </div>`;
    });
  }
  return html + `</div>`;
}

function renderTrackerCard(s, key) {
  const { tracker, entries, current, baseline, change, data } = s;
  let chartHtml = "";
  if (entries.length >= 2) {
    const values = entries.map(d=>Number(data[d])).filter(v=>!isNaN(v));
    const vw=400,vh=160,pad=18;
    const mn=Math.min(...values),mx=Math.max(...values),rng=mx-mn||1;
    const xStep=(vw-pad*2)/Math.max(values.length-1,1);
    const pts=values.map((v,i)=>`${pad+i*xStep},${vh-pad-((v-mn)/rng)*(vh-pad*2)}`).join(" ");
    const circles=values.map((v,i)=>`<circle cx="${pad+i*xStep}" cy="${vh-pad-((v-mn)/rng)*(vh-pad*2)}" r="3.5"/>`).join("");
    chartHtml = `<svg class="chart" viewBox="0 0 ${vw} ${vh}" preserveAspectRatio="none">
      <line x1="${pad}" y1="${vh-pad}" x2="${vw-pad}" y2="${vh-pad}" stroke="var(--border)" stroke-width="1"/>
      <polyline fill="none" stroke="#007AFF" stroke-width="2.5" points="${pts}"/>
      <g fill="#007AFF">${circles}</g></svg>`;
  }
  const showBaseline = tracker.baseline !== "" && baseline !== null && !isNaN(baseline);
  return `<div class="card"><h3>${escapeHtml(tracker.name)} <span class="muted" style="font-size:13px;font-weight:400">${escapeHtml(tracker.unit)}</span></h3>
    <div class="${showBaseline ? 'weight-grid' : 'inline-row'}">
      <div class="metric">${current!==null&&!isNaN(current)?Number(current).toFixed(1):"—"}<small>Current</small></div>
      ${showBaseline ? `<div class="metric">${baseline.toFixed(1)}<small>Baseline</small></div>
      <div class="metric">${change!==null?(change>0?"+":"")+change:"—"}<small>Change</small></div>` : ""}
    </div>
    ${chartHtml||`<div class="muted" style="margin-top:8px">Log at least 2 entries to see a trend.</div>`}
  </div>`;
}

function renderMonthGrid(key, md) {
  const habits = activeHabits();
  let html = `<div class="card grid-card"><h3>Month Grid</h3>`;
  html += `<div class="grid-wrap"><table><tr><th class="habit-name-th"></th>`;
  for (let d=1; d<=daysInMonth(key); d++) {
    const isToday = key===CURRENT_MONTH_KEY&&d===maxLoggedDay(key);
    html += `<th class="${isToday?'today-th':''}">${d}</th>`;
  }
  html += `</tr>`;
  habits.forEach((habit,idx) => {
    const cat = getCategory(habit.categoryId);
    html += `<tr class="${idx%2===1?'alt-row':''}">
      <th class="habit-name-th" style="border-left:3px solid ${cat?.color||'#007AFF'}">${escapeHtml(habit.name)}</th>`;
    for (let d=1; d<=daysInMonth(key); d++) {
      const dateObj  = getDateForDay(key, d);
      const active   = habitActiveOnDate(habit, dateObj);
      const done     = md.days[d]?.includes(habit.id);
      const skipped  = md.skips[d]?.includes(habit.id);
      const isToday  = key===CURRENT_MONTH_KEY&&d===maxLoggedDay(key);
      const cls = !active ? "cell cell-na" : skipped ? "cell cell-skip" : done ? "cell cell-done" : "cell cell-empty";
      html += `<td class="${cls}${isToday?' cell-today':''}" onclick="jumpToDay('${key}',${d})" title="${formatDate(dateObj)}">${done?"·":skipped?"○":""}</td>`;
    }
    html += `</tr>`;
  });
  html += `</table></div></div>`;
  return html;
}

function jumpToDay(key, day) {
  state.logMonthKey = key;
  state.logDay = day;
  showTab("log");
}

// ─── LIFE TAB ─────────────────────────────────────────────────────────────────

// ─── LIFE TAB ─────────────────────────────────────────────────────────────────

function renderLife() {
  const view = state.lifeView || "moments";
  const tabs = [
    { id: "moments", label: "Moments" },
    { id: "reviews", label: "Reviews" },
    { id: "books",   label: "Books"   }
  ];
  const tabHtml = `<div class="life-tabs">
    ${tabs.map(t => `<button class="life-tab ${t.id===view?'active':''}" onclick="setLifeView('${t.id}')">${t.label}</button>`).join("")}
  </div>`;

  let html = tabHtml;

  if (view === "moments")  html += renderMomentsView();
  else if (view === "reviews") html += renderReviewsView();
  else if (view === "books")   html += renderBooksView();

  document.getElementById("content").innerHTML = html;
}

function setLifeView(view) {
  state.lifeView = view;
  renderLife();
}

// ── Moments view ──────────────────────────────────────────────────────────────

function renderMomentsView() {
  const key = state.lifeMonthKey;
  const md  = monthData(key);
  let entriesHtml = "";
  let hasAny = false;
  const dayNums = Object.keys(md.moments).sort((a,b)=>Number(b)-Number(a));
  dayNums.forEach(d => {
    const text = String(md.moments[d]||"").trim();
    if (!text) return;
    hasAny = true;
    entriesHtml += `<div class="moment-entry" onclick="jumpToDay('${key}',${d})">
      <div class="moment-date">${formatDate(getDateForDay(key,Number(d)))}</div>
      <div class="moment-text">${escapeHtml(text)}</div>
      <div class="muted moment-tap">Tap to edit</div>
    </div>`;
  });
  return `
    ${monthNavBar(key, "lifePrevMonth", "lifeNextMonth")}
    <div class="card">
      ${hasAny ? entriesHtml : '<div class="muted">No moments logged this month.</div>'}
    </div>`;
}

function lifePrevMonth() {
  const pk = prevMonthKey(state.lifeMonthKey);
  state.lifeMonthKey = pk; renderLife();
}
function lifeNextMonth() {
  const nk = nextMonthKey(state.lifeMonthKey);
  if (nk <= CURRENT_MONTH_KEY) { state.lifeMonthKey = nk; renderLife(); }
}

// ── Reviews view ──────────────────────────────────────────────────────────────

function renderReviewsView() {
  const reviews = Object.keys(meta.weeklyReviews).sort().reverse();
  if (!reviews.length) {
    return `<div class="card"><div class="muted">No weekly reviews yet. The review prompt appears on Fridays.</div></div>`;
  }
  let html = `<div class="card">`;
  reviews.forEach(wk => {
    const rv  = meta.weeklyReviews[wk];
    const num = wk.split("-W")[1];
    const yr  = wk.split("-W")[0];
    html += `<div class="moment-entry">
      <div class="moment-date">Week ${num}, ${yr}</div>
      <div class="moment-text">${escapeHtml(rv.text)}</div>
    </div>`;
  });
  return html + `</div>`;
}

// ── Books view ────────────────────────────────────────────────────────────────

function renderBooksView() {
  const books    = getBooks();
  const year     = DEFAULT_LOG_DATE.getFullYear();
  const finished = booksFinishedThisYear(year);
  const reading  = currentlyReading();
  const { goal } = bookGoalProgress();

  let html = "";

  // Stats bar
  const avgDays = finished.length
    ? Math.round(finished.reduce((sum,b) => sum + (bookDays(b)||0), 0) / finished.length)
    : null;
  const fastest = finished.length
    ? finished.reduce((min,b) => (bookDays(b)||999) < (bookDays(min)||999) ? b : min, finished[0])
    : null;

  html += `<div class="score-grid">
    <div class="metric">${finished.length}<small>Read ${year}</small></div>
    <div class="metric">${avgDays !== null ? avgDays+"d" : "—"}<small>Avg time</small></div>
    <div class="metric">${goal ? `${finished.length}/${goal.text.match(/\d+/)?.[0]||"?"}` : "—"}<small>Goal</small></div>
  </div>`;

  // Currently reading
  if (reading.length) {
    html += `<div class="card"><h3>Currently reading</h3>`;
    reading.forEach(b => {
      const started = b.startDate ? `Started ${b.startDate}` : "";
      const daysSince = b.startDate
        ? Math.round((Date.now() - new Date(b.startDate)) / 86400000)
        : null;
      html += `<div class="book-row">
        <div class="book-info">
          <div class="book-title">${escapeHtml(b.title)}</div>
          <div class="book-meta">${started}${daysSince !== null ? ` · ${daysSince} days in` : ""}</div>
        </div>
        <div class="book-actions">
          <button class="small-btn small-green" onclick="openFinishBookDialog('${b.id}')">Finish</button>
          <button class="small-btn" onclick="openEditBookDialog('${b.id}')">Edit</button>
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  // Finished books this year
  if (finished.length) {
    html += `<div class="card"><h3>Finished ${year}</h3>`;
    [...finished].reverse().forEach(b => {
      const days = bookDays(b);
      html += `<div class="book-row">
        <div class="book-info">
          <div class="book-title">${escapeHtml(b.title)}</div>
          <div class="book-meta">${b.startDate} → ${b.endDate}${days ? ` · ${days} days` : ""}${fastest&&b.id===fastest.id&&finished.length>1?" · ⚡ fastest":""}</div>
          ${b.notes ? `<div class="book-notes">${escapeHtml(b.notes)}</div>` : ""}
        </div>
        <button class="small-btn" onclick="openEditBookDialog('${b.id}')">Edit</button>
      </div>`;
    });
    html += `</div>`;
  }

  // Older books
  const older = books.filter(b => b.endDate && !b.endDate.startsWith(String(year)));
  if (older.length) {
    html += `<div class="card"><h3>Previous years</h3>`;
    [...older].reverse().forEach(b => {
      const days = bookDays(b);
      html += `<div class="book-row">
        <div class="book-info">
          <div class="book-title">${escapeHtml(b.title)}</div>
          <div class="book-meta">${b.endDate?.slice(0,4)} · ${days ? days+" days" : ""}</div>
        </div>
        <button class="small-btn" onclick="openEditBookDialog('${b.id}')">Edit</button>
      </div>`;
    });
    html += `</div>`;
  }

  if (!books.length) {
    html += `<div class="card"><div class="muted">No books added yet. Add your first book below.</div></div>`;
  }

  // Add book form
  const today = new Date().toISOString().slice(0,10);
  html += `<div class="card">
    <h3>Add a book</h3>
    <input id="new-book-title" type="text" placeholder="Title">
    <label style="margin-top:8px;display:block;font-size:13px;color:var(--muted)">Date started</label>
    <input id="new-book-start" type="date" value="${today}">
    <button class="btn" id="add-book-btn" style="margin-top:10px">Add Book</button>
  </div>`;

  // Attach listener after render
  setTimeout(() => {
    const btn = document.getElementById("add-book-btn");
    if (btn) btn.addEventListener("click", submitAddBook);
  }, 0);

  return html;
}

function submitAddBook() {
  const title = document.getElementById("new-book-title")?.value?.trim();
  if (!title) { showToast("Enter a book title", null); return; }
  const start = document.getElementById("new-book-start")?.value || "";
  addBook(title, start);
  renderLife();
  showToast(`"${title}" added`, null);
}

function openFinishBookDialog(id) {
  const b = meta.books.find(x=>x.id===id); if (!b) return;
  const today = new Date().toISOString().slice(0,10);
  showCustomDialog("Finished!", `
    <div style="font-weight:700;margin-bottom:8px">${escapeHtml(b.title)}</div>
    <label>Date finished</label>
    <input id="fb-end" type="date" value="${today}">
    <label style="margin-top:8px;display:block">Notes (optional)</label>
    <input id="fb-notes" type="text" placeholder="e.g. Loved it, 4/5">
  `, [
    { label: "Mark finished", action: () => {
      const end   = document.getElementById("fb-end")?.value || today;
      const notes = document.getElementById("fb-notes")?.value?.trim() || "";
      finishBook(id, end);
      if (notes) updateBook(id, { notes });
      renderLife();
      const days = bookDays({ startDate: b.startDate, endDate: end });
      showToast(`Finished in ${days||"?"} days 🎉`, null);
    }},
    { label: "Cancel", action: closeDialog }
  ]);
}

function openEditBookDialog(id) {
  const b = meta.books.find(x=>x.id===id); if (!b) return;
  showCustomDialog("Edit Book", `
    <label>Title</label>
    <input id="eb-title" type="text" value="${escapeHtml(b.title)}">
    <label style="margin-top:8px;display:block">Date started</label>
    <input id="eb-start" type="date" value="${b.startDate||""}">
    <label style="margin-top:8px;display:block">Date finished</label>
    <input id="eb-end" type="date" value="${b.endDate||""}">
    <label style="margin-top:8px;display:block">Notes</label>
    <input id="eb-notes" type="text" value="${escapeHtml(b.notes||"")}" placeholder="e.g. Loved it, 4/5">
  `, [
    { label: "Save", action: () => {
      const title = document.getElementById("eb-title")?.value?.trim();
      if (!title) { showToast("Title can't be empty", null); return; }
      updateBook(id, {
        title,
        startDate: document.getElementById("eb-start")?.value || "",
        endDate:   document.getElementById("eb-end")?.value   || "",
        notes:     document.getElementById("eb-notes")?.value?.trim() || ""
      });
      renderLife();
    }},
    { label: "Delete", danger: true, action: () => {
      showDialog("Delete Book", `Remove "${b.title}"?`, [
        { label: "Delete", danger: true, action: () => { deleteBook(id); renderLife(); }},
        { label: "Cancel", action: closeDialog }
      ]);
    }},
    { label: "Cancel", action: closeDialog }
  ]);
}

// ─── STATS TAB ────────────────────────────────────────────────────────────────

function renderStats() {
  const year   = state.statsYear;
  const habits = activeHabits();

  // Overall yearly heatmap (all habits combined)
  let html = `
    <div class="month-nav">
      <button class="nav-btn" onclick="statsPrevYear()">‹</button>
      <span class="month-nav-label">${year}</span>
      <button class="nav-btn" onclick="statsNextYear()" ${year>=DEFAULT_LOG_DATE.getFullYear()?'disabled':''}>›</button>
    </div>
    <div class="card">
      <h3>Year Overview</h3>
      ${renderYearHeatmap(year, null)}
      <div class="heatmap-legend"><span class="muted">Less</span>${[0,25,50,75,100].map(v=>`<div class="hm-cell" style="background:${heatColor(v)}"></div>`).join("")}<span class="muted">More</span></div>
    </div>`;

  // Per-habit selector + heatmap
  html += `<div class="card">
    <h3>Per-Habit</h3>
    <select onchange="state.statsHabitId=this.value;renderStats()">
      <option value="">— Select a habit —</option>
      ${habits.map(h=>`<option value="${h.id}" ${h.id===state.statsHabitId?'selected':''}>${escapeHtml(h.name)}</option>`).join("")}
    </select>`;

  if (state.statsHabitId) {
    const h = getHabit(state.statsHabitId);
    if (h) {
      html += `<div style="margin-top:12px">${renderYearHeatmap(year, h.id)}</div>`;
      html += renderHabitStats(h);
    }
  }
  html += `</div>`;

  // Per-month scores chart
  html += renderMonthlyScoresCard(year);

  document.getElementById("content").innerHTML = html;
}

function heatColor(pct) {
  if (pct === 0)  return "var(--cell-empty)";
  if (pct < 33)   return "#b3d9ff";
  if (pct < 66)   return "#5aacff";
  if (pct < 90)   return "#1a7fd4";
  return "#0a4f9e";
}

function renderYearHeatmap(year, habitId) {
  const months = yearKeys(year);
  let html = `<div class="heatmap-grid">`;
  months.forEach(mk => {
    const md = monthData(mk);
    const totalDays = daysInMonth(mk);
    html += `<div class="hm-month"><div class="hm-month-label">${MONTHS[monthDate(mk).getMonth()]}</div><div class="hm-days">`;
    for (let d=1; d<=totalDays; d++) {
      const dateObj = getDateForDay(mk, d);
      const isFuture= mk > CURRENT_MONTH_KEY || (mk===CURRENT_MONTH_KEY && d > maxLoggedDay(mk));
      if (isFuture) { html += `<div class="hm-cell hm-future"></div>`; continue; }

      let pct;
      if (habitId) {
        const habit = getHabit(habitId);
        const active = habit && habitActiveOnDate(habit, dateObj);
        if (!active) { html += `<div class="hm-cell hm-na"></div>`; continue; }
        pct = habitSatisfied(habitId, mk, d) ? 100 : 0;
      } else {
        const { done, total } = dayPartialCount(mk, d);
        pct = total ? Math.round(done/total*100) : 0;
      }
      html += `<div class="hm-cell" style="background:${heatColor(pct)}" title="${formatDate(dateObj)}: ${pct}%"></div>`;
    }
    html += `</div></div>`;
  });
  return html + `</div>`;
}

function renderHabitStats(habit) {
  let totalDays=0, doneDays=0, currentRun=0, bestRun=0, runningRun=0;
  allMonthKeys().sort().forEach(mk => {
    for (let d=1; d<=maxLoggedDay(mk); d++) {
      const dateObj = getDateForDay(mk, d);
      if (!habitActiveOnDate(habit, dateObj)) continue;
      totalDays++;
      if (habitSatisfied(habit.id, mk, d)) { doneDays++; runningRun++; if(runningRun>bestRun) bestRun=runningRun; }
      else runningRun=0;
    }
  });
  currentRun = runningRun;
  const rate = totalDays ? Math.round(doneDays/totalDays*100) : 0;
  return `<div class="score-grid" style="margin-top:12px">
    <div class="metric">${rate}%<small>All-time Rate</small></div>
    <div class="metric">${currentRun}<small>Current Run</small></div>
    <div class="metric">${bestRun}<small>Best Run</small></div>
  </div>`;
}

function renderMonthlyScoresCard(year) {
  const months = yearKeys(year);
  const scores = months.map(mk => ({ label: MONTHS[monthDate(mk).getMonth()], score: monthExists(mk) ? scoreForMonth(mk) : null }));
  const vh=120, vw=400, pad=20, barW=24, gap=8;
  const total = scores.length;
  const slotW = (vw - pad*2) / total;
  let bars = "";
  scores.forEach((s, i) => {
    if (s.score === null) return;
    const x = pad + i*slotW + (slotW-barW)/2;
    const barH = Math.max(2, (s.score/100)*(vh-pad*2));
    const y = vh - pad - barH;
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="#007AFF" opacity="${s.score>0?0.6+s.score*0.004:0.2}"/>`;
    bars += `<text x="${x+barW/2}" y="${vh-4}" text-anchor="middle" font-size="9" fill="var(--muted)">${s.label}</text>`;
    if (s.score > 0) bars += `<text x="${x+barW/2}" y="${y-3}" text-anchor="middle" font-size="8" fill="var(--text)">${s.score}%</text>`;
  });
  return `<div class="card"><h3>Monthly Scores — ${year}</h3>
    <svg viewBox="0 0 ${vw} ${vh}" style="width:100%;height:${vh}px">${bars}</svg>
  </div>`;
}

function statsPrevYear() { state.statsYear--; state.statsHabitId=null; renderStats(); }
function statsNextYear() { if(state.statsYear<DEFAULT_LOG_DATE.getFullYear()) { state.statsYear++; state.statsHabitId=null; renderStats(); } }

// ─── SETTINGS TAB ─────────────────────────────────────────────────────────────

function renderSettings() {
  const view = state.settingsView || "habits";
  const tabs = [
    { id: "habits",   label: "Habits"   },
    { id: "trackers", label: "Trackers" },
    { id: "goals",    label: "Goals"    },
    { id: "data",     label: "Data"     }
  ];

  const tabHtml = `<div class="life-tabs">
    ${tabs.map(t => `<button class="life-tab ${t.id===view?'active':''}" onclick="setSettingsView('${t.id}')">${t.label}</button>`).join("")}
  </div>`;

  let sectionHtml = "";
  if      (view === "habits")   sectionHtml = renderHabitsSection() + renderCategoriesSection();
  else if (view === "trackers") sectionHtml = renderTrackersSection();
  else if (view === "goals")    sectionHtml = renderGoalsSection();
  else if (view === "data")     sectionHtml = renderWeightSection() + renderBackupSection();

  document.getElementById("content").innerHTML = tabHtml + sectionHtml;

  // Attach add-tracker button via addEventListener (more reliable on iOS PWA than onclick)
  const addBtn = document.getElementById("add-tracker-btn");
  if (addBtn) addBtn.addEventListener("click", submitAddTracker);
}

function setSettingsView(view) {
  state.settingsView = view;
  renderSettings();
}

// Weight section kept for Data tab — just baseline and unit settings
function renderWeightSection() {
  const style = meta.loggingStyle || "reflect";
  const trackers = getTrackers();
  let settingsHtml = `<div class="card">
    <h3>Logging style</h3>
    <div class="muted" style="margin-bottom:10px">How you prefer to track your day.</div>
    <div class="ob-choice-cards">
      <div class="ob-choice-card ${style==="reflect"?"ob-choice-selected":""}" onclick="setLoggingStyle('reflect');renderSettings()">
        <div class="ob-choice-icon" style="font-size:20px">🌅</div>
        <div class="ob-choice-title">Morning reflection ${style==="reflect"?"✓":""}</div>
        <div class="ob-choice-desc">Log yesterday each morning.</div>
      </div>
      <div class="ob-choice-card ${style==="live"?"ob-choice-selected":""}" onclick="setLoggingStyle('live');renderSettings()">
        <div class="ob-choice-icon" style="font-size:20px">⚡</div>
        <div class="ob-choice-title">Daily tracking ${style==="live"?"✓":""}</div>
        <div class="ob-choice-desc">Log today as it happens.</div>
      </div>
    </div>
  </div>`;

  if (!trackers.length) return settingsHtml;
  // Show baseline/unit settings for each tracker inline
  let html = `<div class="card"><h3>Tracker Settings</h3>`;
  trackers.forEach(t => {
    html += `<div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border)">
      <div style="font-weight:600;margin-bottom:6px">${escapeHtml(t.name)}</div>
      <div class="inline-row">
        <div>
          <label>Baseline</label>
          <input type="number" step="0.1" value="${t.baseline||""}" placeholder="Optional"
            onchange="updateTracker('${t.id}',{baseline:this.value});renderSettings()">
        </div>
        <div>
          <label>Unit</label>
          <input type="text" maxlength="10" value="${escapeHtml(t.unit||"")}" placeholder="kg, hrs..."
            onchange="updateTracker('${t.id}',{unit:this.value});renderSettings()">
        </div>
      </div>
    </div>`;
  });
  html += `</div>`;
  return settingsHtml + html;
}

function renderHabitsSection() {
  const active   = activeHabits();
  const archived = archivedHabits();
  let html = `<div class="card"><h3>Habits</h3>`;
  active.forEach((h,i) => {
    const cat = getCategory(h.categoryId);
    html += `<div class="habit-row">
      <div class="habit-row-info">
        <div class="habit-row-name">${escapeHtml(h.name)}</div>
        <div class="habit-row-meta">${cat?`<span style="color:${cat.color}">${escapeHtml(cat.name)}</span>`:""}  ${freqLabel(h.frequency)}</div>
      </div>
      <div class="habit-row-actions">
        <button class="small-btn" onclick="moveHabit('${h.id}',-1)">↑</button>
        <button class="small-btn" onclick="moveHabit('${h.id}',1)">↓</button>
        <button class="small-btn" onclick="openEditHabitDialog('${h.id}')">Edit</button>
        <button class="small-btn small-danger" onclick="openArchiveDialog('${h.id}')">Archive</button>
      </div>
    </div>`;
  });
  if (archived.length) {
    html += `<h3>Archived</h3>`;
    archived.forEach(h => {
      html += `<div class="habit-row">
        <div class="habit-row-info"><div class="habit-row-name muted">${escapeHtml(h.name)}</div></div>
        <div class="habit-row-actions">
          <button class="small-btn small-green" onclick="restoreHabit('${h.id}');renderSettings()">Restore</button>
          <button class="small-btn small-danger" onclick="openDeleteHabitDialog('${h.id}')">Delete</button>
        </div>
      </div>`;
    });
  }
  html += `<h3>Add Habit</h3>
    <input id="new-habit-name" type="text" maxlength="40" placeholder="Habit name">
    <label style="margin-top:8px;display:block;font-size:13px;color:var(--muted)">Category</label>
    <select id="new-habit-cat">${meta.categories.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}</select>
    <label style="margin-top:8px;display:block;font-size:13px;color:var(--muted)">Frequency</label>
    <select id="new-habit-freq" onchange="toggleNewDayPicker(this.value)">
      <option value="daily">Daily</option>
      <option value="weekdays">Weekdays only</option>
      <option value="weekends">Weekends only</option>
      <option value="specificdays">Specific days</option>
    </select>
    <div id="new-day-picker" style="display:none;margin-top:10px">
      <div class="day-picker">${[0,1,2,3,4,5,6].map(n=>`
        <div class="day-picker-row" id="nhd-row-${n}" onclick="toggleNewDay(${n})">
          <div class="day-tick" id="nhd-tick-${n}">✓</div>
          <span>${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][n]}</span>
          <input type="checkbox" id="nhd-cb-${n}" value="${n}" style="display:none">
        </div>`).join("")}
      </div>
    </div>
    <button class="btn" onclick="submitAddHabit()" style="margin-top:10px">Add Habit</button>
  </div>`;
  return html;
}

function renderCategoriesSection() {
  let html = `<div class="card"><h3>Categories</h3>`;
  meta.categories.forEach(c => {
    html += `<div class="cat-row">
      <div class="cat-dot" style="background:${c.color}"></div>
      <div class="cat-name">${escapeHtml(c.name)}</div>
      <div class="cat-count muted">${meta.habits.filter(h=>h.categoryId===c.id&&!h.archived).length} habits</div>
      <button class="small-btn" onclick="openEditCategoryDialog('${c.id}')">Edit</button>
      ${meta.categories.length>1?`<button class="small-btn small-danger" onclick="openDeleteCategoryDialog('${c.id}')">Delete</button>`:""}
    </div>`;
  });
  html += `<h3>Add Category</h3>
    <div class="inline-row">
      <input id="new-cat-name" type="text" maxlength="30" placeholder="Category name">
      <select id="new-cat-color">${CATEGORY_COLORS.map((c,i)=>`<option value="${c}" ${i===0?'selected':''}>${c}</option>`).join("")}</select>
    </div>
    <button class="btn" onclick="submitAddCategory()">Add Category</button>
  </div>`;
  return html;
}

function renderGoalsSection() {
  let html = `<div class="card"><h3>Goals</h3>`;
  if (!meta.goals.length) html += `<div class="muted">No goals yet.</div>`;
  meta.goals.forEach(g => {
    html += `<div class="goal-edit-row">
      <div class="goal-edit-text ${g.done?'done-goal':''}">${escapeHtml(g.text)}${g.dueDate?` <span class="goal-due">${g.dueDate}</span>`:""}</div>
      <div class="goal-edit-progress muted">${escapeHtml(g.progress||"")}</div>
      <div class="goal-edit-actions">
        <button class="small-btn" onclick="openEditGoalDialog('${g.id}')">Edit</button>
        <button class="small-btn ${g.done?'':'small-green'}" onclick="toggleGoalDone('${g.id}');renderSettings()">${g.done?"↩":"✓"}</button>
        <button class="small-btn small-danger" onclick="openDeleteGoalDialog('${g.id}')">✕</button>
      </div>
    </div>`;
  });
  html += `<h3>Add Goal</h3>
    <input id="new-goal-text" type="text" placeholder="Goal description">
    <input id="new-goal-due" type="date" style="margin-top:8px">
    <button class="btn" onclick="submitAddGoal()">Add Goal</button>
  </div>`;
  return html;
}

function renderTrackersSection() {
  const trackers = getTrackers();
  let html = `<div class="card"><h3>Trackers <span class="muted" style="font-size:13px;font-weight:400">${trackers.length}/3</span></h3>`;

  trackers.forEach(t => {
    html += `<div class="tracker-row">
      <div class="tracker-row-info">
        <div class="tracker-row-name">${escapeHtml(t.name)}</div>
        <div class="tracker-row-meta">${escapeHtml(t.unit)}${t.baseline ? ` · Baseline: ${t.baseline}` : " · No baseline"}</div>
      </div>
      <div class="tracker-row-actions">
        <button class="small-btn" onclick="openEditTrackerDialog('${t.id}')">Edit</button>
        ${trackers.length > 1 ? `<button class="small-btn small-danger" onclick="openDeleteTrackerDialog('${t.id}')">Delete</button>` : ""}
      </div>
    </div>`;
  });

  if (trackers.length < 3) {
    html += `<h3>Add Tracker</h3>
      <input id="new-tracker-name" type="text" maxlength="30" placeholder="Name e.g. Weight, Sleep, Mood">
      <input id="new-tracker-unit" type="text" maxlength="10" placeholder="Unit e.g. kg, hrs, /10" style="margin-top:8px">
      <input id="new-tracker-baseline" type="number" step="0.1" placeholder="Baseline (optional)" style="margin-top:8px">
      <button class="btn" id="add-tracker-btn" style="margin-top:10px">Add Tracker</button>`;
  } else {
    html += `<div class="muted" style="margin-top:8px">Maximum 3 trackers reached.</div>`;
  }

  html += `</div>`;
  return html;
}

function renderBackupSection() {
  return `<div class="card"><h3>Backup & Data</h3>
    <div class="auto-backup-status">
      <div class="auto-backup-icon">📦</div>
      <div class="auto-backup-info">
        <div class="auto-backup-title">Automatic weekly backup</div>
        <div class="auto-backup-sub">${autoBackupStatus()}</div>
      </div>
    </div>
    <button class="btn secondary" onclick="exportJSON()" style="margin-top:12px">Export JSON Backup now</button>
    <button class="btn secondary" onclick="exportCSV()" style="margin-top:8px">Export CSV</button>
    <div class="muted" style="margin-top:8px;margin-bottom:8px">Import backup (replaces all data)</div>
    <input type="file" accept=".json" onchange="importJSON(this.files[0]);this.value=''">
    <button class="btn secondary" onclick="checkStorageUsage()" style="margin-top:12px">Check Storage Usage</button>
    <div class="muted" style="margin-top:12px">Daymark v${APP_VERSION}</div>
  </div>`;
}

// ─── Settings Dialogs ─────────────────────────────────────────────────────────

function openEditHabitDialog(id) {
  const h = getHabit(id); if (!h) return;
  const f = h.frequency || { type: "daily" };
  const catOpts = meta.categories.map(c=>`<option value="${c.id}" ${c.id===h.categoryId?"selected":""}>${escapeHtml(c.name)}</option>`).join("");
  const freqOpts = [
    ["daily","Daily"],["weekdays","Weekdays only"],["weekends","Weekends only"],["specificdays","Specific days"]
  ].map(([v,l])=>`<option value="${v}" ${v===f.type?"selected":""}>${l}</option>`).join("");

  const existingDays = f.type === "specificdays" ? (f.days||[]) : [];
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const dayRows = [0,1,2,3,4,5,6].map(n => `
    <div class="day-picker-row ${existingDays.includes(n)?"day-selected":""}"
         id="ehd-row-${n}" onclick="toggleEditDay(${n})">
      <div class="day-tick ${existingDays.includes(n)?"day-tick-on":""}" id="ehd-tick-${n}">✓</div>
      <span>${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][n]}</span>
      <input type="checkbox" id="ehd-cb-${n}" value="${n}"
        ${existingDays.includes(n)?"checked":""} style="display:none">
    </div>`).join("");

  showCustomDialog("Edit Habit", `
    <label>Name</label>
    <input id="ed-name" type="text" maxlength="40" value="${escapeHtml(h.name)}">
    <label style="margin-top:8px;display:block">Category</label>
    <select id="ed-cat">${catOpts}</select>
    <label style="margin-top:8px;display:block">Frequency</label>
    <select id="ed-freq" onchange="toggleEditDayPicker(this.value)">${freqOpts}</select>
    <div id="ed-day-picker" style="margin-top:10px;display:${f.type==="specificdays"?"block":"none"}">
      <div class="day-picker">${dayRows}</div>
    </div>
  `, [
    { label: "Save", action: () => {
      const name = document.getElementById("ed-name")?.value?.trim();
      if (!name) { showToast("Name can't be empty", null); return; }
      renameHabit(id, name);
      updateHabitCategory(id, document.getElementById("ed-cat").value);
      const ftype = document.getElementById("ed-freq").value;
      if (ftype === "specificdays") {
        const checked = [0,1,2,3,4,5,6].filter(n => document.getElementById("ehd-cb-"+n)?.checked);
        if (!checked.length) { showToast("Select at least one day", null); return; }
        updateHabitFrequency(id, { type: "specificdays", days: checked });
      } else {
        updateHabitFrequency(id, { type: ftype });
      }
      renderSettings();
    }},
    { label: "Cancel", action: closeDialog }
  ]);
}

function toggleEditDayPicker(ftype) {
  const picker = document.getElementById("ed-day-picker");
  if (picker) picker.style.display = ftype === "specificdays" ? "block" : "none";
}

function toggleEditDay(n) {
  const row  = document.getElementById("ehd-row-"+n);
  const tick = document.getElementById("ehd-tick-"+n);
  const cb   = document.getElementById("ehd-cb-"+n);
  if (!row || !cb) return;
  cb.checked = !cb.checked;
  row.classList.toggle("day-selected", cb.checked);
  tick.classList.toggle("day-tick-on", cb.checked);
}

function openArchiveDialog(id) {
  const h = getHabit(id); if (!h) return;
  showDialog("Archive Habit", `Archive "${h.name}"? It will no longer appear in your daily log. Historical data is kept.`, [
    { label: "Archive", action: () => { archiveHabit(id); renderSettings(); showToast(`"${h.name}" archived`, () => { restoreHabit(id); renderSettings(); }); }},
    { label: "Cancel",  action: closeDialog }
  ]);
}

function openDeleteHabitDialog(id) {
  const h = getHabit(id); if (!h) return;
  showDialog("Delete Permanently", `Delete "${h.name}"? All log history for this habit will be erased. This cannot be undone.`, [
    { label: "Delete", danger: true, action: () => { deleteHabitPermanently(id); renderSettings(); showToast(`"${h.name}" deleted`, null); }},
    { label: "Cancel", action: closeDialog }
  ]);
}

function openEditCategoryDialog(id) {
  const c = getCategory(id); if (!c) return;
  const colorOpts = CATEGORY_COLORS.map(col=>`<option value="${col}" ${col===c.color?"selected":""}>${col}</option>`).join("");
  showCustomDialog("Edit Category", `
    <label>Name</label>
    <input id="ec-name" type="text" maxlength="30" value="${escapeHtml(c.name)}">
    <label style="margin-top:8px;display:block">Color</label>
    <select id="ec-color">${colorOpts}</select>
  `, [
    { label: "Save", action: () => {
      const name = document.getElementById("ec-name")?.value?.trim();
      if (!name) { showToast("Name can't be empty", null); return; }
      renameCategory(id, name);
      const col = document.getElementById("ec-color").value;
      const cat = getCategory(id); if (cat) { cat.color = col; saveAll(); }
      renderSettings();
    }},
    { label: "Cancel", action: closeDialog }
  ]);
}

function openDeleteCategoryDialog(id) {
  const c = getCategory(id); if (!c) return;
  const fallback = meta.categories.find(x=>x.id!==id);
  showDialog("Delete Category", `Delete "${c.name}"? Habits in this category will move to "${fallback?.name||'default'}".`, [
    { label: "Delete", danger: true, action: () => { deleteCategory(id); renderSettings(); }},
    { label: "Cancel", action: closeDialog }
  ]);
}

function openEditGoalDialog(id) {
  const g = meta.goals.find(x=>x.id===id); if (!g) return;
  showCustomDialog("Edit Goal", `
    <label>Goal</label>
    <input id="eg-text" type="text" value="${escapeHtml(g.text)}">
    <label style="margin-top:8px;display:block">Progress note</label>
    <input id="eg-progress" type="text" value="${escapeHtml(g.progress||"")}" placeholder="e.g. 6 / 20">
    <label style="margin-top:8px;display:block">Due date</label>
    <input id="eg-due" type="date" value="${g.dueDate||""}">
  `, [
    { label: "Save", action: () => {
      const text = document.getElementById("eg-text")?.value?.trim();
      if (!text) { showToast("Goal text can't be empty", null); return; }
      updateGoal(id, { text, progress: document.getElementById("eg-progress")?.value?.trim()||"", dueDate: document.getElementById("eg-due")?.value||"" });
      renderSettings();
    }},
    { label: "Cancel", action: closeDialog }
  ]);
}

function openDeleteGoalDialog(id) {
  const g = meta.goals.find(x=>x.id===id); if (!g) return;
  showDialog("Delete Goal", `Delete "${g.text}"? This cannot be undone.`, [
    { label: "Delete", danger: true, action: () => { deleteGoal(id); renderSettings(); }},
    { label: "Cancel", action: closeDialog }
  ]);
}

// Custom dialog with HTML content (for edit forms)
function showCustomDialog(title, bodyHtml, buttons) {
  closeDialog();
  const overlay = document.createElement("div");
  overlay.id = "dialog-overlay";
  overlay.className = "dialog-overlay";
  overlay.innerHTML = `
    <div class="dialog">
      <div class="dialog-title">${escapeHtml(title)}</div>
      <div class="dialog-body">${bodyHtml}</div>
      <div class="dialog-btns">${
        buttons.map((b,i)=>`<button class="dialog-btn ${b.danger?'danger':''}" onclick="dialogAction(${i})">${escapeHtml(b.label)}</button>`).join("")
      }</div>
    </div>`;
  document.body.appendChild(overlay);
  state.dialog = { buttons };
  // Focus first input
  setTimeout(()=>overlay.querySelector("input")?.focus(), 50);
}

// ─── Add forms ────────────────────────────────────────────────────────────────

function submitAddHabit() {
  const name = document.getElementById("new-habit-name")?.value?.trim();
  if (!name) { showToast("Enter a habit name", null); return; }
  if (name.length > 40) { showToast("Name must be 40 characters or fewer", null); return; }
  if (meta.habits.some(h=>h.name.toLowerCase()===name.toLowerCase())) { showToast("That habit name already exists", null); return; }
  const catId = document.getElementById("new-habit-cat")?.value || meta.categories[0]?.id;
  const ftype = document.getElementById("new-habit-freq")?.value || "daily";
  if (ftype === "specificdays") {
    const checked = [0,1,2,3,4,5,6].filter(n => document.getElementById("nhd-cb-"+n)?.checked);
    if (!checked.length) { showToast("Select at least one day", null); return; }
    addHabit(name, catId, { type: "specificdays", days: checked });
  } else {
    addHabit(name, catId, { type: ftype });
  }
  renderSettings();
  showToast(`"${name}" added`, null);
}

function toggleNewDayPicker(ftype) {
  const picker = document.getElementById("new-day-picker");
  if (picker) picker.style.display = ftype === "specificdays" ? "block" : "none";
}

function toggleNewDay(n) {
  const row  = document.getElementById("nhd-row-"+n);
  const tick = document.getElementById("nhd-tick-"+n);
  const cb   = document.getElementById("nhd-cb-"+n);
  if (!row || !cb) return;
  cb.checked = !cb.checked;
  row.classList.toggle("day-selected", cb.checked);
  tick.classList.toggle("day-tick-on", cb.checked);
}

function submitAddCategory() {
  const name = document.getElementById("new-cat-name")?.value?.trim();
  if (!name) { showToast("Enter a category name", null); return; }
  const color = document.getElementById("new-cat-color")?.value || CATEGORY_COLORS[0];
  addCategory(name, color);
  renderSettings();
}

// ─── Tracker dialogs ─────────────────────────────────────────────────────────

function submitAddTracker() {
  const name = document.getElementById("new-tracker-name")?.value?.trim();
  if (!name) { showToast("Enter a tracker name", null); return; }
  const unit     = document.getElementById("new-tracker-unit")?.value?.trim() || "";
  const baseline = document.getElementById("new-tracker-baseline")?.value?.trim() || "";
  addTracker(name, unit, baseline);
  renderSettings();
  showToast(`"${name}" tracker added`, null);
}

function openEditTrackerDialog(id) {
  const t = meta.trackers?.find(x=>x.id===id); if (!t) return;
  showCustomDialog("Edit Tracker", `
    <label>Name</label>
    <input id="et-name" type="text" maxlength="30" value="${escapeHtml(t.name)}">
    <label style="margin-top:8px;display:block">Unit</label>
    <input id="et-unit" type="text" maxlength="10" value="${escapeHtml(t.unit)}" placeholder="kg, hrs, /10">
    <label style="margin-top:8px;display:block">Baseline (optional)</label>
    <input id="et-baseline" type="number" step="0.1" value="${t.baseline||""}" placeholder="Leave blank for no baseline">
  `, [
    { label: "Save", action: () => {
      const name = document.getElementById("et-name")?.value?.trim();
      if (!name) { showToast("Name can't be empty", null); return; }
      updateTracker(id, {
        name,
        unit:     document.getElementById("et-unit")?.value?.trim() || "",
        baseline: document.getElementById("et-baseline")?.value?.trim() || ""
      });
      renderSettings();
    }},
    { label: "Cancel", action: closeDialog }
  ]);
}

function openDeleteTrackerDialog(id) {
  const t = meta.trackers?.find(x=>x.id===id); if (!t) return;
  showDialog("Delete Tracker", `Delete "${t.name}"? All logged data for this tracker will be removed. This cannot be undone.`, [
    { label: "Delete", danger: true, action: () => { deleteTracker(id); renderSettings(); showToast(`"${t.name}" deleted`, null); }},
    { label: "Cancel", action: closeDialog }
  ]);
}

function submitAddGoal() {
  const text = document.getElementById("new-goal-text")?.value?.trim();
  if (!text) { showToast("Enter a goal description", null); return; }
  const due = document.getElementById("new-goal-due")?.value || "";
  addGoal(text, due);
  renderSettings();
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

// Step 1: Welcome + install prompt
// Step 2: How it works
// Step 3: Choose starting point

function renderOnboarding(step) {
  step = step || 1;
  document.querySelectorAll(".tab").forEach(t => t.style.display = "none");

  // Detect if already installed as PWA (no browser chrome)
  const isPWA = window.navigator.standalone === true
    || window.matchMedia("(display-mode: standalone)").matches;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);

  let html = "";

  if (step === 1) {
    // Install prompt — skip if already a PWA
    if (isPWA) {
      renderOnboarding(2);
      return;
    }

    // Device-specific instructions — clean and minimal
    let installSteps = "";
    let installNote  = "";
    let deviceLabel  = "";

    if (isIOS) {
      deviceLabel = "iPhone / iPad";
      installSteps = `
        <div class="ob-install-step"><span class="ob-step-num">1</span>Tap <strong>Share ⬆</strong> at the bottom of Safari</div>
        <div class="ob-install-step"><span class="ob-step-num">2</span>Tap <strong>Add to Home Screen</strong></div>
        <div class="ob-install-step"><span class="ob-step-num">3</span>Tap <strong>Add</strong> — then open from your home screen</div>`;
      installNote = "Must use Safari — it won't work from Chrome or Firefox on iPhone.";
    } else if (isAndroid) {
      deviceLabel = "Android";
      installSteps = `
        <div class="ob-install-step"><span class="ob-step-num">1</span>Tap the <strong>⋮ menu</strong> in Chrome</div>
        <div class="ob-install-step"><span class="ob-step-num">2</span>Tap <strong>Add to Home screen</strong></div>
        <div class="ob-install-step"><span class="ob-step-num">3</span>Tap <strong>Add</strong> — then open from your home screen</div>`;
      installNote = "Works with Chrome, Samsung Internet, and Firefox.";
    } else {
      installSteps = `<div class="ob-note">On mobile, add to your home screen for the best experience. On desktop, continue in the browser.</div>`;
    }

    html = `
      <div class="onboarding">
        <div class="ob-logo">◆</div>
        <h2>Welcome to Daymark</h2>
        <p class="ob-tagline">Mark your day. Then move on.</p>

        <div class="ob-install-card">
          <div class="ob-install-header">
            <span class="ob-install-icon">📲</span>
            <div>
              <div class="ob-install-title">Add to Home Screen</div>
              ${deviceLabel ? `<div class="ob-install-device">${deviceLabel}</div>` : ""}
            </div>
          </div>
          <div class="ob-install-steps" style="margin-top:12px">${installSteps}</div>
          ${installNote ? `<div class="ob-note" style="margin-top:10px">${installNote}</div>` : ""}
        </div>

        <button class="btn" onclick="renderOnboarding(2)" style="margin-top:16px">Done — let's go →</button>
        <button class="btn secondary" onclick="renderOnboarding(2)" style="margin-top:8px">Skip for now</button>
      </div>`;

  } else if (step === 2) {
    // How it works
    html = `
      <div class="onboarding">
        <div class="ob-logo">◆</div>
        <h2>How Daymark works</h2>
        <p class="ob-tagline">Three things, done daily.</p>
        <div class="ob-steps">
          <div class="ob-how-step">
            <div class="ob-how-icon" style="background:#007AFF20;color:#007AFF">◆</div>
            <div class="ob-how-text">
              <strong>Log your habits</strong>
              <span>Tap each habit to mark it done. Takes 10 seconds.</span>
            </div>
          </div>
          <div class="ob-how-step">
            <div class="ob-how-icon" style="background:#34c75920;color:#34c759">📊</div>
            <div class="ob-how-text">
              <strong>Track your progress</strong>
              <span>See your monthly score, streaks, and yearly heatmap build over time.</span>
            </div>
          </div>
          <div class="ob-how-step">
            <div class="ob-how-icon" style="background:#ff950020;color:#ff9500">📖</div>
            <div class="ob-how-text">
              <strong>Remember your life</strong>
              <span>Write one line about your day. A year from now you'll be glad you did.</span>
            </div>
          </div>
        </div>
        <div class="ob-privacy">
          🔒 Everything stays on your device. No account, no cloud, no ads — ever.
        </div>
        <button class="btn" onclick="renderOnboarding(3)" style="margin-top:16px">Choose your style →</button>
      </div>`;

  } else if (step === 3) {
    // Logging style
    html = `
      <div class="onboarding">
        <div class="ob-logo">◆</div>
        <h2>How do you like to reflect?</h2>
        <p class="ob-tagline">Pick what feels natural — you can change this any time in Settings.</p>
        <div class="ob-choice-cards">
          <div class="ob-choice-card" onclick="selectLoggingStyle('reflect')">
            <div class="ob-choice-icon" style="font-size:28px">🌅</div>
            <div class="ob-choice-title">Morning reflection</div>
            <div class="ob-choice-desc">Log yesterday's habits each morning. Review your day with fresh eyes and a clear head.</div>
          </div>
          <div class="ob-choice-card" onclick="selectLoggingStyle('live')">
            <div class="ob-choice-icon" style="font-size:28px">⚡</div>
            <div class="ob-choice-title">Daily tracking</div>
            <div class="ob-choice-desc">Log today as it happens. Tick off habits through the day and write your moment in the evening.</div>
          </div>
        </div>
      </div>`;

  } else if (step === 4) {
    // Choose starting point
    html = `
      <div class="onboarding">
        <div class="ob-logo">◆</div>
        <h2>Choose a starting point</h2>
        <p class="ob-tagline">You can change everything later in Settings.</p>
        <div class="ob-choice-cards">
          <div class="ob-choice-card" onclick="startWithDefaults()">
            <div class="ob-choice-icon">✦</div>
            <div class="ob-choice-title">Use default habits</div>
            <div class="ob-choice-desc">Start with a set of common habits — Exercise, Read, Sleep 7+, and more. Edit them to suit you.</div>
          </div>
          <div class="ob-choice-card" onclick="startBlank()">
            <div class="ob-choice-icon">○</div>
            <div class="ob-choice-title">Start blank</div>
            <div class="ob-choice-desc">Build your habit list from scratch. You'll go straight to Settings to add your first habit.</div>
          </div>
          <div class="ob-choice-card" onclick="triggerImport()">
            <div class="ob-choice-icon">↑</div>
            <div class="ob-choice-title">Import a backup</div>
            <div class="ob-choice-desc">Have a backup from a previous device? Import it to restore all your data.</div>
          </div>
        </div>
        <input type="file" id="ob-import-input" accept=".json" style="display:none" onchange="handleObImport(this.files[0])">
      </div>`;
  }

  document.getElementById("content").innerHTML = html;
}

function selectLoggingStyle(style) {
  meta.loggingStyle = style;
  refreshLogDate();
  renderOnboarding(4);
}

function triggerImport() {
  document.getElementById("ob-import-input")?.click();
}

function handleObImport(file) {
  if (!file) return;
  // Show tabs before import so renderLog works after
  document.querySelectorAll(".tab").forEach(t => t.style.display = "");
  importJSON(file);
}

function startWithDefaults() {
  saveAll();
  document.querySelectorAll(".tab").forEach(t => t.style.display = "");
  // Mark that we should show the first-use tip
  localStorage.setItem("daymark_show_tip", "1");
  showTab("log");
}

function startBlank() {
  meta.habits = [];
  saveAll();
  document.querySelectorAll(".tab").forEach(t => t.style.display = "");
  localStorage.setItem("daymark_show_tip", "1");
  showTab("settings");
  showToast("Add your first habit in Settings ↓", null);
}

// ─── First-use tip ────────────────────────────────────────────────────────────

function maybeShowFirstTip() {
  if (!localStorage.getItem("daymark_show_tip")) return;
  // Only show once
  localStorage.removeItem("daymark_show_tip");
  setTimeout(() => {
    const old = document.getElementById("first-tip");
    if (old) return;
    const tip = document.createElement("div");
    tip.id = "first-tip";
    tip.className = "first-tip";
    tip.innerHTML = `
      <div class="first-tip-inner">
        <div class="first-tip-title">👆 Tap any habit to mark it done</div>
        <div class="first-tip-body">Log each day, then check Progress to see your streaks build. Write a Memorable Moment at the bottom to capture your day.</div>
        <button class="first-tip-btn" onclick="dismissFirstTip()">Got it</button>
      </div>`;
    document.body.appendChild(tip);
  }, 600);
}

function dismissFirstTip() {
  const tip = document.getElementById("first-tip");
  if (tip) { tip.style.opacity = "0"; setTimeout(() => tip.remove(), 300); }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  const firstRun = isFirstRun();
  loadAll();
  refreshLogDate(); // apply loggingStyle preference to DEFAULT_LOG_DATE
  if (firstRun) {
    renderOnboarding(1);
  } else {
    migrateStoreToTrackers(); // migrate weight -> trackers for v4.0-4.2 users
    saveAll(); // persist any migrations
    showTab("log");
    // Check if a weekly auto-backup is due
    autoBackupIfDue();
  }
}

init();
