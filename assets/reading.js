// Full-screen reading for a lesson: only the lesson is left on the page. The choice is kept
// from unit to unit (and put on <html> in the page head, so a new unit opens already in it); the browser's own full screen is entered on a click or the F key.
(function () {
    var KEY = 'ka-reading', page = document.documentElement, button = document.getElementById('read-toggle'), leaving = false;
    if (!button) return;
    var T = /^en/i.test(page.getAttribute('lang') || '')            // the English edition's pages say lang="en"
        ? { exit: 'Exit full screen', read: 'Full-screen reading', exitTitle: 'Leave full-screen reading (Esc or F)', readTitle: 'Only the explanation, full screen (shortcut F)',
            widths: ['narrow', 'medium', 'wide'], widthTitle: 'How wide the text is while reading full screen (shortcut W)', width: 'Width: ' }
        : { exit: '退出全屏', read: '全屏阅读', exitTitle: '退出全屏阅读（Esc 或 F）', readTitle: '只留下讲解，全屏阅读（快捷键 F）',
            widths: ['窄', '中', '宽'], widthTitle: '全屏阅读时版心的宽度（快捷键 W）', width: '版心：' };

    function remember(on) { try { localStorage.setItem(KEY, on ? '1' : ''); } catch (e) { /* private window */ } }
    function reading() { return page.classList.contains('reading'); }

    function set(on, screen) {
        page.classList.toggle('reading', on);
        button.textContent = on ? T.exit : T.read;
        button.title = on ? T.exitTitle : T.readTitle;
        remember(on);
        if (!screen) return;
        var root = document.documentElement;
        if (on && root.requestFullscreen && !document.fullscreenElement) root.requestFullscreen().catch(function () {});
        if (!on && document.fullscreenElement) document.exitFullscreen().catch(function () {});
    }

    button.addEventListener('click', function () { set(!reading(), true); });
    window.addEventListener('pagehide', function () { leaving = true; });
    window.addEventListener('beforeunload', function () { leaving = true; });
    document.addEventListener('fullscreenchange', function () {
        if (!leaving && !document.fullscreenElement && reading()) set(false, false);   // Esc left the browser's full screen
    });
    document.addEventListener('keydown', function (e) {
        var t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
        if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
        if (zoomed()) { if (e.key === 'Escape') unzoom(); return; }
        if (e.key === 'f' || e.key === 'F') { e.preventDefault(); set(!reading(), true); }
        else if (e.key === 'Escape' && reading() && !document.fullscreenElement) set(false, false);
    });
    try { if (localStorage.getItem(KEY)) set(true, false); } catch (e) { /* private window */ }

    // how wide the page is while reading: narrow, medium (the default) or wide; kept like the mode itself
    var WIDTHS = [['narrow', T.widths[0]], ['', T.widths[1]], ['wide', T.widths[2]]], WKEY = 'ka-reading-width', width = 1;
    var widthButton = document.createElement('button');
    widthButton.type = 'button';
    widthButton.className = 'read-width';
    widthButton.title = T.widthTitle;
    function setWidth(i) {
        width = (i + WIDTHS.length) % WIDTHS.length;
        WIDTHS.forEach(function (w) { if (w[0]) page.classList.toggle('read-' + w[0], w === WIDTHS[width]); });
        widthButton.textContent = T.width + WIDTHS[width][1];
        try { localStorage.setItem(WKEY, String(width)); } catch (e) { /* private window */ }
    }
    widthButton.addEventListener('click', function () { setWidth(width + 1); });
    button.parentNode.appendChild(widthButton);
    try { var saved = parseInt(localStorage.getItem(WKEY), 10); setWidth(isNaN(saved) ? 1 : saved); } catch (e) { setWidth(1); }
    document.addEventListener('keydown', function (e) {
        var t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
        if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && reading() && (e.key === 'w' || e.key === 'W')) setWidth(width + 1);
    });

    // a drawing opens large on a click
    var veil = null;
    function zoomed() { return !!veil; }
    function unzoom() { if (veil) { veil.remove(); veil = null; } }
    document.addEventListener('click', function (e) {
        var img = e.target.closest ? e.target.closest('figure.fig img') : null;
        if (!img) return;
        veil = document.createElement('div');
        veil.className = 'fig-veil';
        var big = document.createElement('img');
        big.src = img.src; big.alt = img.alt;
        veil.appendChild(big);
        veil.addEventListener('click', unzoom);
        document.body.appendChild(veil);
    });
})();
