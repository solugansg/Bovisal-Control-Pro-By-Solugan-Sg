# Checklist de Desarrollo - BoviSal Control Pro

Este documento registra el progreso y las modificaciones realizadas en la aplicación.

## Tareas Completadas

- [x] **Revisión del estado del proyecto:** Se verificó que el proyecto se encontraba únicamente en local sin control de versiones.
- [x] **Configuración de `.gitignore`:** Se creó el archivo `.gitignore` para omitir archivos innecesarios en el repositorio.
- [x] **Inicialización de Git:** Se inicializó el repositorio Git local y se realizó el *commit* inicial con todos los archivos del proyecto.
- [x] **Actualización de categoría Toro:** Se modificó la sigla de la categoría Toro de **T** a **TR** en todas las secciones de la app:
  - En el código interno (`bovisal-app.js`) para cálculos y exportación.
  - En los encabezados de la tabla principal (`index.html`).
  - En los encabezados de la cuadrícula superior del formulario de lote (`index.html`).
  - En el pie de página de la tabla de totales (`index.html`).
- [x] **Cálculo de costos de sal:** Se agregó un campo en "Configuración" para ingresar el Costo del Bulto de Sal, calculando automáticamente y en tiempo real el costo por Kilo y por Gramo. Esta configuración se guarda localmente y en la base de datos de usuario.
- [x] **Reubicación de Interfaz:** Se ajustó el diseño en la sección de Configuración para colocar el cuadro de "Costo del Bulto" a la derecha del "Peso del Bulto", optimizando el espacio visual en pantallas de escritorio.
- [x] **Actualización de versión:** Se incrementó la versión global de la aplicación a la versión `260605.2` en `index.html`, `bovisal-app.js` y el Service Worker para reflejar la agregación del separador de miles en el costo y la ampliación del campo.
- [x] **Campo "Nombre de la Sal":** Se agregó el campo en Configuración y Registro para especificar el Nombre de la Sal utilizada. Se implementó su guardado en base de datos, localstorage y exportación a Excel/WhatsApp.
- [x] **Actualización de versión `260610.4`:** 
  - Se añadieron los nombres completos en la tabla de ingreso de lotes para mayor claridad.
  - Se eliminó el bloque de Fórmulas de Cálculo y la Tabla de Referencia en el Dashboard para mantener un diseño más limpio.
  - Se reubicaron las tarjetas de resumen al final del Dashboard.
- [x] **Actualización de versión `260610.5`:** 
  - Se movieron las tarjetas de resumen en el Dashboard de regreso a la parte superior.
  - Se agregó una nueva tarjeta de "Costo Mensual" al Dashboard que calcula la inversión aproximada multiplicando Bultos/Mes por el Costo del Bulto de la sal seleccionada.

## Tareas Pendientes

- [ ] Subir el repositorio a GitHub (Pendiente por parte del usuario).
- [ ] Desplegar la aplicación en Vercel (Pendiente por parte del usuario).
- [ ] *(Agrega aquí las próximas funcionalidades o cambios que necesites)*
