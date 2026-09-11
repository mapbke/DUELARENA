from flask import Flask, render_template
from flask_socketio import SocketIO

app = Flask(__name__)

app.config["SECRET_KEY"] = "duoarena-dev-secret"

socketio = SocketIO(
    app,
    cors_allowed_origins="*"
)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/reaction")
def reaction():
    return render_template("reaction.html")


@app.route("/typing")
def typing():
    return render_template("typing.html")


@app.route("/stats")
def stats():
    return render_template("stats.html")


@socketio.on("connect")
def handle_connect():
    print("[+] Client connected")


@socketio.on("disconnect")
def handle_disconnect():
    print("[-] Client disconnected")


@socketio.on("player_ready")
def handle_ready(data):
    print("[READY]", data)
    socketio.emit("player_ready", data)


if __name__ == "__main__":
    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=True
    )
