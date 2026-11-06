const API_URL = 'http://localhost:5000/api';

// ==========================================
// 1. GESTIÓN DE NOTIFICACIONES (TOASTS)
// ==========================================
function mostrarToast(mensaje, esError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = mensaje;
    // Asigna la clase de color según el resultado (Verde para éxito, Rojo para error)
    toast.className = `toast ${esError ? 'error' : 'success'}`;
    toast.classList.remove('hidden');

    // Ocultar notificación tras 3.5 segundos
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3500);
}

// ==========================================
// 2. GESTIÓN DE AUTENTICACIÓN Y TOKEN JWT
// ==========================================
function guardarSesion(token, usuario) {
    localStorage.setItem('jwt_token', token);
    if (usuario) {
        localStorage.setItem('usuario_info', JSON.stringify(usuario));
    }
}

function obtenerToken() {
    return localStorage.getItem('jwt_token');
}

function obtenerUsuario() {
    const usuarioStr = localStorage.getItem('usuario_info');
    return usuarioStr ? JSON.parse(usuarioStr) : null;
}

function cerrarSesion() {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('usuario_info');
    mostrarToast('Sesión cerrada correctamente', false);
}

/**
 * Genera los headers HTTP requeridos, incluyendo el Bearer Token para rutas protegidas.
 */
function obtenerHeaders(requiereAuth = false) {
    const headers = { 'Content-Type': 'application/json' };
    if (requiereAuth) {
        const token = obtenerToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }
    return headers;
}

/**
 * Inicia sesión en la API y almacena el JWT retornado.
 */
async function login(correo, password) {
    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: obtenerHeaders(false),
            body: JSON.stringify({ correo, password })
        });

        const data = await res.json();

        if (res.ok) {
            guardarSesion(data.token, data.usuario);
            mostrarToast(`¡Bienvenido, ${data.usuario.nombre}!`, false);
            return true;
        } else {
            mostrarToast(data.error || 'Credenciales inválidas', true);
            return false;
        }
    } catch (error) {
        console.error('Error al autenticar:', error);
        mostrarToast('Error de conexión con el servidor', true);
        return false;
    }
}

// ==========================================
// 3. CONSULTA DE CONTENIDOS (NoSQL)
// ==========================================
document.getElementById('btnBuscar')?.addEventListener('click', async () => {
    const etiquetaSelect = document.getElementById('etiqueta');
    const etiqueta = etiquetaSelect ? etiquetaSelect.value : '';
    const grid = document.getElementById('resultadosGrid');

    if (!etiqueta) {
        mostrarToast('Por favor, seleccione una etiqueta para filtrar', true);
        return;
    }

    try {
        const res = await fetch(`${API_URL}/contenidos?etiqueta=${encodeURIComponent(etiqueta)}`, {
            headers: obtenerHeaders(false)
        });

        const json = await res.json();

        if (!res.ok) {
            mostrarToast(json.error || 'Error al obtener los contenidos', true);
            return;
        }

        grid.innerHTML = '';
        if (!json.data || json.data.length === 0) {
            grid.innerHTML = '<p class="empty-msg">No se encontraron materiales con esta etiqueta.</p>';
            mostrarToast('No se encontraron resultados', true);
            return;
        }

        json.data.forEach(item => {
            // Compatibilidad con los ObjectIDs de MongoDB (_id)
            grid.innerHTML += `
                <div class="card">
                    <h3>${item.titulo}</h3>
                    <p><strong>Autor:</strong> ${item.autor}</p>
                    <p class="tag-badge"><strong>Tipo:</strong> ${item.tipo}</p>
                    <button class="btn-add" onclick="agregarColeccion('${item._id}')">+ A mi Colección</button>
                </div>`;
        });

        mostrarToast(`Búsqueda exitosa: ${json.data.length} contenidos encontrados`, false);

    } catch (e) {
        console.error('Error buscando contenidos:', e);
        mostrarToast('Error de comunicación con el servidor', true);
    }
});

// ==========================================
// 4. TRANSACCIÓN: AGREGAR A COLECCIÓN
// ==========================================
async function agregarColeccion(idContenido) {
    const usuario = obtenerUsuario();

    // Verificación preliminar en Frontend
    if (!usuario) {
        mostrarToast('Debes iniciar sesión para agregar a tu colección', true);
        return;
    }

    try {
        const res = await fetch(`${API_URL}/coleccion/agregar`, {
            method: 'POST',
            headers: obtenerHeaders(true), // Incluye la cabecera Authorization: Bearer <token>
            body: JSON.stringify({
                id_usuario: usuario._id || usuario.id_usuario,
                id_contenido: idContenido
            })
        });

        const data = await res.json();

        // Evaluación de Notificaciones Visuales según Código de Estado HTTP
        switch (res.status) {
            case 201:
                mostrarToast(data.mensaje || '¡Contenido agregado a tu colección!', false);
                break;
            case 409:
                mostrarToast('⚠️ Este libro ya está en tu colección personal', true);
                break;
            case 401:
            case 403:
                mostrarToast('🔒 Sesión expirada o token no válido. Inicia sesión de nuevo.', true);
                break;
            case 404:
                mostrarToast('El contenido o usuario especificado no existe', true);
                break;
            default:
                mostrarToast(data.error || 'Ocurrió un error inesperado', true);
                break;
        }

    } catch (e) {
        console.error('Error al agregar a la colección:', e);
        mostrarToast('Error de red al procesar la solicitud', true);
    }
}
// ==========================================
// 5. EVENTOS DE INTERFAZ Y MANEJO DE SESIÓN
// ==========================================

// Se ejecuta apenas carga la página web
document.addEventListener('DOMContentLoaded', () => {
    verificarEstadoSesion();
});

// Evento: Botón de Iniciar Sesión
document.getElementById('btnLogin')?.addEventListener('click', async () => {
    const correo = document.getElementById('loginCorreo').value.trim();
    const pass = document.getElementById('loginPassword').value.trim();

    if (!correo || !pass) {
        mostrarToast('Por favor, completa ambos campos', true);
        return;
    }

    // Llama a la función login() que creamos en la Parte 3
    const exito = await login(correo, pass);
    if (exito) {
        verificarEstadoSesion();
    }
});

// Evento: Botón de Cerrar Sesión
document.getElementById('btnLogout')?.addEventListener('click', () => {
    cerrarSesion(); // Elimina el token del localStorage
    verificarEstadoSesion(); // Restaura la interfaz
});

// Cambia entre el formulario de login y la aplicación principal
function verificarEstadoSesion() {
    const token = obtenerToken();
    const usuario = obtenerUsuario();
    
    const formLogin = document.getElementById('loginFormContainer');
    const appMain = document.getElementById('appContainer');
    const userPanel = document.getElementById('userPanel');

    if (token && usuario) {
        // Usuario logueado: Mostrar App, ocultar Login
        formLogin.classList.add('hidden');
        appMain.classList.remove('hidden');
        userPanel.innerHTML = `<strong>👤 ${usuario.nombre}</strong> (${usuario.rol})`;
    } else {
        // Usuario sin sesión: Mostrar Login, ocultar App
        formLogin.classList.remove('hidden');
        appMain.classList.add('hidden');
        userPanel.innerHTML = '';
        document.getElementById('loginPassword').value = ''; // Limpiar campo de seguridad
    }
}
// ==========================================
// NUEVO: LÓGICA DE REGISTRO DE USUARIO
// ==========================================

// Alternar entre Login y Registro
document.getElementById('linkToRegister')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('loginBox').classList.add('hidden');
    document.getElementById('registerBox').classList.remove('hidden');
});

document.getElementById('linkToLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('registerBox').classList.add('hidden');
    document.getElementById('loginBox').classList.remove('hidden');
});

// Evento: Botón Registrarme
document.getElementById('btnRegister')?.addEventListener('click', async () => {
    const nombre = document.getElementById('regNombre').value.trim();
    const correo = document.getElementById('regCorreo').value.trim();
    const password = document.getElementById('regPassword').value.trim();

    if (!nombre || !correo || !password) {
        mostrarToast('Por favor, completa todos los campos', true);
        return;
    }

    try {
        const respuesta = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, correo, password })
        });
        
        const data = await respuesta.json();
        
        if (respuesta.ok) {
            mostrarToast('Cuenta creada con éxito. Inicia sesión.', false);
            // Limpiar campos y volver al login
            document.getElementById('regNombre').value = '';
            document.getElementById('regCorreo').value = '';
            document.getElementById('regPassword').value = '';
            document.getElementById('linkToLogin').click();
        } else {
            mostrarToast(`Error: ${data.error}`, true);
        }
    } catch (error) {
        mostrarToast('Error de conexión al servidor', true);
    }
});
