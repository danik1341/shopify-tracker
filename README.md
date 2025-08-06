## 📦 `tracker.js` – Customer Engagement Tracker for Shopify

This script shows **context-aware popups** to users on your e-commerce site based on their behavior — such as time on site, page views, cart changes, and return visits. It connects to a backend API to generate friendly, personalized messages using LLM (like OpenAI).

> ✅ Designed for Shopify storefronts but works on any standard e-commerce site.

---

## ✨ Features

* 🧠 Tracks user engagement across pages
* 🛒 Detects cart changes using Shopify `/cart.js`
* ⏳ Detects time-on-site
* 🧭 SPA navigation detection
* 💬 Shows helpful, friendly popup messages via LLM
* 🍪 Persists cooldown state across reloads using `localStorage`
* ⚙️ Fully configurable via `CONFIG` object

---

## 🚀 How to Use

1. **Include Axios** if not already present:

```html
<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
```

2. **Add `tracker.js` to your storefront**, ideally at the end of the body:

```html
<script src="/path/to/tracker.js" defer></script>
```

3. **Set your backend endpoint** inside `tracker.js`:

```js
const CONFIG = {
  BACKEND_URL: "https://yourdomain.com/track-session",
  PING_INTERVAL: 60000,       // Time between heartbeat pings (ms)
  POPUP_COOLDOWN: 30000,      // Minimum time between popups (ms)
  MODAL_DURATION: 10000       // How long popup stays visible (ms)
};
```

4. That's it! The tracker will:

   * Fire on page load and navigation
   * Listen for add-to-cart clicks
   * Periodically ping your backend
   * Show popups only when allowed

---

## 🧩 What You Can Customize

### ✅ The `CONFIG` object

| Key              | Description                                    | Default          |
| ---------------- | ---------------------------------------------- | ---------------- |
| `BACKEND_URL`    | Your backend API endpoint                      | *required*       |
| `PING_INTERVAL`  | Time between periodic "heartbeat" pings        | `60000` (1 min)  |
| `POPUP_COOLDOWN` | Cooldown time before showing next popup        | `30000` (30 sec) |
| `MODAL_DURATION` | How long each popup message stays visible (ms) | `10000` (10 sec) |

---

### ✅ Behavior Conditions

The tracker sends session data (cart items, page, time, etc.) **only when**:

* A new page is loaded
* User adds item to cart
* Enough time has passed (ping)
* Popups are allowed (based on cooldown and visibility)

---

## 💾 Persistent State Keys (in localStorage)

* `shopify_tracker_last_popup` – stores the last popup timestamp
* `shopify_tracker_popup_visible` – marks if a popup is currently on screen

These prevent spamming users and allow proper cooldown management across reloads and navigation.

---

## 🧪 Backend Requirements

The backend should expose a POST endpoint at the URL you specify in `CONFIG.BACKEND_URL`:

```ts
POST /track-session

Payload:
{
  time_on_site: number,
  current_page: string,
  cart_items: [{ title: string, quantity: number }],
  current_cart_count: number,
  events: string[]
}

Response:
{
  show: boolean,
  message: string | null
}
```

---

## 🛠 Notes for Developers

* Uses `axios.get('/cart.js')` to retrieve cart info (Shopify-friendly)
* Designed to work with **single-page apps (SPA)** and normal sites
* Uses **Tailwind utility classes** for popup styling (optional to customize)
* Logs debug info to console when needed

---

## 📷 Example Popup

```text
🛍️ Still thinking about The Collection Snowboard? It's waiting in your cart.
```

---

## 📚 TODO / Optional Improvements

* Add support for internationalization
* Add custom themes for popup styling
* Log user interaction with the popup
* Allow disabling via query param or admin setting

---
