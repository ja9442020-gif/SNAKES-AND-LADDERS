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

      marker.className = `cell-special ${isLadder ? "ladder" : "snake"}`;
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
  // Turn the screen toward the player whose turn is active.
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

  window.setTimeout(() => {
    if (player.position + roll > 100) {
      setMessage([`Rolled a ${roll}!`, "Need an exact roll for 100."]);
    } else {
      player.position += roll;
      const landed = player.position;
      setMessage([`Rolled a ${roll}!`, `Moved to space ${landed}.`]);

      if (ladders.has(landed)) {
        player.position = ladders.get(landed);
        setMessage(["Lucky climb!", `Up to space ${player.position}.`]);
      } else if (snakes.has(landed)) {
        player.position = snakes.get(landed);
        setMessage(["Oh, a snake!", `Slid to space ${player.position}.`]);
      }

      if (player.position === 100) {
        gameOver = true;
        setMessage([`${player.name} wins!`, "What a lovely game."]);
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
  dieFace.textContent = dieSymbols[0];
  setMessage(["Tap the dice", "to get rolling!"]);
  render();
}

createBoard();
render();

rollButtons.forEach((button) => {
  button.addEventListener("click", rollDice);
});

document.querySelector("#reset-top").addEventListener("click", resetGame);
document.querySelector("#reset-bottom").addEventListener("click", resetGame);
