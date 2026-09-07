const STORAGE_KEY = "catatan";
let notes = loadNotes();
let editingId = null;
let pendingImage = null;

const $ = (id) => document.getElementById(id);

function loadNotes() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function today() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value + "T00:00:00");
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric"
  }).format(d);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderNotes(query = "") {
  const root = $("noteList");
  const q = query.trim().toLowerCase();

  const filtered = notes
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .filter(n => !q || [n.title, n.body, n.date].some(v => String(v || "").toLowerCase().includes(q)));

  if (!filtered.length) {
    root.innerHTML = `<div class="empty">$ grep "${escapeHTML(query)}" ~/notes<br><br>no matching notes found.</div>`;
    return;
  }

  root.innerHTML = filtered.map(n => `
    <article class="note-card">
      <div class="note-top">
        <div class="note-title">${escapeHTML(n.title)}</div>
        <div class="note-perm">-rw-r--r--</div>
      </div>
      <div class="note-date">date: ${escapeHTML(formatDate(n.date))}</div>
      <div class="note-body">${escapeHTML(n.body)}</div>
      ${n.image ? `<img class="note-image" src="${n.image}" alt="gambar catatan">` : ""}
      <div class="note-actions">
        <button class="cmd-button primary" data-edit="${escapeHTML(n.id)}">./edit</button>
        <button class="cmd-button" data-delete="${escapeHTML(n.id)}">rm note</button>
      </div>
    </article>
  `).join("");

  root.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => editNote(btn.dataset.edit));
  });
  root.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", () => deleteNote(btn.dataset.delete));
  });
}

function resetEditor() {
  editingId = null;
  pendingImage = null;
  $("noteId").value = "";
  $("noteTitle").value = "";
  $("noteDate").value = today();
  $("noteBody").value = "";
  $("noteImage").value = "";
  $("imagePreview").innerHTML = "";
  $("removeImage").hidden = true;
  $("editorMode").textContent = "NEW NOTE";
}

function editNote(id) {
  const n = notes.find(x => x.id === id);
  if (!n) return;

  editingId = id;
  pendingImage = n.image || null;
  $("noteId").value = n.id;
  $("noteTitle").value = n.title || "";
  $("noteDate").value = n.date || today();
  $("noteBody").value = n.body || "";
  $("noteImage").value = "";
  $("editorMode").textContent = "EDIT NOTE";
  $("imagePreview").innerHTML = n.image ? `<img src="${n.image}" alt="preview">` : "";
  $("removeImage").hidden = !n.image;

  location.hash = "new-note";
  $("noteTitle").focus();
}

function deleteNote(id) {
  const n = notes.find(x => x.id === id);
  if (!n) return;
  if (!confirm(`rm "${n.title}" ?`)) return;

  notes = notes.filter(x => x.id !== id);
  persist();
  renderNotes($("searchInput").value);
  if (editingId === id) resetEditor();
}

$("noteForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const title = $("noteTitle").value.trim();
  const date = $("noteDate").value || today();
  const body = $("noteBody").value.trim();

  if (!title || !body) return;

  if (editingId) {
    const index = notes.findIndex(x => x.id === editingId);
    if (index !== -1) notes[index] = { ...notes[index], title, date, body, image: pendingImage };
  } else {
    notes.push({ id: makeId(), title, date, body, image: pendingImage });
  }

  persist();
  renderNotes($("searchInput").value);
  resetEditor();
  location.hash = "notes";
});

$("cancelEdit").addEventListener("click", () => {
  resetEditor();
  location.hash = "notes";
});

$("searchInput").addEventListener("input", e => renderNotes(e.target.value));

$("noteImage").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) return;

  // Resize/compress before storing to avoid unnecessarily large localStorage usage.
  const bitmap = await createImageBitmap(file);
  const max = 1400;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  pendingImage = canvas.toDataURL("image/jpeg", 0.78);

  $("imagePreview").innerHTML = `<img src="${pendingImage}" alt="preview">`;
  $("removeImage").hidden = false;
});

$("removeImage").addEventListener("click", () => {
  pendingImage = null;
  $("noteImage").value = "";
  $("imagePreview").innerHTML = "";
  $("removeImage").hidden = true;
});

resetEditor();
renderNotes();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(console.error);
}
