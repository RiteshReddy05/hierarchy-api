const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const USER = {
    user_id: "riteshreddy_23042005",
    email_id: "rr5110@srmist.edu.in",
    college_roll_number: "RA2311056010209"
};

function checkEdge(raw) {
    if (typeof raw !== 'string') return null;
    const s = raw.trim();
    const m = s.match(/^([A-Z])->([A-Z])$/);
    if (!m) return null;
    if (m[1] === m[2]) return null;
    return s;
}

function findGroups(nodes, adj) {
    // undirected connected components
    const und = {};
    for (const n of nodes) und[n] = new Set();
    for (const u in adj) {
        for (const v of adj[u]) {
            und[u].add(v);
            und[v].add(u);
        }
    }
    const seen = new Set();
    const groups = [];
    for (const n of nodes) {
        if (seen.has(n)) continue;
        const stack = [n], g = [];
        while (stack.length) {
            const x = stack.pop();
            if (seen.has(x)) continue;
            seen.add(x);
            g.push(x);
            for (const y of und[x]) if (!seen.has(y)) stack.push(y);
        }
        groups.push(g);
    }
    return groups;
}

function groupHasCycle(gNodes, adj) {
    const set = new Set(gNodes);
    const color = {};
    for (const n of gNodes) color[n] = 0;
    function dfs(u) {
        color[u] = 1;
        for (const v of (adj[u] || [])) {
            if (!set.has(v)) continue;
            if (color[v] === 1) return true;
            if (color[v] === 0 && dfs(v)) return true;
        }
        color[u] = 2;
        return false;
    }
    for (const n of gNodes) {
        if (color[n] === 0 && dfs(n)) return true;
    }
    return false;
}

function makeTree(root, children) {
    const visited = new Set();
    function walk(n) {
        if (visited.has(n)) return {};
        visited.add(n);
        const kids = (children[n] || []).slice().sort();
        const out = {};
        for (const k of kids) out[k] = walk(k);
        return out;
    }
    return { [root]: walk(root) };
}

function treeDepth(root, children) {
    const visited = new Set();
    function go(n) {
        if (visited.has(n)) return 0;
        visited.add(n);
        const kids = children[n] || [];
        if (!kids.length) { visited.delete(n); return 1; }
        let best = 0;
        for (const k of kids) {
            const d = go(k);
            if (d > best) best = d;
        }
        visited.delete(n);
        return 1 + best;
    }
    return go(root);
}

app.post('/bfhl', (req, res) => {
    const data = req.body?.data;
    if (!Array.isArray(data)) {
        return res.status(400).json({ error: "data must be an array" });
    }

    const invalid_entries = [];
    const duplicate_edges = [];
    const seenEdge = new Set();
    const dupRecorded = new Set();
    const validEdges = [];

    for (const entry of data) {
        const ok = checkEdge(entry);
        if (!ok) {
            invalid_entries.push(typeof entry === 'string' ? entry : String(entry));
            continue;
        }
        if (seenEdge.has(ok)) {
            if (!dupRecorded.has(ok)) {
                duplicate_edges.push(ok);
                dupRecorded.add(ok);
            }
            continue;
        }
        seenEdge.add(ok);
        validEdges.push(ok);
    }

    // adjacency + first-parent-wins
    const adj = {};
    const children = {};
    const parentOf = {};
    const nodes = new Set();

    for (const e of validEdges) {
        const [p, c] = e.split('->');
        nodes.add(p);
        nodes.add(c);
        if (!adj[p]) adj[p] = [];
        adj[p].push(c);
        if (!(c in parentOf)) {
            parentOf[c] = p;
            if (!children[p]) children[p] = [];
            children[p].push(c);
        }
        // else: silently drop the extra parent edge for tree-building
    }

    const allNodes = [...nodes];
    const groups = findGroups(allNodes, adj);

    const hierarchies = [];
    let totalTrees = 0;
    let totalCycles = 0;
    let bestDepth = -1;
    let bestRoot = null;

    // sort groups by their smallest node for stable ordering
    groups.sort((a, b) => a.slice().sort()[0].localeCompare(b.slice().sort()[0]));

    for (const g of groups) {
        const cyc = groupHasCycle(g, adj);
        if (cyc) {
            const root = g.slice().sort()[0];
            hierarchies.push({ root, tree: {}, has_cycle: true });
            totalCycles++;
            continue;
        }
        // find root: node in this group with no parent
        const roots = g.filter(n => !(n in parentOf));
        const root = roots.sort()[0]; // should be exactly one for a tree
        const tree = makeTree(root, children);
        const d = treeDepth(root, children);
        hierarchies.push({ root, tree, depth: d });
        totalTrees++;
        if (d > bestDepth || (d === bestDepth && root < bestRoot)) {
            bestDepth = d;
            bestRoot = root;
        }
    }

    const summary = {
        total_trees: totalTrees,
        total_cycles: totalCycles,
        largest_tree_root: bestRoot || ""
    };

    res.json({
        ...USER,
        hierarchies,
        invalid_entries,
        duplicate_edges,
        summary
    });
});

app.get('/', (_, res) => res.send('bfhl api live'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('running on', PORT));
