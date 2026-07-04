const SPREADSHEET_ID = "14kh54nnIYlaHYyPwOK-A0EqMDn-JR81b-MkQaXcgdgk";

const CONFIG_SHEET = "Config";
const TEAMS_SHEET = "Equipos";
const DRINKS_SHEET = "Tragos";
const VOTES_SHEET = "Votos";
const GUESTS_SHEET = "Invitados";

function doGet() {
  return ContentService
    .createTextOutput("Copa de Cócteles OK")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    setupSheets(ss);

    if (data.action === "getState") return getState(ss);
    if (data.action === "submitVote") return submitVote(ss, data);
    if (data.action === "getGuestProgress") return getGuestProgress(ss, data);
    if (data.action === "getDashboard") return getDashboard(ss);

    return jsonResponse({ ok: false, message: "Acción no reconocida." });
  } catch (error) {
    return jsonResponse({ ok: false, message: "Error: " + error.message });
  }
}

function setupSheets(ss) {
  getOrCreateSheet(ss, CONFIG_SHEET, ["Clave", "Valor"]);
  getOrCreateSheet(ss, TEAMS_SHEET, ["EquipoID", "Nombre", "Mesa"]);
  getOrCreateSheet(ss, DRINKS_SHEET, ["TragoID", "Ronda", "EquipoID", "Nombre", "Descripcion", "Estado"]);
  getOrCreateSheet(ss, VOTES_SHEET, ["Fecha", "Código", "Ronda", "TragoID", "EquipoVotante", "EquipoVotado", "Trago", "Sabor", "Presentación", "Concepto", "Total"]);
  getOrCreateSheet(ss, GUESTS_SHEET, ["Código", "Nombre", "EquipoID", "Activo"]);

  const config = ss.getSheetByName(CONFIG_SHEET);
  ensureConfig(config, "RondaActiva", "1");
  ensureConfig(config, "VotacionAbierta", "Sí");
  ensureConfig(config, "MostrarResultadosFinales", "No");
  ensureConfig(config, "MostrarGanadoresRonda", "No");
}

function getState(ss) {
  const activeRound = String(getConfigValue(ss, "RondaActiva", "1")).trim();
  return jsonResponse({
    ok: true,
    eventName: "Copa de Cócteles",
    activeRound,
    roundName: getRoundName(activeRound),
    votingOpen: normalizeYes(getConfigValue(ss, "VotacionAbierta", "Sí")),
    drinks: getActiveDrinks(ss, activeRound),
    ranking: getRankingByScope(ss, null)
  });
}

function submitVote(ss, data) {
  const activeRound = String(getConfigValue(ss, "RondaActiva", "1")).trim();
  const votingOpen = normalizeYes(getConfigValue(ss, "VotacionAbierta", "Sí"));

  if (!votingOpen) return jsonResponse({ ok: false, message: "La votación está cerrada." });

  const guestCode = String(data.guestCode || "").trim().toUpperCase();
  const drinkId = String(data.drinkId || "").trim();

  if (!guestCode) return jsonResponse({ ok: false, message: "Ingresa tu código." });
  if (!drinkId) return jsonResponse({ ok: false, message: "Selecciona un trago." });

  const guest = getGuestByCode(ss, guestCode);
  if (!guest) return jsonResponse({ ok: false, message: "Código no válido o inactivo." });

  const drink = findDrink(ss, drinkId);
  if (!drink) return jsonResponse({ ok: false, message: "No se encontró el trago." });

  if (String(drink.round) !== activeRound) {
    return jsonResponse({ ok: false, message: "Ese trago no pertenece a la ronda activa." });
  }

  if (String(guest.teamId) === String(drink.teamId)) {
    return jsonResponse({ ok: false, message: "No puedes votar por el trago de tu propio equipo." });
  }

  if (hasAlreadyVoted(ss, guestCode, activeRound, drinkId)) {
    return jsonResponse({ ok: false, message: "Ya votaste por este trago." });
  }

  const taste = clampScore(data.taste);
  const presentation = clampScore(data.presentation);
  const concept = clampScore(data.concept);
  const total = taste + presentation + concept;

  ss.getSheetByName(VOTES_SHEET).appendRow([
    new Date(), guestCode, activeRound, drink.id, guest.teamName, drink.teamName,
    drink.name, taste, presentation, concept, total
  ]);

  return jsonResponse({ ok: true, message: "Voto registrado. Gracias por participar." });
}

function getGuestProgress(ss, data) {
  const activeRound = String(getConfigValue(ss, "RondaActiva", "1")).trim();
  const guestCode = String(data.guestCode || "").trim().toUpperCase();

  if (!guestCode) return jsonResponse({ ok: false, message: "Ingresa tu código." });

  const guest = getGuestByCode(ss, guestCode);
  if (!guest) return jsonResponse({ ok: false, message: "Código no válido o inactivo." });

  const allowedDrinks = getActiveDrinks(ss, activeRound).filter(d => String(d.teamId) !== String(guest.teamId));
  const votedIds = getVotedDrinkIds(ss, guestCode, activeRound);
  const voted = allowedDrinks.filter(d => votedIds.includes(String(d.id)));
  const pending = allowedDrinks.filter(d => !votedIds.includes(String(d.id)));

  return jsonResponse({
    ok: true,
    progress: {
      total: allowedDrinks.length,
      used: voted.length,
      remaining: pending.length,
      voted: voted.map(d => `${d.teamName} — ${d.name}`),
      pending: pending.map(d => `${d.teamName} — ${d.name}`)
    }
  });
}

function getDashboard(ss) {
  const activeRound = String(getConfigValue(ss, "RondaActiva", "1")).trim();
  return jsonResponse({
    ok: true,
    eventName: "Copa de Cócteles",
    activeRound,
    roundName: getRoundName(activeRound),
    votingOpen: normalizeYes(getConfigValue(ss, "VotacionAbierta", "Sí")),
    showFinalResults: normalizeYes(getConfigValue(ss, "MostrarResultadosFinales", "No")),
    showRoundWinners: normalizeYes(getConfigValue(ss, "MostrarGanadoresRonda", "No")),
    generalRanking: getRankingByScope(ss, null),
    roundRanking: getRankingByScope(ss, activeRound),
    roundsRanking: { "1": getRankingByScope(ss, "1"), "2": getRankingByScope(ss, "2"), "3": getRankingByScope(ss, "3") },
    participation: getParticipation(ss, activeRound),
    lastVote: getLastVote(ss),
    specialAwards: getSpecialAwards(ss)
  });
}

function getTeams(ss) {
  const sheet = ss.getSheetByName(TEAMS_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 3).getValues()
    .filter(r => r[0] !== "")
    .map(r => ({ id: String(r[0]).trim(), name: String(r[1] || "").trim(), table: String(r[2] || "").trim() }));
}

function getGuestByCode(ss, guestCode) {
  const sheet = ss.getSheetByName(GUESTS_SHEET);
  const lastRow = sheet.getLastRow();
  const teams = getTeams(ss);
  if (lastRow < 2) return null;

  const row = sheet.getRange(2, 1, lastRow - 1, 4).getValues().find(r =>
    String(r[0] || "").trim().toUpperCase() === guestCode && normalizeYes(r[3] || "Sí")
  );
  if (!row) return null;

  const teamId = String(row[2] || "").trim();
  const team = teams.find(t => String(t.id) === teamId);
  return { code: guestCode, name: String(row[1] || "").trim(), teamId, teamName: team ? team.name : teamId };
}

function getActiveDrinks(ss, round) {
  const sheet = ss.getSheetByName(DRINKS_SHEET);
  const lastRow = sheet.getLastRow();
  const teams = getTeams(ss);
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, 6).getValues()
    .filter(r => String(r[1]).trim() === String(round).trim() && normalizeYes(r[5]))
    .map(r => {
      const teamId = String(r[2]).trim();
      const team = teams.find(t => String(t.id) === teamId);
      return {
        id: String(r[0]).trim(),
        round: String(r[1]).trim(),
        teamId,
        teamName: team ? team.name : teamId,
        table: team ? team.table : "",
        name: String(r[3] || "").trim(),
        description: String(r[4] || "").trim()
      };
    });
}

function findDrink(ss, drinkId) {
  const sheet = ss.getSheetByName(DRINKS_SHEET);
  const lastRow = sheet.getLastRow();
  const teams = getTeams(ss);
  if (lastRow < 2) return null;

  const row = sheet.getRange(2, 1, lastRow - 1, 6).getValues().find(r => String(r[0]).trim() === String(drinkId).trim());
  if (!row) return null;

  const teamId = String(row[2]).trim();
  const team = teams.find(t => String(t.id) === teamId);
  return {
    id: String(row[0]).trim(), round: String(row[1]).trim(), teamId,
    teamName: team ? team.name : teamId, table: team ? team.table : "",
    name: String(row[3] || "").trim(), description: String(row[4] || "").trim()
  };
}

function hasAlreadyVoted(ss, guestCode, round, drinkId) {
  const sheet = ss.getSheetByName(VOTES_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  return sheet.getRange(2, 1, lastRow - 1, 4).getValues().some(r =>
    String(r[1] || "").trim().toUpperCase() === guestCode &&
    String(r[2] || "").trim() === String(round).trim() &&
    String(r[3] || "").trim() === String(drinkId).trim()
  );
}

function getVotedDrinkIds(ss, guestCode, round) {
  const sheet = ss.getSheetByName(VOTES_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 4).getValues()
    .filter(r => String(r[1] || "").trim().toUpperCase() === guestCode && String(r[2] || "").trim() === String(round).trim())
    .map(r => String(r[3]).trim());
}

function getRankingByScope(ss, round) {
  const totals = {};
  getTeams(ss).forEach(team => {
    totals[team.name] = { team: team.name, teamId: team.id, table: team.table, points: 0, votes: 0, position: 0 };
  });

  const sheet = ss.getSheetByName(VOTES_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 11).getValues().forEach(r => {
      const voteRound = String(r[2] || "").trim();
      const teamName = String(r[5] || "").trim();
      const total = Number(r[10]) || 0;
      if (round && voteRound !== String(round).trim()) return;
      if (!teamName) return;
      if (!totals[teamName]) totals[teamName] = { team: teamName, teamId: "", table: "", points: 0, votes: 0, position: 0 };
      totals[teamName].points += total;
      totals[teamName].votes += 1;
    });
  }

  const ranking = Object.values(totals).sort((a, b) => b.points - a.points);
  ranking.forEach((item, index) => item.position = index + 1);
  return ranking;
}

function getParticipation(ss, round) {
  const guests = ss.getSheetByName(GUESTS_SHEET);
  const votes = ss.getSheetByName(VOTES_SHEET);
  const totalGuests = Math.max(guests.getLastRow() - 1, 0);
  const lastRow = votes.getLastRow();
  if (lastRow < 2) return { totalGuests, voters: 0, percentage: 0 };

  const unique = new Set();
  votes.getRange(2, 1, lastRow - 1, 3).getValues().forEach(r => {
    if (String(r[2] || "").trim() === String(round).trim()) unique.add(String(r[1] || "").trim().toUpperCase());
  });
  const voters = unique.size;
  return { totalGuests, voters, percentage: totalGuests > 0 ? Math.round((voters / totalGuests) * 100) : 0 };
}

function getLastVote(ss) {
  const sheet = ss.getSheetByName(VOTES_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const r = sheet.getRange(lastRow, 1, 1, 11).getValues()[0];
  return { timestamp: r[0], guestCode: r[1], round: r[2], drinkId: r[3], teamVoter: r[4], teamVoted: r[5], drink: r[6], total: r[10] };
}

function getSpecialAwards(ss) {
  const totals = {};
  getTeams(ss).forEach(team => {
    totals[team.name] = {
      team: team.name,
      taste: { sum: 0, count: 0 },
      presentation: { sum: 0, count: 0 },
      concept: { sum: 0, count: 0 }
    };
  });

  const sheet = ss.getSheetByName(VOTES_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 11).getValues().forEach(r => {
      const team = String(r[5] || "").trim();
      if (!totals[team]) return;
      totals[team].taste.sum += Number(r[7]) || 0;
      totals[team].taste.count++;
      totals[team].presentation.sum += Number(r[8]) || 0;
      totals[team].presentation.count++;
      totals[team].concept.sum += Number(r[9]) || 0;
      totals[team].concept.count++;
    });
  }

  return {
    taste: getCategoryWinner(totals, "taste", "Mejor sabor"),
    presentation: getCategoryWinner(totals, "presentation", "Mejor presentación"),
    concept: getCategoryWinner(totals, "concept", "Mejor concepto")
  };
}

function getCategoryWinner(totals, category, label) {
  let winner = null;
  Object.values(totals).forEach(item => {
    const data = item[category];
    const score = data.count > 0 ? data.sum / data.count : 0;
    if (!winner || score > winner.score) winner = { label, team: item.team, score: Number(score.toFixed(2)) };
  });
  return winner;
}

function getConfigValue(ss, key, fallback) {
  const sheet = ss.getSheetByName(CONFIG_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return fallback;
  const found = sheet.getRange(2, 1, lastRow - 1, 2).getValues().find(r => String(r[0]).trim() === key);
  return found ? found[1] : fallback;
}

function ensureConfig(sheet, key, value) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    sheet.appendRow([key, value]);
    return;
  }
  const found = sheet.getRange(2, 1, lastRow - 1, 1).getValues().some(r => String(r[0]).trim() === key);
  if (!found) sheet.appendRow([key, value]);
}

function getRoundName(round) {
  const value = String(round).trim();
  if (value === "1") return "Ronda 1 — Carta Astral";
  if (value === "2") return "Ronda 2 — Shakira Signature";
  if (value === "3") return "Ronda 3 — Cóctel del Cumpleañero";
  return `Ronda ${value}`;
}

function clampScore(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return 1;
  return Math.min(Math.max(number, 1), 5);
}

function normalizeYes(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return ["si", "yes", "true", "activo", "activa", "abierta"].includes(normalized);
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    return sheet;
  }
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  return sheet;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
