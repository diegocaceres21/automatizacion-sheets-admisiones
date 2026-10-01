/**
 * CONFIGURACIÓN PARA LA EXTENSIÓN "Admisiones UCB"
 *
 * Crea las hojas CONFIG_* en esta planilla a partir de los valores que hoy están
 * fijos en codigo.gs y en los formularios HTML. La extensión lee estas hojas.
 *
 * USO (desde el editor de Apps Script de la planilla):
 *   (Si la planilla ya tiene CONFIG_* de una versión anterior, seedConfig() solo agrega las hojas nuevas,
 *    por ejemplo CONFIG_ASESORES.)
 *   1. Ejecutar seedConfig()      -> crea las hojas CONFIG_* que falten (no toca las existentes).
 *   2. Ejecutar verificarConfig() -> revisa que la configuración coincida con las hojas reales.
 *   Para regenerar todo desde cero: borrar las hojas CONFIG_* y volver a ejecutar seedConfig().
 *
 * Esquema detallado: docs/config-schema.md
 */

var CONFIG_VERSION = 1;

// ===== VALORES INICIALES (copiados del código actual) =====

var SEED_GENERAL = [
  ['configVersion', CONFIG_VERSION, 'Versión del esquema. No modificar.'],
  ['anioPromocionDefault', 2026, 'Valor inicial de "Año de promoción".'],
  ['timezone', 'America/La_Paz', 'Zona horaria para la fecha de registro.'],
  ['incentivosSpreadsheetId', '1ACoimXDMXxxiJv7opfLTsSA2w4KauaDS7d4YN28KjwM', 'Planilla de seguimiento de incentivos (Bienestar).'],
  ['incentivosHoja', 'Hoja 1', 'Hoja dentro de la planilla de incentivos.'],
  ['incentivoSinValor', 'NO APLICA', 'Valor de "incentivo" que NO se registra en Bienestar.'],
  ['promoActiva', true, 'TRUE muestra "Incluir Pre Universitario GRATIS" en NUEVOS CARRERAS.'],
  ['promoEtiqueta', 'Incluir Pre Universitario GRATIS', 'Texto del campo de promoción.'],
  ['promoPlan', 'CATO HOLIDAY GRATIS', 'Plan de pago que se escribe en la fila de promoción.'],
  ['promoMetodoPago', 'GRATIS', 'Método de pago que se escribe en la fila de promoción.'],
  ['siaanIdRegional', 'PJh5GJydX69ABmU3tKVdpQ==', 'Regional para la búsqueda por CI en SIAAN.'],
  ['siaanIdEstadoConfirmado', 'ooo40MW8KdnMovKywZ6qzQ==', 'Estado CONFIRMADO para la búsqueda por CI en SIAAN.'],
  ['siaanTokenLegacy', '', 'Solo para el menú antiguo de Apps Script: token de SIAAN. Cambiarlo cuando expire.'],
  ['siaanUniqueCodeLegacy', 'MARKETING-CODE-2025', 'Solo para el menú antiguo: Uniquecode que acompaña al token.'],
  ['versionUrl', '', 'URL de version.json (GitHub Pages). Si hay versión nueva, el panel muestra un aviso.']
];

// id, grupo (menú), etiqueta, hoja, filasEncabezado, columnaCI, plantilla, activo, periodoSIAAN, carreraDesdeSIAAN
// periodoSIAAN: código del periodo académico en SIAAN (lo que va entre corchetes). El panel preselecciona este destino.
// carreraDesdeSIAAN: TRUE = el campo carrera se llena con la carrera de la preinscripción.
var SEED_DESTINOS = [
  ['NUEVOS', 'NUEVOS CARRERAS', 'NUEVOS CARRERAS', 'NUEVOS CARRERAS', 1, 'S', 'NUEVOS', true, '1-2027', true],
  ['MED1', 'PRE UCB CIENCIAS DE LA SALUD', 'GRUPO 1', 'PRE UCB MED 1', 2, 'H', 'PRE_MED', true, '2026-CPS-NOV', false],
  ['MED2', 'PRE UCB CIENCIAS DE LA SALUD', 'GRUPO 2', 'PRE UCB MED 2', 2, 'H', 'PRE_MED', true, '2026-CPS-DIC', false],
  ['MED3', 'PRE UCB CIENCIAS DE LA SALUD', 'GRUPO 3', 'PRE UCB MED 3', 2, 'H', 'PRE_MED', true, '2027-CPS-ENE', false],
  ['GEN1', 'PRE UCB GENERAL', 'GRUPO 1', 'PRE UCB GENERAL', 2, 'G', 'PRE_GENERAL', true, '2026-CPRU-DIC', false],
  ['GEN2', 'PRE UCB GENERAL', 'GRUPO 2', 'PRE UCB GENERAL 2', 2, 'G', 'PRE_GENERAL', true, '2027-CPRU-ENE', false]
];
var ENCABEZADOS_DESTINOS = ['id', 'grupo', 'etiqueta', 'hoja', 'filasEncabezado', 'columnaCI', 'plantilla', 'activo',
  'periodoSIAAN', 'carreraDesdeSIAAN'];

// siaan (nombre de la carrera como lo muestra SIAAN), carrera (opción de CONFIG_LISTAS).
// Solo hace falta cuando los nombres difieren más allá de tildes o la sigla entre corchetes. Vacío al inicio.
var SEED_CARRERAS_SIAAN = [];

var CARRERAS_GENERAL = ['ADMINISTRACION DE EMPRESAS', 'CONTADURIA PUBLICA', 'INGENIERIA COMERCIAL', 'INGENIERIA EMPRESARIAL',
  'INGENIERIA FINANCIERA', 'INGENIERIA EN COMERCIO Y FINANZAS INTERNACIONALES', 'ARQUITECTURA', 'INGENIERIA AMBIENTAL',
  'INGENIERIA CIVIL', 'INGENIERIA INDUSTRIAL', 'INGENIERIA MECATRONICA', 'INGENIERIA QUIMICA', 'INGENIERIA DE SISTEMAS',
  'ANTROPOLOGIA', 'COMUNICACION SOCIAL', 'DERECHO', 'DISEÑO DIGITAL MULTIMEDIA', 'FILOSOFIA Y LETRAS',
  'FILOSOFIA Y LETRAS PROGRAMA COMPLEMENTARIO', 'PSICOLOGIA'];

var CARRERAS_NUEVOS = ['MEDICINA', 'ODONTOLOGIA', 'ADMINISTRACION DE EMPRESAS', 'CONTADURIA PUBLICA', 'INGENIERIA COMERCIAL',
  'INGENIERIA EMPRESARIAL', 'INGENIERIA FINANCIERA', 'INGENIERIA EN COMERCIO Y FINANZAS INTERNACIONALES', 'ARQUITECTURA',
  'INGENIERIA AMBIENTAL', 'INGENIERIA CIVIL', 'INGENIERIA INDUSTRIAL', 'INGENIERIA MECATRONICA', 'INGENIERIA QUIMICA',
  'INGENIERIA DE SISTEMAS', 'INGENIERIA DE TELECOMUNICACIONES', 'ANTROPOLOGIA', 'COMUNICACION SOCIAL', 'DERECHO',
  'DISEÑO DIGITAL MULTIMEDIA', 'FILOSOFIA Y LETRAS', 'FILOSOFIA Y LETRAS PROGRAMA COMPLEMENTARIO', 'PSICOLOGIA',
  'LIC. TEOLOGIA PASTORAL', 'TEC. SUP. TEOLOGIA PASTORAL', 'TEC. MED. TEOLOGIA PASTORAL'];

// Una columna por lista. El primer valor es el valor por defecto si el campo no define otro.
var SEED_LISTAS = {
  asesores: ['ERIKA CASTRO', 'ROMY SALVATIERRA', 'WANDA PEREDO', 'DIEGO MORALES', 'RONALD BUSTILLOS', 'NATALIA DORADO', 'DIEGO CACERES'],
  carreras_general: CARRERAS_GENERAL,
  carreras_salud: ['MEDICINA', 'ODONTOLOGIA'],
  carreras_nuevos: CARRERAS_NUEVOS,
  planes_general: ['CATO HOLIDAY 50%', 'ESTÁNDAR', 'PRONTO PAGO', 'CATO HOLIDAY GRATIS', 'PRONTO PAGO PLUS'],
  planes_salud: ['PROMOCIÓN 50%', 'ESTÁNDAR', 'PRONTO PAGO', 'PRONTO PAGO PLUS', 'CATO HOLIDAY GRATIS'],
  planes_nuevos: ['ESTANDAR', 'PLUS'],
  metodos_pago: ['QR', 'EFECTIVO'],
  tipos_inscripcion: ['PRESENCIAL', 'VIRTUAL'],
  tipos_estudiante: ['NUEVO', 'TRASPASO', 'SEGUNDA CARRERA', 'CAMBIO DE SEDE', 'CONVENIO UMSS'],
  pack: ['PENDIENTE', 'ENTREGADO', 'NO CORRESPONDE'],
  etapas: ['TOMA DE MATERIAS INCOMPLETA', 'TOMA DE MATERIAS COMPLETADA'],
  firma_autorizacion: ['PENDIENTE', 'FIRMADO', 'ACTUALIZADO EN SIAAN'],
  firma: ['PENDIENTE', 'FIRMADO'],
  incentivos: ['NO APLICA', 'INCENTIVO CATOLICO', 'INCENTIVO OLIMPIADAS', 'INCENTIVO PRIVADO - FISCAL', 'APOYO INTERIOR',
    'APOYO FAMILIAR', 'APOYO FIDELIDAD', 'INCENTIVO INSTITUCIONAL'],
  estado_incentivo: ['NO CORRESPONDE', 'SOLICITADO', 'PENDIENTE', 'PASO POR BIENESTAR'],
  documento: ['PENDIENTE', 'ENTREGADO', 'NO CORRESPONDE'],
  documentos_incentivo: ['NO APLICA', 'LIBRETA DE SEXTO DE SECUNDARIA', 'CERTIFICADO OLIMPIADA',
    'CERTIFICADO COLEGIO DE MEJOR ESTUDIANTE ', 'BOLETÍN DE NOTAS', 'COPIA CONDICIONES INCENTIVO FUNDADOR'],
  test: ['PENDIENTE', 'SI', 'NO CORRESPONDE'],
  carreras_test_matematicas: ['ADMINISTRACION DE EMPRESAS', 'CONTADURIA PUBLICA', 'INGENIERIA COMERCIAL',
    'INGENIERIA EN COMERCIO Y FINANZAS INTERNACIONALES', 'INGENIERIA EMPRESARIAL', 'INGENIERIA FINANCIERA',
    'INGENIERIA QUIMICA', 'INGENIERIA AMBIENTAL', 'INGENIERIA INDUSTRIAL', 'INGENIERIA DE SISTEMAS', 'INGENIERIA CIVIL',
    'INGENIERIA DE TELECOMUNICACIONES', 'INGENIERIA MECATRONICA'],
  carreras_test_fisica: ['INGENIERIA QUIMICA', 'INGENIERIA AMBIENTAL', 'INGENIERIA INDUSTRIAL', 'INGENIERIA DE SISTEMAS',
    'INGENIERIA CIVIL', 'INGENIERIA DE TELECOMUNICACIONES', 'INGENIERIA MECATRONICA'],
  carreras_test_quimica: ['INGENIERIA QUIMICA', 'INGENIERIA AMBIENTAL', 'INGENIERIA INDUSTRIAL']
};

// nombre (debe estar en la lista "asesores"), email (cuenta @ucb.edu.bo con la que el asesor usa Chrome).
// El panel preselecciona el asesor cuyo email coincide con la cuenta de Chrome. Completar los emails.
var SEED_ASESORES = SEED_LISTAS.asesores.map(function (nombre) { return [nombre, '']; });

// plantilla, campo, etiqueta, tipo, lista, default, visibilidad, condicion
// tipo: select | text | number | date | textarea | promo
// default: vacío = primer valor de la lista; HOY = fecha actual; @clave = valor de CONFIG_GENERAL
// visibilidad: visible | avanzado (sección "Más campos") | oculto (se envía el default, sin UI)
function camposComunes_(plantilla, listaCarreras, listaPlanes) {
  return [
    [plantilla, 'fecha', 'Fecha de inscripción', 'date', '', 'HOY', 'avanzado', ''],
    [plantilla, 'asesor', 'Asesor', 'select', 'asesores', '', 'visible', ''],
    [plantilla, 'anioPromocion', 'Año de promoción', 'number', '', '@anioPromocionDefault', 'visible', ''],
    [plantilla, 'carrera', 'Carrera', 'select', listaCarreras, '', 'visible', ''],
    [plantilla, 'tipoInscripcion', 'Tipo de inscripción', 'select', 'tipos_inscripcion', '', 'visible', ''],
    [plantilla, 'pack', 'Pack de bienvenida', 'select', 'pack', '', 'avanzado', ''],
    [plantilla, 'etapa', 'Etapa de inscripción', 'select', 'etapas', '', 'avanzado', ''],
    [plantilla, 'plan', 'Plan de pago', 'select', listaPlanes, '', 'visible', ''],
    [plantilla, 'metodoPago', 'Método de pago', 'select', 'metodos_pago', '', 'visible', ''],
    [plantilla, 'autorizacion', 'Firma de autorización y discapacidad', 'select', 'firma_autorizacion', '', 'avanzado', ''],
    [plantilla, 'contrato', 'Firma de condiciones generales', 'select', 'firma', '', 'avanzado', ''],
    [plantilla, 'firma', 'Firma de toma de materias', 'select', 'firma', '', 'avanzado', '']
  ];
}

function seedCampos_() {
  var nuevos = [
    ['NUEVOS', 'fecha', 'Fecha de inscripción', 'date', '', 'HOY', 'avanzado', ''],
    ['NUEVOS', 'asesor', 'Asesor', 'select', 'asesores', '', 'visible', ''],
    ['NUEVOS', 'anioPromocion', 'Año de promoción', 'number', '', '@anioPromocionDefault', 'visible', ''],
    ['NUEVOS', 'carrera', 'Carrera', 'select', 'carreras_nuevos', '', 'visible', ''],
    ['NUEVOS', 'grupoPreUCB', 'Incluir Pre Universitario GRATIS', 'promo', '', '', 'visible', ''],
    ['NUEVOS', 'tipoInscripcion', 'Tipo de inscripción', 'select', 'tipos_inscripcion', '', 'visible', ''],
    ['NUEVOS', 'tipoEstudiante', 'Tipo de estudiante', 'select', 'tipos_estudiante', '', 'avanzado', ''],
    ['NUEVOS', 'universidad', 'Universidad de traspaso', 'text', '', '', 'avanzado', 'tipoEstudiante=TRASPASO'],
    ['NUEVOS', 'pack', 'Pack de bienvenida', 'select', 'pack', '', 'avanzado', ''],
    ['NUEVOS', 'etapa', 'Etapa de inscripción', 'select', 'etapas', '', 'avanzado', ''],
    ['NUEVOS', 'observaciones', 'Observaciones de materias faltantes', 'textarea', '', '', 'avanzado', ''],
    ['NUEVOS', 'plan', 'Plan de pagos', 'select', 'planes_nuevos', '', 'visible', ''],
    ['NUEVOS', 'metodoPago', 'Método de pago', 'select', 'metodos_pago', '', 'visible', ''],
    ['NUEVOS', 'incentivo', 'Incentivos - Apoyos', 'select', 'incentivos', '', 'visible', ''],
    ['NUEVOS', 'estadoIncentivo', 'Estado de incentivos - apoyos', 'select', 'estado_incentivo', '', 'avanzado', ''],
    ['NUEVOS', 'hojaDeVida', 'Firma de hoja de vida', 'select', 'firma', '', 'avanzado', ''],
    ['NUEVOS', 'autorizacion', 'Firma de autorización y discapacidad', 'select', 'firma_autorizacion', '', 'avanzado', ''],
    ['NUEVOS', 'contrato', 'Firma de condiciones generales', 'select', 'firma', '', 'avanzado', ''],
    ['NUEVOS', 'firma', 'Firma de toma de materias', 'select', 'firma', '', 'avanzado', ''],
    ['NUEVOS', 'pagosPendientes', 'Firma de pagos pendientes', 'select', 'firma', '', 'avanzado', ''],
    ['NUEVOS', 'carnet', 'Fotocopia CI', 'select', 'documento', 'ENTREGADO', 'avanzado', ''],
    ['NUEVOS', 'titulo', 'Fotocopia legalizada título SEDUCA', 'select', 'documento', '', 'avanzado', ''],
    ['NUEVOS', 'tituloGratis', 'Fotocopia legalizada título GRATIS', 'select', 'documento', '', 'avanzado', ''],
    ['NUEVOS', 'certificado', 'Certificado de nacimiento', 'select', 'documento', '', 'avanzado', ''],
    ['NUEVOS', 'fotos', 'Fotos', 'select', 'documento', '', 'avanzado', ''],
    ['NUEVOS', 'libreta', 'Fotocopia de libreta', 'select', 'documento', '', 'avanzado', ''],
    ['NUEVOS', 'documentoIncentivo', 'Documentos incentivos - apoyos', 'select', 'documentos_incentivo', '', 'avanzado', ''],
    ['NUEVOS', 'ingles', 'Test de inglés', 'select', 'test', '', 'avanzado', ''],
    ['NUEVOS', 'matematicas', 'Test de matemáticas', 'select', 'test', '', 'avanzado', ''],
    ['NUEVOS', 'fisica', 'Test de física', 'select', 'test', '', 'avanzado', ''],
    ['NUEVOS', 'quimica', 'Test de química', 'select', 'test', '', 'avanzado', ''],
    ['NUEVOS', 'lectoescritura', 'Test de lectoescritura', 'select', 'test', '', 'avanzado', '']
  ];
  return camposComunes_('PRE_MED', 'carreras_salud', 'planes_salud')
    .concat(camposComunes_('PRE_GENERAL', 'carreras_general', 'planes_general'))
    .concat(nuevos);
}

// Una entrada por columna de la hoja, en orden desde la columna A.
// Valores: campo del formulario o del estudiante | @departamentoCarrera | "TEXTO LITERAL" | vacío
// Datos del estudiante: nombre, ci, celular, colegio, departamentoColegio
var SEED_COLUMNAS = {
  PRE_MED: ['nombre', 'carrera', 'asesor', 'fecha', 'tipoInscripcion', 'pack', '', 'ci', 'celular', '', 'colegio', '',
    'departamentoColegio', '', 'anioPromocion', 'etapa', '', 'plan', 'metodoPago', 'autorizacion', 'contrato', 'firma',
    '"ENTREGADO"'],
  PRE_GENERAL: ['nombre', 'asesor', 'fecha', 'tipoInscripcion', 'pack', '', 'ci', 'celular', '', 'colegio', '',
    'departamentoColegio', '', 'anioPromocion', '@departamentoCarrera', 'carrera', 'etapa', '', 'plan', '', '',
    'metodoPago', 'autorizacion', 'contrato', 'firma', '"ENTREGADO"'],
  NUEVOS: ['nombre', '', '', '', '', '', '', '', '', '', '', '', 'asesor', 'fecha', 'tipoInscripcion', 'tipoEstudiante',
    'pack', '', 'ci', 'celular', '', 'colegio', '', 'universidad', 'departamentoColegio', '', 'anioPromocion', 'carrera',
    'etapa', 'observaciones', 'plan', 'metodoPago', 'incentivo', 'estadoIncentivo', 'hojaDeVida', 'autorizacion',
    'contrato', 'firma', 'pagosPendientes', 'carnet', 'titulo', 'tituloGratis', 'certificado', 'fotos', 'libreta',
    'documentoIncentivo', 'ingles', 'matematicas', 'fisica', 'quimica', 'lectoescritura'],
  INCENTIVOS: ['nombre', 'fecha', 'tipoInscripcion', 'tipoEstudiante', 'ci', 'celular', 'colegio', 'departamentoColegio',
    'anioPromocion', 'carrera', 'incentivo']
};

// carrera elegida en NUEVOS CARRERAS -> destinos de la promoción (ids de CONFIG_DESTINOS, separados por coma)
// "*" = cualquier otra carrera. Destinos vacíos = la carrera no participa.
var SEED_PROMO = [
  ['MEDICINA', ''],
  ['ODONTOLOGIA', 'MED1,MED2,MED3'],
  ['*', 'GEN1,GEN2']
];

// plantilla, campo, listaCarreras, valorSi, valorNo: el default del campo depende de la carrera elegida
var SEED_REGLAS = [
  ['NUEVOS', 'matematicas', 'carreras_test_matematicas', 'PENDIENTE', 'NO CORRESPONDE'],
  ['NUEVOS', 'fisica', 'carreras_test_fisica', 'PENDIENTE', 'NO CORRESPONDE'],
  ['NUEVOS', 'quimica', 'carreras_test_quimica', 'PENDIENTE', 'NO CORRESPONDE']
];

// carrera -> departamento (columna "PRE U SELECCIONADO" de PRE UCB GENERAL). "*" = cualquier otra.
var SEED_DEPARTAMENTOS = [
  ['ADMINISTRACION DE EMPRESAS', 'DAEF'], ['CONTADURIA PUBLICA', 'DAEF'], ['INGENIERIA COMERCIAL', 'DAEF'],
  ['INGENIERIA EMPRESARIAL', 'DAEF'], ['INGENIERIA FINANCIERA', 'DAEF'],
  ['INGENIERIA EN COMERCIO Y FINANZAS INTERNACIONALES', 'DAEF'],
  ['ANTROPOLOGIA', 'DCSH'], ['COMUNICACION SOCIAL', 'DCSH'], ['DERECHO', 'DCSH'], ['DISEÑO DIGITAL MULTIMEDIA', 'DCSH'],
  ['FILOSOFIA Y LETRAS', 'DCSH'], ['FILOSOFIA Y LETRAS PROGRAMA COMPLEMENTARIO', 'DCSH'], ['PSICOLOGIA', 'DCSH'],
  ['INGENIERIA QUIMICA', 'DCEI con QM'], ['INGENIERIA AMBIENTAL', 'DCEI con QM'], ['INGENIERIA INDUSTRIAL', 'DCEI con QM'],
  ['*', 'DCEI sin QM']
];

// ===== CREACIÓN DE HOJAS =====

function seedConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var creadas = [];

  if (crearHoja_(ss, 'CONFIG_GENERAL', ['clave', 'valor', 'descripcion'], SEED_GENERAL)) {
    creadas.push('CONFIG_GENERAL');
  } else {
    var agregadas = completarGeneral_(ss);
    if (agregadas.length) creadas.push('CONFIG_GENERAL (claves nuevas: ' + agregadas.join(', ') + ')');
  }

  if (crearHoja_(ss, 'CONFIG_DESTINOS', ENCABEZADOS_DESTINOS, SEED_DESTINOS)) {
    creadas.push('CONFIG_DESTINOS');
  } else {
    var columnasNuevas = completarDestinos_(ss);
    if (columnasNuevas.length) creadas.push('CONFIG_DESTINOS (columnas nuevas: ' + columnasNuevas.join(', ') + ')');
  }

  var nombresListas = Object.keys(SEED_LISTAS);
  var maxLargo = Math.max.apply(null, nombresListas.map(function (n) { return SEED_LISTAS[n].length; }));
  var filasListas = [];
  for (var i = 0; i < maxLargo; i++) {
    filasListas.push(nombresListas.map(function (n) { return SEED_LISTAS[n][i] !== undefined ? SEED_LISTAS[n][i] : ''; }));
  }
  if (crearHoja_(ss, 'CONFIG_LISTAS', nombresListas, filasListas)) creadas.push('CONFIG_LISTAS');

  if (crearHoja_(ss, 'CONFIG_CAMPOS',
      ['plantilla', 'campo', 'etiqueta', 'tipo', 'lista', 'default', 'visibilidad', 'condicion'], seedCampos_())) {
    creadas.push('CONFIG_CAMPOS');
  }

  if (crearHoja_(ss, 'CONFIG_COLUMNAS', ['plantilla', 'columna', 'valor', 'encabezado'], filasColumnas_(ss))) {
    creadas.push('CONFIG_COLUMNAS');
  }

  if (crearHoja_(ss, 'CONFIG_PROMO', ['carrera', 'destinos'], SEED_PROMO)) creadas.push('CONFIG_PROMO');
  if (crearHoja_(ss, 'CONFIG_REGLAS', ['plantilla', 'campo', 'listaCarreras', 'valorSi', 'valorNo'], SEED_REGLAS)) {
    creadas.push('CONFIG_REGLAS');
  }
  if (crearHoja_(ss, 'CONFIG_DEPARTAMENTOS', ['carrera', 'departamento'], SEED_DEPARTAMENTOS)) {
    creadas.push('CONFIG_DEPARTAMENTOS');
  }
  if (crearHoja_(ss, 'CONFIG_ASESORES', ['nombre', 'email'], SEED_ASESORES)) creadas.push('CONFIG_ASESORES');
  if (crearHoja_(ss, 'CONFIG_CARRERAS_SIAAN', ['siaan', 'carrera'], SEED_CARRERAS_SIAAN)) creadas.push('CONFIG_CARRERAS_SIAAN');

  Logger.log(creadas.length ? 'Hojas creadas: ' + creadas.join(', ') : 'No se creó nada: todas las hojas CONFIG_* ya existen.');
}

// Arma CONFIG_COLUMNAS con la letra de columna y el encabezado real de la hoja (solo como referencia).
function filasColumnas_(ss) {
  var filas = [];
  Object.keys(SEED_COLUMNAS).forEach(function (plantilla) {
    var encabezados = plantilla === 'INCENTIVOS' ? encabezadosIncentivos_() : encabezadosDePlantilla_(ss, plantilla);
    SEED_COLUMNAS[plantilla].forEach(function (valor, i) {
      filas.push([plantilla, letraColumna_(i + 1), valor, encabezados[i] || '']);
    });
  });
  return filas;
}

// Encabezado de la primera hoja destino que usa la plantilla (última fila de encabezado).
function encabezadosDePlantilla_(ss, plantilla) {
  var destino = SEED_DESTINOS.filter(function (d) { return d[6] === plantilla; })[0];
  var hoja = destino && ss.getSheetByName(destino[3]);
  if (!hoja) return [];
  return leerEncabezados_(hoja, destino[4], SEED_COLUMNAS[plantilla].length);
}

function encabezadosIncentivos_() {
  try {
    var hoja = SpreadsheetApp.openById(valorSeed_('incentivosSpreadsheetId')).getSheetByName(valorSeed_('incentivosHoja'));
    return hoja ? leerEncabezados_(hoja, 1, SEED_COLUMNAS.INCENTIVOS.length) : [];
  } catch (e) {
    Logger.log('No se pudo leer la planilla de incentivos: ' + e.message);
    return [];
  }
}

function leerEncabezados_(hoja, filasEncabezado, columnas) {
  return hoja.getRange(filasEncabezado, 1, 1, columnas).getDisplayValues()[0]
    .map(function (h) { return String(h).replace(/\s+/g, ' ').trim(); });
}

// Agrega a CONFIG_DESTINOS las columnas nuevas (con los valores semilla de cada id), sin tocar las existentes.
function completarDestinos_(ss) {
  var hoja = ss.getSheetByName('CONFIG_DESTINOS');
  var valores = hoja.getDataRange().getDisplayValues();
  var enc = valores[0];
  var nuevas = ENCABEZADOS_DESTINOS.filter(function (h) { return enc.indexOf(h) < 0; });
  nuevas.forEach(function (nombre) {
    var iSeed = ENCABEZADOS_DESTINOS.indexOf(nombre);
    var col = hoja.getLastColumn() + 1;
    var columna = [[nombre]].concat(valores.slice(1).map(function (fila) {
      var seed = SEED_DESTINOS.filter(function (d) { return d[0] === fila[enc.indexOf('id')]; })[0];
      return [seed ? String(seed[iSeed]) : ''];
    }));
    hoja.getRange(1, col, columna.length, 1).setNumberFormat('@').setValues(columna);
    hoja.getRange(1, col).setFontWeight('bold').setBackground('#e8eaed');
  });
  return nuevas;
}

// Agrega a CONFIG_GENERAL las claves nuevas que todavía no tiene, sin tocar las existentes.
function completarGeneral_(ss) {
  var hoja = ss.getSheetByName('CONFIG_GENERAL');
  var existentes = hoja.getDataRange().getDisplayValues().map(function (f) { return f[0]; });
  var nuevas = SEED_GENERAL.filter(function (f) { return existentes.indexOf(f[0]) < 0; });
  if (nuevas.length) {
    hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, 3).setNumberFormat('@')
      .setValues(nuevas.map(function (f) { return f.map(String); }));
  }
  return nuevas.map(function (f) { return f[0]; });
}

function crearHoja_(ss, nombre, encabezados, filas) {
  if (ss.getSheetByName(nombre)) return false;
  var hoja = ss.insertSheet(nombre);
  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]).setFontWeight('bold').setBackground('#e8eaed');
  if (filas.length) {
    // Texto plano: evita que Sheets convierta valores como "2026" o "TRUE" en otros tipos sin querer.
    var rango = hoja.getRange(2, 1, filas.length, encabezados.length);
    rango.setNumberFormat('@').setValues(filas.map(function (f) { return f.map(function (v) { return String(v); }); }));
  }
  hoja.setFrozenRows(1);
  hoja.autoResizeColumns(1, encabezados.length);
  hoja.setTabColor('#9aa0a6');
  return true;
}

// ===== VERIFICACIÓN =====

// Lee las hojas CONFIG_* (no los valores semilla) y revisa que sean coherentes con las hojas reales.
function verificarConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var errores = [];
  var avisos = [];

  var tabla = function (nombre) {
    var hoja = ss.getSheetByName(nombre);
    if (!hoja) { errores.push('Falta la hoja ' + nombre + '. Ejecute seedConfig().'); return []; }
    var valores = hoja.getDataRange().getDisplayValues();
    var enc = valores.shift();
    return valores.filter(function (f) { return f.join('') !== ''; }).map(function (f) {
      var o = {};
      enc.forEach(function (h, i) { o[h] = f[i]; });
      return o;
    });
  };

  var general = {};
  tabla('CONFIG_GENERAL').forEach(function (r) { general[r.clave] = r.valor; });
  var destinos = tabla('CONFIG_DESTINOS');
  var campos = tabla('CONFIG_CAMPOS');
  var columnas = tabla('CONFIG_COLUMNAS');
  var promo = tabla('CONFIG_PROMO');
  var reglas = tabla('CONFIG_REGLAS');
  var asesores = tabla('CONFIG_ASESORES');
  var carrerasSiaan = tabla('CONFIG_CARRERAS_SIAAN');

  var hojaListas = ss.getSheetByName('CONFIG_LISTAS');
  var listas = {};
  if (hojaListas) {
    var v = hojaListas.getDataRange().getDisplayValues();
    v[0].forEach(function (nombre, c) {
      if (nombre) listas[nombre] = v.slice(1).map(function (f) { return f[c]; }).filter(function (x) { return x !== ''; });
    });
  } else {
    errores.push('Falta la hoja CONFIG_LISTAS.');
  }

  if (String(general.configVersion) !== String(CONFIG_VERSION)) {
    errores.push('configVersion es ' + general.configVersion + ', se esperaba ' + CONFIG_VERSION + '.');
  }

  var datosEstudiante = ['nombre', 'ci', 'celular', 'colegio', 'departamentoColegio'];
  var plantillas = {};
  campos.forEach(function (c) {
    plantillas[c.plantilla] = plantillas[c.plantilla] || [];
    plantillas[c.plantilla].push(c.campo);
    if (c.lista && !listas[c.lista]) errores.push('CONFIG_CAMPOS ' + c.plantilla + '.' + c.campo + ': la lista "' + c.lista + '" no existe.');
    if (c.tipo === 'select' && !c.lista) errores.push('CONFIG_CAMPOS ' + c.plantilla + '.' + c.campo + ': un select necesita lista.');
    if (['visible', 'avanzado', 'oculto'].indexOf(c.visibilidad) < 0) {
      errores.push('CONFIG_CAMPOS ' + c.plantilla + '.' + c.campo + ': visibilidad "' + c.visibilidad + '" no válida.');
    }
    if (c['default'] && c['default'].charAt(0) === '@' && !(c['default'].slice(1) in general)) {
      errores.push('CONFIG_CAMPOS ' + c.plantilla + '.' + c.campo + ': ' + c['default'] + ' no existe en CONFIG_GENERAL.');
    }
    if (c.lista && c['default'] && c['default'] !== 'HOY' && c['default'].charAt(0) !== '@' &&
        listas[c.lista] && listas[c.lista].indexOf(c['default']) < 0) {
      errores.push('CONFIG_CAMPOS ' + c.plantilla + '.' + c.campo + ': el default "' + c['default'] + '" no está en la lista ' + c.lista + '.');
    }
  });

  columnas.forEach(function (c) {
    var v = c.valor;
    if (!v || v.charAt(0) === '"' || v === '@departamentoCarrera') return;
    var conocidos = datosEstudiante.concat(plantillas[c.plantilla] || [], plantillas.NUEVOS || []);
    if (conocidos.indexOf(v) < 0) errores.push('CONFIG_COLUMNAS ' + c.plantilla + '!' + c.columna + ': "' + v + '" no es un campo conocido.');
  });

  var ids = destinos.map(function (d) { return d.id; });
  destinos.forEach(function (d) {
    if (String(d.activo).toUpperCase() !== 'TRUE') return;
    var hoja = ss.getSheetByName(d.hoja);
    if (!hoja) { errores.push('Destino ' + d.id + ': no existe la hoja "' + d.hoja + '".'); return; }
    if (!plantillas[d.plantilla]) errores.push('Destino ' + d.id + ': la plantilla "' + d.plantilla + '" no tiene campos.');

    var filas = Number(d.filasEncabezado);
    var encabezadoCI = hoja.getRange(d.columnaCI + filas).getDisplayValue();
    if (!/C[ÉE]DULA|C\.?\s?I\b/i.test(encabezadoCI)) {
      errores.push('Destino ' + d.id + ': la columna ' + d.columnaCI + ' dice "' + encabezadoCI + '", no parece la columna de CI.');
    }

    // Compara el encabezado real con el guardado en CONFIG_COLUMNAS (solo columnas que se escriben).
    var cols = columnas.filter(function (c) { return c.plantilla === d.plantilla; });
    var reales = leerEncabezados_(hoja, filas, cols.length);
    cols.forEach(function (c, i) {
      if (c.valor && c.encabezado && reales[i] !== c.encabezado) {
        avisos.push(d.hoja + '!' + c.columna + ': encabezado "' + reales[i] + '", CONFIG_COLUMNAS espera "' + c.encabezado + '" (escribe ' + c.valor + ').');
      }
    });
  });

  promo.forEach(function (p) {
    String(p.destinos).split(',').map(function (s) { return s.trim(); }).filter(String).forEach(function (id) {
      if (ids.indexOf(id) < 0) errores.push('CONFIG_PROMO ' + p.carrera + ': destino "' + id + '" no existe.');
    });
  });
  var periodos = {};
  destinos.forEach(function (d) {
    if (String(d.activo).toUpperCase() !== 'TRUE') return;
    var p = String(d.periodoSIAAN || '').trim().toUpperCase();
    if (!p) { avisos.push('Destino ' + d.id + ': sin periodoSIAAN; no se preseleccionará.'); return; }
    if (periodos[p]) errores.push('CONFIG_DESTINOS: el periodo ' + p + ' está en ' + periodos[p] + ' y en ' + d.id + '.');
    periodos[p] = d.id;
  });
  carrerasSiaan.forEach(function (c) {
    if (listas.carreras_nuevos && listas.carreras_nuevos.indexOf(c.carrera) < 0) {
      errores.push('CONFIG_CARRERAS_SIAAN: "' + c.carrera + '" no está en la lista carreras_nuevos.');
    }
  });

  var emails = {};
  asesores.forEach(function (a) {
    if (listas.asesores && listas.asesores.indexOf(a.nombre) < 0) {
      errores.push('CONFIG_ASESORES: "' + a.nombre + '" no está en la lista asesores de CONFIG_LISTAS.');
    }
    var email = String(a.email || '').trim().toLowerCase();
    if (!email) { avisos.push('CONFIG_ASESORES: ' + a.nombre + ' no tiene email; no se preseleccionará.'); return; }
    if (!/^[^@\s]+@ucb\.edu\.bo$/.test(email)) errores.push('CONFIG_ASESORES: "' + a.email + '" no es un email @ucb.edu.bo.');
    if (emails[email]) errores.push('CONFIG_ASESORES: el email ' + email + ' está repetido (' + emails[email] + ', ' + a.nombre + ').');
    emails[email] = a.nombre;
  });

  reglas.forEach(function (r) {
    if (!listas[r.listaCarreras]) errores.push('CONFIG_REGLAS ' + r.campo + ': la lista "' + r.listaCarreras + '" no existe.');
  });

  var informe = (errores.length ? 'ERRORES (' + errores.length + '):\n- ' + errores.join('\n- ') : 'Sin errores.') +
    (avisos.length ? '\n\nAVISOS (' + avisos.length + '):\n- ' + avisos.join('\n- ') : '');
  Logger.log(informe);
  return informe;
}

// ===== UTILIDADES =====

function valorSeed_(clave) {
  return SEED_GENERAL.filter(function (f) { return f[0] === clave; })[0][1];
}

function letraColumna_(n) {
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
