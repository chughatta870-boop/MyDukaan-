# MyDukaan — by M Ijaz

Vanilla JS + Firebase multi-seller ecommerce PWA. No build step — upload the files as-is to GitHub Pages.

## Files
- `index.html`, `style.css`, `script.js` — the app
- `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png` — PWA files
- `firestore.rules`, `storage.rules` — paste these into Firebase Console (not auto-deployed)

## 1. Firebase setup (one-time)
1. Go to https://console.firebase.google.com → Create project.
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** (start in production mode).
4. **Build → Storage → Get started.**
5. **Project settings (gear icon) → General → scroll to "Your apps" → Web (`</>`) icon → register app.** Copy the `firebaseConfig` object shown.
6. Open `script.js` in this folder and replace the placeholder `firebaseConfig` (near the top) with your real values.

## 2. Apply security rules
- **Firestore Database → Rules tab** → replace contents with `firestore.rules` → Publish.
- **Storage → Rules tab** → replace contents with `storage.rules` → Publish.

These rules make sure a seller can only edit/delete their *own* items, and only the seller on an order can update its status — a customer can't edit someone else's shop or fake-approve their own order.

## 3. Set your real payment numbers
In `script.js`, find `PAYMENT_INFO` near the top and replace the JazzCash / Easypaisa / Bank placeholder numbers with your real ones.

## 4. Deploy to GitHub Pages (no build needed)
1. Create a new GitHub repo, e.g. `mydukaan`.
2. Upload all files in this folder to the **root** of the repo (flat, not inside a subfolder — this avoids icon/manifest path issues).
3. Repo → **Settings → Pages → Source: Deploy from a branch → Branch: main / (root)** → Save.
4. Your app will be live at `https://<your-username>.github.io/mydukaan/` within a minute or two.
5. Open it on your phone → browser menu → "Add to Home Screen" to install it as an app.

## How it works
- **Catalog** — sellers add/edit/delete their own items with a photo, name, and price.
- **Bazaar** — everyone browses all sellers' items and adds items to a cart. A cart can only hold items from **one seller at a time** (the app warns and offers to clear the cart if you try to mix sellers) — this keeps each order tied to a single seller.
- **Cart** — checkout with Cash on Delivery, JazzCash, Easypaisa, or Bank Transfer, full or 50% advance.
- **Orders** — sellers see orders they've *received* and move them through Pending → Accepted → Shipped → Delivered. Buyers see orders they've *placed*.
- Cart contents are saved in the browser (`localStorage`) per logged-in user, so it survives a refresh.

## Notes
- Item photos are not watermarked in the actual file — a "M Ijaz" tag is overlaid visually in the app (matches your other apps' watermark style) so the original photo file stays clean.
- If PWABuilder scoring matters for this one too, the manifest/service worker/icons here follow the same pattern as your other PWAs (192px + 512px real PNGs, offline app-shell caching).
