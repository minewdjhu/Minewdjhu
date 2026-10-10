// Minewdjhu frontend: THE ONE configuration point.
// ======================================================
// This is the only place the backend's address is ever written down.
// Every other file calls api.js, which reads this value. If your
// Cloudflare Quick Tunnel URL changes (it will, unless you move to a
// permanent domain later), this is the only line you need to edit. Then
// commit the change to GitHub and GitHub Pages republishes it.
//
// Example once your tunnel is running:
//   const API_BASE_URL = "https://random-words-here.trycloudflare.com";
//
// For local testing (backend on the same computer) leave it like this:
const API_BASE_URL = "http://127.0.0.1:8420";
