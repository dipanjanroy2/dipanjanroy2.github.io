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

  function md(src) {
    let html = '', para = [], list = null, table = null;
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

    for (const raw of src.split('\n')) {
      const l = raw.replace(/\s+$/, '');
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
        html += `<li${m[1].length >= 2 ? ' class="sub"' : ''}>${inline(m[3])}</li>`;
        continue;
      }
      flushL();
      para.push(l.trim());
    }
    flushP(); flushL(); flushT();
    return html;
  }

  /* ═══ the GTM / teardown engine ════════════════════════════════════════ */
  const lab = $('#labApp');
  if (lab) {
    const ta = $('#pText'), tog = $('#pMode'), go = $('#pGo'), count = $('#pCount');
    const out = $('#pOut'), body = $('#pBody'), status = $('#pStatus'), msg = $('#pMsg');
    const btnCopy = $('#pCopy'), btnPdf = $('#pPdf');
    let raw = '', busy = false, lastKind = 'gtm', lastInput = '';

    const PLACE = {
      gtm: "What do you sell, to whom, and where?\ne.g. Clear aligners at a dental clinic in Indiranagar, Bangalore — mostly walk-ins, about ₹80k a case.",
      teardown: 'Paste your website address — e.g. yourclinic.com',
    };
    const looksLikeUrl = (t) => /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(t.trim());

    const sync = () => {
      const words = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
      count.textContent = `${words} word${words === 1 ? '' : 's'}`;
      const mode = tog.checked ? 'teardown' : 'gtm';
      ta.placeholder = PLACE[mode];
      if (!busy) go.textContent = mode === 'teardown' ? '✦ Tear down this site' : '✦ Build my go-to-market plan';
    };

    ta.addEventListener('input', () => {
      /* a bare web address can only mean one thing — flip the toggle for them */
      if (looksLikeUrl(ta.value) && !tog.checked) tog.checked = true;
      sync();
    });
    tog.addEventListener('change', sync);
    $('#pClear').addEventListener('click', () => { ta.value = ''; tog.checked = false; sync(); ta.focus(); });
    lab.querySelectorAll('[data-try]').forEach((b) => b.addEventListener('click', () => {
      ta.value = b.dataset.try; tog.checked = false; sync(); ta.focus();
    }));

    if (!API) {
      go.disabled = true;
      msg.hidden = false;
      msg.textContent = 'The live engine is being connected. Email me and I will send you a plan by hand.';
    }

    let raf = 0;
    const paint = (text) => {
      raw = text;
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; body.innerHTML = md(raw); });
    };

    async function run() {
      if (busy) return;
      const text = ta.value.trim();
      const kind = tog.checked ? 'teardown' : 'gtm';
      msg.hidden = true;
      if (kind === 'gtm' && text.length < 12) { msg.hidden = false; msg.textContent = 'Give me a little more: what you sell, to whom, and where.'; return; }
      if (kind === 'teardown' && !looksLikeUrl(text)) { msg.hidden = false; msg.textContent = 'That does not look like a website address. Try yourbusiness.com'; return; }

      busy = true; lastKind = kind; lastInput = text; raw = '';
      go.disabled = true; go.textContent = kind === 'teardown' ? 'Reading the site…' : 'Writing your plan…';
      out.hidden = false; out.classList.add('busy');
      body.innerHTML = ''; status.textContent = kind === 'teardown' ? 'Reading the site' : 'Writing';
      btnCopy.disabled = btnPdf.disabled = $('#pDl').disabled = true;
      out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      const t0 = performance.now();
      try {
        const final = await streamPost(kind === 'teardown' ? '/api/teardown' : '/api/gtm',
          kind === 'teardown' ? { url: text } : { brief: text }, paint);
        body.innerHTML = md(final); raw = final;
        status.textContent = `Done in ${Math.max(1, Math.round((performance.now() - t0) / 1000))}s`;
        btnCopy.disabled = btnPdf.disabled = $('#pDl').disabled = false;
      } catch (e) {
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
        + `<div class="pr-top"><b>${lastKind === 'teardown' ? 'Growth teardown' : 'Go-to-market plan'}</b>`
        + `<span>${esc(lastInput.slice(0, 160))}</span></div>`
        + `<div class="md">${md(raw)}</div>`
        + '<div class="pr-foot"><b>Want this built for you? Talk to me.</b><br>'
        + 'Dipanjan Roy · dipanjanroy369@gmail.com · WhatsApp +91 98746 04663 · dipanjanroy.cloud<br>'
        + '<small>Strategy scaffolding from the brief given, not a researched market report.</small></div>';
      document.documentElement.classList.add('printing');
      const prev = document.title;
      document.title = (lastKind === 'teardown' ? 'Growth teardown' : 'GTM plan') + ' - Dipanjan Roy';
      const done = () => { document.documentElement.classList.remove('printing'); document.title = prev; removeEventListener('afterprint', done); };
      addEventListener('afterprint', done);
      print();
    };
    btnPdf.addEventListener('click', savePdf);
    $('#pDl').addEventListener('click', savePdf);

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
