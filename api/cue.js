let store = {};

function nowIso() {
  return new Date().toISOString();
}

module.exports = async function handler(req, res) {
  const method = req.method || "GET";

  if (method === "GET") {
    const room = String((req.query && req.query.room) || "demo");
    const since = parseInt(String((req.query && req.query.since) || "0"), 10) || 0;

    if (!store[room]) {
      store[room] = { seq: 1, cueKey: "stop", at: nowIso() };
    }

    const cur = store[room];
    if (cur.seq === since) {
      res.status(204).end();
      return;
    }
    res.status(200).json(cur);
    return;
  }

  if (method === "POST") {
    let body = req.body;
    if (!body) {
      let raw = "";
      req.on("data", function (c) { raw += c; });
      req.on("end", function () {
        try { body = JSON.parse(raw); } catch (e) { body = {}; }
        writeCue(body, res);
      });
      return;
    }
    writeCue(body, res);
    return;
  }

  res.status(405).json({ ok: false });
};

function writeCue(body, res) {
  const room = String(body.room || "demo");
  const cueKey = String(body.cueKey || "stop");

  if (!store[room]) {
    store[room] = { seq: 1, cueKey: "stop", at: nowIso() };
  }

  const prev = store[room];
  const nextSeq = prev.seq + 1;
  store[room] = { seq: nextSeq, cueKey: cueKey, at: nowIso() };

  res.status(200).json(store[room]);
}
