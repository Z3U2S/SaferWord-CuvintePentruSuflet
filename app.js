// ===== EXISTING CODE RĂMÂNE SUS (NU MODIFICA SUPABASE INIT) =====

let expandedPostId = null;
let currentFilterAuthor = null;

// ===================== COMMENTS COUNT =====================
async function getCommentsCount(postId) {
  const { count } = await supabaseClient
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);
  return count || 0;
}

// ===================== AUTHOR FILTER =====================
function filterByAuthor(author) {
  currentFilterAuthor = author;
  expandedPostId = null;
  const filtered = allPosts.filter(p => p.author === author);
  afiseazaLista(filtered);
}

function clearAuthorFilter() {
  currentFilterAuthor = null;
  expandedPostId = null;
  afiseazaLista(allPosts);
}

// ===================== TOGGLE EXPAND =====================
function togglePost(id) {
  expandedPostId = expandedPostId === id ? null : id;
  const posts = currentFilterAuthor
    ? allPosts.filter(p => p.author === currentFilterAuthor)
    : allPosts;
  afiseazaLista(posts);
}

// ===================== DISPLAY POSTS =====================
async function afiseazaLista(data) {
  const container = document.getElementById("posts");
  container.innerHTML = "";

  // Banner filtru autor activ
  if (currentFilterAuthor) {
    const banner = document.createElement("div");
    banner.className = "author-filter-banner";
    banner.innerHTML = `
      <span>📂 Resurse de: <strong>${currentFilterAuthor}</strong></span>
      <button class="btn-clear-filter" onclick="clearAuthorFilter()">✕ Înapoi la toate</button>
    `;
    container.appendChild(banner);
  }

  if (data.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-msg";
    empty.textContent = "Nicio resursă găsită.";
    container.appendChild(empty);
    return;
  }

  for (const p of data) {
    const isExpanded = expandedPostId === p.id;
    const isLiked = likedPosts.has(p.id);

    const card = document.createElement("div");
    card.className = "post-card" + (isExpanded ? " expanded" : "");
    card.dataset.id = p.id;

    // Capul cardului – mereu vizibil
    const head = document.createElement("div");
    head.className = "post-card-head";
    head.onclick = () => togglePost(p.id);
    head.innerHTML = `
      <div class="post-card-meta">
        <span class="post-card-type">${p.type === "cantec" ? "🎵" : "📜"}</span>
        <div>
          <h3 class="post-card-title">${p.title}</h3>
          <span class="post-card-author" onclick="event.stopPropagation(); filterByAuthor('${p.author}')">
            👤 ${p.author || "Anonim"}
          </span>
        </div>
      </div>
      <div class="post-card-right">
        <span class="post-stat">❤️ ${p.likes || 0}</span>
        <span class="post-chevron">${isExpanded ? "▲" : "▼"}</span>
      </div>
    `;

    card.appendChild(head);

    // Corpul expandat – vizibil doar la click
    if (isExpanded) {
      const commentsCount = await getCommentsCount(p.id);

      const body = document.createElement("div");
      body.className = "post-card-body";
      body.innerHTML = `
        <p class="post-card-content">${p.content}</p>
        <div class="post-card-actions">
          <button class="btn-action btn-like ${isLiked ? "liked" : ""}" onclick="likePost('${p.id}', this)">
            ❤️ <span class="like-count">${p.likes || 0}</span>
          </button>
          <button class="btn-action" onclick="openComments('${p.id}', \`${p.title}\`)">
            💬 ${commentsCount} Comentarii
          </button>
          ${currentUser ? `<button class="btn-action btn-report-sm" onclick="openReport('${p.id}')">🚨 Raportează</button>` : ""}
        </div>
      `;
      card.appendChild(body);
    }

    container.appendChild(card);
  }
}
