/**
 * The game's HTML: canvas, HUD, menu and modal. mountRoadtrip() puts this inside any container,
 * so the same markup serves the standalone page and the Next.js component.
 */
export const MARKUP = `
    <canvas id="scene"></canvas>

    <!-- HUD -->
    <div id="hud" class="hidden">
      <div class="hud-top">
        <div class="pill hud-logo" data-logo aria-hidden="true">GR</div>
        <div class="pill route-pill"><span id="hud-leg">Lagos → Ibadan</span><small id="hud-road">Lagos–Ibadan Expressway</small></div>
        <div class="pill coins">₦ <b id="hud-coins">0</b></div>
        <button class="pill cam-btn" id="btn-cam" aria-label="Switch camera view">🎥 Chase</button>
        <button class="pill icon" id="btn-radio" aria-label="Car radio: next station">📻</button>
        <button class="pill icon" id="btn-sound" aria-label="Sound settings">🔊</button>
        <button class="pill icon" id="btn-pause" aria-label="Pause">⏸</button>
      </div>
      <div class="progress"><div id="hud-progress-fill"></div><div id="hud-progress-dots"></div></div>
      <div class="hud-clock">
        <span class="pill" id="hud-time" aria-label="Time of day">🕖 07:30</span>
        <span class="pill" id="hud-timer" aria-label="Trip time">⏱ 0:00</span>
        <span class="pill job-chip hidden" id="hud-job"></span>
      </div>
      <div id="sound-panel" class="sound-panel hidden" role="dialog" aria-label="Sound">
        <div class="snd-row"><b>📻 <span id="snd-station">Radio off</span></b></div>
        <div class="snd-row"><button id="snd-next">Next station</button><button id="snd-skip">Skip song</button></div>
        <label>Music <input type="range" id="snd-music" min="0" max="100" /></label>
        <label>Effects &amp; horn <input type="range" id="snd-sfx" min="0" max="100" /></label>
        <div class="snd-row"><button id="snd-mute">🔊 Sound on</button><button id="snd-voice">🗣 Voices on</button></div>
        <div class="snd-row"><button id="snd-test">📯 Test horn</button><button id="snd-close" class="snd-done">Done</button></div>
      </div>
      <div class="hud-left">
        <div class="gauge"><b id="hud-speed">0</b><small>km/h</small></div>
        <div class="bars">
          <label>Fuel<span><i id="bar-fuel"></i></span></label>
          <label>Car<span><i id="bar-cond"></i></span></label>
          <label>Energy<span><i id="bar-energy"></i></span></label>
        </div>
        <div class="next"><span id="hud-next">Ibadan</span><b id="hud-km">0 km</b></div>
      </div>
      <div id="alert" class="alert hidden"></div>
      <div id="toasts"></div>
      <div id="bubbles"></div>
      <div id="hype-tag" class="hype-tag hidden"></div>
      <div id="action" class="action hidden"></div>
      <div class="touch" id="touch">
        <div class="pad left">
          <button data-hold="left" aria-label="Steer left">◀</button>
          <button data-hold="right" aria-label="Steer right">▶</button>
        </div>
        <div class="pad mid">
          <button data-tap="horn" class="small">📯 Horn</button>
          <button data-tap="camera" class="small">🎥 Cam</button>
        </div>
        <div class="pad right">
          <button data-hold="brake" class="brake">BRAKE</button>
          <button data-hold="gas" class="gas">GAS</button>
        </div>
      </div>
    </div>

    <!-- Menu -->
    <div id="menu" class="screen">
      <div class="menu-inner">
        <header class="brand">
          <div class="logo" data-logo>GR</div>
          <div>
            <h1><span class="wordmark">GREENREV</span> <span class="sub">Roadtrip</span></h1>
            <p>Drive Naija city to city. Dodge potholes, clear checkpoints, survive the go-slow.</p>
          </div>
        </header>
        <div class="row stats-row">
          <div class="stat"><small>Wallet</small><b id="m-coins">₦0</b></div>
          <div class="stat"><small>Streak</small><b id="m-streak">🔥 0 days</b></div>
          <div class="stat"><small>Level</small><b id="m-level">1</b></div>
          <div class="stat"><small>Hype</small><b id="m-hype">🔥 0</b></div>
          <div class="stat"><small>Loan</small><b id="m-loan">₦0</b></div>
          <div class="stat"><small>Car</small><b id="m-car">Corolla</b></div>
        </div>
        <section>
          <h2>Today's missions</h2>
          <ul id="m-missions" class="missions"></ul>
        </section>
        <section>
          <h2>Pick your journey</h2>
          <div id="m-routes" class="routes"></div>
        </section>
        <div class="row buttons">
          <button class="btn" data-open="garage">🚗 Garage</button>
          <button class="btn" data-open="passport">🛂 Passport</button>
          <button class="btn" data-open="dream">🏁 Dream garage</button>
          <button class="btn invite-btn" data-open="invite">🤝 Invite friends</button>
          <button class="btn" data-open="bank">🏦 Bank</button>
          <button class="btn" data-open="topup">💳 Top up</button>
          <button class="btn" data-open="advertise">📣 Advertise</button>
          <button class="btn" data-open="settings">⚙️ Settings</button>
        </div>
        <div class="gr-strip">
          <button data-cta="marketplace">Shop real cars on <b>GreenRev Marketplace</b> →</button>
          <button data-cta="dealer">Dealer? <b>Sign up on GreenRev</b> →</button>
        </div>
        <footer>Arrow keys / WASD to drive · H horn (honk to hype luxury cars) · C camera · B buy from hawkers · Touch controls on mobile</footer>
      </div>
    </div>

    <!-- Generic modal -->
    <div id="modal" class="screen modal hidden">
      <div class="card">
        <div id="modal-art" class="art"></div>
        <h2 id="modal-title"></h2>
        <div id="modal-body"></div>
        <div id="modal-actions" class="actions"></div>
      </div>
    </div>

    <div id="webgl-error" class="screen hidden">
      <div class="card">
        <h2>3D graphics are switched off</h2>
        <p>Turn on hardware acceleration / WebGL in your browser settings, or try Chrome or Edge.</p>
      </div>
    </div>

    
`;
