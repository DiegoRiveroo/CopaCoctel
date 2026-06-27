const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzYuUDT4SfbhjW99OwyfOmgEpHVAgyOXWIQ1TTKRloge2dhs7-etAqOmBeSLhJf-isYjw/exec";

let revealInProgress = false;
let finalRevealed = false;

const params = new URLSearchParams(window.location.search);
if (params.get("screen") === "1") {
  document.body.classList.add("screen-mode");
}

async function api(action, payload = {}) {
  const response = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload })
  });

  return response.json();
}

function medal(position) {
  if (position === 1) return "🥇";
  if (position === 2) return "🥈";
  if (position === 3) return "🥉";
  return `#${position}`;
}

function getOrderedRanking(ranking = []) {
  return [...ranking].sort((a, b) => (a.position || 999) - (b.position || 999));
}

function getWinnerText(ranking = []) {
  if (!ranking.length) return "Sin votos";

  const topScore = ranking[0]?.points || 0;
  return ranking
      .filter(item => (item.points || 0) === topScore)
      .map(item => item.team || "Equipo")
      .join(" / ");
}

function renderRanking(containerId, ranking = []) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!ranking.length) {
    container.innerHTML = `<p>Todavía no hay votos.</p>`;
    return;
  }

  container.innerHTML = getOrderedRanking(ranking).map((item, index) => {
    const position = item.position || index + 1;

    return `
      <div class="tv-rank-item">
        <div>
          <span class="medal">${medal(position)}</span>
          <span class="rank-name">${item.team || "Equipo"}</span>
          <small>${item.table ? `Mesa ${item.table}` : ""}</small>
        </div>
        <strong>Puesto ${position}</strong>
      </div>
    `;
  }).join("");
}

function renderRounds(roundsRanking = {}) {
  const container = document.getElementById("roundsRanking");
  if (!container) return;

  const names = {
    "1": "Ronda 1 — Carta Astral",
    "2": "Ronda 2 — Shakira Signature",
    "3": "Ronda 3 — Cóctel del Cumpleañero"
  };

  container.innerHTML = Object.keys(roundsRanking).map(round => {
    const ranking = getOrderedRanking(roundsRanking[round] || []);

    return `
      <div class="mini-round">
        <h3>${names[round] || `Ronda ${round}`}</h3>
        ${ranking.map((item, index) => {
      const position = item.position || index + 1;
      return `
            <div class="mini-rank">
              <span>${medal(position)} ${item.team || "Equipo"}</span>
              <strong class="round-points">Puesto ${position}</strong>
            </div>
          `;
    }).join("")}
      </div>
    `;
  }).join("");
}

function renderAwards(awards = {}) {
  const container = document.getElementById("specialAwards");
  if (!container) return;

  const list = Object.values(awards).filter(Boolean);

  if (!list.length) {
    container.innerHTML = `<p>Todavía no hay premios calculados.</p>`;
    return;
  }

  container.innerHTML = list.map(award => `
    <div class="award-card">
      <span>${award.label || "Premio especial"}</span>
      <strong>${award.team || "Sin equipo"}</strong>
    </div>
  `).join("");
}

function showLiveView() {
  finalRevealed = false;
  document.body.classList.remove("final-revealed");

  const generalCard = document.getElementById("generalRanking")?.closest(".tv-card");
  const awardsSection = document.getElementById("awardsSection");
  const finalSection = document.getElementById("finalSection");
  const revealControls = document.getElementById("revealControls");
  const backBtn = document.getElementById("backToLiveBtn");
  const revealBtn = document.getElementById("revealBtn");

  if (generalCard) generalCard.classList.remove("hidden");
  if (awardsSection) awardsSection.classList.add("hidden");
  if (finalSection) finalSection.classList.add("hidden");
  if (revealControls) revealControls.classList.add("hidden");
  if (backBtn) backBtn.classList.add("hidden");
  if (revealBtn) revealBtn.classList.remove("hidden");
}

function showPreRevealView() {
  finalRevealed = false;
  document.body.classList.remove("final-revealed");

  const awardsSection = document.getElementById("awardsSection");
  const finalSection = document.getElementById("finalSection");
  const revealControls = document.getElementById("revealControls");
  const backBtn = document.getElementById("backToLiveBtn");
  const revealBtn = document.getElementById("revealBtn");

  if (awardsSection) awardsSection.classList.add("hidden");
  if (finalSection) finalSection.classList.add("hidden");
  if (revealControls) revealControls.classList.remove("hidden");
  if (backBtn) backBtn.classList.add("hidden");
  if (revealBtn) revealBtn.classList.remove("hidden");
}

function showFinalView(data) {
  finalRevealed = true;
  document.body.classList.add("final-revealed");

  const awardsSection = document.getElementById("awardsSection");
  const finalSection = document.getElementById("finalSection");
  const backBtn = document.getElementById("backToLiveBtn");

  if (awardsSection) awardsSection.classList.remove("hidden");
  if (finalSection) finalSection.classList.remove("hidden");
  if (backBtn) backBtn.classList.remove("hidden");

  renderAwards(data.specialAwards || {});
  renderRanking("generalRanking", data.generalRanking || []);

  const finalWinnerEl = document.getElementById("finalWinner");
  const finalPointsEl = document.getElementById("finalPoints");

  if (finalWinnerEl) finalWinnerEl.textContent = getWinnerText(data.generalRanking || []);
  if (finalPointsEl) finalPointsEl.textContent = "Campeón de la Copa de Cócteles";
}

function startReveal(data) {
  if (revealInProgress) return;

  const overlay = document.getElementById("revealOverlay");
  const titleEl = document.getElementById("revealNumber");
  const mainEl = document.getElementById("revealWinner");
  const detailEl = document.getElementById("revealPoints");

  if (!overlay || !titleEl || !mainEl || !detailEl) return;

  revealInProgress = true;
  overlay.classList.remove("hidden", "reveal-done");

  const ranking = getOrderedRanking(data.generalRanking || []);
  const reverseRanking = [...ranking].reverse();
  const awards = Object.values(data.specialAwards || {}).filter(Boolean);

  const scenes = [];

  scenes.push({
    type: "intro",
    title: "Resultados finales",
    main: "",
    detail: "La Copa de Cócteles se define ahora"
  });

  reverseRanking.forEach(item => {
    const position = item.position || ranking.indexOf(item) + 1;
    scenes.push({
      type: position === 1 ? "winner" : "position",
      title: position === 1 ? "🏆 Campeón" : `${position}.º lugar`,
      main: item.team || "Equipo",
      detail: item.table ? `Mesa ${item.table}` : ""
    });
  });

  if (awards.length) {
    scenes.push({
      type: "intro",
      title: "Premios especiales",
      main: "",
      detail: "Reconocimientos por categoría"
    });

    awards.forEach(award => {
      scenes.push({
        type: "award",
        title: award.label || "Premio especial",
        main: award.team || "Sin equipo",
        detail: ""
      });
    });
  }

  let index = 0;

  function renderScene(scene) {
    titleEl.innerHTML = scene.title || "";
    mainEl.innerHTML = scene.main || "";
    detailEl.innerHTML = scene.detail || "";

    overlay.dataset.scene = scene.type || "default";
    titleEl.className = "";
    mainEl.className = "";
    detailEl.className = "";

    void titleEl.offsetWidth;

    titleEl.classList.add("scene-pop");
    mainEl.classList.add("scene-pop");
    detailEl.classList.add("scene-pop");
  }

  function nextScene() {
    if (index < scenes.length) {
      const scene = scenes[index++];
      renderScene(scene);

      const duration = scene.type === "intro" ? 2200 : scene.type === "winner" ? 5200 : 3300;
      setTimeout(nextScene, duration);
      return;
    }

    overlay.classList.add("reveal-done");

    setTimeout(() => {
      overlay.classList.add("hidden");
      revealInProgress = false;
      showFinalView(data);
    }, 1200);
  }

  nextScene();
}

function bindRevealButtons() {
  const revealBtn = document.getElementById("revealBtn");
  const backBtn = document.getElementById("backToLiveBtn");

  if (revealBtn && revealBtn.dataset.bound !== "true") {
    revealBtn.dataset.bound = "true";
    revealBtn.addEventListener("click", () => {
      if (window.latestDashboardData) startReveal(window.latestDashboardData);
    });
  }

  if (backBtn && backBtn.dataset.bound !== "true") {
    backBtn.dataset.bound = "true";
    backBtn.addEventListener("click", () => {
      showPreRevealView();
    });
  }
}

async function loadDashboard() {
  try {
    const data = await api("getDashboard");

    if (!data.ok) {
      console.error("Dashboard error:", data.message);
      return;
    }

    window.latestDashboardData = data;

    const roundNameEl = document.getElementById("roundName");
    if (roundNameEl) {
      roundNameEl.innerHTML = `${data.roundName || ""} · ${data.votingOpen ? "Votación abierta" : "Votación cerrada"}`;
    }

    renderRanking("generalRanking", data.generalRanking || []);
    renderRanking("roundRanking", data.roundRanking || []);

    const participationEl = document.getElementById("participation");
    if (participationEl) {
      participationEl.innerHTML = `
        <div class="big-number">${data.participation?.voters || 0}/${data.participation?.totalGuests || 0}</div>
        <p>${data.participation?.percentage || 0}% participó en la ronda</p>
      `;
    }

    const lastVoteEl = document.getElementById("lastVote");
    if (lastVoteEl) {
      lastVoteEl.innerHTML = data.lastVote ? `
        <div class="last-vote-code">Último voto registrado</div>
        <p>${data.lastVote.teamVoted || "Equipo"} · ${data.lastVote.drink || "Trago"}</p>
      ` : `<p>Todavía no hay votos.</p>`;
    }

    const roundsSection = document.getElementById("roundsSection");
    if (data.showRoundWinners && roundsSection) {
      roundsSection.classList.remove("hidden");
      renderRounds(data.roundsRanking || {});
    } else if (roundsSection) {
      roundsSection.classList.add("hidden");
    }

    bindRevealButtons();

    if (data.showFinalResults) {
      if (finalRevealed) showFinalView(data);
      else showPreRevealView();
    } else {
      showLiveView();
    }
  } catch (error) {
    console.error("Error cargando dashboard:", error);
  }
}

loadDashboard();
setInterval(loadDashboard, 10000);