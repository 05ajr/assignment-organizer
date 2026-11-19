type Priority = "low" | "medium" | "high";
type Filter = "all" | "upcoming" | "overdue" | "completed";

interface Assignment {
  id: string;
  title: string;
  course: string;
  dueDate: string;
  priority: Priority;
  completed: boolean;
}

const storageKey = "my-assignment-organizer";
const form = document.querySelector<HTMLFormElement>("#assignmentForm")!;
const titleInput = document.querySelector<HTMLInputElement>("#title")!;
const courseInput = document.querySelector<HTMLInputElement>("#course")!;
const dueInput = document.querySelector<HTMLInputElement>("#dueDate")!;
const priorityInput = document.querySelector<HTMLSelectElement>("#priority")!;
const searchInput = document.querySelector<HTMLInputElement>("#search")!;
const list = document.querySelector<HTMLDivElement>("#assignmentList")!;
const formTitle = document.querySelector<HTMLElement>("#formTitle")!;
const saveButton = document.querySelector<HTMLButtonElement>("#saveButton")!;
const cancelButton = document.querySelector<HTMLButtonElement>("#cancelButton")!;
const calendarGrid = document.querySelector<HTMLDivElement>("#calendarGrid")!;
const calendarMonthTitle = document.querySelector<HTMLElement>("#calendarMonth")!;
const selectedDayTitle = document.querySelector<HTMLElement>("#selectedDayTitle")!;
const selectedDayList = document.querySelector<HTMLDivElement>("#selectedDayList")!;
const addOnDayButton = document.querySelector<HTMLButtonElement>("#addOnDay")!;

let assignments: Assignment[] = loadAssignments();
let editingId: string | null = null;
let activeFilter: Filter = "all";
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedDate: string | null = localDate();

function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isAssignment(value: unknown): value is Assignment {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Assignment>;
  return typeof item.id === "string"
    && typeof item.title === "string"
    && typeof item.course === "string"
    && typeof item.dueDate === "string"
    && (item.priority === "low" || item.priority === "medium" || item.priority === "high")
    && typeof item.completed === "boolean";
}

function loadAssignments(): Assignment[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(saved) ? saved.filter(isAssignment) : [];
  } catch {
    return [];
  }
}

function saveAssignments(): void {
  localStorage.setItem(storageKey, JSON.stringify(assignments));
}

function daysUntil(dateText: string): number {
  const [year, month, day] = dateText.split("-").map(Number);
  const now = new Date();
  // UTC avoids day-count errors when daylight saving time changes.
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const due = Date.UTC(year, month - 1, day);
  return Math.round((due - today) / 86400000);
}

function dueLabel(item: Assignment): string {
  if (item.completed) return "Completed";
  const days = daysUntil(item.dueDate);
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} late`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 7) return `Due in ${days} days`;
  return new Date(item.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function resetForm(): void {
  form.reset();
  editingId = null;
  dueInput.value = localDate();
  formTitle.textContent = "New assignment";
  saveButton.textContent = "Add assignment";
  cancelButton.hidden = true;
}

function matchesFilter(item: Assignment): boolean {
  const days = daysUntil(item.dueDate);
  if (activeFilter === "upcoming") return !item.completed && days >= 0;
  if (activeFilter === "overdue") return !item.completed && days < 0;
  if (activeFilter === "completed") return item.completed;
  return true;
}

function renderCalendar(): void {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  calendarMonthTitle.textContent = calendarMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
  calendarGrid.replaceChildren();

  for (let i = 0; i < firstWeekday; i++) {
    const blank = document.createElement("div");
    blank.className = "calendar-blank";
    calendarGrid.append(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = localDate(new Date(year, month, day));
    const due = assignments.filter(item => item.dueDate === date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.setAttribute("aria-label", `${new Date(year, month, day).toLocaleDateString("en-US", { month: "long", day: "numeric" })}, ${due.length} assignments`);
    button.setAttribute("aria-pressed", String(date === selectedDate));
    if (date === localDate()) button.classList.add("today");
    if (date === selectedDate) button.classList.add("chosen");

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = String(day);
    button.append(number);

    due.slice(0, 2).forEach(item => {
      const tag = document.createElement("span");
      tag.className = `calendar-item${item.completed ? " done" : ""}`;
      tag.textContent = item.title;
      button.append(tag);
    });

    if (due.length > 2) {
      const extra = document.createElement("span");
      extra.className = "calendar-extra";
      extra.textContent = `+${due.length - 2} more`;
      button.append(extra);
    }

    button.addEventListener("click", () => {
      selectedDate = date;
      renderCalendar();
    });
    calendarGrid.append(button);
  }

  // Keep the last week from leaving an uneven row in the grid.
  const totalCells = firstWeekday + daysInMonth;
  for (let i = totalCells; i % 7 !== 0; i++) {
    const blank = document.createElement("div");
    blank.className = "calendar-blank";
    calendarGrid.append(blank);
  }

  selectedDayList.replaceChildren();
  addOnDayButton.hidden = !selectedDate;
  if (!selectedDate) {
    selectedDayTitle.textContent = "Select a date";
    const message = document.createElement("p");
    message.className = "section-note";
    message.textContent = "Choose a day above to see assignments due that day.";
    selectedDayList.append(message);
    return;
  }

  selectedDayTitle.textContent = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric"
  });
  const due = assignments.filter(item => item.dueDate === selectedDate);
  if (!due.length) {
    const message = document.createElement("p");
    message.className = "section-note";
    message.textContent = "No assignments due on this day.";
    selectedDayList.append(message);
    return;
  }

  due.forEach(item => {
    const row = document.createElement("div");
    row.className = "day-assignment";
    const description = document.createElement("span");
    description.textContent = `${item.title} (${item.course})${item.completed ? " - completed" : ""}`;
    if (item.completed) description.className = "day-completed";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit";
    edit.setAttribute("aria-label", `Edit ${item.title}`);
    edit.addEventListener("click", () => editAssignment(item.id));
    row.append(description, edit);
    selectedDayList.append(row);
  });
}

function render(): void {
  const completed = assignments.filter(item => item.completed).length;
  const dueSoon = assignments.filter(item => !item.completed && daysUntil(item.dueDate) >= 0 && daysUntil(item.dueDate) <= 7).length;
  const progress = assignments.length ? Math.round(completed / assignments.length * 100) : 0;

  document.querySelector<HTMLElement>("#totalCount")!.textContent = String(assignments.length);
  document.querySelector<HTMLElement>("#soonCount")!.textContent = String(dueSoon);
  document.querySelector<HTMLElement>("#completedCount")!.textContent = String(completed);
  document.querySelector<HTMLElement>("#progressText")!.textContent = `${progress}%`;
  document.querySelector<HTMLElement>("#progressFill")!.style.width = `${progress}%`;

  const term = searchInput.value.trim().toLowerCase();
  const visible = assignments
    .filter(item => matchesFilter(item) && `${item.title} ${item.course}`.toLowerCase().includes(term))
    .sort((a, b) => Number(a.completed) - Number(b.completed) || a.dueDate.localeCompare(b.dueDate));

  document.querySelector<HTMLElement>("#resultsCount")!.textContent = `${visible.length} ${visible.length === 1 ? "assignment" : "assignments"}`;
  list.replaceChildren();

  if (!visible.length) {
    const message = document.createElement("p");
    message.className = "empty";
    message.textContent = assignments.length ? "No assignments match your search or filter." : "No assignments yet. Add one to get started.";
    list.append(message);
  }

  visible.forEach(item => {
    const row = document.createElement("div");
    row.className = `assignment${item.completed ? " completed" : ""}`;
    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "complete-box";
    check.checked = item.completed;
    check.setAttribute("aria-label", `Mark ${item.title} ${item.completed ? "incomplete" : "complete"}`);
    check.addEventListener("change", () => toggleComplete(item.id));

    const main = document.createElement("div");
    main.className = "assignment-main";
    const title = document.createElement("strong");
    title.textContent = item.title;
    const course = document.createElement("small");
    course.textContent = item.course;
    const labels = document.createElement("div");
    labels.className = "labels";
    const priority = document.createElement("span");
    priority.className = `tag ${item.priority}`;
    priority.textContent = `${item.priority[0].toUpperCase() + item.priority.slice(1)} priority`;
    const date = document.createElement("span");
    date.className = `tag date${!item.completed && daysUntil(item.dueDate) < 0 ? " late" : ""}`;
    date.textContent = dueLabel(item);
    labels.append(priority, date);
    main.append(title, course, labels);

    const actions = document.createElement("div");
    actions.className = "assignment-actions";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.setAttribute("aria-label", `Edit ${item.title}`);
    editButton.addEventListener("click", () => editAssignment(item.id));
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete ${item.title}`);
    deleteButton.addEventListener("click", () => deleteAssignment(item.id));
    actions.append(editButton, deleteButton);
    row.append(check, main, actions);
    list.append(row);
  });
  renderCalendar();
}

function toggleComplete(id: string): void {
  assignments = assignments.map(item => item.id === id ? { ...item, completed: !item.completed } : item);
  saveAssignments();
  render();
}

function editAssignment(id: string): void {
  const item = assignments.find(entry => entry.id === id);
  if (!item) return;
  editingId = id;
  titleInput.value = item.title;
  courseInput.value = item.course;
  dueInput.value = item.dueDate;
  priorityInput.value = item.priority;
  formTitle.textContent = "Edit assignment";
  saveButton.textContent = "Save changes";
  cancelButton.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  titleInput.focus({ preventScroll: true });
}

function deleteAssignment(id: string): void {
  if (!confirm("Delete this assignment?")) return;
  assignments = assignments.filter(item => item.id !== id);
  saveAssignments();
  if (editingId === id) resetForm();
  render();
}

form.addEventListener("submit", event => {
  event.preventDefault();
  if (!titleInput.value.trim() || !courseInput.value.trim() || !dueInput.value) return;

  const previous = assignments.find(item => item.id === editingId);
  const entry: Assignment = {
    id: editingId ?? `${Date.now()}-${Math.random()}`,
    title: titleInput.value.trim(),
    course: courseInput.value.trim(),
    dueDate: dueInput.value,
    priority: priorityInput.value as Priority,
    completed: previous ? previous.completed : false
  };

  if (editingId) assignments = assignments.map(item => item.id === editingId ? entry : item);
  else assignments.push(entry);
  saveAssignments();
  const [year, month] = entry.dueDate.split("-").map(Number);
  calendarMonth = new Date(year, month - 1, 1);
  selectedDate = entry.dueDate;
  resetForm();
  render();
});

cancelButton.addEventListener("click", resetForm);

function changeMonth(amount: number): void {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + amount, 1);
  selectedDate = null;
  renderCalendar();
}

document.querySelector<HTMLButtonElement>("#prevMonth")!.addEventListener("click", () => changeMonth(-1));
document.querySelector<HTMLButtonElement>("#nextMonth")!.addEventListener("click", () => changeMonth(1));
document.querySelector<HTMLButtonElement>("#todayButton")!.addEventListener("click", () => {
  const today = new Date();
  calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  selectedDate = localDate(today);
  renderCalendar();
});
addOnDayButton.addEventListener("click", () => {
  if (!selectedDate) return;
  resetForm();
  dueInput.value = selectedDate;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  titleInput.focus({ preventScroll: true });
});
searchInput.addEventListener("input", render);
document.querySelectorAll<HTMLButtonElement>(".tabs button").forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter as Filter;
    document.querySelectorAll<HTMLButtonElement>(".tabs button").forEach(tab => tab.classList.toggle("selected", tab === button));
    render();
  });
});

resetForm();
render();
