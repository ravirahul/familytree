/**
 * assets/emblems.js - the built-in family emblems.
 *
 * Each emblem is a medallion: a ring and a motif, drawn with strokes only, in
 * currentColor, on a 100x100 canvas. One colour, so a family picks a shade and
 * the whole mark takes it. Used by the viewer header, the member card, the
 * admin picker, and rendered to PNG (tools/render-emblems.mjs) for the share
 * card and the favicon.
 *
 *   window.FT_EMBLEMS = { banyan: { name, svg }, ... }
 *   window.ftEmblemSvg(id, color, size) -> '<svg ...>'
 */
(function () {
  const ring = '<circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="50" cy="50" r="40.5" fill="none" stroke="currentColor" stroke-width="1" opacity=".55"/>';
  const S = 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
  const E = {
    banyan: { name: 'Banyan', svg: `<g ${S}><path d="M50 78V48"/><path d="M50 48c-14 0-24-8-24-18 0-9 8-14 14-12 2-7 10-10 16-6 6-4 15-1 16 7 7 0 11 6 11 11 0 10-10 18-23 18"/><path d="M38 52v22M62 52v22M30 56v12M70 56v12"/><path d="M26 78h48"/></g>` },
    peepal: { name: 'Peepal leaf', svg: `<g ${S}><path d="M50 22c16 6 24 18 24 30 0 10-8 18-18 18l-6 10-6-10c-10 0-18-8-18-18 0-12 8-24 24-30z"/><path d="M50 30v36"/><path d="M50 44l-10-6M50 44l10-6M50 56l-9-5M50 56l9-5"/></g>` },
    lotus: { name: 'Lotus', svg: `<g ${S}><path d="M50 30c7 8 9 18 6 28-3-10-6-20-6-28z"/><path d="M50 30c-7 8-9 18-6 28 3-10 6-20 6-28z"/><path d="M36 36c10 4 14 14 13 24-7-6-12-14-13-24z"/><path d="M64 36c-10 4-14 14-13 24 7-6 12-14 13-24z"/><path d="M26 48c10 0 18 6 22 14-9 0-17-5-22-14z"/><path d="M74 48c-10 0-18 6-22 14 9 0 17-5 22-14z"/><path d="M30 66c6 4 12 6 20 6s14-2 20-6"/></g>` },
    sun: { name: 'Sun', svg: `<g ${S}><circle cx="50" cy="50" r="13"/><path d="M50 22v8M50 70v8M22 50h8M70 50h8M30 30l6 6M64 64l6 6M30 70l6-6M64 36l6-6"/></g>` },
    moon: { name: 'Crescent and star', svg: `<g ${S}><path d="M58 26a24 24 0 1 0 12 44 20 20 0 1 1-12-44z"/><path d="M66 42l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z"/></g>` },
    mountain: { name: 'Mountain', svg: `<g ${S}><path d="M24 70l16-28 8 12 6-10 22 26z"/><path d="M40 42l4 6 4-4"/><path d="M28 70h44"/><circle cx="66" cy="34" r="5"/></g>` },
    river: { name: 'River', svg: `<g ${S}><path d="M26 40c8-6 16-6 24 0s16 6 24 0"/><path d="M26 52c8-6 16-6 24 0s16 6 24 0"/><path d="M26 64c8-6 16-6 24 0s16 6 24 0"/></g>` },
    wheat: { name: 'Wheat', svg: `<g ${S}><path d="M50 78V34"/><path d="M50 40c-6-2-10-6-10-12 6 0 10 4 10 12zM50 40c6-2 10-6 10-12-6 0-10 4-10 12z"/><path d="M50 50c-6-2-10-6-10-12 6 0 10 4 10 12zM50 50c6-2 10-6 10-12-6 0-10 4-10 12z"/><path d="M50 60c-6-2-10-6-10-12 6 0 10 4 10 12zM50 60c6-2 10-6 10-12-6 0-10 4-10 12z"/><path d="M50 34c0-6 2-9 4-12"/></g>` },
    lion: { name: 'Lion', svg: `<g ${S}><circle cx="50" cy="50" r="19"/><path d="M50 31c-4-8-12-9-16-5 2 4 2 8 0 12-6 2-8 10-4 14-2 6 2 12 8 12M50 31c4-8 12-9 16-5-2 4-2 8 0 12 6 2 8 10 4 14 2 6-2 12-8 12"/><circle cx="43" cy="47" r="1.6" fill="currentColor"/><circle cx="57" cy="47" r="1.6" fill="currentColor"/><path d="M46 56c2 3 6 3 8 0M50 52v4"/></g>` },
    elephant: { name: 'Elephant', svg: `<g ${S}><path d="M30 60V44c0-10 9-18 20-18s20 8 20 18v16"/><path d="M70 52c6 2 6 12 0 14-4 1-6-2-6-6"/><path d="M30 44c-6 0-10 6-8 12 2 4 6 4 8 2"/><path d="M38 60v12M48 60v12M56 60v12M64 60v12"/><circle cx="44" cy="42" r="1.6" fill="currentColor"/><path d="M50 30c-6-6-8-14-4-20"/></g>` },
    peacock: { name: 'Peacock', svg: `<g ${S}><path d="M50 74c0-14-6-26-16-34M50 74c0-14 6-26 16-34M50 74c0-16-2-30-10-40M50 74c0-16 2-30 10-40M50 74c0-18 0-32 0-42"/><circle cx="34" cy="40" r="3"/><circle cx="66" cy="40" r="3"/><circle cx="40" cy="34" r="3"/><circle cx="60" cy="34" r="3"/><circle cx="50" cy="30" r="3"/><circle cx="50" cy="76" r="4"/></g>` },
    oak: { name: 'Oak and acorn', svg: `<g ${S}><path d="M50 78V54"/><path d="M50 54c-12 0-20-8-18-18 2-8 10-12 16-10 2-6 10-8 16-4 6 2 8 10 4 16 6 4 2 14-8 16"/><path d="M40 68c0-5 4-9 9-9s9 4 9 9c0 2-1 4-2 5H42c-1-1-2-3-2-5z"/><path d="M40 68h18"/></g>` },
    olive: { name: 'Olive branch', svg: `<g ${S}><path d="M30 72c10-14 22-26 40-42"/><path d="M38 60c-6-2-8-8-6-12 6 0 10 4 10 10M48 50c-6-2-8-8-6-12 6 0 10 4 10 10M58 40c-6-2-8-8-6-12 6 0 10 4 10 10"/><path d="M44 66c6 2 10 0 12-4-6-2-10 0-12 4zM54 56c6 2 10 0 12-4-6-2-10 0-12 4z"/></g>` },
    shield: { name: 'Shield', svg: `<g ${S}><path d="M50 24l22 8v18c0 12-9 22-22 28-13-6-22-16-22-28V32z"/><path d="M50 24v54M28 48h44"/></g>` },
    chakra: { name: 'Wheel', svg: `<g ${S}><circle cx="50" cy="50" r="22"/><circle cx="50" cy="50" r="5"/><path d="M50 28v44M28 50h44M34.4 34.4l31.2 31.2M65.6 34.4L34.4 65.6"/></g>` },
    diya: { name: 'Lamp', svg: `<g ${S}><path d="M28 58h44c0 10-10 16-22 16S28 68 28 58z"/><path d="M36 74c-6 2-8 6-8 6h44s-2-4-8-6"/><path d="M50 54c-6-6-6-14 0-22 6 8 6 16 0 22z"/><path d="M50 54v4"/></g>` },
    conch: { name: 'Conch', svg: `<g ${S}><path d="M62 26c10 8 12 24 4 36-6 9-18 14-30 12 2-6 2-12-2-16 10 2 20-2 24-10 4-7 4-15 4-22z"/><path d="M36 74l-8 4"/><path d="M50 40c4 4 6 10 4 16"/></g>` },
    star: { name: 'Star', svg: `<g ${S}><path d="M50 24l7 17 18 2-14 12 4 18-15-9-15 9 4-18-14-12 18-2z"/></g>` },
  };
  window.FT_EMBLEMS = E;
  window.ftEmblemSvg = function (id, color, size, withRing) {
    const e = E[id] || E.banyan;
    const px = size ? ` width="${size}" height="${size}"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${px} style="color:${color || '#D4A643'}" role="img" aria-label="${e.name}">${withRing === false ? '' : ring}${e.svg}</svg>`;
  };
})();
