# Merge guide — do not create a new GreenRev project

1. Back up your current GreenRev folder (the one containing `world3d.js`).
2. Extract `GreenRev-Existing-3D-Full-Fix.zip` into a temporary folder.
3. Replace **game.js**, **world3d.js**, **index.html**, **styles.css** in your ORIGINAL GreenRev project folder.
4. Add **server.js**, **.env.example**, **start-game-windows.bat** and **start-game-mac-linux.sh** to that folder.
5. Keep your other original files and any private API credentials. `CHANGES-ONLY.patch` provides a line-level comparison against the last GreenRev Mobility & Luxury release.
6. In VS Code, open the original folder. Run the game with `node server.js` in **Terminal → New Terminal**. Visit `http://localhost:5173/` (or double click the batch file on Windows).
7. Press **Ctrl + Shift + R** to refresh. Use **Reset** to check that the highway now spawns cars and regional buses immediately.
8. Without a Paystack test secret, you can use the **free demo credit** button. To use hosted checkout, follow README.md: ONLY Paystack `sk_test_` keys are accepted.

**Important:** The basic 3D/game update works without the Paystack account or internet. Payment test checkout cannot function through generic Live Server because it has no `/api/payments/*` endpoints. No real payment credentials should be placed in browser source code.
