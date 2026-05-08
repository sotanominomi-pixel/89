// --- 状態管理 ---
const MIN_N = 12;
const MAX_N = 48;
let currentN = 24; 
let isSecondsVisible = true; 
let currentLang = 'ja'; 
let isPresetFeatureEnabled = true;

// プリセット・アラーム等のデータ
let presets = []; 
let alarms = [{id: 1, h: 7, m: 0, enabled: true, label: 'Alarm'}]; 
let nextPresetId = 1;
let nextAlarmId = 2;

// ストップウォッチ関連
let stopwatchStartTime = 0;
let stopwatchElapsedTime = 0; 
let stopwatchTimer = null;
let lapTimes = [];
let lastLapTimeTotal = 0;

const translations = {
    'ja': {
        'nav-clock': '時計',
        'nav-stopwatch': 'ストップウォッチ',
        'nav-alarm': 'アラーム',
        'nav-settings': '設定',
        'pip-btn': '🔲 ウィンドウを浮かせる'
    },
    'en': {
        'nav-clock': 'Clock',
        'nav-stopwatch': 'Stopwatch',
        'nav-alarm': 'Alarm',
        'nav-settings': 'Settings',
        'pip-btn': '🔲 Pop-out Window'
    }
};

// --- コアロジック ---
function calculateNTime(realTimeMs) {
    const speedFactor = 24 / currentN; 
    const n_world_elapsed_seconds = (realTimeMs / 1000) * speedFactor;
    const h = Math.floor((n_world_elapsed_seconds / 3600) % 24); 
    const m = Math.floor((n_world_elapsed_seconds % 3600) / 60);
    const s = Math.floor(n_world_elapsed_seconds % 60);
    return { h, m, s };
}

function updateClock() {
    const now = new Date();
    const realMs = now.getTime() - new Date(now.toDateString()).getTime(); 
    const { h, m, s } = calculateNTime(realMs); 
    
    const clockDisplay = document.getElementById('n-clock-display');
    if (clockDisplay) {
        const hStr = String(h).padStart(2, '0');
        const mStr = String(m).padStart(2, '0');
        const sStr = String(s).padStart(2, '0');
        clockDisplay.textContent = `${hStr}:${mStr}${isSecondsVisible ? ':' + sStr : ''}`;
    }

    const nDisplay = document.getElementById('n-value-display');
    if (nDisplay) {
        nDisplay.textContent = `N = ${currentN}`;
    }
}

// --- 描画関数 ---
function renderClockMode() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="mode-title">${translations[currentLang]['nav-clock']}</div>
        <div id="n-clock-display" class="clock-display">00:00:00</div>
        <div class="control-panel">
            <label style="font-weight:700;">1日の時間 (N)</label>
            <input type="range" id="n-slider" min="${MIN_N}" max="${MAX_N}" value="${currentN}">
            <div id="n-value-display" style="text-align:center; font-weight:700;">N = ${currentN}</div>
        </div>
        <button id="pip-btn" class="action-button">${translations[currentLang]['pip-btn']}</button>
        ${isPresetFeatureEnabled ? `
            <div class="preset-container">
                <div class="preset-header">
                    <h3>プリセット</h3>
                    <button class="action-button" onclick="addCurrentNToPresets()">保存</button>
                </div>
                <ul class="preset-list" id="preset-list-ui"></ul>
            </div>
        ` : ''}
    `;
    
    const slider = document.getElementById('n-slider');
    slider.addEventListener('input', (e) => {
        currentN = parseInt(e.target.value);
        updateClock();
    });

    document.getElementById('pip-btn').addEventListener('click', togglePiP);
    
    if (isPresetFeatureEnabled) {
        renderPresetsList();
    }
}

function renderPresetsList() {
    const listUi = document.getElementById('preset-list-ui');
    if (!listUi) return;
    listUi.innerHTML = '';
    presets.forEach(preset => {
        const li = document.createElement('li');
        li.className = 'preset-item';
        li.innerHTML = `
            <div style="flex-grow:1" onclick="applyPreset(${preset.n})">
                <span style="font-weight:600;">${preset.name}</span>
                <span style="color:#8E8E93; font-size:14px; margin-left:8px;">(N=${preset.n})</span>
            </div>
            <button class="delete-btn" onclick="deletePreset(${preset.id})">削除</button>
        `;
        listUi.appendChild(li);
    });
}

function applyPreset(n) {
    currentN = n;
    renderClockMode();
}

function addCurrentNToPresets() {
    const name = prompt("プリセット名を入力してください", `プラン${presets.length + 1}`);
    if (name) {
        presets.push({ id: nextPresetId++, name: name, n: currentN });
        renderPresetsList();
    }
}

function deletePreset(id) {
    presets = presets.filter(p => p.id !== id);
    renderPresetsList();
}

function renderStopwatchMode() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="mode-title">${translations[currentLang]['nav-stopwatch']}</div>
        <div id="stopwatch-display" class="clock-display">00:00.00</div>
        <div class="stopwatch-controls">
            <button id="lap-reset-btn" class="rounded-square-btn gray-btn">${stopwatchTimer ? 'ラップ' : 'リセット'}</button>
            <button id="start-stop-btn" class="rounded-square-btn ${stopwatchTimer ? 'stop' : 'start'}">${stopwatchTimer ? 'ストップ' : 'スタート'}</button>
        </div>
        <ul id="lap-list" class="lap-list"></ul>
    `;
    
    document.getElementById('start-stop-btn').addEventListener('click', toggleStopwatch);
    document.getElementById('lap-reset-btn').addEventListener('click', handleLapOrReset);
    renderLaps();
    updateStopwatchDisplay();
}

function toggleStopwatch() {
    if (!stopwatchTimer) {
        stopwatchStartTime = Date.now();
        stopwatchTimer = setInterval(updateStopwatchDisplay, 10);
    } else {
        clearInterval(stopwatchTimer);
        stopwatchElapsedTime += Date.now() - stopwatchStartTime;
        stopwatchTimer = null;
    }
    renderStopwatchMode();
}

function updateStopwatchDisplay() {
    const display = document.getElementById('stopwatch-display');
    if (!display) return;
    
    const currentTotalMs = stopwatchElapsedTime + (stopwatchTimer ? Date.now() - stopwatchStartTime : 0);
    const n_world_ms = currentTotalMs * (24 / currentN);
    
    const totalSeconds = Math.floor(n_world_ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((n_world_ms % 1000) / 10);
    
    display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

function handleLapOrReset() {
    if (stopwatchTimer) {
        const currentTotalMs = (stopwatchElapsedTime + (Date.now() - stopwatchStartTime)) * (24 / currentN);
        const lapTime = currentTotalMs - lastLapTimeTotal;
        lapTimes.push(lapTime);
        lastLapTimeTotal = currentTotalMs;
        renderLaps();
    } else {
        stopwatchElapsedTime = 0;
        lapTimes = [];
        lastLapTimeTotal = 0;
        renderStopwatchMode();
    }
}

function renderLaps() {
    const lapListUi = document.getElementById('lap-list');
    if (!lapListUi) return;
    lapListUi.innerHTML = '';
    [...lapTimes].reverse().forEach((lap, index) => {
        const li = document.createElement('li');
        li.className = 'lap-item';
        const lapSeconds = (lap / 1000).toFixed(2);
        li.innerHTML = `<span>ラップ ${lapTimes.length - index}</span><span>${lapSeconds}s</span>`;
        lapListUi.appendChild(li);
    });
}

function renderAlarmMode() {
    document.getElementById('content-area').innerHTML = `<div class="mode-title">${translations[currentLang]['nav-alarm']}</div><p style="text-align:center; color:#8E8E93; margin-top:50px;">アラーム機能準備中</p>`;
}

function renderSettingsMode() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="mode-title">${translations[currentLang]['nav-settings']}</div>
        <div class="control-panel">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <span>秒数を表示</span>
                <input type="checkbox" id="seconds-toggle" ${isSecondsVisible ? 'checked' : ''} style="width:20px; height:20px;">
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span>プリセット機能</span>
                <input type="checkbox" id="preset-toggle" ${isPresetFeatureEnabled ? 'checked' : ''} style="width:20px; height:20px;">
            </div>
        </div>
    `;
    
    document.getElementById('seconds-toggle').addEventListener('change', (e) => {
        isSecondsVisible = e.target.checked;
        updateClock();
    });
    document.getElementById('preset-toggle').addEventListener('change', (e) => {
        isPresetFeatureEnabled = e.target.checked;
    });
}

// --- PiP機能 (追記分) ---
let windowPip = null;
async function togglePiP() {
    if (!('documentPictureInPicture' in window)) {
        alert("お使いのブラウザはDocument Picture-in-Picture APIに対応していません。最新のChrome等でお試しください。");
        return;
    }
    if (windowPip) {
        windowPip.close();
        return;
    }

    windowPip = await window.documentPictureInPicture.requestWindow({
        width: 300,
        height: 160,
    });

    const pipDiv = windowPip.document.createElement("div");
    pipDiv.id = "pip-clock";
    const pipN = windowPip.document.createElement("div");
    pipN.id = "pip-n-val";

    const style = windowPip.document.createElement("style");
    style.textContent = `
        body {
            background: #000;
            color: #fff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            font-family: -apple-system, sans-serif;
        }
        #pip-clock { font-size: 48px; font-weight: 900; font-variant-numeric: tabular-nums; }
        #pip-n-val { font-size: 18px; color: #8E8E93; margin-top: 8px; }
    `;
    windowPip.document.head.append(style);
    windowPip.document.body.append(pipDiv, pipN);

    const updatePip = () => {
        if (!windowPip) return;
        const now = new Date();
        const realMs = now.getTime() - new Date(now.toDateString()).getTime();
        const { h, m, s } = calculateNTime(realMs);
        pipDiv.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        pipN.textContent = `N = ${currentN}`;
        windowPip.requestAnimationFrame(updatePip);
    };
    updatePip();

    windowPip.addEventListener("pagehide", () => {
        windowPip = null;
    });
}

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
    const tabs = {
        'nav-clock': renderClockMode,
        'nav-stopwatch': renderStopwatchMode,
        'nav-alarm': renderAlarmMode,
        'nav-settings': renderSettingsMode
    };

    Object.keys(tabs).forEach(tabId => {
        document.getElementById(tabId).addEventListener('click', (e) => {
            document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            tabs[tabId]();
        });
    });

    setInterval(updateClock, 1000);
    renderClockMode(); 
});
