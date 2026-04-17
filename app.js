var supabaseClient = window.supabase.createClient(
  "https://pmbckejotwiypykuftkm.supabase.co",
  "sb_publishable_W1NGbl7dFtRyhQzF3UXznQ_ab77fyK-"
);

let allPosts = [];
let isRegisterMode = false;
let currentUser = null;
let isAdmin = false;
let activeCommentPostId = null;
let activeReportPostId = null;
let likedPosts = new Set(JSON.parse(localStorage.getItem("likedPosts") || "[]"));

const DEFAULT_BADWORDS = [
  "pula", "pizda", "muie", "futu", "futut", "cacat", "rahat",
  "curva", "curvar", "dracului", "mortii", "nenorocit",
  "idiot", "cretin", "dobitoc", "labagiu", "sugi", "futui"
];
let badWords = [...DEFAULT_BADWORDS];

// ===================== MODAL HELPERS =====================

function toggleModal(id) {
  document.getElementById(id).classList.toggle("open");
}

function closeModalOutside(event, id) {
  if (event.target === document.getElementById(id)) toggleModal(id);
}

// ===================== AUTH =====================

async function loginGoogle() {
  await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.href }
  });
}

async function loginEmail() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  if (!email || !password) return showToast("Completează emailul și parola!", "error");

  if (isRegisterMode) {
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) return showToast(error.message, "error");
    showToast("Cont creat! Verifică emailul.");
  } else {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return showToast("Email sau parolă greșită!", "error");
  }

  toggleModal("loginModal");
  await initUser();
  incarcaPostari();
}

async function logout() {
  await supabaseClient.auth.signOut();
  location.reload();
}

function toggleRegisterMode() {
  isRegisterMode = !isRegisterMode;
  document.getElementById("modalTitle").textContent = isRegisterMode ? "Creează cont" : "Conectează-te";
  document.getElementById("modalSubtitle").textContent = isRegisterMode ? "Alătură-te comunității" : "Bine ai revenit în comunitate";
  document.getElementById("toggleText").textContent = isRegisterMode ? "Ai deja cont? Conectează-te" : "Nu ai cont? Înregistrează-te";
  document.querySelector(".btn-primary").textContent = isRegisterMode ? "Creează cont" : "Intră cu email";
}

async function initUser() {
  const { data } = await supabaseClient.auth.getUser();
  currentUser = data.user || null;
  isAdmin = currentUser?.user_metadata?.is_admin === true;

  const userDisplay = document.getElementById("userDisplay");
  const loginBtn = document.getElementById("loginNavBtn");
  const logoutBtn = document.getElementById("logoutNavBtn");
  const adminBtn = document.getElementById("adminNavBtn");
  const formSection = document.getElementById("formSection");

  if (currentUser) {
    userDisplay.textContent = currentUser.email.split("@")[0];
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    formSection.style.display = "flex";
    if (isAdmin) adminBtn.style.display = "inline-block";
  } else {
    userDisplay.textContent = "";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    adminBtn.style.display = "none";
    formSection.style.display = "none";
  }
}

// ===================== TOAST =====================

function showToast(msg, type = "success") {
  const existing = document.getElementById("toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "toast";
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
    background: ${type === "error" ? "#ff4444" : "#2d1066"};
    color: white; padding: 12px 24px; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 14px;
    z-index: 9999; box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    animation: fadeInUp 0.3s ease;
  `;

  const style = document.createElement("style");
  style.textContent = `@keyframes fadeInUp { from { opacity:0; transform: translateX(-50%) translateY(10px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }`;
  document.head.appendChild(style);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ===================== FILTRU CUVINTE =====================

function containsBadWord(text) {
  const lower = text.toLowerCase();
  return badWords.find(w => lower.includes(w.toLowerCase())) || null;
}

async function validateRomanian(text) {
  const words = text.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
  if (words.length === 0) return true;
  for (const word of words) {
    const clean = word.replace(/[^a-zA-ZăâîșțĂÂÎȘȚ]/g, "");
    if (!clean) continue;
    try {
      const res = await fetch(`https://api.dexonline.ro/v0/inflected/${encodeURIComponent(clean)}.json`);
      if (res.ok) {
        const json = await res.json();
        if (json.inflected && json.inflected.length > 0) return true;
      }
    } catch (e) { return true; }
  }
  return false;
}

// ===================== POSTS =====================

async function adaugaPost() {
  if (!currentUser) return showToast("Trebuie să fii logat pentru a publica!", "error");

  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();
  const author = document.getElementById("author").value.trim();
  const type = document.getElementById("type").value;

  if (!title || !content) return showToast("Completează titlul și conținutul!", "error");

  const foundBad = containsBadWord(title) || containsBadWord(content);
  if (foundBad) return showToast(`Limbaj inadecvat detectat („${foundBad}"). Postarea nu poate fi publicată.`, "error");

  const publishBtn = document.querySelector("#formSection button");
  publishBtn.textContent = "Se verifică...";
  publishBtn.disabled = true;

  const isRomanian = await validateRomanian(content);
  publishBtn.textContent = "Publică";
  publishBtn.disabled = false;

  if (!isRomanian) return showToast("Conținutul nu pare să fie în română.", "error");

  const { error } = await supabaseClient.from("posts").insert([
    { title, content, author, type, user_id: currentUser.id }
  ]);

  if (error) return showToast("Eroare la publicare: " + error.message, "error");

  document.getElementById("title").value = "";
  document.getElementById("content").value = "";
  document.getElementById("author").value = "";

  showToast("✅ Postarea a fost publicată!");
  incarcaPostari();
}

async function likePost(id, btn) {
  if (likedPosts.has(id)) {
    likedPosts.delete(id);
    btn.classList.remove("liked");
  } else {
    likedPosts.add(id);
    btn.classList.add("liked");
    await supabaseClient.rpc("increment_likes", { row_id: id });
  }
  localStorage.setItem("likedPosts", JSON.stringify([...likedPosts]));

  // Actualizează doar numărul, fără reload complet
  const { data } = await supabaseClient.from("posts").select("likes").eq("id", id).single();
  if (data) btn.querySelector(".like-count").textContent = data.likes || 0;
}

async function editPost(id, title, content) {
  // Refolosim modal-ul de comentarii cu un form de editare
  activeCommentPostId = id;
  const modal = document.getElementById("commentModal");
  document.getElementById("commentModalTitle").textContent = "Editează postarea";
  const list = document.getElementById("commentsList");
  list.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px;">
      <input id="editTitle" value="${title.replace(/"/g, '&quot;')}" style="padding:10px 14px; border:1.5px solid #e5e5e5; border-radius:8px; font-size:14px; font-family:'DM Sans',sans-serif; color:#111;" />
      <textarea id="editContent" style="padding:10px 14px; border:1.5px solid #e5e5e5; border-radius:8px; font-size:14px; font-family:'DM Sans',sans-serif; color:#111; min-height:120px; resize:vertical;">${content}</textarea>
    </div>
  `;
  document.getElementById("commentForm").style.display = "none";
  document.getElementById("commentLoginMsg").style.display = "none";

  // Schimbăm butonul Trimite cu Salvează
  const existingBtn = document.querySelector("#commentModal .btn-save-edit");
  if (existingBtn) existingBtn.remove();
  const saveBtn = document.createElement("button");
  saveBtn.className = "btn-primary btn-save-edit";
  saveBtn.textContent = "Salvează modificările";
  saveBtn.style.marginTop = "8px";
  saveBtn.onclick = async () => {
    const newTitle = document.getElementById("editTitle").value.trim();
    const newContent = document.getElementById("editContent").value.trim();
    if (!newTitle || !newContent) return showToast("Completează toate câmpurile!", "error");
    const { error } = await supabaseClient.from("posts").update({ title: newTitle, content: newContent }).eq("id", id);
    if (error) return showToast("Eroare: " + error.message, "error");
    toggleModal("commentModal");
    showToast("✅ Postarea a fost actualizată!");
    incarcaPostari();
  };
  list.appendChild(saveBtn);
  modal.classList.add("open");
}

async function deletePost(id) {
  if (!confirm("Ești sigur că vrei să ștergi această postare?")) return;
  const { error } = await supabaseClient.from("posts").delete().eq("id", id);
  if (error) return showToast("Eroare: " + error.message, "error");
  showToast("Postarea a fost ștearsă.");
  incarcaPostari();
}

// ===================== COMENTARII =====================

async function openComments(postId, postTitle) {
  activeCommentPostId = postId;
  document.getElementById("commentModalTitle").textContent = `💬 ${postTitle}`;

  // Resetează modal
  const saveBtn = document.querySelector(".btn-save-edit");
  if (saveBtn) saveBtn.remove();

  const list = document.getElementById("commentsList");
  list.innerHTML = `<p class="comments-empty">Se încarcă...</p>`;

  document.getElementById("commentForm").style.display = currentUser ? "flex" : "none";
  document.getElementById("commentLoginMsg").style.display = currentUser ? "none" : "block";
  document.getElementById("commentInput").value = "";

  toggleModal("commentModal");
  await loadComments(postId);
}

async function loadComments(postId) {
  const list = document.getElementById("commentsList");
  const { data, error } = await supabaseClient
    .from("comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) {
    list.innerHTML = `<p class="comments-empty">Niciun comentariu încă. Fii primul! 🕊️</p>`;
    return;
  }

  list.innerHTML = "";
  data.forEach(c => {
    const div = document.createElement("div");
    div.className = "comment-item";
    const date = new Date(c.created_at).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
    div.innerHTML = `
      <div class="comment-meta">${date}</div>
      ${c.content}
    `;
    list.appendChild(div);
  });
}

async function submitComment() {
  const text = document.getElementById("commentInput").value.trim();
  if (!text) return showToast("Scrie un comentariu!", "error");

  const foundBad = containsBadWord(text);
  if (foundBad) return showToast(`Limbaj inadecvat detectat. Comentariul nu poate fi trimis.`, "error");

  const { error } = await supabaseClient.from("comments").insert([{
    post_id: activeCommentPostId,
    content: text
  }]);

  if (error) return showToast("Eroare: " + error.message, "error");

  document.getElementById("commentInput").value = "";
  await loadComments(activeCommentPostId);
  showToast("✅ Comentariu trimis!");
}

// ===================== RAPORTARE =====================

function openReport(postId) {
  activeReportPostId = postId;
  document.querySelectorAll('input[name="reportReason"]').forEach(r => r.checked = false);
  document.getElementById("reportExtra").value = "";
  toggleModal("reportModal");
}

async function submitReport() {
  const selected = document.querySelector('input[name="reportReason"]:checked');
  if (!selected) return showToast("Selectează un motiv!", "error");

  const extra = document.getElementById("reportExtra").value.trim();
  const reason = selected.value + (extra ? ` — ${extra}` : "");

  const { error } = await supabaseClient.from("reports").insert([{
    post_id: activeReportPostId,
    reason: reason,
    reported_by: currentUser ? currentUser.id : null
  }]);

  if (error) return showToast("Eroare: " + error.message, "error");

  toggleModal("reportModal");
  showToast("✅ Raportul a fost trimis. Mulțumim!");
}

// ===================== DISPLAY POSTS =====================

async function afiseazaLista(data) {
  const container = document.getElementById("posts");
  container.innerHTML = "";

  if (!data || data.length === 0) {
    container.innerHTML = `<p class="empty-msg">Nicio postare găsită.</p>`;
    return;
  }

  data.forEach(p => {
    const div = document.createElement("div");
    div.className = "post";

    const isOwner = currentUser && currentUser.id === p.user_id;
    const canEdit = isOwner || isAdmin;
    const isLiked = likedPosts.has(p.id);

    div.innerHTML = `
      <h3>${p.title}</h3>
      <small>✍️ ${p.author || "Anonim"} • ${p.type}</small>
      <p>${p.content}</p>
      <div class="post-actions">
        <button class="btn-like ${isLiked ? 'liked' : ''}" onclick="likePost('${p.id}', this)">
          <span class="heart">❤️</span>
          <span class="like-count">${p.likes || 0}</span>
        </button>
        <button onclick="openComments('${p.id}', \`${p.title.replace(/`/g, "'")}\`)">💬 Comentarii</button>
        ${currentUser && !isOwner ? `<button class="btn-report" onclick="openReport('${p.id}')">🚨 Raportează</button>` : ""}
        ${canEdit ? `
          <button onclick="editPost('${p.id}', \`${p.title.replace(/`/g, "'")}\`, \`${p.content.replace(/`/g, "'")}\`)">✏️ Editează</button>
          <button class="btn-delete" onclick="deletePost('${p.id}')">🗑️ Șterge</button>
        ` : ""}
      </div>
    `;

    container.appendChild(div);
  });
}

async function incarcaPostari() {
  const { data } = await supabaseClient
    .from("posts").select("*").order("created_at", { ascending: false });
  allPosts = data || [];
  afiseazaLista(allPosts);
}

function searchPosts() {
  const val = document.getElementById("search").value.toLowerCase();
  const filtered = allPosts.filter(p =>
    p.title.toLowerCase().includes(val) || p.content.toLowerCase().includes(val)
  );
  afiseazaLista(filtered);
}

function incarcaToate() { incarcaPostari(); }
function incarcaPoezii() { afiseazaLista(allPosts.filter(p => p.type === "poezie")); }
function incarcaCantece() { afiseazaLista(allPosts.filter(p => p.type === "cantec")); }

// ===================== ADMIN PANEL =====================

function toggleAdminPanel() {
  const panel = document.getElementById("adminPanel");
  const isVisible = panel.style.display !== "none";
  panel.style.display = isVisible ? "none" : "block";
  if (!isVisible) { loadReported(); loadBadwords(); }
}

function switchTab(tab) {
  document.getElementById("tab-reported").style.display = tab === "reported" ? "block" : "none";
  document.getElementById("tab-badwords").style.display = tab === "badwords" ? "block" : "none";
  document.querySelectorAll(".tab-btn").forEach((btn, i) => {
    btn.classList.toggle("active", (i === 0 && tab === "reported") || (i === 1 && tab === "badwords"));
  });
}

async function loadReported() {
  const container = document.getElementById("reportedList");
  container.innerHTML = `<p class="empty-msg">Se încarcă...</p>`;

  const { data, error } = await supabaseClient
    .from("reports")
    .select("*, posts(title, content, author)")
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    container.innerHTML = `<p class="empty-msg">✅ Nicio postare raportată momentan.</p>`;
    return;
  }

  container.innerHTML = "";
  data.forEach(r => {
    const post = r.posts;
    const div = document.createElement("div");
    div.className = "reported-item";
    div.innerHTML = `
      <h4>${post ? post.title : "Postare ștearsă"}</h4>
      <p>${post ? post.content.substring(0, 100) + (post.content.length > 100 ? "..." : "") : "-"}</p>
      <p class="report-reason">🚨 ${r.reason}</p>
      <div class="report-actions">
        <button class="btn-dismiss" onclick="dismissReport('${r.id}')">✓ Ignoră</button>
        ${post ? `<button class="btn-remove-post" onclick="deletePostAdmin('${r.post_id}', '${r.id}')">🗑️ Șterge postarea</button>` : ""}
      </div>
    `;
    container.appendChild(div);
  });
}

async function dismissReport(reportId) {
  await supabaseClient.from("reports").delete().eq("id", reportId);
  showToast("Raport ignorat.");
  loadReported();
}

async function deletePostAdmin(postId, reportId) {
  if (!confirm("Ștergi postarea definitiv?")) return;
  await supabaseClient.from("posts").delete().eq("id", postId);
  await supabaseClient.from("reports").delete().eq("id", reportId);
  showToast("Postarea a fost ștearsă.");
  loadReported();
  incarcaPostari();
}

function loadBadwords() {
  const container = document.getElementById("badwordsList");
  container.innerHTML = `<div class="badword-tags">` +
    badWords.map(w => `
      <span class="badword-tag">${w}
        <button onclick="removeBadword('${w}')">✕</button>
      </span>
    `).join("") +
  `</div>`;
}

function addBadword() {
  const input = document.getElementById("newBadword");
  const word = input.value.trim().toLowerCase();
  if (!word) return;
  if (badWords.includes(word)) return showToast("Cuvântul există deja!", "error");
  badWords.push(word);
  input.value = "";
  loadBadwords();
  showToast(`„${word}" adăugat în lista neagră.`);
}

function removeBadword(word) {
  badWords = badWords.filter(w => w !== word);
  loadBadwords();
}

// ===================== INIT =====================
initUser();
incarcaPostari();
