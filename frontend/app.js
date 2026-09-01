const API_URL = 'http://localhost:5000/api';
document.getElementById('btnBuscar').addEventListener('click', async () => {
    const etiqueta = document.getElementById('etiqueta').value;
    const grid = document.getElementById('resultadosGrid');
    if(!etiqueta) return alert("Seleccione una etiqueta");
    try {
        const res = await fetch(`${API_URL}/contenidos?etiqueta=${etiqueta}`);
        const json = await res.json();
        grid.innerHTML = '';
        json.data.forEach(item => {
            grid.innerHTML += `<div class="card">
                <h3>${item.titulo}</h3><p>${item.autor}</p>
                <button class="btn-add" onclick="agregarColeccion(${item.id_contenido})">+ Colección</button>
            </div>`;
        });
    } catch (e) { alert("Error buscando contenidos"); }
});

async function agregarColeccion(id) {
    try {
        const res = await fetch(`${API_URL}/coleccion/agregar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_usuario: 1, id_contenido: id })
        });
        if(res.ok) {
            const toast = document.getElementById('toast');
            toast.classList.remove('hidden');
            setTimeout(() => toast.classList.add('hidden'), 3000);
        } else {
            alert("Error al agregar");
        }
    } catch(e) { console.error(e); }
}
