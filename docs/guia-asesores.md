# Admisiones UCB: guía para asesores

Extensión de Chrome para registrar estudiantes en las planillas de Admisiones desde un panel lateral, sin abrir Google Sheets.

## Antes de instalar

- Use un **perfil de Chrome con su cuenta @ucb.edu.bo**. Para verificarlo, haga clic en la foto de perfil arriba a la derecha de Chrome. Si ve otra cuenta, agregue un perfil con la cuenta de la universidad.
- Pida al administrador **acceso de edición** a la planilla de Admisiones y a la planilla de incentivos de Bienestar.

## Instalar (una sola vez)

1. Presione **Windows + R** (se abre la ventana "Ejecutar").
2. Copie y pegue esta línea completa, y presione **Enter**:

   ```
   powershell -ExecutionPolicy Bypass -Command "irm https://diegocaceres21.github.io/automatizacion-sheets-admisiones/install/instalar.ps1 | iex"
   ```

3. Se abre una ventana azul que descarga e instala la extensión. Al terminar, abre Chrome en `chrome://extensions`.
4. En esa pestaña de Chrome:
   1. Active **Modo de desarrollador** (arriba a la derecha).
   2. Haga clic en **Cargar extensión sin empaquetar**.
   3. En la ventana que aparece, pegue la carpeta con **Ctrl+V**. El instalador ya la copió. Luego presione **Seleccionar carpeta**.
5. Haga clic en el ícono de pieza de rompecabezas de la barra de Chrome. Luego haga clic en el alfiler junto a **Admisiones UCB** para dejar el ícono visible.
6. Haga clic en el ícono de Admisiones UCB. La primera vez, Google pide permiso para usar sus planillas. Elija su cuenta @ucb.edu.bo y acepte.
7. Si tenía SIAAN abierto, recargue esa pestaña (F5).

La extensión queda en `%LOCALAPPDATA%AdmisionesUCBextension`. **No mueva ni borre esa carpeta.**

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

No tiene que hacer nada. El instalador dejó una tarea de Windows que busca versiones nuevas al iniciar sesión y a las 08:30 y 13:30. La extensión se recarga sola cuando el panel está cerrado. Si el panel está abierto, muestra **Versión X lista para usar · Aplicar ahora**.

Para actualizar en el momento, vuelva a ejecutar la línea de instalación (paso 2). Si la extensión ya estaba cargada, no hace falta repetir el paso 4.

## Desinstalar

1. En `chrome://extensions`, presione **Quitar** en Admisiones UCB.
2. En **Windows + R**, ejecute:

   ```
   powershell -ExecutionPolicy Bypass -File "%LOCALAPPDATA%AdmisionesUCBactualizar.ps1" -Desinstalar
   ```

## Planilla de destino

La planilla donde se registran los estudiantes la define el administrador para todos. No necesita configurarla. Puede ver cuál se está usando en **Opciones**: clic derecho en el ícono, luego **Opciones**.

Si el panel muestra "Este equipo usa una planilla de PRUEBA", vaya a Opciones y presione **Volver a la del administrador**.

## Si la extensión no funciona

El menú antiguo **Añadir estudiante** de la planilla sigue disponible como respaldo.
