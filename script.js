/* =========================================
   0. SISTEMA DE TOAST (FEEDBACK VISUAL)
   ========================================= */
function mostrarToast(mensaje, tipo = 'exito') {
    const toast = document.getElementById('toast-feedback');
    if (!toast) return;

    const colores = {
        exito:   { bg: '#2ecc71', icon: '✅' },
        error:   { bg: '#e74c3c', icon: '❌' },
        info:    { bg: '#4F85C7', icon: 'ℹ️' },
        alerta:  { bg: '#f39c12', icon: '⚠️' },
    };
    const { bg, icon } = colores[tipo] || colores.exito;

    toast.style.background = bg;
    toast.innerHTML = `<span>${icon}</span><span>${mensaje}</span>`;
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.style.transform = 'translateY(80px)';
        toast.style.opacity = '0';
    }, 3000);
}

/* =========================================
   1. CONFIGURACIÓN DE FIREBASE
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

const CALENDARIZACION_2026 = {
    1: { inicio: '2026-03-09', fin: '2026-05-15', nombre: "I BIMESTRE", unidades: "I y II Unidad" },
    2: { inicio: '2026-05-25', fin: '2026-07-24', nombre: "II BIMESTRE", unidades: "III y IV Unidad" },
    3: { inicio: '2026-08-10', fin: '2026-10-09', nombre: "III BIMESTRE", unidades: "V y VI Unidad" },
    4: { inicio: '2026-10-19', fin: '2026-12-18', nombre: "IV BIMESTRE", unidades: "VII y VIII Unidad" }
};

let alumnosData = {};
let tutoresData = {};
let cambiosSinGuardar = false;
let cacheAsistencia = {};

/* =========================================
   2. FUNCIONES HELPER (CÓDIGO REUTILIZABLE)
   ========================================= */
function getCurrentKey() {
    const nivel = document.getElementById('selectNivel').value;
    const grado = document.getElementById('selectGrado').value;
    if (!nivel || !grado) return null;
    return `${nivel}_${grado}`.replace(/ /g, "_");
}

function getCurrentGradoInfo() {
    const nivel = document.getElementById('selectNivel').value;
    const grado = document.getElementById('selectGrado').value;
    return { nivel, grado, key: getCurrentKey() };
}

function getFechaActual() {
    const fecha = document.getElementById('fechaAsistencia').value;
    return fecha || new Date().toISOString().split('T')[0];
}

function validarNombre(nombre) {
    const limpio = nombre.trim().toUpperCase();
    
    if (limpio.length < 3) {
        return { valido: false, mensaje: "El nombre debe tener al menos 3 caracteres" };
    }
    
    if (limpio.length > 100) {
        return { valido: false, mensaje: "El nombre es demasiado largo (máx 100 caracteres)" };
    }
    
    // Permite letras, espacios, acentos, ñ y guiones
    if (!/^[A-ZÁÉÍÓÚÑ\s\-\.]+$/.test(limpio)) {
        return { valido: false, mensaje: "Solo se permiten letras, espacios, guiones y puntos" };
    }
    
    if (/\d/.test(limpio)) {
        return { valido: false, mensaje: "El nombre no debe contener números" };
    }
    
    return { valido: true, mensaje: "", nombre: limpio };
}

function tieneCambiosSinGuardar() {
    if (cambiosSinGuardar) {
        return confirm("⚠️ Hay cambios sin guardar. ¿Deseas continuar?");
    }
    return true;
}

function marcarCambios() {
    cambiosSinGuardar = true;
}

function limpiarCambios() {
    cambiosSinGuardar = false;
}

/* =========================================
   3. INICIALIZACIÓN
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    fijarFechaHoy();
    
    // Escuchas optimizadas con .once() para cargas iniciales
    db.ref('alumnos').once('value', (snapshot) => {
        alumnosData = snapshot.val() || {};
        actualizarGrados();
    });

    db.ref('tutores').once('value', (snapshot) => {
        tutoresData = snapshot.val() || {};
        cargarTablaAsistencia();
    });

    // Escucha para cambios en tiempo real (solo las referencias necesarias)
    db.ref('alumnos').on('child_changed', (snapshot) => {
        const key = snapshot.key;
        alumnosData[key] = snapshot.val() || [];
        actualizarListaAdmin();
        cargarTablaAsistencia();
    });

    db.ref('tutores').on('child_changed', (snapshot) => {
        const key = snapshot.key;
        tutoresData[key] = snapshot.val() || "";
        cargarTablaAsistencia();
    });

    // Reloj
    setInterval(() => {
        const reloj = document.getElementById('reloj');
        if(reloj) reloj.innerHTML = `<i class="far fa-clock"></i> ${new Date().toLocaleTimeString()}`;
    }, 1000);
    
    // Autoguardado cada 5 minutos
    setInterval(() => {
        if (cambiosSinGuardar) {
            guardarAsistenciaAutomatico();
        }
    }, 300000); // 5 minutos
});

function fijarFechaHoy() {
    const selector = document.getElementById('fechaAsistencia');
    const hoy = new Date();
    hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
    selector.value = hoy.toISOString().split('T')[0];
}

/* =========================================
   4. GESTIÓN DE GRADOS Y TUTORES
   ========================================= */
function actualizarGrados() {
    const nivel = document.getElementById('selectNivel').value;
    const combo = document.getElementById('selectGrado');
    combo.innerHTML = '<option value="">Grado</option>';
    
    if (nivel && estructuraColegio[nivel]) {
        estructuraColegio[nivel].forEach(g => {
            let opt = document.createElement('option');
            opt.value = g; 
            opt.innerText = g;
            combo.appendChild(opt);
        });
    }
    cargarTablaAsistencia(); 
}

function guardarTutor() {
    const info = getCurrentGradoInfo();
    if (!info.grado) {
        mostrarToast("⚠️ Seleccione un grado primero", "alerta");
        return;
    }
    
    const input = document.getElementById('nombreTutor');
    const nombre = input.value.trim().toUpperCase();
    
    if(nombre === "") {
        mostrarToast("⚠️ Ingrese el nombre del docente", "alerta");
        return;
    }
    
    // Validar nombre del tutor
    const validacion = validarNombre(nombre);
    if (!validacion.valido) {
        mostrarToast(validacion.mensaje, "alerta");
        return;
    }

    db.ref('tutores/' + info.key).set(validacion.nombre)
        .then(() => {
            mostrarToast("Tutor guardado: " + validacion.nombre, "exito");
            cargarTablaAsistencia();
        })
        .catch((error) => {
            console.error("Error guardando tutor:", error);
            mostrarToast("Error al guardar el tutor", "error");
        });
}

/* =========================================
   5. SISTEMA DE ASISTENCIA (CORE MEJORADO)
   ========================================= */
function cargarTablaAsistencia() {
    const info = getCurrentGradoInfo();
    const fecha = getFechaActual();
    const lista = document.getElementById('listaEstudiantes');
    const infoTutor = document.getElementById('infoTutorCabecera');
    const txtConteo = document.getElementById('txt-conteo-alumnos');

    if (!info.grado) {
        lista.innerHTML = '';
        txtConteo.innerText = "0";
        infoTutor.innerHTML = '<i class="fas fa-info-circle"></i> Seleccione un grado';
        return;
    }

    const alumnos = (alumnosData[info.key] || []).sort();
    txtConteo.innerText = alumnos.length;
    document.getElementById('count-total').innerText = alumnos.length;
    
    infoTutor.innerHTML = tutoresData[info.key] ? 
        `<i class="fas fa-chalkboard-teacher"></i> Tutor(a): ${tutoresData[info.key]}` : 
        `<i class="fas fa-chalkboard-teacher"></i> Tutor no asignado`;

    // Usar cache para mejorar rendimiento
    const cacheKey = `${info.key}_${fecha}`;
    if (cacheAsistencia[cacheKey]) {
        renderizarTabla(alumnos, cacheAsistencia[cacheKey], lista);
        return;
    }

    db.ref(`asistencias/${info.key}/${fecha}`).once('value')
        .then((snapshot) => {
            const asisGuardada = snapshot.val() || [];
            cacheAsistencia[cacheKey] = asisGuardada;
            renderizarTabla(alumnos, asisGuardada, lista);
        })
        .catch((error) => {
            console.error("Error cargando asistencia:", error);
            mostrarToast("Error al cargar los datos", "error");
        });
}

function renderizarTabla(alumnos, asisGuardada, lista) {
    lista.innerHTML = '';
    
    if (alumnos.length === 0) {
        lista.innerHTML = `
            <tr class="empty-state-row">
                <td colspan="3">
                    <div class="empty-state">
                        <i class="fas fa-user-plus"></i>
                        <p>No hay alumnos registrados en este grado</p>
                    </div>
                </td>
            </tr>`;
        return;
    }
    
    alumnos.forEach((nom, i) => {
        const nomLimpio = nom.trim().toUpperCase();
        const reg = asisGuardada.find(x => x.alumno.trim().toUpperCase() === nomLimpio) || {estado:'', nota:''};
        
        lista.innerHTML += `
            <tr>
                <td>${i+1}</td>
                <td class="nom-est"><b>${nomLimpio}</b></td>
                <td>
                    <div class="action-container" style="display: flex; align-items: center; gap: 10px;">
                        <div class="attendance-btns">
                            ${['P','T','A','J'].map(e => `
                                <input type="radio" name="r_${i}" id="${e.toLowerCase()}_${i}" value="${e}" 
                                       class="btn-check" onchange="marcarCambios()" onclick="toggleRadio(this)"
                                       ${reg.estado === e ? 'checked' : ''}>
                                <label for="${e.toLowerCase()}_${i}" class="btn-label">${e}</label>
                            `).join('')}
                        </div>

                        <button onclick="verHistorial('${nomLimpio}')" class="btn-view-history" title="Ver historial anual">
                            <i class="fas fa-calendar-alt"></i>
                        </button>

                        <input type="text" class="obs-input" placeholder="Nota..." 
                               id="obs_${i}" value="${reg.nota || ''}" 
                               onchange="marcarCambios()" style="flex: 1;">
                    </div>
                </td>
            </tr>`;
    });
    actualizarDashboard();
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
    marcarCambios();
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
    if (!tieneCambiosSinGuardar()) return;
    
    document.querySelectorAll('input[value="P"]').forEach(r => {
        r.checked = true;
        r.dataset.wasChecked = "true";
    });
    actualizarDashboard();
    marcarCambios();
    mostrarToast("Todos marcados como presentes", "info");
}

function guardarAsistencia() {
    const info = getCurrentGradoInfo();
    const fecha = getFechaActual();
    
    if(!info.grado) {
        mostrarToast("⚠️ Seleccione un grado primero", "alerta");
        return;
    }
    
    if (!confirm(`¿Desea guardar la asistencia de ${info.grado} para el día ${fecha}?`)) return;

    const btnSave = document.querySelector('.btn-save');
    const originalText = btnSave.innerHTML;
    
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    btnSave.disabled = true;

    const registros = recolectarRegistros();
    
    // Validar que haya datos
    if (registros.length === 0) {
        mostrarToast("⚠️ No hay alumnos para guardar", "alerta");
        btnSave.innerHTML = originalText;
        btnSave.disabled = false;
        return;
    }

    db.ref(`asistencias/${info.key}/${fecha}`).set(registros)
        .then(() => {
            mostrarToast("¡Asistencia guardada con éxito!", "exito");
            limpiarCambios();
            const cacheKey = `${info.key}_${fecha}`;
            cacheAsistencia[cacheKey] = registros;
        })
        .catch((error) => {
            console.error("Error de Firebase:", error);
            let mensaje = "Error al guardar. Revisa tu conexión.";
            if (error.code === 'PERMISSION_DENIED') {
                mensaje = "Sin permisos para guardar";
            } else if (error.code === 'NETWORK_ERROR') {
                mensaje = "Error de conexión a internet";
            }
            mostrarToast(mensaje, "error");
        })
        .finally(() => { 
            btnSave.innerHTML = originalText; 
            btnSave.disabled = false; 
        });
}

function guardarAsistenciaAutomatico() {
    const info = getCurrentGradoInfo();
    if (!info.grado) return;
    
    const registros = recolectarRegistros();
    if (registros.length === 0) return;
    
    const fecha = getFechaActual();
    db.ref(`asistencias/${info.key}/${fecha}`).set(registros)
        .then(() => {
            limpiarCambios();
            mostrarToast("💾 Autoguardado exitoso", "info");
        })
        .catch((error) => {
            console.error("Error en autoguardado:", error);
        });
}

function recolectarRegistros() {
    const registros = [];
    document.querySelectorAll('#listaEstudiantes tr').forEach(tr => {
        const b = tr.querySelector('b');
        if(b){
            const s = tr.querySelector('input:checked');
            const nota = tr.querySelector('.obs-input');
            registros.push({ 
                alumno: b.innerText.trim().toUpperCase(), 
                estado: s ? s.value : 'S/R', 
                nota: nota ? nota.value.trim() || "" : ""
            });
        }
    });
    return registros;
}

/* =========================================
   6. EXPORTACIÓN A EXCEL (MEJORADA)
   ========================================= */
async function generarFichaLibreta() {
    const nroBim = document.getElementById('selectBimestreIndividual').value;
    const config = CALENDARIZACION_2026[nroBim];
    const info = getCurrentGradoInfo();
    
    if (!info.grado) {
        mostrarToast("⚠️ Seleccione un grado primero", "alerta");
        return;
    }
    
    const tutorActual = tutoresData[info.key] || "POR ASIGNAR";

    try {
        const snap = await db.ref(`asistencias/${info.key}`).once('value');
        const data = snap.val() || {};

        const fechasBimestre = Object.keys(data)
            .filter(f => f >= config.inicio && f <= config.fin)
            .sort();

        if (fechasBimestre.length === 0) {
            mostrarToast("❌ No hay registros en el periodo seleccionado", "alerta");
            return;
        }

        let rows = [];
        let stats = {P:0, T:0, A:0, J:0};
        const nombreBusqueda = document.getElementById('h-nombre-estudiante')
            .innerText.replace('person', '').trim().toUpperCase();

        fechasBimestre.forEach(fecha => {
            const regDia = data[fecha].find(x => x.alumno.trim().toUpperCase() === nombreBusqueda);
            if(regDia && regDia.estado !== "S/R") {
                const est = regDia.estado.toUpperCase();
                if(stats[est] !== undefined) stats[est]++;
                rows.push([fecha.split('-').reverse().join('/'), est, regDia.nota || ""]);
            }
        });

        const header = [
            ["I.E.P. MIS TALENTOS - REPORTE DE ASISTENCIA"],
            ["ESTUDIANTE:", nombreBusqueda],
            ["GRADO:", info.grado],
            ["TUTOR:", tutorActual],
            ["BIMESTRE:", config.nombre],
            [""],
            ["FECHA", "ESTADO", "OBSERVACIÓN"]
        ];

        const footer = [
            [""],
            ["RESUMEN DEL BIMESTRE"],
            ["PRESENTE (P)", stats.P],
            ["TARDANZA (T)", stats.T],
            ["FALTA (A)", stats.A],
            ["JUSTIFICADO (J)", stats.J]
        ];

        const ws = XLSX.utils.aoa_to_sheet([...header, ...rows, ...footer]);
        const wb = XLSX.utils.book_new();
        ws['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
        XLSX.writeFile(wb, `Asistencia_${config.nombre}_${nombreBusqueda}.xlsx`);
        
        mostrarToast("📊 Ficha generada exitosamente", "exito");
        
    } catch (error) {
        console.error("Error generando ficha:", error);
        mostrarToast("Error al generar la ficha", "error");
    }
}

async function exportarReporteBimestral(nroBimestre) {
    const info = getCurrentGradoInfo();
    if (!info.grado) {
        mostrarToast("⚠️ Seleccione Nivel y Grado", "alerta");
        return;
    }

    const config = CALENDARIZACION_2026[nroBimestre];
    const tutorActual = tutoresData[info.key] || "POR ASIGNAR";

    try {
        const snapshot = await db.ref(`asistencias/${info.key}`).once('value');
        const asistenciasTotales = snapshot.val() || {};

        const fechasBimestre = Object.keys(asistenciasTotales)
            .filter(f => f >= config.inicio && f <= config.fin)
            .sort();

        if (fechasBimestre.length === 0) {
            mostrarToast(`❌ No hay asistencias para el ${config.nombre}`, "alerta");
            return;
        }

        const encabezadoHoja = [
            ["I.E.P. MIS TALENTOS - REPORTE DE ASISTENCIA POR BIMESTRE"],
            [`PERIODO: ${config.nombre} (${config.unidades})`, "", `NIVEL: ${info.nivel}`, `GRADO: ${info.grado}`],
            [`TUTOR(A): ${tutorActual}`, "", "", `GENERADO: ${new Date().toLocaleDateString()}`],
            [""]
        ];

        const filaCabecera = ["N°", "APELLIDOS Y NOMBRES", "PRESENTE", "TARDANZA", "AUSENTE", "JUSTIFICADO"];

        const alumnos = (alumnosData[info.key] || []).sort();
        const cuerpoReporte = alumnos.map((nom, idx) => {
            let stats = { P: 0, T: 0, A: 0, J: 0 };
            const nombreU = nom.trim().toUpperCase();

            fechasBimestre.forEach(fecha => {
                const dataDia = asistenciasTotales[fecha];
                const registro = dataDia ? dataDia.find(x => x.alumno.trim().toUpperCase() === nombreU) : null;
                if (registro && registro.estado !== "S/R") {
                    const est = registro.estado.toUpperCase();
                    if (stats[est] !== undefined) stats[est]++;
                }
            });

            return [idx + 1, nombreU, stats.P, stats.T, stats.A, stats.J];
        });

        const ws = XLSX.utils.aoa_to_sheet([...encabezadoHoja, filaCabecera, ...cuerpoReporte]);
        const wb = XLSX.utils.book_new();

        ws['!cols'] = [
            { wch: 5 },
            { wch: 40 },
            { wch: 12 },
            { wch: 12 },
            { wch: 12 },
            { wch: 14 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Resumen Bimestral");
        XLSX.writeFile(wb, `Reporte_${config.nombre.replace(/ /g, "_")}_${info.grado.replace(/ /g, "_")}.xlsx`);
        
        mostrarToast("📊 Reporte bimestral generado", "exito");
        
    } catch (error) {
        console.error("Error exportando bimestre:", error);
        mostrarToast("Error al generar el reporte", "error");
    }
}

function exportarExcelDiario() {
    const info = getCurrentGradoInfo();
    const fecha = getFechaActual();
    
    if(!info.grado) {
        mostrarToast("⚠️ Seleccione un grado", "alerta");
        return;
    }
    
    const tutorActual = tutoresData[info.key] || "No asignado";

    db.ref(`asistencias/${info.key}/${fecha}`).once('value')
        .then((snapshot) => {
            const data = snapshot.val();
            if(!data || data.length === 0) {
                mostrarToast("❌ No hay datos para esta fecha", "alerta");
                return;
            }

            const encabezado = [
                ["I.E.P. MIS TALENTOS - REPORTE DIARIO DE ASISTENCIA"],
                [`FECHA: ${fecha}`, "", `NIVEL: ${info.nivel}`, "", `GRADO: ${info.grado}`],
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
            XLSX.writeFile(wb, `Asistencia_${info.grado.replace(/ /g, "_")}_${fecha}.xlsx`);
            
            mostrarToast("📊 Reporte diario exportado", "exito");
        })
        .catch((error) => {
            console.error("Error exportando diario:", error);
            mostrarToast("Error al exportar", "error");
        });
}

async function exportarReporteMensual() {
    const info = getCurrentGradoInfo();
    const fecha = getFechaActual();

    if (!info.grado || !fecha) {
        mostrarToast("⚠️ Seleccione Nivel, Grado y Fecha", "alerta");
        return;
    }

    const [anio, mesNum] = fecha.split('-');
    const mesesNombres = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const nombreMes = mesesNombres[parseInt(mesNum) - 1];
    
    const tutorActual = tutoresData[info.key] || "POR ASIGNAR";

    try {
        const snapshot = await db.ref(`asistencias/${info.key}`).once('value');
        const todas = snapshot.val() || {};

        const ultimoDia = new Date(anio, mesNum, 0).getDate();
        const diasArray = Array.from({length: ultimoDia}, (_, i) => (i + 1).toString().padStart(2, '0'));

        const filaDias = ["N°", "APELLIDOS Y NOMBRES", ...diasArray.map(d => parseInt(d)), "P", "T", "A", "J", "TOTAL", "OBSERVACIONES"];
        
        const encabezadoInstitucional = [
            ["I.E.P. MIS TALENTOS - REGISTRO AUXILIAR DE ASISTENCIA"],
            [`NIVEL: ${info.nivel}`, `GRADO: ${info.grado}`, `MES: ${nombreMes}`, `AÑO: ${anio}`],
            [`TUTOR(A): ${tutorActual}`],
            [""]
        ];

        const alumnos = (alumnosData[info.key] || []).sort();
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
        XLSX.writeFile(wb, `Registro_${info.grado.replace(/ /g, "_")}_${nombreMes}.xlsx`);
        
        mostrarToast("📊 Reporte mensual exportado", "exito");
        
    } catch (error) {
        console.error("Error exportando mensual:", error);
        mostrarToast("Error al generar el reporte mensual", "error");
    }
}

/* =========================================
   7. GESTIÓN DE ALUMNOS (MEJORADA)
   ========================================= */
function abrirModalAlumnos() {
    const info = getCurrentGradoInfo();
    if(!info.grado) {
        mostrarToast("Seleccione grado primero", "alerta");
        return;
    }
    document.getElementById('modalEstudiantes').style.display = "block";
    document.getElementById('infoGradoActual').innerText = `${info.nivel} > ${info.grado}`;
    document.getElementById('nombreTutor').value = tutoresData[info.key] || "";
    actualizarListaAdmin();
}

function cerrarModalAlumnos() { 
    document.getElementById('modalEstudiantes').style.display = "none"; 
}

function agregarAlumno() {
    const input = document.getElementById('nombreAlumno');
    const nom = input.value.trim().toUpperCase();
    
    // Validación mejorada
    const validacion = validarNombre(nom);
    if (!validacion.valido) {
        mostrarToast(validacion.mensaje, "alerta");
        return;
    }
    
    const info = getCurrentGradoInfo();
    if (!info.grado) {
        mostrarToast("Seleccione un grado", "alerta");
        return;
    }
    
    if(!alumnosData[info.key]) alumnosData[info.key] = [];
    if(alumnosData[info.key].includes(validacion.nombre)) {
        mostrarToast("El alumno ya existe", "alerta");
        return;
    }
    
    alumnosData[info.key].push(validacion.nombre);
    db.ref('alumnos/' + info.key).set(alumnosData[info.key].sort())
        .then(() => { 
            mostrarToast("Estudiante agregado: " + validacion.nombre, "exito"); 
            input.value = ""; 
            actualizarListaAdmin();
            cargarTablaAsistencia();
        })
        .catch((error) => {
            console.error("Error agregando alumno:", error);
            mostrarToast("Error al agregar. Intenta de nuevo.", "error");
        });
}

function editarAlumno(i) {
    const info = getCurrentGradoInfo();
    if (!info.grado) return;
    
    let listaOriginal = [...alumnosData[info.key]].sort();
    const nombreActual = listaOriginal[i];

    const nuevoNombre = prompt("Editar nombre del estudiante:", nombreActual);

    if (nuevoNombre !== null) {
        const validacion = validarNombre(nuevoNombre);
        if (!validacion.valido) {
            mostrarToast(validacion.mensaje, "alerta");
            return;
        }
        
        if (listaOriginal.includes(validacion.nombre) && validacion.nombre !== nombreActual) {
            mostrarToast("Ese nombre ya existe", "alerta");
            return;
        }

        listaOriginal[i] = validacion.nombre;
        
        db.ref('alumnos/' + info.key).set(listaOriginal.sort())
            .then(() => {
                mostrarToast("Nombre actualizado correctamente", "exito");
                actualizarListaAdmin();
                cargarTablaAsistencia();
            })
            .catch((error) => {
                console.error("Error editando alumno:", error);
                mostrarToast("Error al editar. Intenta de nuevo.", "error");
            });
    }
}

function eliminarAlumno(i) {
    if(!confirm("¿Eliminar estudiante?")) return;
    
    const info = getCurrentGradoInfo();
    if (!info.grado) return;
    
    const listaOriginal = [...alumnosData[info.key]].sort();
    const nombreEliminado = listaOriginal[i];
    listaOriginal.splice(i, 1);
    
    db.ref('alumnos/' + info.key).set(listaOriginal)
        .then(() => { 
            mostrarToast("Estudiante eliminado: " + nombreEliminado, "info"); 
            actualizarListaAdmin();
            cargarTablaAsistencia();
        })
        .catch((error) => {
            console.error("Error eliminando alumno:", error);
            mostrarToast("Error al eliminar. Intenta de nuevo.", "error");
        });
}

function actualizarListaAdmin() {
    const info = getCurrentGradoInfo();
    if (!info.grado) return;
    
    const lista = document.getElementById('listaAdminAlumnos');
    const alumnos = (alumnosData[info.key] || []).sort();
    
    document.getElementById('count-admin-list').innerText = alumnos.length;
    
    if (alumnos.length === 0) {
        lista.innerHTML = `
            <li class="admin-item-pro" style="justify-content:center; color:#a0aec0;">
                <span>No hay alumnos registrados</span>
            </li>`;
        return;
    }
    
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
    const info = getCurrentGradoInfo();
    
    if (!info.grado) {
        mostrarToast("⚠️ Selecciona un nivel y grado", "alerta");
        input.value = "";
        return;
    }

    const reader = new FileReader();
    
    reader.readAsText(input.files[0], "UTF-8"); 

    reader.onload = function(e) {
        const lineas = e.target.result.split(/\r?\n/);
        let nuevos = alumnosData[info.key] ? [...alumnosData[info.key]] : [];
        let contadorNuevos = 0;
        let errores = [];

        lineas.forEach((l, idx) => {
            const nom = l.trim().toUpperCase().replace(/[\u200B-\u200D\uFEFF]/g, "");
            
            if (nom && nom.length > 2) {
                const validacion = validarNombre(nom);
                if (!validacion.valido) {
                    errores.push(`Línea ${idx+1}: ${validacion.mensaje}`);
                    return;
                }
                
                if (!nuevos.includes(validacion.nombre)) {
                    nuevos.push(validacion.nombre);
                    contadorNuevos++;
                }
            }
        });

        if (errores.length > 0) {
            mostrarToast(`⚠️ ${errores.length} errores encontrados. Revisa la consola.`, "alerta");
            console.error("Errores de importación:", errores);
        }

        if (contadorNuevos === 0) {
            mostrarToast("ℹ️ No se encontraron alumnos nuevos", "info");
            input.value = "";
            return;
        }

        db.ref('alumnos/' + info.key).set(nuevos.sort())
            .then(() => {
                mostrarToast(`✅ ¡Éxito! Se agregaron ${contadorNuevos} alumnos`, "exito");
                input.value = "";
                actualizarListaAdmin();
                cargarTablaAsistencia();
            })
            .catch(error => {
                console.error("Error en Firebase:", error);
                mostrarToast("❌ Error al sincronizar con la nube", "error");
            });
    };

    reader.onerror = () => {
        mostrarToast("❌ Error al leer el archivo .txt", "error");
        input.value = "";
    };
}

function exportarSoloNombres() {
    const info = getCurrentGradoInfo();
    if (!info.grado) {
        mostrarToast("⚠️ Seleccione un grado", "alerta");
        return;
    }
    
    const alumnos = (alumnosData[info.key] || []).sort();
    if (alumnos.length === 0) {
        mostrarToast("❌ No hay alumnos", "alerta");
        return;
    }
    
    const contenido = alumnos.join("\r\n");
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lista_${info.grado.replace(/ /g, "_")}_2026.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    mostrarToast("📄 Lista exportada", "exito");
}

/* =========================================
   8. CONSULTA DE HISTORIAL (MEJORADA)
   ========================================= */
async function verHistorial(nom) {
    const info = getCurrentGradoInfo();
    if(!info.grado) {
        mostrarToast("Seleccione un grado", "alerta");
        return;
    }

    const modal = document.getElementById('modalHistorial');
    const listaDetalle = document.getElementById('lista-historial-detalle');
    
    modal.style.display = "block";
    listaDetalle.innerHTML = '<p style="text-align:center; padding:20px; color:#666;"><i class="fas fa-spinner fa-spin"></i> Cargando historial...</p>';

    document.getElementById('h-nombre-estudiante').innerHTML = `<i class="fas fa-user-graduate"></i> ${nom}`;
    document.getElementById('h-grado-label').innerText = `HISTORIAL ANUAL - ${info.grado}`;

    try {
        const snap = await db.ref(`asistencias/${info.key}`).once('value');
        const data = snap.val() || {};
        
        let resumen = { P: 0, T: 0, A: 0, J: 0 };
        let itemsHTML = "";
        let totalDias = 0;

        const fechasOrdenadas = Object.keys(data).sort().reverse();

        fechasOrdenadas.forEach(fecha => {
            const registroDia = data[fecha].find(x => x.alumno.trim().toUpperCase() === nom);
            
            if (registroDia && registroDia.estado !== "S/R") {
                const est = registroDia.estado.toUpperCase();
                if (resumen[est] !== undefined) {
                    resumen[est]++;
                    totalDias++;
                }
                
                const fechaLegible = fecha.split('-').reverse().join('/');

                itemsHTML += `
                    <div class="admin-item-pro">
                        <div class="historial-info">
                            <span class="historial-fecha">${fechaLegible}</span>
                            <span class="historial-obs">${registroDia.nota || "Sin observaciones"}</span>
                        </div>
                        <div class="btn-label" style="background:${getColorEstado(est)}; color:white; border:none; display:flex; align-items:center; justify-content:center;">
                            ${est}
                        </div>
                    </div>`;
            }
        });

        if (totalDias === 0) {
            listaDetalle.innerHTML = '<p style="text-align:center; padding:20px; color:#a0aec0;">No hay registros de asistencia para este alumno.</p>';
        } else {
            listaDetalle.innerHTML = itemsHTML;
        }

        document.getElementById('h-count-p').innerText = resumen.P;
        document.getElementById('h-count-t').innerText = resumen.T;
        document.getElementById('h-count-a').innerText = resumen.A;
        document.getElementById('h-count-j').innerText = resumen.J;
        document.getElementById('h-total-dias').innerText = `${totalDias} registros`;

    } catch (error) {
        console.error("Error cargando historial:", error);
        listaDetalle.innerHTML = '<p style="text-align:center; padding:20px; color:#e74c3c;">❌ Error al cargar el historial</p>';
        mostrarToast("Error al cargar historial", "error");
    }
}

function cerrarModalHistorial() {
    document.getElementById('modalHistorial').style.display = "none";
}

function getColorEstado(estado) {
    const colores = {
        'P': '#2ecc71',
        'T': '#f1c40f',
        'A': '#E31B2B',
        'J': '#3498db'
    };
    return colores[estado] || '#cbd5e0';
}

function exportarHistorialAlumno() {
    const nombre = document.getElementById('h-nombre-estudiante').innerText.trim();
    const grado = document.getElementById('h-grado-label').innerText.trim();
    const p = document.getElementById('h-count-p').innerText;
    const t = document.getElementById('h-count-t').innerText;
    const a = document.getElementById('h-count-a').innerText;
    const j = document.getElementById('h-count-j').innerText;
    const total = document.getElementById('h-total-dias').innerText;

    const data = [
        ["I.E.P. MIS TALENTOS"],
        ["SISTEMA DE GESTIÓN ACADÉMICA 2026"],
        [""],
        ["REPORTE CONSOLIDADO DE ASISTENCIA"],
        ["------------------------------------------------------------"],
        ["DATOS DEL ESTUDIANTE"],
        ["NOMBRE COMPLETO:", nombre.replace('Nombre del Alumno', '')],
        ["GRADO Y SECCIÓN:", grado],
        ["FECHA DE EMISIÓN:", new Date().toLocaleDateString()],
        [""],
        ["RESUMEN DE ESTADOS", "CANTIDAD"],
        ["PRESENTE (P)", parseInt(p)],
        ["TARDANZA (T)", parseInt(t)],
        ["FALTA (A)", parseInt(a)],
        ["JUSTIFICADO (J)", parseInt(j)],
        ["--------------------------", "----------"],
        ["TOTAL REGISTROS:", total],
        [""],
        [""],
        ["___________________________"],
        ["Firma del Tutor / Dirección"]
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();

    ws['!cols'] = [
        { wch: 30 }, 
        { wch: 20 }
    ];

    if(!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push(
        { s: {r: 0, c: 0}, e: {r: 0, c: 1} },
        { s: {r: 1, c: 0}, e: {r: 1, c: 1} },
        { s: {r: 3, c: 0}, e: {r: 3, c: 1} }
    );

    XLSX.utils.book_append_sheet(wb, ws, "Resumen");
    
    const nombreArchivo = `Reporte_${nombre.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
    
    mostrarToast("📊 Reporte exportado", "exito");
}

/* =========================================
   9. FUNCIONES UTILITARIAS ADICIONALES
   ========================================= */
function limpiarCache() {
    cacheAsistencia = {};
    mostrarToast("🧹 Cache limpiado", "info");
}

function recargarDatos() {
    if (!tieneCambiosSinGuardar()) return;
    limpiarCache();
    cargarTablaAsistencia();
    mostrarToast("🔄 Datos recargados", "info");
}

// Exportar funciones globalmente para uso en HTML
window.actualizarGrados = actualizarGrados;
window.cargarTablaAsistencia = cargarTablaAsistencia;
window.guardarAsistencia = guardarAsistencia;
window.marcarTodosPresentes = marcarTodosPresentes;
window.abrirModalAlumnos = abrirModalAlumnos;
window.cerrarModalAlumnos = cerrarModalAlumnos;
window.guardarTutor = guardarTutor;
window.agregarAlumno = agregarAlumno;
window.editarAlumno = editarAlumno;
window.eliminarAlumno = eliminarAlumno;
window.importarLista = importarLista;
window.exportarSoloNombres = exportarSoloNombres;
window.exportarExcelDiario = exportarExcelDiario;
window.exportarReporteMensual = exportarReporteMensual;
window.exportarReporteBimestral = exportarReporteBimestral;
window.verHistorial = verHistorial;
window.cerrarModalHistorial = cerrarModalHistorial;
window.exportarHistorialAlumno = exportarHistorialAlumno;
window.generarFichaLibreta = generarFichaLibreta;
window.toggleRadio = toggleRadio;
window.actualizarDashboard = actualizarDashboard;
window.marcarCambios = marcarCambios;
