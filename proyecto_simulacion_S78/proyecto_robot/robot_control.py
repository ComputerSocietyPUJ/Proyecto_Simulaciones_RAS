"""
Abstracción modular para el control del robot (físico o simulado).

Aplica principios SOLID de diseño de software:
- Single Responsibility: cada driver maneja únicamente la comunicación con su respectiva capa de hardware/simulación.
- Open/Closed: extensible para nuevos tipos de drivers (ej. PWM, ROS2, Serial/Arduino) sin alterar la interfaz pública.
- Liskov Substitution / Dependency Inversion: la aplicación depende de una interfaz abstracta común (BaseRobotDriver).
"""

from abc import ABC, abstractmethod
from datetime import datetime
import time

DIRECCIONES_VALIDAS = {"adelante", "atras", "izquierda", "derecha", "detener"}


class BaseRobotDriver(ABC):
    """Interfaz abstracta que define el contrato común para cualquier controlador de robot."""

    def __init__(self):
        self.direccion_actual = "detener"
        self.velocidad_actual = 1.0
        self.historial = []

    @abstractmethod
    def mover(self, direccion: str, velocidad: float = 1.0) -> dict:
        """Aplica la dirección y velocidad al robot."""
        pass

    def registrar_comando(self, direccion: str, velocidad: float, modo: str):
        """Registra el comando en el historial en memoria para telemetría."""
        self.direccion_actual = direccion
        self.velocidad_actual = max(0.0, min(1.0, float(velocidad)))
        evento = {
            "direccion": direccion,
            "velocidad": self.velocidad_actual,
            "modo": modo,
            "timestamp": datetime.now().strftime("%H:%M:%S")
        }
        self.historial.append(evento)
        if len(self.historial) > 50:
            self.historial.pop(0)

    @abstractmethod
    def obtener_estado(self) -> dict:
        """Retorna el estado actual del controlador y sus componentes."""
        pass


class SimulatedRobotDriver(BaseRobotDriver):
    """Driver para entornos de desarrollo (laptops sin GPIO / Raspberry Pi)."""

    def __init__(self):
        super().__init__()
        self.modo = "simulado"

    def mover(self, direccion: str, velocidad: float = 1.0) -> dict:
        velocidad_val = max(0.0, min(1.0, float(velocidad)))
        self.registrar_comando(direccion, velocidad_val, self.modo)
        print(f"[SIMULADO] Comando recibido: {direccion.upper()} | Velocidad: {int(velocidad_val * 100)}%")
        return {
            "ok": True,
            "modo": self.modo,
            "direccion": direccion,
            "velocidad": velocidad_val,
            "timestamp": time.time()
        }

    def obtener_estado(self) -> dict:
        return {
            "ok": True,
            "modo": self.modo,
            "simulado": True,
            "direccion": self.direccion_actual,
            "velocidad": self.velocidad_actual,
            "hardware": "Virtual Mock Controller",
            "pines": {
                "motor_izquierdo": [17, 18],
                "motor_derecho": [22, 23]
            },
            "historial": self.historial[-10:]
        }


class GpioRobotDriver(BaseRobotDriver):
    """Driver real utilizando gpiozero para Raspberry Pi."""

    def __init__(self, pin_izq_fwd=17, pin_izq_back=18, pin_der_fwd=22, pin_der_back=23):
        super().__init__()
        self.modo = "real"
        self.pines = {
            "motor_izquierdo": [pin_izq_fwd, pin_izq_back],
            "motor_derecho": [pin_der_fwd, pin_der_back]
        }
        from gpiozero import Motor
        # Se inicializan los motores con soporte PWM si está disponible
        self.motor_izquierdo = Motor(forward=pin_izq_fwd, backward=pin_izq_back)
        self.motor_derecho = Motor(forward=pin_der_fwd, backward=pin_der_back)

    def mover(self, direccion: str, velocidad: float = 1.0) -> dict:
        vel = max(0.0, min(1.0, float(velocidad)))
        self.registrar_comando(direccion, vel, self.modo)

        try:
            if direccion == "adelante":
                self.motor_izquierdo.forward(vel)
                self.motor_derecho.forward(vel)
            elif direccion == "atras":
                self.motor_izquierdo.backward(vel)
                self.motor_derecho.backward(vel)
            elif direccion == "izquierda":
                self.motor_izquierdo.backward(vel)
                self.motor_derecho.forward(vel)
            elif direccion == "derecha":
                self.motor_izquierdo.forward(vel)
                self.motor_derecho.backward(vel)
            elif direccion == "detener":
                self.motor_izquierdo.stop()
                self.motor_derecho.stop()

            return {
                "ok": True,
                "modo": self.modo,
                "direccion": direccion,
                "velocidad": vel,
                "timestamp": time.time()
            }
        except Exception as e:
            return {"ok": False, "error": f"Error de hardware GPIO: {str(e)}"}

    def obtener_estado(self) -> dict:
        return {
            "ok": True,
            "modo": self.modo,
            "simulado": False,
            "direccion": self.direccion_actual,
            "velocidad": self.velocidad_actual,
            "hardware": "Raspberry Pi GPIO",
            "pines": self.pines,
            "historial": self.historial[-10:]
        }


def _crear_driver():
    """Fábrica de driver con detección automática de hardware."""
    try:
        from gpiozero import Motor
        driver = GpioRobotDriver()
        simulado = False
        return driver, simulado
    except Exception as e:
        driver = SimulatedRobotDriver()
        simulado = True
        return driver, simulado


# Instancia única (Singleton) activa
driver_actual, SIMULADO = _crear_driver()


def mover(direccion: str, velocidad: float = 1.0) -> dict:
    """
    Función de compatibilidad directa con el backend original.
    direccion: 'adelante' | 'atras' | 'izquierda' | 'derecha' | 'detener'
    velocidad: float entre 0.0 y 1.0 (por defecto 1.0)
    """
    if direccion not in DIRECCIONES_VALIDAS:
        return {
            "ok": False,
            "error": f"Dirección no válida: '{direccion}'. Opciones: {list(DIRECCIONES_VALIDAS)}"
        }
    return driver_actual.mover(direccion, velocidad)


def obtener_estado() -> dict:
    """Consulta el estado del robot y la telemetría actual."""
    return driver_actual.obtener_estado()
