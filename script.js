const header = document.querySelector('#site-header');
const menuButton = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('#mobile-menu');

const setCursorPressed = pressed => document.documentElement.classList.toggle('cursor-pressed', pressed);
window.addEventListener('pointerdown', () => setCursorPressed(true), { passive: true });
window.addEventListener('pointerup', () => setCursorPressed(false), { passive: true });
window.addEventListener('pointercancel', () => setCursorPressed(false), { passive: true });
window.addEventListener('blur', () => setCursorPressed(false));
const setHeaderState = () => {
  if (!header) return;
  const heroShell = document.querySelector('.hero-scroll-shell');
  const heroRunway = heroShell ? Math.max(heroShell.offsetHeight - window.innerHeight, 1) : 1;
  const revealAt = heroShell ? heroShell.offsetTop + (heroRunway * 0.80) : 1;
  const isVisible = window.scrollY >= revealAt;
  header.classList.toggle('is-visible', isVisible);
  header.classList.toggle('scrolled', isVisible);
};
setHeaderState();
window.addEventListener('scroll', setHeaderState, { passive: true });

menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  menuButton.setAttribute('aria-label', open ? 'Open menu' : 'Close menu');
  mobileMenu.classList.toggle('open', !open);
});
mobileMenu?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  mobileMenu.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open menu');
}));

const guestInput = document.querySelector('#guest-count');
const durationInput = document.querySelector('#duration');
const totalOutput = document.querySelector('#estimate-total');
const guestBreakdown = document.querySelector('#guest-breakdown');
const durationBreakdown = document.querySelector('#duration-breakdown');
const discountRow = document.querySelector('#discount-row');
const discountBreakdown = document.querySelector('#discount-breakdown');
const form = document.querySelector('#estimator-form');
const errorOutput = document.querySelector('#form-error');

function rateFor(guests, duration) {
  if (!guests || guests < 4) return 0;
  if (Number(duration) === 90) return guests <= 9 ? 50 : 35;
  return guests <= 9 ? 65 : 50;
}

function updateEstimate() {
  const guests = Number(guestInput.value);
  const duration = Number(durationInput.value);
  const rate = rateFor(guests, duration);
  const base = guests * rate;
  const hasDiscount = guests >= 60;
  const discount = hasDiscount ? Math.round(base * 0.1) : 0;
  const subtotal = base - discount;
  guestBreakdown.textContent = rate ? `${guests} guests x $${rate}` : 'Enter 4-100 guests';
  durationBreakdown.textContent = `${duration} minutes`;
  discountRow.hidden = !hasDiscount;
  discountBreakdown.textContent = hasDiscount ? `-$${discount.toLocaleString()} (10%)` : '-';
  totalOutput.textContent = rate ? `$${subtotal.toLocaleString()}` : '-';
}

guestInput?.addEventListener('input', updateEstimate);
durationInput?.addEventListener('change', updateEstimate);
updateEstimate();

form?.addEventListener('submit', event => {
  event.preventDefault();
  const type = document.querySelector('#event-type').value;
  const guests = Number(guestInput.value);
  const date = document.querySelector('#event-date').value;
  const zip = document.querySelector('#zip-code').value.trim();
  const duration = Number(durationInput.value);
  const errors = [];
  if (!type) errors.push('choose an event type');
  if (guests < 4 || guests > 100) errors.push('enter 4-100 guests');
  if (!date) errors.push('choose a date');
  if (!/^\d{5}$/.test(zip)) errors.push('enter a five-digit ZIP code');
  if (errors.length) {
    errorOutput.textContent = `Please ${errors.join(', ')}.`;
    form.querySelector(':invalid')?.focus();
    return;
  }
  errorOutput.textContent = '';
  const estimate = { type, guests, date, zip, duration };
  sessionStorage.setItem('paintEventsEstimate', JSON.stringify(estimate));
  const params = new URLSearchParams(estimate);
  window.location.href = `paint-events-booking-v2.html?${params.toString()}`;
});

const dateInput = document.querySelector('#event-date');
if (dateInput) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  dateInput.min = tomorrow.toISOString().split('T')[0];
}

const revealTargets = document.querySelectorAll('.legacy-reveal-disabled');
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  revealTargets.forEach(target => target.classList.add('reveal'));
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    }
  }), { threshold: 0.12 });
  revealTargets.forEach(target => observer.observe(target));
}

const aboutSection = document.querySelector('.about-section');
if (aboutSection && 'IntersectionObserver' in window) {
  const aboutObserver = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      aboutSection.classList.add('about-in-view');
      aboutObserver.unobserve(aboutSection);
    }
  }, { threshold: 0.18 });
  aboutObserver.observe(aboutSection);
} else {
  aboutSection?.classList.add('about-in-view');
}


function initializeScrollVideo() {
  const shell = document.querySelector('.hero-scroll-shell');
  const hero = document.querySelector('#scroll-video-hero');
  const video = document.querySelector('#hero-paint-video');
  const visual = document.querySelector('.hero-video-visual');
  const loading = document.querySelector('#video-loading');
  const cue = document.querySelector('#video-swipe-cue');
  const copy = document.querySelector('#hero-copy');
  const sideImage = document.querySelector('#hero-side-image');
  const actions = document.querySelector('#hero-actions');
  const skipHeroButton = document.querySelector('#hero-skip-scroll');
  const flightLogo = document.querySelector('#hero-logo-flight');
  const navLogo = document.querySelector('#site-header .brand img');
  if (!shell || !hero || !video || !visual) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let shouldSkipIntro = new URLSearchParams(window.location.search).get('skipIntro') === '1';
  try {
    shouldSkipIntro = shouldSkipIntro || sessionStorage.getItem('paintEventsIntroSeen') === '1';
    sessionStorage.setItem('paintEventsIntroSeen', '1');
  } catch (error) {
    // Session storage can be unavailable in privacy-restricted contexts.
  }
  const smoothing = 0.12;
  let ready = false;
  let displayedTime = 0;
  let rafId = 0;
  let loopActive = false;
  let cueHidden = false;

  if (shouldSkipIntro) {
    video.pause();
    video.style.visibility = 'hidden';
    visual.style.background = '#0b2858';
    visual.classList.add('is-ready', 'is-skip-final');
    visual.setAttribute('aria-busy', 'false');
    if (loading) loading.textContent = '';
    ready = true;
  }

  // Progress through the pinned scroll range: 0 at the moment the hero locks
  // in place, 1 once the shell's extra scroll runway has been used up.
  function getProgress() {
    const rect = shell.getBoundingClientRect();
    const heroHeight = innerHeight;
    const scrollableHeight = Math.max(shell.offsetHeight - heroHeight, 1);
    const scrolledIntoShell = -rect.top;
    return Math.min(1, Math.max(0, scrolledIntoShell / scrollableHeight));
  }

  let magnetTimer = 0;
  let lastMagnetProgress = getProgress();
  let magnetDirection = 1;

  function scheduleHeroMagnet() {
    const progress = getProgress();
    const movement = progress - lastMagnetProgress;
    if (Math.abs(movement) > 0.0001) magnetDirection = movement > 0 ? 1 : -1;
    lastMagnetProgress = progress;
    clearTimeout(magnetTimer);

    if (progress > 0.795 && progress < 0.905) {
      magnetTimer = window.setTimeout(() => {
        const targetProgress = magnetDirection > 0 ? 0.905 : 0.795;
        const shellTop = window.scrollY + shell.getBoundingClientRect().top;
        const runway = Math.max(shell.offsetHeight - window.innerHeight, 1);
        window.scrollTo({ top: shellTop + (runway * targetProgress), behavior: 'smooth' });
      }, 110);
    }
  }

  window.addEventListener('scroll', scheduleHeroMagnet, { passive: true });
  function animateVideoTime() {
    const duration = video.duration || 10;
    const safeMax = Math.max(duration - 0.05, 0);
    const progress = getProgress();
    skipHeroButton?.classList.toggle('is-hidden', progress > 0.04);

    // The logo appears on the completed blue frame, grows with the hero,
    // then follows a reversible path into the navbar as the content arrives.
    const logoAppear = Math.min(1, Math.max(0, (progress - 0.56) / 0.06));
    const logoScaleProgress = Math.min(1, Math.max(0, (progress - 0.56) / 0.16));
    const logoTravel = Math.min(1, Math.max(0, (progress - 0.79) / 0.08));
    const easedTravel = logoTravel * logoTravel * (3 - (2 * logoTravel));
    if (flightLogo && navLogo) {
      const targetSize = navLogo.offsetWidth || (innerWidth <= 560 ? 56 : 72);
      const headerHeight = innerWidth <= 560 ? 72 : 86;
      const targetLeft = (innerWidth <= 1120 ? 16 : 24) + (targetSize / 2);
      const targetTop = headerHeight / 2;
      const centeredSize = (innerWidth <= 560 ? 208 : 256) + (logoScaleProgress * (innerWidth <= 560 ? 84 : 156));
      const currentSize = centeredSize + ((targetSize - centeredSize) * easedTravel);
      const currentLeft = (innerWidth / 2) + ((targetLeft - (innerWidth / 2)) * easedTravel);
      const currentTop = (innerHeight / 2) + ((targetTop - (innerHeight / 2)) * easedTravel);
      const travelFade = logoTravel > 0.9 ? Math.max(0, (1 - logoTravel) / 0.1) : 1;
      flightLogo.style.left = `${currentLeft.toFixed(2)}px`;
      flightLogo.style.top = `${currentTop.toFixed(2)}px`;
      flightLogo.style.width = `${currentSize.toFixed(2)}px`;
      flightLogo.style.height = `${currentSize.toFixed(2)}px`;
      flightLogo.style.opacity = `${(logoAppear * travelFade).toFixed(4)}`;
      flightLogo.style.transform = 'translate(-50%,-50%)';
      header?.classList.toggle('logo-landed', logoTravel >= 0.98);
    }
    const videoProgress = Math.min(progress / 0.56, 1);
    const targetTime = videoProgress * safeMax;
    // First grow proportionally until the video reaches the full hero height.
    const expansionProgress = Math.min(1, Math.max(0, (progress - 0.56) / 0.16));
    visual.style.setProperty('--video-expansion', expansionProgress.toFixed(4));
    hero.classList.toggle('is-full-bleed', expansionProgress >= 0.995);

    // Once full-height, stretch only horizontally to remove the side gaps.
    // This is numeric and continuous, so there is no object-fit jump.
    const stretchProgress = Math.min(1, Math.max(0, (progress - 0.72) / 0.07));
    const heroRatio = hero.clientWidth / Math.max(hero.clientHeight, 1);
    const videoRatio = (video.videoWidth || 16) / Math.max(video.videoHeight || 9, 1);
    const finalStretch = Math.max(1, heroRatio / videoRatio);
    const horizontalStretch = 1 + ((finalStretch - 1) * stretchProgress);
    visual.style.setProperty('--video-stretch', horizontalStretch.toFixed(5));

    // Scroll-controlled entrance after the video has finished scaling.
    // The last portion of the shell is intentionally a hold range.
    const copyProgress = Math.min(1, Math.max(0, (progress - 0.80) / 0.07));
    const mediaProgress = Math.min(1, Math.max(0, (progress - 0.81) / 0.08));
    const ctaProgress = Math.min(1, Math.max(0, (progress - 0.84) / 0.06));
    hero.style.setProperty('--copy-opacity', copyProgress.toFixed(4));
    hero.style.setProperty('--copy-x', `${((1 - copyProgress) * -170).toFixed(2)}px`);
    hero.style.setProperty('--cta-opacity', ctaProgress.toFixed(4));
    hero.style.setProperty('--cta-y', `${((1 - ctaProgress) * 90).toFixed(2)}px`);
    if (sideImage) {
      const topLeft = 100 - (78 * mediaProgress);
      const bottomLeft = 100 - (100 * mediaProgress);
      sideImage.style.opacity = mediaProgress.toFixed(4);
      sideImage.style.clipPath = `polygon(${topLeft.toFixed(2)}% 0,100% 0,100% 100%,${bottomLeft.toFixed(2)}% 100%)`;
    }

    const delta = targetTime - displayedTime;
    displayedTime += Math.abs(delta) < 0.004 ? delta : delta * smoothing;
    displayedTime = Math.min(Math.max(displayedTime, 0), safeMax);
    try {
      if (!video.seeking && Math.abs(video.currentTime - displayedTime) > 0.008) {
        video.currentTime = displayedTime;
      }
    } catch (err) {
      // A rejected seek should never kill the loop: skip this frame's write and retry next frame.
    }
    if (!cueHidden && displayedTime > 0.05) {
      cueHidden = true;
      cue?.classList.add('is-hidden');
    }

    if (loopActive) rafId = requestAnimationFrame(animateVideoTime);
  }

  function startLoop() {
    if (loopActive) return;
    loopActive = true;
    rafId = requestAnimationFrame(animateVideoTime);
  }

  function stopLoop() {
    loopActive = false;
    cancelAnimationFrame(rafId);
  }

  function enableInteraction() {
    ready = true;
    visual.classList.add('is-ready');
    visual.setAttribute('aria-busy', 'false');
    loading.textContent = '';
    const duration = video.duration || 10;
    const safeMax = Math.max(duration - 0.05, 0);
    displayedTime = shouldSkipIntro
      ? safeMax
      : Math.min(getProgress() * safeMax, safeMax);
    video.currentTime = displayedTime;
    startLoop();
  }

  video.addEventListener('loadedmetadata', () => {
    if (shouldSkipIntro) {
      video.pause();
      return;
    }
    if (reducedMotion) {
      video.currentTime = video.duration || 10;
      visual.classList.add('is-ready');
      visual.setAttribute('aria-busy', 'false');
      loading.textContent = '';
      return;
    }
    video.pause();
    video.currentTime = 0.001;
  }, { once: true });

  video.addEventListener('loadeddata', () => {
    if (shouldSkipIntro) return;
    if (!reducedMotion && !ready) {
      video.pause();
      video.currentTime = 0;
      enableInteraction();
    }
  }, { once: true });

  video.addEventListener('error', () => {
    loading.textContent = 'The painting preview could not be loaded.';
    visual.setAttribute('aria-busy', 'false');
  }, { once: true });


  function skipToCompletedHero(forceFinalFrame = false) {
    const shellTop = window.scrollY + shell.getBoundingClientRect().top;
    const runway = Math.max(shell.offsetHeight - window.innerHeight, 1);
    if (forceFinalFrame) {
      const safeMax = Math.max((video.duration || 10) - 0.05, 0);
      displayedTime = safeMax;
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = safeMax;
      }
    }
    skipHeroButton?.classList.add('is-hidden');
    cue?.classList.add('is-hidden');
    cueHidden = true;
    window.scrollTo({ top: shellTop + (runway * 0.91), behavior: 'auto' });
    requestAnimationFrame(() => {
      if (ready) animateVideoTime();
    });
  }

  skipHeroButton?.addEventListener('click', () => skipToCompletedHero(false));

  if (shouldSkipIntro && !window.location.hash) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    startLoop();
    requestAnimationFrame(() => requestAnimationFrame(() => skipToCompletedHero(true)));
  }
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    let returningFromInternalPage = false;
    try {
      returningFromInternalPage = sessionStorage.getItem('paintEventsIntroSeen') === '1';
    } catch (error) {
      returningFromInternalPage = true;
    }
    if (!returningFromInternalPage) return;
    shouldSkipIntro = true;
    video.pause();
    video.style.visibility = 'hidden';
    visual.style.background = '#0b2858';
    visual.classList.add('is-ready', 'is-skip-final');
    ready = true;
    window.addEventListener('scroll', scheduleHeroMagnet, { passive: true });
    startLoop();
    requestAnimationFrame(() => skipToCompletedHero(true));
  });

  window.addEventListener('pagehide', () => {
    stopLoop();
    clearTimeout(magnetTimer);
    window.removeEventListener('scroll', scheduleHeroMagnet);
  });
}


const miniGalleryTrack = document.querySelector('.mini-gallery-track');
if (miniGalleryTrack && !miniGalleryTrack.dataset.loopReady) {
  const originalSet = miniGalleryTrack.querySelector('.mini-gallery-set');
  if (originalSet) {
    for (let copyIndex = 0; copyIndex < 3; copyIndex += 1) {
      const clone = originalSet.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('img').forEach((image) => {
        image.alt = '';
        image.loading = 'eager';
      });
      miniGalleryTrack.appendChild(clone);
    }

    const syncGalleryLoop = () => {
      const gap = parseFloat(getComputedStyle(miniGalleryTrack).columnGap) || 0;
      const distance = originalSet.getBoundingClientRect().width + gap;
      miniGalleryTrack.style.setProperty('--mini-gallery-shift', `-${distance}px`);
    };

    requestAnimationFrame(syncGalleryLoop);
    window.addEventListener('load', syncGalleryLoop, { once: true });
    if ('ResizeObserver' in window) {
      new ResizeObserver(syncGalleryLoop).observe(originalSet);
    }
  }
  miniGalleryTrack.dataset.loopReady = 'true';
}

const contentMotionTargets = document.querySelectorAll([
  '.trust-strip .container',
  '.experiences .section-heading',
  '.experiences .experience-card',
  '.details-image',
  '.details-content > h2',
  '.details-content .benefit-grid article',
  '.estimator-intro',
  '.estimator-card',
  '.corporate-media',
  '.corporate-copy',
  '.real-events .section-heading',
  '.large-quote',
  '.gallery-main',
  '.mini-gallery',
  '.about-copy',
  '.faq-layout > *',
  '.final-cta-inner'
].join(','));
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  contentMotionTargets.forEach((item, index) => {
    item.classList.add('scroll-motion-section');
    item.style.setProperty('--motion-delay', `${(index % 4) * 70}ms`);
  });
  const contentMotionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('scroll-motion-visible');
        contentMotionObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
  contentMotionTargets.forEach((item) => contentMotionObserver.observe(item));
} else {
  contentMotionTargets.forEach((item) => {
    item.classList.add('scroll-motion-section', 'scroll-motion-visible');
  });
}
initializeScrollVideo();































