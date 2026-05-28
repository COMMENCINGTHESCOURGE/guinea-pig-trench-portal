/**
 * SOVEREIGN_AGENT_BRIDGE.js — [LEVEL_4_AUTONOMY]
 * Establishing the WebSocket link between the Terrain Substrate and the Python Decision Engine.
 */

class SovereignBridge {
    constructor(url = "ws://localhost:8765") {
        this.url = url;
        this.socket = null;
        this.connected = false;
        this.onAction = null; // Callback for received AI actions
    }

    connect() {
        this.socket = new WebSocket(this.url);
        
        this.socket.onopen = () => {
            console.log("[BRIDGE] Linked to Sovereign Agent Core.");
            this.connected = true;
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (this.onAction) this.onAction(data.action);
        };

        this.socket.onclose = () => {
            console.warn("[BRIDGE] Connection Severed. Re-anchoring...");
            this.connected = false;
            setTimeout(() => this.connect(), 5000);
        };
    }

    sendState(gameState) {
        if (this.connected) {
            this.socket.send(JSON.stringify(gameState));
        }
    }
}

window.SovereignBridge = SovereignBridge;
