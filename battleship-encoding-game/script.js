const GRID_SIZE = 10;
const DIRECTIONS = ["N", "E", "S", "W"];
const DIRECTION_DELTA = {
  N: { dr: -1, dc: 0 },
  E: { dr: 0, dc: 1 },
  S: { dr: 1, dc: 0 },
  W: { dr: 0, dc: -1 },
};
const DIRECTION_NAME = { N: "North", E: "East", S: "South", W: "West" };
const COL_LETTERS = "ABCDEFGHIJ";
const FACING_ROTATION = { N: 0, E: 90, S: 180, W: 270 };

let state = null;
let bits = [0, 0, 0, 0];
let gridCells = [];

function randInt(max) {
  return Math.floor(Math.random() * max);
}

function cellLabel(row, col) {
  return `${COL_LETTERS[col]}${row + 1}`;
}

function newGame() {
  const agentRow = randInt(GRID_SIZE);
  const agentCol = randInt(GRID_SIZE);
  let boatRow, boatCol;
  do {
    boatRow = randInt(GRID_SIZE);
    boatCol = randInt(GRID_SIZE);
  } while (boatRow === agentRow && boatCol === agentCol);

  state = {
    agent: { row: agentRow, col: agentCol, facing: DIRECTIONS[randInt(4)] },
    boat: { row: boatRow, col: boatCol },
    commandCount: 0,
    gameOver: false,
  };

  bits = [0, 0, 0, 0];
  renderBits();
  renderStats();
  clearLog();
  clearGridMarks();
  renderAgent();

  const missionEl = document.getElementById("missionInfo");
  missionEl.textContent =
    `Agent deployed at ${cellLabel(agentRow, agentCol)}, facing ${DIRECTION_NAME[state.agent.facing]}. ` +
    `The map is ${GRID_SIZE}x${GRID_SIZE} (A-${COL_LETTERS[GRID_SIZE - 1]}, 1-${GRID_SIZE}). Find the enemy boat!`;

  addLogEntry(`Mission start: agent at ${cellLabel(agentRow, agentCol)} facing ${DIRECTION_NAME[state.agent.facing]}.`, "sent");
}

function turnRight(facing) {
  return DIRECTIONS[(DIRECTIONS.indexOf(facing) + 1) % 4];
}

function turnLeft(facing) {
  return DIRECTIONS[(DIRECTIONS.indexOf(facing) + 3) % 4];
}

function inBounds(row, col) {
  return row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE;
}

function sendNibble() {
  if (state.gameOver) return;

  const [bMove, bRight, bLeft, bPing] = bits;
  const nibbleStr = bits.join("");

  if (bRight === 1 && bLeft === 1) {
    state.commandCount++;
    renderStats();
    addLogEntry(`Sent ${nibbleStr} → Rejected: can't turn both directions at once.`, "error");
    return;
  }

  const agent = state.agent;
  let newRow = agent.row;
  let newCol = agent.col;

  if (bMove === 1) {
    const { dr, dc } = DIRECTION_DELTA[agent.facing];
    newRow = agent.row + dr;
    newCol = agent.col + dc;

    if (!inBounds(newRow, newCol)) {
      state.commandCount++;
      renderStats();
      addLogEntry(`Sent ${nibbleStr} → Rejected: that move would go off the edge of the map.`, "error");
      return;
    }
  }

  state.commandCount++;
  agent.row = newRow;
  agent.col = newCol;
  renderAgent();

  addLogEntry(`Sent ${nibbleStr}`, "sent");

  if (agent.row === state.boat.row && agent.col === state.boat.col) {
    state.gameOver = true;
    addLogEntry(`Contact! The enemy boat is in the agent's square. Found in ${state.commandCount} commands!`, "win");
    markBoatFound();
    renderStats();
    return;
  }

  if (bRight === 1) agent.facing = turnRight(agent.facing);
  else if (bLeft === 1) agent.facing = turnLeft(agent.facing);
  renderAgent();

  if (bPing === 1) {
    const response = sonarResponse();
    addLogEntry(`Response: ${response}`, "response");
  }

  renderStats();
}

function sonarResponse() {
  const agent = state.agent;
  const boat = state.boat;

  if (agent.row === boat.row && agent.col === boat.col) return "1000";

  const { dr, dc } = DIRECTION_DELTA[agent.facing];
  const frontRow = agent.row + dr;
  const frontCol = agent.col + dc;
  if (frontRow === boat.row && frontCol === boat.col) return "0010";

  const rowDiff = Math.abs(agent.row - boat.row);
  const colDiff = Math.abs(agent.col - boat.col);
  if (rowDiff <= 1 && colDiff <= 1) return "0001";

  return "0000";
}

function renderBits() {
  document.querySelectorAll(".bit-btn").forEach((btn) => {
    const idx = Number(btn.dataset.index);
    btn.textContent = bits[idx];
    btn.classList.toggle("on", bits[idx] === 1);
  });
  document.getElementById("nibblePreview").textContent = bits.join("");
}

function renderStats() {
  document.getElementById("cmdCount").textContent = state.commandCount;
}

function clearLog() {
  document.getElementById("log").innerHTML = "";
}

function addLogEntry(text, cls) {
  const log = document.getElementById("log");
  const entry = document.createElement("div");
  entry.className = `log-entry ${cls}`;
  entry.textContent = text;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

function buildGrid() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  gridCells = [];

  const corner = document.createElement("div");
  corner.className = "grid-cell header";
  grid.appendChild(corner);

  for (let c = 0; c < GRID_SIZE; c++) {
    const header = document.createElement("div");
    header.className = "grid-cell header";
    header.textContent = COL_LETTERS[c];
    grid.appendChild(header);
  }

  for (let r = 0; r < GRID_SIZE; r++) {
    const rowHeader = document.createElement("div");
    rowHeader.className = "grid-cell header";
    rowHeader.textContent = r + 1;
    grid.appendChild(rowHeader);

    const rowCells = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      cell.dataset.mark = "0";
      cell.addEventListener("click", () => cycleMark(cell));
      grid.appendChild(cell);
      rowCells.push(cell);
    }
    gridCells.push(rowCells);
  }
}

function renderAgent() {
  gridCells.forEach((row) =>
    row.forEach((cell) => {
      cell.classList.remove("agent");
      const arrow = cell.querySelector(".agent-arrow");
      if (arrow) arrow.remove();
    })
  );

  const { row, col, facing } = state.agent;
  const cell = gridCells[row][col];
  cell.classList.add("agent");
  const arrow = document.createElement("span");
  arrow.className = "agent-arrow";
  arrow.textContent = "▲";
  arrow.style.transform = `rotate(${FACING_ROTATION[facing]}deg)`;
  cell.appendChild(arrow);
}

function markBoatFound() {
  const cell = gridCells[state.boat.row][state.boat.col];
  cell.classList.add("boat-found");
}

function cycleMark(cell) {
  const current = cell.dataset.mark;
  const next = current === "0" ? "1" : current === "1" ? "2" : "0";
  cell.dataset.mark = next;
  cell.classList.remove("mark-dot", "mark-x");
  if (next === "1") cell.classList.add("mark-dot");
  if (next === "2") cell.classList.add("mark-x");
}

function clearGridMarks() {
  document.querySelectorAll(".grid-cell[data-mark]").forEach((cell) => {
    cell.dataset.mark = "0";
    cell.classList.remove("mark-dot", "mark-x");
  });
}

document.querySelectorAll(".bit-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const idx = Number(btn.dataset.index);
    bits[idx] = bits[idx] === 0 ? 1 : 0;
    renderBits();
  });
});

document.getElementById("sendBtn").addEventListener("click", sendNibble);
document.getElementById("newGameBtn").addEventListener("click", newGame);

buildGrid();
newGame();
