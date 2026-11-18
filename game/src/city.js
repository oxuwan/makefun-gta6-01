// The city of Porto Verde: a procedural grid of roads, blocks, buildings,
// parks and a harbour, generated once from a seed. Roads run on a regular
// lattice; each block holds buildings, a park, or a plaza. The module also
// answers the questions the simulation asks: is this point on a road, is
// it inside a building, and where is the nearest road point.

import { WORLD } from './config.js';
import { clamp, pick, range, rangeInt } from './random.js';

export const ROAD_LINES = []; // filled by createCity: road centreline coords

function roadLines() {
  const lines = [];
  const n = Math.floor(WORLD.size / WORLD.roadSpacing);
  for (let i = 0; i <= n; i += 1) lines.push(i * WORLD.roadSpacing);
  return lines;
}

export function createCity(rng) {
  const lines = roadLines();
  const blocks = [];   // {x, y, w, h, kind, buildings[], trees[]}
  const buildings = []; // {x, y, w, h, roof, wall, floors}
  const parks = [];
  const water = { x: WORLD.size - 300, y: 0, w: 300, h: WORLD.size }; // harbour strip, east edge

  for (let bx = 0; bx < lines.length - 1; bx += 1) {
    for (let by = 0; by < lines.length - 1; by += 1) {
      const x0 = lines[bx] + WORLD.roadWidth / 2 + WORLD.blockInset;
      const y0 = lines[by] + WORLD.roadWidth / 2 + WORLD.blockInset;
      const x1 = lines[bx + 1] - WORLD.roadWidth / 2 - WORLD.blockInset;
      const y1 = lines[by + 1] - WORLD.roadWidth / 2 - WORLD.blockInset;
      if (x1 <= x0 || y1 <= y0) continue;
      // The harbour strip swallows the easternmost column of blocks.
      if (x0 > water.x - 40) continue;
      const roll = rng();
      const block = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind: 'buildings', buildings: [], trees: [] };
      if (roll < 0.16) {
        block.kind = 'park';
        const treeCount = rangeInt(rng, 6, 12);
        for (let t = 0; t < treeCount; t += 1) {
          block.trees.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20), r: range(rng, 9, 15) });
        }
        parks.push(block);
      } else if (roll < 0.22) {
        block.kind = 'plaza';
        block.trees.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, r: 12 });
      } else {
        // One to four buildings per block, placed on a rough sub-grid.
        const cols = rangeInt(rng, 1, 2);
        const rows = rangeInt(rng, 1, 2);
        for (let cx = 0; cx < cols; cx += 1) {
          for (let cy = 0; cy < rows; cy += 1) {
            if (rng() < 0.18) continue;
            const bw = (block.w / cols) * range(rng, 0.55, 0.85);
            const bh = (block.h / rows) * range(rng, 0.55, 0.85);
            const bx0 = x0 + (cx + 0.5) * (block.w / cols) - bw / 2;
            const by0 = y0 + (cy + 0.5) * (block.h / rows) - bh / 2;
            const b = {
              x: bx0, y: by0, w: bw, h: bh,
              roof: pick(rng, ['#7a5a44', '#5f6b7a', '#8a6f4d', '#6b4a5a', '#4d6b5a', '#74604a']),
              wall: pick(rng, ['#a9805e', '#7d8ba0', '#b08d5f', '#8a6274', '#63907a', '#93795c']),
              floors: rangeInt(rng, 1, 4),
            };
            block.buildings.push(b);
            buildings.push(b);
          }
        }
      }
      blocks.push(block);
    }
  }

  function onRoad(x, y) {
    for (const line of lines) {
      if (Math.abs(x - line) < WORLD.roadWidth / 2) return true;
      if (Math.abs(y - line) < WORLD.roadWidth / 2) return true;
    }
    return false;
  }

  function inWater(x, y) {
    return x > water.x && y >= water.y && y <= water.y + water.h;
  }

  function buildingAt(x, y) {
    for (const b of buildings) {
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b;
    }
    return null;
  }

  /** The block containing a point, or null on a road / in the harbour. */
  function blockAt(x, y) {
    for (const block of blocks) {
      if (x >= block.x && x <= block.x + block.w && y >= block.y && y <= block.y + block.h) return block;
    }
    return null;
  }

  /** Snap a point to the nearest road centreline (used for spawns and markers). */
  function nearestRoadPoint(x, y) {
    let bestX = lines[0];
    let bestY = lines[0];
    let bestDx = Infinity;
    let bestDy = Infinity;
    for (const line of lines) {
      const dx = Math.abs(x - line);
      const dy = Math.abs(y - line);
      if (dx < bestDx) { bestDx = dx; bestX = line; }
      if (dy < bestDy) { bestDy = dy; bestY = line; }
    }
    // Prefer the closer axis; return a point on that road.
    return bestDx <= bestDy ? { x: bestX, y: clamp(y, 0, WORLD.size) } : { x: clamp(x, 0, WORLD.size), y: bestY };
  }

  /** A random point on a road, for spawning cars and pedestrians. */
  function randomRoadPoint() {
    const horizontal = rng() < 0.5;
    const line = pick(rng, lines);
    const along = range(rng, 60, WORLD.size - 60);
    return horizontal ? { x: along, y: line } : { x: line, y: along };
  }

  /** A random walkable point (road or sidewalk), never inside a building or water. */
  function randomWalkPoint() {
    for (let tries = 0; tries < 40; tries += 1) {
      const x = range(rng, 80, WORLD.size - 380);
      const y = range(rng, 80, WORLD.size - 80);
      if (!buildingAt(x, y) && !inWater(x, y)) return { x, y };
    }
    return { x: WORLD.roadSpacing, y: WORLD.roadSpacing };
  }

  return {
    lines, blocks, buildings, parks, water,
    // The marina at the harbour's south corner: mission 5's getaway boat.
    marina: { x: WORLD.size - 200, y: WORLD.size - 200 },
    onRoad, inWater, buildingAt, blockAt, nearestRoadPoint, randomRoadPoint, randomWalkPoint,
  };
}
