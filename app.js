/* ============================================================
   SpiceGarden — app.js
   Central client-side logic for all pages

   ── A/B EXPERIMENT DATA SCHEMA (for methods-section reference) ──
   Every logged event includes: { action, sessionId, anonId, ts, ...fields }

   exposure    { dish, variant, variantIndex, page }
               Fired once per page view, after the target dish's card
               has been continuously >=60% visible for MIN_DWELL_MS.
               This is the "treatment received" event — the denominator
               for conversion rate and the trigger for the survey.

   add_to_cart { dish, variant, variantIndex }
               Fired on every add-to-cart click, any dish. Behavioral
               log, not an experimental outcome by itself.

   conversion  { dish, variant, variantIndex, latencyMs }
               Fired ONCE PER PERSON (gated on a persistent localStorage
               flag, not per session) the first time they add the
               target dish to cart. latencyMs is time from first logged
               exposure to this conversion within the same session/visit;
               it is null if no exposure was logged in this session
               (e.g. they converted on a return visit, or via the
               no-JS/fallback menu path).

   survey      { dish, variant, variantIndex, appeal_item1..3,
                 appeal_composite, manipulationCheck }
               Fired ONCE PER PERSON (persistent flag), triggered by
               exposure (not by conversion) so ratings aren't a biased
               sample of people who already committed to ordering.

   NOTE ON UNITS OF ANALYSIS: variant assignment and the conversion/
   survey "ever" flags are stored in localStorage (persists across
   sessions, same browser/device). exposure events are logged per
   SESSION (sessionId), so the same anonId can have multiple exposure
   rows across visits — for intent-to-treat analysis, collapse to first
   exposure per anonId; for dosage/repeat-exposure analysis, use all
   rows clustered by anonId.

   KNOWN LIMITATION: anonId is per-browser/device, not per-person.
   The same individual on two devices will appear as two anonIds.
   ============================================================ */

'use strict';

// ── A/B Test Variants ────────────────────────────────────────
const variants = [
  "A sensory journey of charred spices and succulent chicken, kissed by the tandoor's open flame.",
  "A health-conscious choice, perfectly grilled and packed with protein — bold flavour without compromise.",
  "An aromatic masterpiece of Kashmiri spices, slow-marinated for 24 hours and charred to perfection.",
];

// The single dish under experimental manipulation. Centralized here so
// every page (and the survey's manipulation check) references the same
// value instead of separately hardcoded strings that can drift apart.
const TARGET_DISH = 'Tandoori Butter Chicken';

// ── Research consent / opt-out ───────────────────────────────
// Single source of truth checked by getAnonId(), variant assignment,
// logEvent(), and trackExposure() — opting out stops all of them rather
// than relying on scattered checks that are easy to miss when this file
// is edited later.
function isOptedOut() {
  return localStorage.getItem('sg_research_optout') === '1';
}

// ── Persistent anonymous visitor ID ──────────────────────────
// Survives across sessions (unlike sessionStorage) so the same person
// returning later is recognized as one unit of observation, not
// double-counted as a fresh participant. No PII is ever stored here.
function getAnonId() {
  if (isOptedOut()) return null;
  let id = localStorage.getItem('sg_anon_id');
  if (!id) {
    id = (window.crypto && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : 'anon_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
    localStorage.setItem('sg_anon_id', id);
  }
  return id;
}
const anonId = getAnonId();

// Pick a variant ONCE per person (persisted in localStorage, not
// sessionStorage) — otherwise the same individual could be assigned a
// different framing on a later visit, contaminating the between-subjects
// design with within-subject repeats.
const variantIndex = (() => {
  if (isOptedOut()) {
    // Page still needs *some* description to render, but we don't
    // persist or log which one — nothing here is recoverable as data.
    return Math.floor(Math.random() * variants.length);
  }
  let idx = localStorage.getItem('sg_variant');
  if (idx === null) {
    idx = Math.floor(Math.random() * variants.length);
    localStorage.setItem('sg_variant', idx);
  }
  return parseInt(idx, 10);
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
    name: TARGET_DISH,
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

// ── Session ID helper (per visit/tab) ────────────────────────
function getSessionId() {
  let id = sessionStorage.getItem('sg_session_id');
  if (!id) {
    id = 'sess_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('sg_session_id', id);
  }
  return id;
}

// ── Generic server event logger ──────────────────────────────
function logEvent(action, data = {}) {
  if (isOptedOut()) return; // research data collection disabled for this browser

  const payload = { action, ...data, sessionId: getSessionId(), anonId, ts: new Date().toISOString() };

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

// ── Exposure tracking for the A/B-tested dish ────────────────
// Logs an 'exposure' event the first time the target dish's card has
// been continuously visible (>=60% in viewport) for MIN_DWELL_MS within
// THIS page view, then schedules the appeal survey shortly after — this
// decouples the appeal rating from add-to-cart, so non-converters are
// surveyed too.
const MIN_DWELL_MS    = 3000;
const SURVEY_DELAY_MS = 2000;

function trackExposure() {
  if (isOptedOut()) return; // don't track, and don't schedule the survey, for opted-out users

  const el = document.querySelector('[data-exposure-target="true"]');
  if (!el) return; // target card not on this page / not yet rendered

  let dwellTimer = null;
  let alreadyExposed = false;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !alreadyExposed) {
        dwellTimer = setTimeout(() => {
          alreadyExposed = true;
          sessionStorage.setItem('sg_exposed_at', String(Date.now()));

          logEvent('exposure', {
            dish: TARGET_DISH,
            variant: selectedDesc,
            variantIndex,
            page: window.location.pathname.split('/').pop() || 'index.html',
          });

          observer.disconnect();
          maybeScheduleSurvey();
        }, MIN_DWELL_MS);
      } else if (dwellTimer) {
        clearTimeout(dwellTimer);
        dwellTimer = null;
      }
    });
  }, { threshold: 0.6 });

  observer.observe(el);
}

function maybeScheduleSurvey() {
  // One survey response per PERSON, ever — not per visit, and not
  // gated on conversion, so the appeal sample isn't biased toward
  // people who already committed to ordering.
  if (localStorage.getItem('sg_survey_completed')) return;
  if (sessionStorage.getItem('sg_survey_scheduled')) return;
  sessionStorage.setItem('sg_survey_scheduled', '1');

  setTimeout(() => {
    const modal = document.getElementById('survey-modal');
    if (modal) modal.classList.add('open');
  }, SURVEY_DELAY_MS);
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
  logEvent('add_to_cart', { dish: dishName, variant: selectedDesc, variantIndex });

  // Experimental outcome: fires only for the target dish, only once
  // EVER per person (localStorage, not sessionStorage) so repeat
  // visits/clicks don't inflate the conversion count.
  if (dishName === TARGET_DISH && !localStorage.getItem('sg_converted_target')) {
    localStorage.setItem('sg_converted_target', '1');
    const exposedAt = sessionStorage.getItem('sg_exposed_at');
    const latencyMs = exposedAt ? Date.now() - parseInt(exposedAt, 10) : null;
    logEvent('conversion', {
      dish: TARGET_DISH,
      variant: selectedDesc,
      variantIndex,
      latencyMs, // null if no exposure was logged this session (see schema note above)
    });
  }
}

// ── Legacy addToCart (no arguments — kept for backward compatibility) ─
function addToCartLegacy() {
  showToast('Added to your order!');
  logEvent('add_to_cart', { variant: selectedDesc, variantIndex });
}

// ── Research consent banner ───────────────────────────────────
// Injected dynamically (not static HTML in each page) for the same
// reason the experiment logic itself is centralized here: one source
// of truth that's automatically present on every page that loads
// app.js, with no risk of a page falling out of sync with the others.
function injectConsentStyles() {
  if (document.getElementById('sg-consent-styles')) return;
  const style = document.createElement('style');
  style.id = 'sg-consent-styles';
  style.textContent = `
    #consent-banner {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 9998;
      background: #1A1A1A; color: rgba(255,255,255,0.82);
      padding: 16px 24px; display: flex; align-items: center; gap: 20px;
      flex-wrap: wrap; justify-content: space-between;
      border-top: 3px solid #FF6B35; font-size: 0.85rem;
      box-shadow: 0 -4px 24px rgba(0,0,0,0.25);
      transform: translateY(0); transition: transform 0.3s ease;
    }
    #consent-banner.hidden { transform: translateY(120%); }
    #consent-banner p { margin: 0; max-width: 680px; line-height: 1.5; color: rgba(255,255,255,0.78); }
    #consent-banner a { color: #F4A726; text-decoration: underline; cursor: pointer; }
    .consent-actions { display: flex; gap: 10px; flex-shrink: 0; }
    .consent-actions button {
      font-size: 0.82rem; font-weight: 600; padding: 9px 18px;
      border-radius: 50px; cursor: pointer; border: none;
      box-shadow: none; transition: all 0.2s ease;
    }
    .consent-accept { background: #FF6B35; color: #fff; }
    .consent-accept:hover { background: #C0392B; transform: none; box-shadow: none; }
    .consent-decline { background: transparent; color: rgba(255,255,255,0.6); border: 1.5px solid rgba(255,255,255,0.25); }
    .consent-decline:hover { color: #fff; border-color: rgba(255,255,255,0.5); transform: none; box-shadow: none; }
    #consent-modal .modal-card { text-align: left; }
    #consent-modal h3 { text-align: center; margin-bottom: 16px; }
    #consent-modal p { font-size: 0.88rem; color: #666; line-height: 1.65; margin-bottom: 14px; }
    #consent-modal ul { margin: 0 0 14px 0; padding-left: 20px; font-size: 0.88rem; color: #666; line-height: 1.65; }
    @media (max-width: 640px) {
      #consent-banner { flex-direction: column; align-items: stretch; text-align: left; }
      .consent-actions { justify-content: flex-end; }
    }
  `;
  document.head.appendChild(style);
}

function injectConsentBanner() {
  if (document.getElementById('consent-banner')) return; // already injected on this page load
  injectConsentStyles();

  const banner = document.createElement('div');
  banner.id = 'consent-banner';
  banner.innerHTML = `
    <p>
      We collect anonymous interaction data (no name, email, or contact details) to
      study what makes menu descriptions effective. De-identified results may be
      used in research.
      <a onclick="showConsentDetails(); return false;" href="#">Learn more</a>
    </p>
    <div class="consent-actions">
      <button type="button" class="consent-decline" onclick="optOutOfResearch()">Opt out</button>
      <button type="button" class="consent-accept" onclick="dismissConsentBanner()">Got it</button>
    </div>`;
  document.body.appendChild(banner);

  const modal = document.createElement('div');
  modal.id = 'consent-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <h3>About This Data</h3>
      <p><strong>What we collect:</strong> which version of a dish description you
      see, whether you add items to your order, and (optionally) survey ratings —
      tied only to a random ID stored in your browser.</p>
      <ul>
        <li>We never collect your name, email, or phone through this tracking,
        even if you separately submit a reservation or contact form — those go
        through a completely separate process.</li>
        <li>Results may be analyzed and published in de-identified form for
        research on menu copywriting.</li>
        <li>Opting out stops all future collection on this device immediately,
        and won't affect your ability to browse, order, or book a table.</li>
        <li>Because this data isn't linked to your identity, we have no way to
        find and delete specific past entries after the fact — opting out
        prevents new data, not retroactive removal.</li>
      </ul>
      <button onclick="hideConsentDetails()" style="width:100%;">Close</button>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open');
  });
}

function initConsentBanner() {
  if (isOptedOut() || localStorage.getItem('sg_consent_ack') === '1') return;
  injectConsentBanner();
}

function dismissConsentBanner() {
  localStorage.setItem('sg_consent_ack', '1');
  const banner = document.getElementById('consent-banner');
  if (banner) banner.classList.add('hidden');
}

function showConsentDetails() {
  const modal = document.getElementById('consent-modal');
  if (modal) modal.classList.add('open');
}

function hideConsentDetails() {
  const modal = document.getElementById('consent-modal');
  if (modal) modal.classList.remove('open');
}

// Opting out doesn't just hide the banner — it wipes every piece of
// locally-stored research/experiment state (anon ID, variant
// assignment, conversion/survey flags) and sets a flag that getAnonId(),
// variant assignment, logEvent(), and trackExposure() all check, so
// nothing further is collected or persisted for this browser.
function optOutOfResearch() {
  ['sg_anon_id', 'sg_variant', 'sg_survey_completed', 'sg_survey_scheduled',
   'sg_converted_target', 'sg_event_log', 'sg_consent_ack']
    .forEach(k => localStorage.removeItem(k));
  ['sg_exposed_at', 'sg_survey_scheduled', 'sg_session_id']
    .forEach(k => sessionStorage.removeItem(k));

  localStorage.setItem('sg_research_optout', '1');

  hideConsentDetails();
  const banner = document.getElementById('consent-banner');
  if (banner) banner.classList.add('hidden');

  showToast("You're opted out — no research data will be collected on this device.");
}

// ── Survey: scale + manipulation-check button selection ──────
function selectScaleOption(btn) {
  const group = btn.closest('[data-scale]');
  if (!group) return;
  group.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function selectManipOption(btn) {
  document.querySelectorAll('.manip-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

// ── Survey submit ─────────────────────────────────────────────
// Captures a 3-item appeal composite + a forced-choice manipulation
// check, so appeal ratings can be validated against whether the
// person actually registered which framing they saw.
function submitSurvey() {
  const modal = document.getElementById('survey-modal');

  const appealItems = ['appeal-1', 'appeal-2', 'appeal-3'].map(scaleId => {
    const selected = document.querySelector(`[data-scale="${scaleId}"] .scale-btn.selected`);
    return selected ? parseInt(selected.dataset.value, 10) : null;
  });

  if (appealItems.includes(null)) {
    showToast('Please rate all three statements before submitting.');
    return;
  }

  const manipBtn = document.querySelector('.manip-btn.selected');
  const manipulationCheck = manipBtn ? manipBtn.dataset.value : 'no_response';

  const appealComposite = +(appealItems.reduce((a, b) => a + b, 0) / appealItems.length).toFixed(2);

  logEvent('survey', {
    dish: TARGET_DISH,
    variant: selectedDesc,
    variantIndex,
    appeal_item1: appealItems[0],
    appeal_item2: appealItems[1],
    appeal_item3: appealItems[2],
    appeal_composite: appealComposite,
    manipulationCheck,
  });

  localStorage.setItem('sg_survey_completed', '1');
  if (modal) modal.classList.remove('open');

  showToast('Thanks for your feedback!');
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

// ── DOMContentLoaded — wire up each page ─────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // ── index.html: populate signature dishes grid ──
  const indexContainer = document.getElementById('menu-container');
  if (indexContainer && !indexContainer.hasChildNodes()) {
    const featured = menuData.filter(m =>
      [TARGET_DISH, 'Hot Butter Cuttlefish', 'Saffron Panna Cotta', 'Dal Makhani'].includes(m.name)
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
      if (item.name === TARGET_DISH) card.dataset.exposureTarget = 'true';
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

    // Start exposure tracking now that the target card exists in the DOM.
    trackExposure();
  }

  // ── menu.html: inject menu data if populateMenu exists ──
  // (menu.html calls populateMenu + trackExposure itself, after its own
  // DOMContentLoaded listener runs — see menu.html's inline script.)
  if (typeof populateMenu === 'function' && !indexContainer) {
    // no-op guard kept for pages that may define populateMenu differently;
    // menu.html drives its own population explicitly.
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

  // ── Consent banner (injects itself + its detail modal if not yet shown/declined) ──
  initConsentBanner();

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