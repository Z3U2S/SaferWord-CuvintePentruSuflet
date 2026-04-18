/ ===========================================
SAFERWORD — app.js (enhanced)
=========================================== /

const supabaseClient = window.supabase.createClient(
“https://pmbckejotwiypykuftkm.supabase.co”,
“sb_publishable_W1NGbl7dFtRyhQzF3UXznQ_ab77fyK-”
);

const ADMIN_EMAIL = “saferika88@gmail.com”;

let allPosts = [];
let currentUser = null;
let currentFilter = “toate”;
let activeCommentPostId = null;
let profileData = {};

/ ── INIT ── /
document.addEventListener(“DOMContentLoaded”, async () => {
await refreshUser();
await incarcaPostari();
handleAuthRedirect();
});

async function handleAuthRedirect() {
const hash = window.location.hash;
if (hash && hash.includes(“access_token”)) {
await refreshUser();
window.history.replaceState(null, “”, window.location.pathname);
// Check if new user needs to accept ToS
if (currentUser) checkToS();
}
}

/ ── TOS (Termeni & Condiții) ── /
const TOS_KEY = “saferword_tos_accepted_v1”;

function checkToS() {
if (!currentUser) return;
// Check per-user acceptance stored in localStorage
const accepted = localStorage.getItem(${TOS_KEY}_${currentUser.id});
if (!accepted) {
document.getElementById(“tosOverlay”).classList.add(“open”);
}
}

function toggleTosBtn() {
const checked = document.getElementById(“tosCheck”).checked;
document.getElementById(“tosAcceptBtn”).disabled = !checked;
}

function acceptToS() {
if (!currentUser) return;
localStorage.setItem(${TOS_KEY}_${currentUser.id}, “true”);
document.getElementById(“tosOverlay”).classList.remove(“open”);
}

function rejectToS() {
logout();
document.getElementById(“tosOverlay”).classList.remove(“open”);
}

function closeToS() {
document.getElementById(“tosOverlay”).classList.remove(“open”);
}

function toggleLegal() {
const legal = document.getElementById(“legalSection”);
const isVisible = legal.style.display !== “none”;
// Hide posts area, show legal
document.getElementById(“posts”).style.display = isVisible ? “block” : “none”;
legal.style.display = isVisible ? “none” : “block”;
document.getElementById(“formSection”).style.display = “none”;
// Scroll to top of legal
if (!isVisible) legal.scrollIntoView({ behavior: “smooth”, block: “start” });
}

/ ── AUTH ── /
async function refreshUser() {
const { data } = await supabaseClient.auth.getUser();
const wasLoggedIn = !!currentUser;
currentUser = data?.user || null;
afiseazaHeaderUser();
// Show ToS on first login
if (!wasLoggedIn && currentUser) checkToS();
}

async function loginGoogle() {
await supabaseClient.auth.signInWithOAuth({
provider: “google”,
options: { redirectTo: window.location.href }
});
}

async function logout() {
await supabaseClient.auth.signOut();
currentUser = null;
profileData = {};
afiseazaHeaderUser();
document.getElementById(“authPanel”).style.display = “none”;
incarcaPostari();
}

function afiseazaHeaderUser() {
const chip = document.getElementById(“headerEmail”);
const avatarEl = document.getElementById(“headerAvatar”);
if (currentUser) {
chip.textContent = currentUser.email.split(”@”)[0];
if (profileData.avatar_url) {
avatarEl.innerHTML = <img src="${profileData.avatar_url}" alt="">;
} else {
avatarEl.textContent = currentUser.email[0].toUpperCase();
}
} else {
chip.textContent = “Cont”;
avatarEl.textContent = “?”;
}
}

/ ── TOGGLE PROFILE PANEL ── /
async function toggleProfile() {
const panel = document.getElementById(“authPanel”);
const isVisible = panel.style.display !== “none”;
panel.style.display = isVisible ? “none” : “block”;

if (!isVisible) {
if (currentUser) {
document.getElementById(“authContent”).style.display = “none”;
document.getElementById(“profileContent”).style.display = “block”;
await incarcaProfil();
} else {
document.getElementById(“authContent”).style.display = “block”;
document.getElementById(“profileContent”).style.display = “none”;
}
}
}

/ ── PROFILE ── /
async function incarcaProfil() {
if (!currentUser) return;
const { data } = await supabaseClient
.from(“profiles”)
.select(”*”)
.eq(“user_id”, currentUser.id)
.single();

profileData = data || {};

if (data) {
document.getElementById(“profileNume”).value = data.display_name || “”;
document.getElementById(“profileLocatie”).value = data.location || “”;
document.getElementById(“profileSex”).value = data.sex || “”;
document.getElementById(“profileBio”).value = data.bio || “”;

if (data.avatar_url) {
  document.getElementById("profileImg").src = data.avatar_url;
  document.getElementById("profileImg").style.display = "block";
  document.getElementById("profileInitial").style.display = "none";
} else {
  document.getElementById("profileImg").style.display = "none";
  document.getElementById("profileInitial").style.display = "flex";
  document.getElementById("profileInitial").textContent = currentUser.email[0].toUpperCase();
}
}
}

async function salveazaProfil() {
if (!currentUser) return;
const payload = {
user_id: currentUser.id,
display_name: document.getElementById(“profileNume”).value,
location: document.getElementById(“profileLocatie”).value,
sex: document.getElementById(“profileSex”).value,
bio: document.getElementById(“profileBio”).value,
avatar_url: profileData.avatar_url || null
};

const { error } = await supabaseClient
.from(“profiles”)
.upsert(payload, { onConflict: “user_id” });

if (!error) {
profileData = payload;
afiseazaHeaderUser();
alert(“Profil salvat ✦”);
} else {
console.error(error);
alert(“Eroare la salvare. Verifică tabelul ‘profiles’ în Supabase.”);
}
}

async function uploadAvatar(input) {
if (!currentUser || !input.files[0]) return;
const file = input.files[0];
const ext = file.name.split(”.”).pop();
const path = avatars/${currentUser.id}.${ext};

const { error } = await supabaseClient.storage
.from(“avatars”)
.upload(path, file, { upsert: true });

if (!error) {
const { data: urlData } = supabaseClient.storage.from(“avatars”).getPublicUrl(path);
profileData.avatar_url = urlData.publicUrl;
document.getElementById(“profileImg”).src = urlData.publicUrl;
document.getElementById(“profileImg”).style.display = “block”;
document.getElementById(“profileInitial”).style.display = “none”;
afiseazaHeaderUser();
} else {
alert(“Nu s-a putut uploada imaginea. Asigură-te că bucket-ul ‘avatars’ există în Supabase Storage.”);
console.error(error);
}
}

/ ── TOGGLE FORM ── /
function toggleForm() {
const f = document.getElementById(“formSection”);
f.style.display = f.style.display === “none” ? “block” : “none”;
}

/ ── ADD POST ── /
async function adaugaPost() {
if (!currentUser) return alert(“Te rog loghează-te mai întâi!”);

const title = document.getElementById(“title”).value.trim();
const content = document.getElementById(“content”).value.trim();
const author = document.getElementById(“author”).value.trim();
const type = document.getElementById(“type”).value;

if (!title || !content) return alert(“Completează titlul și conținutul.”);

const { error } = await supabaseClient.from(“posts”).insert([{
title, content, author: author || null, type,
user_id: currentUser.id,
views: 0, likes: 0
}]);

if (!error) {
document.getElementById(“title”).value = “”;
document.getElementById(“content”).value = “”;
document.getElementById(“author”).value = “”;
toggleForm();
await incarcaPostari();
} else {
console.error(error);
alert(“Eroare la publicare. Verifică structura tabelului.”);
}
}

/ ── DELETE ── /
async function deletePost(id) {
if (!confirm(“Ștergi această resursă?”)) return;
await supabaseClient.from(“posts”).delete().eq(“id”, id);
incarcaPostari();
}

/ ── EDIT ── /
function startEdit(id) {
document.getElementById(view-${id}).style.display = “none”;
document.getElementById(edit-${id}).style.display = “block”;
}

async function saveEdit(id) {
const title = document.getElementById(edit-title-${id}).value.trim();
const content = document.getElementById(edit-content-${id}).value.trim();
const type = document.getElementById(edit-type-${id}).value;

const { error } = await supabaseClient
.from(“posts”)
.update({ title, content, type })
.eq(“id”, id);

if (!error) incarcaPostari();
else console.error(error);
}

function cancelEdit(id) {
document.getElementById(edit-${id}).style.display = “none”;
document.getElementById(view-${id}).style.display = “block”;
}

/ ── VIEWS ── /
async function incrementViews(id) {
const post = allPosts.find(p => p.id === id);
if (!post) return;
const newViews = (post.views || 0) + 1;
await supabaseClient.from(“posts”).update({ views: newViews }).eq(“id”, id);
post.views = newViews;
// Update display
const el = document.getElementById(views-${id});
if (el) el.textContent = newViews;
}

/ ── LIKES ── /
async function toggleLike(id) {
if (!currentUser) return alert(“Loghează-te pentru a da like!”);

const key = liked_${id};
const liked = localStorage.getItem(key);

const post = allPosts.find(p => p.id === id);
if (!post) return;

const newLikes = liked
? Math.max(0, (post.likes || 0) - 1)
: (post.likes || 0) + 1;

await supabaseClient.from(“posts”).update({ likes: newLikes }).eq(“id”, id);
post.likes = newLikes;

if (liked) {
localStorage.removeItem(key);
} else {
localStorage.setItem(key, “1”);
}

// Update btn
const btn = document.getElementById(like-btn-${id});
const count = document.getElementById(like-count-${id});
if (btn) btn.classList.toggle(“liked”, !liked);
if (count) count.textContent = newLikes;
}

/ ── COMMENTS ── /
async function openComments(postId, postTitle) {
activeCommentPostId = postId;
document.getElementById(“commentsPanelTitle”).textContent = 💬 ${postTitle};
document.getElementById(“commentsOverlay”).classList.add(“open”);
document.body.style.overflow = “hidden”;

await incrementViews(postId);
await loadComments(postId);
}

function closeComments(e) {
if (e && e.target !== document.getElementById(“commentsOverlay”)) return;
document.getElementById(“commentsOverlay”).classList.remove(“open”);
document.body.style.overflow = “”;
activeCommentPostId = null;
}

async function loadComments(postId) {
const list = document.getElementById(“commentsList”);
list.innerHTML = <div class="comment-empty">Se încarcă...</div>;

const { data, error } = await supabaseClient
.from(“comments”)
.select(”*”)
.eq(“post_id”, postId)
.order(“created_at”, { ascending: true });

list.innerHTML = “”;

if (error || !data || data.length === 0) {
list.innerHTML = <div class="comment-empty">Niciun comentariu încă. Fii primul! ✦</div>;
} else {
data.forEach(c => {
const div = document.createElement(“div”);
div.className = “comment-item”;
div.innerHTML = <div class="comment-author">✦ ${c.author_email || "Anonim"}</div> <div class="comment-text">${escapeHtml(c.content)}</div> <div class="comment-date">${formatDate(c.created_at)}</div>;
list.appendChild(div);
});
}

// Show input or login prompt
if (currentUser) {
document.getElementById(“commentInputArea”).style.display = “flex”;
document.getElementById(“commentLoginPrompt”).style.display = “none”;
} else {
document.getElementById(“commentInputArea”).style.display = “none”;
document.getElementById(“commentLoginPrompt”).style.display = “block”;
}
}

async function adaugaComment() {
if (!currentUser || !activeCommentPostId) return;
const content = document.getElementById(“newComment”).value.trim();
if (!content) return;

const { error } = await supabaseClient.from(“comments”).insert([{
post_id: activeCommentPostId,
user_id: currentUser.id,
author_email: currentUser.email,
content
}]);

if (!error) {
document.getElementById(“newComment”).value = “”;
await loadComments(activeCommentPostId);
} else {
console.error(error);
alert(“Eroare la comentariu. Verifică tabelul ‘comments’ în Supabase.”);
}
}

/ ── LOAD ── /
async function incarcaPostari() {
const { data } = await supabaseClient
.from(“posts”)
.select(”*”)
.order(“id”, { ascending: false });

allPosts = data || [];
afiseazaGrupat(filterPosts(allPosts));

// Update widgets
afiseazaVerset();
afiseazaLatest(allPosts);
afiseazaTop(allPosts);
}

function filterPosts(posts) {
if (currentFilter = “poezii”) return posts.filter(p => p.type = “poezie”);
if (currentFilter = “cantece”) return posts.filter(p => p.type = “cantec”);
return posts;
}

/ ── DISPLAY GROUPED BY AUTHOR ── /
function afiseazaGrupat(posts) {
const container = document.getElementById(“posts”);
container.innerHTML = “”;

if (posts.length === 0) {
container.innerHTML = <div style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);font-size:1rem;">Nicio resursă găsită ✦</div>;
return;
}

// Group by author
const groups = {};
posts.forEach(p => {
const key = p.author || “Anonim”;
if (!groups[key]) groups[key] = [];
groups[key].push(p);
});

Object.entries(groups).forEach(([author, groupPosts]) => {
const groupDiv = document.createElement(“div”);
groupDiv.className = “author-group”;

const initials = author.charAt(0).toUpperCase();
const totalLikes = groupPosts.reduce((s, p) => s + (p.likes || 0), 0);

// Header
const header = document.createElement("div");
header.className = "author-group-header";
header.innerHTML = `
  <div class="author-avatar-sm">${initials}</div>
  <div class="author-group-info">
    <div class="author-group-name">✍️ ${escapeHtml(author)}</div>
    <div class="author-group-meta">${groupPosts.length} resurse · ♥ ${totalLikes} aprecieri</div>
  </div>
  <span class="author-group-chevron">▼</span>
`;

// Posts container
const postsDiv = document.createElement("div");
postsDiv.className = "author-group-posts";

groupPosts.forEach(p => {
  postsDiv.appendChild(buildPostEl(p));
});

// Toggle
header.addEventListener("click", () => {
  const isOpen = postsDiv.classList.contains("open");
  postsDiv.classList.toggle("open");
  header.classList.toggle("open", !isOpen);
  header.querySelector(".author-group-chevron").classList.toggle("open", !isOpen);
});

// Open first group by default
if (Object.keys(groups).indexOf(author) === 0) {
  postsDiv.classList.add("open");
  header.classList.add("open");
  header.querySelector(".author-group-chevron").classList.add("open");
}

groupDiv.appendChild(header);
groupDiv.appendChild(postsDiv);
container.appendChild(groupDiv);
});
}

function buildPostEl(p) {
const isOwner = currentUser && p.userid = currentUser.id;
const isAdmin = currentUser && currentUser.email = ADMIN_EMAIL;
const liked = localStorage.getItem(`liked${p.id}`);
const badgeClass = p.type = “cantec” ? “cantec” : “”;
const typeLabel = p.type = “cantec” ? “🎵 Cântec” : “📜 Poezie”;

const div = document.createElement(“div”);
div.className = “post”;

div.innerHTML = <!-- VIEW MODE --> <div id="view-${p.id}"> <div class="post-type-badge ${badgeClass}">${typeLabel}</div> <div class="post-title">${escapeHtml(p.title)}</div> <div class="post-meta"> <span>📅 ${formatDate(p.created_at)}</span> <span>👁 <span id="views-${p.id}">${p.views || 0}</span></span> <span>♥ <span id="like-count-display-${p.id}">${p.likes || 0}</span></span> </div> <div class="post-content">${escapeHtml(p.content)}</div> <div class="post-actions"> <button class="action-btn ${liked ? 'liked' : ''}" id="like-btn-${p.id}" onclick="toggleLike('${p.id}')"> <span class="btn-icon">♥</span> <span id="like-count-${p.id}">${p.likes || 0}</span> </button> <button class="action-btn" onclick="openComments('${p.id}', ${JSON.stringify(escapeHtml(p.title))})"> <span class="btn-icon">💬</span> Comentarii </button> ${(isOwner || isAdmin) ?


` : “”}

<!-- EDIT MODE -->
<div id="edit-${p.id}" style="display:none;" class="edit-form">
  <input id="edit-title-${p.id}" class="field" value="${escapeHtmlAttr(p.title)}" placeholder="Titlu">
  <textarea id="edit-content-${p.id}" class="field" rows="6" placeholder="Conținut">${escapeHtml(p.content)}</textarea>
  <select id="edit-type-${p.id}" class="field">
    <option value="poezie" ${p.type === 'poezie' ? 'selected' : ''}>📜 Poezie</option>
    <option value="cantec" ${p.type === 'cantec' ? 'selected' : ''}>🎵 Cântec</option>
  </select>
  <div class="post-actions">
    <button class="btn-primary" onclick="saveEdit('${p.id}')">💾 Salvează</button>
    <button class="btn-secondary" onclick="cancelEdit('${p.id}')">Anulează</button>
  </div>
</div>
`;

return div;
}

/ ── NAV ── /
function setNav(btn, filter) {
document.querySelectorAll(”.nav-btn”).forEach(b => b.classList.remove(“active”));
btn.classList.add(“active”);
currentFilter = filter;
document.getElementById(“formSection”).style.display = “none”;

if (filter = “termeni”) {
document.getElementById(“legalSection”).style.display = “block”;
document.getElementById(“posts”).style.display = “none”;
toggleWidgets(false);
} else {
document.getElementById(“legalSection”).style.display = “none”;
document.getElementById(“posts”).style.display = “block”;
toggleWidgets(filter = “toate”);
afiseazaGrupat(filterPosts(allPosts));
}
}

/ ── SEARCH ── /
function searchPosts() {
const val = document.getElementById(“search”).value.toLowerCase();
const filtered = filterPosts(allPosts).filter(p =>
p.title.toLowerCase().includes(val) ||
(p.content && p.content.toLowerCase().includes(val)) ||
(p.author && p.author.toLowerCase().includes(val))
);
afiseazaGrupat(filtered);
}

/ ── HELPERS ── /
function escapeHtml(str) {
if (!str) return “”;
return String(str)
.replace(/&/g, “&”)
.replace(/</g, “<”)
.replace(/>/g, “>”)
.replace(/”/g, “"”);
}

function escapeHtmlAttr(str) {
if (!str) return “”;
return String(str).replace(/”/g, “"”).replace(/’/g, “'”);
}

function formatDate(iso) {
if (!iso) return “”;
const d = new Date(iso);
return d.toLocaleDateString(“ro-RO”, { day: “2-digit”, month: “short”, year: “numeric” });
}

/ ════════════════════════════════════════
WIDGETS
════════════════════════════════════════ /

/ ── VERSET ZILNIC ── /
const VERSETE = [
{ text: “Căci Dumnezeu atât de mult a iubit lumea, că a dat pe singurul Lui Fiu, pentru ca oricine crede în El să nu piară, ci să aibă viață veșnică.”, ref: “Ioan 3:16” },
{ text: “Eu sunt calea, adevărul și viața. Nimeni nu vine la Tatăl decât prin Mine.”, ref: “Ioan 14:6” },
{ text: “Domnul este păstorul meu: nu voi duce lipsă de nimic.”, ref: “Psalmul 23:1” },
{ text: “Puteți face totul prin Hristos care vă întărește.”, ref: “Filipeni 4:13” },
{ text: “Fiți tari și îmbărbătați-vă! Nu vă temeți și nu vă înspăimântați de ei, căci Domnul Dumnezeul vostru merge cu voi.”, ref: “Deuteronom 31:6” },
{ text: “Veniți la Mine toți cei trudiți și împovărați și Eu vă voi da odihnă.”, ref: “Matei 11:28” },
{ text: “Nădăjduiește în Domnul din toată inima ta și nu te bizui pe înțelepciunea ta!”, ref: “Proverbe 3:5” },
{ text: “Cel ce locuiește sub ocrotirea Celui Preaînalt și se odihnește la umbra Celui Atotputernic.”, ref: “Psalmul 91:1” },
{ text: “Dumnezeul nostru este refugiul și tăria noastră, un ajutor care nu lipsește niciodată în necaz.”, ref: “Psalmul 46:1” },
{ text: “Căutați mai întâi Împărăția lui Dumnezeu și neprihănirea Lui și toate aceste lucruri vi se vor da pe deasupra.”, ref: “Matei 6:33” },
{ text: “Și știm că toate lucrurile lucrează împreună spre binele celor ce iubesc pe Dumnezeu.”, ref: “Romani 8:28” },
{ text: “Fii fără teamă, căci Eu sunt cu tine; nu te uita cu îngrijorare, căci Eu sunt Dumnezeul tău.”, ref: “Isaia 41:10” },
{ text: “Bucurați-vă totdeauna în Domnul! Iarăși zic: Bucurați-vă!”, ref: “Filipeni 4:4” },
{ text: “Cuvântul Tău este o candelă pentru picioarele mele și o lumină pe cărarea mea.”, ref: “Psalmul 119:105” },
{ text: “Domnul să te binecuvânteze și să te păzească!”, ref: “Numeri 6:24” },
{ text: “Iubiți-vă unii pe alții cum v-am iubit Eu.”, ref: “Ioan 15:12” },
{ text: “Harul Domnului nostru Isus Hristos să fie cu voi cu toți!”, ref: “Apocalipsa 22:21” },
{ text: “Fiți smeriți unii față de alții, căci Dumnezeu rezistă celor mândri, dar dă har celor smeriți.”, ref: “1 Petru 5:5” },
{ text: “Nu vă lăsați biruiți de rău, ci biruiți răul prin bine.”, ref: “Romani 12:21” },
{ text: “Dragostea să fie fără prefăcătorie. Urâți răul și alipiți-vă de bine.”, ref: “Romani 12:9” },
{ text: “Eu am venit ca oile să aibă viață și s-o aibă din belșug.”, ref: “Ioan 10:10” },
{ text: “Cel ce vine la Mine nu-l voi izgoni afară.”, ref: “Ioan 6:37” },
{ text: “Pacea pe care v-o dau Eu nu este ca aceea pe care o dă lumea.”, ref: “Ioan 14:27” },
{ text: “Doamne, Tu ești scutul meu, slava mea, și Cel ce-mi ridici capul.”, ref: “Psalmul 3:3” },
{ text: “Lucrarea mâinilor noastre, întărește-o; da, întărește lucrarea mâinilor noastre!”, ref: “Psalmul 90:17” },
{ text: “Iată, Eu stau la ușă și bat. Dacă aude cineva glasul Meu și deschide ușa, voi intra la el.”, ref: “Apocalipsa 3:20” },
{ text: “Dați mulțumiri în toate împrejurările, căci aceasta este voia lui Dumnezeu pentru voi.”, ref: “1 Tesaloniceni 5:18” },
{ text: “Dumnezeu este duh și cei ce I se închină trebuie să I se închine în duh și în adevăr.”, ref: “Ioan 4:24” },
{ text: “Credinița este o încredere neclintită în lucrurile nădăjduite, o puternică convingere despre lucrurile care nu se văd.”, ref: “Evrei 11:1” },
{ text: “Sfințiți pe Hristos ca Domn în inimile voastre și fiți gata totdeauna să dați un răspuns oricui vă cere socoteală.”, ref: “1 Petru 3:15” },
{ text: “Lumina strălucea în întuneric și întunericul n-a biruit-o.”, ref: “Ioan 1:5” },
];

function afiseazaVerset() {
// Same verse all day — seed by date so it changes daily
const today = new Date();
const seed = today.getFullYear() 10000 + (today.getMonth() + 1) 100 + today.getDate();
const idx = seed % VERSETE.length;
const v = VERSETE[idx];

const textEl = document.getElementById(“verseText”);
const refEl = document.getElementById(“verseRef”);
if (!textEl) return;

textEl.classList.add(“fade”);
setTimeout(() => {
textEl.textContent = v.text;
refEl.textContent = “— “ + v.ref;
textEl.classList.remove(“fade”);
}, 400);
}

/ ── ULTIMELE RESURSE ── /
function afiseazaLatest(posts) {
const el = document.getElementById(“latestList”);
if (!el) return;

const latest = […posts]
.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
.slice(0, 6);

if (latest.length === 0) {
el.innerHTML = <div class="widget-loading">Nicio resursă încă.</div>;
return;
}

el.innerHTML = latest.map(p => <div class="latest-item" onclick="scrollToPost('${p.id}')"> <div class="latest-item-title">${escapeHtml(p.title)}</div> <div class="latest-item-meta"> <span class="latest-badge ${p.type === 'cantec' ? 'cantec' : ''}">${p.type === 'cantec' ? '🎵' : '📜'} ${p.type}</span> <span>${formatDate(p.created_at)}</span> </div> </div>).join(””);
}

function scrollToPost(id) {
// Switch to home filter first
const homeBtn = document.querySelector(’.nav-btn[onclick*=“toate”]’);
if (homeBtn) setNav(homeBtn, “toate”);

// Scroll to post
setTimeout(() => {
const el = document.getElementById(view-${id});
if (el) {
el.scrollIntoView({ behavior: “smooth”, block: “center” });
el.closest(”.post”).style.background = “rgba(244,114,182,0.12)”;
setTimeout(() => { if (el.closest(”.post”)) el.closest(”.post”).style.background = “”; }, 1800);
}
}, 300);
}

/ ── TOP CONTRIBUTORI ── /
function afiseazaTop(posts) {
const el = document.getElementById(“topList”);
if (!el) return;

// Count posts per author
const counts = {};
posts.forEach(p => {
const key = p.author || “Anonim”;
counts[key] = (counts[key] || 0) + 1;
});

const sorted = Object.entries(counts)
.sort((a, b) => b[1] - a[1])
.slice(0, 10);

if (sorted.length === 0) {
el.innerHTML = <div class="widget-loading">Niciun contributor încă.</div>;
return;
}

const medals = [“gold”, “silver”, “bronze”];
const rankSymbols = [“🥇”, “🥈”, “🥉”];

el.innerHTML = sorted.map(([author, count], i) => {
const rankClass = medals[i] || “”;
const rankLabel = i < 3 ? rankSymbols[i] : #${i + 1};
const initial = author.charAt(0).toUpperCase();
return <div class="top-item"> <div class="top-rank ${rankClass}">${rankLabel}</div> <div class="top-avatar">${initial}</div> <div class="top-info"> <div class="top-name">${escapeHtml(author)}</div> <div class="top-count">${count} resurse publicate</div> </div> </div>;
}).join(””);
}

/ ── HIDE WIDGETS ON NON-HOME TABS ── /
// This is called from setNav — show widgets only on home
function toggleWidgets(show) {
const w = document.getElementById(“homepageWidgets”);
if (w) w.style.display = show ? “block” : “none”;
}