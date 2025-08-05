// === Config ===
const CONFIG = {
  BACKEND_URL: "http://localhost:3030/track-session", // ← Replace this for production
  IDLE_PING_INTERVAL: 60000, // 60s fallback ping
  POPUP_COOLDOWN: 30000,     // 30s between popups
};

// === Load Axios from CDN ===
(function loadAxios(callback) {
  if (window.axios) return callback();
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js";
  script.onload = callback;
  document.head.appendChild(script);
})(initTracker);

// === Tracker Logic ===
function initTracker() {
  let sessionStart = Date.now();
  let previousCartCount = 0;
  let lastPopupTime = 0;

  async function getSessionData(trigger) {
    const timeOnSite = Math.floor((Date.now() - sessionStart) / 1000);
    const currentPage = window.location.pathname;

    try {
      const res = await axios.get("/cart.js");
      const cart = res.data;
      const currentCartCount = cart.items?.length || 0;
      const events = [];

      // Detect cart change
      if (currentCartCount !== previousCartCount) {
        events.push({
          type: "cart_change",
          delta: currentCartCount - previousCartCount,
          at: Date.now(),
        });
        previousCartCount = currentCartCount;
      }

      // Always track page view
      events.push({
        type: "page_view",
        url: currentPage,
        at: Date.now(),
      });

      return {
        time_on_site: timeOnSite,
        current_page: currentPage,
        cart_items: currentCartCount,
        events,
        trigger,
      };
    } catch (err) {
      console.error("Cart fetch error", err);
      return {
        time_on_site: timeOnSite,
        current_page: currentPage,
        cart_items: 0,
        events: [],
        trigger,
      };
    }
  }

  async function sendSessionData(trigger = "interval") {
    try {
      const payload = await getSessionData(trigger);
      const res = await axios.post(CONFIG.BACKEND_URL, payload);
      const data = res.data;

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
    modal.className = `
      fixed bottom-6 right-6 max-w-md bg-blue-50 border border-blue-300 
      rounded-xl shadow-xl p-5 z-50 transition-opacity
    `;
    modal.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h3 class="text-blue-800 font-semibold mb-1">Special Offer</h3>
          <p class="text-blue-900 text-sm">${message}</p>
        </div>
        <button class="ml-4 text-blue-500 hover:text-blue-700 text-lg font-bold">×</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector("button").onclick = () => modal.remove();
    setTimeout(() => modal.remove(), 20000); // auto-hide after 20s
  }

  // === Triggers ===
  window.addEventListener("pageshow", () => sendSessionData("page_load"));

  // Watch for cart changes (poll every 5s)
  setInterval(() => {
    axios.get("/cart.js")
      .then(res => {
        const count = res.data.items?.length || 0;
        if (count !== previousCartCount) {
          previousCartCount = count;
          sendSessionData("cart_change");
        }
      })
      .catch(() => {}); // silent fail
  }, 5000);

  // Fallback ping every minute
  setInterval(() => sendSessionData("idle_ping"), CONFIG.IDLE_PING_INTERVAL);

  // Initial ping
  sendSessionData("init");
}
