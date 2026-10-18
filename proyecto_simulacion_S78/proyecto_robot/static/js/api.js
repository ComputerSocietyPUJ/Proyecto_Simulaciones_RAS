/**
 * RobotApiClient — Capa de abstracción de red (Service / API Client).
 *
 * Principio SOLID aplicado:
 * - Single Responsibility Principle (SRP): Aislar completamente las peticiones HTTP
 *   y el manejo de errores del resto de la interfaz y de la lógica de presentación.
 */

class RobotApiClient {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
        this.timeoutMs = 4000;
    }

    /**
     * Realiza un fetch con timeout integrado para evitar que la interfaz se congele.
     */
    async _request(endpoint, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...(options.headers || {})
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new Error(errorBody.error || `HTTP error ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Tiempo de espera agotado al conectar con el robot');
            }
            throw error;
        }
    }

    /**
     * Envía un comando de movimiento con velocidad opcional.
     * @param {'adelante'|'atras'|'izquierda'|'derecha'|'detener'} direccion 
     * @param {number} velocidad (0.0 a 1.0)
     */
    async mover(direccion, velocidad = 1.0) {
        return await this._request('/api/mover', {
            method: 'POST',
            body: JSON.stringify({ direccion, velocidad })
        });
    }

    /**
     * Detiene los motores inmediatamente (E-Stop).
     */
    async detener() {
        return await this.mover('detener', 0.0);
    }

    /**
     * Consulta el estado del hardware, pines y últimos comandos ejecutados.
     */
    async obtenerEstado() {
        return await this._request('/api/estado', { method: 'GET' });
    }

    /**
     * Consulta las lecturas de los sensores del robot.
     */
    async obtenerSensores() {
        return await this._request('/api/sensores', { method: 'GET' });
    }
}

// Instancia única (Singleton) lista para exportar o usar globalmente
window.robotApi = new RobotApiClient();
