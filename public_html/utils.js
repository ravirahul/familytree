// utils.js - Shared utility functions

/**
 * Storage utilities with error handling
 */
const storage = {
  get(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(key);
      return value !== null ? value : defaultValue;
    } catch (e) {
      console.warn('localStorage not available:', e);
      return defaultValue;
    }
  },
  
  set(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn('localStorage not available:', e);
      return false;
    }
  },
  
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn('localStorage not available:', e);
      return false;
    }
  }
};

/**
 * Data validation and sanitization
 */
const dataUtils = {
  sanitizeNode(node) {
    if (!node || !node.id || !node.name || node.name === 'name') {
      return null;
    }
    
    const sanitized = { ...node };
    sanitized.id = Number(node.id);
    
    if (isNaN(sanitized.id) || sanitized.id === 0) {
      return null;
    }
    
    sanitized.fid = node.fid && Number(node.fid) !== 0 ? Number(node.fid) : null;
    sanitized.mid = node.mid && Number(node.mid) !== 0 ? Number(node.mid) : null;
    
    if (!Array.isArray(node.pids)) {
      if (typeof node.pids === 'string' && node.pids.length) {
        sanitized.pids = node.pids
          .split(',')
          .map(v => Number(v.trim()))
          .filter(v => !isNaN(v) && v !== 0);
      } else {
        sanitized.pids = [];
      }
    } else {
      sanitized.pids = node.pids
        .map(v => Number(v))
        .filter(v => !isNaN(v) && v !== 0);
    }
    
    if (!node.birth_date || node.birth_date === '0000-00-00') {
      sanitized.birth_date = '';
    }
    
    sanitized.nickname = node.nickname || '';
    
    return sanitized;
  },
  
  calculateGenerations(nodes) {
    const depthCache = {};
    const visiting   = new Set(); // cycle detection: tracks IDs currently in the call stack
    const byId       = new Map(nodes.map(n => [n.id, n]));

    function depthOf(id) {
      if (depthCache[id] != null) return depthCache[id];
      if (visiting.has(id)) {
        // Circular parent reference in data – break the cycle and treat as root
        console.warn('Circular parent reference detected for member id:', id);
        return 1;
      }

      visiting.add(id);
      const node = byId.get(id);
      if (!node || (!node.fid && !node.mid)) {
        depthCache[id] = 1;
      } else {
        const fd = node.fid ? depthOf(node.fid) : 0;
        const md = node.mid ? depthOf(node.mid) : 0;
        depthCache[id] = 1 + Math.max(fd, md);
      }
      visiting.delete(id);
      return depthCache[id];
    }
    
    let maxGen = 0;
    nodes.forEach(n => {
      maxGen = Math.max(maxGen, depthOf(n.id));
    });
    
    return maxGen;
  },
  
  findRelatives(member, allNodes) {
    const father = member.fid
      ? allNodes.find(n => n.id === member.fid)
      : null;
  
    const mother = member.mid
      ? allNodes.find(n => n.id === member.mid)
      : null;
  
    const spouses = Array.isArray(member.pids)
      ? member.pids
          .map(pid => allNodes.find(n => n.id === pid))
          .filter(Boolean)
      : [];
  
    const children = allNodes.filter(n =>
      n.fid === member.id || n.mid === member.id
    );

    // Siblings — share at least one parent, excluding self
    const siblings = (member.fid || member.mid)
      ? allNodes.filter(n =>
          n.id !== member.id &&
          ((member.fid && n.fid === member.fid) ||
           (member.mid && n.mid === member.mid)))
      : [];

    return { father, mother, spouses, children, siblings };
  }
};

/**
 * UI utilities
 */
const uiUtils = {
  // a placeholder shaped like the view that is loading; the next innerHTML on the container replaces it
  skeleton(view = window.FT_VIEW || 'custom', message = CONFIG.MESSAGES.loading) {
    const sk = (cls, n = 1) => `<i class="sk ${cls}"></i>`.repeat(n);
    const row = () => `<div class="sk-row">${sk('sk-circle sk-av')}<div class="sk-grow">${sk('sk-line w60')}${sk('sk-line w40')}</div></div>`;
    const body = {
      custom: `<div class="sk-tree">
          <div class="sk-gen">${sk('sk-node', 2)}</div><i class="sk-stem"></i>
          <div class="sk-gen">${sk('sk-node', 3)}</div><i class="sk-stem"></i>
          <div class="sk-gen">${sk('sk-node', 4)}</div></div>`,
      events: `<div class="sk-list"><div class="sk-axis">${sk('sk-circle sk-dot', 7)}</div>${row()}${row()}${row()}${row()}</div>`,
      map: `<div class="sk-map">${sk('sk-panel')}${sk('sk-circle sk-pin', 3)}</div>`,
      memories: `<div class="sk-grid">${sk('sk-card', 24)}</div>`,
      relation: `<div class="sk-list"><div class="sk-pair">${sk('sk-chip', 2)}</div>${sk('sk-card sk-tall')}</div>`,
    }[view] || `<div class="sk-list">${row()}${row()}${row()}</div>`;
    return `<div class="sk-wrap sk-${view}" aria-busy="true" aria-live="polite"><span class="sr-only">${message}</span>${body}</div>`;
  },

  showLoading(container, message = CONFIG.MESSAGES.loading) {
    if (container) container.innerHTML = this.skeleton(undefined, message);
  },
  
  showError(container, message = CONFIG.MESSAGES.error) {
    if (!container) return;
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:40px;">
        <div style="text-align:center;color:var(--text-muted);">
          <div style="margin-bottom:12px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto;display:block;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
          <div>${message}</div>
          <button class="btn btn-soft" style="margin-top:16px;" onclick="location.reload()">
            Refresh Page
          </button>
        </div>
      </div>
    `;
  },
  
  formatDate(dateString) {
    if (!dateString || dateString === '0000-00-00') return '—';
    return dateString;
  },
  
  displayValue(value) {
    return (value && String(value).trim()) ? String(value).trim() : '—';
  },
  
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
};

/**
 * Export data utilities
 */
const exportUtils = {
  exportJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
};

/**
 * RelationshipCalculator - detailed relationship logic
 */
class RelationshipCalculator {
  constructor(allMembers) {
    this.members = allMembers;
    this.byId = new Map(allMembers.map(m => [m.id, m]));
    // children by parent id, in member order (getChildren / getSiblings / BFS were O(n) per call)
    this.order = new Map(allMembers.map((m, i) => [m, i]));
    this.kids = new Map();
    allMembers.forEach(m => [m.fid, m.mid].forEach(p => {
      if (!p) return;
      if (!this.kids.has(p)) this.kids.set(p, []);
      const k = this.kids.get(p);
      if (k[k.length - 1] !== m) k.push(m);   // fid === mid would add twice
    }));
  }
  
  calculateRelationship(person1Id, person2Id) {
  if (person1Id === person2Id) {
    return {
      type: 'self',
      description: 'Same Person',
      path: [this.byId.get(person1Id)],
      details: 'This is the same person'
    };
  }
  
  const person1 = this.byId.get(person1Id);
  const person2 = this.byId.get(person2Id);
  if (!person1 || !person2) return null;
  
  // Check direct relationships first (parent-child, siblings, grandparents)
  const directRel = this.checkDirectRelationship(person1, person2);
  if (directRel) return directRel;
  
  // Check spouse relationship
  const spouseRel = this.checkSpouseRelationship(person1, person2);
  if (spouseRel) return spouseRel;
  
  // Check aunt/uncle and niece/nephew BEFORE cousins
  const auntUncleRel = this.checkAuntUncleRelationship(person1, person2);
  if (auntUncleRel) return auntUncleRel;
  
  // Check cousin relationships (this should catch most cousin cases)
  const cousinRel = this.calculateCousinRelationship(person1, person2);
  if (cousinRel) return cousinRel;
  
  // Check in-law relationships
  const inLawRel = this.checkInLawRelationship(person1, person2);
  if (inLawRel) return inLawRel;
  
  // Fall back to shortest path for distant relatives
  const path = this.findShortestPath(person1Id, person2Id);
  if (path) {
    return {
      type: 'distant',
      description: 'Distant Relative',
      path,
      details: `${path.length - 1} degrees of separation`,
      steps: this.describePathSteps(path)
    };
  }
  
  return null;
}
  
  // === helpers (same as earlier spec; kept compact) ===

  checkDirectRelationship(p1, p2) {
    if (p1.fid === p2.id) {
      return { type: 'parent-child', description: 'Father', path: [p1, p2],
        details: `${p2.name} is the father of ${p1.name}` };
    }
    if (p1.mid === p2.id) {
      return { type: 'parent-child', description: 'Mother', path: [p1, p2],
        details: `${p2.name} is the mother of ${p1.name}` };
    }
    if (p2.fid === p1.id) {
      const d = p2.gender === 'female' ? 'Daughter' : 'Son';
      return { type: 'parent-child', description: d, path: [p1, p2],
        details: `${p2.name} is the ${d.toLowerCase()} of ${p1.name}` };
    }
    if (p2.mid === p1.id) {
      const d = p2.gender === 'female' ? 'Daughter' : 'Son';
      return { type: 'parent-child', description: d, path: [p1, p2],
        details: `${p2.name} is the ${d.toLowerCase()} of ${p1.name}` };
    }
    
    if (this.areSiblings(p1, p2)) {
      const isFull = p1.fid === p2.fid && p1.mid === p2.mid && p1.fid && p1.mid;
      const prefix = isFull ? '' : 'Half-';
      const gender = p2.gender === 'female' ? 'Sister' : 'Brother';
      return {
        type: 'sibling',
        description: prefix + gender,
        path: [p1, p2],
        details: `${p2.name} is the ${prefix.toLowerCase()}${gender.toLowerCase()} of ${p1.name}`
      };
    }
    
    const gp = this.checkGrandparentRelationship(p1, p2);
    if (gp) return gp;
    return null;
  }
  
  checkGrandparentRelationship(p1, p2) {
    const a1 = this.getAncestors(p1.id);
    const level = a1.findIndex(gen => gen.includes(p2.id));
    if (level > 0) {
      const greats = level === 1 ? '' : 'Great-'.repeat(level - 1);
      const gender = p2.gender === 'female' ? 'Grandmother' : 'Grandfather';
      return {
        type: 'grandparent',
        description: greats + gender,
        path: this.getPathThroughParents(p1, p2),
        details: `${p2.name} is the ${(greats + gender).toLowerCase()} of ${p1.name}`
      };
    }
    
    const a2 = this.getAncestors(p2.id);
    const levelDown = a2.findIndex(gen => gen.includes(p1.id));
    if (levelDown > 0) {
      const greats = levelDown === 1 ? '' : 'Great-'.repeat(levelDown - 1);
      const gender = p2.gender === 'female' ? 'Granddaughter' : 'Grandson';
      return {
        type: 'grandchild',
        description: greats + gender,
        path: this.getPathThroughParents(p2, p1).reverse(),
        details: `${p2.name} is the ${(greats + gender).toLowerCase()} of ${p1.name}`
      };
    }
    return null;
  }
  
  checkSpouseRelationship(p1, p2) {
    const isSpouse = (p1.pids && p1.pids.includes(p2.id)) ||
                     (p2.pids && p2.pids.includes(p1.id));
    if (isSpouse) {
      const label = p2.gender === 'female' ? 'Wife' : 'Husband';
      return {
        type: 'spouse',
        description: label,
        path: [p1, p2],
        details: `${p2.name} is the ${label.toLowerCase()} of ${p1.name}`
      };
    }
    return null;
  }
  
  checkInLawRelationship(p1, p2) {
    const p1Spouses = this.getSpouses(p1);
    for (const spouse of p1Spouses) {
      if (spouse.fid === p2.id) {
        return {
          type: 'in-law',
          description: 'Father-in-Law',
          path: [p1, spouse, p2],
          details: `${p2.name} is the father-in-law of ${p1.name} (father of ${spouse.name})`
        };
      }
      if (spouse.mid === p2.id) {
        return {
          type: 'in-law',
          description: 'Mother-in-Law',
          path: [p1, spouse, p2],
          details: `${p2.name} is the mother-in-law of ${p1.name} (mother of ${spouse.name})`
        };
      }
      if (this.areSiblings(spouse, p2)) {
        const g = p2.gender === 'female' ? 'Sister' : 'Brother';
        return {
          type: 'in-law',
          description: `${g}-in-Law`,
          path: [p1, spouse, p2],
          details: `${p2.name} is the ${g.toLowerCase()}-in-law of ${p1.name} (${g.toLowerCase()} of ${spouse.name})`
        };
      }
    }
    
    const p2Spouses = this.getSpouses(p2);
    for (const spouse of p2Spouses) {
      if (spouse.fid === p1.id || spouse.mid === p1.id) {
        const g = p2.gender === 'female' ? 'Daughter' : 'Son';
        return {
          type: 'in-law',
          description: `${g}-in-Law`,
          path: [p1, spouse, p2],
          details: `${p2.name} is the ${g.toLowerCase()}-in-law of ${p1.name} (spouse of ${spouse.name})`
        };
      }
    }
    return null;
  }
  
  checkAuntUncleRelationship(p1, p2) {
    const p1Parents = [
      p1.fid ? this.byId.get(p1.fid) : null,
      p1.mid ? this.byId.get(p1.mid) : null
    ].filter(Boolean);
    
    for (const parent of p1Parents) {
      if (this.areSiblings(parent, p2)) {
        const level = this.getGenerationLevel(p2.id, parent.id);
        const greats = level > 0 ? 'Great-'.repeat(level) : '';
        const g = p2.gender === 'female' ? 'Aunt' : 'Uncle';
        return {
          type: 'aunt-uncle',
          description: greats + g,
          path: [p1, parent, p2],
          details: `${p2.name} is the ${(greats + g).toLowerCase()} of ${p1.name} (${g.toLowerCase()} through ${parent.name})`
        };
      }
    }
    
    const siblings = this.getSiblings(p1);
    for (const sibling of siblings) {
      const children = this.getChildren(sibling);
      if (children.some(c => c.id === p2.id)) {
        const level = this.getGenerationLevel(p1.id, sibling.id);
        const greats = level > 0 ? 'Grand-'.repeat(level) : '';
        const g = p2.gender === 'female' ? 'Niece' : 'Nephew';
        return {
          type: 'niece-nephew',
          description: greats + g,
          path: [p1, sibling, p2],
          details: `${p2.name} is the ${(greats + g).toLowerCase()} of ${p1.name} (child of ${sibling.name})`
        };
      }
    }
    return null;
  }
  
  calculateCousinRelationship(p1, p2) {
  const commonAncestors = this.findCommonAncestors(p1.id, p2.id);
  if (!commonAncestors.length) return null;

  // use the nearest common ancestor (fewest combined generations)
  const ancestor = commonAncestors[0];

  const d1 = this.getGenerationDistance(ancestor.id, p1.id);
  const d2 = this.getGenerationDistance(ancestor.id, p2.id);
  if (d1 === -1 || d2 === -1) return null;

  // if one is direct ancestor of the other, let grandparent logic handle it
  if (d1 === 0 || d2 === 0) return null;

  // if both are only 1 generation from the ancestor, they are siblings,
  // which is already handled in checkDirectRelationship / checkAuntUncleRelationship
  if (d1 === 1 && d2 === 1) return null;

  const minD = Math.min(d1, d2);
  const maxD = Math.max(d1, d2);
  const removed = maxD - minD;

  // standard genealogy: cousin degree = minD - 1
  const degree = minD - 1;
  if (degree < 1) return null; // anything closer is not a cousin

  let degreeLabel;
  if (degree === 1) degreeLabel = 'First Cousin';
  else if (degree === 2) degreeLabel = 'Second Cousin';
  else if (degree === 3) degreeLabel = 'Third Cousin';
  else if (degree === 4) degreeLabel = 'Fourth Cousin';
  else degreeLabel = `${degree}th Cousin`;

  let removedLabel = '';
  if (removed === 1) removedLabel = 'Once Removed';
  else if (removed === 2) removedLabel = 'Twice Removed';
  else if (removed > 2) removedLabel = `${removed} Times Removed`;

  const description = removedLabel ? `${degreeLabel} ${removedLabel}` : degreeLabel;
  const path = this.buildPathThroughAncestor(p1, p2, ancestor);

  return {
    type: 'cousin',
    description,
    path,
    details: `${p2.name} and ${p1.name} are ${description.toLowerCase()} (through common ancestor ${ancestor.name})`
  };
}

  
  areSiblings(p1, p2) {
    if (p1.id === p2.id) return false;
    return (p1.fid && p1.fid === p2.fid) || (p1.mid && p1.mid === p2.mid);
  }
  
  getAncestors(personId, maxLevel = 10) {
    const generations = [];
    let current = [personId];
    for (let i = 0; i < maxLevel; i++) {
      const next = [];
      for (const id of current) {
        const p = this.byId.get(id);
        if (!p) continue;
        if (p.fid) next.push(p.fid);
        if (p.mid) next.push(p.mid);
      }
      if (!next.length) break;
      generations.push(next);
      current = next;
    }
    return generations;
  }
  
  getGenerationDistance(ancestorId, descendantId) {
    // BFS up through BOTH parents — the old father-line-only walk returned -1
    // whenever the ancestor was reachable only through a mother, which made
    // first cousins report as "distant relatives".
    let frontier = [descendantId];
    const visited = new Set(frontier);
    let dist = 0;
    while (frontier.length && dist < 20) {
      if (frontier.includes(ancestorId)) return dist;
      const next = [];
      for (const id of frontier) {
        const p = this.byId.get(id);
        if (!p) continue;
        for (const pid of [p.fid, p.mid]) {
          if (pid && !visited.has(pid)) {
            visited.add(pid);
            next.push(pid);
          }
        }
      }
      frontier = next;
      dist++;
    }
    return frontier.includes(ancestorId) ? dist : -1;
  }
  
  findCommonAncestors(id1, id2) {
    const a1 = this.getAncestors(id1).flat();
    const a2 = new Set(this.getAncestors(id2).flat());
    return [...new Set(a1)]
      .filter(id => a2.has(id))
      .map(id => ({
        id,
        ...this.byId.get(id),
        distance1: this.getGenerationDistance(id, id1),
        distance2: this.getGenerationDistance(id, id2)
      }))
      // Guard: unreachable entries must never sort to the front
      .filter(x => x.distance1 !== -1 && x.distance2 !== -1)
      .sort((a, b) => (a.distance1 + a.distance2) - (b.distance1 + b.distance2));
  }
  
  getPathThroughParents(descendant, ancestor) {
    const path = [descendant];
    let current = descendant;
    const visited = new Set();
    while (current.id !== ancestor.id && path.length < 20) {
      if (visited.has(current.id)) break;
      visited.add(current.id);

      if (current.fid === ancestor.id || current.mid === ancestor.id) {
        path.push(ancestor);
        break;
      }

      // Step to whichever parent actually leads to the ancestor
      const father = current.fid ? this.byId.get(current.fid) : null;
      const mother = current.mid ? this.byId.get(current.mid) : null;
      let parent = null;
      if (father && this.getGenerationDistance(ancestor.id, father.id) !== -1) parent = father;
      else if (mother && this.getGenerationDistance(ancestor.id, mother.id) !== -1) parent = mother;
      if (!parent) break;
      path.push(parent);
      current = parent;
    }
    return path;
  }
  
  buildPathThroughAncestor(p1, p2, ancestor) {
    const toAnc = this.getPathThroughParents(p1, ancestor);
    const fromAnc = this.getPathThroughParents(p2, ancestor);
    return [...toAnc, ...fromAnc.slice(0, -1).reverse()];
  }
  
  getSpouses(person) {
    if (!person.pids || !Array.isArray(person.pids)) return [];
    return person.pids.map(id => this.byId.get(id)).filter(Boolean);
  }
  
  getSiblings(person) {
    const cand = new Set([...(person.fid ? this.kids.get(person.fid) || [] : []), ...(person.mid ? this.kids.get(person.mid) || [] : [])]);
    return [...cand].filter(m => m.id !== person.id && this.areSiblings(person, m)).sort((a, b) => this.order.get(a) - this.order.get(b));
  }
  
  getChildren(person) {
    return (this.kids.get(person.id) || []).slice();
  }
  
  getGenerationLevel(id1, id2) {
    const a1 = this.getAncestors(id1);
    const a2 = this.getAncestors(id2);
    return Math.abs(a1.length - a2.length);
  }
  
  findShortestPath(person1Id, person2Id) {
    const queue = [[person1Id]];
    const visited = new Set([person1Id]);
    for (let qi = 0; qi < queue.length; qi++) {   // index, not shift(): shift is O(n) per step
      const path = queue[qi];
      const currentId = path[path.length - 1];
      const current = this.byId.get(currentId);
      if (!current) continue;
      const cons = this.getConnections(current);
      for (const id of cons) {
        if (id === person2Id) {
          return [...path, id].map(i => this.byId.get(i));
        }
        if (!visited.has(id)) {
          visited.add(id);
          queue.push([...path, id]);
        }
      }
    }
    return null;
  }
  
  getConnections(person) {
    const cons = [];
    if (person.fid) cons.push(person.fid);
    if (person.mid) cons.push(person.mid);
    if (person.pids && Array.isArray(person.pids)) cons.push(...person.pids);
    (this.kids.get(person.id) || []).forEach(m => cons.push(m.id));
    return [...new Set(cons)].filter(id => id !== person.id);
  }
  
  describePathSteps(path) {
    const steps = [];
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];
      let rel = '';
      if (p2.fid === p1.id) rel = 'is father of';
      else if (p2.mid === p1.id) rel = 'is mother of';
      else if (p1.fid === p2.id) rel = 'is child of';
      else if (p1.mid === p2.id) rel = 'is child of';
      else if (p1.pids && p1.pids.includes(p2.id)) rel = 'is married to';
      else if (p2.pids && p2.pids.includes(p1.id)) rel = 'is married to';
      else if (this.areSiblings(p1, p2)) rel = 'is sibling of';
      else rel = 'is related to';
      steps.push({ person: p1, relation: rel });
    }
    return steps;
  }
}

if (typeof window !== 'undefined') {
  window.RelationshipCalculator = RelationshipCalculator;
}
