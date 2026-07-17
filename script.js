/* =========================================================
   MyDukaan — by M Ijaz
   Vanilla JS + Firebase (compat SDK, no build step needed)
   ========================================================= */

/* ---------- 1. FIREBASE CONFIG ----------
   APNI KEYS YAHAN LAGAYEN - firebase console > project settings se milen gi
   (https://console.firebase.google.com) */
const firebaseConfig = {
  apiKey: "AIzaSyAobgytS0dOyfKdFIG3S8i41y8Hn3vy_Us",
  authDomain: "mydukaan-4a03a.firebaseapp.com",
  projectId: "mydukaan-4a03a",
  storageBucket: "mydukaan-4a03a.firebasestorage.app",
  messagingSenderId: "129569940924",
  appId: "1:129569940924:web:8624e7dd9eeef2a943b7b9"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/* ---------- 2. PAYMENT INFO ----------
   YAHAN APNE ASLI ACCOUNT NUMBERS LIKHEN */
const PAYMENT_INFO = {
  JazzCash: "0300-1234567 — M Ijaz",
  Easypaisa: "0300-1234567 — M Ijaz",
  Bank: "HBL 1234-5678-9012 — M Ijaz"
};

/* ---------- 3. STATE ---------- */
let currentUser = null;
let myItems = [];
let allItems = [];
let receivedOrders = [];
let placedOrders = [];
let cart = [];
let editItemId = null;
let currentPage = "seller";
let ordersView = "received";

/* ---------- 4. DOM SHORTCUTS ---------- */
const $ = (id) => document.getElementById(id);
const authScreen = $("authScreen");
const appShell = $("appShell");

/* ---------- 5. UTILITIES ---------- */
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function money(n) {
  const num = Number(n) || 0;
  return "Rs " + num.toLocaleString("en-PK");
}

let toastTimer = null;
function showToast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2600);
}

function setLoading(on) {
  $("loadingOverlay").classList.toggle("hidden", !on);
}

function cartKey() {
  return currentUser ? `mydukaan_cart_${currentUser.uid}` : null;
}
function saveCart() {
  const key = cartKey();
  if (key) localStorage.setItem(key, JSON.stringify(cart));
}
function loadCart() {
  const key = cartKey();
  cart = key ? JSON.parse(localStorage.getItem(key) || "[]") : [];
}

/* ---------- 6. AUTH ---------- */
let authMode = "login";

$("tabLogin").addEventListener("click", () => setAuthMode("login"));
$("tabSignup").addEventListener("click", () => setAuthMode("signup"));

function setAuthMode(mode) {
  authMode = mode;
  $("tabLogin").classList.toggle("active", mode === "login");
  $("tabSignup").classList.toggle("active", mode === "signup");
  $("authSubmit").textContent = mode === "login" ? "Login" : "Create Account";
  $("authError").classList.add("hidden");
}

$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("authEmail").value.trim();
  const pass = $("authPass").value;
  $("authError").classList.add("hidden");
  setLoading(true);
  try {
    if (authMode === "login") {
      await auth.signInWithEmailAndPassword(email, pass);
    } else {
      await auth.createUserWithEmailAndPassword(email, pass);
    }
  } catch (err) {
    $("authError").textContent = friendlyAuthError(err);
    $("authError").classList.remove("hidden");
  } finally {
    setLoading(false);
  }
});

function friendlyAuthError(err) {
  const code = err && err.code || "";
  if (code.includes("email-already-in-use")) return "Ye email pehle se registered hai. Login karein.";
  if (code.includes("invalid-email")) return "Email sahi format me nahi hai.";
  if (code.includes("weak-password")) return "Password kam az kam 6 characters ka hona chahiye.";
  if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential")) return "Email ya password ghalat hai.";
  return err && err.message ? err.message : "Kuch ghalat ho gaya. Dobara koshish karein.";
}

$("logoutBtn").addEventListener("click", () => auth.signOut());

auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  if (user) {
    authScreen.classList.add("hidden");
    appShell.classList.remove("hidden");
    loadCart();
    updateCartBadge();
    setLoading(true);
    await Promise.all([fetchMyItems(), fetchAllItems(), fetchReceivedOrders(), fetchPlacedOrders()]);
    setLoading(false);
    const requestedPage = new URLSearchParams(location.search).get("page");
    const validPages = ["seller", "bazaar", "cart", "orders"];
    goToPage(validPages.includes(requestedPage) ? requestedPage : "seller");
  } else {
    appShell.classList.add("hidden");
    authScreen.classList.remove("hidden");
    myItems = []; allItems = []; receivedOrders = []; placedOrders = []; cart = [];
  }
});

/* ---------- 7. NAVIGATION ---------- */
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => goToPage(btn.dataset.page));
});

function goToPage(page) {
  currentPage = page;
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  $("page-" + page).classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  if (page === "seller") renderMyItems();
  if (page === "bazaar") renderBazaar();
  if (page === "cart") renderCart();
  if (page === "orders") renderOrders();
}

/* ---------- 8. ITEMS: FETCH ---------- */
async function fetchMyItems() {
  if (!currentUser) return;
  try {
    const snap = await db.collection("items").where("sellerId", "==", currentUser.uid).get();
    myItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    myItems.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (err) {
    console.error(err);
    showToast("Items load karne me masla hua");
  }
}

async function fetchAllItems() {
  try {
    const snap = await db.collection("items").get();
    allItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    allItems.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (err) {
    console.error(err);
    showToast("Bazaar load karne me masla hua");
  }
}

/* ---------- 9. ITEMS: ADD / EDIT / DELETE ---------- */
$("itemImage").addEventListener("change", () => {
  const file = $("itemImage").files[0];
  if (!file) { $("itemImgPreviewWrap").classList.add("hidden"); return; }
  const url = URL.createObjectURL(file);
  $("itemImgPreview").src = url;
  $("itemImgPreviewWrap").classList.remove("hidden");
});

$("itemCancelEdit").addEventListener("click", () => resetItemForm());

function resetItemForm() {
  editItemId = null;
  $("itemForm").reset();
  $("itemImgPreviewWrap").classList.add("hidden");
  $("itemFormTitle").textContent = "Add New Item";
  $("itemSubmitBtn").textContent = "Add Item";
  $("itemCancelEdit").classList.add("hidden");
}

$("itemForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("itemName").value.trim();
  const price = Number($("itemPrice").value);
  const file = $("itemImage").files[0];
  if (!name || price < 0) return;

  setLoading(true);
  try {
    let imgUrl = null;
    if (file) {
      const path = `items/${currentUser.uid}_${Date.now()}_${file.name}`;
      const ref = storage.ref(path);
      await ref.put(file);
      imgUrl = await ref.getDownloadURL();
    }

    if (editItemId) {
      const updates = { name, price };
      if (imgUrl) updates.imgUrl = imgUrl;
      await db.collection("items").doc(editItemId).update(updates);
      showToast("Item update ho gaya");
    } else {
      await db.collection("items").add({
        name, price,
        imgUrl: imgUrl || null,
        sellerId: currentUser.uid,
        sellerEmail: currentUser.email,
        createdAt: Date.now()
      });
      showToast("Item add ho gaya");
    }
    resetItemForm();
    await Promise.all([fetchMyItems(), fetchAllItems()]);
    renderMyItems();
  } catch (err) {
    console.error(err);
    showToast("Item save karne me masla hua");
  } finally {
    setLoading(false);
  }
});

function startEditItem(id) {
  const item = myItems.find((i) => i.id === id);
  if (!item) return;
  editItemId = id;
  $("itemName").value = item.name;
  $("itemPrice").value = item.price;
  $("itemFormTitle").textContent = "Edit Item";
  $("itemSubmitBtn").textContent = "Update Item";
  $("itemCancelEdit").classList.remove("hidden");
  if (item.imgUrl) {
    $("itemImgPreview").src = item.imgUrl;
    $("itemImgPreviewWrap").classList.remove("hidden");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteItemById(id) {
  if (!confirm("Ye item delete karna hai?")) return;
  setLoading(true);
  try {
    await db.collection("items").doc(id).delete();
    showToast("Item delete ho gaya");
    await Promise.all([fetchMyItems(), fetchAllItems()]);
    renderMyItems();
  } catch (err) {
    console.error(err);
    showToast("Delete karne me masla hua");
  } finally {
    setLoading(false);
  }
}

/* ---------- 10. RENDER: MY ITEMS ---------- */
function renderMyItems() {
  const grid = $("myItemsGrid");
  $("myItemsEmpty").classList.toggle("hidden", myItems.length > 0);
  grid.innerHTML = myItems.map(itemCardHtml).join("");
  grid.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => startEditItem(btn.dataset.edit))
  );
  grid.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => deleteItemById(btn.dataset.delete))
  );
}

function itemCardHtml(item) {
  const photo = item.imgUrl
    ? `<img src="${escapeHtml(item.imgUrl)}" alt="${escapeHtml(item.name)}" loading="lazy" />`
    : `<div class="item-photo-wrap no-photo">No Photo</div>`;
  return `
  <div class="item-card">
    <div class="item-photo-wrap">
      ${item.imgUrl ? photo : `<div class="no-photo" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--ink-muted);font-size:12px;">No Photo</div>`}
      <span class="item-watermark">M Ijaz</span>
    </div>
    <div class="item-body">
      <div class="item-name">${escapeHtml(item.name)}</div>
      <div class="item-price">${money(item.price)}</div>
      <div class="item-actions">
        <button class="btn btn-outline" data-edit="${item.id}">Edit</button>
        <button class="btn btn-danger" data-delete="${item.id}">Delete</button>
      </div>
    </div>
  </div>`;
}

/* ---------- 11. RENDER: BAZAAR ---------- */
$("bazaarSearch").addEventListener("input", () => renderBazaar());

function renderBazaar() {
  const q = $("bazaarSearch").value.trim().toLowerCase();
  const list = allItems.filter((i) => !q || i.name.toLowerCase().includes(q));
  const grid = $("bazaarGrid");
  $("bazaarEmpty").classList.toggle("hidden", list.length > 0);
  grid.innerHTML = list.map((item) => {
    const inCart = cart.some((c) => c.id === item.id);
    const isMine = item.sellerId === currentUser.uid;
    const photo = item.imgUrl
      ? `<img src="${escapeHtml(item.imgUrl)}" alt="${escapeHtml(item.name)}" loading="lazy" />`
      : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--ink-muted);font-size:12px;">No Photo</div>`;
    return `
    <div class="item-card">
      <div class="item-photo-wrap">${photo}<span class="item-watermark">M Ijaz</span></div>
      <div class="item-body">
        <div class="item-name">${escapeHtml(item.name)}</div>
        <div class="item-price">${money(item.price)}</div>
        <div class="item-seller">by ${escapeHtml(item.sellerEmail || "seller")}</div>
        <div class="item-actions">
          ${isMine
            ? `<button class="btn btn-ghost" disabled>Your item</button>`
            : `<button class="btn ${inCart ? "btn-ghost" : "btn-primary"}" data-addcart="${item.id}" ${inCart ? "disabled" : ""}>${inCart ? "In Cart" : "Add to Cart"}</button>`
          }
        </div>
      </div>
    </div>`;
  }).join("");

  grid.querySelectorAll("[data-addcart]").forEach((btn) =>
    btn.addEventListener("click", () => addToCart(btn.dataset.addcart))
  );
}

/* ---------- 12. CART ---------- */
function addToCart(itemId) {
  const item = allItems.find((i) => i.id === itemId);
  if (!item) return;
  if (cart.some((c) => c.id === item.id)) {
    showToast("Ye item pehle se cart me hai");
    return;
  }
  if (cart.length > 0 && cart[0].sellerId !== item.sellerId) {
    if (!confirm("Cart me sirf ek dukaandaar ke items ek sath order ho sakte hain. Cart clear karke ye item add karein?")) {
      return;
    }
    cart = [];
  }
  cart.push({
    id: item.id, name: item.name, price: item.price,
    imgUrl: item.imgUrl || null, sellerId: item.sellerId, sellerEmail: item.sellerEmail
  });
  saveCart();
  updateCartBadge();
  showToast("Cart me add ho gaya");
  renderBazaar();
}

function removeFromCart(itemId) {
  cart = cart.filter((c) => c.id !== itemId);
  saveCart();
  updateCartBadge();
  renderCart();
}

function updateCartBadge() {
  const badge = $("cartBadge");
  badge.textContent = cart.length;
  badge.classList.toggle("hidden", cart.length === 0);
}

function renderCart() {
  const list = $("cartList");
  $("cartEmpty").classList.toggle("hidden", cart.length > 0);
  $("cartSummary").classList.toggle("hidden", cart.length === 0);

  list.innerHTML = cart.map((c) => `
    <div class="cart-item">
      <img src="${c.imgUrl ? escapeHtml(c.imgUrl) : ""}" alt="${escapeHtml(c.name)}" onerror="this.style.visibility='hidden'" />
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(c.name)}</div>
        <div class="cart-item-price">${money(c.price)}</div>
      </div>
      <button class="cart-item-remove" data-remove="${c.id}">Remove</button>
    </div>
  `).join("");

  list.querySelectorAll("[data-remove]").forEach((btn) =>
    btn.addEventListener("click", () => removeFromCart(btn.dataset.remove))
  );

  const total = cart.reduce((sum, c) => sum + Number(c.price), 0);
  $("cartTotal").textContent = money(total);
  $("cartSellerNote").textContent = cart[0] ? `Dukaandaar: ${cart[0].sellerEmail || "—"}` : "";

  $("infoJazzCash").textContent = PAYMENT_INFO.JazzCash;
  $("infoEasypaisa").textContent = PAYMENT_INFO.Easypaisa;
  $("infoBank").textContent = PAYMENT_INFO.Bank;
}

document.querySelectorAll("[data-pay]").forEach((btn) => {
  btn.addEventListener("click", () => placeOrder(btn.dataset.pay, btn.dataset.half === "1"));
});

async function placeOrder(paymentMethod, isHalf) {
  if (cart.length === 0) { showToast("Cart khali hai"); return; }
  const fullTotal = cart.reduce((sum, c) => sum + Number(c.price), 0);
  const total = isHalf ? Math.round(fullTotal / 2) : fullTotal;

  setLoading(true);
  try {
    await db.collection("orders").add({
      items: cart,
      total, fullTotal,
      paymentMethod, isHalfPayment: isHalf,
      status: "Pending",
      customerEmail: currentUser.email,
      customerId: currentUser.uid,
      sellerId: cart[0].sellerId,
      createdAt: Date.now()
    });
    cart = [];
    saveCart();
    updateCartBadge();
    showToast(`Order ho gaya — ${paymentMethod}${isHalf ? " (50%)" : ""}`);
    await fetchPlacedOrders();
    goToPage("orders");
    ordersView = "placed";
    switchOrdersView("placed");
  } catch (err) {
    console.error(err);
    showToast("Order place karne me masla hua");
  } finally {
    setLoading(false);
  }
}

/* ---------- 13. ORDERS ---------- */
async function fetchReceivedOrders() {
  if (!currentUser) return;
  try {
    const snap = await db.collection("orders").where("sellerId", "==", currentUser.uid).get();
    receivedOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    receivedOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (err) { console.error(err); }
}

async function fetchPlacedOrders() {
  if (!currentUser) return;
  try {
    const snap = await db.collection("orders").where("customerId", "==", currentUser.uid).get();
    placedOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    placedOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (err) { console.error(err); }
}

$("ordersTabReceived").addEventListener("click", () => switchOrdersView("received"));
$("ordersTabPlaced").addEventListener("click", () => switchOrdersView("placed"));

function switchOrdersView(view) {
  ordersView = view;
  $("ordersTabReceived").classList.toggle("active", view === "received");
  $("ordersTabPlaced").classList.toggle("active", view === "placed");
  renderOrders();
}

function renderOrders() {
  const list = ordersView === "received" ? receivedOrders : placedOrders;
  $("ordersEmpty").classList.toggle("hidden", list.length > 0);
  $("ordersList").innerHTML = list.map((order) => orderCardHtml(order, ordersView === "received")).join("");

  if (ordersView === "received") {
    document.querySelectorAll("[data-status]").forEach((btn) =>
      btn.addEventListener("click", () => updateOrderStatus(btn.dataset.orderid, btn.dataset.status))
    );
  }
}

function orderCardHtml(order, canManage) {
  const itemNames = (order.items || []).map((i) => escapeHtml(i.name)).join(", ");
  const nextSteps = { Pending: "Accepted", Accepted: "Shipped", Shipped: "Delivered" };
  const next = nextSteps[order.status];
  return `
  <div class="order-card status-${escapeHtml(order.status)}">
    <div class="order-row"><span>${canManage ? "Customer" : "Dukaandaar"}</span><strong>${escapeHtml(canManage ? order.customerEmail : (order.sellerEmail || "seller"))}</strong></div>
    <div class="order-items-list">${itemNames}</div>
    <div class="order-row"><span>Total</span><strong>${money(order.total)}${order.isHalfPayment ? ` (50% of ${money(order.fullTotal)})` : ""}</strong></div>
    <div class="order-row"><span>Payment</span><strong>${escapeHtml(order.paymentMethod)}</strong></div>
    <div class="order-row"><span>Status</span><span class="order-status-badge">${escapeHtml(order.status)}</span></div>
    ${canManage && next ? `
    <div class="order-actions">
      <button class="btn btn-primary" data-orderid="${order.id}" data-status="${next}">Mark ${next}</button>
    </div>` : ""}
  </div>`;
}

async function updateOrderStatus(orderId, status) {
  setLoading(true);
  try {
    await db.collection("orders").doc(orderId).update({ status });
    showToast("Order status update ho gaya");
    await fetchReceivedOrders();
    renderOrders();
  } catch (err) {
    console.error(err);
    showToast("Status update karne me masla hua");
  } finally {
    setLoading(false);
  }
}

/* ---------- 14. PWA: SERVICE WORKER + INSTALL ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => console.error("SW register failed", err));
  });
}

let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});
