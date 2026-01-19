/* =========================
   BASIS ELEMENTEN
========================= */
const calendarEl = document.getElementById("calendar");
const currentLabel = document.getElementById("currentLabel");

const modal = document.getElementById("modal");
const addBtn = document.getElementById("addEventBtn");
const saveBtn = document.getElementById("saveEvent");
const cancelBtn = document.getElementById("cancelEvent");
const deleteBtn = document.getElementById("deleteEvent");

const titleInput = document.getElementById("titleInput");
const descInput = document.getElementById("descInput");
const dateInput = document.getElementById("dateInput");
const startTime = document.getElementById("startTime");
const endTime = document.getElementById("endTime");
const repeatType = document.getElementById("repeatType");

const exceptionStart = document.getElementById("exceptionStart");
const exceptionEnd = document.getElementById("exceptionEnd");
const exceptionRepeatYearly = document.getElementById("exceptionRepeatYearly");
const addExceptionBtn = document.getElementById("addExceptionBtn");
const exceptionList = document.getElementById("exceptionList");

const colorInput = document.getElementById("colorInput");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const monthViewBtn = document.getElementById("monthViewBtn");
const weekViewBtn = document.getElementById("weekViewBtn");
const weekdayExclusionsEl = document.getElementById("weekdayExclusions");

const holidayView = document.getElementById("holidayView");
const holidayViewBtn = document.getElementById("holidayViewBtn");
const holidayYear = document.getElementById("holidayYear");
const holidayName = document.getElementById("holidayName");
const holidayStart = document.getElementById("holidayStart");
const holidayEnd = document.getElementById("holidayEnd");
const addHolidayBtn = document.getElementById("addHolidayBtn");
const holidayList = document.getElementById("holidayList");
const schoolHolidayMode = document.getElementById("schoolHolidayMode");

const backBtn = document.getElementById("backBtn");
const hourHeight = 60;

/* =========================
   STATE
========================= */
let view = "month";
let currentDate = new Date();
let selectedDate = null;
let editingEventId = null;

let events = [];
let schoolHolidays = {};
let editingHolidayIndex = null;

/* =========================
   HELPERS
========================= */
function saveEvents() { return; }

function saveSchoolHolidays() { return; }

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isToday(date) {
  const t = new Date();
  return date.toDateString() === t.toDateString();
}

// Huidige gebruiker ophalen (valt terug op 'member1')
function getCurrentUserId() { return 'member1'; }

// Get current user email from auth
function getCurrentUserEmail() {
  const auth = localStorage.getItem('cashwellAuth');
  if (auth) {
    try {
      const authData = JSON.parse(auth);
      return authData.email || null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

// Calculate profit for a specific date (myself + group entries)
function calculateProfitForDate(dateStr) {
  const userEmail = getCurrentUserEmail();
  const storageKey = userEmail ? `cashwell_${userEmail}_entries` : 'cashwellEntries';
  const entries = JSON.parse(localStorage.getItem(storageKey)) || [];
  const membersKey = userEmail ? `cashwell_${userEmail}_members` : 'cashwellMembers';
  const members = JSON.parse(localStorage.getItem(membersKey)) || [];
  
  // Get myself entries for this date
  const myselfEntries = entries.filter(e => 
    e.owner === 'myself' && e.date === dateStr
  );
  
  // Get group entries for this date (assuming user is member1 for now)
  // You can adjust this logic based on how you identify the current user
  const groupEntries = entries.filter(e => 
    e.owner === 'group' && e.date === dateStr
  );
  
  // Calculate profit from myself entries
  const myselfProfit = myselfEntries
    .filter(e => e.type === 'profit')
    .reduce((sum, e) => sum + e.amount, 0);
  const myselfLoss = myselfEntries
    .filter(e => e.type === 'loss')
    .reduce((sum, e) => sum + e.amount, 0);
  
  let groupProfit = 0;
  let groupLoss = 0;
  groupEntries.forEach(entry => {
    const involved = entry.memberIds && entry.memberIds.includes(getCurrentUserId());
    if (!involved) return;
    const denom = entry.memberIds.length || 1;
    const share = entry.amount / denom;
    if (entry.type === 'profit') groupProfit += share;
    else if (entry.type === 'loss') groupLoss += share;
  });
  
  return (myselfProfit - myselfLoss) + (groupProfit - groupLoss);
}

// Calculate total profit for a month
function calculateMonthlyProfit(year, month) {
  const userEmail = getCurrentUserEmail();
  const storageKey = userEmail ? `cashwell_${userEmail}_entries` : 'cashwellEntries';
  const entries = JSON.parse(localStorage.getItem(storageKey)) || [];
  const members = JSON.parse(localStorage.getItem('cashwellMembers')) || [];
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);
  const startStr = dateKey(startOfMonth);
  const endStr = dateKey(endOfMonth);
  
  // Get myself entries for this month
  const myselfEntries = entries.filter(e => 
    e.owner === 'myself' && e.date >= startStr && e.date <= endStr
  );
  
  // Get group entries for this month
  const groupEntries = entries.filter(e => 
    e.owner === 'group' && e.date >= startStr && e.date <= endStr
  );
  
  // Calculate profit from myself entries
  const myselfProfit = myselfEntries
    .filter(e => e.type === 'profit')
    .reduce((sum, e) => sum + e.amount, 0);
  const myselfLoss = myselfEntries
    .filter(e => e.type === 'loss')
    .reduce((sum, e) => sum + e.amount, 0);
  
  let groupProfit = 0;
  let groupLoss = 0;
  groupEntries.forEach(entry => {
    const involved = entry.memberIds && entry.memberIds.includes(getCurrentUserId());
    if (!involved) return;
    const denom = entry.memberIds.length || 1;
    const share = entry.amount / denom;
    if (entry.type === 'profit') groupProfit += share;
    else if (entry.type === 'loss') groupLoss += share;
  });
  
  return (myselfProfit - myselfLoss) + (groupProfit - groupLoss);
}

// Uitzondering toevoegen
function addExceptionToList(start, end, yearly) {
  const li = document.createElement("li");
  li.textContent = `${start} - ${end}${yearly ? " (jaar)" : ""}`;
  li.dataset.start = start;
  li.dataset.end = end;
  li.dataset.yearly = yearly ? "true" : "false";
  li.onclick = () => li.remove();
  exceptionList.appendChild(li);
}

// Controleer of datum binnen uitzondering valt
function isDateInException(date, exceptions = []) {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  return exceptions.some(ex => {
    if (ex.yearly) {
      const [, sm, sd] = ex.start.split("-").map(Number);
      const [, em, ed] = ex.end.split("-").map(Number);
      const start = new Date(current.getFullYear(), sm - 1, sd);
      const end = new Date(current.getFullYear(), em - 1, ed);
      return current >= start && current <= end;
    } else {
      const start = new Date(ex.start);
      const end = new Date(ex.end);
      return current >= start && current <= end;
    }
  });
}

// Get team events from localStorage
function getTeamEvents() {
  const userEmail = getCurrentUserEmail();
  const storageKey = userEmail ? `cashwell_${userEmail}_teamEvents` : 'cashwellTeamEvents';
  const teamEvents = JSON.parse(localStorage.getItem(storageKey)) || [];
  return teamEvents.map(te => ({
    id: `team-${te.id}`,
    title: te.name,
    date: te.date,
    start: te.startTime || '09:00',
    end: te.endTime || '10:00',
    repeat: 'none',
    color: '#b026ff', // Neon purple for team events
    isTeamEvent: true,
    description: te.description || ''
  }));
}

// Haal events op die zichtbaar moeten zijn (met schoolvakantie-check)
function eventsForDate(date) {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  // Get regular calendar events
  const calendarEvents = events.filter(ev => {
    // 1️⃣ Weekdag-uitzonderingen
    if (ev.excludedWeekdays?.includes(current.getDay())) return false;

    // 2️⃣ Uitzonderingen
    if (ev.exceptions?.length && isDateInException(current, ev.exceptions)) return false;
    
    const isHoliday = isSchoolHoliday(current);

    if (ev.schoolHolidayMode === "exclude" && isHoliday) return false;
    if (ev.schoolHolidayMode === "only" && !isHoliday) return false;

    const start = new Date(ev.date);
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());

    if (current < startDay) return false;

    if (ev.repeat === "none") return current.getTime() === startDay.getTime();
    if (ev.repeat === "daily") return true;
    if (ev.repeat === "weekly") return current.getDay() === startDay.getDay();
    if (ev.repeat === "monthly") return current.getDate() === startDay.getDate();

    return false;
  });
  
  // Get team events for this date
  const teamEvents = getTeamEvents().filter(te => {
    const eventDate = new Date(te.date);
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    return current.getTime() === eventDay.getTime();
  });
  
  // Combine both types of events
  return [...calendarEvents, ...teamEvents];
}

/* =========================
   MODAL OPEN / CLOSE
========================= */
function openModal(date, event = null) {
  selectedDate = date;
  modal.classList.remove("hidden");

  if (event) {
    editingEventId = event.id;
    titleInput.value = event.title;
    descInput.value = event.desc || "";
    dateInput.value = event.date || dateKey(selectedDate);
    startTime.value = event.start;
    endTime.value = event.end;
    repeatType.value = event.repeat || "none";
    colorInput.value = event.color || "#00ffff";
    schoolHolidayMode.value = event.schoolHolidayMode || "all";

    weekdayExclusionsEl.querySelectorAll("input").forEach(cb => {
      cb.checked = event.excludedWeekdays?.includes(Number(cb.value)) || false;
    });

    exceptionList.innerHTML = "";
    exceptionStart.value = "";
    exceptionEnd.value = "";
    exceptionRepeatYearly.checked = false;
    if (event.exceptions && event.exceptions.length) {
      event.exceptions.forEach(ex => addExceptionToList(ex.start, ex.end, ex.yearly));
    }

    deleteBtn.classList.remove("hidden");
  } else {
    editingEventId = null;
    titleInput.value = "";
    descInput.value = "";
    dateInput.value = dateKey(selectedDate);
    startTime.value = "08:00";
    endTime.value = "09:00";
    repeatType.value = "none";
    colorInput.value = "#00ffff";
    schoolHolidayMode.value = "all";

    exceptionList.innerHTML = "";
    exceptionStart.value = "";
    exceptionEnd.value = "";
    exceptionRepeatYearly.checked = false;
    weekdayExclusionsEl.querySelectorAll("input").forEach(cb => (cb.checked = false));
    deleteBtn.classList.add("hidden");
  }
}

function closeModal() {
  modal.classList.add("hidden");
}

/* =========================
   MODAL EVENTS
========================= */
addBtn.onclick = () => openModal(new Date());
cancelBtn.onclick = closeModal;

addExceptionBtn.onclick = () => {
  if (exceptionStart.value && exceptionEnd.value) {
    addExceptionToList(exceptionStart.value, exceptionEnd.value, exceptionRepeatYearly.checked);
    exceptionStart.value = "";
    exceptionEnd.value = "";
    exceptionRepeatYearly.checked = false;
  }
};

saveBtn.onclick = () => {
  if (!titleInput.value || !startTime.value || !endTime.value) return;

  // Automatische uitzondering toevoegen indien ingevuld
  if (exceptionStart.value && exceptionEnd.value) {
    const exists = Array.from(exceptionList.children).some(
      li =>
        li.dataset.start === exceptionStart.value &&
        li.dataset.end === exceptionEnd.value &&
        li.dataset.yearly === String(exceptionRepeatYearly.checked)
    );
    if (!exists) addExceptionToList(exceptionStart.value, exceptionEnd.value, exceptionRepeatYearly.checked);
  }

  const exceptions = Array.from(exceptionList.children).map(li => ({
    start: li.dataset.start,
    end: li.dataset.end,
    yearly: li.dataset.yearly === "true"
  }));

  const excludedWeekdays = Array.from(
    weekdayExclusionsEl.querySelectorAll("input:checked")
  ).map(cb => Number(cb.value));

  const eventData = {
    id: editingEventId || Date.now(),
    title: titleInput.value,
    desc: descInput.value,
    date: dateInput.value,
    start: startTime.value,
    end: endTime.value,
    repeat: repeatType.value,
    exceptions: exceptions,
    excludedWeekdays: excludedWeekdays,
    color: colorInput.value,
    schoolHolidayMode: schoolHolidayMode.value
  };

  if (editingEventId) {
    const index = events.findIndex(ev => ev.id === editingEventId);
    events[index] = eventData;
  } else {
    events.push(eventData);
  }

  saveEvents();
  closeModal();
  render();
};

deleteBtn.onclick = () => {
  if (!editingEventId) return;
  events = events.filter(ev => ev.id !== editingEventId);
  saveEvents();
  closeModal();
  render();
};

/* =========================
   SCHOOLVAKANTIE MANAGEMENT
========================= */
function getHolidaysForYear(year) {
  return schoolHolidays[year] || [];
}

function isSchoolHoliday(date) {
  const year = date.getFullYear();
  const holidays = getHolidaysForYear(year);

  return holidays.some(h => {
    const start = new Date(h.start);
    const end = new Date(h.end);

    const d = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    return d >= start && d <= end;
  });
}

function renderHolidayList() {
  const year = holidayYear.value;
  holidayList.innerHTML = "";

  getHolidaysForYear(year).forEach((h, i) => {
    const li = document.createElement("li");

    const info = document.createElement("span");
    info.textContent = `${h.name}: ${h.start} → ${h.end}`;

    const actions = document.createElement("div");

    const editBtn = document.createElement("button");
    editBtn.textContent = "✏️";
    editBtn.onclick = () => editHoliday(year, i);

    const delBtn = document.createElement("button");
    delBtn.textContent = "🗑️";
    delBtn.onclick = () => deleteHoliday(year, i);

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(info);
    li.appendChild(actions);

    holidayList.appendChild(li);
  });
}

function deleteHoliday(year, index) {
  schoolHolidays[year].splice(index, 1);
  saveSchoolHolidays();
  renderHolidayList();
}

function editHoliday(year, index) {
  const h = schoolHolidays[year][index];

  holidayYear.value = year;
  holidayName.value = h.name;
  holidayStart.value = h.start;
  holidayEnd.value = h.end;

  editingHolidayIndex = index;
}

addHolidayBtn.onclick = () => {
  if (!holidayName.value || !holidayStart.value || !holidayEnd.value) return;

  const year = holidayYear.value;
  if (!schoolHolidays[year]) schoolHolidays[year] = [];

  if (editingHolidayIndex !== null) {
    schoolHolidays[year][editingHolidayIndex] = {
      name: holidayName.value,
      start: holidayStart.value,
      end: holidayEnd.value
    };
    editingHolidayIndex = null;
  } else {
    schoolHolidays[year].push({
      name: holidayName.value,
      start: holidayStart.value,
      end: holidayEnd.value
    });
  }

  holidayName.value = "";
  holidayStart.value = "";
  holidayEnd.value = "";

  saveSchoolHolidays();
  renderHolidayList();
};

/* =========================
   NAVIGATIE
========================= */
holidayViewBtn.onclick = () => {
  calendarEl.classList.add("hidden");
  holidayView.classList.remove("hidden");
  renderHolidayList();
};

backBtn.onclick = () => {
  holidayView.classList.add("hidden");
  calendarEl.classList.remove("hidden");
};

prevBtn.onclick = () => {
  view === "month"
    ? currentDate.setMonth(currentDate.getMonth() - 1)
    : currentDate.setDate(currentDate.getDate() - 7);
  render();
};

nextBtn.onclick = () => {
  view === "month"
    ? currentDate.setMonth(currentDate.getMonth() + 1)
    : currentDate.setDate(currentDate.getDate() + 7);
  render();
};

monthViewBtn.onclick = () => {
  view = "month";
  monthViewBtn.classList.add("active");
  weekViewBtn.classList.remove("active");
  render();
};

weekViewBtn.onclick = () => {
  view = "week";
  weekViewBtn.classList.add("active");
  monthViewBtn.classList.remove("active");
  render();
};

/* =========================
   RENDER
========================= */
function render() {
  calendarEl.innerHTML = "";
  view === "month" ? renderMonth() : renderWeek();
}

/* =========================
   MAAND VIEW
========================= */
function renderMonth() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calculate monthly profit
  const monthlyProfit = calculateMonthlyProfit(year, month);
  const monthName = currentDate.toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric"
  });

  // Update label with monthly profit
  currentLabel.innerHTML = `${monthName} <span style="font-size: 0.7em; color: var(--neon); margin-left: 1rem;">$${monthlyProfit.toFixed(2)}</span>`;

  const grid = document.createElement("div");
  grid.className = "month-grid";

  const firstDay = new Date(year, month, 1).getDay() || 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 1; i < firstDay; i++) grid.appendChild(document.createElement("div"));

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dateStr = dateKey(date);
    const cell = document.createElement("div");
    cell.className = "day";
    if (isToday(date)) cell.classList.add("today");
    if (isSchoolHoliday(date)) cell.classList.add("holiday");

    // Calculate profit for this day
    const dayProfit = calculateProfitForDate(dateStr);
    
    // Create day content with profit
    const dayContent = document.createElement("div");
    dayContent.innerHTML = `<div class="day-number">${d}</div>`;
    
    // Add profit display if there's profit for this day
    if (dayProfit !== 0) {
      const profitEl = document.createElement("div");
      profitEl.className = "day-profit";
      profitEl.style.cssText = `
        font-size: 0.75rem;
        color: ${dayProfit > 0 ? 'var(--neon-green)' : 'var(--danger)'};
        font-weight: 600;
        margin-top: 0.25rem;
        text-shadow: 0 0 8px ${dayProfit > 0 ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 51, 102, 0.5)'};
      `;
      profitEl.textContent = dayProfit > 0 ? `+$${dayProfit.toFixed(2)}` : `$${dayProfit.toFixed(2)}`;
      dayContent.appendChild(profitEl);
    }
    
    cell.appendChild(dayContent);
    cell.onclick = () => openModal(date);

    eventsForDate(date).forEach(ev => {
      const e = document.createElement("div");
      e.className = "event";
      e.dataset.start = ev.start;
      e.dataset.end = ev.end;

      e.style.background = ev.color;
      
      // Show different text for team events
      if (ev.isTeamEvent) {
        e.textContent = `👥 ${ev.title}`;
        e.style.border = '2px solid var(--neon-purple)';
        e.style.boxShadow = '0 0 10px rgba(176, 38, 255, 0.5)';
      } else {
        e.textContent = `${ev.start} ${ev.title}`;
      }

      const options = document.createElement("div");
      options.className = "event-options";

      // Only show edit/delete for regular calendar events, not team events
      if (!ev.isTeamEvent) {
        const editBtn = document.createElement("button");
        editBtn.textContent = "✏️";
        editBtn.className = "edit-btn";
        editBtn.onclick = evt => {
          evt.stopPropagation();
          openModal(date, ev);
        };

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "🗑️";
        deleteBtn.className = "delete-btn";
        deleteBtn.onclick = evt => {
          evt.stopPropagation();
          events = events.filter(e => e.id !== ev.id);
          saveEvents();
          render();
        };

        options.appendChild(editBtn);
        options.appendChild(deleteBtn);
      } else {
        // For team events, show info that it's from team events
        const infoBtn = document.createElement("button");
        infoBtn.textContent = "ℹ️";
        infoBtn.className = "edit-btn";
        infoBtn.title = "Team Event - beheer in hoofdmenu";
        infoBtn.style.cursor = 'default';
        options.appendChild(infoBtn);
      }

      e.appendChild(options);
      cell.appendChild(e);
    });

    grid.appendChild(cell);
  }

  calendarEl.appendChild(grid);
}

/* =========================
   WEEK VIEW
========================= */
function createCurrentTimeLine() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const y = (hours + minutes / 60) * hourHeight;

  const line = document.createElement("div");
  line.className = "current-time-line";
  line.style.top = `${y}px`;

  return line;
}

function renderWeek() {
  const start = new Date(currentDate);
  const day = start.getDay() === 0 ? 7 : start.getDay();
  start.setDate(start.getDate() - day + 1);

  currentLabel.textContent = `Week van ${start.toLocaleDateString("nl-NL")}`;

  const wrapper = document.createElement("div");
  wrapper.className = "week-wrapper";

  const header = document.createElement("div");
  header.className = "week-header";
  header.appendChild(document.createElement("div"));

  for (let d = 0; d < 7; d++) {
    const date = new Date(start);
    date.setDate(start.getDate() + d);

    const h = document.createElement("div");
    h.innerHTML = `
      <div style="font-size:.7rem; opacity:.6">
        ${date.toLocaleDateString("nl-NL", { weekday: "short" })}
      </div>
      <div style="font-size:.9rem; font-weight:600">
        ${date.getDate()}
      </div>
    `;
    header.appendChild(h);
  }
  wrapper.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "week-grid";
  // Huidige tijdlijn
  const timeLine = createCurrentTimeLine();
  grid.appendChild(timeLine);

  const timeCol = document.createElement("div");
  timeCol.className = "time-col";
  for (let h = 0; h < 24; h++) {
    const t = document.createElement("div");
    t.className = "time-slot";
    t.textContent = `${h}:00`;
    timeCol.appendChild(t);
  }
  grid.appendChild(timeCol);

  for (let d = 0; d < 7; d++) {
    const date = new Date(start);
    date.setDate(start.getDate() + d);

    const col = document.createElement("div");
    col.className = "day-col";

    for (let h = 0; h < 24; h++) {
      const line = document.createElement("div");
      line.className = "hour-line";
      line.style.top = `${h * hourHeight}px`;
      col.appendChild(line);
    }

    eventsForDate(date).forEach(ev => {
      const [sh, sm] = ev.start.split(":").map(Number);
      const [eh, em] = ev.end.split(":").map(Number);

      const top = (sh + sm / 60) * hourHeight;
      const height = ((eh + em / 60) - (sh + sm / 60)) * hourHeight;

      const e = document.createElement("div");
      e.className = "week-event";
      e.dataset.start = ev.start;
      e.dataset.end = ev.end;

      e.style.top = `${top}px`;
      e.style.height = `${height}px`;
      e.style.background = ev.color;
      
      // Show different text for team events
      if (ev.isTeamEvent) {
        e.textContent = `👥 ${ev.title}`;
        e.style.border = '2px solid var(--neon-purple)';
        e.style.boxShadow = '0 0 10px rgba(176, 38, 255, 0.5)';
      } else {
        e.textContent = ev.title;
      }

      const options = document.createElement("div");
      options.className = "event-options";

      // Only show edit/delete for regular calendar events, not team events
      if (!ev.isTeamEvent) {
        const editBtn = document.createElement("button");
        editBtn.textContent = "✏️";
        editBtn.className = "edit-btn";
        editBtn.onclick = evt => {
          evt.stopPropagation();
          openModal(date, ev);
        };

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "🗑️";
        deleteBtn.className = "delete-btn";
        deleteBtn.onclick = evt => {
          evt.stopPropagation();
          events = events.filter(e => e.id !== ev.id);
          saveEvents();
          render();
        };

        options.appendChild(editBtn);
        options.appendChild(deleteBtn);
      } else {
        // For team events, show info that it's from team events
        const infoBtn = document.createElement("button");
        infoBtn.textContent = "ℹ️";
        infoBtn.className = "edit-btn";
        infoBtn.title = "Team Event - beheer in hoofdmenu";
        infoBtn.style.cursor = 'default';
        options.appendChild(infoBtn);
      }

      e.appendChild(options);
      col.appendChild(e);
    });

    grid.appendChild(col);
  }

  wrapper.appendChild(grid);
  calendarEl.appendChild(wrapper);
  requestAnimationFrame(() => {
    grid.scrollTop = 8 * hourHeight;
  });
}

/* =========================
   INIT
========================= */
render();
setInterval(() => {
  if (view === "week") render();
}, 60000); // elke minuut
