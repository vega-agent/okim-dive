'use client'

// M2 port of scripts/site/site-motion.js — same reveal behavior, mobile menu,
// and scrolled-nav handling, with prefers-reduced-motion fallback preserved.
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

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
  '.gallery-cta .cta-content',
]

export default function SiteMotion() {
  const pathname = usePathname()

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    document.documentElement.classList.add('motion-ready')

    function prepareReveals() {
      const elements = document.querySelectorAll(revealSelectors.join(','))
      elements.forEach((element, index) => {
        if (element.classList.contains('motion-reveal')) return
        element.classList.add('motion-reveal')
        if (element.matches('.feature-card, .quick-link-card, .course-card, .trip-card, .method-card, .gallery-item')) {
          ;(element as HTMLElement).style.setProperty('--reveal-delay', `${Math.min(index % 4, 3) * 70}ms`)
        }
      })
      return elements
    }

    function showAll() {
      document.querySelectorAll('.motion-reveal').forEach((element) => {
        element.classList.add('is-visible')
      })
    }

    let observer: IntersectionObserver | null = null
    function setupObserver() {
      observer?.disconnect()
      const elements = prepareReveals()
      if (reduceMotion.matches || !('IntersectionObserver' in window)) {
        showAll()
        return
      }
      observer = new IntersectionObserver((entries, currentObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-visible')
          currentObserver.unobserve(entry.target)
        })
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 })
      elements.forEach((element) => observer!.observe(element))
    }

    function setupMobileMenu() {
      const getElements = () => ({
        toggle: document.querySelector('.nav-toggle'),
        menu: document.getElementById('primary-navigation'),
      })
      const closeMenu = () => {
        const { toggle, menu } = getElements()
        if (!toggle || !menu) return
        menu.classList.remove('active')
        toggle.setAttribute('aria-expanded', 'false')
        document.body.classList.remove('menu-open')
      }
      const onClick = (event: MouseEvent) => {
        const target = event.target as Element | null
        const { toggle, menu } = getElements()
        if (!toggle || !menu || !target) return
        if (target.closest('.nav-toggle')) {
          const isOpen = menu.classList.toggle('active')
          toggle.setAttribute('aria-expanded', String(isOpen))
          document.body.classList.toggle('menu-open', isOpen)
        } else if (target.closest('#primary-navigation a')) {
          closeMenu()
        }
      }
      const onKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && document.querySelector('#primary-navigation.active')) {
          closeMenu()
          ;(document.querySelector('.nav-toggle') as HTMLElement | null)?.focus()
        }
      }
      document.addEventListener('click', onClick)
      document.addEventListener('keydown', onKeydown)
      return () => {
        document.removeEventListener('click', onClick)
        document.removeEventListener('keydown', onKeydown)
      }
    }

    function setupNavigation() {
      const navbar = document.querySelector('.navbar')
      if (!navbar) return () => {}
      const updateNav = () => {
        navbar.classList.toggle('is-scrolled', window.scrollY > 16)
        document.documentElement.style.setProperty('--nav-height', `${navbar.getBoundingClientRect().height}px`)
      }
      updateNav()
      window.addEventListener('scroll', updateNav, { passive: true })
      window.addEventListener('resize', updateNav, { passive: true })
      const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(updateNav) : null
      resizeObserver?.observe(navbar)
      return () => {
        window.removeEventListener('scroll', updateNav)
        window.removeEventListener('resize', updateNav)
        resizeObserver?.disconnect()
      }
    }

    function syncMotionPreference(event: MediaQueryListEvent) {
      if (event.matches) showAll()
      else setupObserver()
    }

    const cleanupNavigation = setupNavigation()
    const cleanupMenu = setupMobileMenu()
    setupObserver()
    if (typeof reduceMotion.addEventListener === 'function') {
      reduceMotion.addEventListener('change', syncMotionPreference)
    }

    return () => {
      cleanupNavigation()
      cleanupMenu()
      observer?.disconnect()
      if (typeof reduceMotion.removeEventListener === 'function') {
        reduceMotion.removeEventListener('change', syncMotionPreference)
      }
    }
    // Navbar/menu/nav listeners attach once; reveals re-run per route below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Re-prepare reveals for newly mounted page content after client navigation.
    const elements = document.querySelectorAll(revealSelectors.join(','))
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    elements.forEach((element, index) => {
      if (element.classList.contains('motion-reveal')) return
      element.classList.add('motion-reveal')
      if (element.matches('.feature-card, .quick-link-card, .course-card, .trip-card, .method-card, .gallery-item')) {
        ;(element as HTMLElement).style.setProperty('--reveal-delay', `${Math.min(index % 4, 3) * 70}ms`)
      }
      if (reduceMotion.matches) element.classList.add('is-visible')
    })
    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        currentObserver.unobserve(entry.target)
      })
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 })
    elements.forEach((element) => {
      if (!element.classList.contains('is-visible')) observer.observe(element)
    })
    return () => observer.disconnect()
  }, [pathname])

  return null
}