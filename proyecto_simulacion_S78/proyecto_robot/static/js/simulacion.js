/**
 * SimulationEngine — Motor modular y extensible de simulaciones 2D en Canvas.
 *
 * Principios de Diseño de Software:
 * - Open/Closed Principle (OCP): La plataforma está abierta a nuevas simulaciones sin modificar
 *   el motor central. Cada simulación es una "Estrategia" registrada en `SimulationRegistry`.
 * - Strategy Pattern: Se intercambian dinámicamente los algoritmos de simulación.
 * - Single Responsibility Principle (SRP): El motor gestiona el bucle de renderizado, escalado
 *   y tiempo delta (dt); cada simulación se encarga exclusivamente de sus entidades y física.
 */

class SimulationRegistry {
    static _simulations = new Map();

    static register(id, metadata) {
        this._simulations.set(id, metadata);
    }

    static get(id) {
        return this._simulations.get(id);
    }

    static getAll() {
        return Array.from(this._simulations.entries());
    }
}

/**
 * ============================================================================
 * ESTRATEGIA 1: Cinemática Diferencial Interactiva (Teleoperada)
 * ============================================================================
 */
class DifferentialDriveSimulation {
    constructor() {
        this.nombre = "Cinemática Diferencial";
        this.descripcion = "Robot diferencial que responde a comandos WASD/botones trazando su trayectoria.";
        this.reset();
    }

    reset() {
        this.x = 200;
        this.y = 150;
        this.theta = 0; // Ángulo de orientación en radianes
        this.v = 0;     // Velocidad lineal
        this.w = 0;     // Velocidad angular
        this.radio = 18;
        this.rastro = [];
        this.maxRastro = 120;
    }

    update(dt, input, engine) {
        // Control interactivo
        let objetivoV = 0;
        let objetivoW = 0;
        const velMax = 90;
        const giroMax = 2.8;

        if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) objetivoV += velMax;
        if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) objetivoV -= velMax;
        if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) objetivoW -= giroMax;
        if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) objetivoW += giroMax;

        // Suavizado de inercia
        this.v += (objetivoV - this.v) * 0.15;
        this.w += (objetivoW - this.w) * 0.2;

        // Modelo cinemático diferencial: x' = v*cos(theta), y' = v*sin(theta), theta' = w
        this.theta += this.w * dt;
        this.x += this.v * Math.cos(this.theta) * dt;
        this.y += this.v * Math.sin(this.theta) * dt;

        // Mantener dentro de los bordes con rebote suave
        if (this.x < this.radio) { this.x = this.radio; this.v *= -0.5; }
        if (this.x > engine.width - this.radio) { this.x = engine.width - this.radio; this.v *= -0.5; }
        if (this.y < this.radio) { this.y = this.radio; this.v *= -0.5; }
        if (this.y > engine.height - this.radio) { this.y = engine.height - this.radio; this.v *= -0.5; }

        // Registrar estela si hay movimiento
        if (Math.abs(this.v) > 1 || Math.abs(this.w) > 0.05) {
            this.rastro.push({ x: this.x, y: this.y });
            if (this.rastro.length > this.maxRastro) this.rastro.shift();
        }
    }

    draw(ctx, engine) {
        // Dibujar estela
        if (this.rastro.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = "rgba(59, 130, 246, 0.35)";
            ctx.lineWidth = 3;
            ctx.moveTo(this.rastro[0].x, this.rastro[0].y);
            for (let i = 1; i < this.rastro.length; i++) {
                ctx.lineTo(this.rastro[i].x, this.rastro[i].y);
            }
            ctx.stroke();
        }

        // Dibujar robot con transformación de rotación
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.theta);

        // Ruedas laterales
        ctx.fillStyle = "#334155";
        ctx.fillRect(-14, -this.radio - 3, 28, 6); // Rueda izquierda
        ctx.fillRect(-14, this.radio - 3, 28, 6);  // Rueda derecha

        // Chasis
        ctx.fillStyle = "#2563eb";
        ctx.beginPath();
        ctx.roundRect(-16, -this.radio, 32, this.radio * 2, 6);
        ctx.fill();

        // Indicador de proa (frente)
        ctx.fillStyle = "#60a5fa";
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(8, -8);
        ctx.lineTo(8, 8);
        ctx.closePath();
        ctx.fill();

        // Centro del robot
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    getTelemetry() {
        return {
            x: Math.round(this.x),
            y: Math.round(this.y),
            angulo: `${Math.round((this.theta * 180 / Math.PI) % 360)}°`,
            velocidad: `${Math.round(this.v)} px/s`
        };
    }
}

/**
 * ============================================================================
 * ESTRATEGIA 2: Navegación Autónoma y Evasión con Sensores (LiDAR/Sonar)
 * ============================================================================
 */
class AutonomousObstacleAvoidanceSimulation {
    constructor() {
        this.nombre = "Navegación Autónoma";
        this.descripcion = "Robot autónomo con 3 sensores virtuales de proximidad que detectan y evaden obstáculos.";
        this.reset();
    }

    reset() {
        this.x = 80;
        this.y = 80;
        this.theta = 0.5;
        this.velocidadBase = 70;
        this.radio = 16;
        this.sensores = [
            { anguloRelativo: -0.45, distancia: 80, lectura: 80, hit: false }, // Izquierda
            { anguloRelativo: 0, distancia: 100, lectura: 100, hit: false },   // Frontal
            { anguloRelativo: 0.45, distancia: 80, lectura: 80, hit: false }   // Derecha
        ];
        this.obstaculos = [
            { x: 180, y: 120, radio: 32 },
            { x: 320, y: 190, radio: 40 },
            { x: 260, y: 70, radio: 26 },
            { x: 440, y: 130, radio: 35 }
        ];
    }

    update(dt, input, engine) {
        // Cálculo de lecturas de sensores contra obstáculos y paredes
        this.sensores.forEach(s => {
            const rayAngle = this.theta + s.anguloRelativo;
            const rayMaxX = this.x + Math.cos(rayAngle) * s.distancia;
            const rayMaxY = this.y + Math.sin(rayAngle) * s.distancia;

            let minDist = s.distancia;
            let hit = false;

            // Verificar contra obstáculos circulares
            this.obstaculos.forEach(obs => {
                // Intersección de rayo con círculo (aproximación por muestreo)
                for (let d = 5; d <= s.distancia; d += 6) {
                    const px = this.x + Math.cos(rayAngle) * d;
                    const py = this.y + Math.sin(rayAngle) * d;
                    const distObs = Math.hypot(px - obs.x, py - obs.y);
                    if (distObs <= obs.radio) {
                        if (d < minDist) {
                            minDist = d;
                            hit = true;
                        }
                        break;
                    }
                }
            });

            // Verificar límites del canvas
            for (let d = 5; d <= s.distancia; d += 8) {
                const px = this.x + Math.cos(rayAngle) * d;
                const py = this.y + Math.sin(rayAngle) * d;
                if (px <= 0 || px >= engine.width || py <= 0 || py >= engine.height) {
                    if (d < minDist) {
                        minDist = d;
                        hit = true;
                    }
                    break;
                }
            }

            s.lectura = minDist;
            s.hit = hit;
        });

        // Lógica de navegación autónoma reactiva (Braitenberg / Subsunción básica)
        const sIzq = this.sensores[0].lectura;
        const sFront = this.sensores[1].lectura;
        const sDer = this.sensores[2].lectura;

        if (sFront < 45 || sIzq < 35 || sDer < 35) {
            // Si está muy cerca de algo, gira hacia el lado con mayor espacio libre
            if (sIzq > sDer) {
                this.theta -= 3.0 * dt;
            } else {
                this.theta += 3.0 * dt;
            }
        } else {
            // Avance libre con corrección leve
            this.theta += (Math.random() - 0.5) * 0.2 * dt;
        }

        this.x += Math.cos(this.theta) * this.velocidadBase * dt;
        this.y += Math.sin(this.theta) * this.velocidadBase * dt;

        // Mantener dentro de bordes
        this.x = Math.max(this.radio, Math.min(engine.width - this.radio, this.x));
        this.y = Math.max(this.radio, Math.min(engine.height - this.radio, this.y));
    }

    draw(ctx, engine) {
        // Dibujar obstáculos
        this.obstaculos.forEach(obs => {
            ctx.fillStyle = "#334155";
            ctx.beginPath();
            ctx.arc(obs.x, obs.y, obs.radio, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "#475569";
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        // Dibujar rayos de los sensores
        this.sensores.forEach(s => {
            const rayAngle = this.theta + s.anguloRelativo;
            const endX = this.x + Math.cos(rayAngle) * s.lectura;
            const endY = this.y + Math.sin(rayAngle) * s.lectura;

            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = s.hit ? "rgba(239, 68, 68, 0.85)" : "rgba(34, 197, 94, 0.45)";
            ctx.lineWidth = 1.8;
            ctx.setLineDash([4, 3]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Punto de impacto
            if (s.hit) {
                ctx.fillStyle = "#ef4444";
                ctx.beginPath();
                ctx.arc(endX, endY, 3.5, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // Dibujar el robot
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.theta);

        ctx.fillStyle = "#10b981";
        ctx.beginPath();
        ctx.arc(0, 0, this.radio, 0, Math.PI * 2);
        ctx.fill();

        // Ojo de proa
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(8, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    getTelemetry() {
        return {
            x: Math.round(this.x),
            y: Math.round(this.y),
            angulo: `${Math.round((this.theta * 180 / Math.PI) % 360)}°`,
            sensorFrontal: `${Math.round(this.sensores[1].lectura)} px`
        };
    }
}

/**
 * ============================================================================
 * ESTRATEGIA 3: Rebote Elástico y Exploración Básica (Extensión del original)
 * ============================================================================
 */
class BouncingExplorerSimulation {
    constructor() {
        this.nombre = "Rebote Elástico";
        this.descripcion = "Evolución de la simulación original con vector de velocidad bidireccional y rastro.";
        this.reset();
    }

    reset() {
        this.tamano = 32;
        this.x = 30;
        this.y = 120;
        this.vx = 110;
        this.vy = 80;
        this.rebotes = 0;
    }

    update(dt, input, engine) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Rebote en X
        if (this.x <= 0) {
            this.x = 0;
            this.vx = Math.abs(this.vx);
            this.rebotes++;
        } else if (this.x + this.tamano >= engine.width) {
            this.x = engine.width - this.tamano;
            this.vx = -Math.abs(this.vx);
            this.rebotes++;
        }

        // Rebote en Y
        if (this.y <= 0) {
            this.y = 0;
            this.vy = Math.abs(this.vy);
            this.rebotes++;
        } else if (this.y + this.tamano >= engine.height) {
            this.y = engine.height - this.tamano;
            this.vy = -Math.abs(this.vy);
            this.rebotes++;
        }
    }

    draw(ctx, engine) {
        // Cuadrado del robot con sombra suave
        ctx.fillStyle = "#6366f1";
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.tamano, this.tamano, 6);
        ctx.fill();

        // Vector de velocidad
        ctx.strokeStyle = "#a5b4fc";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x + this.tamano / 2, this.y + this.tamano / 2);
        ctx.lineTo(this.x + this.tamano / 2 + this.vx * 0.25, this.y + this.tamano / 2 + this.vy * 0.25);
        ctx.stroke();
    }

    getTelemetry() {
        return {
            x: Math.round(this.x),
            y: Math.round(this.y),
            velocidad: `${Math.round(Math.hypot(this.vx, this.vy))} px/s`,
            rebotes: this.rebotes
        };
    }
}

// Registro de las estrategias disponibles
SimulationRegistry.register('diferencial', {
    name: 'Cinemática Diferencial & Teleoperación',
    create: () => new DifferentialDriveSimulation()
});

SimulationRegistry.register('autonoma', {
    name: 'Navegación Autónoma y Evasión con Sensores',
    create: () => new AutonomousObstacleAvoidanceSimulation()
});

SimulationRegistry.register('rebote', {
    name: 'Rebote Elástico y Exploración Básica',
    create: () => new BouncingExplorerSimulation()
});

/**
 * ============================================================================
 * MOTOR PRINCIPAL (SimulationEngine)
 * ============================================================================
 */
class SimulationEngine {
    constructor(canvasId = 'lienzo') {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        this.currentSimulation = null;
        this.isRunning = true;
        this.lastTime = 0;
        this.input = { keys: new Set() };

        // HUD elements
        this.hudCoords = document.getElementById('hudCoords');
        this.hudVel = document.getElementById('hudVel');
        this.hudExtra = document.getElementById('hudExtra');
        this.simSelect = document.getElementById('simSelect');
        this.btnTogglePlay = document.getElementById('btnTogglePlay');
        this.btnResetSim = document.getElementById('btnResetSim');

        this.init();
    }

    init() {
        this.setupListeners();
        this.populateSelect();

        // Cargar primera simulación registrada
        this.loadSimulation('diferencial');

        // Iniciar loop
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    setupListeners() {
        window.addEventListener('keydown', (e) => this.input.keys.add(e.code));
        window.addEventListener('keyup', (e) => this.input.keys.delete(e.code));

        if (this.simSelect) {
            this.simSelect.addEventListener('change', (e) => {
                this.loadSimulation(e.target.value);
            });
        }

        if (this.btnTogglePlay) {
            this.btnTogglePlay.addEventListener('click', () => {
                this.isRunning = !this.isRunning;
                this.btnTogglePlay.textContent = this.isRunning ? 'Pausar' : 'Reanudar';
            });
        }

        if (this.btnResetSim) {
            this.btnResetSim.addEventListener('click', () => {
                if (this.currentSimulation) this.currentSimulation.reset();
            });
        }
    }

    populateSelect() {
        if (!this.simSelect) return;
        this.simSelect.innerHTML = '';
        SimulationRegistry.getAll().forEach(([id, meta]) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = meta.name;
            this.simSelect.appendChild(opt);
        });
    }

    loadSimulation(id) {
        const meta = SimulationRegistry.get(id);
        if (meta) {
            this.currentSimulation = meta.create();
            const descEl = document.getElementById('simDescription');
            if (descEl) descEl.textContent = this.currentSimulation.descripcion;
        }
    }

    loop(currentTime) {
        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;

        if (this.isRunning && this.currentSimulation) {
            this.currentSimulation.update(dt, this.input, this);
            this.updateHud();
        }

        this.render();
        requestAnimationFrame((t) => this.loop(t));
    }

    render() {
        // Limpiar fondo con cuadrícula sutil
        this.ctx.fillStyle = '#0f172a';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Cuadrícula técnica sutil
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        const paso = 25;
        for (let x = 0; x < this.width; x += paso) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
        for (let y = 0; y < this.height; y += paso) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }

        // Renderizar simulación activa
        if (this.currentSimulation) {
            this.currentSimulation.draw(this.ctx, this);
        }
    }

    updateHud() {
        if (!this.currentSimulation || !this.currentSimulation.getTelemetry) return;
        const t = this.currentSimulation.getTelemetry();

        if (this.hudCoords) this.hudCoords.textContent = `X: ${t.x} | Y: ${t.y}`;
        if (this.hudVel) this.hudVel.textContent = t.velocidad || t.angulo || '—';
        if (this.hudExtra) this.hudExtra.textContent = t.sensorFrontal ? `Sensor: ${t.sensorFrontal}` : (t.rebotes !== undefined ? `Rebotes: ${t.rebotes}` : '');
    }
}

// Inicialización automática
document.addEventListener('DOMContentLoaded', () => {
    window.simulationEngine = new SimulationEngine();
});

// Exportar registro para que cualquier nuevo elemento o script pueda añadir simulaciones
window.SimulationRegistry = SimulationRegistry;
