// Dozwolone przejścia statusów zamówienia
// 1: PENDING (NIEZATWIERDZONE), 2: CONFIRMED (ZATWIERDZONE), 3: CANCELED (ANULOWANE), 4: FULFILLED (ZREALIZOWANE)
const transitions = new Map([
  [1, new Set([2, 3])], // PENDING -> CONFIRMED | CANCELED
  [2, new Set([3, 4])], // CONFIRMED -> CANCELED | FULFILLED
  [3, new Set([])],     // CANCELED -> (none)
  [4, new Set([])],     // FULFILLED -> (none)
]);

// Sprawdza, czy zmiana statusu jest dozwolona
function canTransition(fromId, toId) {
  const allowed = transitions.get(fromId) || new Set();
  return allowed.has(toId);
}

module.exports = { transitions, canTransition };
