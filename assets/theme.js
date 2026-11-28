/* Day and night. "Auto" follows the phone or computer's own dark mode; the reader can also fix
 * day or night, and the choice is remembered in this browser. The theme is set on <html> by a
 * small script in the page head before the first paint, so the page never flashes white at night;
 * this file adds the switch and follows the system while on "auto".
 */
(function () {
    'use strict';
    var KEY = 'ka-theme', root = document.documentElement, mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    var EN = /^en/i.test(root.getAttribute('lang') || '');          // the English edition's pages say lang="en"
    var MODES = ['auto', 'dark', 'light'], NAMES = EN ? { auto: 'Auto', dark: 'Night', light: 'Day' } : { auto: '跟随系统', dark: '夜间', light: '日间' };
    var ICONS = {
        auto: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor"/></svg>',
        dark: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7z" fill="currentColor"/></svg>',
        light: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="currentColor"/><g stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9 13 13M3 13l1.1-1.1M11.9 4.1 13 3"/></g></svg>'
    };
    function stored() { try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; } }
    var mode = stored();
    function apply() {
        var dark = mode === 'dark' || (mode === 'auto' && mq && mq.matches);
        root.setAttribute('data-theme', dark ? 'dark' : 'light');
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--k-page').trim() || (dark ? '#0F1012' : '#EBEEF2'));
        if (button) { button.innerHTML = ICONS[mode] + '<span>' + NAMES[mode] + '</span>'; button.title = EN ? 'Day / night: now "' + NAMES[mode] + '", click to switch' : '日间 / 夜间：现在是“' + NAMES[mode] + '”，点一下切换'; }
    }
    var button = null, nav = document.querySelector('.unit-nav');
    if (nav) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'theme-toggle';
        button.addEventListener('click', function () {
            mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
            try { localStorage.setItem(KEY, mode); } catch (e) { /* private window */ }
            root.classList.add('theme-changing');
            apply();
            setTimeout(function () { root.classList.remove('theme-changing'); }, 400);
        });
        var before = nav.querySelector('.read-toggle');
        if (before) nav.insertBefore(button, before); else nav.appendChild(button);
    }
    if (mq) {
        var follow = function () { if (mode === 'auto') apply(); };
        if (mq.addEventListener) mq.addEventListener('change', follow); else if (mq.addListener) mq.addListener(follow);
    }
    apply();
})();
