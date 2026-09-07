(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const revealSelectors = [
    '.hero-content',
    '.page-hero .hero-content',
    '.intro-content',
    '.section-title',
    '.feature-card',
    '.quick-link-card',
    '.course-card',
    '.journey-node',
    '.trip-card',
    '.method-card',
    '.gallery-item',
    '.process-step',
    '.form-content',
    '.trip-planning-note',
    '.gallery-cta .cta-content'
  ];

  document.documentElement.classList.add('motion-ready');

  function prepareReveals() {
    const elements = document.querySelectorAll(revealSelectors.join(','));
    elements.forEach((element, index) => {
      if (element.classList.contains('motion-reveal')) return;
      element.classList.add('motion-reveal');
      if (element.matches('.feature-card, .quick-link-card, .course-card, .trip-card, .method-card, .gallery-item')) {
        element.style.setProperty('--reveal-delay', `${Math.min(index % 4, 3) * 70}ms`);
      }
    });
    return elements;
  }

  function showAll() {
    document.querySelectorAll('.motion-reveal').forEach((element) => {
      element.classList.add('is-visible');
    });
  }

  function setupObserver() {
    if (document.body.classList.contains('home-pilot')) return;
    const elements = prepareReveals();
    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      showAll();
      return;
    }

    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });

    elements.forEach((element) => observer.observe(element));
  }

  function setupMobileMenu() {
    const getElements = () => ({
      toggle: document.querySelector('.nav-toggle'),
      menu: document.getElementById('primary-navigation')
    });

    const closeMenu = () => {
      const { toggle, menu } = getElements();
      if (!toggle || !menu) return;
      menu.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
    };

    document.addEventListener('click', (event) => {
      const { toggle, menu } = getElements();
      if (!toggle || !menu) return;
      if (event.target.closest('.nav-toggle')) {
        const isOpen = menu.classList.toggle('active');
        toggle.setAttribute('aria-expanded', String(isOpen));
        document.body.classList.toggle('menu-open', isOpen);
      } else if (event.target.closest('#primary-navigation a')) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.querySelector('#primary-navigation.active')) {
        closeMenu();
        document.querySelector('.nav-toggle')?.focus();
      }
    });
  }

  function setupNavigation() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    const updateNav = () => {
      navbar.classList.toggle('is-scrolled', window.scrollY > 16);
      document.documentElement.style.setProperty('--nav-height', `${navbar.getBoundingClientRect().height}px`);
    };
    updateNav();
    window.addEventListener('scroll', updateNav, { passive: true });
    window.addEventListener('resize', updateNav, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(updateNav).observe(navbar);
  }

  function syncMotionPreference(event) {
    if (event.matches) showAll();
    else setupObserver();
  }

  // Home owns a one-shot waterline enhancement; no continuous ambient animation.
  function setupHomeWaterline() {
    if (!document.body.classList.contains('home-pilot')) return;
    const waterline = document.querySelector('.pilot-waterline');
    if (!waterline || reduceMotion.matches || !('IntersectionObserver' in window)) return;

    let crossing;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || waterline.dataset.crossed) return;
        waterline.dataset.crossed = 'true';
        crossing = waterline.animate([
          { opacity: .35, transform: 'translateY(-24px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 900, easing: 'cubic-bezier(.2,.65,.3,1)', fill: 'forwards' });
        observer.unobserve(waterline);
      });
    }, { threshold: 0 });

    observer.observe(waterline);
    reduceMotion.addEventListener('change', () => {
      if (!reduceMotion.matches) return;
      crossing?.cancel();
      waterline.dataset.crossed = 'true';
    });
  }

  setupHomeWaterline();
  setupNavigation();
  setupMobileMenu();
  setupObserver();
  if (typeof reduceMotion.addEventListener === 'function') {
    reduceMotion.addEventListener('change', syncMotionPreference);
  }
})();
