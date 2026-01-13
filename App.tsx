// App.tsx
// React + TypeScript 用の最小プロトタイプ
// ダーク基調 + ネオンライム、運用UI(元PC)と親UI(スマホ)を同じサイズ感で表示
// Web Bluetooth は BLE(GATT)前提。サービスUUIDとキャラUUIDはあなたのデバイスに合わせて変更してください。

import React, { useEffect, useMemo, useRef, useState } from "react";

type SendState = "normal" | "chance" | "pinch";

const THEME = {
  bg: "#0A0C10",
  surface: "#191A1C",
  surface2: "#2E2E32",
  text: "#D6D6D9",
  subtext: "#A19E9B",
  neon: "#D5FD62",
  danger: "#FF5C5C",
};

const BLE = {
  // あなたのデバイスの UUID に置き換えてください
  serviceUUID: "0000ffe0-0000-1000-8000-00805f9b34fb",
  characteristicUUID: "0000ffe1-0000-1000-8000-00805f9b34fb",
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function encodeCommand(cmd: number, intensity: number) {
  // 例: [cmd, intensity]
  // cmd: 0 normal, 1 chance, 2 pinch, 99 stop
  const i = clamp(Math.round(intensity), 0, 100);
  return new Uint8Array([cmd & 0xff, i & 0xff]);
}

function useBleController() {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [deviceName, setDeviceName] = useState<string>("");
  const [status, setStatus] = useState<string>("未接続");
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const charRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  useEffect(() => {
    setIsSupported(Boolean((navigator as any).bluetooth));
  }, []);

  const disconnect = async () => {
    try {
      const dev = deviceRef.current;
      if (dev?.gatt?.connected) dev.gatt.disconnect();
    } catch {
    } finally {
      deviceRef.current = null;
      charRef.current = null;
      setIsConnected(false);
      setDeviceName("");
      setStatus("未接続");
    }
  };

  const connect = async () => {
    if (!isSupported) {
      setStatus("この環境ではBluetoothが使えません");
      return;
    }
    try {
      setStatus("接続中…");
      const dev = await navigator.bluetooth.requestDevice({
        filters: [{ services: [BLE.serviceUUID] }],
        optionalServices: [BLE.serviceUUID],
      });

      deviceRef.current = dev;
      setDeviceName(dev.name || "BLE Device");

      dev.addEventListener("gattserverdisconnected", () => {
        setIsConnected(false);
        setStatus("未接続");
      });

      const server = await dev.gatt!.connect();
      const service = await server.getPrimaryService(BLE.serviceUUID);
      const ch = await service.getCharacteristic(BLE.characteristicUUID);
      charRef.current = ch;

      setIsConnected(true);
      setStatus("接続済");
    } catch (e: any) {
      setIsConnected(false);
      setStatus("接続失敗");
    }
  };

  const send = async (cmd: number, intensity: number) => {
    const ch = charRef.current;
    if (!ch) throw new Error("No characteristic");
    const data = encodeCommand(cmd, intensity);
    await ch.writeValue(data);
  };

  return {
    isSupported,
    isConnected,
    deviceName,
    status,
    connect,
    disconnect,
    send,
  };
}

function Card(props: { title?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={styles.card}>
      {(props.title || props.right) && (
        <div style={styles.cardHeader}>
          <div style={styles.cardTitle}>{props.title}</div>
          <div>{props.right}</div>
        </div>
      )}
      <div>{props.children}</div>
    </div>
  );
}

function Pill(props: { text: string; tone?: "default" | "neon" | "danger" }) {
  const bg =
    props.tone === "neon"
      ? "rgba(213,253,98,0.16)"
      : props.tone === "danger"
      ? "rgba(255,92,92,0.16)"
      : "rgba(255,255,255,0.06)";
  const color =
    props.tone === "neon" ? THEME.neon : props.tone === "danger" ? THEME.danger : THEME.subtext;

  return (
    <span style={{ ...styles.pill, background: bg, color }}>
      {props.text}
    </span>
  );
}

function PrimaryButton(props: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neon" | "danger" | "ghost";
}) {
  const tone = props.tone || "neon";
  const base =
    tone === "neon"
      ? { background: THEME.neon, color: "#0A0C10" }
      : tone === "danger"
      ? { background: THEME.danger, color: "#0A0C10" }
      : { background: "rgba(255,255,255,0.06)", color: THEME.text, border: "1px solid rgba(255,255,255,0.12)" };

  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        ...styles.primaryBtn,
        ...base,
        opacity: props.disabled ? 0.45 : 1,
        cursor: props.disabled ? "not-allowed" : "pointer",
      }}
    >
      {props.label}
    </button>
  );
}

function Toggle(props: { value: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <div style={styles.rowBetween}>
      <div>
        <div style={{ color: THEME.text, fontSize: 14, fontWeight: 700 }}>{props.label}</div>
        {props.sub && <div style={{ color: THEME.subtext, fontSize: 12, marginTop: 4 }}>{props.sub}</div>}
      </div>
      <button
        onClick={() => props.onChange(!props.value)}
        style={{
          ...styles.toggle,
          background: props.value ? "rgba(213,253,98,0.25)" : "rgba(255,255,255,0.07)",
          borderColor: props.value ? "rgba(213,253,98,0.55)" : "rgba(255,255,255,0.12)",
        }}
      >
        <div
          style={{
            ...styles.toggleKnob,
            left: props.value ? 22 : 2,
            background: props.value ? THEME.neon : "rgba(255,255,255,0.55)",
          }}
        />
      </button>
    </div>
  );
}

function OperatorScreen() {
  const ble = useBleController();
  const [demo, setDemo] = useState<boolean>(true);
  const [sending, setSending] = useState<SendState>("normal");
  const [intensity, setIntensity] = useState<number>(60);
  const [toast, setToast] = useState<string>("");

  const canSend = demo || ble.isConnected;

  const showToast = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(""), 1400);
  };

  const sendState = async (st: SendState) => {
    setSending(st);

    const cmd = st === "normal" ? 0 : st === "chance" ? 1 : 2;

    if (demo) {
      // デモ: バイブだけで雰囲気を再現
      if (navigator.vibrate) {
        const pattern = st === "chance" ? [60, 60, 60] : st === "pinch" ? [140, 80, 140] : [40];
        navigator.vibrate(pattern);
      }
      showToast(`デモ送信: ${labelOfState(st)}`);
      return;
    }

    if (!ble.isConnected) {
      showToast("未接続です");
      return;
    }

    try {
      await ble.send(cmd, intensity);
      showToast(`送信: ${labelOfState(st)}`);
    } catch {
      showToast("送信失敗");
    }
  };

  const stop = async () => {
    if (demo) {
      if (navigator.vibrate) navigator.vibrate(0);
      showToast("デモ停止");
      return;
    }
    if (!ble.isConnected) {
      showToast("未接続です");
      return;
    }
    try {
      await ble.send(99, 0);
      showToast("停止送信");
    } catch {
      showToast("停止失敗");
    }
  };

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <div>
          <div style={styles.h1}>運用</div>
          <div style={styles.h2}>状態を送る</div>
        </div>
        <Pill text={demo ? "DEMO" : ble.status} tone={demo ? "neon" : ble.isConnected ? "neon" : "default"} />
      </div>

      <Card
        title="接続"
        right={
          ble.isConnected ? (
            <PrimaryButton label="切断" onClick={ble.disconnect} tone="ghost" />
          ) : (
            <PrimaryButton label="接続" onClick={ble.connect} tone="neon" disabled={!ble.isSupported} />
          )
        }
      >
        <div style={styles.rowBetween}>
          <div>
            <div style={{ color: THEME.text, fontSize: 14, fontWeight: 800 }}>
              {ble.isConnected ? ble.deviceName || "接続済" : "未接続"}
            </div>
            <div style={{ color: THEME.subtext, fontSize: 12, marginTop: 6 }}>
              {!ble.isSupported ? "この環境はWeb Bluetooth非対応" : "BLEデバイスを選択"}
            </div>
          </div>
          <Pill text={ble.isConnected ? "CONNECTED" : "DISCONNECTED"} tone={ble.isConnected ? "neon" : "default"} />
        </div>
      </Card>

      <Card title="モード">
        <Toggle
          value={demo}
          onChange={(v) => setDemo(v)}
          label="デモ"
          sub="実機なしで送信演出のみ。接続できない環境用"
        />
      </Card>

      <Card title="強さ">
        <div style={{ display: "grid", gap: 10 }}>
          <input
            type="range"
            min={0}
            max={100}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            style={styles.slider}
          />
          <div style={styles.rowBetween}>
            <Pill text={`強さ: ${Math.round(intensity)}`} />
            <div style={{ display: "flex", gap: 8 }}>
              <PrimaryButton label="弱" onClick={() => setIntensity(30)} tone="ghost" />
              <PrimaryButton label="中" onClick={() => setIntensity(60)} tone="ghost" />
              <PrimaryButton label="強" onClick={() => setIntensity(85)} tone="ghost" />
            </div>
          </div>
        </div>
      </Card>

      <Card title="試合状態">
        <div style={{ display: "grid", gap: 12 }}>
          <StateButton label="チャンス" active={sending === "chance"} onClick={() => sendState("chance")} disabled={!canSend} />
          <StateButton label="ピンチ" active={sending === "pinch"} onClick={() => sendState("pinch")} disabled={!canSend} />
          <StateButton label="通常" active={sending === "normal"} onClick={() => sendState("normal")} disabled={!canSend} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 6 }}>
            <PrimaryButton label="停止" onClick={stop} tone="danger" />
          </div>
        </div>
        <div style={{ color: THEME.subtext, fontSize: 12, marginTop: 14 }}>
          送信中: <span style={{ color: THEME.text, fontWeight: 800 }}>{labelOfState(sending)}</span>
        </div>
      </Card>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

function StateButton(props: { label: string; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        ...styles.stateBtn,
        borderColor: props.active ? "rgba(213,253,98,0.55)" : "rgba(255,255,255,0.12)",
        background: props.active ? "rgba(213,253,98,0.16)" : "rgba(255,255,255,0.06)",
        opacity: props.disabled ? 0.45 : 1,
        cursor: props.disabled ? "not-allowed" : "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: THEME.text, fontSize: 18, fontWeight: 900 }}>{props.label}</div>
        <Pill text={props.active ? "ACTIVE" : "SEND"} tone={props.active ? "neon" : "default"} />
      </div>
      <div style={{ color: THEME.subtext, fontSize: 12, marginTop: 10 }}>
        1タップで送信
      </div>
    </button>
  );
}

function labelOfState(st: SendState) {
  return st === "chance" ? "チャンス" : st === "pinch" ? "ピンチ" : "通常";
}

function ParentScreen() {
  const ble = useBleController();
  const [mode, setMode] = useState<"family" | "kids">("family");
  const [intensity, setIntensity] = useState<number>(55);
  const [paused, setPaused] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [lastSignal, setLastSignal] = useState<SendState>("normal");
  const [toast, setToast] = useState<string>("");
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [showNowWhat, setShowNowWhat] = useState<boolean>(false);

  const showToast = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(""), 1400);
  };

  const emergencyStop = async () => {
    try {
      if (!ble.isConnected) {
        showToast("未接続です");
        return;
      }
      await ble.send(99, 0);
      showToast("緊急停止");
    } catch {
      showToast("停止失敗");
    }
  };

  const applyIntensity = async (v: number) => {
    setIntensity(v);
    if (!ble.isConnected) return;
    try {
      // 強さだけ更新したいなら cmd を 10 とかにしてデバイス側で解釈
      await ble.send(10, v);
    } catch {
    }
  };

  const nowWhatText = useMemo(() => {
    if (lastSignal === "chance") return "チャンス: たたいて応援しよう";
    if (lastSignal === "pinch") return "ピンチ: よく見て応援の準備";
    return "通常: みんなで見守ろう";
  }, [lastSignal]);

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <div>
          <div style={styles.h1}>親</div>
          <div style={styles.h2}>セットアップと補助確認</div>
        </div>
        <Pill text={ble.isConnected ? "CONNECTED" : "DISCONNECTED"} tone={ble.isConnected ? "neon" : "default"} />
      </div>

      <Card
        title="ペアリング"
        right={
          ble.isConnected ? (
            <PrimaryButton label="切断" onClick={ble.disconnect} tone="ghost" />
          ) : (
            <PrimaryButton label="接続" onClick={ble.connect} tone="neon" disabled={!ble.isSupported} />
          )
        }
      >
        <div style={{ color: THEME.subtext, fontSize: 12 }}>
          年齢入力なし。刺激上限なし。親が強さを調整。
        </div>
      </Card>

      <Card title="観戦モード">
        <div style={{ display: "flex", gap: 10 }}>
          <Chip active={mode === "family"} label="親子モード" onClick={() => setMode("family")} />
          <Chip active={mode === "kids"} label="子どもモード" onClick={() => setMode("kids")} />
        </div>
      </Card>

      <Card title="強さ">
        <div style={{ display: "grid", gap: 10 }}>
          <input
            type="range"
            min={0}
            max={100}
            value={intensity}
            onChange={(e) => applyIntensity(Number(e.target.value))}
            style={styles.slider}
          />
          <div style={styles.rowBetween}>
            <Pill text={`強さ: ${Math.round(intensity)}`} />
            <div style={{ display: "flex", gap: 8 }}>
              <PrimaryButton label="弱" onClick={() => applyIntensity(30)} tone="ghost" />
              <PrimaryButton label="中" onClick={() => applyIntensity(55)} tone="ghost" />
              <PrimaryButton label="強" onClick={() => applyIntensity(80)} tone="ghost" />
            </div>
          </div>
        </div>
      </Card>

      <Card title="観戦中ホーム">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={styles.nowSignal}>
            <div style={{ color: THEME.subtext, fontSize: 12 }}>いまの合図</div>
            <div style={{ color: THEME.text, fontSize: 22, fontWeight: 950, marginTop: 6 }}>
              {labelOfState(lastSignal)}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <PrimaryButton label="今なに？" onClick={() => setShowNowWhat(true)} tone="neon" />
            <PrimaryButton label="チュートリアル" onClick={() => setShowTutorial(true)} tone="ghost" />
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <Toggle value={paused} onChange={setPaused} label="一時停止" sub="振動を一時的に止める" />
            <Toggle value={muted} onChange={setMuted} label="静音" sub="通知音などを出さない" />
          </div>

          <div style={{ marginTop: 4 }}>
            <PrimaryButton label="緊急停止" onClick={emergencyStop} tone="danger" />
          </div>

          <div style={{ color: THEME.subtext, fontSize: 12 }}>
            デモ用: 下のボタンで合図表示だけ更新
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Chip active={lastSignal === "chance"} label="チャンス" onClick={() => setLastSignal("chance")} />
            <Chip active={lastSignal === "pinch"} label="ピンチ" onClick={() => setLastSignal("pinch")} />
            <Chip active={lastSignal === "normal"} label="通常" onClick={() => setLastSignal("normal")} />
          </div>
        </div>
      </Card>

      {showTutorial && (
        <Modal title="30秒チュートリアル" onClose={() => setShowTutorial(false)}>
          <div style={{ display: "grid", gap: 10, color: THEME.text, fontSize: 14, lineHeight: 1.5 }}>
            <div>1 合図がきたら「いまの合図」を見る</div>
            <div>2 子どもに短く伝える</div>
            <div>3 チャンスはたたいて応援、ピンチはよく見て準備</div>
            <div style={{ color: THEME.subtext, fontSize: 12 }}>
              観戦の中心はフィールド。スマホは一瞬だけ。
            </div>
          </div>
        </Modal>
      )}

      {showNowWhat && (
        <Modal title="今なに？" onClose={() => setShowNowWhat(false)}>
          <div style={{ color: THEME.text, fontSize: 16, fontWeight: 900 }}>{nowWhatText}</div>
          <div style={{ color: THEME.subtext, fontSize: 12, marginTop: 10 }}>
            子どもにそのまま読める一文にしておく
          </div>
        </Modal>
      )}

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

function Chip(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      style={{
        ...styles.chip,
        borderColor: props.active ? "rgba(213,253,98,0.55)" : "rgba(255,255,255,0.12)",
        background: props.active ? "rgba(213,253,98,0.16)" : "rgba(255,255,255,0.06)",
      }}
    >
      <span style={{ color: THEME.text, fontSize: 13, fontWeight: 850 }}>{props.label}</span>
    </button>
  );
}

function Modal(props: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={styles.modalOverlay} onClick={props.onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={{ color: THEME.text, fontWeight: 950 }}>{props.title}</div>
          <button onClick={props.onClose} style={styles.modalClose}>
            閉じる
          </button>
        </div>
        <div style={{ marginTop: 12 }}>{props.children}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<"operator" | "parent">("operator");

  return (
    <div style={styles.app}>
      <div style={styles.phoneShell}>
        <div style={styles.topTabs}>
          <button
            onClick={() => setTab("operator")}
            style={{
              ...styles.tabBtn,
              background: tab === "operator" ? "rgba(213,253,98,0.18)" : "rgba(255,255,255,0.06)",
              borderColor: tab === "operator" ? "rgba(213,253,98,0.55)" : "rgba(255,255,255,0.12)",
            }}
          >
            運用
          </button>
          <button
            onClick={() => setTab("parent")}
            style={{
              ...styles.tabBtn,
              background: tab === "parent" ? "rgba(213,253,98,0.18)" : "rgba(255,255,255,0.06)",
              borderColor: tab === "parent" ? "rgba(213,253,98,0.55)" : "rgba(255,255,255,0.12)",
            }}
          >
            親
          </button>
        </div>

        {tab === "operator" ? <OperatorScreen /> : <ParentScreen />}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: "100vh",
    background: THEME.bg,
    display: "grid",
    placeItems: "center",
    padding: 18,
    color: THEME.text,
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans JP", "Apple Color Emoji", "Segoe UI Emoji"',
  },
  phoneShell: {
    width: "min(430px, 92vw)",
    borderRadius: 26,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
    overflow: "hidden",
  },
  topTabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    padding: 12,
    background: "rgba(255,255,255,0.02)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  tabBtn: {
    padding: "12px 10px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    color: THEME.text,
    fontWeight: 900,
    cursor: "pointer",
  },
  screen: {
    padding: 14,
    display: "grid",
    gap: 12,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 6,
  },
  h1: {
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: 0.3,
  },
  h2: {
    fontSize: 12,
    color: THEME.subtext,
    marginTop: 6,
  },
  card: {
    background: THEME.surface,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.10)",
    padding: 14,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 950,
    color: THEME.text,
  },
  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  pill: {
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    fontSize: 12,
    fontWeight: 900,
  },
  primaryBtn: {
    padding: "10px 12px",
    borderRadius: 16,
    border: "0px solid transparent",
    fontWeight: 950,
    fontSize: 13,
    minWidth: 86,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    position: "relative",
    cursor: "pointer",
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 999,
    position: "absolute",
    top: 1.5,
    transition: "left 160ms ease",
  },
  slider: {
    width: "100%",
    accentColor: THEME.neon as any,
  },
  stateBtn: {
    width: "100%",
    textAlign: "left",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.12)",
    padding: 14,
  },
  chip: {
    padding: "10px 12px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    cursor: "pointer",
  },
  nowSignal: {
    background: THEME.surface2,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    padding: 14,
  },
  toast: {
    position: "sticky",
    bottom: 12,
    marginTop: 4,
    background: "rgba(0,0,0,0.60)",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: "10px 12px",
    borderRadius: 16,
    color: THEME.text,
    fontSize: 13,
    fontWeight: 850,
    backdropFilter: "blur(10px)",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    display: "grid",
    placeItems: "center",
    padding: 14,
    zIndex: 50,
  },
  modal: {
    width: "min(420px, 92vw)",
    background: THEME.surface,
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 22,
    padding: 14,
    boxShadow: "0 30px 80px rgba(0,0,0,0.65)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  modalClose: {
    borderRadius: 14,
    padding: "8px 10px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: THEME.text,
    fontWeight: 900,
    cursor: "pointer",
  },
};
