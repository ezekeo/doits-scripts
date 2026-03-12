# Doits Scripts – Torn Userscripts

A small collection of quality-of-life userscripts for **torn.com**, designed to be lightweight, practical, and easy to use.

All scripts support **auto-updates via GitHub**.

---

## 📦 Requirements

You will need **one** of the following:

### Option 1: Desktop / Mobile Browser
- **Tampermonkey** (recommended)  
  or  
- Violentmonkey

### Option 2: Torn PDA (Mobile App)
- **Torn PDA** app (Android / iOS)

---

## 📥 Installation

### 🔹 Browser (Tampermonkey / Violentmonkey)

1. Install **Tampermonkey**
2. Click one of the install links below
3. Confirm installation in the userscript manager

Updates are handled automatically.

---

### 🔹 Torn PDA (Mobile App)

1. Open **Torn PDA**
2. Go to **Settings**
3. Select **Userscripts**
4. Tap **➕ Add Userscript**
5. **Select “Remote Load / Update”**
6. Paste the **RAW install link** for the script
7. Save and enable the script

⚠️ Make sure you use the **raw.githubusercontent.com** link, not the GitHub page link.

---

## 🔧 Available Scripts

### 🛰️ Doitsburger’s FF Scouter

Scouts and displays Fair Fight (FF) information in a quick, readable format to assist with decision-making during fights.

### 🔑 API Requirement (Important)

Before using this script, you **must**:

1. Register a **Torn Limited API key** at  
   **https://ffscouter.com**
2. Use the **same API key** when prompted by the userscript

**Install (Browser / Torn PDA):**  
https://raw.githubusercontent.com/doitsburger/doits-scripts/main/ff-scouter/doitsburgers-ff-scouter.user.js

👉 After installing the userscript, you will be prompted to enter this API key **the first time you visit a Torn profile page**.  
This step is required for the script to function correctly.

---

### 👥 Attribution & Credits

> **Attribution:**  
> This script is **not solely original work**.  
>  
> It is based on and inspired by the original **FF Scouter** userscripts created by members of the Torn community.  
>  
> **Original authors:**  
> `rDacted`, `Weav3r`, `GFOUR`  
>  
> This version includes modifications, maintenance, and enhancements by **doitsburger**.  
>  
> Full credit and respect to the original authors.

---

### Doitsburger's FF Target Finder + Attack Overlay

A Tampermonkey userscript that helps you quickly find fair fight (FF) targets using data from [FFScouter](https://ffscouter.com) and adds a prominent **START FIGHT** overlay on attack pages for easier engagement.

## Features
- **Quick target lookup** – Fetches a random target matching your Fair Fight range, inactivity, and faction filters.
- **Tap/hold interaction** – On mobile: tap the floating target icon to find a target, hold to open settings.
- **Desktop keyboard shortcuts** – `F1` find target, `F2` open settings, `F3` set API key.
- **START FIGHT overlay** – On attack pages, a pulsing overlay appears above the fight button; click it to start the fight.
- **Configurable filters** – Set min/max FF, filter by inactive players (14+ days), factionless only, and choose whether to open targets in a new tab.
- **Status verification** – Optionally verify that a target is in "Okay" state before attacking (slower but more accurate).
- **Flexible API key** – Use your own FFScouter API key or rely on the automatic key provided by Torn PDA.

## Installation
1. Install a userscript manager like [Tampermonkey](https://www.tampermonkey.net/) or Violentmonkey.
2. Create a new script and paste the entire code from this repository.
3. Save the script – it will automatically run on Torn pages.

## Usage
- **Floating button** – Appears on all Torn pages (customizable position).  
  - Tap (or click) to find a target.  
  - Hold (or right‑click) to open settings.  
- **Keyboard** (desktop only):  
  - `F1` – Find target  
  - `F2` – Open settings  
  - `F3` – Enter/edit API key  
- **Attack overlay** – When you land on a fight page (`loader.php?sid=attack`), a full‑width pulsing "START FIGHT" overlay appears. Click it to trigger the actual attack button.

## Configuration
- **API Key** – You can get a free API key from [FFScouter](https://ffscouter.com) (register your Torn API key there). If you use Torn PDA, the script will automatically use its built‑in key.
- **Target settings** – Adjust the Fair Fight range (1.00–3.00) and enable filters for inactive or factionless players.
- **Behavior** – Choose whether to open attacks in a new tab, and enable status verification.
- **Button position** – In settings, click "Move Button" to drag the floating button anywhere on the screen.

## Credits
This script is a tweak/modification of the original work by **FFScouter** and **Torn Mobile**.  
**Doitsburger** is only a tweaker – all core functionality and credit belong to the original authors.

---

### ✈️ One Click Travel

Adds one-click travel shortcuts to make travelling between locations faster and more convenient.

**Install (Browser / Torn PDA):**  
https://raw.githubusercontent.com/doitsburger/doits-scripts/main/one-click-travel/one-click-travel.user.js

---

### 🖼️ Background Image

Adds a simple custom background to Torn.com with a minimal emoji toggle button.  
Lightweight, clean, and works seamlessly on both browser and Torn PDA.

**Install (Browser / Torn PDA):**  
https://raw.githubusercontent.com/doitsburger/doits-scripts/main/background-image/background

---

## 🔄 Auto Updates

All scripts include automatic update support.

---

## 🛡️ Notes

- Scripts do **not** store API keys unless explicitly stated
- FF Scouter API usage is handled via **ffscouter.com**
- No data is sent to unrelated third-party services
- Use at your own risk — Torn rules apply

---

## 🧑‍💻 Author & Maintainer

Maintained by **doitsburger**

GitHub: https://github.com/doitsburger

---

## 📄 Licence & Credits

- Original FF Scouter concept and implementation by Torn community developers  
- Modifications, maintenance, and distribution by **doitsburger**  
- Provided for personal use — please respect original authorship and Torn rules
