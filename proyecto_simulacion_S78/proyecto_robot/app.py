from flask import Flask, render_template, request, jsonify
import robot_control

app = Flask(__name__)


@app.route("/")
def home():
    estado = robot_control.obtener_estado()
    return render_template("home.html", estado=estado, simulado=robot_control.SIMULADO)


@app.route("/simulaciones")
def simulaciones():
    estado = robot_control.obtener_estado()
    return render_template("simulacion.html", estado=estado, simulado=robot_control.SIMULADO)


@app.route("/control")
def control():
    estado = robot_control.obtener_estado()
    return render_template("control.html", estado=estado, simulado=robot_control.SIMULADO)


@app.route("/api/estado", methods=["GET"])
def api_estado():
    """Retorna el estado actual del robot y su telemetría reciente."""
    return jsonify(robot_control.obtener_estado())


@app.route("/api/mover", methods=["POST"])
def api_mover():
    """
    Recibe JSON: { "direccion": "adelante"|"atras"|"izquierda"|"derecha"|"detener", "velocidad"?: 0.0 - 1.0 }
    """
    data = request.get_json(silent=True) or {}
    direccion = data.get("direccion", "")
    velocidad = data.get("velocidad", 1.0)
    resultado = robot_control.mover(direccion, velocidad)
    return jsonify(resultado)


@app.route("/api/sensores", methods=["GET"])
def api_sensores():
    """
    Endpoint modular extensible para sensores de proximidad / telemetría.
    Permite acoplar sensores ultrasónicos o LiDAR reales en semanas posteriores.
    """
    return jsonify({
        "ok": True,
        "sensores": {
            "distancia_frontal_cm": 35.4,
            "distancia_izquierda_cm": 52.1,
            "distancia_derecha_cm": 48.0,
            "bateria_porcentaje": 94,
            "temperatura_c": 38.5
        }
    })


if __name__ == "__main__":
    # host="0.0.0.0" permite entrar desde otro dispositivo en la misma red
    # (por ejemplo, desde el celular o tablet, apuntando a la IP de la Raspberry Pi).
    app.run(host="0.0.0.0", port=5000, debug=True)
