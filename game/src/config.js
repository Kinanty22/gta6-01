// SOLMARA — config: every tunable number for the open-world crime game.
// One clear job: constants only, no logic, so balance tweaks live in one place.
export const WORLD = { width: 3600, height: 2600, roadWidth: 116, beachY: 2320, waterY: 2480 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmara-save-v1';
export const BEST_KEY = 'solmara-best-v1';

// Vertical and horizontal road centre lines across the city grid.
export const ROADS_X = [300, 800, 1300, 1800, 2300, 2800, 3300];
export const ROADS_Y = [300, 760, 1220, 1680, 2140];

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  runSpeed: 330,
  health: 100,
  punchRange: 46,
  punchDamage: 34,
  punchCooldown: 0.38,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 520,
  reverseAccel: 300,
  maxSpeed: 560,
  maxReverse: 190,
  brake: 760,
  drag: 0.55,
  grip: 3.4,
  health: 100,
};

export const TRAFFIC_COUNT = 16;
export const PED_COUNT = 42;
export const COP_CAR_MAX = 4;

export const WANTED = {
  // heat points; stars are thresholds of heat.
  starAt: [0, 25, 55, 95, 150, 220],
  stealCar: 26,
  hitPed: 30,
  punchCop: 45,
  punchPed: 12,
  crashCopCar: 20,
  decayPerSec: 2.2,
  hideDecayPerSec: 9,
  bustHoldSec: 2.2,
};

export const MISSIONS = [
  {
    id: 'hot-wheels',
    title: 'MISSION 1 — HOT WHEELS',
    brief: 'Mara needs wheels. Steal any car and bring it to the marina marker.',
    reward: 300,
  },
  {
    id: 'the-package',
    title: 'MISSION 2 — THE PACKAGE',
    brief: 'Grab the package at the docks, deliver it downtown before time runs out.',
    reward: 600,
    timeLimit: 90,
  },
  {
    id: 'heat-wave',
    title: 'MISSION 3 — HEAT WAVE',
    brief: 'Three stars on your tail. Reach the green safehouse and lose them.',
    reward: 900,
  },
];

export const STASH_COUNT = 10;
export const STASH_VALUE = 150;
