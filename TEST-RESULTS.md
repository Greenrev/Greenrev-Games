# GreenRev overhaul — QA record

## Passed — browser interaction with graphics stubbed
- Page initialisation and welcome modal, both route story data (20 stages per route).
- 21 traffic NPCs created; fleet rebuilt after Reset and on route change.
- Abuja→Kano fleet includes northern-style Hiace buses and no yellow danfos.
- Lagos→Abuja fleet includes yellow danfos and no northern-style Hiace buses.
- Player-to-NPC collision opens the crash/recovery flow.
- High-priced Lexus purchase, insufficient-funds warning, simulated 36-month financing.
- Game Bank test-checkout entry; free QA credits; eight GreenRev phone tabs.
- All three rental offers complete inspection and booking, with different prices.
- Northern-bus and Lagos-danfo passenger encounters.
- Aerial, Follow, Cockpit and Far camera buttons, Horn and Time & light actions.
- Jump-to-event and reopen-an-active-mission after closing its dialog.
- No JavaScript page errors in scripted tests.

## Passed — mock Paystack contract tests on a local HTTP server
- Test-checkout initialise returns a Paystack-style hosted URL.
- A pending transaction **does not** give credits.
- Successful Paystack test status is matched against amount, currency, email, reference and test domain.
- Repeat verification is idempotent server-side; malformed references and invalid packages are rejected.
- `.env` is not served as a public file.

## Unverified in this runtime
- **Visual quality/performance of actual WebGL vehicle meshes**: browser graphics are blocked in this test environment. JavaScript and event handlers were tested with a stub renderer, but the real 3D models must be visually checked in a WebGL-enabled Chrome/Edge on the user's device.
- **A real Paystack test payment**: no user's Paystack test secret key was available. Only a mocked API provider contract was tested, not a live call to Paystack.
- Production payment safety: the virtual wallet is still stored locally. The supplied server is a test integration, not a production ledger.

These limits are intentional and are not labelled as passing tests.
