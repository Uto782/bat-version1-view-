(function () {
    const el = {
      roomInput: document.getElementById("roomInput"),
      roomView: document.getElementById("roomView"),
      lastSend: document.getElementById("lastSend"),
      sendResult: document.getElementById("sendResult")
    };
  
    const btn = {
      chance: document.getElementById("btnChance"),
      pinch: document.getElementById("btnPinch"),
      stop: document.getElementById("btnStop")
    };
  
    const STORAGE_KEY = "batControllerV1";
    const state = loadState();
  
    el.roomInput.value = state.room;
    renderRoom();
  
    el.roomInput.addEventListener("input", function () {
      state.room = (el.roomInput.value || "demo").trim();
      saveState();
      renderRoom();
    });
  
    btn.chance.addEventListener("click", function () { sendCue("chance"); });
    btn.pinch.addEventListener("click", function () { sendCue("pinch"); });
    btn.stop.addEventListener("click", function () { sendCue("stop"); });
  
    function renderRoom() {
      el.roomView.textContent = state.room;
    }
  
    async function sendCue(cueKey) {
      const payload = { room: state.room, cueKey: cueKey };
      try {
        const res = await fetch("/api/cue", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          el.sendResult.textContent = "失敗";
          return;
        }
        const data = await res.json();
        el.lastSend.textContent = cueKey + " / " + (data.at || "");
        el.sendResult.textContent = "送信済み";
      } catch (e) {
        el.sendResult.textContent = "通信失敗";
      }
    }
  
    function saveState() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    }
  
    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { room: "demo" };
        const obj = JSON.parse(raw);
        return { room: obj.room || "demo" };
      } catch (e) {
        return { room: "demo" };
      }
    }
  })();
  