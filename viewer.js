(function () {
    const STORAGE_KEY = "batViewerV1";
  
    const UUID = {
      service: "12345678-1234-5678-1234-56789abcdef0",
      patternChar: "12345678-1234-5678-1234-56789abcdef1",
      tapChar: "12345678-1234-5678-1234-56789abcdef2"
    };
  
    const CUE = {
      stop:   { name: "停止",   short: "休み", meaning: "いったん止めて落ち着こう。", action: "深呼吸しよう", phrase: "いったん休憩しよう。", patternId: 0 },
      chance: { name: "チャンス", short: "攻めどき", meaning: "いまは盛り上がる場面。いっしょに応援して流れを作ろう。", action: "応援してみよう", phrase: "今はチャンスだよ。いっしょに叩こう。", patternId: 1 },
      pinch:  { name: "ピンチ",  short: "守りどき", meaning: "静かに見守って、ここをしのぐと流れが変わる。", action: "静かに見よう", phrase: "ここは大事。静かに見守ろう。", patternId: 2 }
    };
  
    const MODE = {
      family:   { label: "親子モード" },
      calm:     { label: "おだやか" },
      standard: { label: "標準" },
      excite:   { label: "盛り上げ" }
    };
  
    const stateDefault = {
      screen: "setup",
      room: "demo",
  
      connected: false,
      deviceName: "",
  
      age: null,
      intensityLimit: 5,
  
      gameId: "today-1",
      mode: null,
      missionParent: "",
      missionChild: "",
  
      paused: false,
      muted: false,
  
      hitCount: 0,
      cueKey: "stop",
      cueCount: 0,
      lastCueAt: "",
      lastSeq: 0
    };
  
    let state = loadState();
  
    const BLE = {
      supported: !!(navigator.bluetooth && navigator.bluetooth.requestDevice),
      device: null,
      server: null,
      svc: null,
      chPattern: null,
      chTap: null
    };
  
    const tapTimes = [];
  
    const el = {
      topBarSub: byId("topBarSub"),
      footerLine: byId("footerLine"),
  
      screens: {
        setup: byId("screen-setup"),
        pregame: byId("screen-pregame"),
        live: byId("screen-live"),
        nowwhat: byId("screen-nowwhat"),
        trouble: byId("screen-trouble"),
        post: byId("screen-post")
      },
  
      roomInput: byId("roomInput"),
      syncStatus: byId("syncStatus"),
  
      devStatus: byId("devStatus"),
      devName: byId("devName"),
      bleHint: byId("bleHint"),
  
      ageValue: byId("ageValue"),
      intensityLimit: byId("intensityLimit"),
      intensityLimitValue: byId("intensityLimitValue"),
  
      gameSelect: byId("gameSelect"),
      modeValue: byId("modeValue"),
      missionParent: byId("missionParent"),
      missionChild: byId("missionChild"),
  
      cueName: byId("cueName"),
      cueShort: byId("cueShort"),
      cueUpdated: byId("cueUpdated"),
  
      nowCueTitle: byId("nowCueTitle"),
      nowCueMeaning: byId("nowCueMeaning"),
      nowCueAction: byId("nowCueAction"),
      nowCuePhrase: byId("nowCuePhrase"),
  
      chipSide: byId("chipSide"),
      chipDiff: byId("chipDiff"),
      chipHype: byId("chipHype"),
  
      hitCount: byId("hitCount"),
      hitsPerMin: byId("hitsPerMin"),
      blazeBadge: byId("blazeBadge"),
      flame: byId("flame"),
  
      postHits: byId("postHits"),
      postCues: byId("postCues"),
      postMode: byId("postMode"),
      postGame: byId("postGame"),
      postMessage: byId("postMessage")
    };
  
    const btn = {
      connect: byId("btnConnect"),
      disconnect: byId("btnDisconnect"),
  
      toPreGame: byId("toPreGame"),
      backToSetup: byId("backToSetup"),
  
      genMission: byId("btnGenMission"),
      startGame: byId("startGame"),
  
      nowwhat: byId("btnNowWhat"),
      backToLive: byId("backToLive"),
  
      toTrouble: byId("toTrouble"),
      backFromTrouble: byId("backFromTrouble"),
  
      pauseToggle: byId("pauseToggle"),
      muteToggle: byId("muteToggle"),
  
      troubleDisconnect: byId("btnTroubleDisconnect"),
      troubleConnect: byId("btnTroubleConnect"),
  
      emergencyStop: byId("btnEmergencyStop"),
      resume: byId("btnResume"),
  
      finishGame: byId("finishGame"),
      postToPreGame: byId("postToPreGame"),
      postToSetup: byId("postToSetup")
    };
  
    setupHandlers();
    showOnly(state.screen);
    renderAll();
    startPollingCue();
    startDummyMatchTicker();
    startRateTicker();
  
    function setupHandlers() {
      el.roomInput.value = state.room;
      el.roomInput.addEventListener("input", function () {
        state.room = (el.roomInput.value || "demo").trim();
        saveState();
        renderAll();
      });
  
      btn.connect.addEventListener("click", function () { connectFlow(); });
      btn.disconnect.addEventListener("click", function () { disconnectFlow(); });
  
      onEach(document.querySelectorAll("[data-age]"), function (node) {
        node.addEventListener("click", function () {
          state.age = parseInt(node.getAttribute("data-age"), 10);
          saveState();
          renderAll();
          highlightSelections();
        });
      });
  
      el.intensityLimit.addEventListener("input", function () {
        state.intensityLimit = parseInt(el.intensityLimit.value, 10);
        saveState();
        renderAll();
      });
  
      btn.toPreGame.addEventListener("click", function () {
        if (!state.age) {
          alert("年齢プリセットを選択してください");
          return;
        }
        go("pregame");
      });
  
      btn.backToSetup.addEventListener("click", function () { go("setup"); });
  
      el.gameSelect.addEventListener("change", function () {
        state.gameId = el.gameSelect.value;
        saveState();
        renderAll();
      });
  
      onEach(document.querySelectorAll("[data-mode]"), function (node) {
        node.addEventListener("click", function () {
          state.mode = node.getAttribute("data-mode");
          saveState();
          renderAll();
          highlightSelections();
        });
      });
  
      btn.genMission.addEventListener("click", function () {
        const m = generateMissions();
        state.missionParent = m.parent;
        state.missionChild = m.child;
        saveState();
        renderAll();
      });
  
      btn.startGame.addEventListener("click", function () {
        if (!state.mode) {
          alert("モードを選択してください");
          return;
        }
        if (!state.missionParent || !state.missionChild) {
          const m = generateMissions();
          state.missionParent = m.parent;
          state.missionChild = m.child;
        }
        state.hitCount = 0;
        state.cueKey = "stop";
        state.cueCount = 0;
        state.lastCueAt = "";
        tapTimes.length = 0;
        state.paused = false;
        state.muted = false;
        saveState();
        go("live");
        renderAll();
      });
  
      btn.nowwhat.addEventListener("click", function () { go("nowwhat"); });
      btn.backToLive.addEventListener("click", function () { go("live"); });
  
      btn.toTrouble.addEventListener("click", function () { go("trouble"); });
      btn.backFromTrouble.addEventListener("click", function () { go("live"); });
  
      btn.pauseToggle.addEventListener("click", function () {
        state.paused = !state.paused;
        saveState();
        renderAll();
      });
  
      btn.muteToggle.addEventListener("click", function () {
        state.muted = !state.muted;
        saveState();
        renderAll();
      });
  
      btn.troubleDisconnect.addEventListener("click", function () { disconnectFlow(); });
      btn.troubleConnect.addEventListener("click", function () { connectFlow(); });
  
      btn.emergencyStop.addEventListener("click", function () {
        state.paused = true;
        state.muted = true;
        saveState();
        renderAll();
        sendPattern(0);
        alert("停止しました");
      });
  
      btn.resume.addEventListener("click", function () {
        state.paused = false;
        state.muted = false;
        saveState();
        renderAll();
        const cue = CUE[state.cueKey] || CUE.stop;
        sendPattern(cue.patternId);
        alert("再開しました");
      });
  
      btn.finishGame.addEventListener("click", function () {
        go("post");
        renderPost();
      });
  
      btn.postToPreGame.addEventListener("click", function () { go("pregame"); });
  
      btn.postToSetup.addEventListener("click", function () {
        state = clone(stateDefault);
        saveState();
        go("setup");
        renderAll();
        highlightSelections();
      });
    }
  
    function renderAll() {
      renderHeader();
      renderConnection();
      renderSetup();
      renderPreGame();
      renderLive();
      renderNowWhat();
      renderFooter();
      highlightSelections();
    }
  
    function renderHeader() {
      const label = {
        setup: "初回セットアップ",
        pregame: "試合開始前",
        live: "観戦中",
        nowwhat: "いまなに？",
        trouble: "トラブル",
        post: "観戦後"
      }[state.screen] || "ー";
      el.topBarSub.textContent = label;
    }
  
    function renderFooter() {
      const t1 = state.connected ? "接続中" : "未接続";
      const t2 = "セッション " + state.room;
      el.footerLine.textContent = t1 + " / " + t2;
    }
  
    function renderConnection() {
      el.devStatus.textContent = state.connected ? "接続中" : "未接続";
      el.devName.textContent = state.deviceName ? state.deviceName : "ー";
      if (!BLE.supported) {
        el.bleHint.textContent = "この環境はWeb Bluetoothに未対応です。Bluefyで開いてください。";
      } else {
        el.bleHint.textContent = "接続を押して BatDemo を選択します。";
      }
    }
  
    function renderSetup() {
      el.ageValue.textContent = state.age ? (String(state.age) + "才") : "未選択";
      el.intensityLimit.value = String(state.intensityLimit);
      el.intensityLimitValue.textContent = String(state.intensityLimit);
    }
  
    function renderPreGame() {
      el.gameSelect.value = state.gameId || "today-1";
      el.modeValue.textContent = state.mode ? MODE[state.mode].label : "未選択";
      el.missionParent.textContent = state.missionParent || "未生成";
      el.missionChild.textContent = state.missionChild || "未生成";
      el.syncStatus.textContent = "稼働中";
    }
  
    function renderLive() {
      const cue = CUE[state.cueKey] || CUE.stop;
      el.cueName.textContent = cue.name;
      el.cueShort.textContent = cue.short;
      el.cueUpdated.textContent = state.lastCueAt ? state.lastCueAt : "ー";
  
      el.hitCount.textContent = String(state.hitCount);
  
      const perMin = countLastMinute();
      el.hitsPerMin.textContent = String(perMin);
  
      applyFlame(state.hitCount, perMin);
      btn.pauseToggle.textContent = state.paused ? "再開" : "一時停止";
      btn.muteToggle.textContent = state.muted ? "静音中" : "静音";
    }
  
    function renderNowWhat() {
      const cue = CUE[state.cueKey] || CUE.stop;
      el.nowCueTitle.textContent = cue.name;
      el.nowCueMeaning.textContent = cue.meaning;
      el.nowCueAction.textContent = cue.action;
      el.nowCuePhrase.textContent = cue.phrase;
    }
  
    function renderPost() {
      el.postHits.textContent = String(state.hitCount);
      el.postCues.textContent = String(state.cueCount);
      el.postMode.textContent = state.mode ? MODE[state.mode].label : "ー";
      el.postGame.textContent = state.gameId || "ー";
  
      let msg = "今日のがんばりを次回につなげよう。";
      if (state.hitCount >= 30) msg = "すごい。応援が形になったね。";
      if (state.hitCount >= 60) msg = "今日の熱量が伝わったね。";
      el.postMessage.textContent = msg;
    }
  
    function highlightSelections() {
      onEach(document.querySelectorAll("[data-age]"), function (node) {
        const age = parseInt(node.getAttribute("data-age"), 10);
        node.classList.toggle("selected", state.age === age);
      });
      onEach(document.querySelectorAll("[data-mode]"), function (node) {
        const key = node.getAttribute("data-mode");
        node.classList.toggle("selected", state.mode === key);
      });
    }
  
    function go(screenKey) {
      state.screen = screenKey;
      saveState();
      showOnly(screenKey);
      renderAll();
    }
  
    function showOnly(screenKey) {
      Object.keys(el.screens).forEach(function (k) {
        el.screens[k].classList.toggle("hidden", k !== screenKey);
      });
    }
  
    function generateMissions() {
      const parentPool = [
        "合図が来たら子どもに一言で説明する",
        "チャンスのときにいっしょに叩く",
        "ピンチのときは静かに見守る声かけをする"
      ];
      const childPool = [
        "チャンスの合図で3回叩く",
        "ピンチの合図では静かに見守る",
        "止まったら水分補給する"
      ];
      return { parent: pick(parentPool), child: pick(childPool) };
    }
  
    function pick(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }
  
    function saveState() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    }
  
    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return clone(stateDefault);
        return Object.assign(clone(stateDefault), JSON.parse(raw));
      } catch (e) {
        return clone(stateDefault);
      }
    }
  
    function clone(obj) {
      return JSON.parse(JSON.stringify(obj));
    }
  
    function byId(id) {
      return document.getElementById(id);
    }
  
    function onEach(list, fn) {
      Array.prototype.forEach.call(list, fn);
    }
  
    async function connectFlow() {
      if (!BLE.supported) {
        alert("この環境はWeb Bluetoothに未対応です。Bluefyで開いてください。");
        return;
      }
      try {
        const device = await navigator.bluetooth.requestDevice({
          filters: [{ name: "BatDemo" }],
          optionalServices: [UUID.service]
        });
  
        BLE.device = device;
        state.deviceName = device.name || "BatDemo";
  
        device.addEventListener("gattserverdisconnected", function () {
          state.connected = false;
          saveState();
          renderAll();
        });
  
        BLE.server = await device.gatt.connect();
        BLE.svc = await BLE.server.getPrimaryService(UUID.service);
  
        BLE.chPattern = await BLE.svc.getCharacteristic(UUID.patternChar);
        BLE.chTap = await BLE.svc.getCharacteristic(UUID.tapChar);
  
        await BLE.chTap.startNotifications();
        BLE.chTap.addEventListener("characteristicvaluechanged", onTapNotify);
  
        state.connected = true;
        saveState();
        renderAll();
  
        alert("接続しました");
      } catch (e) {
        state.connected = false;
        saveState();
        renderAll();
        alert("接続できませんでした。BluefyとBLE設定を確認してください。");
      }
    }
  
    async function disconnectFlow() {
      state.connected = false;
      saveState();
      renderAll();
      try {
        if (BLE.device && BLE.device.gatt && BLE.device.gatt.connected) {
          BLE.device.gatt.disconnect();
        }
      } catch (e) {}
    }
  
    function onTapNotify(ev) {
      if (state.screen !== "live") return;
      if (state.paused) return;
      try {
        const v = ev.target.value;
        if (v && v.byteLength >= 1) {
          const one = v.getUint8(0);
          if (one > 0) addTap();
        } else {
          addTap();
        }
      } catch (e) {
        addTap();
      }
    }
  
    function addTap() {
      state.hitCount = state.hitCount + 1;
      tapTimes.push(Date.now());
      trimOldTaps();
      saveState();
      renderAll();
    }
  
    function trimOldTaps() {
      const now = Date.now();
      while (tapTimes.length > 0) {
        if (tapTimes[0] >= now - 60000) break;
        tapTimes.shift();
      }
    }
  
    function countLastMinute() {
      trimOldTaps();
      return tapTimes.length;
    }
  
    function applyFlame(totalHits, perMin) {
      const level = clamp(Math.floor(totalHits / 10) + 1, 1, 5);
      el.flame.className = "flame on" + String(level);
  
      const blazing = perMin >= 50;
      el.flame.classList.toggle("blaze", blazing);
      el.blazeBadge.classList.toggle("hidden", !blazing);
    }
  
    function clamp(n, min, max) {
      if (n < min) return min;
      if (n > max) return max;
      return n;
    }
  
    async function sendPattern(patternId) {
      if (!state.connected) return;
      if (!BLE.chPattern) return;
      try {
        const buf = new Uint8Array([patternId & 255]);
        await BLE.chPattern.writeValue(buf);
      } catch (e) {}
    }
  
    let pollTimer = null;
  
    function startPollingCue() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(function () {
        pollCueOnce();
      }, 350);
    }
  
    async function pollCueOnce() {
      const room = encodeURIComponent(state.room || "demo");
      const since = String(state.lastSeq || 0);
      try {
        const res = await fetch("/api/cue?room=" + room + "&since=" + since, { cache: "no-store" });
        if (res.status === 204) return;
        if (!res.ok) return;
        const data = await res.json();
        if (!data || !data.seq) return;
  
        if (data.seq !== state.lastSeq) {
          state.lastSeq = data.seq;
          state.cueKey = data.cueKey || "stop";
          state.cueCount = state.cueCount + 1;
          state.lastCueAt = data.at || "";
          saveState();
          renderAll();
  
          if (!state.muted && !state.paused) {
            const cue = CUE[state.cueKey] || CUE.stop;
            sendPattern(cue.patternId);
          }
        }
        el.syncStatus.textContent = "稼働中";
      } catch (e) {
        el.syncStatus.textContent = "不安定";
      }
    }
  
    let dummyTicker = null;
  
    function startDummyMatchTicker() {
      if (dummyTicker) clearInterval(dummyTicker);
      dummyTicker = setInterval(function () {
        if (state.screen !== "live") return;
        if (state.paused) return;
        renderDummyMatchValues();
      }, 2500);
    }
  
    function renderDummyMatchValues() {
      const side = pick(["攻め", "守り"]);
      const diff = pick(["同点", "1点差", "2点差", "3点差"]);
      const hype = pick(["低", "中", "高"]);
      el.chipSide.textContent = "攻守: " + side;
      el.chipDiff.textContent = "点差: " + diff;
      el.chipHype.textContent = "盛り上がり: " + hype;
    }
  
    let rateTicker = null;
  
    function startRateTicker() {
      if (rateTicker) clearInterval(rateTicker);
      rateTicker = setInterval(function () {
        if (state.screen !== "live") return;
        const perMin = countLastMinute();
        el.hitsPerMin.textContent = String(perMin);
        applyFlame(state.hitCount, perMin);
      }, 500);
    }
  
    showOnly(state.screen);
  })();
  