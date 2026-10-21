
const board = document.querySelector("#board");

const rollButtons = [
  document.querySelector("#roll-button"),
  document.querySelector("#roll-button-bottom")
];

const dieFace = document.querySelector("#die-face");
const gameMessage = document.querySelector("#game-message");
const turnTitle = document.querySelector("#turn-title");
const turnBadge = document.querySelector("#turn-badge");

const players = [
  { name: "Player 1", position: 0, color: "p1" },
  { name: "Player 2", position: 0, color: "p2" }
];

const ladders = new Map([
  [4, 14], [9, 31], [20, 38], [28, 84],
  [40, 59], [51, 67], [63, 81], [71, 91]
]);

const snakes = new Map([
  [17, 7], [54, 34], [62, 19], [64, 60],
  [87, 24], [93, 73], [95, 75], [99, 78]
]);

const dieSymbols = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

let currentPlayer = 0;
let locked = false;
let gameOver = false;
let soundEnabled = true;
let audioContext = null;

const leaderboardKey = "updown-leaderboard-v1";

function loadLeaderboard() {
  const empty = {
    wins: { "Player 1": 0, "Player 2": 0 },
    games: 0,
    lastWinner: ""
  };

  try {
    const saved = JSON.parse(
      localStorage.getItem(leaderboardKey)
    );

    if (!saved || typeof saved !== "object") {
      return empty;
    }

    return {
      wins: { ...empty.wins, ...(saved.wins || {}) },
      games: Number(saved.games) || 0,
      lastWinner:
        typeof saved.lastWinner === "string"
          ? saved.lastWinner
          : ""
    };
  } catch {
    return empty;
  }
}

let leaderboard = loadLeaderboard();

function saveLeaderboard() {
  try {
    localStorage.setItem(
      leaderboardKey,
      JSON.stringify(leaderboard)
    );
  } catch {
    // Gameplay continues if browser storage is unavailable.
  }
}

function renderLeaderboard() {
  const list = document.querySelector("#leaderboard-list");

  // The leaderboard HTML must be added to index.html.
  if (!list) return;

  const entries = players
    .map((player) => ({
      name: player.name,
      wins: leaderboard.wins[player.name] || 0
    }))
    .sort(
      (a, b) =>
        b.wins - a.wins || a.name.localeCompare(b.name)
    );

  list.replaceChildren(
    ...entries.map((entry, index) => {
      const row = document.createElement("div");
      row.className = "leaderboard-row";

      const rank = document.createElement("span");
      rank.className = "leaderboard-rank";
      rank.textContent = index === 0 ? "🥇" : "🥈";

      const name = document.createElement("strong");
      name.textContent = entry.name;

      const wins = document.createElement("span");
      wins.className = "leaderboard-wins";
      wins.textContent =
        `${entry.wins} ${entry.wins === 1 ? "win" : "wins"}`;

      row.append(rank, name, wins);
      return row;
    })
  );

  const note = document.querySelector(".leaderboard-note");

  if (note) {
    note.textContent = leaderboard.lastWinner
      ? `${leaderboard.games} games played · Last winner: ${leaderboard.lastWinner}`
      : "Wins are saved on this device.";
  }
}

function playSound(type) {
  if (!soundEnabled) return;

  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) return;

  const sounds = {
    roll: [
      [420, 0.08],
      [560, 0.10]
    ],
    ladder: [
      [520, 0.10],
      [660, 0.10],
      [820, 0.16]
    ],
    snake: [
      [340, 0.12],
      [250, 0.16],
      [170, 0.20]
    ],
    win: [
      [523, 0.12],
      [659, 0.12],
      [784, 0.12],
      [1046, 0.28]
    ]
  };

  const notes = sounds[type] || sounds.roll;

  try {
    audioContext ||= new AudioContextClass();

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    let startAt = audioContext.currentTime;

    notes.forEach(([frequency, duration]) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type =
        type === "snake" ? "triangle" : "sine";

      oscillator.frequency.setValueAtTime(
        frequency,
        startAt
      );

      gain.gain.setValueAtTime(0.0001, startAt);

      gain.gain.exponentialRampToValueAtTime(
        0.08,
        startAt + 0.015
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        startAt + duration
      );

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.02);

      startAt += duration * 0.78;
    });
  } catch {
    // The game still works if audio is unavailable.
  }
}

function recordWin(player) {
  leaderboard.wins[player.name] =
    (leaderboard.wins[player.name] || 0) + 1;

  leaderboard.games += 1;
  leaderboard.lastWinner = player.name;

  saveLeaderboard();
  renderLeaderboard();
}

function createBoard() {
  board.replaceChildren();

  for (let number = 100; number >= 1; number--) {
    const cell = document.createElement("div");

    const rowFromBottom = Math.floor((number - 1) / 10);
    const offset = (number - 1) % 10;

    const column =
      rowFromBottom % 2 === 0 ? offset : 9 - offset;

    cell.className = "cell";
    cell.dataset.space = number;
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `Space ${number}`);

    cell.style.gridRow = 10 - rowFromBottom;
    cell.style.gridColumn = column + 1;

    const label = document.createElement("span");
    label.className = "cell-number";
    label.textContent = String(number).padStart(2, "0");

    cell.append(label);

    if (ladders.has(number) || snakes.has(number)) {
      const isLadder = ladders.has(number);
      const marker = document.createElement("span");

      marker.className =
        `cell-special ${isLadder ? "ladder" : "snake"}`;

      marker.textContent = isLadder ? "↗" : "〰";

      marker.title = isLadder
        ? `Ladder to ${ladders.get(number)}`
        : `Snake to ${snakes.get(number)}`;

      cell.append(marker);
    }

    const tokens = document.createElement("span");
    tokens.className = "tokens";
    tokens.setAttribute("aria-hidden", "true");

    cell.append(tokens);
    board.append(cell);
  }
}

function render() {
  for (const cell of board.children) {
    const space = Number(cell.dataset.space);
    const tokenArea = cell.querySelector(".tokens");

    tokenArea.replaceChildren();

    players.forEach((player, index) => {
      if (player.position === space) {
        const token = document.createElement("span");

        token.className = `token ${player.color}`;
        token.textContent = `P${index + 1}`;

        tokenArea.append(token);
      }
    });
  }

  players.forEach((player, index) => {
    const position = document.querySelector(
      `#position-${index}`
    );

    const status = document.querySelector(
      `#player-status-${index}`
    );

    const row = document.querySelector(
      `#player-row-${index}`
    );

    position.textContent =
      player.position === 0
        ? "START"
        : String(player.position).padStart(2, "0");

    row.classList.toggle(
      "active-player",
      index === currentPlayer && !gameOver
    );

    if (gameOver && player.position === 100) {
      status.textContent = "Winner! 🎉";
    } else if (index === currentPlayer && !gameOver) {
      status.textContent = "Your turn";
    } else if (player.position === 0) {
      status.textContent = "Ready to roll";
    } else {
      status.textContent = `On space ${player.position}`;
    }
  });

  turnTitle.textContent = gameOver
    ? `${players[currentPlayer].name} wins!`
    : players[currentPlayer].name;

  turnBadge.textContent = `0${currentPlayer + 1}`;

  rollButtons.forEach((button) => {
    button.disabled = locked || gameOver;
  });

  renderLeaderboard();
}

function setMessage(lines) {
  gameMessage.replaceChildren(
    ...lines.map((line, index) => {
      const span = document.createElement("span");

      span.textContent = line;

      if (index === 0) {
        span.style.fontWeight = "700";
      }

      return span;
    })
  );
}

function rollDice() {
  if (locked || gameOver) return;

  locked = true;

  rollButtons.forEach((button) => {
    button.disabled = true;
  });

  const diceButton = document.querySelector("#roll-button");

  diceButton.classList.remove("rolling");
  void diceButton.offsetWidth;
  diceButton.classList.add("rolling");

  playSound("roll");

  const roll = Math.floor(Math.random() * 6) + 1;
  const player = players[currentPlayer];

  dieFace.textContent = dieSymbols[roll - 1];

  window.setTimeout(() => {
    if (player.position + roll > 100) {
      setMessage([
        `Rolled a ${roll}!`,
        "Need an exact roll for 100."
      ]);
    } else {
      player.position += roll;

      const landed = player.position;

      setMessage([
        `Rolled a ${roll}!`,
        `Moved to space ${landed}.`
      ]);

      if (ladders.has(landed)) {
        playSound("ladder");

        player.position = ladders.get(landed);

        setMessage([
          "🪜 Lucky climb!",
          `Up to space ${player.position}.`
        ]);
      } else if (snakes.has(landed)) {
        playSound("snake");

        player.position = snakes.get(landed);

        setMessage([
          "🐍 Oh, a snake!",
          `Slid to space ${player.position}.`
        ]);
      }

      if (player.position === 100) {
        gameOver = true;

        playSound("win");
        recordWin(player);

        setMessage([
          `🏆 ${player.name} wins!`,
          "What a lovely game!"
        ]);

        showCelebration();
      }
    }

    const extraTurn = roll === 6 && !gameOver;

    if (!gameOver && !extraTurn) {
      currentPlayer = (currentPlayer + 1) % players.length;
    }

    if (extraTurn) {
      setMessage([
        "🎉 Rolled a 6!",
        "You get another turn."
      ]);
    }

    locked = false;
    render();
  }, 420);
}

function showCelebration() {
  const card = document.querySelector(".turn-card");

  if (!card) return;

  card.classList.remove("winner-celebration");
  void card.offsetWidth;
  card.classList.add("winner-celebration");
}

function resetGame() {
  players.forEach((player) => {
    player.position = 0;
  });

  currentPlayer = 0;
  locked = false;
  gameOver = false;

  dieFace.textContent = dieSymbols[0];

  setMessage([
    "Tap the dice",
    "to get rolling!"
  ]);

  const card = document.querySelector(".turn-card");
  card?.classList.remove("winner-celebration");

  render();
}

function setupSoundToggle() {
  const soundToggle = document.querySelector("#sound-toggle");

  if (!soundToggle) return;

  soundToggle.setAttribute("aria-pressed", "true");

  soundToggle.addEventListener("click", () => {
    soundEnabled = !soundEnabled;

    soundToggle.setAttribute(
      "aria-pressed",
      String(soundEnabled)
    );

    soundToggle.setAttribute(
      "aria-label",
      soundEnabled ? "Turn sound off" : "Turn sound on"
    );

    soundToggle.innerHTML = soundEnabled
      ? "🔊 <span>Sound on</span>"
      : "🔇 <span>Sound off</span>";

    if (soundEnabled) {
      playSound("roll");
    }
  });
}

createBoard();
render();
setupSoundToggle();

rollButtons.forEach((button) => {
  button.addEventListener("click", rollDice);
});

document
  .querySelector("#reset-top")
  .addEventListener("click", resetGame);

document
  .querySelector("#reset-bottom")
  .addEventListener("click", resetGame);
