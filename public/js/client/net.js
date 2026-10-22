// Conexão WebSocket com o servidor, com reconexão automática.
export class Net {
  constructor() {
    this.ws = null;
    this.handlers = {};
    this.queue = [];
    this.connected = false;
    this.wantReconnect = true;
    this.serverOffset = 0;
  }

  url() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}`;
  }

  connect() {
    return new Promise((resolve) => {
      const ws = new WebSocket(this.url());
      this.ws = ws;
      ws.onopen = () => {
        this.connected = true;
        this.authed = false;
        this.emit('open');
        resolve(true);
      };
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        if (m.t === 'auth' && m.now) this.serverOffset = m.now - Date.now();
        if (m.t === 'auth' && m.ok) {
          // mensagens guardadas enquanto offline só vão depois do login
          this.authed = true;
          for (const q of this.queue) ws.send(JSON.stringify(q));
          this.queue = [];
        }
        if (m.t === 'pong' && m.now) this.serverOffset = m.now - Date.now();
        this.emit(m.t, m);
      };
      ws.onclose = () => {
        const was = this.connected;
        this.connected = false;
        this.emit('close', { was });
        resolve(false);
        if (this.wantReconnect) setTimeout(() => this.reconnect(), 2500);
      };
      ws.onerror = () => {};
    });
  }

  async reconnect() {
    if (this.connected) return;
    const ok = await this.connect();
    if (ok) this.emit('reconnected');
  }

  send(m) {
    const pre = ['register', 'login', 'resume', 'ping'].includes(m.t);
    if (this.connected && this.ws.readyState === 1 && (this.authed || pre)) this.ws.send(JSON.stringify(m));
    else if (m.t === 'save' || m.t === 'chat') {
      // só o save mais recente importa
      if (m.t === 'save') this.queue = this.queue.filter((q) => q.t !== 'save');
      this.queue.push(m);
    }
  }

  on(t, fn) {
    (this.handlers[t] ||= []).push(fn);
  }

  off(t, fn) {
    this.handlers[t] = (this.handlers[t] || []).filter((f) => f !== fn);
  }

  emit(t, m) {
    for (const fn of this.handlers[t] || []) fn(m);
  }

  now() {
    return Date.now() + this.serverOffset;
  }
}

export const net = new Net();
