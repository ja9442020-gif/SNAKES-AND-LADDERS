const board = document.querySelector("#board");
const stationsTop = document.querySelector("#stations-top");
const stationsBottom = document.querySelector("#stations-bottom");
const boardArt = document.querySelector("#board-art");
const gameMessage = document.querySelector("#game-message");
const turnTitle = document.querySelector("#turn-title");
const turnBadge = document.querySelector("#turn-badge");
const soundToggle = document.querySelector("#sound-toggle");
const leaderboardList = document.querySelector("#leaderboard-list");
const setupCard = document.querySelector("#setup-card");
const gameLayout = document.querySelector("#game-layout");
const playerCountSelect = document.querySelector("#player-count-select");
const nameFields = document.querySelector("#name-fields");
const playersList = document.querySelector("#players-list");
const colors = ["coral", "blue", "purple", "gold"];
const avatars = ["🦊", "🐼", "🐸", "🦁"];
const STATS_KEY = "up-and-down-leaderboard-v1";

const ladders = new Map([[4, 14], [9, 31], [20, 38], [28, 84], [40, 59], [51, 67], [63, 81], [71, 91]]);
const snakes = new Map([[17, 7], [54, 34], [62, 19], [64, 60], [87, 24], [93, 73], [95, 75], [99, 78]]);
const dieSymbols = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

let players = [];
let currentPlayer = 0;
let locked = false;
let gameOver = false;
let audioContext;
let soundEnabled = localStorage.getItem("up-and-down-sound") !== "off";
let stats = loadStats();

function nameKey(name) {
  return name.trim().toLocaleLowerCase();
}

function loadStats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATS_KEY));
    if (saved?.byName && typeof saved.byName === "object") {
      return { byName: saved.byName };
    }
    if (Array.isArray(saved?.wins)) {
      const byName = {};
      saved.wins.forEach((wins, index) => {
        const name = `Player ${index + 1}`;
        byName[nameKey(name)] = { name, wins: Math.max(0, Number(wins) || 0) };
      });
      return { byName };
    }
  } catch (error) {
    console.info("Starting a fresh leaderboard.", error);
  }
  return { byName: {} };
}

function saveStats() {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function populateNameFields(names = []) {
  const count = Number(playerCountSelect.value);
  nameFields.replaceChildren();

  for (let index = 0; index < count; index += 1) {
    const label = document.createElement("label");
    label.className = "name-field";
    label.htmlFor = `player-name-${index}`;
    label.textContent = `Player ${index + 1} name`;

    const input = document.createElement("input");
    input.id = `player-name-${index}`;
    input.type = "text";
    input.maxLength = 18;
    input.autocomplete = "off";
    input.placeholder = `Player ${index + 1}`;
    input.value = names[index] || "";

    label.append(input);
    nameFields.append(label);
  }
}

function renderLeaderboard() {
  const records = { ...stats.byName };
  players.forEach((player) => {
    const key = nameKey(player.name);
    if (!records[key]) records[key] = { name: player.name, wins: 0 };
  });

  const ranked = Object.values(records)
    .filter((record) => Number(record.wins) > 0 || players.some((player) => nameKey(player.name) === nameKey(record.name)))
    .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name))
    .slice(0, 8);

  leaderboardList.replaceChildren();
  ranked.forEach((record, index) => {
    const row = document.createElement("div");
    row.className = "leaderboard-row";

    const rank = document.createElement("span");
    rank.className = `rank ${index === 0 ? "rank-gold" : "rank-silver"}`;
    rank.textContent = String(index + 1);

    const avatar = document.createElement("span");
    avatar.className = `leader-avatar avatar-${colors[index % colors.length]}`;
    avatar.textContent = record.name.slice(0, 2).toUpperCase();

    const name = document.createElement("strong");
    name.textContent = record.name;

    const wins = document.createElement("span");
    wins.className = "win-count";
    wins.textContent = `${record.wins} ${record.wins === 1 ? "win" : "wins"}`;

    row.append(rank, avatar, name, wins);
    leaderboardList.append(row);
  });
}

function syncSoundButton() {
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
  soundToggle.setAttribute("aria-label", soundEnabled ? "Turn sounds off" : "Turn sounds on");
  soundToggle.innerHTML = soundEnabled ? "🔊 <span>Sound on</span>" : "🔇 <span>Sound off</span>";
}

function playSound(kind) {
  if (!soundEnabled) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext ??= new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume();

  const patterns = {
    roll: [[260, 0, 0.045], [390, 0.06, 0.045], [310, 0.12, 0.045], [520, 0.18, 0.05], [700, 0.25, 0.12]],
    move: [[520, 0, 0.1]],
    ladder: [[520, 0, 0.11], [660, 0.11, 0.11], [780, 0.22, 0.17]],
    snake: [[440, 0, 0.12], [330, 0.12, 0.13], [220, 0.25, 0.2]],
    win: [[523, 0, 0.18], [659, 0.13, 0.18], [784, 0.26, 0.3]]
  };

  for (const [frequency, delay, duration] of patterns[kind] || []) {
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    const start = audioContext.currentTime + delay;
    oscillator.type = kind === "snake" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(0.11, start + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(volume);
    volume.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
}

function createBoard() {
  createBoardArt();
  for (let number = 100; number >= 1; number -= 1) {
    const cell = document.createElement("div");
    const rowFromBottom = Math.floor((number - 1) / 10);
    const offset = (number - 1) % 10;
    const column = rowFromBottom % 2 === 0 ? offset : 9 - offset;

    cell.className = "cell";
    cell.dataset.space = String(number);
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `Space ${number}`);
    cell.style.gridRow = String(10 - rowFromBottom);
    cell.style.gridColumn = String(column + 1);

    const label = document.createElement("span");
    label.className = "cell-number";
    label.textContent = String(number);
    cell.append(label);

    const tokens = document.createElement("span");
    tokens.className = "tokens";
    tokens.setAttribute("aria-hidden", "true");
    cell.append(tokens);
    board.append(cell);
  }
}

function boardPoint(space) {
  const rowFromBottom = Math.floor((space - 1) / 10);
  const offset = (space - 1) % 10;
  const column = rowFromBottom % 2 === 0 ? offset : 9 - offset;
  return { x: column * 100 + 50, y: (9 - rowFromBottom) * 100 + 50 };
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function createBoardArt() {
  boardArt.replaceChildren();
  for (let row = 0; row < 10; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      boardArt.append(svgElement("rect", {
        x: column * 100, y: row * 100, width: 100, height: 100,
        fill: (row + column) % 2 ? "#f4a2a2" : "#fff0c9",
        stroke: "#342829", "stroke-width": 2
      }));
    }
  }
  boardArt.append(svgElement("rect", { x: 4, y: 4, width: 992, height: 992, fill: "none", stroke: "#e9ed28", "stroke-width": 8 }));

  ladders.forEach((to, from) => {
    const start = boardPoint(from);
    const end = boardPoint(to);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    const px = -dy / length * 13;
    const py = dx / length * 13;
    const group = svgElement("g", { class: "ladder-art" });
    const rail1 = `M ${start.x + px} ${start.y + py} L ${end.x + px} ${end.y + py}`;
    const rail2 = `M ${start.x - px} ${start.y - py} L ${end.x - px} ${end.y - py}`;
    group.append(svgElement("path", { d: rail1, class: "ladder-rail-shadow" }), svgElement("path", { d: rail2, class: "ladder-rail-shadow" }));
    group.append(svgElement("path", { d: rail1, class: "ladder-rail" }), svgElement("path", { d: rail2, class: "ladder-rail" }));
    for (let step = 0.08; step < 0.96; step += Math.min(0.13, 30 / length)) {
      const x = start.x + dx * step;
      const y = start.y + dy * step;
      const rung = `M ${x + px} ${y + py} L ${x - px} ${y - py}`;
      group.append(svgElement("path", { d: rung, class: "ladder-rung-shadow" }), svgElement("path", { d: rung, class: "ladder-rung" }));
    }
    boardArt.append(group);
  });

  snakes.forEach((to, from) => {
    const start = boardPoint(from);
    const end = boardPoint(to);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    const bend = Math.min(78, length * 0.27);
    const px = -dy / length * bend;
    const py = dx / length * bend;
    const pathData = `M ${start.x} ${start.y} C ${start.x + dx * .25 + px} ${start.y + dy * .25 + py}, ${start.x + dx * .5 - px} ${start.y + dy * .5 - py}, ${start.x + dx * .58} ${start.y + dy * .58} S ${end.x - dx * .2 - px} ${end.y - dy * .2 - py}, ${end.x} ${end.y}`;
    const path = svgElement("path", { d: pathData, fill: "none", class: "snake-body-outline" });
    const body = svgElement("path", { d: pathData, fill: "none", class: "snake-body" });
    boardArt.append(path, body);
    const total = body.getTotalLength();
    for (let distance = 20; distance < total - 12; distance += 29) {
      const point = body.getPointAtLength(distance);
      boardArt.append(svgElement("circle", { cx: point.x, cy: point.y, r: 4.5, class: "snake-spot" }));
    }
    const head = svgElement("g", { class: "snake-head" });
    head.append(svgElement("ellipse", { cx: start.x, cy: start.y, rx: 12, ry: 10 }),
      svgElement("circle", { cx: start.x - 4, cy: start.y - 2, r: 2.7, class: "snake-eye" }),
      svgElement("circle", { cx: start.x + 3, cy: start.y - 4, r: 2.7, class: "snake-eye" }),
      svgElement("circle", { cx: start.x - 4, cy: start.y - 2, r: 1, class: "snake-pupil" }),
      svgElement("circle", { cx: start.x + 3, cy: start.y - 4, r: 1, class: "snake-pupil" }));
    head.append(svgElement("path", { d: `M ${start.x} ${start.y + 5} q 3 5 6 2 l 3 3 m -3 -3 l 3 -3`, class: "snake-tongue" }));
    boardArt.append(head);
  });
}

function render() {
  playersList.replaceChildren();
  stationsTop.replaceChildren();
  stationsBottom.replaceChildren();

  players.forEach((player, index) => {
    const isActive = index === currentPlayer && !gameOver;
    const station = document.createElement("section");
    station.className = `player-station station-${colors[index % colors.length]}${isActive ? " active-station" : ""}`;
    station.dataset.playerIndex = String(index);
    station.setAttribute("aria-label", `${player.name}${isActive ? ", current turn" : ""}`);

    const heading = document.createElement("div");
    heading.className = "station-heading";
    const avatar = document.createElement("span");
    avatar.className = `player-avatar avatar-${colors[index % colors.length]}`;
    avatar.textContent = avatars[index % avatars.length];
    const identity = document.createElement("div");
    identity.className = "station-identity";
    const name = document.createElement("strong");
    name.textContent = player.name;
    const status = document.createElement("span");
    status.textContent = gameOver && player.position === 100
      ? "Winner! 🎉"
      : player.position === 0
        ? isActive ? "Roll a 1 to enter" : "Waiting to enter"
        : isActive ? "Your turn" : `Space ${player.position}`;
    identity.append(name, status);
    heading.append(avatar, identity);

    const die = document.createElement("button");
    die.className = "station-die";
    die.type = "button";
    die.textContent = dieSymbols[(player.lastRoll || 1) - 1];
    die.setAttribute("aria-label", `Roll ${player.name}'s dice`);
    die.disabled = !isActive || locked || gameOver;
    die.addEventListener("click", rollDice);

    const position = document.createElement("span");
    position.className = "station-position";
    position.textContent = player.position === 0 ? "START" : `${String(player.position).padStart(2, "0")} / 100`;
    station.append(heading, die, position);
    const isTopCorner = index === 1 || index === 2;
    (isTopCorner ? stationsTop : stationsBottom).append(station);
  });

  boardArt.querySelectorAll(".ladder-art").forEach((ladder) => ladder.classList.remove("is-pending"));

  for (const cell of board.querySelectorAll(".cell")) {
    const space = Number(cell.dataset.space);
    const tokenArea = cell.querySelector(".tokens");
    tokenArea.replaceChildren();
    players.forEach((player, index) => {
      if (player.position === space) {
        const token = document.createElement("span");
        token.className = `token p${index + 1}`;
        token.textContent = avatars[index % avatars.length];
        tokenArea.append(token);
      }
    });
  }

  players.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = `player-row${index === currentPlayer && !gameOver ? " active-player" : ""}`;

    const avatar = document.createElement("span");
    avatar.className = `player-avatar avatar-${colors[index % colors.length]}`;
    avatar.textContent = avatars[index % avatars.length];

    const info = document.createElement("div");
    info.className = "player-info";
    const name = document.createElement("strong");
    name.textContent = player.name;
    const status = document.createElement("span");
    status.textContent = gameOver && player.position === 100
      ? "Winner! 🎉"
      : index === currentPlayer && !gameOver
        ? "Your turn"
        : player.position === 0
        ? "Roll a 1 to enter"
          : `On space ${player.position}`;
    info.append(name, status);

    const position = document.createElement("span");
    position.className = "position-pill";
    position.textContent = player.position === 0 ? "START" : String(player.position).padStart(2, "0");
    row.append(avatar, info, position);
    playersList.append(row);
  });

  document.querySelector("#playing-count").textContent = `${players.length} PLAYING`;
  turnTitle.textContent = gameOver ? `${players[currentPlayer].name} wins!` : (players[currentPlayer]?.name || "Choose players");
  turnBadge.textContent = String(currentPlayer + 1).padStart(2, "0");
  syncSoundButton();
  renderLeaderboard();
}

function setMessage(lines) {
  gameMessage.replaceChildren(...lines.map((line, index) => {
    const span = document.createElement("span");
    span.textContent = line;
    if (index === 0) span.style.fontWeight = "700";
    return span;
  }));
}

function startGame() {
  const count = Number(playerCountSelect.value);
  const names = Array.from(nameFields.querySelectorAll("input"), (input, index) =>
    input.value.trim() || `Player ${index + 1}`
  );
  const seen = new Set();

  players = names.slice(0, count).map((name, index) => {
    let finalName = name;
    let suffix = 2;
    while (seen.has(nameKey(finalName))) finalName = `${name} ${suffix++}`;
    seen.add(nameKey(finalName));
    return { name: finalName, position: 0, color: `p${index + 1}` };
  });

  currentPlayer = 0;
  gameOver = false;
  locked = false;
  setupCard.classList.add("is-hidden");
  gameLayout.classList.remove("is-hidden");
  setMessage(["Roll a 1 to enter the board.", "After entering, move by the number rolled. Ladders climb automatically."]);
  render();
}

function openPlayerSetup() {
  playerCountSelect.value = String(players.length || 2);
  populateNameFields(players.map((player) => player.name));
  gameLayout.classList.add("is-hidden");
  setupCard.classList.remove("is-hidden");
}

function finishRoll(roll) {
  const extraTurn = roll === 6 && !gameOver;
  if (!gameOver && !extraTurn) {
    currentPlayer = (currentPlayer + 1) % players.length;
  }
  if (extraTurn) {
    setMessage(["Rolled a 6!", "You get another turn."]);
  }
  locked = false;
  render();
}

function finishPlayerMove(roll, player) {
  const landed = player.position;

  if (ladders.has(landed)) {
    const destination = ladders.get(landed);
    setMessage(["You found a ladder! 🪜", `Climbing to space ${destination}.`]);
    player.position = destination;
    playSound("ladder");
  } else if (snakes.has(landed)) {
    player.position = snakes.get(landed);
    setMessage(["Oh, a snake! 🐍", `Slid to space ${player.position}.`]);
    playSound("snake");
  }

  if (player.position === 100) {
    gameOver = true;
    const key = nameKey(player.name);
    const record = stats.byName[key] || { name: player.name, wins: 0 };
    record.name = player.name;
    record.wins += 1;
    stats.byName[key] = record;
    saveStats();
    board.classList.add("winner-celebration");
    window.setTimeout(() => board.classList.remove("winner-celebration"), 2500);
    setMessage([`${player.name} wins! 🎉`, "Added to the Hall of Fame!"]);
    playSound("win");
  }

  finishRoll(roll);
}

function moveOneSpaceAtATime(roll, player, remaining) {
  if (remaining <= 0) {
    finishPlayerMove(roll, player);
    return;
  }

  window.setTimeout(() => {
    player.position += 1;
    setMessage([`Rolled a ${roll}!`, `Moving to space ${player.position}…`]);
    playSound("move");
    render();
    moveOneSpaceAtATime(roll, player, remaining - 1);
  }, 170);
}

function rollDice() {
  if (locked || gameOver || players.length === 0) return;
  locked = true;
  const diceButton = document.querySelector(`[data-player-index="${currentPlayer}"] .station-die`);
  diceButton.classList.remove("rolling");
  void diceButton.offsetWidth;
  diceButton.classList.add("rolling");

  const roll = Math.floor(Math.random() * 6) + 1;
  const player = players[currentPlayer];
  player.lastRoll = roll;
  playSound("roll");

  window.setTimeout(() => {
    if (player.position === 0 && roll !== 1) {
      setMessage([`Rolled a ${roll}.`, "You need a 1 to enter the board."]);
      finishRoll(roll);
      return;
    }
    if (player.position === 0 && roll === 1) {
      player.position = 1;
      setMessage(["Rolled a 1!", "You entered the board on space 1."]);
      playSound("move");
      render();
      finishPlayerMove(roll, player);
      return;
    }
    if (player.position + roll > 100) {
      setMessage([`Rolled a ${roll}!`, "Need an exact roll for 100."]);
      finishRoll(roll);
    } else {
      moveOneSpaceAtATime(roll, player, roll);
    }
  }, 700);
}

function resetGame() {
  if (players.length === 0) {
    openPlayerSetup();
    return;
  }
  players.forEach((player) => { player.position = 0; });
  currentPlayer = 0;
  locked = false;
  gameOver = false;
  board.classList.remove("winner-celebration");
  setMessage(["Roll a 1 to enter the board.", "After entering, move by the number rolled. Ladders climb automatically."]);
  setupCard.classList.add("is-hidden");
  gameLayout.classList.remove("is-hidden");
  render();
}

soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem("up-and-down-sound", soundEnabled ? "on" : "off");
  syncSoundButton();
  if (soundEnabled) playSound("move");
});

playerCountSelect.addEventListener("change", () => populateNameFields());
document.querySelector("#start-game").addEventListener("click", startGame);
document.querySelector("#edit-players").addEventListener("click", openPlayerSetup);
document.querySelector("#reset-top").addEventListener("click", resetGame);
document.querySelector("#reset-bottom").addEventListener("click", resetGame);
createBoard();
populateNameFields();
render();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.info("Offline support could not be enabled on this visit.", error);
    });
  });
}
