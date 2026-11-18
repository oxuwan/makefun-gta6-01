// Porto Verde — every tuning number and colour in one place.
// The world is a fixed-size city (world units); the renderer scales the
// camera view to the window, so no rule below depends on screen size.

export const STEP = 1 / 60;

export const WORLD = {
  size: 3840,          // city is size x size world units
  roadSpacing: 480,    // distance between road centrelines
  roadWidth: 96,
  blockInset: 24,      // sidewalk margin inside each block
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  // Slightly faster sprint so on-foot escapes from 1-star heat feel fair.
  runSpeed: 340,
  punchRange: 36,
  punchDamage: 25,
  punchCooldown: 0.45,
  shootCooldown: 0.28,
  bulletSpeed: 760,
  maxHealth: 100,
};

export const CAR = {
  length: 54,
  width: 26,
  // Snappier launch and a higher top speed: chases at 3+ stars outran the
  // player's car too easily, so the hero cars get a little more legs.
  accel: 460,
  brake: 720,
  reverseAccel: 260,
  maxSpeed: 580,
  maxReverse: 180,
  turnRate: 2.6,       // radians per second at full lock, scaled by speed
  grip: 3.2,
  handbrakeTurn: 4.2,
};

export const TRAFFIC = {
  // A busier road makes the city read alive in screenshots and gives the
  // player more cars worth stealing; still cheap to simulate.
  count: 30,
  speed: 150,
  speedJitter: 45,
};

export const PEDS = {
  // More foot traffic on the sidewalks for the same reason.
  count: 48,
  walkSpeed: 55,
};

export const POLICE = {
  maxSpeed: 600,
  accel: 480,
  ramDamage: 6,
  ramCooldown: 1.2,
  // wanted stars -> how many police cars hunt at once
  unitsForStars: [0, 2, 3, 4, 5, 6],
  // seconds with no police nearby before wanted starts to fall
  // (12 s: long enough to hide, short enough that losing the heat feels earned)
  evadeSeconds: 12,
};

export const WANTED = {
  max: 5,
  decayPerSecond: 0.06,
  stealCar: 1,
  punchPed: 1,
  shoot: 1,
  killPed: 2,
  ramPolice: 1,
};

export const MISSIONS = {
  reward: [400, 650, 900, 1200, 2000],
};

export const SAVE_KEY = 'porto-verde.save.v1';
export const BEST_KEY = 'porto-verde.best';

export const PALETTE = {
  grass: '#5d8a4a',
  park: '#4e7d3e',
  water: '#2e6f8e',
  sand: '#c9b078',
  road: '#33373f',
  roadEdge: '#26292f',
  lane: '#d8c95a',
  sidewalk: '#8f8a7c',
  buildingRoof: ['#7a5a44', '#5f6b7a', '#8a6f4d', '#6b4a5a', '#4d6b5a', '#74604a'],
  buildingWall: ['#a9805e', '#7d8ba0', '#b08d5f', '#8a6274', '#63907a', '#93795c'],
  text: '#f2ede2',
  muted: '#b9b2a0',
  panel: 'rgba(12, 16, 24, 0.78)',
  accent: '#ffb02e',
  danger: '#e5484d',
  police: '#2f6fd0',
  minimapBg: 'rgba(10, 14, 20, 0.82)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
