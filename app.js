var supabaseClient = window.supabase.createClient(
  "https://pmbckejotwiypykuftkm.supabase.co",
  "sb_publishable_W1NGbl7dFtRyhQzF3UXznQ_ab77fyK-"
);

let allPosts = [];
let isRegisterMode = false;
let currentUser = null;
let isAdmin = false;
let activeCommentPostId = null;
let activeReaderPostId = null;
let likedPosts = new Set(JSON.parse(localStorage.getItem("likedPosts") || "[]"));
let currentFontSize = 18;
let currentReaderTheme = localStorage.getItem("readerTheme") || "light";
let currentFilter = "all"; // "all", "poems", "songs"

const DEFAULT_BADWORDS = [
  "pula", "pizda", "muie", "futu", "futut", "cacat", "rahat",
  "curva", "curvar", "dracului", "mortii", "nenorocit",
  "idiot", "cretin", "dobitoc", "labagiu", "sugi", "futui"
];
let badWords = [...DEFAULT_BADWORDS];

const TERMS_HTML = `
<h3>📋 Termeni și Condiții - SaferWord</h3>

<h4>1. Responsabilitatea Conținutului</h4>
<p>Fiecare utilizator este responsabil pe deplin pentru conținutul pe care îl publică pe platforma SaferWord. Platforma nu acceptă responsabilitate pentru:</p>
<ul>
  <li>Material ofensator, discriminator sau cuvinte de înjurături</li>
  <li>Conținut ilegal sau care încalcă drepturi de proprietate intelectuală</li>
  <li>Informații false, misleading sau dăunătoare</li>
  <li>Spam, publicitate nesolicitate sau manipulare</li>
</ul>

<h4>2. Drepturi de Autor și Proprietate Intelectuală</h4>
<p>Tu declarați că:</p>
<ul>
  <li>Deții drepturi complete asupra conținutului publicat</li>
  <li>Nu încalci drepturi de autor ale altora</li>
  <li>Ai permisiunea de la autorul original dacă publicezi lucrări de alții</li>
  <li>Ești de acord ca SaferWord să poată folosi conținutul pentru îmbunătățiri ale platformei</li>
</ul>

<h4>3. Standard de Limbaj și Comportament</h4>
<p>Utilizatorii se angajează să:</p>
<ul>
  <li>Respecte alte persoane și nu folosească limbaj ofensator</li>
  <li>Nu hărțuiască, amenințe sau intimideze alte persoane</li>
  <li>Nu distribuie conținut sexual explicit sau inapropriat</li>
  <li>Respecte comunitatea și valorile SaferWord</li>
</ul>

<h4>4. Moderare și Acțiuni Disciplinare</h4>
<p>SaferWord se rezervă dreptul să:</p>
<ul>
  <li>Șteargă conținut care încalcă acești termeni</li>
  <li>Suspende sau interzică conturi care abuzează de platformă</li>
  <li>Raporteze conținut ilegal autorităților competente</li>
  <li>Efectueze verificări și investigații pentru siguranță</li>
</ul>

<h4>5. Lipsa Garanțiilor</h4>
<p>Serviciul SaferWord se oferă "așa cum este". NU oferim garanții de:</p>
<ul>
  <li>Disponibilitate continuă a serviciului</li>
  <li>Siguranța datelor (deși facem eforturi maxime)</li>
  <li>Acuratețea sau calitatea conținutului</li>
  <li>Potrivire pentru orice scop anume</li>
</ul>

<h4>6. Limitarea Responsabilității</h4>
<p>În niciun caz SaferWord nu va fi responsabil pentru:</p>
<ul>
  <li>Pierderi de date sau daunele indirecte</li>
  <li>Prejudicii cauzate de conținut publicat de utilizatori</li>
  <li>Accesul neautorizat la conturi</li>
  <li>Intreruperi de serviciu datorită forțelor majore</li>
</ul>

<h4>7. Modificări și Actualizări</h4>
<p>Putem modifica acești termeni oricând. Modificările importante vor fi anunțate prin email. Continuarea utilizării platformei după notificare implică acceptarea noilor termeni.</p>

<h4>8. Acceptare Obligatorie</h4>
<p>Prin crearea unui cont și utilizarea SaferWord, tu accepți integral acești Termeni și Condiții. Dacă nu ești de acord cu vreun punct, nu trebuie să te înscrii.</p>

<h4>9. Contact și Reclamații</h4>
<p>Pentru orice întrebări, reclamații sau rapoarte de abuz, contactează-ne prin platforma noastră de suport.</p>

<p style="margin-top: 16px; color: #666; font-size: 12px;"><strong>Versiunea 1.0 - Valabil din $(new Date().toLocaleDateString("ro-RO"))</strong></p>
`;

// ===================== INIT =====================

async function init() {
  displayTerms("termsContent");
  displayTerms("signupTermsContent");
  await initUser();
  await incarcaPostari();
  loadBadwords();
}

window.addEventListener("load", init);
supabaseClient.auth.onAuthStateChanged(async (user) => {
  if (user) await initUser();
});

// ===================== MODAL HELPERS =====================

function toggleModal(id) {
  document.getElementById(id).classList.toggle("open");
}

function closeModalOutside(event, id) {
  if (event.target === document.getElementById(id)) toggleModal(id);
}

// ===================== TERMENI =====================

function displayTerms(targetId) {
  const today = new Date().toLocaleDateString("ro-RO");
  const html = TERMS_HTML.replace("$(new Date().toLocaleDateString(\"ro-RO\"))", today);
  document.getElementById(targetId).innerHTML = html;
}

// ===================== AUTH =====================

async function loginGoogle() {
  await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.href }
  });
}

async function loginEmail() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  if (!email || !password) return showToast("Completează emailul și parola!", "error");

  if (isRegisterMode) {
    displayTerms("signupTermsContent");
    document.getElementById("signupTermsCheckbox").checked = false;
    updateSignupTermsButton();
    window.pendingEmail = email;
    window.pendingPassword = password;
    toggleModal("loginModal");
    toggleModal("signupTermsModal");
  } else {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return showToast("Email sau parolă greșită!", "error");
    toggleModal("loginModal");
    await initUser();
    incarcaPostari();
  }
}

async function completeSignup() {
  if (!window.pendingEmail || !window.pendingPassword) return showToast("Eroare! Încearcă din nou.", "error");
  const { error } = await supabaseClient.auth.signUp({
    email: window.pendingEmail,
    password: window.pendingPassword
  });
  if (error) return showToast(error.message, "error");
  showToast("✅ Cont creat! Verifică emailul.");
  window.pendingEmail = null;
  window.pendingPassword = null;
  toggleModal("signupTermsModal");
  isRegisterMode = false;
  document.getElementById("modalTitle").textContent = "Conectează-te";
  document.getElementById("toggleText").textContent = "Nu ai cont? Înregistrează-te";
}

function updateSignupTermsButton() {
  document.getElementById("signupAcceptBtn").disabled = !document.getElementById("signupTermsCheckbox").checked;
}

async function logout() {
  await supabaseClient.auth.signOut();
  location.reload();
}

function toggleRegisterMode() {
  isRegisterMode = !isRegisterMode;
  document.getElementById("modalTitle").textContent = isRegisterMode ? "Creează cont" : "Conectează-te";
  document.getElementById("modalSubtitle").textContent = isRegisterMode ? "Alătură-te comunității" : "Bine ai revenit";
  document.getElementById("toggleText").textContent = isRegisterMode ? "Ai deja cont? Conectează-te" : "Nu ai cont? Înregistrează-te";
}

async function initUser() {
  const { data } = await supabaseClient.auth.getUser();
  currentUser = data.user || null;
  isAdmin = currentUser?.user_metadata?.is_admin === true;

  const userDisplay = document.getElementById("userDisplay");
  const loginBtn = document.getElementById("loginNavBtn");
  const logoutBtn = document.getElementById("logoutNavBtn");
  const adminBtn = document.getElementById("adminNavBtn");
  const profileBtn = document.getElementById("profileNavBtn");
  const myResourcesBtn = document.getElementById("myResourcesBtn");
  const formSection = document.getElementById("formSection");

  if (currentUser) {
    const profile = await loadUserProfile(currentUser.id);
    userDisplay.textContent = profile?.username || currentUser.email.split("@")[0];
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    profileBtn.style.display = "inline-block";
    myResourcesBtn.style.display = "inline-block";
    formSection.style.display = "flex";
    if (isAdmin) adminBtn.style.display = "inline-block";
  } else {
    userDisplay.textContent = "";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    profileBtn.style.display = "none";
    myResourcesBtn.style.display = "none";
    adminBtn.style.display = "none";
    formSection.style.display = "none";
  }
}

// ===================== PROFIL =====================

async function loadUserProfile(userId) {
  const { data } = await supabaseClient
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data;
}

async function openProfileModal() {
  if (!currentUser) return;
  const profile = await loadUserProfile(currentUser.id);
  document.getElementById("profileUsername").value = profile?.username || "";
  document.getElementById("profileLocation").value = profile?.location || "";
  document.getElementById("profileBio").value = profile?.bio || "";
  document.getElementById("profileSex").value = profile?.sex || "";
  document.getElementById("profileAge").value = profile?.age || "";
  document.getElementById("profilePublic").checked = profile?.is_profile_public !== false;
  toggleModal("profileModal");
}

async function saveProfile() {
  const username = document.getElementById("profileUsername").value.trim();
  if (!username) return showToast("Adaugă un nume de utilizator!", "error");
  const { error } = await supabaseClient
    .from("user_profiles")
    .upsert({
      id: currentUser.id,
      username,
      location: document.getElementById("profileLocation").value.trim(),
      bio: document.getElementById("profileBio").value.trim(),
      sex: document.getElementById("profileSex").value,
      age: parseInt(document.getElementById("profileAge").value) || null,
      is_profile_public: document.getElementById("profilePublic").checked,
      updated_at: new Date()
    });
  if (error) return showToast("Eroare: " + error.message, "error");
  toggleModal("profileModal");
  showToast("✅ Profil salvat!");
  await initUser();
}

// ===================== TOAST =====================

function showToast(msg, type = "success") {
  const existing = document.getElementById("toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "toast";
  toast.textContent = msg;
  toast.style.background = type === "error" ? "#ff4444" : "#2d1066";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ===================== BADWORDS =====================

function containsBadWord(text) {
  const lower = text.toLowerCase();
  return badWords.find(w => lower.includes(w.toLowerCase())) || null;
}

function loadBadwords() {
  badWords = [...DEFAULT_BADWORDS];
  const stored = localStorage.getItem("badwords");
  if (stored) badWords = JSON.parse(stored);
}

function saveBadwords() {
  localStorage.setItem("badwords", JSON.stringify(badWords));
}

async function addBadword() {
  const input = document.getElementById("newBadword");
  const word = input.value.trim().toLowerCase();
  if (!word) return showToast("Adaugă un cuvânt!", "error");
  if (badWords.includes(word)) return showToast("Cuvântul există deja!", "error");
  badWords.push(word);
  saveBadwords();
  input.value = "";
  loadReportedBadwords();
  showToast("✅ Cuvânt adăugat!");
}

function removeBadword(word) {
  badWords = badWords.filter(w => w !== word);
  saveBadwords();
  loadReportedBadwords();
  showToast("✅ Cuvânt șters!");
}

function loadReportedBadwords() {
  const list = document.getElementById("badwordsList");
  list.innerHTML = `
    <div class="badword-tags">
      ${badWords.map(w => `
        <div class="badword-tag">
          <span>${w}</span>
          <button onclick="removeBadword('${w}')">✕</button>
        </div>
      `).join("")}
    </div>
  `;
}

// ===================== POSTS =====================

async function adaugaPost() {
  if (!currentUser) return showToast("Trebuie să fii logat!", "error");
  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();
  const author = document.getElementById("author").value.trim();
  const type = document.getElementById("type").value;
  const creationStory = document.getElementById("creationStory").value.trim();

  if (!title || !content) return showToast("Completează titlu și conținut!", "error");
  
  const badWord = containsBadWord(content + " " + title);
  if (badWord) return showToast(`❌ Cuvântul "${badWord}" nu este permis!`, "error");

  const { error } = await supabaseClient
    .from("posts")
    .insert({
      title,
      content,
      author: author || "Anonim",
      type,
      user_id: currentUser.id,
      created_at_display: new Date().toISOString(),
      creation_story: creationStory || null,
      likes: 0
    });

  if (error) return showToast("Eroare: " + error.message, "error");
  
  document.getElementById("title").value = "";
  document.getElementById("content").value = "";
  document.getElementById("author").value = "";
  document.getElementById("creationStory").value = "";
  document.getElementById("type").value = "poezie";
  
  showToast("✅ Postare publicată!");
  await incarcaPostari();
}

async function incarcaPostari() {
  const { data } = await supabaseClient
    .from("posts")
    .select("*")
    .order("created_at_display", { ascending: false });
  
  allPosts = data || [];
  updateDashboard();
  afiseazaLista(allPosts);
}

function updateDashboard() {
  const total = allPosts.length;
  const authors = new Set(allPosts.map(p => p.user_id)).size;
  const poems = allPosts.filter(p => p.type === "poezie").length;
  const songs = allPosts.filter(p => p.type === "cantec").length;

  document.getElementById("totalPosts").textContent = total;
  document.getElementById("totalAuthors").textContent = authors;
  document.getElementById("totalPoems").textContent = poems;
  document.getElementById("totalSongs").textContent = songs;
}

function searchPosts() {
  const query = document.getElementById("search").value.toLowerCase();
  const filtered = allPosts.filter(p =>
    p.title.toLowerCase().includes(query) ||
    p.content.toLowerCase().includes(query) ||
    p.author.toLowerCase().includes(query)
  );
  afiseazaLista(filtered);
}

function showHome() {
  document.getElementById("search").value = "";
  currentFilter = "all";
  updateDashboard();
  afiseazaLista(allPosts);
}

function showPoems() {
  currentFilter = "poems";
  const poems = allPosts.filter(p => p.type === "poezie");
  updateDashboardFiltered(poems);
  afiseazaLista(poems);
}

function showSongs() {
  currentFilter = "songs";
  const songs = allPosts.filter(p => p.type === "cantec");
  updateDashboardFiltered(songs);
  afiseazaLista(songs);
}

function updateDashboardFiltered(data) {
  const total = data.length;
  const authors = new Set(data.map(p => p.user_id)).size;
  const poems = data.filter(p => p.type === "poezie").length;
  const songs = data.filter(p => p.type === "cantec").length;

  document.getElementById("totalPosts").textContent = total;
  document.getElementById("totalAuthors").textContent = authors;
  document.getElementById("totalPoems").textContent = poems;
  document.getElementById("totalSongs").textContent = songs;
}

// ===================== DISPLAY POSTS =====================

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("ro-RO") + " " + date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

async function afiseazaLista(data) {
  const container = document.getElementById("posts");
  container.innerHTML = "";

  if (!data || data.length === 0) {
    container.innerHTML = `<p class="empty-msg">Nicio postare găsită.</p>`;
    return;
  }

  const byAuthor = {};
  for (const p of data) {
    const profile = await loadUserProfile(p.user_id);
    const authorName = p.author || profile?.username || "Anonim";
    const authorKey = `${p.user_id}|${authorName}`;
    
    if (!byAuthor[authorKey]) {
      byAuthor[authorKey] = { userId: p.user_id, name: authorName, posts: [] };
    }
    byAuthor[authorKey].posts.push(p);
  }

  const grid = document.createElement("div");
  grid.className = "authors-grid";

  for (const key in byAuthor) {
    const author = byAuthor[key];
    const poemCount = author.posts.filter(p => p.type === "poezie").length;
    const songCount = author.posts.filter(p => p.type === "cantec").length;

    const pile = document.createElement("div");
    pile.className = "author-pile";
    pile.innerHTML = `
      <div class="pile-header" onclick="openAuthorModal('${author.userId}', '${author.name}', event)">
        <div class="pile-name">${author.name}</div>
        <div class="pile-count">${author.posts.length}</div>
        <div class="pile-types">
          ${poemCount > 0 ? `<span class="type-badge">📜 ${poemCount}</span>` : ""}
          ${songCount > 0 ? `<span class="type-badge">🎵 ${songCount}</span>` : ""}
        </div>
      </div>
      <div class="pile-list">
        ${author.posts.sort((a, b) => new Date(b.created_at_display) - new Date(a.created_at_display)).map(p => `
          <div class="pile-item" onclick="openReader('${p.id}', event)">
            <h4>${p.title}</h4>
            <span class="pile-date">📅 ${formatDate(p.created_at_display)}</span>
            <span class="pile-type">${p.type === "poezie" ? "📜 Poezie" : "🎵 Cântec"}</span>
            <p>${p.content.substring(0, 80)}...</p>
          </div>
        `).join("")}
      </div>
    `;
    grid.appendChild(pile);
  }

  container.appendChild(grid);
}

// ===================== AUTHOR MODAL =====================

async function openAuthorModal(userId, authorName, event) {
  event.stopPropagation();
  const profile = await loadUserProfile(userId);
  
  // Filtrează resursele după filtrul activ
  let authorPosts = allPosts.filter(p => p.user_id === userId);
  if (currentFilter === "poems") {
    authorPosts = authorPosts.filter(p => p.type === "poezie");
  } else if (currentFilter === "songs") {
    authorPosts = authorPosts.filter(p => p.type === "cantec");
  }

  const initials = authorName.split(" ").map(n => n[0]).join("").toUpperCase();

  const html = `
    <div class="author-profile-view">
      <div class="author-header">
        <div class="author-avatar">${initials}</div>
        <div class="author-info">
          <h3>${authorName}</h3>
          ${profile?.location ? `<p>📍 ${profile.location}</p>` : ""}
          ${profile?.age ? `<p>👤 ${profile.age} ani</p>` : ""}
          ${profile?.bio ? `<p>"${profile.bio}"</p>` : ""}
        </div>
      </div>
      <div class="author-resources">
        <h4>${currentFilter === "poems" ? "Poeziile" : currentFilter === "songs" ? "Cântecele" : "Resursele"} autorului (${authorPosts.length})</h4>
        ${authorPosts.length === 0 ? `<p style="opacity: 0.6; font-size: 13px;">Niciun ${currentFilter === "poems" ? "poem" : currentFilter === "songs" ? "cântec" : "resursă"} în acest filtru</p>` : authorPosts.map(p => `
          <div class="resource-item" onclick="openReader('${p.id}', event)">
            <span class="resource-item-type">${p.type === "poezie" ? "📜" : "🎵"}</span>
            <strong>${p.title}</strong>
            <br>
            <small>${formatDate(p.created_at_display)}</small>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  document.getElementById("authorContent").innerHTML = html;
  toggleModal("authorModal");
}

// ===================== READER MODAL =====================

async function openReader(postId, event) {
  event.stopPropagation();
  const post = allPosts.find(p => p.id === postId);
  if (!post) return;

  activeReaderPostId = postId;

  document.getElementById("readerTitle").textContent = post.title;
  document.getElementById("readerMeta").textContent = `Autor: ${post.author} • ${formatDate(post.created_at_display)} • ${post.type === "poezie" ? "Poezie" : "Cântec"}`;

  // Parse content - grupează versurile în strofe
  const lines = post.content.split('\n');
  let strophes = [];
  let currentStrophe = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "") {
      if (currentStrophe.length > 0) {
        strophes.push(currentStrophe);
        currentStrophe = [];
      }
    } else {
      currentStrophe.push(lines[i]);
    }
  }
  if (currentStrophe.length > 0) {
    strophes.push(currentStrophe);
  }
  
  const contentHTML = `
    ${strophes.map(strophe => {
      return `<div class="strophe">${strophe.map(line => `<p>${line}</p>`).join("")}</div>`;
    }).join("")}
    ${post.creation_story ? `<div class="reader-story"><strong>📖 Povestea creației:</strong><br>${post.creation_story}</div>` : ""}
  `;

  document.getElementById("readerContent").innerHTML = contentHTML;
  
  // Setează font size din localStorage sau default
  const savedFontSize = localStorage.getItem("lastFontSize") || "18";
  const slider = document.getElementById("fontSizeSlider");
  const valueDisplay = document.getElementById("fontSizeValue");
  const content = document.getElementById("readerContent");
  
  if (slider) {
    slider.value = savedFontSize;
    slider.disabled = false;
  }
  if (valueDisplay) valueDisplay.textContent = savedFontSize;
  if (content) {
    content.style.setProperty("font-size", savedFontSize + "px", "important");
  }
  
  // Setează tema din localStorage
  setReaderTheme(currentReaderTheme);
  
  // Arată buton edit dacă e author
  const editBtn = document.getElementById("editReaderBtn");
  if (currentUser && currentUser.id === post.user_id) {
    editBtn.style.display = "inline-block";
  } else {
    editBtn.style.display = "none";
  }
  
  // Reset bold
  document.getElementById("readerContent").classList.remove("bold-text");
  document.getElementById("boldToggleBtn").style.opacity = "0.6";

  toggleModal("readerModal");
}

function changeFontSize() {
  try {
    const slider = document.getElementById("fontSizeSlider");
    const value = slider ? slider.value : "18";
    
    const displayValue = document.getElementById("fontSizeValue");
    if (displayValue) displayValue.textContent = value;
    
    const content = document.getElementById("readerContent");
    if (content) {
      // Force override cu !important direct pe element
      content.style.setProperty("font-size", value + "px", "important");
      console.log("Font size ACTUALLY changed to:", value + "px");
    }
    
    currentFontSize = value;
    localStorage.setItem("lastFontSize", value);
  } catch (err) {
    console.error("Error changing font size:", err);
  }
}

function toggleBoldText() {
  const content = document.getElementById("readerContent");
  const btn = document.getElementById("boldToggleBtn");
  
  
  content.classList.toggle("bold-text");
  btn.style.opacity = content.classList.contains("bold-text") ? "1" : "0.6";
}

async function printResourcePDF() {
  const post = allPosts.find(p => p.id === activeReaderPostId);
  if (!post) return showToast("Eroare!", "error");
  
  // Parse content același ca în reader
  const lines = post.content.split('\n');
  let strophes = [];
  let currentStrophe = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "") {
      if (currentStrophe.length > 0) {
        strophes.push(currentStrophe);
        currentStrophe = [];
      }
    } else {
      currentStrophe.push(lines[i]);
    }
  }
  if (currentStrophe.length > 0) {
    strophes.push(currentStrophe);
  }
  
  // Crează HTML pentru print cu format frumos
  const printWindow = window.open("", "", "height=900,width=900");
  const strophesHTML = strophes.map(strophe => {
    return `<div style="margin-bottom: 20px;">
      ${strophe.map(line => `<p style="margin: 0; padding: 0; line-height: 1.8;">${line}</p>`).join("")}
    </div>`;
  }).join("");
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${post.title}</title>
      <style>
        body {
          font-family: 'Georgia', serif;
          max-width: 800px;
          margin: 40px;
          line-height: 1.8;
          color: #333;
        }
        h1 { 
          font-size: 28px; 
          margin-bottom: 10px;
          font-weight: bold;
        }
        .meta { 
          color: #999; 
          font-size: 13px; 
          margin-bottom: 30px;
          border-bottom: 1px solid #ddd;
          padding-bottom: 15px;
        }
        .content {
          margin: 30px 0;
        }
        .strophe {
          margin-bottom: 20px;
        }
        .strophe p {
          margin: 0;
          padding: 0;
          line-height: 1.8;
        }
        .story { 
          background: #f5f5f5; 
          padding: 15px; 
          margin: 30px 0; 
          font-style: italic; 
          border-left: 3px solid #666;
          font-size: 14px;
        }
        .footer {
          margin-top: 40px;
          border-top: 1px solid #ccc;
          padding-top: 15px;
          text-align: center;
          color: #999;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <h1>${post.title}</h1>
      <div class="meta">
        <p><strong>Autor:</strong> ${post.author}</p>
        <p><strong>Data:</strong> ${formatDate(post.created_at_display)}</p>
        <p><strong>Tip:</strong> ${post.type === "poezie" ? "Poezie" : "Cântec"}</p>
      </div>
      <div class="content">
        ${strophesHTML}
      </div>
      ${post.creation_story ? `<div class="story"><strong>📖 Povestea creației:</strong><br>${post.creation_story}</div>` : ""}
      <div class="footer">
        <p>Publicat pe SaferWord - Resursa ta pentru suflet</p>
      </div>
    </body>
    </html>
  `;
  
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
  }, 250);
  
  showToast("📄 Se pregătește PDF-ul...");
}

function openEditFromReader() {
  if (!activeReaderPostId) return;
  const post = allPosts.find(p => p.id === activeReaderPostId);
  if (!post) return;
  
  document.getElementById("editResourceId").value = post.id;
  document.getElementById("editResourceTitle").value = post.title;
  document.getElementById("editResourceContent").value = post.content;
  document.getElementById("editResourceType").value = post.type;
  document.getElementById("editResourceStory").value = post.creation_story || "";
  
  toggleModal("readerModal");
  toggleModal("editResourceModal");
}

function setReaderTheme(theme) {
  const readerBox = document.getElementById("readerBox");
  
  // Șterge toate clasele de tema
  readerBox.className = readerBox.className.replace(/theme-\w+/g, "");
  
  // Adaugă clasa temei noi
  readerBox.classList.add("theme-" + theme);
  
  // Actualizează butoanele active
  document.querySelectorAll(".theme-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelector(`.theme-btn[onclick="setReaderTheme('${theme}')"]`)?.classList.add("active");
  
  // Salvează în localStorage
  currentReaderTheme = theme;
  localStorage.setItem("readerTheme", theme);
}

// ===================== COMENTARII =====================

async function loadComments(postId) {
  const { data } = await supabaseClient
    .from("comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  const list = document.getElementById("commentsList");
  if (!data || data.length === 0) {
    list.innerHTML = `<div class="comments-empty">Niciun comentariu deocamdată.</div>`;
    return;
  }

  list.innerHTML = data.map(c => `
    <div class="comment-item">
      <div class="comment-meta">${new Date(c.created_at).toLocaleDateString("ro-RO")}</div>
      <p>${c.content}</p>
    </div>
  `).join("");
}

async function submitComment() {
  const text = document.getElementById("commentInput").value.trim();
  if (!text) return showToast("Scrie un comentariu!", "error");
  if (!activeReaderPostId) return showToast("Eroare!", "error");

  const { error } = await supabaseClient
    .from("comments")
    .insert({
      post_id: activeReaderPostId,
      content: text,
      created_at: new Date().toISOString()
    });

  if (error) return showToast("Eroare!", "error");
  
  document.getElementById("commentInput").value = "";
  await loadComments(activeReaderPostId);
  showToast("✅ Comentariu adăugat!");
}

// ===================== RAPORTARE =====================

async function openReport(postId, event) {
  event.stopPropagation();
  activeReportPostId = postId;
  toggleModal("reportModal");
}

async function submitReport() {
  const reason = document.querySelector('input[name="reportReason"]:checked')?.value;
  if (!reason) return showToast("Selectează un motiv!", "error");

  const { error } = await supabaseClient
    .from("reports")
    .insert({
      post_id: activeReportPostId,
      reason,
      reported_by: currentUser?.id || "anonim",
      created_at: new Date().toISOString()
    });

  if (error) return showToast("Eroare!", "error");
  
  toggleModal("reportModal");
  showToast("✅ Raport trimis! Mulțumim!");
}

// ===================== ADMIN =====================

function toggleAdminPanel() {
  const panel = document.getElementById("adminPanel");
  panel.style.display = panel.style.display === "none" ? "flex" : "none";
  if (panel.style.display === "flex") loadReportedBadwords();
}

function switchTab(tab) {
  document.querySelectorAll(".admin-tabs .tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll("[id^='tab-']").forEach(t => t.style.display = "none");
  
  event.target.classList.add("active");
  document.getElementById("tab-" + tab).style.display = "block";
  
  if (tab === "reported") loadReported();
  if (tab === "badwords") loadReportedBadwords();
  if (tab === "resources") loadAdminResources();
  if (tab === "authors") loadAdminAuthors();
}

async function loadReported() {
  const { data } = await supabaseClient
    .from("reports")
    .select("*, posts(*)")
    .order("created_at", { ascending: false });

  const list = document.getElementById("reportedList");
  if (!data || data.length === 0) {
    list.innerHTML = `<p class="empty-msg">Niciun raport.</p>`;
    return;
  }

  list.innerHTML = data.map(r => `
    <div class="reported-item">
      <h4>${r.posts?.title || "Postare ștearsă"}</h4>
      <p>${r.posts?.content?.substring(0, 80)}...</p>
      <div class="report-reason">⚠️ ${r.reason}</div>
      <div class="report-actions">
        <button class="btn-dismiss" onclick="dismissReport('${r.id}')">Respinge</button>
        <button class="btn-remove-post" onclick="deletePostAdmin('${r.posts?.id}', '${r.id}')">Șterge postare</button>
      </div>
    </div>
  `).join("");
}

async function dismissReport(reportId) {
  const { error } = await supabaseClient
    .from("reports")
    .delete()
    .eq("id", reportId);

  if (error) return showToast("Eroare!", "error");
  loadReported();
  showToast("✅ Raport respins!");
}

async function deletePostAdmin(postId, reportId) {
  const { error: deleteError } = await supabaseClient
    .from("posts")
    .delete()
    .eq("id", postId);

  const { error: reportError } = await supabaseClient
    .from("reports")
    .delete()
    .eq("id", reportId);

  if (deleteError || reportError) return showToast("Eroare!", "error");
  
  await incarcaPostari();
  loadReported();
  showToast("✅ Postare ștearsă!");
}

// ===================== RESURSELE MELE =====================

function showMyResources() {
  if (!currentUser) return showToast("Trebuie să fii logat!", "error");
  const myResources = allPosts.filter(p => p.user_id === currentUser.id);
  
  const container = document.getElementById("posts");
  container.innerHTML = "";
  
  if (myResources.length === 0) {
    container.innerHTML = `<p class="empty-msg">Nu ai publicat nimic încă. Publică o resursă!</p>`;
    return;
  }
  
  const grid = document.createElement("div");
  grid.className = "authors-grid";
  
  const pile = document.createElement("div");
  pile.className = "author-pile";
  pile.innerHTML = `
    <div class="pile-header">
      <div class="pile-name">Resursele mele</div>
      <div class="pile-count">${myResources.length}</div>
    </div>
    <div class="pile-list open">
      ${myResources.sort((a, b) => new Date(b.created_at_display) - new Date(a.created_at_display)).map(p => `
        <div class="pile-item" style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="flex: 1; cursor:pointer;" onclick="openReader('${p.id}', event)">
            <h4>${p.title}</h4>
            <span class="pile-date">📅 ${formatDate(p.created_at_display)}</span>
            <span class="pile-type">${p.type === "poezie" ? "📜 Poezie" : "🎵 Cântec"}</span>
            <p>${p.content.substring(0, 60)}...</p>
          </div>
          <div class="pile-actions" style="gap: 4px; display: flex; flex-direction: column;">
            <button onclick="openEditResourceModal('${p.id}')" style="background: rgba(100,200,255,0.12) !important; color: #64c8ff !important; border-color: rgba(100,200,255,0.3) !important; font-size: 11px; padding: 4px 8px; border: 1px solid rgba(100,200,255,0.3); border-radius: 6px; background: rgba(100,200,255,0.12); cursor: pointer;">✏️ Edit</button>
            <button onclick="deleteMyResourceConfirm('${p.id}')" style="background: rgba(255,80,80,0.12) !important; color: #ff8080 !important; border-color: rgba(255,80,80,0.3) !important; font-size: 11px; padding: 4px 8px; border: 1px solid rgba(255,80,80,0.3); border-radius: 6px; background: rgba(255,80,80,0.12); cursor: pointer;">🗑️ Del</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
  grid.appendChild(pile);
  container.appendChild(grid);
}

function openEditResourceModal(postId) {
  const post = allPosts.find(p => p.id === postId);
  if (!post) return;
  
  document.getElementById("editResourceId").value = postId;
  document.getElementById("editResourceTitle").value = post.title;
  document.getElementById("editResourceContent").value = post.content;
  document.getElementById("editResourceType").value = post.type;
  document.getElementById("editResourceStory").value = post.creation_story || "";
  
  toggleModal("editResourceModal");
}

function deleteMyResourceConfirm(postId) {
  // Modal frumos pentru confirmare
  document.getElementById("deleteConfirmPostId").value = postId;
  const post = allPosts.find(p => p.id === postId);
  document.getElementById("deleteConfirmTitle").textContent = post ? post.title : "Resursa";
  toggleModal("deleteConfirmModal");
}

async function confirmDeleteResource() {
  const postId = document.getElementById("deleteConfirmPostId").value;
  toggleModal("deleteConfirmModal");
  await deleteMyResource(postId);
}

function cancelDeleteResource() {
  toggleModal("deleteConfirmModal");
}

async function editMyResource(postId, title, content, type, creationStory, event) {
  event.stopPropagation();
  
  // Găsesc postarea
  const post = allPosts.find(p => p.id === postId);
  if (!post) return;
  
  // Deschid edit form
  document.getElementById("editResourceId").value = postId;
  document.getElementById("editResourceTitle").value = post.title;
  document.getElementById("editResourceContent").value = post.content;
  document.getElementById("editResourceType").value = post.type;
  document.getElementById("editResourceStory").value = post.creation_story || "";
  
  toggleModal("editResourceModal");
}

async function saveEditedResource() {
  const postId = document.getElementById("editResourceId").value;
  const newTitle = document.getElementById("editResourceTitle").value.trim();
  const newContent = document.getElementById("editResourceContent").value.trim();
  const newType = document.getElementById("editResourceType").value;
  const newStory = document.getElementById("editResourceStory").value.trim();
  
  if (!newTitle || !newContent) return showToast("Completează titlu și conținut!", "error");
  
  const { error } = await supabaseClient
    .from("posts")
    .update({
      title: newTitle,
      content: newContent,
      type: newType,
      creation_story: newStory || null
    })
    .eq("id", postId);
  
  if (error) return showToast("Eroare la editare!", "error");
  
  toggleModal("editResourceModal");
  showToast("✅ Resursă editată!");
  await incarcaPostari();
  showMyResources();
}

async function deleteMyResource(postId) {
  try {
    const { error } = await supabaseClient
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", currentUser.id); // Extra safety: delete only own posts
    
    if (error) {
      console.error("Delete error:", error);
      return showToast("❌ Nu poți șterge această resursă! " + error.message, "error");
    }
    
    showToast("✅ Resursă ștearsă!");
    await incarcaPostari();
    showMyResources();
  } catch (err) {
    console.error("Delete exception:", err);
    showToast("❌ Eroare la ștergere: " + err.message, "error");
  }
}

// ===================== ADMIN - RESURSE =====================

async function loadAdminResources() {
  const { data } = await supabaseClient
    .from("posts")
    .select("*, user_profiles(username)")
    .order("created_at_display", { ascending: false });
  
  const list = document.getElementById("adminResourcesList");
  if (!data || data.length === 0) {
    list.innerHTML = `<p class="empty-msg">Nicio resursă.</p>`;
    return;
  }
  
  list.innerHTML = data.map(p => `
    <div class="admin-resource-item">
      <div class="admin-resource-info">
        <h4>${p.title}</h4>
        <p>👤 ${p.user_profiles?.username || "Anonim"}</p>
        <p>📅 ${formatDate(p.created_at_display)}</p>
        <p>${p.type === "poezie" ? "📜 Poezie" : "🎵 Cântec"} • ❤️ ${p.likes || 0} like-uri</p>
      </div>
      <div class="admin-resource-actions">
        <button class="btn-edit-admin" onclick="editResourceAdmin('${p.id}')">Editează</button>
        <button class="btn-delete-admin" onclick="deleteResourceAdmin('${p.id}')">Șterge</button>
      </div>
    </div>
  `).join("");
}

async function editResourceAdmin(postId) {
  const post = allPosts.find(p => p.id === postId);
  if (!post) return;
  
  document.getElementById("editResourceId").value = postId;
  document.getElementById("editResourceTitle").value = post.title;
  document.getElementById("editResourceContent").value = post.content;
  document.getElementById("editResourceType").value = post.type;
  document.getElementById("editResourceStory").value = post.creation_story || "";
  
  toggleModal("editResourceModal");
}

async function deleteResourceAdmin(postId) {
  const confirmDelete = confirm("⚠️ ATENȚIE!\n\nSigur vrei să ștergi această resursă?\n\nAceastă acțiune NU se poate anula!");
  if (!confirmDelete) return;
  
  const { error } = await supabaseClient
    .from("posts")
    .delete()
    .eq("id", postId);
  
  if (error) return showToast("Eroare!", "error");
  showToast("✅ Resursă ștearsă!");
  await incarcaPostari();
  loadAdminResources();
}

// ===================== ADMIN - AUTORI =====================

async function loadAdminAuthors() {
  const { data: profiles } = await supabaseClient
    .from("user_profiles")
    .select("*");
  
  const list = document.getElementById("adminAuthorsList");
  if (!profiles || profiles.length === 0) {
    list.innerHTML = `<p class="empty-msg">Niciun autor.</p>`;
    return;
  }
  
  list.innerHTML = profiles.map(author => {
    const authorPosts = allPosts.filter(p => p.user_id === author.id);
    const poems = authorPosts.filter(p => p.type === "poezie").length;
    const songs = authorPosts.filter(p => p.type === "cantec").length;
    
    return `
      <div class="admin-author-item">
        <div class="admin-author-header">
          <div class="admin-author-info">
            <h4>${author.username}</h4>
            <div class="admin-author-stats">
              <span>📍 ${author.location || "N/A"}</span>
              <span>👤 ${author.age ? author.age + " ani" : "N/A"}</span>
              <span>📚 ${authorPosts.length} resurse</span>
              <span>📜 ${poems} poezii</span>
              <span>🎵 ${songs} cântece</span>
              <span>${author.is_profile_public ? "🌍 Public" : "🔒 Privat"}</span>
            </div>
          </div>
          <div class="admin-author-actions">
            <button class="btn-edit-admin" onclick="viewAuthorDetailsAdmin('${author.id}')">Detalii</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function viewAuthorDetailsAdmin(userId) {
  const profile = allPosts.map(p => ({ ...p, profile: allPosts.find(x => x.user_id === userId)?.user_id }))
    .filter(p => p.user_id === userId)[0];
  
  // Simplu: afișează în alert sau poți deschide un modal
  alert("Detalii autor:\n\nID: " + userId + "\n\nPentru funcționalitate avansată, poți implementa un modal!");
}

// ===================== PRESENTATION MODE =====================

let presentationState = {
  post: null,
  strophes: [],
  currentStrophe: 0,
  isPresentationOpen: false
};

async function openPresentationMode() {
  const post = allPosts.find(p => p.id === activeReaderPostId);
  if (!post) return showToast("Eroare la deschidere!", "error");
  
  // Parse content în strofe
  const lines = post.content.split('\n');
  let strophes = [];
  let currentStrophe = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "") {
      if (currentStrophe.length > 0) {
        strophes.push(currentStrophe);
        currentStrophe = [];
      }
    } else {
      currentStrophe.push(lines[i]);
    }
  }
  if (currentStrophe.length > 0) {
    strophes.push(currentStrophe);
  }
  
  presentationState.post = post;
  presentationState.strophes = strophes;
  presentationState.currentStrophe = 0;
  presentationState.isPresentationOpen = true;
  
  showPresentationSlide();
}

function showPresentationSlide() {
  const { post, strophes, currentStrophe } = presentationState;
  
  const strophe = strophes[currentStrophe];
  const stropheHTML = strophe.map(line => `<p>${line}</p>`).join("");
  
  const html = `
    <div class="presentation-container">
      <button class="presentation-close" onclick="closePresentationMode()">✕ Ieșire</button>
      
      <div class="presentation-title">${post.title}</div>
      <div class="presentation-meta">De ${post.author}</div>
      
      <div class="presentation-content">
        <div class="presentation-strophe">
          ${stropheHTML}
        </div>
      </div>
      
      <div class="presentation-controls">
        <button onclick="prevPresentationSlide()">⬅️ Înapoi</button>
        <div class="presentation-counter">${currentStrophe + 1} / ${strophes.length}</div>
        <button onclick="nextPresentationSlide()">Înainte ➡️</button>
      </div>
    </div>
  `;
  
  // Crează container și injectează
  let container = document.getElementById("presentationMode");
  if (!container) {
    container = document.createElement("div");
    container.id = "presentationMode";
    document.body.appendChild(container);
  }
  
  container.innerHTML = html;
  container.style.display = "block";
  
  // Keyboard support
  document.addEventListener("keydown", handlePresentationKeys);
}

function nextPresentationSlide() {
  const { strophes } = presentationState;
  if (presentationState.currentStrophe < strophes.length - 1) {
    presentationState.currentStrophe++;
    showPresentationSlide();
  }
}

function prevPresentationSlide() {
  if (presentationState.currentStrophe > 0) {
    presentationState.currentStrophe--;
    showPresentationSlide();
  }
}

function closePresentationMode() {
  const container = document.getElementById("presentationMode");
  if (container) {
    container.style.display = "none";
    container.innerHTML = "";
  }
  presentationState.isPresentationOpen = false;
  document.removeEventListener("keydown", handlePresentationKeys);
}

function handlePresentationKeys(event) {
  if (!presentationState.isPresentationOpen) return;
  
  if (event.key === "ArrowRight" || event.key === " ") {
    nextPresentationSlide();
  } else if (event.key === "ArrowLeft") {
    prevPresentationSlide();
  } else if (event.key === "Escape") {
    closePresentationMode();
  }
}
