import React from "react";
import uuid from "react-uuid";

const defaultTree = [
    { id: uuid(), value: "root", parent: null, children: [], result: 0 },
];

export const useTree = () => {
    const [tree, setTree] = React.useState(defaultTree);
    const [tree1D, setTree1D] = React.useState(defaultTree);

    React.useEffect(() => {
        const newTree = [...tree];
        setTree1D(treeToArr(newTree));
    }, [tree]);

    const addNode = (toParent, node, newTree) => {
        const newNode = {
            value: node,
            id: uuid(),
            parent: toParent,
            children: [],
            result: 0,
        };
        const parent = findNode(toParent, newTree);
        console.log(`parent: ${parent}`);
        parent.children.push(newNode);
        setTree(newTree);
    };

    const addNodeStateful = (toParent, node) => {
        const newTree = [...tree];
        const newNode = {
            value: node,
            id: uuid(),
            parent: toParent,
            children: [],
            result: 0,
        };
        const parent = findNode(toParent, newTree);
        console.log(`parent: ${parent}`);
        parent.children.push(newNode);
        setTree(newTree);
    };

    const resolveChildren = (id) => {
        const newTree = [...tree];
        const node = findNode(id, newTree);
        let vars = [];
        node.children.forEach((child) => {
            vars.push([child.value, child.result]);
        });
        return vars;
    };

    const setResult = (id, res) => {
        const newTree = [...tree];
        const node = findNode(id, newTree);
        node.result = res;
        setTree(newTree);
    };

    const isLeaf = (id) => {
        return findNode(id, tree).children.length === 0;
    };

    const findNode = (id, newTree) => {
        return findNodeRecursive(id, newTree[0]);
    };

    const findNodeRecursive = (id, node) => {
        if (node.id === id) {
            return node;
        }
        for (let i = 0; i < node.children.length; i++) {
            const child = findNodeRecursive(id, node.children[i]);
            if (child) {
                return child;
            }
        }
        return null;
    };

    const treeToArr = (tree) => {
        const arr = [];
        const traverse = (node) => {
            arr.push(node);
            node.children.forEach((child) => traverse(child));
        };
        traverse(tree[0]);
        return arr;
    };

    const resetTree = () => {
        const defaultTreed = [
            { id: uuid(), value: "root", parent: null, children: [] },
        ];
        setTree(defaultTreed);
        console.log(`resetting tree`);
    };

    const resetAndAdd = (nodes, to) => {
        const newTree = [...tree];

        resetChildren(to, newTree);
        setChildren(nodes, to, newTree);
        setTree(newTree);
    };

    const resetChildren = (to, tree) => {
        const node = findNode(to, tree);
        node.children = [];
    };

    const setChildren = (children, parent, tree) => {
        children.forEach((child) => addNode(parent, child, tree));
    };

    const resetChildrenStateful = (to) => {
        const newTree = [...tree];
        const parent = findNode(to, newTree);
        parent.children = [];
        setTree(newTree);
    };

    const removeNode = (id) => {
        const newTree = [...tree];
        const node = findNode(id, newTree);
        const parent = findNode(node.parent, newTree);
        parent.children = parent.children.filter((child) => child.id !== id);
        setTree(newTree);
    };

    const getNodeLevel = (id) => {
        let node = findNode(id, tree);
        let level = 0;
        try {
            while (node.parent !== null) {
                level++;
                node = findNode(node.parent, tree);
            }
        } catch (error) {}
        return level;
    };

    const getChildIndex = (id) => {
        const node = findNode(id, tree);
        try {
            const parent = findNode(node.parent, tree);
            return parent.children.indexOf(node);
        } catch (error) {}
    };

    const childrenSatisfied = (id, vars) => {
        const node = findNode(id, tree);
        const children = node.children;
        const childVars = [];
        children.forEach((child) => {
            childVars.push(child.value);
        });

        if (childVars.length === vars.length)
            return childVars.every((child) => vars.includes(child));
        else return false;
    };

    const getChildren = (id) => {
        const node = findNode(id, tree);
        if (node.children) return node.children;
        else return [];
    };

    return {
        tree,
        tree1D,
        addNode,
        addNodeStateful,
        findNode,
        resetTree,
        resetAndAdd,
        resetChildrenStateful,
        isLeaf,
        setResult,
        resolveChildren,
        removeNode,
        getNodeLevel,
        getChildIndex,
        childrenSatisfied,
        getChildren,
        defaultTree,
    };
};
