/**
 * scroll-animations.js
 *
 * Auto-applies IntersectionObserver-based scroll animations to predefined
 * elements across all pages. Each element animates in exactly once per page
 * load (unobserved after first trigger). Resets on page refresh.
 */
(function () {
    'use strict';

    var FADE_UP   = 'fade-up';
    var FADE_LEFT = 'fade-left';
    var SCALE_IN  = 'scale-in';

    // Stagger timing
    var STAGGER_MS     = 80;   // delay between siblings
    var MAX_STAGGER_MS = 320;  // cap so large grids don't wait forever

    /**
     * Each entry: [CSS selector, animation type, isStagger]
     *
     * Non-stagger items animate as single units.
     * Stagger items are grouped by their immediate parent so siblings
     * cascade in with sequential delays.
     */
    var TARGETS = [
        // ── Page-level hero content (sub-pages only — main hero excluded)
        ['.page-hero-content',        FADE_UP,   false],
        ['.page-hero .hero-content',  FADE_UP,   false],
        ['.tools-hero-content',       FADE_UP,   false],

        // ── Section-level single elements
        ['.section-title',            FADE_UP,   false],
        ['.sponsors-title',           FADE_UP,   false],
        ['.lead-text',                FADE_UP,   false],
        ['.about-text',               FADE_UP,   false],
        ['.cta-content',              FADE_UP,   false],
        ['.video-container',          FADE_UP,   false],
        ['.tools-stats-strip',        FADE_UP,   false],

        // ── Stagger groups (siblings cascade by parent)
        ['.stat-card',                FADE_UP,   true],
        ['.team-member',              FADE_UP,   true],
        ['.mission-card',             FADE_UP,   true],
        ['.feature-card',             FADE_UP,   true],
        ['.program-card',             FADE_UP,   true],
        ['.involvement-card',         FADE_UP,   true],
        ['.sponsor-tier',             FADE_UP,   true],
        ['.story-card',               FADE_UP,   true],
        ['.achievement-item',         FADE_LEFT, true],
        ['.contact-method',           FADE_UP,   true],
        ['.tech-card',                FADE_UP,   true],
        ['.gallery-item',             SCALE_IN,  true],
        ['.spec-item',                FADE_LEFT, true],
        ['.sponsor-logo-item',        SCALE_IN,  true],
        ['.ftc-tool-card',            FADE_UP,   true],
    ];

    /**
     * Walk each target definition, find matching elements, and stamp them
     * with [data-sa] and an optional --sa-delay CSS custom property.
     * Skips any element that was already marked by a previous target rule.
     */
    function markElements() {
        TARGETS.forEach(function (entry) {
            var selector = entry[0];
            var anim     = entry[1];
            var stagger  = entry[2];

            var els = Array.from(document.querySelectorAll(selector));
            if (!els.length) return;

            if (stagger) {
                // Group matching siblings by their immediate parent so that
                // each parent's children get sequential stagger indices.
                var groups = new Map();
                els.forEach(function (el) {
                    var p = el.parentElement;
                    if (!groups.has(p)) groups.set(p, []);
                    groups.get(p).push(el);
                });

                groups.forEach(function (children) {
                    children.forEach(function (el, i) {
                        if (el.hasAttribute('data-sa')) return; // already claimed
                        el.setAttribute('data-sa', anim);
                        var delay = Math.min(i * STAGGER_MS, MAX_STAGGER_MS);
                        if (delay > 0) {
                            el.style.setProperty('--sa-delay', delay + 'ms');
                        }
                    });
                });
            } else {
                els.forEach(function (el) {
                    if (el.hasAttribute('data-sa')) return;
                    el.setAttribute('data-sa', anim);
                });
            }
        });
    }

    /**
     * Create an IntersectionObserver that adds .sa-visible when an element
     * enters the viewport. The element is unobserved immediately so the
     * animation plays only once per page load. After the animation finishes,
     * data-sa / sa-visible are cleaned up so hover effects work normally.
     */
    function setupObserver() {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;

                var el = entry.target;
                observer.unobserve(el);
                el.classList.add('sa-visible');

                // Clean up after animation so CSS hover effects are unaffected
                el.addEventListener('animationend', function () {
                    el.removeAttribute('data-sa');
                    el.classList.remove('sa-visible');
                    el.style.removeProperty('--sa-delay');
                }, { once: true });
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -60px 0px'
        });

        document.querySelectorAll('[data-sa]').forEach(function (el) {
            observer.observe(el);
        });
    }

    /**
     * Entry point. A .sa-init class is added to <html> while elements are
     * being hidden so that any existing CSS transitions don't animate
     * elements flying *off* screen. Removed after two rAFs (safely after
     * the browser has processed the new hidden states).
     */
    function init() {
        document.documentElement.classList.add('sa-init');
        markElements();

        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                document.documentElement.classList.remove('sa-init');
                setupObserver();
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
