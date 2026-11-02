import os
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

# URI de conexión (variable de entorno para Render/Atlas o local por defecto)
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
DB_NAME = os.getenv('DB_NAME', 'lector_nosql_db')

def get_db_connection():
    """Establece y retorna la instancia de la base de datos en MongoDB."""
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        # Verifica que la base de datos responda (ping)
        client.admin.command('ping')
        return client[DB_NAME]
    except ConnectionFailure as e:
        print(f"Error al conectar a MongoDB: {e}")
        return None
