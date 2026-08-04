document.documentElement.classList.add('js');

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const header = document.querySelector('#site-header');
const menuButton = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('#mobile-menu');
const mobileStickyCta = document.querySelector('.mobile-sticky-cta');

function setHeaderState() {
  header?.classList.toggle('scrolled', window.scrollY > 32);
  const home = document.querySelector('#home');
  mobileStickyCta?.classList.toggle('is-visible', Boolean(home && window.scrollY >= home.offsetTop + home.offsetHeight * .72));
}

function closeMenu({ restoreFocus = false } = {}) {
  if (!menuButton || !mobileMenu) return;
  mobileMenu.hidden = true;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open menu');
  header?.classList.remove('menu-open');
  if (restoreFocus) menuButton.focus();
}

setHeaderState();
window.addEventListener('scroll', setHeaderState, { passive: true });

menuButton?.addEventListener('click', () => {
  const willOpen = menuButton.getAttribute('aria-expanded') !== 'true';
  mobileMenu.hidden = !willOpen;
  menuButton.setAttribute('aria-expanded', String(willOpen));
  menuButton.setAttribute('aria-label', willOpen ? 'Close menu' : 'Open menu');
  header?.classList.toggle('menu-open', willOpen);
  if (willOpen) mobileMenu.querySelector('a')?.focus();
});

mobileMenu?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => closeMenu()));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') closeMenu({ restoreFocus: true });
});

/* Opening scroll-controlled video */
function initializeOpeningVideo() {
  const shell = document.querySelector('.intro-scroll-shell');
  const media = document.querySelector('#intro-media');
  const video = document.querySelector('#hero-paint-video');
  const status = document.querySelector('#video-status');
  const choice = document.querySelector('#intro-choice');
  const startButton = document.querySelector('#scroll-to-paint');
  const progressWrap = document.querySelector('.intro-progress');
  const progressBar = document.querySelector('#intro-progress-bar');
  const completeLink = document.querySelector('#intro-complete');
  const enterLink = document.querySelector('#enter-website');
  const skipLink = document.querySelector('.skip-link');
  const flyingLogo = document.querySelector('#intro-logo-flight');
  const headerBrand = document.querySelector('.site-header .brand');
  if (!shell || !media || !video) return;

  let duration = 0;
  let displayedTime = 0;
  let frame = 0;
  let ready = false;
  let introSkipped = false;
  let autoScrollFrame = 0;

  const getProgress = () => {
    if (prefersReducedMotion.matches) return 0;
    const rect = shell.getBoundingClientRect();
    const runway = Math.max(shell.offsetHeight - window.innerHeight, 1);
    return Math.min(1, Math.max(0, -rect.top / runway));
  };

  function render() {
    frame = 0;
    const progress = introSkipped ? 1 : getProgress();
    choice?.classList.toggle('is-hidden', progress > .075);
    progressWrap?.classList.toggle('is-visible', progress > .075 && progress < .94);
    completeLink?.classList.toggle('is-visible', progress > .91);
    if (progressBar) progressBar.style.transform = `scaleX(${progress.toFixed(4)})`;
    if (flyingLogo && headerBrand) {
      const revealStart = .79;
      const travelStart = .87;
      const travelEnd = .985;
      const reveal = Math.min(1, Math.max(0, (progress - revealStart) / .045));
      const travel = Math.min(1, Math.max(0, (progress - travelStart) / (travelEnd - travelStart)));
      const easedTravel = 1 - Math.pow(1 - travel, 3);
      const brandRect = headerBrand.getBoundingClientRect();
      const startSize = Math.min(window.innerWidth * .28, window.innerHeight * .38, 360);
      const endSize = Math.max(brandRect.width, brandRect.height);
      const startX = (window.innerWidth - startSize) / 2;
      const startY = (window.innerHeight - startSize) / 2;
      const endX = brandRect.left + (brandRect.width - endSize) / 2;
      const endY = brandRect.top + (brandRect.height - endSize) / 2;
      const size = startSize + (endSize - startSize) * easedTravel;
      const x = startX + (endX - startX) * easedTravel;
      const y = startY + (endY - startY) * easedTravel;

      flyingLogo.style.setProperty('--flight-x', `${x}px`);
      flyingLogo.style.setProperty('--flight-y', `${y}px`);
      flyingLogo.style.setProperty('--flight-size', `${size}px`);
      flyingLogo.style.setProperty('--flight-opacity', `${reveal * (travel < .94 ? 1 : Math.max(0, (1 - travel) / .06))}`);
      flyingLogo.classList.toggle('is-active', progress > revealStart && progress < 1);
      headerBrand.style.setProperty('--brand-flight-opacity', progress >= travelStart && progress < travelEnd ? `${Math.max(0, (travel - .72) / .28)}` : '1');
    }

    if (!ready || prefersReducedMotion.matches || !duration) return;
    const safeDuration = Math.max(duration - .05, 0);
    const target = safeDuration * progress;
    displayedTime += (target - displayedTime) * .16;
    if (Math.abs(target - displayedTime) < .008) displayedTime = target;
    try {
      if (!video.seeking && Math.abs(video.currentTime - displayedTime) > .01) video.currentTime = displayedTime;
    } catch (error) {
      /* A rejected seek is harmless; the next frame retries. */
    }
    if (Math.abs(target - displayedTime) > .01) requestRender();
  }

  function requestRender() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  function markReady() {
    if (ready) return;
    ready = true;
    duration = Number.isFinite(video.duration) ? video.duration : 0;
    media.classList.add('is-ready');
    media.setAttribute('aria-busy', 'false');
    status.textContent = '';
    video.pause();
    if (prefersReducedMotion.matches && duration) {
      try { video.currentTime = Math.max(duration - .05, 0); } catch (error) { /* Poster remains as fallback. */ }
    }
    requestRender();
  }

  video.addEventListener('loadedmetadata', markReady, { once: true });
  video.addEventListener('loadeddata', markReady, { once: true });
  video.addEventListener('error', () => {
    media.classList.add('has-video-error');
    media.setAttribute('aria-busy', 'false');
    status.textContent = 'The video could not load. Both website choices remain available.';
  }, { once: true });
  if (video.readyState >= 1) markReady();

  const finishIntroAndEnter = (event) => {
    event?.preventDefault();
    introSkipped = true;
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    if (autoScrollFrame) {
      cancelAnimationFrame(autoScrollFrame);
      autoScrollFrame = 0;
    }
    const finishTime = Math.max((duration || video.duration || 0) - .05, 0);
    displayedTime = finishTime;
    video.pause();
    if (finishTime) {
      try { video.currentTime = finishTime; } catch (error) { /* Poster remains as fallback. */ }
    }
    choice?.classList.add('is-hidden');
    progressWrap?.classList.remove('is-visible');
    completeLink?.classList.add('is-visible');
    if (progressBar) progressBar.style.transform = 'scaleX(1)';
    flyingLogo?.classList.remove('is-active');
    headerBrand?.style.setProperty('--brand-flight-opacity', '1');
    const home = document.querySelector('#home');
    if (home) {
      try { history.replaceState(null, '', '#home'); } catch (error) { /* file:// can reject history writes. */ }
      const previousScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      const goToHero = () => {
        const liveHeader = document.querySelector('.site-header');
        const headerHeight = liveHeader?.getBoundingClientRect().height || 76;
        document.documentElement.style.setProperty('--live-header-h', `${headerHeight}px`);
        const heroTop = home.getBoundingClientRect().top + window.scrollY - headerHeight;
        window.scrollTo({ top: Math.max(0, heroTop), left: 0, behavior: 'auto' });
      };
      goToHero();
      requestAnimationFrame(() => requestAnimationFrame(goToHero));
      window.setTimeout(() => {
        goToHero();
        document.documentElement.style.scrollBehavior = previousScrollBehavior;
      }, 180);
    }
  };

  enterLink?.addEventListener('click', finishIntroAndEnter);
  completeLink?.addEventListener('click', finishIntroAndEnter);
  skipLink?.addEventListener('click', finishIntroAndEnter);
  startButton?.addEventListener('click', () => {
    const startY = window.scrollY;
    const targetY = shell.offsetTop + Math.max(shell.offsetHeight - window.innerHeight, 1);
    if (prefersReducedMotion.matches) {
      window.scrollTo(0, targetY);
      return;
    }
    if (autoScrollFrame) cancelAnimationFrame(autoScrollFrame);
    const previousScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    const startedAt = performance.now();
    const travelTime = 3200;
    const animateScroll = (now) => {
      const progress = Math.min(1, (now - startedAt) / travelTime);
      const eased = progress < .5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      window.scrollTo({ top: startY + (targetY - startY) * eased, left: 0, behavior: 'auto' });
      if (progress < 1) autoScrollFrame = requestAnimationFrame(animateScroll);
      else {
        autoScrollFrame = 0;
        document.documentElement.style.scrollBehavior = previousScrollBehavior;
      }
    };
    autoScrollFrame = requestAnimationFrame(animateScroll);
  });

  window.addEventListener('scroll', requestRender, { passive: true });
  window.addEventListener('resize', requestRender, { passive: true });
  prefersReducedMotion.addEventListener?.('change', requestRender);
  requestRender();
}

initializeOpeningVideo();
function syncLiveHeaderHeight() {
  const liveHeader = document.querySelector('.site-header');
  if (!liveHeader) return;
  document.documentElement.style.setProperty('--live-header-h', `${liveHeader.getBoundingClientRect().height}px`);
}
window.addEventListener('resize', syncLiveHeaderHeight, { passive: true });
window.addEventListener('load', syncLiveHeaderHeight, { once: true });
requestAnimationFrame(syncLiveHeaderHeight);

/* Calendar and homepage request estimator */
const calendarGrid = document.querySelector('#booking-calendar');
const calendarMonthLabel = document.querySelector('#calendar-month');
const calendarStatus = document.querySelector('#calendar-status');
const calendarPrev = document.querySelector('#calendar-prev');
const calendarNext = document.querySelector('#calendar-next');
const dateInput = document.querySelector('#event-date');
const estimatorForm = document.querySelector('#estimator-form');
const guestInput = document.querySelector('#guest-count');
const durationInput = document.querySelector('#duration');
const estimateTotal = document.querySelector('#estimate-total');
const guestBreakdown = document.querySelector('#guest-breakdown');
const formError = document.querySelector('#form-error');

const today = new Date();
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = '';

const toDateValue = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateValue = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
};

if (dateInput) dateInput.min = toDateValue(tomorrow);

function renderCalendar() {
  if (!calendarGrid || !calendarMonthLabel) return;
  try {
    calendarGrid.replaceChildren();
    calendarMonthLabel.textContent = visibleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/Los_Angeles' });
    const firstWeekday = visibleMonth.getDay();
    const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
    const pendingDate = localStorage.getItem('paintEventsPendingDate') || '';

    for (let index = 0; index < firstWeekday; index += 1) {
      const spacer = document.createElement('span');
      spacer.className = 'calendar-empty';
      spacer.setAttribute('role', 'gridcell');
      calendarGrid.append(spacer);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
      const value = toDateValue(date);
      const isUnavailable = date < tomorrow;
      const isSelected = value === selectedDate;
      const isPending = value === pendingDate && !isSelected;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'calendar-day';
      button.textContent = String(day);
      button.disabled = isUnavailable;
      button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-selected', String(isSelected));
      const spokenDate = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      const state = isUnavailable ? 'unavailable' : isSelected ? 'selected' : isPending ? 'pending request on this device' : 'requestable';
      button.setAttribute('aria-label', `${spokenDate}, ${state}`);
      if (isSelected) button.classList.add('is-selected');
      if (isPending) button.classList.add('is-pending');
      if (!isUnavailable) button.addEventListener('click', () => selectDate(value, { announce: true }));
      calendarGrid.append(button);
    }

    const currentMonth = today.getFullYear() * 12 + today.getMonth();
    const shownMonth = visibleMonth.getFullYear() * 12 + visibleMonth.getMonth();
    calendarPrev.disabled = shownMonth <= currentMonth;
    calendarNext.disabled = shownMonth >= currentMonth + 18;
    calendarStatus.textContent = selectedDate
      ? `${parseDateValue(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} selected for your request. This is not a confirmed reservation.`
      : 'Future dates are requestable. Select one to begin; Paint Events will review availability.';
  } catch (error) {
    calendarGrid.innerHTML = '<p role="alert">The visual calendar is unavailable. Use the preferred date field in the form.</p>';
    calendarStatus.textContent = 'Calendar error. The date field remains available.';
  }
}

function selectDate(value, { announce = false } = {}) {
  selectedDate = value;
  if (dateInput) {
    dateInput.value = value;
    dateInput.setAttribute('aria-invalid', 'false');
  }
  if (announce && calendarStatus) calendarStatus.textContent = 'Preferred date selected. Availability will be reviewed after your request.';
  renderCalendar();
}

calendarPrev?.addEventListener('click', () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  renderCalendar();
});
calendarNext?.addEventListener('click', () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  renderCalendar();
});
dateInput?.addEventListener('change', () => {
  const parsed = parseDateValue(dateInput.value);
  if (!parsed) return;
  visibleMonth = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  selectDate(dateInput.value);
});
renderCalendar();

function rateFor(guests, duration) {
  if (!guests || guests < 4) return 0;
  if (Number(duration) === 90) return guests <= 9 ? 50 : 35;
  return guests <= 9 ? 65 : 50;
}

function updateEstimate() {
  if (!guestInput || !durationInput) return;
  const guests = Number(guestInput.value);
  const duration = Number(durationInput.value);
  const rate = rateFor(guests, duration);
  const base = guests * rate;
  const discount = guests >= 60 ? Math.round(base * .1) : 0;
  const subtotal = base - discount;
  if (estimateTotal) estimateTotal.textContent = rate ? `$${subtotal.toLocaleString()}` : '—';
  if (guestBreakdown) guestBreakdown.textContent = rate
    ? `${guests} guests × $${rate} · ${duration} minutes${discount ? ' · 10% group discount' : ''}`
    : 'Enter 4–100 guests';
}

guestInput?.addEventListener('input', updateEstimate);
durationInput?.addEventListener('change', updateEstimate);
updateEstimate();

function setFieldError(field, message) {
  if (!field) return;
  field.setAttribute('aria-invalid', String(Boolean(message)));
  const error = document.querySelector(`#${field.id}-error`);
  if (error) error.textContent = message;
}

estimatorForm?.addEventListener('submit', event => {
  event.preventDefault();
  const typeField = document.querySelector('#event-type');
  const zipField = document.querySelector('#zip-code');
  const type = typeField.value;
  const guests = Number(guestInput.value);
  const date = dateInput.value;
  const zip = zipField.value.trim();
  const duration = Number(durationInput.value);

  setFieldError(typeField, type ? '' : 'Choose an event type.');
  setFieldError(guestInput, guests >= 4 && guests <= 100 ? '' : 'Enter between 4 and 100 guests.');
  setFieldError(dateInput, date && parseDateValue(date) >= tomorrow ? '' : 'Choose a future preferred date.');
  setFieldError(zipField, /^\d{5}$/.test(zip) ? '' : 'Enter a five-digit ZIP code.');

  const invalidField = estimatorForm.querySelector('[aria-invalid="true"]');
  if (invalidField) {
    formError.textContent = 'Review the highlighted fields before continuing.';
    invalidField.focus();
    return;
  }

  formError.textContent = '';
  const estimate = { type, guests, date, zip, duration };
  sessionStorage.setItem('paintEventsEstimate', JSON.stringify(estimate));
  const params = new URLSearchParams(estimate);
  window.location.href = `paint-events-booking-v2.html?${params.toString()}`;
});

/* Progressive disclosure without hiding content from reduced-motion users */
const revealTargets = document.querySelectorAll('.service-card, .process-grid li, .booking-layout, .corporate-layout, .gallery-grid, .about-layout, .review-card');
if ('IntersectionObserver' in window && !prefersReducedMotion.matches) {
  revealTargets.forEach(target => target.classList.add('reveal'));
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    });
  }, { threshold: .1 });
  revealTargets.forEach(target => observer.observe(target));
}






/* Three-line Google review previews. */
function initializeReviewReadMore() {
  document.querySelectorAll('.review-card').forEach((card) => {
    const text = card.querySelector('p');
    if (!text || card.querySelector('.review-read-more')) return;
    text.classList.add('review-text');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'review-read-more';
    button.textContent = 'Read more';
    button.setAttribute('aria-expanded', 'false');
    text.insertAdjacentElement('afterend', button);
    const measure = () => card.classList.toggle('has-overflow', text.scrollHeight > text.clientHeight + 2 || card.classList.contains('is-expanded'));
    button.addEventListener('click', () => {
      const expanded = card.classList.toggle('is-expanded');
      button.textContent = expanded ? 'Read less' : 'Read more';
      button.setAttribute('aria-expanded', String(expanded));
      measure();
    });
    requestAnimationFrame(measure);
  });
}
initializeReviewReadMore();





