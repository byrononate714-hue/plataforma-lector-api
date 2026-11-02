from datetime import datetime
from pymongo import MongoClient, ASCENDING, DESCENDING
from bson.objectid import ObjectId

def inicializar_bd_nosql():
    # 1. Conexión a MongoDB (Local / Atlas)
    client = MongoClient("mongodb://localhost:27017/")
    db = client["lector_nosql_db"]

    # 2. Limpieza de colecciones previas
    db.usuarios.drop()
    db.contenidos.drop()
    print("✔ Colecciones anteriores eliminadas de 'lector_nosql_db'.")

    # 3. Creación de Índices
    db.usuarios.create_index([("correo", ASCENDING)], unique=True)
    db.contenidos.create_index([("etiquetas.nombre", ASCENDING)])
    db.contenidos.create_index([("popularidad", DESCENDING)])
    print("✔ Índices únicos y de búsqueda creados con éxito.")

    # 4. Inserción de Contenido Semilla
    id_contenido_algebra = ObjectId()
    doc_contenido = {
        "_id": id_contenido_algebra,
        "titulo": "Álgebra Lineal y sus Aplicaciones",
        "autor": "David C. Lay",
        "tipo": "Académico",
        "popularidad": 1,
        "fecha_publicacion": datetime.strptime("2015-05-20", "%Y-%m-%d"),
        "etiquetas": [
            {
                "nombre": "Ingeniería",
                "descripcion": "Material para ciencias exactas"
            }
        ]
    }
    db.contenidos.insert_one(doc_contenido)
    print(f"✔ Contenido insertado con _id: {id_contenido_algebra}")

    # 5. Inserción de Usuario Semilla con Colección Embebida
    doc_usuario = {
        "nombre": "Juan Pérez",
        "correo": "juan@email.com",
        "password": "hash_seguro_123", # En producción irá cifrado con bcrypt
        "rol": "Lector",
        "fecha_registro": datetime.utcnow(),
        "ultimo_login": None,
        "estado": True,
        "coleccion": [
            {
                "contenido_id": id_contenido_algebra,
                "titulo": "Álgebra Lineal y sus Aplicaciones",
                "fecha_agregado": datetime.utcnow()
            }
        ]
    }
    id_usuario_juan = db.usuarios.insert_one(doc_usuario).inserted_id
    print(f"✔ Usuario Lector insertado con _id: {id_usuario_juan}")

    print("\n¡Inicialización NoSQL completada exitosamente!")

if __name__ == "__main__":
    inicializar_bd_nosql()
