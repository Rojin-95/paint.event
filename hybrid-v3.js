(() => {
  const track = document.querySelector('.mini-gallery-track');
  const originalSet = track?.querySelector('.mini-gallery-set');
  if (track && originalSet && !track.dataset.loopReady) {
    while (track.children.length < 4) {
      const clone = originalSet.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('img').forEach((image) => {
        image.alt = '';
        image.loading = 'eager';
      });
      track.appendChild(clone);
    }
    const syncGalleryLoop = () => {
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      track.style.setProperty('--mini-gallery-shift', `-${originalSet.getBoundingClientRect().width + gap}px`);
    };
    requestAnimationFrame(syncGalleryLoop);
    window.addEventListener('load', syncGalleryLoop, { once:true });
    if ('ResizeObserver' in window) new ResizeObserver(syncGalleryLoop).observe(originalSet);
    track.dataset.loopReady = 'true';
  }

  const aboutSection = document.querySelector('.about-section');
  if (aboutSection && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const aboutObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        aboutSection.classList.add('about-in-view');
        aboutObserver.unobserve(aboutSection);
      }
    }, { threshold:.18 });
    aboutObserver.observe(aboutSection);
  } else {
    aboutSection?.classList.add('about-in-view');
  }

  const motionTargets = document.querySelectorAll('.real-events .section-heading,.real-events .large-quote,.real-events .gallery-main,.real-events .mini-gallery,.about-section .about-copy');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    motionTargets.forEach((item,index) => {
      item.classList.add('scroll-motion-section');
      item.style.setProperty('--motion-delay', `${(index % 4) * 70}ms`);
    });
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('scroll-motion-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold:.1, rootMargin:'0px 0px -6% 0px' });
    motionTargets.forEach((item) => observer.observe(item));
  } else {
    motionTargets.forEach((item) => item.classList.add('scroll-motion-section','scroll-motion-visible'));
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href="#home"]');
    if (!link) return;
    const home = document.querySelector('#home');
    if (!home) return;
    event.preventDefault();
    const headerHeight = document.querySelector('.site-header')?.offsetHeight || 0;
    window.scrollTo({ top:Math.max(0,home.offsetTop-headerHeight), behavior:'smooth' });
  });
})();

/* Smooth, compact V1-style FAQ disclosure motion. */
(() => {
  const detailsItems = document.querySelectorAll('.faq-list details');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  detailsItems.forEach((details) => {
    const summary = details.querySelector('summary');
    if (!summary) return;
    summary.addEventListener('click', (event) => {
      event.preventDefault();
      if (details.classList.contains('faq-animating')) return;
      const opening = !details.open;
      const collapsedHeight = summary.getBoundingClientRect().height;

      if (opening) details.open = true;
      const expandedHeight = details.scrollHeight;
      details.classList.add('faq-animating');
      details.style.overflow = 'hidden';

      const animation = details.animate(
        opening
          ? [{height:`${collapsedHeight}px`},{height:`${expandedHeight}px`}]
          : [{height:`${expandedHeight}px`},{height:`${collapsedHeight}px`}],
        {duration:360,easing:'cubic-bezier(.22,.72,.18,1)'}
      );
      animation.onfinish = () => {
        if (!opening) details.open = false;
        details.classList.remove('faq-animating');
        details.style.height = '';
        details.style.overflow = '';
      };
      animation.oncancel = animation.onfinish;
    });
  });
})();

/* Seamless horizontal loop for the static Google review excerpts. */
(() => {
  const track = document.querySelector('.reviews-grid');
  if (!track || track.dataset.reviewLoopReady === 'true') return;
  const originals = [...track.querySelectorAll('.review-card')];
  if (!originals.length) return;
  for (let copy = 0; copy < 2; copy += 1) {
    originals.forEach((card) => {
      const clone = card.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });
  }
  const syncReviewLoop = () => {
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const distance = originals.reduce((total, card) => total + card.getBoundingClientRect().width, 0) + gap * originals.length;
    track.style.setProperty('--reviews-shift', `-${distance}px`);
  };
  requestAnimationFrame(syncReviewLoop);
  window.addEventListener('load', syncReviewLoop, { once:true });
  if ('ResizeObserver' in window) new ResizeObserver(syncReviewLoop).observe(track);
  track.dataset.reviewLoopReady = 'true';
})();

/* Seamless loop for the trusted-client logo strip. */
(() => {
  const track = document.querySelector('.client-logos');
  if (!track || track.dataset.marqueeReady === 'true') return;
  const originals = [...track.querySelectorAll('img')];
  if (!originals.length) return;
  for (let copy = 0; copy < 3; copy += 1) {
    originals.forEach((logo) => {
      const clone = logo.cloneNode(true);
      clone.alt = '';
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });
  }
  const sync = () => {
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const distance = originals.reduce((sum,logo) => sum + logo.getBoundingClientRect().width,0) + gap * originals.length;
    track.style.setProperty('--trust-logo-shift', `-${distance}px`);
  };
  requestAnimationFrame(sync);
  window.addEventListener('load',sync,{once:true});
  if ('ResizeObserver' in window) new ResizeObserver(sync).observe(track);
  track.dataset.marqueeReady = 'true';
})();
