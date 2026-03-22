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

function freqLabel(f) {
  if (!f) return "Daily";
  switch(f.type) {
    case "daily":    return "Daily";
    case "weekdays": return "Weekdays";
    case "weekends": return "Weekends";
    case "xperweek": return `${f.count||1}× / week`;
    default:         return "Daily";
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

  let html = `
    <div class="card day-nav-card">
      <div class="day-nav">
        <button class="nav-btn" onclick="logPrevDay()">‹</button>
        <div class="day-nav-info">
          <div class="day-nav-date">${formatDate(dateObj)}</div>
          <div class="day-nav-sub">${done} of ${total} done</div>
        </div>
        <button class="nav-btn" onclick="logNextDay()" ${key===CURRENT_MONTH_KEY&&day===maxLoggedDay(key)?'disabled':''}>›</button>
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
      const f = h.frequency;
      let freqNote = "";
      if (f?.type === "xperweek") {
        const wkDone = weeklyDoneCount(h.id, dateObj);
        freqNote = `<span class="freq-note">${wkDone}/${f.count||1} this week</span>`;
      }
      html += `<div class="habit ${isSkipped?'habit-skipped':''} ${satisfied&&!isSkipped?'habit-satisfied':''}">
        <div class="dot ${isDone?'done':''} ${isSkipped?'skipped':''}" onclick="toggleHabit('${h.id}','${key}',${day})"></div>
        <div class="habit-info" onclick="toggleHabit('${h.id}','${key}',${day})">
          <div class="habit-name-row">${escapeHtml(h.name)}${freqNote}</div>
        </div>
        <button class="skip-btn ${isSkipped?'active':''}" onclick="toggleSkip('${h.id}','${key}',${day})" title="${isSkipped?'Unskip':'Rest day'}">○</button>
      </div>`;
    });
  });

  // Weight + Moment
  html += `<div class="card">
    <h3>Weight <span class="muted" style="font-size:13px;font-weight:400">${escapeHtml(meta.weightUnit)}</span></h3>
    <input type="number" step="0.1" id="weight-input" value="${md.weight[day]||""}" placeholder="e.g. 80.0"
      oninput="saveWeight(this.value,'${key}',${day})">
    <h3>Memorable Moment</h3>
    <textarea id="moment-input" placeholder="What happened today worth remembering?"
      oninput="saveMoment(this.value,'${key}',${day})">${md.moments[day]||""}</textarea>
  </div>`;

  document.getElementById("content").innerHTML = html;
  maybeShowFirstTip();
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

  // Weight summary
  const wEntries = Object.keys(md.weight).sort((a,b)=>Number(a)-Number(b))
    .filter(d=>String(md.weight[d]).trim()!=="");
  const wCurrent = wEntries.length ? Number(md.weight[wEntries[wEntries.length-1]]) : null;
  const wBaseline= meta.baselineWeight!=="" ? Number(meta.baselineWeight) : null;
  const wChange  = (wCurrent!==null&&wBaseline!==null&&!isNaN(wCurrent)&&!isNaN(wBaseline))
    ? (wCurrent-wBaseline).toFixed(1) : null;

  let html = `
    ${monthNavBar(key, "progressPrevMonth", "progressNextMonth")}

    <div class="score-grid">
      <div class="metric">${monthScore}%<small>Month Score</small></div>
      <div class="metric ${atRisk?'at-risk':''}">${current}<small>Streak${atRisk?" ⚠️":""}</small></div>
      <div class="metric">${best}<small>Best Streak</small></div>
    </div>

    ${renderGoalCard()}
    ${renderWeightCard(wCurrent, wBaseline, wChange, md, wEntries)}
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

function renderWeightCard(wCurrent, wBaseline, wChange, md, wEntries) {
  let chartHtml = "";
  if (wEntries.length >= 2) {
    const values = wEntries.map(d=>Number(md.weight[d])).filter(v=>!isNaN(v));
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
  return `<div class="card"><h3>Weight</h3>
    <div class="weight-grid">
      <div class="metric">${wCurrent!==null&&!isNaN(wCurrent)?wCurrent.toFixed(1):"—"}<small>Current</small></div>
      <div class="metric">${wBaseline!==null&&!isNaN(wBaseline)?wBaseline.toFixed(1):"—"}<small>Baseline</small></div>
      <div class="metric">${wChange!==null?(wChange>0?"+":"")+wChange:"—"}<small>Change</small></div>
    </div>
    ${chartHtml||`<div class="muted">Log at least 2 weight entries to see a trend.</div>`}
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

function renderLife() {
  const key = state.lifeMonthKey;
  const md  = monthData(key);

  // Collect entries with content across all months for the cross-month view
  let entriesHtml = "";
  let hasAny = false;

  // Show current selected month moments
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

  // Weekly reviews for this month
  let reviewsHtml = "";
  Object.keys(meta.weeklyReviews).sort().reverse().forEach(wk => {
    // Only show reviews that fall in the selected month — approximate by year-month prefix
    const yr = wk.split("-W")[0];
    const d  = monthDate(key);
    if (String(d.getFullYear()) !== yr) return;
    const rv = meta.weeklyReviews[wk];
    reviewsHtml += `<div class="moment-entry">
      <div class="moment-date">Week ${wk.split("-W")[1]} review</div>
      <div class="moment-text">${escapeHtml(rv.text)}</div>
    </div>`;
  });

  let html = `
    ${monthNavBar(key, "lifePrevMonth", "lifeNextMonth")}
    <div class="card">
      <h3>Memorable Moments</h3>
      ${hasAny ? entriesHtml : '<div class="muted">No moments logged this month.</div>'}
    </div>`;

  if (reviewsHtml) {
    html += `<div class="card"><h3>Weekly Reviews</h3>${reviewsHtml}</div>`;
  }

  document.getElementById("content").innerHTML = html;
}

function lifePrevMonth() {
  const pk = prevMonthKey(state.lifeMonthKey);
  state.lifeMonthKey = pk; renderLife();
}
function lifeNextMonth() {
  const nk = nextMonthKey(state.lifeMonthKey);
  if (nk <= CURRENT_MONTH_KEY) { state.lifeMonthKey = nk; renderLife(); }
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
  document.getElementById("content").innerHTML =
    renderHabitsSection() + renderCategoriesSection() + renderGoalsSection() + renderWeightSection() + renderBackupSection();
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
    <select id="new-habit-freq">
      <option value="daily">Daily</option>
      <option value="weekdays">Weekdays only</option>
      <option value="weekends">Weekends only</option>
      <option value="xperweek">X times per week</option>
    </select>
    <div id="new-habit-xcount" style="display:none;margin-top:8px">
      <input type="number" id="new-habit-count" min="1" max="7" value="3" placeholder="Times per week">
    </div>
    <button class="btn" onclick="submitAddHabit()">Add Habit</button>
  </div>`;

  // Show/hide xperweek count
  html += `<script>document.getElementById('new-habit-freq')?.addEventListener('change',function(){document.getElementById('new-habit-xcount').style.display=this.value==='xperweek'?'block':'none'});<\/script>`;
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

function renderWeightSection() {
  return `<div class="card"><h3>Weight</h3>
    <div class="inline-row">
      <div>
        <label style="font-size:13px;color:var(--muted)">Baseline</label>
        <input type="number" step="0.1" value="${meta.baselineWeight||""}" onchange="meta.baselineWeight=this.value;saveAll()" placeholder="e.g. 80.0">
      </div>
      <div>
        <label style="font-size:13px;color:var(--muted)">Unit</label>
        <select onchange="meta.weightUnit=this.value;saveAll()">
          <option value="kg" ${meta.weightUnit==="kg"?"selected":""}>kg</option>
          <option value="lbs" ${meta.weightUnit==="lbs"?"selected":""}>lbs</option>
        </select>
      </div>
    </div>
  </div>`;
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
  const cat = getCategory(h.categoryId);
  const f   = h.frequency || { type: "daily" };
  const catOpts = meta.categories.map(c=>`<option value="${c.id}" ${c.id===h.categoryId?"selected":""}>${escapeHtml(c.name)}</option>`).join("");
  const freqOpts = [
    ["daily","Daily"],["weekdays","Weekdays only"],["weekends","Weekends only"],["xperweek","X times per week"]
  ].map(([v,l])=>`<option value="${v}" ${v===f.type?"selected":""}>${l}</option>`).join("");

  showCustomDialog("Edit Habit", `
    <label>Name</label>
    <input id="ed-name" type="text" maxlength="40" value="${escapeHtml(h.name)}">
    <label style="margin-top:8px;display:block">Category</label>
    <select id="ed-cat">${catOpts}</select>
    <label style="margin-top:8px;display:block">Frequency</label>
    <select id="ed-freq" onchange="document.getElementById('ed-xcount').style.display=this.value==='xperweek'?'block':'none'">${freqOpts}</select>
    <div id="ed-xcount" style="display:${f.type==='xperweek'?'block':'none'};margin-top:8px">
      <input type="number" id="ed-count" min="1" max="7" value="${f.count||3}" placeholder="Times per week">
    </div>
  `, [
    { label: "Save", action: () => {
      const name = document.getElementById("ed-name")?.value?.trim();
      if (!name) { showToast("Name can't be empty", null); return; }
      renameHabit(id, name);
      updateHabitCategory(id, document.getElementById("ed-cat").value);
      const ftype = document.getElementById("ed-freq").value;
      updateHabitFrequency(id, ftype==="xperweek"
        ? { type:"xperweek", count: parseInt(document.getElementById("ed-count")?.value)||3 }
        : { type: ftype });
      renderSettings();
    }},
    { label: "Cancel", action: closeDialog }
  ]);
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
  const freq  = ftype==="xperweek"
    ? { type:"xperweek", count: parseInt(document.getElementById("new-habit-count")?.value)||3 }
    : { type: ftype };
  addHabit(name, catId, freq);
  renderSettings();
  showToast(`"${name}" added`, null);
}

function submitAddCategory() {
  const name = document.getElementById("new-cat-name")?.value?.trim();
  if (!name) { showToast("Enter a category name", null); return; }
  const color = document.getElementById("new-cat-color")?.value || CATEGORY_COLORS[0];
  addCategory(name, color);
  renderSettings();
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
    const installInstructions = isIOS
      ? `<div class="ob-install-steps">
           <div class="ob-install-step"><span class="ob-step-num">1</span>Tap the <strong>Share button</strong> <span class="ob-icon">⬆</span> at the bottom of Safari</div>
           <div class="ob-install-step"><span class="ob-step-num">2</span>Scroll down and tap <strong>Add to Home Screen</strong></div>
           <div class="ob-install-step"><span class="ob-step-num">3</span>Tap <strong>Add</strong> in the top right</div>
           <div class="ob-install-step"><span class="ob-step-num">4</span>Open Daymark from your home screen</div>
         </div>
         <div class="ob-note">⚠️ Must use Safari — Chrome and Firefox on iPhone don't support this</div>`
      : isAndroid
      ? `<div class="ob-install-steps">
           <div class="ob-install-step"><span class="ob-step-num">1</span>Tap the <strong>three dots</strong> menu in Chrome</div>
           <div class="ob-install-step"><span class="ob-step-num">2</span>Tap <strong>Add to Home screen</strong></div>
           <div class="ob-install-step"><span class="ob-step-num">3</span>Tap <strong>Add</strong> when prompted</div>
           <div class="ob-install-step"><span class="ob-step-num">4</span>Open Daymark from your home screen</div>
         </div>`
      : `<div class="ob-note">On mobile, add this to your home screen for the best experience. On desktop you can continue in the browser.</div>`;

    html = `
      <div class="onboarding">
        <div class="ob-logo">◆</div>
        <h2>Welcome to Daymark</h2>
        <p class="ob-tagline">Mark your day. Then move on.</p>
        <div class="ob-install-card">
          <div class="ob-install-title">📱 Install for the best experience</div>
          <p class="ob-install-desc">Adding to your home screen keeps your data safe and makes Daymark feel like a native app — full screen, offline, no browser bar.</p>
          ${installInstructions}
        </div>
        <button class="btn" onclick="renderOnboarding(2)" style="margin-top:16px">I've added it to my home screen →</button>
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
        <button class="btn" onclick="renderOnboarding(3)" style="margin-top:16px">Get started →</button>
      </div>`;

  } else if (step === 3) {
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
  if (firstRun) {
    renderOnboarding(1);
  } else {
    saveAll(); // persist any migrations
    showTab("log");
    // Check if a weekly auto-backup is due
    autoBackupIfDue();
  }
}

init();
