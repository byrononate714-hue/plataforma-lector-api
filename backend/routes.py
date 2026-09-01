from flask import Blueprint, jsonify, request
from database import get_db_connection

api_routes = Blueprint('api', __name__)

@api_routes.route('/contenidos', methods=['GET'])
def buscar_contenidos():
    filtro_etiqueta = request.args.get('etiqueta')
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Error de conexión a la base de datos"}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        query = """
            SELECT c.id_contenido, c.titulo, c.autor, c.tipo, c.popularidad 
            FROM Contenido c
            JOIN Contenido_Etiqueta ce ON c.id_contenido = ce.id_contenido
            JOIN Etiqueta e ON ce.id_etiqueta = e.id_etiqueta
            WHERE 1=1
        """
        parametros = []
        if filtro_etiqueta:
            query += " AND e.nombre = %s"
            parametros.append(filtro_etiqueta)
            
        cursor.execute(query, tuple(parametros))
        resultados = cursor.fetchall()
        return jsonify({"data": resultados}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        cursor.close()
        conn.close()

@api_routes.route('/coleccion/agregar', methods=['POST'])
def agregar_a_coleccion():
    datos = request.get_json()
    if not datos or 'id_usuario' not in datos or 'id_contenido' not in datos:
        return jsonify({"error": "Faltan datos requeridos"}), 400
        
    id_usuario = datos['id_usuario']
    id_contenido = datos['id_contenido']
    
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Error BD"}), 500

    cursor = conn.cursor()
    try:
        conn.start_transaction()
        check_query = "SELECT id_coleccion FROM Coleccion_Usuario WHERE id_usuario = %s AND id_contenido = %s"
        cursor.execute(check_query, (id_usuario, id_contenido))
        if cursor.fetchone():
             return jsonify({"error": "El contenido ya está en la colección"}), 409
             
        insert_query = "INSERT INTO Coleccion_Usuario (id_usuario, id_contenido, fecha_agregado) VALUES (%s, %s, NOW())"
        cursor.execute(insert_query, (id_usuario, id_contenido))
        
        update_query = "UPDATE Contenido SET popularidad = popularidad + 1 WHERE id_contenido = %s"
        cursor.execute(update_query, (id_contenido,))

        conn.commit()
        return jsonify({"mensaje": "Contenido agregado", "id_coleccion": cursor.lastrowid}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()
