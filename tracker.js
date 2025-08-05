// === Config ===
const CONFIG = {
  BACKEND_URL: "http://localhost:3030/track-session", // ← Replace with your backend URL
  PING_INTERVAL: 10000, // in ms
};

// === Load axios from CDN ===
(function loadAxios(callback) {
  if (window.axios) return callback();
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js";
  script.onload = callback;
  document.head.appendChild(script);
})(initTracker);

function initTracker() {
  let sessionStart = Date.now();
  let previousCartCount = 0;

  function getSessionData() {
    const timeOnSite = Math.floor((Date.now() - sessionStart) / 1000);
    const currentPage = window.location.pathname;
    const cartItems = Shopify?.cart?.items?.length || 0;

    return {
      time_on_site: timeOnSite,
      current_page: currentPage,
      cart_items: cartItems,
      events: [], // TODO later
    };
  }

  function sendSessionData() {
    const payload = getSessionData();

    axios.post(CONFIG.BACKEND_URL, payload)
      .then((res) => {
        const data = res.data;
        if (data?.show && data?.message) {
          showMessage(data.message);
        }
      })
      .catch((err) => console.error("Session API error:", err));
  }

  function showMessage(message) {
    const modal = document.createElement("div");
    modal.className =
      "fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg z-50 border border-gray-200 max-w-sm";
    modal.innerHTML = `
      <p class="text-gray-800 text-sm">${message}</p>
      <button class="mt-2 text-sm text-blue-500 hover:underline">Close</button>
    `;
    document.body.appendChild(modal);

    modal.querySelector("button").onclick = () => modal.remove();
    setTimeout(() => modal.remove(), 10000); // auto-hide after 10s
  }

  // === Track session every N seconds ===
  setInterval(sendSessionData, CONFIG.PING_INTERVAL);

  // Send one immediately
  sendSessionData();
}
