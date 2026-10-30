// custom/custom-tree.js  v1.4
// Phase 1: Custom D3-based family tree renderer — couple-node layout.
// Replaces Balkan FamilyTree JS (commercial library).
//
// v1.2 changes vs v1.1
// ─────────────────────────────────────────────────────────────────────────────
// 1. Toggle position  — button now sits 14 px below the card pair, not V_GAP/2
//    below (was 36 px).  Visually "just below the heart".
//
// 2. Connector origin — for couple units the vertical spine now originates at
//    the heart symbol (y + CARD_H/2) so the line truly comes from the heart.
//    For singletons it still originates at the card bottom (y + CARD_H).
//
// 3. Connector target — children connectors now drop onto _primaryX(child)
//    (centre of the PRIMARY person's card) instead of the couple midpoint.
//    Layout centering also adjusted: parent centred over span of children's
//    primary-person centres, so the spine stays vertical for single-child.
//
// 4. Spouse-origin button — secondary persons (spouses who "married in") get
//    a small ＋ button at the top of their card.  Clicking it expands and
//    navigates to the unit that contains their birth-family parents.

class CustomTreeView extends FamilyTreeController {
  constructor() {
    super('custom');

    this.svg          = null;
    this.g            = null;
    this.zoomBehavior = null;

    this.units             = new Map();   // unitId  -> FamilyUnit
    this.personToUnit      = new Map();   // personId -> unitId
    this.spouseOrigins     = new Map();   // secondaryPersonId -> parentUnitId (their birth family)
    this.rootUnits         = [];
    this.hiddenRootUnitIds = new Set();   // root units suppressed while the other side is active

    this.orientation   = 'vertical';
    this.highlightedId = null;
    this.isFullscreen  = false;

    // Layout constants — heritage redesign: vertical photo-forward cards
    this.CARD_W       = 124;
    this.CARD_H      = 148;
    this.COUPLE_GAP   = 20;   // gap between husband and wife cards
    this.H_GAP        = 44;   // min gap between sibling subtrees
    this.V_GAP        = 78;   // vertical distance from bottom of parent to top of child
    this.AVATAR_R     = 30;   // photo circle radius (top-centred)
    this.PHOTO_CY     = 46;   // photo circle centre-y within the card
    this.TOGGLE_R     = 12;
    this.TOGGLE_OFFSET = 16;  // px below card bottom where toggle sits
    this.LOD_THRESHOLD = 0.5; // zoom scale below which cards simplify
    this.INITIAL_BUDGET = 600; // people opened on first load when no focus person is set
    this.BIG_TREE = 500;      // above this many people, draw only what is near the viewport
    this.TINY_ZOOM = 0.2;     // big trees: below this scale names are unreadable dots, so skip them

    this.builderMode = Boolean(
      typeof window !== 'undefined' && (
        window.FT_CAN_EDIT ||
        new URLSearchParams(location.search).get('builder') === '1'
      )
    );
    this.activePopoverContext = null;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async init() {
    const success = await super.init();
    if (success) {
      this.buildFamilyUnits();
      this._setInitialCollapsedState();   // collapse all; open only focus path
      this.mountTree();
      this.updateStats();
      this._setupGlobalEvents();

      // Deep link: ?focus={memberId} — shared from a member panel's Copy link
      const fp = parseInt(new URLSearchParams(location.search).get('focus'), 10);
      if (fp) setTimeout(() => this.focusOnPerson(fp), 350);
    }
    return success;
  }

  // ─── Initial collapsed state ───────────────────────────────────────────────
  //
  // On first load collapse every unit, then expand only:
  //   • the ancestor chain from root → focus person's unit  (so lineage above is visible)
  //   • the focus person's own unit                         (so direct children show)
  //
  // Everything else (cousins, other branches) starts collapsed with a + toggle.

  _setInitialCollapsedState() {
    // 1. Collapse all
    this.units.forEach(u => { u._collapsed = true; });

    // 2. Walk from the focus unit UP to the root, uncollapsing each.
    //    Uncollapsing a unit makes ITS children visible, so walking up
    //    to the root ensures every generation from the top down to the
    //    focus person is rendered (siblings at each level appear as
    //    collapsed + nodes, which is the right minimal initial view).
    const focusId = (typeof CONFIG !== 'undefined') ? CONFIG.DEFAULT_FOCUS_ID : null;

    let uid = focusId ? this.personToUnit.get(focusId) : null;
    let topUid = null;
    while (uid) {
      const u = this.units.get(uid);
      if (!u) break;
      u._collapsed = false;   // expand this unit → its children become visible
      topUid = uid;
      uid = u.parentUnitId;
    }

    // FALLBACK: the focus person doesn't exist in this tree (e.g. demo trees,
    // any tenant other than the one DEFAULT_FOCUS_ID belongs to).
    // Pick the root unit with the largest lineage and expand it fully so the
    // tree is visible instead of everything being hidden.
    if (!topUid) {
      const countDesc = (unit) => {
        let n = 1;
        unit.childUnitIds.forEach(cid => {
          const c = this.units.get(cid);
          if (c) n += countDesc(c);
        });
        return n;
      };
      let bestCount = -1;
      this.units.forEach((u, id) => {
        if (u.parentUnitId) return;           // roots only
        const n = countDesc(u);
        if (n > bestCount) { bestCount = n; topUid = id; }
      });
      // Open it generation by generation while the people shown stay under
      // INITIAL_BUDGET; a small tree opens fully, a big one stops at the
      // generation that would flood the screen (the rest keep their + toggle).
      let level = topUid ? [topUid] : [];
      let shown = topUid ? this.units.get(topUid).members.length : 0;
      while (level.length) {
        const kids = level.flatMap(id => this.units.get(id).childUnitIds).filter(id => this.units.has(id));
        const add = kids.reduce((n, id) => n + this.units.get(id).members.length, 0);
        if (shown + add > this.INITIAL_BUDGET) break;
        level.forEach(id => { this.units.get(id)._collapsed = false; });
        shown += add;
        level = kids;
      }
    }

    // 3. Hide every root unit that is NOT the focus person's root.
    //    Secondary/spouse-origin roots (Vijay Sinha, Jogendra, Mukund Lal, etc.)
    //    should not be visible on first load — only the active lineage shows.
    this.units.forEach((u, id) => {
      if (!u.parentUnitId && id !== topUid) {
        this.hiddenRootUnitIds.add(id);
      }
    });
  }

  // ─── Build Family Units ────────────────────────────────────────────────────
  //
  // ROOT CAUSE FIX: pids is bidirectional — A.pids=[B] AND B.pids=[A].
  // The old "mark-spouse-into" algorithm put BOTH in spouseInto, so both were
  // skipped and each became a singleton.
  //
  // NEW ALGORITHM: collect unique couple PAIRS first, decide one primary per
  // pair, create one unit per pair.  Then singletons for the rest.

  buildFamilyUnits() {
    const byId = new Map(this.familyData.map(p => [p.id, p]));
    this.units.clear();
    this.personToUnit.clear();
    this.spouseOrigins.clear();

    // Who appears as fid OR mid of some child? They are "anchor parents".
    const isAnchorParent = new Set();
    this.familyData.forEach(c => {
      if (c.fid) isAnchorParent.add(c.fid);
      if (c.mid) isAnchorParent.add(c.mid);
    });

    // Collect unique couple pairs.  Key = "min_max" of the two IDs.
    // For each pair, pick primary = whoever is an anchor-parent.
    // If both or neither, use lower ID as primary (stable tiebreak).
    const pairs   = new Map();  // key -> { primary, secondary }
    const pairKey = (a, b) => `${Math.min(a, b)}_${Math.max(a, b)}`;

    this.familyData.forEach(person => {
      if (!Array.isArray(person.pids) || !person.pids.length) return;
      person.pids.forEach(spouseId => {
        const spouse = byId.get(spouseId);
        if (!spouse) return;
        const key = pairKey(person.id, spouseId);
        if (pairs.has(key)) return;   // already registered from the other direction

        // Decide primary
        const personIsAnchor = isAnchorParent.has(person.id);
        const spouseIsAnchor = isAnchorParent.has(spouseId);

        let primary   = person;
        let secondary = spouse;

        if (!personIsAnchor && spouseIsAnchor) {
          // Spouse is the anchor parent → swap
          primary   = spouse;
          secondary = person;
        } else if (personIsAnchor === spouseIsAnchor) {
          // Both or neither are anchor parents → lower ID wins
          if (spouseId < person.id) {
            primary   = spouse;
            secondary = person;
          }
        }

        pairs.set(key, { primary, secondary });
      });
    });

    // Create couple units
    pairs.forEach(({ primary, secondary }) => {
      // If either already mapped, add the partner to that existing unit
      if (this.personToUnit.has(primary.id)) {
        const uid  = this.personToUnit.get(primary.id);
        const unit = this.units.get(uid);
        if (unit && !unit.members.some(m => m.id === secondary.id)) {
          unit.members.push(secondary);
          unit.spouseIds.push(secondary.id);
          this.personToUnit.set(secondary.id, uid);
        }
        return;
      }

      if (this.personToUnit.has(secondary.id)) {
        const uid  = this.personToUnit.get(secondary.id);
        const unit = this.units.get(uid);
        if (unit && !unit.members.some(m => m.id === primary.id)) {
          unit.members.push(primary);
          unit.spouseIds.push(primary.id);
          this.personToUnit.set(primary.id, uid);
        }
        return;
      }

      const uid  = `u_${primary.id}`;
      const unit = this._makeUnit(uid, primary);
      unit.members.push(secondary);
      unit.spouseIds.push(secondary.id);
      this.units.set(uid, unit);
      this.personToUnit.set(primary.id, uid);
      this.personToUnit.set(secondary.id, uid);
    });

    // Singleton units for everyone still unmapped
    this.familyData.forEach(person => {
      if (this.personToUnit.has(person.id)) return;
      const uid  = `u_${person.id}`;
      const unit = this._makeUnit(uid, person);
      this.units.set(uid, unit);
      this.personToUnit.set(person.id, uid);
    });

    // Wire parent-child relationships between units.
    // We wire through the PRIMARY person of each child unit only, so each
    // unit ends up with exactly one parent unit.
    this.familyData.forEach(child => {
      const childUid = this.personToUnit.get(child.id);
      if (!childUid) return;
      const childUnit = this.units.get(childUid);
      if (!childUnit || childUnit.primaryId !== child.id) return; // only via primary

      // Prefer fid over mid for the parent unit lookup (preserves tree structure)
      const parentPersonId = child.fid || child.mid;
      if (!parentPersonId) return;

      const parentUid = this.personToUnit.get(parentPersonId);
      if (!parentUid || parentUid === childUid) return;

      const parentUnit = this.units.get(parentUid);
      if (!parentUnit) return;

      if (!parentUnit.childUnitIds.includes(childUid)) {
        parentUnit.childUnitIds.push(childUid);
      }
      childUnit.parentUnitId = parentUid;

      // Which marriage of the parent unit does this child belong to?
      // members = [primary, spouse1, spouse2, ...]; marriage i sits between
      // members[i-1] and members[i]. Unknown / single parent → marriage 1.
      const otherParent = (child.fid === parentUnit.primaryId) ? child.mid : child.fid;
      const idx = parentUnit.members.findIndex(m => m.id === otherParent);
      childUnit._marriageIdx = idx >= 1 ? idx : 1;
    });

    // Children of the same marriage sit together, in spouse order (stable sort)
    this.units.forEach(u => {
      u.childUnitIds.sort((a, b) =>
        (this.units.get(a)?._marriageIdx || 1) - (this.units.get(b)?._marriageIdx || 1));
    });

    // Build spouseOrigins map: secondary person → the unit containing their
    // own birth-family parents (so the user can navigate "up" Rekha's side).
    this.units.forEach(unit => {
      for (let i = 1; i < unit.members.length; i++) {
        const sec    = unit.members[i];
        const parId  = sec.fid || sec.mid;
        if (!parId) continue;
        const parUnitId = this.personToUnit.get(parId);
        if (parUnitId) this.spouseOrigins.set(sec.id, parUnitId);
      }
    });

    // For every unit, record BOTH parent-side IDs so the toggle button can
    // switch between "Surendra's lineage above" ↔ "Rekha's lineage above".
    this.units.forEach(unit => {
      unit._primaryParentUnitId = unit.parentUnitId || null;   // from fid/mid wiring
      unit._activeParentSide    = 'primary';
      if (unit.members.length >= 2) {
        for (let i = 1; i < unit.members.length; i++) {
          const altId = this.spouseOrigins.get(unit.members[i].id);
          if (altId) { unit._secondaryParentUnitId = altId; break; }
        }
      }
    });

    // Collect roots; assign generations depth-first
    this.rootUnits = [];
    this.units.forEach(u => { if (!u.parentUnitId) this.rootUnits.push(u); });

    const assignGen = (unit, gen) => {
      unit.generation = gen;
      unit.childUnitIds.forEach(cid => {
        const c = this.units.get(cid);
        if (c) assignGen(c, gen + 1);
      });
    };
    this.rootUnits.forEach(r => assignGen(r, 0));

  }

  _makeUnit(uid, primary) {
    return {
      id: uid, primaryId: primary.id,
      members: [primary], spouseIds: [],
      childUnitIds: [], parentUnitId: null,
      generation: 0,
      x: 0, y: 0, uw: 0, subtreeW: 0,
      _collapsed: false,
      _primaryParentUnitId:   null,  // primary person's birth-family parent unit
      _secondaryParentUnitId: null,  // secondary person's birth-family parent unit
      _activeParentSide:      'primary',  // which side is currently wired above
      _marriageIdx: 1,               // which marriage of the parent unit this child came from
      cx: 0, _childOffsets: [],      // layout: unit centre / child block lefts, relative to own block
    };
  }

  // ─── Layout ────────────────────────────────────────────────────────────────

  _unitOwnWidth(unit) {
    const n = unit.members.length;
    return n * this.CARD_W + (n - 1) * this.COUPLE_GAP;
  }

  // X-centre of the PRIMARY person's card within the unit.
  _primaryX(unit) {
    return unit.x - unit.uw / 2 + this.CARD_W / 2;
  }

  // X-centre of the SECONDARY person's card within the unit.
  _secondaryX(unit) {
    return unit.x - unit.uw / 2 + this.CARD_W + this.COUPLE_GAP + this.CARD_W / 2;
  }

  // X of the heart between members[i-1] and members[i]; card-centre for singles.
  _heartX(unit, i) {
    if (unit.members.length < 2) return unit.x;
    const k = Math.min(Math.max(i, 1), unit.members.length - 1);
    return unit.x - unit.uw / 2 + k * (this.CARD_W + this.COUPLE_GAP) - this.COUPLE_GAP / 2;
  }

  // Offset of the active person's card centre from the unit centre.
  _activeOffset(unit) {
    return this._activePersonX(unit) - unit.x;
  }

  // X-centre of whichever person's side is currently the active parent.
  // Connectors drop onto this card, and layout centres the parent over it.
  _activePersonX(unit) {
    if (unit._activeParentSide === 'secondary' && unit.members.length >= 2) {
      return this._secondaryX(unit);
    }
    return this._primaryX(unit);
  }

  // Walk up the parentUnitId chain from unitId and return the topmost root unit.
  _findChainRoot(unitId) {
    let cur = this.units.get(unitId);
    while (cur && cur.parentUnitId) {
      cur = this.units.get(cur.parentUnitId);
    }
    return cur || null;
  }

  _visibleChildren(unit) {
    if (unit._collapsed) return [];
    return unit.childUnitIds.map(id => this.units.get(id)).filter(Boolean);
  }

  computeLayout() {
    // Pass 1 (bottom-up): every unit gets a block [0, subtreeW] in its own
    // coordinates, with cx = where its centre sits inside that block and
    // _childOffsets = where each visible child's block starts. The parent is
    // centred over its children's active cards, and the block is widened so
    // the parent's own cards never spill past the block edge — that spill is
    // what made couple→single-child chains drift into their neighbours.
    const measure = (unit) => {
      unit.uw = this._unitOwnWidth(unit);
      const vc = this._visibleChildren(unit);
      if (!vc.length) {
        unit.subtreeW = unit.uw + this.H_GAP;
        unit.cx = unit.subtreeW / 2;
        unit._childOffsets = [];
        return;
      }
      vc.forEach(measure);

      let cursor = 0;
      const offsets = [];
      vc.forEach((c, i) => {
        if (i > 0) cursor += this.H_GAP;
        offsets.push(cursor);
        cursor += c.subtreeW;
      });
      const childTotal = cursor;

      // active-card x of first/last child, relative to the children block
      const activeRel = (c, off) => off + c.cx + this._activeOffsetRel(c);
      const parentRel = (activeRel(vc[0], offsets[0]) + activeRel(vc[vc.length - 1], offsets[vc.length - 1])) / 2;

      const left  = Math.min(0, parentRel - unit.uw / 2 - this.H_GAP / 2);
      const right = Math.max(childTotal, parentRel + unit.uw / 2 + this.H_GAP / 2);
      const shift = -left;

      unit.subtreeW      = right - left;
      unit.cx            = parentRel + shift;
      unit._childOffsets = offsets.map(o => o + shift);
    };

    // Pass 2 (top-down): turn relative blocks into absolute x/y
    const place = (unit, leftX, y) => {
      unit.x = leftX + unit.cx;
      unit.y = y;
      const vc = this._visibleChildren(unit);
      const childY = y + this.CARD_H + this.V_GAP;
      vc.forEach((c, i) => place(c, leftX + unit._childOffsets[i], childY));
    };

    let cursor = 0;
    this.rootUnits.forEach((root, i) => {
      if (this.hiddenRootUnitIds.has(root.id)) return;
      measure(root);
      if (i > 0) cursor += this.H_GAP * 3;
      place(root, cursor, 0);
      cursor += root.subtreeW;
    });
  }

  // Active card offset from unit centre, without needing unit.x yet.
  _activeOffsetRel(unit) {
    const n = unit.members.length;
    const uw = n * this.CARD_W + (n - 1) * this.COUPLE_GAP;
    if (unit._activeParentSide === 'secondary' && n >= 2) {
      return -uw / 2 + this.CARD_W + this.COUPLE_GAP + this.CARD_W / 2;
    }
    return -uw / 2 + this.CARD_W / 2;
  }

  // ─── Mount ─────────────────────────────────────────────────────────────────

  mountTree() {
    const treeRoot = document.getElementById('tree-root');
    if (!treeRoot) return;
    treeRoot.innerHTML = '<svg id="custom-tree" style="width:100%;height:100%;display:block;"></svg>';

    try {
      this.svg = d3.select('#custom-tree');

      this.zoomBehavior = d3.zoom()
        .scaleExtent([0.06, 4])
        .on('zoom', (e) => {
          this.g.attr('transform', e.transform);
          // Level-of-detail: simplify cards when zoomed far out
          this.svg.classed('ct-far', e.transform.k < this.LOD_THRESHOLD);
          this._rerenderIfNeeded(e.transform);
        });

      this.svg.call(this.zoomBehavior);
      this.g = this.svg.append('g').attr('class', 'ct-canvas');

      // Ensure a <defs> block exists for patterns
      this.svg.insert('defs', ':first-child');

      this.computeLayout();
      this.render();
      this.centerOnDefault();
    } catch (err) {
      console.error('CustomTree mount failed:', err);
      this.handleError(err);
    }
  }

  // ─── Viewport culling (big trees only) ─────────────────────────────────────
  //
  // A tree of thousands of people is tens of thousands of SVG nodes when fully
  // open, which makes every pan frame and every expand slow. Above BIG_TREE
  // people, render() draws only units within one screen of the viewport, and
  // far-zoomed cards without their detail group (CSS hides it there anyway),
  // and below TINY_ZOOM without the name label too. Panning or zooming past
  // the drawn area, or across one of those thresholds, redraws.

  // level of detail: 0 full card, 1 far (name label only), 2 tiny (plain card)
  _lod(k) { return k < this.TINY_ZOOM ? 2 : k < this.LOD_THRESHOLD ? 1 : 0; }

  // The visible area in tree coordinates, grown by `margin` screens on each side.
  _viewRect(t, margin) {
    const el = this.svg.node();
    const W = el.clientWidth || window.innerWidth, H = el.clientHeight || 600;
    const x0 = -t.x / t.k, y0 = -t.y / t.k, w = W / t.k, h = H / t.k;
    return { x0: x0 - w * margin, y0: y0 - h * margin, x1: x0 + w * (1 + margin), y1: y0 + h * (1 + margin) };
  }

  _rerenderIfNeeded(t) {
    const d = this._drawn;
    if (!d || this._rerenderQueued) return;
    const v = this._viewRect(t, 0), r = d.rect;
    const outside = v.x0 < r.x0 || v.x1 > r.x1 || v.y0 < r.y0 || v.y1 > r.y1;
    if (this._lod(t.k) === d.lod && (d.complete || !outside)) return;
    this._rerenderQueued = true;
    requestAnimationFrame(() => { this._rerenderQueued = false; this.render(); });
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  render() {
    if (!this.g) return;
    this.g.selectAll('*').remove();

    // Clear accumulated SVG patterns from previous renders
    this.svg.select('defs').selectAll('pattern').remove();

    const colors = this._themeColors();

    if (!this.familyData || this.familyData.length === 0) {
      const emptyG = this.g.append('g')
        .attr('class', 'ct-empty-tree')
        .attr('transform', 'translate(0, 0)')
        .style('cursor', 'pointer')
        .on('click', (e) => {
          e.stopPropagation();
          this.openCreatorPopover(e, { type: 'root', targetPerson: null });
        });

      emptyG.append('rect')
        .attr('x', -140).attr('y', -70)
        .attr('width', 280).attr('height', 140)
        .attr('rx', 16)
        .attr('fill', colors.cardBg)
        .attr('stroke', colors.accent)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '6,4');

      // Empty state vector graphic
      emptyG.append('path')
        .attr('d', 'M0 -44 C-14 -44 -24 -32 -18 -18 C-24 -14 -22 -2 -12 2 C-14 10 -4 14 0 16 C4 14 14 10 12 2 C22 -2 24 -14 18 -18 C24 -32 14 -44 0 -44 Z M0 16 L0 26')
        .attr('fill', 'none')
        .attr('stroke', colors.accent)
        .attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round');

      emptyG.append('text')
        .attr('x', 0).attr('y', 42)
        .attr('text-anchor', 'middle')
        .attr('fill', colors.textMain)
        .attr('font-family', 'Georgia, "Times New Roman", serif')
        .attr('font-size', 16)
        .attr('font-weight', 700)
        .text('Start Your Family Tree');

      emptyG.append('text')
        .attr('x', 0).attr('y', 64)
        .attr('text-anchor', 'middle')
        .attr('fill', colors.accent)
        .attr('font-size', 12)
        .text('Click to add first person');

      return;
    }

    const linksG = this.g.append('g').attr('class', 'ct-links');
    const nodesG = this.g.append('g').attr('class', 'ct-nodes');

    // big trees: draw only near the viewport (see _viewRect); small trees draw everything
    const big = this.familyData.length > this.BIG_TREE;
    const t = d3.zoomTransform(this.svg.node());
    const lod = big ? this._lod(t.k) : 0;
    const rect = big ? this._viewRect(t, 1) : null;
    let skipped = 0;
    const near = (x0, y0, x1, y1) => !rect || (x1 >= rect.x0 && x0 <= rect.x1 && y1 >= rect.y0 && y0 <= rect.y1) || (skipped++, false);

    const drawUnit = (unit) => {
      const vc = this._visibleChildren(unit);
      if (vc.length) {
        const a = vc[0], b = vc[vc.length - 1];
        if (near(Math.min(unit.x - unit.uw / 2, a.x - a.uw / 2), unit.y, Math.max(unit.x + unit.uw / 2, b.x + b.uw / 2), a.y)) this._renderLinks(linksG, unit, colors);
      }
      if (near(unit.x - unit.uw / 2 - 16, unit.y - 24, unit.x + unit.uw / 2 + 16, unit.y + this.CARD_H + 40)) this._renderUnit(nodesG, unit, colors, lod);
      if (!unit._collapsed) {
        unit.childUnitIds.forEach(cid => {
          const c = this.units.get(cid);
          if (c) drawUnit(c);
        });
      }
    };
    // Skip roots that have been hidden by a parent-side switch
    this.rootUnits.forEach(r => {
      if (!this.hiddenRootUnitIds.has(r.id)) drawUnit(r);
    });
    this._drawn = big ? { rect, lod, complete: !skipped } : null;
  }

  // ─── Unit rendering ────────────────────────────────────────────────────────

  _renderUnit(container, unit, colors, lod = 0) {
    const { x, y, members, id, _collapsed, childUnitIds } = unit;

    const g = container.append('g')
      .attr('class', 'ct-unit')
      .attr('data-unit-id', id);

    // Marriage line + heart between spouses — one segment per adjacent pair
    // (supports multi-spouse units, e.g. Dasharatha's three queens)
    if (members.length > 1) {
      const my = y + this.PHOTO_CY;   // align with the photo circles
      for (let i = 1; i < members.length; i++) {
      const lx = x - unit.uw / 2 + i * (this.CARD_W + this.COUPLE_GAP) - this.COUPLE_GAP;
      const rx = lx + this.COUPLE_GAP;
      g.append('line')
        .attr('x1', lx).attr('y1', my)
        .attr('x2', rx).attr('y2', my)
        .attr('stroke', colors.coupleLink)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,3');
      const midX = (lx + rx) / 2;
      g.append('path')
        .attr('d', `M${midX} ${my + 3} C${midX - 3.5} ${my} ${midX - 4.5} ${my - 2} ${midX - 4.5} ${my - 3.5} A2.2 2.2 0 0 1 ${midX} ${my - 3} A2.2 2.2 0 0 1 ${midX + 4.5} ${my - 3.5} C${midX + 4.5} ${my - 2} ${midX + 3.5} ${my} ${midX} ${my + 3} Z`)
        .attr('fill', colors.coupleLink);
      }
    }

    // Render each person card
    members.forEach((person, i) => {
      const cardX = x - unit.uw / 2 + i * (this.CARD_W + this.COUPLE_GAP);
      this._renderCard(g, person, cardX, y, colors, lod);
    });

    // Expand/collapse toggle — sits TOGGLE_OFFSET px below the card pair,
    // so it appears visually "just below" the heart symbol (not mid-gap).
    if (childUnitIds.length > 0) {
      const toggleY = y + this.CARD_H + this.TOGGLE_OFFSET;

      const toggle = g.append('g')
        .attr('class', 'ct-toggle')
        .attr('transform', `translate(${x},${toggleY})`)
        .style('cursor', 'pointer')
        .on('click', (e) => {
          e.stopPropagation();
          unit._collapsed = !unit._collapsed;
          this.computeLayout();
          this.render();
        });

      toggle.append('circle')
        .attr('r', this.TOGGLE_R)
        .attr('fill', colors.cardBg)
        .attr('stroke', colors.accent)
        .attr('stroke-width', 1.5);

      toggle.append('text')
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
        .attr('fill', colors.accent).attr('font-size', 16).attr('font-weight', 700)
        .text(_collapsed ? '+' : '\u2212');  // + or −

      // Invisible enlarged hit area (easier tapping on touch screens)
      toggle.append('circle')
        .attr('r', 20)
        .attr('fill', 'transparent');

      if (_collapsed) {
        toggle.append('title')
          .text(`${childUnitIds.length} child unit(s) — click to expand`);
      }
    }
  }

  // ─── Card rendering ────────────────────────────────────────────────────────

  _renderCard(container, person, x, y, colors, lod = 0) {
    const isAlive       = Number(person.is_alive) === 1;
    const isFocus       = CONFIG.DEFAULT_FOCUS_ID != null && person.id === CONFIG.DEFAULT_FOCUS_ID;
    const isHighlighted = person.id === this.highlightedId;
    const gender        = (person.gender || '').toLowerCase();

    const strokeColor = isHighlighted ? '#fbbf24' : isFocus ? colors.accent : colors.cardStroke;
    const strokeWidth = (isHighlighted || isFocus) ? 2.5 : 1.2;

    // Gender-tinted background — heritage warm tones
    let bgColor;
    if (isHighlighted) {
      bgColor = colors.hl;
    } else if (gender === 'female') {
      bgColor = colors.female;
    } else if (gender === 'male') {
      bgColor = colors.male;
    } else {
      bgColor = colors.cardBg;
    }

    const open = (e) => {
      e.stopPropagation();
      const member = this.familyData.find(m => m.id === person.id);
      if (member) {
        this.highlightedId = member.id;
        this.showMemberDetails(member);
        this.render();
      }
    };
    const g = container.append('g')
      .attr('class', 'ct-card' + (isHighlighted ? ' is-active' : ''))
      .attr('transform', `translate(${x},${y})`)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', person.name || 'Family member')
      .style('cursor', 'pointer')
      .on('click', open)
      .on('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); } });

    // Focus / highlight glow halo
    if (isFocus || isHighlighted) {
      g.append('rect')
        .attr('x', -4).attr('y', -4)
        .attr('width', this.CARD_W + 8).attr('height', this.CARD_H + 8)
        .attr('rx', colors.rx + 3)
        .attr('fill', isHighlighted ? 'rgba(251,191,36,0.12)' : 'rgba(212,166,67,0.10)');

      if (isHighlighted) {
        g.append('rect')
          .attr('class', 'ct-pulse-halo')
          .attr('x', -4).attr('y', -4)
          .attr('width', this.CARD_W + 8).attr('height', this.CARD_H + 8)
          .attr('rx', colors.rx + 3)
          .attr('fill', 'none')
          .attr('stroke', '#fbbf24')
          .attr('stroke-width', 2.5);
      }
    }

    // Card background rect
    g.append('rect')
      .attr('width', this.CARD_W).attr('height', this.CARD_H)
      .attr('rx', colors.rx)
      .attr('fill', bgColor)
      .attr('stroke', strokeColor)
      .attr('stroke-width', strokeWidth);

    // Photo-forward layout: circle top-centre, text centred beneath.
    // `gd` (detail group) hides at far zoom; a big name label shows instead.
    // far-zoomed big trees skip the detail group (hidden by CSS at that zoom anyway)
    // Life dates — "1942 – 2023", "b. 1972" or "d. 2023" (only what privacy
    // rules already expose; living members' DOB is stripped server-side)
    const yr = d => (d && /^\d{4}/.test(String(d))) ? String(d).slice(0, 4) : null;
    const by = yr(person.birth_date), dy = yr(person.death_date);
    const lifeDates = (by && dy) ? `${by} – ${dy}` : by ? `b. ${by}` : dy ? `d. ${dy}` : null;
    if (lod === 0) {
      const gd = g.append('g').attr('class', 'ct-detail');
      const ax = this.CARD_W / 2;
      const ay = this.PHOTO_CY;

      // ── Avatar ──────────────────────────────────────────────────────────────
      // Use SVG <pattern> fill on a circle — no clipPath coordinate-space issues.

      if (person.img) {
        // Register a pattern in <defs> (unique per person per render)
        const patId = `ct-pat-${person.id}`;
        const diam  = this.AVATAR_R * 2;
        const defs  = this.svg.select('defs');

        const pat = defs.append('pattern')
          .attr('id', patId)
          .attr('patternUnits', 'objectBoundingBox')
          .attr('width', 1).attr('height', 1);

        pat.append('image')
          .attr('href', person.img)         // modern SVG href
          .attr('xlink:href', person.img)   // legacy fallback for older WebKit
          .attr('x', 0).attr('y', 0)
          .attr('width', diam).attr('height', diam)
          .attr('preserveAspectRatio', 'xMidYMid slice');

        gd.append('circle')
          .attr('cx', ax).attr('cy', ay)
          .attr('r', this.AVATAR_R)
          .attr('fill', `url(#${patId})`);

      } else {
        // Initials avatar with gender-tinted heritage fill
        const fill = gender === 'female'
          ? colors.avFemale
          : colors.avMale;

        gd.append('circle')
          .attr('cx', ax).attr('cy', ay)
          .attr('r', this.AVATAR_R)
          .attr('fill', fill);

        gd.append('text')
          .attr('x', ax).attr('y', ay)
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
          .attr('fill', colors.textMain)
          .attr('font-family', colors.font)
          .attr('font-size', 20).attr('font-weight', 700)
          .text((person.name || '?').charAt(0).toUpperCase());
      }

      // Alive ring — green = alive, warm grey = deceased
      gd.append('circle')
        .attr('cx', ax).attr('cy', ay)
        .attr('r', this.AVATAR_R)
        .attr('fill', 'none')
        .attr('stroke', isAlive ? colors.alive : colors.dead)
        .attr('stroke-width', 2.5);

      // ── Text area — centred beneath the photo ────────────────────────────────
      const tx       = this.CARD_W / 2;
      const maxChars = 17;
      const trunc    = s => s && s.length > maxChars ? s.slice(0, maxChars - 1) + '\u2026' : (s || '');

      // Text rows — name (always, serif), nickname?, life dates? — centred
      const hasNick = Boolean(person.nickname);
      const rows = [{ text: trunc(person.name), size: 11.5, weight: 700, fill: colors.textMain, serif: true }];
      if (hasNick)    rows.push({ text: trunc(`"${person.nickname}"`), size: 9.5, italic: true, fill: colors.textMuted });
      if (lifeDates)  rows.push({ text: lifeDates, size: 9, fill: colors.textMuted });

      const textTop = this.PHOTO_CY + this.AVATAR_R + 18;   // first baseline below photo
      const lineH   = 14;
      rows.forEach((r, i) => {
        const t = gd.append('text')
          .attr('x', tx)
          .attr('y', textTop + i * lineH)
          .attr('text-anchor', 'middle')
          .attr('fill', r.fill)
          .attr('font-size', r.size)
          .attr('font-weight', r.weight || 400)
          .text(r.text);
        if (r.italic) t.attr('font-style', 'italic');
        if (r.serif)  t.attr('font-family', colors.font);
      });
      // (No alive/deceased text — the coloured ring communicates this)
    }

    // Far-zoom label — a single large first name shown when details are hidden
    if (lod < 2) g.append('text')
      .attr('class', 'ct-farlabel')
      .attr('x', this.CARD_W / 2).attr('y', this.CARD_H / 2)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('fill', colors.textMain)
      .attr('font-family', colors.font)
      .attr('font-size', 17).attr('font-weight', 700)
      .text((person.name || '').split(' ')[0]);

    // Full name on hover (truncated names get a native tooltip)
    g.append('title').text(person.name + (person.nickname ? ` "${person.nickname}"` : '') + (lifeDates ? ` · ${lifeDates}` : ''));

    // ── Family-side toggle button ─────────────────────────────────────────────
    // In a couple unit that has BOTH sides' parents known, the person whose
    // family is NOT currently shown above gets a + button at the top of their
    // card.  Clicking it re-wires the couple under that person's family and
    // moves the + to the other person.  No camera jump — viewport stays put.
    //
    //   Initial:  Surendra's parents above  →  + appears on Rekha's card
    //   Click +:  Rekha's parents above    →  + appears on Surendra's card
    //   Click +:  Surendra's parents above  →  + appears on Rekha's card  ...
    {
      const myUnitId = this.personToUnit.get(person.id);
      const myUnit   = myUnitId ? this.units.get(myUnitId) : null;

      if (myUnit && myUnit.members.length >= 2 && myUnit._secondaryParentUnitId) {
        const isPrimary     = (person.id === myUnit.primaryId);
        const onPrimarySide = (myUnit._activeParentSide === 'primary');

        // + on primary  → only when secondary side is active (primary family is hidden)
        // + on secondary → only when primary side is active (secondary family is hidden)
        const showBtn = isPrimary ? !onPrimarySide : onPrimarySide;

        if (showBtn) {
          const targetSide = isPrimary ? 'primary' : 'secondary';

          const originBtn = g.append('g')
            .attr('class', 'ct-origin-btn')
            .attr('transform', `translate(${this.CARD_W / 2}, -11)`)
            .style('cursor', 'pointer')
            .on('click', (e) => {
              e.stopPropagation();
              this._switchParentSide(myUnit, myUnitId, targetSide);
            });

          originBtn.append('circle')
            .attr('r', 9)
            .attr('fill', colors.accent)
            .attr('stroke', colors.cardBg)
            .attr('stroke-width', 1.5);

          originBtn.append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', colors.cardBg)
            .attr('font-size', 13)
            .attr('font-weight', 700)
            .text('+');

          originBtn.append('title')
            .text('Show ' + (person.name || 'this person') + '\u2019s family above');
        }
      }
    }

    // ── Flowchart Builder Directional Handles ─────────────────────────────
    if (this.builderMode) {
      this._renderNodeHandles(g, person, colors);
    }
  }

  // ─── Parent-side switch ────────────────────────────────────────────────────
  //
  // Detaches `unit` from its current parent and re-wires it under the chosen
  // side's parent.  The viewport never moves — only tree structure changes.

  _switchParentSide(unit, unitId, targetSide) {
    const targetParentId  = targetSide === 'primary'
      ? unit._primaryParentUnitId
      : unit._secondaryParentUnitId;
    const currentParentId = unit.parentUnitId;

    if (targetParentId === currentParentId) {
      unit._activeParentSide = targetSide;
      this.computeLayout();
      this.render();
      return;
    }

    // ── 1. Detach from current parent ──────────────────────────────────────
    const currentParent = this.units.get(currentParentId);
    if (currentParent) {
      currentParent.childUnitIds =
        currentParent.childUnitIds.filter(id => id !== unitId);
    }

    // ── 2. Attach to new parent ────────────────────────────────────────────
    if (targetParentId) {
      const targetParent = this.units.get(targetParentId);
      if (!targetParent) return;
      if (!targetParent.childUnitIds.includes(unitId)) {
        targetParent.childUnitIds.push(unitId);
      }
    }

    unit.parentUnitId      = targetParentId || null;
    unit._activeParentSide = targetSide;

    // ── 2b. Co-switch all sibling couples sharing the same secondary parent ─
    // e.g. when Alka's + is clicked (Vijay Sinha is secondary parent), Kanchan
    // and Binita (also Vijay's children) must also be pulled into his tree.
    // On the return trip (targetSide === 'primary') they all go back.
    if (targetSide === 'secondary' && targetParentId) {
      this.units.forEach((u, uid) => {
        if (uid === unitId) return;                              // skip self
        if (u._secondaryParentUnitId !== targetParentId) return; // different secondary parent
        if (u.parentUnitId === targetParentId) return;          // already here
        // Detach from current primary parent
        const sib_curPar = this.units.get(u.parentUnitId);
        if (sib_curPar) {
          sib_curPar.childUnitIds = sib_curPar.childUnitIds.filter(id => id !== uid);
        }
        // Attach to shared secondary parent
        const sib_secPar = this.units.get(targetParentId);
        if (sib_secPar && !sib_secPar.childUnitIds.includes(uid)) {
          sib_secPar.childUnitIds.push(uid);
        }
        u.parentUnitId      = targetParentId;
        u._activeParentSide = 'secondary';
      });
    } else if (targetSide === 'primary') {
      // Return all siblings that were co-switched back to their primary parents
      const secParentId = unit._secondaryParentUnitId;
      if (secParentId) {
        this.units.forEach((u, uid) => {
          if (uid === unitId) return;
          if (u._secondaryParentUnitId !== secParentId) return;
          if (u.parentUnitId !== secParentId) return;          // not co-switched, skip
          // Detach from secondary parent
          const sib_secPar = this.units.get(secParentId);
          if (sib_secPar) {
            sib_secPar.childUnitIds = sib_secPar.childUnitIds.filter(id => id !== uid);
          }
          // Reattach to own primary parent
          const sib_primPar = this.units.get(u._primaryParentUnitId);
          if (sib_primPar && !sib_primPar.childUnitIds.includes(uid)) {
            sib_primPar.childUnitIds.push(uid);
          }
          u.parentUnitId      = u._primaryParentUnitId || null;
          u._activeParentSide = 'primary';
        });
      }
    }

    // ── 3. Expand new parent's ancestors so the full lineage is visible ───
    let uid = targetParentId;
    while (uid) {
      const u = this.units.get(uid);
      if (!u) break;
      u._collapsed = false;
      uid = u.parentUnitId;
    }

    // ── 4. Expand the target parent's entire subtree so siblings show too ─
    // e.g. when Vidya's side opens and Jogendra appears, Harendra's full
    // branch (Jogendra's other child) should also be expanded automatically.
    const _expandSubtree = (u, depth) => {
      if (!u || depth > 20) return;
      u._collapsed = false;
      u.childUnitIds.forEach(cid => _expandSubtree(this.units.get(cid), depth + 1));
    };
    _expandSubtree(this.units.get(targetParentId), 0);

    // ── 5. Recompute roots ────────────────────────────────────────────────
    this.rootUnits = [];
    this.units.forEach(u => { if (!u.parentUnitId) this.rootUnits.push(u); });

    // ── 6. Hide ALL roots except the newly active lineage's root ─────────
    // This ensures only one family tree is visible at a time, regardless of
    // how many secondary-origin roots exist (Vijay Sinha, Mukund Lal, etc.)
    const activeRoot = this._findChainRoot(unitId);
    this.hiddenRootUnitIds.clear();
    this.rootUnits.forEach(r => {
      if (!activeRoot || r.id !== activeRoot.id) {
        this.hiddenRootUnitIds.add(r.id);
      }
    });

    this.computeLayout();
    this.render();

    // ── 7. Center camera on the person whose side just became active ──────
    // Secondary side active → focus Rekha; primary side → focus Surendra.
    const focusPerson = targetSide === 'secondary'
      ? unit.members[1]
      : unit.members[0];
    if (focusPerson) this._centerOnPersonId(focusPerson.id);
  }

  // ─── Link rendering ────────────────────────────────────────────────────────
  //
  // Connector shape (couple parent → children):
  //
  //   [heart] ← heart at (unit.x, y + CARD_H/2)
  //   │   ← vertical spine from heart, behind cards (hidden until card bottom)
  //   │   ← spine continues below card bottom (visible here)
  //  [●]  ← toggle button at y + CARD_H + TOGGLE_OFFSET
  //   │
  //   ├───────────────┬──────────────┐   ← horizontal bar at midY,
  //   │               │              │     aligned to _activePersonX of each child
  //  [P₁…]          [P₂…]         [P₃…]  ← drops land on the active person's card

  _renderLinks(container, unit, colors) {
    const vc = this._visibleChildren(unit);
    if (!vc.length) return;

    const isCouple = unit.members.length > 1;
    const py = unit.y + this.CARD_H;                    // card bottom
    const cy = vc[0].y;                                 // top of child row
    const line = (x1, y1, x2, y2) => container.append('line')
      .attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2)
      .attr('stroke', colors.linkLine).attr('stroke-width', 1.5);

    // Group children by the marriage they came from (already sorted that way)
    const groups = new Map();
    vc.forEach(c => {
      const k = isCouple ? (c._marriageIdx || 1) : 0;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(c);
    });

    let gi = 0;
    groups.forEach((kids, k) => {
      // Spine starts at this marriage's heart (or the single parent's card bottom)
      const sx   = isCouple ? this._heartX(unit, k) : unit.x;
      const sy   = isCouple ? unit.y + this.PHOTO_CY : py;
      // Stagger elbows a little so bars of different marriages never merge
      const midY = py + (cy - py) * 0.55 - (groups.size - 1 - gi) * 8;
      gi++;

      line(sx, sy, sx, midY);

      const drops = kids.map(c => this._activePersonX(c));
      const lx = Math.min(sx, ...drops);
      const rx = Math.max(sx, ...drops);
      if (rx - lx > 0.5) line(lx, midY, rx, midY);
      kids.forEach((c, i) => line(drops[i], midY, drops[i], cy));
    });
  }

  // ─── Theme ─────────────────────────────────────────────────────────────────

  _themeColors() {
    // the family's chosen tree look (assets/tree-themes.js), light or dark
    const p = window.ftTreePalette ? window.ftTreePalette() : null;
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    if (!p) return { isDark, cardBg: isDark ? '#262019' : '#fffdf6', cardStroke: isDark ? '#4a3f2e' : '#ddd2b8', accent: isDark ? '#d4a643' : '#a16207', linkLine: isDark ? '#6b5f49' : '#b5a98e', textMain: isDark ? '#ede5d4' : '#332e24', textMuted: isDark ? '#a3977f' : '#8a7f68', coupleLink: isDark ? '#d98ca6' : '#c26d8c', male: isDark ? '#232a20' : '#f2f4e8', female: isDark ? '#2e2126' : '#fbf1ec', hl: isDark ? '#3a301a' : '#fdf3d7', avMale: isDark ? '#3a4634' : '#dde3c9', avFemale: isDark ? '#54353f' : '#f3d9cf', alive: '#4d7c0f', dead: '#a8a29e', rx: 12, font: 'Georgia, "Times New Roman", serif' };
    return { isDark: p.isDark, cardBg: p.card, cardStroke: p.stroke, accent: p.accent, linkLine: p.line, textMain: p.text, textMuted: p.muted, coupleLink: p.couple,
      male: p.male, female: p.female, hl: p.hl, avMale: p.avMale, avFemale: p.avFemale, alive: p.alive, dead: p.dead, rx: p.rx, font: p.font };
  }

  // ─── Navigation ────────────────────────────────────────────────────────────

  centerOnDefault() {
    const focusId = CONFIG.DEFAULT_FOCUS_ID;
    const member  = this.familyData.find(m => m.id === focusId);
    if (member) {
      this.highlightedId = focusId;
      this.render();
      this._centerOnPersonId(focusId);
      this.showMemberDetails(member);
    } else if (this.rootUnits.length) {
      const visibleRoot = this.rootUnits.find(r => !this.hiddenRootUnitIds.has(r.id)) || this.rootUnits[0];
      this._centerOnUnit(visibleRoot);
    }
  }

  _centerOnPersonId(personId) {
    const uid = this.personToUnit.get(personId);
    if (uid) this._centerOnUnit(this.units.get(uid));
  }

  _centerOnUnit(unit) {
    if (!unit) return;
    const el = this.svg.node();
    const W  = el.clientWidth  || window.innerWidth;
    const H  = el.clientHeight || 600;
    const tx = W / 2 - unit.x;
    const ty = H / 3 - (unit.y + this.CARD_H / 2);
    this.svg.transition().duration(700)
      .call(this.zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(1));
  }

  fitToScreen() {
    let minX =  Infinity, minY =  Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    const walk = (unit) => {
      minX = Math.min(minX, unit.x - unit.uw / 2);
      minY = Math.min(minY, unit.y);
      maxX = Math.max(maxX, unit.x + unit.uw / 2);
      maxY = Math.max(maxY, unit.y + this.CARD_H);
      if (!unit._collapsed) {
        unit.childUnitIds.forEach(cid => {
          const c = this.units.get(cid);
          if (c) walk(c);
        });
      }
    };
    this.rootUnits.forEach(r => walk(r));

    const el  = this.svg.node();
    const W   = el.clientWidth  || window.innerWidth;
    const H   = el.clientHeight || 600;
    const pad = 60;
    const scale = Math.min(W / (maxX - minX + pad * 2), H / (maxY - minY + pad * 2), 1.5);
    const tx    = (W - (maxX + minX) * scale) / 2;
    const ty    = (H - (maxY + minY) * scale) / 2;
    this.svg.transition().duration(700)
      .call(this.zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  // ─── Search ────────────────────────────────────────────────────────────────

  searchAndHighlight(query) {
    if (!query || !query.trim()) {
      this.highlightedId = null;
      this.render();
      return;
    }
    const q     = query.toLowerCase().trim();
    const match = this.familyData.find(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.nickname || '').toLowerCase().includes(q)
    );
    if (!match) return;

    // Expand path to matched unit
    let uid = this.personToUnit.get(match.id);
    while (uid) {
      const u = this.units.get(uid);
      if (!u) break;
      u._collapsed = false;
      uid = u.parentUnitId;
    }

    this.highlightedId = match.id;
    this.computeLayout();
    this.render();
    this._centerOnPersonId(match.id);
    const member = this.familyData.find(m => m.id === match.id);
    if (member) this.showMemberDetails(member);
  }

  // ─── Flowchart Builder Directional Handles ─────────────────────────────────
  _renderNodeHandles(cardG, person, colors) {
    const handlesG = cardG.append('g').attr('class', 'ct-card-handles');

    const myUnitId = this.personToUnit.get(person.id);
    const unit = myUnitId ? this.units.get(myUnitId) : null;
    const isCouple = unit && unit.members && unit.members.length > 1;
    const isPrimary = unit && person.id === unit.primaryId;

    const hasOriginBtn = Boolean(unit && isCouple && unit._secondaryParentUnitId);

    const handles = [];

    // 1. Top: Parent handle
    const topX = hasOriginBtn ? 24 : (this.CARD_W / 2);
    handles.push({
      type: 'parent',
      cx: topX,
      cy: -13,
      icon: 'UP',
      tooltip: `Add parent of ${person.name}`
    });

    // 2. Bottom: Child handle
    handles.push({
      type: 'child',
      cx: this.CARD_W / 2,
      cy: this.CARD_H + 13,
      icon: 'DOWN',
      tooltip: `Add child of ${person.name}`
    });

    // 3. Left handle: Sibling handle
    handles.push({
      type: 'sibling',
      cx: -13,
      cy: this.PHOTO_CY,
      icon: '⇄',
      tooltip: `Add sibling of ${person.name}`
    });

    // 4. Spouse handle
    const memberIndex = unit && unit.members ? unit.members.indexOf(person) : 0;
    const isRightmost = (unit && unit.members) ? (memberIndex === unit.members.length - 1) : true;

    if (isRightmost) {
      handles.push({
        type: 'spouse',
        cx: this.CARD_W + 13,
        cy: this.PHOTO_CY,
        icon: 'spouse',
        tooltip: `Add spouse of ${person.name}`
      });
    } else {
      handles.push({
        type: 'spouse',
        cx: this.CARD_W - 14,
        cy: -11,
        icon: 'spouse',
        tooltip: `Add spouse of ${person.name}`
      });
    }

    handles.forEach(h => {
      const hg = handlesG.append('g')
        .attr('class', `ct-handle ct-handle-${h.type}`)
        .attr('transform', `translate(${h.cx}, ${h.cy})`)
        .style('cursor', 'pointer')
        .on('click', (event) => {
          event.stopPropagation();
          this.openCreatorPopover(person, h.type, {
            unit: unit,
            sourceEvent: event
          });
        });

      hg.append('circle')
        .attr('r', 11)
        .attr('fill', colors.accent)
        .attr('stroke', colors.cardBg)
        .attr('stroke-width', 2);

      if (h.type === 'parent') {
        hg.append('path')
          .attr('d', 'M0 -4 L-3.5 0 L-1.2 0 L-1.2 4 L1.2 4 L1.2 0 L3.5 0 Z')
          .attr('fill', '#ffffff');
      } else if (h.type === 'child') {
        hg.append('path')
          .attr('d', 'M0 4 L-3.5 0 L-1.2 0 L-1.2 -4 L1.2 -4 L1.2 0 L3.5 0 Z')
          .attr('fill', '#ffffff');
      } else if (h.type === 'sibling') {
        hg.append('path')
          .attr('d', 'M-4 0 L-1 -2.5 L-1 -0.8 L1 -0.8 L1 -2.5 L4 0 L1 2.5 L1 0.8 L-1 0.8 L-1 2.5 Z')
          .attr('fill', '#ffffff');
      } else if (h.type === 'spouse') {
        hg.append('path')
          .attr('d', 'M0 3 C-2.8 0.5 -3.8 -1.2 -3.8 -2.4 A1.8 1.8 0 0 1 0 -2 A1.8 1.8 0 0 1 3.8 -2.4 C3.8 -1.2 2.8 0.5 0 3 Z')
          .attr('fill', '#ffffff');
      } else {
        hg.append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('fill', '#ffffff')
          .attr('font-size', 10)
          .attr('font-weight', 700)
          .text('+');
      }

      hg.append('title').text(h.tooltip);
    });
  }

  // ─── Node Creator Popover (Builder Mode) ──────────────────────────────────

  openCreatorPopover(targetPerson, relationType, options = {}) {
    const popover = document.getElementById('nodeCreatorPopover');
    if (!popover) return;

    this.activePopoverContext = {
      targetPerson: targetPerson,
      type: relationType,
      presetGender: options.presetGender || null,
      unit: options.unit || null
    };

    const shell = document.querySelector('.tree-shell');
    if (shell) {
      const shellRect = shell.getBoundingClientRect();
      const popoverW = 280;
      const popoverH = 220;
      let left, top;

      const event = options.sourceEvent;
      const handleRect = (event && event.currentTarget) ? event.currentTarget.getBoundingClientRect() : null;

      if (handleRect) {
        left = handleRect.left - shellRect.left + (handleRect.width / 2) - (popoverW / 2);
        top  = handleRect.bottom - shellRect.top + 10;
        if (top + popoverH > shellRect.height - 16) {
          top = handleRect.top - shellRect.top - popoverH - 10;
        }
      } else {
        left = Math.max(16, shellRect.width - popoverW - 24);
        top  = 75;
      }

      left = Math.max(12, Math.min(shellRect.width - popoverW - 12, left));
      top  = Math.max(12, Math.min(shellRect.height - popoverH - 12, top));

      popover.style.left = `${left}px`;
      popover.style.top  = `${top}px`;
      popover.hidden = false;
    }

    const titleEl   = document.getElementById('ncpTitle');
    const submitBtn = document.getElementById('ncpSubmitBtn');
    const nameInput = document.getElementById('ncpName');
    const maleRad   = document.getElementById('ncpGenderMale');
    const femRad    = document.getElementById('ncpGenderFemale');
    const aliveChk  = document.getElementById('ncpIsAlive');

    const context = this.activePopoverContext;

    const p = context.targetPerson;
    const targetName = p ? (p.name || 'Relative').split(' ')[0] : 'Family';

    if (aliveChk) aliveChk.checked = true;

    if (context.type === 'parent') {
      const isFather = context.presetGender === 'male';
      const isMother = context.presetGender === 'female';
      if (isFather) {
        if (titleEl) titleEl.textContent = `Add Father of ${targetName}`;
        if (submitBtn) submitBtn.querySelector('span').textContent = 'Add Father';
        if (maleRad) maleRad.checked = true;
      } else if (isMother) {
        if (titleEl) titleEl.textContent = `Add Mother of ${targetName}`;
        if (submitBtn) submitBtn.querySelector('span').textContent = 'Add Mother';
        if (femRad) femRad.checked = true;
      } else {
        if (titleEl) titleEl.textContent = `Add Parent of ${targetName}`;
        if (submitBtn) submitBtn.querySelector('span').textContent = 'Add Parent';
        if (p && p.fid && !p.mid) {
          if (femRad) femRad.checked = true;
        } else {
          if (maleRad) maleRad.checked = true;
        }
      }
    } else if (context.type === 'child') {
      if (titleEl) titleEl.textContent = `Add Child of ${targetName}`;
      if (submitBtn) submitBtn.querySelector('span').textContent = 'Add Child';
      if (maleRad) maleRad.checked = true;
    } else if (context.type === 'spouse') {
      if (titleEl) titleEl.textContent = `Add Spouse of ${targetName}`;
      if (submitBtn) submitBtn.querySelector('span').textContent = 'Add Spouse';
      const targetGender = (p?.gender || '').toLowerCase();
      if (targetGender === 'male') {
        if (femRad) femRad.checked = true;
      } else {
        if (maleRad) maleRad.checked = true;
      }
    } else if (context.type === 'sibling') {
      if (titleEl) titleEl.textContent = `Add Sibling of ${targetName}`;
      if (submitBtn) submitBtn.querySelector('span').textContent = 'Add Sibling';
      if (maleRad) maleRad.checked = true;
    } else if (context.type === 'root') {
      if (titleEl) titleEl.textContent = 'Add First Family Member';
      if (submitBtn) submitBtn.querySelector('span').textContent = 'Add First Person';
      if (maleRad) maleRad.checked = true;
    }

    if (nameInput) {
      nameInput.value = '';
      setTimeout(() => nameInput.focus(), 60);
    }
  }

  closeCreatorPopover() {
    const popover = document.getElementById('nodeCreatorPopover');
    if (popover) popover.hidden = true;
    this.activePopoverContext = null;
  }

  async submitCreatorPopover() {
    if (!this.activePopoverContext) return;
    const context = this.activePopoverContext;
    const P = context.targetPerson;

    const nameInput = document.getElementById('ncpName');
    const name = (nameInput?.value || '').trim();
    if (!name) {
      nameInput?.focus();
      return;
    }

    const gender = document.querySelector('input[name="ncpGender"]:checked')?.value || 'male';
    const isAlive = document.getElementById('ncpIsAlive')?.checked ? 1 : 0;
    const submitBtn = document.getElementById('ncpSubmitBtn');

    if (submitBtn) {
      submitBtn.disabled = true;
      const span = submitBtn.querySelector('span');
      if (span) span.textContent = 'Saving...';
    }

    try {
      const payload = {
        name,
        gender,
        is_alive: isAlive
      };

      // Relationship linking
      if (context.type === 'child' && P) {
        const pGender = (P.gender || '').toLowerCase();
        const spouseId = Array.isArray(P.pids) && P.pids.length ? P.pids[0] : null;
        if (pGender === 'female') {
          payload.mid = P.id;
          if (spouseId) payload.fid = spouseId;
        } else {
          payload.fid = P.id;
          if (spouseId) payload.mid = spouseId;
        }
      } else if (context.type === 'spouse' && P) {
        payload.pids = [P.id];
      } else if (context.type === 'sibling' && P) {
        if (P.fid) payload.fid = P.fid;
        if (P.mid) payload.mid = P.mid;
        if (!P.fid && !P.mid) {
          const pRes = await fetch('/admin/admin-api.php', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': (typeof window !== 'undefined' && window.FT_CSRF_TOKEN) ? window.FT_CSRF_TOKEN : ''
            },
            body: JSON.stringify({ name: `Parent of ${P.name}`, gender: 'male', is_alive: 1 })
          });
          if (pRes.ok) {
            const sharedParent = await pRes.json();
            this.familyData.push(sharedParent);
            payload.fid = sharedParent.id;
            P.fid = sharedParent.id;
            await fetch(`/admin/admin-api.php?id=${P.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': (typeof window !== 'undefined' && window.FT_CSRF_TOKEN) ? window.FT_CSRF_TOKEN : ''
              },
              body: JSON.stringify({ ...P, fid: sharedParent.id })
            });
          }
        }
      } else if (context.type === 'parent' && P) {
        if (gender === 'male' && P.mid) {
          payload.pids = [P.mid];
        } else if (gender === 'female' && P.fid) {
          payload.pids = [P.fid];
        }
      }

      const res = await fetch('/admin/admin-api.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': (typeof window !== 'undefined' && window.FT_CSRF_TOKEN) ? window.FT_CSRF_TOKEN : ''
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        alert('You need to be logged into the Admin panel to add members.\nClick "Log in" at the top right.');
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to save member');
      }

      const newMember = data;

      // If we added a Parent, update the child P's fid or mid
      if (context.type === 'parent' && P) {
        const parentField = gender === 'female' ? 'mid' : 'fid';
        P[parentField] = newMember.id;
        await fetch(`/admin/admin-api.php?id=${P.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': (typeof window !== 'undefined' && window.FT_CSRF_TOKEN) ? window.FT_CSRF_TOKEN : ''
          },
          body: JSON.stringify({ ...P, [parentField]: newMember.id })
        });

        this.familyData.forEach(m => {
          if (m.id !== P.id) {
            if (gender === 'male' && P.mid && m.mid === P.mid && !m.fid) {
              m.fid = newMember.id;
            } else if (gender === 'female' && P.fid && m.fid === P.fid && !m.mid) {
              m.mid = newMember.id;
            }
          }
        });
      }

      // Add new member to local memory
      this.familyData.push(newMember);

      // If spouse: update local pids on P
      if (context.type === 'spouse' && P) {
        if (!Array.isArray(P.pids)) P.pids = [];
        if (!P.pids.includes(newMember.id)) P.pids.push(newMember.id);
      }

      this.updateStats();
      this.closeCreatorPopover();

      this.buildFamilyUnits();
      this.computeLayout();
      this.render();

      this.focusOnPerson(newMember.id);

      // Re-sync right member panel if open
      if (window._mpCurrentMemberId) {
        const curMember = this.familyData.find(m => m.id === window._mpCurrentMemberId);
        if (curMember && typeof openMemberPanel === 'function') {
          openMemberPanel(curMember, dataUtils.findRelatives(curMember, this.familyData));
        }
      }

      this._showNotification(`Added ${newMember.name} to tree!`);

    } catch (err) {
      console.error('Failed to create member:', err);
      alert('Error: ' + (err.message || 'Could not save member'));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        const span = submitBtn.querySelector('span');
        if (span) span.textContent = 'Add Relative';
      }
    }
  }

  toggleBuilderMode() {
    this.builderMode = !this.builderMode;
    this.render();
    if (!this.builderMode) {
      this.closeCreatorPopover();
    }
    return this.builderMode;
  }

  _showNotification(msg) {
    let toast = document.getElementById('ftToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'ftToast';
      toast.className = 'ft-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  _setupGlobalEvents() {
    document.addEventListener('click', (e) => {
      const popover = document.getElementById('nodeCreatorPopover');
      if (popover && !popover.hidden) {
        if (!e.target.closest('#nodeCreatorPopover') && !e.target.closest('.ct-handle') && !e.target.closest('.ct-empty-tree')) {
          this.closeCreatorPopover();
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeCreatorPopover();
      }
    });
  }

  // ─── Fullscreen ────────────────────────────────────────────────────────────

  toggleFullscreen(force) {
    const shell = document.querySelector('.tree-shell');
    if (!shell) return;
    this.isFullscreen = (typeof force === 'boolean') ? force : !this.isFullscreen;
    shell.classList.toggle('fullscreen', this.isFullscreen);
    if (typeof window !== 'undefined' && typeof window.updateFullscreenUI === 'function') {
      window.updateFullscreenUI(this.isFullscreen);
    }
    setTimeout(() => this.fitToScreen(), 150);
  }

  exitFullscreen() {
    if (!this.isFullscreen) return;
    this.toggleFullscreen(false);
  }

  // ─── Controller overrides ──────────────────────────────────────────────────

  showMemberDetails(member) {
    openMemberPanel(member, dataUtils.findRelatives(member, this.familyData));
  }

  onThemeChange() { this.render(); }

  onExpandChange(isExpanded) {
    this.units.forEach(u => { u._collapsed = !isExpanded; });
    this.computeLayout();
    this.render();
  }

  onOrientationChange(orientation) {
    this.orientation = orientation;
    this.computeLayout();
    this.render();
  }

  onCenter() { this.fitToScreen(); }

  // ─── Search (wired to the shell search box) ────────────────────────────────
  // BUGFIX: shell.js has always called searchAndHighlight(), but the method
  // was never implemented — typing in search did nothing.

  searchAndHighlight(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) {
      this.highlightedId = null;
      this.render();
      return;
    }

    const match = this.familyData.find(m =>
      (m.name || '').toLowerCase().includes(q) ||
      (m.nickname || '').toLowerCase().includes(q));
    if (!match) return;

    this._revealAndCenter(match.id);
  }

  /**
   * Deep-link focus: /tree/{slug}?focus={id} — expands the person's branch,
   * centres the camera on them and opens their member panel.
   */
  focusOnPerson(personId) {
    const member = this.familyData.find(m => m.id === personId);
    if (!member) return;
    this._revealAndCenter(personId);
    this.showMemberDetails(member);
  }

  /** Shared: highlight + expand ancestors + reveal hidden branch + centre. */
  _revealAndCenter(personId) {
    this.highlightedId = personId;

    let uid = this.personToUnit.get(personId);
    let topUid = null;
    while (uid) {
      const u = this.units.get(uid);
      if (!u) break;
      u._collapsed = false;
      topUid = uid;
      uid = u.parentUnitId;
    }
    if (topUid && this.hiddenRootUnitIds.has(topUid)) {
      this.hiddenRootUnitIds.delete(topUid);
    }

    this.computeLayout();
    this.render();
    this._centerOnPersonId(personId);
  }

  // ─── Touch-friendly zoom controls (used by shell FAB buttons) ─────────────

  zoomIn()  { this._zoomBy(1.35); }
  zoomOut() { this._zoomBy(1 / 1.35); }

  _zoomBy(factor) {
    if (!this.svg || !this.zoomBehavior) return;
    this.svg.transition().duration(200)
      .call(this.zoomBehavior.scaleBy, factor);
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const view = new CustomTreeView();
  view.init().catch(err => console.error('CustomTree init failed:', err));
  window.customTreeView = view;
});
