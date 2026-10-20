/**
 * TUN TEA 20-10 ORDER APP
 * Real-time Collaborative Ordering & Finalizing Dashboard
 * Optimized for Vercel Serverless & High-Density Space-Saving Zalo Tables
 */

// Global State
let menuData = null;
let currentSession = null;
let currentCategory = 'all';
let searchQuery = '';
let selectedDrink = null;
let currentDrinkSubtotal = 0;
let currentQuantity = 1;
let networkInfo = null;

// DOM Elements
const menuGrid = document.getElementById('menu-grid-container');
const categoryFiltersContainer = document.getElementById('category-filters-container');
const searchInput = document.getElementById('menu-search-input');
const btnClearSearch = document.getElementById('btn-clear-search');
const ordersListContainer = document.getElementById('orders-list-container');
const ordersEmptyState = document.getElementById('orders-empty-state');
const tabOrdersBadge = document.getElementById('tab-orders-badge');
const headerCupCount = document.getElementById('header-cup-count');
const headerPromoStatus = document.getElementById('header-promo-status');
const headerLockBadge = document.getElementById('header-lock-badge');

// Promo Tracker elements
const freeCupsCount = document.getElementById('free-cups-count');
const promoProgressFill = document.getElementById('promo-progress-fill');
const promoNextStep = document.getElementById('promo-next-step');

// Sticky Cart Elements
const cartBarCount = document.getElementById('cart-bar-count');
const cartBarTotal = document.getElementById('cart-bar-total');

// Host Tab Elements
const kpiTotalCups = document.getElementById('kpi-total-cups');
const kpiCustomersCount = document.getElementById('kpi-customers-count');
const kpiFreeCups = document.getElementById('kpi-free-cups');
const kpiFreeshipStatus = document.getElementById('kpi-freeship-status');
const kpiTotalAmount = document.getElementById('kpi-total-amount');
const kitchenTableContainer = document.getElementById('kitchen-table-container');
const kitchenListContainer = document.getElementById('kitchen-list-container');
const btnViewTable = document.getElementById('btn-view-table');
const btnViewCards = document.getElementById('btn-view-cards');
const splitBreakdownContainer = document.getElementById('split-breakdown-container');
const shopVietqrImg = document.getElementById('shop-vietqr-img');
const vietqrAmountDisplay = document.getElementById('vietqr-amount-display');
const btnToggleLock = document.getElementById('btn-toggle-lock');
const btnLockIcon = document.getElementById('btn-lock-icon');
const btnLockText = document.getElementById('btn-lock-text');

// Modal Elements
const customizeModal = document.getElementById('customize-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const modalDrinkCategory = document.getElementById('modal-drink-category');
const modalDrinkName = document.getElementById('modal-drink-name');
const modalDrinkPrice = document.getElementById('modal-drink-price');
const modalSizesContainer = document.getElementById('modal-sizes-container');
const sizeOptionsGroup = document.getElementById('size-options-group');
const iceSugarGroup = document.getElementById('ice-sugar-group');
const modalToppingsContainer = document.getElementById('modal-toppings-container');
const modalSubtotalVal = document.getElementById('modal-subtotal-val');
const btnSubmitOrder = document.getElementById('btn-submit-order');

// Quantity Stepper Elements
const orderQty = document.getElementById('order-qty');
const btnQtyMinus = document.getElementById('btn-qty-minus');
const btnQtyPlus = document.getElementById('btn-qty-plus');

// Inputs
const orderCustomerName = document.getElementById('order-customer-name');
const orderWish = document.getElementById('order-wish');
const orderSugar = document.getElementById('order-sugar');
const orderIce = document.getElementById('order-ice');
const orderNote = document.getElementById('order-note');
const btnGenderFemale = document.getElementById('btn-gender-female');
const btnGenderMale = document.getElementById('btn-gender-male');

// Share Modal Elements
const shareModal = document.getElementById('share-modal');
const btnOpenShare = document.getElementById('btn-open-share');
const btnCloseShare = document.getElementById('btn-close-share');
const shareQrImage = document.getElementById('share-qr-image');
const shareUrlInput = document.getElementById('share-url-input');
const btnCopyLink = document.getElementById('btn-copy-link');

// 1. Initialize Application
async function initApp() {
  initPetals();
  restoreSavedCustomerName();
  setupEventListeners();

  try {
    // Load Menu
    const menuRes = await fetch('/api/menu');
    menuData = await menuRes.json();
    renderCategories();
    renderMenu();
  } catch (err) {
    console.warn("Could not load /api/menu from server, checking fallback...", err);
  }

  // Load Session with local storage fallback
  await loadSessionWithFallback();

  try {
    // Load Network Info for QR sharing
    const netRes = await fetch('/api/network-info');
    if (netRes.ok) {
      networkInfo = await netRes.json();
    }
  } catch (e) {
    // Vercel or cloud environment
  }
  setupShareModal();

  // Connect SSE for Real-Time Live Sync (if supported by server environment)
  connectSSE();
}

// Resilient Session Loading (Vercel & Offline Compatible)
async function loadSessionWithFallback() {
  let loadedSession = null;

  try {
    const sessionRes = await fetch('/api/session');
    if (sessionRes.ok) {
      loadedSession = await sessionRes.json();
    }
  } catch (err) {
    console.warn("Network session load skipped, using cached storage:", err);
  }

  const cachedOrders = getCachedOrders();

  if (loadedSession) {
    currentSession = loadedSession;
    // If server session has fewer orders than cached on Vercel cold restart, merge them!
    if (cachedOrders.length > 0 && currentSession.orders.length === 0) {
      currentSession.orders = cachedOrders;
      // Background sync to server
      fetch('/api/session/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: cachedOrders })
      }).catch(() => {});
    }
  } else {
    currentSession = {
      title: "Đơn Trà Sữa Mừng Ngày Phụ Nữ Việt Nam 20-10 🌸",
      hostName: "Trưởng Nhóm / Chủ Xị",
      isLocked: false,
      sponsorMode: "sponsor_women",
      customMessage: "Chúc toàn thể phái đẹp 20-10 luôn rực rỡ, ngọt ngào như ly trà sữa TUN TEA! 💐",
      createdAt: new Date().toISOString(),
      orders: cachedOrders
    };
  }

  saveCachedOrders(currentSession.orders);
  renderSessionState();
}

// 2. Setup Real-time SSE Connection
function connectSSE() {
  try {
    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.session) {
          const prevCount = currentSession ? currentSession.orders.length : 0;
          currentSession = data.session;
          saveCachedOrders(currentSession.orders);
          renderSessionState();

          if (data.type === 'ORDER_ADDED' && currentSession.orders.length > prevCount) {
            const latest = currentSession.orders[currentSession.orders.length - 1];
            showToast(`🌸 ${latest.customerName} vừa đặt: ${latest.drinkName}!`, 'info');
          } else if (data.type === 'LOCK_TOGGLED') {
            showToast(currentSession.isLocked ? "🔒 Chủ xị đã khóa order!" : "🔓 Chủ xị đã mở lại order!", 'warning');
          }
        }
      } catch (e) {
        console.error("SSE parse error", e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      // On Vercel serverless, SSE disconnects after execution, retry gently every 10s
      setTimeout(connectSSE, 10000);
    };
  } catch (err) {
    // Fallback if SSE unavailable
  }
}

// 3. Render Menu & Categories
function renderCategories() {
  if (!menuData || !menuData.categories) return;
  categoryFiltersContainer.innerHTML = menuData.categories.map(cat => `
    <button class="cat-chip ${cat.id === currentCategory ? 'active' : ''}" data-cat-id="${cat.id}">
      <span>${cat.icon}</span> ${cat.name}
    </button>
  `).join('');

  categoryFiltersContainer.querySelectorAll('.cat-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      currentCategory = btn.dataset.catId;
      renderCategories();
      renderMenu();
    });
  });
}

function renderMenu() {
  if (!menuData || !menuData.items) return;

  const filtered = menuData.items.filter(item => {
    const matchesCat = currentCategory === 'all' || item.category === currentCategory;
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.badge && item.badge.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    menuGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">🔍</div>
        <h3>Không tìm thấy món phù hợp</h3>
        <p>Vui lòng thử tìm với từ khóa khác</p>
      </div>
    `;
    return;
  }

  menuGrid.innerHTML = filtered.map(item => {
    let displayPrice = '';
    if (item.sizes) {
      displayPrice = `${formatMoney(item.sizes.M)} <span class="drink-price-sub">/ M</span>`;
    } else {
      displayPrice = formatMoney(item.price);
    }

    const catObj = menuData.categories.find(c => c.id === item.category);
    const catName = catObj ? catObj.name : '';

    return `
      <div class="drink-card" data-drink-id="${item.id}">
        <div class="drink-card-top">
          <div class="drink-header">
            <h3 class="drink-name">${item.name}</h3>
            ${item.badge ? `<span class="drink-badge">${item.badge}</span>` : ''}
          </div>
          <div class="drink-category-tag">
            <span>${catObj ? catObj.icon : '🍵'}</span> ${catName} ${item.size ? `• ${item.size}` : ''}
          </div>
        </div>
        <div class="drink-footer">
          <div class="drink-price">${displayPrice}</div>
          <button class="btn-select-drink" onclick="openDrinkCustomizer('${item.id}')">
            Chọn món +
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// 4. Open Drink Customizer Modal
window.openDrinkCustomizer = function(drinkId) {
  if (currentSession && currentSession.isLocked) {
    showToast("⚠️ Order đã được chốt, không thể thêm món mới!", "warning");
    return;
  }

  const drink = menuData.items.find(i => i.id === drinkId);
  if (!drink) return;

  selectedDrink = { ...drink };
  selectedDrink.chosenSize = drink.sizes ? 'M' : (drink.size || 'L');
  selectedDrink.chosenBasePrice = drink.sizes ? drink.sizes.M : drink.price;
  selectedDrink.chosenToppings = [];

  // Reset Quantity Stepper to 1
  currentQuantity = 1;
  if (orderQty) orderQty.value = 1;

  modalDrinkCategory.innerText = (menuData.categories.find(c => c.id === drink.category) || {}).name || '';
  modalDrinkName.innerText = drink.name;
  modalDrinkPrice.innerText = formatMoney(selectedDrink.chosenBasePrice);

  // Render Sizes if Coffee has M & L
  if (drink.sizes) {
    sizeOptionsGroup.style.display = 'block';
    modalSizesContainer.innerHTML = Object.entries(drink.sizes).map(([sz, pr]) => `
      <div class="size-pill ${sz === 'M' ? 'active' : ''}" data-size="${sz}" data-price="${pr}">
        Size ${sz} (${formatMoney(pr)})
      </div>
    `).join('');

    modalSizesContainer.querySelectorAll('.size-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        modalSizesContainer.querySelectorAll('.size-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        selectedDrink.chosenSize = pill.dataset.size;
        selectedDrink.chosenBasePrice = Number(pill.dataset.price);
        recalcModalSubtotal();
      });
    });
  } else {
    sizeOptionsGroup.style.display = 'none';
  }

  // Ice & Sugar Options
  iceSugarGroup.style.display = drink.hasIceSugar ? 'block' : 'none';

  // Render Toppings
  modalToppingsContainer.innerHTML = menuData.toppings.map(top => `
    <label class="topping-checkbox-label" id="topping-label-${top.id}">
      <div class="topping-left">
        <input type="checkbox" value="${top.id}" data-name="${top.name}" data-price="${top.price}">
        <span>${top.name}</span>
      </div>
      <span class="topping-price-tag">+${formatMoney(top.price)}</span>
    </label>
  `).join('');

  modalToppingsContainer.querySelectorAll('input[type="checkbox"]').forEach(chk => {
    chk.addEventListener('change', () => {
      const parent = chk.closest('.topping-checkbox-label');
      if (chk.checked) {
        parent.classList.add('checked');
        selectedDrink.chosenToppings.push({
          id: chk.value,
          name: chk.dataset.name,
          price: Number(chk.dataset.price)
        });
      } else {
        parent.classList.remove('checked');
        selectedDrink.chosenToppings = selectedDrink.chosenToppings.filter(t => t.id !== chk.value);
      }
      recalcModalSubtotal();
    });
  });

  recalcModalSubtotal();
  customizeModal.classList.add('active');
};

function recalcModalSubtotal() {
  if (!selectedDrink) return;
  const qty = Math.max(1, parseInt(orderQty ? orderQty.value : 1, 10) || 1);
  currentQuantity = qty;
  const toppingTotal = selectedDrink.chosenToppings.reduce((sum, t) => sum + t.price, 0);
  const unitPrice = selectedDrink.chosenBasePrice + toppingTotal;
  currentDrinkSubtotal = unitPrice * qty;
  modalSubtotalVal.innerText = `${formatMoney(currentDrinkSubtotal)} (${qty} ly)`;
}

// 5. Submit Order Item (with Vercel & Offline Resilience)
async function submitOrder() {
  const name = (orderCustomerName.value || '').trim();
  if (!name) {
    showToast("Vui lòng nhập tên của bạn!", "warning");
    orderCustomerName.focus();
    return;
  }

  // Save name for convenience
  localStorage.setItem('tuntea_customer_name', name);

  const genderRadio = document.querySelector('input[name="gender"]:checked');
  const isWoman = genderRadio ? genderRadio.value === 'female' : true;
  const wish = (orderWish.value || '').trim();
  const note = (orderNote.value || '').trim();
  const sugar = selectedDrink.hasIceSugar ? orderSugar.value : 'Mặc định';
  const ice = selectedDrink.hasIceSugar ? orderIce.value : 'Mặc định';
  const qty = Math.max(1, parseInt(orderQty ? orderQty.value : 1, 10) || 1);

  const toppingTotal = selectedDrink.chosenToppings.reduce((sum, t) => sum + t.price, 0);
  const unitPrice = selectedDrink.chosenBasePrice + toppingTotal;

  const orderPayload = {
    id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    customerName: name,
    isWoman,
    drinkId: selectedDrink.id,
    drinkName: selectedDrink.name,
    category: selectedDrink.category,
    size: selectedDrink.chosenSize,
    quantity: qty,
    basePrice: selectedDrink.chosenBasePrice,
    sugar,
    ice,
    toppings: [...selectedDrink.chosenToppings],
    toppingTotal,
    unitPrice,
    totalPrice: unitPrice * qty,
    note,
    wish,
    timestamp: new Date().toISOString()
  };

  btnSubmitOrder.disabled = true;
  btnSubmitOrder.innerText = "Đang thêm...";

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });

    if (res.ok) {
      const result = await res.json();
      if (result.session) {
        currentSession = result.session;
      } else {
        addOrderToLocalSession(orderPayload);
      }
    } else {
      // Vercel serverless read-only or error fallback
      addOrderToLocalSession(orderPayload);
    }
  } catch (err) {
    // Network / Offline fallback
    addOrderToLocalSession(orderPayload);
  } finally {
    saveCachedOrders(currentSession.orders);
    renderSessionState();
    showToast(`🎉 Đã thêm ${qty} ly ${selectedDrink.name} vào danh sách!`, "success");
    customizeModal.classList.remove('active');
    btnSubmitOrder.disabled = false;
    btnSubmitOrder.innerText = "➕ Thêm Vào Danh Sách";
    orderWish.value = '';
    orderNote.value = '';
  }
}

// Local Session Helpers
function addOrderToLocalSession(orderItem) {
  if (!currentSession) currentSession = { orders: [] };
  if (!currentSession.orders) currentSession.orders = [];
  currentSession.orders.push(orderItem);
}

function getCachedOrders() {
  try {
    const data = localStorage.getItem('tuntea_cached_orders');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveCachedOrders(orders) {
  try {
    localStorage.setItem('tuntea_cached_orders', JSON.stringify(orders || []));
  } catch (e) {}
}

// 6. Render Full Session State (Orders, Stats, Host, Split Bill)
function renderSessionState() {
  if (!currentSession) return;

  const orders = currentSession.orders || [];
  let totalCups = 0;
  let totalAmount = 0;

  orders.forEach(o => {
    const qty = Math.max(1, Number(o.quantity) || 1);
    totalCups += qty;
    totalAmount += Number(o.totalPrice) || 0;
  });

  // Update Badges & Counters
  tabOrdersBadge.innerText = totalCups;
  headerCupCount.innerText = `${totalCups} ly`;
  cartBarCount.innerText = totalCups;
  cartBarTotal.innerText = formatMoney(totalAmount);

  // Lock status
  if (currentSession.isLocked) {
    headerLockBadge.className = 'lock-status-badge locked';
    headerLockBadge.innerHTML = '<span class="status-dot red"></span> Đã khóa order';
    btnLockIcon.innerText = '🔓';
    btnLockText.innerText = 'Mở lại Order';
    btnToggleLock.className = 'btn btn-secondary';
  } else {
    headerLockBadge.className = 'lock-status-badge';
    headerLockBadge.innerHTML = '<span class="status-dot green"></span> Đang nhận món';
    btnLockIcon.innerText = '🔒';
    btnLockText.innerText = 'Khóa Order (Chốt sổ)';
    btnToggleLock.className = 'btn btn-warning';
  }

  // 10 Cups Promo Calculation
  const freeCups = Math.floor(totalCups / 10);
  const remainingForNext = 10 - (totalCups % 10);
  const progressPercent = ((totalCups % 10) / 10) * 100;

  freeCupsCount.innerText = freeCups;
  promoProgressFill.style.width = `${progressPercent}%`;

  if (totalCups === 0) {
    promoNextStep.innerText = "Cần thêm 10 ly nữa để được tặng 1 ly miễn phí!";
    headerPromoStatus.innerText = "10 tặng 1";
  } else if (remainingForNext === 10) {
    promoNextStep.innerText = `🎉 Đạt mốc! Đã được tặng ${freeCups} ly miễn phí! Tiếp tục thêm 10 ly để nhận thêm!`;
    headerPromoStatus.innerText = `Đã tặng ${freeCups} ly`;
  } else {
    promoNextStep.innerText = `Chỉ còn ${remainingForNext} ly nữa là được TẶNG THÊM 1 LY MIỄN PHÍ!`;
    headerPromoStatus.innerText = `Còn ${remainingForNext} ly tặng tiếp`;
  }

  // Render Orders Tab
  renderOrdersList(orders);

  // Render Host Tab
  renderHostSummary(orders, totalCups, totalAmount, freeCups);
}

// 7. Render Orders List Tab (Grouped by Customer)
function renderOrdersList(orders) {
  if (orders.length === 0) {
    ordersEmptyState.style.display = 'block';
    ordersListContainer.innerHTML = '';
    return;
  }

  ordersEmptyState.style.display = 'none';

  // Group by customer
  const grouped = {};
  orders.forEach(o => {
    if (!grouped[o.customerName]) {
      grouped[o.customerName] = {
        name: o.customerName,
        isWoman: o.isWoman,
        items: [],
        subtotal: 0,
        totalQty: 0
      };
    }
    const qty = Math.max(1, Number(o.quantity) || 1);
    grouped[o.customerName].items.push(o);
    grouped[o.customerName].subtotal += (o.totalPrice || 0);
    grouped[o.customerName].totalQty += qty;
  });

  ordersListContainer.innerHTML = Object.values(grouped).map(group => `
    <div class="customer-group-card">
      <div class="customer-group-header">
        <div class="customer-name-tag">
          <span class="gender-icon ${group.isWoman ? 'female' : 'male'}">
            ${group.isWoman ? '🌸' : '🧔'}
          </span>
          <span>${group.name}</span>
          <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal;">(${group.totalQty} ly)</span>
          ${group.isWoman ? '<span class="badge-2010" style="font-size: 0.65rem;">Phái đẹp</span>' : ''}
        </div>
        <div class="customer-subtotal">
          ${formatMoney(group.subtotal)}
        </div>
      </div>

      <div class="customer-items-list">
        ${group.items.map(item => {
          const qty = Math.max(1, Number(item.quantity) || 1);
          return `
            <div class="order-item-row">
              <div class="order-item-details">
                <div class="order-item-title">
                  ${qty > 1 ? `<span class="col-qty" style="margin-right: 6px;">${qty}x</span>` : ''}
                  ${item.drinkName} (${item.size})
                </div>
                <div class="order-item-specs">
                  <span class="spec-badge">🍬 ${item.sugar}</span>
                  <span class="spec-badge">🧊 ${item.ice}</span>
                  ${item.note ? `<span class="spec-badge" style="color: var(--primary);">📝 ${item.note}</span>` : ''}
                </div>
                ${item.toppings && item.toppings.length > 0 ? `
                  <div class="order-item-toppings">
                    + Topping: ${item.toppings.map(t => t.name).join(', ')}
                  </div>
                ` : ''}
                ${item.wish ? `
                  <div class="order-item-wish">
                    💌 "${item.wish}"
                  </div>
                ` : ''}
              </div>

              <div class="order-item-actions">
                <div class="order-item-price">${formatMoney(item.totalPrice)}</div>
                ${!currentSession.isLocked ? `
                  <button class="btn-item-delete" onclick="deleteOrderItem('${item.id}')" title="Xóa món này">
                    🗑️
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
}

// 8. Delete Order Item
window.deleteOrderItem = async function(orderId) {
  if (currentSession && currentSession.isLocked) {
    showToast("⚠️ Order đã bị khóa!", "warning");
    return;
  }

  if (!confirm("Bạn có chắc chắn muốn xóa món này khỏi danh sách?")) return;

  try {
    await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
  } catch (err) {}

  currentSession.orders = (currentSession.orders || []).filter(o => o.id !== orderId);
  saveCachedOrders(currentSession.orders);
  renderSessionState();
  showToast("Đã xóa món khỏi danh sách", "info");
};

// 9. Render Host Summary (High-Density Table & Split Bill)
function renderHostSummary(orders, totalCups, totalAmount, freeCups) {
  // KPIs
  kpiTotalCups.innerText = `${totalCups} ly`;
  const uniqueCustomers = new Set(orders.map(o => o.customerName)).size;
  kpiCustomersCount.innerText = `${uniqueCustomers} người tham gia`;
  kpiFreeCups.innerText = `Tặng ${freeCups} ly`;

  if (totalCups >= 3) {
    kpiFreeshipStatus.innerText = "✅ Đủ điều kiện FREESHIP (<2km)";
    kpiFreeshipStatus.style.color = "var(--success)";
  } else {
    kpiFreeshipStatus.innerText = "Chưa đủ 3 ly freeship";
    kpiFreeshipStatus.style.color = "var(--text-light)";
  }

  kpiTotalAmount.innerText = formatMoney(totalAmount);

  // Group drinks for high-density barista table
  const kitchenMap = {};
  orders.forEach(o => {
    const qty = Math.max(1, Number(o.quantity) || 1);
    const key = `${o.drinkName} (${o.size})`;
    if (!kitchenMap[key]) {
      kitchenMap[key] = {
        name: o.drinkName,
        size: o.size,
        basePrice: o.basePrice || 0,
        count: 0,
        subtotal: 0,
        variants: []
      };
    }
    kitchenMap[key].count += qty;
    kitchenMap[key].subtotal += (o.totalPrice || 0);

    // Compact spec
    let variantDesc = `${o.sugar}, ${o.ice}`;
    if (o.toppings && o.toppings.length > 0) {
      variantDesc += ` + ${o.toppings.map(t => t.name).join(', ')}`;
    }
    if (o.note) {
      variantDesc += ` [${o.note}]`;
    }
    kitchenMap[key].variants.push({ desc: variantDesc, qty, customer: o.customerName });
  });

  const kitchenItems = Object.values(kitchenMap);

  if (kitchenItems.length === 0) {
    kitchenTableContainer.innerHTML = '<div class="empty-state" style="padding: 24px;">Chưa có món nào để tổng hợp</div>';
    kitchenListContainer.innerHTML = '<div class="empty-state" style="padding: 24px;">Chưa có món nào để tổng hợp</div>';
  } else {
    // 1. HIGH-DENSITY COMPACT TABLE VIEW (Tiết kiệm giấy, mật độ cao)
    kitchenTableContainer.innerHTML = `
      <table class="compact-dense-table">
        <thead>
          <tr>
            <th class="col-stt">STT</th>
            <th>Tên Món & Size</th>
            <th style="text-align: center;">SL</th>
            <th>Chi Tiết (Đường/Đá & Topping)</th>
            <th style="text-align: right;">Thành Tiền</th>
          </tr>
        </thead>
        <tbody>
          ${kitchenItems.map((item, idx) => {
            const vCounts = {};
            item.variants.forEach(v => {
              vCounts[v.desc] = (vCounts[v.desc] || 0) + v.qty;
            });

            return `
              <tr>
                <td class="col-stt">${String(idx + 1).padStart(2, '0')}</td>
                <td class="col-name">${item.name} <span style="color: var(--text-light); font-weight: normal;">(${item.size})</span></td>
                <td style="text-align: center;"><span class="col-qty">${item.count}</span></td>
                <td class="col-specs">
                  ${Object.entries(vCounts).map(([desc, cnt]) => `
                    <div class="spec-line">
                      <span class="spec-qty-tag">${cnt}x</span> ${desc}
                    </div>
                  `).join('')}
                </td>
                <td class="col-subtotal">${formatMoney(item.subtotal)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="background: #fff1f2; font-weight: 800; border-top: 2px solid #fecdd3;">
            <td colspan="2" style="text-align: right; padding: 10px;">TỔNG CỘNG:</td>
            <td style="text-align: center; color: var(--primary); font-size: 1.05rem;">${totalCups} ly</td>
            <td style="font-size: 0.8rem; color: var(--tea-amber);">
              ${freeCups > 0 ? `🎁 TẶNG ${freeCups} LY MIỄN PHÍ` : 'Cần thêm ' + (10 - (totalCups % 10)) + ' ly để tặng ly đầu'}
            </td>
            <td style="text-align: right; color: var(--primary); font-size: 1.1rem; padding: 10px;">${formatMoney(totalAmount)}</td>
          </tr>
        </tfoot>
      </table>
    `;

    // 2. Fallback Cards View
    kitchenListContainer.innerHTML = kitchenItems.map(k => {
      const vCounts = {};
      k.variants.forEach(v => { vCounts[v.desc] = (vCounts[v.desc] || 0) + v.qty; });
      return `
        <div class="kitchen-item">
          <div class="kitchen-item-top">
            <span class="kitchen-item-name">${k.name} (${k.size})</span>
            <span class="kitchen-item-qty">${k.count} ly</span>
          </div>
          <ul class="kitchen-variants">
            ${Object.entries(vCounts).map(([desc, cnt]) => `
              <li><strong>${cnt} ly:</strong> ${desc}</li>
            `).join('')}
          </ul>
        </div>
      `;
    }).join('');
  }

  // Split Bill Calculations
  renderSplitBill(orders, totalAmount);

  // VietQR Code for Tun Tea
  vietqrAmountDisplay.innerText = formatMoney(totalAmount);
  const vcbQrUrl = `https://img.vietqr.io/image/970436-0411001079352-compact2.png?amount=${totalAmount}&addInfo=TUNTEA%202010&accountName=NGUYEN%20THANH%20TUAN`;
  shopVietqrImg.src = vcbQrUrl;
}

// 10. Split Bill Breakdown
function renderSplitBill(orders, totalAmount) {
  const mode = document.querySelector('input[name="sponsorMode"]:checked')?.value || 'sponsor_women';

  // Group by customer
  const people = {};
  orders.forEach(o => {
    if (!people[o.customerName]) {
      people[o.customerName] = { name: o.customerName, isWoman: o.isWoman, subtotal: 0, itemsCount: 0 };
    }
    const qty = Math.max(1, Number(o.quantity) || 1);
    people[o.customerName].subtotal += (o.totalPrice || 0);
    people[o.customerName].itemsCount += qty;
  });

  const peopleList = Object.values(people);
  const womenList = peopleList.filter(p => p.isWoman);
  const menList = peopleList.filter(p => !p.isWoman);

  let html = '';

  if (peopleList.length === 0) {
    splitBreakdownContainer.innerHTML = '<div style="color: var(--text-light); text-align: center; padding: 12px;">Chưa có dữ liệu chia tiền</div>';
    return;
  }

  if (mode === 'sponsor_all') {
    html = `
      <div style="background: #ecfdf5; color: #065f46; padding: 12px; border-radius: 8px; margin-bottom: 10px; font-weight: 700; text-align: center;">
        🎉 Công ty / Mạnh thường quân bao toàn bộ đơn hàng! Mọi người được thưởng thức miễn phí!
      </div>
    `;
    peopleList.forEach(p => {
      html += `
        <div class="split-row">
          <span>${p.isWoman ? '🌸' : '🧔'} ${p.name} (${p.itemsCount} ly)</span>
          <span class="split-free-tag">Được bao: 0 đ</span>
        </div>
      `;
    });
  } else if (mode === 'sponsor_women') {
    const womenTotal = womenList.reduce((s, p) => s + p.subtotal, 0);
    const menTotal = menList.reduce((s, p) => s + p.subtotal, 0);
    const totalToPayByMen = womenTotal + menTotal;
    const splitPerMan = menList.length > 0 ? Math.ceil(totalToPayByMen / menList.length) : 0;

    html = `
      <div style="background: #fff1f2; color: #be123c; padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; font-size: 0.85rem;">
        🌸 <strong>20-10 Ngọt ngào:</strong> Chị em phụ nữ được mời 100%!
        ${menList.length > 0 ? `<br>Tổng tiền chia đều cho ${menList.length} nam: <strong>${formatMoney(splitPerMan)} / người</strong>.` : '<br>(Chưa có bạn nam nào trong danh sách để chia)'}
      </div>
    `;

    peopleList.forEach(p => {
      if (p.isWoman) {
        html += `
          <div class="split-row">
            <span>🌸 ${p.name} (${p.itemsCount} ly)</span>
            <span class="split-free-tag">🌸 20-10 Miễn phí: 0 đ</span>
          </div>
        `;
      } else {
        html += `
          <div class="split-row">
            <span>🧔 ${p.name} (${p.itemsCount} ly)</span>
            <span style="font-weight: 800; color: var(--primary);">${formatMoney(splitPerMan)}</span>
          </div>
        `;
      }
    });
  } else {
    // Exact split per person
    peopleList.forEach(p => {
      html += `
        <div class="split-row">
          <span>${p.isWoman ? '🌸' : '🧔'} ${p.name} (${p.itemsCount} ly)</span>
          <span style="font-weight: 800;">${formatMoney(p.subtotal)}</span>
        </div>
      `;
    });
  }

  splitBreakdownContainer.innerHTML = html;
}

// 11. Format & Copy Order Text: HIGH DENSITY COMPACT TABLE FOR ZALO
function generateShopTableText() {
  if (!currentSession || currentSession.orders.length === 0) {
    return "Danh sách order hiện đang trống!";
  }

  const orders = currentSession.orders;
  let totalCups = 0;
  const totalAmount = orders.reduce((s, o) => s + (o.totalPrice || 0), 0);

  // Group drinks
  const kitchenMap = {};
  orders.forEach(o => {
    const qty = Math.max(1, Number(o.quantity) || 1);
    totalCups += qty;
    const key = `${o.drinkName} (${o.size})`;
    if (!kitchenMap[key]) {
      kitchenMap[key] = { name: o.drinkName, size: o.size, count: 0, variants: [] };
    }
    kitchenMap[key].count += qty;

    // Compact spec description
    let sDesc = o.sugar ? o.sugar.replace(' Đường', 'Đ').replace(' (Chuẩn)', '').replace(' (Vừa)', '').replace(' (Ít ngọt)', '').replace(' (Không đường)', '') : 'Chuẩn';
    let iDesc = o.ice ? o.ice.replace(' Đá', 'Đá').replace(' (Chuẩn)', '').replace(' (Ít đá)', '') : 'Chuẩn';

    let v = '';
    if (sDesc === 'Chuẩn' && iDesc === 'Chuẩn') {
      v = 'Chuẩn vị';
    } else {
      v = `${sDesc} ${iDesc}`.trim();
    }

    if (o.toppings && o.toppings.length > 0) {
      v += ` +${o.toppings.map(t => t.name.replace('Trân châu ', 'TC ').replace('Cheese Ball (3 viên)', 'CheeseBall')).join('+')}`;
    }
    if (o.note) v += ` [${o.note}]`;

    kitchenMap[key].variants.push({ desc: v, qty });
  });

  const freeCups = Math.floor(totalCups / 10);

  let text = `🌸 ĐƠN TRÀ SỮA TUN TEA 20-10 🌸\n`;
  text += `⏰ ${new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})} ngày ${new Date().toLocaleDateString('vi-VN')} | 🧋 ${totalCups} ly`;
  if (freeCups > 0) text += ` (🎁 TẶNG ${freeCups} LY)`;
  if (totalCups >= 3) text += ` | 🛵 Freeship <2km`;
  text += `\n============================================================\n`;
  text += `STT | MÓN & SIZE           | SL | QUY CÁCH (ĐƯỜNG/ĐÁ/TOPPING)\n`;
  text += `----+----------------------+----+---------------------------\n`;

  let idx = 1;
  for (const [key, item] of Object.entries(kitchenMap)) {
    const stt = String(idx).padStart(2, '0');
    const namePadded = item.name.length > 17 ? item.name.substring(0, 15) + '..' : item.name;
    const fullItemName = `${namePadded} (${item.size})`.padEnd(20, ' ');
    const qtyStr = String(item.count).padStart(2, ' ');

    const vCounts = {};
    item.variants.forEach(v => {
      vCounts[v.desc] = (vCounts[v.desc] || 0) + v.qty;
    });

    const vKeys = Object.keys(vCounts);
    if (vKeys.length === 1 && item.count === 1) {
      text += `${stt}  | ${fullItemName} | ${qtyStr} | ${vKeys[0]}\n`;
    } else {
      text += `${stt}  | ${fullItemName} | ${qtyStr} | ${vCounts[vKeys[0]]}x ${vKeys[0]}\n`;
      for (let i = 1; i < vKeys.length; i++) {
        text += `    |                      |    | ${vCounts[vKeys[i]]}x ${vKeys[i]}\n`;
      }
    }
    idx++;
  }

  text += `============================================================\n`;
  text += `💰 TỔNG TIỀN: ${formatMoney(totalAmount)}\n`;
  text += `🏦 Vietcombank: 0411001079352 - NGUYEN THANH TUAN\n`;
  text += `📍 Giao đến: [Vui lòng điền địa chỉ công ty/phòng ban]\n`;
  text += `📞 SĐT người nhận: [Vui lòng điền số điện thoại]\n`;
  text += `Chúc Quán TUN TEA ngày 20-10 luôn đông khách! 💖`;

  return text;
}

// Format Detailed Order Text (Alternative view)
function generateShopOrderText() {
  if (!currentSession || currentSession.orders.length === 0) {
    return "Danh sách order hiện đang trống!";
  }

  const orders = currentSession.orders;
  let totalCups = 0;
  orders.forEach(o => { totalCups += Math.max(1, Number(o.quantity) || 1); });
  const totalAmount = orders.reduce((s, o) => s + (o.totalPrice || 0), 0);
  const freeCups = Math.floor(totalCups / 10);

  const kitchenMap = {};
  orders.forEach(o => {
    const qty = Math.max(1, Number(o.quantity) || 1);
    const key = `${o.drinkName} (${o.size})`;
    if (!kitchenMap[key]) {
      kitchenMap[key] = { name: o.drinkName, size: o.size, count: 0, variants: [] };
    }
    kitchenMap[key].count += qty;

    let v = `${o.sugar}, ${o.ice}`;
    if (o.toppings && o.toppings.length > 0) {
      v += ` + ${o.toppings.map(t => t.name).join(', ')}`;
    }
    if (o.note) v += ` [${o.note}]`;
    kitchenMap[key].variants.push({ desc: v, qty });
  });

  let text = `🌸 ĐƠN HÀNG TUN TEA (MỪNG 20-10) 🌸\n`;
  text += `⏰ Thời gian đặt: ${new Date().toLocaleTimeString('vi-VN')} ngày ${new Date().toLocaleDateString('vi-VN')}\n`;
  text += `🥤 Tổng số lượng: ${totalCups} ly\n`;
  if (freeCups > 0) {
    text += `🎁 Ưu đãi áp dụng: TẶNG ${freeCups} LY MIỄN PHÍ (Chương trình 10 ly tặng 1)\n`;
  }
  if (totalCups >= 3) {
    text += `🛵 Freeship: Đơn trên 3 ly freeship <2km\n`;
  }
  text += `------------------------------------\n`;
  text += `📋 CHI TIẾT PHA CHẾ:\n\n`;

  let idx = 1;
  for (const [key, item] of Object.entries(kitchenMap)) {
    text += `${idx}. ${item.name} (${item.size}) - TỔNG: ${item.count} ly\n`;
    const vCounts = {};
    item.variants.forEach(v => { vCounts[v.desc] = (vCounts[v.desc] || 0) + v.qty; });
    for (const [vDesc, cnt] of Object.entries(vCounts)) {
      text += `   • ${cnt} ly: ${vDesc}\n`;
    }
    text += `\n`;
    idx++;
  }

  text += `------------------------------------\n`;
  text += `💰 TỔNG TIỀN: ${formatMoney(totalAmount)}\n`;
  text += `💳 Hình thức: Chuyển khoản Vietcombank (0411001079352 - NGUYEN THANH TUAN)\n`;
  text += `📍 Địa chỉ nhận hàng: [Vui lòng nhắn địa chỉ của bạn]\n`;
  text += `📞 SĐT người nhận: [Vui lòng nhắn SĐT của bạn]\n\n`;
  text += `Nhờ Quán Tun Tea làm giúp bên mình nhé! Chúc quán 20-10 đắt khách! ❤️`;

  return text;
}

// 12. Setup Event Listeners
function setupEventListeners() {
  // Tab Switching
  document.querySelectorAll('.app-tabs-nav .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Search input
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    btnClearSearch.classList.toggle('hidden', !searchQuery);
    renderMenu();
  });

  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    btnClearSearch.classList.add('hidden');
    renderMenu();
  });

  // Quantity Stepper buttons
  if (btnQtyMinus) {
    btnQtyMinus.addEventListener('click', () => {
      let val = parseInt(orderQty.value, 10) || 1;
      if (val > 1) {
        orderQty.value = val - 1;
        recalcModalSubtotal();
      }
    });
  }

  if (btnQtyPlus) {
    btnQtyPlus.addEventListener('click', () => {
      let val = parseInt(orderQty.value, 10) || 1;
      if (val < 50) {
        orderQty.value = val + 1;
        recalcModalSubtotal();
      }
    });
  }

  if (orderQty) {
    orderQty.addEventListener('change', () => {
      let val = parseInt(orderQty.value, 10) || 1;
      if (val < 1) val = 1;
      if (val > 50) val = 50;
      orderQty.value = val;
      recalcModalSubtotal();
    });
  }

  // Gender Toggle
  btnGenderFemale.addEventListener('click', () => {
    btnGenderFemale.classList.add('active');
    btnGenderMale.classList.remove('active');
  });
  btnGenderMale.addEventListener('click', () => {
    btnGenderMale.classList.add('active');
    btnGenderFemale.classList.remove('active');
  });

  // Modal Close
  btnCloseModal.addEventListener('click', () => customizeModal.classList.remove('active'));
  customizeModal.addEventListener('click', (e) => {
    if (e.target === customizeModal) customizeModal.classList.remove('active');
  });

  // Submit Order
  btnSubmitOrder.addEventListener('click', submitOrder);

  // Quick Order Tab Button
  const btnQuickOrder = document.getElementById('btn-quick-order-tab');
  if (btnQuickOrder) {
    btnQuickOrder.addEventListener('click', () => switchTab('tab-menu'));
  }

  // Sponsor Mode Change
  document.querySelectorAll('input[name="sponsorMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (currentSession) {
        const orders = currentSession.orders || [];
        const totalAmount = orders.reduce((s, o) => s + (o.totalPrice || 0), 0);
        renderSplitBill(orders, totalAmount);
      }
    });
  });

  // View Mode Toggle (Table vs Cards)
  if (btnViewTable && btnViewCards) {
    btnViewTable.addEventListener('click', () => {
      btnViewTable.classList.add('active');
      btnViewCards.classList.remove('active');
      kitchenTableContainer.classList.remove('hidden');
      kitchenListContainer.classList.add('hidden');
    });

    btnViewCards.addEventListener('click', () => {
      btnViewCards.classList.add('active');
      btnViewTable.classList.remove('active');
      kitchenListContainer.classList.remove('hidden');
      kitchenTableContainer.classList.add('hidden');
    });
  }

  // Copy Compact Table Text for Zalo
  const btnCopyShopTable = document.getElementById('btn-copy-shop-table');
  if (btnCopyShopTable) {
    btnCopyShopTable.addEventListener('click', () => {
      const text = generateShopTableText();
      copyText(text);
      showToast("📋 Đã sao chép BẢNG GỌN gửi Zalo (tiết kiệm dòng)! Bạn có thể dán ngay.", "success");
    });
  }

  // Copy Detailed Order Text for Shop
  const btnCopyShop = document.getElementById('btn-copy-shop-order');
  if (btnCopyShop) {
    btnCopyShop.addEventListener('click', () => {
      const text = generateShopOrderText();
      copyText(text);
      showToast("📝 Đã sao chép Danh Sách Đầy Đủ gửi Zalo!", "success");
    });
  }

  // Lock / Unlock Session
  btnToggleLock.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/session/lock', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        currentSession.isLocked = data.isLocked;
        renderSessionState();
      }
    } catch (err) {
      currentSession.isLocked = !currentSession.isLocked;
      renderSessionState();
    }
  });

  // Reset Session
  const btnReset = document.getElementById('btn-reset-session');
  btnReset.addEventListener('click', async () => {
    if (!confirm("⚠️ Bạn có chắc chắn muốn bắt đầu đơn mới? Danh sách cũ sẽ được lưu trữ tự động.")) return;
    try {
      await fetch('/api/session/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: "Đơn Trà Sữa Mừng Ngày Phụ Nữ Việt Nam 20-10 🌸" })
      });
    } catch (err) {}

    currentSession.orders = [];
    saveCachedOrders([]);
    renderSessionState();
    showToast("Đã khởi tạo đơn mới!", "success");
  });

  // Share Modal
  btnOpenShare.addEventListener('click', () => shareModal.classList.add('active'));
  btnCloseShare.addEventListener('click', () => shareModal.classList.remove('active'));
  shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) shareModal.classList.remove('active');
  });

  btnCopyLink.addEventListener('click', () => {
    copyText(shareUrlInput.value);
    showToast("Đã sao chép link đặt món!", "success");
  });

  // Print Order (Formatted as clean high-density table)
  const btnPrint = document.getElementById('btn-print-order');
  btnPrint.addEventListener('click', () => {
    const printArea = document.getElementById('print-area');
    printArea.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 15px; font-size: 11pt;">
        <h2 style="text-align: center; margin-bottom: 2px;">TUN TEA - PHIẾU CHỐT ĐƠN 20-10</h2>
        <p style="text-align: center; font-size: 9pt; color: #555; margin-bottom: 10px;">32 Nguyễn Thái Học, Dĩ An, Bình Dương • SĐT: 0975 270 399</p>
        <div style="margin-bottom: 12px;">
          ${kitchenTableContainer.innerHTML}
        </div>
        <div style="margin-top: 10px; font-size: 10pt;">
          <strong>Hình thức thanh toán:</strong> Chuyển khoản Vietcombank (0411001079352 - NGUYEN THANH TUAN)<br>
          <strong>Thời gian in phiếu:</strong> ${new Date().toLocaleString('vi-VN')}
        </div>
      </div>
    `;
    window.print();
  });

  // Export CSV
  const btnExport = document.getElementById('btn-export-csv');
  btnExport.addEventListener('click', exportToCSV);
}

// 13. Export to CSV (Excel compatible)
function exportToCSV() {
  if (!currentSession || currentSession.orders.length === 0) {
    showToast("Chưa có đơn hàng để xuất file", "warning");
    return;
  }

  let csv = "\uFEFF"; // UTF-8 BOM for Excel
  csv += "STT,Người Đặt,Giới Tính,Tên Món,Size,Số Lượng,Đường,Đá,Topping,Ghi Chú,Lời Chúc 20-10,Đơn Giá (VNĐ),Tổng Tiền (VNĐ)\n";

  currentSession.orders.forEach((o, index) => {
    const qty = Math.max(1, Number(o.quantity) || 1);
    const toppingsStr = o.toppings ? o.toppings.map(t => t.name).join(' + ') : '';
    csv += `"${index + 1}","${o.customerName}","${o.isWoman ? 'Nữ' : 'Nam'}","${o.drinkName}","${o.size}","${qty}","${o.sugar}","${o.ice}","${toppingsStr}","${o.note || ''}","${o.wish || ''}","${o.unitPrice || o.basePrice}","${o.totalPrice}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `TUN_TEA_Order_20-10_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("📊 Đã tải xuống file CSV thành công!", "success");
}

// 14. Setup Share Modal with Real QR Code
function setupShareModal() {
  const currentOrigin = window.location.origin;
  const shareUrl = networkInfo && networkInfo.url ? networkInfo.url : currentOrigin;
  shareUrlInput.value = shareUrl;
  shareQrImage.src = `/api/qr?text=${encodeURIComponent(shareUrl)}`;
}

// 15. Tab Switching Utility
window.switchTab = function(tabId) {
  document.querySelectorAll('.app-tabs-nav .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === tabId);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// 16. Utility Helpers
function formatMoney(amount) {
  return (amount || 0).toLocaleString('vi-VN') + ' đ';
}

function restoreSavedCustomerName() {
  const saved = localStorage.getItem('tuntea_customer_name');
  if (saved && orderCustomerName) {
    orderCustomerName.value = saved;
  }
}

window.copyText = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("Đã sao chép vào bộ nhớ tạm!", "info");
  }).catch(() => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast("Đã sao chép!", "info");
  });
};

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// 17. Falling Flower Petals Canvas Effect
function initPetals() {
  const canvas = document.getElementById('petals-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let animationFrameId;
  let isRunning = true;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  const petalsCount = 28;
  const petals = [];
  const petalColors = [
    'rgba(255, 182, 193, 0.8)',
    'rgba(255, 192, 203, 0.85)',
    'rgba(244, 63, 94, 0.65)',
    'rgba(251, 113, 133, 0.7)',
    'rgba(254, 205, 211, 0.8)'
  ];

  for (let i = 0; i < petalsCount; i++) {
    petals.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      size: Math.random() * 8 + 8,
      speedX: Math.random() * 1.5 - 0.75,
      speedY: Math.random() * 1.2 + 0.8,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 1.5,
      color: petalColors[Math.floor(Math.random() * petalColors.length)]
    });
  }

  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-p.size / 2, -p.size, -p.size, -p.size / 2, 0, p.size);
    ctx.bezierCurveTo(p.size, -p.size / 2, p.size / 2, -p.size, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  function render() {
    if (!isRunning) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    petals.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotationSpeed;

      if (p.y > canvas.height + 20) {
        p.y = -20;
        p.x = Math.random() * canvas.width;
      }
      if (p.x > canvas.width + 20) p.x = -20;
      if (p.x < -20) p.x = canvas.width + 20;

      drawPetal(p);
    });

    animationFrameId = requestAnimationFrame(render);
  }

  render();

  // Toggle button
  const btnToggle = document.getElementById('btn-toggle-petals');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      isRunning = !isRunning;
      if (isRunning) {
        render();
        btnToggle.style.opacity = '1';
        showToast("🌸 Đã bật hiệu ứng hoa rơi 20-10", "info");
      } else {
        cancelAnimationFrame(animationFrameId);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        btnToggle.style.opacity = '0.5';
        showToast("Đã tắt hiệu ứng hoa rơi", "info");
      }
    });
  }
}

// Run on load
document.addEventListener('DOMContentLoaded', initApp);
