// ═══════════════════════════════════════════════════
// PAYPE CHATBOT WIDGET — Embed in any page
// Usage: <script src="paype-chatbot.js"></script>
// ═══════════════════════════════════════════════════
(function() {
  'use strict';

  // ── CONFIG ─────────────────────────────────────
  var WIDGET_ID = 'paype-chatbot-widget';
  if (document.getElementById(WIDGET_ID)) return; // already loaded

  // ── STYLES ─────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = `
    #paype-chatbot-widget * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, sans-serif; }
    #paype-chatbot-widget { position: fixed; bottom: 24px; right: 24px; z-index: 99999; }

    /* FAB BUTTON */
    #pcw-fab {
      width: 58px; height: 58px; border-radius: 50%;
      background: linear-gradient(135deg, #0D1B3E, #805AD5);
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 24px rgba(13,27,62,.4);
      transition: all .3s ease; position: relative;
    }
    #pcw-fab:hover { transform: scale(1.08); box-shadow: 0 6px 30px rgba(13,27,62,.5); }
    #pcw-fab-icon { font-size: 24px; transition: all .3s; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    #pcw-fab { overflow: visible; padding: 0; }
    #pcw-fab-icon svg, #pcw-avatar svg, .pcw-msg-av svg { width: 100%; height: 100%; display: block; border-radius: 50%; }
    .pcw-msg.ai .pcw-msg-av { overflow: hidden; background: none; }
    #pcw-fab-dot {
      position: absolute; top: 2px; right: 2px;
      width: 14px; height: 14px; border-radius: 50%;
      background: #00C2A8; border: 2px solid white;
      animation: pcw-pulse 2s infinite;
    }
    @keyframes pcw-pulse { 0%,100%{transform:scale(1);opacity:1;} 50%{transform:scale(1.2);opacity:.7;} }

    /* TOOLTIP */
    #pcw-tooltip {
      position: absolute; bottom: 68px; right: 0;
      background: #0D1B3E; color: white;
      padding: 8px 14px; border-radius: 10px;
      font-size: 12px; font-weight: 600; white-space: nowrap;
      box-shadow: 0 4px 16px rgba(0,0,0,.2);
      opacity: 0; pointer-events: none; transition: opacity .3s;
    }
    #pcw-tooltip::after {
      content: ''; position: absolute; bottom: -5px; right: 20px;
      width: 10px; height: 10px;
      background: #0D1B3E; transform: rotate(45deg);
    }
    #paype-chatbot-widget:hover #pcw-tooltip { opacity: 1; }

    /* CHAT WINDOW */
    #pcw-window {
      position: absolute; bottom: 72px; right: 0;
      width: 380px; height: 540px;
      background: white; border-radius: 18px;
      box-shadow: 0 16px 60px rgba(0,0,0,.2);
      display: none; flex-direction: column; overflow: hidden;
      border: 1px solid rgba(0,0,0,.08);
      animation: pcw-slideup .3s ease;
    }
    @keyframes pcw-slideup { from{opacity:0;transform:translateY(20px);} to{opacity:1;transform:translateY(0);} }
    #pcw-window.open { display: flex; }

    /* HEADER */
    #pcw-header {
      background: linear-gradient(135deg, #0D1B3E, #1a1a4e);
      padding: 14px 16px; display: flex; align-items: center; gap: 10px;
      flex-shrink: 0;
    }
    #pcw-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      background: linear-gradient(135deg, #00C2A8, #805AD5);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
    }
    #pcw-name { font-size: 14px; font-weight: 700; color: white; }
    #pcw-status { font-size: 11px; color: rgba(255,255,255,.5); margin-top: 1px; display: flex; align-items: center; gap: 4px; }
    #pcw-status-dot { width: 6px; height: 6px; border-radius: 50%; background: #00C2A8; animation: pcw-pulse 2s infinite; }
    #pcw-header-actions { margin-left: auto; display: flex; gap: 6px; }
    .pcw-hbtn { background: rgba(255,255,255,.1); border: none; color: rgba(255,255,255,.7); width: 28px; height: 28px; border-radius: 8px; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; transition: .15s; }
    .pcw-hbtn:hover { background: rgba(255,255,255,.2); color: white; }

    /* QUICK LINKS */
    #pcw-quicklinks {
      padding: 10px 12px; border-bottom: 1px solid #F0F4F8;
      display: flex; gap: 6px; overflow-x: auto; flex-shrink: 0;
      background: #FAFBFC;
    }
    #pcw-quicklinks::-webkit-scrollbar { display: none; }
    .pcw-ql {
      padding: 5px 10px; background: white; border: 1px solid #E2E8F0;
      border-radius: 20px; font-size: 11px; font-weight: 600; color: #0D1B3E;
      cursor: pointer; white-space: nowrap; transition: .15s; flex-shrink: 0;
    }
    .pcw-ql:hover { background: #0D1B3E; color: white; border-color: #0D1B3E; }

    /* MESSAGES */
    #pcw-messages {
      flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px;
      background: #FAFBFC;
    }
    #pcw-messages::-webkit-scrollbar { width: 3px; }
    #pcw-messages::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 2px; }
    .pcw-msg { display: flex; gap: 8px; max-width: 88%; }
    .pcw-msg.user { align-self: flex-end; flex-direction: row-reverse; }
    .pcw-msg-av { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
    .pcw-msg.ai .pcw-msg-av { background: linear-gradient(135deg, #00C2A8, #805AD5); color: white; }
    .pcw-msg.user .pcw-msg-av { background: #0D1B3E; color: white; }
    .pcw-bubble { padding: 9px 12px; border-radius: 12px; font-size: 12px; line-height: 1.6; }
    .pcw-msg.ai .pcw-bubble { background: white; border: 1px solid #E2E8F0; border-radius: 4px 12px 12px 12px; color: #1A202C; }
    .pcw-msg.user .pcw-bubble { background: #0D1B3E; color: white; border-radius: 12px 4px 12px 12px; }
    .pcw-time { font-size: 10px; color: #718096; margin-top: 3px; }
    .pcw-msg.user .pcw-time { text-align: right; }

    /* TYPING */
    .pcw-typing { display: flex; gap: 4px; padding: 10px 12px; background: white; border: 1px solid #E2E8F0; border-radius: 4px 12px 12px 12px; width: 50px; }
    .pcw-typing span { width: 6px; height: 6px; border-radius: 50%; background: #00C2A8; animation: pcw-blink 1.2s infinite; }
    .pcw-typing span:nth-child(2) { animation-delay: .2s; }
    .pcw-typing span:nth-child(3) { animation-delay: .4s; }
    @keyframes pcw-blink { 0%,80%,100%{opacity:.3;} 40%{opacity:1;} }

    /* INPUT */
    #pcw-input-area { padding: 10px 12px; border-top: 1px solid #E2E8F0; background: white; flex-shrink: 0; }
    #pcw-input-row { display: flex; gap: 7px; align-items: flex-end; }
    #pcw-input {
      flex: 1; border: 1.5px solid #E2E8F0; border-radius: 10px;
      padding: 8px 12px; font-size: 12px; outline: none; resize: none;
      max-height: 80px; line-height: 1.5; font-family: inherit;
      transition: .15s;
    }
    #pcw-input:focus { border-color: #00C2A8; }
    #pcw-send {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, #0D1B3E, #1a3a7c);
      border: none; cursor: pointer; color: white;
      display: flex; align-items: center; justify-content: center;
      transition: .15s; flex-shrink: 0;
    }
    #pcw-send:hover { opacity: .9; }
    #pcw-send:disabled { opacity: .5; cursor: not-allowed; }
    #pcw-powered { text-align: center; font-size: 10px; color: #718096; margin-top: 7px; }
    #pcw-powered span { color: #805AD5; font-weight: 600; }

    /* NAV LINKS */
    .pcw-navlinks { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
    .pcw-navlink {
      padding: 4px 10px; background: #F0F4F8; border-radius: 20px;
      font-size: 11px; font-weight: 600; color: #0D1B3E; cursor: pointer;
      text-decoration: none; border: 1px solid #E2E8F0; transition: .15s;
      display: inline-flex; align-items: center; gap: 4px;
    }
    .pcw-navlink:hover { background: #0D1B3E; color: white; }

    @media(max-width: 440px) {
      #pcw-window { width: calc(100vw - 32px); right: -12px; }
    }
  `;
  document.head.appendChild(style);

  var PCW_FACE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14b8a6"/><stop offset="1" stop-color="#7c3aed"/></linearGradient><linearGradient id="psr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff7e6"/><stop offset="1" stop-color="#f3dcae"/></linearGradient></defs><circle cx="32" cy="32" r="32" fill="url(#pbg)"/><path d="M17.5 28C16 13 25 8 32 8s16 5 14.5 20c1 8 2 14 1 22H16.5c-1-8 0-14 1-22z" fill="#1d1630"/><path d="M6 64c1-12 10-17 26-17s25 5 26 17z" fill="url(#psr)"/><path d="M22 64c0-10 3-15 6-17l6 0c6 3 10 8 12 17z" fill="#0f766e"/><path d="M22 64c0-10 3-15 6-17" stroke="#f5b800" stroke-width="1.6" fill="none"/><rect x="28" y="38" width="8" height="10" rx="3" fill="#d89a6a"/><ellipse cx="32" cy="27.5" rx="12" ry="13.5" fill="#ebb98d"/><path d="M32 11.5C23.5 11.5 19 18 19.6 28.5C21 21 25 17.2 32 16.2z" fill="#1d1630"/><path d="M32 11.5C40.5 11.5 45 18 44.4 28.5C43 21 39 17.2 32 16.2z" fill="#1d1630"/><path d="M32 11.8v4.4" stroke="#7a6a64" stroke-width=".7"/><path d="M25 24q3-2.2 6 0M33 24q3-2.2 6 0" stroke="#1d1630" stroke-width="1.1" fill="none" stroke-linecap="round"/><path d="M25.5 27.4q2.5 1.6 5 0q-2.5-1.8-5 0zM34.5 27.4q2.5 1.6 5 0q-2.5-1.8-5 0z" fill="#2b1a12"/><circle cx="32" cy="19.8" r="1.5" fill="#d6212a"/><circle cx="33.9" cy="31.4" r=".7" fill="#f5b800"/><path d="M29.5 34q2.5 2.2 5 0" stroke="#b3403a" stroke-width="1.3" fill="none" stroke-linecap="round"/><path d="M18.2 30.5a2.4 2.4 0 014.8 0z" fill="#f5b800"/><path d="M41.0 30.5a2.4 2.4 0 014.8 0z" fill="#f5b800"/><circle cx="20.6" cy="33.2" r="1.1" fill="#f5b800"/><circle cx="43.4" cy="33.2" r="1.1" fill="#f5b800"/><circle cx="44.8" cy="16.5" r="1.7" fill="#fff"/><circle cx="44.8" cy="16.5" r=".5" fill="#f5d36b"/><circle cx="43.4" cy="13.3" r="1.7" fill="#fff"/><circle cx="43.4" cy="13.3" r=".5" fill="#f5d36b"/><circle cx="41.3" cy="10.5" r="1.7" fill="#fff"/><circle cx="41.3" cy="10.5" r=".5" fill="#f5d36b"/><circle cx="38.6" cy="8.4" r="1.7" fill="#fff"/><circle cx="38.6" cy="8.4" r=".5" fill="#f5d36b"/><circle cx="35.4" cy="7.1" r="1.7" fill="#fff"/><circle cx="35.4" cy="7.1" r=".5" fill="#f5d36b"/><circle cx="32.0" cy="6.6" r="1.7" fill="#fff"/><circle cx="32.0" cy="6.6" r=".5" fill="#f5d36b"/><circle cx="28.6" cy="7.1" r="1.7" fill="#fff"/><circle cx="28.6" cy="7.1" r=".5" fill="#f5d36b"/><circle cx="25.4" cy="8.4" r="1.7" fill="#fff"/><circle cx="25.4" cy="8.4" r=".5" fill="#f5d36b"/><circle cx="22.7" cy="10.5" r="1.7" fill="#fff"/><circle cx="22.7" cy="10.5" r=".5" fill="#f5d36b"/><circle cx="20.6" cy="13.3" r="1.7" fill="#fff"/><circle cx="20.6" cy="13.3" r=".5" fill="#f5d36b"/><circle cx="19.2" cy="16.5" r="1.7" fill="#fff"/><circle cx="19.2" cy="16.5" r=".5" fill="#f5d36b"/></svg>';

  // ── HTML ───────────────────────────────────────
  var widget = document.createElement('div');
  widget.id = WIDGET_ID;
  widget.innerHTML = `
    <div id="pcw-tooltip">💬 Ask Saraswathi</div>
    <div id="pcw-window">
      <div id="pcw-header">
        <div id="pcw-avatar">${PCW_FACE}</div>
        <div>
          <div id="pcw-name">PAYPE Saraswathi</div>
          <div id="pcw-status"><div id="pcw-status-dot"></div>Always online · Finance helper</div>
        </div>
        <div id="pcw-header-actions">
          <button class="pcw-hbtn" onclick="pcwClear()" title="Clear chat">🗑</button>
          <button class="pcw-hbtn" onclick="pcwGoAI()" title="Open Full AI">⬆</button>
          <button class="pcw-hbtn" onclick="pcwToggle()" title="Close">✕</button>
        </div>
      </div>
      <div id="pcw-quicklinks">
        <button class="pcw-ql" onclick="pcwAsk('What is the GST rate for software services?')">🔢 GST rate</button>
        <button class="pcw-ql" onclick="pcwAsk('How to record salary payment in journal entry?')">📒 Journal entry</button>
        <button class="pcw-ql" onclick="pcwAsk('What is TDS section 194C rate?')">📋 TDS 194C</button>
        <button class="pcw-ql" onclick="pcwAsk('How to calculate CGST and SGST?')">💰 CGST/SGST</button>
        <button class="pcw-ql" onclick="pcwAsk('What documents needed for GST registration?')">📄 GST docs</button>
        <button class="pcw-ql" onclick="pcwAsk('Explain double entry bookkeeping simply')">📖 Bookkeeping</button>
      </div>
      <div id="pcw-messages"></div>
      <div id="pcw-input-area">
        <div id="pcw-input-row">
          <textarea id="pcw-input" rows="1" placeholder="Type or press the mic and speak (Tamil, Hindi, English...)"></textarea>
          <button id="pcw-spk" title="Hear her answers" onclick="pcwToggleSpeak()" style="width:34px;height:36px;border:none;background:none;cursor:pointer;font-size:17px;flex-shrink:0;">🔇</button>
          <button id="pcw-mic" title="Speak to Saraswathi" onclick="pcwMic()" style="width:36px;height:36px;border-radius:10px;border:1.5px solid #E2E8F0;background:#fff;cursor:pointer;font-size:17px;flex-shrink:0;">🎤</button>
          <button id="pcw-send" onclick="pcwSend()">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
        <div id="pcw-powered">PAYPE Saraswathi · <span>PayPe Technologies</span></div>
      </div>
    </div>
    <button id="pcw-fab" onclick="pcwToggle()">
      <span id="pcw-fab-icon">${PCW_FACE}</span>
      <div id="pcw-fab-dot"></div>
    </button>
  `;
  document.body.appendChild(widget);

  // ── STATE ──────────────────────────────────────
  var pcwOpen = false;
  var pcwHistory = [];
  var pcwGreeted = false;

  var pcwPages = {
    accounting: { name: 'Accounting', url: 'https://erp.paype.co.in' },
    hrms:       { name: 'HRMS',       url: 'https://hr.paype.co.in' },
    inventory:  { name: 'Inventory & CRM', url: 'https://doctorramesh5-ops.github.io/paype-erp/inventory.html' },
    ai:         { name: 'AI Assistant', url: 'https://doctorramesh5-ops.github.io/paype-erp/ai.html' }
  };

  var pcwCompany = {
    name: 'PayPe Technologies Pvt. Ltd.',
    gstin: '33AAMCP7960K1ZU',
    state: 'Tamil Nadu',
    city: 'Coimbatore',
    fy: '2026-27'
  };

  // Detect current page
  var pcwCurrentPage = 'general';
  var href = window.location.href;
  if (href.includes('hr.paype.co.in') || href.includes('hrms')) pcwCurrentPage = 'hrms';
  else if (href.includes('erp.paype.co.in') || href.includes('accounting')) pcwCurrentPage = 'accounting';
  else if (href.includes('inventory')) pcwCurrentPage = 'inventory';
  else if (href.includes('/ai')) pcwCurrentPage = 'ai';

  // ── FUNCTIONS ──────────────────────────────────
  window.pcwToggle = function() {
    pcwOpen = !pcwOpen;
    var win = document.getElementById('pcw-window');
    var icon = document.getElementById('pcw-fab-icon');
    if (pcwOpen) {
      win.classList.add('open');
      icon.textContent = '✕';icon.style.fontSize = '22px';icon.style.color = '#fff';
      if (!pcwGreeted) { pcwGreet(); pcwGreeted = true; }
      setTimeout(function(){ document.getElementById('pcw-input').focus(); }, 300);
    } else {
      win.classList.remove('open');
      icon.innerHTML = PCW_FACE;
    }
  };

  window.pcwClear = function() {
    pcwHistory = [];
    document.getElementById('pcw-messages').innerHTML = '';
    pcwGreeted = false;
    pcwGreet();
  };

  window.pcwGoAI = function() {
    window.open('https://doctorramesh5-ops.github.io/paype-erp/ai.html', '_blank');
  };

  function pcwGreet() {
    var hour = new Date().getHours();
    var greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    var pageCtx = {
      hrms: 'I can help with employee management, payroll, attendance, and HR queries.',
      accounting: 'I can help with journal entries, GST, TDS, invoices, and financial queries.',
      inventory: 'I can help with stock management, purchase orders, CRM leads, and inventory queries.',
      ai: 'I am the full AI assistant. Ask me anything!',
      general: 'I can help with accounting, GST, HR, inventory, and all business queries.'
    };
    var navHtml = '<div class="pcw-navlinks">' +
      '<a class="pcw-navlink" href="https://erp.paype.co.in" target="_blank">📊 Accounting</a>' +
      '<a class="pcw-navlink" href="https://hr.paype.co.in" target="_blank">👥 HRMS</a>' +
      '<a class="pcw-navlink" href="https://doctorramesh5-ops.github.io/paype-erp/inventory.html" target="_blank">📦 Inventory</a>' +
      (pcwRole() === 'admin' ? '<a class="pcw-navlink" href="https://doctorramesh5-ops.github.io/paype-erp/ai.html" target="_blank">🤖 PAYPE Saraswathi</a>' : '') +
      '</div>';

    pcwAddMsg('ai', greet + '! 👋 I\'m PAYPE Saraswathi.\n' + (pcwTok() ? (pageCtx[pcwCurrentPage] || pageCtx.general) : 'Ask me about PAYPE products, plans and how to buy.') + '\n\nHow can I help you today?' + navHtml);
  }

  window.pcwAsk = function(text) {
    document.getElementById('pcw-input').value = text;
    pcwSend();
  };

  window.pcwSend = function() {
    var input = document.getElementById('pcw-input');
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';

    pcwAddMsg('user', text);
    var typing = pcwAddTyping();
    document.getElementById('pcw-send').disabled = true;

    pcwHistory.push({ role: 'user', content: text });

    function pcwDone(reply) {
      pcwRemoveTyping(typing);
      pcwHistory.push({ role: 'assistant', content: reply });
      pcwAddMsg('ai', reply);
      document.getElementById('pcw-send').disabled = false;
      if (pcwVoiceOn) pcwSpeak(reply);
    }
    function pcwAsk(path, withToken) {
      var h = { 'Content-Type': 'application/json' };
      if (withToken) h.Authorization = 'Bearer ' + pcwTok();
      return fetch('https://erpapi.paype.co.in' + path, { method: 'POST', headers: h, body: JSON.stringify({ messages: pcwHistory.slice(-12), max_tokens: 500 }) })
        .then(function(r){ return r.json().then(function(j){ return { status: r.status, j: j }; }); });
    }
    function pcwText(x) { return (x.j && x.j.success && x.j.data && x.j.data.content && x.j.data.content[0]) ? x.j.data.content[0].text : null; }
    (pcwTok() ? pcwAsk('/api/ai/saraswathi', true) : pcwAsk('/api/ai/public', false))
    .then(function(x) {
      if (x.status === 401 && pcwTok()) return pcwAsk('/api/ai/public', false);
      return x;
    })
    .then(function(x) { pcwDone(pcwText(x) || (x.j && x.j.message) || 'Sorry, I could not respond. Please try again.'); })
    .catch(function() { pcwDone('Connection error. Please check your internet and try again.'); });
  };

/* voice-1 */
  var pcwVoiceOn = false, pcwRec = null, pcwChunks = [], pcwAudio = null;
  function pcwVoicePath(k) { return (pcwTok() ? '/api/voice/' : '/api/voice/public-') + k; }
  function pcwVoicePost(k, body) {
    var h = { 'Content-Type': 'application/json' };
    if (pcwTok()) h.Authorization = 'Bearer ' + pcwTok();
    return fetch('https://erpapi.paype.co.in' + pcwVoicePath(k), { method: 'POST', headers: h, body: JSON.stringify(body) }).then(function(r){ return r.json(); });
  }
  window.pcwToggleSpeak = function() {
    pcwVoiceOn = !pcwVoiceOn;
    document.getElementById('pcw-spk').textContent = pcwVoiceOn ? '🔊' : '🔇';
    if (!pcwVoiceOn && pcwAudio) { try { pcwAudio.pause(); } catch (e) {} }
  };
  function pcwSpeak(text) {
    pcwVoicePost('tts', { text: text }).then(function(d) {
      if (!d || !d.success) return;
      if (pcwAudio) { try { pcwAudio.pause(); } catch (e) {} }
      pcwAudio = new Audio('data:' + (d.mime || 'audio/mpeg') + ';base64,' + d.audio);
      pcwAudio.play().catch(function(){});
    }).catch(function(){});
  }
  window.pcwMic = function() {
    var mic = document.getElementById('pcw-mic');
    if (pcwRec) { pcwRec.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { pcwAddMsg('ai', 'This browser does not support voice. Please type your question.'); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
      var mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
      var rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      pcwRec = rec; pcwChunks = [];
      mic.textContent = '⏹'; mic.style.background = '#fee2e2'; mic.style.borderColor = '#e53e3e';
      var stopTimer = setTimeout(function(){ if (pcwRec === rec) rec.stop(); }, 25000);
      rec.ondataavailable = function(e) { if (e.data && e.data.size) pcwChunks.push(e.data); };
      rec.onstop = function() {
        clearTimeout(stopTimer);
        stream.getTracks().forEach(function(t){ t.stop(); });
        pcwRec = null; mic.textContent = '🎤'; mic.style.background = '#fff'; mic.style.borderColor = '#E2E8F0';
        var type = (rec.mimeType || 'audio/webm').split(';')[0];
        var blob = new Blob(pcwChunks, { type: type });
        if (blob.size < 1500) return;
        var typing = pcwAddTyping();
        var fr = new FileReader();
        fr.onload = function() {
          var b64 = String(fr.result).split(',')[1] || '';
          pcwVoicePost('stt', { audio: b64, mime: type }).then(function(d) {
            pcwRemoveTyping(typing);
            if (!d || !d.success) { pcwAddMsg('ai', (d && d.message) || 'I could not understand. Please try again or type.'); return; }
            document.getElementById('pcw-input').value = d.transcript;
            if (!pcwVoiceOn) window.pcwToggleSpeak();
            pcwSend();
          }).catch(function(){ pcwRemoveTyping(typing); pcwAddMsg('ai', 'Connection error. Please try again.'); });
        };
        fr.readAsDataURL(blob);
      };
      rec.start();
    }).catch(function() { pcwAddMsg('ai', 'Please allow the microphone in your browser to speak to me.'); });
  };

  function pcwRole() { try { return (JSON.parse(localStorage.getItem('erp_user') || 'null') || {}).role || ''; } catch (e) { return ''; } }
  function pcwTok() { try { return localStorage.getItem('erp_token') || ''; } catch (e) { return ''; } }

  function pcwAddMsg(role, html) {
    var msgs = document.getElementById('pcw-messages');
    var div = document.createElement('div');
    div.className = 'pcw-msg ' + role;
    var time = new Date().toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'});
    var avText = role === 'ai' ? PCW_FACE : '👤';
    var formatted = html
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code style="background:#F0F4F8;padding:1px 5px;border-radius:4px;font-size:11px;">$1</code>')
      .replace(/\n/g, '<br>');
    div.innerHTML = '<div class="pcw-msg-av">' + avText + '</div><div><div class="pcw-bubble">' + formatted + '</div><div class="pcw-time">' + time + '</div></div>';
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function pcwAddTyping() {
    var msgs = document.getElementById('pcw-messages');
    var div = document.createElement('div');
    div.className = 'pcw-msg ai';
    div.id = 'pcw-typing';
    div.innerHTML = '<div class="pcw-msg-av">' + PCW_FACE + '</div><div><div class="pcw-typing"><span></span><span></span><span></span></div></div>';
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function pcwRemoveTyping(el) { if(el && el.parentNode) el.parentNode.removeChild(el); }

  // Keyboard support
  document.getElementById('pcw-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); pcwSend(); }
  });
  document.getElementById('pcw-input').addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });

})();
