const transitions = new Map([
  [1, new Set([2, 3])],
  [2, new Set([3, 4])],
  [3, new Set([])],
  [4, new Set([])],
]);

function canTransition(fromId, toId) {
  const allowed = transitions.get(fromId) || new Set();
  return allowed.has(toId);
}

module.exports = { transitions, canTransition };
