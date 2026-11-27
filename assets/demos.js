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
        for (var k in this.cells) shrink(this.cells[k].value);
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
        if (c.value.textContent !== value) { c.value.textContent = value; shrink(c.value); }
        if (tone) c.cell.style.setProperty('--tone', C[tone] || tone);
    };
    // A reading stays on one line, so the panel never changes height under the reader's hand;
    // a long one is set a little smaller instead.
    function shrink(node) {
        node.style.fontSize = '';
        var size = parseFloat(getComputedStyle(node).fontSize);
        while (node.scrollWidth > node.clientWidth + 1 && size > 11) { size -= 0.5; node.style.fontSize = size + 'px'; }
    }
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
     * The six stages of the drawing, and the four kinds of waiting under them. With overlap the
     * slowest stage sets the pace; without it the times add. The GPU stages can go no faster than
     * the CPU hands them work ("waiting for orders").
     * Lesson's example: CPU prepares 300 samples/s, the GPU could do 1000/s → 300/s, GPU idle 70%.
     * The stages without a slider have fixed, illustrative rates. */
    registry.pipeline = function (figure) {
        var p = new Panel(figure, { title: '一步训练的管道', note: '讲解里的六步和四种“等”；没有滑块的三步速度是示意值', ratio: 0.42, minHeight: 300 });
        var ST = [
            { name: '读取与预处理', hw: '存储 → CPU', wait: 'data', key: 'cpu' },
            { name: '拼 batch', hw: '锁页内存', wait: 'data', fixed: 1800 },
            { name: '拷上 GPU', hw: 'PCIe', wait: 'data', fixed: 2500 },
            { name: '前向 · 反向', hw: 'GPU', wait: 'compute', key: 'gpu', launch: true },
            { name: '梯度同步', hw: 'NVLink / 网络', wait: 'peers', key: 'net' },
            { name: '优化器', hw: 'GPU', wait: 'compute', fixed: 6000, launch: true }
        ];
        var WAIT = { data: '等数据', compute: '等计算', peers: '等别的卡', launch: '等发令' };
        var GROUPS = [['data', 0, 2], ['compute', 3, 3], ['peers', 4, 4], ['compute', 5, 5]];
        var n = ST.length, CAP = 3, st, flights, served, cursor;
        function per(v) { return fmt(v) + ' /秒'; }
        p.slider('cpu', '第 1 步 · CPU 准备数据', 100, 2000, 50, 300, per, reset, 'data');
        p.slider('gpu', '第 4 步 · GPU 计算', 100, 2000, 50, 1000, per, reset, 'compute');
        p.slider('net', '第 5 步 · 梯度同步', 100, 4000, 50, 2000, per, reset, 'peers');
        p.slider('launch', 'CPU 发令（派 kernel）', 100, 4000, 50, 3000, per, reset, 'launch');
        p.toggle('overlap', [[true, '相邻环节重叠'], [false, '一段做完才做下一段']], true, reset);
        p.readout('tput', '整体吞吐（样本/秒）', 'ink');
        p.readout('gpu', 'GPU 在计算的时间', 'compute');
        p.readout('neck', '瓶颈', 'data');
        function base(i) { return ST[i].key ? p.values[ST[i].key] : ST[i].fixed; }
        function rate(i) { return ST[i].launch ? Math.min(base(i), p.values.launch) : base(i); }
        function waitOf(i) { return ST[i].launch && p.values.launch < base(i) ? 'launch' : ST[i].wait; }
        function rates() { var r = []; for (var i = 0; i < n; i++) r.push(rate(i)); return r; }
        function analytic() {
            var r = rates();
            if (p.values.overlap) return Math.min.apply(null, r);
            var t = 0; r.forEach(function (x) { t += 1 / x; }); return 1 / t;
        }
        function reset() {
            st = []; for (var i = 0; i < n; i++) st.push({ left: 0, has: false, blocked: false, busy: 0 });
            p.q = []; for (i = 0; i < n - 1; i++) p.q.push(0);
            flights = []; served = 0; cursor = 0;
            p.kick && p.kick();
        }
        function svc(i) { return 170 / rate(i); }
        function fly(from, to) { flights.push({ from: from, to: to, t: 0 }); }
        reset();
        function tick(dt) {
            flights.forEach(function (f) { f.t += dt / 0.3; });
            flights = flights.filter(function (f) { return f.t < 1; });
            var i, s;
            if (p.values.overlap) {
                for (i = n - 1; i >= 0; i--) {
                    s = st[i];
                    if (s.has) {
                        s.left -= dt;
                        if (s.left <= 0) {
                            if (i === n - 1) { s.has = false; served++; fly(i, n); }
                            else if (p.q[i] < CAP) { s.has = false; p.q[i]++; fly(i, i + 1); s.blocked = false; }
                            else s.blocked = true;
                        }
                    }
                    if (!s.has && (i === 0 || p.q[i - 1] > 0)) { if (i > 0) p.q[i - 1]--; s.has = true; s.left = svc(i); }
                    s.busy += ((s.has && s.left > 0 ? 1 : 0) - s.busy) * Math.min(1, dt * 1.5);
                }
            } else {
                for (i = 0; i < n - 1; i++) p.q[i] = 0;
                var a = st[cursor];
                if (!a.has) { a.has = true; a.left = svc(cursor); }
                a.left -= dt;
                if (a.left <= 0) { a.has = false; fly(cursor, cursor + 1); if (cursor === n - 1) served++; cursor = (cursor + 1) % n; }
                st.forEach(function (x, k) { x.busy += ((k === cursor ? 1 : 0) - x.busy) * Math.min(1, dt * 1.5); x.blocked = false; });
            }
        }
        p.draw = function () {
            var w = p.w, narrow = w < 640, pad = 14;
            var gap = narrow ? 14 : Math.max(20, w * 0.032), bw = narrow ? w - pad * 2 - 74 : (w - pad * 2 - gap * (n - 1)) / n, bh = narrow ? 56 : 100;
            var top = narrow ? 16 : 22, groupsH = narrow ? 0 : 74;
            p.fit(narrow ? top + n * bh + (n - 1) * gap + 50 : top + bh + groupsH + 40);
            var ctx = p.ctx, h = p.h;
            p.clear();
            var boxes = []; for (var i = 0; i < n; i++) boxes.push(narrow ? { x: pad, y: top + i * (bh + gap) } : { x: pad + i * (bw + gap), y: top });
            function exit(k) { var b = boxes[k]; return narrow ? [b.x + 24, b.y + bh] : [b.x + bw, b.y + 26]; }
            function entry(k) { if (k === n) return narrow ? [pad + 24, h - 6] : [w - 2, top + 26]; var b = boxes[k]; return narrow ? [b.x + 24, b.y] : [b.x, b.y + 26]; }
            var r = rates(), tput = analytic(), neck = p.values.overlap ? r.indexOf(Math.min.apply(null, r)) : -1, neckWait = neck >= 0 ? waitOf(neck) : null;
            for (i = 0; i < n; i++) {
                var x = boxes[i].x, by = boxes[i].y, wt = waitOf(i), col = C[ST[i].wait], s = st[i];
                ctx.save();
                if (s.busy > 0.05 && !still) { ctx.shadowColor = alpha(col, 0.5 * s.busy); ctx.shadowBlur = 22 * s.busy; }
                round(ctx, x, by, bw, bh, 10); ctx.fillStyle = alpha(col, (0.12 + s.busy * 0.55) * 0.45); ctx.fill();
                ctx.restore();
                round(ctx, x, by, bw, bh, 10);
                ctx.lineWidth = i === neck ? 2 : 1.1; ctx.strokeStyle = alpha(i === neck && wt === 'launch' ? C.launch : col, i === neck ? 1 : 0.5); ctx.stroke();
                var cap = Math.min(1, tput / r[i]);
                if (narrow) {
                    text(ctx, (i + 1) + ' ' + ST[i].name, x + 12, by + 21, { size: 13, weight: 600, color: C.ink });
                    text(ctx, fmt(r[i]) + ' /秒', x + 12, by + 39, { size: 11.5, mono: true, color: alpha(col, 0.95) });
                    text(ctx, ST[i].hw, x + 12 + ctx.measureText(fmt(r[i]) + ' /秒').width + 10, by + 39, { size: 11, color: C.dim });
                    text(ctx, '忙 ' + fmt(cap * 100) + '%', x + bw - 12, by + 21, { size: 11.5, mono: true, align: 'right', color: C.soft });
                    round(ctx, x + 12, by + bh - 9, bw - 24, 3, 1.5); ctx.fillStyle = C.faint; ctx.fill();
                    round(ctx, x + 12, by + bh - 9, Math.max(3, (bw - 24) * cap), 3, 1.5); ctx.fillStyle = col; ctx.fill();
                    // which wait this stage belongs to, at the right edge
                    var own = ST[i].wait, lit = neck === i;
                    ctx.fillStyle = C[own]; ctx.fillRect(w - pad - 64, by + 6, 3, bh - 12);
                    text(ctx, WAIT[own], w - pad - 56, by + (ST[i].launch ? bh / 2 - 2 : bh / 2 + 4), { size: 11.5, weight: lit && wt === own ? 600 : 500, color: lit && wt === own ? C[own] : alpha(C[own], 0.7) });
                    if (ST[i].launch) text(ctx, WAIT.launch, w - pad - 56, by + bh / 2 + 14, { size: 11, weight: lit && wt === 'launch' ? 600 : 500, color: lit && wt === 'launch' ? C.launch : alpha(C.launch, 0.7) });
                } else {
                    var fs = bw < 110 ? 12.5 : 13.5;
                    text(ctx, String(i + 1), x + 10, by + 20, { size: 11, mono: true, weight: 600, color: alpha(col, 0.95) });
                    text(ctx, ST[i].hw, x + 24, by + 20, { size: 10.5, color: C.dim });
                    text(ctx, ST[i].name, x + 10, by + 40, { size: fs, weight: 600, color: C.ink });
                    text(ctx, fmt(r[i]), x + 10, by + 60, { size: 12, mono: true, color: alpha(col, 0.95) });
                    text(ctx, fmt(cap * 100) + '%', x + bw - 10, by + 60, { size: 11, mono: true, align: 'right', color: C.soft });
                    round(ctx, x + 10, by + bh - 18, bw - 20, 5, 2.5); ctx.fillStyle = C.faint; ctx.fill();
                    round(ctx, x + 10, by + bh - 18, Math.max(5, (bw - 20) * cap), 5, 2.5); ctx.fillStyle = col; ctx.fill();
                }
                if (narrow && s.has && s.left > 0) {
                    var prog = 1 - s.left / svc(i);
                    ctx.beginPath();
                    ctx.arc(x + bw - 78, by + 17, 5.5, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
                    ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.stroke();
                }
            }
            for (var k = 0; k < n - 1; k++) {
                var a = exit(k), b = entry(k + 1), qn = p.q[k];
                for (var j = 0; j < CAP; j++) {
                    if (narrow) round(ctx, pad + 40 + j * 14, a[1] + gap / 2 - 3, 10, 6, 2);
                    else round(ctx, a[0] + gap / 2 - 4, boxes[0].y + bh - 12 - j * 9, 8, 6, 2);
                    ctx.fillStyle = j < qn ? alpha(C[ST[k].wait], 0.9) : alpha(C.faint, 0.6); ctx.fill();
                }
                ctx.strokeStyle = C.dim; ctx.lineWidth = 1;
                if (narrow) {
                    ctx.beginPath(); ctx.moveTo(a[0], a[1] + 3); ctx.lineTo(b[0], b[1] - 4); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(b[0] - 3, b[1] - 8); ctx.lineTo(b[0], b[1] - 4); ctx.lineTo(b[0] + 3, b[1] - 8); ctx.stroke();
                } else {
                    ctx.beginPath(); ctx.moveTo(a[0] + 3, a[1]); ctx.lineTo(b[0] - 4, b[1]); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(b[0] - 8, b[1] - 3); ctx.lineTo(b[0] - 4, b[1]); ctx.lineTo(b[0] - 8, b[1] + 3); ctx.stroke();
                }
            }
            flights.forEach(function (f) {
                var a = exit(f.from), b = entry(f.to), e = 1 - Math.pow(1 - f.t, 3), arc = Math.sin(f.t * Math.PI) * 10;
                var fx = a[0] + (b[0] - a[0]) * e - (narrow ? arc : 0), fy = a[1] + (b[1] - a[1]) * e - (narrow ? 0 : arc), tone = C[ST[Math.min(f.from, n - 1)].wait];
                ctx.save(); if (!still) { ctx.shadowColor = tone; ctx.shadowBlur = 10; }
                round(ctx, fx - 5, fy - 3.5, 10, 7, 2); ctx.fillStyle = tone; ctx.fill(); ctx.restore();
            });
            if (!narrow) {
                // the four kinds of waiting, as in the drawing: one bar under the stages each belongs to
                var gy = top + bh + 22;
                GROUPS.forEach(function (g) {
                    var x0 = boxes[g[1]].x, x1 = boxes[g[2]].x + bw, on = neckWait === g[0] && neck >= g[1] && neck <= g[2];
                    ctx.save(); if (on && !still) { ctx.shadowColor = C[g[0]]; ctx.shadowBlur = 14; }
                    round(ctx, x0, gy, x1 - x0, on ? 6 : 4, 3); ctx.fillStyle = alpha(C[g[0]], on ? 1 : 0.45); ctx.fill(); ctx.restore();
                    text(ctx, WAIT[g[0]], (x0 + x1) / 2, gy + 22, { size: 12, weight: on ? 600 : 500, align: 'center', color: on ? C[g[0]] : C.soft });
                });
                var lx0 = boxes[3].x, lx1 = boxes[5].x + bw, lOn = neckWait === 'launch';
                ctx.save(); if (lOn && !still) { ctx.shadowColor = C.launch; ctx.shadowBlur = 14; }
                round(ctx, lx0, gy + 38, lx1 - lx0, lOn ? 6 : 4, 3); ctx.fillStyle = alpha(C.launch, lOn ? 1 : 0.45); ctx.fill(); ctx.restore();
                text(ctx, '等发令：CPU 来不及把下一个任务派给 GPU', (lx0 + lx1) / 2, gy + 60, { size: 12, weight: lOn ? 600 : 500, align: 'center', color: lOn ? C.launch : C.soft });
                text(ctx, p.values.overlap ? '重叠时：整体 = 六段里最慢的那一段' : '不重叠时：每批要依次走完六段，时间相加', pad, gy + 44, { size: 12, color: C.dim });
            } else {
                text(ctx, p.values.overlap ? '重叠时：整体 = 最慢的那一段' : '不重叠时：六段的时间相加', pad + 40, h - 16, { size: 12, color: C.soft });
            }
            p.set('tput', fmt(tput));
            p.set('gpu', fmt(Math.min(1, tput / base(3)) * 100) + '%');
            if (p.values.overlap) p.set('neck', WAIT[neckWait] + '（第 ' + (neck + 1) + ' 步）', neckWait);
            else p.set('neck', '六段串行，时间相加', 'alert');
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
            var narrow = w < 560, L = narrow ? 58 : 74, R = w - 14, AREA = 200, rh = Math.min(30, AREA / W), top = 18 + (AREA - W * rh) / 2, cols = 260, cw = (R - L) / cols;
            var sy = 18 + AREA + 14, sh = 26, legendRows = narrow ? 2 : 1;
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
            var narrow = w < 560, L = narrow ? 50 : 66, R = w - 14, AREA = 200, rh = Math.min(34, AREA / P), top = 16 + (AREA - P * rh) / 2, cw = (R - L) / total;
            p.fit(16 + AREA + (narrow ? 64 : 46));
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

    /* ── shared helpers for the second set ── */
    function logScale(lo, hi, a, b) {
        var l0 = Math.log10(lo), l1 = Math.log10(hi);
        return function (v) { return a + (Math.log10(v) - l0) / (l1 - l0) * (b - a); };
    }
    function fmtBytes(b) {
        if (b >= 1e9) return fmt(b / 1e9, b < 1e10 ? 1 : 0) + ' GB';
        if (b >= 1e6) return fmt(b / 1e6, b < 1e7 ? 1 : 0) + ' MB';
        if (b >= 1e3) return fmt(b / 1e3, b < 1e4 ? 1 : 0) + ' KB';
        return fmt(b) + ' B';
    }
    function fmtTime(s) {
        if (s >= 1) return fmt(s, 2) + ' 秒';
        if (s >= 1e-3) return fmt(s * 1e3, s < 1e-2 ? 2 : 1) + ' 毫秒';
        return fmt(s * 1e6, s < 1e-5 ? 1 : 0) + ' 微秒';
    }
    function legend(ctx, items, x, y, step) {
        items.forEach(function (it, n) {
            var lx = x + n * step;
            ctx.fillStyle = it[0]; round(ctx, lx, y - 9, 10, 10, 2.5); ctx.fill();
            text(ctx, it[1], lx + 15, y, { size: 11, color: C.soft });
        });
    }

    /* ── 5.1 · Time = fixed latency + size ÷ bandwidth ──────────────────────────────────────
     * Lesson: 10 µs and 50 GB/s put the crossover at 500 KB. Ring all-reduce on N cards:
     * 2(N−1)·latency + 2(N−1)/N · S ÷ bandwidth, whose crossover sits at N·latency·bandwidth. */
    registry['alpha-beta'] = function (figure) {
        var p = new Panel(figure, { title: '通信时间 = 固定延迟 + 数据量 ÷ 带宽', note: '拖动消息大小，看时间由谁决定', ratio: 0.5, minHeight: 310 });
        function size(v) { return Math.pow(10, 3 + v / 100 * 6); }
        p.slider('s', '消息大小', 0, 100, 0.25, 100 * (Math.log10(4e3) - 3) / 6, function (v) { return fmtBytes(size(v)); }, null, 'data');
        p.slider('a', '固定延迟', 1, 50, 1, 10, function (v) { return v + ' 微秒'; }, null, 'launch');
        p.slider('b', '带宽', 5, 400, 5, 50, function (v) { return v + ' GB/s'; }, null, 'peers');
        p.slider('n', '卡数 N（环形时）', 2, 64, 1, 8, function (v) { return v + ' 张'; });
        p.toggle('mode', [['p2p', '一次点对点'], ['ring', '环形 all-reduce']], 'p2p');
        p.readout('t', '这次通信用时', 'ink');
        p.readout('share', '其中固定延迟占', 'launch');
        p.readout('eff', '数据量 ÷ 用时', 'peers');
        p.readout('knee', '分界点', 'ink');
        var shown = size(p.values.s);
        function model(S) {
            var a = p.values.a * 1e-6, B = p.values.b * 1e9, N = p.values.n;
            if (p.values.mode === 'ring') return { lat: 2 * (N - 1) * a, xfer: 2 * (N - 1) / N * S / B, knee: N * a * B };
            return { lat: a, xfer: S / B, knee: a * B };
        }
        function tick(dt) { var target = size(p.values.s); shown = Math.pow(10, Math.log10(shown) + (Math.log10(target) - Math.log10(shown)) * Math.min(1, dt * 8)); }
        p.draw = function () {
            var ctx = p.ctx, w = p.w, h = p.h;
            p.clear();
            var narrow = w < 560, L = narrow ? 54 : 70, R = w - 18, T = 30, B = h - 42;
            var X = logScale(1e3, 1e9, L, R), Y = logScale(1e-6, 1, B, T);
            ctx.lineWidth = 1; ctx.strokeStyle = C.faint;
            [[1e3, '1 KB'], [1e4, ''], [1e5, ''], [1e6, '1 MB'], [1e7, ''], [1e8, ''], [1e9, '1 GB']].forEach(function (g) {
                ctx.beginPath(); ctx.moveTo(X(g[0]), T); ctx.lineTo(X(g[0]), B); ctx.stroke();
                if (g[1]) text(ctx, g[1], X(g[0]), B + 18, { size: 11, mono: true, align: 'center', color: C.dim });
            });
            [[1e-6, '1 µs'], [1e-5, ''], [1e-4, ''], [1e-3, '1 ms'], [1e-2, ''], [1e-1, ''], [1, '1 s']].forEach(function (g) {
                ctx.beginPath(); ctx.moveTo(L, Y(g[0])); ctx.lineTo(R, Y(g[0])); ctx.stroke();
                if (g[1]) text(ctx, g[1], L - 8, Y(g[0]) + 4, { size: 11, mono: true, align: 'right', color: C.dim });
            });
            text(ctx, '消息大小（对数）', R, B + 36, { size: 11, align: 'right', color: C.dim });
            text(ctx, '用时', L - 8, T - 12, { size: 11, align: 'right', color: C.dim });
            var m0 = model(1e3), knee = Math.min(1e9, Math.max(1e3, m0.knee));
            ctx.fillStyle = alpha(C.launch, 0.08); ctx.fillRect(L, T, X(knee) - L, B - T);
            ctx.fillStyle = alpha(C.peers, 0.07); ctx.fillRect(X(knee), T, R - X(knee), B - T);
            if (X(knee) - L > 70) text(ctx, '延迟决定', (L + X(knee)) / 2, T + 18, { size: 12.5, weight: 600, align: 'center', color: C.launch });
            if (R - X(knee) > 70) text(ctx, '带宽决定', (X(knee) + R) / 2, T + 18, { size: 12.5, weight: 600, align: 'center', color: C.peers });
            // the two terms on their own, then their sum
            ctx.setLineDash([4, 4]); ctx.lineWidth = 1.4;
            ctx.strokeStyle = alpha(C.launch, 0.8);
            ctx.beginPath(); ctx.moveTo(L, Y(m0.lat)); ctx.lineTo(R, Y(m0.lat)); ctx.stroke();
            ctx.strokeStyle = alpha(C.peers, 0.8); ctx.beginPath();
            for (var i = 0; i <= 60; i++) { var S = Math.pow(10, 3 + i / 10), y = Y(Math.max(1e-6, model(S).xfer)); if (i) ctx.lineTo(X(S), y); else ctx.moveTo(X(S), y); }
            ctx.stroke(); ctx.setLineDash([]);
            ctx.save();
            if (!still) { ctx.shadowColor = alpha(C.ink, 0.5); ctx.shadowBlur = 10; }
            ctx.strokeStyle = C.ink; ctx.lineWidth = 2.4; ctx.beginPath();
            for (i = 0; i <= 120; i++) { S = Math.pow(10, 3 + i / 20); var m = model(S); y = Y(m.lat + m.xfer); if (i) ctx.lineTo(X(S), y); else ctx.moveTo(X(S), y); }
            ctx.stroke(); ctx.restore();
            ctx.setLineDash([2, 4]); ctx.strokeStyle = C.dim; ctx.beginPath(); ctx.moveTo(X(knee), T + 26); ctx.lineTo(X(knee), B); ctx.stroke(); ctx.setLineDash([]);
            // things from the lessons, on the same axis
            [[4e3, '几 KB 的偏置'], [25e6, 'DDP 的 25 MB 桶']].forEach(function (mk) {
                var mm = model(mk[0]), yy = Y(mm.lat + mm.xfer);
                ctx.beginPath(); ctx.arc(X(mk[0]), yy, 3.5, 0, Math.PI * 2); ctx.fillStyle = C.soft; ctx.fill();
                text(ctx, mk[1], X(mk[0]) + 7, yy - 8, { size: 11, color: C.soft });
            });
            var M = model(shown), t = M.lat + M.xfer, px = X(shown), py = Y(t), col = M.lat > M.xfer ? C.launch : C.peers;
            ctx.setLineDash([2, 3]); ctx.strokeStyle = alpha(col, 0.7);
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, B); ctx.stroke(); ctx.setLineDash([]);
            ctx.save(); if (!still) { ctx.shadowColor = col; ctx.shadowBlur = 18; }
            ctx.beginPath(); ctx.arc(px, py, 7.5, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.restore();
            // how this one message's time splits
            var bw = narrow ? 120 : 180, bx = R - bw - 6, by = B - 26, f = M.lat / t;
            round(ctx, bx, by, bw, 8, 4); ctx.fillStyle = alpha(C.peers, 0.85); ctx.fill();
            round(ctx, bx, by, Math.max(3, bw * f), 8, 4); ctx.fillStyle = C.launch; ctx.fill();
            text(ctx, '延迟 | 传输', bx, by - 7, { size: 10.5, color: C.dim });
            var S0 = size(p.values.s), E = model(S0), T0 = E.lat + E.xfer;
            p.set('t', fmtTime(T0));
            p.set('share', fmt(E.lat / T0 * 100) + '%');
            p.set('eff', fmt(S0 / T0 / 1e9, S0 / T0 < 1e10 ? 2 : 0) + ' GB/s');
            p.set('knee', fmtBytes(model(1e3).knee));
        };
        p.loop(tick);
    };

    /* ── 7.1 · DDP buckets ─────────────────────────────────────────────────────────────────
     * 24 layers, each a weight and a bias; backward runs from the last layer to the first.
     * A bucket's all-reduce starts once all its gradients exist and the bucket before it has gone.
     * Times are illustrative; the shape of the trade-off is the lesson's. */
    registry['ddp-overlap'] = function (figure) {
        var p = new Panel(figure, { title: 'DDP 分桶：一边反向，一边通信', note: '时间是示意值：每层反向 4 ms，每次通信先付 1 ms 固定延迟', ratio: 0.4, minHeight: 280 });
        var CAPS = [0, 1, 2, 5, 10, 25, 50, 100, Infinity], LAYERS = 24, STEP = 4, LAT = 1, MS_PER_MB = 0.42;
        p.slider('cap', '桶的大小（bucket_cap_mb）', 0, CAPS.length - 1, 1, 5, function (v) { var c = CAPS[v]; return c === 0 ? '每个张量单独发' : c === Infinity ? '全部攒成一个' : c + ' MB'; }, restart, 'peers');
        p.toggle('order', [['reverse', '按反向的顺序装桶（DDP）'], ['forward', '按定义的顺序装桶']], 'reverse', restart);
        p.readout('calls', '通信次数', 'ink');
        p.readout('exposed', '反向结束后还要等', 'alert');
        p.readout('total', '这一步的总时长', 'ink');
        var head = 0, plan;
        function restart() { head = 0; plan = null; p.kick && p.kick(); }
        function build() {
            var tensors = [];
            for (var l = 1; l <= LAYERS; l++) { tensors.push({ layer: l, mb: 8 }); tensors.push({ layer: l, mb: 0.016 }); }
            if (p.values.order === 'reverse') tensors.reverse();
            var cap = CAPS[p.values.cap], buckets = [], cur = null;
            tensors.forEach(function (t) {
                if (!cur || (cur.mb + t.mb > cap && cur.mb > 0) || cap === 0) { cur = { mb: 0, layers: [] }; buckets.push(cur); }
                cur.mb += t.mb; if (cur.layers.indexOf(t.layer) < 0) cur.layers.push(t.layer);
            });
            var end = 0;
            buckets.forEach(function (b) {
                b.ready = Math.max.apply(null, b.layers.map(function (l) { return (LAYERS - l + 1) * STEP; }));
                b.start = Math.max(b.ready, end);
                b.dur = LAT + b.mb * MS_PER_MB;
                b.end = end = b.start + b.dur;
            });
            return { buckets: buckets, back: LAYERS * STEP, end: Math.max(LAYERS * STEP, end) };
        }
        function tick(dt) {
            if (!plan) plan = build();
            head += dt * 60;
            if (head > plan.end + 70) head = 0;
        }
        p.draw = function () {
            if (!plan) plan = build();
            var ctx = p.ctx, w = p.w, narrow = w < 560;
            var L = narrow ? 62 : 84, R = w - 16, top = 34, laneH = 34, gap = 46;
            p.fit(top + laneH * 2 + gap + 74);
            ctx = p.ctx; var h = p.h;
            p.clear();
            var scale = Math.max(200, plan.end * 1.04), X = function (t) { return L + t / scale * (R - L); }, now = still ? 1e9 : head;
            ctx.strokeStyle = C.faint; ctx.lineWidth = 1;
            for (var t = 0; t <= scale; t += 20) { ctx.beginPath(); ctx.moveTo(X(t), top - 6); ctx.lineTo(X(t), top + laneH * 2 + gap + 6); ctx.stroke(); if (t % (narrow ? 80 : 40) === 0) text(ctx, t + ' ms', X(t), top - 12, { size: 10.5, mono: true, align: 'center', color: C.dim }); }
            var y1 = top, y2 = top + laneH + gap;
            text(ctx, '反向计算', L - 10, y1 + laneH / 2 + 4, { size: 12, weight: 600, align: 'right', color: C.ink });
            text(ctx, '梯度通信', L - 10, y2 + laneH / 2 + 4, { size: 12, weight: 600, align: 'right', color: C.ink });
            // backward: last layer first
            var bucketOf = {};
            plan.buckets.forEach(function (b, k) { b.layers.forEach(function (l) { bucketOf[l] = k; }); });
            for (var i = 0; i < LAYERS; i++) {
                var layer = LAYERS - i, x0 = X(i * STEP), x1 = X((i + 1) * STEP), done = now >= (i + 1) * STEP;
                round(ctx, x0 + 0.5, y1, x1 - x0 - 1, laneH, 3);
                ctx.fillStyle = done ? alpha(C.compute, 0.92) : now > i * STEP ? alpha(C.compute, 0.55) : alpha(C.compute, 0.14);
                ctx.fill();
                if (x1 - x0 > 16) text(ctx, String(layer), (x0 + x1) / 2, y1 + laneH / 2 + 4, { size: 10, mono: true, align: 'center', color: done ? C.panel : C.dim });
                // which bucket this layer's gradients wait in
                var k = bucketOf[layer];
                ctx.fillStyle = alpha(k % 2 ? C.peers : C.data, done ? 0.9 : 0.3);
                ctx.fillRect(x0 + 1, y1 + laneH + 5, x1 - x0 - 2, 4);
            }
            plan.buckets.forEach(function (b, k) {
                var x0 = X(b.start), x1 = X(b.end), xl = X(b.start + LAT), on = now >= b.start;
                if (!on) return;
                var fill = Math.min(1, (now - b.start) / b.dur), xe = x0 + (x1 - x0) * fill;
                ctx.save(); ctx.beginPath(); ctx.rect(x0, y2 - 2, xe - x0, laneH + 4); ctx.clip();
                round(ctx, x0 + 0.5, y2, Math.max(2, xl - x0 - 1), laneH, 3); ctx.fillStyle = C.launch; ctx.fill();
                round(ctx, xl, y2, Math.max(1, x1 - xl - 1), laneH, 3); ctx.fillStyle = alpha(k % 2 ? C.peers : C.data, 0.9); ctx.fill();
                ctx.restore();
            });
            var xb = X(plan.back);
            ctx.strokeStyle = alpha(C.ink, 0.7); ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(xb, top - 4); ctx.lineTo(xb, y2 + laneH + 8); ctx.stroke(); ctx.setLineDash([]);
            text(ctx, '反向结束', xb + 5, y1 + laneH + 26, { size: 11, color: C.soft });
            var exposed = plan.end - plan.back;
            if (exposed > 0.5 && now >= plan.end) {
                var by = y2 + laneH + 18;
                ctx.strokeStyle = C.alert; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(xb, by - 5); ctx.lineTo(xb, by); ctx.lineTo(X(plan.end), by); ctx.lineTo(X(plan.end), by - 5); ctx.stroke();
                text(ctx, '露在外面的通信', (xb + X(plan.end)) / 2, by + 15, { size: 11, align: 'center', color: C.alert });
            }
            if (!still && now < plan.end + 4) { ctx.strokeStyle = alpha(C.ink, 0.55); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(now), top - 4); ctx.lineTo(X(now), y2 + laneH + 4); ctx.stroke(); }
            legend(ctx, [[C.compute, '反向'], [C.launch, '固定延迟'], [alpha(C.peers, 0.9), '传输']], narrow ? 16 : L, h - 12, narrow ? 76 : 96);
            if (!narrow) text(ctx, '反向下的细条：这层梯度在哪个桶（相邻的桶交替着色）', L + 300, h - 12, { size: 11, color: C.dim });
            p.set('calls', fmt(plan.buckets.length) + ' 次');
            p.set('exposed', fmt(exposed, exposed < 10 ? 1 : 0) + ' ms', exposed > 20 ? 'alert' : 'peers');
            p.set('total', fmt(plan.end, 0) + ' ms');
        };
        p.loop(tick);
    };

    /* ── 7.2 · ZeRO ────────────────────────────────────────────────────────────────────────
     * The lesson's bytes per parameter: 16 (2 + 2 + 12), then 4 + 12/N, 2 + 14/N, 16/N;
     * communication 1×, 1×, 1×, 1.5×. */
    registry['zero-levels'] = function (figure) {
        var p = new Panel(figure, { title: 'ZeRO：每张卡只管 1/N', note: '混合精度 + Adam，每个参数 16 字节；卡上显存按 80 GB 算', ratio: 0.46, minHeight: 300 });
        p.toggle('lv', [[0, '数据并行'], [1, '第一级'], [2, '第二级'], [3, '第三级']], 0);
        p.slider('n', '卡数 N', 1, 64, 1, 8, function (v) { return v + ' 张'; });
        p.slider('P', '模型参数', 1, 70, 1, 7, function (v) { return v + 'B（' + v * 10 + ' 亿）'; });
        p.readout('bpp', '每个参数约占（字节）', 'ink');
        p.readout('card', '每张卡的模型状态', 'ink');
        p.readout('comm', '通信量（相对数据并行）', 'peers');
        p.readout('fit', '80 GB 的卡放得下吗', 'ink');
        var parts = [['参数', 2, C.compute], ['梯度', 2, C.launch], ['优化器', 12, C.data]], shown = [2, 2, 12];
        function target() {
            var N = p.values.n, lv = p.values.lv;
            return [lv >= 3 ? 2 / N : 2, lv >= 2 ? 2 / N : 2, lv >= 1 ? 12 / N : 12];
        }
        function tick(dt) { var t = target(); for (var i = 0; i < 3; i++) shown[i] += (t[i] - shown[i]) * Math.min(1, dt * 6); }
        p.draw = function () {
            var ctx = p.ctx, w = p.w, h = p.h, narrow = w < 560;
            p.clear();
            var N = p.values.n, lv = p.values.lv, P = p.values.P * 1e9, drawn = Math.min(N, narrow ? 4 : 8);
            var L = narrow ? 50 : 64, R = w - 16, T = 30, B = h - 46, gap = narrow ? 12 : 18;
            var maxGB = Math.max(100, 16 * P / 1e9 * 1.08), Y = function (gb) { return B - gb / maxGB * (B - T); };
            ctx.strokeStyle = C.faint; ctx.lineWidth = 1;
            var tickStep = maxGB > 600 ? 200 : maxGB > 250 ? 100 : 20;
            for (var g = 0; g <= maxGB; g += tickStep) { ctx.beginPath(); ctx.moveTo(L, Y(g)); ctx.lineTo(R, Y(g)); ctx.stroke(); text(ctx, g + ' GB', L - 8, Y(g) + 4, { size: 10.5, mono: true, align: 'right', color: C.dim }); }
            ctx.strokeStyle = C.alert; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(L, Y(80)); ctx.lineTo(R, Y(80)); ctx.stroke(); ctx.setLineDash([]);
            text(ctx, '一张 80 GB 的卡', R, Y(80) - 7, { size: 11, align: 'right', color: C.alert });
            var cw = Math.min(90, (R - L - gap * (drawn + 1)) / (drawn + (N > drawn ? 0.8 : 0)));
            for (var c = 0; c < drawn; c++) {
                var x = L + gap + c * (cw + gap), base = 0;
                for (var i = 0; i < 3; i++) {
                    var gb = shown[i] * P / 1e9, y0 = Y(base), y1 = Y(base + gb), sharded = (lv >= 1 && i === 2) || (lv >= 2 && i === 1) || (lv >= 3 && i === 0);
                    ctx.fillStyle = alpha(parts[i][2], sharded ? 0.95 : 0.55);
                    ctx.fillRect(x, y1, cw, Math.max(0, y0 - y1 - 1));
                    if (sharded && N > 1 && y0 - y1 > 14 && cw > 40) text(ctx, '第 ' + (c + 1) + ' 段', x + cw / 2, (y0 + y1) / 2 + 4, { size: 10.5, align: 'center', weight: 600, color: C.panel });
                    base += gb;
                }
                text(ctx, '卡 ' + (c + 1), x + cw / 2, B + 16, { size: 11, align: 'center', color: C.dim });
            }
            if (N > drawn) text(ctx, '… 共 ' + N + ' 张', R - 2, B - 8, { size: 12, align: 'right', color: C.soft });
            var lx = narrow ? L : R - 270;
            legend(ctx, parts.map(function (pt) { return [pt[2], pt[0] + ' ' + pt[1] + ' 字节']; }), lx, T - 8, narrow ? 84 : 90);
            var bpp = [16, 4 + 12 / N, 2 + 14 / N, 16 / N][lv], card = bpp * P / 1e9;
            p.set('bpp', fmt(bpp, bpp < 10 ? 2 : 0));
            p.set('card', fmt(card, card < 10 ? 1 : 0) + ' GB');
            p.set('comm', lv === 3 ? '1.5 倍' : '1 倍', lv === 3 ? 'data' : 'peers');
            p.set('fit', card <= 80 ? (card <= 60 ? '放得下，余 ' + fmt(80 - card) + ' GB' : '勉强放下') : '放不下', card <= 60 ? 'peers' : card <= 80 ? 'data' : 'alert');
        };
        p.loop(tick);
    };

    /* ── 9.1 · KV cache sizing ─────────────────────────────────────────────────────────────
     * Lesson: 2 × layers × hidden × tokens × bytes. 32 layers, 4096, 16 bit → 0.5 MB a token,
     * 4000 tokens ≈ 2 GB; an 80 GB card with 14 GB of weights leaves about 60 GB → about 30 requests. */
    registry['kv-memory'] = function (figure) {
        var p = new Panel(figure, { title: '一张卡能同时服务多少请求', note: '80 GB 的卡：权重 14 GB，留给 KV cache 约 60 GB', ratio: 0.36, minHeight: 250 });
        function tokens(v) { return Math.round(Math.pow(10, 2.5 + v / 100 * 2.6) / 100) * 100; }
        p.slider('ctx', '每个请求的上下文', 0, 100, 0.5, 100 * (Math.log10(4000) - 2.5) / 2.6, function (v) { return fmt(tokens(v)) + ' token'; }, refill, 'data');
        p.slider('layers', '层数', 8, 80, 4, 32, function (v) { return v + ' 层'; }, refill);
        p.slider('hidden', '隐藏维度', 1024, 8192, 512, 4096, function (v) { return fmt(v); }, refill);
        p.toggle('group', [[1, '每个头一组 K、V'], [4, 'GQA：4 个头共用'], [8, '8 个头共用']], 1, refill);
        p.toggle('bits', [[2, '16 位'], [1, '8 位']], 2, refill);
        p.readout('tok', '每个 token', 'ink');
        p.readout('req', '每个请求', 'data');
        p.readout('cap', '能同时放下', 'peers');
        var fill = 0;
        function refill() { fill = 0; p.kick && p.kick(); }
        function sizes() {
            var perTok = 2 * p.values.layers * p.values.hidden * p.values.bits / p.values.group, T = tokens(p.values.ctx), perReq = perTok * T;
            return { perTok: perTok, T: T, perReq: perReq, cap: Math.floor(60 * Math.pow(2, 30) / perReq) };
        }
        function tick(dt) { var s = sizes(); fill = Math.min(s.cap + 0.999, fill + dt * Math.max(3, s.cap / 1.6)); }
        p.draw = function () {
            var ctx = p.ctx, w = p.w, narrow = w < 560, s = sizes();
            var L = 16, R = w - 16, cols = narrow ? 20 : 40, rows = 160 / cols, cell = (R - L) / cols, top = 40;
            p.fit(top + rows * cell + 58);
            ctx = p.ctx; var h = p.h;
            p.clear();
            text(ctx, '一张 80 GB 的卡，每一格 0.5 GB', L, 22, { size: 12, color: C.soft });
            var GB = Math.pow(2, 30), reqCells = s.perReq / GB * 2, shownReq = still ? s.cap : Math.floor(fill), partial = still ? 0 : fill - shownReq;
            for (var k = 0; k < 160; k++) {
                var cx = L + (k % cols) * cell, cy = top + Math.floor(k / cols) * cell, colr, a = 1;
                if (k < 28) colr = C.compute;                                   // weights, 14 GB
                else if (k < 40) colr = '#2A3B50';                              // runtime and headroom
                else {
                    var pos = (k - 40) / reqCells, idx = Math.floor(pos);
                    if (reqCells > 0 && idx < shownReq && pos < s.cap) colr = idx % 2 ? alpha(C.data, 0.62) : C.data;
                    else if (reqCells > 0 && idx === shownReq && idx < s.cap && pos - idx < partial) colr = alpha(C.data, 0.5);
                    else { colr = alpha(C.faint, 0.55); a = 0; }
                }
                round(ctx, cx + 1, cy + 1, cell - 2, cell - 2, Math.min(4, cell / 5));
                ctx.fillStyle = colr; ctx.fill();
                if (a && k >= 40 && !still && (k - 40) / reqCells >= shownReq - 1 && (k - 40) / reqCells < shownReq) { ctx.save(); ctx.shadowColor = C.data; ctx.shadowBlur = 10; ctx.fill(); ctx.restore(); }
            }
            var ly = top + rows * cell + 24;
            legend(ctx, [[C.compute, '模型权重 14 GB'], ['#2A3B50', '运行时与余量'], [C.data, '一个个请求的 KV cache']], L, ly, narrow ? 110 : 150);
            var msg = s.cap === 0 ? '一个请求的缓存就超过了 60 GB：一个都放不下' : '同时放下 ' + s.cap + ' 个请求；再来的只能排队，算力却远没用满';
            text(ctx, msg, L, ly + 24, { size: 12, color: s.cap === 0 ? C.alert : C.soft });
            p.set('tok', fmt(s.perTok / Math.pow(2, 20), 2) + ' MB');
            p.set('req', s.perReq >= GB ? fmt(s.perReq / GB, 1) + ' GB' : fmt(s.perReq / Math.pow(2, 20)) + ' MB', s.perReq > 14 * GB ? 'alert' : 'data');
            p.set('cap', s.cap + ' 个请求', s.cap < 8 ? 'alert' : 'peers');
        };
        p.loop(tick);
    };

    /* ── 9.3 · Static against continuous batching ──────────────────────────────────────────
     * The same stream of requests goes to both. Static: a batch runs until its longest request ends.
     * Continuous: after every step, finished requests leave and waiting ones take their place. */
    registry['continuous-batching'] = function (figure) {
        var p = new Panel(figure, { title: '静态批处理 vs 连续批处理', note: '同一串请求同时喂给两边；一格是一步（生成一个 token），长度是示意', ratio: 0.5, minHeight: 330 });
        var SLOTS = 4, COLS = 64, sims, stream, acc;
        p.slider('every', '每隔几步来一个请求', 1, 8, 1, 4, function (v) { return v + ' 步'; }, reset, 'data');
        p.slider('long', '最长的请求', 10, 60, 2, 40, function (v) { return v + ' 步'; }, reset);
        p.button('重来', function () { reset(); }, 'ghost');
        p.readout('us', '静态：槽位真正在干活', 'alert');
        p.readout('uc', '连续：槽位真正在干活', 'peers');
        p.readout('ws', '静态：平均排队（步）', 'ink');
        p.readout('wc', '连续：平均排队（步）', 'ink');
        function rng(seed) { return function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; }
        function reset() {
            var r = rng(7);
            stream = { r: r, list: [] };
            sims = [mk('static'), mk('cont')];
            acc = 0;
            for (var w0 = 0; w0 < COLS; w0++) sims.forEach(stepSim);
            p.kick && p.kick();
        }
        function mk(kind) { return { kind: kind, step: 0, queue: [], slots: [], hist: [], busy: 0, total: 0, waits: [], next: 0 }; }
        function request(i) {
            while (stream.list.length <= i) {
                var r = stream.r, n = stream.list.length, longOne = r() < 0.22, len = longOne ? Math.round(p.values.long * (0.65 + 0.35 * r())) : 2 + Math.round(r() * p.values.long * 0.3);
                stream.list.push({ id: n, len: len, at: n * p.values.every });
            }
            return stream.list[i];
        }
        function stepSim(s) {
            while (request(s.next).at <= s.step) { var q = request(s.next++); s.queue.push({ id: q.id, len: q.len, left: q.len, at: q.at }); }
            var running = s.slots.some(function (x) { return x && x.left > 0; });
            if (s.kind === 'cont' || !running) {
                if (s.kind === 'static') s.slots = [];
                for (var k = 0; k < SLOTS; k++) {
                    if ((!s.slots[k] || s.slots[k].left <= 0) && s.queue.length) { var q2 = s.queue.shift(); s.waits.push(s.step - q2.at); s.slots[k] = q2; }
                }
            }
            var col = [];
            for (k = 0; k < SLOTS; k++) {
                var x = s.slots[k];
                if (x && x.left > 0) { x.left--; col.push({ id: x.id, first: x.left === x.len - 1, last: x.left === 0 }); s.busy++; }
                else col.push(null);
                s.total++;
            }
            s.hist.push(col); if (s.hist.length > COLS) s.hist.shift();
            s.step++;
        }
        reset();
        function tick(dt) { acc += dt * 9; while (acc >= 1) { acc -= 1; sims.forEach(stepSim); } }
        if (still) for (var i = 0; i < 200; i++) sims.forEach(stepSim);
        var PAL = [C.compute, C.peers, C.data, C.launch];
        p.draw = function () {
            var ctx = p.ctx, w = p.w, narrow = w < 560, L = narrow ? 50 : 86, R = w - 14, rh = 22, blockGap = 46, top = 34;
            p.fit(top + 2 * SLOTS * rh + blockGap + 48);
            ctx = p.ctx; var h = p.h;
            p.clear();
            var cw = (R - L) / COLS;
            sims.forEach(function (s, b) {
                var y0 = top + b * (SLOTS * rh + blockGap);
                text(ctx, b ? '连续批处理' : '静态批处理', L, y0 - 12, { size: 12.5, weight: 600, color: b ? C.peers : C.alert });
                text(ctx, '排队中 ' + s.queue.length, R, y0 - 12, { size: 11.5, mono: true, align: 'right', color: s.queue.length > 6 ? C.alert : C.dim });
                for (var k = 0; k < SLOTS; k++) {
                    var y = y0 + k * rh;
                    text(ctx, '槽 ' + (k + 1), L - 10, y + rh * 0.68, { size: 11, align: 'right', color: C.dim });
                    var off = COLS - s.hist.length;
                    for (var c = 0; c < s.hist.length; c++) {
                        var cell = s.hist[c][k], x = L + (off + c) * cw;
                        if (cell) {
                            ctx.fillStyle = alpha(PAL[cell.id % 4], 0.88);
                            ctx.fillRect(Math.round(x), y + 2, Math.ceil(cw) - (cell.last ? 2 : 0), rh - 4);
                            if (cell.first) { ctx.fillStyle = C.ink; ctx.fillRect(Math.round(x), y + 2, 2, rh - 4); }
                        } else {
                            ctx.fillStyle = alpha(C.alert, 0.13);
                            ctx.fillRect(Math.round(x), y + 2, Math.ceil(cw), rh - 4);
                        }
                    }
                }
            });
            legend(ctx, [[C.compute, '一个请求（换色即换人）'], [alpha(C.alert, 0.35), '槽位空着']], L, h - 12, narrow ? 140 : 190);
            function pct(s) { return s.total ? fmt(s.busy / s.total * 100) + '%' : '—'; }
            function wait(s) { if (!s.waits.length) return '—'; var t = 0; s.waits.forEach(function (x) { t += x; }); return fmt(t / s.waits.length, 1); }
            p.set('us', pct(sims[0])); p.set('uc', pct(sims[1]));
            p.set('ws', wait(sims[0])); p.set('wc', wait(sims[1]));
        };
        p.loop(tick);
    };

    /* ── 3.4 · Coalescing ──────────────────────────────────────────────────────────────────
     * 32 threads of a warp each read one 4-byte float. Memory hands out whole 128-byte
     * segments (the segment size is illustrative). Stride 1 → one segment; stride 32 → 32. */
    registry.coalescing = function (figure) {
        var p = new Panel(figure, { title: '合并访存：一个 warp 的 32 次读', note: '每个线程读一个 4 字节的数；显存一次送出 128 字节的一整段（示意）', ratio: 0.5, minHeight: 300 });
        p.slider('stride', '相邻线程的地址相隔（元素）', 1, 32, 1, 1, function (v) { return v === 1 ? '1（连续）' : String(v); }, function () { pulse = 0; p.kick && p.kick(); }, 'data');
        p.readout('tx', '要传输的段数', 'ink');
        p.readout('moved', '实际搬运', 'ink');
        p.readout('used', '真正用到', 'ink');
        p.readout('eff', '有效带宽只剩', 'peers');
        var pulse = 0;
        function tick(dt) { pulse = (pulse + dt / 1.8) % 1; }
        p.draw = function () {
            var ctx = p.ctx, w = p.w, narrow = w < 560, stride = p.values.stride, segs = Math.ceil(32 * stride / 32);
            var L = 18, R = w - 18, perRow = Math.min(segs, narrow ? 4 : 8), gap = narrow ? 8 : 12, segW = (R - L - gap * (perRow - 1)) / perRow, segH = narrow ? 30 : 34;
            var rows = Math.ceil(segs / perRow), memTop = 150, maxRows = narrow ? 8 : 4;
            p.fit(memTop + maxRows * (segH + gap) + 30);
            ctx = p.ctx; var h = p.h;
            p.clear();
            var tw = (R - L) / 32;
            text(ctx, '一个 warp 的 32 个线程', L, 22, { size: 12, color: C.soft });
            text(ctx, '显存：每块是一段 128 字节，装 32 个数；亮的是被读到的', L, h - 12, { size: 12, color: C.soft });
            function cellPos(e) {
                var s = Math.floor(e / 32), within = e % 32, row = Math.floor(s / perRow), col = s % perRow;
                var sx = L + col * (segW + gap), sy = memTop + row * (segH + gap);
                return { x: sx + (within + 0.5) * segW / 32, y: sy, s: s };
            }
            for (var s = 0; s < segs; s++) {
                var row = Math.floor(s / perRow), col = s % perRow, sx = L + col * (segW + gap), sy = memTop + row * (segH + gap);
                round(ctx, sx, sy, segW, segH, 6);
                ctx.fillStyle = alpha(C.alert, stride > 1 ? 0.10 : 0.0); ctx.fill();
                ctx.fillStyle = alpha(C.data, 0.08); ctx.fill();
                ctx.strokeStyle = alpha(C.data, 0.75); ctx.lineWidth = 1.2; ctx.stroke();
                for (var e = 0; e < 32; e++) {
                    var used = (s * 32 + e) % stride === 0;
                    ctx.fillStyle = used ? C.data : alpha(C.faint, 0.9);
                    ctx.fillRect(sx + e * segW / 32 + 0.5, sy + 6, Math.max(1, segW / 32 - 1), segH - 12);
                }
            }
            for (var t = 0; t < 32; t++) {
                var tx = L + (t + 0.5) * tw, ty = 50, q = cellPos(t * stride);
                ctx.strokeStyle = alpha(C.data, 0.28); ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(tx, ty + 8); ctx.bezierCurveTo(tx, ty + 44, q.x, q.y - 44, q.x, q.y); ctx.stroke();
                if (!still) {
                    var u = (pulse * 1.3 - t / 32 * 0.3); if (u > 0 && u < 1) {
                        var a = 1 - u, bx = a * a * a * tx + 3 * a * a * u * tx + 3 * a * u * u * q.x + u * u * u * q.x;
                        var by = a * a * a * (ty + 8) + 3 * a * a * u * (ty + 44) + 3 * a * u * u * (q.y - 44) + u * u * u * q.y;
                        ctx.save(); ctx.shadowColor = C.data; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(bx, by, 2.2, 0, Math.PI * 2); ctx.fillStyle = C.data; ctx.fill(); ctx.restore();
                    }
                }
                ctx.beginPath(); ctx.arc(tx, ty, Math.min(6, tw * 0.36), 0, Math.PI * 2); ctx.fillStyle = C.compute; ctx.fill();
                if (t % (narrow ? 8 : 4) === 0) text(ctx, String(t), tx, ty - 10, { size: 10, mono: true, align: 'center', color: C.dim });
            }
            var moved = segs * 128;
            p.set('tx', segs + ' 次', segs > 4 ? 'alert' : 'peers');
            p.set('moved', fmt(moved) + ' 字节');
            p.set('used', '128 字节');
            p.set('eff', fmt(100 / segs, segs === 1 ? 0 : 1) + '%', segs === 1 ? 'peers' : 'alert');
        };
        p.loop(tick);
    };

    /* ── 7.3 · Tensor parallelism, computed with real numbers ──────────────────────────────
     * y = gelu(x·A)·B with x of 4, a hidden layer of 8, an output of 4. Megatron: A by columns,
     * B by rows, the partial outputs summed once at the end; the sum must equal the unsplit y.
     * Splitting A by rows instead gives partial pre-activations, and gelu of a part is not part
     * of gelu, so the sum is wrong unless the cards talk before the activation. */
    registry['tensor-parallel'] = function (figure) {
        var p = new Panel(figure, { title: '张量并行：把 MLP 切到几张卡上', note: '用一组真实的小数字算一遍：各卡的结果加起来，要和不切时完全一样', ratio: 0.6, minHeight: 360 });
        p.toggle('n', [[1, '1 张卡'], [2, '2 张'], [4, '4 张']], 2, restart);
        p.toggle('how', [['col', 'A 按列切，B 按行切'], ['row', '反过来：A 按行切']], 'col', restart);
        p.button('重放', function () { restart(); }, 'ghost');
        p.readout('comm', '这个 MLP 要通信', 'peers');
        p.readout('match', '各卡相加 vs 不切', 'ink');
        p.readout('store', '每张卡存的权重', 'ink');
        var PAL = [C.compute, C.peers, C.data, C.launch], clock = 0, CYCLE = 7.5;
        function restart() { clock = 0; p.kick && p.kick(); }
        var seed = 3;
        function r() { seed = (seed * 16807) % 2147483647; return Math.round(((seed / 2147483647) * 2 - 1) * 10) / 10; }
        var x = [0.8, -0.5, 0.3, 1.0], A = [], B = [], i, j;
        for (i = 0; i < 4; i++) { A.push([]); for (j = 0; j < 8; j++) A[i].push(r()); }
        for (i = 0; i < 8; i++) { B.push([]); for (j = 0; j < 4; j++) B[i].push(r()); }
        function gelu(z) { return 0.5 * z * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (z + 0.044715 * z * z * z))); }
        function solve() {
            var N = p.values.n, col = p.values.how === 'col', cards = [], k, a, b, c;
            var z = [], ref = [0, 0, 0, 0];
            for (b = 0; b < 8; b++) { z[b] = 0; for (a = 0; a < 4; a++) z[b] += x[a] * A[a][b]; }
            for (c = 0; c < 4; c++) for (b = 0; b < 8; b++) ref[c] += gelu(z[b]) * B[b][c];
            for (k = 0; k < N; k++) {
                var card = { hidden: [], idx: [], part: [0, 0, 0, 0] };
                if (col) {                                   // my columns of A, my rows of B
                    for (b = k * 8 / N; b < (k + 1) * 8 / N; b++) {
                        var zz = 0; for (a = 0; a < 4; a++) zz += x[a] * A[a][b];
                        card.idx.push(b); card.hidden.push(gelu(zz));
                        for (c = 0; c < 4; c++) card.part[c] += gelu(zz) * B[b][c];
                    }
                } else {                                     // my rows of A: a partial sum of every hidden unit
                    for (b = 0; b < 8; b++) {
                        var pz = 0; for (a = k * 4 / N; a < (k + 1) * 4 / N; a++) pz += x[a] * A[a][b];
                        card.idx.push(b); card.hidden.push(gelu(pz));
                        for (c = 0; c < 4; c++) card.part[c] += gelu(pz) * B[b][c];
                    }
                }
                cards.push(card);
            }
            var sum = [0, 0, 0, 0];
            cards.forEach(function (cd) { for (c = 0; c < 4; c++) sum[c] += cd.part[c]; });
            var err = 0; for (c = 0; c < 4; c++) err = Math.max(err, Math.abs(sum[c] - ref[c]));
            return { cards: cards, sum: sum, ref: ref, err: err };
        }
        function tick(dt) { clock = (clock + dt) % CYCLE; }
        function num(v) { return (v >= 0 ? '' : '−') + Math.abs(v).toFixed(2); }
        p.draw = function () {
            var ctx = p.ctx, w = p.w, narrow = w < 560, S = solve(), N = p.values.n, col = p.values.how === 'col';
            var pad = 14, L = narrow ? 46 : 64, cw = narrow ? Math.min(36, (w - L - pad) / 8) : Math.min(48, (w - L - pad - 40 - 4 * 52) / 8);
            var ow = narrow ? Math.min(52, (w - L - pad) / 4) : 52, rowH = narrow ? 64 : 40, top = 86;
            var cardsH = 4 * rowH + 3 * 8, sumY = top + cardsH + (narrow ? 44 : 34), rowGap = narrow ? 46 : 34;
            p.fit(sumY + 2 * rowGap + 30);
            ctx = p.ctx; var h = p.h;
            p.clear();
            var phase = still ? 9 : clock / CYCLE * 6;            // 0 inputs, 1 hidden, 2 gelu, 3 partial, 4 sum, 5 compare
            text(ctx, '输入 x（每张卡都有一份）', pad, 22, { size: 11.5, color: C.soft });
            for (i = 0; i < 4; i++) {
                round(ctx, pad + i * 50, 30, 46, 20, 4); ctx.fillStyle = alpha(C.ink, 0.1); ctx.fill();
                text(ctx, num(x[i]), pad + i * 50 + 23, 44, { size: 11, mono: true, align: 'center', color: col || N === 1 ? C.ink : C.soft });
            }
            if (!col && N > 1 && !narrow) text(ctx, '（A 按行切时，每张卡只用 x 的 ' + 4 / N + ' 个分量）', pad + 210, 44, { size: 11, color: C.dim });
            var hx = L, ox = narrow ? L : L + 8 * cw + 40;
            S.cards.forEach(function (cd, k) {
                var y = top + k * (rowH + 8), tone = PAL[k];
                text(ctx, '卡 ' + (k + 1), L - 10, y + 15, { size: 11.5, weight: 600, align: 'right', color: tone });
                cd.hidden.forEach(function (v, m) {
                    var slot = col ? cd.idx[m] : m, cx = hx + slot * cw;
                    var on = phase > 1 + k * 0.15, act = phase > 2;
                    round(ctx, cx + 1, y + 2, cw - 2, 22, 4);
                    ctx.fillStyle = on ? alpha(tone, act ? 0.85 : 0.4) : alpha(C.faint, 0.6); ctx.fill();
                    if (on && cw > 28) text(ctx, num(v), cx + cw / 2, y + 17, { size: narrow ? 9.5 : 10.5, mono: true, align: 'center', color: act ? C.panel : C.ink });
                });
                if (col && N > 1) for (var e = 0; e < 8; e++) if (cd.idx.indexOf(e) < 0) { round(ctx, hx + e * cw + 1, y + 2, cw - 2, 22, 4); ctx.strokeStyle = alpha(C.faint, 0.8); ctx.lineWidth = 1; ctx.stroke(); }
                var py = narrow ? y + 32 : y + 2, onP = phase > 3 + k * 0.1;
                if (!narrow) text(ctx, '→', ox - 22, py + 16, { size: 13, color: C.dim });
                for (var c = 0; c < 4; c++) {
                    round(ctx, ox + c * ow + 1, py, ow - 4, 22, 4);
                    ctx.fillStyle = onP ? alpha(tone, 0.25) : alpha(C.faint, 0.5); ctx.fill();
                    if (onP) { ctx.strokeStyle = alpha(tone, 0.8); ctx.lineWidth = 1; ctx.stroke(); text(ctx, num(cd.part[c]), ox + c * ow + (ow - 4) / 2 + 1, py + 15, { size: 10.5, mono: true, align: 'center', color: C.ink }); }
                }
            });
            text(ctx, col || N === 1 ? '激活后的中间层（各卡只算自己那几列）' : '激活后的中间层（各卡算的是“部分和”的激活）', hx, top - 8, { size: 11, color: C.dim });
            if (!narrow) text(ctx, '这张卡对输出的贡献', ox, top - 8, { size: 11, color: C.dim });
            // all-reduce: the partial outputs travel down and add up
            if (phase > 4 && phase < 5 && !still && N > 1) {
                var f = phase - 4;
                S.cards.forEach(function (cd, k) {
                    var y0 = (narrow ? top + k * (rowH + 8) + 32 : top + k * (rowH + 8) + 2) + 11;
                    for (var c = 0; c < 4; c++) {
                        var px = ox + c * ow + ow / 2 - 2, yy = y0 + (sumY + 11 - y0) * f;
                        ctx.save(); ctx.shadowColor = PAL[k]; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(px, yy, 3, 0, Math.PI * 2); ctx.fillStyle = PAL[k]; ctx.fill(); ctx.restore();
                    }
                });
            }
            var rows = [['相加（all-reduce）', S.sum, phase > 5 || still], ['不切时的结果', S.ref, phase > 5 || still]];
            rows.forEach(function (row, rI) {
                var y = sumY + rI * rowGap;
                if (narrow) text(ctx, row[0], ox, y - 6, { size: 11.5, weight: 600, color: rI ? C.soft : C.peers });
                else text(ctx, row[0], ox - 10, y + 15, { size: 11.5, align: 'right', weight: 600, color: rI ? C.soft : C.peers });
                for (var c = 0; c < 4; c++) {
                    var ok = Math.abs(S.sum[c] - S.ref[c]) < 1e-9;
                    round(ctx, ox + c * ow + 1, y, ow - 4, 22, 4);
                    ctx.fillStyle = row[2] ? (rI ? alpha(C.ink, 0.12) : alpha(ok ? C.peers : C.alert, 0.3)) : alpha(C.faint, 0.5); ctx.fill();
                    if (row[2]) text(ctx, num(row[1][c]), ox + c * ow + (ow - 4) / 2 + 1, y + 15, { size: 10.5, mono: true, align: 'center', color: C.ink });
                }
            });
            if (phase > 5 || still) {
                var good = S.err < 1e-9;
                text(ctx, good ? '✓ 一模一样' : (narrow ? '✗ 对不上：激活作用在了部分和上' : '✗ 对不上：激活函数作用在了部分和上，加起来就不是原来的结果'), narrow ? L : ox - 260, sumY + 2 * rowGap + 10, { size: 12, weight: 600, color: good ? C.peers : C.alert });
            }
            p.set('comm', N === 1 ? '不需要' : col ? '1 次（最后相加）' : '激活前还要多一次', N === 1 || col ? 'peers' : 'alert');
            p.set('match', S.err < 1e-9 ? '完全一致' : '差 ' + S.err.toFixed(2), S.err < 1e-9 ? 'peers' : 'alert');
            p.set('store', N === 1 ? 'A、B 全部' : col ? 'A ' + 8 / N + ' 列 + B ' + 8 / N + ' 行' : 'A ' + 4 / N + ' 行 + 整个 B');
        };
        p.loop(tick);
    };

    /* ── 4.2 · Fusion ──────────────────────────────────────────────────────────────────────
     * Lesson: y = gelu(x·w + b) is 8n memory accesses as three kernels and 4n fused; a chain of k
     * operators saves 2(k−1)n. Element-wise work is bandwidth-bound, so time follows accesses. */
    registry.fusion = function (figure) {
        var p = new Panel(figure, { title: '算子融合：中间结果不落地', note: '逐元素运算受带宽限制，时间约和显存访问量成正比；动画的快慢就按访问量来', ratio: 0.5, minHeight: 320 });
        var OPS = [['×', 'w'], ['+', 'b'], ['gelu', ''], ['×', 's'], ['+', 'c'], ['tanh', '']], UNIT = 0.32, LAUNCH = 0.35;
        p.slider('k', '链上的算子个数', 1, 6, 1, 3, function (v) { return v + ' 个'; }, restart, 'compute');
        p.toggle('fused', [[false, '分开执行（每个算子一个 kernel）'], [true, '融合成一个 kernel']], false, restart);
        p.readout('sep', '分开：显存访问', 'alert');
        p.readout('fus', '融合：显存访问', 'peers');
        p.readout('kern', 'kernel 启动', 'launch');
        p.readout('tmp', '临时张量', 'ink');
        var clock = 0, plan;
        function restart() { clock = 0; plan = null; p.kick && p.kick(); }
        function formula(k) {
            var e = 'x', plus = false;
            for (var i = 0; i < k; i++) {
                var o = OPS[i];
                if (!o[1]) { e = o[0] + '(' + e + ')'; plus = false; }
                else if (o[0] === '×') { e = (plus ? '(' + e + ')' : e) + ' × ' + o[1]; plus = false; }
                else { e = e + ' + ' + o[1]; plus = true; }
            }
            return 'y = ' + e;
        }
        function counts(k) {
            var extra = 0; for (var i = 0; i < k; i++) if (OPS[i][1]) extra++;
            return { sep: (1 + extra + (k - 1)) + k, fus: 1 + extra + 1, extra: extra };   // reads + writes, in units of n
        }
        function build() {
            var k = p.values.k, fused = p.values.fused, tensors = [{ name: 'x', kind: 'in' }], ev = [], t = 0, i;
            for (i = 0; i < k; i++) if (OPS[i][1]) tensors.push({ name: OPS[i][1], kind: 'in' });
            if (!fused) for (i = 1; i < k; i++) tensors.push({ name: 't' + i, kind: 'tmp', made: i - 1 });
            tensors.push({ name: 'y', kind: 'out' });
            function idx(name) { for (var q = 0; q < tensors.length; q++) if (tensors[q].name === name) return q; }
            if (fused) {
                t += LAUNCH;
                var reads = ['x']; for (i = 0; i < k; i++) if (OPS[i][1]) reads.push(OPS[i][1]);
                reads.forEach(function (nm) { ev.push({ kind: 'read', tensor: idx(nm), kernel: 0, t0: t, t1: t + UNIT }); t += UNIT; });
                ev.push({ kind: 'write', tensor: idx('y'), kernel: 0, t0: t, t1: t + UNIT }); t += UNIT;
            } else {
                for (i = 0; i < k; i++) {
                    t += LAUNCH;
                    var src = i ? 't' + i : 'x', dst = i === k - 1 ? 'y' : 't' + (i + 1), rs = [src];
                    if (OPS[i][1]) rs.push(OPS[i][1]);
                    rs.forEach(function (nm) { ev.push({ kind: 'read', tensor: idx(nm), kernel: i, t0: t, t1: t + UNIT }); t += UNIT; });
                    ev.push({ kind: 'write', tensor: idx(dst), kernel: i, t0: t, t1: t + UNIT }); t += UNIT;
                }
            }
            var c = counts(k), sepT = k * LAUNCH + c.sep * UNIT;
            return { tensors: tensors, ev: ev, end: t, sepEnd: sepT, kernels: fused ? 1 : k };
        }
        function tick(dt) { if (!plan) plan = build(); clock += dt; if (clock > plan.end + 1.6) clock = 0; }
        p.draw = function () {
            if (!plan) plan = build();
            var w = p.w, narrow = w < 560, k = p.values.k, fused = p.values.fused, now = still ? 1e9 : clock;
            var pad = 16, memY = 58, kerY = narrow ? 150 : 164;
            p.fit(kerY + 62 + 2 * 24 + 18);
            var ctx = p.ctx;
            p.clear();
            var  bw = Math.min(64, (w - pad * 2) / plan.tensors.length - 10), gap = (w - pad * 2 - bw * plan.tensors.length) / Math.max(1, plan.tensors.length - 1);
            text(ctx, formula(k), pad, 24, { size: 13, mono: true, weight: 500, color: C.ink });
            text(ctx, '显存', w - pad, 24, { size: 11.5, align: 'right', color: C.data });
            ctx.fillStyle = alpha(C.data, 0.06); ctx.fillRect(0, memY - 14, w, 50);
            ctx.fillStyle = alpha(C.compute, 0.06); ctx.fillRect(0, kerY - 14, w, 62);
            text(ctx, '芯片上：寄存器', w - pad, kerY - 20, { size: 11.5, align: 'right', color: C.compute });
            var tx = function (q) { return pad + q * (bw + gap); };
            plan.tensors.forEach(function (tn, q) {
                var written = tn.kind === 'in' || plan.ev.some(function (e) { return e.kind === 'write' && e.tensor === q && now >= e.t1; });
                var col = tn.kind === 'in' ? C.data : tn.kind === 'tmp' ? C.alert : C.peers;
                round(ctx, tx(q), memY - 4, bw, 24, 5);
                ctx.fillStyle = written ? alpha(col, tn.kind === 'tmp' ? 0.35 : 0.8) : alpha(C.faint, 0.4); ctx.fill();
                if (tn.kind === 'tmp') { ctx.setLineDash([3, 3]); ctx.strokeStyle = alpha(C.alert, 0.8); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); }
                text(ctx, tn.name, tx(q) + bw / 2, memY + 12, { size: 12, mono: true, weight: 600, align: 'center', color: written ? (tn.kind === 'tmp' ? C.ink : C.panel) : C.dim });
            });
            var kw = fused ? Math.min(w - pad * 2, 320) : Math.min(90, (w - pad * 2) / k - 8), kgap = fused ? 0 : (w - pad * 2 - kw * k) / Math.max(1, k - 1);
            var kx = function (i) { return fused ? (w - kw) / 2 : pad + i * (kw + kgap); };
            for (var i = 0; i < plan.kernels; i++) {
                var active = plan.ev.some(function (e) { return e.kernel === i && now >= e.t0 && now < e.t1; });
                round(ctx, kx(i), kerY, kw, 34, 8);
                ctx.fillStyle = alpha(C.compute, active ? 0.4 : 0.14); ctx.fill();
                ctx.strokeStyle = alpha(C.compute, active ? 1 : 0.5); ctx.lineWidth = 1.2; ctx.stroke();
                var label = fused ? OPS.slice(0, k).map(function (o) { return o[1] ? o[0] + ' ' + o[1] : o[0]; }).join(' → ') : (OPS[i][1] ? OPS[i][0] + ' ' + OPS[i][1] : OPS[i][0]);
                text(ctx, label, kx(i) + kw / 2, kerY + 21, { size: fused && k > 4 && narrow ? 10 : 11.5, mono: true, align: 'center', color: C.ink });
            }
            // the bytes in flight
            plan.ev.forEach(function (e) {
                if (now < e.t0 || now >= e.t1) return;
                var f = (now - e.t0) / (e.t1 - e.t0), ax = tx(e.tensor) + bw / 2, ay = memY + 20, bx = kx(e.kernel) + kw / 2, by = kerY;
                if (e.kind === 'write') { var sx = ax, sy = ay; ax = bx; ay = by; bx = sx; by = sy; }
                ctx.strokeStyle = alpha(e.kind === 'read' ? C.data : C.peers, 0.35); ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
                for (var d = 0; d < 4; d++) {
                    var g = (f + d / 4) % 1, px = ax + (bx - ax) * g, py = ay + (by - ay) * g;
                    ctx.save(); if (!still) { ctx.shadowColor = C.data; ctx.shadowBlur = 8; }
                    ctx.beginPath(); ctx.arc(px, py, 2.6, 0, Math.PI * 2); ctx.fillStyle = e.kind === 'read' ? C.data : C.peers; ctx.fill(); ctx.restore();
                }
            });
            // a running count, and the two totals as bars on one time scale
            var done = 0; plan.ev.forEach(function (e) { if (now >= e.t1) done++; });
            var c = counts(k), by0 = kerY + 62, barL = narrow ? 60 : 96, barW = w - pad - barL - 86, sc = barW / plan.sepEnd;
            [['分开', k * LAUNCH + c.sep * UNIT, c.sep, C.alert, !fused], ['融合', LAUNCH + c.fus * UNIT, c.fus, C.peers, fused]].forEach(function (b, n) {
                var y = by0 + n * 24;
                text(ctx, b[0], barL - 10, y + 12, { size: 11.5, align: 'right', color: b[4] ? C.ink : C.dim });
                round(ctx, barL, y + 2, b[1] * sc, 12, 4); ctx.fillStyle = alpha(b[3], b[4] ? 0.9 : 0.3); ctx.fill();
                text(ctx, b[2] + 'n 次访问', barL + b[1] * sc + 8, y + 12, { size: 11, mono: true, color: b[4] ? C.ink : C.dim });
                if (b[4] && !still) { var cx = barL + Math.min(now, plan.end) * sc; ctx.fillStyle = C.ink; ctx.fillRect(cx - 1, y, 2, 16); }
            });
            p.set('sep', c.sep + 'n', 'alert');
            p.set('fus', c.fus + 'n（省掉 ' + (c.sep - c.fus) + 'n）', 'peers');
            p.set('kern', fused ? '1 次' : k + ' 次');
            p.set('tmp', fused ? '0 个' : (k - 1) + ' 个');
        };
        p.loop(tick);
    };

    /* ── 9.1 · PagedAttention ──────────────────────────────────────────────────────────────
     * The same stream of requests on both sides. Left: each request reserves room for the
     * longest possible answer in one contiguous stretch. Right: blocks of 16 tokens, taken one
     * at a time as a request grows, from anywhere; freed the moment it ends. When blocks run out,
     * the request that came in last steps aside and starts again later (as vLLM does). */
    registry['paged-attention'] = function (figure) {
        var p = new Panel(figure, { title: '按最大长度预留 vs 分页（PagedAttention）', note: '同一串请求喂给两边；一格是一个块，放 16 个 token；请求长度是示意', ratio: 0.55, minHeight: 330 });
        var BLOCKS = 96, PER = 16, MAXB = 16, COLS = 12, sims, acc, stats;
        p.button('重来', function () { reset(); }, 'ghost');
        p.readout('cc', '预留：平均同时在跑', 'alert');
        p.readout('pc', '分页：平均同时在跑', 'peers');
        p.readout('cu', '预留：显存平均用上', 'alert');
        p.readout('pu', '分页：显存平均用上', 'peers');
        function rng(seed) { return function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; }
        function lengthFrom(r) { return r() < 0.25 ? Math.round(160 + r() * (MAXB * PER - 160)) : Math.round(8 + r() * 140); }
        function reset() {
            var shuffle = rng(99), order = [];
            for (var b = 0; b < BLOCKS; b++) order.push(b);
            for (b = BLOCKS - 1; b > 0; b--) { var j = Math.floor(shuffle() * (b + 1)), t = order[b]; order[b] = order[j]; order[j] = t; }
            function make() {
                return [{ kind: 'contig', r: rng(5), act: [], next: 0, sumU: 0, sumC: 0, steps: 0 },
                        { kind: 'paged', r: rng(5), act: [], queue: [], free: order.slice(), next: 0, sumU: 0, sumC: 0, steps: 0 }];
            }
            sims = make(); acc = 0;
            for (var s = 0; s < 160; s++) sims.forEach(step);
            // the numbers below the grids come from a long run of the same stream, not from the few seconds on screen
            var long = make();
            for (s = 0; s < 6000; s++) long.forEach(step);
            long.forEach(function (x) { x.sumU = x.sumC = x.steps = 0; });
            for (s = 0; s < 6000; s++) long.forEach(step);
            stats = long;
            p.kick && p.kick();
        }
        function step(s) {
            var used = 0;
            if (s.kind === 'contig') {
                for (var slot = 0; slot < BLOCKS / MAXB; slot++) if (!s.act.some(function (q) { return q.slot === slot; })) s.act.push({ id: s.next++, len: lengthFrom(s.r), n: 0, slot: slot });
                s.act.forEach(function (q) { q.n++; used += q.n; });
                s.act = s.act.filter(function (q) { return q.n < q.len; });
            } else {
                while (s.free.length > s.act.length + 1) {
                    var q0 = s.queue.length ? s.queue.shift() : { id: s.next++, len: lengthFrom(s.r) };
                    s.act.push({ id: q0.id, len: q0.len, n: 0, blocks: [s.free.shift()] });
                }
                for (var i = 0; i < s.act.length; i++) {
                    var q = s.act[i];
                    if (q.n === q.blocks.length * PER) {
                        if (!s.free.length) { var v = s.act.pop(); s.free = s.free.concat(v.blocks); s.queue.unshift({ id: v.id, len: v.len }); if (v === q) break; }
                        if (!s.free.length) continue;
                        q.blocks.push(s.free.shift());
                    }
                    q.n++;
                }
                s.act.forEach(function (q) { used += q.n; });
                s.act = s.act.filter(function (q) { if (q.n >= q.len) { s.free = s.free.concat(q.blocks); return false; } return true; });
            }
            s.sumU += used / (BLOCKS * PER); s.sumC += s.act.length; s.steps++;
        }
        reset();
        function tick(dt) { acc += dt * 14; while (acc >= 1) { acc -= 1; sims.forEach(step); } }
        var PAL = [C.compute, C.peers, C.data, C.launch, '#FF9F7A', '#7FD3FF'];
        p.draw = function () {
            var ctx = p.ctx, w = p.w, narrow = w < 600, pad = 14, side = narrow ? w - pad * 2 : (w - pad * 3) / 2, cell = side / COLS, gridH = cell * (BLOCKS / COLS);
            p.fit(narrow ? 2 * (gridH + 40) + 40 : gridH + 74);
            ctx = p.ctx; var h = p.h;
            p.clear();
            sims.forEach(function (s, n) {
                var ox = narrow ? pad : pad + n * (side + pad), oy = narrow ? 30 + n * (gridH + 40) : 30, owner = {}, fill = {};
                text(ctx, n ? '分页：用到哪块拿哪块' : '预留：每个请求先占 256 个 token 的位置', ox, oy - 10, { size: 12, weight: 600, color: n ? C.peers : C.alert });
                s.act.forEach(function (q) {
                    if (s.kind === 'contig') for (var b = 0; b < MAXB; b++) { owner[q.slot * MAXB + b] = q.id; fill[q.slot * MAXB + b] = Math.max(0, Math.min(1, (q.n - b * PER) / PER)); }
                    else q.blocks.forEach(function (bk, m) { owner[bk] = q.id; fill[bk] = Math.max(0, Math.min(1, (q.n - m * PER) / PER)); });
                });
                for (var b = 0; b < BLOCKS; b++) {
                    var cx = ox + (b % COLS) * cell, cy = oy + Math.floor(b / COLS) * cell, id = owner[b];
                    round(ctx, cx + 1.5, cy + 1.5, cell - 3, cell - 3, 4);
                    if (id == null) { ctx.fillStyle = alpha(C.faint, 0.45); ctx.fill(); continue; }
                    var tone = PAL[id % PAL.length], f = fill[b];
                    ctx.fillStyle = alpha(tone, 0.12); ctx.fill();
                    ctx.strokeStyle = alpha(tone, 0.55); ctx.lineWidth = 1; ctx.stroke();
                    if (f > 0) { ctx.save(); ctx.beginPath(); ctx.rect(cx + 1.5, cy + 1.5 + (cell - 3) * (1 - f), cell - 3, (cell - 3) * f); ctx.clip(); round(ctx, cx + 1.5, cy + 1.5, cell - 3, cell - 3, 4); ctx.fillStyle = alpha(tone, 0.9); ctx.fill(); ctx.restore(); }
                }
            });
            var ly = h - 12;
            ctx.fillStyle = alpha(C.compute, 0.9); ctx.fillRect(pad, ly - 9, 10, 10);
            text(ctx, '实心：已经写进去的 token', pad + 15, ly, { size: 11, color: C.soft });
            ctx.strokeStyle = alpha(C.compute, 0.6); ctx.strokeRect(pad + 190.5, ly - 8.5, 9, 9);
            text(ctx, '空心：占着但没用上', pad + 205, ly, { size: 11, color: C.soft });
            p.set('cc', fmt(stats[0].sumC / stats[0].steps, 1) + ' 个');
            p.set('pc', fmt(stats[1].sumC / stats[1].steps, 1) + ' 个');
            p.set('cu', fmt(stats[0].sumU / stats[0].steps * 100) + '%');
            p.set('pu', fmt(stats[1].sumU / stats[1].steps * 100) + '%');
        };
        p.loop(tick);
    };

    /* ── 1.5 · Floating-point formats ──────────────────────────────────────────────────────
     * fp32 (8 exponent bits, 23 mantissa), bf16 (8, 7) and fp16 (5, 10), converted bit by bit
     * with round-to-nearest-even. Second view: 1 + a small update, the reason the lesson keeps
     * master weights in 32 bits. */
    function f32bits(v) { var b = new DataView(new ArrayBuffer(4)); b.setFloat32(0, v); return b.getUint32(0); }
    function bitsF32(u) { var b = new DataView(new ArrayBuffer(4)); b.setUint32(0, u >>> 0); return b.getFloat32(0); }
    function toBf16(v) {
        var u = f32bits(v);
        if ((u & 0x7f800000) === 0x7f800000 && (u & 0x7fffff)) return 0x7fc0;
        return ((u + 0x7fff + ((u >>> 16) & 1)) >>> 16) & 0xffff;
    }
    function fromBf16(b) { return bitsF32(b << 16); }
    function toF16(v) {
        var s = v < 0 || (v === 0 && 1 / v < 0) ? 0x8000 : 0, a = Math.abs(v);
        if (isNaN(v)) return 0x7e00;
        if (a === 0) return s;
        if (a >= 65520) return s | 0x7c00;                          // rounds past the largest finite value, 65504
        var e = Math.floor(Math.log2(a));
        if (a / Math.pow(2, e) >= 2) e++; else if (a / Math.pow(2, e) < 1) e--;
        function rne(x) { var f = Math.floor(x), d = x - f; return d > 0.5 || (d === 0.5 && f % 2) ? f + 1 : f; }
        if (e < -14) { var m = rne(a / Math.pow(2, -24)); return s | m; }   // subnormal (m may reach 1024, the smallest normal)
        var mant = rne((a / Math.pow(2, e) - 1) * 1024);
        if (mant === 1024) { mant = 0; e++; }
        if (e > 15) return s | 0x7c00;
        return s | ((e + 15) << 10) | mant;
    }
    function fromF16(b) {
        var s = b & 0x8000 ? -1 : 1, e = (b >> 10) & 31, m = b & 1023;
        if (e === 31) return m ? NaN : s * Infinity;
        if (e === 0) return s * m * Math.pow(2, -24);
        return s * (1 + m / 1024) * Math.pow(2, e - 15);
    }
    registry['float-formats'] = function (figure) {
        var p = new Panel(figure, { title: '一个数在三种格式里怎么存', note: '每一位都是真的：按 IEEE 的规则、就近舍入算出来的', ratio: 0.5, minHeight: 320 });
        var PRESETS = [[0.1, '0.1'], [1 / 3, '1/3'], [3.14159265, 'π'], [65504, '65504'], [70000, '70000'], [1e-5, '0.00001'], [1e-8, '10⁻⁸']];
        p.toggle('mode', [['store', '看一个数怎么存'], ['update', '1 加上一个很小的更新']], 'store');
        p.toggle('x', PRESETS.map(function (q, i) { return [i, q[1]]; }), 0);
        p.slider('u', '更新量（参数 1.0 加上它）', -9, -1, 0.05, -4, function (v) { return Math.pow(10, v).toExponential(1).replace('e-', '×10⁻').replace(/⁻(\d)/, function (m, d) { return '⁻' + '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]; }); }, null, 'launch');
        p.readout('a', 'fp32', 'ink');
        p.readout('b', 'bf16', 'data');
        p.readout('c', 'fp16', 'compute');
        var FMT = [['fp32', 8, 23], ['bf16', 8, 7], ['fp16', 5, 10]];
        function encode(v) {
            var u32 = f32bits(v), b16 = toBf16(v), h16 = toF16(v);
            return [{ bits: u32, n: 32, back: bitsF32(u32) }, { bits: b16, n: 16, back: fromBf16(b16) }, { bits: h16, n: 16, back: fromF16(h16) }];
        }
        function show(v) {
            if (!isFinite(v)) return v > 0 ? '∞（溢出）' : '−∞';
            if (v === 0) return '0（太小，变成了 0）';
            var s = Math.abs(v) >= 1e5 || Math.abs(v) < 1e-4 ? v.toExponential(6) : v.toPrecision(10);
            return s.replace(/(\.\d*?)0+($|e)/, '$1$2').replace(/\.($|e)/, '$1');
        }
        var swap = el('div', 'demo-swap'), kids = p.controls.children, presets = kids[1], upSlider = kids[2];
        swap.appendChild(presets); swap.appendChild(upSlider); p.controls.appendChild(swap);
        p.draw = function () {
            var ctx = p.ctx, w = p.w, narrow = w < 560, upd = p.values.mode === 'update', pad = 14;
            presets.classList.toggle('off', upd); upSlider.classList.toggle('off', !upd);
            presets.setAttribute('aria-hidden', upd ? 'true' : 'false'); upSlider.setAttribute('aria-hidden', upd ? 'false' : 'true');
            var v = upd ? 1 + Math.pow(10, p.values.u) : PRESETS[p.values.x][0], E = encode(v);
            var labelW = narrow ? 44 : 56, cw = Math.min(18, (w - pad * 2 - labelW) / 32), rowH = narrow ? 62 : 58, top = 40;
            p.fit(top + 3 * rowH + 26);
            ctx = p.ctx;
            p.clear();
            text(ctx, upd ? '1 + ' + Math.pow(10, p.values.u).toExponential(2) + '  （真值 ' + v.toPrecision(12) + '）' : '要存的数：' + PRESETS[p.values.x][1] + (p.values.x === 1 ? '（0.3333…）' : ''), pad, 24, { size: 13, mono: true, color: C.ink });
            FMT.forEach(function (f, r) {
                var y = top + r * rowH, enc = E[r], tone = [C.ink, C.data, C.compute][r];
                text(ctx, f[0], pad, y + 15, { size: 12, mono: true, weight: 600, color: tone });
                for (var i = 0; i < enc.n; i++) {
                    var bit = (enc.bits >>> (enc.n - 1 - i)) & 1, part = i === 0 ? C.alert : i <= f[1] ? C.data : C.compute;
                    var x = pad + labelW + i * cw;
                    round(ctx, x + 0.5, y + 2, cw - 1.5, 18, 3);
                    ctx.fillStyle = alpha(part, bit ? 0.9 : 0.16); ctx.fill();
                    if (cw >= 12) text(ctx, String(bit), x + cw / 2, y + 15, { size: 10, mono: true, align: 'center', color: bit ? C.panel : alpha(part, 0.8) });
                }
                var back = enc.back, rel = upd ? null : Math.abs(back - v) / Math.abs(v);
                var line = upd ? (back === 1 ? '存下来还是 1：这次更新被舍入掉了' : '存下来 ' + show(back) + '，更新保住了 ' + fmt((back - 1) / Math.pow(10, p.values.u) * 100) + '%')
                               : '存下来是 ' + show(back) + (isFinite(back) && back !== 0 ? '，相对误差 ' + (rel === 0 ? '0' : rel.toExponential(1)) : '');
                text(ctx, line, pad + labelW, y + 38, { size: 11.5, color: upd && back === 1 ? C.alert : C.soft });
            });
            var ly = top + 3 * rowH + 12;
            [[C.alert, '符号'], [C.data, narrow ? '指数（范围）' : '指数：管范围'], [C.compute, narrow ? '有效数字（精度）' : '有效数字：管精度']].forEach(function (lg, n) {
                var x = pad + (narrow ? 0 : labelW) + n * (narrow ? [0, 54, 150][n] / Math.max(1, n) : 120);
                ctx.fillStyle = lg[0]; ctx.fillRect(x, ly - 9, 10, 10);
                text(ctx, lg[1], x + 15, ly, { size: 11, color: C.soft });
            });
            function cell(enc) {
                var back = enc.back;
                if (upd) return back === 1 ? '更新丢了' : '更新保住了';
                if (!isFinite(back)) return '溢出';
                if (back === 0) return '变成 0';
                var rel = Math.abs(back - v) / Math.abs(v);
                return rel === 0 ? '精确' : '误差 ' + rel.toExponential(1);
            }
            p.set('a', cell(E[0]), upd && E[0].back === 1 ? 'alert' : 'ink');
            p.set('b', cell(E[1]), (upd && E[1].back === 1) || !isFinite(E[1].back) || E[1].back === 0 ? 'alert' : 'data');
            p.set('c', cell(E[2]), (upd && E[2].back === 1) || !isFinite(E[2].back) || E[2].back === 0 ? 'alert' : 'compute');
        };
        p.draw();
    };

    /* ── 7.4 · How often to checkpoint ─────────────────────────────────────────────────────
     * Lesson: waste = c/T + T/(2M), least at T = √(2cM), where it is about √(2c/M).
     * c = 1 min, M = 4 h → about 22 min and 9%. The strip below replays a run with random
     * failures (mean gap M) and measures the waste for the interval you chose. */
    registry['checkpoint-interval'] = function (figure) {
        var p = new Panel(figure, { title: '多久存一次检查点', note: '曲线是讲解里的公式；下面的色带是一次带随机故障的模拟', ratio: 0.55, minHeight: 360 });
        function cOf(v) { return Math.pow(10, v); }                                  // seconds
        p.slider('c', '存一次要多久', 1, 3, 0.02, Math.log10(60), function (v) { var s = cOf(v); return s < 90 ? fmt(s) + ' 秒' : fmt(s / 60, 1) + ' 分钟'; }, null, 'launch');
        p.slider('M', '平均多久出一次故障', 1, 100, 1, 4, function (v) { return v + ' 小时'; }, null, 'alert');
        var Tin = p.slider('T', '你选的间隔', 0, 2.78, 0.01, Math.log10(22), function (v) { var m = Math.pow(10, v); return m < 90 ? fmt(m) + ' 分钟' : fmt(m / 60, 1) + ' 小时'; }, null, 'peers');
        p.button('用最优间隔', function () { Tin.value = Math.log10(Math.sqrt(2 * cOf(p.values.c) / 60 * p.values.M * 60)); Tin.dispatchEvent(new Event('input')); }, 'ghost');
        p.readout('opt', '最优间隔 √(2cM)', 'peers');
        p.readout('waste', '你选的间隔：浪费', 'ink');
        p.readout('best', '最优时浪费 √(2c/M)', 'peers');
        p.readout('sim', '模拟测得', 'ink');
        function simulate(cMin, Mmin, T, horizon, seed, keep) {
            var r = seed, now = 0, sinceSave = 0, lost = 0, ckpt = 0, segs = [], mark = 0, nextFail;
            function gapToFailure() { r = (r * 1103515245 + 12345) % 2147483648; return -Math.log(1 - r / 2147483648) * Mmin; }
            function push(kind, a, b) { if (keep) segs.push([kind, a, b]); }
            function fail() {                                                   // the work since the last finished checkpoint is gone
                if (keep) for (var q = mark; q < segs.length; q++) if (segs[q][0] === 'work') segs[q][0] = 'lost';
                lost += sinceSave; sinceSave = 0; push('fail', now, now); mark = segs.length; nextFail = now + gapToFailure();
            }
            nextFail = gapToFailure();
            while (now < horizon) {
                var need = T - sinceSave;
                if (now + need > nextFail) { push('work', now, nextFail); sinceSave += nextFail - now; now = nextFail; fail(); continue; }
                push('work', now, now + need); now += need; sinceSave += need;
                if (now + cMin > nextFail) { push('ckpt', now, nextFail); ckpt += nextFail - now; now = nextFail; fail(); continue; }
                push('ckpt', now, now + cMin); ckpt += cMin; now += cMin; sinceSave = 0; mark = segs.length;
            }
            return { segs: segs, waste: (lost + ckpt) / now };
        }
        p.draw = function () {
            var ctx = p.ctx, w = p.w, narrow = w < 560, h;
            var cMin = cOf(p.values.c) / 60, Mmin = p.values.M * 60, T = Math.pow(10, p.values.T), Topt = Math.sqrt(2 * cMin * Mmin);
            var L = narrow ? 44 : 56, R = w - 16, top = 26, plotH = narrow ? 150 : 170, B = top + plotH, stripY = B + 74;
            p.fit(stripY + 56);
            ctx = p.ctx; h = p.h;
            p.clear();
            var X = logScale(1, 600, L, R), maxW = 0.6, Y = function (f) { return B - Math.min(f, maxW) / maxW * plotH; };
            ctx.strokeStyle = C.faint; ctx.lineWidth = 1;
            [[1, '1 分'], [10, '10 分'], [60, '1 时'], [600, '10 时']].forEach(function (g) { ctx.beginPath(); ctx.moveTo(X(g[0]), top); ctx.lineTo(X(g[0]), B); ctx.stroke(); text(ctx, g[1], X(g[0]), B + 16, { size: 10.5, align: 'center', color: C.dim }); });
            [0, 0.2, 0.4, 0.6].forEach(function (f) { ctx.beginPath(); ctx.moveTo(L, Y(f)); ctx.lineTo(R, Y(f)); ctx.stroke(); text(ctx, fmt(f * 100) + '%', L - 6, Y(f) + 4, { size: 10.5, mono: true, align: 'right', color: C.dim }); });
            if (!narrow) text(ctx, '间隔 T（对数）', R, B + 34, { size: 10.5, align: 'right', color: C.dim });
            function curve(fn, col, dash, width) {
                ctx.setLineDash(dash); ctx.strokeStyle = col; ctx.lineWidth = width; ctx.beginPath();
                for (var i = 0; i <= 120; i++) { var t = Math.pow(10, i / 120 * Math.log10(600)), y = Y(fn(t)); if (i) ctx.lineTo(X(t), y); else ctx.moveTo(X(t), y); }
                ctx.stroke(); ctx.setLineDash([]);
            }
            ctx.save(); ctx.beginPath(); ctx.rect(L, top, R - L, plotH); ctx.clip();
            curve(function (t) { return cMin / t; }, alpha(C.launch, 0.85), [4, 4], 1.4);
            curve(function (t) { return t / (2 * Mmin); }, alpha(C.alert, 0.85), [4, 4], 1.4);
            ctx.save(); if (!still) { ctx.shadowColor = alpha(C.ink, 0.5); ctx.shadowBlur = 8; }
            curve(function (t) { return cMin / t + t / (2 * Mmin); }, C.ink, [], 2.2); ctx.restore();
            ctx.restore();
            [[C.launch, narrow ? 'c/T' : '存档开销 c/T', true], [C.alert, narrow ? 'T/(2M)' : '故障损失 T/(2M)', true], [C.ink, narrow ? '之和' : '两项之和', false]].forEach(function (lg, n) {
                var lx = L + n * (narrow ? 84 : 124), ly = B + 34;
                ctx.strokeStyle = lg[0]; ctx.lineWidth = 2; ctx.setLineDash(lg[2] ? [4, 3] : []);
                ctx.beginPath(); ctx.moveTo(lx, ly - 4); ctx.lineTo(lx + 16, ly - 4); ctx.stroke(); ctx.setLineDash([]);
                text(ctx, lg[1], lx + 21, ly, { size: 11, color: C.soft });
            });
            var wOpt = cMin / Topt + Topt / (2 * Mmin), wT = cMin / T + T / (2 * Mmin);
            if (Topt >= 1 && Topt <= 600) { ctx.beginPath(); ctx.arc(X(Topt), Y(wOpt), 4, 0, Math.PI * 2); ctx.fillStyle = C.peers; ctx.fill(); text(ctx, '最优', X(Topt), Y(wOpt) + 18, { size: 11, align: 'center', color: C.peers }); }
            ctx.save(); if (!still) { ctx.shadowColor = C.peers; ctx.shadowBlur = 14; }
            ctx.beginPath(); ctx.arc(X(T), Y(wT), 7, 0, Math.PI * 2); ctx.fillStyle = C.ink; ctx.fill(); ctx.restore();
            // a replay: the first 3M of a run, and the waste measured over a long one
            var horizon = 3 * Mmin, run = simulate(cMin, Mmin, T, horizon, 4242, true), long = simulate(cMin, Mmin, T, Math.min(400 * Mmin, 150000 * T), 777, false);
            text(ctx, '模拟前 ' + fmt(horizon / 60) + ' 小时：', L, stripY - 12, { size: 11.5, color: C.soft });
            var SX = function (t) { return L + t / horizon * (R - L); };
            run.segs.forEach(function (s) {
                if (s[1] >= horizon) return;
                var x0 = SX(s[1]), x1 = SX(Math.min(s[2], horizon));
                if (s[0] === 'fail') { ctx.fillStyle = C.alert; ctx.fillRect(x0 - 1, stripY - 4, 2, 30); return; }
                ctx.fillStyle = s[0] === 'work' ? alpha(C.peers, 0.8) : s[0] === 'ckpt' ? C.launch : alpha(C.alert, 0.55);
                ctx.fillRect(x0, stripY, Math.max(0.8, x1 - x0), 22);
            });
            legend(ctx, [[alpha(C.peers, 0.8), '有用的训练'], [C.launch, '存档'], [alpha(C.alert, 0.55), '故障白算的'], [C.alert, '故障']], L, stripY + 44, narrow ? 78 : 110);
            p.set('opt', Topt < 90 ? fmt(Topt) + ' 分钟' : fmt(Topt / 60, 1) + ' 小时');
            p.set('waste', fmt(wT * 100, 1) + '%', wT > wOpt * 1.15 ? 'alert' : 'peers');
            p.set('best', fmt(Math.sqrt(2 * cMin / Mmin) * 100, 1) + '%');
            p.set('sim', fmt(long.waste * 100, 1) + '%');
        };
        p.draw();
    };

    /* ── 9.2 · Quantization as a coarser ruler ─────────────────────────────────────────────
     * Lesson: the range [−m, m] split into 255 steps (int8) or 15 (int4); every value moves to the
     * nearest mark. 999 values in ±0.1 and one at 5.0: one ruler for all puts a step at about 0.04
     * and squeezes the 999 into five or six marks. Groups of 128 give each group its own ruler. */
    registry['quant-ruler'] = function (figure) {
        var p = new Panel(figure, { title: '量化：换一把刻度更粗的尺子', note: '1000 个数：999 个在 ±0.1 之间，外加一个 5.0', ratio: 0.5, minHeight: 320 });
        p.toggle('bits', [[8, '8 位（255 格）'], [4, '4 位（15 格）']], 8);
        p.toggle('outlier', [[true, '有那个 5.0'], [false, '没有']], true);
        p.toggle('group', [[false, '整个矩阵一把尺子'], [true, '每 128 个一组']], false);
        p.readout('step', '一格多宽', 'ink');
        p.readout('levels', '999 个数落进了几格', 'data');
        p.readout('err', '平均误差', 'ink');
        p.readout('extra', '额外存储（缩放因子）', 'ink');
        var vals = [], seed = 21;
        function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
        for (var i = 0; i < 1000; i++) { var g = (rnd() + rnd() + rnd() - 1.5) / 1.5; vals.push(Math.round(g * 0.1 * 1e4) / 1e4); }
        var OUT = 500;
        function quantize() {
            var bits = p.values.bits, steps = Math.pow(2, bits) - 1, data = vals.slice();
            data[OUT] = p.values.outlier ? 5.0 : vals[OUT];
            var size = p.values.group ? 128 : data.length, q = new Array(data.length), scales = [];
            for (var s = 0; s < data.length; s += size) {
                var m = 0, e = Math.min(data.length, s + size), k;
                for (k = s; k < e; k++) m = Math.max(m, Math.abs(data[k]));
                var scale = 2 * m / steps;
                scales.push({ from: s, to: e, m: m, scale: scale });
                for (k = s; k < e; k++) q[k] = Math.round((data[k] + m) / scale) * scale - m;
            }
            return { data: data, q: q, scales: scales };
        }
        p.draw = function () {
            var ctx = p.ctx, w = p.w, h = p.h, narrow = w < 560, Q = quantize(), pad = 18;
            p.clear();
            var view = 0.13, X = function (v) { return pad + (v + view) / (2 * view) * (w - pad * 2); }, lineY = h * 0.52;
            var sc = Q.scales.filter(function (s) { return !(OUT >= s.from && OUT < s.to); })[0] || Q.scales[0];
            if (!p.values.group) sc = Q.scales[0];
            ctx.strokeStyle = C.dim; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, lineY); ctx.lineTo(w - pad, lineY); ctx.stroke();
            // the ruler's marks inside the view
            var marks = 0;
            for (var k = 0; k <= Math.pow(2, p.values.bits) - 1; k++) {
                var mv = k * sc.scale - sc.m;
                if (mv < -view || mv > view) continue;
                marks++;
                ctx.strokeStyle = alpha(C.data, 0.9); ctx.lineWidth = 1.4;
                ctx.beginPath(); ctx.moveTo(X(mv), lineY - 8); ctx.lineTo(X(mv), lineY + 8); ctx.stroke();
            }
            [-0.1, -0.05, 0, 0.05, 0.1].forEach(function (v) { text(ctx, (v > 0 ? '+' : '') + v, X(v), h - 14, { size: 10.5, mono: true, align: 'center', color: C.dim }); });
            if (p.values.outlier) text(ctx, narrow ? (p.values.group ? '5.0 只拖累它那一组 →' : '5.0 在远处，撑长了尺子 →') : p.values.group ? '那个 5.0 只拖累它自己那一组（128 个数）→' : '那个 5.0 在右边很远的地方，尺子被它撑长了 →', w - pad, 22, { size: 11.5, align: 'right', color: C.alert });
            text(ctx, '原来的值', pad, 22, { size: 11.5, color: C.soft });
            text(ctx, '挪到最近的刻度以后', pad, h - 34, { size: 11.5, color: C.soft });
            // a sample of the 999, before and after
            var levelSet = {}, errSum = 0, n = 0;
            for (var t = 0; t < 1000; t++) {
                if (t === OUT && p.values.outlier) continue;
                levelSet[Q.q[t].toFixed(9)] = 1; errSum += Math.abs(Q.q[t] - Q.data[t]); n++;
                if (t % 11) continue;
                var x0 = X(Q.data[t]), x1 = X(Math.max(-view, Math.min(view, Q.q[t]))), y0 = 34 + (t * 7 % 60), y1 = lineY + 20 + (t * 13 % 40);
                ctx.strokeStyle = alpha(C.compute, 0.25); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, lineY); ctx.stroke();
                ctx.beginPath(); ctx.arc(x0, y0, 2.6, 0, Math.PI * 2); ctx.fillStyle = C.compute; ctx.fill();
                ctx.beginPath(); ctx.arc(x1, y1, 2.6, 0, Math.PI * 2); ctx.fillStyle = C.data; ctx.fill();
                ctx.strokeStyle = alpha(C.data, 0.2); ctx.beginPath(); ctx.moveTo(x1, lineY); ctx.lineTo(x1, y1); ctx.stroke();
            }
            var levels = Object.keys(levelSet).length;
            p.set('step', sc.scale.toPrecision(2));
            p.set('levels', levels + ' 格', levels < 20 ? 'alert' : 'data');
            p.set('err', (errSum / n).toPrecision(2));
            p.set('extra', p.values.group ? '每个数 +0.125 位' : '几乎为 0');
        };
        p.draw();
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
