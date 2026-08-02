/* =========================================================================
   Paint Events — Gallery behaviour
   Two views inside one section:
     • index      → bento grid of collections (grid rhythm lives in CSS)
     • collection → justified rows computed from the intrinsic size of every
                    photo, so rows share a height and both edges stay flush
                    while no image is ever cropped.
   Deep-linkable via #/<collection>. Fully keyboard operable.
   ========================================================================= */
(() => {
  const BASE = window.GALLERY_BASE || 'assets/images/gallery-library/';
  const CATEGORIES = window.GALLERY_CATEGORIES || [];
  const ITEMS = window.GALLERY_ITEMS || [];

  const view = document.querySelector('#gallery-view');
  const rail = document.querySelector('#filter-rail');
  const heading = document.querySelector('#gallery-heading');
  const elEyebrow = document.querySelector('#gh-eyebrow');
  const elTitle = document.querySelector('#gh-title');
  const elBlurb = document.querySelector('#gh-blurb');
  const elCount = document.querySelector('#gh-count');
  const elCountLabel = document.querySelector('#gh-count-label');
  const backBtn = document.querySelector('#gallery-back');
  const filterbar = document.querySelector('#gallery-filterbar');
  if (!view || !rail) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const byId = new Map(CATEGORIES.map(c => [c.id, c]));
  const photosOf = id => ITEMS.filter(i => i.c === id);
  const counts = new Map(CATEGORIES.map(c => [c.id, photosOf(c.id).length]));
  const src = f => BASE + f;

  const PAGE = 48;          // photos rendered per batch
  const ICON_ARROW = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const ICON_BACK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>';
  const ICON_ZOOM = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2M11 8.4v5.2M8.4 11h5.2"/></svg>';

  let current = '';         // '' = index
  let shown = 0;            // photos rendered in the active collection
  let gridWatcher = null;   // ResizeObserver for the active collection

  /* ------------------------------------------------------------ helpers - */

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function fadeIn(img) {
    if (img.complete && img.naturalWidth) { img.classList.add('is-loaded'); return; }
    img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
    img.addEventListener('error', () => img.classList.add('is-loaded'), { once: true });
  }

  /* Reveals tiles as they scroll in, staggered by their position in the row. */
  const revealer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const delay = reduced.matches ? 0 : Math.min(Number(el.dataset.stagger || 0), 5) * 55;
          el.style.transitionDelay = delay + 'ms';
          el.classList.add('is-in');
          obs.unobserve(el);
        });
      }, { rootMargin: '160px 0px' })
    : null;

  function reveal(el) {
    if (!revealer) { el.classList.add('is-in'); return; }
    revealer.observe(el);
  }

  /* --------------------------------------------------------- filter rail - */

  const thumb = document.createElement('span');
  thumb.className = 'filter-rail__thumb';
  thumb.setAttribute('aria-hidden', 'true');
  rail.appendChild(thumb);

  rail.insertAdjacentHTML('afterbegin', [
    `<button class="filter-button" type="button" data-filter="" aria-pressed="true">All collections</button>`,
    ...CATEGORIES.map(c =>
      `<button class="filter-button" type="button" data-filter="${c.id}" aria-pressed="false">${esc(c.label)}<span class="filter-button__n">${counts.get(c.id)}</span></button>`)
  ].join(''));

  const buttons = [...rail.querySelectorAll('.filter-button')];

  function moveThumb(instant) {
    const active = rail.querySelector('.filter-button.is-active');
    if (!active) { thumb.style.opacity = '0'; return; }
    if (instant) thumb.style.transition = 'none';
    thumb.style.width = active.offsetWidth + 'px';
    thumb.style.transform = `translateX(${active.offsetLeft}px)`;
    thumb.style.opacity = '1';
    if (instant) { void thumb.offsetWidth; thumb.style.transition = ''; }
  }

  function syncRail(id) {
    buttons.forEach(b => {
      const on = b.dataset.filter === id;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
      if (on) b.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduced.matches ? 'auto' : 'smooth' });
    });
    moveThumb();
  }

  rail.addEventListener('click', e => {
    const btn = e.target.closest('.filter-button');
    if (btn) go(btn.dataset.filter, { scroll: true });
  });
  rail.addEventListener('scroll', () => moveThumb(true), { passive: true });

  /* ---------------------------------------------------------- index view - */

  function renderIndex() {
    const grid = document.createElement('div');
    grid.className = 'collection-index';
    grid.innerHTML = CATEGORIES.map(c => `
      <button class="cat-card" type="button" data-open="${c.id}" aria-label="Open the ${esc(c.label)} collection, ${counts.get(c.id)} photos">
        <img class="cat-card__img" src="${src(c.cover)}" width="${c.coverW}" height="${c.coverH}" alt="" loading="lazy" decoding="async">
        <span class="cat-card__meta">
          <span>
            <span class="cat-card__eyebrow">${esc(c.eyebrow)}</span>
            <span class="cat-card__title">${esc(c.label)}</span>
            <em class="cat-card__count">${counts.get(c.id)} photos</em>
          </span>
          <span class="cat-card__go">${ICON_ARROW}</span>
        </span>
      </button>`).join('');

    grid.querySelectorAll('.cat-card__img').forEach((img, i) => {
      if (i < 4) { img.loading = 'eager'; img.fetchPriority = 'high'; }
      fadeIn(img);
    });
    grid.addEventListener('click', e => {
      const card = e.target.closest('[data-open]');
      if (card) go(card.dataset.open, { scroll: true });
    });

    view.replaceChildren(grid);
  }

  /* ----------------------------------------------------- collection view - */

  /* Height a set of photos would take if stretched across the full width. */
  function rowHeight(items, width, gap) {
    const ratioSum = items.reduce((sum, p) => sum + p.w / p.h, 0);
    return (width - gap * (items.length - 1)) / ratioSum;
  }

  /* Greedy justified rows: fill a row until its height drops to the target,
     then lock it so every photo in that row shares one height and the row
     spans the container edge to edge. */
  function layoutRows(photos, width, gap, target, final) {
    const rows = [];
    let row = [];

    for (let k = 0; k < photos.length; k += 1) {
      row.push(photos[k]);
      const height = rowHeight(row, width, gap);
      if (height > target) continue;

      // Adding this photo dropped the row under the target. Keep whichever of
      // the two candidate rows lands closer to it, otherwise narrow viewports
      // end up with rows of tiny thumbnails.
      if (row.length > 1) {
        const shorter = row.slice(0, -1);
        const shorterHeight = rowHeight(shorter, width, gap);
        if (Math.abs(shorterHeight - target) < Math.abs(height - target)) {
          rows.push({ items: shorter, height: shorterHeight });
          row = [photos[k]];
          continue;
        }
      }

      rows.push({ items: row, height });
      row = [];
    }

    // While photos remain unrendered, carry the ragged leftover into the next
    // batch rather than committing it — that is what keeps the seam invisible.
    if (!row.length || (!final && rows.length)) return rows;

    // A thin trailing row would tower over the rest. Pull photos down from the
    // row above until it settles, so the tail still reads as part of the grid.
    const limit = target * 1.3;      // tallest a justified tail may be
    const prevCap = target * 1.18;   // and how much the row above may grow
    let height = rowHeight(row, width, gap);
    while (height > limit && rows.length && rows[rows.length - 1].items.length > 2) {
      const prev = rows[rows.length - 1];
      if (rowHeight(prev.items.slice(0, -1), width, gap) > prevCap) break;
      row.unshift(prev.items.pop());
      prev.height = rowHeight(prev.items, width, gap);
      height = rowHeight(row, width, gap);
    }

    rows.push(height <= limit
      ? { items: row, height, tail: true }
      : { items: row, height: target, partial: true, tail: true });
    return rows;
  }

  function targetHeight(width) {
    if (width < 560) return Math.max(190, width * 0.62);
    if (width < 900) return 250;
    if (width < 1200) return 290;
    return 330;
  }

  /* Paints `wanted` photos as one continuous set of rows. Returns how many were
     actually placed: while photos remain unrendered the ragged trailing row is
     held back, so no batch boundary ever shows up as a seam in the grid.
     Tiles below `settled` appear instantly; only newly added ones animate. */
  function paint(container, photos, wanted, settled, cat) {
    const width = container.getBoundingClientRect().width;
    if (!width) return 0;

    const gap = Math.round(parseFloat(getComputedStyle(container).gap) || 14);
    const list = photos.slice(0, wanted);
    const rows = layoutRows(list, width, gap, targetHeight(width), wanted >= photos.length);

    const frag = document.createDocumentFragment();
    let index = 0;

    rows.forEach(r => {
      const rowEl = document.createElement('div');
      rowEl.className = 'justified__row';
      rowEl.style.height = r.height.toFixed(2) + 'px';
      rowEl.style.gap = gap + 'px';
      rowEl.style.containIntrinsicSize = `auto ${Math.round(r.height)}px`;

      const widths = r.items.map(p => Math.max(40, (p.w / p.h) * r.height));
      // Absorb accumulated drift into the last tile so the row edge stays flush.
      if (!r.partial) {
        const total = widths.reduce((a, b) => a + b, 0) + gap * (r.items.length - 1);
        widths[widths.length - 1] += width - total;
      }

      r.items.forEach((p, i) => {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'tile';
        tile.style.width = widths[i].toFixed(2) + 'px';
        tile.dataset.index = String(index);
        tile.dataset.stagger = String(i);
        tile.setAttribute('aria-label', `Open photo ${index + 1} of ${photos.length}`);
        tile.innerHTML =
          `<img src="${src(p.f)}" width="${p.w}" height="${p.h}" alt="${esc(cat?.label || 'Paint Events')} — Paint Events photo ${index + 1}" loading="lazy" decoding="async">` +
          `<span class="tile__zoom">${ICON_ZOOM}</span>`;
        fadeIn(tile.querySelector('img'));
        if (index < settled) tile.classList.add('is-in');
        else reveal(tile);
        rowEl.appendChild(tile);
        index += 1;
      });

      frag.appendChild(rowEl);
    });

    container.replaceChildren(frag);
    return index;
  }

  function renderCollection(id) {
    const cat = byId.get(id);
    const photos = photosOf(id);

    const wrap = document.createElement('div');
    wrap.className = 'collection';

    const grid = document.createElement('div');
    grid.className = 'justified';
    wrap.appendChild(grid);

    // Attach before painting: the row maths reads the container's real width.
    view.replaceChildren(wrap);

    if (!photos.length) {
      grid.innerHTML = '<p class="collection__empty">No photos in this collection yet.</p>';
      return;
    }

    const more = document.createElement('div');
    more.className = 'collection__more';
    more.innerHTML = '<button type="button">Show more photos</button>';
    const moreBtn = more.querySelector('button');

    shown = 0;
    let wanted = PAGE;
    const commit = settled => {
      shown = paint(grid, photos, Math.min(wanted, photos.length), settled, cat);
      const left = photos.length - shown;
      more.hidden = left <= 0;
      if (left > 0) moreBtn.textContent = `Show ${Math.min(PAGE, left)} more photos`;
    };

    commit(0);
    if (shown < photos.length) wrap.appendChild(more);
    moreBtn.addEventListener('click', () => { wanted = shown + PAGE; commit(shown); });

    grid.addEventListener('click', e => {
      const tile = e.target.closest('.tile');
      if (tile) openLightbox(photos, Number(tile.dataset.index), cat);
    });

    /* Rebuild on width change — the row maths depends on the container.
       A ResizeObserver rather than window.resize, so container changes such as
       a scrollbar appearing or the browser zooming are caught too. */
    let lastWidth = Math.round(grid.getBoundingClientRect().width);
    let timer;
    gridWatcher = new ResizeObserver(entries => {
      const w = Math.round(entries[0].contentRect.width);
      if (!w || w === lastWidth) return;
      lastWidth = w;
      clearTimeout(timer);
      timer = setTimeout(() => commit(shown), 120);
    });
    gridWatcher.observe(grid);
  }

  /* -------------------------------------------------------------- router - */

  function setHeading(id) {
    const cat = byId.get(id);
    heading.classList.add('is-swapping');
    const apply = () => {
      if (cat) {
        elEyebrow.textContent = cat.eyebrow;
        elTitle.textContent = cat.label;
        elBlurb.textContent = cat.blurb;
        elCount.textContent = String(counts.get(id));
        elCountLabel.textContent = counts.get(id) === 1 ? ' photo' : ' photos';
        backBtn.hidden = false;
      } else {
        elEyebrow.textContent = 'Choose a moment';
        elTitle.innerHTML = 'Made to celebrate<br><span>every kind of gathering.</span>';
        elBlurb.textContent = 'Every photo below is from a real Paint Events booking across Southern California. Pick the kind of day you are planning.';
        elCount.textContent = String(CATEGORIES.length);
        elCountLabel.textContent = ' collections';
        backBtn.hidden = true;
      }
      heading.classList.remove('is-swapping');
    };
    reduced.matches ? apply() : setTimeout(apply, 180);
  }

  function render(id) {
    gridWatcher?.disconnect();
    gridWatcher = null;
    id && byId.has(id) ? renderCollection(id) : renderIndex();
  }

  function go(id, { scroll = false, replace = false } = {}) {
    const next = byId.has(id) ? id : '';
    if (next === current && view.firstChild) return;
    current = next;

    syncRail(next);
    setHeading(next);

    const commit = () => {
      render(next);
      view.classList.remove('is-leaving');
      if (scroll) {
        const top = (filterbar?.getBoundingClientRect().top ?? 0) + window.scrollY - 96;
        window.scrollTo({ top, behavior: reduced.matches ? 'auto' : 'smooth' });
      }
    };

    const hash = next ? `#/${next}` : '#gallery';
    if (replace) history.replaceState(null, '', hash);
    else if (location.hash !== hash) history.pushState(null, '', hash);

    if (reduced.matches || !view.firstChild) { commit(); return; }
    view.classList.add('is-leaving');
    setTimeout(commit, 180);
  }

  function fromHash() {
    const m = /^#\/([a-z-]+)$/.exec(location.hash);
    return m && byId.has(m[1]) ? m[1] : '';
  }

  window.addEventListener('popstate', () => {
    const id = fromHash();
    if (id === current) return;
    current = id;
    syncRail(id);
    setHeading(id);
    render(id);
  });

  backBtn?.addEventListener('click', () => go('', { scroll: true }));
  backBtn.innerHTML = `${ICON_BACK}<span>All collections</span>`;

  /* ------------------------------------------------------------ lightbox - */

  const lb = document.querySelector('#gallery-lightbox');
  const lbImg = document.querySelector('#lightbox-image');
  const lbCaption = document.querySelector('#lightbox-caption');
  const lbPrev = document.querySelector('#lightbox-prev');
  const lbNext = document.querySelector('#lightbox-next');
  const lbClose = document.querySelector('#lightbox-close');
  let lbList = [];
  let lbIndex = 0;
  let lbCat = null;

  function preload(i) {
    const p = lbList[i];
    if (p) new Image().src = src(p.f);
  }

  function showAt(i) {
    if (!lbList.length) return;
    lbIndex = Math.max(0, Math.min(i, lbList.length - 1));
    const p = lbList[lbIndex];
    lb.classList.add('is-swapping');
    lbImg.src = src(p.f);
    lbImg.width = p.w;
    lbImg.height = p.h;
    lbImg.alt = `${lbCat?.label || 'Paint Events'} — photo ${lbIndex + 1}`;
    lbImg.decode?.().catch(() => {}).finally(() => lb.classList.remove('is-swapping'));
    lbCaption.innerHTML = `${esc(lbCat?.label || 'Gallery')} <span>${lbIndex + 1} / ${lbList.length}</span>`;
    lbPrev.disabled = lbIndex === 0;
    lbNext.disabled = lbIndex === lbList.length - 1;
    preload(lbIndex + 1);
    preload(lbIndex - 1);
  }

  function openLightbox(list, index, cat) {
    lbList = list;
    lbCat = cat;
    showAt(index);
    if (!lb.open) lb.showModal();
  }

  lbPrev?.addEventListener('click', () => showAt(lbIndex - 1));
  lbNext?.addEventListener('click', () => showAt(lbIndex + 1));
  lbClose?.addEventListener('click', () => lb.close());
  lb?.addEventListener('click', e => {
    if (e.target === lb || e.target.classList.contains('lightbox-stage')) lb.close();
  });
  lb?.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); showAt(lbIndex + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); showAt(lbIndex - 1); }
  });

  let touchX = null;
  lb?.addEventListener('touchstart', e => { touchX = e.changedTouches[0].clientX; }, { passive: true });
  lb?.addEventListener('touchend', e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 55) showAt(lbIndex + (dx < 0 ? 1 : -1));
    touchX = null;
  }, { passive: true });

  /* --------------------------------------------------------------- boot - */

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => moveThumb(true), 140);
  });
  new ResizeObserver(() => moveThumb(true)).observe(rail);

  if (filterbar && 'IntersectionObserver' in window) {
    const sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    filterbar.parentNode.insertBefore(sentinel, filterbar);
    new IntersectionObserver(
      ([e]) => filterbar.classList.toggle('is-pinned', !e.isIntersecting),
      { rootMargin: '-120px 0px 0px 0px', threshold: 1 }
    ).observe(sentinel);
  }

  const start = fromHash();
  current = start;
  syncRail(start);
  if (start) setHeading(start);
  render(start);
  requestAnimationFrame(() => moveThumb(true));
  // Pill widths shift once the webfont swaps in, so re-measure the indicator.
  document.fonts?.ready.then(() => moveThumb(true));
  if (start) {
    const top = (filterbar?.getBoundingClientRect().top ?? 0) + window.scrollY - 96;
    window.scrollTo({ top, behavior: 'auto' });
  }
})();
