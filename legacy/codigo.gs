
//var datosEstudiante;
var ui = SpreadsheetApp.getUi();
// EL TOKEN DEL SIAAN YA NO VA EN EL CÓDIGO: SE LEE DE LA HOJA CONFIG_GENERAL
// (claves siaanTokenLegacy y siaanUniqueCodeLegacy). CAMBIARLO AHÍ CUANDO EXPIRE.

var ss = SpreadsheetApp.getActiveSpreadsheet();

//LEE UN VALOR DE CONFIG_GENERAL (MISMA HOJA QUE USA LA EXTENSIÓN)
function leerConfigGeneral_(clave) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("CONFIG_GENERAL");
  if (!hoja) return "";
  var valores = hoja.getDataRange().getDisplayValues();
  for (var i = 1; i < valores.length; i++) {
    if (valores[i][0] === clave) return String(valores[i][1]).trim();
  }
  return "";
}

//DEVUELVE EL TOKEN DEL SIAAN
function getToken(){
  var token = leerConfigGeneral_("siaanTokenLegacy");
  if (!token) throw new Error("Falta el token de SIAAN: complete siaanTokenLegacy en la hoja CONFIG_GENERAL.");
  return token;
}

function getUniqueCode(){
  return leerConfigGeneral_("siaanUniqueCodeLegacy") || "MARKETING-CODE-2025";
}

// GUARDAR LOS DATOS DEL ESTUDIANTE UNA VEZ ANTES QUE SE LLENE EL FORMULARIO DE PANTALLA
function setdatosEstudiante(value) {
  var userProperties = PropertiesService.getUserProperties();
  var serializedObject = JSON.stringify(value);
  userProperties.setProperty('datosEstudiante', serializedObject);
}

// OBTENER LOS DATOS DEL ESTUDIANTE UNA VEZ QUE SE LLENO EL FORMULARIO DE PANTALLA
function getDatosEstudiante() {
  var userProperties = PropertiesService.getUserProperties();
  var serializedObject = userProperties.getProperty('datosEstudiante');
  
  if (serializedObject) {
    return JSON.parse(serializedObject);
  } else {
    return null;
  }
}

//MOSTRAR OPCIONES DE MENU EN GOOGLE SHEETS
function onOpen() {
  var ui = SpreadsheetApp.getUi();  // Get the UI of the spreadsheet

  // Submenu for "PRE UCB MEDICINA"
  var preUcbMedicinaSubMenu = ui.createMenu('PRE UCB CIENCIAS DE LA SALUD')
    .addItem('GRUPO 1', 'agregarPREUCBMEDUNO')
    .addItem('GRUPO 2', 'agregarPREUCBMEDDOS')
    .addItem('GRUPO 3', 'agregarPREUCBMEDTRES');

  // Submenu for "PRE UCB GENERAL"
  var preUcbGeneralSubMenu = ui.createMenu('PRE UCB GENERAL')
    .addItem('GRUPO 1', 'agregarPreUcbGeneralGrupoUno')
    .addItem('GRUPO 2', 'agregarPreUcbGeneralGrupoDos');

  // Main menu with submenus
  ui.createMenu('Añadir estudiante')
    .addItem('NUEVOS CARRERAS', 'agregarNuevoCarrera')
    .addSubMenu(preUcbMedicinaSubMenu) // Add "PRE UCB MEDICINA" submenu
    .addSubMenu(preUcbGeneralSubMenu)  // Add "PRE UCB GENERAL" submenu
    .addToUi();  // Add the menu to the UI
}
 
//SOLICITA AL USUARIO INGRESAR EL CI DEL ESTUDIANTE
function getCIEstudiante(){ 
  var carnet = ui.prompt('Añadir Estudiante', 'Ingrese el número de carnet', ui.ButtonSet.OK_CANCEL);
  return carnet.getResponseText()
}

//OBTENER EL ID DE LA INSCRIPCIÓN QUE EL ESTUDIANTE TIENE EN EL SIAAN
function obtenerIDEstudiante(carnet) {
  return new Promise(function(resolve, reject) {
    try {
      var url = "https://backend.ucb.edu.bo/Academico/api/v1/Academico/PreInscripcion/ObtenerListaPreinscripcionesReducidas?idRegional=PJh5GJydX69ABmU3tKVdpQ==&idEstadoPreinscripcion=ooo40MW8KdnMovKywZ6qzQ==&apellidosNombresCi=" + carnet;
      //var url = "https://backend2.ucb.edu.bo/Authentication/api/v1/Personas/ObtenerPersonasPorRegional?idRegional=PJh5GJydX69ABmU3tKVdpQ==&criterioBusqueda=" + carnet + "&tipoResultado=Objeto";
      
      // Add missing semicolon in the URL above.

      var headers = {
        'Token': getToken(),
        'Uniquecode': getUniqueCode()
      };
      var options = {
        'headers': headers,
        'muteHttpExceptions': true
      };
      var response = UrlFetchApp.fetch(url, options);
      var codigo = response.getResponseCode();
      if (codigo === 401 || codigo === 403) {
        reject(new Error("El token de SIAAN expiró. Actualice siaanTokenLegacy en la hoja CONFIG_GENERAL."));
        return;
      }
      if (codigo === 404) {
        // SIAAN RESPONDE 404 CUANDO NO HAY UNA PREINSCRIPCIÓN CONFIRMADA CON ESE CI
        reject(new Error("No hay una preinscripción CONFIRMADA con ese carnet."));
        return;
      }
      if (codigo !== 200) {
        reject(new Error("SIAAN respondió con error " + codigo));
        return;
      }
      var jsonData = JSON.parse(response.getContentText());
      resolve(jsonData.datos[0][7].contenidoCelda[0].parametros[0].valorParametro);
    } catch (e) {
        reject(e.message ? e : new Error("El Estudiante no fue encontrado"));
    }
  });
}

//OBTENER DATOS DE LA PREINSCRIPCIÓN DEL ESTUDIANTE (CONSIDERAR CAMBIAR A QUE SEAN DIRECTO LOS DATOS DEL FILE ACADEMICO DEL ESTUDIANTE)
function obtenerDatosEstudiante(id){
  try {
    var url = "https://backend.ucb.edu.bo/Academico/api/v1/Academico/PreInscripcion/ObtenerDatosPreInscripcionReducida?idPreinscripcion=" +id;
    //var url = "https://backend.ucb.edu.bo/Academico/api/v1/Academico/FileVirtual/ObtenerDatosPersonales?idPersona=" + id;
    var headers = {
        'Token': getToken(),
        'Uniquecode': getUniqueCode()
      };

      var options = {
        'headers': headers
      };
      var response = UrlFetchApp.fetch(url, options);

      if (response.getResponseCode() === 200) {
        var jsonData = JSON.parse(response.getContentText());
        Logger.log(jsonData.datos.preInscripcion)
        return jsonData.datos.preInscripcion
      }
  }
  catch (e) {
    Logger.log(e)
    throw new Error("Hubo un problema al obtener los datos del estudiante");
  }
}

function handleRequest(response){
  if (response.getResponseCode() == 200) {
      // Successful response, process data
      var data = response.getContentText();
      return data;
      // Your code to process the data goes here
    } else {
      // Handle non-200 HTTP response
      ui.alert('El Estudiante no pudo ser encontrado', ui.ButtonSet.YES);
      return 0
  }
}


function eliminarEspaciosDuplicados(cadena) {
  // Utiliza la función replace con una expresión regular para eliminar espacios duplicados
  var cadenaSinDuplicados = cadena.replace(/\s+/g, ' ');
  return cadenaSinDuplicados;
}

//FUNCIONES PARA AGREGAR A CADA HOJA DEL GOOGLE SHEETS (OJO: EL VALOR ENTRE COMILLAS DEBE SER IGUAL AL NOMBRE DE LA HOJA)
function agregarPREUCBMEDUNO(){
  agregarEstudianteNuevo("PRE UCB MED 1")
} 
function agregarPREUCBMEDDOS(){
  agregarEstudianteNuevo("PRE UCB MED 2")
} 
function agregarPREUCBMEDTRES(){
  agregarEstudianteNuevo("PRE UCB MED 3")
} 

function agregarPreUcbGeneralGrupoUno(){
  agregarEstudianteNuevo("PRE UCB GENERAL")
}

function agregarPreUcbGeneralGrupoDos(){
  agregarEstudianteNuevo("PRE UCB GENERAL 2")
}

function agregarNuevoCarrera(){
  agregarEstudianteNuevo("NUEVOS CARRERAS")
}

//FUNCIÓN PRINCIPAL LLAMADA UNA VEZ SE SELECCIONA OPCIÓN DEL MENU
function agregarEstudianteNuevo(hojaCarrera){
  try{
    var carnet = getCIEstudiante()
    if(carnet){
      if(!doesValueExist(hojaCarrera, carnet)){
        obtenerIDEstudiante(carnet)
        .then(function(id) {
          setdatosEstudiante(obtenerDatosEstudiante(id))
          openCustomUI(getDatosEstudiante().datosPersonales.apellidosNombres, hojaCarrera)
        })
        .catch(function(error) {
          ui.alert(error.message);
        });
      }
      else{
        ui.alert("Este estudiante YA HA SIDO REGISTRADO ANTERIORMENTE");
      }
      
    }
    
  }
  catch (e) {
    // Handle other errors during the HTTP request
      ui.alert(e.message);
  }
}

//VERIFICA QUE EL NOMBRE DEL USUARIO NO EXISTA YA EN LA TABLA 
function doesValueExist(sheetName, valueToCheck) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(sheetName);
  var columnaIndex; //COLUMNA EN LA QUE SE ENCUENTRA EL CI DEL ESTUDIANTE

  if (!sheet) {
    return false;
  }

  // COLUMNA DEL CI SEGÚN CONFIG_DESTINOS (LA MISMA QUE USA LA EXTENSIÓN)
  columnaIndex = columnaCIConfig_(sheetName);
  if(!columnaIndex){
    if(sheetName =="NUEVOS CARRERAS"){
      columnaIndex = 19; // S
    }
    else if(sheetName =="PRE UCB GENERAL" || sheetName =="PRE UCB GENERAL 2"){
      columnaIndex = 7; // G
    }
    else {
      columnaIndex = 8; // H: PRE UCB MED 1, 2 Y 3
    }
  }
  
  // Get all values in the second column
  var valuesInSecondColumn = sheet.getRange(1, columnaIndex, sheet.getLastRow(), 1).getValues();

  // Flatten the 2D array to a 1D array
  var flatValues = valuesInSecondColumn.flat();

  flatValues = flatValues.map(function(element) {
  return String(element);
  });
  Logger.log(flatValues)

  // Check if the value exists in the second column
  var exists = flatValues.includes(valueToCheck);
  Logger.log("Existe: " + exists)
  return exists;
}


//NÚMERO DE COLUMNA DEL CI PARA UNA HOJA, SEGÚN CONFIG_DESTINOS (0 SI NO ESTÁ)
function columnaCIConfig_(sheetName) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("CONFIG_DESTINOS");
  if (!hoja) return 0;
  var valores = hoja.getDataRange().getDisplayValues();
  var enc = valores[0];
  var iHoja = enc.indexOf("hoja"), iCol = enc.indexOf("columnaCI");
  for (var i = 1; i < valores.length; i++) {
    if (valores[i][iHoja] === sheetName) {
      var letras = String(valores[i][iCol]).trim().toUpperCase();
      var n = 0;
      for (var j = 0; j < letras.length; j++) n = n * 26 + (letras.charCodeAt(j) - 64);
      return n;
    }
  }
  return 0;
}

//ABRE EL FORMULARIO POPUP DONDE SE LLENAN DATOS FALTANTES
function openCustomUI(nombreCompleto, hojaCarrera) {
  // Create a new HTML user interface
  var htmlOutput = HtmlService.createHtmlOutputFromFile(hojaCarrera)
      .setWidth(550)//410
      .setHeight(450);
  
  // Show the dialog
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Añadir a ' + nombreCompleto);

}


//OBTENER DATOS PARA LLENAR EN CASO DE PRE UCB MEDICINA
function getDataFromUIMedicinaPre(dataInscripcion, hojadePreU) {
  nombre = eliminarEspaciosDuplicados(getDatosEstudiante().datosPersonales.apellidosNombres)
  ci = getDatosEstudiante().datosPersonales.documentoIdentidad
  celular = getDatosEstudiante().datosPersonales.celulares
  colegio = [getDatosEstudiante().datosColegio.colegio, getDatosEstudiante().datosColegio.departamento]
  
  //IMPORTANTE: CADA VALOR DE LA LISTA dataToAppend ES COMO SI FUERA UNA COLUMNA. ESTA LISTA DEBE ESTAR EN EL MISMO ORDEN QUE ESTÁN LAS COLUMNAS
  //DEL EXCEL. EN CASO DE AÑADIR O QUITAR COLUMNAS, SE DEBE MODIFICAR EL dataToAppend. 
  //OJO: SI UNA COLUMNA DEBE QUEDAR CON VALOR VACIO SE DEBE COLOCAR "", NO DIRECTAMENTE SALTAR A LA SIGUIENTE COLUMNA
  var dataToAppend = [nombre,dataInscripcion.carrera, dataInscripcion.asesor, dataInscripcion.fecha,dataInscripcion.tipoInscripcion, dataInscripcion.pack, "", ci, celular, "", colegio[0], "", colegio[1], "", dataInscripcion.anioPromocion, dataInscripcion.etapa, "", dataInscripcion.plan,dataInscripcion.metodoPago, dataInscripcion.autorizacion , dataInscripcion.contrato, dataInscripcion.firma, "ENTREGADO"];
    
  anadirFilaDatos(dataToAppend, hojadePreU)
}

//OBTENER DATOS PARA LLENAR EN CASO DE PRE UCB GENERAL
function getDataFromUIPreGeneral(dataInscripcion, hojadePreU) {
  nombre = eliminarEspaciosDuplicados(getDatosEstudiante().datosPersonales.apellidosNombres)
  ci = getDatosEstudiante().datosPersonales.documentoIdentidad
  celular = getDatosEstudiante().datosPersonales.celulares
  colegio = [getDatosEstudiante().datosColegio.colegio,
  getDatosEstudiante().datosColegio.departamento]
  departamentoCarrera = obtenerDepartamento(dataInscripcion.carrera)

  //IMPORTANTE: CADA VALOR DE LA LISTA dataToAppend ES COMO SI FUERA UNA COLUMNA. ESTA LISTA DEBE ESTAR EN EL MISMO ORDEN QUE ESTÁN LAS COLUMNAS
  //DEL EXCEL. EN CASO DE AÑADIR O QUITAR COLUMNAS, SE DEBE MODIFICAR EL dataToAppend. 
  //OJO: SI UNA COLUMNA DEBE QUEDAR CON VALOR VACIO SE DEBE COLOCAR "", NO DIRECTAMENTE SALTAR A LA SIGUIENTE COLUMNA
  var dataToAppend = [nombre, dataInscripcion.asesor, dataInscripcion.fecha,dataInscripcion.tipoInscripcion, dataInscripcion.pack, "", ci,  celular,"", colegio[0], "", colegio[1],"", dataInscripcion.anioPromocion,departamentoCarrera, dataInscripcion.carrera, dataInscripcion.etapa, "", dataInscripcion.plan, "", "",dataInscripcion.metodoPago,dataInscripcion.autorizacion,dataInscripcion.contrato, dataInscripcion.firma, "ENTREGADO"];
    
  anadirFilaDatos(dataToAppend, hojadePreU)
}

//OBTENER DATOS PARA LLENAR EN CASO DE INSCRITOS A CARRERA
function getDataFromUINuevosCarreras(dataInscripcion) {
  nombre = eliminarEspaciosDuplicados(getDatosEstudiante().datosPersonales.apellidosNombres)
  ci = getDatosEstudiante().datosPersonales.documentoIdentidad
  celular = getDatosEstudiante().datosPersonales.celulares
  colegio = [getDatosEstudiante().datosColegio.colegio, getDatosEstudiante().datosColegio.departamento]

  //IMPORTANTE: CADA VALOR DE LA LISTA dataToAppend ES COMO SI FUERA UNA COLUMNA. ESTA LISTA DEBE ESTAR EN EL MISMO ORDEN QUE ESTÁN LAS COLUMNAS
  //DEL EXCEL. EN CASO DE AÑADIR O QUITAR COLUMNAS, SE DEBE MODIFICAR EL dataToAppend. 
  //OJO: SI UNA COLUMNA DEBE QUEDAR CON VALOR VACIO SE DEBE COLOCAR "", NO DIRECTAMENTE SALTAR A LA SIGUIENTE COLUMNA
  var dataToAppend = [nombre,"", "", "","", "", "","", "", "", "",  "", dataInscripcion.asesor, dataInscripcion.fecha,dataInscripcion.tipoInscripcion, dataInscripcion.tipoEstudiante, dataInscripcion.pack, "", ci, celular,"", colegio[0], "",dataInscripcion.universidad, colegio[1], "", dataInscripcion.anioPromocion, dataInscripcion.carrera, dataInscripcion.etapa, dataInscripcion.observaciones, dataInscripcion.plan,dataInscripcion.metodoPago, dataInscripcion.incentivo, dataInscripcion.estadoIncentivo,dataInscripcion.hojaDeVida, dataInscripcion.autorizacion, dataInscripcion.contrato, dataInscripcion.firma, dataInscripcion.pagosPendientes, dataInscripcion.carnet,dataInscripcion.titulo, dataInscripcion.tituloGratis,dataInscripcion.certificado, dataInscripcion.fotos, dataInscripcion.libreta,dataInscripcion.documentoIncentivo, dataInscripcion.ingles,dataInscripcion.matematicas,dataInscripcion.fisica,dataInscripcion.quimica,dataInscripcion.lectoescritura];

  
  anadirFilaDatos(dataToAppend, "NUEVOS CARRERAS")

  //EN ESTA SECCIÓN EVALUA SI EL ESTUDIANTE TIENE INCENTIVO O NO PARA AÑADIR A EXCEL DE BIENESTAR
  if(dataInscripcion.incentivo != "" && dataInscripcion.incentivo != "NO APLICA"){
    var datosInscripcionIncentivo = [nombre, dataInscripcion.fecha, dataInscripcion.tipoInscripcion, dataInscripcion.tipoEstudiante, ci, celular, colegio[0], colegio[1],dataInscripcion.anioPromocion, dataInscripcion.carrera, dataInscripcion.incentivo]

    try {
      anadirASeguimientoIncentivos(datosInscripcionIncentivo)
    } catch(e) {
      Logger.log("Error al registrar en hoja de incentivos: " + e.message);
      // No relanzamos el error para que el popup sí confirme el registro al usuario
    }
  } 

      // ===== PROMOCIÓN TEMPORAL: PRE UCB GRATIS — BORRAR ESTE BLOQUE CUANDO TERMINE EL EVENTO =====
  if(dataInscripcion.grupoPreUCB && dataInscripcion.grupoPreUCB !== ""){
    try {
      var hojaDestinoPromo = dataInscripcion.grupoPreUCB; // ej: "PRE UCB MED 1" o "PRE UCB GENERAL 2"
      var dataToAppendPreUCB;

      if(hojaDestinoPromo.indexOf("PRE UCB MED") === 0){
        // Estructura de columnas tipo CIENCIAS DE LA SALUD (getDataFromUIMedicinaPre)
        dataToAppendPreUCB = [
          nombre, dataInscripcion.carrera, dataInscripcion.asesor, dataInscripcion.fecha,
          dataInscripcion.tipoInscripcion, dataInscripcion.pack, "", ci, celular, "",
          colegio[0], "", colegio[1], "", dataInscripcion.anioPromocion, dataInscripcion.etapa,
          "", "CATO HOLIDAY GRATIS","GRATIS", dataInscripcion.autorizacion, dataInscripcion.contrato,
          dataInscripcion.firma, "ENTREGADO"
        ];
      } else {
        // Estructura de columnas tipo GENERAL (getDataFromUIPreGeneral)
        var departamentoCarreraPromo = obtenerDepartamento(dataInscripcion.carrera);
        dataToAppendPreUCB = [
          nombre, dataInscripcion.asesor, dataInscripcion.fecha, dataInscripcion.tipoInscripcion,
          dataInscripcion.pack, "", ci, celular, "", colegio[0], "", colegio[1], "",
          dataInscripcion.anioPromocion, departamentoCarreraPromo, dataInscripcion.carrera,
          dataInscripcion.etapa, "", "CATO HOLIDAY GRATIS", "", "","GRATIS",
          dataInscripcion.autorizacion, dataInscripcion.contrato, dataInscripcion.firma, "ENTREGADO"
        ];
      }

      anadirFilaDatos(dataToAppendPreUCB, hojaDestinoPromo);
    } catch(e) {
      Logger.log("Error al registrar en Pre UCB (promoción): " + e.message);
    }
  }
  // ===== FIN BLOQUE PROMOCIÓN TEMPORAL =====


}

//AÑADIR DATOS A LA TABLA DE EXCEL DE ADMISIONES
function anadirFilaDatos(datos, nombreHoja){
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombreHoja);
  sheet.appendRow(datos)
}

function anadirASeguimientoIncentivos(datosInscripcionIncentivo) {
  var idSeguimientoBienestar = "1ACoimXDMXxxiJv7opfLTsSA2w4KauaDS7d4YN28KjwM";
  var nombreHoja = "Hoja 1";//revisar siempre el nombre de la hoja
  
  var ss = SpreadsheetApp.openById(idSeguimientoBienestar);
  var sheet = ss.getSheetByName(nombreHoja);
  
  sheet.appendRow(datosInscripcionIncentivo);
  
}
//VERIFICA A QUE DEPARTAMENTO PERTENECE LAS CARRERAS EXCEPTO POR LAS DE SALUD
function obtenerDepartamento(carrera){
  var daefCareers = ["ADMINISTRACION DE EMPRESAS", "CONTADURIA PUBLICA", "INGENIERIA COMERCIAL", "INGENIERIA EMPRESARIAL", "INGENIERIA FINANCIERA", "INGENIERIA EN COMERCIO Y FINANZAS INTERNACIONALES"];
  var dcshCareers = ["ANTROPOLOGIA", "COMUNICACION SOCIAL", "DERECHO","DISEÑO DIGITAL MULTIMEDIA", "FILOSOFIA Y LETRAS", "FILOSOFIA Y LETRAS PROGRAMA COMPLEMENTARIO", "PSICOLOGIA"];
  var dceiWithQM = ["INGENIERIA QUIMICA", "INGENIERIA AMBIENTAL", "INGENIERIA INDUSTRIAL"];
  
  if (daefCareers.includes(carrera)) {
    return "DAEF";
  } else if (dcshCareers.includes(carrera)) {
    return "DCSH";
  } else if (dceiWithQM.includes(carrera)) {
    return "DCEI con QM";
  } else {
    return "DCEI sin QM";
  }
}


