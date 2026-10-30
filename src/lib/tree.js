// Helpers for walking the cards of a canvas.
//
// Every card belongs to one tree: `parent` and `children` are that tree.
// On top of that a card can borrow other cards' values through `links`
// ([{ id, variable }]), so one card can feed several equations. Together
// children and links are a card's inputs.

export const getSubtreeIds = (nodes, id) => {
    const ids = [id];
    nodes[id].children.forEach((childId) =>
        ids.push(...getSubtreeIds(nodes, childId))
    );
    return ids;
};

// Ids from `id` up to the root of its tree, starting with `id` itself.
export const getAncestorIds = (nodes, id) => {
    const ids = [];
    for (let node = nodes[id]; node; node = nodes[node.parent]) {
        ids.push(node.id);
    }
    return ids;
};

// The cards a card's equation can draw its variables from.
export const inputsOf = (nodes, node) => [
    ...node.children.map((id) => ({ id, variable: nodes[id].variable, owned: true })),
    ...(node.links || [])
        .filter((link) => nodes[link.id])
        .map((link) => ({ id: link.id, variable: link.variable, owned: false })),
];

// Every card `id` needs to be evaluated, `id` first, in breadth-first order.
export const dependencyIds = (nodes, id) => {
    const seen = new Set([id]);
    const order = [id];
    for (let i = 0; i < order.length; i++) {
        inputsOf(nodes, nodes[order[i]]).forEach((input) => {
            if (!seen.has(input.id)) {
                seen.add(input.id);
                order.push(input.id);
            }
        });
    }
    return order;
};

// Whether evaluating `fromId` needs `targetId` (or they're the same card).
export const dependsOn = (nodes, fromId, targetId) =>
    dependencyIds(nodes, fromId).includes(targetId);

// Cards that use `id` as a variable: its parent and any card linking to it.
export const consumersOf = (nodes, id) =>
    Object.values(nodes)
        .filter(
            (node) =>
                node.children.includes(id) ||
                (node.links || []).some((link) => link.id === id)
        )
        .map((node) => node.id);

export const treeOfRoot = (trees, rootId) =>
    trees.find((tree) => tree.rootId === rootId);

// What a card is called: its variable, or the tree's name for a root.
export const nodeLabel = (doc, id) => {
    const node = doc.nodes[id];
    if (!node) return "";
    if (node.parent !== null) return node.variable;
    const tree = treeOfRoot(doc.trees, id);
    return tree ? tree.name : "";
};
