(() => {
  /* Land at the top of a page you have just navigated to. Browsers otherwise
     restore the previous scroll offset, which drops you into the middle of the
     new page. Back/forward still restore where you were, and links carrying a
     #fragment still jump to their target. */
  if ('scrollRestoration' in history) {
    const entry = performance.getEntriesByType('navigation')[0];
    const isReturn = entry ? entry.type === 'back_forward' : false;
    if (!isReturn && !location.hash) {
      history.scrollRestoration = 'manual';
      window.scrollTo(0, 0);
      addEventListener('DOMContentLoaded', () => window.scrollTo(0, 0), { once: true });
      addEventListener('load', () => window.scrollTo(0, 0), { once: true });
    } else {
      history.scrollRestoration = 'auto';
    }
  }

  const script = document.currentScript;
  const rootUrl = new URL('../', script.src);
  const href = (path) => new URL(path, rootUrl).href;
  const pagePath = decodeURIComponent(location.pathname).replace(/\\/g, '/').toLowerCase();
  const isHome = /\/p\.e 3\/(?:index(?:-updated|-v3)?\.html)?$/.test(pagePath);
  const active = pagePath.includes('/services/') ? 'services'
    : pagePath.endsWith('/gallery.html') ? 'gallery'
    : pagePath.includes('/about/') ? 'about'
    : pagePath.includes('/faq/') ? 'faq' : '';
  const homeHref = isHome ? '#top' : href('index.html?skipIntro=1');
  const links = [
    ['services', 'Services', href('services/index.html')],
    ['gallery', 'Gallery', href('gallery.html')],
    ['about', 'About', href('about/index.html')],
    ['faq', 'FAQ', href('faq/index.html')]
  ];
  const navLinks = links.map(([key, label, url]) => `<a href="${url}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const headerClass = isHome ? 'site-header pe-shared-navbar' : 'site-header pe-shared-navbar scrolled';
  document.write(`<link rel="stylesheet" href="${href('components/navbar.css')}"><header class="${headerClass}" id="site-header">
    <div class="container header-inner">
      <a class="brand" href="${homeHref}" aria-label="Paint Events home"><img src="${href('assets/images/paint-events-logo-transparent.png')}" alt="" width="54" height="54"></a>
      <nav class="desktop-nav" aria-label="Primary navigation">${navLinks}</nav>
      <a class="button button-primary header-cta" href="${href('paint-events-booking-v2.html')}">Start a request <span aria-hidden="true">↗</span></a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" aria-label="Open menu"><span></span><span></span><span></span></button>
    </div>
    <nav class="mobile-menu" id="mobile-menu" aria-label="Mobile navigation" hidden>${navLinks}<a class="button button-primary" href="${href('paint-events-booking-v2.html')}">Start a request</a></nav>
  </header>`);
  const header = document.getElementById('site-header');
  const toggle = header?.querySelector('.menu-toggle');
  const menu = header?.querySelector('.mobile-menu');
  toggle?.addEventListener('click', () => {
    const open = !header.classList.contains('menu-open');
    header.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (menu) menu.hidden = !open;
  });
})();
