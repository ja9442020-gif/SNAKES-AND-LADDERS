const board = document.querySelector("#board");
const rollButtons = [
  document.querySelector("#roll-button"),
  document.querySelector("#roll-button-bottom")
];
const dieFace = document.querySelector("#die-face");
const gameMessage = document.querySelector("#game-message");
const turnTitle = document.querySelector("#turn-title");
const turnBadge = document.querySelector("#turn-badge");
const soundToggle = document.querySelector("#sound-toggle");
const leaderboardList = document.querySelector("#leaderboard-list");

const players = [
  { name: "Player 1", position: 0, color: "p1", avatar: "avatar-coral" },
  { name: "Player 2", position: 0, color: "p2", avatar: "avatar-blue" }
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
const STATS_KEY = "up-and-down-leaderboard-v1";

let currentPlayer = 0;
let locked = false;
let gameOver = false;
let audioContext;
let soundEnabled = localStorage.getItem("up-and-down-sound") !== "off";
let stats = loadStats();

function loadStats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATS_KEY));

    if (saved && Array.isArray(saved.wins) && saved.wins.length === 2) {
      return {
        wins: saved.wins.map((count) => Math.max(0, Number(count) || 0))
      };
    }
  } catch (error) {
    console.info("Starting a fresh local leaderboard.", error);
  }

  return { wins: [0, 0] };
}

function saveStats() {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function renderLeaderboard() {
  const rankedPlayers = players
    .map((player, index) => ({
      ...player,
      index,
      wins: stats.wins[index]
    }))
    .sort((a, b) => b.wins - a.wins || a.index - b.index);

  leaderboardList.replaceChildren();

  rankedPlayers.forEach((player, rankIndex) => {
    const row = document.createElement("div");
    row.className = "leaderboard-row";

    const rank = document.createElement("span");
    rank.className = `rank ${rankIndex === 0 ? "rank-gold" : "rank-silver"}`;
    rank.textContent = String(rankIndex + 1);

    const avatar = document.createElement("span");
    avatar.className = `leader-avatar ${player.avatar}`;
    avatar.textContent = `P${player.index + 1}`;

    const name = document.createElement("strong");
    name.textContent = player.name;

    const wins = document.createElement("span");
    wins.className = "win-count";
    wins.textContent = `${player.wins} ${player.wins === 1 ? "win" : "wins"}`;

    row.append(rank, avatar, name, wins);
    leaderboardList.append(row);
  });
}

function syncSoundButton() {
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
  soundToggle.setAttribute(
    "aria-label",
    soundEnabled ? "Turn sounds off" : "Turn sounds on"
  );

  soundToggle.innerHTML = soundEnabled
    ? "🔊 <span>Sound on</span>"
    : "🔇 <span>Sound off</span>";
}

function playSound(kind) {
  if (!soundEnabled) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  audioContext ??= new AudioContextClass();

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  const now = audioContext.currentTime;

  const patterns = {
    roll: [
      [440, 0, 0.07],
      [560, 0.09, 0.08],
      [680, 0.18, 0.11]
    ],
    move: [[520, 0, 0.1]],
    ladder: [
      [520, 0, 0.11],
      [660, 0.11, 0.11],
      [780, 0.22, 0.17]
    ],
    snake: [
      [440, 0, 0.12],
      [330, 0.12, 0.13],
      [220, 0.25, 0.2]
    ],
    win: [
      [523, 0, 0.18],
      [659, 0.13, 0.18],
      [784, 0.26, 0.3]
    ]
  };

  for (const [frequency, delay, duration] of patterns[kind] || []) {
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    const start = now + delay;

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
  for (let number = 100; number >= 1; number--) {
    const cell = document.createElement("div");
    const rowFromBottom = Math.floor((number - 1) / 10);
    const offset = (number - 1) % 10;
    const column = rowFromBottom % 2 === 0 ? offset : 9 - offset;

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

      cell.classList.add(isLadder ? "ladder-space" : "snake-space");
      marker.className = `cell-special ${isLadder ? "ladder" : "snake"}`;
      marker.textContent = isLadder ? "🪜" : "🐍";
      marker.title = isLadder
        ? `Ladder to space ${ladders.get(number)}`
        : `Snake to space ${snakes.get(number)}`;

      cell.setAttribute("aria-label", `Space ${number}, ${marker.title}`);
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
  document.body.classList.toggle("face-player-two", currentPlayer === 1);

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
    const position = document.querySelector(`#position-${index}`);
    const status = document.querySelector(`#player-status-${index}`);
    const row = document.querySelector(`#player-row-${index}`);

    position.textContent = player.position === 0
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

  syncSoundButton();
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

  const roll = Math.floor(Math.random() * 6) + 1;
  const player = players[currentPlayer];

  dieFace.textContent = dieSymbols[roll - 1];
  playSound("roll");

  window.setTimeout(() => {
    if (player.position + roll > 100) {
      setMessage([`Rolled a ${roll}!`, "Need an exact roll for 100."]);
      playSound("move");
    } else {
      player.position += roll;
      const landed = player.position;

      setMessage([`Rolled a ${roll}!`, `Moved to space ${landed}.`]);
      playSound("move");

      if (ladders.has(landed)) {
        player.position = ladders.get(landed);
        setMessage(["Lucky climb! 🪜", `Up to space ${player.position}.`]);
        playSound("ladder");
      } else if (snakes.has(landed)) {
        player.position = snakes.get(landed);
        setMessage(["Oh, a snake! 🐍", `Slid to space ${player.position}.`]);
        playSound("snake");
      }

      if (player.position === 100) {
        gameOver = true;
        stats.wins[currentPlayer] += 1;
        saveStats();

        board.classList.add("winner-celebration");
        window.setTimeout(() => {
          board.classList.remove("winner-celebration");
        }, 2500);

        setMessage([`${player.name} wins! 🎉`, "Added to the Hall of Fame!"]);
        playSound("win");
      }
    }

    const extraTurn = roll === 6 && !gameOver;

    if (!gameOver && !extraTurn) {
      currentPlayer = (currentPlayer + 1) % players.length;
    }

    if (extraTurn) {
      setMessage(["Rolled a 6!", "You get another turn."]);
    }

    locked = false;
    render();
  }, 420);
}

function resetGame() {
  players.forEach((player) => {
    player.position = 0;
  });

  currentPlayer = 0;
  locked = false;
  gameOver = false;
  board.classList.remove("winner-celebration");
  dieFace.textContent = dieSymbols[0];
  setMessage(["Tap the dice", "to get rolling!"]);
  render();
}

soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem("up-and-down-sound", soundEnabled ? "on" : "off");
  syncSoundButton();

  if (soundEnabled) {
    playSound("move");
  }
});

createBoard();
render();

rollButtons.forEach((button) => {
  button.addEventListener("click", rollDice);
});

document.querySelector("#reset-top").addEventListener("click", resetGame);
document.querySelector("#reset-bottom").addEventListener("click", resetGame);
