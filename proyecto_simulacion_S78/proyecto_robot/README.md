# Proyecto Robot — Semanas 7-8 (Sistema Modular de Control y Simulación)

Plataforma web minimalista, modular y extensible desarrollada con Flask, HTML5 Canvas y CSS3 (Design Tokens), aplicando los principios del diseño de software (SOLID, Separación de Responsabilidades y Patrón Estrategia).

---

## 🚀 Cómo correr el proyecto

### 1. En tu laptop (Modo Simulado)
El entorno virtual ya se encuentra configurado con todas las dependencias (`Flask==3.0.3` y `gpiozero==2.0.1`).

Desde la carpeta `proyecto_robot`:
```bash
# Activar entorno virtual
source venv/bin/activate

# Iniciar servidor Flask
python app.py
```
Abre en tu navegador: **`http://localhost:5000`**

> **Nota de detección:** Como tu laptop no tiene pines GPIO de Raspberry Pi, el driver conmuta de manera automática y transparente al modo **Simulado**: los comandos se procesan en memoria, se imprimen en terminal y se transmiten a la consola de telemetría web.

### 2. En la Raspberry Pi (Control Físico Real)
1. Conecta los motores a los pines GPIO definidos (por defecto: 17, 18 para motor izquierdo; 22, 23 para motor derecho).
2. En la terminal de la Raspberry Pi:
```bash
source venv/bin/activate
python app.py
```
3. Desde tu celular, tablet o laptop conectada a la misma red WiFi, abre:
   `http://<IP_DE_LA_RASPBERRY>:5000` (obtén la IP con `hostname -I`).

---

## 🏛️ Arquitectura y Principios de Diseño de Software

### 1. Separación de Responsabilidades (Separation of Concerns - SoC)
- **Capa de Presentación y Estilos (`static/css/`)**:
  - `variables.css`: Sistema de tokens de diseño minimalista (colores, espaciados, tipografías, compatibilidad con modo oscuro).
  - `style.css`: Componentes modulares (tarjetas, D-Pad, insignias de estado, consola monospacio).
- **Capa de Abstracción de Red (`static/js/api.js`)**:
  - Clase `RobotApiClient`: Encapsula todas las peticiones `fetch`, control de timeouts y serialización JSON. Ningún botón interactúa con la red directamente sin pasar por este cliente.
- **Capa de Interacción y Telemetría (`static/js/control.js`)**:
  - Clase `RobotController`: Administra atajos de teclado, estados activos de botones, slider de velocidad (PWM) y sondeo periódico de sensores.
- **Capa de Simulación (`static/js/simulacion.js`)**:
  - `SimulationEngine`: Coordina el bucle de renderizado a 60 FPS en `<canvas>` independiente de las vistas.

### 2. Principio Open/Closed (Abierto a Extensión, Cerrado a Modificación)
Para añadir nuevas simulaciones no es necesario modificar el código central del lienzo. Basta con registrar una nueva estrategia:
```javascript
SimulationRegistry.register('mi_simulacion', {
    name: 'Mi Nueva Simulación',
    create: () => new MiSimulacionStrategy()
});
```

### 3. Principio de Inversión de Dependencias (DIP) y Patrón Estrategia en Python
En `robot_control.py`:
- `BaseRobotDriver`: Contrato abstracto que define las operaciones del robot.
- `SimulatedRobotDriver`: Implementación para desarrollo local y pruebas sin hardware.
- `GpioRobotDriver`: Implementación física con `gpiozero.Motor` y PWM.
- El servidor Flask (`app.py`) depende de la abstracción común, nunca de detalles específicos de los pines.

---

## 🎮 Controles y Atajos de Teclado
| Tecla | Acción |
| :--- | :--- |
| `W` o `↑` | Avanzar (Adelante) |
| `S` o `↓` | Retroceder (Atrás) |
| `A` o `←` | Girar a la Izquierda |
| `D` o `→` | Girar a la Derecha |
| `Espacio` | Parada Inmediata (E-Stop) |

---

## 🧩 Cómo implementar más elementos (Guía Rápida)

1. **Añadir nuevos sensores (ej. ultrasónico HC-SR04):**
   - En `robot_control.py`: Agrega la lectura en el driver físico.
   - En `app.py`: El endpoint `/api/sensores` ya expone el formato JSON listo.
   - En `templates/control.html`: Agrega una fila en la tarjeta de telemetría.
2. **Añadir nuevos actuadores (ej. servomotor o LEDs):**
   - Agrega un método `accionar_servo(angulo)` en `BaseRobotDriver` y su respectiva ruta `/api/servo` en `app.py`.
