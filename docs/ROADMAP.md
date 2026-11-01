# Roadmap

## Status (v3, 2026-10-31)

**Built in v3:** invite and challenge links, the car radio (built-in stations plus a licensed playlist), paint colours, cloud saves and GreenRev Points (API and game side), real-money credits, contracts, the bank, three difficulty levels, new road challenges, 4 new journeys.

**Still to build:**
- **Travel together / convoys** (section 1): needs a real-time server (WebSocket rooms) and GreenRev accounts. The API in `server/` has the accounts hook (`getUser`), and the road is already generated identically on every device from its seed, so only positions need syncing.
- **Voice chat** (section 2): needs WebRTC plus a TURN relay service for players on mobile networks. Build after convoys.
- **Luxury car tiers and customisation** (section 3): paint is done; tiers, wraps, rims and plates are next.
- **More voice lines:** hawker calls, a co-driver, and Yoruba, Hausa and Igbo lines (best recorded by native speakers).

The original design notes follow.

## 1. Travel together: invite friends on a trip

Players send an **invite link** (WhatsApp, SMS, copy link) to join a journey such as Lagos → Abuja.

- **Same car:** friends ride as passengers. The driver drives; passengers see the same road and can:
  - navigate
  - pick the music or radio
  - buy from hawkers
  - help at checkpoints (answer the officer, hand over papers)
  - take over driving at rest stops
- **Convoy (different cars):** each friend drives their own car, either one they own or one **rented** in-game, on the same road at the same time. You can:
  - see each other
  - overtake
  - flash lights or honk
  - meet at rest stops
  - race to the next city
- **Rented cars** tie into GreenRev car rental: rent a 7-seater for the group trip in-game, with "rent the real one" links.
- **Shared rewards:** a convoy bonus for arriving together, group missions ("whole convoy clears 3 checkpoints"), and a group passport stamp.
- **Trip lobby:** the host picks the route, the departure time and who drives. Late joiners can join from the next town.

**Technical notes**
- Needs a small real-time server (WebSocket rooms, one per trip) and GreenRev accounts for identity.
- The road plan is already deterministic from a seed (route, leg and date), so every player can generate the same road locally. Only car positions, speeds and events need syncing, a few small messages per second per player.
- Invite links are deep links into the web and mobile app (`greenrevs.com/roadtrip/join/<tripId>`) using the existing host-app bridge.
- Host-authoritative events (checkpoints, crashes between players), with the host deciding outcomes.

## 2. Talk on the road: voice and speaker

- **Voice chat** between people in the same car or convoy while driving. Push-to-talk or always-on, with mute per person.
- **Car speaker and radio:** in-car radio stations (Naija hits, highlife, Fuji, news and traffic reports), and passengers can play DJ.
- **Spoken game moments:** started. Hype men, police and roadside lines now speak (recorded clips, with text-to-speech fallback; see `src/game/voice.ts`). Still to do: hawker calls, the co-driver reading directions, and Yoruba, Hausa and Igbo lines.
- **Voice commands later:** "Horn", "Pull into the rest stop", "Buy pure water".

**Technical notes**
- WebRTC audio between players, using a hosted SFU such as LiveKit, Agora or Daily for convoys of more than 3 cars.
- Needs microphone permission in the web and mobile apps, plus moderation and reporting tools for voice.

## 3. Car enthusiasts and luxury cars

Grow the garage into a full car-culture layer, from a normal Tokunbo car up to luxury and supercars, as your money grows.

- **Tiers:** everyday (Corolla, Accord), SUVs and trucks (Hilux, Prado), premium (Lexus, Mercedes, BMW, Range Rover), and luxury and super (G-Wagon, Rolls-Royce, Bentley, Lamborghini, Ferrari).
- **Earning your way up:** trips, missions, streaks and ad-free bonuses fund upgrades. Luxury cars cost more to fuel, insure and repair, which shapes the in-game economy.
- **Ownership flavour:**
  - **Status:** checkpoints react to a G-Wagon differently ("Oga, you be big man o!"), and some fine scenes play out differently.
  - **Practical trade-offs:** supercars hate potholes, while SUVs shrug them off.
- **Customisation for enthusiasts:** paint, wraps, rims, tint, number plates (custom state plates), body kits, sound systems, and performance tuning.
- **Showroom and community:**
  - **Display:** show off your garage, with car meets at rest stops.
  - **Collect:** limited-edition cars on special dates (December, Detty December, carnival week).
  - **Compete:** leaderboards for "best collection".
- **GreenRev link:** every car in the game links to real listings on GreenRev Marketplace ("Own the real one"). Luxury dealers can sponsor their cars in the game as paid placements, extending the roadside ads.

**Technical notes**
- The car list is already data-driven (`src/data/cars.ts`). Each new body needs a model in `src/world/models.ts`, or imported glTF models for high-detail luxury cars.
- Rarer cars justify better visuals, and the quality setting can load high-detail models only on capable phones.
- Store any real-money purchases server-side through the GreenRev payment gateway, never client-side.

## Suggested order

1. **Luxury cars and customisation:** single-player, no new servers. It builds on the existing garage and economy, and luxury dealers can start sponsoring cars.
2. **Invite links and convoys:** needs accounts and a real-time server.
3. **Voice chat and speaker:** needs convoys in place, plus moderation.
