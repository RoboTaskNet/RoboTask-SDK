// Placeholder hash and merkle utilities (replace with keccak/sha256 for production)
function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & 0xffffffff;
  }
  return hash >>> 0;
}
function toHex(n) { return '0x' + n.toString(16).padStart(8, '0'); }

export function hash(input) {
  const s = typeof input === 'string' ? input : JSON.stringify(input);
  return toHex(djb2(s));
}

export const Merkle = {
  leafHash(value) { return hash(value); },
  buildTree(leaves) {
    const level0 = leaves.map(v => Merkle.leafHash(v));
    const levels = [level0];
    let current = level0;
    while (current.length > 1) {
      const next = [];
      for (let i = 0; i < current.length; i += 2) {
        if (i + 1 < current.length) next.push(hash(current[i] + current[i + 1]));
        else next.push(current[i]);
      }
      levels.push(next);
      current = next;
    }
    return { levels, root: current[0] || null };
  },
  root(leaves) { return Merkle.buildTree(leaves).root; },
  proof(leaves, index) {
    const tree = Merkle.buildTree(leaves);
    const proof = [];
    let idx = index;
    for (let level = 0; level < tree.levels.length - 1; level++) {
      const currentLevel = tree.levels[level];
      const isRight = idx % 2 === 1;
      const pairIndex = isRight ? idx - 1 : idx + 1;
      const sibling = currentLevel[pairIndex];
      if (sibling) proof.push({ position: isRight ? 'left' : 'right', hash: sibling });
      idx = Math.floor(idx / 2);
    }
    return proof;
  }
};

