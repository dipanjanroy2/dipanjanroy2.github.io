/* Portfolio v2 interactions: hero ad stack, AI demo (live or scripted replay),
   campaign receipts + lightbox, AI ads gallery, funnel stages.
   Plain JS, no dependencies. Everything degrades to readable HTML without it. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover)').matches;
  const play = (v) => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };

  /* ── API: same rule as lab.js — localhost talks to `wrangler dev` ── */
  const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
  const API = (document.querySelector('meta[name="portfolio-api"]')?.content || '').replace(/\/$/, '')
    || (LOCAL ? 'http://127.0.0.1:8787' : '');

  async function apiReachable() {
    if (!API) return false;
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 1500);
      await fetch(API + '/api/chat', { method: 'OPTIONS', signal: ctl.signal, mode: 'cors' });
      clearTimeout(t);
      return true;
    } catch { return false; }
  }

  /* ── hero: three ads, hover (or tap) to play, always muted ── */
  $$('.stack .phone').forEach((p) => {
    const v = p.querySelector('video');
    if (!v) return;
    if (canHover) {
      p.addEventListener('mouseenter', () => play(v));
      p.addEventListener('mouseleave', () => v.pause());
    }
    p.addEventListener('click', () => (v.paused ? play(v) : v.pause()));
  });

  /* ── AI demo ── */
  const REPLAY = {
    'What results have you had with Meta ads?':
      'Since 2023 I have run <b>30+ Meta campaigns</b> — 774K impressions and 11.6K clicks. The best-documented one is an online astrology-reading product: <b>71 paid orders from 63 buyers</b> in the first six weeks, every order matched to Razorpay, and revenue of <b>2.2x the Meta ad spend</b>.',
    'Can you build the follow-up too?':
      'Yes. I built an <b>AI voice agent that calls a new lead within 15 minutes</b> and sends a WhatsApp recap afterwards. Four of my WhatsApp message templates were approved by Meta. The recording on the right is a real call to an agent I set up.',
    'Why marketing, if you are an engineer?':
      'I started in <b>cloud, DevOps and back-end engineering</b>. Then I got hooked on online selling — I sold physical products myself and had to learn marketing to make them sell. I built Shopify, WordPress and custom sites and landing pages, made the ads, and then trained in <b>digital marketing and go-to-market</b> in Kolkata and Bangalore. The engineering is now my edge: I set up the tracking, automations and AI agents myself.',
    'What is your technical background?':
      'Cloud and agentic-AI engineering: I run production <b>AWS</b> infrastructure for airline clients, including British Airways and Qantas. That is why I set up pixels, events, automations and AI agents myself instead of waiting on a developer.',
    'How do you know your numbers are right?':
      'I count captured payments, not what Ads Manager reports. Checking Meta against Razorpay is how I found the <b>Pixel double-counting purchases</b>, and test orders marked as paid.'
  };
  const log = $('#aiLog'), sugg = $('#aiSugg');
  if (log && sugg) {
    const add = (cls, html) => {
      const d = document.createElement('div');
      d.className = 'msg ' + cls;
      d.innerHTML = html;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
      return d;
    };
    let busy = false;
    async function replay(q) {
      if (busy) return;
      busy = true;
      $$('button', sugg).forEach((b) => (b.disabled = true));
      add('q', q.replace(/</g, '&lt;'));
      const t = add('a typing', '…');
      await new Promise((r) => setTimeout(r, reduced ? 0 : 650));
      t.classList.remove('typing');
      t.innerHTML = REPLAY[q];
      $$('button', sugg).forEach((b) => (b.disabled = false));
      busy = false;
    }
    sugg.innerHTML = Object.keys(REPLAY).map((q) => `<button type="button">${q}</button>`).join('');
    sugg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) replay(b.textContent); });

    // live mode: the same chips (and a text box) ask the real assistant
    const history = [];
    const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const fmt = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
    async function ask(q) {
      if (busy || !q.trim()) return;
      busy = true;
      $$('button', sugg).forEach((b) => (b.disabled = true));
      $('#aiSend').disabled = true;
      add('q', esc(q));
      const t = add('a typing', '…');
      history.push({ role: 'user', content: q });
      try {
        const res = await fetch(API + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: history.slice(-8) }) });
        if (!res.ok || !res.body) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error || 'The assistant is busy. Try again in a minute.');
        }
        const rd = res.body.getReader(), dec = new TextDecoder();
        let all = '';
        t.classList.remove('typing');
        for (;;) {
          const { done, value } = await rd.read();
          if (done) break;
          all += dec.decode(value, { stream: true });
          t.innerHTML = fmt(all);
          log.scrollTop = log.scrollHeight;
        }
        history.push({ role: 'assistant', content: all });
      } catch (err) {
        t.classList.remove('typing');
        t.textContent = err.message || 'Something went wrong. Try again.';
        history.pop();
      }
      $$('button', sugg).forEach((b) => (b.disabled = false));
      $('#aiSend').disabled = false;
      busy = false;
    }

    apiReachable().then((live) => {
      const st = $('#aiStatus'), note = $('#aiNote');
      if (live) {
        st.className = 'status live'; st.textContent = 'Live';
        note.textContent = 'This is the live assistant. It answers only from my verified résumé notes, and says so when something is not in them.';
        $('#aiForm').hidden = false;
        sugg.onclick = null;
        sugg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { e.stopImmediatePropagation(); ask(b.textContent); } }, true);
        $('#aiForm').addEventListener('submit', (e) => { e.preventDefault(); const i = $('#aiInput'); const q = i.value; i.value = ''; ask(q); });
        $$('[data-needs-api]').forEach((el) => (el.hidden = false));
      } else {
        st.className = 'status demo'; st.textContent = 'Scripted demo';
        $$('[data-needs-api]').forEach((el) => (el.hidden = true));
      }
    });
  }

  /* ── live voice call to the AI receptionist (public demo agent) ── */
  const callBtn = $('#callBtn'), callStatus = $('#callStatus');
  if (callBtn) {
    const AGENT = 'agent_7601m2wbp10cftyth82jhxdbkkd8';
    const LIMIT = 120; // seconds; a courtesy limit in the page — the agent itself caps calls at 5 minutes
    let conv = null, timer = null, left = LIMIT, raf = 0, ov = null;
    const idle = () => { callBtn.textContent = '📞 Call the AI receptionist — live'; callBtn.disabled = false; };
    const fmt = (n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
    // full-screen call stage: two orbs that move with the voices, live captions, a countdown bar
    const openStage = () => {
      ov = document.createElement('div');
      ov.className = 'callstage'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Live call with the AI receptionist');
      ov.innerHTML = `<div class="cs-top"><span class="cs-live"><i></i>LIVE CALL</span><span class="cs-clinic">Muskaan Dental Clinic · demo</span><span class="cs-time" id="csTime">${fmt(LIMIT)}</span></div>
        <div class="cs-orbs"><div class="cs-p you"><div class="orb" id="orbYou"></div><b>You</b><small>caller</small></div><div class="cs-link"></div><div class="cs-p ai"><div class="orb" id="orbAi"></div><b>Riya</b><small>AI receptionist</small></div></div>
        <div class="cs-cap"><p class="cs-ai" id="csAi">Connecting…</p><p class="cs-you" id="csYou"></p></div>
        <div class="cs-foot"><span id="csHint">Say hello — speak Hindi or English</span><button type="button" class="btn cs-end" id="csEnd">■ End call</button></div>`;
      document.body.appendChild(ov); document.body.classList.add('in-call');
      $('#csEnd', ov).addEventListener('click', () => end());
      requestAnimationFrame(() => ov && ov.classList.add('on'));
      const oa = $('#orbAi', ov), oy = $('#orbYou', ov);
      let ai = 0, you = 0;
      const tick = () => {
        let vo = 0, vi = 0;
        try { vo = conv ? conv.getOutputVolume() : 0; vi = conv ? conv.getInputVolume() : 0; } catch {}
        ai += (Math.min(1, vo * 2.2) - ai) * .25; you += (Math.min(1, vi * 2.2) - you) * .25;
        oa.style.setProperty('--lv', ai.toFixed(3)); oy.style.setProperty('--lv', you.toFixed(3));
        raf = requestAnimationFrame(tick);
      };
      tick();
    };
    const closeStage = () => {
      cancelAnimationFrame(raf); document.body.classList.remove('in-call');
      if (ov) { const o = ov; ov = null; o.classList.remove('on'); setTimeout(() => o.remove(), 300); }
    };
    const end = async (msg) => {
      clearInterval(timer); timer = null;
      try { if (conv) await conv.endSession(); } catch {}
      conv = null; closeStage(); idle(); callStatus.textContent = msg || 'Call ended. Thanks for trying it.';
    };
    callBtn.addEventListener('click', async () => {
      if (conv) return end();
      // per-browser courtesy cap: 3 calls a day (the agent itself is capped server-side too)
      const today = new Date().toISOString().slice(0, 10);
      let used = { d: today, n: 0 };
      try { const u = JSON.parse(localStorage.getItem('dr-calls') || 'null'); if (u && u.d === today) used = u; } catch {}
      if (used.n >= 3) { callStatus.textContent = "You've tried the live call 3 times today — play the recorded call above, or email me for a full demo."; return; }
      try { localStorage.setItem('dr-calls', JSON.stringify({ d: today, n: used.n + 1 })); } catch {}
      callBtn.disabled = true; callStatus.textContent = 'Connecting… allow the microphone when asked.';
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const { Conversation } = await import('https://esm.sh/@elevenlabs/client@0.7');
        openStage();
        conv = await Conversation.startSession({
          agentId: AGENT,
          connectionType: 'websocket',
          onMessage: (m) => {
            if (!ov || !m || !m.message) return;
            if (m.source === 'ai') { $('#csAi', ov).textContent = m.message; $('#csYou', ov).textContent = ''; }
            else $('#csYou', ov).textContent = '“' + m.message + '”';
          },
          onModeChange: ({ mode }) => {
            if (!ov) return;
            ov.dataset.mode = mode;
            $('#csHint', ov).textContent = mode === 'speaking' ? 'Riya is speaking…' : '🎙️ Your turn — go ahead';
          },
          onDisconnect: (d) => { if (conv) end(d && d.reason === 'error' ? 'The call dropped' + (d.message ? ' (' + d.message + ')' : '') + '. Try again.' : ''); },
          onError: (e) => end('The call could not continue' + (e && e.message ? ' (' + e.message + ')' : '') + '. Try again.')
        });
        callBtn.disabled = false; callBtn.textContent = '■ End call';
        left = LIMIT; callStatus.textContent = 'On a call…';
        timer = setInterval(() => {
          left -= 1;
          if (ov) { $('#csTime', ov).textContent = fmt(Math.max(left, 0)); ov.style.setProperty('--p', (left / LIMIT).toFixed(3)); }
          if (left <= 0) end('Two minutes are up — that was the demo.');
        }, 1000);
      } catch (e) {
        conv = null; closeStage(); idle();
        callStatus.textContent = e && e.name === 'NotAllowedError'
          ? 'The call needs microphone access. Allow it in the browser and try again.'
          : 'Could not start the call. Check your connection and try again.';
      }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && conv) end(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && conv) end('Call ended when you left the tab.'); });
  }

  /* ── campaign receipts ── */
  // Add a real screenshot by setting `img` (path under assets/receipts/). Cost
  // columns must be removed from the image itself before it goes here.
  const RECEIPTS = [
    { f: 'sales', brand: 'Astrology readings · D2C', obj: 'Sales', title: 'Astrology readings launch', stat: '<b>2.18%</b> CTR · <b>71</b> verified orders', did: 'Ads, landing page, offer ladder and Razorpay reconciliation — all mine.', slot: 'Astrology readings campaign — Ads Manager, cost columns removed', h: 300, img: 'assets/receipts/astrology-campaigns.webp?v=2' },
    { f: 'sales test', brand: 'Room heater · e-commerce', obj: 'Sales', title: 'One product, three versions', stat: 'CTR <b>1.30% → 2.22% → 2.17%</b> across three rebuilds', did: 'Rebuilt the campaign twice on the same product.', slot: 'Room heater v1, v2 and v3', h: 230, img: 'assets/receipts/room-heater.webp' },
    { f: 'sales', brand: 'Home products', obj: 'Sales', title: 'Best click-through', stat: '<b>3.52%</b> CTR · <b>40</b> purchases', did: '', slot: 'Home products campaigns', h: 250, img: 'assets/receipts/home-products.webp' },
    { f: 'awareness', brand: 'Book', obj: 'Awareness', title: 'Book campaign reach', stat: '<b>247K</b> accounts reached', did: '', slot: 'Book awareness campaign', h: 210, img: 'assets/receipts/book-awareness.webp' },
    { f: 'sales', brand: 'Trading product', obj: 'Sales', title: 'A second category, above 3%', stat: '<b>3.29%</b> CTR · <b>7</b> purchases', did: '', slot: 'Trading product campaign', h: 240, img: 'assets/receipts/trading.webp' }
  ];
  const wall = $('#wall');
  if (wall) {
    const media = (r, big) => r.img
      ? `<img src="${r.img}" alt="${r.title} — Ads Manager screenshot, cost columns removed" loading="lazy">`
      : `<div class="slot" style="${big ? '' : 'height:' + r.h + 'px'}"><span><b>Screenshot coming</b>${r.slot}</span></div>`;
    wall.innerHTML = RECEIPTS.map((r, i) => `
      <button class="rc reveal in" type="button" data-i="${i}" data-f="${r.f}">
        ${media(r)}
        <div class="meta"><div class="row">${r.brand}<span class="obj">${r.obj}</span></div>
          <h3>${r.title}</h3><div class="stat">${r.stat}</div>${r.did ? `<p class="did">${r.did}</p>` : ''}</div>
      </button>`).join('');

    const cards = $$('.rc', wall);
    $$('#rcChips button').forEach((c) => c.addEventListener('click', () => {
      $$('#rcChips button').forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      const f = c.dataset.f;
      cards.forEach((k) => (k.hidden = !(f === 'all' || k.dataset.f.split(' ').includes(f))));
    }));

    const lb = $('#lb'), lbMedia = $('#lbMedia'), lbTitle = $('#lbTitle');
    let idx = 0, opener = null;
    const vis = () => cards.filter((k) => !k.hidden);
    const show = (i) => {
      const v = vis(); idx = (i + v.length) % v.length;
      const r = RECEIPTS[+v[idx].dataset.i];
      lbTitle.textContent = r.title;
      lbMedia.innerHTML = media(r, true);
    };
    const close = () => { lb.classList.remove('open'); document.body.style.overflow = ''; if (opener) opener.focus(); };
    cards.forEach((k) => k.addEventListener('click', () => {
      opener = k; show(vis().indexOf(k)); lb.classList.add('open'); document.body.style.overflow = 'hidden'; $('#lbClose').focus();
    }));
    $('#lbClose').addEventListener('click', close);
    $('#lbPrev').addEventListener('click', () => show(idx - 1));
    $('#lbNext').addEventListener('click', () => show(idx + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    document.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') show(idx + 1);
      if (e.key === 'ArrowLeft') show(idx - 1);
    });
    let x0 = null;
    lb.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
    });
  }

  /* ── AI ads: muted preview on hover; click = play with sound ── */
  $$('.ad-media').forEach((m) => {
    const v = m.querySelector('video'), snd = m.querySelector('.snd'), hint = m.querySelector('.playhint');
    const others = () => $$('.ad-media video').filter((x) => x !== v);
    if (canHover) {
      m.addEventListener('mouseenter', () => { if (v.muted) play(v); });
      m.addEventListener('mouseleave', () => { if (v.muted) v.pause(); });
    }
    m.addEventListener('click', () => {
      others().forEach((x) => { x.pause(); x.muted = true; });
      if (v.paused || v.muted) { v.muted = false; play(v); snd.textContent = '🔊'; hint.textContent = 'Tap to pause'; }
      else { v.pause(); snd.textContent = '🔇'; hint.textContent = 'Tap for sound'; }
    });
  });

  /* ── AI clip wall: muted loops, hover (or tap) to play ── */
  $$('.clips button.clip').forEach((c) => {
    const v = c.querySelector('video');
    if (canHover) {
      c.addEventListener('mouseenter', () => play(v));
      c.addEventListener('mouseleave', () => v.pause());
    }
    c.addEventListener('click', () => (v.paused ? play(v) : v.pause()));
  });

  /* ── funnel stages ── */
  const STAGES = [
    { p: 'Know the buyer', t: 'Dream buyer', built: 'Before any ad, one buyer written down: what they fear, the moment that sends them searching, and the exact words they type. For the astrology product that was people in India stuck on a marriage or relationship decision.', tools: ['Buyer persona', 'Keyword Planner', 'Meta Ad Library'], evidence: 'The GTM tool above writes this persona for any business you give it.', metric: 'Hindi · Bengali · English', msub: 'SEO pages in three languages', where: 'The astrology-reading product.' },
    { p: 'Find them', t: 'Where they are', built: 'Meta campaigns across Sales, Leads, Engagement and Click-to-WhatsApp — audience and creative tests, budget pacing, restructuring on cost per purchase. Creatives include my AI-generated video ads.', tools: ['Meta Ads Manager', 'AI video', 'Creative testing'], evidence: 'Campaign receipts and the AI ads gallery above.', metric: '2.18% CTR', msub: 'Astrology-readings campaign · 30+ campaigns since 2023', where: 'The astrology-reading product, and D2C room heaters and LED torches.' },
    { p: 'The bait', t: 'Free value first', built: 'Something genuinely useful before any ask: a free first answer before payment, 6 free calculators that lead into the paid app, and an AI website audit delivered on WhatsApp and email as a lead magnet.', tools: ['Lead magnet', 'Free tools', 'WhatsApp'], evidence: 'The free GTM plan and website teardown above work the same way.', metric: '6 free calculators', msub: 'each one leads into the paid app', where: 'The astrology-reading product, and my AI automation work.' },
    { p: 'The offer', t: 'An offer they can’t refuse', built: 'A four-tier offer ladder, from a ₹49 order bump up to a ₹499 premium reading — so every buyer has a yes at their own level, and the top tier looks like the obvious choice.', tools: ['Offer ladder', 'Order bump', 'Value stack'], evidence: 'Payment records, by tier.', metric: '31% chose the top tier', msub: 'of 71 paid orders', where: 'The astrology-reading product.' },
    { p: 'Capture', t: 'Landing page', built: 'An animated landing page with an A/B variant, written for one buyer and one action. SEO in English, Hindi and Bengali: 43 pages with hreflang and schema.', tools: ['HTML / CSS / JS', 'A/B test', 'Search Console'], evidence: 'The landing page and its A/B variant, live online. The dental demo below is the same structure.', metric: '43 SEO pages', msub: 'No step conversion rate published — I don’t show one I can’t prove.', where: 'The astrology-reading product.' },
    { p: 'Convert', t: 'Checkout', built: 'A Razorpay checkout, with every order reconciled against the bank instead of trusting the pixel — which is how I caught Meta double-counting purchases.', tools: ['Razorpay', 'Meta Pixel', 'Reconciliation'], evidence: 'Every order matched one by one to Razorpay.', metric: '71 paid orders', msub: 'from 63 buyers in the first six weeks', where: 'The astrology-reading product.' },
    { p: 'Nurture', t: 'Follow-up', built: 'Nobody is left to go cold: an AI voice agent calls a new lead within 15 minutes and sends an automatic WhatsApp recap.', tools: ['AI voice', 'WhatsApp Cloud API', 'Automation'], evidence: 'Call the AI receptionist live in the AI demo section.', metric: '15 minutes', msub: 'from lead to first call · 4 WhatsApp templates approved by Meta', where: 'My AI automation work for small businesses.' },
    { p: 'Lifetime value', t: 'Repeat order', built: 'The offer ladder and order bump give a buyer a reason to come back for the next reading.', tools: ['Offer design', 'WhatsApp'], evidence: 'Payment records.', metric: '71 orders · 63 buyers', msub: 'in the first six weeks', where: 'The astrology-reading product.' }
  ];
  const fn = $('#fnSteps'), panel = $('#fnPanel');
  if (fn && panel) {
    fn.innerHTML = STAGES.map((s, i) => `<button type="button" role="tab" id="fnTab${i}" aria-controls="fnPanel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><span>0${i + 1} · ${s.p}</span><b>${s.t}</b></button>`).join('');
    const render = (i) => {
      const s = STAGES[i];
      panel.setAttribute('aria-labelledby', 'fnTab' + i);
      panel.innerHTML = `<h3>${s.t}</h3>
        <div><h4>What I built</h4><p>${s.built}</p></div>
        <div><h4>The number here</h4><p class="metric">${s.metric}<small>${s.msub}</small></p></div>
        <div><h4>Tools</h4><ul>${s.tools.map((t) => `<li>${t}</li>`).join('')}</ul></div>
        <div><h4>Evidence</h4><p>${s.evidence}</p></div>
        <p class="where">Where: ${s.where}</p>`;
    };
    const tabs = $$('button', fn);
    const select = (i, focus) => {
      tabs.forEach((b, j) => { b.setAttribute('aria-selected', String(j === i)); b.tabIndex = j === i ? 0 : -1; });
      render(i); if (focus) tabs[i].focus();
      tabs[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    };
    tabs.forEach((b, i) => b.addEventListener('click', () => select(i)));
    fn.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); select((i + 1) % tabs.length, true); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); select((i - 1 + tabs.length) % tabs.length, true); }
    });
    render(0);
  }
})();
