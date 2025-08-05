// (
//     function() {
//         const API_URL = "http://localhost:3030/track-session"
//         const sessionData = {
//             events: [],
//             current_page: window.location.pathname,
//             cart_items: 0,
//             time_on_site: 0,
//   };

//         let startTime = Date.now();

//         document.addEventListener("click", (e) => {
//             const target = e.target.closest("[data-track]")
//             if (target) {
//                 const eventName = target.getAttribute
//             }
//         })
//     }
// )
(function () {
  const BACKEND_URL = "http://localhost:3030/track-session";
  const sessionData = {
    events: [],
    current_page: window.location.pathname,
    cart_items: 0,
    time_on_site: 0,
  };

  let startTime = Date.now();

  // Track clicks
  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-track]");
    if (target) {
      const eventName = target.getAttribute("data-track");
      sessionData.events.push({ type: "click", target: eventName, timestamp: Date.now() });
    }
  });

  // Update time on site every 5 seconds and send data after 10s
  const interval = setInterval(() => {
    sessionData.time_on_site = Math.floor((Date.now() - startTime) / 1000);
  }, 5000);

  setTimeout(async () => {
    clearInterval(interval);
    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sessionData),
      });

      const result = await res.json();

      if (result.show && result.message) {
        showPopup(result.message);
      }
    } catch (err) {
      console.error("Tracking error:", err);
    }
  }, 10000); // Send after 10s

  function showPopup(message) {
    const popup = document.createElement("div");
    popup.innerHTML = `
      <div style="
        position:fixed;
        bottom:20px;
        right:20px;
        background:white;
        border:1px solid #ccc;
        padding:16px;
        border-radius:8px;
        box-shadow:0 4px 8px rgba(0,0,0,0.1);
        z-index:10000;
        max-width:300px;
        font-family:sans-serif;
      ">
        ${message}
        <button style="display:block;margin-top:10px;" onclick="this.parentElement.remove()">Close</button>
      </div>
    `;
    document.body.appendChild(popup);
  }
})();
