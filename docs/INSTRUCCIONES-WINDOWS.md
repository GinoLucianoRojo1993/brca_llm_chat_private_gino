# BCRA Chat — Instrucciones para Windows 11

Desarrollado por [Gino Luciano Rojo](https://linkedin.com/in/gino-luciano-rojo/)

---

## Requisitos previos

### 1. Node.js (obligatorio)
Descargá e instalá Node.js LTS desde:
**https://nodejs.org/**

> Elegí la versión **LTS** (la recomendada). Durante la instalación, asegurate de marcar la opción "Add to PATH".

### 2. API Key de Anthropic (obligatorio)
Necesitás una cuenta en Anthropic para obtener tu clave de API:
**https://console.anthropic.com/**

---

## Instalación paso a paso

### Paso 1 — Descomprimir
Descomprimí el archivo `bcra-chat.zip` en la carpeta donde quieras tenerlo (ej: `C:\bcra-chat\`).

### Paso 2 — Ejecutar el setup
Hacé doble clic en **`setup-windows.bat`**

Este script:
- Verifica que Node.js esté instalado
- Instala todas las dependencias del proyecto
- Crea el archivo `.env.local` si no existe

### Paso 3 — Configurar la API Key
Abrí el archivo `.env.local` con el Bloc de Notas y reemplazá la línea:
```
ANTHROPIC_API_KEY=sk-ant-REEMPLAZAR-CON-TU-API-KEY
```
por tu clave real de Anthropic. Guardá el archivo.

### Paso 4 — Iniciar la aplicación
Hacé doble clic en **`start-windows.bat`**

- La primera vez compilará la aplicación (puede tardar 1-2 minutos)
- Abrirá automáticamente tu navegador en `http://localhost:3000`
- La ventana negra del terminal debe quedar abierta mientras usás la app

---

## Uso de la aplicación

Una vez iniciada, podés escribir consultas como:

| Consulta | Descripción |
|---------|-------------|
| `Listame las variables monetarias del BCRA` | Ver todas las variables con su último valor |
| `Dime el valor del dólar hoy` | Cotización actual del USD |
| `Mostrame la evolución del USD entre 2024-01-01 y 2024-03-31` | Serie histórica de tipo de cambio |
| `Qué cotización tenía el EUR el 2024-06-12` | Cotización de una fecha específica |
| `Traé la situación crediticia actual del CUIT 20123456789` | Central de Deudores |
| `Consultá si el cheque 20377516 del banco 11 fue denunciado` | Sistema de cheques |
| `Compará plazos fijos del banco 11` | Régimen de Transparencia |
| `Qué tarjetas de crédito informa la entidad 11` | Productos financieros |

---

## Detener la aplicación

Hacé clic en la ventana negra del terminal y presioná **Ctrl + C**.

---

## Nota sobre el .exe

Esta aplicación es una **app web** construida con Next.js. No se distribuye como `.exe` porque:
- Requiere un servidor Node.js para funcionar
- Se accede desde el navegador (Chrome, Firefox, Edge, etc.)
- Los scripts `.bat` reemplazan esa función: con doble clic la app levanta y el browser abre automáticamente

---

## Solución de problemas

| Problema | Solución |
|---------|----------|
| "Node.js no está instalado" | Instalá Node.js LTS desde nodejs.org |
| "Error de API key" | Verificá que `.env.local` tenga la clave correcta |
| El browser no abre solo | Abrí manualmente `http://localhost:3000` |
| Puerto 3000 ocupado | Cerrá otras aplicaciones que usen ese puerto |
| "Falló el build" | Ejecutá `setup-windows.bat` nuevamente |

---

## Archivos del proyecto

```
bcra-chat/
├── setup-windows.bat        ← Ejecutar primero (instalación)
├── start-windows.bat        ← Ejecutar para iniciar la app
├── .env.local               ← Configuración (API keys)
├── docs/
│   ├── README.md            ← Documentación completa
│   └── INSTRUCCIONES-WINDOWS.md  ← Este archivo
└── src/                     ← Código fuente
```
