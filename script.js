(function(){
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const pupil = document.getElementById('pupil');
  const coreEye = document.getElementById('coreEye');
  const coreOrb = document.getElementById('coreOrb');
  const rings = document.querySelectorAll('.core-ring');

  let visionOn = false, hearingOn = false;

  function refreshStatus(){
    const active = [];
    if (visionOn) active.push('seeing');
    if (hearingOn) active.push('hearing');
    if (active.length){
      statusText.textContent = active.join(' & ') + ' — live';
      statusDot.classList.add('live');
    } else {
      statusText.textContent = 'idle — no senses active';
      statusDot.classList.remove('live');
    }
  }

  // ---------- Vision ----------
  (function(){
    const mod = document.getElementById('mod-vision');
    const toggle = document.getElementById('toggle-vision');
    const readout = document.getElementById('readout-vision');
    let stream = null;
    let video = null;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      readout.innerHTML = '<span class="warn">camera not supported here</span>';
      toggle.disabled = true;
      return;
    }

    toggle.addEventListener('change', async () => {
      if (toggle.checked){
        readout.textContent = 'opening eye…';
        try{
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          video = document.createElement('video');
          video.autoplay = true; video.muted = true; video.playsInline = true;
          video.srcObject = stream;
          pupil.style.display = 'none';
          coreOrb.classList.add('camera-on');
          coreEye.appendChild(video);
          const track = stream.getVideoTracks()[0];
          const s = track.getSettings ? track.getSettings() : {};
          readout.innerHTML = `<span class="ok">watching</span> — ${s.width || '?'}×${s.height || '?'}`;
          mod.classList.add('on');
          visionOn = true;
          refreshStatus();
        }catch(err){
          readout.innerHTML = `<span class="warn">${err.name}: ${err.message}</span>`;
          toggle.checked = false;
        }
      } else {
        if (stream){ stream.getTracks().forEach(t => t.stop()); stream = null; }
        if (video){ video.remove(); video = null; }
        pupil.style.display = '';
        coreOrb.classList.remove('camera-on');
        readout.textContent = 'not watching';
        mod.classList.remove('on');
        visionOn = false;
        refreshStatus();
      }
    });
  })();

  // ---------- Hearing ----------
  (function(){
    const mod = document.getElementById('mod-hearing');
    const toggle = document.getElementById('toggle-hearing');
    const readout = document.getElementById('readout-hearing');
    let stream = null, audioCtx = null, analyser = null, raf = null;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      readout.innerHTML = '<span class="warn">microphone not supported here</span>';
      toggle.disabled = true;
      return;
    }

    function loop(){
      if (!analyser) return;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++){
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const scale = 1 + Math.min(rms * 4, 0.5);
      rings.forEach((r, i) => {
        r.style.transform = `scale(${1 + (scale - 1) * (1 - i * 0.25)})`;
      });
      readout.innerHTML = `<span class="ok">listening</span> — level ${(rms * 100).toFixed(0)}`;
      raf = requestAnimationFrame(loop);
    }

    toggle.addEventListener('change', async () => {
      if (toggle.checked){
        readout.textContent = 'opening ear…';
        try{
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const source = audioCtx.createMediaStreamSource(stream);
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          mod.classList.add('on');
          hearingOn = true;
          refreshStatus();
          loop();
        }catch(err){
          readout.innerHTML = `<span class="warn">${err.name}: ${err.message}</span>`;
          toggle.checked = false;
        }
      } else {
        if (raf) cancelAnimationFrame(raf);
        if (stream){ stream.getTracks().forEach(t => t.stop()); stream = null; }
        if (audioCtx){ audioCtx.close(); audioCtx = null; }
        analyser = null;
        rings.forEach(r => r.style.transform = 'scale(1)');
        readout.textContent = 'not listening';
        mod.classList.remove('on');
        hearingOn = false;
        refreshStatus();
      }
    });
  })();

  // ---------- Memory (file upload) ----------
  (function(){
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const mod = document.getElementById('mod-memory');

    function formatSize(bytes){
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function flashOrb(){
      const orb = document.getElementById('coreOrb');
      orb.style.boxShadow = '0 0 70px rgba(57,255,136,0.45)';
      setTimeout(() => { orb.style.boxShadow = ''; }, 400);
    }

    function addFiles(files){
      if (!files.length) return;
      mod.classList.add('on');
      [...files].forEach(f => {
        const item = document.createElement('div');
        item.className = 'file-item';
        const name = document.createElement('span');
        name.textContent = f.name;
        const size = document.createElement('span');
        size.className = 'size';
        size.textContent = formatSize(f.size);
        item.append(name, size);
        fileList.appendChild(item);
      });
      flashOrb();
    }

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => addFiles(e.target.files));

    ['dragenter','dragover'].forEach(evt =>
      dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); })
    );
    ['dragleave','drop'].forEach(evt =>
      dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); })
    );
    dropZone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
  })();

  // ---------- Prompt ----------
  (function(){
    const mod = document.getElementById('mod-prompt');
    const input = document.getElementById('promptInput');
    const sendBtn = document.getElementById('promptSave');
    const list = document.getElementById('promptList');
    const count = document.getElementById('promptCount');
    const readout = document.getElementById('readout-prompt');

    const modal = document.getElementById('alexModal');
    const chat = document.getElementById('alexChat');
    const modalSub = document.getElementById('alexModalSub');
    const closeBtn = document.getElementById('alexModalClose');
    const closeX = document.getElementById('alexModalX');

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let prompts = [];
    let nextId = 1;
    let timers = [];
    let lastFocus = null;

    // ----- Alex's replies (simulated locally — no AI service is called) -----
    function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

    function makeReply(text){
      const t = text.toLowerCase();
      const short = text.length > 90 ? text.slice(0, 90).trim() + '…' : text;

      if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(t))
        return pick([
          "Hello! Alex here. Good to hear from you. What are we looking at today?",
          "Hey! I was just watching the room. What's on your mind?"
        ]);
      if (/\b(thanks|thank you|thx)\b/.test(t))
        return "You're welcome. I'm here whenever you need me.";
      if (/\b(who are you|your name|what are you)\b/.test(t))
        return "I'm Alex. I read the room to see what's coming next. Everything I notice stays in your browser.";
      if (/\b(camera|vision|see|watch)\b/.test(t))
        return "If you switch on Vision, I can see through your camera. I only watch when you let me, and nothing leaves your device.";
      if (/\b(mic|microphone|hear|listen|sound|audio)\b/.test(t))
        return "Turn on Hearing and I'll listen through your microphone. You'll see the rings around my core move with the sound.";
      if (/\b(file|memory|remember|upload)\b/.test(t))
        return "Drop a file in Memory and I'll hold onto it for this session. When you refresh, I let it go.";
      if (/\bhelp\b/.test(t))
        return "Of course. Tell me what you're trying to do, and give me a sense or a file if it helps me understand.";
      if (t.includes('?'))
        return pick([
          'That\'s a good question: "' + short + '"\n\nI\'m still learning to answer that one well. Tell me a little more and we can work it out together.',
          'Let me think about "' + short + '"\n\nMy first instinct is to look at the context. What are you trying to get done?'
        ]);
      return pick([
        'Got it. You told me: "' + short + '"\n\nI\'ve noted it. Want to add more detail?',
        'Understood. I\'ve taken in "' + short + '" and I\'m watching for what comes next.'
      ]);
    }

    // ----- Modal -----
    function clearTimers(){ timers.forEach(clearTimeout); timers = []; }
    function later(fn, ms){ timers.push(setTimeout(fn, ms)); }

    function scrollChat(){ chat.scrollTop = chat.scrollHeight; }

    function openModal(){
      lastFocus = document.activeElement;
      modal.hidden = false;
      closeBtn.focus();
    }

    function closeModal(){
      clearTimers();
      modal.hidden = true;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function converse(text){
      clearTimers();
      chat.textContent = '';

      const userBubble = document.createElement('div');
      userBubble.className = 'bubble user';
      userBubble.textContent = text;
      chat.appendChild(userBubble);

      const alexBubble = document.createElement('div');
      alexBubble.className = 'bubble alex typing';
      const dots = document.createElement('span');
      dots.className = 'dots';
      dots.innerHTML = '<span></span><span></span><span></span>';
      alexBubble.appendChild(dots);

      modalSub.textContent = 'thinking…';
      modalSub.classList.add('live');
      openModal();

      later(() => {
        chat.appendChild(alexBubble);
        scrollChat();
      }, reduceMotion ? 0 : 350);

      later(() => {
        const reply = makeReply(text);
        modalSub.textContent = 'typing…';
        alexBubble.textContent = '';
        const textNode = document.createTextNode('');
        const caret = document.createElement('span');
        caret.className = 'caret';
        alexBubble.append(textNode, caret);

        if (reduceMotion){
          textNode.nodeValue = reply;
          finish();
          return;
        }

        let n = 0;
        (function step(){
          n++;
          textNode.nodeValue = reply.slice(0, n);
          scrollChat();
          if (n < reply.length){
            const ch = reply[n - 1];
            later(step, /[.,!?\n]/.test(ch) ? 140 : 22);
          } else {
            finish();
          }
        })();

        function finish(){
          alexBubble.classList.add('done');
          modalSub.textContent = 'online';
          modalSub.classList.remove('live');
        }
      }, reduceMotion ? 0 : 1300);
    }

    closeBtn.addEventListener('click', closeModal);
    closeX.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (modal.hidden) return;
      if (e.key === 'Escape') closeModal();
      // keep keyboard focus inside the dialog
      if (e.key === 'Tab'){
        const f = [closeX, closeBtn];
        const idx = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(idx + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });

    // ----- Sent history -----
    function timeLabel(d){
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function flashOrb(){
      const orb = document.getElementById('coreOrb');
      orb.style.boxShadow = '0 0 70px rgba(57,255,136,0.45)';
      setTimeout(() => { orb.style.boxShadow = ''; }, 400);
    }

    function makeBtn(label, onClick){
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ghost';
      b.textContent = label;
      b.addEventListener('click', () => onClick(b));
      return b;
    }

    function render(){
      list.textContent = '';
      prompts.forEach(p => {
        const item = document.createElement('div');
        item.className = 'prompt-item';

        const text = document.createElement('div');
        text.className = 'prompt-text';
        text.textContent = p.text;

        const meta = document.createElement('div');
        meta.className = 'prompt-meta';
        const time = document.createElement('span');
        time.textContent = 'sent ' + timeLabel(p.time);

        const btns = document.createElement('div');
        btns.className = 'btns';
        btns.append(
          makeBtn('Resend', () => converse(p.text)),
          makeBtn('Copy', async (b) => {
            try{ await navigator.clipboard.writeText(p.text); b.textContent = 'Copied'; }
            catch(e){ b.textContent = 'Failed'; }
            setTimeout(() => { b.textContent = 'Copy'; }, 1200);
          }),
          makeBtn('Remove', () => { prompts = prompts.filter(x => x.id !== p.id); update(); })
        );

        meta.append(time, btns);
        item.append(text, meta);
        list.appendChild(item);
      });
    }

    function update(){
      render();
      count.textContent = prompts.length + ' sent';
      readout.textContent = prompts.length ? 'last answered just now' : 'nothing sent yet';
      mod.classList.toggle('on', prompts.length > 0);
      sendBtn.disabled = !input.value.trim();
    }

    function send(){
      const value = input.value.trim();
      if (!value) return;
      prompts.unshift({ id: nextId++, text: value, time: new Date() });
      input.value = '';
      update();
      flashOrb();
      converse(value);
    }

    input.addEventListener('input', () => { sendBtn.disabled = !input.value.trim(); });
    input.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter'){ e.preventDefault(); send(); }
    });
    sendBtn.addEventListener('click', send);

    update();
  })();

})();


// ---------- Background: drifting dust + watching eyes ----------
(function(){
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let w = 0, h = 0, dpr = 1;
  let motes = [];
  let eyes = [];
  let nextEye = 0;
  let raf = null;

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(90, Math.max(35, (w * h) / 16000)));
    motes = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.4 + 0.3,
      vx: (Math.random() - 0.5) * 0.12,
      vy: -(Math.random() * 0.18 + 0.03),
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.02 + 0.005
    }));
  }

  function spawnEye(now){
    // stay away from the middle column where the content is
    const side = Math.random() < 0.5 ? 0 : 1;
    const margin = Math.min(w * 0.22, 220);
    const x = side === 0 ? Math.random() * margin + 12 : w - Math.random() * margin - 12;
    const y = Math.random() * h * 0.9 + h * 0.05;
    const size = Math.random() * 1.8 + 2.2;
    eyes.push({
      x, y, size,
      gap: size * (5 + Math.random() * 2),
      born: now,
      life: 3800 + Math.random() * 2600,
      blinkAt: 0.55 + Math.random() * 0.25
    });
    nextEye = now + 5000 + Math.random() * 7000;
  }

  function drawEye(e, now){
    const t = (now - e.born) / e.life;
    if (t >= 1) return false;
    // fade in, hold, fade out
    let a = t < 0.2 ? t / 0.2 : t > 0.85 ? (1 - t) / 0.15 : 1;
    // quick blink
    let open = 1;
    const b = (t - e.blinkAt) / 0.05;
    if (b > 0 && b < 1) open = Math.abs(1 - b * 2);
    a *= 0.55;

    [-1, 1].forEach(side => {
      const cx = e.x + side * e.gap / 2;
      const g = ctx.createRadialGradient(cx, e.y, 0, cx, e.y, e.size * 5);
      g.addColorStop(0, 'rgba(57,255,136,' + (a * 0.55) + ')');
      g.addColorStop(1, 'rgba(57,255,136,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, e.y, e.size * 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(190,255,215,' + a + ')';
      ctx.beginPath();
      ctx.ellipse(cx, e.y, e.size, Math.max(0.3, e.size * 0.55 * open), 0, 0, Math.PI * 2);
      ctx.fill();
    });
    return true;
  }

  function frame(now){
    ctx.clearRect(0, 0, w, h);

    for (const m of motes){
      m.x += m.vx; m.y += m.vy; m.phase += m.speed;
      if (m.y < -4){ m.y = h + 4; m.x = Math.random() * w; }
      if (m.x < -4) m.x = w + 4;
      if (m.x > w + 4) m.x = -4;
      const a = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(m.phase));
      ctx.fillStyle = 'rgba(57,255,136,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (now >= nextEye && eyes.length < 2) spawnEye(now);
    eyes = eyes.filter(e => drawEye(e, now));

    raf = requestAnimationFrame(frame);
  }

  function drawStatic(){
    ctx.clearRect(0, 0, w, h);
    for (const m of motes){
      ctx.fillStyle = 'rgba(57,255,136,0.25)';
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function start(){
    if (reduceMotion){ drawStatic(); return; }
    if (raf) return;
    nextEye = performance.now() + 3500;
    raf = requestAnimationFrame(frame);
  }

  function stop(){
    if (raf){ cancelAnimationFrame(raf); raf = null; }
  }

  window.addEventListener('resize', () => { resize(); if (reduceMotion) drawStatic(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });

  resize();
  start();
})();