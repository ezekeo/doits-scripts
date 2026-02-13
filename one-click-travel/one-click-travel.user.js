// ==UserScript==
// ==UserScript==
// @name         1 One-Click Travel — One Click Return
// @namespace    https://github.com/doitsburger/doits-scripts
// @version      7.0
// @description  Separate floating travel buttons: one click for travel/return (fully automatic return)
// @match        https://www.torn.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @downloadURL  https://raw.githubusercontent.com/doitsburger/doits-scripts/refs/heads/main/one-click-travel/one-click-travel.user.js
// @updateURL    https://raw.githubusercontent.com/doitsburger/doits-scripts/refs/heads/main/one-click-travel/one-click-travel.user.js
// ==/UserScript==

(function(){
  'use strict';

  /* ======== CONFIG ======== */
  const UI_POLL_MS = 1500;
  const AUTO_TRAVEL_TTL = 1000*60*3;

  const COUNTRY_LIST = [
    { name:'Mexico', city:'Ciudad Juárez', flag:'/images/v2/travel_agency/flags/fl_mexico.svg' },
    { name:'Cayman Islands', city:'George Town', flag:'/images/v2/travel_agency/flags/fl_cayman_islands.svg' },
    { name:'Canada', city:'Toronto', flag:'/images/v2/travel_agency/flags/fl_canada.svg' },
    { name:'Hawaii', city:'Honolulu', flag:'/images/v2/travel_agency/flags/fl_hawaii.svg' },
    { name:'United Kingdom', city:'London', flag:'/images/v2/travel_agency/flags/fl_uk.svg' },
    { name:'Argentina', city:'Buenos Aires', flag:'/images/v2/travel_agency/flags/fl_argentina.svg' },
    { name:'Switzerland', city:'Zurich', flag:'/images/v2/travel_agency/flags/fl_switzerland.svg' },
    { name:'Japan', city:'Tokyo', flag:'/images/v2/travel_agency/flags/fl_japan.svg' },
    { name:'China', city:'Beijing', flag:'/images/v2/travel_agency/flags/fl_china.svg' },
    { name:'UAE', city:'Dubai', flag:'/images/v2/travel_agency/flags/fl_uae.svg' },
    { name:'South Africa', city:'Johannesburg', flag:'/images/v2/travel_agency/flags/fl_south_africa.svg' }
  ];

  const STORAGE_SELECTED = 'torn_travel_selected_country';
  const STORAGE_TRAVELING = 'torn_travel_flag_traveling';
  const STORAGE_AUTO_TARGET = 'torn_auto_travel_target';
  const STORAGE_AUTO_REQUESTED = 'torn_auto_travel_requested';
  const STORAGE_FLYING_ENABLED = 'torn_country_flying_enabled';

  /* ======== STATE ======== */
  let selectedCountryName = GM_getValue(STORAGE_SELECTED, COUNTRY_LIST[0].name);
  let travelingFlag = GM_getValue(STORAGE_TRAVELING, false);
  let countryFlyingEnabled = GM_getValue(STORAGE_FLYING_ENABLED, true);

  /* ======== HELPERS ======== */
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const sleep = ms => new Promise(r=>setTimeout(r, ms));

  function countryByName(name){
    return COUNTRY_LIST.find(c => c.name.toLowerCase() === (name||'').toLowerCase()) || COUNTRY_LIST[0];
  }

  function emojiFallback(name){
    const map = {
      'mexico':'🇲🇽','cayman islands':'🇰🇾','canada':'🇨🇦','hawaii':'🇺🇸','united kingdom':'🇬🇧',
      'argentina':'🇦🇷','switzerland':'🇨🇭','japan':'🇯🇵','china':'🇨🇳','united arab emirates':'🇦🇪','south africa':'🇿🇦'
    };
    return map[(name||'').toLowerCase()] || '✈️';
  }

  function showToast(text, ok=true){
    const id='torn-travel-toast';
    const ex = document.getElementById(id); if(ex) ex.remove();
    const el = document.createElement('div'); el.id=id; el.textContent=text;
    Object.assign(el.style,{
      position:'fixed',right:'18px',top:'18px',zIndex:2147484000,
      padding:'8px 12px',background: ok? '#2ecc71':'#e74c3c',color:'#fff',
      borderRadius:'6px',fontWeight:600,boxShadow:'0 6px 20px rgba(0,0,0,0.25)'
    });
    document.body.appendChild(el);
    setTimeout(()=>{ if(el.parentNode) el.parentNode.removeChild(el); },2800);
  }

  function safeClick(el){
    if(!el) return false;
    try {
      el.click();
      return true;
    } catch(e){
      try {
        const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
        el.dispatchEvent(ev);
        return true;
      } catch(e2){
        return false;
      }
    }
  }

  function waitForSelector(selector, timeout=1000){
    return new Promise((resolve,reject)=>{
      const el = document.querySelector(selector);
      if(el) return resolve(el);
      const obs = new MutationObserver((m,o)=>{
        const e = document.querySelector(selector);
        if(e){ o.disconnect(); clearTimeout(t); resolve(e); }
      });
      obs.observe(document.body, {childList:true, subtree:true});
      const t = setTimeout(()=>{ obs.disconnect(); reject(new Error('timeout')); }, timeout);
    });
  }

  function findExpandButtonByCountryName(countryName){
    const candidates = $$('button.expandButton___Q7fCV, button.expandButton, .expandButton___Q7fCV, button');
    const target = (countryName||'').toLowerCase();
    for(const b of candidates){
      const span = b.querySelector('.country___bzUdI, .name___ERdKb, .country, .destinationDetails____Y_zO .country___bzUdI');
      const text = (span && span.textContent) ? span.textContent.trim().toLowerCase() : (b.textContent||'').trim().toLowerCase();
      if(text.includes(target)) return b;
    }
    return null;
  }

  /* ======== SIMPLE & RELIABLE State detection ======== */
  function isAbroadByHeader(){
    const bodyText = document.body.textContent.toLowerCase();

    // Check for CLEAR indicators of being abroad
    if (bodyText.includes('you are in') && !bodyText.includes('torn city')) {
      return true;
    }

    if (bodyText.includes('arrived in') && !bodyText.includes('torn city')) {
      return true;
    }

    const locationText = document.body.innerHTML.toLowerCase();
    for (const country of COUNTRY_LIST) {
      const countryName = country.name.toLowerCase();
      if (locationText.includes(`you are in ${countryName}`) ||
          locationText.includes(`arrived in ${countryName}`) ||
          locationText.includes(`currently in ${countryName}`)) {
        return true;
      }
    }

    if (bodyText.includes('return to torn') ||
        bodyText.includes('come back to torn') ||
        bodyText.includes('travel home')) {
      return true;
    }

    const travelHomeElements = $$('a[href*="travelHome"], a.travel-home, .travel-home-link, a[onclick*="travelHome"]');
    if (travelHomeElements.length > 0) {
      return true;
    }

    if (window.location.href.includes('sid=travel')) {
      const hasReturnText = bodyText.includes('return to torn city') || bodyText.includes('travel home from');
      const hasCountryList = bodyText.includes('mexico') || bodyText.includes('canada') || bodyText.includes('japan');

      if (hasReturnText && !hasCountryList) {
        return true;
      }
    }

    return false;
  }

  function isTravelingByDOM(){
    if($('.travelTimer')) return true;
    const t = document.body.innerText || '';
    if(/you are already travelling|you are travelling|you are already traveling|travel timer/i.test(t)) return true;
    return false;
  }

  function getState(){
    if(isTravelingByDOM()) return 'traveling';
    if(isAbroadByHeader()) return 'abroad';
    return 'home';
  }

  /* ======== FLOATING BUTTONS ======== */
  function buildFloatingButtons(){
    // Remove existing buttons if any
    if($('#torn-travel-btn')) $('#torn-travel-btn').remove();
    if($('#torn-picker-btn')) $('#torn-picker-btn').remove();

    // Main travel button - ALWAYS VISIBLE
    const travelBtn = document.createElement('button');
    travelBtn.id = 'torn-travel-btn';
    Object.assign(travelBtn.style,{
      position: 'fixed',
      right: '2px',
      bottom: '262px',
      zIndex: 10000,
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      border: 'none',
      background: '#fff',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      cursor: 'pointer',
      padding: 0,
      margin: 0,
      userSelect: 'none',
      transition: 'all 0.2s ease',
      outline: 'none',
      fontSize: '0',
      visibility: 'visible',
      opacity: '1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    });

    // Country picker button
    const pickerBtn = document.createElement('button');
    pickerBtn.id = 'torn-picker-btn';
    pickerBtn.innerHTML = '🌏';
    pickerBtn.title = 'Change destination';
    Object.assign(pickerBtn.style,{
      position: 'fixed',
      right: '2px',
      bottom: '293px',
      zIndex: 10000,
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      border: '2px solid #666',
      background: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '16px',
      padding: '0',
      margin: '0',
      opacity: '0.8',
      transition: 'all 0.2s ease',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
    });

    // Inner container for the main button
    const inner = document.createElement('div');
    inner.id = 'torn-travel-btn-inner';
    Object.assign(inner.style,{
      width: '25px',
      height: '25px',
      borderRadius: '50%',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative'
    });
    travelBtn.appendChild(inner);

    // Add buttons directly to body
    document.body.appendChild(travelBtn);
    document.body.appendChild(pickerBtn);

    /* ======== EVENT HANDLERS ======== */

    // Main travel button click
    travelBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Visual feedback
      travelBtn.style.transform = 'scale(0.9)';
      setTimeout(() => {
        travelBtn.style.transform = 'scale(1)';
      }, 200);

      await triggerOneClickTravel();
    });

    // Picker button click
    pickerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Visual feedback
      pickerBtn.style.transform = 'scale(0.9)';
      pickerBtn.style.background = '#f0f0f0';
      setTimeout(() => {
        pickerBtn.style.transform = 'scale(1)';
        pickerBtn.style.background = '#fff';
      }, 200);

      openCountryPicker();
    });

    // Hover effects
    travelBtn.addEventListener('mouseenter', () => {
      travelBtn.style.boxShadow = '0 6px 25px rgba(0,0,0,0.5)';
      travelBtn.style.transform = 'scale(1.05)';
    });
    travelBtn.addEventListener('mouseleave', () => {
      travelBtn.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)';
      travelBtn.style.transform = 'scale(1)';
    });

    pickerBtn.addEventListener('mouseenter', () => {
      pickerBtn.style.opacity = '1';
      pickerBtn.style.boxShadow = '0 3px 10px rgba(0,0,0,0.4)';
      pickerBtn.style.borderColor = '#2f80ed';
      pickerBtn.style.transform = 'scale(1.05)';
    });
    pickerBtn.addEventListener('mouseleave', () => {
      pickerBtn.style.opacity = '0.8';
      pickerBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
      pickerBtn.style.borderColor = '#666';
      pickerBtn.style.transform = 'scale(1)';
    });

    // Initial render
    renderButtonState();
  }

  function renderButtonState(){
    const travelBtn = $('#torn-travel-btn');
    const pickerBtn = $('#torn-picker-btn');
    const inner = $('#torn-travel-btn-inner');

    if(!travelBtn || !inner) return;

    inner.innerHTML = '';
    const state = getState();

    console.log('Current state:', state, 'URL:', window.location.href);

    // ALWAYS show main button
    travelBtn.style.display = 'flex';
    travelBtn.style.visibility = 'visible';
    travelBtn.style.opacity = '1';

    if(state === 'abroad'){
      // Create container for layered effect
      const container = document.createElement('div');
      Object.assign(container.style, {
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        overflow: 'hidden'
      });

      // Add home icon (background)
      const icon = document.createElement('div');
      icon.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3l9 8h-3v8h-11v-8h-3z" fill="#e74c3c"/>
      </svg>`;
      Object.assign(icon.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      });

      // Add border on top
      const border = document.createElement('div');
      Object.assign(border.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        border: '3px solid #e74c3c',
        pointerEvents: 'none',
        boxSizing: 'border-box'
      });

      container.appendChild(icon);
      container.appendChild(border);
      inner.appendChild(container);

      travelBtn.title = 'RETURN TO TORN CITY - Click to go home';

      // Hide picker when abroad
      if (pickerBtn) {
        pickerBtn.style.display = 'none';
      }

      // Red border for return
      travelBtn.style.background = '#ffebee';
      travelBtn.style.boxShadow = '0 4px 20px rgba(231, 76, 60, 0.4)';

    } else if (state === 'traveling') {
      // Create container for layered effect
      const container = document.createElement('div');
      Object.assign(container.style, {
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        overflow: 'hidden'
      });

      // Add airplane icon (background)
      const icon = document.createElement('div');
      icon.innerHTML = `<div style="font-size:28px;color:#f39c12;">✈️</div>`;
      Object.assign(icon.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      });

      // Add border on top
      const border = document.createElement('div');
      Object.assign(border.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        border: '3px solid #f39c12',
        pointerEvents: 'none',
        boxSizing: 'border-box'
      });

      container.appendChild(icon);
      container.appendChild(border);
      inner.appendChild(container);

      travelBtn.title = 'Currently traveling...';

      // Hide picker when traveling
      if (pickerBtn) {
        pickerBtn.style.display = 'none';
      }

      travelBtn.style.background = '#fffaf0';
      travelBtn.style.boxShadow = '0 4px 20px rgba(243, 156, 18, 0.4)';

    } else {
      // Show flag when home
      const country = countryByName(selectedCountryName);

      // Create container for layered effect
      const container = document.createElement('div');
      Object.assign(container.style, {
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        overflow: 'hidden'
      });

      // Add flag as background
      const flagBg = document.createElement('div');
      const img = document.createElement('img');
      img.alt = country.name;
      img.draggable = false;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.src = country.flag;
      img.onerror = () => {
        flagBg.innerHTML = '';
        const f = document.createElement('div');
        f.textContent = emojiFallback(country.name);
        f.style.fontSize = '22px';
        f.style.width = '100%';
        f.style.height = '100%';
        f.style.display = 'flex';
        f.style.alignItems = 'center';
        f.style.justifyContent = 'center';
        flagBg.appendChild(f);
      };

      Object.assign(flagBg.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      });

      flagBg.appendChild(img);

      // Add border on top
      const border = document.createElement('div');
      Object.assign(border.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        border: '3px solid #2f80ed',
        pointerEvents: 'none',
        boxSizing: 'border-box'
      });

      container.appendChild(flagBg);
      container.appendChild(border);
      inner.appendChild(container);

      travelBtn.title = `Travel to ${country.name}`;

      // Show picker when home
      if (pickerBtn) {
        pickerBtn.style.display = 'flex';
      }

      travelBtn.style.background = '#fff';
      travelBtn.style.boxShadow = '0 4px 20px rgba(47, 128, 237, 0.4)';
    }
  }

  function openCountryPicker(){
    if(getState() !== 'home') {
      showToast('You can only change destination while in Torn City', false);
      return;
    }

    const existingPicker = $('#torn-country-panel');
    if(existingPicker) existingPicker.remove();

    const panel = document.createElement('div');
    panel.id = 'torn-country-panel';
    Object.assign(panel.style,{
      position: 'fixed',
      right: '80px',
      bottom: '100px',
      zIndex: 2147483646,
      background: '#222',
      padding: '15px',
      borderRadius: '12px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 60px)',
      gap: '10px',
      border: '1px solid #444'
    });

    const title = document.createElement('div');
    title.textContent = 'Select Destination';
    Object.assign(title.style, {
      gridColumn: '1 / -1',
      color: '#fff',
      textAlign: 'center',
      fontWeight: 'bold',
      marginBottom: '10px',
      fontSize: '14px'
    });
    panel.appendChild(title);

    COUNTRY_LIST.forEach(c => {
      const b = document.createElement('button');
      b.title = `${c.name} — ${c.city}`;
      Object.assign(b.style,{
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        border: '2px solid #555',
        padding: 0,
        cursor: 'pointer',
        background: '#fff',
        overflow: 'hidden',
        transition: 'transform 0.2s ease',
        position: 'relative'
      });

      b.addEventListener('mouseenter', () => {
        b.style.transform = 'scale(1.1)';
        b.style.borderColor = '#2f80ed';
      });
      b.addEventListener('mouseleave', () => {
        b.style.transform = 'scale(1)';
        b.style.borderColor = '#555';
      });

      // Create flag image
      const img = document.createElement('img');
      img.src = c.flag;
      img.alt = c.name;
      img.draggable = false;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.onerror = () => {
        b.textContent = emojiFallback(c.name);
        b.style.fontSize = '12px';
        b.style.display = 'flex';
        b.style.alignItems = 'center';
        b.style.justifyContent = 'center';
      };

      b.appendChild(img);
      b.addEventListener('click', (e) => {
        e.preventDefault();

        if (!countryFlyingEnabled) {
          showToast('Country flying is currently disabled. Enable it to travel.', false);
          return;
        }

        selectedCountryName = c.name;
        GM_setValue(STORAGE_SELECTED, selectedCountryName);
        panel.remove();
        renderButtonState();
        showToast(`Destination set: ${c.name}`, true);
      });

      panel.appendChild(b);
    });

    // Country Flying Toggle
    const toggleBtn = document.createElement('button');
    toggleBtn.title = countryFlyingEnabled ? 'Disable country flying' : 'Enable country flying';
    Object.assign(toggleBtn.style,{
      width: '60px',
      height: '60px',
      borderRadius: '50%',
      border: '2px solid #555',
      padding: 0,
      cursor: 'pointer',
      background: countryFlyingEnabled ? '#90EE90' : '#FFB6C1',
      overflow: 'hidden',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px'
    });

    toggleBtn.innerHTML = countryFlyingEnabled ? '✈️' : '🚫';

    toggleBtn.addEventListener('mouseenter', () => {
      toggleBtn.style.transform = 'scale(1.1)';
      toggleBtn.style.borderColor = '#2f80ed';
    });
    toggleBtn.addEventListener('mouseleave', () => {
      toggleBtn.style.transform = 'scale(1)';
      toggleBtn.style.borderColor = '#555';
    });

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      countryFlyingEnabled = !countryFlyingEnabled;
      GM_setValue(STORAGE_FLYING_ENABLED, countryFlyingEnabled);

      toggleBtn.style.background = countryFlyingEnabled ? '#90EE90' : '#FFB6C1';
      toggleBtn.innerHTML = countryFlyingEnabled ? '✈️' : '🚫';
      toggleBtn.title = countryFlyingEnabled ? 'Disable country flying' : 'Enable country flying';

      showToast(`Country flying ${countryFlyingEnabled ? 'enabled' : 'disabled'}`, true);
    });

    panel.appendChild(toggleBtn);

    const close = document.createElement('button');
    close.textContent = 'Close';
    Object.assign(close.style,{
      gridColumn: '1 / -1',
      padding: '8px',
      marginTop: '10px',
      background: '#2f80ed',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontWeight: 'bold'
    });
    close.addEventListener('click', () => panel.remove());
    panel.appendChild(close);

    document.body.appendChild(panel);

    // Close panel when clicking outside
    const closePanel = (e) => {
      if (!panel.contains(e.target) && e.target.id !== 'torn-picker-btn') {
        panel.remove();
        document.removeEventListener('click', closePanel);
      }
    };
    setTimeout(() => document.addEventListener('click', closePanel), 100);
  }

  /* ======== TRAVEL FUNCTIONS ======== */
  async function triggerOneClickTravel(){
    const state = getState();

    if(state === 'abroad'){
      await triggerReturnFlow();
      return;
    }

    if (!countryFlyingEnabled && state === 'home') {
      showToast('Country flying is currently disabled. Enable it to travel.', false);
      return;
    }

    if(state === 'traveling'){
      travelingFlag = true;
      GM_setValue(STORAGE_TRAVELING, true);
      renderButtonState();
      showToast('Already travelling', true);
      return;
    }

    const desired = selectedCountryName;
    const expandBtn = findExpandButtonByCountryName(desired);

    if(expandBtn){
      safeClick(expandBtn);

      try {
        const continueBtn = await waitForSelector('.confirmPanel___KqaRh .buttons___Uk5cy .torn-btn', 3500).catch(() => null);
        if(continueBtn){
          safeClick(continueBtn);
          travelingFlag = true;
          GM_setValue(STORAGE_TRAVELING, true);
          showToast(`Traveling to ${desired}`, true);
          renderButtonState();
          return;
        }
      } catch(e){}

      showToast('Opened travel row — awaiting confirmation', true);
      return;
    }

    GM_setValue(STORAGE_AUTO_TARGET, desired);
    GM_setValue(STORAGE_AUTO_REQUESTED, Date.now());
    window.location.href = '/page.php?sid=travel';
  }

  async function checkAutoTravelOnLoad(){
    if (!countryFlyingEnabled) {
      GM_setValue(STORAGE_AUTO_TARGET, null);
      GM_setValue(STORAGE_AUTO_REQUESTED, null);
      return;
    }

    const target = GM_getValue(STORAGE_AUTO_TARGET, null);
    const requested = GM_getValue(STORAGE_AUTO_REQUESTED, null);
    if(!target || !requested) return;
    if(Date.now() - requested > AUTO_TRAVEL_TTL){
      GM_setValue(STORAGE_AUTO_TARGET, null);
      GM_setValue(STORAGE_AUTO_REQUESTED, null);
      return;
    }

    await sleep(1000);
    const btn = findExpandButtonByCountryName(target);
    if(btn){
      safeClick(btn);
      try {
        const continueBtn = await waitForSelector('.confirmPanel___KqaRh .buttons___Uk5cy .torn-btn', 4000).catch(()=>null);
        if(continueBtn){
          safeClick(continueBtn);
          travelingFlag = true;
          GM_setValue(STORAGE_TRAVELING, true);
          showToast(`Traveling to ${target}`, true);
        }
      } catch(e){}
    }
    GM_setValue(STORAGE_AUTO_TARGET, null);
    GM_setValue(STORAGE_AUTO_REQUESTED, null);
    renderButtonState();
  }

  /* ======== IMPROVED RETURN FLOW ======== */
  async function triggerReturnFlow() {
    showToast('Returning to Torn City...', true);

    // Method 1: Look for Torn's native return buttons
    const returnSelectors = [
      'a[href*="travelHome"]',
      'a.travel-home',
      '.travel-home-link a',
      'button[onclick*="travelHome"]',
      'a[onclick*="travelHome"]',
      'a.return-home'
    ];

    let returnElement = null;
    for (const selector of returnSelectors) {
      returnElement = document.querySelector(selector);
      if (returnElement) {
        console.log('Found return element with selector:', selector);
        break;
      }
    }

    // Method 2: Search by text content
    if (!returnElement) {
      const allLinks = [...document.querySelectorAll('a, button')];
      for (const el of allLinks) {
        const text = (el.textContent || '').toLowerCase();
        const href = el.getAttribute('href') || '';
        const onclick = el.getAttribute('onclick') || '';

        if (text.includes('return to torn') ||
            text.includes('travel home') ||
            text.includes('back to torn') ||
            text.includes('return home') ||
            href.includes('travelHome') ||
            onclick.includes('travelHome')) {
          returnElement = el;
          console.log('Found return element by text:', text);
          break;
        }
      }
    }

    if (returnElement) {
      console.log('Clicking return element');
      safeClick(returnElement);

      // Wait for any confirmation dialog
      await sleep(1500);

      // Look for confirmation button
      const confirmSelectors = [
        'button.torn-btn:not([disabled])',
        'a.torn-btn',
        '.travel-confirm button',
        '.confirm-travel button'
      ];

      let confirmElement = null;
      for (const selector of confirmSelectors) {
        confirmElement = $(selector);
        if (confirmElement) {
          const text = (confirmElement.textContent || '').toLowerCase();
          if (text.includes('travel') || text.includes('confirm') || text.includes('return')) {
            console.log('Found confirmation button:', text);
            break;
          }
        }
      }

      // Also search all buttons for confirmation text
      if (!confirmElement) {
        const allButtons = [...document.querySelectorAll('button, a')];
        for (const el of allButtons) {
          const text = (el.textContent || '').toLowerCase();
          if (text.includes('travel back') ||
              text.includes('confirm travel') ||
              text.includes('return to torn city') ||
              text.includes('yes, travel')) {
            confirmElement = el;
            console.log('Found confirmation button by text:', text);
            break;
          }
        }
      }

      if (confirmElement) {
        console.log('Clicking confirmation button');
        safeClick(confirmElement);
        travelingFlag = false;
        GM_setValue(STORAGE_TRAVELING, false);
        showToast('Return confirmed!', true);

        // Wait a bit and check if we're still abroad
        setTimeout(() => {
          if (!isAbroadByHeader()) {
            showToast('Successfully returned to Torn City!', true);
            renderButtonState();
          }
        }, 3000);
      } else {
        showToast('Return initiated - please wait...', true);
      }
    } else {
      // If no return element found, try to go directly to the travel home endpoint
      console.log('No return element found, trying direct travelHome endpoint');

      // Try to simulate the travelHome action directly
      const travelHomeUrl = 'https://www.torn.com/page.php?sid=travelHome';

      // Create a form to submit the travelHome request
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = travelHomeUrl;
      form.style.display = 'none';

      // Add CSRF token if available
      const csrfToken = $('input[name="csrf_token"]') || $('meta[name="csrf-token"]');
      if (csrfToken) {
        const tokenInput = document.createElement('input');
        tokenInput.type = 'hidden';
        tokenInput.name = 'csrf_token';
        tokenInput.value = csrfToken.value || csrfToken.getAttribute('content');
        form.appendChild(tokenInput);
      }

      // Add a confirm parameter
      const confirmInput = document.createElement('input');
      confirmInput.type = 'hidden';
      confirmInput.name = 'confirm';
      confirmInput.value = '1';
      form.appendChild(confirmInput);

      document.body.appendChild(form);
      form.submit();

      showToast('Initiating return to Torn City...', true);
    }
  }

  /* ======== INIT ======== */
  function init(){
    // Force button to always be built
    setTimeout(() => {
      buildFloatingButtons();
      checkAutoTravelOnLoad().catch(console.error);

      // Force update state every second
      setInterval(() => {
        renderButtonState();
      }, 1000);
    }, 1000);

    // Also update on any page change
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(() => {
          renderButtonState();
        }, 500);
      }
    });
    observer.observe(document, { subtree: true, childList: true });
  }

  // Start immediately
  init();

})();
