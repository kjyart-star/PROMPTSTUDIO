#!/usr/bin/env node
'use strict';

const fs = require('fs');

function main() {
  const inPath = process.argv[2];
  const outPath = process.argv[3];
  if (!inPath || !outPath) {
    console.error('Usage: node ua-tour-analyze.js <input.json> <output.json>');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const nodes = data.nodes || [];
  const edges = data.edges || [];
  const layers = data.layers || [];

  const nodeById = new Map();
  for (const n of nodes) nodeById.set(n.id, n);

  // Only treat file-level node types as tour-eligible.
  const FILE_TYPES = new Set(['file', 'config', 'document', 'schema', 'table']);
  const isFileNode = (n) => n && FILE_TYPES.has(n.type);

  // --- Fan-in / Fan-out (count edges between existing nodes) ---
  const fanIn = new Map();
  const fanOut = new Map();
  for (const n of nodes) { fanIn.set(n.id, 0); fanOut.set(n.id, 0); }
  for (const e of edges) {
    if (nodeById.has(e.source) && nodeById.has(e.target)) {
      fanOut.set(e.source, (fanOut.get(e.source) || 0) + 1);
      fanIn.set(e.target, (fanIn.get(e.target) || 0) + 1);
    }
  }

  const nameOf = (id) => (nodeById.get(id) ? nodeById.get(id).name : id);

  const fanInRanking = [...fanIn.entries()]
    .filter(([id]) => isFileNode(nodeById.get(id)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id, v]) => ({ id, fanIn: v, name: nameOf(id) }));

  const fanOutRanking = [...fanOut.entries()]
    .filter(([id]) => isFileNode(nodeById.get(id)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id, v]) => ({ id, fanOut: v, name: nameOf(id) }));

  // --- Entry point candidates ---
  const codeNames = new Set([
    'index.ts','index.js','main.ts','main.js','app.ts','app.js','server.ts','server.js',
    'mod.rs','main.go','main.py','main.rs','manage.py','app.py','wsgi.py','asgi.py','run.py',
    '__main__.py','Application.java','Main.java','Program.cs','config.ru','index.php',
    'App.swift','Application.kt','main.cpp','main.c','layout.tsx'
  ]);

  const fileNodes = nodes.filter(isFileNode);
  const fanOutVals = fileNodes.map((n) => fanOut.get(n.id) || 0).sort((a, b) => a - b);
  const fanInVals = fileNodes.map((n) => fanIn.get(n.id) || 0).sort((a, b) => a - b);
  const pct = (arr, p) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] : 0;
  const fanOutTop10 = pct(fanOutVals, 0.9);
  const fanInBottom25 = pct(fanInVals, 0.25);

  const epScores = [];
  for (const n of fileNodes) {
    let score = 0;
    const fp = n.filePath || '';
    const depth = fp.split('/').length;
    if (n.type === 'document') {
      if (/(^|\/)README\.md$/i.test(fp) && depth <= 1) score += 5;
      else if (/\.md$/i.test(fp) && depth <= 1) score += 2;
    } else {
      if (codeNames.has(n.name)) score += 3;
      if (depth <= 2) score += 1;
      if ((fanOut.get(n.id) || 0) >= fanOutTop10 && fanOutTop10 > 0) score += 1;
      if ((fanIn.get(n.id) || 0) <= fanInBottom25) score += 1;
    }
    if (score > 0) epScores.push({ id: n.id, score, name: n.name, summary: (n.summary || '') });
  }
  // root layout.tsx boost (project natural entry)
  for (const e of epScores) {
    if (e.id === 'file:src/app/layout.tsx') e.score += 2;
  }
  epScores.sort((a, b) => b.score - a.score);
  const entryPointCandidates = epScores.slice(0, 8);

  // --- BFS from top code entry point following imports/calls ---
  const adj = new Map();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if ((e.type === 'imports' || e.type === 'calls') && nodeById.has(e.source) && nodeById.has(e.target)) {
      adj.get(e.source).push(e.target);
    }
  }

  const codeEntry = epScores.find((e) => nodeById.get(e.id) && nodeById.get(e.id).type !== 'document');
  const startNode = codeEntry ? codeEntry.id : (fileNodes[0] && fileNodes[0].id);

  const order = [];
  const depthMap = {};
  if (startNode) {
    const q = [startNode];
    depthMap[startNode] = 0;
    while (q.length) {
      const cur = q.shift();
      order.push(cur);
      for (const nb of (adj.get(cur) || [])) {
        if (depthMap[nb] === undefined) {
          depthMap[nb] = depthMap[cur] + 1;
          q.push(nb);
        }
      }
    }
  }
  const byDepth = {};
  for (const [id, d] of Object.entries(depthMap)) {
    (byDepth[d] = byDepth[d] || []).push(id);
  }

  // --- Non-code inventory ---
  const nonCodeFiles = { documentation: [], infrastructure: [], data: [], config: [] };
  for (const n of nodes) {
    const item = { id: n.id, name: n.name, type: n.type, summary: n.summary || '' };
    if (n.type === 'document') nonCodeFiles.documentation.push(item);
    else if (['service', 'pipeline', 'resource'].includes(n.type)) nonCodeFiles.infrastructure.push(item);
    else if (['table', 'schema', 'endpoint'].includes(n.type)) nonCodeFiles.data.push(item);
    else if (n.type === 'config') nonCodeFiles.config.push(item);
  }

  // --- Clusters: bidirectional import/call pairs, then expand ---
  const directed = new Set();
  for (const e of edges) {
    if ((e.type === 'imports' || e.type === 'calls') && nodeById.has(e.source) && nodeById.has(e.target)) {
      directed.add(e.source + '||' + e.target);
    }
  }
  const undirectedCount = new Map(); // "a||b" sorted -> count of edges between
  for (const key of directed) {
    const [a, b] = key.split('||');
    if (a === b) continue;
    const k = [a, b].sort().join('||');
    undirectedCount.set(k, (undirectedCount.get(k) || 0) + 1);
  }
  const clusters = [];
  const seedPairs = [...undirectedCount.entries()]
    .filter(([, c]) => c >= 2) // bidirectional
    .map(([k]) => k.split('||'));
  const usedClusterKey = new Set();
  for (const [a, b] of seedPairs) {
    const set = new Set([a, b]);
    // expand: add nodes connected to >=2 members
    for (const n of nodes) {
      if (set.has(n.id) || set.size >= 5) continue;
      let conn = 0;
      for (const m of set) {
        const k = [n.id, m].sort().join('||');
        if (undirectedCount.has(k)) conn++;
      }
      if (conn >= 2) set.add(n.id);
    }
    const arr = [...set].sort();
    const key = arr.join('||');
    if (!usedClusterKey.has(key)) {
      usedClusterKey.add(key);
      let edgeCount = 0;
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const k = [arr[i], arr[j]].sort().join('||');
          edgeCount += undirectedCount.get(k) || 0;
        }
      }
      clusters.push({ nodes: arr, edgeCount });
    }
  }
  clusters.sort((a, b) => b.edgeCount - a.edgeCount);

  // --- Node summary index ---
  const nodeSummaryIndex = {};
  for (const n of nodes) {
    nodeSummaryIndex[n.id] = { name: n.name, type: n.type, summary: n.summary || '' };
  }

  const result = {
    scriptCompleted: true,
    entryPointCandidates,
    fanInRanking,
    fanOutRanking,
    bfsTraversal: { startNode, order, depthMap, byDepth },
    nonCodeFiles,
    clusters: clusters.slice(0, 10),
    layers: { count: layers.length, list: layers },
    nodeSummaryIndex,
    totalNodes: nodes.length,
    totalEdges: edges.length
  };

  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  process.exit(0);
}

try {
  main();
} catch (err) {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
}
