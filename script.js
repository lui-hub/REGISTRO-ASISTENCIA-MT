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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const estructuraColegio = {
    "INICIAL": ["3 años", "4 años", "5 años"],
    "PRIMARIA": ["1º Primaria", "2º Primaria", "3º Primaria", "4º Primaria", "5º Primaria", "6º Primaria"],
    "SECUNDARIA": ["1º Secundaria", "2º Secundaria", "3º Secundaria", "4º Secundaria", "5º Secundaria"]
};

let alumnosData = {};
let tutoresData = {};

document.addEventListener('DOMContentLoaded', () => {
    fijarFechaHoy();
    
    db.ref('alumnos').on('value', (snapshot) => {
        alumnosData = snapshot.val() || {};
        actualizarGrados(); 
    });

    db.ref('tutores').on('value', (snapshot) => {
        tutoresData = snapshot.val() || {};
        cargarTablaAsistencia();
    });

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
    combo.innerHTML = '<option value="">Grado</option>';
    
    if (nivel && estructuraColegio[nivel]) {
        estructuraColegio[nivel].forEach(g => {
            let opt = document.createElement('option');
            opt.value = g; opt.innerText = g;
            combo.appendChild(opt);
        });
        // Forzamos un pequeño delay o simplemente esperamos a que el usuario elija
        // para evitar que Firebase intente buscar una ruta vacía.
    }
    cargarTablaAsistencia(); 
}

function guardarTutor() {
    const n = document.getElementById('selectNivel').value;
    const g = document.getElementById('selectGrado').value;
    const input = document.getElementById('nombreTutor');
    const nombre = input.value.trim().toUpperCase();
    
    if(!g) return alert("⚠️ Seleccione grado primero");
    if(nombre === "") return alert("⚠️ Ingrese el nombre del docente");

    const key = `${n}_${g}`.replace(/ /g, "_");
    db.ref('tutores/' + key).set(nombre).then(() => {
        alert("✅ Tutor guardado: " + nombre);
        cargarTablaAsistencia(); // Para que se actualice la cabecera inmediatamente
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

    if (!g) {
        lista.innerHTML = '';
        txtConteo.innerText = "0";
        infoTutor.innerHTML = '<i class="fas fa-info-circle"></i> Seleccione un grado';
        return;
    }

    const key = `${n}_${g}`.replace(/ /g, "_");
    const alumnos = (alumnosData[key] || []).sort();
    txtConteo.innerText = alumnos.length;
    document.getElementById('count-total').innerText = alumnos.length;
    infoTutor.innerHTML = tutoresData[key] ? `<i class="fas fa-chalkboard-teacher"></i> Tutor(a): ${tutoresData[key]}` : `<i class="fas fa-chalkboard-teacher"></i> Tutor no asignado`;

    db.ref(`asistencias/${key}/${f}`).once('value', (snapshot) => {
        const asisGuardada = snapshot.val() || [];
        lista.innerHTML = '';
        alumnos.forEach((nom, i) => {
            const nomLimpio = nom.trim().toUpperCase();
            const reg = asisGuardada.find(x => x.alumno.trim().toUpperCase() === nomLimpio) || {estado:'', nota:''};
            lista.innerHTML += `
                <tr>
                    <td>${i+1}</td>
                    <td class="nom-est"><b>${nomLimpio}</b></td>
                    <td>
                        <div class="attendance-btns">
                            ${['P','T','A','J'].map(e => `
                                <input type="radio" name="r_${i}" id="${e.toLowerCase()}_${i}" value="${e}" 
                                       class="btn-check" onchange="actualizarDashboard()" onclick="toggleRadio(this)"
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

function toggleRadio(radio) {
    if (radio.dataset.wasChecked === "true") {
        radio.checked = false;
        radio.dataset.wasChecked = "false";
        actualizarDashboard();
    } else {
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

function guardarAsistencia() {
    const n = document.getElementById('selectNivel').value;
    const g = document.getElementById('selectGrado').value;
    const f = document.getElementById('fechaAsistencia').value;
    
    if(!g) return alert("⚠️ Seleccione un grado primero");
    if (!confirm(`¿Desea guardar la asistencia de ${g} para el día ${f}?`)) return;

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
                alumno: b.innerText.trim().toUpperCase(), 
                estado: s ? s.value : 'S/R', 
                nota: tr.querySelector('.obs-input').value.trim() || "" 
            });
        }
    });
    
    const key = `${n}_${g}`.replace(/ /g, "_");

    db.ref(`asistencias/${key}/${f}`).set(registros)
        .then(() => {
            alert("🚀 ¡Sincronizado con éxito!");
            cargarTablaAsistencia(); 
        })
        .catch((error) => {
            console.error("Error de Firebase:", error);
            alert("❌ Error al guardar en la nube.");
        })
        .finally(() => { 
            btnSave.innerHTML = originalText; 
            btnSave.disabled = false; 
        });
}

/* =========================================
   4. EXPORTACIÓN A EXCEL (XLSX)
   ========================================= */
function exportarExcelDiario() {
    const n = document.getElementById('selectNivel').value;
    const g = document.getElementById('selectGrado').value;
    const f = document.getElementById('fechaAsistencia').value;
    
    if(!g) return alert("⚠️ Seleccione un grado para exportar.");
    const key = `${n}_${g}`.replace(/ /g, "_");
    const tutorActual = tutoresData[key] || "No asignado";

    db.ref(`asistencias/${key}/${f}`).once('value', (snapshot) => {
        const data = snapshot.val();
        if(!data) return alert("❌ No hay datos registrados para esta fecha.");

        const encabezado = [
            ["I.E.P. MIS TALENTOS - REPORTE DIARIO DE ASISTENCIA"],
            [`FECHA: ${f}`, "", `NIVEL: ${n}`, "", `GRADO: ${g}`],
            [`TUTOR(A): ${tutorActual}`],
            [""],
            ["N°", "APELLIDOS Y NOMBRES", "ESTADO", "OBSERVACIONES / NOTAS"]
        ];

        const cuerpo = data.map((r, i) => [i + 1, r.alumno, r.estado, r.nota || ""]);
        const datosFinales = [...encabezado, ...cuerpo];
        const ws = XLSX.utils.aoa_to_sheet(datosFinales);
        const wb = XLSX.utils.book_new();
        ws['!cols'] = [{wch: 5}, {wch: 45}, {wch: 10}, {wch: 40}];
        XLSX.utils.book_append_sheet(wb, ws, "Asistencia_Diaria");
        XLSX.writeFile(wb, `Asistencia_${g.replace(/ /g, "_")}_${f}.xlsx`);
    });
}

async function exportarReporteMensual() {
    const n = document.getElementById('selectNivel').value;
    const g = document.getElementById('selectGrado').value;
    const f = document.getElementById('fechaAsistencia').value;

    if (!g || !f) return alert("⚠️ Seleccione Nivel, Grado y Fecha.");

    const [anio, mesNum] = f.split('-');
    const mesesNombres = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const nombreMes = mesesNombres[parseInt(mesNum) - 1];
    
    const key = `${n}_${g}`.replace(/ /g, "_");
    const tutorActual = tutoresData[key] || "POR ASIGNAR";

    const snapshot = await db.ref(`asistencias/${key}`).once('value');
    const todas = snapshot.val() || {};

    const ultimoDia = new Date(anio, mesNum, 0).getDate();
    const diasArray = Array.from({length: ultimoDia}, (_, i) => (i + 1).toString().padStart(2, '0'));

    const filaDias = ["N°", "APELLIDOS Y NOMBRES", ...diasArray.map(d => parseInt(d)), "P", "T", "A", "J", "TOTAL", "OBSERVACIONES"];
    
    const encabezadoInstitucional = [
        ["I.E.P. MIS TALENTOS - REGISTRO AUXILIAR DE ASISTENCIA"],
        [`NIVEL: ${n}`, `GRADO: ${g}`, `MES: ${nombreMes}`, `AÑO: ${anio}`],
        [`TUTOR(A): ${tutorActual}`],
        [""]
    ];

    const alumnos = (alumnosData[key] || []).sort();
    const cuerpo = alumnos.map((nom, i) => {
        let stats = { P: 0, T: 0, A: 0, J: 0 };
        let marcasDiarias = [];
        let faltasTexto = [];
        const nombreLimpioBase = nom.trim().toUpperCase();

        diasArray.forEach(d => {
            const fechaKey = `${anio}-${mesNum}-${d}`;
            const diaData = todas[fechaKey];
            const reg = diaData ? diaData.find(x => x.alumno.trim().toUpperCase() === nombreLimpioBase) : null;

            if (reg && reg.estado !== "S/R") {
                marcasDiarias.push(reg.estado);
                const est = reg.estado.toUpperCase();
                if (stats[est] !== undefined) stats[est]++;
                if (est === 'A') faltasTexto.push(parseInt(d));
            } else {
                marcasDiarias.push("-"); 
            }
        });

        const totalAsist = stats.P + stats.T;
        return [
            i + 1,
            nombreLimpioBase,
            ...marcasDiarias,
            stats.P, stats.T, stats.A, stats.J,
            totalAsist,
            faltasTexto.length > 0 ? `Faltas el: ${faltasTexto.join(', ')}` : ""
        ];
    });

    const datosFinales = [...encabezadoInstitucional, filaDias, ...cuerpo];
    const ws = XLSX.utils.aoa_to_sheet(datosFinales);
    const wb = XLSX.utils.book_new();
    const colWidths = [{wch: 4}, {wch: 35}, ...diasArray.map(() => ({wch: 3})), {wch: 4}, {wch: 4}, {wch: 4}, {wch: 4}, {wch: 8}, {wch: 25}];
    ws['!cols'] = colWidths;
    if(!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: {r:0, c:0}, e: {r:0, c: ultimoDia + 7} });

    XLSX.utils.book_append_sheet(wb, ws, "Registro_Auxiliar");
    XLSX.writeFile(wb, `Registro_${g.replace(/ /g, "_")}_${nombreMes}.xlsx`);
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
    const input = document.getElementById('nombreAlumno');
    const nom = input.value.trim().toUpperCase(); 
    if(!nom) return;
    
    const n = document.getElementById('selectNivel').value;
    const g = document.getElementById('selectGrado').value;
    const key = `${n}_${g}`.replace(/ /g, "_");
    
    if(!alumnosData[key]) alumnosData[key] = [];
    if(alumnosData[key].includes(nom)) return alert("El alumno ya existe");
    
    alumnosData[key].push(nom);
    db.ref('alumnos/' + key).set(alumnosData[key].sort()); 
    input.value = "";
    actualizarListaAdmin();
}

// --- FUNCIÓN DE EDITAR AÑADIDA ---
function editarAlumno(i) {
    const n = document.getElementById('selectNivel').value;
    const g = document.getElementById('selectGrado').value;
    const key = `${n}_${g}`.replace(/ /g, "_");
    
    let listaOriginal = [...alumnosData[key]].sort();
    const nombreActual = listaOriginal[i];

    const nuevoNombre = prompt("Editar nombre del estudiante:", nombreActual);

    if (nuevoNombre !== null) {
        const nombreLimpio = nuevoNombre.trim().toUpperCase();
        if (nombreLimpio === "") return alert("El nombre no puede estar vacío.");
        if (listaOriginal.includes(nombreLimpio) && nombreLimpio !== nombreActual) return alert("Ese nombre ya existe.");

        listaOriginal[i] = nombreLimpio;
        
        db.ref('alumnos/' + key).set(listaOriginal.sort())
            .then(() => {
                alert("✅ Nombre actualizado");
                actualizarListaAdmin();
            })
            .catch(error => alert("❌ Error al editar"));
    }
}

function eliminarAlumno(i) {
    if(!confirm("¿Eliminar estudiante?")) return;
    const n = document.getElementById('selectNivel').value;
    const g = document.getElementById('selectGrado').value;
    const key = `${n}_${g}`.replace(/ /g, "_");
    const listaOriginal = [...alumnosData[key]].sort();
    listaOriginal.splice(i, 1);
    db.ref('alumnos/' + key).set(listaOriginal);
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
            <div class="admin-btns">
                <button class="btn-edit-ui" onclick="editarAlumno(${i})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-delete-ui" onclick="eliminarAlumno(${i})" title="Eliminar">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </li>`).join('');
}

function importarLista(input) {
    const n = document.getElementById('selectNivel').value;
    const g = document.getElementById('selectGrado').value;
    
    if (!g) {
        alert("⚠️ Por favor, selecciona un nivel y grado antes de importar.");
        input.value = ""; // Limpiar el input file
        return;
    }

    const key = `${n}_${g}`.replace(/ /g, "_");
    const reader = new FileReader();
    
    reader.readAsText(input.files[0], "UTF-8"); 

    reader.onload = function(e) {
        // 1. Dividimos por cualquier tipo de salto de línea y limpiamos espacios
        const lineas = e.target.result.split(/\r?\n/);
        
        // 2. Traemos la lista actual o empezamos una nueva
        let nuevos = alumnosData[key] ? [...alumnosData[key]] : [];
        let contadorNuevos = 0;

        lineas.forEach(l => {
            // Limpieza profunda: quitamos espacios, pasamos a MAYÚSCULAS 
            // y eliminamos caracteres no imprimibles que a veces vienen en los TXT
            const nom = l.trim().toUpperCase().replace(/[\u200B-\u200D\uFEFF]/g, "");
            
            // Validamos que el nombre no esté vacío y que no sea un duplicado
            if (nom && nom.length > 2) {
                if (!nuevos.includes(nom)) {
                    nuevos.push(nom);
                    contadorNuevos++;
                }
            }
        });

        if (contadorNuevos === 0) {
            alert("ℹ️ No se encontraron alumnos nuevos para agregar.");
            input.value = "";
            return;
        }

        // 3. Guardamos la lista ordenada alfabéticamente
        db.ref('alumnos/' + key).set(nuevos.sort())
            .then(() => {
                alert(`✅ ¡Éxito! Se agregaron ${contadorNuevos} alumnos nuevos a ${g}.`);
                input.value = ""; // Reset del input para poder subir el mismo archivo si se corrigió
                actualizarListaAdmin();
            })
            .catch(error => {
                console.error("Error en Firebase:", error);
                alert("❌ Error al sincronizar con la nube.");
            });
    };

    reader.onerror = () => alert("❌ Error al leer el archivo .txt");
}

/* =========================================
   6. NUEVO: EXPORTAR SOLO NOMBRES (TXT)
   ========================================= */
function exportarSoloNombres() {
    const n = document.getElementById('selectNivel').value;
    const g = document.getElementById('selectGrado').value;
    if (!g) return alert("⚠️ Seleccione un grado para exportar.");
    const key = `${n}_${g}`.replace(/ /g, "_");
    const alumnos = (alumnosData[key] || []).sort();
    if (alumnos.length === 0) return alert("❌ No hay alumnos.");
    
    const contenido = alumnos.join("\r\n");
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lista_${g.replace(/ /g, "_")}_2026.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}
