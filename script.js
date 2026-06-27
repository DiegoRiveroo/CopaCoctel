const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzYuUDT4SfbhjW99OwyfOmgEpHVAgyOXWIQ1TTKRloge2dhs7-etAqOmBeSLhJf-isYjw/exec";

const activeRoundEl = document.getElementById("activeRound");
const votingStatusEl = document.getElementById("votingStatus");
const rankingEl = document.getElementById("ranking");
const drinksGridEl = document.getElementById("drinksGrid");
const drinkSelectEl = document.getElementById("drinkSelect");
const voteForm = document.getElementById("voteForm");
const voteStatus = document.getElementById("voteStatus");
const refreshBtn = document.getElementById("refreshBtn");
const guestProgressEl = document.getElementById("guestProgress");
const guestCodeInput = document.querySelector('input[name="guestCode"]');
const submitBtn = voteForm?.querySelector('button[type="submit"]');

let latestState = null;

async function api(action, payload = {}) {
  const response = await fetch(SCRIPT_URL, {
    method: "POST",
    mode: "cors",
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

function escapeHtml(value) {
  return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
}

function showStatus(message, type = "info") {
  if (!voteStatus) return;
  voteStatus.textContent = message || "";
  voteStatus.className = `form-status ${type}`;
}

function getGuestCode() {
  return guestCodeInput ? guestCodeInput.value.trim().toUpperCase() : "";
}

function getDrinkIcon(round) {
  const value = String(round || "").trim();
  if (value === "1") return "✨";
  if (value === "2") return "🎤";
  if (value === "3") return "🏆";
  return "🍸";
}

function getEditionLabel(round) {
  const value = String(round || "").trim();
  if (value === "1") return "Carta Astral";
  if (value === "2") return "Shakira Edition";
  if (value === "3") return "Final Edition";
  return "Copa";
}

function updateSubmitButton(progress = null) {
  if (!submitBtn) return;

  if (!progress) {
    submitBtn.textContent = "Enviar voto";
    submitBtn.disabled = false;
    return;
  }

  if (progress.remaining <= 0) {
    submitBtn.textContent = "Ronda completa ✅";
    submitBtn.disabled = true;
    return;
  }

  submitBtn.textContent = `Enviar voto · faltan ${progress.remaining}`;
  submitBtn.disabled = false;
}

function renderRanking(ranking = []) {
  if (!rankingEl) return;

  if (!ranking.length) {
    rankingEl.innerHTML = "<p>Todavía no hay votos.</p>";
    return;
  }

  rankingEl.innerHTML = ranking.map((item, index) => {
    const position = item.position || index + 1;

    return `
      <div class="rank-card">
        <div class="rank-number">${medal(position)}</div>
        <div>
          <div class="rank-name">${escapeHtml(item.team || "Equipo")}</div>
          <div class="drink-meta">${item.table ? `Mesa ${escapeHtml(item.table)}` : ""}</div>
        </div>
        <div class="rank-points">Puesto ${position}</div>
      </div>
    `;
  }).join("");
}

async function getAvailableDrinksForGuest(drinks = []) {
  const guestCode = getGuestCode();
  if (!guestCode) return drinks;

  try {
    const progressResult = await api("getGuestProgress", { guestCode });

    if (!progressResult.ok || !progressResult.progress) {
      return drinks;
    }

    const pendingTexts = progressResult.progress.pending || [];

    if (!pendingTexts.length && progressResult.progress.total > 0) {
      return [];
    }

    return drinks.filter(drink =>
        pendingTexts.some(text =>
            text.includes(drink.teamName) && text.includes(drink.name)
        )
    );
  } catch (error) {
    console.error("No se pudo filtrar tragos por invitado:", error);
    return drinks;
  }
}

function bindDrinkCards() {
  if (!drinksGridEl || !drinkSelectEl) return;

  drinksGridEl.querySelectorAll(".drink-card:not(.disabled-card)").forEach(card => {
    card.addEventListener("click", () => {
      const drinkId = card.dataset.drinkId;
      if (!drinkId) return;

      drinkSelectEl.value = drinkId;

      document.querySelectorAll(".drink-card").forEach(item => {
        item.classList.remove("selected-card");
      });

      card.classList.add("selected-card");
      showStatus("Trago seleccionado ✅ Ahora poné las estrellas y enviá tu voto.", "success");
    });
  });
}

async function renderDrinks(drinks = []) {
  if (!drinksGridEl || !drinkSelectEl) return;

  if (!drinks.length) {
    drinksGridEl.innerHTML = "<p>No hay tragos activos para esta ronda.</p>";
    drinkSelectEl.innerHTML = "";
    return;
  }

  const availableDrinks = await getAvailableDrinksForGuest(drinks);

  if (!availableDrinks.length && getGuestCode()) {
    drinkSelectEl.innerHTML = "";

    drinksGridEl.innerHTML = drinks.map(drink => `
      <article class="drink-card disabled-card">
        <div class="edition-badge">${getEditionLabel(drink.round)}</div>
        <div class="drink-icon">${getDrinkIcon(drink.round)}</div>
        <h3>${escapeHtml(drink.name)}</h3>
        <p class="drink-meta">${escapeHtml(drink.teamName)} ${drink.table ? `· Mesa ${escapeHtml(drink.table)}` : ""}</p>
        ${drink.description ? `<p>${escapeHtml(drink.description)}</p>` : ""}
        <p class="drink-meta">Ya no disponible para tu voto</p>
      </article>
    `).join("");

    showStatus("Ya no tienes tragos pendientes para votar en esta ronda.", "success");
    return;
  }

  const options = availableDrinks.length ? availableDrinks : drinks;

  drinkSelectEl.innerHTML = `
    <option value="">Elegí un trago</option>
    ${options.map(drink => `
      <option value="${escapeHtml(drink.id)}">
        ${escapeHtml(drink.name)} — ${escapeHtml(drink.teamName)}
      </option>
    `).join("")}
  `;

  drinksGridEl.innerHTML = drinks.map(drink => {
    const isAvailable = options.some(option => String(option.id) === String(drink.id));
    const disabledClass = getGuestCode() && !isAvailable ? "disabled-card" : "";

    return `
      <article class="drink-card ${disabledClass}" data-drink-id="${escapeHtml(drink.id)}">
        <div class="edition-badge">${getEditionLabel(drink.round)}</div>
        <div class="drink-icon">${getDrinkIcon(drink.round)}</div>
        <h3>${escapeHtml(drink.name)}</h3>
        <p class="drink-meta">${escapeHtml(drink.teamName)} ${drink.table ? `· Mesa ${escapeHtml(drink.table)}` : ""}</p>
        ${drink.description ? `<p>${escapeHtml(drink.description)}</p>` : ""}
        ${getGuestCode() && !isAvailable ? `<p class="drink-meta">No disponible para tu voto</p>` : `<p class="drink-meta tap-hint">Tocá la carta para votar este trago</p>`}
      </article>
    `;
  }).join("");

  bindDrinkCards();
}

function initStars() {
  document.querySelectorAll(".rating-group").forEach(group => {
    const inputName = group.dataset.input;
    const input = group.querySelector(`input[name="${inputName}"]`);
    const starsEl = group.querySelector(".stars");

    if (!input || !starsEl || starsEl.dataset.ready === "true") return;

    starsEl.dataset.ready = "true";

    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "star-btn";
      btn.textContent = "☆";
      btn.dataset.value = i;

      btn.addEventListener("click", () => {
        input.value = i;

        starsEl.querySelectorAll(".star-btn").forEach(star => {
          const value = Number(star.dataset.value);
          star.textContent = value <= i ? "★" : "☆";
          star.classList.toggle("active", value <= i);
        });
      });

      starsEl.appendChild(btn);
    }
  });
}

function resetStars() {
  document.querySelectorAll(".rating-group").forEach(group => {
    const input = group.querySelector("input");
    const stars = group.querySelectorAll(".star-btn");

    if (input) input.value = "";

    stars.forEach(star => {
      star.textContent = "☆";
      star.classList.remove("active");
    });
  });
}

async function loadData() {
  try {
    const result = await api("getState");

    if (!result.ok) {
      if (activeRoundEl) activeRoundEl.textContent = "Error";
      if (votingStatusEl) votingStatusEl.textContent = result.message || "No se pudo cargar.";
      return;
    }

    latestState = result;

    document.body.classList.remove("round-1", "round-2", "round-3");
    document.body.classList.add(`round-${result.activeRound}`);

    if (activeRoundEl) activeRoundEl.textContent = result.roundName || result.eventName;

    if (votingStatusEl) {
      votingStatusEl.textContent = result.votingOpen ? "Votación abierta" : "Votación cerrada";
      votingStatusEl.classList.toggle("closed", !result.votingOpen);
    }

    if (!result.votingOpen) {
      showStatus("La votación está cerrada por ahora.", "warning");
    }

    renderRanking(result.ranking || []);
    await renderDrinks(result.drinks || []);
  } catch (error) {
    if (activeRoundEl) activeRoundEl.textContent = "Error de conexión";
    if (votingStatusEl) votingStatusEl.textContent = "Revisa la URL del Apps Script.";
    console.error(error);
  }
}

async function loadGuestProgress() {
  if (!guestCodeInput || !guestProgressEl) return;

  const guestCode = getGuestCode();

  if (!guestCode) {
    guestProgressEl.innerHTML = "";
    updateSubmitButton(null);
    await renderDrinks(latestState?.drinks || []);
    return;
  }

  try {
    const result = await api("getGuestProgress", { guestCode });

    if (!result.ok) {
      guestProgressEl.innerHTML = `
        <div class="progress-card warning-card">
          <strong>Código no encontrado</strong>
          <p>${escapeHtml(result.message || "Revisá el código ingresado.")}</p>
        </div>
      `;

      updateSubmitButton(null);
      await renderDrinks(latestState?.drinks || []);
      return;
    }

    const progress = result.progress;
    const guest = result.guest || {};
    const percent = progress.total > 0 ? Math.round((progress.used / progress.total) * 100) : 0;

    updateSubmitButton(progress);

    guestProgressEl.innerHTML = `
      <div class="progress-card player-card">
        <strong>👋 ¡Hola ${escapeHtml(guest.name || "invitado")}!</strong>
        <p>${escapeHtml(guest.teamName || "Tu equipo")}</p>

        <div class="progress-bar">
          <div style="width:${percent}%"></div>
        </div>

        <p><strong>${progress.used} de ${progress.total}</strong> tragos votados</p>
        <p><strong>Pendientes:</strong> ${progress.pending.length ? escapeHtml(progress.pending.join(", ")) : "Ninguno"}</p>

        <button type="button" id="changeGuestBtn" class="secondary-btn small-btn">Cambiar invitado</button>
      </div>
    `;

    const changeGuestBtn = document.getElementById("changeGuestBtn");

    changeGuestBtn?.addEventListener("click", async () => {
      guestCodeInput.value = "";
      guestCodeInput.disabled = false;
      guestProgressEl.innerHTML = "";

      if (drinkSelectEl) drinkSelectEl.value = "";

      resetStars();
      updateSubmitButton(null);
      showStatus("", "info");

      await loadData();
    });

    await renderDrinks(latestState?.drinks || []);
  } catch (error) {
    guestProgressEl.innerHTML = "<p>No se pudo cargar tu progreso.</p>";
    console.error(error);
  }
}

voteForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = Object.fromEntries(new FormData(voteForm).entries());
  const savedCode = getGuestCode();

  if (!payload.drinkId) {
    showStatus("Elegí un trago antes de enviar tu voto.", "warning");
    return;
  }

  if (!payload.taste || !payload.presentation || !payload.concept) {
    showStatus("Completá las 3 valoraciones con estrellas.", "warning");
    return;
  }

  showStatus("Enviando voto...", "info");

  try {
    const result = await api("submitVote", payload);

    if (result.ok) {
      showStatus("✅ Voto registrado. Elegí el siguiente trago pendiente.", "success");

      if (drinkSelectEl) drinkSelectEl.value = "";
      resetStars();

      if (guestCodeInput) {
        guestCodeInput.disabled = false;
        guestCodeInput.value = savedCode;
      }

      await loadGuestProgress();
      await loadData();

      return;
    }

    showStatus(result.message || "No se pudo registrar el voto.", "warning");
  } catch (error) {
    showStatus("No se pudo enviar el voto. Revisá la conexión.", "warning");
    console.error(error);
  }
});

refreshBtn?.addEventListener("click", async () => {
  await loadData();
  await loadGuestProgress();
});

drinkSelectEl?.addEventListener("change", () => {
  document.querySelectorAll(".drink-card").forEach(card => {
    card.classList.toggle("selected-card", card.dataset.drinkId === drinkSelectEl.value);
  });
});

guestCodeInput?.addEventListener("blur", loadGuestProgress);
guestCodeInput?.addEventListener("change", loadGuestProgress);
guestCodeInput?.addEventListener("input", () => {
  clearTimeout(window.__guestInputTimer);
  window.__guestInputTimer = setTimeout(loadGuestProgress, 500);
});

initStars();
loadData();
setInterval(loadData, 10000);