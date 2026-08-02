(() => {
  const accordionItems = [...document.querySelectorAll('.faq-page .faq-category-list details')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const running = new WeakMap();

  accordionItems.forEach(item => {
    const summary = item.querySelector('summary');
    if (!summary) return;

    summary.addEventListener('click', event => {
      if (reducedMotion.matches || !item.animate) return;
      event.preventDefault();

      running.get(item)?.cancel();
      const opening = !item.open;
      const startHeight = item.getBoundingClientRect().height;

      if (opening) item.open = true;
      item.classList.toggle('is-closing', !opening);
      item.classList.toggle('is-opening', opening);

      const endHeight = opening
        ? item.scrollHeight
        : summary.getBoundingClientRect().height;

      const animation = item.animate(
        [
          { height: `${startHeight}px` },
          { height: `${endHeight}px` }
        ],
        {
          duration: opening ? 460 : 380,
          easing: 'cubic-bezier(.22, .72, .18, 1)'
        }
      );

      running.set(item, animation);
      animation.onfinish = () => {
        if (!opening) item.open = false;
        item.classList.remove('is-opening', 'is-closing');
        running.delete(item);
      };
      animation.oncancel = () => {
        item.classList.remove('is-opening', 'is-closing');
        running.delete(item);
      };
    });
  });
})();
