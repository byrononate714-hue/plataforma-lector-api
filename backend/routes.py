from flask import Blueprint, jsonify, request
from bson.objectid import ObjectId
from bson.errors import InvalidId
from datetime import datetime
from database import get_db_connection

api_routes = Blueprint('api', __name__)

def format_doc(doc):
    """Auxiliar para convertir ObjectId y datetime a tipos serializables en JSON."""
    if not doc:
        return doc
    if '_id' in doc:
        doc['_id'] = str(doc['_id'])
    if 'coleccion' in doc:
        for item in doc['coleccion']:
            if 'contenido_id' in item:
                item['contenido_id'] = str(item['contenido_id'])
            if 'fecha_agregado' in item and isinstance(item['fecha_agregado'], datetime):
                item['fecha_agregado'] = item['fecha_agregado'].isoformat()
    if 'fecha_publicacion' in doc and isinstance(doc['fecha_publicacion'], datetime):
        doc['fecha_publicacion'] = doc['fecha_publicacion'].isoformat()
    return doc


@api_routes.route('/contenidos', methods=['GET'])
def buscar_contenidos():
    filtro_etiqueta = request.args.get('etiqueta')
    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Error de conexión a la base de datos NoSQL"}), 500

    try:
        query = {}
        if filtro_etiqueta:
            # Búsqueda sobre el arreglo embebido 'etiquetas'
            query["etiquetas.nombre"] = filtro_etiqueta

        cursor = db.contenidos.find(query)
        resultados = [format_doc(doc) for doc in cursor]

        return jsonify({"data": resultados}), 200
    except Exception as e:
        return jsonify({"error": f"Error al consultar contenidos: {str(e)}"}), 400


@api_routes.route('/coleccion/agregar', methods=['POST'])
def agregar_a_coleccion():
    datos = request.get_json()
    if not datos or 'id_usuario' not in datos or 'id_contenido' not in datos:
        return jsonify({"error": "Faltan datos requeridos (id_usuario, id_contenido)"}), 400

    id_usuario_raw = datos['id_usuario']
    id_contenido_raw = datos['id_contenido']

    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Error de conexión a la base de datos NoSQL"}), 500

    try:
        # Validación de formato de ObjectId para el contenido
        try:
            obj_id_contenido = ObjectId(id_contenido_raw)
        except InvalidId:
            return jsonify({"error": "id_contenido no es un ObjectId válido"}), 400

        # Verificar existencia del contenido en el catálogo
        contenido_doc = db.contenidos.find_one({"_id": obj_id_contenido})
        if not contenido_doc:
            return jsonify({"error": "El contenido especificado no existe"}), 404

        # Búsqueda del usuario (acepta ObjectId o identificador de migración)
        query_usuario = {}
        try:
            query_usuario["_id"] = ObjectId(id_usuario_raw)
        except InvalidId:
            query_usuario["_id"] = id_usuario_raw

        usuario_doc = db.usuarios.find_one(query_usuario)
        if not usuario_doc and isinstance(id_usuario_raw, int):
            usuario_doc = db.usuarios.find_one({"_id": id_usuario_raw})

        if not usuario_doc:
            return jsonify({"error": "Usuario no encontrado"}), 404

        # 1. Validación de duplicados en el arreglo embebido 'coleccion'
        coleccion_actual = usuario_doc.get("coleccion", [])
        ya_existe = any(str(item.get("contenido_id")) == str(obj_id_contenido) for item in coleccion_actual)

        if ya_existe:
            return jsonify({"error": "El contenido ya está en la colección personal"}), 409

        # 2. Agregar a la colección del usuario ($push atómico)
        nuevo_item = {
            "contenido_id": obj_id_contenido,
            "titulo": contenido_doc.get("titulo", "Sin título"),
            "fecha_agregado": datetime.utcnow()
        }

        db.usuarios.update_one(
            {"_id": usuario_doc["_id"]},
            {"$push": {"coleccion": nuevo_item}}
        )

        # 3. Incrementar popularidad del contenido ($inc atómico)
        db.contenidos.update_one(
            {"_id": obj_id_contenido},
            {"$inc": {"popularidad": 1}}
        )

        return jsonify({
            "mensaje": "Contenido agregado a la colección exitosamente",
            "id_contenido": str(obj_id_contenido)
        }), 201

    except Exception as e:
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500
