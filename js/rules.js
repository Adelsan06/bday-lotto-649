// =========================================================
// rules.js
// - Game rule helpers (numbers, matching, payout split)
// =========================================================

export function normalize6(arr){
  const nums = arr.map(n => Math.floor(Number(n))).filter(n => Number.isInteger(n) && n >= 1 && n <= 49);
  const set = new Set(nums);
  if (set.size !== 6) return null;
  return [...set].sort((a,b)=>a-b);
}

export function computeMatch(picks, winning){
  const winSet = new Set(winning || []);
  const matched = (picks || []).filter(n => winSet.has(n));
  return { matched, matchCount: matched.length };
}

// payout split: 85% prize, 15% house
export function splitPool(totalPool){
  const prize = totalPool * 0.85;
  const house = totalPool * 0.15;
  return { prize, house };
}
