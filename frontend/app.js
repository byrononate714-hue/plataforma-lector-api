const API_URL = 'http://localhost:5000/api';

// ==========================================
// CONTROLADOR DE PANTALLAS (SPA)
// ==========================================
const vistas = {
    auth: document.getElementById('view-auth'),
    home: document.getElementById('view-home'),
    search: document.getElementById('view-search'),
    profile: document.getElementById('view-profile'),
    read: document.getElementById('view-read')
};

function cambiarPantalla(nombrePantalla) {
    Object.values(vistas).forEach(vista => {
        if (vista) vista.classList.add('hidden');
    });
    if (vistas[nombrePantalla]) {
        vistas[nombrePantalla].classList.remove('hidden');
    }
}

// ==========================================
// GESTIÓN DE NOTIFICACIONES (TOASTS)
// ==========================================
function mostrarToast(mensaje, esError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = mensaje;
    toast.className = `toast ${esError ? 'error' : 'success'}`;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3500);
}

// ==========================================
// GESTIÓN DE AUTENTICACIÓN Y TOKEN JWT
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
    cambiarPantalla('auth'); // Redirigir al Login al cerrar sesión
}

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

function verificarEstadoSesion() {
    const token = obtenerToken();
    const usuario = obtenerUsuario();

    // Elementos del Nav (Si tienes un menú de navegación global)
    const userPanel = document.getElementById('userPanel'); 

    if (token && usuario) {
        cambiarPantalla('home');
        if(userPanel) userPanel.innerHTML = `<strong>👤 ${usuario.nombre}</strong>`;
    } else {
        cambiarPantalla('auth');
        if(userPanel) userPanel.innerHTML = '';
        const passwordInput = document.getElementById('loginPassword');
        if (passwordInput) passwordInput.value = '';
    }
}

// ==========================================
// EVENTOS DE NAVEGACIÓN GLOBAL (Menú superior)
// ==========================================
document.getElementById('nav-home')?.addEventListener('click', (e) => { e.preventDefault(); cambiarPantalla('home'); });
document.getElementById('nav-search')?.addEventListener('click', (e) => { e.preventDefault(); cambiarPantalla('search'); });
document.getElementById('nav-profile')?.addEventListener('click', (e) => { e.preventDefault(); cambiarPantalla('profile'); });
document.getElementById('btnLogout')?.addEventListener('click', () => { cerrarSesion(); });

// ==========================================
// EVENTOS DE LOGIN Y REGISTRO (Pantalla 1)
// ==========================================
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

document.getElementById('btnLogin')?.addEventListener('click', async () => {
    const correo = document.getElementById('loginCorreo').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!correo || !password) {
        mostrarToast('Por favor, completa ambos campos', true);
        return;
    }

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
            verificarEstadoSesion();
        } else {
            mostrarToast(data.error || 'Credenciales inválidas', true);
        }
    } catch (error) {
        console.error('Error al autenticar:', error);
        mostrarToast('Error de conexión con el servidor', true);
    }
});

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

// ==========================================
// BÚSQUEDA DE CONTENIDOS (Pantalla 3)
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
            grid.innerHTML += `
                <div class="card">
                    <h3>${item.titulo}</h3>
                    <p><strong>Autor:</strong> ${item.autor}</p>
                    <p class="tag-badge"><strong>Tipo:</strong> ${item.tipo}</p>
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <button class="btn-add" onclick="agregarColeccion('${item._id}')">+ A mi Colección</button>
                        <button class="btn-primary" onclick="abrirLectura('${item.titulo}', '${item.autor}')" style="flex:1;">Leer</button>
                    </div>
                </div>`;
        });
        mostrarToast(`Búsqueda exitosa: ${json.data.length} resultados`, false);

    } catch (e) {
        mostrarToast('Error de comunicación con el servidor', true);
    }
});

// ==========================================
// TRANSACCIÓN: AGREGAR A COLECCIÓN
// ==========================================
async function agregarColeccion(idContenido) {
    const usuario = obtenerUsuario();
    if (!usuario) {
        mostrarToast('Debes iniciar sesión para agregar a tu colección', true);
        return;
    }

    try {
        const res = await fetch(`${API_URL}/coleccion/agregar`, {
            method: 'POST',
            headers: obtenerHeaders(true),
            body: JSON.stringify({
                id_usuario: usuario._id || usuario.id_usuario,
                id_contenido: idContenido
            })
        });

        const data = await res.json();
        switch (res.status) {
            case 201: mostrarToast(data.mensaje || '¡Contenido agregado a tu colección!', false); break;
            case 409: mostrarToast('⚠️ Este libro ya está en tu colección personal', true); break;
            case 401: 
            case 403: mostrarToast('🔒 Sesión expirada. Inicia sesión de nuevo.', true); cerrarSesion(); break;
            case 404: mostrarToast('El contenido o usuario especificado no existe', true); break;
            default: mostrarToast(data.error || 'Ocurrió un error inesperado', true); break;
        }
    } catch (e) {
        mostrarToast('Error de red al procesar la solicitud', true);
    }
}

// ==========================================
// MODO LECTURA (Pantalla 5)
// ==========================================
function abrirLectura(titulo, autor) {
    cambiarPantalla('read');
    
    // Obtener los elementos de la vista de lectura (asegúrate de tenerlos en el HTML)
    const tituloElement = document.getElementById('lecturaTitulo');
    const autorElement = document.getElementById('lecturaAutor');
    const contenidoElement = document.getElementById('lecturaContenido');

    if(tituloElement) tituloElement.textContent = titulo;
    if(autorElement) autorElement.textContent = `Por ${autor}`;
    if(contenidoElement) contenidoElement.innerHTML = `<p>Cargando el documento <strong>${titulo}</strong>...</p><br><p style="color: #666; font-style: italic;">(El contenido del PDF o texto iría renderizado en esta sección de lectura dedicada).</p>`;
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    verificarEstadoSesion();
});
