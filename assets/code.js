/* Code blocks in the lessons, coloured by what each token is.
 *
 * The lessons' code blocks carry no language tag, so the language is guessed from the text:
 * YAML (Kubernetes manifests), shell (commands and environment variables), C/CUDA, otherwise
 * Python. Colours follow the course: calls in compute blue, strings and numbers in data amber,
 * keywords and comments in the handwritten italic of Victor Mono.
 */
(function () {
    'use strict';

    var PY_KW = 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield None True False self'.split(' ');
    var C_KW = 'auto break case char const continue default do double else enum extern float for goto if inline int long register return short signed sizeof static struct switch typedef union unsigned void volatile while bool true false nullptr template typename class public private namespace using new delete __global__ __device__ __host__ __shared__ __syncthreads dim3 size_t'.split(' ');
    var SH_KW = 'if then else fi for do done while in case esac export sudo cd echo'.split(' ');

    function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function span(cls, s) { return '<span class="tk-' + cls + '">' + esc(s) + '</span>'; }

    function guess(src) {
        if (/^\s*(apiVersion|kind|metadata|spec|resources|containers)\s*:/m.test(src)) return 'yaml';
        if (/__global__|<<<|#include|\bint\s+main\b|;\s*$/m.test(src) && !/^\s*(def|import|from)\s/m.test(src)) return 'c';
        if (/^\s*(\$ |nvidia-smi|torchrun|kubectl|export |NCCL_|CUDA_|python3? |pip |nsys |ncu |ibv_|numactl|lspci|helm |docker )/m.test(src)) return 'shell';
        return 'python';
    }

    // One pass with a sticky regex per language; anything not matched is kept as plain text.
    var RULES = {
        python: [
            ['comment', /#[^\n]*/y],
            ['string', /[rbfRBF]{0,2}("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/y],
            ['deco', /@[A-Za-z_][\w.]*/y],
            ['number', /\b(?:0x[\da-fA-F]+|\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?)\b/y],
            ['word', /[A-Za-z_]\w*/y]
        ],
        c: [
            ['comment', /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
            ['string', /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/y],
            ['deco', /#\s*\w+/y],
            ['number', /\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?f?)\b/y],
            ['word', /[A-Za-z_]\w*/y]
        ],
        shell: [
            ['comment', /#[^\n]*/y],
            ['string', /"(?:\\.|[^"\\])*"|'[^']*'/y],
            ['var', /\$\{?\w+\}?|\b[A-Z][A-Z0-9_]*(?==)/y],
            ['flag', /(?:^|(?<=\s))--?[\w-]+/y],
            ['number', /\b\d+(?:\.\d+)?\b/y],
            ['word', /[A-Za-z_][\w.-]*/y]
        ],
        yaml: [
            ['comment', /#[^\n]*/y],
            ['key', /[\w.\/-]+(?=\s*:(?:\s|$))/y],
            ['string', /"(?:\\.|[^"\\\n])*"|'[^'\n]*'/y],
            ['number', /\b\d+(?:\.\d+)?\b/y],
            ['word', /[A-Za-z_][\w.-]*/y]
        ]
    };

    function highlight(src, lang) {
        var rules = RULES[lang], out = '', i = 0, plain = '', lineStart = true;
        function flush() { if (plain) { out += esc(plain); plain = ''; } }
        while (i < src.length) {
            var hit = null;
            for (var r = 0; r < rules.length && !hit; r++) {
                var re = rules[r][1];
                re.lastIndex = i;
                var m = re.exec(src);
                if (m && m.index === i && m[0].length) hit = [rules[r][0], m[0]];
            }
            if (!hit) { plain += src[i]; lineStart = src[i] === '\n' || (lineStart && /\s/.test(src[i])); i++; continue; }
            flush();
            var kind = hit[0], word = hit[1];
            if (kind === 'word') {
                var after = src.slice(i + word.length).match(/^\s*(\(|:)/);
                if (lang === 'python' && PY_KW.indexOf(word) >= 0) kind = 'kw';
                else if (lang === 'c' && C_KW.indexOf(word) >= 0) kind = 'kw';
                else if (lang === 'shell' && (SH_KW.indexOf(word) >= 0 || lineStart)) kind = lineStart ? 'cmd' : 'kw';
                else if (lang === 'yaml' && /^(true|false|null)$/.test(word)) kind = 'kw';
                else if (after && after[1] === '(' && lang !== 'yaml') kind = 'call';
                else if (lang !== 'shell' && src[i - 1] === '.') kind = 'attr';
                else kind = null;
            }
            out += kind ? span(kind, word) : esc(word);
            lineStart = false;
            i += word.length;
        }
        flush();
        return out;
    }

    function run(root) {
        (root || document).querySelectorAll('.essence pre').forEach(function (pre) {
            if (pre.dataset.lang) return;
            if (pre.querySelector('span, a, mark, strong')) return;          // something already marked it up
            var code = pre.querySelector('code') || pre, src = code.textContent, lang = guess(src);
            try { code.innerHTML = highlight(src, lang); pre.dataset.lang = lang; pre.classList.add('lang-' + lang); }
            catch (e) { if (window.console) console.error('highlight', e); }
        });
    }
    window.CourseCode = { highlight: highlight, guess: guess, run: run };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { run(); });
    else run();
})();
