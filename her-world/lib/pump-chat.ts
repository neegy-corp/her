import type { ChatMessage } from "./show";
export function normalizeChat(
  raw: unknown,
  mint: string,
  since: number,
): ChatMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const at =
    typeof value.timestamp === "number"
      ? value.timestamp
      : Date.parse(String(value.timestamp));
  if (
    value.roomId !== mint ||
    typeof value.id !== "string" ||
    typeof value.message !== "string" ||
    !value.message.trim() ||
    !Number.isFinite(at) ||
    at < since ||
    at > Date.now() + 10000
  )
    return null;
  return {
    id: value.id.slice(0, 180),
    author:
      typeof value.username === "string"
        ? value.username.slice(0, 60)
        : "viewer",
    text: value.message.slice(0, 400),
    at,
  };
}
export function openPumpChat(
  mint: string,
  receive: (message: ChatMessage) => void,
  report: (state: string) => void,
) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint))
    throw new Error("Invalid coin mint.");
  const since = Date.now();
  let socket: WebSocket,
    retry: ReturnType<typeof setTimeout>,
    heartbeat: ReturnType<typeof setTimeout>,
    stopped = false,
    attempts = 0;
  const seen = new Set<string>();
  function connect() {
    if (stopped) return;
    report("connecting");
    socket = new WebSocket(
      "wss://livechat.pump.fun/socket.io/?EIO=4&transport=websocket",
    );
    const watchdog = () => {
      clearTimeout(heartbeat);
      heartbeat = setTimeout(() => socket.close(), 45000);
    };
    watchdog();
    socket.onmessage = (event) => {
      const packet = String(event.data);
      if (packet.length > 200000) return;
      try {
        if (packet === "2") {
          socket.send("3");
          watchdog();
        } else if (packet.startsWith("0"))
          socket.send(
            "40" +
              JSON.stringify({
                origin: "https://pump.fun",
                timestamp: Date.now(),
                token: null,
              }),
          );
        else if (packet.startsWith("40"))
          socket.send(
            "420" +
              JSON.stringify([
                "joinRoom",
                { roomId: mint, username: "anonymous" },
              ]),
          );
        else if (packet.startsWith("430")) {
          const ack = JSON.parse(packet.slice(3));
          if (ack[0]?.error) {
            report("room rejected");
            stop();
            return;
          }
          attempts = 0;
          report("connected");
        } else if (packet.startsWith("42")) {
          const [kind, payload] = JSON.parse(packet.slice(2));
          if (kind !== "newMessage") return;
          const message = normalizeChat(payload, mint, since);
          if (message && !seen.has(message.id)) {
            seen.add(message.id);
            if (seen.size > 1000) seen.delete(seen.values().next().value!);
            receive(message);
          }
        } else if (packet.startsWith("44")) {
          report("authentication required");
          stop();
        }
      } catch {
        report("invalid chat packet");
      }
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      clearTimeout(heartbeat);
      if (!stopped) {
        report("reconnecting");
        retry = setTimeout(
          connect,
          Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)),
        );
      }
    };
  }
  function stop() {
    stopped = true;
    clearTimeout(retry);
    clearTimeout(heartbeat);
    socket?.close();
  }
  connect();
  return stop;
}
