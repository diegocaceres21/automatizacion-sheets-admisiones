# Admisiones UCB: guía para asesores

Extensión de Chrome para registrar estudiantes en las planillas de Admisiones desde un panel lateral, sin abrir Google Sheets.

## Antes de instalar

- Use un **perfil de Chrome con su cuenta @ucb.edu.bo**. Para verificarlo, haga clic en la foto de perfil arriba a la derecha de Chrome. Si ve otra cuenta, agregue un perfil con la cuenta de la universidad.
- Pida al administrador **acceso de edición** a la planilla de Admisiones y a la planilla de incentivos de Bienestar.

## Instalar (una sola vez)

1. Descargue el archivo `admisiones-ucb-X.Y.Z.zip` que le envió el administrador.
2. Descomprímalo en una carpeta fija, por ejemplo `Documentos\admisiones-ucb`. **No borre ni mueva esa carpeta**: Chrome la usa mientras la extensión está instalada.
3. En Chrome, abra `chrome://extensions`.
4. Active **Modo de desarrollador** (arriba a la derecha).
5. Haga clic en **Cargar extensión sin empaquetar** y elija la carpeta `admisiones-ucb`.
6. Haga clic en el ícono de pieza de rompecabezas de la barra de Chrome. Luego haga clic en el alfiler junto a **Admisiones UCB** para dejar el ícono visible.
7. Haga clic en el ícono de Admisiones UCB. La primera vez, Google pide permiso para usar sus planillas. Elija su cuenta @ucb.edu.bo y acepte.

## Registrar a un estudiante

### Desde SIAAN (recomendado)

1. En SIAAN, abra **Revisar preinscripción** del estudiante. El panel muestra una *vista previa* del estudiante.
2. Revise los datos en SIAAN y presione **Confirmar**.
3. El panel carga al estudiante con la marca **Confirmado en SIAAN**. Si el panel estaba cerrado, el ícono muestra un **1** verde: haga clic en el ícono para abrirlo.
   Si no aparece, presione **Ya confirmé · cargar** en la vista previa del panel.
4. Elija el **destino**, por ejemplo NUEVOS CARRERAS o PRE UCB GENERAL GRUPO 1.
5. Complete el formulario. Su nombre de asesor aparece seleccionado automáticamente. Los campos poco usados están en **Más campos**.
6. Presione **Añadir a …**. Al terminar, el panel muestra la fila registrada y un enlace **Abrir en Sheets**.

### Por número de carnet

Use esta opción si el estudiante ya fue confirmado antes. Debe tener SIAAN abierto en alguna pestaña, con la sesión iniciada.

1. En el panel, escriba el carnet y presione **Buscar**.
2. Siga los pasos 4 a 6 de arriba.

## Mensajes frecuentes

| Mensaje | Qué hacer |
|---|---|
| "Este estudiante YA HA SIDO REGISTRADO en …" | El CI ya está en esa hoja. Verifique en la planilla; no hace falta registrarlo de nuevo. |
| "No hay una preinscripción CONFIRMADA con el CI …" | Confirme primero la preinscripción en SIAAN. |
| "Abra SIAAN … e inicie sesión" / "La sesión de SIAAN expiró" | Abra academico.ucb.edu.bo en una pestaña e inicie sesión. Luego vuelva a buscar. |
| "No tiene permiso de edición en la planilla" | Pida acceso de edición al administrador. |
| "Los encabezados de la hoja no coinciden…" | Alguien cambió columnas de la planilla. Avise al administrador antes de registrar. |
| "El registro principal se guardó, pero falló …" | El estudiante sí quedó registrado. Avise al administrador para completar la fila de incentivos o de promoción. |
| Error con "Revise la consola de la extensión" | Haga clic derecho dentro del panel, luego **Inspeccionar** y la pestaña **Console**. Envíe una captura al administrador. |
| Ícono con **!** rojo | Hubo un error al leer al estudiante recién confirmado. Abra el panel para ver el detalle y búsquelo por carnet. |

## Actualizar

Cuando haya una versión nueva, el panel muestra **Nueva versión X disponible · Descargar**.

1. Descargue el ZIP nuevo.
2. Descomprímalo **en la misma carpeta**, reemplazando los archivos.
3. En `chrome://extensions`, presione **↻ (Recargar)** en Admisiones UCB.

Su configuración (asesor, último destino) se conserva.

## Si la extensión no funciona

El menú antiguo **Añadir estudiante** de la planilla sigue disponible como respaldo.
