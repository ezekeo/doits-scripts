// ==UserScript==
// @name         DoitsBurgers FF Scouter
// @namespace    https://github.com/doitsburger/doits-scripts
// @version      1.0.0
// @description  Scouter tool for FF and BS Estimates on Torn. Added last action row also displaying FF and quick attack button.
// @author       rDacted, Weav3r, GFOUR - modded by Doitsburger
// @match        https://www.torn.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @updateURL    https://raw.githubusercontent.com/ezekeo/doits-scripts/main/ff-scouter/doitsburgers-ff-scouter.user.js
// @downloadURL  https://raw.githubusercontent.com/ezekeo/doits-scripts/main/ff-scouter/doitsburgers-ff-scouter.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';
    
    // Check if API key exists and prompt if not
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
})();

// Icon definitions
const tornSymbol = `<svg class="torn-symbol" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="12" y="16" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="14" fill="currentColor">T</text>
</svg>`;

function createPlaneSvg(isReturning) {
    return `<svg class="plane-svg ${isReturning ? 'returning' : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
        <path d="M482.3 192c34.2 0 93.7 29 93.7 64c0 36-59.5 64-93.7 64l-116.6 0L265.2 495.9c-5.7 10-16.3 16.1-27.8 16.1l-56.2 0c-10.6 0-18.3-10.2-15.4-20.4l49-171.6L112 320 68.8 377.6c-3 4 0 6.4-12.8 6.4l-42 0c-7.8 0-14-6.3-14-14c0-1.3 .2-2.6 .5-3.9L32 256 .5 145.9c-.4-1.3-.5-2.6-.5-3.9c0-7.8 6.3-14 14-14l42 0c5 0 9.8 2.4 12.8 6.4L112 192l102.9 0-49-171.6C162.9 10.2 170.6 0 181.2 0l56.2 0c11.5 0 22.1 6.2 27.8 16.1L365.7 192l116.6 0z"/>
    </svg>`;
}

const FF_VERSION = 2.4;
const API_INTERVAL = 30000;
const memberCountdowns = {};
let apiCallInProgressCount = 0;

// ========== FF COLOR CONFIGURATION ==========
// Easy to adjust FF colors - modify these values to change colors
const FF_COLORS = {
    // Color ranges based on FF value
    '0-2': '#87CEEB',    // Light Blue
    '2-4': '#28c628',    // Green
    '4-5': '#AA7DCE',    // Brown
    '5+': '#c62828'      // Red
};

// ========== END COLOR CONFIGURATION ==========

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

    /* Faction Profile Status Styles */
    .table-cell.status {
        min-width: 120px;
        max-width: 200px;
        resize: horizontal;
        overflow: auto;
    }

    .faction-profile-status {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-size: 12px;
        font-weight: bold;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        width: 100%;
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
        padding: 1px 4px;
        border-radius: 3px;
        margin-left: 4px;
        min-width: 60px;
        text-align: center;
    }

    /* Extra info row for faction profile */
    .ff-scouter-extra-row {
        background-color: #353535;
        border-bottom: 1px solid #000000;
        padding: 2px 0;
        font-size: 14px;
        color: #6c757d;
        display: none; /* Hidden by default, shown with data attribute */
    }

    .table-row[data-ff-scouter-extra] + .ff-scouter-extra-row {
        display: block !important;
    }

    .ff-scouter-extra-content {
        display: flex;
        justify-content: space-between;
        padding: 0 10px;
    }

    .ff-scouter-last-action {
        font-style: italic;
    }

    .ff-scouter-stats {
        display: flex;
        gap: 10px;
        align-items: center;
    }

    .ff-scouter-ff-value {
        font-weight: bold;
    }

    .ff-scouter-attack-btn {
        font-size: 20px;
        text-decoration: none;
        padding: 0 4px;
        border-radius: 3px;
        font-weight: bold;
        cursor: pointer;
        display: inline-block;
        line-height: 1;
    }

    .ff-scouter-attack-btn:hover {
        opacity: 0.8;
    }

    /* Sort Panel Styles */
    .ff-scouter-sort-panel {
        position: fixed;
        bottom: 328px;
        right: 2px;
        z-index: 10000;
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
    bottom: 324px;
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
    /* Make torn symbol a different color (e.g., gold) */
.torn-symbol {
    fill: #FFD700 !important;
}

/* Departing plane (normal orientation) - green */
.plane-svg:not(.returning) {
    fill: #4CAF50 !important;
}

/* Returning plane (flipped) - orange/red */
.plane-svg.returning {
    fill: #FF5722 !important;
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

    // DO NOT CHANGE THIS
    // DO NOT CHANGE THIS
    var apikey = '###PDA-APIKEY###';
    // DO NOT CHANGE THIS
    // DO NOT CHANGE THIS
    if (apikey[0] != '#') {
        console.log("Adding modifications to support TornPDA");
        rD_xmlhttpRequest = function (details) {
            console.log("Attempt to make http request");
            if (details.method.toLowerCase() == "get") {
                return PDA_httpGet(details.url)
                    .then(details.onload)
                    .catch(details.onerror ?? ((e) => console.error(e)));
            }
            else if (details.method.toLowerCase() == "post") {
                return PDA_httpPost(details.url, details.headers ?? {}, details.body ?? details.data ?? "")
                    .then(details.onload)
                    .catch(details.onerror ?? ((e) => console.error(e)));
            }
            else {
                console.log("What is this? " + details.method);
            }
        }
        rD_setValue = function (name, value) {
            console.log("Attempted to set " + name);
            return localStorage.setItem(name, value);
        }
        rD_getValue = function (name, defaultValue) {
            var value = localStorage.getItem(name) ?? defaultValue;
            return value;
        }
        rD_deleteValue = function (name) {
            console.log("Attempted to delete " + name);
            return localStorage.removeItem(name);
        }
        rD_registerMenuCommand = function () {
            console.log("Disabling GM_registerMenuCommand");
        }
        rD_setValue('limited_key', apikey);
    }
    else {
        rD_xmlhttpRequest = GM_xmlhttpRequest;
        rD_setValue = GM_setValue;
        rD_getValue = GM_getValue;
        rD_deleteValue = GM_deleteValue;
        rD_registerMenuCommand = GM_registerMenuCommand;
    }

    var key = rD_getValue("limited_key", null);
    var info_line = null;

    rD_registerMenuCommand('Enter Limited API Key', () => {
        let userInput = prompt("Enter Limited API Key", rD_getValue('limited_key', ""));
        if (userInput !== null) {
            rD_setValue('limited_key', userInput);
            // Reload page
            window.location.reload();
        }
    });

    function create_text_location() {
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

        var h4 = $("h4")[0]
        if (h4.textContent === "Attacking") {
            h4.parentNode.parentNode.after(info_line);
        } else {
            const linksTopWrap = h4.parentNode.querySelector('.links-top-wrap');
            if (linksTopWrap) {
                linksTopWrap.parentNode.insertBefore(info_line, linksTopWrap.nextSibling);
            } else {
                h4.after(info_line);
            }
        }

        return info_line;
    }

    function set_message(message, error = false) {
        while (info_line.firstChild) {
            info_line.removeChild(info_line.firstChild);
        }

        const textNode = document.createTextNode(message);
        if (error) {
            info_line.style.color = "red";
        }
        else {
            info_line.style.color = "";
        }
        info_line.appendChild(textNode);
    }

    function update_ff_cache(player_ids, callback) {
        if (!key) {
            return
        }

        player_ids = [...new Set(player_ids)];

        var unknown_player_ids = get_cache_misses(player_ids)

        if (unknown_player_ids.length > 0) {
            console.log(`Refreshing cache for ${unknown_player_ids.length} ids`);

            var player_id_list = unknown_player_ids.join(",")
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
                            var one_hour = 60 * 60 * 1000;
                            var expiry = Date.now() + one_hour;
                        ff_response.forEach(result => {
                            if (result && result.player_id) {
                                // If all values are null, store a no_data flag
                                if (
                                    result.fair_fight === null &&
                                    result.bs_estimate === null &&
                                    result.bs_estimate_human === null &&
                                    result.last_updated === null
                                ) {
                                    let cacheObj = {
                                        no_data: true,
                                        expiry: expiry
                                    };
                                    rD_setValue("" + result.player_id, JSON.stringify(cacheObj));
                                } else {
                                    let cacheObj = {
                                        value: result.fair_fight,
                                        last_updated: result.last_updated,
                                        expiry: expiry,
                                        bs_estimate: result.bs_estimate,
                                        bs_estimate_human: result.bs_estimate_human
                                    };
                                    rD_setValue("" + result.player_id, JSON.stringify(cacheObj));
                                }
                                }
                            });
                            callback(player_ids);
                    }
                    else {
                        try {
                            var err = JSON.parse(response.responseText);
                            if (err && err.error) {
                                showToast(err.error);
                        } else {
                                showToast('API request failed.');
                            }
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
        var cached_ff_response = rD_getValue("" + target_id, null);
        try {
            cached_ff_response = JSON.parse(cached_ff_response);
        }
        catch {
            cached_ff_response = null;
        }

        if (cached_ff_response) {
            if (cached_ff_response.expiry > Date.now()) {
                return cached_ff_response;
            }
        }
    }

    function display_fair_fight(target_id, player_id) {
        const response = get_fair_fight_response(target_id);
        if (response) {
            set_fair_fight(response, player_id);
        }
    }

    function get_ff_string(ff_response) {
        const ff = ff_response.value.toFixed(2);

        return `${ff}`;
    }

    function get_detailed_message(ff_response, player_id) {
        if (ff_response.no_data) {
            // Show 'No data' if the API returned all nulls
            return `<span style=\"font-weight: bold; margin-right: 6px;\">FairFight:</span><span style=\"background: #444; color: #fff; font-weight: bold; padding: 2px 2px; border-radius: 4px; display: inline-block;\">No data</span>`;
        }
        const ff_string = get_ff_string(ff_response)

        const background_colour = get_ff_colour(ff_response.value);
        const text_colour = get_contrast_color(background_colour);

        let statDetails = '';
        if (ff_response.bs_estimate_human) {
            // Use the same FF color for BS estimate
            const bsColor = get_ff_colour(ff_response.value);
            statDetails = `<span style=\"font-size: 11px; font-weight: normal; margin-left: 8px; vertical-align: middle; color: #cccccc; font-style: italic;\">Est. TBS: <span style="font-weight: bold;color: ${bsColor}">${ff_response.bs_estimate_human}</span></span>`;
        }

        return `<span style=\"font-weight: bold; margin-right: 6px;\">FF:</span><span style=\"background: ${background_colour}; color: ${text_colour}; font-weight: bold; padding: 2px 2px; border-radius: 4px; display: inline-block;\">${ff_string}</span>${statDetails}`;
    }

    function get_ff_string_short(ff_response, player_id) {
        const ff = ff_response.value.toFixed(2);

        return `${ff}`;
    }

    function set_fair_fight(ff_response, player_id) {
        const detailed_message = get_detailed_message(ff_response, player_id);
        info_line.innerHTML = detailed_message;
    }

    function get_members() {
        var player_ids = [];
        $(".table-body > .table-row").each(function () {
            if (!$(this).find(".fallen").length) {
                if (!$(this).find(".fedded").length) {
                    $(this).find(".member").each(function (index, value) {
                        var url = value.querySelectorAll('a[href^="/profiles"]')[0].href;
                        var player_id = url.match(/.*XID=(?<player_id>\d+)/).groups.player_id;
                        player_ids.push(parseInt(player_id));
                    });
                }
            }
        });

        return player_ids;
    }

    function rgbToHex(r, g, b) {
        return '#' +
            ((1 << 24) + (r << 16) + (g << 8) + b)
                .toString(16)
                .slice(1)
                .toUpperCase(); // Convert to hex and return
    }

    function get_ff_colour(value) {
        // Easy to adjust color function using FF_COLORS configuration
        if (value <= 2.5) {
            return FF_COLORS['0-2'];      // Light Blue
        } else if (value <= 3.8) {
            return FF_COLORS['2-4'];      // Green
        } else if (value <= 4.5) {
            return FF_COLORS['4-5'];      // Brown
        } else {
            return FF_COLORS['5+'];       // Red
        }
    }

    function get_contrast_color(hex) {
        // Convert hex to RGB
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        // Calculate brightness
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
        return (brightness > 126) ? 'black' : 'white'; // Return black or white based on brightness
    }

    function apply_fair_fight_info(player_ids) {
        const fair_fights = new Object();

        for (const player_id of player_ids) {
            var cached_ff_response = rD_getValue("" + player_id, null);
            try {
                cached_ff_response = JSON.parse(cached_ff_response);
            }
            catch {
                cached_ff_response = null;
            }

            if (cached_ff_response) {
                if (cached_ff_response.expiry > Date.now()) {
                    fair_fights[player_id] = cached_ff_response;
                }
            }
        }


    }

    function get_cache_misses(player_ids) {
        var unknown_player_ids = []
        for (const player_id of player_ids) {
            var cached_ff_response = rD_getValue("" + player_id, null);
            try {
                cached_ff_response = JSON.parse(cached_ff_response);
            }
            catch {
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

    create_text_location();

    const match1 = window.location.href.match(/https:\/\/www.torn.com\/profiles.php\?XID=(?<target_id>\d+)/);
    const match2 = window.location.href.match(/https:\/\/www.torn.com\/loader.php\?sid=attack&user2ID=(?<target_id>\d+)/);
    const match = match1 ?? match2
    if (match) {
        // We're on a profile page or an attack page - get the fair fight score
        var target_id = match.groups.target_id
        update_ff_cache([target_id], function (target_ids) { display_fair_fight(target_ids[0], target_id) })

        if (!key) {
            set_message("Limited API key needed - click to add");
        }
    }
    else if (window.location.href.startsWith("https://www.torn.com/factions.php")) {
        const torn_observer = new MutationObserver(function () {
            // Find the member table - add a column if it doesn't already have one, for FF scores
            var members_list = $(".members-list")[0];
            if (members_list) {
                torn_observer.disconnect()

                var player_ids = get_members();
                update_ff_cache(player_ids, apply_fair_fight_info)
            }
        });

        torn_observer.observe(document, { attributes: false, childList: true, characterData: false, subtree: true });

        if (!key) {
            set_message("Limited API key needed - click to add");
        }
    }
    else {
        // console.log("Did not match against " + window.location.href);
    }

    function get_player_id_in_element(element) {
        const match = element.parentElement?.href?.match(/.*XID=(?<target_id>\d+)/);
        if (match) {
            return match.groups.target_id;
        }

        const anchors = element.getElementsByTagName('a');

        for (const anchor of anchors) {
            const match = anchor.href.match(/.*XID=(?<target_id>\d+)/);
            if (match) {
                return match.groups.target_id;
            }
        }

        if (element.nodeName.toLowerCase() === "a") {
            const match = element.href.match(/.*XID=(?<target_id>\d+)/);
            if (match) {
                return match.groups.target_id;
            }
        }

        return null;
    }

    function get_ff(target_id) {
        const response = get_fair_fight_response(target_id);
        if (response) {
            return response.value;
        }

        return null;
    }

    function ff_to_percent(ff) {
        // There are 3 key areas, low, medium, high
        // Low is 1-2
        // Medium is 2-4
        // High is 4+
        // If we clip high at 8 then the math becomes easy
        // The percent is 0-33% 33-66% 66%-100%
        const low_ff = 2;
        const high_ff = 4;
        const low_mid_percent = 33;
        const mid_high_percent = 66;
        ff = Math.min(ff, 8)
        var percent;
        if (ff < low_ff) {
            percent = (ff - 1) / (low_ff - 1) * low_mid_percent;
        } else if (ff < high_ff) {
            percent = (((ff - low_ff) / (high_ff - low_ff)) * (mid_high_percent - low_mid_percent)) + low_mid_percent;
        } else {
            percent = (((ff - high_ff) / (8 - high_ff)) * (100 - mid_high_percent)) + mid_high_percent;
        }

        return percent;
    }

    function show_cached_values(elements) {
        for (const [player_id, element] of elements) {
            element.classList.add('ff-scouter-indicator');
            if (!element.classList.contains('indicator-lines')) {
                element.classList.add('indicator-lines');
                element.style.setProperty("--arrow-width", "10px");

                // Ugly - does removing this break anything?
                element.classList.remove("small");
                element.classList.remove("big");
            }

            const response = get_fair_fight_response(player_id);
            if (response) {
                // Remove any existing elements
                $(element).find('.ff-scouter-arrow').remove();
                $(element).find('.ff-scouter-bs-estimate').remove();

                // Add FF indicator
                const ff = response.value;
                if (ff) {
                    const percent = ff_to_percent(ff);
                    element.style.setProperty("--band-percent", percent);

                    var arrow;
                    if (percent < 33) {
                        arrow = BLUE_ARROW;
                    } else if (percent < 66) {
                        arrow = GREEN_ARROW;
                    } else {
                        arrow = RED_ARROW;
                    }
                    const img = $('<img>', {
                        src: arrow,
                        class: "ff-scouter-arrow",
                    });
                    $(element).append(img);

                    // Add BS estimate badge for ALL pages (will be hidden on faction profile pages via CSS)
                    if (response.bs_estimate || response.bs_estimate_human) {
                        const bsValue = response.bs_estimate_human ||
                                       (response.bs_estimate ? formatBattleStats(response.bs_estimate) : null);

                        if (bsValue) {
                            const ff = response.value;

                            // Get the same color as the FF value using the FF color scheme
                            const backgroundColor = get_ff_colour(ff);
                            const textColor = get_contrast_color(backgroundColor);

                            const bsEstimate = $('<div>', {
    class: "ff-scouter-bs-estimate",
    text: bsValue,
    css: {
        'position': 'absolute',
        'bottom': '-5px',
        'left': '50%', // Fixed: 'centre' → '50%'
        'transform': 'translateX(-50%)', // Centers it horizontally
        'font-size': '8px',
        'color': textColor, // White/black for contrast (needs textColor variable)
        'background-color': backgroundColor, // FF color as background
        'text-shadow': '0px 0px 1px rgba(0, 0, 0, 0.3)', // Subtle shadow
        'padding': '1px 2px', // 1px top/bottom, 2px left/right (1px larger than font)
        'border-radius': '2px', // Slight rounding
        'pointer-events': 'none',
        'z-index': '10',
        'font-weight': 'bold',
        'line-height': '1', // Tight line height
        'white-space': 'nowrap' // Prevents line breaks
    }
});
                            $(element).append(bsEstimate);
                        }
                    }
                }
            }
        }
    }

    function formatBattleStats(value) {
        if (!value) return null;
        if (value >= 1e9) {
            return (value / 1e9).toFixed(2).replace(/\.00$/, '') + 'b';
        } else if (value >= 1e6) {
            return (value / 1e6).toFixed(2).replace(/\.00$/, '') + 'm';
        } else if (value >= 1e3) {
            return (value / 1e3).toFixed(2).replace(/\.00$/, '') + 'k';
        } else {
            return value.toString();
        }
    }

    function parseBattleStats(tbsString) {
        if (!tbsString || tbsString === 'N/A') return 0;

        tbsString = tbsString.toLowerCase().trim();
        let multiplier = 1;

        if (tbsString.includes('b')) {
            multiplier = 1e9;
            tbsString = tbsString.replace('b', '');
        } else if (tbsString.includes('m')) {
            multiplier = 1e6;
            tbsString = tbsString.replace('m', '');
        } else if (tbsString.includes('k')) {
            multiplier = 1e3;
            tbsString = tbsString.replace('k', '');
        }

        const numericValue = parseFloat(tbsString);
        if (isNaN(numericValue)) return 0;

        return numericValue * multiplier;
    }

    function getBattleStatsColor(value) {
        // Convert string values like "2.5b" to numbers
        if (typeof value === 'string') {
            value = parseBattleStats(value);
        }

        // Color coding based on battlestats ranges
        if (value < 1e6) { // Less than 1 million
            return '#CCCCCC'; // Light gray
        } else if (value < 10e6) { // 1-10 million
            return '#4CAF50'; // Green
        } else if (value < 100e6) { // 10-100 million
            return '#2196F3'; // Blue
        } else if (value < 1e9) { // 100M-1B
            return '#9C27B0'; // Purple
        } else if (value < 10e9) { // 1B-10B
            return '#FF9800'; // Orange
        } else { // 10B+
            return '#F44336'; // Red
        }
    }
    async function apply_ff_gauge(elements) {
        // Remove elements which already have the class
        elements = elements.filter(e => !e.classList.contains('ff-scouter-indicator'));
        // Convert elements to a list of tuples
        elements = elements.map(e => {
            const player_id = get_player_id_in_element(e);
            return [player_id, e];
        });
        // Remove any elements that don't have an id
        elements = elements.filter(e => e[0]);

        if (elements.length > 0) {
            // Display cached values immediately
            // This is also important to ensure we only iterate the list once
            // Then update
            // Then re-display after the update
            show_cached_values(elements);
            const player_ids = elements.map(e => e[0]);
            update_ff_cache(player_ids, () => { show_cached_values(elements); });
        }
    }

    async function apply_to_mini_profile(mini) {
        // Get the user id, and the details
        // Then in profile-container.description append a new span with the text. Win
        const player_id = get_player_id_in_element(mini);
        if (player_id) {
            const response = get_fair_fight_response(player_id);
            if (response) {
                // Remove any existing elements
                $(mini).find('.ff-scouter-mini-ff').remove();

                // Minimal, text-only Fair Fight string for mini-profiles
                const ff_string = get_ff_string(response);
                const difficulty = get_difficulty_text(response.value);
                const now = Date.now() / 1000;
                const age = now - response.last_updated;
                let fresh = "";
                if (age < 24 * 60 * 60) {
                    // Pass
                } else if (age < 31 * 24 * 60 * 60) {
                    var days = Math.round(age / (24 * 60 * 60));
                    fresh = days === 1 ? "(1 day old)" : `(${days} days old)`;
                } else if (age < 365 * 24 * 60 * 60) {
                    var months = Math.round(age / (31 * 24 * 60 * 60));
                    fresh = months === 1 ? "(1 month old)" : `(${months} months old)`;
                } else {
                    var years = Math.round(age / (365 * 24 * 60 * 60));
                    fresh = years === 1 ? "(1 year old)" : `(${years} years old)`;
                }
                const message = `FF ${ff_string} (${difficulty}) ${fresh}`;

                const description = $(mini).find('.description');
                const desc = $('<span></span>', {
                    class: "ff-scouter-mini-ff",
                });
                desc.text(message);
                $(description).append(desc);
            }
        }
    }

    const ff_gauge_observer = new MutationObserver(async function () {
        var honor_bars = $(".honor-text-wrap").toArray();
        if (honor_bars.length > 0) {
            await apply_ff_gauge($(".honor-text-wrap").toArray());
        } else {
            if (window.location.href.startsWith("https://www.torn.com/factions.php")) {
                await apply_ff_gauge($(".member").toArray());
            } else if (window.location.href.startsWith("https://www.torn.com/companies.php")) {
                await apply_ff_gauge($(".employee").toArray());
            } else if (window.location.href.startsWith("https://www.torn.com/joblist.php")) {
                await apply_ff_gauge($(".employee").toArray());
            } else if (window.location.href.startsWith("https://www.torn.com/messages.php")) {
                await apply_ff_gauge($(".name").toArray());
            } else if (window.location.href.startsWith("https://www.torn.com/index.php")) {
                await apply_ff_gauge($(".name").toArray());
            } else if (window.location.href.startsWith("https://www.torn.com/hospitalview.php")) {
                await apply_ff_gauge($(".name").toArray());
            } else if (window.location.href.startsWith("https://www.torn.com/page.php?sid=UserList")) {
                await apply_ff_gauge($(".name").toArray());
            } else if (window.location.href.startsWith("https://www.torn.com/bounties.php")) {
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

    const key = name.trim().toLowerCase();

    // Exact abbreviations for Torn countries
    const map = {
        'canada': 'CAN',
        'cayman islands': 'CAY',
        'mexico': 'MEX',
        'argentina': 'ARG',
        'uk': 'UK',
        'united kingdom': 'UK',
        'hawaii': 'HWAI',
        'switzerland': 'SWITZ',
        'south africa': 'SA', // or 'ZA' if you prefer
        'china': 'CHI',
        'japan': 'JAP',
        'uae': 'UAE',
        'united arab emirates': 'UAE'
    };

    return map[key] || '';
}

    function formatTime(ms) {
        let totalSeconds = Math.max(0, Math.floor(ms / 1000));
        let hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        let minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        let seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    function fetchFactionData(factionID) {
        const url = `https://api.torn.com/v2/faction/${factionID}/members?striptags=true&key=${key}`;
        return fetch(url).then(response => response.json());
    }

    // Sort Panel functionality
    let currentSortMode = 'none'; // 'none', 'bs-high-low', 'bs-low-high', 'hospital-timer'
    let originalRowOrder = [];

    function createSortPanel() {
        if (document.getElementById('ff-scouter-sort-btn')) return;

        // Create sort button
        const sortBtn = document.createElement('button');
        sortBtn.id = 'ff-scouter-sort-btn';
        sortBtn.className = 'ff-scouter-sort-btn';
        sortBtn.textContent = '⇅';
        sortBtn.title = 'Click to show sort options';

        // Create sort panel
        const sortPanel = document.createElement('div');
        sortPanel.id = 'ff-scouter-sort-panel';
        sortPanel.className = 'ff-scouter-sort-panel';

        // Create sort options
        const options = [
    { id: 'bs-high-low', text: 'BS: High to Low' },
    { id: 'bs-low-high', text: 'BS: Low to High' },
    { id: 'hospital-timer', text: 'Hospital Timer' },
    { id: 'traveling', text: 'Travel/Abroad' },   // <-- new option
    { id: 'reset', text: 'Reset Order' }
];

        options.forEach(option => {
            const optionBtn = document.createElement('button');
            optionBtn.className = 'ff-scouter-sort-option';
            optionBtn.dataset.sort = option.id;
            optionBtn.textContent = option.text;
            sortPanel.appendChild(optionBtn);
        });

        // Add event listeners
        sortBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            sortPanel.classList.toggle('visible');
            sortBtn.classList.toggle('visible');
        });

        sortPanel.addEventListener('click', function(e) {
            if (e.target.classList.contains('ff-scouter-sort-option')) {
                const sortType = e.target.dataset.sort;
                handleSortSelection(sortType);
                sortPanel.classList.remove('visible');
                sortBtn.classList.add('visible');
            }
        });

        // Close panel when clicking outside
        document.addEventListener('click', function(e) {
            if (!sortPanel.contains(e.target) && !sortBtn.contains(e.target)) {
                sortPanel.classList.remove('visible');
                sortBtn.classList.add('visible');
            }
        });

        document.body.appendChild(sortBtn);
        document.body.appendChild(sortPanel);
        sortBtn.classList.add('visible');
    }

    function handleSortSelection(sortType) {
    const sortPanel = document.getElementById('ff-scouter-sort-panel');
    if (!sortPanel) return;

    // Update active state
    const allOptions = sortPanel.querySelectorAll('.ff-scouter-sort-option');
    allOptions.forEach(option => option.classList.remove('active'));

    const selectedOption = sortPanel.querySelector(`[data-sort="${sortType}"]`);
    if (selectedOption) {
        selectedOption.classList.add('active');
    }

    // Store original order if not already stored
    const tableBody = document.querySelector('.table-body');
    if (tableBody && originalRowOrder.length === 0) {
        originalRowOrder = Array.from(tableBody.children);
    }

    // Perform sort
    currentSortMode = sortType;

    if (sortType === 'reset') {
        resetToOriginalOrder();
        // SAVE SORT MODE: reset = none
        rD_setValue('ff_scouter_sort_mode', 'none');
    } else if (sortType === 'bs-high-low' || sortType === 'bs-low-high') {
        sortRowsByBS(sortType);
        // SAVE SORT MODE
        rD_setValue('ff_scouter_sort_mode', sortType);
    } else if (sortType === 'hospital-timer') {
        sortRowsByEnhancedHospitalTimer();
        // SAVE SORT MODE
        rD_setValue('ff_scouter_sort_mode', sortType);
    } else if (sortType === 'traveling') {
    sortRowsByTravelAbroad();
    rD_setValue('ff_scouter_sort_mode', sortType);
}
}

    function resetToOriginalOrder() {
        const tableBody = document.querySelector('.table-body');
        if (!tableBody || originalRowOrder.length === 0) return;

        originalRowOrder.forEach(row => {
            tableBody.appendChild(row);
        });
    }

    function sortRowsByBS(sortType) {
        const tableBody = document.querySelector('.table-body');
        if (!tableBody) return;

        // Get all main rows
        const mainRows = Array.from(tableBody.querySelectorAll('.table-row[data-ff-scouter-extra]'));
        const rowsWithBS = [];

        // Collect rows with their BS estimate values
        mainRows.forEach(mainRow => {
            const extraRow = mainRow.nextElementSibling;
            if (!extraRow || !extraRow.classList.contains('ff-scouter-extra-row')) return;

            const profileLink = mainRow.querySelector('a[href*="profiles.php?XID="]');
            if (!profileLink) return;

            const match = profileLink.href.match(/XID=(\d+)/);
            if (!match) return;

            const playerId = match[1];
            const ffResponse = get_fair_fight_response(playerId);

            let bsValue = 0;
            if (ffResponse && ffResponse.bs_estimate) {
                bsValue = ffResponse.bs_estimate;
            }

            rowsWithBS.push({
                mainRow: mainRow,
                extraRow: extraRow,
                bsValue: bsValue,
                playerId: playerId
            });
        });

        // Sort based on type
        if (sortType === 'bs-high-low') {
            // High to Low
            rowsWithBS.sort((a, b) => b.bsValue - a.bsValue);
        } else {
            // Low to High
            rowsWithBS.sort((a, b) => a.bsValue - b.bsValue);
        }

        // Reorder rows in the table
        rowsWithBS.forEach(item => {
            tableBody.appendChild(item.mainRow);
            tableBody.appendChild(item.extraRow);
        });
    }

    function getStatusFromRow(row) {
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

    function sortRowsByEnhancedHospitalTimer() {
        const tableBody = document.querySelector('.table-body');
        if (!tableBody) return;

        // Get all main rows
        const mainRows = Array.from(tableBody.querySelectorAll('.table-row[data-ff-scouter-extra]'));
        const rowsWithData = [];

        // Collect rows with their data
        mainRows.forEach(mainRow => {
            const extraRow = mainRow.nextElementSibling;
            if (!extraRow || !extraRow.classList.contains('ff-scouter-extra-row')) return;

            const profileLink = mainRow.querySelector('a[href*="profiles.php?XID="]');
            if (!profileLink) return;

            const match = profileLink.href.match(/XID=(\d+)/);
            if (!match) return;

            const playerId = match[1];
            const ffResponse = get_fair_fight_response(playerId);

            // Get BS value
            let bsValue = 0;
            if (ffResponse && ffResponse.bs_estimate) {
                bsValue = ffResponse.bs_estimate;
            }

            // Get status from row
            const status = getStatusFromRow(mainRow);

            // Get hospital timer if hospitalized
            let hospitalTimer = Infinity;
            if (status === 'Hospital' && memberCountdowns[playerId]) {
                const remaining = memberCountdowns[playerId] - Date.now();
                if (remaining > 0) {
                    hospitalTimer = remaining;
                } else {
                    hospitalTimer = 0; // Timer expired
                }
            }

            rowsWithData.push({
                mainRow: mainRow,
                extraRow: extraRow,
                bsValue: bsValue,
                status: status,
                hospitalTimer: hospitalTimer,
                playerId: playerId
            });
        });

        // Enhanced Hospital Timer Sorting Logic
        rowsWithData.sort((a, b) => {
            // Status priority order (lower number = higher priority)
            const statusPriority = {
                'Hospital': 1,  // In hospital (after Okay)
                'Okay': 2,      // Highest priority - ready now
                'Traveling': 3, // Traveling
                'Abroad': 4,    // Out of town
                'Jail': 5,      // In jail
                'Unknown': 6    // Unknown status
            };

            const aPriority = statusPriority[a.status] || 99;
            const bPriority = statusPriority[b.status] || 99;

            // 1. First, sort by status priority
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }

            // 2. Within same status group, apply specific sorting
            if (a.status === 'Hospital' && b.status === 'Hospital') {
                // Both in hospital: sort by timer (soonest first)
                if (a.hospitalTimer !== b.hospitalTimer) {
                    return a.hospitalTimer - b.hospitalTimer;
                }
                // Same timer: sort by BS (weakest first - Low to High)
                return a.bsValue - b.bsValue;
            }
            else if (a.status === 'Okay' && b.status === 'Okay') {
                // Both okay: sort by BS (strongest first - High to Low)
                return b.bsValue - a.bsValue;
            }
            else {
                // For other status groups: sort by BS (strongest first - High to Low)
                return b.bsValue - a.bsValue;
            }
        });

        // Reorder rows in the table
        rowsWithData.forEach(item => {
            tableBody.appendChild(item.mainRow);
            tableBody.appendChild(item.extraRow);
        });
    }

function sortRowsByTravelAbroad() {
    const tableBody = document.querySelector('.table-body');
    if (!tableBody) return;

    const mainRows = Array.from(tableBody.querySelectorAll('.table-row[data-ff-scouter-extra]'));
    const rowsWithData = [];

    mainRows.forEach(mainRow => {
        const extraRow = mainRow.nextElementSibling;
        if (!extraRow || !extraRow.classList.contains('ff-scouter-extra-row')) return;

        const profileLink = mainRow.querySelector('a[href*="profiles.php?XID="]');
        if (!profileLink) return;

        const match = profileLink.href.match(/XID=(\d+)/);
        if (!match) return;

        const playerId = match[1];
        const ffResponse = get_fair_fight_response(playerId);

        // Get BS value
        let bsValue = 0;
        if (ffResponse && ffResponse.bs_estimate) {
            bsValue = ffResponse.bs_estimate;
        }

        // Get status from row
        const status = getStatusFromRow(mainRow);

        // Group priority: 1 = Traveling, 2 = Abroad, 3 = Others
        let groupPriority;
        if (status === 'Traveling') {
            groupPriority = 1;
        } else if (status === 'Abroad') {
            groupPriority = 2;
        } else {
            groupPriority = 3;
        }

        rowsWithData.push({
            mainRow: mainRow,
            extraRow: extraRow,
            bsValue: bsValue,
            groupPriority: groupPriority,
            playerId: playerId
        });
    });

    // Sort: first by group priority, then by BS descending
    rowsWithData.sort((a, b) => {
        if (a.groupPriority !== b.groupPriority) {
            return a.groupPriority - b.groupPriority; // lower number first
        }
        // Same group: higher BS first
        return b.bsValue - a.bsValue;
    });

    // Reorder rows
    rowsWithData.forEach(item => {
        tableBody.appendChild(item.mainRow);
        tableBody.appendChild(item.extraRow);
    });
}

    // New function to update faction profile member status using arrows for travel
function updateFactionProfileMemberStatus(li, member, isFactionProfilePage) {
    if (!member || !member.status) return;

    let statusEl = li.querySelector('.status');
    if (!statusEl) {
        return;
    }

    let statusText = '';
    let statusClass = '';
    let untilTime = 0;

    switch(member.status.state) {
        case "Okay":
            statusText = "Okay";
            statusClass = 'faction-status-okay';
            break;

        case "Traveling": {
    let description = member.status.description || '';

    if (description.includes("Returning to Torn from ")) {
        let location = description.replace("Returning to Torn from ", "");
        let abbr = abbreviateCountry(location);
        statusText = `${tornSymbol} -- ${createPlaneSvg(true)}`;
    } else if (description.includes("Traveling to ")) {
        let location = description.replace("Traveling to ", "");
        let abbr = abbreviateCountry(location);
        statusText = `${createPlaneSvg(false)} -- ${abbr}`;
    } else {
        statusText = "Traveling";
    }

    statusClass = 'faction-status-traveling';

    if (member.status.until) {
        untilTime = parseInt(member.status.until, 10) * 1000;
    }
    break;
}

        case "Abroad": {
            let abroadDesc = member.status.description || '';
            if (abroadDesc.startsWith("In ")) {
                let location = abroadDesc.replace("In ", "");
                let abbr = abbreviateCountry(location);
                statusText = `🌏 ${abbr}`;
            } else {
                statusText = "Abroad";
            }
            statusClass = 'faction-status-abroad';
            break;
        }

        case "Hospital":
            statusClass = 'faction-status-hospital';
            if (member.status.until) {
                untilTime = parseInt(member.status.until, 10) * 1000;
            }
            break;

        case "Jail":
            statusClass = 'faction-status-jail';
            if (member.status.until) {
                untilTime = parseInt(member.status.until, 10) * 1000;
            }
            break;

        default:
            statusText = member.status.state || "";
            statusClass = '';
    }

    // Store until time for countdown updates
    if (untilTime > 0) {
        memberCountdowns[member.id] = untilTime;
    } else {
        delete memberCountdowns[member.id];
    }

    // For faction profile pages, we'll create the extra info row
    if (isFactionProfilePage) {
        createOrUpdateExtraInfoRow(li, member);
    }

    // Countdown text
    let countdownText = '';
    if (untilTime > 0) {
        let remaining = untilTime - Date.now();
        countdownText = remaining > 0 ? formatTime(remaining) : "00:00:00";
    }

    // Build HTML
    let statusHTML = `<div class="faction-profile-status ${statusClass}">`;

    if (statusText) {
        statusHTML += `<span class="status-text">${statusText}</span>`;
    }

    if (countdownText) {
        statusHTML += `<span class="faction-status-countdown">${countdownText}</span>`;
    }

    statusHTML += '</div>';

    statusEl.innerHTML = statusHTML;
}

    // Function to create or update extra info row with last action, FF, and attack emoji
    function createOrUpdateExtraInfoRow(li, member) {
        // Check if extra row already exists
        let extraRow = li.nextElementSibling;
        if (extraRow && extraRow.classList.contains('ff-scouter-extra-row')) {
            // Update existing row
            updateExtraInfoRowContent(extraRow, member);
        } else {
            // Create new row
            createExtraInfoRow(li, member);
        }
    }

    function createExtraInfoRow(li, member) {
        const extraRow = document.createElement('li');
        extraRow.className = 'ff-scouter-extra-row';

        // Store user ID on the extra row for tracking
        const profileLink = li.querySelector('a[href*="profiles.php?XID="]');
        if (profileLink) {
            const match = profileLink.href.match(/XID=(\d+)/);
            if (match) {
                extraRow.dataset.userId = match[1];
            }
        }

        // Also mark the main row so we can track it
        li.dataset.ffScouterExtra = 'true';

        const extraContent = document.createElement('div');
        extraContent.className = 'ff-scouter-extra-content';

        // Get player ID from the member row
        let playerId = null;
        if (profileLink) {
            const match = profileLink.href.match(/XID=(\d+)/);
            if (match) {
                playerId = match[1];
            }
        }

        // Get FF data
        let ffValue = 'N/A';
        let ffColor = '#000';

        if (playerId) {
            const ffResponse = get_fair_fight_response(playerId);
            if (ffResponse && !ffResponse.no_data) {
                ffValue = ffResponse.value.toFixed(2);
                // Get FF color using the new color scheme
                ffColor = get_ff_colour(ffResponse.value);
            }
        }

        // Last action text
        let lastActionText = 'Last action: N/A';
        if (member.last_action && member.last_action.relative) {
            lastActionText = `Last action: ${member.last_action.relative}`;
        }

        // Build content with attack emoji only (no title)
        extraContent.innerHTML = `
            <div class="ff-scouter-last-action">${lastActionText}</div>
            <div class="ff-scouter-stats">
                <div class="ff-scouter-ff">
                    FF: <span class="ff-scouter-ff-value" style="color: ${ffColor}">${ffValue}</span>
                </div>
                <div class="ff-scouter-attack">
                    <a href="https://www.torn.com/loader.php?sid=attack&user2ID=${playerId}" target="_blank" class="ff-scouter-attack-btn" style="color: ${ffColor}">⚔️</a>
                </div>
            </div>
        `;

        extraRow.appendChild(extraContent);
        li.parentNode.insertBefore(extraRow, li.nextSibling);
    }

    function updateExtraInfoRowContent(extraRow, member) {
        const lastActionDiv = extraRow.querySelector('.ff-scouter-last-action');
        if (lastActionDiv && member.last_action && member.last_action.relative) {
            lastActionDiv.textContent = `Last action: ${member.last_action.relative}`;
        }

        // Note: FF and attack button are updated separately via the cache updates
    }

    // Function to update FF and attack button in existing extra rows
    function updateExtraInfoRowStats() {
        if (!window.location.href.match(/factions\.php\?step=profile&ID=\d+/)) return;

        document.querySelectorAll('.ff-scouter-extra-row').forEach(extraRow => {
            const li = extraRow.previousElementSibling;
            if (!li || !li.classList.contains('table-row')) return;

            const profileLink = li.querySelector('a[href*="profiles.php?XID="]');
            if (!profileLink) return;

            const match = profileLink.href.match(/XID=(\d+)/);
            if (!match) return;

            const playerId = match[1];
            const ffResponse = get_fair_fight_response(playerId);

            if (ffResponse && !ffResponse.no_data) {
                const ffValue = ffResponse.value.toFixed(2);
                // Get FF color using the new color scheme
                const ffColor = get_ff_colour(ffResponse.value);

                const ffSpan = extraRow.querySelector('.ff-scouter-ff-value');
                const attackBtn = extraRow.querySelector('.ff-scouter-attack-btn');

                if (ffSpan) {
                    ffSpan.textContent = ffValue;
                    ffSpan.style.color = ffColor;
                }
                if (attackBtn) {
                    attackBtn.style.color = ffColor;
                    attackBtn.href = `https://www.torn.com/loader.php?sid=attack&user2ID=${playerId}`;
                }
            }
        });
    }

    // Function to fix extra rows after filtering/sorting
    function fixExtraRowsAfterFilter() {
        if (!window.location.href.match(/factions\.php\?step=profile&ID=\d+/)) return;

        const tableBody = document.querySelector('.table-body');
        if (!tableBody) return;

        // Collect all main rows and their extra rows
        const mainRows = Array.from(tableBody.querySelectorAll('.table-row[data-ff-scouter-extra]'));
        const extraRows = Array.from(tableBody.querySelectorAll('.ff-scouter-extra-row'));

        // Create a map of user ID to extra row
        const extraRowMap = new Map();
        extraRows.forEach(extraRow => {
            if (extraRow.dataset.userId) {
                extraRowMap.set(extraRow.dataset.userId, extraRow);
            }
        });

        // Re-attach extra rows to their correct main rows
        mainRows.forEach(mainRow => {
            const profileLink = mainRow.querySelector('a[href*="profiles.php?XID="]');
            if (!profileLink) return;

            const match = profileLink.href.match(/XID=(\d+)/);
            if (!match) return;

            const userId = match[1];
            const extraRow = extraRowMap.get(userId);

            if (extraRow) {
                // Check if extra row is already in the right position
                if (extraRow.previousElementSibling !== mainRow) {
                    // Remove extra row from current position
                    extraRow.parentNode.removeChild(extraRow);
                    // Insert after main row
                    mainRow.parentNode.insertBefore(extraRow, mainRow.nextSibling);
                }
            }
        });
    }

    // Function to update faction profile statuses
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

                // Find all member rows in faction profile
                document.querySelectorAll(".table-body > .table-row").forEach(row => {
                    let profileLink = row.querySelector('a[href*="profiles.php?XID="]');
                    if (!profileLink) return;

                    let match = profileLink.href.match(/XID=(\d+)/);
                    if (!match) return;

                    let userID = match[1];
                    updateFactionProfileMemberStatus(row, memberMap[userID], true);
                });

                // Update FF and attack button in extra rows
                updateExtraInfoRowStats();

            // ========== RE-APPLY CURRENT SORT (if any) TO KEEP ORDER CONSISTENT ==========
if (currentSortMode !== 'none' && currentSortMode !== 'reset') {
    console.log(`Re-applying sort mode: ${currentSortMode}`);
    if (currentSortMode === 'bs-high-low' || currentSortMode === 'bs-low-high') {
        sortRowsByBS(currentSortMode);
    } else if (currentSortMode === 'hospital-timer') {
        sortRowsByEnhancedHospitalTimer();
    }
}
// ========== END RE-SORT ==========

                // Fix any misaligned extra rows
                setTimeout(fixExtraRowsAfterFilter, 100);
            })
            .catch(err => {
                console.error("Error fetching faction data for profile", err);
            });
    }

    // Function to update countdown timers on faction profile page
    function updateFactionProfileTimers() {
        if (!window.location.href.match(/factions\.php\?step=profile&ID=\d+/)) return;

        document.querySelectorAll('.table-body > .table-row').forEach(row => {
            let profileLink = row.querySelector('a[href*="profiles.php?XID="]');
            if (!profileLink) return;

            let match = profileLink.href.match(/XID=(\d+)/);
            if (!match) return;

            let userID = match[1];
            let statusEl = row.querySelector('.status');
            if (!statusEl) return;

            if (memberCountdowns[userID]) {
                let remaining = memberCountdowns[userID] - Date.now();
                if (remaining > 0) {
                    const countdownEl = statusEl.querySelector('.faction-status-countdown');
                    if (countdownEl) {
                        countdownEl.textContent = formatTime(remaining);
                    }
                } else if (remaining <= 0) {
                    const countdownEl = statusEl.querySelector('.faction-status-countdown');
                    if (countdownEl) {
                        countdownEl.textContent = "00:00:00";
                    }
                }
            }
        });
    }

    // Initialize faction profile status updates
    function initFactionProfileStatus() {
        // Check if we're on a faction profile page
        const profileMatch = window.location.href.match(/factions\.php\?step=profile&ID=(\d+)/);
        if (!profileMatch) return false;

        const factionID = profileMatch[1];

        // Function to initialize once table is ready
        function initializeWhenReady() {
            const memberTable = document.querySelector(".table-body");
            if (!memberTable) {
                // Try again in 100ms if table not ready yet
                setTimeout(initializeWhenReady, 100);
                return;
            }

            // Wait a bit more to ensure all rows are rendered
            setTimeout(() => {
                // Create sort panel
                createSortPanel();

                // Collect all player IDs from the table
                const playerIds = [];
                document.querySelectorAll(".table-body > .table-row").forEach(row => {
                    let profileLink = row.querySelector('a[href*="profiles.php?XID="]');
                    if (!profileLink) return;

                    let match = profileLink.href.match(/XID=(\d+)/);
                    if (!match) return;

                    playerIds.push(match[1]);
                });

                // Update FF cache for all players first
                if (playerIds.length > 0) {
                    update_ff_cache(playerIds, () => {
                        // Then update statuses and create extra rows
                        updateFactionProfileStatuses(factionID);

                        // Also update FF and attack button immediately
                        updateExtraInfoRowStats();

                        // === RESTORE SAVED SORT ===
const savedSort = rD_getValue('ff_scouter_sort_mode', 'none');
if (savedSort !== 'none') {
    currentSortMode = savedSort;
    // Highlight the active sort option in the panel
    const sortPanel = document.getElementById('ff-scouter-sort-panel');
    if (sortPanel) {
        const option = sortPanel.querySelector(`[data-sort="${savedSort}"]`);
        if (option) option.classList.add('active');
    }
    // Apply the sort
    if (savedSort === 'bs-high-low' || savedSort === 'bs-low-high') {
        sortRowsByBS(savedSort);
    } else if (savedSort === 'hospital-timer') {
        sortRowsByEnhancedHospitalTimer();
    } else if (savedSort === 'traveling') {
    sortRowsByTravelAbroad();
}
}
// === END RESTORE ===

                    });
                } else {
                    updateFactionProfileStatuses(factionID);

                    // === RESTORE SAVED SORT ===
const savedSort = rD_getValue('ff_scouter_sort_mode', 'none');
if (savedSort !== 'none') {
    currentSortMode = savedSort;
    // Highlight the active sort option in the panel
    const sortPanel = document.getElementById('ff-scouter-sort-panel');
    if (sortPanel) {
        const option = sortPanel.querySelector(`[data-sort="${savedSort}"]`);
        if (option) option.classList.add('active');
    }
    // Apply the sort
    if (savedSort === 'bs-high-low' || savedSort === 'bs-low-high') {
        sortRowsByBS(savedSort);
    } else if (savedSort === 'hospital-timer') {
        sortRowsByEnhancedHospitalTimer();
    } else if (savedSort === 'traveling') {
    sortRowsByTravelAbroad();
}
}
// === END RESTORE ===

                }

                // Set up observer to fix rows after filtering
                const tableObserver = new MutationObserver(() => {
                    setTimeout(fixExtraRowsAfterFilter, 100);
                });
                tableObserver.observe(memberTable, { childList: true, subtree: true });

                console.log(`Faction profile status initialized for faction ${factionID}`);
            }, 300);

            return true;
        }

        // Start initialization
        if (initializeWhenReady()) {
            // Set up interval for updates
            setInterval(() => updateFactionProfileStatuses(factionID), API_INTERVAL);

            // Start timer updates for countdowns
            setInterval(updateFactionProfileTimers, 1000);

            return true;
        }

        return false;
    }

    // Observer for faction profile pages
    const factionProfileObserver = new MutationObserver(() => {
        if (window.location.href.match(/factions\.php\?step=profile&ID=\d+/)) {
            if (initFactionProfileStatus()) {
                factionProfileObserver.disconnect();
            }
        }
    });

    // Start observing if on faction profile page
    if (window.location.href.match(/factions\.php\?step=profile&ID=\d+/)) {
        if (!initFactionProfileStatus()) {
            factionProfileObserver.observe(document.body, { childList: true, subtree: true });
        }
    }

    // Original war status functions
    function updateMemberStatus(li, member) {
        if (!member || !member.status) return;

        let statusEl = li.querySelector('.status');
        if (!statusEl) return;

        let lastActionRow = li.querySelector('.last-action-row');
        let lastActionText = member.last_action?.relative || '';
        if (lastActionRow) {
            lastActionRow.textContent = `Last Action: ${lastActionText}`;
        } else {
            lastActionRow = document.createElement('div');
            lastActionRow.className = 'last-action-row';
            lastActionRow.textContent = `Last Action: ${lastActionText}`;
            let lastDiv = Array.from(li.children).reverse().find(el => el.tagName === 'DIV');
            if (lastDiv?.nextSibling) {
                li.insertBefore(lastActionRow, lastDiv.nextSibling);
            } else {
                li.appendChild(lastActionRow);
            }
        }

        // Handle status changes
        if (member.status.state === "Okay") {
            if (statusEl.dataset.originalHtml) {
                statusEl.innerHTML = statusEl.dataset.originalHtml;
                delete statusEl.dataset.originalHtml;
            }
            statusEl.textContent = "Okay";
} else if (member.status.state === "Traveling") {
    if (!statusEl.dataset.originalHtml) {
        statusEl.dataset.originalHtml = statusEl.innerHTML;
    }

    let description = member.status.description || '';
    let location = '';
    let isReturning = false;

    if (description.includes("Returning to Torn from ")) {
        location = description.replace("Returning to Torn from ", "");
        isReturning = true;
    } else if (description.includes("Traveling to ")) {
        location = description.replace("Traveling to ", "");
    }

    let abbr = abbreviateCountry(location);

    if (isReturning) {
        statusEl.innerHTML = `<span class="travel-status">${tornSymbol} -- ${createPlaneSvg(true)}</span>`;
    } else {
        statusEl.innerHTML = `<span class="travel-status">${createPlaneSvg(false)} -- ${abbr}</span>`;
    }
        } else if (member.status.state === "Abroad") {
            if (!statusEl.dataset.originalHtml) {
                statusEl.dataset.originalHtml = statusEl.innerHTML;
            }
            let description = member.status.description || '';
            if (description.startsWith("In ")) {
                let location = description.replace("In ", "");
                let abbr = abbreviateCountry(location);
                statusEl.textContent = `in ${abbr}`;
            }
        }

        // Update countdown
        if (member.status.until && parseInt(member.status.until, 10) > 0) {
            memberCountdowns[member.id] = parseInt(member.status.until, 10) * 1000;
        } else {
            delete memberCountdowns[member.id];
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
                    let profileLink = li.querySelector('a[href*="profiles.php?XID="]');
                    if (!profileLink) return;
                    let match = profileLink.href.match(/XID=(\d+)/);
                    if (!match) return;
                    let userID = match[1];
                    updateMemberStatus(li, memberMap[userID]);
                });
            })
            .catch(err => {
                console.error("Error fetching faction data for faction", factionID, err);
            })
            .finally(() => {
                apiCallInProgressCount--;
            });
    }

    function updateAllMemberTimers() {
        const liElements = document.querySelectorAll(".enemy-faction .members-list li, .your-faction .members-list li");
        liElements.forEach(li => {
            let profileLink = li.querySelector('a[href*="profiles.php?XID="]');
            if (!profileLink) return;
            let match = profileLink.href.match(/XID=(\d+)/);
            if (!match) return;
            let userID = match[1];
            let statusEl = li.querySelector('.status');
            if (!statusEl) return;
            if (memberCountdowns[userID]) {
                let remaining = memberCountdowns[userID] - Date.now();
                if (remaining < 0) remaining = 0;
                statusEl.textContent = formatTime(remaining);
            }
        });
    }

    function updateAPICalls() {
        let enemyFactionLink = document.querySelector(".opponentFactionName___vhESM");
        let yourFactionLink = document.querySelector(".currentFactionName___eq7n8");
        if (!enemyFactionLink || !yourFactionLink) return;

        let enemyFactionIdMatch = enemyFactionLink.href.match(/ID=(\d+)/);
        let yourFactionIdMatch = yourFactionLink.href.match(/ID=(\d+)/);
        if (!enemyFactionIdMatch || !yourFactionIdMatch) return;

        let enemyList = document.querySelector(".enemy-faction .members-list");
        let yourList = document.querySelector(".your-faction .members-list");
        if (!enemyList || !yourList) return;

        updateFactionStatuses(enemyFactionIdMatch[1], enemyList);
        updateFactionStatuses(yourFactionIdMatch[1], yourList);
    }

    function initWarScript() {
        let enemyFactionLink = document.querySelector(".opponentFactionName___vhESM");
        let yourFactionLink = document.querySelector(".currentFactionName___eq7n8");
        if (!enemyFactionLink || !yourFactionLink) return false;

        let enemyList = document.querySelector(".enemy-faction .members-list");
        let yourList = document.querySelector(".your-faction .members-list");
        if (!enemyList || !yourList) return false;

        updateAPICalls();
        setInterval(updateAPICalls, API_INTERVAL);
        console.log("Torn Faction Status Countdown (Real-Time & API Status - Relative Last): Initialized");
        return true;
    }

    let warObserver = new MutationObserver((mutations, obs) => {
        if (initWarScript()) {
            obs.disconnect();
        }
    });
    warObserver.observe(document.body, { childList: true, subtree: true });

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

        // Close button
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

    // Function to remove "days" column from faction profile pages
    function removeDaysColumn() {
        if (!window.location.href.includes("factions.php?step=profile")) return;

        // REMOVE HEADER CELL
        document.querySelectorAll('.table-header .table-cell.days').forEach(el => {
            el.remove();
        });

        // REMOVE ROW CELLS
        document.querySelectorAll('.table-row .table-cell.days').forEach(el => {
            el.remove();
        });
    }

    // Run once after page loads for faction profile pages
    if (window.location.href.includes("factions.php?step=profile")) {
        setTimeout(removeDaysColumn, 500);

        // Re-run whenever Torn refreshes AJAX content
        const daysObserver = new MutationObserver(() => {
            setTimeout(removeDaysColumn, 100);
        });

        daysObserver.observe(document.body, { childList: true, subtree: true });
    }
}
