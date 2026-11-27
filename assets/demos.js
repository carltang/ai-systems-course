/* Interactive demonstrations for the course.
 *
 * A demo takes the place of one of the course's drawings: a figure whose image is
 * figures/<name>.svg becomes a live instrument when a demo of that name is registered here.
 * The drawing stays in the page, so print, no-script readers and search engines still get it.
 *
 * Every number a demo shows is computed from the controls in front of the reader, using the
 * relations the lesson beside it states. Where a demo needs a value the lesson does not give
 * (how long a memory access takes in cycles, say), the panel says it is illustrative.
 */
(function () {
    'use strict';

    // The four kinds of waiting keep one colour each across the whole course.
    var C = {
        data: '#F2B544', compute: '#6E9BFF', launch: '#B49BFF', peers: '#3DD6A0', alert: '#FF7A7A',
        ink: '#E9EEF5', soft: '#A4B3C4', dim: '#6B7D91', faint: '#2A3B50', grid: '#1C2B3D', panel: '#0D1722', well: '#121F2E'
    };
    var MONO = '"IBM Plex Mono", "SF Mono", Menlo, Consolas, monospace';
    var SANS = '"IBM Plex Sans", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif';
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var registry = {};

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function fmt(v, digits) {
        if (!isFinite(v)) return '—';
        return v.toLocaleString('zh-CN', { maximumFractionDigits: digits == null ? 0 : digits, minimumFractionDigits: digits || 0 });
    }
    function alpha(hex, a) {
        var n = parseInt(hex.slice(1), 16);
        return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    function round(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
    function text(ctx, s, x, y, opt) {
        opt = opt || {};
        ctx.font = (opt.weight || 500) + ' ' + (opt.size || 12) + 'px ' + (opt.mono ? MONO : SANS);
        ctx.fillStyle = opt.color || C.soft;
        ctx.textAlign = opt.align || 'left';
        ctx.textBaseline = opt.base || 'alphabetic';
        ctx.fillText(s, x, y);
    }

    /* The panel every demo lives in: a title row, a canvas, controls, readouts. */
    function Panel(figure, spec) {
        var self = this;
        this.figure = figure;
        this.root = el('div', 'demo');
        this.root.setAttribute('role', 'group');
        this.root.setAttribute('aria-label', spec.title);
        var head = el('div', 'demo-head');
        head.appendChild(el('span', 'demo-title', spec.title));
        if (spec.note) head.appendChild(el('span', 'demo-note', spec.note));
        this.root.appendChild(head);
        this.stage = el('div', 'demo-stage');
        this.canvas = el('canvas');
        this.canvas.setAttribute('aria-hidden', 'true');
        this.stage.appendChild(this.canvas);
        this.root.appendChild(this.stage);
        this.readouts = el('div', 'demo-readouts');
        this.root.appendChild(this.readouts);
        this.controls = el('div', 'demo-controls');
        this.root.appendChild(this.controls);
        this.ratio = spec.ratio || 0.42;
        this.minHeight = spec.minHeight || 230;
        this.values = {};
        this.cells = {};
        var img = figure.querySelector('img');
        if (img) img.classList.add('demo-fallback');
        figure.classList.add('has-demo');
        figure.insertBefore(this.root, figure.firstChild);
        this.resize();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { self.draw && self.draw(); });
        if (window.ResizeObserver) new ResizeObserver(function () { self.resize(); self.draw && self.draw(); }).observe(this.stage);
    }
    Panel.prototype.resize = function () {
        var w = this.stage.clientWidth || 600;
        var h = this.fixedH || Math.max(this.minHeight, Math.round(w * this.ratio));
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.canvas.style.height = h + 'px';
        this.w = w; this.h = h;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    Panel.prototype.fit = function (h) {
        h = Math.round(h);
        if (h !== this.h) { this.fixedH = h; this.resize(); }
    };
    Panel.prototype.slider = function (key, label, min, max, step, value, show, onInput, tone) {
        var self = this;
        var wrap = el('label', 'demo-slider');
        var top = el('span', 'demo-slider-top');
        top.appendChild(el('span', 'demo-label', label));
        var out = el('output', 'demo-value');
        top.appendChild(out);
        wrap.appendChild(top);
        var input = el('input');
        input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = value;
        if (tone) input.style.setProperty('--tone', C[tone] || tone);
        wrap.appendChild(input);
        this.controls.appendChild(wrap);
        function update() {
            var v = parseFloat(input.value);
            self.values[key] = v;
            out.textContent = show(v);
            input.style.setProperty('--fill', ((v - min) / (max - min) * 100) + '%');
        }
        input.addEventListener('input', function () { update(); onInput && onInput(); self.draw && self.draw(); });
        update();
        return input;
    };
    Panel.prototype.toggle = function (key, options, value, onChange) {
        var self = this;
        var wrap = el('div', 'demo-toggle');
        wrap.setAttribute('role', 'radiogroup');
        var buttons = options.map(function (o) {
            var b = el('button', '', o[1]);
            b.type = 'button';
            b.setAttribute('role', 'radio');
            b.addEventListener('click', function () { set(o[0]); onChange && onChange(); self.draw && self.draw(); });
            wrap.appendChild(b);
            return b;
        });
        function set(v) {
            self.values[key] = v;
            options.forEach(function (o, i) {
                buttons[i].classList.toggle('on', o[0] === v);
                buttons[i].setAttribute('aria-checked', o[0] === v ? 'true' : 'false');
            });
        }
        set(value);
        this.controls.appendChild(wrap);
    };
    Panel.prototype.button = function (label, onClick, cls) {
        var self = this;
        var b = el('button', 'demo-button' + (cls ? ' ' + cls : ''), label);
        b.type = 'button';
        b.addEventListener('click', function () { onClick(b); self.draw && self.draw(); });
        this.controls.appendChild(b);
        return b;
    };
    Panel.prototype.readout = function (key, label, tone) {
        var cell = el('div', 'demo-readout');
        if (tone) cell.style.setProperty('--tone', C[tone] || tone);
        var value = el('span', 'demo-readout-value', '—');
        cell.appendChild(value);
        cell.appendChild(el('span', 'demo-readout-label', label));
        this.readouts.appendChild(cell);
        this.cells[key] = { value: value, cell: cell };
    };
    Panel.prototype.set = function (key, value, tone) {
        var c = this.cells[key];
        if (!c) return;
        if (c.value.textContent !== value) c.value.textContent = value;
        if (tone) c.cell.style.setProperty('--tone', C[tone] || tone);
    };
    // A demo animates only while it is on screen, and not at all when the reader asked for less motion.
    Panel.prototype.loop = function (tick) {
        var self = this, visible = false, last = 0, frame = 0;
        function step(t) {
            frame = 0;
            var dt = last ? Math.min((t - last) / 1000, 0.05) : 0;
            last = t;
            tick(dt);
            self.draw();
            if (visible && !still && !self.paused) frame = requestAnimationFrame(step);
        }
        this.kick = function () { if (!frame && visible && !still && !self.paused) { last = 0; frame = requestAnimationFrame(step); } };
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                visible = entries[0].isIntersecting;
                if (visible) self.kick(); else if (frame) { cancelAnimationFrame(frame); frame = 0; }
            }, { rootMargin: '80px' }).observe(this.root);
        } else { visible = true; this.kick(); }
        if (still) { for (var i = 0; i < 400; i++) tick(0.02); }
        this.draw();
    };
    Panel.prototype.clear = function () {
        var ctx = this.ctx;
        ctx.clearRect(0, 0, this.w, this.h);
        ctx.fillStyle = C.panel;
        ctx.fillRect(0, 0, this.w, this.h);
        ctx.fillStyle = C.grid;
        for (var x = 12; x < this.w; x += 24) for (var y = 12; y < this.h; y += 24) ctx.fillRect(x, y, 1, 1);
    };

    /* ── 0.1 · The training step as a pipeline ─────────────────────────────────────────────
     * Three stations in series. With overlap the slowest sets the pace; without it the times add.
     * Lesson's example: CPU prepares 300 samples/s, the GPU could do 1000/s → 300/s, GPU idle 70%. */
    registry.pipeline = function (figure) {
        var p = new Panel(figure, { title: '一步训练的管道', note: '拖动滑块，看最窄的一段怎样决定整体速度', ratio: 0.31, minHeight: 236 });
        var names = ['数据供给', 'GPU 计算', '梯度同步'], tones = ['data', 'compute', 'peers'], waits = ['等数据', '等计算', '等别的卡'];
        p.slider('r0', '数据供给（CPU）', 100, 2000, 50, 300, function (v) { return fmt(v) + ' 样本/秒'; }, reset, 'data');
        p.slider('r1', 'GPU 计算', 100, 2000, 50, 1000, function (v) { return fmt(v) + ' 样本/秒'; }, reset, 'compute');
        p.slider('r2', '梯度同步（多卡）', 100, 4000, 50, 2000, function (v) { return fmt(v) + ' 样本/秒'; }, reset, 'peers');
        p.toggle('overlap', [[true, '相邻环节重叠'], [false, '一段做完才做下一段']], true, reset);
        p.readout('tput', '整体吞吐（样本/秒）', 'ink');
        p.readout('gpu', 'GPU 忙碌的时间', 'compute');
        p.readout('neck', '瓶颈', 'data');
        var CAP = 5, st, flights, served, clock;
        function reset() {
            st = [0, 1, 2].map(function () { return { left: 0, has: false, blocked: false, busy: 0 }; });
            p.q = [0, 0];
            flights = []; served = 0; clock = 0;
            p.kick && p.kick();
        }
        function svc(i) { return 140 / p.values['r' + i]; }
        function rates() { return [p.values.r0, p.values.r1, p.values.r2]; }
        function analytic() {
            var r = rates();
            if (p.values.overlap) return Math.min(r[0], r[1], r[2]);
            return 1 / (1 / r[0] + 1 / r[1] + 1 / r[2]);
        }
        function fly(from, to) { flights.push({ from: from, to: to, t: 0 }); }
        reset();
        var cursor = 0;
        function tick(dt) {
            clock += dt;
            flights.forEach(function (f) { f.t += dt / 0.28; });
            flights = flights.filter(function (f) { return f.t < 1; });
            if (p.values.overlap) {
                for (var i = 2; i >= 0; i--) {
                    var s = st[i];
                    if (s.has) {
                        s.left -= dt;
                        if (s.left <= 0) {
                            if (i === 2) { s.has = false; served++; fly(2, 3); }
                            else if (p.q[i] < CAP) { s.has = false; p.q[i]++; fly(i, i + 1); s.blocked = false; }
                            else s.blocked = true;
                        }
                    }
                    if (!s.has && (i === 0 || p.q[i - 1] > 0)) { if (i > 0) p.q[i - 1]--; s.has = true; s.left = svc(i); }
                    s.busy += ((s.has && s.left > 0 ? 1 : 0) - s.busy) * Math.min(1, dt * 1.5);
                }
            } else {
                p.q = [0, 0];
                var a = st[cursor];
                if (!a.has) { a.has = true; a.left = svc(cursor); }
                a.left -= dt;
                if (a.left <= 0) { a.has = false; fly(cursor, cursor + 1); if (cursor === 2) served++; cursor = (cursor + 1) % 3; }
                st.forEach(function (s, k) { s.busy += ((k === cursor ? 1 : 0) - s.busy) * Math.min(1, dt * 1.5); s.blocked = false; });
            }
        }
        p.draw = function () {
            var w = p.w, narrow = w < 560, pad = narrow ? 14 : Math.max(18, w * 0.04);
            // wide: the three stations side by side; narrow (a phone): one above the other
            var gap = narrow ? 40 : Math.max(46, w * 0.1), bw = narrow ? w - pad * 2 : (w - pad * 2 - gap * 2) / 3, bh = narrow ? 70 : 118, top = narrow ? 16 : 0;
            if (narrow) p.fit(top + bh * 3 + gap * 2 + 62);
            else if (p.fixedH) { p.fixedH = 0; p.resize(); }
            var ctx = p.ctx, h = p.h;
            p.clear();
            if (!narrow) { bh = Math.min(118, h * 0.46); top = Math.max(16, (h - bh - 40) / 2); }
            var boxes = [0, 1, 2].map(function (i) { return narrow ? { x: pad, y: top + i * (bh + gap) } : { x: pad + i * (bw + gap), y: top }; });
            function exit(i) { var b = boxes[i]; return narrow ? [b.x + 30, b.y + bh] : [b.x + bw, b.y + 22]; }
            function entry(i) { if (i === 3) return narrow ? [pad + 30, h - 6] : [w - 4, top + 22]; var b = boxes[i]; return narrow ? [b.x + 30, b.y] : [b.x, b.y + 22]; }
            var r = rates(), tput = analytic(), neck = p.values.overlap ? r.indexOf(Math.min.apply(null, r)) : -1;
            for (var i = 0; i < 3; i++) {
                var x = boxes[i].x, by = boxes[i].y, col = C[tones[i]], s = st[i];
                var glow = 0.12 + s.busy * 0.55;
                ctx.save();
                if (s.busy > 0.05 && !still) { ctx.shadowColor = alpha(col, 0.55 * s.busy); ctx.shadowBlur = 26 * s.busy; }
                round(ctx, x, by, bw, bh, 12);
                ctx.fillStyle = alpha(col, glow * 0.45);
                ctx.fill();
                ctx.restore();
                round(ctx, x, by, bw, bh, 12);
                ctx.lineWidth = i === neck ? 2 : 1.2;
                ctx.strokeStyle = alpha(col, i === neck ? 1 : 0.55);
                ctx.stroke();
                text(ctx, names[i], x + 14, by + 24, { size: 13.5, weight: 600, color: C.ink });
                text(ctx, fmt(r[i]) + ' /秒', x + 14, by + 44, { size: 12, mono: true, color: alpha(col, 0.95) });
                var cap = p.values.overlap ? Math.min(1, tput / r[i]) : tput / r[i];
                var barY = by + bh - (narrow ? 14 : 22), barW = bw - 28;
                round(ctx, x + 14, barY, barW, narrow ? 4 : 6, 3); ctx.fillStyle = C.faint; ctx.fill();
                round(ctx, x + 14, barY, Math.max(6, barW * cap), narrow ? 4 : 6, 3); ctx.fillStyle = col; ctx.fill();
                text(ctx, '忙 ' + fmt(cap * 100) + '%', x + bw - 14, by + (narrow ? 24 : 44), { size: 12, mono: true, align: 'right', color: C.soft });
                var noteX = narrow ? x + bw - 14 : x + 14, noteY = narrow ? by + 44 : barY - 10, noteAlign = narrow ? 'right' : 'left';
                if (s.blocked) text(ctx, '下游满了，在等', noteX, noteY, { size: 11, color: C.alert, align: noteAlign });
                else if (!s.has && p.values.overlap && i > 0 && p.q[i - 1] === 0) text(ctx, '空着：' + waits[i - 1].replace('等', '在等'), noteX, noteY, { size: 11, color: alpha(C[tones[i - 1]], 0.9), align: noteAlign });
                if (s.has && s.left > 0) {
                    var prog = 1 - s.left / svc(i);
                    ctx.beginPath();
                    ctx.arc(narrow ? x + bw - 76 : x + bw - 26, by + (narrow ? 20 : 24), narrow ? 7 : 9, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
                    ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
                }
            }
            for (var k = 0; k < 2; k++) {
                var a = exit(k), b = entry(k + 1), n = p.q[k];
                for (var j = 0; j < CAP; j++) {
                    var qx, qy;
                    if (narrow) { qx = pad + 56 + j * 20; qy = a[1] + gap / 2 - 4; round(ctx, qx, qy, 15, 9, 2.5); }
                    else { qx = a[0] + gap / 2 - 8; qy = boxes[0].y + bh - 21 - j * 13; round(ctx, qx, qy, 16, 9, 2.5); }
                    ctx.fillStyle = j < n ? alpha(C[tones[k]], 0.9) : alpha(C.faint, 0.6);
                    ctx.fill();
                }
                ctx.strokeStyle = C.dim; ctx.lineWidth = 1;
                if (narrow) {
                    ctx.beginPath(); ctx.moveTo(a[0], a[1] + 6); ctx.lineTo(b[0], b[1] - 7); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(b[0] - 4, b[1] - 12); ctx.lineTo(b[0], b[1] - 7); ctx.lineTo(b[0] + 4, b[1] - 12); ctx.stroke();
                } else {
                    ctx.beginPath(); ctx.moveTo(a[0] + 6, a[1]); ctx.lineTo(b[0] - 8, b[1]); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(b[0] - 13, b[1] - 4); ctx.lineTo(b[0] - 8, b[1]); ctx.lineTo(b[0] - 13, b[1] + 4); ctx.stroke();
                }
            }
            flights.forEach(function (f) {
                var a = exit(f.from), b = entry(f.to), e = 1 - Math.pow(1 - f.t, 3), arc = Math.sin(f.t * Math.PI) * 14;
                var x = a[0] + (b[0] - a[0]) * e - (narrow ? arc : 0), y = a[1] + (b[1] - a[1]) * e - (narrow ? 0 : arc);
                var tone = C[tones[Math.min(f.from, 2)]];
                ctx.save();
                if (!still) { ctx.shadowColor = tone; ctx.shadowBlur = 12; }
                round(ctx, x - 6, y - 4, 12, 8, 2.5); ctx.fillStyle = tone; ctx.fill();
                ctx.restore();
            });
            var footY = narrow ? h - 30 : top + bh + 34;
            text(ctx, p.values.overlap ? '重叠时：整体 = 三段里最慢的那一段' : (narrow ? '不重叠时：三段的时间相加' : '不重叠时：每个样本要依次走完三段，时间相加'), narrow ? pad + 52 : pad, footY + (narrow ? 14 : 0), { size: 12.5, color: C.soft });
            if (!narrow) text(ctx, '已处理 ' + fmt(served) + ' 批', w - pad, footY, { size: 12, mono: true, align: 'right', color: C.dim });
            p.set('tput', fmt(tput));
            p.set('gpu', fmt(tput / r[1] * 100) + '%');
            if (p.values.overlap) p.set('neck', neck === 1 ? '算力（等计算）' : waits[neck], tones[neck]);
            else p.set('neck', '三段串行，时间相加', 'alert');
        };
        p.loop(tick);
    };

    /* ── 2.4 · Roofline ────────────────────────────────────────────────────────────────────
     * Lesson: 1000 GB/s and 20 TFLOPS, knee at 20 FLOP/B; naive matmul 0.25 FLOP/B, tiling ×T. */
    registry.roofline = function (figure) {
        var p = new Panel(figure, { title: 'Roofline：你的 kernel 撞的是哪面墙', note: '分块边长 T 决定算术强度；带宽和峰值决定屋顶', ratio: 0.5, minHeight: 300 });
        p.slider('T', '分块边长 T', 1, 64, 1, 1, function (v) { return v === 1 ? '1（不分块）' : String(v); });
        p.slider('bw', '显存带宽', 200, 4000, 100, 1000, function (v) { return fmt(v) + ' GB/s'; });
        p.slider('peak', '峰值算力', 5, 100, 1, 20, function (v) { return fmt(v) + ' TFLOPS'; });
        p.readout('I', '算术强度（FLOP/B）', 'ink');
        p.readout('perf', '能达到的性能', 'ink');
        p.readout('share', '占峰值算力', 'compute');
        p.readout('bound', '受限于', 'data');
        var shown = 0.25;
        function tick(dt) { var I = 0.25 * p.values.T; shown += (I - shown) * Math.min(1, dt * 7); }
        p.draw = function () {
            var ctx = p.ctx, w = p.w, h = p.h;
            p.clear();
            var L = 66, R = w - 22, T = 26, B = h - 44;
            var xlo = Math.log10(0.1), xhi = Math.log10(1000), ylo = Math.log10(1e10), yhi = Math.log10(2e14);
            function X(v) { return L + (Math.log10(v) - xlo) / (xhi - xlo) * (R - L); }
            function Y(v) { return B - (Math.log10(v) - ylo) / (yhi - ylo) * (B - T); }
            var bw = p.values.bw * 1e9, peak = p.values.peak * 1e12, knee = peak / bw;
            ctx.strokeStyle = C.faint; ctx.lineWidth = 1;
            [0.1, 1, 10, 100, 1000].forEach(function (v) { ctx.beginPath(); ctx.moveTo(X(v), T); ctx.lineTo(X(v), B); ctx.stroke(); text(ctx, String(v), X(v), B + 18, { size: 11, mono: true, align: 'center', color: C.dim }); });
            [1e10, 1e11, 1e12, 1e13, 1e14].forEach(function (v) { ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(R, Y(v)); ctx.stroke(); text(ctx, (v / 1e12 >= 1 ? fmt(v / 1e12) + 'T' : fmt(v / 1e9) + 'G'), L - 8, Y(v) + 4, { size: 11, mono: true, align: 'right', color: C.dim }); });
            text(ctx, '算术强度（FLOP/B，对数）', R, B + 36, { size: 11, align: 'right', color: C.dim });
            text(ctx, 'FLOP/s', L - 8, T - 8, { size: 11, mono: true, align: 'right', color: C.dim });
            // the two regions under the roof
            ctx.beginPath(); ctx.moveTo(X(0.1), B); ctx.lineTo(X(0.1), Y(Math.max(bw * 0.1, 1e10))); ctx.lineTo(X(knee), Y(peak)); ctx.lineTo(X(knee), B); ctx.closePath();
            ctx.fillStyle = alpha(C.data, 0.10); ctx.fill();
            ctx.beginPath(); ctx.moveTo(X(knee), B); ctx.lineTo(X(knee), Y(peak)); ctx.lineTo(R, Y(peak)); ctx.lineTo(R, B); ctx.closePath();
            ctx.fillStyle = alpha(C.compute, 0.10); ctx.fill();
            // the roof
            ctx.save();
            if (!still) { ctx.shadowColor = alpha(C.ink, 0.5); ctx.shadowBlur = 10; }
            ctx.beginPath(); ctx.moveTo(X(0.1), Y(Math.max(bw * 0.1, 1e10))); ctx.lineTo(X(knee), Y(peak)); ctx.lineTo(R, Y(peak));
            ctx.strokeStyle = C.ink; ctx.lineWidth = 2.4; ctx.stroke();
            ctx.restore();
            ctx.setLineDash([3, 4]); ctx.strokeStyle = C.dim;
            ctx.beginPath(); ctx.moveTo(X(knee), Y(peak)); ctx.lineTo(X(knee), B); ctx.stroke(); ctx.setLineDash([]);
            text(ctx, '拐点 ' + fmt(knee, knee < 10 ? 1 : 0) + ' FLOP/B', X(knee) + 6, B - 8, { size: 11, mono: true, color: C.soft });
            var mid = Math.sqrt(0.1 * knee);
            text(ctx, '带宽受限', X(mid), Math.min(B - 12, Y(bw * mid) + 34), { size: 12.5, weight: 600, color: C.data, align: 'center' });
            text(ctx, '算力受限', (X(knee) + R) / 2, Y(peak) + 30, { size: 12.5, weight: 600, color: C.compute, align: 'center' });
            // marks from the lesson
            [[0.25, '朴素'], [4, 'T = 16']].forEach(function (m) {
                var pv = Math.min(peak, bw * m[0]);
                ctx.beginPath(); ctx.arc(X(m[0]), Y(pv), 3.5, 0, Math.PI * 2); ctx.fillStyle = C.dim; ctx.fill();
                text(ctx, m[1], X(m[0]) + 7, Y(pv) + 14, { size: 11, color: C.dim });
            });
            // the reader's kernel
            var I = shown, perf = Math.min(peak, bw * I), col = I < knee ? C.data : C.compute;
            ctx.setLineDash([2, 3]); ctx.strokeStyle = alpha(col, 0.7);
            ctx.beginPath(); ctx.moveTo(X(I), Y(perf)); ctx.lineTo(X(I), B); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(X(I), Y(perf)); ctx.lineTo(L, Y(perf)); ctx.stroke(); ctx.setLineDash([]);
            ctx.save();
            if (!still) { ctx.shadowColor = col; ctx.shadowBlur = 18; }
            ctx.beginPath(); ctx.arc(X(I), Y(perf), 7.5, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
            ctx.restore();
            ctx.beginPath(); ctx.arc(X(I), Y(perf), 12, 0, Math.PI * 2); ctx.strokeStyle = alpha(col, 0.5); ctx.lineWidth = 1.5; ctx.stroke();
            var exact = 0.25 * p.values.T, real = Math.min(peak, bw * exact);
            p.set('I', fmt(exact, exact < 10 ? 2 : 1));
            p.set('perf', real >= 1e12 ? fmt(real / 1e12, 1) + ' TFLOPS' : fmt(real / 1e9) + ' GFLOPS');
            p.set('share', fmt(real / peak * 100, real / peak < 0.1 ? 1 : 0) + '%');
            p.set('bound', exact < knee ? '带宽（搬数据）' : '算力（做运算）', exact < knee ? 'data' : 'compute');
        };
        p.loop(tick);
    };

    /* ── 5.1 · Ring all-reduce ─────────────────────────────────────────────────────────────
     * N cards, data cut into N chunks; N−1 steps add while passing, N−1 steps only pass. */
    registry['ring-allreduce'] = function (figure) {
        var p = new Panel(figure, { title: '环形 all-reduce', note: '每一格是一段数据，越亮代表加进去的卡越多', ratio: 0.56, minHeight: 330 });
        var N, have, step, phase, t, playing = true, moving;
        p.slider('n', '卡数 N', 2, 8, 1, 4, function (v) { return v + ' 张'; }, reset);
        var play = p.button('暂停', function (b) { playing = !playing; b.textContent = playing ? '暂停' : '播放'; p.kick && p.kick(); });
        p.button('下一步', function () { playing = false; play.textContent = '播放'; advance(); }, 'ghost');
        p.button('重来', function () { reset(); }, 'ghost');
        p.readout('stage', '阶段', 'peers');
        p.readout('steps', '已走的步数', 'ink');
        p.readout('sent', '每张卡已发出（份）', 'ink');
        p.readout('total', '走完共发出 2(N−1)/N', 'peers');
        function reset() {
            N = p.values.n; step = 0; t = 0; phase = 'rs'; moving = null;
            have = [];
            for (var g = 0; g < N; g++) { have[g] = []; for (var c = 0; c < N; c++) have[g][c] = 1 << g; }
            p.kick && p.kick();
        }
        function bits(m) { var n = 0; while (m) { n += m & 1; m >>= 1; } return n; }
        function plan() {
            var s = step < N - 1 ? step : step - (N - 1), out = [];
            for (var g = 0; g < N; g++) {
                var chunk = step < N - 1 ? ((g - s) % N + N) % N : ((g + 1 - s) % N + N) % N;
                out.push({ from: g, to: (g + 1) % N, chunk: chunk, mask: have[g][chunk] });
            }
            return out;
        }
        function advance() {
            if (step >= 2 * (N - 1)) { reset(); return; }
            var moves = plan(), add = step < N - 1;
            moves.forEach(function (m) { have[m.to][m.chunk] = add ? (have[m.to][m.chunk] | m.mask) : m.mask; });
            step++; t = 0;
            moving = null;
        }
        reset();
        function tick(dt) {
            if (!playing) return;
            t += dt / (N > 5 ? 0.9 : 1.1);
            if (step >= 2 * (N - 1)) { if (t > 1.6) reset(); return; }
            moving = { moves: plan(), t: Math.min(1, t) };
            if (t >= 1) advance();
        }
        p.draw = function () {
            var ctx = p.ctx, w = p.w, h = p.h;
            p.clear();
            var cw = Math.max(9, Math.min(20, (Math.min(w, h) * 0.45) / N)), nodeW = cw * N + 18, nodeH = cw + 36;
            var cx = w * 0.5, cy = h * 0.5 + 14, R = Math.min(w * 0.36, h * 0.36, w / 2 - nodeW / 2 - 8, (h - 40) / 2 - nodeH / 2 - 4);
            function pos(g) { var a = -Math.PI / 2 + g * 2 * Math.PI / N; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; }
            // the ring
            ctx.strokeStyle = C.faint; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
            for (var g = 0; g < N; g++) {
                var a = -Math.PI / 2 + (g + 0.5) * 2 * Math.PI / N, ax = cx + R * Math.cos(a), ay = cy + R * Math.sin(a), ta = a + Math.PI / 2;
                ctx.beginPath(); ctx.moveTo(ax - 6 * Math.cos(ta) + 4 * Math.cos(a), ay - 6 * Math.sin(ta) + 4 * Math.sin(a));
                ctx.lineTo(ax, ay); ctx.lineTo(ax - 6 * Math.cos(ta) - 4 * Math.cos(a), ay - 6 * Math.sin(ta) - 4 * Math.sin(a));
                ctx.strokeStyle = C.dim; ctx.stroke();
            }
            for (g = 0; g < N; g++) {
                var q = pos(g), x = q[0] - nodeW / 2, y = q[1] - nodeH / 2;
                round(ctx, x, y, nodeW, nodeH, 10); ctx.fillStyle = C.well; ctx.fill();
                ctx.strokeStyle = alpha(C.peers, 0.45); ctx.lineWidth = 1; ctx.stroke();
                text(ctx, '卡 ' + g, x + 9, y + 17, { size: 11.5, weight: 600, color: C.ink });
                for (var c = 0; c < N; c++) {
                    var k = bits(have[g][c]) / N, full = k === 1;
                    round(ctx, x + 9 + c * cw, y + 24, cw - 3, cw - 3, 3);
                    ctx.fillStyle = full ? C.peers : alpha(C.peers, 0.12 + 0.6 * k);
                    ctx.fill();
                    if (full && !still) { ctx.save(); ctx.shadowColor = C.peers; ctx.shadowBlur = 8; ctx.fill(); ctx.restore(); }
                }
            }
            if (moving) {
                var e = moving.t < 0.5 ? 2 * moving.t * moving.t : 1 - Math.pow(-2 * moving.t + 2, 2) / 2;
                moving.moves.forEach(function (m) {
                    var a0 = -Math.PI / 2 + m.from * 2 * Math.PI / N, a1 = a0 + 2 * Math.PI / N, a = a0 + (a1 - a0) * e;
                    var x = cx + (R + 0) * Math.cos(a), y = cy + R * Math.sin(a), s = Math.max(10, cw);
                    var col = step < N - 1 ? C.data : C.peers;
                    ctx.save();
                    if (!still) { ctx.shadowColor = col; ctx.shadowBlur = 16; }
                    round(ctx, x - s / 2, y - s / 2, s, s, 3); ctx.fillStyle = col; ctx.fill();
                    ctx.restore();
                    text(ctx, String(m.chunk), x, y + 4, { size: 10.5, mono: true, align: 'center', weight: 600, color: C.panel });
                });
            }
            var label = step < N - 1 ? '前半程：边传边加（reduce-scatter）' : step < 2 * (N - 1) ? '后半程：只传不加（all-gather）' : '完成：每张卡都有完整的总和';
            text(ctx, label, 16, 26, { size: 12.5, weight: 600, color: step < N - 1 ? C.data : C.peers });
            p.set('stage', step < N - 1 ? '边传边加' : step < 2 * (N - 1) ? '只传不加' : '完成', step < N - 1 ? 'data' : 'peers');
            p.set('steps', step + ' / ' + 2 * (N - 1));
            p.set('sent', fmt(step / N, 2));
            p.set('total', fmt(2 * (N - 1) / N, 2));
        };
        p.loop(tick);
    };

    /* ── 2.3 · Latency hiding ──────────────────────────────────────────────────────────────
     * Each warp computes for a while, then waits on memory. One warp issues at a time.
     * Cycle counts are illustrative; the lesson says only that a memory access takes hundreds. */
    registry['latency-hiding'] = function (figure) {
        var p = new Panel(figure, { title: '用别的 warp 把等待填满', note: '周期数是示意值：一次访存要等几百个周期', ratio: 0.5, minHeight: 320 });
        var BUCKET = 8, SPEED = 900, sim, hist, sm;
        p.slider('W', '驻留的 warp 数', 1, 16, 1, 4, function (v) { return v + ' 个'; }, reset);
        p.slider('L', '一次访存要等', 100, 800, 20, 400, function (v) { return v + ' 周期'; }, reset);
        p.slider('C', '每段计算', 10, 200, 10, 40, function (v) { return v + ' 周期'; }, reset);
        p.readout('util', '运算单元利用率（实测）', 'compute');
        p.readout('theory', '估算 min(1, W·C ÷ (C+L))', 'ink');
        p.readout('need', '要填满至少需要', 'launch');
        function reset() {
            var W = p.values.W;
            sim = { cycle: 0, acc: 0, busy: 0, total: 0, rr: 0, warps: [] };
            for (var i = 0; i < W; i++) sim.warps.push({ state: 'ready', left: 0, wait: Math.round(i * p.values.L / W) });
            sim.warps.forEach(function (wp) { if (wp.wait > 0) { wp.state = 'mem'; wp.left = wp.wait; } });
            hist = sim.warps.map(function () { return []; }); sm = [];
            p.kick && p.kick();
        }
        reset();
        function cycle() {
            var W = sim.warps.length, issuing = -1, cur = sim.warps.filter(function (x) { return x.state === 'run'; })[0];
            if (cur) issuing = sim.warps.indexOf(cur);
            else {
                for (var k = 0; k < W; k++) { var j = (sim.rr + k) % W; if (sim.warps[j].state === 'ready') { issuing = j; sim.rr = (j + 1) % W; sim.warps[j].state = 'run'; sim.warps[j].left = p.values.C; break; } }
            }
            sim.warps.forEach(function (wp, i) {
                if (wp.state === 'mem') { if (--wp.left <= 0) wp.state = 'ready'; }
                else if (wp.state === 'run') { if (--wp.left <= 0) { wp.state = 'mem'; wp.left = p.values.L; } }
            });
            sim.total++; if (issuing >= 0) sim.busy++;
            return issuing;
        }
        function tick(dt) {
            sim.acc += dt * SPEED;
            while (sim.acc >= BUCKET) {
                sim.acc -= BUCKET;
                var counts = sim.warps.map(function () { return { run: 0, mem: 0, ready: 0 }; }), any = 0;
                for (var c = 0; c < BUCKET; c++) {
                    var who = cycle();
                    if (who >= 0) any++;
                    sim.warps.forEach(function (wp, i) { counts[i][wp.state === 'run' ? 'run' : wp.state === 'mem' ? 'mem' : 'ready']++; });
                }
                counts.forEach(function (ct, i) { hist[i].push(ct.run > 0 ? 'run' : ct.ready > 0 ? 'ready' : 'mem'); if (hist[i].length > 260) hist[i].shift(); });
                sm.push(any / BUCKET); if (sm.length > 260) sm.shift();
                if (sim.total > 60000) { sim.busy *= 0.5; sim.total *= 0.5; }
            }
        }
        if (still) { for (var s = 0; s < 3000; s++) tick(0.01); }
        p.draw = function () {
            var ctx = p.ctx, w = p.w, h = p.h, W = sim.warps.length;
            var narrow = w < 560, L = narrow ? 58 : 74, R = w - 14, top = 18, rh = W <= 8 ? 22 : 15, cols = 260, cw = (R - L) / cols;
            var sy = top + W * rh + 14, sh = 26, legendRows = narrow ? 2 : 1;
            p.fit(sy + sh + 26 + legendRows * 20);
            ctx = p.ctx; h = p.h;
            p.clear();
            // consecutive buckets of one colour are drawn as one bar, on whole pixels, so no seams show
            function runs(list, colour, y, height) {
                var off = cols - list.length, k = 0;
                while (k < list.length) {
                    var c = colour(list[k]), j = k;
                    while (j + 1 < list.length && colour(list[j + 1]) === c) j++;
                    var x0 = Math.round(L + (off + k) * cw), x1 = Math.round(L + (off + j + 1) * cw);
                    ctx.fillStyle = c; ctx.fillRect(x0, y, Math.max(1, x1 - x0), height);
                    k = j + 1;
                }
            }
            var RUN = C.compute, READY = alpha(C.launch, 0.45), MEM = '#1B2A3C', IDLE = alpha(C.alert, 0.32), PART = alpha(C.compute, 0.55);
            for (var i = 0; i < W; i++) {
                var y = top + i * rh;
                text(ctx, 'warp ' + i, L - 10, y + rh * 0.7, { size: Math.min(11.5, rh * 0.66), mono: true, align: 'right', color: C.dim });
                runs(hist[i], function (st) { return st === 'run' ? RUN : st === 'ready' ? READY : MEM; }, y + 2, rh - 4);
            }
            text(ctx, '运算单元', L - 10, sy + 17, { size: 11.5, align: 'right', color: C.ink, weight: 600 });
            runs(sm, function (v) { return v >= 1 ? RUN : v > 0 ? PART : IDLE; }, sy, sh);
            [[RUN, '在计算'], [READY, '数据已到，等着发射'], [MEM, '在等显存'], [IDLE, '运算单元空转']].forEach(function (lg, n) {
                var per = narrow ? 2 : 4, col = n % per, row = Math.floor(n / per);
                var x = L + col * (R - L) / per, ly = sy + sh + 24 + row * 20;
                ctx.fillStyle = lg[0]; ctx.fillRect(x, ly - 9, 10, 10);
                text(ctx, lg[1], x + 15, ly, { size: 11, color: C.soft });
            });
            var C_ = p.values.C, L_ = p.values.L, theory = Math.min(1, W * C_ / (C_ + L_));
            p.set('util', fmt(sim.total ? sim.busy / sim.total * 100 : 0) + '%', sim.busy / Math.max(1, sim.total) > 0.95 ? 'peers' : 'compute');
            p.set('theory', fmt(theory * 100) + '%');
            p.set('need', Math.ceil((C_ + L_) / C_) + ' 个 warp');
        };
        p.loop(tick);
    };

    /* ── 5.4 · Pipeline bubbles ────────────────────────────────────────────────────────────
     * p stages, m micro-batches, all forwards then all backwards. Lesson: bubble = (p−1)/(m+p−1). */
    registry['pipeline-bubbles'] = function (figure) {
        var p = new Panel(figure, { title: '流水线并行的气泡', note: '前向和反向画成一样长（示意）', ratio: 0.42, minHeight: 280 });
        var head = 0;
        p.slider('p', '段数 p', 2, 8, 1, 4, function (v) { return v + ' 段'; }, function () { head = 0; p.kick && p.kick(); });
        p.slider('m', '微批次数 m', 1, 16, 1, 4, function (v) { return v + ' 个'; }, function () { head = 0; p.kick && p.kick(); });
        p.readout('bubble', '气泡占比（数格子）', 'alert');
        p.readout('formula', '(p − 1) ÷ (m + p − 1)', 'ink');
        p.readout('slots', '一步的总时长（格）', 'ink');
        function tick(dt) { var P = p.values.p, M = p.values.m, total = 2 * (M + P - 1); head += dt * Math.max(3, total / 3.2); if (head > total + 3) head = 0; }
        p.draw = function () {
            var ctx = p.ctx, w = p.w, h = p.h, P = p.values.p, M = p.values.m, total = 2 * (M + P - 1), F = M + P - 1;
            p.clear();
            var narrow = w < 560, L = narrow ? 50 : 66, R = w - 14, top = 16, cw = (R - L) / total, rh = P > 6 ? 24 : 30;
            p.fit(top + P * rh + (narrow ? 64 : 46));
            ctx = p.ctx; h = p.h;
            p.clear();
            var shown = still ? total : head, idle = 0;
            for (var s = 0; s < P; s++) {
                var y = top + s * rh;
                text(ctx, '第 ' + (s + 1) + ' 段', L - 10, y + rh * 0.68, { size: 11.5, align: 'right', color: C.dim });
                for (var t = 0; t < total; t++) {
                    var j = -1, back = false;
                    if (t < F) { j = t - s; if (j >= M) j = -1; }
                    else { j = t - F - (P - 1 - s); back = true; if (j >= M) j = -1; }
                    if (j < 0) idle++;
                    var x = L + t * cw + 1, on = t < shown;
                    round(ctx, x, y + 2, cw - 2, rh - 4, Math.min(5, cw / 4));
                    if (j < 0) ctx.fillStyle = on ? alpha(C.alert, 0.16) : alpha(C.faint, 0.35);
                    else ctx.fillStyle = on ? (back ? C.peers : C.compute) : alpha(back ? C.peers : C.compute, 0.14);
                    ctx.fill();
                    if (j >= 0 && on && cw > 16 && rh > 16) text(ctx, String(j + 1), x + (cw - 2) / 2, y + rh / 2 + 4, { size: Math.min(11, cw * 0.5), mono: true, align: 'center', weight: 600, color: C.panel });
                }
            }
            if (!still && head <= total) {
                var hx = L + Math.min(head, total) * cw;
                ctx.strokeStyle = alpha(C.ink, 0.6); ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.moveTo(hx, top - 4); ctx.lineTo(hx, top + P * rh + 4); ctx.stroke();
            }
            [[C.compute, narrow ? '前向（数字是微批次）' : '前向（数字是第几个微批次）'], [C.peers, '反向'], [alpha(C.alert, 0.4), '空着：气泡']].forEach(function (lg, n) {
                var ly = narrow ? h - 34 + (n === 0 ? 0 : 20) : h - 14, x = narrow ? (n === 0 ? L : L + (n - 1) * 110) : L + n * Math.max(150, (R - L) / 3);
                ctx.fillStyle = lg[0]; ctx.fillRect(x, ly - 9, 10, 10);
                text(ctx, lg[1], x + 15, ly, { size: 11, color: C.soft });
            });
            var frac = idle / (P * total), formula = (P - 1) / (M + P - 1);
            p.set('bubble', fmt(frac * 100, 1) + '%');
            p.set('formula', (P - 1) + ' ÷ ' + (M + P - 1) + ' = ' + fmt(formula * 100, 1) + '%');
            p.set('slots', String(total));
        };
        p.loop(tick);
    };

    /* ── 3.3 · Flash Attention ─────────────────────────────────────────────────────────────
     * Standard: S and P (N×N) go through memory. Flash: tiles live on chip, only Q, K, V, O touch memory.
     * The sizes are the lesson's: N×N against N×d, 16-bit, one head. */
    registry['flash-attention'] = function (figure) {
        var p = new Panel(figure, { title: '标准注意力 vs Flash Attention', note: '左右同时播放；方格是 N×N 分数矩阵的分块', ratio: 0.56, minHeight: 360 });
        var B = 6, t = 0, period = 9.5;
        p.slider('N', '序列长度 N', 512, 32768, 512, 4096, function (v) { return fmt(v); });
        p.readout('ratio', 'N×N 是 N×d 的多少倍（d = 64）', 'ink');
        p.readout('std', '标准实现：N×N 中间结果占显存', 'alert');
        p.readout('flash', 'Flash：额外占用', 'peers');
        function tick(dt) { t = (t + dt) % period; }
        p.draw = function () {
            var ctx = p.ctx, w = p.w, h = p.h;
            p.clear();
            var narrow = w < 560, half = narrow ? w : w / 2, pad = narrow ? 14 : 18, gs = Math.min(half - pad * 2 - 60, 300), cell = gs / B;
            var blockH = 76 + gs + 44;
            p.fit(narrow ? blockH * 2 + 10 : blockH);
            ctx = p.ctx; h = p.h; w = p.w;
            p.clear();
            var phase = still ? period - 0.01 : t, k = Math.floor(phase / period * (B * B + 4));
            // left: standard
            var lx = pad + 36, ly = 76;
            text(ctx, '标准实现', pad, 24, { size: 13.5, weight: 600, color: C.ink });
            text(ctx, 'S、P 整块写回显存，再读出来', pad, 42, { size: 11.5, color: C.soft });
            var written = Math.min(B * B, Math.floor(phase / (period * 0.7) * B * B));
            for (var i = 0; i < B; i++) for (var j = 0; j < B; j++) {
                var n = i * B + j, on = n < written, x = lx + j * cell, y = ly + i * cell;
                round(ctx, x + 1.5, y + 1.5, cell - 3, cell - 3, 4);
                ctx.fillStyle = on ? alpha(C.alert, n === written - 1 && !still ? 0.95 : 0.6) : alpha(C.faint, 0.6);
                ctx.fill();
            }
            ctx.strokeStyle = alpha(C.alert, 0.6); ctx.lineWidth = 1.2;
            round(ctx, lx - 3, ly - 3, gs + 6, gs + 6, 7); ctx.stroke();
            text(ctx, '显存', lx - 8, ly + gs / 2, { size: 11, align: 'right', color: C.alert });
            var trips = phase < period * 0.7 ? '写 S' : phase < period * 0.82 ? '读 S，写 P' : '读 P';
            text(ctx, trips, lx + gs / 2, ly + gs + 26, { size: 12, mono: true, align: 'center', color: C.alert });
            // right: flash
            var ox = narrow ? 0 : half, oy = narrow ? blockH + 10 : 0, rx = ox + pad + 36, ry = oy + 76;
            text(ctx, 'Flash Attention', ox + pad, oy + 24, { size: 13.5, weight: 600, color: C.ink });
            text(ctx, '在片上一块块算完就丢，N×N 不进显存', ox + pad, oy + 42, { size: 11.5, color: C.soft });
            var cur = Math.min(B * B - 1, Math.floor(phase / (period * 0.88) * B * B)), qi = Math.floor(cur / B), kj = cur % B;
            for (i = 0; i < B; i++) for (j = 0; j < B; j++) {
                n = i * B + j; x = rx + j * cell; y = ry + i * cell;
                round(ctx, x + 1.5, y + 1.5, cell - 3, cell - 3, 4);
                ctx.strokeStyle = alpha(C.faint, 0.9); ctx.lineWidth = 1; ctx.stroke();
                if (n === cur) {
                    ctx.save();
                    if (!still) { ctx.shadowColor = C.compute; ctx.shadowBlur = 20; }
                    ctx.fillStyle = C.compute; ctx.fill(); ctx.restore();
                } else if (n < cur && n >= cur - 2) { ctx.fillStyle = alpha(C.compute, n === cur - 1 ? 0.22 : 0.08); ctx.fill(); }
            }
            // Q block row and K/V column being used
            ctx.fillStyle = alpha(C.launch, 0.9);
            round(ctx, rx - 22, ry + qi * cell + 3, 14, cell - 6, 3); ctx.fill();
            text(ctx, 'Q' + (qi + 1), rx - 15, ry + qi * cell - 4, { size: 10.5, mono: true, align: 'center', color: C.launch });
            ctx.fillStyle = alpha(C.data, 0.9);
            round(ctx, rx + kj * cell + 3, ry - 18, cell - 6, 12, 3); ctx.fill();
            text(ctx, 'K' + (kj + 1) + ' V' + (kj + 1), rx + kj * cell + cell / 2, ry - 22, { size: 10.5, mono: true, align: 'center', color: C.data });
            // output rows finished
            for (i = 0; i < B; i++) {
                var done = i < qi || (i === qi && kj === B - 1);
                round(ctx, rx + gs + 12, ry + i * cell + 3, 14, cell - 6, 3);
                ctx.fillStyle = done ? C.peers : alpha(C.faint, 0.6); ctx.fill();
            }
            text(ctx, 'O', rx + gs + 19, ry - 6, { size: 10.5, mono: true, align: 'center', color: C.peers });
            text(ctx, '片上存储', rx + gs / 2, ry + gs + 26, { size: 12, mono: true, align: 'center', color: C.compute });
            var N = p.values.N, d = 64, bytes = N * N * 2;
            p.set('ratio', fmt(N / d) + ' 倍');
            p.set('std', bytes >= 1 << 30 ? fmt(bytes / (1 << 30), 1) + ' GB / 头' : fmt(bytes / (1 << 20)) + ' MB / 头');
            p.set('flash', '只随 N 线性增长');
        };
        p.loop(tick);
    };

    function upgrade(root) {
        (root || document).querySelectorAll('figure.fig').forEach(function (figure) {
            if (figure.classList.contains('has-demo')) return;
            var img = figure.querySelector('img');
            var m = img && /figures\/([a-z0-9-]+)\.svg/.exec(img.getAttribute('src') || '');
            if (m && registry[m[1]]) {
                try { registry[m[1]](figure); } catch (e) { if (window.console) console.error('demo', m[1], e); }
            }
        });
    }
    window.CourseDemos = { upgrade: upgrade, names: Object.keys(registry) };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { upgrade(); });
    else upgrade();
})();
