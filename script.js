/* =========================================
   1. CONFIGURACIÓN DE FIREBASE E INICIALIZACIÓN
   ========================================= */
const firebaseConfig = {
  apiKey: "AIzaSyCudmhzZXs5xbBEC1jQtVnQtUlvFEIOKXg",
  authDomain: "registro-mis-talentos-2026.firebaseapp.com",
  databaseURL: "https://registro-mis-talentos-2026-default-rtdb.firebaseio.com",
  projectId: "registro-mis-talentos-2026",
  storageBucket: "registro-mis-talentos-2026.firebasestorage.app",
  messagingSenderId: "369657950455",
  appId: "1:369657950455:web:d9432657403c1d78c723f2",
  measurementId: "G-B10SX3M879"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const estructuraColegio = {
    "INICIAL": ["3 años", "4 años", "5 años"],
    "PRIMARIA": ["1º Primaria", "2º Primaria", "3º Primaria", "4º Primaria", "5º Primaria", "6º Primaria"],
    "SECUNDARIA": ["1º Secundaria", "2º Secundaria", "3º Secundaria", "4º Secundaria", "5º Secundaria"]
};

// Variables de estado sincronizadas con la nube
let alumnosData = {};
let tutoresData = {};
let lastChecked = null; // Para deseleccionar radios

document.addEventListener('DOMContentLoaded', () => {
    fijarFechaHoy();
    
    // --- ESCUCHADORES EN TIEMPO REAL (FIREBASE) ---
    db.ref('alumnos').on('value', (snapshot) => {
        alumnosData = snapshot.val() || {};
        actualizarGrados(); 
    });

    db.ref('tutores').on('value', (snapshot) => {
        tutoresData = snapshot.val() || {};
        cargarTablaAsistencia();
    });

    // Reloj dinámico
    setInterval(() => {
        const reloj = document.getElementById('reloj');
        if(reloj) reloj.innerHTML = `<i class="far fa-clock"></i> ${new Date().toLocaleTimeString()}`;
    }, 1000);
});

function fijarFechaHoy() {
    const selector = document.getElementById('fechaAsistencia');
    const hoy = new Date();
    hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
    selector.value = hoy.toISOString().split('T')[0];
}

/* =========================================
   2. GESTIÓN DE GRADOS Y TUTORES
   ========================================= */
function actualizarGrados() {
    const nivel = document.getElementById('selectNivel').value;
    const combo = document.getElementById('selectGrado');
    const valorPrevio = combo.value;
    
    combo.innerHTML = '<option value="">Grado</option>';
    
    if (nivel && estructuraColegio[nivel]) {
        estructuraColegio[nivel].forEach(g => {
            let opt = document.createElement('option');
            opt.value = g; opt.innerText = g;
            if(g === valorPrevio) opt.selected = true;
            combo.appendChild(opt);
        });
    }
    cargarTablaAsistencia();
}

function guardarTutor() {
    const n = document.getElementById('selectNivel').value;
    const g = document.getElementById('selectGrado').value;
    const nombre = document.getElementById('nombreTutor').value.trim();
    
    if(!g) return alert("Seleccione grado primero");
    const key = `${n}_${g}`.replace(/ /g, "_");
    
    db.ref('tutores/' + key).set(nombre).then(() => {
        alert("✅ Tutor guardado en la nube");
    });
}

/* =========================================
   3. SISTEMA DE ASISTENCIA (CORE)
   ========================================= */
function cargarTablaAsistencia() {
    const n = document.getElementById('selectNivel').value;
    const g = document.getElementById('selectGrado').value;
    const f = document.getElementById('fechaAsistencia').value;
    const lista = document.getElementById('listaEstudiantes');
    const infoTutor = document.getElementById('infoTutorCabecera');
    const txtConteo = document.getElementById('txt-conteo-alumnos');

    lastChecked = null; // Reiniciar rastreador de deselección

    if (!g) {
        lista.innerHTML = '';
        txtConteo.innerText = "0";
        infoTutor.innerHTML = '<i class="fas fa-info-circle"></i> Seleccione un grado para comenzar';
        return;
    }

    const key = `${n}_${g}`.replace(/ /g, "_");
    const alumnos = (alumnosData[key] || []).sort();
    
    txtConteo.innerText = alumnos.length;
    document.getElementById('count-total').innerText = alumnos.length;
    infoTutor.innerHTML = tutoresData[key] ? `<i class="fas fa-chalkboard-teacher"></i> Tutor(a): ${tutoresData[key]}` : `<i class="fas fa-chalkboard-teacher"></i> Tutor no asignado`;

    if (alumnos.length === 0) {
        lista.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:30px; color:#999;">Grado sin alumnos registrados.</td></tr>';
        return;
    }

    db.ref(`asistencias/${key}/${f}`).once('value', (snapshot) => {
        const asisGuardada = snapshot.val() || [];
        lista.innerHTML = '';

        alumnos.forEach((nom, i) => {
            const reg = asisGuardada.find(x => x.alumno === nom) || {estado:'', nota:''};
            lista.innerHTML += `
                <tr>
                    <td>${i+1}</td>
                    <td class="nom-est"><b>${nom}</b></td>
                    <td>
                        <div class="attendance-btns">
                            ${['P','T','A','J'].map(e => `
                                <input type="radio" 
                                       name="r_${i}" 
                                       id="${e.toLowerCase()}_${i}" 
                                       value="${e}" 
                                       class="btn-check" 
                                       onchange="actualizarDashboard()" 
                                       onclick="toggleRadio(this)"
                                       ${reg.estado === e ? 'checked' : ''}>
                                <label for="${e.toLowerCase()}_${i}" class="btn-label">${e}</label>
                            `).join('')}
                        </div>
                        <input type="text" class="obs-input" placeholder="Nota..." id="obs_${i}" value="${reg.nota}">
                    </td>
                </tr>`;
        });
        actualizarDashboard();
    });
}

// Función nueva para deseleccionar
function toggleRadio(radio) {
    if (radio.dataset.wasChecked === "true") {
        radio.checked = false;
        radio.dataset.wasChecked = "false";
        actualizarDashboard();
    } else {
        // Limpiar otros del mismo grupo
        const name = radio.name;
        document.querySelectorAll(`input[name="${name}"]`).forEach(r => r.dataset.wasChecked = "false");
        radio.dataset.wasChecked = "true";
    }
}

function actualizarDashboard() {
    const checked = document.querySelectorAll('.btn-check:checked');
    let c = {P:0, T:0, A:0, J:0};
    checked.forEach(r => c[r.value]++);
    
    document.getElementById('count-p').innerText = c.P;
    document.getElementById('count-t').innerText = c.T;
    document.getElementById('count-a').innerText = c.A;
    document.getElementById('count-j').innerText = c.J;
}

function marcarTodosPresentes() {
    document.querySelectorAll('input[value="P"]').forEach(r => {
        r.checked = true;
        r.dataset.wasChecked = "true";
    });
    actualizarDashboard();
}

/* =========================================
   4. PERSISTENCIA Y REPORTES
   ========================================= */
function guardarAsistencia() {
    const n = document.getElementById('selectNivel').value;
    const g = document.getElementById('selectGrado').value;
    const f = document.getElementById('fechaAsistencia').value;
    
    if(!g) return alert("Seleccione un grado primero");
    
    const btnSave = document.querySelector('.btn-save');
    const originalText = btnSave.innerHTML;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    btnSave.disabled = true;

    let registros = [];
    document.querySelectorAll('#listaEstudiantes tr').forEach(tr => {
        const b = tr.querySelector('b');
        if(b){
            const s = tr.querySelector('input:checked');
            registros.push({ 
                alumno: b.innerText, 
                estado: s ? s.value : 'S/R', 
                nota: tr.querySelector('.obs-input').value 
            });
        }
    });
    
    const key = `${n}_${g}`.replace(/ /g, "_");
    
    db.ref(`asistencias/${key}/${f}`).set(registros)
    .then(() => alert("🚀 ¡Sincronizado con éxito!"))
    .catch(() => alert("❌ Error de conexión. Intente de nuevo."))
    .finally(() => {
        btnSave.innerHTML = originalText;
        btnSave.disabled = false;
    });
}

async function exportarReporteMensual() {
    const n = document.getElementById('selectNivel').value;
    const g = document.getElementById('selectGrado').value;
    const f = document.getElementById('fechaAsistencia').value;

    if (!g) return alert("Seleccione grado primero");

    const mesSeleccionado = f.substring(0, 7); 
    const key = `${n}_${g}`.replace(/ /g, "_");

    const snapshot = await db.ref(`asistencias/${key}`).once('value');
    const todasLasAsistencias = snapshot.val();

    if (!todasLasAsistencias) return alert("No hay datos en la nube.");

    const diasDelMes = Object.keys(todasLasAsistencias).filter(fecha => fecha.startsWith(mesSeleccionado)).sort();
    if (diasDelMes.length === 0) return alert("No hay datos en este mes.");

    const alumnosDelGrado = (alumnosData[key] || []).sort();
    let resumen = {};
    alumnosDelGrado.forEach(nom => resumen[nom] = { P: 0, T: 0, A: 0, J: 0 });

    diasDelMes.forEach(dia => {
        todasLasAsistencias[dia].forEach(reg => {
            if (resumen[reg.alumno] && resumen[reg.alumno][reg.estado] !== undefined) {
                resumen[reg.alumno][reg.estado]++;
            }
        });
    });

    let csv = "\uFEFFREPORTE MENSUAL - MIS TALENTOS\n";
    csv += `GRADO:;${g};MES:;${mesSeleccionado}\n\n`;
    csv += `ESTUDIANTE;P;T;A;J;TOTAL ASIST.\n`;

    alumnosDelGrado.forEach(nom => {
        const r = resumen[nom];
        csv += `${nom};${r.P};${r.T};${r.A};${r.J};${r.P + r.T}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_${g}_${mesSeleccionado}.csv`;
    link.click();
}

function exportarCSV() {
    const n = document.getElementById('selectNivel').value;
    const g = document.getElementById('selectGrado').value;
    const f = document.getElementById('fechaAsistencia').value;
    const key = `${n}_${g}`.replace(/ /g, "_");

    db.ref(`asistencias/${key}/${f}`).once('value', (snapshot) => {
        const data = snapshot.val();
        if(!data) return alert("Sin datos hoy.");

        let csv = "\uFEFFI.E.P. MIS TALENTOS\n";
        csv += `FECHA:;${f};GRADO:;${g}\n\n`;
        csv += `N°;ESTUDIANTE;ESTADO;NOTA\n`;

        data.forEach((r, i) => csv += `${i+1};${r.alumno};${r.estado};${r.nota}\n`);

        const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Asistencia_${g}_${f}.csv`;
        link.click();
    });
}

/* =========================================
   5. GESTIÓN DE ALUMNOS
   ========================================= */
function abrirModalAlumnos() {
    const nivel = document.getElementById('selectNivel').value;
    const grado = document.getElementById('selectGrado').value;
    if(!grado) return alert("Seleccione grado primero");
    
    document.getElementById('modalEstudiantes').style.display = "block";
    document.getElementById('infoGradoActual').innerText = `${nivel} > ${grado}`;
    const key = `${nivel}_${grado}`.replace(/ /g, "_");
    document.getElementById('nombreTutor').value = tutoresData[key] || "";
    actualizarListaAdmin();
}

function cerrarModalAlumnos() { document.getElementById('modalEstudiantes').style.display = "none"; }

function agregarAlumno() {
    const n = document.getElementById('selectNivel').value;
    const g = document.getElementById('selectGrado').value;
    const nom = document.getElementById('nombreAlumno').value.trim().toUpperCase();
    if(!nom) return;
    const key = `${n}_${g}`.replace(/ /g, "_");
    if(!alumnosData[key]) alumnosData[key] = [];
    if(alumnosData[key].includes(nom)) return alert("Ya existe");
    alumnosData[key].push(nom);
    db.ref('alumnos/' + key).set(alumnosData[key]);
    document.getElementById('nombreAlumno').value = "";
    actualizarListaAdmin();
}

function eliminarAlumno(i) {
    if(!confirm("¿Eliminar estudiante?")) return;
    const n = document.getElementById('selectNivel').value;
    const g = document.getElementById('selectGrado').value;
    const key = `${n}_${g}`.replace(/ /g, "_");
    alumnosData[key].sort().splice(i, 1);
    db.ref('alumnos/' + key).set(alumnosData[key]);
    actualizarListaAdmin();
}

function actualizarListaAdmin() {
    const n = document.getElementById('selectNivel').value;
    const g = document.getElementById('selectGrado').value;
    const key = `${n}_${g}`.replace(/ /g, "_");
    const lista = document.getElementById('listaAdminAlumnos');
    const alumnos = (alumnosData[key] || []).sort();
    document.getElementById('count-admin-list').innerText = alumnos.length;
    lista.innerHTML = alumnos.map((nombre, i) => `
        <li class="admin-item-pro">
            <span>${i + 1}. ${nombre}</span>
            <button class="btn-delete-ui" onclick="eliminarAlumno(${i})"><i class="fas fa-trash-alt"></i></button>
        </li>`).join('');
}

function importarLista(input) {
    const n = document.getElementById('selectNivel').value;
    const g = document.getElementById('selectGrado').value;
    const key = `${n}_${g}`.replace(/ /g, "_");
    const reader = new FileReader();
    reader.readAsText(input.files[0], "UTF-8"); 
    reader.onload = function(e) {
        const lineas = e.target.result.split(/\r?\n/);
        let nuevos = alumnosData[key] || [];
        lineas.forEach(l => {
            const nom = l.trim().toUpperCase();
            if(nom && !nuevos.includes(nom)) nuevos.push(nom);
        });
        db.ref('alumnos/' + key).set(nuevos).then(() => alert("✅ Lista sincronizada"));
    };
}
