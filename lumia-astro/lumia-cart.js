/* Lumia demo cart — localStorage, no backend. Exposes window.LumiaCart */
(function () {
  const KEY = 'lumia_cart_v1';
  const money = (n) => '$' + Number(n).toFixed(2);
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const write = (c) => { localStorage.setItem(KEY, JSON.stringify(c)); render(); };

  function add(item) {
    const c = read();
    const key = [item.id, item.size || '', item.color || ''].join('|');
    const ex = c.find((x) => x.key === key);
    if (ex) ex.qty += item.qty || 1;
    else c.push({ ...item, qty: item.qty || 1, key });
    write(c);
    open();
    toast(item.title + ' added to cart');
  }
  function setQty(key, q) { write(read().map((x) => (x.key === key ? { ...x, qty: Math.max(1, q) } : x))); }
  function remove(key) { write(read().filter((x) => x.key !== key)); }
  function count() { return read().reduce((n, x) => n + x.qty, 0); }
  function total() { return read().reduce((s, x) => s + x.price * x.qty, 0); }

  const $ = (s) => document.querySelector(s);
  function open() { const o = $('#cart-drawer'), b = $('#cart-overlay'); if (o) o.classList.add('open'); if (b) b.classList.add('open'); }
  function close() { const o = $('#cart-drawer'), b = $('#cart-overlay'); if (o) o.classList.remove('open'); if (b) b.classList.remove('open'); }

  function lineHTML(x) {
    const opts = [x.color ? 'Color' : null, x.size ? 'Size: ' + x.size : null].filter(Boolean).join(' · ');
    return `<div class="citem">
      <img src="${x.image}" alt="">
      <div>
        <div style="font-weight:600;font-size:14px">${x.title}</div>
        <div class="muted" style="font-size:12px">${opts}</div>
        <div class="qty" style="margin-top:6px">
          <button data-dec="${x.key}">−</button><span>${x.qty}</span><button data-inc="${x.key}">+</button>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700">${money(x.price * x.qty)}</div>
        <button class="link-remove" data-rm="${x.key}">Remove</button>
      </div>
    </div>`;
  }

  function render() {
    const items = read();
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = count(); el.style.display = count() ? 'grid' : 'none';
    });
    const body = $('#cart-drawer-body');
    if (body) body.innerHTML = items.length
      ? items.map(lineHTML).join('')
      : '<p class="muted center" style="padding:40px 0">Your cart is empty.</p>';
    document.querySelectorAll('[data-cart-total]').forEach((el) => (el.textContent = money(total())));
    const cp = $('#cart-page-body');
    if (cp) renderCartPage(cp, items);
  }

  function renderCartPage(el, items) {
    if (!items.length) { el.innerHTML = '<div class="center" style="padding:60px 0"><p class="muted">Your cart is empty.</p><a class="btn btn-primary" href="/shop">Continue shopping</a></div>'; return; }
    el.innerHTML = `<div style="display:grid;grid-template-columns:1fr 340px;gap:32px" class="cart-cols">
      <div>${items.map(lineHTML).join('')}</div>
      <div class="filter-box" style="position:static">
        <h4>Order Summary</h4>
        <div class="row-between"><span class="muted">Subtotal</span><b data-cart-total>${money(total())}</b></div>
        <div class="row-between" style="margin:8px 0"><span class="muted">Shipping</span><b>Free</b></div>
        <hr style="border:none;border-top:1px solid var(--line);margin:14px 0">
        <div class="row-between"><b>Total</b><b style="font-size:20px" data-cart-total>${money(total())}</b></div>
        <a class="btn btn-primary btn-block" style="margin-top:16px" href="/checkout">Checkout</a>
      </div></div>`;
  }

  let toastT;
  function toast(msg) {
    let t = $('#lumia-toast');
    if (!t) { t = document.createElement('div'); t.id = 'lumia-toast';
      t.style.cssText = 'position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#10182b;color:#fff;padding:12px 20px;border-radius:999px;z-index:80;font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);opacity:0;transition:.25s';
      document.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = '1'; clearTimeout(toastT);
    toastT = setTimeout(() => (t.style.opacity = '0'), 1800);
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('.add-cart');
    if (a) { e.preventDefault(); const d = a.dataset;
      add({ id: d.id, title: d.title, price: +d.price, image: d.image, slug: d.slug,
            size: getSel(d.id, 'size'), color: getSel(d.id, 'color') }); return; }
    const inc = e.target.closest('[data-inc]'); if (inc) return bump(inc.dataset.inc, 1);
    const dec = e.target.closest('[data-dec]'); if (dec) return bump(dec.dataset.dec, -1);
    const rm = e.target.closest('[data-rm]'); if (rm) return remove(rm.dataset.rm);
    if (e.target.closest('[data-cart-open]')) { e.preventDefault(); open(); }
    if (e.target.closest('[data-cart-close]')) close();
  });
  function bump(key, d) { const it = read().find((x) => x.key === key); if (it) setQty(key, it.qty + d); }
  function getSel(id, kind) { const el = document.querySelector(`[data-sel="${kind}"][data-for="${id}"].active`); return el ? el.dataset.val : ''; }

  window.LumiaCart = { add, setQty, remove, count, total, open, close, render };
  document.addEventListener('DOMContentLoaded', render);
  render();
})();
