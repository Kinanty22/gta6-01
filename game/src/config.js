// SOLMARA — Streets of Gold: every tuning number and colour in one place.
// The city is a fixed 3600x2600 world; the renderer follows the player with a
// camera, so no rule below depends on the screen size.

export const WORLD = { width: 3600, height: 2600 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The view the renderer paints (1280x800 screenshots, and the live game). */
export const VIEW = { width: 1280, height: 800 };

export const PLAYER = {
  radius: 14,
  walkSpeed: 220,
  runSpeed: 340,
  punchRange: 46,
  punchDamage: 25,
  punchCooldown: 0.4,
  maxHealth: 100,
};

export const CAR = {
  accel: 520,
  brake: 700,
  reverseMax: 220,
  maxSpeed: 560,
  steer: 2.6,
  grip: 3.2,
  radius: 20,
  maxHealth: 100,
  smokeBelow: 40,
};

export const PED = { radius: 11, minSpeed: 38, maxSpeed: 72 };

export const TRAFFIC = { count: 16, minSpeed: 120, maxSpeed: 190, radius: 18 };
export const PARKED = { count: 8 };
export const TAXI = { count: 2 };
export const PED_COUNT = 42;
export const COP_CAR_MAX = 5;

/** Heat points at which each wanted star appears (index = stars - 1). */
export const STAR_HEAT = [1, 40, 80, 120, 180];
export const HEAT_MAX = 300;
export const HEAT_DECAY = 3;
export const HEAT = {
  stealCar: 40,
  hitPed: 25,
  punchCop: 50,
  ramCopCar: 30,
  killPed: 60,
};

export const FINES = { busted: 100, wasted: 100 };
export const STASH_VALUE = 150;

export const MISSIONS = [
  {
    id: 'hot-wheels',
    name: 'Hot Wheels',
    giver: 'Mara Voss',
    brief: 'Steal a car and bring it to the Marina.',
    reward: 300,
    target: { x: 2900, y: 500, label: 'MARINA' },
  },
  {
    id: 'the-package',
    name: 'The Package',
    giver: 'Mara Voss',
    brief: 'Timed delivery: docks to Solmara Tower. Do not be late.',
    reward: 600,
    start: { x: 3100, y: 420, label: 'DOCKS' },
    target: { x: 1700, y: 1000, label: 'SOLMARA TOWER' },
    timeLimit: 90,
  },
  {
    id: 'heat-wave',
    name: 'Heat Wave',
    giver: 'Mara Voss',
    brief: 'Get a 3-star wanted level, then lose the cops at the safehouse.',
    reward: 900,
    target: { x: 2700, y: 2050, label: 'SAFEHOUSE' },
    needStars: 3,
  },
];

export const PLACES = {
  policeHQ: { x: 1500, y: 1000, label: 'POLICE HQ' },
  hospital: { x: 1900, y: 1750, label: 'HOSPITAL' },
  tower: { x: 1700, y: 1000, label: 'SOLMARA TOWER' },
  marina: { x: 2900, y: 500, label: 'MARINA' },
  docks: { x: 3100, y: 420, label: 'DOCKS' },
  safehouse: { x: 2700, y: 2050, label: 'SAFEHOUSE' },
  park: { x: 800, y: 1700, label: 'PALM PARK' },
  spawn: { x: 1500, y: 1250 },
};

export const DISTRICTS = [
  { name: 'Downtown', x0: 1100, y0: 650, x1: 2300, y1: 1350, tint: '#3a4152' },
  { name: 'Old Town', x0: 300, y0: 300, x1: 1100, y1: 1000, tint: '#4a3f35' },
  { name: 'Marina', x0: 2300, y0: 300, x1: 3300, y1: 1000, tint: '#2f4256' },
  { name: 'Suburbs', x0: 300, y0: 1350, x1: 1500, y1: 2350, tint: '#3d4a35' },
  { name: 'Palm Beach', x0: 2300, y0: 1350, x1: 3600, y1: 2600, tint: '#54452f' },
];

/** Vertical avenues and horizontal streets (centre lines); roads are 64 wide. */
export const ROADS_X = [300, 700, 1100, 1500, 1900, 2300, 2700, 3100];
export const ROADS_Y = [300, 650, 1000, 1350, 1700, 2050, 2350];
export const ROAD_W = 64;

/** The sea starts here (east edge); the sand runs just west of it. Water is solid. */
export const SEA_X = 3450;
export const BEACH_X = 3300;

export const PALETTE = {
  grass: '#4d7a3a',
  grassDark: '#436e33',
  road: '#33373f',
  roadLine: '#c9a227',
  sidewalk: '#6b6f75',
  building: '#7d7468',
  buildingRoof: '#5d564c',
  buildingDowntown: '#8a7f8a',
  water: '#2b6cb0',
  sand: '#d9c27a',
  park: '#3f7a34',
  pond: '#3a7ca8',
  tree: '#2f6b2a',
  treeDark: '#265824',
  player: '#ff5fa2',
  playerRing: '#ffffff',
  car: '#e8b73a',
  taxi: '#f2c94c',
  police: '#3a6fd8',
  ped: '#cfd6dd',
  cop: '#2f5fd0',
  stash: '#39d353',
  marker: '#39d353',
  gold: '#f2c94c',
  red: '#e5534b',
  panel: 'rgba(12, 16, 24, 0.82)',
  text: '#eef1f5',
  muted: '#9aa3b0',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save is kept between visits (this browser only). */
export const SAVE_KEY = 'solmara.save.v1';
