const CONFIG = {
  BACKEND_URL: "http://localhost:3030/track-session", // Replace with production backend API URL
  PING_INTERVAL: 60000, // Ping the server every Xms
  POPUP_COOLDOWN: 30000, // Minimum time between visible popups, in ms
  MODAL_DURATION: 10000, // How long the popup stays on screen, in ms
};

// === Load Axios ===
(function loadAxios(callback) {
  if (window.axios) return callback();
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js";
  script.onload = callback;
  document.head.appendChild(script);
})(initTracker);

// === Main Tracking Logic ===
function initTracker() {
  // === Runtime state ===
  let sessionStart = Date.now();
  let previousCartCount = 0;
  let eventBuffer = [];

  // === Persistent state keys ===
  const cooldownKey = "shopify_tracker_last_popup"; // Timestamp of last popup
  const popupKey = "shopify_tracker_popup_visible"; // Whether a popup is currently visible

  // === Utility ===
  function now() {
    return Date.now();
  }

  /**
   * Display the popup modal with the given message
   * Auto-dismisses after duration or if manually closed
   */
  function showMessage(message) {
    clearAllPopups();
    markMessageShown();
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    const modal = document.createElement("div");
    modal.className = `
            shopify-tracker-popup fixed bottom-6 left-6 p-6 rounded-xl z-100 shadow-lg max-w-lg w-[95%] sm:w-[420px]
            ${
              prefersDark
                ? "bg-gray-800 text-white border border-gray-700"
                : "bg-white text-gray-800 border border-gray-200"
            }
        `.trim();

    modal.innerHTML = `
            <div class="text-lg leading-relaxed font-medium">${message}</div>
            <button class="mt-4 text-sm text-blue-500 underline hover:text-blue-700">Close</button>
        `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => (modal.style.opacity = "1"));
    localStorage.setItem(popupKey, "1");

    modal.querySelector("button").onclick = () => {
      modal.remove();
      clearPopupState();
    };

    setTimeout(() => {
      modal.remove();
      clearPopupState();
    }, CONFIG.MODAL_DURATION);
  }

  /**
   * Whether a new popup message can be shown.
   * Ignores cooldown for add-to-cart events (they're higher priority).
   */
  function canShowMessage(reason = "") {
    const lastShown = parseInt(localStorage.getItem(cooldownKey), 10) || 0;
    const isPopupVisible = localStorage.getItem(popupKey) === "1";

    if (reason === "add_to_cart") return true;

    return !isPopupVisible && now() - lastShown > CONFIG.POPUP_COOLDOWN;
  }

  function markMessageShown() {
    localStorage.setItem(cooldownKey, now());
    localStorage.setItem(popupKey, "1");
  }

  function clearPopupState() {
    localStorage.setItem(popupKey, "0");
  }

  function clearAllPopups() {
    document
      .querySelectorAll(".shopify-tracker-popup")
      .forEach((p) => p.remove());
    clearPopupState();
  }

  /**
   * Collect session data, including time on site, current page, and cart info.
   * Includes buffered events like cart changes or page views.
   */
  async function getSessionData(reason) {
    const time_on_site = Math.floor((now() - sessionStart) / 1000);
    const current_page = window.location.pathname;

    try {
      const res = await axios.get("/cart.js");
      const cart = res.data;
      const currentCartCount = cart.items?.length || 0;

      const cartItems = Array.isArray(cart.items)
        ? cart.items.map((item) => ({
            title: item.title,
            quantity: item.quantity,
          }))
        : [];

      // Detect cart changes
      if (currentCartCount !== previousCartCount) {
        eventBuffer.push({
          type: "cart_change",
          delta: currentCartCount - previousCartCount,
          at: now(),
        });
        previousCartCount = currentCartCount;
      }

      if (reason === "page_view" || reason === "home_welcome") {
        eventBuffer.push({
          type: reason,
          url: current_page,
          at: now(),
        });
      }

      return {
        time_on_site,
        current_page,
        cart_items: cartItems,
        current_cart_count: currentCartCount,
        events: [...eventBuffer],
      };
    } catch (err) {
      console.error("Cart fetch error", err);
      return {
        time_on_site,
        current_page,
        cart_items: [],
        current_cart_count: 0,
        events: [],
      };
    } finally {
      eventBuffer = [];
    }
  }

  /**
   * Trigger the tracker manually with a reason (page_view, add_to_cart, etc.)
   * Will skip if not allowed (e.g., due to cooldown), except for add_to_cart events.
   */
  async function triggerTracker(reason = "") {
    if (!canShowMessage(reason)) return;

    const payload = await getSessionData(reason);
    if (!payload) return;

    console.log("DEBUG Payload:", payload);

    try {
      const res = await axios.post(CONFIG.BACKEND_URL, payload);
      const data = res.data;

      if (data?.show && data?.message) {
        showMessage(data.message);
      }
    } catch (err) {
      console.error("Session API error:", err);
    }
  }

  /**
   * Listen for add-to-cart clicks.
   * Triggers an "add_to_cart" event if the item appears in the cart afterward.
   */
  function observeAddToCartClicks() {
    document.body.addEventListener("click", (e) => {
      const btn = e.target.closest("button, input[type='submit']");
      if (!btn) return;

      const form = btn.closest("form");
      const variantInput = form?.querySelector('input[name="id"]');
      const variantId = variantInput?.value;

      const text = (btn.innerText || btn.value || "").toLowerCase();
      if (!text.includes("add to cart")) return;

      // Track the click event immediately
      eventBuffer.push({
        type: "add_to_cart_click",
        at: now(),
        ...(variantId && { variant_id: variantId }),
      });

      // Wait a moment for cart to update, then send the event (always)
      setTimeout(() => {
        clearAllPopups(); // replace whatever message is showing
        triggerTracker("add_to_cart");
      }, 1000);
    });
  }

  // === Initial Triggers ===

  /**
   * Listen for SPA-style page navigation changes
   * Trigger once on load appropriate page view or welcome event message
   */
  const path = window.location.pathname;
  triggerTracker(path === "/" ? "home_welcome" : "page_view");

  async function delayedPageViewTrigger() {
    await new Promise((res) => setTimeout(res, 300));
    triggerTracker("page_view");
  }

  /**
   * Listen for SPA-style page navigation changes
   * Trigger appropriate page view (real page switches)
   */
  let previousPath = window.location.pathname;
  setInterval(() => {
    const currentPath = window.location.pathname;

    if (currentPath === previousPath) return;

    previousPath = currentPath;

    const lastShown = parseInt(localStorage.getItem(cooldownKey), 10) || 0;
    const isPopupVisible = localStorage.getItem(popupKey) === "1";

    const cooldownPassed = now() - lastShown > CONFIG.POPUP_COOLDOWN;
    const canShow = !isPopupVisible && cooldownPassed;

    if (canShow && currentPath !== "/") {
      delayedPageViewTrigger();
    }
  }, 1000);

  // Fire periodic pings every 60s (PING_INTERVAL) — only if allowed to show message
  setInterval(() => {
    if (canShowMessage()) triggerTracker("interval_ping");
  }, CONFIG.PING_INTERVAL);

  // Observe cart button clicks
  observeAddToCartClicks();
}
