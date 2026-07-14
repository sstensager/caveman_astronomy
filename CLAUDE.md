# Working with this repo

- After a change, don't spin up the dev server, launch a browser, or hunt for
  Playwright/chromium-cli to visually verify UI/rendering behavior. The user
  checks these themselves in the browser and it's faster than the token spend
  of doing it in-session. `tsc --noEmit` + the vitest suite are sufficient
  automated verification unless the user asks for more.
- If a visual check would genuinely be valuable, ask first rather than just
  doing it.
