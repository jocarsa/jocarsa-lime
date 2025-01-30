/**
 * server.js
 *
 * Plain Node.js HTTP server (no Express) that:
 *   ...
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const CELLS_FILE = "cells.json";
const NPCS_FILE = "npcs.json";

// In-memory data
let paintedCells = [];
let npcs = [];

/* --------------------- Load Data from Disk --------------------- */
function loadPaintedCells() {
  try {
    const data = fs.readFileSync(CELLS_FILE, "utf8");
    paintedCells = JSON.parse(data);
    console.log("[Load] Painted cells loaded from", CELLS_FILE);
  } catch (err) {
    console.log("[Load] No existing cells.json found, starting empty.");
    paintedCells = [];
  }
}

function loadNPCs() {
  try {
    const data = fs.readFileSync(NPCS_FILE, "utf8");
    npcs = JSON.parse(data);
    console.log("[Load] NPCs loaded from", NPCS_FILE);
  } catch (err) {
    console.log("[Load] No existing npcs.json found, starting empty.");
    npcs = [];
  }
}

loadPaintedCells();
loadNPCs();

/* --------------------- Save Data to Disk --------------------- */
function savePaintedCells() {
  fs.writeFile(CELLS_FILE, JSON.stringify(paintedCells, null, 2), err => {
    if (err) console.error("[Save] Error saving paintedCells:", err);
  });
}

function saveNPCs() {
  fs.writeFile(NPCS_FILE, JSON.stringify(npcs, null, 2), err => {
    if (err) console.error("[Save] Error saving npcs:", err);
  });
}

/* --------------------- Utilities --------------------- */

function isColored(color = "") {
  const c = color.trim().toLowerCase();
  return c !== "#fff" && c !== "#ffffff" && c !== "white";
}

function getAllPaintedCells() {
  return paintedCells.filter(cell => isColored(cell.color));
}

function getRandomPaintedCell() {
  const valid = getAllPaintedCells();
  if (valid.length === 0) return null;
  const randIndex = Math.floor(Math.random() * valid.length);
  return valid[randIndex];
}

function findCell(x, y) {
  return paintedCells.find(c => c.x === x && c.y === y);
}

function findColoredNeighbors(x, y) {
  const offsets = [
    { dx:  1, dy:  0 },
    { dx: -1, dy:  0 },
    { dx:  0, dy:  1 },
    { dx:  0, dy: -1 }
  ];
  const neighbors = [];
  offsets.forEach(({ dx, dy }) => {
    const nx = x + dx;
    const ny = y + dy;
    const cell = findCell(nx, ny);
    if (cell && isColored(cell.color)) {
      neighbors.push({ x: nx, y: ny });
    }
  });
  return neighbors;
}

/* --------------------- NPC Timers --------------------- */
setInterval(() => {
  const spawnCell = getRandomPaintedCell();
  if (spawnCell) {
    const newNPC = {
      id: Date.now() + "_" + Math.floor(Math.random() * 1000),
      x: spawnCell.x,
      y: spawnCell.y
    };
    npcs.push(newNPC);
    console.log("[Spawn NPC]", newNPC);
    saveNPCs();
  }
}, 10000);

setInterval(() => {
  let moved = false;
  npcs.forEach(npc => {
    const neighbors = findColoredNeighbors(npc.x, npc.y);
    if (neighbors.length > 0) {
      const randIndex = Math.floor(Math.random() * neighbors.length);
      npc.x = neighbors[randIndex].x;
      npc.y = neighbors[randIndex].y;
      moved = true;
    }
  });
  if (moved) {
    saveNPCs();
  }
}, 1000);

/* --------------------- Create HTTP Server --------------------- */

const PORT = 3000;
const server = http.createServer((req, res) => {
  // Minimal CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }
	if (req.method === "GET" && req.url === "/npc.png") {
    const filePath = path.join(__dirname, "npc.png");
    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error("Error reading npc.png:", err);
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("404 Not Found");
      }
      res.writeHead(200, { "Content-Type": "image/png" });
      return res.end(data);
    });
    return; // Important: exit the handler after serving the image
  }
  // ========== Serve the main index.html on GET / ==========
  if (req.method === "GET" && req.url === "/") {
    fs.readFile("index.html", (err, fileData) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        return res.end("Error: index.html not found or unreadable.");
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(fileData);
    });

  } else if (req.method === "GET" && req.url === "/celdas") {
    // Return all painted cells
    const json = JSON.stringify(paintedCells);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(json);

  } else if (req.method === "GET" && req.url === "/npcs") {
    // Return all NPCs
    const json = JSON.stringify(npcs);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(json);

  } else if (req.method === "POST" && req.url === "/save-cell") {
    // Save or update a painted cell
    let bodyData = "";
    req.on("data", chunk => { bodyData += chunk; });
    req.on("end", () => {
      try {
        const { x, y, color } = JSON.parse(bodyData);
        if (typeof x !== "number" || typeof y !== "number" || !color) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Invalid data" }));
        }
        // find or add
        const idx = paintedCells.findIndex(c => c.x === x && c.y === y);
        if (idx >= 0) {
          paintedCells[idx].color = color;
        } else {
          paintedCells.push({ x, y, color });
        }
        console.log(`[Save Cell] (${x},${y}) => ${color}`);
        savePaintedCells();

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ status: "ok" }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Bad JSON format" }));
      }
    });

  } else {
    // 404 Not Found
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});

