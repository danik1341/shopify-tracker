// === Config ===
const CONFIG = {
  BACKEND_URL: "http://localhost:3030/track-session", // ← Replace this in production
  PING_INTERVAL: 10000, // ms
  POPUP_COOLDOWN: 30000, // ms
};

// === Load Axios from CDN ===
(function loadAxios(callback) {
  if (window.axios) return callback();
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js";
  script.onload = callback;
  document.head.appendChild(script);
})(initTracker);

// === Main Tracker ===
function initTracker() {
  let sessionStart = Date.now();
  let previousCartCount = 0;
  let lastPopupTime = 0;
  let eventBuffer = [];

  async function getSessionData() {
    const timeOnSite = Math.floor((Date.now() - sessionStart) / 1000);
    const currentPage = window.location.pathname;

    try {
      const res = await axios.get("/cart.js");
      const cart = res.data;
      const currentCartCount = cart.items?.length || 0;

      // Detect cart changes
      if (currentCartCount !== previousCartCount) {
        eventBuffer.push({
          type: "cart_change",
          delta: currentCartCount - previousCartCount,
          at: Date.now(),
        });
        previousCartCount = currentCartCount;
      }

      // Always log page view
      eventBuffer.push({
        type: "page_view",
        url: currentPage,
        at: Date.now(),
      });

      const payload = {
        time_on_site: timeOnSite,
        current_page: currentPage,
        cart_items: currentCartCount,
        events: [...eventBuffer],
      };

      // Clear event buffer after sending
      eventBuffer = [];

      return payload;
    } catch (err) {
      console.error("Cart fetch error", err);
      return {
        time_on_site: timeOnSite,
        current_page: currentPage,
        cart_items: 0,
        events: [],
      };
    }
  }

  async function sendSessionData() {
    try {
      const payload = await getSessionData();
      const res = await axios.post(CONFIG.BACKEND_URL, payload);
      const data = res.data;

      // Show message only if allowed and cooldown passed
      const now = Date.now();
      if (data?.show && data?.message && now - lastPopupTime > CONFIG.POPUP_COOLDOWN) {
        lastPopupTime = now;
        showMessage(data.message);
      }
    } catch (err) {
      console.error("Session API error:", err);
    }
  }

  function showMessage(message) {
    const modal = document.createElement("div");
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    modal.className =
      `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 border max-w-sm transition-all duration-300
      ${prefersDark ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-800 border-gray-200'}`;
    modal.innerHTML = `
      <p class="text-sm">${message}</p>
      <button class="mt-2 text-sm underline">Close</button>
    `;

    document.body.appendChild(modal);

    modal.querySelector("button").onclick = () => modal.remove();
    setTimeout(() => modal.remove(), 10000); // auto-hide
  }

  function observeAddToCart() {
    document.body.addEventListener("click", (e) => {
      const btn = e.target.closest("button, input[type='submit']");
      if (!btn) return;

      const text = btn.innerText?.toLowerCase() || btn.value?.toLowerCase() || "";

      if (text.includes("add to cart")) {
        eventBuffer.push({
          type: "add_to_cart_click",
          at: Date.now(),
        });
      }
    });
  }

  // Start tracking
  sendSessionData();
  setInterval(sendSessionData, CONFIG.PING_INTERVAL);
  observeAddToCart();
}
