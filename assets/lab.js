/* ═══════════════════════════════════════════════════════════════════════════
   The live parts of the résumé: the GTM / teardown engine and the persona chat.

   Nothing here holds a key. Every call goes to the Worker (see /worker), which
   is the only place the model and voice credentials exist.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
  /* On localhost the Worker runs beside the page (`wrangler dev`). In
     production the URL comes from <meta name="portfolio-api">, which stays
     empty until the Worker is deployed — and then the live parts say so
     instead of failing. */
  const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
  const API = (document.querySelector('meta[name="portfolio-api"]')?.content || '').replace(/\/$/, '')
    || (LOCAL ? 'http://127.0.0.1:8787' : '');

  const $ = (s, r = document) => r.querySelector(s);

  /* ── streamed POST: yields text as it arrives ──────────────────────────── */
  async function streamPost(path, body, onText) {
    const res = await fetch(API + path, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || 'That did not work. Try again in a moment.');
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let all = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      all += dec.decode(value, { stream: true });
      onText(all);
    }
    return all;
  }

  /* ── a small, safe Markdown renderer ───────────────────────────────────
     Model output is untrusted, so everything is HTML-escaped first and only
     a fixed set of tags is ever produced. */
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  /* "Area | 1-5 | evidence" lines -> a visual scorecard */
  function scorecard(lines) {
    const rows = lines.map((l) => l.split('|').map((c) => c.trim())).filter((r) => r.length >= 2 && r[0]);
    if (!rows.length) return '';
    const nums = rows.map((r) => parseInt(r[1], 10)).filter((n) => n >= 1 && n <= 5);
    const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
    const band = (n) => (n >= 4 ? 'good' : n === 3 ? 'mid' : 'low');
    return '<div class="sc"><div class="sc-total" data-b="' + band(Math.round(avg)) + '"><b>' + (avg ? avg.toFixed(1) : '–')
      + '</b><span>/ 5</span><small>Website score</small></div><div class="sc-rows">'
      + rows.map((r) => {
        const n = parseInt(r[1], 10);
        const ok = n >= 1 && n <= 5;
        return '<div class="sc-row" data-b="' + (ok ? band(n) : 'na') + '"><span class="sc-name">' + inline(r[0]) + '</span>'
          + '<span class="sc-bar" aria-hidden="true">' + [1, 2, 3, 4, 5].map((k) => '<i' + (ok && k <= n ? ' class="on"' : '') + '></i>').join('') + '</span>'
          + '<span class="sc-num">' + (ok ? n + '/5' : 'n/a') + '</span>'
          + (r[2] ? '<span class="sc-ev">' + inline(r.slice(2).join(' | ')) + '</span>' : '') + '</div>';
      }).join('') + '</div></div>';
  }

  function md(src) {
    let html = '', para = [], list = null, table = null, fence = null;
    const flushP = () => { if (para.length) { html += `<p>${inline(para.join(' '))}</p>`; para = []; } };
    const flushL = () => { if (list) { html += `</${list}>`; list = null; } };
    const flushT = () => {
      if (!table) return;
      const rows = table.map((r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      const body = rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
      if (body.length) {
        html += '<div class="md-table"><table><thead><tr>' + body[0].map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'
          + body.slice(1).map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
      }
      table = null;
    };

    const flushF = () => {
      if (!fence) return;
      html += fence.lang === 'scorecard' ? scorecard(fence.lines) : `<pre><code>${esc(fence.lines.join('\n'))}</code></pre>`;
      fence = null;
    };
    for (const raw of src.split('\n')) {
      const l = raw.replace(/\s+$/, '');
      if (fence) { if (/^\s*```/.test(l)) flushF(); else fence.lines.push(l); continue; }
      let f;
      if ((f = l.match(/^\s*```\s*([a-z]*)/i))) { flushP(); flushL(); flushT(); fence = { lang: f[1].toLowerCase(), lines: [] }; continue; }
      if (/^\s*\|.*\|\s*$/.test(l)) { flushP(); flushL(); (table = table || []).push(l); continue; }
      flushT();
      let m;
      if (!l.trim()) { flushP(); flushL(); continue; }
      if ((m = l.match(/^(#{1,4})\s+(.*)$/))) {
        flushP(); flushL();
        html += m[1].length <= 2 ? `<h3>${inline(m[2])}</h3>` : `<h4>${inline(m[2])}</h4>`;
        continue;
      }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { flushP(); flushL(); html += '<hr>'; continue; }
      if ((m = l.match(/^>\s?(.*)$/))) { flushP(); flushL(); html += `<blockquote>${inline(m[1])}</blockquote>`; continue; }
      if ((m = l.match(/^(\s*)([-*•]|\d+[.)])\s+(.*)$/))) {
        flushP();
        const want = /\d/.test(m[2]) ? 'ol' : 'ul';
        if (list !== want) { flushL(); html += `<${want}>`; list = want; }
        const box = m[3].match(/^\[( |x)\]\s+(.*)$/i);
        html += box ? `<li class="chk${m[1].length >= 2 ? ' sub' : ''}"><span class="cb" aria-hidden="true"></span>${inline(box[2])}</li>`
          : `<li${m[1].length >= 2 ? ' class="sub"' : ''}>${inline(m[3])}</li>`;
        continue;
      }
      flushL();
      para.push(l.trim());
    }
    flushP(); flushL(); flushT(); flushF();
    return html;
  }

  /* ═══ the GTM / teardown engine ════════════════════════════════════════ */
  const lab = $('#labApp');
  if (lab) {
    const ta = $('#pText'), go = $('#pGo'), count = $('#pCount');
    const out = $('#pOut'), body = $('#pBody'), status = $('#pStatus'), msg = $('#pMsg');
    const btnCopy = $('#pCopy'), btnPdf = $('#pPdf'), btnDl = $('#pDl');
    let raw = '', busy = false, lastInput = '', lastSite = '', cover = '';

    const URL_IN = /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s"'<>)]*)?)/i;
    const siteOf = (t) => { const m = t.match(URL_IN); if (!m) return ''; try { return new URL(/^https?:/i.test(m[1]) ? m[1] : 'https://' + m[1]).hostname.replace(/^www\./, ''); } catch { return ''; } };
    const GO = '✦ Build my GTM plan + audit';

    const sync = () => {
      const words = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
      count.textContent = siteOf(ta.value) ? `🔗 ${siteOf(ta.value)} · audit on` : `${words} word${words === 1 ? '' : 's'}`;
      if (!busy) go.textContent = GO;
    };
    ta.addEventListener('input', sync);
    $('#pClear').addEventListener('click', () => { ta.value = ''; sync(); ta.focus(); });
    lab.querySelectorAll('[data-try]').forEach((b) => b.addEventListener('click', () => { ta.value = b.dataset.try; sync(); ta.focus(); }));

    if (!API) {
      go.disabled = true;
      msg.hidden = false;
      msg.textContent = 'The live engine is being connected. Email me and I will send you a plan by hand.';
    }

    /* what the engine is doing while the first words are on their way */
    let stepTimer = 0;
    const startSteps = (withSite) => {
      const steps = (withSite
        ? ['Opening ' + withSite, 'Reading the homepage and two inner pages', 'Checking offer, trust, CTA and tracking', 'Scoring the website', 'Locking your ideal customer', 'Building the offer and funnel']
        : ['Reading your brief', 'Ranking customer segments', 'Locking your ideal customer', 'Building the offer and funnel', 'Planning content and the first 30 days']);
      let i = 0;
      const draw = () => {
        body.innerHTML = '<ol class="rp-steps">' + steps.map((s, k) => `<li class="${k < i ? 'done' : k === i ? 'now' : ''}">${esc(s)}</li>`).join('') + '</ol>';
      };
      draw();
      stepTimer = setInterval(() => { if (i < steps.length - 1) { i += 1; draw(); } }, 2600);
    };
    const stopSteps = () => { clearInterval(stepTimer); stepTimer = 0; };

    const makeCover = (text, site) => {
      const what = site || text.replace(/\s+/g, ' ').slice(0, 90) + (text.length > 90 ? '…' : '');
      const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      return '<div class="rp-cover"><span class="rp-k">' + (site ? 'GTM plan + website audit' : 'Go-to-market plan') + '</span>'
        + `<b>${esc(what)}</b><span class="rp-by">Prepared by Dipanjan Roy's GTM engine · ${date}</span></div>`;
    };

    let raf = 0;
    const paint = (text) => {
      raw = text;
      if (stepTimer) stopSteps();
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; body.innerHTML = cover + md(raw); });
    };

    async function run() {
      if (busy) return;
      const text = ta.value.trim();
      const site = siteOf(text);
      msg.hidden = true;
      if (!site && text.length < 12) { msg.hidden = false; msg.textContent = 'Give me a little more: what you sell, to whom, and where — or paste your website.'; return; }

      busy = true; lastInput = text; lastSite = site; raw = ''; cover = makeCover(text, site);
      go.disabled = true; go.textContent = site ? 'Auditing the site…' : 'Writing your plan…';
      out.hidden = false; out.classList.add('busy');
      status.textContent = site ? 'Reading the website' : 'Writing';
      btnCopy.disabled = btnPdf.disabled = btnDl.disabled = true;
      startSteps(site);
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });

      const t0 = performance.now();
      try {
        const final = await streamPost('/api/gtm', { brief: text }, (t) => { status.textContent = 'Writing your report'; paint(t); });
        stopSteps();
        raw = final; body.innerHTML = cover + md(final);
        status.textContent = `Done in ${Math.max(1, Math.round((performance.now() - t0) / 1000))}s`;
        btnCopy.disabled = btnPdf.disabled = btnDl.disabled = false;
      } catch (e) {
        stopSteps();
        if (!raw) out.hidden = true;
        msg.hidden = false; msg.textContent = e.message;
        status.textContent = 'Stopped';
      } finally {
        busy = false; out.classList.remove('busy'); go.disabled = false; sync();
      }
    }
    go.addEventListener('click', run);
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run(); });

    btnCopy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(raw); btnCopy.textContent = 'Copied'; }
      catch { btnCopy.textContent = 'Select & copy'; }
      setTimeout(() => (btnCopy.textContent = 'Copy'), 1600);
    });

    /* PDF without a server: print just the plan, on white, with my contact details. */
    const savePdf = () => {
      const root = $('#printRoot');
      root.innerHTML =
        '<div class="pr-brand"><b>Dipanjan Roy</b><span>Tech marketer &amp; AI builder</span></div>'
        + `<div class="pr-top"><b>${lastSite ? 'GTM plan + website audit' : 'Go-to-market plan'}</b>`
        + `<span>${esc(lastInput.slice(0, 160))}</span></div>`
        + `<div class="md">${md(raw)}</div>`
        + '<div class="pr-foot"><b>Want this built for you? Talk to me.</b><br>'
        + 'Dipanjan Roy · dipanjanroy369@gmail.com · WhatsApp +91 98746 04663 · dipanjanroy.cloud<br>'
        + '<small>Built from the brief and the public website only: no analytics, ad account or CRM was seen. Scores reflect what is on the page.</small></div>';
      document.documentElement.classList.add('printing');
      const prev = document.title;
      document.title = (lastSite ? 'GTM plan + audit - ' + lastSite : 'GTM plan') + ' - Dipanjan Roy';
      const done = () => { document.documentElement.classList.remove('printing'); document.title = prev; removeEventListener('afterprint', done); };
      addEventListener('afterprint', done);
      print();
    };
    btnPdf.addEventListener('click', savePdf);
    btnDl.addEventListener('click', savePdf);

    sync();
  }

  /* ═══ persona chat ═════════════════════════════════════════════════════ */
  const fab = $('#cwFab'), panel = $('#cwPanel');
  // no live API yet: hide the buttons that would open the chat
  if (!API) document.querySelectorAll('[data-open-chat]').forEach((el) => { el.hidden = true; });
  if (fab && panel && API) {
    const log = $('#cwLog'), form = $('#cwForm'), input = $('#cwInput'), send = $('#cwSend');
    const sugg = $('#cwSugg'), spk = $('#cwSpeak'), mic = $('#cwMic');
    const history = [];
    let busy = false, speak = false, audio = null;

    fab.hidden = false;

    const open = () => { panel.hidden = false; fab.hidden = true; setTimeout(() => input.focus(), 60); };
    const close = () => { panel.hidden = true; fab.hidden = false; stopAudio(); fab.focus(); };
    fab.addEventListener('click', open);
    $('#cwClose').addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
    /* any "ask my AI" link on the page opens the panel */
    document.addEventListener('click', (e) => { if (e.target.closest('[data-open-chat]')) { e.preventDefault(); open(); } });

    const bubble = (role, text = '') => {
      const d = document.createElement('div');
      d.className = `cw-m ${role === 'user' ? 'u' : 'a'}`;
      d.textContent = text;
      log.appendChild(d); log.scrollTop = log.scrollHeight;
      return d;
    };

    function stopAudio() { if (audio) { audio.pause(); audio = null; } }
    async function say(text) {
      stopAudio();
      try {
        const r = await fetch(API + '/api/tts', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: text.slice(0, 680) }),
        });
        if (!r.ok) return;
        audio = new Audio(URL.createObjectURL(await r.blob()));
        await audio.play();
      } catch { /* autoplay blocked or voice down — the text answer is already on screen */ }
    }

    async function ask(text) {
      text = text.trim();
      if (!text || busy) return;
      busy = true; send.disabled = true; sugg.hidden = true; stopAudio();
      bubble('user', text);
      history.push({ role: 'user', content: text });
      const a = bubble('assistant'); a.classList.add('wait');
      try {
        const final = await streamPost('/api/chat', { messages: history }, (t) => {
          a.classList.remove('wait'); a.textContent = t; log.scrollTop = log.scrollHeight;
        });
        history.push({ role: 'assistant', content: final });
        if (speak) say(final);
      } catch (e) {
        a.classList.remove('wait');
        a.textContent = e.message;
        history.pop();
      } finally { busy = false; send.disabled = false; }
    }

    form.addEventListener('submit', (e) => { e.preventDefault(); const t = input.value; input.value = ''; ask(t); });
    sugg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) ask(b.textContent); });

    spk.addEventListener('click', () => {
      speak = !speak;
      spk.setAttribute('aria-pressed', String(speak));
      spk.title = speak ? 'Voice replies on' : 'Voice replies off';
      if (!speak) stopAudio();
    });

    /* talk to it: the browser's own speech recognition, where it exists */
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      mic.hidden = false;
      const rec = new SR();
      rec.lang = 'en-IN'; rec.interimResults = true; rec.maxAlternatives = 1;
      let listening = false, heard = '';
      rec.onresult = (e) => {
        heard = [...e.results].map((r) => r[0].transcript).join(' ');
        input.value = heard;
      };
      rec.onend = () => {
        listening = false; mic.classList.remove('live');
        const t = heard.trim(); heard = '';
        if (t) { input.value = ''; ask(t); }
      };
      rec.onerror = () => { listening = false; mic.classList.remove('live'); };
      mic.addEventListener('click', () => {
        if (listening) { rec.stop(); return; }
        /* asking out loud means they want to hear the answer */
        if (!speak) spk.click();
        stopAudio(); heard = '';
        try { rec.start(); listening = true; mic.classList.add('live'); } catch { /* already started */ }
      });
    }
  }
})();
