// Solmara — Streets of Gold: every number that tunes the city, the cars and the law.
// One place for the constants so the simulation, the renderer and the screenshots agree.
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmara-save-v1';

export const WORLD = { w: 3600, h: 2600 };

// Road centrelines. Avenues run north-south, streets east-west; every road is ROAD_W wide.
export const AVENUES = [300, 900, 1500, 2100, 2700, 3300];
export const STREETS = [250, 700, 1150, 1600, 2050];
export const ROAD_W = 96;

// The sea eats the south edge; the beach is the strip just above it.
export const BEACH_Y = 2300;
export const SEA_Y = 2380;

// The park block, between avenue 900 and avenue 1500, streets 700 and 1150.
export const PARK = { x: 972, y: 772, w: 456, h: 306 };
export const POND = { x: 1200, y: 925, rx: 130, ry: 78 };

// Named places the missions and the respawns use.
export const PLACES = {
  start: { x: 1780, y: 1420 },
  policeHq: { x: 1830, y: 420 },
  hospital: { x: 2430, y: 1330 },
  marina: { x: 3150, y: 1850 },
  docks: { x: 3330, y: 1900 },
  tower: { x: 1950, y: 450 },
  safehouse: { x: 1200, y: 1900 },
};

// Five districts, each a rectangle with its own ground tint and name.
export const DISTRICTS = [
  { name: 'Old Town', x: 0, y: 250, w: 900, h: 2050, ground: '#c9b18c' },
  { name: 'Downtown', x: 1500, y: 250, w: 1200, h: 900, ground: '#bfae8e' },
  { name: 'Marina', x: 2700, y: 1150, w: 900, h: 1150, ground: '#b7ad8f' },
  { name: 'Suburbs', x: 900, y: 1600, w: 1800, h: 700, ground: '#c2b48f' },
  { name: 'Palm Beach', x: 2700, y: 2050, w: 900, h: 330, ground: '#d8c49a' },
];

// On foot.
export const WALK_SPEED = 175;
export const RUN_SPEED = 268;
export const PLAYER_RADIUS = 13;
export const PLAYER_HEALTH = 100;
export const PUNCH_RANGE = 34;
export const PUNCH_DAMAGE = 34;
export const PUNCH_COOLDOWN = 0.45;

// Cars.
export const CAR_LENGTH = 48;
export const CAR_WIDTH = 24;
export const CAR_ACCEL = 430;
export const CAR_BRAKE = 620;
export const CAR_MAX_SPEED = 565;
export const CAR_MAX_REVERSE = 210;
export const CAR_TURN = 2.6;
export const CAR_GRIP = 5.2;
export const CAR_HEALTH = 100;

// The law: heat runs 0..500, a star per 100.
export const HEAT_MAX = 500;
export const HEAT_PER_STAR = 100;
export const HEAT_STEAL = 60;
export const HEAT_HIT_PED = 45;
export const HEAT_PUNCH_COP = 90;
export const HEAT_RAM_COP = 70;
export const HEAT_DECAY = 5;
export const HEAT_DECAY_SAFEHOUSE = 16;
export const BUST_FINE = 150;
export const WASTED_FEE = 200;
export const MAX_COP_CARS = 5;
export const MAX_FOOT_COPS = 2;

// Missions for Mara Voss, the fixer.
export const MISSIONS = [
  {
    name: 'Hot Wheels',
    brief: 'Steal a car and bring it to the Marina.',
    reward: 300,
    target: PLACES.marina,
    targetName: 'MARINA',
  },
  {
    name: 'The Package',
    brief: 'Timed delivery: docks to the Solmara Tower. 100 seconds.',
    reward: 600,
    target: PLACES.tower,
    targetName: 'SOLMARA TOWER',
    timeLimit: 100,
    startAt: PLACES.docks,
  },
  {
    name: 'Heat Wave',
    brief: 'Lose a 3-star wanted level at the safehouse.',
    reward: 900,
    target: PLACES.safehouse,
    targetName: 'SAFEHOUSE',
    wantedOnStart: 300,
  },
];

export const STASH_COUNT = 10;
export const STASH_REWARD = 150;
export const TRAFFIC_COUNT = 16;
export const PED_COUNT = 42;

// Sun-soaked palette: warm asphalt, terracotta roofs, turquoise sea.
export const COLORS = {
  road: '#4a4a52',
  roadEdge: '#33333a',
  dash: '#e8d44d',
  sidewalk: '#b9ac93',
  sea: '#2f8fae',
  seaDeep: '#1f6f8e',
  beach: '#e6d199',
  grass: '#7fae5a',
  grassDark: '#6b9c4a',
  pond: '#5fb2d4',
  buildingRoof: ['#c96f4a', '#b45a3c', '#d08a4e', '#8a6f8d', '#7d8aa0', '#a8815a', '#96504a'],
  buildingEdge: '#5c4632',
  tree: '#4d8a3f',
  treeDark: '#3c7031',
  player: '#ff5d8f',
  playerRing: '#ffffff',
  copCar: '#20242e',
  copLightR: '#ff3b30',
  copLightB: '#2f7bff',
  taxi: '#f5c518',
  gold: '#ffd94a',
  hudBg: 'rgba(12, 14, 20, 0.72)',
  hudText: '#ffffff',
  hudDim: '#cfd3dc',
};
