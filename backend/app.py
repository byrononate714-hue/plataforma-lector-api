from flask import Flask
from flask_cors import CORS
from routes import api_routes

app = Flask(__name__)
CORS(app) # Habilita CORS para el frontend

app.register_blueprint(api_routes, url_prefix='/api')

@app.route('/')
def home():
    return "Servidor Backend Lector+ en funcionamiento."

if __name__ == '__main__':
    app.run(debug=True, port=5000)
