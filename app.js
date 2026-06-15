/* ============================================================
   SpiceGarden — app.js
   Central client-side logic for all pages
   ============================================================ */

'use strict';

// ── A/B Test Variants ────────────────────────────────────────
const variants = [
  "A sensory journey of charred spices and succulent chicken, kissed by the tandoor's open flame.",
  "A health-conscious choice, perfectly grilled and packed with protein — bold flavour without compromise.",
  "An aromatic masterpiece of Kashmiri spices, slow-marinated for 24 hours and charred to perfection.",
];

// Pick a consistent variant per session (not random every page load)
const variantIndex = (() => {
  let idx = sessionStorage.getItem('sg_variant');
  if (idx === null) {
    idx = Math.floor(Math.random() * variants.length);
    sessionStorage.setItem('sg_variant', idx);
  }
  return parseInt(idx);
})();

const selectedDesc = variants[variantIndex];

// ── Full Menu Data ───────────────────────────────────────────
// Used by index.html and menu.html
const menuData = [
  // Starters
  {
    id: 1, category: 'starters', emoji: '🥗',
    name: 'Spiced Lentil Soup',
    desc: 'A fragrant blend of red lentils, cumin & fresh coriander, served with warm naan.',
    price: 'LKR 850', badges: ['veg'], spice: '🌶️',
  },
  {
    id: 2, category: 'starters', emoji: '🍢',
    name: 'Seekh Kebab Skewers',
    desc: 'Minced lamb mixed with garam masala, grilled on charcoal & served with mint chutney.',
    price: 'LKR 1,400', badges: ['spicy'], spice: '🌶️🌶️',
  },
  {
    id: 3, category: 'starters', emoji: '🧅',
    name: 'Onion Bhaji Basket',
    desc: 'Crispy golden onion fritters with green chilli & yoghurt dipping sauce.',
    price: 'LKR 700', badges: ['veg', 'new'], spice: '🌶️',
  },
  {
    id: 4, category: 'starters', emoji: '🦑',
    name: 'Hot Butter Cuttlefish',
    desc: 'Crispy cuttlefish tossed in our signature spicy butter sauce with spring onion.',
    price: 'LKR 1,800', badges: ['spicy', 'chef'], spice: '🌶️🌶️🌶️',
  },
  // Mains
  {
    id: 5, category: 'mains', emoji: '🍗',
    name: 'Tandoori Butter Chicken',
    desc: selectedDesc, // A/B test variant applied here
    price: 'LKR 2,200', badges: ['chef'], spice: '🌶️🌶️',
  },
  {
    id: 6, category: 'mains', emoji: '🐑',
    name: 'Rogan Josh',
    desc: 'Slow-braised lamb shoulder in a deep Kashmiri chilli gravy with whole spices.',
    price: 'LKR 2,600', badges: ['spicy'], spice: '🌶️🌶️🌶️',
  },
  {
    id: 7, category: 'mains', emoji: '🫘',
    name: 'Dal Makhani',
    desc: 'Black lentils simmered overnight in butter & cream — the ultimate comfort dish.',
    price: 'LKR 1,500', badges: ['veg'], spice: '🌶️',
  },
  {
    id: 8, category: 'mains', emoji: '🦐',
    name: 'Goan Prawn Curry',
    desc: 'Tiger prawns in a coconut-tamarind gravy with toasted kokum & mustard seeds.',
    price: 'LKR 2,800', badges: ['new', 'spicy'], spice: '🌶️🌶️',
  },
  {
    id: 9, category: 'mains', emoji: '🍚',
    name: 'Seafood Fried Rice',
    desc: 'Wok-fried rice with tiger prawns, fresh fish & cuttlefish — a Sri Lankan fusion classic.',
    price: 'LKR 1,500', badges: ['new'], spice: '🌶️',
  },
  // Breads
  {
    id: 10, category: 'breads', emoji: '🫓',
    name: 'Butter Naan',
    desc: 'Hand-stretched leavened bread baked in a clay tandoor, brushed with cultured butter.',
    price: 'LKR 350', badges: ['veg'], spice: '',
  },
  {
    id: 11, category: 'breads', emoji: '🌿',
    name: 'Garlic & Herb Paratha',
    desc: 'Flaky whole-wheat flatbread layered with roasted garlic, fresh methi & ghee.',
    price: 'LKR 450', badges: ['veg'], spice: '🌶️',
  },
  // Desserts
  {
    id: 12, category: 'desserts', emoji: '🍮',
    name: 'Saffron Panna Cotta',
    desc: 'Silky vanilla cream set with Sri Lankan saffron & topped with pistachio praline.',
    price: 'LKR 900', badges: ['veg', 'chef'], spice: '',
  },
  {
    id: 13, category: 'desserts', emoji: '🍨',
    name: 'Rose & Cardamom Kulfi',
    desc: 'Traditional Indian ice cream with Damascus rose water, cardamom & crushed almonds.',
    price: 'LKR 750', badges: ['veg'], spice: '',
  },
  // Drinks
  {
    id: 14, category: 'drinks', emoji: '🥭',
    name: 'Mango Lassi',
    desc: 'Chilled Alphonso mango blended with thick yoghurt, honey & a pinch of cardamom.',
    price: 'LKR 550', badges: ['veg'], spice: '',
  },
  {
    id: 15, category: 'drinks', emoji: '🌹',
    name: 'Rose Sherbet',
    desc: 'House-made rose syrup with cold milk, basil seeds & crushed ice.',
    price: 'LKR 500', badges: ['veg'], spice: '',
  },
];

// ── Cart state ───────────────────────────────────────────────
const cart = {
  items: JSON.parse(sessionStorage.getItem('sg_cart') || '[]'),

  add(name, price) {
    const existing = this.items.find(i => i.name === name);
    if (existing) { existing.qty++; }
    else          { this.items.push({ name, price, qty: 1 }); }
    sessionStorage.setItem('sg_cart', JSON.stringify(this.items));
    this._updateBadge();
  },

  remove(name) {
    this.items = this.items.filter(i => i.name !== name);
    sessionStorage.setItem('sg_cart', JSON.stringify(this.items));
    this._updateBadge();
  },

  total() {
    return this.items.reduce((sum, i) => {
      const num = parseInt((i.price || '0').replace(/[^0-9]/g, ''));
      return sum + num * i.qty;
    }, 0);
  },

  _updateBadge() {
    const badge = document.getElementById('cart-count');
    if (badge) {
      const count = this.items.reduce((s, i) => s + i.qty, 0);
      badge.textContent = count;
      badge.style.display = count ? 'flex' : 'none';
    }
  },
};

// ── Toast notification ───────────────────────────────────────
function showToast(message, type = 'success') {
  const notif = document.getElementById('notification');
  const text  = document.getElementById('notification-text');
  if (!notif) return;

  if (text) text.textContent = message;
  notif.classList.add('show');

  clearTimeout(notif._toastTimer);
  notif._toastTimer = setTimeout(() => notif.classList.remove('show'), 3000);
}

// ── Add to cart (called from menu cards) ────────────────────
function addToCart(dishName, btnEl) {
  const item = menuData.find(m => m.name === dishName);
  cart.add(dishName, item ? item.price : '');

  // Animate button
  if (btnEl) {
    const orig = btnEl.textContent;
    btnEl.textContent = '✓';
    btnEl.classList.add('added');
    setTimeout(() => { btnEl.textContent = orig; btnEl.classList.remove('added'); }, 1500);
  }

  showToast(`"${dishName}" added to your order!`);

  // Log to server
  logEvent('add_to_cart', { dish: dishName, variant: selectedDesc, variantIndex });

  // Show survey after a short delay (only once per session)
  if (!sessionStorage.getItem('sg_survey_shown')) {
    setTimeout(() => {
      const modal = document.getElementById('survey-modal');
      if (modal) {
        modal.classList.add('open');
        sessionStorage.setItem('sg_survey_shown', '1');
      }
    }, 800);
  }
}

// ── Legacy addToCart (no arguments — for old menu.html cards) ─
function addToCartLegacy() {
  showToast('Added to your order!');
  logEvent('add_to_cart', { variant: selectedDesc, variantIndex });

  const modal = document.getElementById('survey-modal');
  if (modal && !sessionStorage.getItem('sg_survey_shown')) {
    modal.classList.add('open');
    sessionStorage.setItem('sg_survey_shown', '1');
  }
}

// ── Survey submit ────────────────────────────────────────────
function submitSurvey() {
  const rating = document.getElementById('likert')?.value || 0;
  const modal  = document.getElementById('survey-modal');

  logEvent('survey', { rating: parseInt(rating), variant: selectedDesc, variantIndex });

  if (modal) modal.classList.remove('open');

  const labels = ['😐', '🙂', '😊', '😋', '🤩'];
  showToast(`Thanks for your ${labels[rating - 1] || '⭐'} feedback!`);
}

// ── Log order (called from index.html quick-order buttons) ───
function logOrder(dishName) {
  cart.add(dishName, '');
  showToast(`"${dishName}" added to your order!`);
  logEvent('order', { dish: dishName, timestamp: new Date().toISOString() });
}

// ── Handle contact form (contact.html) ──────────────────────
function handleContact(event) {
  if (event) event.preventDefault();

  const name    = document.getElementById('c-name')?.value.trim()    || (event?.target?.name?.value);
  const email   = document.getElementById('c-email')?.value.trim()   || (event?.target?.email?.value);
  const message = document.getElementById('c-message')?.value.trim() || (event?.target?.message?.value);

  if (!name || !email || !message) {
    alert('Please fill in your name, email, and message.');
    return;
  }

  const payload = {
    name, email, message,
    topic:  document.querySelector('.topic-btn.selected')?.textContent.trim() || 'General Enquiry',
    rating: document.querySelectorAll('.rating-star.lit').length || null,
    phone:  document.getElementById('c-phone')?.value.trim() || null,
  };

  // Try new endpoint first, fall back to /save
  fetch('/save-contact', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  .catch(() => fetch('/save', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action: 'contact_form', ...payload }),
  }))
  .then(() => {
    // Show success state (handled by contact.html inline JS too)
    const formPanel    = document.getElementById('form-panel');
    const successPanel = document.getElementById('success-panel');
    if (formPanel)    formPanel.style.display = 'none';
    if (successPanel) successPanel.classList.add('show');
  })
  .catch(err => console.warn('Contact save failed (server may be offline):', err));
}

// ── Generic server event logger ──────────────────────────────
function logEvent(action, data = {}) {
  const payload = { action, ...data, sessionId: getSessionId(), ts: new Date().toISOString() };

  // Try dedicated endpoint, fall back to /save
  const endpoint = action === 'contact_form' ? '/save-contact'
                 : action === 'order'         ? '/save-order'
                 : '/save';

  fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  }).catch(() => {
    // Server offline during dev — store locally
    const log = JSON.parse(localStorage.getItem('sg_event_log') || '[]');
    log.push(payload);
    localStorage.setItem('sg_event_log', JSON.stringify(log.slice(-50)));
  });
}

// ── Session ID helper ────────────────────────────────────────
function getSessionId() {
  let id = sessionStorage.getItem('sg_session_id');
  if (!id) {
    id = 'sess_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('sg_session_id', id);
  }
  return id;
}

// ── DOMContentLoaded — wire up each page ─────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // ── index.html: populate signature dishes grid ──
  const indexContainer = document.getElementById('menu-container');
  if (indexContainer && !indexContainer.hasChildNodes()) {
    const featured = menuData.filter(m =>
      ['Tandoori Butter Chicken','Hot Butter Cuttlefish','Saffron Panna Cotta','Dal Makhani'].includes(m.name)
    );
    featured.forEach(item => {
      const badgeMap = {
        veg:   '<span class="item-badge badge-veg">🌿 Veg</span>',
        spicy: '<span class="item-badge badge-spicy">🌶️ Spicy</span>',
        new:   '<span class="item-badge badge-new">New</span>',
        chef:  '<span class="item-badge badge-chef">Chef\'s Pick</span>',
      };
      const badgesHtml = (item.badges || []).map(b => badgeMap[b] || '').join('');
      const spiceHtml  = item.spice ? `<span class="spice-meter">${item.spice}</span>` : '';

      const card = document.createElement('div');
      card.className       = 'menu-item-card reveal';
      card.dataset.category = item.category;
      card.innerHTML = `
        <div class="menu-item-img">
          ${item.emoji || '🍽️'}
          <div class="item-badges">${badgesHtml}</div>
          ${spiceHtml}
        </div>
        <div class="menu-item-body">
          <div class="item-category-tag">${item.category}</div>
          <h3>${item.name}</h3>
          <p>${item.desc}</p>
          <div class="item-footer">
            <div class="item-price">
              ${item.price}
              <small>per serving</small>
            </div>
            <button class="add-btn" title="Add to order"
              onclick="addToCart('${item.name.replace(/'/g,"\\'")}', this)">+</button>
          </div>
        </div>`;
      indexContainer.appendChild(card);
    });

    // Trigger scroll reveal for new cards
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
  }

  // ── menu.html: inject menu data if populateMenu exists ──
  if (typeof populateMenu === 'function') {
    populateMenu(menuData);
  }

  // ── Apply A/B variant to any dish-desc element ──
  const descEl = document.getElementById('dish-desc');
  if (descEl) descEl.textContent = selectedDesc;

  // ── Wire survey modal close on overlay click ──
  const surveyModal = document.getElementById('survey-modal');
  if (surveyModal) {
    surveyModal.addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('open');
    });
  }

  // ── Init cart badge ──
  cart._updateBadge();

  // ── Scroll reveal (global) ──
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

  // ── Active nav link highlight ──
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // ── Log page view ──
  logEvent('page_view', { page, variantIndex });
});