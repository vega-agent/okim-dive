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
    '.trip-card',
    '.method-card',
    '.included-item',
    '.gallery-item',
    '.process-step',
    '.form-content',
    '.calendar-note',
    '.gallery-cta .cta-content'
  ];

  document.documentElement.classList.add('motion-ready');

  function prepareReveals() {
    const elements = document.querySelectorAll(revealSelectors.join(','));
    elements.forEach((element, index) => {
      if (element.classList.contains('motion-reveal')) return;
      element.classList.add('motion-reveal');
      if (element.matches('.feature-card, .quick-link-card, .course-card, .trip-card, .method-card, .included-item, .gallery-item')) {
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

  function setupNavigation() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    const updateNav = () => navbar.classList.toggle('is-scrolled', window.scrollY > 16);
    updateNav();
    window.addEventListener('scroll', updateNav, { passive: true });
  }

  function syncMotionPreference(event) {
    if (event.matches) showAll();
    else setupObserver();
  }

  setupNavigation();
  setupObserver();
  if (typeof reduceMotion.addEventListener === 'function') {
    reduceMotion.addEventListener('change', syncMotionPreference);
  }
})();
