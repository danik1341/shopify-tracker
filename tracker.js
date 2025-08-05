const CONFIG = {
    BACKEND_URL: "http://localhost:3030/track-session", // Replace in production
    PING_INTERVAL: 60000, // ms
    POPUP_COOLDOWN: 30000, // ms
  };

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

        // Always track page view
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
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

      const modal = document.createElement("div");
      modal.className = `
        shopify-tracker-popup fixed bottom-6 left-6 p-6 rounded-xl z-1000 shadow-lg max-w-lg w-[95%] sm:w-[420px]
        ${prefersDark ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-800 border border-gray-200'}
        transition-opacity duration-300 opacity-0
      `.trim();

      modal.innerHTML = `
        <div class="text-lg leading-relaxed font-medium">${message}</div>
        <button class="mt-4 text-sm text-blue-500 underline hover:text-blue-700">Close</button>
      `;

      document.body.appendChild(modal);
      requestAnimationFrame(() => (modal.style.opacity = "1"));

      modal.querySelector("button").onclick = () => modal.remove();
      setTimeout(() => modal.remove(), 10000);
    }

    // === Listen for Add to Cart Events ===
    function observeAddToCartClicks() {
      document.body.addEventListener("click", (e) => {
        const btn = e.target.closest("button, input[type='submit']");
        if (!btn) return;
        const text = (btn.innerText || btn.value || "").toLowerCase();
        if (text.includes("add to cart")) {
          eventBuffer.push({ type: "add_to_cart_click", at: Date.now() });
          setTimeout(sendSessionData, 1000); // Delay to allow cart to update
        }
      });
    }

    // === Start Tracker ===
    observeAddToCartClicks();
    sendSessionData();
    setInterval(sendSessionData, CONFIG.PING_INTERVAL);
  }