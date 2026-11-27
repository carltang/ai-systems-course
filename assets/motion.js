/* Motion that answers the reader: turning to the next or previous unit, and opening or closing
 * the folded parts of a lesson. With "reduce motion" set in the system, everything still works
 * and nothing moves.
 *
 * The page turn itself is a cross-document view transition (see lesson.css). Which way the page
 * slides is passed to the next page in sessionStorage and read there before the first paint
 * (the small script in the page head), because the transition is drawn by the new page.
 */
(function () {
    'use strict';
    var root = document.documentElement;
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── turning the page ────────────────────────────────────────────────────────────────
    function mark(dir) { try { sessionStorage.setItem('ka-nav', dir); } catch (e) { /* private window */ } }
    function direction(a) {
        if (!a) return null;
        if (a.getAttribute('data-step')) return a.getAttribute('data-step') === 'next' ? 'forward' : 'back';
        if (a.closest('.unit-pager')) return a.classList.contains('next') ? 'forward' : 'back';
        return null;
    }
    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[data-step], .unit-pager a'), dir = direction(a);
        if (dir && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) mark(dir);
    }, true);
    // the direction belongs to one arrival only: clear it once this page has slid in
    window.addEventListener('pagereveal', function (e) {
        var vt = e.viewTransition, done = function () { root.removeAttribute('data-nav'); };
        if (!vt) { done(); return; }
        vt.ready.catch(function () {});                    // an interrupted turn is not an error: the page is simply there
        vt.finished.then(done, done);
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted) root.removeAttribute('data-nav'); });
    setTimeout(function () { root.removeAttribute('data-nav'); }, 1500);

    // ← → (and [ ]) turn the page, except while typing, inside a demo, or over a zoomed drawing
    document.addEventListener('keydown', function (e) {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
        var k = e.key, fwd = k === ']' || k === 'ArrowRight', back = k === '[' || k === 'ArrowLeft';
        if (!fwd && !back) return;
        var t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || (t.closest && t.closest('.demo, iframe')))) return;
        if (document.querySelector('.fig-veil')) return;
        if ((k === 'ArrowLeft' || k === 'ArrowRight') && document.getElementById('deck')) return;   // the guide deck has the arrows
        var a = document.querySelector(fwd ? 'a[data-step="next"]' : 'a[data-step="prev"]');
        if (!a) return;
        e.preventDefault();
        mark(fwd ? 'forward' : 'back');
        location.href = a.href;
    });

    // ── opening and closing the folded parts ────────────────────────────────────────────
    var OPEN = { duration: 260, easing: 'cubic-bezier(.2, 0, 0, 1)' }, CLOSE = { duration: 200, easing: 'cubic-bezier(.4, 0, 1, 1)' };
    function heights(d) {                                  // closed and open heights, measured within one frame
        var was = d.open;
        d.style.height = '';
        d.open = true; var full = d.getBoundingClientRect().height;
        d.open = false; var closed = d.getBoundingClientRect().height;
        d.open = was;
        return { closed: closed, full: full };
    }
    function settle(d) { d.style.overflow = ''; d.style.height = ''; d.classList.remove('is-closing'); d._anim = null; }
    function toggle(d, summary) {
        var body = summary.nextElementSibling, opening = d._target ? d._target === 'closed' : !d.open;
        var from = d.getBoundingClientRect().height;       // where it is now, even halfway through a previous animation
        if (d._anim) { d._anim.onfinish = null; d._anim.cancel(); }
        var h = heights(d);
        d._target = opening ? 'open' : 'closed';
        d.style.overflow = 'hidden';
        if (opening) {
            d.open = true; d.classList.remove('is-closing');
            d._anim = d.animate({ height: [from + 'px', h.full + 'px'] }, OPEN);
            if (body) body.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], OPEN);
            d._anim.onfinish = function () { settle(d); d._target = null; };
        } else {
            d.classList.add('is-closing');
            d._anim = d.animate({ height: [from + 'px', h.closed + 'px'] }, CLOSE);
            if (body) body.animate([{ opacity: 1 }, { opacity: 0 }], CLOSE);
            d._anim.onfinish = function () { d.open = false; settle(d); d._target = null; };
            // after reading far down a long fold, closing it would leave the reader lost: bring its title back
            var top = summary.getBoundingClientRect().top;
            if (top < 0) window.scrollBy({ top: top - 16, behavior: 'smooth' });
        }
    }
    document.addEventListener('click', function (e) {
        var summary = e.target.closest && e.target.closest('details.i-more > summary');
        if (!summary || still || e.defaultPrevented || !summary.parentNode.animate) return;
        e.preventDefault();
        toggle(summary.parentNode, summary);
    });
})();
