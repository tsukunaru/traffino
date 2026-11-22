import manifest from '../package.json' with { type: 'json' };
export const VERSION=manifest.version;
export const AD_COINS=25;
export const DIRS = ['north', 'east', 'south', 'west'];
export const TURNS = ['straight', 'left', 'right'];
export const BALANCE = {
  step: 1 / 60, capacity: 112, pedestrianCapacity: 48,
  gap: 1.1, stopMargin: 1.7, jamLength: 18, jamGrace: 9, hardJamGrace: 5,
  collisionSpeed: 0.85, collisionInset: 0.10, wreckTime: 7,
  dayDuration: 180, rushDuration: 150, rushDensity: .58, emergencyTimer: 24,
  eventWarning: 4, eventDuration: 16, eventInterval: 38,
  flowGain: 0.12, flowDecay: 0.014, flowMax: 5, timelyWait: 12,
  circuitBonus: 120,
  score: { car: 30, bus: 70, emergency: 160, pedestrian: 15, day: 200, event: 100 },
  reputationPerCar: 2, coinsPerCar: 1, completionCoins: 4,
  emergencyReputation: 10, emergencyPenalty: 80, collisionPenalty: 100,
};
export const INTERSECTIONS = [
  { id: 'garden', extent: 25, entry: 6, lane: 1.7, width: 6.8, unlock: 0, ground: 0xaac6ab },
  { id: 'harbor', extent: 27, entry: 6.7, lane: 1.9, width: 7.6, unlock: 420, ground: 0xa7c3c2 },
];
export const VEHICLES = {
  car: { length: 2.8, width: 1.35, speed: 7.2, accel: 3.8, brake: 7, weight: 45, rarity: 'common', color: 0xd97458 },
  taxi: { length: 2.9, width: 1.4, speed: 7.7, accel: 4, brake: 7.5, weight: 15, rarity: 'common', color: 0xf6c452 },
  truck: { length: 4.8, width: 1.6, speed: 5.3, accel: 2.1, brake: 5.5, weight: 9, rarity: 'common', color: 0x8faaa9 },
  bus: { length: 4.7, width: 1.6, speed: 5.8, accel: 2.4, brake: 6, weight: 10, rarity: 'common', color: 0xd6b696, bus: true, passengerImportance: 1.5, scheduleTolerance: 14 },
  van: { length: 3.5, width: 1.5, speed: 6.5, accel: 3, brake: 6.5, weight: 9, rarity: 'common', color: 0xe4dbc7, delivery: true },
  ambulance: { length: 3.4, width: 1.5, speed: 8, accel: 4.5, brake: 8, weight: 3, rarity: 'rare', color: 0xf9f1d9, emergencyPriority: 3 },
  firetruck: { length: 4.6, width: 1.65, speed: 6.7, accel: 2.8, brake: 7, weight: 2, rarity: 'rare', color: 0xcc6554, emergencyPriority: 3 },
  police: { length: 2.9, width: 1.4, speed: 8.5, accel: 5, brake: 8, weight: 3, rarity: 'rare', color: 0x698db8, emergencyPriority: 2 },
  pizza: { length: 2.5, width: 1.2, speed: 8, accel: 4.5, brake: 8, weight: 2, rarity: 'epic', color: 0xbd6c59, delivery: true },
  schoolbus: { length: 4.5, width: 1.6, speed: 5.5, accel: 2.2, brake: 6, weight: 2, rarity: 'epic', color: 0xe9b84a, bus: true, passengerImportance: 2, scheduleTolerance: 16 },
  garbage: { length: 4.6, width: 1.65, speed: 5, accel: 2, brake: 6, weight: 1, rarity: 'epic', color: 0x769573 },
  tourist: { length: 4.8, width: 1.65, speed: 6, accel: 2.3, brake: 6, weight: 1, rarity: 'legendary', color: 0x9384ad, bus: true, passengerImportance: 2, scheduleTolerance: 18 },
  reckless: { length: 2.8, width: 1.35, speed: 10, accel: 6, brake: 10, weight: 2, rarity: 'rare', color: 0xe88437, reckless: true },
};
export const STORY = [
  { duration: 60, density: .34, goal: 5, turns: false, tier: 0, medals: [200, 390], wait: [22, 13], flow: [1.3, 1.8] },
  { duration: 75, density: .43, goal: 14, turns: true, tier: 0, medals: [360, 580], wait: [22, 14], flow: [1.5, 2] },
  { duration: 80, density: .55, goal: 18, turns: true, tier: 0, medals: [460, 720], wait: [24, 15], flow: [1.6, 2.2] },
  { duration: 85, density: .46, goal: 14, objectives: [{stat:'buses',target:1}], turns: true, tier: 1, medals: [500, 800], wait: [24, 15], flow: [1.6, 2.2] },
  { duration: 90, density: .46, goal: 18, objectives: [{stat:'emergencyPassed',target:1}], turns: true, tier: 2, medals: [650, 950], wait: [25, 16], flow: [1.7, 2.3] },
  { duration: 95, density: .46, goal: 16, objectives: [{stat:'pedestrians',target:3}], turns: true, tier: 2, pedestrians: true, medals: [650, 1000], wait: [25, 16], flow: [1.8, 2.4] },
  { duration: 100, density: .53, goal: 18, objectives: [{stat:'eventsCompleted',target:1}], turns: true, tier: 3, pedestrians: true, events: true, medals: [850, 1350], wait: [26, 17], flow: [1.8, 2.5] },
  { seed: 1003, duration: 120, density: .55, goal: 24, objectives: [{stat:'emergencyPassed',target:1},{stat:'pedestrians',target:3},{stat:'eventsCompleted',target:1}], turns: true, tier: 3, pedestrians: true, events: true, medals: [1200, 1900], wait: [26, 17], flow: [2, 2.7] },
];
export const EVENTS = ['broken', 'works', 'turn', 'surge', 'wave', 'delivery'];
export const TRAINING = [
  { id: 'board', cost: 48 },
  { id: 'radio', cost: 96, requires: 'board' },
  { id: 'ledger', cost: 48 },
  { id: 'dividend', cost: 96, requires: 'ledger' },
  { id: 'survey', cost: 42 },
  { id: 'crew', cost: 88, requires: 'survey' },
];
export const SERVICE = { promotionTargets: [90, 160, 240], dutySeconds: 120, dutyGoal: 16, rushGoal: 24, medalCoins: 2, warningLead: 4, crewSeconds: 3, runnerWarning: 4, radioSeconds: 6, premium: 1, premiumFlow: 2 };
export const RANKS = [0, 150, 420, 900, 1700, 3000];
export const COSMETICS = [{ id: 'classic', cost: 0, color: 0x3a736a }, { id: 'coral', cost: 120, color: 0xce705b }, { id: 'indigo', cost: 240, color: 0x77789c }];
export const MISSIONS = [
  { id: 'cars', stat: 'passed', target: 200, coins: 100, rep: 80 },
  { id: 'flow', stat: 'maxFlow', target: 5, max: true, coins: 120, rep: 100 },
  { id: 'rescue', stat: 'emergencyPassed', target: 5, coins: 90, rep: 80 },
  { id: 'night', stat: 'nights', target: 1, coins: 80, rep: 70 },
  { id: 'rush', stat: 'rushHours', target: 2, coins: 100, rep: 90 },
  { id: 'buses', stat: 'buses', target: 15, coins: 90, rep: 80 },
  { id: 'clean', stat: 'cleanShifts', target: 1, coins: 70, rep: 60 },
];
