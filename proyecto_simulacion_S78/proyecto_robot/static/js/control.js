/**
 * RobotController — Manejador de la interfaz de control manual y telemetría.
 *
 * Principios aplicados:
 * - Single Responsibility: Encargado exclusivamente de coordinar la interacción del usuario
 *   (botones, teclado, sliders) y proyectar el feedback visual en el DOM.
 * - Inversión de dependencias: Utiliza la abstracción `window.robotApi`.
 */

class RobotController {
    constructor(api = window.robotApi) {
        this.api = api;
        this.velocidad = 1.0;
        this.teclasPresionadas = new Set();
        this.activeDirection = 'detener';

        // Elementos del DOM
        this.dpadButtons = document.querySelectorAll('button[data-dir]');
        this.speedSlider = document.getElementById('velocidadSlider');
        this.speedLabel = document.getElementById('velocidadValor');
        this.consoleLog = document.getElementById('consoleLog');
        this.btnClearLog = document.getElementById('btnClearLog');
        this.badgeModo = document.getElementById('badgeModo');
        this.estadoTexto = document.getElementById('estadoTexto');
        this.sensorFrontal = document.getElementById('sensorFrontal');
        this.sensorIzq = document.getElementById('sensorIzq');
        this.sensorDer = document.getElementById('sensorDer');

        this.init();
    }

    init() {
        this.setupButtons();
        this.setupKeyboard();
        this.setupSlider();
        this.setupClearLog();
        this.startTelemetryPolling();
        this.log('Sistema de control inicializado correctamente.', 'success');
    }

    /**
     * Vincula los botones del D-Pad.
     */
    setupButtons() {
        this.dpadButtons.forEach(button => {
            const dir = button.dataset.dir;

            // Click directo
            button.addEventListener('click', () => {
                this.ejecutarComando(dir);
            });
        });
    }

    /**
     * Habilita soporte para teclado (WASD, flechas de dirección y barra espaciadora).
     */
    setupKeyboard() {
        const mapaTeclas = {
            'KeyW': 'adelante',
            'ArrowUp': 'adelante',
            'KeyS': 'atras',
            'ArrowDown': 'atras',
            'KeyA': 'izquierda',
            'ArrowLeft': 'izquierda',
            'KeyD': 'derecha',
            'ArrowRight': 'derecha',
            'Space': 'detener'
        };

        window.addEventListener('keydown', (e) => {
            // Evitar captura si el usuario está escribiendo en un input
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

            if (mapaTeclas[e.code]) {
                e.preventDefault();
                const dir = mapaTeclas[e.code];

                if (!this.teclasPresionadas.has(e.code)) {
                    this.teclasPresionadas.add(e.code);
                    this.ejecutarComando(dir);
                    this.actualizarBotonVisual(dir, true);
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (mapaTeclas[e.code]) {
                this.teclasPresionadas.delete(e.code);
                const dir = mapaTeclas[e.code];
                this.actualizarBotonVisual(dir, false);

                // Si se suelta una tecla de movimiento continuo, opcionalmente se puede detener
                if (this.teclasPresionadas.size === 0 && dir !== 'detener') {
                    // Detener suave al soltar tecla
                    this.ejecutarComando('detener');
                }
            }
        });
    }

    /**
     * Configura el slider de velocidad porcentual (PWM).
     */
    setupSlider() {
        if (!this.speedSlider) return;

        this.speedSlider.addEventListener('input', (e) => {
            const porcentaje = parseInt(e.target.value, 10);
            this.velocidad = (porcentaje / 100);
            if (this.speedLabel) {
                this.speedLabel.textContent = `${porcentaje}%`;
            }
        });
    }

    setupClearLog() {
        if (this.btnClearLog && this.consoleLog) {
            this.btnClearLog.addEventListener('click', () => {
                this.consoleLog.innerHTML = '';
                this.log('Registro de telemetría limpiado.', 'warn');
            });
        }
    }

    /**
     * Envía la orden a través de la API y actualiza la consola y telemetría.
     */
    async ejecutarComando(direccion) {
        this.activeDirection = direccion;

        try {
            const res = await this.api.mover(direccion, this.velocidad);
            if (res.ok) {
                const modoLabel = res.modo === 'simulado' ? 'Simulado' : 'Hardware Pi';
                this.log(`Comando: [${direccion.toUpperCase()}] al ${Math.round(this.velocidad * 100)}% (${modoLabel})`);
                if (this.estadoTexto) {
                    this.estadoTexto.textContent = `${direccion.toUpperCase()} (${Math.round(this.velocidad * 100)}%)`;
                }
            } else {
                this.log(`Error del controlador: ${res.error}`, 'error');
            }
        } catch (err) {
            this.log(`Error de comunicación: ${err.message}`, 'error');
            if (this.estadoTexto) {
                this.estadoTexto.textContent = 'Error de conexión';
            }
        }
    }

    actualizarBotonVisual(direccion, activo) {
        const btn = document.querySelector(`button[data-dir="${direccion}"]`);
        if (btn) {
            btn.classList.toggle('active', activo);
        }
    }

    /**
     * Añade una línea con timestamp al visualizador de consola.
     */
    log(mensaje, tipo = 'info') {
        if (!this.consoleLog) return;

        const time = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = 'log-entry';

        const timeSpan = document.createElement('span');
        timeSpan.className = 'log-time';
        timeSpan.textContent = time;

        const msgSpan = document.createElement('span');
        msgSpan.className = `log-msg ${tipo}`;
        msgSpan.textContent = mensaje;

        entry.appendChild(timeSpan);
        entry.appendChild(msgSpan);
        this.consoleLog.appendChild(entry);
        this.consoleLog.scrollTop = this.consoleLog.scrollHeight;
    }

    /**
     * Muestreo periódico de telemetría y sensores.
     */
    startTelemetryPolling() {
        const actualizar = async () => {
            try {
                // Actualizar estado general
                const estado = await this.api.obtenerEstado();
                if (estado && estado.ok) {
                    if (this.badgeModo) {
                        this.badgeModo.textContent = estado.simulado ? 'Modo Simulado' : 'Hardware Real';
                        this.badgeModo.className = `status-pill ${estado.simulado ? 'simulado' : 'real'}`;
                    }
                }

                // Actualizar sensores si el widget existe
                const sen = await this.api.obtenerSensores();
                if (sen && sen.ok && sen.sensores) {
                    if (this.sensorFrontal) this.sensorFrontal.textContent = `${sen.sensores.distancia_frontal_cm} cm`;
                    if (this.sensorIzq) this.sensorIzq.textContent = `${sen.sensores.distancia_izquierda_cm} cm`;
                    if (this.sensorDer) this.sensorDer.textContent = `${sen.sensores.distancia_derecha_cm} cm`;
                }
            } catch (e) {
                // Silencioso en polling para no saturar la consola
            }
        };

        // Polling cada 3 segundos
        setInterval(actualizar, 3000);
    }
}

// Inicialización automática cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.robotController = new RobotController();
});
