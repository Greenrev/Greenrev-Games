# GreenRev Roadtrip

A 3D road-trip game across Nigeria, built to bring people back to the GreenRev web and mobile apps every day. You drive city to city by road:
- dodging potholes
- crawling through go-slow while hawkers sell pure water and Agege bread through your window
- stopping for police, military, FRSC and VIO checkpoints
- braking for cattle crossing the road

When your car breaks down, your tyre bursts or VIO says the car isn't roadworthy, the game sends you to **GreenRev**: mechanics, parts, the marketplace, and dealer sign-up.

| | |
|---|---|
| ![Go-slow with hawkers](docs/screens/goslow.png) | ![Lagos–Ibadan Expressway](docs/screens/lagos.png) |
| ![Sahel with cattle](docs/screens/sahel.png) | ![Rain on the Ore–Benin road](docs/screens/rain.png) |

## What's new in v3

- **TypeScript**, to match GreenRev's stack (Next.js front end, Node.js back end). `npm run typecheck`.
- **Next.js:** `mountRoadtrip(element, config)` plus a ready client component, page and API route in [`nextjs/`](nextjs/README.md).
- **Node.js API** in [`server/`](server/README.md): featured listings, referral rewards, Paystack credit purchases, cloud saves and GreenRev Points.
- **Money that matters:** contracts for every journey (race for money), a full trip money summary (start, earned, spent, net, time), wallets that go negative, a bank with loans, and real-money credit packs.
- **Three levels:** Easy, Normal and Naija Hard (more traffic, potholes and fines, and up to 45% more pay).
- **New Nigerian road challenges:** toll plazas, agberos collecting "owo ita", road works with lane closures, flooded roads, one-way drivers, hidden speed bumps ("gallops") and fuel scarcity.
- **4 new journeys, 11 new cities:** Lagos → Port Harcourt, Lagos → Akure, Abuja → Enugu, Kano → Sokoto.
- **Clock and timer:** time of day, trip time against the job's target, and a daylight arrival bonus.
- **Car radio and sound panel:** live FM streams (with station permission), two built-in stations, licensed songs from a playlist, and volume controls without pausing.
- **Police and FRSC patrols** on the highway, with sirens, speed checks and pull-overs.
- **Fixes:** the overpass now has earth ramps down to the ground, so its traffic no longer drives into the air; road works, floods and one-way drivers now appear on most journeys; a real two-tone car horn; roundabout palms and monument no longer sit on your lane; junction roads under flyovers sit on level ground (no more flying cars); flyover ramps sit on embankments; traffic stops for goats, cows and herders; police voices only play at the checkpoint; the robot voice is off by default.

## Journeys

| Journey | Cities | Unlock |
|---|---|---|
| **Lagos → Abuja** | Lagos · Ibadan · Ilorin · Jebba (River Niger) · Mokwa · Bida · Abuja | Open |
| **Lagos → Calabar** | Lagos · Ore · Benin City · Onitsha (Second Niger Bridge) · Owerri · Aba · Uyo · Calabar | Open |
| **Abuja → Kano** | Abuja · Kaduna · Zaria · Kano | Finish Lagos → Abuja |
| **Abuja → Jos** | Abuja · Keffi · Akwanga · Jos (Plateau climb) | Finish Lagos → Abuja |
| **Kano → Maiduguri** | Kano · Potiskum · Damaturu · Maiduguri | Finish Abuja → Kano |
| **Lagos → Akure** | Lagos · Abeokuta · Ibadan · Osogbo · Akure | Open |
| **Lagos → Port Harcourt** | Lagos · Ore · Benin City · Warri · Port Harcourt | Finish Lagos → Calabar |
| **Abuja → Enugu** | Abuja · Lokoja (the Confluence) · Anyigba · Enugu | Finish Lagos → Abuja |
| **Kano → Sokoto** | Kano · Katsina · Gusau · Sokoto | Finish Abuja → Kano |

There are 34 cities, each with a passport stamp, a local fact and a must-eat dish. Each leg has its own:
- **road quality:** pothole density, e.g. the Ore–Benin road is rough
- **traffic level**
- **security profile:** how many police, military, FRSC and VIO stops

The **biome** sets the scenery and weather:
- **South:** palms and rainforest, with rain
- **Middle Belt savanna:** acacias and mud compounds
- **Sahel:** harmattan haze and baobabs
- **Jos Plateau:** hills and boulders

Adding a city is one entry in `src/data/routes.ts`.

## On the road

- **Nigerian traffic:**
  - **Lagos:** yellow **danfos** that cut in, **kekes**, **okadas** with a passenger
  - **Highways:** intercity luxury buses, trailers and tankers in the slow lane
  - **Lane discipline:** right-hand traffic on a dual carriageway, with a fast lane by the median; honk and slow cars move over
- **Bridges, flyovers and roundabouts:**
  - **Named Niger crossings:** the steel-truss **Jebba Bridge** and the cable-stayed **Second Niger Bridge**, with the river below, piers, and fishermen in canoes. The South also gets smaller creek bridges (narrow, no overtaking).
  - **City flyovers:** the road climbs over a busy junction, with traffic crossing underneath and traders under the deck. Highway **overpasses** cross above you, with their own traffic.
  - **Roundabouts:** the carriageway swings around an island with palms and a monument in green-white-green, a traffic warden directing traffic, and cars queueing on the side roads. Above 60 km/h the warden (LASTMA in Lagos) fines you.
- **Rest stops:** one on almost every leg, signposted 500 m ahead. Stop beside it and pull in:
  - **Fuel** at the forecourt.
  - **Regional food** that restores driver energy: jollof and amala in the South, pounded yam and suya in the middle belt, tuwo, kilishi and fura da nono in the North, Irish potato porridge on the Plateau.
  - **Rest** for an hour to get back to full energy.
  - **Quick mechanic check:** +15% condition.
  - **Missing FRSC safety kit:** buy it there.
  - Each stop has a buka, a rest house, parked trailers and travellers eating. Long legs also get a plain filling station.
- **Potholes:** shallow ones jolt you, deep ones can burst a tyre. Tougher cars and suspension upgrades take less damage, and rain makes them harder to see.
- **Go-slow:** a city jam at the start and end of busy legs, plus random mid-route jams (a broken-down trailer, market day, road works). **Hawkers** walk between the cars; buy a snack to restore your energy.
- **Checkpoints:** slow down when you see the drums, stop, and answer the officer:
  - **Police:** "Particulars?" Expired papers mean an official fine with a receipt.
  - **Military stop and search:** "Everybody come down! Open your boot."
  - **FRSC:** checks your fire extinguisher, warning triangle and spare tyre.
  - **VIO:** roadworthiness. Below 50% condition you're fined and pointed to a mechanic.
  - **Running a checkpoint:** a heavy fine.
- **FRSC radar:** a 100 km/h limit sign, then a speed check.
- **Animals:** goats everywhere and cattle herds with a herder in the North. Hit one and you pay compensation.
- **People everywhere:** walkers on the footpaths, hawkers with trays on their heads, officers waving traffic down, roadside mechanics. They jump out of the way, with speech bubbles ("Oga, easy o!", "Haba!"). Nobody gets hurt in this game.
- **Car upkeep:** fuel, car condition and driver energy. Filling stations on the way, a black-market jerrycan if you run dry, breakdowns when condition hits zero.
- **Time and weather:** a day-night cycle with headlights and glowing traffic lights, rain in the South, harmattan haze in the Sahel.
- **Seven camera views:** chase, bonnet, driver (cockpit), front view (looking back at your car), aerial, top-down and cinematic. Switch with the **🎥** button at the top of the screen, or **C** on a keyboard.
- **Paint shop:** 12 colours for your own car in the Garage, free to change. Traffic comes in bright colours too.
- **Fair traffic behind you:** cars behind keep a safe gap, brake hard when you stop, and overtake in the other lane when it's clear. Nobody changes lanes into you. If a car still knocks you from behind (usually after you cut in front of it), it's not your fault: a small dent, no crash on your record.
- **Voices:** hype men, police and roadside lines are spoken. Record them in your own voice; see [public/voice/README.md](public/voice/README.md).

## Retention loop

- **Daily streak:** fuel money on check-in, growing over 7 days (₦50k → ₦500k), then repeating. Miss a day and it resets.
- **Daily missions:** 3 per day, the same for every player that date, e.g. "Dodge 15 potholes", "Buy from 3 hawkers", "Check out GreenRev Marketplace".
- **Fresh roads every day:** each leg's potholes, checkpoints, jams and weather are seeded by the date.
- **Progression:** unlockable journeys, a city passport, 12 achievements, XP levels and best times.
- **Garage:** six cars, from a Tokunbo Corolla and the Honda Accord "Evil Spirit" to the Innoson G5, Hilux, Lexus RX 350 and Land Cruiser V8. Also tyres, suspension and engine upgrades, and the safety kit FRSC checks for.

## Jobs, money and the bank

**Contracts.** Before each journey you pick a job, or just drive. Offers change daily and are the same for everyone:
- **Full load of passengers:** pay plus tips. Potholes, hard braking and crashes upset the passengers ("Driver, take am easy o!").
- **Express delivery:** big pay for beating the clock; late delivery pays half.
- **Fragile cargo:** tomatoes and eggs; every pothole breaks some.
- **Chief's pickup:** any crash or fine loses the big bonus.

The HUD shows the time of day, your trip time against the job's target, and the job's pay. At the end you get a full statement: what you started with, every naira earned and spent by category, the net for the trip, and the time.

**Going into the red.** Fines, tolls, levies and roadside repairs are always paid, even if your wallet goes negative. Repairs and fuel can use an overdraft up to a limit that grows with your level. A negative wallet costs 5% per leg and locks cars and upgrades.

**The bank** (Mama Bisi Microfinance, fictional). Three loan sizes with interest per leg; a quarter of each leg's pay repays the loan automatically. Your credit limit grows as you finish legs without crashing. "Debt free" is an achievement.

**GreenRev credits (real money).** Credit packs from ₦500 add game money. They can never be cashed out. Payment runs on the GreenRev site (Paystack) or in the store apps (Apple/Google in-app purchase); the backend confirms it and the game claims it once. See `credits` in `src/config.ts` and [`server/`](server/README.md).

**Levels.** Easy, Normal and Naija Hard change traffic, potholes, fines, crash damage, event frequency and pay. Change it from the job screen or Settings.

## Road challenges

| Challenge | What happens |
|---|---|
| Toll plaza | Stop and pay; run the barrier for a fine and a dent |
| Agberos | "Owo ita!" Pay, argue, or shout for the warden; each has a risk |
| Road works | A lane closes behind cones; merge in time or knock cones down |
| Flooded road | Over 30 km/h and the engine may drink water and stall |
| One-way driver | A car comes at you in your lane; dodge it for a bonus |
| Hidden speed bumps | Unmarked "gallops" entering towns punish speeding |
| Fuel scarcity | "No fuel" at the pumps; jerrycan boys sell at black-market prices |
| Cattle and goats | All traffic, both directions, stops while the herd crosses |
| Police and FRSC patrols | Marked pickups with flashing light bars cruise below the limit (and pass on the other side). Overtake one above 100 km/h and the siren comes on: stop and you may talk your way out; ignore it for 25 seconds and the fine doubles. Other drivers move over for the siren |

## Car radio and sound

The 📻 button on the HUD changes station; 🔊 opens a sound panel (music and effects volume, mute, voices, horn test) without pausing. Built-in stations **GreenRev FM** (Afrobeats-style) and **Highlife Hour** are generated live, so there's nothing to license. To add real songs, list MP3s in `public/music/playlist.json` (`{ "tracks": [{ "title", "artist", "src" }] }`) and a **Naija Hits** station appears. Only add tracks you have the right to stream: your own, royalty-free, or by agreement with the artist or label.

### Live radio

The radio can also carry real FM stations' internet streams. They appear first on the 📻 button, marked LIVE:

```js
window.GREENREV_CONFIG = {
  radio: { live: [{ name: "Station FM 100.0", url: "https://stream.example.com/live" }] },
};
```

- Streams must be `https://`. If a station is offline, the player is told and can tap to the next one.
- **Get each station's permission before adding it.** A station's stream and the music in it belong to the station and the rights holders; carrying it inside your app is a separate use from listening on the station's own site. Many stations welcome partnerships (extra listeners, and GreenRev could sponsor a show or run ads), so approach them as a partner. Take legal advice on the agreement.
- The hosted Claude demo can't play outside streams (it blocks connections to other sites), so test live radio on your own deployment.

## Hype: featured dealer cars

About once a minute a **featured luxury car** (a real GreenRev listing) appears ahead of you, driving a little slower so you catch up and pass right beside it. A hype man by the roadside shouts it out ("This luxury don land! Who get am?!"), the car gets a 🔥 dealer tag, and a **HYPE IT** button appears.

- **Hype it:** tap the button, tap the car, or honk. Quick reactions and rarer cars earn more hype points and naira. A daily mission and two achievements use hype.
- **View this car:** the hype toast opens a listing card: dealer, city and price, with **View this car on GreenRev** and **Save to dream garage**. The game pauses while it is open and resumes with **Keep driving**.
- **After the leg:** the city arrival screen lists the cars you hyped on that road.
- **Dream garage:** in the menu, with your total hype. Each saved car links to its listing.
- **No brands:** the cars are stylised (luxury saloon, luxury 4x4, sports coupe) with no logos, and no hype line names a brand. Brand names appear only in the listing title the dealer provides.

**Adding real listings** (paid placement for dealers): add them to `public/featured.json`, or serve the same shape from the GreenRev backend and point `featured.url` at it:

```json
{ "cars": [
  { "id": "ikoyi-autos-saloon-1", "dealer": "Ikoyi Autos", "city": "Lagos",
    "title": "Black luxury saloon, 2024", "body": "limo", "color": "#0d0d0f",
    "price": 185000000, "listingUrl": "https://www.greenrevs.com/shop/...",
    "start": "2026-11-01", "end": "2026-11-30" } ] }
```

- `body` is `limo` (luxury saloon), `luxsuv` (luxury 4x4) or `coupe` (sports coupe). `color` is any hex.
- `start`, `end`, `price` and `listingUrl` are optional. Without `listingUrl`, the card searches the Marketplace for the title.
- Until any listing is live, sample cars run so the loop works from day one; their card says they're samples.
- How often they appear: `featured.minGapSeconds` and `featured.maxGapSeconds` in `src/config.ts`.

**Reporting** (for dealers and your own funnel): `hype_car {car, dealer, points}`, `hype_card_open {car, reason}`, `hype_save {car}`, and `cta_click {target: "listing", car, dealer, reason}`. Listing links carry the game's UTM tags with `utm_content` set to where the click came from (`hype_toast`, `arrival_hyped`, `dream_garage`).

## Invite friends and challenges

- **Invite link:** every player gets a 6-letter code. **🤝 Invite friends** in the menu shares it (phone share sheet, WhatsApp or copy). The link is the game's address plus `#ref-CODE`.
- **Welcome bonus:** a new player who opens a friend's link gets ₦200,000 fuel money once (`referral.welcomeBonus`). Your own code doesn't count.
- **Challenge link:** after finishing a journey, **Challenge a friend to beat my time** shares a link with the journey and your time (`#ref-CODE-ch-lagos-abuja-t-754`). Your friend sees the challenge when they open it, and finishing that journey faster earns them a ₦100,000 bonus.
- **Rewarding the inviter needs your backend**, because one phone can't verify another phone. The game emits `referral_open {ref}`, `referral_join {ref}` (a brand-new player joined with a code), `invite_share {code, kind}` and `challenge_result`. Record joins against the code on the GreenRev backend, then set `referral.claimUrl`: the game calls `GET <claimUrl>?code=ABC123` on launch and expects `{ "reward": 150000, "joins": 3 }` with any new, unpaid reward.
- **Inside the mobile app:** pass the code from a deep link with `window.GREENREV_CONFIG.invite = "ref-ABC123"`, and set `playUrl` to the public game address so shared links open the game.

## GreenRev moments

The game routes players to GreenRev at natural moments, not with pop-up ads:

| Moment | Goes to |
|---|---|
| Breakdown, tyre burst, crash, VIO "not roadworthy", engine light on | **Mechanics**. Choosing the GreenRev mechanic also gets a 30% in-game discount. |
| FRSC finds missing safety kit; Garage | **Parts vendors** |
| Garage "See the real one on GreenRev"; city stops | **Marketplace**, searching for that model |
| City stops; journey complete | **Dealer sign-up** ("Are you a dealer in Kano?") |
| Tap a roadside **billboard** in the 3D world | The advertised service |
| Menu strip | Marketplace and dealer sign-up |

One daily mission rewards visiting the Marketplace. Every click is tagged with a UTM reason (`breakdown`, `vio_fail`, `garage_real_car` …) so you can measure which moments convert.

## Roadside advertising (revenue)

Businesses can buy space on the in-game billboards. Some roadside boards, and a signpost at every rest stop, read **ADVERTISE HERE** with the prices. Tapping one (or **📣 Advertise** in the menu) opens the booking panel:

| Package | Price (default) |
|---|---|
| 3 days | ₦15,000 |
| 7 days | ₦30,000 |
| 30 days | ₦100,000 |

**Set up payments**
1. In the Paystack dashboard, open **Payment Pages**, create one fixed-amount page per package, and copy each page's link.
2. Paste the links (and your prices) into `advertise.packages` in `src/config.ts`, or pass them in from the app:
   ```js
   window.GREENREV_CONFIG = { advertise: {
     contactUrl: "https://greenrevs.com/advertise",   // or https://wa.me/234XXXXXXXXXX
     packages: [
       { id: "3d", days: 3, price: 15000, paystackUrl: "https://paystack.com/pay/your-3-day-page" },
       { id: "7d", days: 7, price: 30000, paystackUrl: "https://paystack.com/pay/your-7-day-page" },
       { id: "30d", days: 30, price: 100000, paystackUrl: "https://paystack.com/pay/your-30-day-page" },
     ] } };
   ```
   Until a package has a Paystack link, its button reads **Book now** and goes to `contactUrl`.

**Artwork**
- Size: 1024 × 512 px (2:1), JPG or PNG under 500 KB, with text kept 40 px from the edges.
- Template: `public/ad-template.png`, linked from the panel. Regenerate it with `node scripts/make-ad-template.mjs`.

**Going live:** add the campaign to `public/ads.json`, or serve the same shape from the GreenRev backend and point `advertise.adsUrl` at it:
```json
{ "campaigns": [
  { "id": "mama-cass-nov", "advertiser": "Mama Cass Kitchen", "image": "https://cdn.greenrevs.com/ads/mama-cass.jpg",
    "link": "https://wa.me/2348000000000", "start": "2026-11-01", "end": "2026-11-07", "routes": ["lagos-abuja"] } ] }
```
- `routes` is optional; leave it out for every journey.
- Images must be served with CORS enabled (any normal CDN is fine).
- Active campaigns rotate across the ADVERTISE HERE slots, with a small **Ad** tag.
- Tapping an ad opens the advertiser's link.

**Reporting:** the game emits these events, so you can send advertisers impressions and taps from your analytics:
- `ad_impression {campaign}`
- `ad_click {campaign}`
- `advertise_open`
- `advertise_package_click {package}`

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # unit tests: economy, contracts, events, routes, referrals, API
npm run typecheck      # TypeScript
npm run api            # Roadtrip API locally on :8787 (server/)
npm run build:lib      # ES module + CSS for the Next.js app (dist-lib/)
npm run build          # static site in dist/
npm run smoke          # headless browser: boots the game, drives, checks the go-slow, hawker and checkpoint flows; fails on console errors
node scripts/tour.mjs  # screenshots of every region into screenshots/
node scripts/features-tour.mjs  # screenshots of each bridge, flyover, overpass and roundabout type
node scripts/stops-tour.mjs  # rest stop, Advertise Here boards, a sponsored board and the booking panel
```

Controls: **↑/W** gas · **↓/S/Space** brake · **←→/A D** steer · **H** horn (also hypes a passing luxury car) · **C** camera · **B** buy from a hawker · **F** refuel · **P/Esc** pause. On phones, on-screen buttons appear, plus the 🎥 camera button at the top.

## Embedding in the GreenRev apps

The game is a static site: `npm run build`, then host `dist/` at e.g. `greenrevs.com/roadtrip`. For a mobile WebView, `npm run build:single` produces one self-contained `dist-single/index.html`.

### Configure the links

Set this before the game script loads:

```html
<script>
  window.GREENREV_CONFIG = {
    marketplaceUrl: "https://greenrevs.com",
    mechanicUrl: "https://greenrevs.com/mechanics",
    dealerSignupUrl: "https://greenrevs.com/dealers/signup",
    partsUrl: "https://greenrevs.com/parts",
    logoUrl: "https://www.greenrevs.com/logo.png",   // menu and HUD logo; the GREENREV wordmark shows if it can't load
    featured: { url: "https://api.greenrevs.com/roadtrip/featured" },  // or the bundled ./featured.json
    voiceUrl: "./voice/",                              // recorded voice clips
    playUrl: "https://www.greenrevs.com/roadtrip",     // address used in invite and challenge links
  };
</script>
```

The defaults in `src/config.ts` are placeholders. Point them at the real pages.

### Messages to the host app

Inside a React Native WebView (`window.ReactNativeWebView`) or an iframe, the game **posts messages instead of opening URLs**, so the app can navigate natively:

```js
{ type: "greenrev:navigate", target: "mechanic", url: "https://…?utm_source=roadtrip_game…", context: { reason: "breakdown", city: "Ibadan" } }
{ type: "greenrev:event", event: "leg_complete", props: { routeId, leg, seconds, crashes } }
```

These events are emitted for analytics and retention dashboards:
- `session_start`
- `daily_checkin`
- `route_start`
- `leg_complete`
- `route_complete`
- `cta_click`

`window.GreenRevAnalytics.track(event, props)` is called too, if present.

### Saves

Progress is saved in `localStorage` (`greenrev-roadtrip-v2`). To sync across devices, back it with the user's GreenRev account through the host app.

## Code map

```
src/
  mount.ts           mountRoadtrip(element, config): embed anywhere (Next.js, React, plain page)
  standalone.ts      entry for index.html
  markup.ts          the game's HTML (canvas, HUD, menu, modal)
  main.ts            game loop: driving model, potholes, collisions, events, dialogs, arrivals
  config.ts          GreenRev links, host-app bridge, purchases, analytics
  types/             shared types (routes, legs, modal actions) and globals
  data/routes.ts     cities, journeys, legs (road quality, traffic, security, biome, tolls)
  data/cars.ts       garage cars, upgrades, safety kit, driving physics
  game/state.ts      save game, streaks, daily missions, achievements (pure, tested)
  game/economy.ts    trip ledger, overdraft, bank loans, credit packs, difficulty (pure, tested)
  game/contracts.ts  jobs, par times, contract settlement (pure, tested)
  game/director.ts   seeded per-leg event plan, including the road challenges (pure, tested)
  game/cloud.ts      cloud saves and GreenRev Points
  game/ads.ts        roadside ad campaigns (tested)
  game/featured.ts   featured dealer cars, hype, dream garage (tested)
  game/referral.ts   invite codes and challenge links (tested)
  game/audio.ts      engine, car horn, effects, car radio
  game/voice.ts      spoken lines: recorded MP3s, optional text-to-speech
  game/physics.ts    lanes, curves, hills, flyovers, river valleys, roundabouts, junction levelling
  game/ui.ts         menu, modals, garage, passport, HUD helpers
  world/world.ts     streamed road and terrain, embankments, scenery, sky, day/night, rain
  world/traffic.ts   NPC vehicles: following, lane changes, herds, road works, one-way drivers
  world/actors.ts    people and animals
  world/features.ts  bridges, flyovers, overpasses and roundabouts
  world/models.ts    procedural low-poly 3D models, including cones, toll plazas, flood water
server/              Node.js API (Web Request/Response handlers, store interface, tests)
nextjs/              drop-in files for the GreenRev Next.js app
```

TypeScript notes: the code compiles with `strict: false` for now, so the move from JavaScript stayed safe. New modules (economy, contracts, cloud, server) are typed properly; tighten `strict` file by file from here. Vite and esbuild don't type-check during builds, so run `npm run typecheck` in CI.

Everything is procedural, so there are no image or model files (apart from the optional voice clips and the logo, which loads from greenrevs.com). The full build is about 170 KB gzipped, three.js included.

## Roadmap

Planned for later releases: travel-together invite links (same car or convoy), in-trip voice chat and car radio, and a luxury and enthusiast car tier with customisation. See [docs/ROADMAP.md](docs/ROADMAP.md).

## Notes

- This is a full rebuild. The previous version's code (`game.js`, `world3d.js`, `server.js` …) was never committed to this repository, only its README, so its features were reimplemented from that description.
- The earlier **Paystack test checkout** for in-game money was intentionally not carried over. In-game naira are virtual. Selling game currency needs a server-side wallet, refunds and provider approval, and is better handled by the GreenRev backend if you decide to do it.
- The visuals are stylised low-poly WebGL, built to run on mid-range Android phones. "4D" here means 3D plus time: day-night, weather and events that change every day.
#   G r e e n r e v - G a m e s  
 