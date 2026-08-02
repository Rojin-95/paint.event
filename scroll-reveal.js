(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sections = [...document.querySelectorAll('main > section')].filter(section =>
    !section.matches('.main-hero, .page-hero, .gallery-hero')
  );

  const targets = sections.map(section =>
    section.querySelector(':scope > .container, :scope > .final-cta-inner') || section
  );

  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    targets.forEach(target => target.classList.add('scroll-section-visible'));
    return;
  }

  targets.forEach((target, index) => {
    target.classList.add('scroll-section-reveal');
    target.style.setProperty('--section-order', String(index));
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('scroll-section-visible');
      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -8% 0px'
  });

  targets.forEach(target => observer.observe(target));
})();
