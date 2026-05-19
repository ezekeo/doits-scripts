// ==UserScript==
// @name         1 Doits FF Scouter
// @namespace    https://github.com/doitsburger/doits-scripts
// @version      1.5.4
// @description  Scouter tool for FF and BS Estimates on Torn. Attack button in status, extra row clean, destinations panel, sorting on your faction page, and last action sorting.
// @author       rDacted, Weav3r, GFOUR - modded by Doitsburger
// @match        https://www.torn.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @updateURL    https://raw.githubusercontent.com/doitsburger/doits-scripts/main/ff-scouter/doitsburgers-ff-scouter.user.js
// @downloadURL  https://raw.githubusercontent.com/doitsburger/doits-scripts/main/ff-scouter/doitsburgers-ff-scouter.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    setTimeout(function() {
        var storedKey = GM_getValue("limited_key", null);
        if (!storedKey) {
            var userKey = prompt(
                "FF Scouter: API Key Required\n\n" +
                "Please enter your limited API key from ffscouter.com\n" +
                "This key is required for the script to work.",
                ""
            );
            if (userKey && userKey.trim()) {
                GM_setValue("limited_key", userKey.trim());
                alert("API key saved! The page will now reload.");
                window.location.reload();
            } else if (userKey === null) {
                alert("FF Scouter cannot work without an API key.\n" +
                      "You can add it later via Tampermonkey menu > 'Enter Limited API Key'");
            }
        }
    }, 2000);

    const tornSymbol = `
    <svg class="torn-symbol" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11"
              fill="url(#metalGradient)"
              stroke="#000"
              stroke-width="1.2"/>
      <circle cx="12" cy="12" r="9"
              fill="none"
              stroke="rgba(0,0,0,0.45)"
              stroke-width="1.2"/>
      <ellipse cx="12" cy="8" rx="7" ry="3"
               fill="rgba(255,255,255,0.22)"/>
      <text x="12" y="15.5"
            text-anchor="middle"
            font-family="Arial"
            font-weight="900"
            font-size="13"
            fill="#000">T</text>
      <defs>
        <linearGradient id="metalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#f2f2f2"/>
          <stop offset="40%"  stop-color="#8c8c8c"/>
          <stop offset="70%"  stop-color="#3a3a3a"/>
          <stop offset="100%" stop-color="#bfbfbf"/>
        </linearGradient>
      </defs>
    </svg>`;

    function createPlaneSvg(isReturning) {
        return `<svg class="plane-svg ${isReturning ? 'returning' : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
            <path d="M482.3 192c34.2 0 93.7 29 93.7 64c0 36-59.5 64-93.7 64l-116.6 0L265.2 495.9c-5.7 10-16.3 16.1-27.8 16.1l-56.2 0c-10.6 0-18.3-10.2-15.4-20.4l49-171.6L112 320 68.8 377.6c-3 4 0 6.4-12.8 6.4l-42 0c-7.8 0-14-6.3-14-14c0-1.3 .2-2.6 .5-3.9L32 256 .5 145.9c-.4-1.3-.5-2.6-.5-3.9c0-7.8 6.3-14 14-14l42 0c5 0 9.8 2.4 12.8 6.4L112 192l102.9 0-49-171.6C162.9 10.2 170.6 0 181.2 0l56.2 0c11.5 0 22.1 6.2 27.8 16.1L365.7 192l116.6 0z"/>
        </svg>`;
    }

    const FF_VERSION = 2.5;
    const API_INTERVAL = 30000;
    const memberCountdowns = {};
    let apiCallInProgressCount = 0;

    let currentSortMode = 'none';
    let warSortMode = 'none';

    (function loadSavedSortModes() {
        const validModes = ['bs-high-low', 'bs-low-high', 'hospital-priority', 'okay-priority', 'traveling', 'last-action'];
        const savedProfile = GM_getValue('ff_scouter_sort_mode', 'none');
        const savedWar = GM_getValue('ff_scouter_sort_mode_war', 'none');
        currentSortMode = validModes.includes(savedProfile) ? savedProfile : 'none';
        warSortMode = validModes.includes(savedWar) ? savedWar : 'none';
    })();

    let showExtraRows = true;

    const FF_COLORS = {
        '0-2': '#87CEEB',
        '2-4': '#28c628',
        '4-5': '#AA7DCE',
        '5+': '#c62828'
    };

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
        { name:'United Arab Emirates', city:'Dubai', flag:'/images/v2/travel_agency/flags/fl_uae.svg' },
        { name:'South Africa', city:'Johannesburg', flag:'/images/v2/travel_agency/flags/fl_south_africa.svg' }
    ];

    const profileOriginalOrderMap = new Map();
    const warOriginalOrderMaps = {
        your: new Map(),
        enemy: new Map()
    };
    let nextProfileOriginalOrder = 0;
    let nextWarOriginalOrder = {
        your: 0,
        enemy: 0
    };

    let isApplyingProfileSort = false;
    let isApplyingWarSort = false;
    let profileSortTimeout = null;
    let warSortTimeout = null;
    let profileSortObserver = null;
    let warYourSortObserver = null;
    let warEnemySortObserver = null;

    let profileStatusInterval = null;
    let profileTimerInterval = null;
    let mainFactionStatusInterval = null;
    let mainFactionTimerInterval = null;
    let warStatusInterval = null;
    let attackBoxObserver = null;

    let infoLineObserver = null;
    let currentAttackTargetId = null;
    let lastAttackUrl = '';
    let attackPageWatchInterval = null;
    let currentMainPageKey = '';
    let lastKnownPageUrl = location.href;

    // New lifecycle keys
    let currentProfilePageKey = '';
    let currentMainFactionPageKey = '';
    let currentWarPageKey = '';

    function formatFFForExtraRow(ffValue) {
        if (ffValue > 10) {
            return '<strong>HIGH</strong>';
        } else {
            return ffValue.toFixed(1);
        }
    }

    function updateThemeColors() {
        const bodyBg = window.getComputedStyle(document.body).backgroundColor;
        const rgb = bodyBg.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
            const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
            const isDark = brightness < 128;
            const newBg = isDark ? '#2A2A2A' : '#EEEEEE';
            document.documentElement.style.setProperty('--extra-row-bg', newBg);
        } else {
            document.documentElement.style.setProperty('--extra-row-bg', '#353535');
        }
    }

    if (document.body) {
        updateThemeColors();
    } else {
        document.addEventListener('DOMContentLoaded', updateThemeColors);
    }

    const themeObserver = new MutationObserver(() => {
        updateThemeColors();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });

    let singleton = document.getElementById('ff-scouter-run-once');
    if (!singleton) {
        console.log(`FF Scouter version ${FF_VERSION} starting`);

        GM_addStyle(`
            .table-cell {overflow: hidden;}

            .ff-scouter-indicator {
                position: relative;
                display: block;
                padding: 0;
            }

            .ff-scouter-vertical-line-low-upper,
            .ff-scouter-vertical-line-low-lower,
            .ff-scouter-vertical-line-high-upper,
            .ff-scouter-vertical-line-high-lower {
                content: '';
                position: absolute;
                width: 2px;
                height: 30%;
                background-color: black;
                margin-left: -1px;
            }

            .ff-scouter-vertical-line-low-upper {
                top: 0;
                left: calc(var(--arrow-width) / 2 + 33 * (100% - var(--arrow-width)) / 100);
            }

            .ff-scouter-vertical-line-low-lower {
                bottom: 0;
                left: calc(var(--arrow-width) / 2 + 33 * (100% - var(--arrow-width)) / 100);
            }

            .ff-scouter-vertical-line-high-upper {
                top: 0;
                left: calc(var(--arrow-width) / 2 + 66 * (100% - var(--arrow-width)) / 100);
            }

            .ff-scouter-vertical-line-high-lower {
                bottom: 0;
                left: calc(var(--arrow-width) / 2 + 66 * (100% - var(--arrow-width)) / 100);
            }

            .ff-scouter-arrow {
                position: absolute;
                transform: translate(-50%, -50%);
                padding: 0;
                top: 0;
                left: calc(var(--arrow-width) / 2 + var(--band-percent) * (100% - var(--arrow-width)) / 100);
                width: var(--arrow-width);
                object-fit: cover;
                pointer-events: none;
            }

            .last-action-row {
                font-size: 11px;
                color: inherit;
                font-style: normal;
                font-weight: normal;
                text-align: center;
                margin-left: 8px;
                margin-bottom: 2px;
                margin-top: -2px;
                display: block;
            }

            .travel-status {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 2px;
                min-width: 0;
                overflow: hidden;
            }

            .torn-symbol {
                width: 16px;
                height: 16px;
                fill: currentColor;
                vertical-align: middle;
                flex-shrink: 0;
            }

            .plane-svg {
                width: 14px;
                height: 14px;
                fill: currentColor;
                vertical-align: middle;
                flex-shrink: 0;
            }

            .plane-svg.returning {
                transform: scaleX(-1);
            }

            .country-abbr {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                min-width: 0;
                flex: 0 1 auto;
                vertical-align: bottom;
            }

            .ff-scouter-bs-estimate {
                position: fixed;
                bottom: 2px;
                left: 2px;
                font-size: 12px;
                color: #cccccc;
                background-color: rgba(0, 0, 0, 0.6);
                padding: 1px 3px;
                border-radius: 2px;
                pointer-events: none;
                z-index: 10;
            }

            .ff-scouter-mini-ff {
                font-size: 10px;
                font-weight: bold;
                margin: 2px 0;
                padding: 2px 4px;
                border-radius: 3px;
                display: inline-block;
            }

            .table-cell.status {
                min-width: 110px;
                max-width: 200px;
                resize: horizontal;
                overflow: auto;
                position: relative;
            }

            .hospital-abroad-icon {
                position: absolute;
                top: 0px;
                right: 0px;
                font-size: 9px;
                line-height: 1;
                pointer-events: none;
                z-index: 2;
            }

            .faction-profile-status {
                display: flex !important;
                align-items: center;
                justify-content: space-between;
                width: 100%;
                flex-wrap: nowrap !important;
                gap: 4px;
                min-height: 20px;
            }

            .faction-status-okay {
                color: #28a745;
            }

            .faction-status-traveling {
                color: #40a2e8;
            }

            .faction-status-abroad {
                color: #ffc107;
            }

            .faction-status-hospital {
                color: #dc3545;
            }

            .faction-status-jail {
                color: #6f42c1;
            }

            .faction-status-countdown {
                font-weight: bold;
                font-size: 12px;
                background: rgba(0, 0, 0, 0.1);
                padding: 1px 2px;
                border-radius: 3px;
                margin-left: 2px;
                min-width: 60px;
                text-align: center;
            }

            .status-text-container {
                flex: 1;
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .status-text {
                font-weight: bold;
            }

            .status-attack-btn {
                margin-right: 2px;
                flex-shrink: 0;
                text-decoration: none;
                font-size: 16px;
                font-weight: bold;
                color: inherit;
                opacity: 0.8;
                transition: opacity 0.2s;
            }

            .status-attack-btn:hover {
                opacity: 1;
            }

            .ff-scouter-extra-row {
                background-color: var(--extra-row-bg, #353535);
                border-bottom: 1px solid #000000;
                padding: 2px 0;
                font-size: 11px;
                color: #6c757d;
                display: none;
            }

            .table-row[data-ff-scouter-extra] + .ff-scouter-extra-row {
                display: block !important;
            }

            .ff-scouter-extra-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0 5px;
            }

            .ff-scouter-last-action {
                font-size: 11px;
                font-style: italic;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .ff-scouter-ff-right {
                font-size: 11px;
                font-weight: bold;
                text-align: right;
                white-space: nowrap;
                margin-left: 10px;
            }

            .ff-scouter-sort-panel {
                position: fixed;
                bottom: 141px;
                right: 2px;
                z-index: 100000;
                background: rgba(40, 40, 40, 0.95);
                border: 1px solid #555;
                border-radius: 8px;
                padding: 8px;
                display: none;
                flex-direction: column;
                gap: 5px;
                min-width: 120px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            }

            .ff-scouter-sort-panel.visible {
                display: flex;
            }

            .ff-scouter-sort-btn {
                background: #28a745;
                color: white;
                border: 2px solid #3b82f6;
                border-radius: 28px;
                width: 28px;
                height: 40px;
                font-size: 25px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                display: none;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
                position: fixed;
                bottom: 133px;
                right: 2px;
                z-index: 10001;
                padding: 0;
                line-height: 1;
            }

            .ff-scouter-sort-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            }

            .ff-scouter-sort-btn.visible {
                display: flex;
            }

            .ff-scouter-sort-option {
                background: #444;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 6px 10px;
                font-size: 12px;
                cursor: pointer;
                text-align: left;
                transition: background 0.2s ease;
            }

            .ff-scouter-sort-option:hover {
                background: #555;
            }

            .ff-scouter-sort-option.active {
                background: #28a745;
                font-weight: bold;
            }

            body.ff-hide-extra .last-action-row,
            body.ff-hide-extra .ff-scouter-extra-row,
            body.ff-hide-extra .table-row[data-ff-scouter-extra] + .ff-scouter-extra-row {
                display: none !important;
            }

            .torn-symbol {
                fill: #FFD700 !important;
            }

            .plane-svg:not(.returning) {
                fill: #4CAF50 !important;
            }

            .plane-svg.returning {
                fill: #FF5722 !important;
            }

            .destinations-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(180deg, #2d2d2d 0%, #1a1a1a 100%);
                border-radius: 8px;
                width: 450px;
                max-width: 95vw;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
                color: #ddd;
                z-index: 1000000;
                padding: 0;
                font-family: Arial, Helvetica, sans-serif;
            }

            .destinations-header {
                background: linear-gradient(180deg, #3d3d3d 0%, #2a2a2a 100%);
                padding: 16px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #444;
                position: sticky;
                top: 0;
                z-index: 10;
            }

            .destinations-header h2 {
                margin: 0!important;
                color: #fff;
                font-size: 15px;
                font-weight: 600;
            }

            .destinations-close {
                background: rgba(255,255,255,0.1);
                border: none;
                color: #888;
                font-size: 18px;
                cursor: pointer;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .destinations-close:hover {
                background: rgba(255,100,100,0.2);
                color: #f66;
            }

            .destinations-toolbar {
                padding: 12px 16px;
                border-bottom: 1px solid #333;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(0,0,0,0.2);
            }

            .destinations-toggle {
                display: flex;
                gap: 8px;
                background: #2a2a2a;
                padding: 3px;
                border-radius: 20px;
                border: 1px solid #444;
            }

            .toggle-btn {
                padding: 6px 12px;
                border: none;
                border-radius: 16px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                background: transparent;
                color: #888;
                transition: all 0.2s;
            }

            .toggle-btn.active {
                background: #4a7c4a;
                color: white;
            }

            .refresh-btn {
                background: #3a3a3a;
                border: 1px solid #555;
                color: #ddd;
                padding: 6px 12px;
                border-radius: 16px;
                font-size: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 5px;
            }

            .refresh-btn:hover {
                background: #4a4a4a;
            }

            .refresh-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .destinations-content {
                padding: 16px;
            }

            .destination-group {
                margin-bottom: 12px;
                border: 1px solid #333;
                border-radius: 6px;
                overflow: hidden;
            }

            .group-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 12px;
                background: rgba(255,255,255,0.03);
                cursor: pointer;
                user-select: none;
            }

            .group-header:hover {
                background: rgba(255,255,255,0.08);
            }

            .group-header .group-name {
                font-weight: bold;
                color: #eee;
            }

            .group-header .group-count {
                background: #333;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 11px;
                color: #aaa;
            }

            .group-header .collapse-icon {
                font-size: 12px;
                color: #888;
                margin-left: 8px;
            }

            .group-members {
                padding: 4px 8px;
                background: rgba(0,0,0,0.2);
            }

            .destination-group.collapsed .group-members {
                display: none;
            }

            .member-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 4px 8px;
                margin: 2px 0;
                background: rgba(255,255,255,0.02);
                border-radius: 4px;
            }

            .member-name.enemy,
            .member-name.friendly,
            .member-name.neutral {
                color: #ddd;
            }

            .member-status {
                font-size: 11px;
                color: #888;
            }

            .loading, .error, .no-data {
                text-align: center;
                padding: 20px;
                color: #888;
            }

            .error {
                color: #f66;
            }

            .location-tag {
                font-size: 10px;
                background: #333;
                padding: 2px 6px;
                border-radius: 10px;
                color: #aaa;
            }

            #ff-scouter-attack-box {
                position: relative;
                top: auto;
                left: auto;
                z-index: auto;
                background: transparent;
                border: none;
                border-radius: 0;
                padding: 0;
                margin-top: 4px;
                margin-bottom: 4px;
                box-shadow: none;
                backdrop-filter: none;
                -webkit-backdrop-filter: none;
                white-space: nowrap;
                pointer-events: none;
                display: flex;
                align-items: center;
                gap: 6px;
                width: fit-content;
                color: #ddd;
                font-size: 12px;
                line-height: 1.2;
                font-weight: 700;
            }

            #ff-scouter-attack-box[data-mounted-mode="fixed"] {
                position: fixed;
                top: 52px;
                left: 8px;
                background: transparent;
            }

            #ff-scouter-attack-box .ff-label {
                font-weight: 700;
                color: #ddd;
            }

            #ff-scouter-attack-box .ff-value {
                font-weight: 700;
                color: #fff;
            }

            #ff-scouter-attack-box .ff-pill {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 2px 8px;
                border-radius: 999px;
                font-weight: 700;
                line-height: 1;
                box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
            }

            #ff-scouter-attack-box .ff-sep {
                opacity: 0.45;
                font-weight: 400;
            }
        `);

        var BASE_URL = "https://ffscouter.com";
        var BLUE_ARROW = "https://raw.githubusercontent.com/rDacted2/fair_fight_scouter/main/images/blue-arrow.svg";
        var GREEN_ARROW = "https://raw.githubusercontent.com/rDacted2/fair_fight_scouter/main/images/green-arrow.svg";
        var RED_ARROW = "https://raw.githubusercontent.com/rDacted2/fair_fight_scouter/main/images/red-arrow.svg";

        var rD_xmlhttpRequest;
        var rD_setValue;
        var rD_getValue;
        var rD_deleteValue;
        var rD_registerMenuCommand;

        var apikey = '###PDA-APIKEY###';
        if (apikey[0] != '#') {
            console.log("Adding modifications to support TornPDA");
            rD_xmlhttpRequest = function (details) {
                if (details.method.toLowerCase() == "get") {
                    return PDA_httpGet(details.url)
                        .then(details.onload)
                        .catch(details.onerror ?? ((e) => console.error(e)));
                } else if (details.method.toLowerCase() == "post") {
                    return PDA_httpPost(details.url, details.headers ?? {}, details.body ?? details.data ?? "")
                        .then(details.onload)
                        .catch(details.onerror ?? ((e) => console.error(e)));
                }
            };
            rD_setValue = function (name, value) {
                return localStorage.setItem(name, value);
            };
            rD_getValue = function (name, defaultValue) {
                return localStorage.getItem(name) ?? defaultValue;
            };
            rD_deleteValue = function (name) {
                return localStorage.removeItem(name);
            };
            rD_registerMenuCommand = function () {};
            rD_setValue('limited_key', apikey);
        } else {
            rD_xmlhttpRequest = GM_xmlhttpRequest;
            rD_setValue = GM_setValue;
            rD_getValue = GM_getValue;
            rD_deleteValue = GM_deleteValue;
            rD_registerMenuCommand = GM_registerMenuCommand;
        }

        var key = rD_getValue("limited_key", null); // ffscouter key
        var tornKey = rD_getValue("torn_api_key", null); // Torn API key
        var info_line = null;
        showExtraRows = rD_getValue('ff_show_extra_rows', true) === true;

        // Prompt for Torn API key if missing
        if (!tornKey && key) {
            tornKey = prompt(
                "FF Scouter: Torn API Key Required\n\n" +
                "Please enter your Torn API key (limited, from torn.com).\n" +
                "This is needed for faction member data.",
                ""
            );
            if (tornKey && tornKey.trim()) {
                rD_setValue("torn_api_key", tornKey.trim());
            }
        }

        rD_registerMenuCommand('Enter Limited API Key', () => {
            let userInput = prompt("Enter Limited API Key", rD_getValue('limited_key', ""));
            if (userInput !== null) {
                rD_setValue('limited_key', userInput);
                window.location.reload();
            }
        });

        function getInfoMountTarget() {
            const attackingHeader = Array.from(document.querySelectorAll('h4'))
            .find(h => h.textContent && h.textContent.trim().toLowerCase() === 'attacking');

            if (attackingHeader && attackingHeader.parentNode && attackingHeader.parentNode.parentNode) {
                return { type: 'after-parent', el: attackingHeader.parentNode.parentNode };
            }

            const firstVisibleH4 = Array.from(document.querySelectorAll('h4'))
            .find(h => h.textContent && h.offsetParent !== null);

            if (firstVisibleH4) {
                const linksTopWrap = firstVisibleH4.parentNode?.querySelector('.links-top-wrap');
                if (linksTopWrap && linksTopWrap.parentNode) {
                    return { type: 'after-node', el: linksTopWrap };
                }
                return { type: 'after-node', el: firstVisibleH4 };
            }

            return null;
        }

        function ensureInfoLineMounted() {
            if (!info_line) {
                info_line = document.createElement('div');
                info_line.id = "ff-scouter-run-once";
                info_line.style.display = 'block';
                info_line.style.clear = 'both';
                info_line.style.margin = '5px 0';
                info_line.addEventListener('click', () => {
                    if (key === null) {
                        const limited_key = prompt("Enter Limited API Key", rD_getValue('limited_key', ""));
                        if (limited_key) {
                            rD_setValue('limited_key', limited_key);
                            key = limited_key;
                            window.location.reload();
                        }
                    }
                });
            }

            const target = getInfoMountTarget();
            if (!target) return info_line;

            if (target.type === 'after-parent') {
                if (info_line.parentNode !== target.el.parentNode || info_line.previousElementSibling !== target.el) {
                    target.el.insertAdjacentElement('afterend', info_line);
                }
            } else if (target.type === 'after-node') {
                if (info_line.parentNode !== target.el.parentNode || info_line.previousElementSibling !== target.el) {
                    target.el.insertAdjacentElement('afterend', info_line);
                }
            }

            return info_line;
        }

        function set_message(message, error = false) {
            ensureInfoLineMounted();
            if (!info_line) return;
            while (info_line.firstChild) {
                info_line.removeChild(info_line.firstChild);
            }
            const textNode = document.createTextNode(message);
            info_line.style.color = error ? "red" : "";
            info_line.appendChild(textNode);
        }

        function update_ff_cache(player_ids, callback) {
            if (!key) return;

            player_ids = [...new Set(player_ids)];
            var unknown_player_ids = get_cache_misses(player_ids);

            if (unknown_player_ids.length > 0) {
                var player_id_list = unknown_player_ids.join(",");
                const url = `${BASE_URL}/api/v1/get-stats?key=${key}&targets=${player_id_list}`;

                rD_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    onload: function (response) {
                        if (response.status == 200) {
                            var ff_response = JSON.parse(response.responseText);
                            if (ff_response && ff_response.error) {
                                showToast(ff_response.error);
                                return;
                            }
                            var expiry = Date.now() + (60 * 60 * 1000);
                            ff_response.forEach(result => {
                                if (!result || !result.player_id) return;
                                if (
                                    result.fair_fight === null &&
                                    result.bs_estimate === null &&
                                    result.bs_estimate_human === null &&
                                    result.last_updated === null
                                ) {
                                    rD_setValue(String(result.player_id), JSON.stringify({
                                        no_data: true,
                                        expiry: expiry
                                    }));
                                } else {
                                    rD_setValue(String(result.player_id), JSON.stringify({
                                        value: result.fair_fight,
                                        last_updated: result.last_updated,
                                        expiry: expiry,
                                        bs_estimate: result.bs_estimate,
                                        bs_estimate_human: result.bs_estimate_human
                                    }));
                                }
                            });
                            callback(player_ids);
                        } else {
                            try {
                                var err = JSON.parse(response.responseText);
                                showToast(err && err.error ? err.error : 'API request failed.');
                            } catch {
                                showToast('API request failed.');
                            }
                        }
                    },
                    onerror: function (e) { console.error('**** error ', e); },
                    onabort: function (e) { console.error('**** abort ', e); },
                    ontimeout: function (e) { console.error('**** timeout ', e); }
                });
            } else {
                callback(player_ids);
            }
        }

        function get_fair_fight_response(target_id) {
            var cached_ff_response = rD_getValue(String(target_id), null);
            try {
                cached_ff_response = JSON.parse(cached_ff_response);
            } catch {
                cached_ff_response = null;
            }
            if (cached_ff_response && cached_ff_response.expiry > Date.now()) {
                return cached_ff_response;
            }
            return null;
        }

        function isAttackPage() {
            return /(?:loader|page)\.php\?sid=attack&user2ID=\d+/.test(window.location.href);
        }

        function getAttackTargetIdFromUrl() {
            const match = window.location.href.match(/[?&]user2ID=(\d+)/);
            return match ? match[1] : null;
        }

        function getProfileTargetIdFromUrl() {
            const match = window.location.href.match(/profiles\.php\?XID=(\d+)/);
            return match ? match[1] : null;
        }

        function getAttackHeader() {
            const headings = Array.from(document.querySelectorAll('h4'));
            return headings.find(h => h.textContent && h.textContent.trim().toLowerCase() === 'attacking') || null;
        }

        function mountAttackBox() {
            let box = document.getElementById('ff-scouter-attack-box');
            if (!box) {
                box = document.createElement('div');
                box.id = 'ff-scouter-attack-box';
            }

            const header = getAttackHeader();

            if (header) {
                if (box.parentNode === header.parentNode && box.previousElementSibling === header) {
                    box.dataset.mountedMode = 'inline';
                    return box;
                }
                header.insertAdjacentElement('afterend', box);
                box.dataset.mountedMode = 'inline';
            } else {
                if (box.parentNode !== document.body) {
                    document.body.appendChild(box);
                }
                box.dataset.mountedMode = 'fixed';
            }

            return box;
        }

        function getOrCreateAttackBox() {
            return mountAttackBox();
        }

        function renderAttackBox(ff_response, player_id) {
            const box = getOrCreateAttackBox();

            if (!ff_response) {
                box.innerHTML = `
                    <span class="ff-label">FF</span>
                    <span class="ff-value">Loading...</span>
                `;
                return;
            }

            if (ff_response.no_data) {
                box.innerHTML = `
                    <span class="ff-label">FF</span>
                    <span class="ff-value">No data</span>
                `;
                return;
            }

            const ffString = get_ff_string(ff_response);

            let bsText = 'N/A';
            if (ff_response.bs_estimate_human) {
                bsText = ff_response.bs_estimate_human;
            } else if (ff_response.bs_estimate) {
                bsText = formatBattleStats(ff_response.bs_estimate);
            }

            const ffBg = get_ff_colour(ff_response.value);
            const ffText = get_contrast_color(ffBg);

            box.innerHTML = `
                <span class="ff-label">FF</span>
                <span class="ff-value">${ffString}</span>
                <span class="ff-sep">•</span>
                <span class="ff-label">BS</span>
                <span class="ff-pill" style="background:${ffBg}; color:${ffText};">${bsText}</span>
            `;
        }

        function ensureAttackBoxPersistence(target_id) {
            if (!isAttackPage()) return;

            const box = mountAttackBox();
            const cached = get_fair_fight_response(target_id);

            if (cached) {
                renderAttackBox(cached, target_id);
            } else if (!box.innerHTML) {
                box.innerHTML = `
            <span class="ff-label">FF</span>
            <span class="ff-value">Loading...</span>
        `;
            }
        }

        function bootstrapAttackOverlay(forceRefresh = false) {
            if (!isAttackPage()) {
                currentAttackTargetId = null;
                return;
            }

            const targetId = getAttackTargetIdFromUrl();
            if (!targetId) return;

            const urlChanged = window.location.href !== lastAttackUrl;
            const targetChanged = targetId !== currentAttackTargetId;

            if (!forceRefresh && !urlChanged && !targetChanged) {
                const cached = get_fair_fight_response(targetId);
                if (cached) {
                    renderAttackBox(cached, targetId);
                } else {
                    mountAttackBox();
                }
                return;
            }

            currentAttackTargetId = targetId;
            lastAttackUrl = window.location.href;

            mountAttackBox();
            ensureAttackBoxPersistence(targetId);

            const cached = get_fair_fight_response(targetId);
            if (cached) {
                renderAttackBox(cached, targetId);
            } else {
                const box = getOrCreateAttackBox();
                box.innerHTML = `
                    <span class="ff-label">FF</span>
                    <span class="ff-value">Loading...</span>
                `;

                update_ff_cache([targetId], function () {
                    const refreshed = get_fair_fight_response(targetId);
                    if (refreshed) {
                        renderAttackBox(refreshed, targetId);
                    }
                });
            }
        }

        function display_fair_fight(target_id, player_id) {
            const response = get_fair_fight_response(target_id);
            if (!response) return;

            if (isAttackPage()) {
                renderAttackBox(response, player_id);
            } else {
                set_fair_fight(response, player_id);
            }
        }

        function get_ff_string(ff_response) {
            return `${ff_response.value.toFixed(2)}`;
        }

        function get_detailed_message(ff_response, player_id) {
            if (ff_response.no_data) {
                return `<span style="font-weight: bold; margin-right: 6px;">FairFight:</span><span style="background: #444; color: #fff; font-weight: bold; padding: 2px 2px; border-radius: 4px; display: inline-block;">No data</span>`;
            }
            const ff_string = get_ff_string(ff_response);
            const background_colour = get_ff_colour(ff_response.value);
            const text_colour = get_contrast_color(background_colour);

            let statDetails = '';
            if (ff_response.bs_estimate_human) {
                const bsColor = get_ff_colour(ff_response.value);
                statDetails = `<span style="font-size: 11px; font-weight: normal; margin-left: 8px; vertical-align: middle; color: #cccccc; font-style: italic;">Est. TBS: <span style="font-weight: bold;color: ${bsColor}">${ff_response.bs_estimate_human}</span></span>`;
            }

            return `<span style="font-weight: bold; margin-right: 6px;">FF:</span><span style="background: ${background_colour}; color: ${text_colour}; font-weight: bold; padding: 2px 2px; border-radius: 4px; display: inline-block;">${ff_string}</span>${statDetails}`;
        }

        function set_fair_fight(ff_response, player_id) {
            ensureInfoLineMounted();
            if (!info_line) return;
            info_line.innerHTML = get_detailed_message(ff_response, player_id);
        }

        function get_members() {
            var player_ids = [];
            $(".table-body > .table-row").each(function () {
                if (!$(this).find(".fallen").length && !$(this).find(".fedded").length) {
                    $(this).find(".member").each(function (index, value) {
                        var anchor = value.querySelectorAll('a[href^="/profiles"]')[0];
                        if (!anchor) return;
                        var matched = anchor.href.match(/.*XID=(?<player_id>\d+)/);
                        if (matched?.groups?.player_id) {
                            player_ids.push(parseInt(matched.groups.player_id, 10));
                        }
                    });
                }
            });
            return player_ids;
        }

        function get_ff_colour(value) {
            if (value <= 2.5) return FF_COLORS['0-2'];
            if (value <= 3.8) return FF_COLORS['2-4'];
            if (value <= 4.5) return FF_COLORS['4-5'];
            return FF_COLORS['5+'];
        }

        function get_contrast_color(hex) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
            return (brightness > 126) ? 'black' : 'white';
        }

        function apply_fair_fight_info(player_ids) {}

        function get_cache_misses(player_ids) {
            var unknown_player_ids = [];
            for (const player_id of player_ids) {
                var cached_ff_response = rD_getValue(String(player_id), null);
                try {
                    cached_ff_response = JSON.parse(cached_ff_response);
                } catch {
                    cached_ff_response = null;
                }
                if ((!cached_ff_response) ||
                    (cached_ff_response.expiry < Date.now()) ||
                    (cached_ff_response.age > (7 * 24 * 60 * 60))) {
                    unknown_player_ids.push(player_id);
                }
            }
            return unknown_player_ids;
        }

        function bootstrapCurrentPageFF(force = false) {
            if (isAttackPage()) {
                bootstrapAttackOverlay(force);
                return;
            }

            const profileTargetId = getProfileTargetIdFromUrl();
            if (!profileTargetId) {
                currentMainPageKey = '';
                return;
            }

            const keyForPage = `profile:${profileTargetId}`;
            if (!force && currentMainPageKey === keyForPage && info_line && document.body.contains(info_line)) {
                const cached = get_fair_fight_response(profileTargetId);
                if (cached) set_fair_fight(cached, profileTargetId);
                return;
            }

            currentMainPageKey = keyForPage;
            ensureInfoLineMounted();

            const cached = get_fair_fight_response(profileTargetId);
            if (cached) {
                set_fair_fight(cached, profileTargetId);
            } else {
                set_message('Loading...');
                update_ff_cache([profileTargetId], function () {
                    const refreshed = get_fair_fight_response(profileTargetId);
                    if (refreshed) {
                        set_fair_fight(refreshed, profileTargetId);
                    }
                });
            }
        }

        function startInfoLineWatcher() {
            if (infoLineObserver) infoLineObserver.disconnect();

            infoLineObserver = new MutationObserver(() => {
                if ((getProfileTargetIdFromUrl() || isAttackPage())) {
                    if (!info_line || !document.body.contains(info_line)) {
                        ensureInfoLineMounted();
                        bootstrapCurrentPageFF();
                    }
                }
            });

            infoLineObserver.observe(document.body, { childList: true, subtree: true });
        }

        function startAttackOverlayWatcher() {
            if (attackPageWatchInterval) return;

            attackPageWatchInterval = setInterval(() => {
                if (isAttackPage()) {
                    bootstrapAttackOverlay();
                } else {
                    currentAttackTargetId = null;
                    lastAttackUrl = '';
                }
            }, 500);
        }

        // Cleanup helpers
        function cleanupProfilePage() {
            if (profileSortObserver) {
                profileSortObserver.disconnect();
                profileSortObserver = null;
            }
            if (profileStatusInterval) {
                clearInterval(profileStatusInterval);
                profileStatusInterval = null;
            }
            if (profileTimerInterval) {
                clearInterval(profileTimerInterval);
                profileTimerInterval = null;
            }
        }

        function cleanupMainFactionPage() {
            if (profileSortObserver) {
                profileSortObserver.disconnect();
                profileSortObserver = null;
            }
            if (mainFactionStatusInterval) {
                clearInterval(mainFactionStatusInterval);
                mainFactionStatusInterval = null;
            }
            if (mainFactionTimerInterval) {
                clearInterval(mainFactionTimerInterval);
                mainFactionTimerInterval = null;
            }
        }

        function cleanupWarPage() {
            if (warYourSortObserver) {
                warYourSortObserver.disconnect();
                warYourSortObserver = null;
            }
            if (warEnemySortObserver) {
                warEnemySortObserver.disconnect();
                warEnemySortObserver = null;
            }
            if (warStatusInterval) {
                clearInterval(warStatusInterval);
                warStatusInterval = null;
            }
        }

        // Cache own faction ID as soon as possible
        if (tornKey) {
            fetchUserFactionId(tornKey).then(id => {
                if (id) userFactionId = id;
            });
        }

        ensureInfoLineMounted();
        bootstrapCurrentPageFF(true);
        startInfoLineWatcher();
        startAttackOverlayWatcher();

        if (window.location.href.startsWith("https://www.torn.com/factions.php")) {
            const torn_observer = new MutationObserver(function () {
                var members_list = $(".members-list")[0];
                if (members_list) {
                    torn_observer.disconnect();
                    var player_ids = get_members();
                    update_ff_cache(player_ids, apply_fair_fight_info);
                }
            });
            torn_observer.observe(document, { attributes: false, childList: true, characterData: false, subtree: true });
            if (!key) set_message("Limited API key needed - click to add");
        }

        function get_player_id_in_element(element) {
            const match = element.parentElement?.href?.match(/.*XID=(?<target_id>\d+)/);
            if (match) return match.groups.target_id;
            const anchors = element.getElementsByTagName('a');
            for (const anchor of anchors) {
                const m = anchor.href.match(/.*XID=(?<target_id>\d+)/);
                if (m) return m.groups.target_id;
            }
            if (element.nodeName.toLowerCase() === "a") {
                const m = element.href.match(/.*XID=(?<target_id>\d+)/);
                if (m) return m.groups.target_id;
            }
            return null;
        }

        function ff_to_percent(ff) {
            const low_ff = 2;
            const high_ff = 4;
            const low_mid_percent = 33;
            const mid_high_percent = 66;
            ff = Math.min(ff, 8);
            if (ff < low_ff) {
                return (ff - 1) / (low_ff - 1) * low_mid_percent;
            } else if (ff < high_ff) {
                return (((ff - low_ff) / (high_ff - low_ff)) * (mid_high_percent - low_mid_percent)) + low_mid_percent;
            } else {
                return (((ff - high_ff) / (8 - high_ff)) * (100 - mid_high_percent)) + mid_high_percent;
            }
        }

        function formatBattleStats(value) {
            if (!value) return null;
            if (value >= 1e9) return (value / 1e9).toFixed(2).replace(/\.00$/, '') + 'b';
            if (value >= 1e6) return (value / 1e6).toFixed(2).replace(/\.00$/, '') + 'm';
            if (value >= 1e3) return (value / 1e3).toFixed(2).replace(/\.00$/, '') + 'k';
            return value.toString();
        }

        function show_cached_values(elements) {
            for (const [player_id, element] of elements) {
                element.classList.add('ff-scouter-indicator');
                if (!element.classList.contains('indicator-lines')) {
                    element.classList.add('indicator-lines');
                    element.style.setProperty("--arrow-width", "10px");
                    element.classList.remove("small");
                    element.classList.remove("big");
                }
                const response = get_fair_fight_response(player_id);
                if (response) {
                    $(element).find('.ff-scouter-arrow').remove();
                    $(element).find('.ff-scouter-bs-estimate').remove();
                    const ff = response.value;
                    if (ff) {
                        const percent = ff_to_percent(ff);
                        element.style.setProperty("--band-percent", percent);
                        var arrow = percent < 33 ? BLUE_ARROW : (percent < 66 ? GREEN_ARROW : RED_ARROW);
                        $(element).append($('<img>', { src: arrow, class: "ff-scouter-arrow" }));
                        if (response.bs_estimate || response.bs_estimate_human) {
                            const bsValue = response.bs_estimate_human || (response.bs_estimate ? formatBattleStats(response.bs_estimate) : null);
                            if (bsValue) {
                                const backgroundColor = get_ff_colour(ff);
                                const textColor = get_contrast_color(backgroundColor);
                                $(element).append($('<div>', {
                                    class: "ff-scouter-bs-estimate",
                                    text: bsValue,
                                    css: {
                                        position: 'absolute',
                                        bottom: '-5px',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        fontSize: '8px',
                                        color: textColor,
                                        backgroundColor: backgroundColor,
                                        textShadow: '0px 0px 1px rgba(0, 0, 0, 0.3)',
                                        padding: '1px 2px',
                                        borderRadius: '2px',
                                        pointerEvents: 'none',
                                        zIndex: '10',
                                        fontWeight: 'bold',
                                        lineHeight: '1',
                                        whiteSpace: 'nowrap'
                                    }
                                }));
                            }
                        }
                    }
                }
            }
        }

        async function apply_ff_gauge(elements) {
            elements = elements.filter(e => !e.classList.contains('ff-scouter-indicator'));
            elements = elements.map(e => [get_player_id_in_element(e), e]).filter(e => e[0]);
            if (elements.length > 0) {
                show_cached_values(elements);
                const player_ids = elements.map(e => e[0]);
                update_ff_cache(player_ids, () => { show_cached_values(elements); });
            }
        }

        async function apply_to_mini_profile(mini) {
            const player_id = get_player_id_in_element(mini);
            if (!player_id) return;
            const response = get_fair_fight_response(player_id);
            if (!response || response.no_data) return;

            $(mini).find('.ff-scouter-mini-ff').remove();

            const ffValueFormatted = formatFFForExtraRow(response.value);
            const backgroundColor = get_ff_colour(response.value);
            const textColor = get_contrast_color(backgroundColor);

            const ffElement = $('<div>', {
                class: 'ff-scouter-mini-ff',
                css: {
                    fontSize: '10px',
                    fontWeight: 'bold',
                    backgroundColor: backgroundColor,
                    color: textColor,
                    padding: '2px 4px',
                    borderRadius: '3px',
                    display: 'inline-block',
                    marginTop: '2px',
                    textAlign: 'center'
                },
                html: `FF: ${ffValueFormatted}`
            });

            const description = $(mini).find('.description');
            if (description.length) description.append(ffElement);
            else $(mini).append(ffElement);
        }

        const ff_gauge_observer = new MutationObserver(async function () {
            var honor_bars = $(".honor-text-wrap").toArray();
            if (honor_bars.length > 0) {
                await apply_ff_gauge($(".honor-text-wrap").toArray());
            } else {
                if (window.location.href.startsWith("https://www.torn.com/factions.php")) await apply_ff_gauge($(".member").toArray());
                else if (window.location.href.startsWith("https://www.torn.com/companies.php")) await apply_ff_gauge($(".employee").toArray());
                else if (window.location.href.startsWith("https://www.torn.com/joblist.php")) await apply_ff_gauge($(".employee").toArray());
                else if (window.location.href.startsWith("https://www.torn.com/messages.php")) await apply_ff_gauge($(".name").toArray());
                else if (window.location.href.startsWith("https://www.torn.com/index.php")) await apply_ff_gauge($(".name").toArray());
                else if (window.location.href.startsWith("https://www.torn.com/hospitalview.php")) await apply_ff_gauge($(".name").toArray());
                else if (window.location.href.startsWith("https://www.torn.com/page.php?sid=UserList")) await apply_ff_gauge($(".name").toArray());
                else if (window.location.href.startsWith("https://www.torn.com/bounties.php")) {
                    await apply_ff_gauge($(".target").toArray());
                    await apply_ff_gauge($(".listed").toArray());
                } else if (window.location.href.startsWith("https://www.torn.com/forums.php")) {
                    await apply_ff_gauge($(".last-poster").toArray());
                    await apply_ff_gauge($(".starter").toArray());
                    await apply_ff_gauge($(".last-post").toArray());
                    await apply_ff_gauge($(".poster").toArray());
                } else if (window.location.href.includes("page.php?sid=hof")) {
                    await apply_ff_gauge($('[class^="userInfoBox__"]').toArray());
                }
            }

            var mini_profiles = $('[class^="profile-mini-_userProfileWrapper_"]').toArray();
            if (mini_profiles.length > 0) {
                for (const mini of mini_profiles) {
                    if (!mini.classList.contains('ff-processed')) {
                        mini.classList.add('ff-processed');
                        const player_id = get_player_id_in_element(mini);
                        apply_to_mini_profile(mini);
                        update_ff_cache([player_id], () => { apply_to_mini_profile(mini); });
                    }
                }
            }
        });

        ff_gauge_observer.observe(document, { attributes: false, childList: true, characterData: false, subtree: true });

        function abbreviateCountry(name) {
            if (!name) return '';
            // Remove extra words like "airstrip", "City"
            let clean = name.replace(/\s+(airstrip|City|Islands?)/i, '').trim();
            const key = clean.toLowerCase();
            const map = {
                'united kingdom': 'UK',
                'uk': 'UK',
                'england': 'UK',
                'cayman islands': 'CAY',
                'cayman': 'CAY',
                'mexico': 'MEX',
                'argentina': 'ARG',
                'canada': 'CAN',
                'hawaii': 'HI',
                'switzerland': 'SWITZ',
                'south africa': 'SA',
                'china': 'CHI',
                'japan': 'JAP',
                'united arab emirates': 'UAE',
                'uae': 'UAE',
                'emirates': 'UAE'
            };
            return map[key] || clean.substring(0, 3).toUpperCase();
        }

        function formatTime(ms) {
            let totalSeconds = Math.max(0, Math.floor(ms / 1000));
            let hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
            let minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
            let seconds = String(totalSeconds % 60).padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
        }

        function fetchFactionData(factionID) {
            const url = `https://api.torn.com/v2/faction/${factionID}/members?striptags=true&key=${tornKey}`;
            return fetch(url).then(response => response.json());
        }

        function getPlayerIdFromRow(row) {
            if (!row) return null;
            const profileLink = row.querySelector('a[href*="profiles.php?XID="]');
            if (!profileLink) return null;
            const match = profileLink.href.match(/XID=(\d+)/);
            return match ? match[1] : null;
        }

        function seedProfileOriginalOrderMap() {
            const tableBody = document.querySelector('.table-body');
            if (!tableBody) return;
            const rows = Array.from(tableBody.querySelectorAll('.table-row'));
            rows.forEach(row => {
                const playerId = getPlayerIdFromRow(row);
                if (!playerId) return;
                if (!profileOriginalOrderMap.has(playerId)) {
                    profileOriginalOrderMap.set(playerId, nextProfileOriginalOrder++);
                }
            });
        }

        function seedWarOriginalOrderMap(listElement, side) {
            if (!listElement || !warOriginalOrderMaps[side]) return;
            Array.from(listElement.children).forEach(li => {
                const playerId = getPlayerIdFromRow(li);
                if (!playerId) return;
                if (!warOriginalOrderMaps[side].has(playerId)) {
                    warOriginalOrderMaps[side].set(playerId, nextWarOriginalOrder[side]++);
                }
            });
        }

        function getProfileOriginalIndex(playerId) {
            if (!profileOriginalOrderMap.has(playerId)) {
                profileOriginalOrderMap.set(playerId, nextProfileOriginalOrder++);
            }
            return profileOriginalOrderMap.get(playerId);
        }

        function getWarOriginalIndex(side, playerId) {
            if (!warOriginalOrderMaps[side].has(playerId)) {
                warOriginalOrderMaps[side].set(playerId, nextWarOriginalOrder[side]++);
            }
            return warOriginalOrderMaps[side].get(playerId);
        }

        function getStatusFromProfileMainRow(row) {
            const statusEl = row.querySelector('.status');
            if (!statusEl) return 'Unknown';
            const statusDiv = statusEl.querySelector('.faction-profile-status');
            if (!statusDiv) return 'Unknown';
            if (statusDiv.classList.contains('faction-status-okay')) return 'Okay';
            if (statusDiv.classList.contains('faction-status-hospital')) return 'Hospital';
            if (statusDiv.classList.contains('faction-status-traveling')) return 'Traveling';
            if (statusDiv.classList.contains('faction-status-abroad')) return 'Abroad';
            if (statusDiv.classList.contains('faction-status-jail')) return 'Jail';
            return 'Unknown';
        }

        function getStatusFromWarRow(row) {
            const statusEl = row.querySelector('.status');
            if (!statusEl) return 'Unknown';
            if (statusEl.classList.contains('faction-status-okay')) return 'Okay';
            if (statusEl.classList.contains('faction-status-hospital')) return 'Hospital';
            if (statusEl.classList.contains('faction-status-traveling')) return 'Traveling';
            if (statusEl.classList.contains('faction-status-abroad')) return 'Abroad';
            if (statusEl.classList.contains('faction-status-jail')) return 'Jail';
            return 'Unknown';
        }

        function compareProfileItems(mode, a, b) {
            const statusPriorityHospital = { 'Hospital': 1, 'Okay': 2, 'Abroad': 3, 'Traveling': 4 };
            const statusPriorityOkay = { 'Okay': 1, 'Hospital': 2, 'Abroad': 3, 'Traveling': 4 };

            if (mode === 'bs-high-low') {
                if (a.bsValue !== b.bsValue) return b.bsValue - a.bsValue;
                return a.originalIndex - b.originalIndex;
            }

            if (mode === 'bs-low-high') {
                if (a.bsValue !== b.bsValue) return a.bsValue - b.bsValue;
                return a.originalIndex - b.originalIndex;
            }

            if (mode === 'hospital-priority') {
                const aPrio = statusPriorityHospital[a.status] || 99;
                const bPrio = statusPriorityHospital[b.status] || 99;
                if (aPrio !== bPrio) return aPrio - bPrio;
                if (a.status === 'Hospital' && b.status === 'Hospital') {
                    if (a.hospitalTimer !== b.hospitalTimer) return a.hospitalTimer - b.hospitalTimer;
                    return a.originalIndex - b.originalIndex;
                }
                if (a.status === 'Okay' && b.status === 'Okay') {
                    if (a.bsValue !== b.bsValue) return b.bsValue - a.bsValue;
                    return a.originalIndex - b.originalIndex;
                }
                if (a.bsValue !== b.bsValue) return b.bsValue - a.bsValue;
                return a.originalIndex - b.originalIndex;
            }

            if (mode === 'okay-priority') {
                const aPrio = statusPriorityOkay[a.status] || 99;
                const bPrio = statusPriorityOkay[b.status] || 99;
                if (aPrio !== bPrio) return aPrio - bPrio;
                if (a.status === 'Okay' && b.status === 'Okay') {
                    if (a.bsValue !== b.bsValue) return b.bsValue - a.bsValue;
                    return a.originalIndex - b.originalIndex;
                }
                if (a.status === 'Hospital' && b.status === 'Hospital') {
                    if (a.hospitalTimer !== b.hospitalTimer) return a.hospitalTimer - b.hospitalTimer;
                    return a.originalIndex - b.originalIndex;
                }
                if (a.bsValue !== b.bsValue) return b.bsValue - a.bsValue;
                return a.originalIndex - b.originalIndex;
            }

            if (mode === 'traveling') {
                const aHasDest = !!a.destination;
                const bHasDest = !!b.destination;
                if (aHasDest !== bHasDest) return aHasDest ? -1 : 1;
                if (aHasDest) {
                    const cmp = a.destination.localeCompare(b.destination);
                    if (cmp !== 0) return cmp;
                    if (a.bsValue !== b.bsValue) return b.bsValue - a.bsValue;
                    return a.originalIndex - b.originalIndex;
                }
                if (a.bsValue !== b.bsValue) return b.bsValue - a.bsValue;
                return a.originalIndex - b.originalIndex;
            }

            if (mode === 'last-action') {
                if (a.lastAction !== b.lastAction) return b.lastAction - a.lastAction;
                if (a.bsValue !== b.bsValue) return b.bsValue - a.bsValue;
                return a.originalIndex - b.originalIndex;
            }

            return a.originalIndex - b.originalIndex;
        }

        function compareWarItems(mode, a, b) {
            return compareProfileItems(mode, a, b);
        }

        function collectProfileRowData() {
            const tableBody = document.querySelector('.table-body');
            if (!tableBody) return [];

            seedProfileOriginalOrderMap();

            const mainRows = Array.from(tableBody.querySelectorAll('.table-row[data-ff-scouter-extra]'));
            const items = [];

            mainRows.forEach(mainRow => {
                const playerId = getPlayerIdFromRow(mainRow);
                if (!playerId) return;

                const extraRow = mainRow.nextElementSibling && mainRow.nextElementSibling.classList.contains('ff-scouter-extra-row')
                ? mainRow.nextElementSibling
                : null;

                const ffResponse = get_fair_fight_response(playerId);
                const bsValue = ffResponse && ffResponse.bs_estimate ? ffResponse.bs_estimate : 0;
                const status = getStatusFromProfileMainRow(mainRow);
                let hospitalTimer = Infinity;
                if (status === 'Hospital' && memberCountdowns[playerId]) {
                    const remaining = memberCountdowns[playerId] - Date.now();
                    hospitalTimer = remaining > 0 ? remaining : 0;
                }

                items.push({
                    playerId,
                    mainRow,
                    extraRow,
                    bsValue,
                    status,
                    hospitalTimer,
                    destination: mainRow.dataset.destination || '',
                    lastAction: parseInt(mainRow.dataset.lastAction || '0', 10) || 0,
                    originalIndex: getProfileOriginalIndex(playerId)
                });
            });

            return items;
        }

        function applyProfileSort(mode = currentSortMode) {
            if (!mode || mode === 'none') return;
            const tableBody = document.querySelector('.table-body');
            if (!tableBody) return;

            const items = collectProfileRowData();
            if (!items.length) return;

            items.sort((a, b) => compareProfileItems(mode, a, b));

            isApplyingProfileSort = true;
            try {
                items.forEach(item => {
                    tableBody.appendChild(item.mainRow);
                    if (item.extraRow) tableBody.appendChild(item.extraRow);
                });
            } finally {
                requestAnimationFrame(() => {
                    isApplyingProfileSort = false;
                });
            }
        }

        function scheduleProfileSort(delay = 120) {
            if (profileSortTimeout) clearTimeout(profileSortTimeout);
            profileSortTimeout = setTimeout(() => {
                profileSortTimeout = null;
                if (currentSortMode !== 'none') {
                    fixExtraRowsAfterFilter();
                    applyProfileSort(currentSortMode);
                }
            }, delay);
        }

        function collectWarRowData(listElement, side) {
            if (!listElement) return [];

            seedWarOriginalOrderMap(listElement, side);

            return Array.from(listElement.children).map(li => {
                const playerId = getPlayerIdFromRow(li);
                if (!playerId) return null;
                const ffResponse = get_fair_fight_response(playerId);
                const bsValue = ffResponse && ffResponse.bs_estimate ? ffResponse.bs_estimate : 0;
                const status = getStatusFromWarRow(li);
                let hospitalTimer = Infinity;
                if (status === 'Hospital' && memberCountdowns[playerId]) {
                    const remaining = memberCountdowns[playerId] - Date.now();
                    hospitalTimer = remaining > 0 ? remaining : 0;
                }
                return {
                    playerId,
                    row: li,
                    bsValue,
                    status,
                    hospitalTimer,
                    destination: li.dataset.destination || '',
                    lastAction: parseInt(li.dataset.lastAction || '0', 10) || 0,
                    originalIndex: getWarOriginalIndex(side, playerId)
                };
            }).filter(Boolean);
        }

        function applyWarSortToList(listElement, side, mode = warSortMode) {
            if (!listElement || !mode || mode === 'none') return;

            const items = collectWarRowData(listElement, side);
            if (!items.length) return;

            items.sort((a, b) => compareWarItems(mode, a, b));

            isApplyingWarSort = true;
            try {
                items.forEach(item => listElement.appendChild(item.row));
            } finally {
                requestAnimationFrame(() => {
                    isApplyingWarSort = false;
                });
            }
        }

        function applyWarSort(mode = warSortMode) {
            if (!mode || mode === 'none') return;
            const yourList = document.querySelector('.your-faction .members-list');
            const enemyList = document.querySelector('.enemy-faction .members-list');
            if (yourList) applyWarSortToList(yourList, 'your', mode);
            if (enemyList) applyWarSortToList(enemyList, 'enemy', mode);
        }

        function scheduleWarSort(delay = 120) {
            if (warSortTimeout) clearTimeout(warSortTimeout);
            warSortTimeout = setTimeout(() => {
                warSortTimeout = null;
                if (warSortMode !== 'none') {
                    applyWarSort(warSortMode);
                }
            }, delay);
        }

        function forceSortNow() {
            const isWarPage = document.querySelector('.your-faction .members-list') !== null &&
                  document.querySelector('.enemy-faction .members-list') !== null;
            if (isWarPage) {
                if (warSortMode !== 'none') applyWarSort(warSortMode);
            } else {
                if (currentSortMode !== 'none') {
                    fixExtraRowsAfterFilter();
                    applyProfileSort(currentSortMode);
                }
            }
        }

        function setupProfileSortObserver() {
            const tableBody = document.querySelector('.table-body');
            if (!tableBody) return;
            if (profileSortObserver) profileSortObserver.disconnect();

            profileSortObserver = new MutationObserver(() => {
                if (isApplyingProfileSort) return;
                if (currentSortMode === 'none') return;
                scheduleProfileSort(160);
            });

            profileSortObserver.observe(tableBody, { childList: true, subtree: false });
        }

        function setupWarSortObservers() {
            const yourList = document.querySelector('.your-faction .members-list');
            const enemyList = document.querySelector('.enemy-faction .members-list');

            if (warYourSortObserver) warYourSortObserver.disconnect();
            if (warEnemySortObserver) warEnemySortObserver.disconnect();

            if (yourList) {
                warYourSortObserver = new MutationObserver(() => {
                    if (isApplyingWarSort) return;
                    if (warSortMode === 'none') return;
                    scheduleWarSort(160);
                });
                warYourSortObserver.observe(yourList, { childList: true, subtree: false });
            }

            if (enemyList) {
                warEnemySortObserver = new MutationObserver(() => {
                    if (isApplyingWarSort) return;
                    if (warSortMode === 'none') return;
                    scheduleWarSort(160);
                });
                warEnemySortObserver.observe(enemyList, { childList: true, subtree: false });
            }
        }

        function createSortPanel() {
            if (document.getElementById('ff-scouter-sort-btn')) return;

            const sortBtn = document.createElement('button');
            sortBtn.id = 'ff-scouter-sort-btn';
            sortBtn.className = 'ff-scouter-sort-btn';
            sortBtn.textContent = '⇅';
            sortBtn.title = 'Click to show sort options';
            sortBtn.addEventListener('dblclick', forceSortNow);

            const sortPanel = document.createElement('div');
            sortPanel.id = 'ff-scouter-sort-panel';
            sortPanel.className = 'ff-scouter-sort-panel';

            const options = [
                { id: 'bs-high-low', text: 'BS: High to Low' },
                { id: 'bs-low-high', text: 'BS: Low to High' },
                { id: 'hospital-priority', text: 'Hospital Priority' },
                { id: 'okay-priority', text: 'Okay Priority' },
                { id: 'traveling', text: 'Travel/Abroad' },
                { id: 'last-action', text: 'Last Action (recent first)' }
            ];

            options.forEach(option => {
                const optionBtn = document.createElement('button');
                optionBtn.className = 'ff-scouter-sort-option';
                optionBtn.dataset.sort = option.id;
                optionBtn.textContent = option.text;
                optionBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    handleSortSelection(this.dataset.sort);
                    sortPanel.classList.remove('visible');
                    sortBtn.classList.add('visible');
                });
                sortPanel.appendChild(optionBtn);
            });

            const separator = document.createElement('hr');
            separator.style.width = '100%';
            separator.style.margin = '5px 0';
            separator.style.border = 'none';
            separator.style.borderTop = '1px solid #555';
            sortPanel.appendChild(separator);

            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'ff-toggle-extra-btn';
            toggleBtn.className = 'ff-scouter-sort-option';
            toggleBtn.textContent = showExtraRows ? 'Hide Extra Rows' : 'Show Extra Rows';
            toggleBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                setExtraRowsVisibility(!showExtraRows);
            });
            sortPanel.appendChild(toggleBtn);

            const destBtn = document.createElement('button');
            destBtn.id = 'ff-destinations-btn';
            destBtn.className = 'ff-scouter-sort-option';
            destBtn.textContent = '🌍 Destinations';
            destBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                showDestinationsPanel();
            });
            sortPanel.appendChild(destBtn);

            sortBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                sortPanel.classList.toggle('visible');
                sortBtn.classList.toggle('visible');
            });

            document.addEventListener('click', function(e) {
                if (!sortPanel.contains(e.target) && !sortBtn.contains(e.target)) {
                    sortPanel.classList.remove('visible');
                    sortBtn.classList.add('visible');
                }
            });

            document.body.appendChild(sortBtn);
            document.body.appendChild(sortPanel);
            sortBtn.classList.add('visible');

            highlightActiveSortOption();
        }

        function handleSortSelection(sortType) {
            const isWarPage = document.querySelector('.your-faction .members-list') !== null &&
                  document.querySelector('.enemy-faction .members-list') !== null;

            if (isWarPage) {
                warSortMode = sortType;
                GM_setValue('ff_scouter_sort_mode_war', warSortMode);
                applyWarSort(sortType);
            } else {
                currentSortMode = sortType;
                GM_setValue('ff_scouter_sort_mode', currentSortMode);
                fixExtraRowsAfterFilter();
                applyProfileSort(sortType);
            }
            highlightActiveSortOption();
        }

        function highlightActiveSortOption() {
            const sortPanel = document.getElementById('ff-scouter-sort-panel');
            if (!sortPanel) return;

            sortPanel.querySelectorAll('.ff-scouter-sort-option').forEach(btn => btn.classList.remove('active'));

            const isWarPage = document.querySelector('.your-faction .members-list') !== null &&
                  document.querySelector('.enemy-faction .members-list') !== null;
            const activeMode = isWarPage ? warSortMode : currentSortMode;
            if (activeMode === 'none') return;

            const activeBtn = sortPanel.querySelector(`[data-sort="${activeMode}"]`);
            if (activeBtn) activeBtn.classList.add('active');
        }

        function setExtraRowsVisibility(show) {
            showExtraRows = show;
            GM_setValue('ff_show_extra_rows', show);
            if (show) document.body.classList.remove('ff-hide-extra');
            else document.body.classList.add('ff-hide-extra');
            const btn = document.getElementById('ff-toggle-extra-btn');
            if (btn) btn.textContent = show ? 'Hide Extra Rows' : 'Show Extra Rows';
        }

        const COUNTRY_FLAG_MAP = {
            'United Kingdom': '🇬🇧',
            'UK': '🇬🇧',
            'Switzerland': '🇨🇭',
            'Argentina': '🇦🇷',
            'Japan': '🇯🇵',
            'South Africa': '🇿🇦',
            'United Arab Emirates': '🇦🇪',
            'UAE': '🇦🇪',
            'Canada': '🇨🇦',
            'Mexico': '🇲🇽',
            'Cayman Islands': '🇰🇾',
            'Hawaii': '🇺🇸',
            'China': '🇨🇳'
        };

        // Build a lookup that maps any short/alternate form to the full name from COUNTRY_LIST
        const COUNTRY_NAME_MAP = {};
        COUNTRY_LIST.forEach(c => {
            const full = c.name;
            COUNTRY_NAME_MAP[full.toLowerCase()] = full;
            // Add common abbreviations / short forms
            const shortForms = {
                'United Kingdom': ['uk', 'united kingdom', 'england', 'great britain'],
                'United Arab Emirates': ['uae', 'united arab emirates', 'emirates'],
                'Cayman Islands': ['cayman', 'cayman islands'],
                'South Africa': ['south africa', 'sa'],
                'Switzerland': ['switzerland', 'swiss'],
                'Argentina': ['argentina'],
                'Mexico': ['mexico'],
                'Canada': ['canada'],
                'Hawaii': ['hawaii'],
                'Japan': ['japan'],
                'China': ['china']
            };
            const aliases = shortForms[full] || [];
            aliases.forEach(alias => COUNTRY_NAME_MAP[alias.toLowerCase()] = full);
        });

        function standardizeCountryName(name) {
            if (!name) return '';
            const lower = name.trim().toLowerCase();
            return COUNTRY_NAME_MAP[lower] || name.trim();
        }

        // Get flag URL for a full country name
        function getFlagUrl(countryFullName) {
            const entry = COUNTRY_LIST.find(c => c.name === countryFullName);
            return entry ? entry.flag : null;
        }

        let currentDestinationsMode = 'safe';
        let userFactionId = null;

        function extractCountryFromDescription(desc) {
            if (!desc) return null;

            let match;

            // New pattern: "Traveling from X to Y"
            match = desc.match(/Traveling from ([A-Za-z\s]+) to ([A-Za-z\s]+)/i);
            if (match) {
                // We'll determine later if it's outgoing or returning
                return { from: standardizeCountryName(match[1].trim()), to: standardizeCountryName(match[2].trim()) };
            }

            // Legacy: "Traveling to X" (outgoing)
            match = desc.match(/Traveling to ([A-Za-z\s]+)/i);
            if (match) return { to: standardizeCountryName(match[1].trim()), from: 'Torn' };

            // Legacy: "Returning to Torn from X"
            match = desc.match(/Returning to Torn from ([A-Za-z\s]+)/i);
            if (match) return { from: standardizeCountryName(match[1].trim()), to: 'Torn' };

            // Abroad: "In X"
            match = desc.match(/In ([A-Za-z\s]+)/i);
            if (match) return { location: standardizeCountryName(match[1].trim()) };

            return null;
        }

        async function getUserLocation(apiKey) {
            if (!tornKey) return 'Torn';
            try {
                const response = await fetch(`https://api.torn.com/v2/user/?selections=basic&key=${tornKey}`);
                const data = await response.json();
                const status = data.status;
                if (!status) return 'Torn';

                if (status.state === 'Traveling') {
                    const parsed = extractCountryFromDescription(status.description);
                    if (parsed && parsed.from && parsed.to) {
                        if (parsed.from === 'Torn' || parsed.from === 'Torn City') {
                            return standardizeCountryName(parsed.to);
                        } else if (parsed.to === 'Torn' || parsed.to === 'Torn City') {
                            return standardizeCountryName(parsed.from);
                        }
                    }
                    // Legacy fallback
                    if (status.description.includes('Traveling to ')) {
                        return extractCountryFromDescription(status.description)?.to || 'Traveling';
                    } else if (status.description.includes('Returning to Torn from ')) {
                        return extractCountryFromDescription(status.description)?.from || 'Traveling';
                    }
                    return 'Traveling';
                } else if (status.state === 'Abroad') {
                    const parsed = extractCountryFromDescription(status.description);
                    if (parsed && parsed.location) return standardizeCountryName(parsed.location);
                    const match = status.description.match(/In ([A-Za-z\s]+)/i);
                    return match ? standardizeCountryName(match[1].trim()) : 'Abroad';
                }
                return 'Torn';
            } catch (e) {
                console.error('Error fetching user location:', e);
                return 'Torn';
            }
        }

        function getFactionIdFromContext() {
            const enemyLink = document.querySelector('.opponentFactionName___vhESM a');
            if (enemyLink) {
                const match = enemyLink.href.match(/ID=(\d+)/);
                if (match) return match[1];
            }
            const profileMatch = window.location.href.match(/factions\.php\?step=profile&ID=(\d+)/);
            if (profileMatch) return profileMatch[1];
            return userFactionId || null;
        }

        async function fetchFactionMembers(factionId, apiKey) {
    if (!apiKey) throw new Error('No API key');
    const response = await fetch(`https://api.torn.com/v2/faction/${factionId}/members?striptags=true&key=${apiKey}`);
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            if (!Array.isArray(data.members)) throw new Error('No members data');
            return data.members;
        }

        async function fetchUserFactionId(apiKey) {
            // 1. Try from page first (most reliable, instant)
            const pageId = getUserFactionIdFromPage();
            if (pageId) {
                userFactionId = pageId;
                return pageId;
            }

            // 2. Fall back to API if we have a key
            if (!apiKey) return null;
            try {
                const response = await fetch(`https://api.torn.com/v2/user/?selections=profile&key=${tornKey}`);
                const data = await response.json();
                if (!data.error && data.faction?.faction_id) {
                    userFactionId = data.faction.faction_id;
                }
                return userFactionId;
            } catch {
                return null;
            }
        }

        function groupMembersByDestination(members) {
            const groups = {
                Torn: [],
                Traveling: {},
                Abroad: {},
                Returning: {}
            };

            members.forEach(member => {
                const status = member.status;
                if (!status) return;

                const state = status.state;
                const desc = status.description || '';

                if (state === 'Okay' || state === 'Hospital' || state === 'Jail') {
                    groups.Torn.push({ name: member.name, status: state, onlineStatus: member.last_action?.status || 'Offline' });
                }
                else if (state === 'Traveling') {
                    // Parse the new format: "Traveling from X to Y"
                    const parsed = extractCountryFromDescription(desc);
                    if (parsed && parsed.from && parsed.to) {
                        if (parsed.to === 'Torn' || parsed.to === 'Torn City') {
                            // Returning
                            const dest = parsed.from;
                            if (!groups.Returning[dest]) groups.Returning[dest] = [];
                            groups.Returning[dest].push({ name: member.name, status: 'Returning', onlineStatus: member.last_action?.status || 'Offline' });
                        } else if (parsed.from === 'Torn' || parsed.from === 'Torn City') {
                            // Traveling to destination
                            const dest = parsed.to;
                            if (!groups.Traveling[dest]) groups.Traveling[dest] = [];
                            groups.Traveling[dest].push({ name: member.name, status: 'Traveling', onlineStatus: member.last_action?.status || 'Offline' });
                        } else {
                            // Neither is Torn? Fallback to treating 'to' as destination
                            const dest = parsed.to;
                            if (!groups.Traveling[dest]) groups.Traveling[dest] = [];
                            groups.Traveling[dest].push({ name: member.name, status: 'Traveling', onlineStatus: member.last_action?.status || 'Offline' });
                        }
                    }
                    // Legacy fallback
                    else if (desc.includes('Returning to Torn from ')) {
                        const dest = desc.replace('Returning to Torn from ', '').trim();
                        if (!groups.Returning[dest]) groups.Returning[dest] = [];
                        groups.Returning[dest].push({ name: member.name, status: 'Returning', onlineStatus: member.last_action?.status || 'Offline' });
                    } else if (desc.includes('Traveling to ')) {
                        const dest = desc.replace('Traveling to ', '').trim();
                        if (!groups.Traveling[dest]) groups.Traveling[dest] = [];
                        groups.Traveling[dest].push({ name: member.name, status: 'Traveling', onlineStatus: member.last_action?.status || 'Offline' });
                    }
                }
                else if (state === 'Abroad') {
                    const parsed = extractCountryFromDescription(desc);
                    let dest = 'Unknown';
                    if (parsed && parsed.location) dest = parsed.location;
                    else if (desc.match(/In ([A-Za-z\s]+)/i)) dest = desc.match(/In ([A-Za-z\s]+)/i)[1].trim();
                    dest = standardizeCountryName(dest);
                    if (!groups.Abroad[dest]) groups.Abroad[dest] = [];
                    groups.Abroad[dest].push({ name: member.name, status: 'Abroad', onlineStatus: member.last_action?.status || 'Offline' });
                }
            });

            return groups;
        }

        function renderDestinationsPanel(container, groups, mode, userLocation, isOwnFaction) {
            container.innerHTML = '';
            const allCountries = COUNTRY_LIST.map(c => c.name);

            if (mode === 'safe') {
                const occupied = new Set();
                Object.keys(groups.Traveling).forEach(c => occupied.add(c));
                Object.keys(groups.Abroad).forEach(c => occupied.add(c));
                const safe = allCountries.filter(c => !occupied.has(c));
                if (!safe.length) {
                    container.innerHTML = '<div class="no-data">No safe destinations found</div>';
                    return;
                }
                safe.forEach(country => {
                    const item = document.createElement('div');
                    item.className = 'member-item';
                    const flagUrl = getFlagUrl(country);
                    const flagImg = flagUrl ? `<img src="${flagUrl}" style="width:16px;height:11px;margin-right:4px;vertical-align:middle;">` : '';
                    const tag = (userLocation === country) ? '<span class="location-tag">You are here</span>' : '';
                    item.innerHTML = `<span class="member-name">${flagImg}${country} ${tag}</span> <span class="member-status">✅ Safe</span>`;
                    container.appendChild(item);
                });
            } else {
                const nameClass = 'neutral';
                if (groups.Torn.length) {
                    container.appendChild(createGroupElement('🏠 Torn', groups.Torn, nameClass));
                }
                ['Traveling', 'Abroad', 'Returning'].forEach(cat => {
                    Object.keys(groups[cat]).sort().forEach(dest => {
                        const members = groups[cat][dest];
                        const icon = cat === 'Traveling' ? '✈️' : (cat === 'Abroad' ? '🌍' : '🔙');
                        container.appendChild(createGroupElement(`${icon} ${dest}`, members, nameClass));
                    });
                });
                if (!groups.Torn.length && !Object.keys(groups.Traveling).length && !Object.keys(groups.Abroad).length && !Object.keys(groups.Returning).length) {
                    container.innerHTML = '<div class="no-data">No location data available</div>';
                }
            }
        }

        function createGroupElement(title, members, nameClass) {
            const group = document.createElement('div');
            group.className = 'destination-group';
            group.innerHTML = `
                <div class="group-header">
                    <span class="group-name">${title}</span>
                    <span class="group-count">${members.length}</span>
                    <span class="collapse-icon">▼</span>
                </div>
                <div class="group-members"></div>
            `;
            const membersDiv = group.querySelector('.group-members');
            members.forEach(m => {
                const item = document.createElement('div');
                item.className = 'member-item';
                const onlineCircle =
                      m.onlineStatus === 'Online' ? '🟢' :
                m.onlineStatus === 'Idle' ? '🟡' :
                '⚫';
                item.innerHTML = `<span class="member-name ${nameClass}">${onlineCircle} ${m.name}</span> <span class="member-status">${m.status}</span>`;
                membersDiv.appendChild(item);
            });
            group.querySelector('.group-header').addEventListener('click', (e) => {
                e.stopPropagation();
                group.classList.toggle('collapsed');
                const icon = group.querySelector('.collapse-icon');
                icon.textContent = group.classList.contains('collapsed') ? '▶' : '▼';
            });
            return group;
        }

        async function showDestinationsPanel() {
            const existing = document.querySelector('.destinations-panel');
            if (existing) {
                existing.remove();
                return;
            }

            const apiKey = key;
            if (!apiKey) {
                alert('API key required.');
                return;
            }

            const panel = document.createElement('div');
            panel.className = 'destinations-panel';
            panel.innerHTML = `
        <div class="destinations-header">
            <h2>🌍 Destinations</h2>
            <button class="destinations-close">✕</button>
        </div>
        <div class="destinations-toolbar">
            <div class="destinations-toggle">
              <button class="toggle-btn active" data-mode="safe">Unoccupied</button>
              <button class="toggle-btn" data-mode="enemy">Locations</button>
              <button class="toggle-btn" data-mode="danger">⚠️ Danger</button>
            </div>
            <button class="refresh-btn" id="refresh-destinations">🔄 Refresh</button>
        </div>
        <div class="destinations-content">
            <div class="loading">Loading...</div>
        </div>
    `;

            document.body.appendChild(panel);

            panel.querySelector('.destinations-close').addEventListener('click', () => panel.remove());
            panel.addEventListener('click', (e) => e.stopPropagation());
            setTimeout(() => {
                document.addEventListener('click', function outsideClick(e) {
                    if (!panel.contains(e.target)) {
                        panel.remove();
                        document.removeEventListener('click', outsideClick);
                    }
                });
            }, 0);

            const content = panel.querySelector('.destinations-content');
            const toggleBtns = panel.querySelectorAll('.toggle-btn');
            const refreshBtn = panel.querySelector('#refresh-destinations');

            const setMode = async (mode) => {
                toggleBtns.forEach(b => b.classList.remove('active'));
                panel.querySelector(`[data-mode="${mode}"]`).classList.add('active');
                currentDestinationsMode = mode;
                panel.querySelector('.destinations-header h2').innerHTML =
                    mode === 'danger' ? '🚨 Danger Zones' :
                mode === 'enemy' ? '📍 Locations' :
                '🌍 Destinations';
                try {
                    await loadDestinations(content, apiKey);
                } catch (e) {
                    console.error('Error loading destinations tab:', e);
                    content.innerHTML = '<div class="error">Error loading. Check console.</div>';
                }
            };

            toggleBtns.forEach(btn => {
                btn.addEventListener('click', () => setMode(btn.dataset.mode));
            });

            refreshBtn.addEventListener('click', async () => {
                refreshBtn.disabled = true;
                refreshBtn.innerHTML = '⏳ Loading...';
                await setMode(currentDestinationsMode);
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '🔄 Refresh';
            });

            await setMode('safe'); // default tab
        }

        async function loadDestinations(content, apiKey) {
            content.innerHTML = '<div class="loading">Loading...</div>';

            if (currentDestinationsMode === 'danger') {
                await loadDangerZones(content, apiKey);
                return;
            }

            if (currentDestinationsMode === 'safe') {
    // Unoccupied tab – shows safe (unoccupied) countries
    try {
        const factionId = getFactionIdFromContext();
        if (!factionId) throw new Error('No faction detected. Open from a faction profile or war page.');

        const [userLocation, members] = await Promise.all([
            getUserLocation(apiKey),
            fetchFactionMembers(factionId, apiKey)
        ]);

        const groups = groupMembersByDestination(members);
        renderDestinationsPanel(content, groups, 'safe', userLocation, false);
    } catch (err) {
        content.innerHTML = `<div class="error">${err.message}</div>`;
    }
    return;
}

// Locations tab – the faction whose page we're viewing
let factionId = getFactionIdFromContext();

if (!factionId) {
    content.innerHTML = '<div class="error">No faction detected.</div>';
    return;
}

try {
    const [userLocation, members] = await Promise.all([
        getUserLocation(apiKey),
        fetchFactionMembers(factionId, apiKey)
    ]);

    const groups = groupMembersByDestination(members);
    const isOwnFaction = (userFactionId && userFactionId == factionId);
    renderDestinationsPanel(content, groups, 'enemy', userLocation, isOwnFaction);
} catch (err) {
    content.innerHTML = `<div class="error">${err.message}</div>`;
}
        }

        async function loadDangerZones(content, apiKey) {
            // --- Determine faction IDs without breaking ---
            let yourFactionId = null;
            let enemyFactionId = null;

            // Method 1: from war page DOM (existing function in script)
            try {
                const ids = getWarFactionIds();
                if (ids && ids.yourFactionId && ids.enemyFactionId) {
                    yourFactionId = ids.yourFactionId;
                    enemyFactionId = ids.enemyFactionId;
                }
            } catch (e) { /* quiet */ }

            // Method 2: if that failed, try the page's torn-data (your ID only)
            if (!yourFactionId) {
                try {
                    const tornEl = document.getElementById('torn-data');
                    if (tornEl) {
                        const data = JSON.parse(tornEl.textContent);
                        yourFactionId = data?.user?.faction?.faction_id || null;
                    }
                } catch (e) {}
            }

            // If still no yourFactionId, try API (user's own profile)
            if (!yourFactionId) {
                try {
                    const ufid = await fetchUserFactionId(apiKey);
                    if (ufid) yourFactionId = ufid;
                } catch (e) {}
            }

            // If we can't find enemy ID, we can't do danger zones
            if (!enemyFactionId) {
                content.innerHTML = '<div class="error">Enemy faction not detected. Open this tab while on a ranked‑war page.</div>';
                return;
            }
            if (!yourFactionId) {
                content.innerHTML = '<div class="error">Your faction ID could not be determined.</div>';
                return;
            }

            // Fetch both faction members
            let ownMembers, enemyMembers;
            try {
                [ownMembers, enemyMembers] = await Promise.all([
                    fetchFactionMembers(yourFactionId, apiKey),
                    fetchFactionMembers(enemyFactionId, apiKey)
                ]);
            } catch (err) {
                content.innerHTML = `<div class="error">Failed to fetch members: ${err.message}</div>`;
                return;
            }

            if (!ownMembers || !enemyMembers) {
                content.innerHTML = '<div class="error">No member data received.</div>';
                return;
            }

            // -------- Fetch enemy FF/BS data from API ----------
            const allEnemyIds = enemyMembers.map(m => m.id).filter(Boolean);
            const uniqueEnemyIds = [...new Set(allEnemyIds)];

            if (uniqueEnemyIds.length > 0) {
                content.innerHTML = '<div class="loading">Fetching enemy stats...</div>';
                await new Promise((resolve) => {
                    update_ff_cache(uniqueEnemyIds, () => {
                        resolve();
                    });
                });
            }
            // ----------------------------------------------------

            // Build location maps (uses the helper defined below)
            const ownMap = buildMemberLocationMap(ownMembers);
            const enemyMap = buildMemberLocationMap(enemyMembers);

            // Find overlapping countries
            const dangerZones = {};
            for (const [country, own] of Object.entries(ownMap)) {
                if (!enemyMap[country]) continue;
                const enemy = enemyMap[country];
                const hasOwn = own.present.length + own.traveling.length > 0;
                const hasEnemy = enemy.present.length + enemy.traveling.length > 0;
                if (hasOwn && hasEnemy) {
                    dangerZones[country] = {
                        country,
                        friendlyPresent: own.present,
                        friendlyTraveling: own.traveling,
                        enemyPresent: enemy.present,
                        enemyTraveling: enemy.traveling
                    };
                }
            }

            const sortedKeys = Object.keys(dangerZones).sort((a, b) => a.localeCompare(b));
            if (!sortedKeys.length) {
                content.innerHTML = '<div class="no-data">No danger zones detected.</div>';
                return;
            }

            // Render
            content.innerHTML = '';
            sortedKeys.forEach(country => {
                const zone = dangerZones[country];
                const flagUrl = getFlagUrl(country);
                const flagHtml = flagUrl
                ? `<img src="${flagUrl}" style="width:18px;height:12px;vertical-align:middle;margin-right:4px;">`
            : (COUNTRY_FLAG_MAP?.[country] || '🌍'); // safe fallback

                const group = document.createElement('div');
                group.className = 'destination-group';
                group.innerHTML = `
            <div class="group-header">
                <span class="group-name">AT RISK ${flagHtml} ${country}</span>
                <span class="collapse-icon">▼</span>
            </div>
            <div class="group-members"></div>
        `;
                const membersDiv = group.querySelector('.group-members');

                // Friendly members (present + traveling) sorted by BS descent
                const friendly = [...zone.friendlyPresent.map(m => ({...m, type:'present'})),
                                  ...zone.friendlyTraveling.map(m => ({...m, type:'traveling'}))];
                friendly.sort((a,b) => (b.bs||0) - (a.bs||0));
                friendly.forEach(m => {
                    const icon = m.type === 'present' ? '📍' : '→';
                    const item = document.createElement('div');
                    item.className = 'member-item';
                    const onlineCircle = m.status === 'Online' ? '🟢' : (m.status === 'Idle' ? '🟡' : '⚫');
                    item.innerHTML = `${icon} ${onlineCircle} ${m.name} (≈ ${m.bsHuman || 'N/A'})`;
                    membersDiv.appendChild(item);
                });

                // Enemy present
                if (zone.enemyPresent.length) {
                    const present = [...zone.enemyPresent].sort((a,b) => (b.bs||0)-(a.bs||0));
                    const header = document.createElement('div');
                    header.className = 'member-item';
                    header.style.fontWeight = 'bold';
                    header.textContent = `⚔️ Present (${present.length})`;
                    membersDiv.appendChild(header);
                    present.forEach(m => {
                        const item = document.createElement('div');
                        item.className = 'member-item';
                        const onlineCircle = m.status === 'Online' ? '🔴' : (m.status === 'Idle' ? '🟡' : '⚫');
                        item.innerHTML = `${onlineCircle} ${m.name} (≈ ${m.bsHuman || 'N/A'})`;
                        membersDiv.appendChild(item);
                    });
                }

                // Enemy inbound
                if (zone.enemyTraveling.length) {
                    const inbound = [...zone.enemyTraveling].sort((a,b) => (b.bs||0)-(a.bs||0));
                    const header = document.createElement('div');
                    header.className = 'member-item';
                    header.style.fontWeight = 'bold';
                    header.textContent = `✈️ Inbound (${inbound.length})`;
                    membersDiv.appendChild(header);
                    inbound.forEach(m => {
                        const item = document.createElement('div');
                        item.className = 'member-item';
                        const onlineCircle = m.status === 'Online' ? '🔴' : (m.status === 'Idle' ? '🟡' : '⚫');
                        item.innerHTML = `${onlineCircle} ${m.name} (≈ ${m.bsHuman || 'N/A'})`;
                        membersDiv.appendChild(item);
                    });
                }

                group.querySelector('.group-header').addEventListener('click', (e) => {
                    e.stopPropagation();
                    group.classList.toggle('collapsed');
                    const icon = group.querySelector('.collapse-icon');
                    icon.textContent = group.classList.contains('collapsed') ? '▶' : '▼';
                });

                content.appendChild(group);
            });
        }

        function buildMemberLocationMap(members) {
            const map = {}; // country -> { present: [...], traveling: [...] }

            members.forEach(member => {
                if (!member || !member.status) return;
                const status = member.status;
                let country = null;
                let type = null; // 'present' = abroad, 'traveling' = heading there

                if (status.state === 'Abroad') {
                    const parsed = extractCountryFromDescription(status.description);
                    country = parsed?.location || null;
                    if (country) type = 'present';
                } else if (status.state === 'Traveling') {
                    const parsed = extractCountryFromDescription(status.description);
                    if (parsed && parsed.from && parsed.to) {
                        if (parsed.from === 'Torn' || parsed.from === 'Torn City') {
                            country = parsed.to;
                            type = 'traveling';
                        } else if (parsed.to === 'Torn' || parsed.to === 'Torn City') {
                            // returning home – ignore for danger zone (they are coming back)
                            country = null;
                        } else {
                            // neither Torn, assume heading to 'to'
                            country = parsed.to;
                            type = 'traveling';
                        }
                    } else {
                        // legacy
                        if (status.description.includes('Traveling to ')) {
                            country = status.description.replace('Traveling to ', '').trim();
                            type = 'traveling';
                        }
                    }
                }

                if (country && type) {
                    country = standardizeCountryName(country);
                    if (!map[country]) map[country] = { present: [], traveling: [] };

                    // Retrieve BS estimate
                    const ffResponse = get_fair_fight_response(member.id);
                    const bsValue = ffResponse?.bs_estimate || 0;
                    const bsHuman = ffResponse?.bs_estimate_human || (ffResponse?.bs_estimate ? formatBattleStats(ffResponse.bs_estimate) : 'N/A');

                    map[country][type].push({
                        name: member.name,
                        id: member.id,
                        bs: bsValue,
                        bsHuman: bsHuman,
                        status: member.last_action?.status || 'Offline'
                    });
                }
            });

            return map;
        }

        function renderSharedMemberStatus(row, member, options = {}) {
            if (!row || !member || !member.status) return;

            const statusEl = row.querySelector('.status');
            if (!statusEl) return;

            const showAttackButton = options.showAttackButton === true;

            statusEl.classList.remove(
                'faction-status-okay',
                'faction-status-hospital',
                'faction-status-traveling',
                'faction-status-abroad',
                'faction-status-jail'
            );

            let statusText = '';
            let statusClass = '';
            let untilTime = 0;
            let isAbroad = false;
            let destination = '';

            switch (member.status.state) {
                case "Okay":
                    statusText = "Okay";
                    statusClass = 'faction-status-okay';
                    break;

                case "Traveling": {
                    const description = member.status.description || '';
                    console.log('[FF] Traveling description:', description); // optional debug
                    let location = '';
                    let isReturning = false;

                    const parsed = extractCountryFromDescription(description);
                    if (parsed && parsed.from && parsed.to) {
                        if (parsed.from === 'Torn' || parsed.from === 'Torn City') {
                            // Traveling from Torn -> outgoing
                            isReturning = false;
                            location = parsed.to;
                        } else if (parsed.to === 'Torn' || parsed.to === 'Torn City') {
                            // Traveling to Torn -> returning
                            isReturning = true;
                            location = parsed.from;
                        } else {
                            // Neither Torn? Fallback: treat as outgoing to "to"
                            isReturning = false;
                            location = parsed.to;
                        }
                    } else if (parsed && parsed.location) {
                        // Abroad case (shouldn't happen in Traveling, but safe)
                        location = parsed.location;
                        isReturning = false;
                    } else {
                        // Fallback: try legacy extraction
                        if (description.includes("Traveling to ")) {
                            location = description.replace("Traveling to ", "").trim();
                            isReturning = false;
                        } else if (description.includes("Returning to Torn from ")) {
                            location = description.replace("Returning to Torn from ", "").trim();
                            isReturning = true;
                        } else {
                            // Last resort: try to find any country name
                            const words = description.split(' ');
                            for (let word of words) {
                                if (word.length > 2 && word[0] === word[0].toUpperCase()) {
                                    location = word;
                                    break;
                                }
                            }
                        }
                    }

                    if (!location) location = 'Unknown';
                    destination = standardizeCountryName(location);
                    const abbr = abbreviateCountry(location);

                    statusText = isReturning
                        ? `${tornSymbol} ${createPlaneSvg(true)} ${abbr}`
        : `${tornSymbol} ${createPlaneSvg(false)} ${abbr}`;
                    statusClass = 'faction-status-traveling';

                    if (member.status.until) {
                        untilTime = parseInt(member.status.until, 10) * 1000;
                    }
                    break;
                }

                case "Abroad": {
                    const description = member.status.description || '';
                    let location = '';

                    if (description.startsWith("In ")) {
                        location = description.replace("In ", "").trim();
                        const abbr = abbreviateCountry(location);
                        statusText = `🌏 ${abbr}`;
                        destination = standardizeCountryName(location);
                    } else {
                        statusText = "Abroad";
                    }

                    statusClass = 'faction-status-abroad';
                    break;
                }

                case "Hospital": {
                    statusClass = 'faction-status-hospital';

                    if (member.status.description) {
                        const descLower = member.status.description.toLowerCase();

                        const countryMap = {
                            'canadian': 'Canada',
                            'canada': 'Canada',
                            'cayman': 'Cayman Islands',
                            'cayman islands': 'Cayman Islands',
                            'mexican': 'Mexico',
                            'mexico': 'Mexico',
                            'argentine': 'Argentina',
                            'argentina': 'Argentina',
                            'uk': 'UK',
                            'british': 'UK',
                            'united kingdom': 'UK',
                            'hawaiian': 'Hawaii',
                            'hawaii': 'Hawaii',
                            'swiss': 'Switzerland',
                            'switzerland': 'Switzerland',
                            'south african': 'South Africa',
                            'south africa': 'South Africa',
                            'chinese': 'China',
                            'china': 'China',
                            'japanese': 'Japan',
                            'japan': 'Japan',
                            'emirati': 'UAE',
                            'uae': 'UAE',
                            'united arab emirates': 'UAE'
                        };

                        for (const [key, full] of Object.entries(countryMap)) {
                            if (descLower.includes(key)) {
                                isAbroad = true;
                                destination = standardizeCountryName(full);
                                break;
                            }
                        }
                    }

                    if (member.status.until) {
                        untilTime = parseInt(member.status.until, 10) * 1000;
                    }

                    statusText = '';
                    break;
                }

                case "Jail":
                    statusClass = 'faction-status-jail';

                    if (member.status.until) {
                        untilTime = parseInt(member.status.until, 10) * 1000;
                    }

                    break;

                default:
                    statusText = member.status.state || '';
                    statusClass = '';
            }

            if (untilTime > 0) {
                memberCountdowns[member.id] = untilTime;
            } else {
                delete memberCountdowns[member.id];
            }

            let countdownText = '';
            if (untilTime > 0) {
                const remaining = untilTime - Date.now();
                countdownText = remaining > 0 ? formatTime(remaining) : '00:00:00';
            }

            statusEl.classList.add(statusClass);

            let statusHTML = `
        <div class="faction-profile-status ${statusClass}" style="position: relative; display: flex; align-items: center; width: 100%;">
    `;

            if (showAttackButton) {
                statusHTML += `
            <a href="https://www.torn.com/loader.php?sid=attack&user2ID=${member.id}" target="_blank" class="status-attack-btn">⚔️</a>
        `;
            }

            statusHTML += `
            <div class="status-text-container">
    `;

            if (statusText) {
                statusHTML += `<span class="status-text">${statusText}</span>`;
            }

            if (countdownText) {
                statusHTML += `<span class="faction-status-countdown">${countdownText}</span>`;
            }

            statusHTML += `
            </div>
`;

            if (member.status.state === "Hospital" && isAbroad) {
                statusHTML += `<span class="hospital-abroad-icon">🌏</span>`;
            }

            statusHTML += `
        </div>
`;

            statusEl.innerHTML = statusHTML;

            row.dataset.destination = destination || '';
            row.dataset.lastAction = member.last_action?.timestamp ? String(member.last_action.timestamp * 1000) : '0';
        }

        function updateFactionProfileMemberStatus(li, member, isFactionProfilePage) {
            if (!member || !member.status) return;

            renderSharedMemberStatus(li, member, {
                showAttackButton: true
            });

            if (isFactionProfilePage) {
                createOrUpdateExtraInfoRow(li, member);
            }
        }

        function createOrUpdateExtraInfoRow(li, member) {
            let extraRow = li.nextElementSibling;
            if (extraRow && extraRow.classList.contains('ff-scouter-extra-row')) {
                updateExtraInfoRowContent(extraRow, member);
            } else {
                createExtraInfoRow(li, member);
            }
        }

        function createExtraInfoRow(li, member) {
            const extraRow = document.createElement('li');
            extraRow.className = 'ff-scouter-extra-row';

            const profileLink = li.querySelector('a[href*="profiles.php?XID="]');
            if (profileLink) {
                const match = profileLink.href.match(/XID=(\d+)/);
                if (match) extraRow.dataset.userId = match[1];
            }

            li.dataset.ffScouterExtra = 'true';

            const extraContent = document.createElement('div');
            extraContent.className = 'ff-scouter-extra-content';

            let playerId = getPlayerIdFromRow(li);
            let ffValue = 'N/A';
            let ffColor = '#000';
            if (playerId) {
                const ffResponse = get_fair_fight_response(playerId);
                if (ffResponse && !ffResponse.no_data) {
                    ffValue = formatFFForExtraRow(ffResponse.value);
                    ffColor = get_ff_colour(ffResponse.value);
                }
            }

            let lastActionText = 'Last action: N/A';
            if (member.last_action && member.last_action.relative) {
                lastActionText = `Last action: ${member.last_action.relative}`;
            }

            extraContent.innerHTML = `
                <div class="ff-scouter-last-action">${lastActionText}</div>
                <div class="ff-scouter-ff-right">
                    FF: <span class="ff-scouter-ff-value" style="color: ${ffColor}">${ffValue}</span>
                </div>
            `;

            extraRow.appendChild(extraContent);
            li.parentNode.insertBefore(extraRow, li.nextSibling);
        }

        function updateExtraInfoRowContent(extraRow, member) {
            const lastActionDiv = extraRow.querySelector('.ff-scouter-last-action');
            if (lastActionDiv) {
                lastActionDiv.textContent = member.last_action?.relative ? `Last action: ${member.last_action.relative}` : 'Last action: N/A';
            }
        }

        function updateExtraInfoRowStats() {
            const isProfileOrMainFaction = window.location.href.match(/factions\.php\?step=profile&ID=\d+/) ||
                  (window.location.href.includes('factions.php?step=your') && !window.location.hash.includes('/war/rank'));
            if (!isProfileOrMainFaction) return;

            document.querySelectorAll('.ff-scouter-extra-row').forEach(extraRow => {
                const li = extraRow.previousElementSibling;
                if (!li || !li.classList.contains('table-row')) return;

                const playerId = getPlayerIdFromRow(li);
                if (!playerId) return;

                const ffResponse = get_fair_fight_response(playerId);
                if (ffResponse && !ffResponse.no_data) {
                    const ffSpan = extraRow.querySelector('.ff-scouter-ff-value');
                    if (ffSpan) {
                        ffSpan.innerHTML = formatFFForExtraRow(ffResponse.value);
                        ffSpan.style.color = get_ff_colour(ffResponse.value);
                    }
                }
            });
        }

        function fixExtraRowsAfterFilter() {
            const isProfileOrMainFaction = window.location.href.match(/factions\.php\?step=profile&ID=\d+/) ||
                  (window.location.href.includes('factions.php?step=your') && !window.location.hash.includes('/war/rank'));
            if (!isProfileOrMainFaction) return;

            const tableBody = document.querySelector('.table-body');
            if (!tableBody) return;

            const mainRows = Array.from(tableBody.querySelectorAll('.table-row[data-ff-scouter-extra]'));
            const extraRows = Array.from(tableBody.querySelectorAll('.ff-scouter-extra-row'));

            const extraRowMap = new Map();
            extraRows.forEach(extraRow => {
                if (extraRow.dataset.userId) extraRowMap.set(extraRow.dataset.userId, extraRow);
            });

            mainRows.forEach(mainRow => {
                const userId = getPlayerIdFromRow(mainRow);
                if (!userId) return;
                const extraRow = extraRowMap.get(userId);
                if (!extraRow) return;
                if (extraRow.previousElementSibling !== mainRow) {
                    extraRow.remove();
                    mainRow.parentNode.insertBefore(extraRow, mainRow.nextSibling);
                }
            });
        }

        function updateFactionProfileStatuses(factionID) {
            if (!key) return;

            fetchFactionData(factionID)
                .then(data => {
                if (!Array.isArray(data.members)) {
                    console.warn(`No members array for faction ${factionID}`);
                    return;
                }

                const memberMap = {};
                data.members.forEach(member => {
                    memberMap[member.id] = member;
                });

                document.querySelectorAll(".table-body > .table-row").forEach(row => {
                    const userID = getPlayerIdFromRow(row);
                    if (!userID) return;
                    updateFactionProfileMemberStatus(row, memberMap[userID], true);
                });

                updateExtraInfoRowStats();
                fixExtraRowsAfterFilter();
                scheduleProfileSort(120);
            })
                .catch(err => {
                console.error("Error fetching faction data for profile", err);
            });
        }

        function updateFactionProfileTimers() {
            const isProfileOrMainFaction = window.location.href.match(/factions\.php\?step=profile&ID=\d+/) ||
                  (window.location.href.includes('factions.php?step=your') && !window.location.hash.includes('/war/rank'));
            if (!isProfileOrMainFaction) return;

            document.querySelectorAll('.table-body > .table-row').forEach(row => {
                let userID = getPlayerIdFromRow(row);
                if (!userID) return;
                let statusEl = row.querySelector('.status');
                if (!statusEl) return;
                if (memberCountdowns[userID]) {
                    let remaining = memberCountdowns[userID] - Date.now();
                    const countdownEl = statusEl.querySelector('.faction-status-countdown');
                    if (countdownEl) countdownEl.textContent = remaining > 0 ? formatTime(remaining) : "00:00:00";
                }
            });
        }

        function initFactionProfileStatus() {
            const profileMatch = window.location.href.match(/factions\.php\?step=profile&ID=(\d+)/);
            if (!profileMatch) return false;

            const factionID = profileMatch[1];
            const memberTable = document.querySelector(".table-body");
            if (!memberTable) return false;

            const pageKey = `profile:${factionID}`;

            if (currentProfilePageKey === pageKey && document.body.contains(memberTable)) {
                return true;
            }

            cleanupProfilePage();
            currentProfilePageKey = pageKey;

            createSortPanel();
            seedProfileOriginalOrderMap();
            setupProfileSortObserver();

            const playerIds = [];
            document.querySelectorAll(".table-body > .table-row").forEach(row => {
                const playerId = getPlayerIdFromRow(row);
                if (playerId) playerIds.push(playerId);
            });

            if (playerIds.length > 0) {
                update_ff_cache(playerIds, () => {
                    updateFactionProfileStatuses(factionID);
                    updateExtraInfoRowStats();
                });
            } else {
                updateFactionProfileStatuses(factionID);
            }

            setExtraRowsVisibility(showExtraRows);

            profileStatusInterval = setInterval(() => updateFactionProfileStatuses(factionID), API_INTERVAL);
            profileTimerInterval = setInterval(updateFactionProfileTimers, 1000);

            return true;
        }

        function initMainFactionPage() {
            if (!(window.location.href.includes('factions.php?step=your') && !window.location.hash.includes('/war/rank'))) {
                return false;
            }

            const memberTable = document.querySelector(".table-body");
            if (!memberTable) return false;

            const pageKey = 'main-faction';

            if (currentMainFactionPageKey === pageKey && document.body.contains(memberTable)) {
                return true;
            }

            cleanupMainFactionPage();
            currentMainFactionPageKey = pageKey;

            fetchUserFactionId(key).then(userFactionId => {
                if (!userFactionId) {
                    console.warn("Could not fetch own faction ID");
                    return;
                }

                createSortPanel();
                seedProfileOriginalOrderMap();
                setupProfileSortObserver();

                const playerIds = [];
                document.querySelectorAll(".table-body > .table-row").forEach(row => {
                    const playerId = getPlayerIdFromRow(row);
                    if (playerId) playerIds.push(playerId);
                });

                if (playerIds.length > 0) {
                    update_ff_cache(playerIds, () => {
                        updateFactionProfileStatuses(userFactionId);
                        updateExtraInfoRowStats();
                    });
                } else {
                    updateFactionProfileStatuses(userFactionId);
                }

                setExtraRowsVisibility(showExtraRows);

                mainFactionStatusInterval = setInterval(() => updateFactionProfileStatuses(userFactionId), API_INTERVAL);
                mainFactionTimerInterval = setInterval(updateFactionProfileTimers, 1000);
            });

            return true;
        }

        function updateMemberStatus(li, member) {
            if (!member || !member.status) return;

            renderSharedMemberStatus(li, member, {
                showAttackButton: false
            });

            let lastActionRow = li.querySelector('.last-action-row');
            const lastActionText = member.last_action?.relative || '';

            if (lastActionRow) {
                lastActionRow.textContent = `Last Action: ${lastActionText}`;
            } else {
                lastActionRow = document.createElement('div');
                lastActionRow.className = 'last-action-row';
                lastActionRow.textContent = `Last Action: ${lastActionText}`;

                const lastDiv = Array.from(li.children).reverse().find(el => el.tagName === 'DIV');

                if (lastDiv?.nextSibling) {
                    li.insertBefore(lastActionRow, lastDiv.nextSibling);
                } else {
                    li.appendChild(lastActionRow);
                }
            }
        }

        function updateFactionStatuses(factionID, container) {
            apiCallInProgressCount++;
            fetchFactionData(factionID)
                .then(data => {
                if (!Array.isArray(data.members)) {
                    console.warn(`No members array for faction ${factionID}`);
                    return;
                }

                const memberMap = {};
                data.members.forEach(member => {
                    memberMap[member.id] = member;
                });

                container.querySelectorAll("li").forEach(li => {
                    let userID = getPlayerIdFromRow(li);
                    if (!userID) return;
                    updateMemberStatus(li, memberMap[userID]);
                });

                scheduleWarSort(120);
            })
                .catch(err => {
                console.error("Error fetching faction data for faction", factionID, err);
            })
                .finally(() => {
                apiCallInProgressCount--;
            });
        }

        function updateAllMemberTimers() {
            const rows = document.querySelectorAll(
                ".enemy-faction .members-list li, .your-faction .members-list li, .table-body > .table-row"
            );

            rows.forEach(row => {
                const userID = getPlayerIdFromRow(row);
                if (!userID) return;

                const statusEl = row.querySelector('.status');
                if (!statusEl) return;

                if (memberCountdowns[userID]) {
                    let remaining = memberCountdowns[userID] - Date.now();
                    if (remaining < 0) remaining = 0;

                    const countdownEl = statusEl.querySelector('.faction-status-countdown');

                    if (countdownEl) {
                        countdownEl.textContent = formatTime(remaining);
                    }
                }
            });
        }

        function getFactionIdFromElement(el) {
            if (!el) return null;

            const directHref = el.href || el.getAttribute?.('href') || '';
            let match = directHref.match(/ID=(\d+)/);
            if (match) return match[1];

            const link = el.querySelector?.('a[href*="factions.php"][href*="ID="]');
            if (link) {
                match = link.href.match(/ID=(\d+)/);
                if (match) return match[1];
            }

            return null;
        }

        // --- Reliable page-data faction ID extraction (no API needed) ---

        function getUserFactionIdFromPage() {
            const tornDataEl = document.getElementById('torn-data');
            if (!tornDataEl) return null;

            try {
                const data = JSON.parse(tornDataEl.textContent);
                // Path: user.faction.faction_id
                return data?.user?.faction?.faction_id || null;
            } catch (e) {
                console.warn('Could not parse torn-data JSON', e);
                return null;
            }
        }

        function getEnemyFromRankedWarPage(yourFactionId) {
            if (!yourFactionId) return null;

            // Torn often defines this directly.
            if (window.__RAW_DATA__?.factions && Array.isArray(window.__RAW_DATA__.factions)) {
                const factions = window.__RAW_DATA__.factions;
                const enemy = factions.find(f => f.id !== yourFactionId);
                return enemy?.id || null;
            }

            // Alternative: sometimes the data is in a script tag
            const scripts = document.querySelectorAll('script:not([src])');
            for (const script of scripts) {
                const match = script.textContent.match(/window\.__RAW_DATA__\s*=\s*(\{.+?\});/s);
                if (match) {
                    try {
                        const data = JSON.parse(match[1]);
                        const enemy = data.factions?.find(f => f.id !== yourFactionId);
                        if (enemy) return enemy.id;
                    } catch {}
                }
            }
            return null;
        }

        function getWarFactionIds() {
            let enemyFactionId = null;
            let yourFactionId = null;

            const enemyFactionLink =
                  document.querySelector(".opponentFactionName___vhESM") ||
                  document.querySelector(".enemy-faction a[href*='factions.php'][href*='ID=']") ||
                  document.querySelector("[class*='opponentFactionName']");

            const yourFactionLink =
                  document.querySelector(".currentFactionName___eq7n8") ||
                  document.querySelector(".your-faction a[href*='factions.php'][href*='ID=']") ||
                  document.querySelector("[class*='currentFactionName']");

            enemyFactionId = getFactionIdFromElement(enemyFactionLink);
            yourFactionId = getFactionIdFromElement(yourFactionLink);

            return {
                enemyFactionId,
                yourFactionId
            };
        }

        function updateAPICalls() {
            const enemyList = document.querySelector(".enemy-faction .members-list");
            const yourList = document.querySelector(".your-faction .members-list");

            if (!enemyList || !yourList) return;

            const ids = getWarFactionIds();

            if (!ids.enemyFactionId || !ids.yourFactionId) {
                console.warn("FF Scouter: Could not detect war faction IDs", ids);
                return;
            }

            updateFactionStatuses(ids.enemyFactionId, enemyList);
            updateFactionStatuses(ids.yourFactionId, yourList);
        }

        function isWarDomReady() {
            return !!(
                document.querySelector(".enemy-faction .members-list") &&
                document.querySelector(".your-faction .members-list")
            );
        }

        function initWarScript() {
            const enemyList = document.querySelector(".enemy-faction .members-list");
            const yourList = document.querySelector(".your-faction .members-list");

            if (!enemyList || !yourList) return false;

            const ids = getWarFactionIds();
            const enemyId = ids.enemyFactionId || 'enemy';
            const yourId = ids.yourFactionId || 'your';

            const pageKey = `war:${yourId}:${enemyId}`;

            if (
                currentWarPageKey === pageKey &&
                document.body.contains(enemyList) &&
                document.body.contains(yourList)
            ) {
                updateAPICalls();
                return true;
            }

            cleanupWarPage();
            currentWarPageKey = pageKey;

            createSortPanel();

            seedWarOriginalOrderMap(yourList, 'your');
            seedWarOriginalOrderMap(enemyList, 'enemy');

            setupWarSortObservers();

            const savedWarSort = GM_getValue('ff_scouter_sort_mode_war', 'none');
            if (savedWarSort !== 'none') {
                warSortMode = savedWarSort;
                setTimeout(() => {
                    applyWarSort(savedWarSort);
                    highlightActiveSortOption();
                }, 300);
            }

            updateAPICalls();

            if (warStatusInterval) clearInterval(warStatusInterval);
            warStatusInterval = setInterval(updateAPICalls, API_INTERVAL);

            console.log("FF Scouter: War page initialized successfully", pageKey);

            return true;
        }

        function reconcilePageState() {
            const isProfile = /factions\.php\?step=profile&ID=\d+/.test(window.location.href);
            const isMainFaction = window.location.href.includes('factions.php?step=your') && !window.location.hash.includes('/war/rank');
            const isWar = isWarDomReady();

            if (!isProfile && currentProfilePageKey) {
                cleanupProfilePage();
                currentProfilePageKey = '';
            }

            if (!isMainFaction && currentMainFactionPageKey) {
                cleanupMainFactionPage();
                currentMainFactionPageKey = '';
            }

            if (!isWar && currentWarPageKey) {
                cleanupWarPage();
                currentWarPageKey = '';
            }

            if (isProfile) initFactionProfileStatus();
            if (isMainFaction) initMainFactionPage();
            if (isWar) initWarScript();

            if (location.href !== lastKnownPageUrl) {
                lastKnownPageUrl = location.href;
                ensureInfoLineMounted();
                bootstrapCurrentPageFF(true);
            } else if (getProfileTargetIdFromUrl()) {
                if (!info_line || !document.body.contains(info_line)) {
                    ensureInfoLineMounted();
                    bootstrapCurrentPageFF();
                }
            }
        }

        setInterval(() => {
            if (isAttackPage()) return;
            reconcilePageState();
        }, 1000);
        setInterval(updateAllMemberTimers, 1000);

        function showToast(message) {
            const existing = document.getElementById('ffscouter-toast');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.id = 'ffscouter-toast';
            toast.style.position = 'fixed';
            toast.style.bottom = '30px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.background = '#c62828';
            toast.style.color = '#fff';
            toast.style.padding = '8px 16px';
            toast.style.borderRadius = '8px';
            toast.style.fontSize = '14px';
            toast.style.boxShadow = '0 2px 12px rgba(0,0,0,0.2)';
            toast.style.zIndex = '2147483647';
            toast.style.opacity = '1';
            toast.style.transition = 'opacity 0.5s';
            toast.style.display = 'flex';
            toast.style.alignItems = 'center';
            toast.style.gap = '10px';

            const closeBtn = document.createElement('span');
            closeBtn.textContent = '×';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.marginLeft = '8px';
            closeBtn.style.fontWeight = 'bold';
            closeBtn.style.fontSize = '18px';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.onclick = () => toast.remove();

            const msg = document.createElement('span');
            if (message === 'Invalid API key. Please sign up at ffscouter.com to use this service') {
                msg.innerHTML = 'FairFight Scouter: Invalid API key. Please sign up at <a href="https://ffscouter.com" target="_blank" style="color: #fff; text-decoration: underline; font-weight: bold;">ffscouter.com</a> to use this service';
            } else {
                msg.textContent = `FairFight Scouter: ${message}`;
            }

            toast.appendChild(msg);
            toast.appendChild(closeBtn);
            document.body.appendChild(toast);

            setTimeout(() => {
                if (toast.parentNode) {
                    toast.style.opacity = '0';
                    setTimeout(() => toast.remove(), 500);
                }
            }, 4000);
        }

        function removeDaysColumn() {
            const isProfileOrMainFaction = window.location.href.includes("factions.php?step=profile") ||
                  (window.location.href.includes("factions.php?step=your") && !window.location.hash.includes('/war/rank'));
            if (!isProfileOrMainFaction) return;
            document.querySelectorAll('.table-header .table-cell.days').forEach(el => el.remove());
            document.querySelectorAll('.table-row .table-cell.days').forEach(el => el.remove());
        }

        if (window.location.href.includes("factions.php?step=profile") ||
            (window.location.href.includes("factions.php?step=your") && !window.location.hash.includes('/war/rank'))) {
            setTimeout(removeDaysColumn, 500);
            const daysObserver = new MutationObserver(() => {
                setTimeout(removeDaysColumn, 100);
            });
            daysObserver.observe(document.body, { childList: true, subtree: true });
        }

        function enlargeStartFightButton() {
            const buttons = Array.from(document.querySelectorAll('button.torn-btn.silver'));
            const btn = buttons.find(b => b.textContent.trim() === 'Start fight');
            if (!btn) return;

            btn.style.fontSize = '34px';
            btn.style.padding = '18px 24px';
            btn.style.minWidth = '280px';
            btn.style.minHeight = '110px';
            btn.style.position = 'relative';
            btn.style.zIndex = '100000';
        }

        const ffWarDomObserver = new MutationObserver(() => {
            if (isAttackPage()) return;

            if (isWarDomReady()) {
                initWarScript();
            }
        });

        ffWarDomObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        function moveAttackModalLowerOnMobile() {
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            const modal = document.querySelector('.modal___lMj6N.defender___niX1M');
            if (!modal) return;

            if (!isMobile) {
                modal.style.alignItems = '';
                modal.style.justifyContent = '';
                modal.style.paddingTop = '';
                modal.style.paddingBottom = '';
                return;
            }

            modal.style.alignItems = 'flex-end';
            modal.style.justifyContent = 'center';
            modal.style.paddingTop = '0';
            modal.style.paddingBottom = '0px';
        }

        function styleStartFightArea() {
            enlargeStartFightButton();
            moveAttackModalLowerOnMobile();
        }

        styleStartFightArea();

        const startFightObserver = new MutationObserver(() => {
            if (!isAttackPage()) return;
            styleStartFightArea();
        });
        startFightObserver.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('resize', styleStartFightArea);
    }
})();
