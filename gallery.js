(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const mobileMenu = document.querySelector('#gallery-mobile-menu');
  if (menuButton && mobileMenu) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!open));
      mobileMenu.classList.toggle('open', !open);
    });
  }

  const filterButtons = [...document.querySelectorAll('.filter-button')];
  const cards = [...document.querySelectorAll('.gallery-card')];
  const count = document.querySelector('#visible-count');
  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      filterButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      let visible = 0;
      cards.forEach((card, index) => {
        const show = filter === 'all' || card.dataset.category === filter;
        card.classList.toggle('is-hidden', !show);
        card.classList.remove('is-entering');
        if (show) {
          visible += 1;
          requestAnimationFrame(() => {
            card.style.animationDelay = `${Math.min(index * 35, 210)}ms`;
            card.classList.add('is-entering');
          });
        }
      });
      if (count) count.textContent = String(visible);
    });
  });

  const dialog = document.querySelector('#gallery-lightbox');
  const dialogImage = document.querySelector('#lightbox-image');
  const dialogTitle = document.querySelector('#lightbox-title');
  const closeButton = document.querySelector('.lightbox-close');
  if (dialog && dialogImage && dialogTitle) {
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        dialogImage.src = card.dataset.src || card.querySelector('img').src;
        dialogImage.alt = card.querySelector('img').alt;
        dialogTitle.textContent = card.dataset.title || '';
        dialog.showModal();
      });
    });
    closeButton?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  const revealTargets = [...document.querySelectorAll('.gallery-card, .gallery-heading, .gallery-hero-copy, .gallery-hero-collage')];
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-entering');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealTargets.forEach((target) => observer.observe(target));
})();
