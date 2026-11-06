from flask import Blueprint, jsonify, request
from bson.objectid import ObjectId
from bson.errors import InvalidId
from datetime import datetime
import jwt
from database import get_db_connection

api_routes = Blueprint('api', __name__)

# Clave secreta para firmar los tokens JWT
SECRET_KEY = "super_secreta_clave_lector" 

# ==========================================
# FUNCIÓN AUXILIAR: Formatear MongoDB a JSON
# ==========================================
def format_doc(doc):
    """Convierte ObjectId y datetime de MongoDB a texto para que Flask pueda enviarlo como JSON."""
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

# ==========================================
# RUTA: INICIO DE SESIÓN (JWT)
# ==========================================
@api_routes.route('/auth/login', methods=['POST'])
def login():
    datos = request.get_json()
    if not datos or 'correo' not in datos or 'password' not in datos:
        return jsonify({"error": "Faltan credenciales"}), 400
        
    correo = datos['correo']
    password = datos['password']

    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Error de conexión a MongoDB"}), 500

    # Busca al usuario en la colección NoSQL
    usuario = db.usuarios.find_one({"correo": correo, "estado": True})

    # Verifica la contraseña y genera el token
    if usuario and usuario.get('password') == password:
        token = jwt.encode({
            'sub': str(usuario['_id']),
            'correo': usuario['correo'],
            'rol': usuario.get('rol', 'Lector')
        }, SECRET_KEY, algorithm='HS256')

        # Actualiza el último login
        db.usuarios.update_one({"_id": usuario['_id']}, {"$set": {"ultimo_login": datetime.utcnow()}})

        return jsonify({
            "mensaje": "Inicio de sesión exitoso",
            "token": token,
            "usuario": {
                "_id": str(usuario['_id']),
                "nombre": usuario['nombre'],
                "correo": usuario['correo'],
                "rol": usuario.get('rol')
            }
        }), 200
    else:
        return jsonify({"error": "Credenciales inválidas"}), 401
# ==========================================
# RUTA: CREAR CUENTA (REGISTRO)
# ==========================================
@api_routes.route('/auth/register', methods=['POST'])
def register():
    datos = request.get_json()
    if not datos or 'nombre' not in datos or 'correo' not in datos or 'password' not in datos:
        return jsonify({"error": "Faltan datos requeridos (nombre, correo, password)"}), 400
        
    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Error de conexión a MongoDB"}), 500

    # Verificar si el correo ya existe
    if db.usuarios.find_one({"correo": datos['correo']}):
        return jsonify({"error": "El correo ya está registrado"}), 409

    # Crear el nuevo documento de usuario
    nuevo_usuario = {
        "nombre": datos['nombre'],
        "correo": datos['correo'],
        "password": datos['password'], # En un proyecto futuro esto debe ir hasheado (ej. bcrypt)
        "rol": "Lector",
        "fecha_registro": datetime.utcnow(),
        "ultimo_login": None,
        "estado": True,
        "coleccion": []
    }
    
    db.usuarios.insert_one(nuevo_usuario)
    
    return jsonify({"mensaje": "Usuario registrado exitosamente. Ahora puedes iniciar sesión."}), 201
# ==========================================
# RUTA: BUSCAR CONTENIDOS (NoSQL)
# ==========================================
@api_routes.route('/contenidos', methods=['GET'])
def buscar_contenidos():
    filtro_etiqueta = request.args.get('etiqueta')
    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Error de conexión a la base de datos NoSQL"}), 500

    try:
        query = {}
        if filtro_etiqueta:
            # Búsqueda dentro del arreglo embebido 'etiquetas'
            query["etiquetas.nombre"] = filtro_etiqueta

        cursor = db.contenidos.find(query)
        resultados = [format_doc(doc) for doc in cursor]

        return jsonify({"data": resultados}), 200
    except Exception as e:
        return jsonify({"error": f"Error al consultar contenidos: {str(e)}"}), 400

# ==========================================
# RUTA: AGREGAR A COLECCIÓN (Transacción NoSQL)
# ==========================================
@api_routes.route('/coleccion/agregar', methods=['POST'])
def agregar_a_coleccion():
    datos = request.get_json()
    if not datos or 'id_usuario' not in datos or 'id_contenido' not in datos:
        return jsonify({"error": "Faltan datos requeridos (id_usuario, id_contenido)"}), 400

    id_usuario_raw = datos['id_usuario']
    id_contenido_raw = datos['id_contenido']

    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Error de conexión a MongoDB"}), 500

    try:
        # Validación de ObjectIDs
        try:
            obj_id_contenido = ObjectId(id_contenido_raw)
            obj_id_usuario = ObjectId(id_usuario_raw)
        except InvalidId:
            return jsonify({"error": "Formato de ID inválido"}), 400

        # Verificar si el contenido existe
        contenido_doc = db.contenidos.find_one({"_id": obj_id_contenido})
        if not contenido_doc:
            return jsonify({"error": "El contenido no existe"}), 404

        # Verificar si el usuario existe
        usuario_doc = db.usuarios.find_one({"_id": obj_id_usuario})
        if not usuario_doc:
            return jsonify({"error": "Usuario no encontrado"}), 404

        # Validación: ¿El libro ya está en la colección personal?
        coleccion_actual = usuario_doc.get("coleccion", [])
        ya_existe = any(str(item.get("contenido_id")) == str(obj_id_contenido) for item in coleccion_actual)

        if ya_existe:
            return jsonify({"error": "El contenido ya está en la colección"}), 409

        # Inserción atómica en el documento del usuario ($push)
        nuevo_item = {
            "contenido_id": obj_id_contenido,
            "titulo": contenido_doc.get("titulo", "Sin título"),
            "fecha_agregado": datetime.utcnow()
        }
        db.usuarios.update_one(
            {"_id": obj_id_usuario},
            {"$push": {"coleccion": nuevo_item}}
        )

        # Incremento atómico de popularidad ($inc)
        db.contenidos.update_one(
            {"_id": obj_id_contenido},
            {"$inc": {"popularidad": 1}}
        )

        return jsonify({
            "mensaje": "Contenido agregado a la colección exitosamente",
            "id_contenido": str(obj_id_contenido)
        }), 201

    except Exception as e:
        return jsonify({"error": f"Error interno: {str(e)}"}), 500
# ==========================================
# NUEVA RUTA: CONTENIDOS MÁS POPULARES
# ==========================================
@api_routes.route('/contenidos/populares', methods=['GET'])
def populares():
    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Error de conexión a MongoDB"}), 500

    try:
        # Busca todos los contenidos, los ordena por popularidad descendente (-1) y limita a 6
        cursor = db.contenidos.find().sort("popularidad", -1).limit(6)
        resultados = [format_doc(doc) for doc in cursor]

        return jsonify({"data": resultados}), 200
    except Exception as e:
        return jsonify({"error": f"Error al consultar populares: {str(e)}"}), 400
# ==========================================
# NUEVA RUTA: OBTENER MI COLECCIÓN
# ==========================================
@api_routes.route('/usuario/coleccion', methods=['GET'])
def obtener_mi_coleccion():
    id_usuario_raw = request.args.get('id_usuario')
    if not id_usuario_raw:
        return jsonify({"error": "Falta id_usuario"}), 400

    db = get_db_connection()
    if db is None:
        return jsonify({"error": "Error de conexión a MongoDB"}), 500

    try:
        usuario_doc = db.usuarios.find_one({"_id": ObjectId(id_usuario_raw)})
        if not usuario_doc:
            return jsonify({"error": "Usuario no encontrado"}), 404
        
        # Extraemos el arreglo 'coleccion' embebido en el usuario
        coleccion = usuario_doc.get("coleccion", [])
        
        # Formateamos los IDs para que JSON los entienda
        for item in coleccion:
            if 'contenido_id' in item:
                item['contenido_id'] = str(item['contenido_id'])
            if 'fecha_agregado' in item and isinstance(item['fecha_agregado'], datetime):
                item['fecha_agregado'] = item['fecha_agregado'].isoformat()

        return jsonify({"data": coleccion}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# ==========================================
# NUEVA RUTA: SUBIR NUEVO CONTENIDO AL CATÁLOGO
# ==========================================
@api_routes.route('/contenidos/crear', methods=['POST'])
def crear_contenido():
    datos = request.get_json()
    if not datos:
        return jsonify({"error": "Faltan datos"}), 400
        
    db = get_db_connection()
    
    nuevo_contenido = {
        "titulo": datos.get('titulo', 'Sin título'),
        "autor": datos.get('autor', 'Anónimo'),
        "tipo": datos.get('tipo', 'General'),
        "popularidad": 0,
        "fecha_publicacion": datetime.utcnow(),
        # Embebemos la etiqueta automáticamente
        "etiquetas": [{"nombre": datos.get('etiqueta', 'General'), "descripcion": "Subido por usuario"}] 
    }
    
    resultado = db.contenidos.insert_one(nuevo_contenido)
    return jsonify({"mensaje": "Contenido subido con éxito", "id": str(resultado.inserted_id)}), 201
