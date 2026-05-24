/**
 * ÉLARA Fashion — Ecommerce Checkout
 * Yuno SDK Full Checkout Flow
 */

/* ============================================================
   CONSTANTS
   ============================================================ */

const COUNTRIES = {
  BR: {
    name: 'Brazil',
    flag: '🇧🇷',
    currency: 'BRL',
    language: 'pt',
    methods: ['💳 Credit Card', 'Pix', '🍏 Apple Pay', '🤖 Google Pay'],
    methodsDim: [false, false, true, true],
    note: 'Available for Brazil: Credit Card, Pix, and more',
  },
  CO: {
    name: 'Colombia',
    flag: '🇨🇴',
    currency: 'COP',
    language: 'es',
    methods: ['💳 Credit Card', 'PSE', '🍏 Apple Pay', '🤖 Google Pay'],
    methodsDim: [false, false, true, true],
    note: 'Available for Colombia: Credit Card, PSE, and more',
  },
  MX: {
    name: 'Mexico',
    flag: '🇲🇽',
    currency: 'MXN',
    language: 'es',
    methods: ['💳 Credit Card', 'OXXO', '🍏 Apple Pay', '🤖 Google Pay'],
    methodsDim: [false, false, true, true],
    note: 'Available for Mexico: Credit Card, OXXO, and more',
  },
};

const CART_ITEMS = [
  {
    name: 'Cashmere Oversized Coat',
    variant: 'Deep Black · Size S',
    qty: 1,
    emoji: '🧥',
    bg: 'linear-gradient(135deg, #1a1a2e18 0%, #1a1a2e30 100%)',
    prices: { BR: 'R$ 1.290,00', CO: 'COP 2.890.000', MX: 'MX$ 8.500' },
  },
  {
    name: 'Silk Pleated Midi Dress',
    variant: 'Ivory · Size 36',
    qty: 1,
    emoji: '👗',
    bg: 'linear-gradient(135deg, #f5f0e818 0%, #f0e8d030 100%)',
    prices: { BR: 'R$ 780,00', CO: 'COP 1.760.000', MX: 'MX$ 5.200' },
  },
  {
    name: 'Patent Leather Ankle Boots',
    variant: 'Cognac · EU 38',
    qty: 1,
    emoji: '👢',
    bg: 'linear-gradient(135deg, #8b451318 0%, #8b451330 100%)',
    prices: { BR: 'R$ 650,00', CO: 'COP 1.460.000', MX: 'MX$ 4.300' },
  },
];

const ORDER_TOTALS = {
  BR: { subtotal: 'R$ 2.720,00',       shipping: 'Grátis',  tax: 'R$ 217,60',      grand: 'R$ 2.937,60' },
  CO: { subtotal: 'COP 6.110.000',     shipping: 'Gratis',  tax: 'COP 488.800',    grand: 'COP 6.598.800' },
  MX: { subtotal: 'MX$ 18.000',        shipping: 'Gratis',  tax: 'MX$ 1.440',      grand: 'MX$ 19.440' },
};

/* ============================================================
   STATE
   ============================================================ */

const state = {
  country: 'CO',
  yuno: null,
  checkoutSession: null,
  publicApiKey: null,
  isPaying: false,
  isLoadingCheckout: false,
};

/* ============================================================
   DOM HELPERS
   ============================================================ */

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

/* ============================================================
   INIT (called when DOM is ready)
   ============================================================ */

function init() {
  renderCartItems();
  updateOrderTotals(state.country);
  updateCountryUI(state.country);
  updateMethodChips(state.country);

  // Country selector
  $$('#country-selector .country-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const country = btn.dataset.country;
      if (country !== state.country && !state.isLoadingCheckout) {
        onCountryChange(country);
      }
    });
  });

  // Pay button
  $('pay-button').addEventListener('click', onPayClick);

  // Overlay actions
  $('btn-continue-shopping').addEventListener('click', () => location.reload());
  $('btn-retry').addEventListener('click', () => {
    hideOverlay('error');
    state.isPaying = false;
  });
  $('btn-change-method').addEventListener('click', () => {
    hideOverlay('error');
    state.isPaying = false;
    if (state.yuno) state.yuno.hideLoader?.();
  });
  $('btn-view-status').addEventListener('click', () => hideOverlay('pending'));

  // Promo code (UI only demo)
  $('btn-promo').addEventListener('click', onPromoApply);
}

/* ============================================================
   YUNO SDK — Entry Point
   Called by `window.addEventListener('yuno-sdk-ready', ...)`
   ============================================================ */

async function initYunoCheckout() {
  await loadCheckoutForCountry(state.country);
}

/* ============================================================
   CHECKOUT INITIALIZATION PER COUNTRY
   ============================================================ */

async function loadCheckoutForCountry(country) {
  if (state.isLoadingCheckout) return;
  state.isLoadingCheckout = true;
  state.country = country;

  updateCountryUI(country);
  updateOrderTotals(country);
  updateMethodChips(country);
  showSkeleton();
  setPayButtonState(false);
  $('yuno-root').classList.add('loading');

  try {
    // Initialize SDK once
    if (!state.publicApiKey) {
      const data = await fetch('/public-api-key').then((r) => r.json());
      state.publicApiKey = data.publicApiKey;
    }

    if (!state.yuno) {
      state.yuno = await Yuno.initialize(state.publicApiKey);
    }

    // Get checkout session for selected country
    const session = await fetch(`/checkout/sessions?country=${country}`, {
      method: 'POST',
    }).then((r) => r.json());

    if (!session.checkout_session) {
      throw new Error('Invalid session response');
    }

    state.checkoutSession = session.checkout_session;
    const countryCode = session.country || country;

    // Configure checkout
    await state.yuno.startCheckout({
      checkoutSession: state.checkoutSession,
      elementSelector: '#yuno-root',
      countryCode,
      language: COUNTRIES[country]?.language ?? 'es',
      showLoading: true,
      keepLoader: true,

      onLoading: ({ isLoading }) => {
        if (!state.isPaying) {
          if (isLoading) {
            showSkeleton();
          } else {
            hideSkeleton();
            $('yuno-root').classList.remove('loading');
            setPayButtonState(true);
          }
        }
      },

      renderMode: {
        type: 'modal',
        elementSelector: {
          apmForm: '#yuno-form',
          actionForm: '#yuno-action-form',
        },
      },

      card: {
        type: 'extends',
        styles: `
          * { font-family: 'Inter', -apple-system, sans-serif !important; }
          .Yuno-front-side-card__name-label { letter-spacing: 0.5px; }
        `,
      },

      async yunoCreatePayment(oneTimeToken) {
        state.isPaying = true;
        showOverlay('processing');

        try {
          const resp = await fetch(`/payments?country=${state.country}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              oneTimeToken,
              checkoutSession: state.checkoutSession,
            }),
          }).then((r) => r.json());

          if (resp.error || resp.status === 'ERROR') {
            throw new Error(resp.error_message || 'Payment API error');
          }

          state.yuno.continuePayment();
        } catch (err) {
          console.error('Payment creation failed:', err);
          hideOverlay('processing');
          state.isPaying = false;
          showOverlay('error');
          $('error-message-text').textContent =
            'An unexpected error occurred. Please try again.';
        }
      },

      yunoPaymentMethodSelected(data) {
        console.log('[ÉLARA] Payment method selected:', data);
      },

      yunoPaymentResult(data) {
        state.isPaying = false;
        hideOverlay('processing');
        if (state.yuno) state.yuno.hideLoader?.();

        const status = typeof data === 'string' ? data : (data?.status ?? '');

        switch (status) {
          case 'SUCCEEDED':
          case 'VERIFIED':
            showSuccessState();
            break;
          case 'PENDING':
            showOverlay('pending');
            break;
          case 'REJECTED':
            showErrorState('Your payment was rejected. Please try a different payment method or contact your bank.');
            break;
          case 'DECLINED':
            showErrorState('Your payment was declined. Please verify your card details and try again.');
            break;
          case 'ERROR':
            showErrorState('A payment error occurred. Please try again.');
            break;
          case 'CANCELLED':
          case 'CANCELED_BY_USER':
            // User cancelled — no overlay, just re-enable pay button
            setPayButtonState(true);
            break;
          default:
            // READY_TO_PAY and other statuses — restore normal state
            setPayButtonState(true);
        }
      },

      yunoError(error) {
        state.isPaying = false;
        hideOverlay('processing');
        if (state.yuno) state.yuno.hideLoader?.();

        const errCode = typeof error === 'string' ? error : error?.error;

        if (errCode === 'CANCELED_BY_USER' || errCode === 'CANCELLED') {
          setPayButtonState(true);
          return;
        }

        console.error('[ÉLARA] Yuno error:', error);
        showErrorState('An error occurred processing your payment. Please try again.');
      },
    });

    // Mount the payment methods widget
    state.yuno.mountCheckout();

  } catch (err) {
    console.error('[ÉLARA] Checkout init failed:', err);
    hideSkeleton();
    $('yuno-root').classList.remove('loading');
    setPayButtonState(true);
    showToast('Failed to load payment methods. Please refresh the page.', 'error');
  } finally {
    state.isLoadingCheckout = false;
  }
}

/* ============================================================
   PAY BUTTON HANDLER
   ============================================================ */

function onPayClick() {
  if (state.yuno && !state.isPaying && !state.isLoadingCheckout) {
    state.yuno.startPayment();
  }
}

/* ============================================================
   COUNTRY CHANGE
   ============================================================ */

function onCountryChange(country) {
  state.country = country;
  // Clear the SDK container before re-mounting
  const root = $('yuno-root');
  if (root) root.innerHTML = '';

  loadCheckoutForCountry(country);
}

/* ============================================================
   UI — ORDER SUMMARY
   ============================================================ */

function renderCartItems() {
  const container = $('summary-items');
  if (!container) return;

  container.innerHTML = CART_ITEMS.map((item, i) => `
    <div class="summary-item" role="listitem" style="animation-delay:${i * 0.08}s">
      <div class="item-thumb" style="background:${item.bg}" aria-hidden="true">
        <span style="font-size:26px">${item.emoji}</span>
        <div class="item-qty-badge">${item.qty}</div>
      </div>
      <div class="item-info">
        <div class="item-name">${item.name}</div>
        <div class="item-variant">${item.variant}</div>
        <div class="item-price" id="item-price-${i}">${item.prices[state.country]}</div>
      </div>
    </div>
  `).join('');
}

function updateOrderTotals(country) {
  const t = ORDER_TOTALS[country];
  if (!t) return;

  CART_ITEMS.forEach((item, i) => {
    const el = $(`item-price-${i}`);
    if (el) el.textContent = item.prices[country];
  });

  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set('total-subtotal', t.subtotal);
  set('total-shipping', t.shipping);
  set('total-tax', t.tax);
  set('total-grand', t.grand);
}

/* ============================================================
   UI — COUNTRY SELECTOR
   ============================================================ */

function updateCountryUI(country) {
  $$('#country-selector .country-btn').forEach((btn) => {
    const isActive = btn.dataset.country === country;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}

/* ============================================================
   UI — PAYMENT METHOD CHIPS
   ============================================================ */

function updateMethodChips(country) {
  const cfg = COUNTRIES[country];
  if (!cfg) return;

  const noteEl = $('payment-note-text');
  if (noteEl) noteEl.textContent = cfg.note;

  const chipsEl = $('method-chips');
  if (!chipsEl) return;

  chipsEl.innerHTML = cfg.methods
    .map((m, i) => {
      const dim = cfg.methodsDim[i] ? ' dim' : '';
      const label = cfg.methodsDim[i] ? `${m} <span style="font-size:10px;opacity:.6">(soon)</span>` : m;
      return `<span class="chip${dim}" role="listitem">${label}</span>`;
    })
    .join('');
}

/* ============================================================
   UI — SKELETON / LOADING
   ============================================================ */

function showSkeleton() {
  $('skeleton-wrap')?.classList.add('show');
}

function hideSkeleton() {
  $('skeleton-wrap')?.classList.remove('show');
}

/* ============================================================
   UI — PAY BUTTON STATE
   ============================================================ */

function setPayButtonState(enabled) {
  const btn = $('pay-button');
  if (btn) btn.disabled = !enabled;
}

/* ============================================================
   UI — OVERLAYS
   ============================================================ */

function showOverlay(type) {
  $(`overlay-${type}`)?.classList.add('show');
}

function hideOverlay(type) {
  $(`overlay-${type}`)?.classList.remove('show');
}

function showSuccessState() {
  const ref = 'ÉLARA-' + Date.now().toString().slice(-8).toUpperCase();
  const el = $('order-ref');
  if (el) el.textContent = `Order #${ref}`;
  showOverlay('success');
}

function showErrorState(message) {
  const el = $('error-message-text');
  if (el) el.textContent = message;
  showOverlay('error');
}

/* ============================================================
   UI — TOAST NOTIFICATIONS
   ============================================================ */

function showToast(message, type = 'info') {
  const container = $('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.4"/>
      <path d="M7 4.5v3M7 9.5v.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    </svg>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('in'));

  const remove = () => {
    toast.classList.remove('in');
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 300);
  };

  setTimeout(remove, 4500);
  toast.addEventListener('click', remove);
}

/* ============================================================
   PROMO CODE (UI only demo)
   ============================================================ */

function onPromoApply() {
  const val = $('promo-input')?.value?.trim();
  if (!val) return;
  if (val.toUpperCase() === 'ELARA10') {
    showToast('Promo code applied! 10% off your order.', 'success');
  } else {
    showToast('Invalid promo code. Try ELARA10 for 10% off.', 'error');
  }
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */

document.addEventListener('DOMContentLoaded', init);
window.addEventListener('yuno-sdk-ready', initYunoCheckout);
