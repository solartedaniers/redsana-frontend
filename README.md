# 📡 RedSana

> **Diagnóstico inteligente de salud y seguridad para tu red WiFi doméstica.**

RedSana es una aplicación de escritorio que vigila tu conexión a internet en segundo plano y te dice, en palabras simples, qué está pasando cuando algo anda mal — sin que tengas que reiniciar el router "a ver si arregla" y sin necesitar conocimientos técnicos.

---

## 🔗 Repositorios del proyecto

| Repositorio | Qué contiene |
|---|---|
| [redsana-frontend](https://github.com/solartedaniers/redsana-frontend) (este) | App Angular (web en Vercel) y capa nativa Tauri/Rust (instalador de escritorio publicado en Releases) |
| [redsana-backend](https://github.com/solartedaniers/redsana-backend) | API FastAPI, base de datos (SQLAlchemy + Alembic) y orquestación de la IA; desplegada en Render |
| [redsana-ai](https://github.com/solartedaniers/redsana-ai) | Paquete Python `redsana-ai`: asistente de seguridad (Groq), detección de anomalías (IsolationForest) y de cortes |

---

## 📑 Tabla de contenido

- [🧠 ¿Qué es RedSana?](#-qué-es-redsana)
- [🛠️ Tecnologías utilizadas](#️-tecnologías-utilizadas)
- [🤖 Inteligencia Artificial](#-inteligencia-artificial)
- [☁️ Arquitectura y despliegue](#️-arquitectura-y-despliegue)
- [⚡ Event Loop: Tasks vs Microtasks](#-event-loop-tasks-vs-microtasks)
- [🧵 Web Workers y trabajo en segundo plano](#-web-workers-y-trabajo-en-segundo-plano)
- [🧩 Patrones de diseño aplicados](#-patrones-de-diseño-aplicados)
- [🗄️ Base de datos](#️-base-de-datos)
- [🚀 Instalación y ejecución](#-instalación-y-ejecución)
- [✅ Pruebas](#-pruebas)
- [📂 Estructura del proyecto](#-estructura-del-proyecto)
- [📌 Estado actual](#-estado-actual)

---

## 🧠 ¿Qué es RedSana?

Cuando el WiFi de una casa falla, el usuario promedio no tiene forma de saber si el problema es:

- 🔌 su router,
- 📱 un dispositivo saturando la red, o
- 🌐 su proveedor de internet (ISP).

Y aunque quisiera revisar la seguridad de su router (¿tiene la contraseña de fábrica? ¿está bien configurado?), la mayoría de las guías están llenas de jerga técnica que nadie entiende.

**RedSana resuelve esto con dos módulos:**

### 1️⃣ Monitoreo preventivo de la red
La app mide tu conexión de verdad (latencia, jitter, pérdida de paquetes) cada minuto, **aprende cuál es el comportamiento normal de tu propia red** y te avisa cuando empieza a degradarse — antes de que se caiga por completo. También detecta cortes de conectividad reales cuando ocurren.

### 2️⃣ Auditoría de seguridad guiada
Un cuestionario corto, en lenguaje simple (sin "firmware", sin "WPA3" sin explicar), que calcula un puntaje de seguridad de tu router y te da una guía priorizada de qué arreglar primero — más un asistente conversacional que responde tus preguntas puntuales sobre tu red o tu router.

**Todo esto corre con datos reales de tu red** — nada de valores simulados: la app se conecta de verdad a tu adaptador de red, hace ping real, escanea tu red local real y lee la configuración real de cifrado WiFi de tu sistema operativo.

---

## 🛠️ Tecnologías utilizadas

| Capa | Tecnología | ¿Para qué se usa? |
|---|---|---|
| 🖥️ **Frontend** | Angular + TypeScript | Interfaz de usuario: dashboard, pantallas de autenticación, asistente de seguridad, panel de administración |
| 📦 **Empaquetado de escritorio** | Tauri (Rust) | Convierte el frontend web en una app de escritorio nativa real, con acceso al sistema operativo |
| 🦀 **Mediciones reales de red** | Rust (dentro de Tauri) | Ping ICMP real, escaneo ARP de dispositivos conectados, lectura del cifrado WiFi activo — nada de esto es posible desde un navegador normal |
| ⚙️ **Backend** | FastAPI (Python) | API que expone los datos, valida la sesión del usuario, calcula puntajes de seguridad y ejecuta la detección de anomalías |
| 🗄️ **Base de datos** | Supabase (PostgreSQL) | Persistencia de usuarios, dispositivos, métricas históricas, alertas y evaluaciones de seguridad |
| 🔐 **Autenticación** | Supabase Auth | Login, registro y recuperación de contraseña reales, con JWT verificado por el backend |
| 🧠 **Detección de anomalías** | scikit-learn (IsolationForest) | Aprende el comportamiento normal de cada red y detecta degradaciones reales |
| 💬 **Asistente conversacional** | Groq API (modelos Llama) | Responde preguntas del usuario sobre su red/router, usando datos reales como contexto |
| 🌐 **Almacenamiento de archivos** | Supabase Storage | Fotos de perfil de usuario |

---

## 🤖 Inteligencia Artificial

RedSana usa **dos motores de IA distintos**, cada uno elegido para el problema que realmente resuelve — no la misma IA para todo:

### 🔍 IsolationForest — detección de anomalías de red

| | |
|---|---|
| **Qué hace** | Analiza las últimas 24 horas de mediciones (latencia, jitter, pérdida de paquetes) y detecta cuándo la conexión se sale de su comportamiento normal |
| **Por qué este modelo** | Es **no supervisado** (no necesita datos etiquetados de "esto es una falla" — nadie tiene ese historial al empezar), **multivariable** (analiza las 3 métricas en conjunto, no una por una) y **liviano** (entrena en milisegundos sobre pocas filas, ideal para correr por usuario en tiempo real) |
| **Costo** | 🆓 Gratis — librería open source (`scikit-learn`), corre en el propio backend, sin API externa |
| **Cómo aprende "lo normal"** | Cada red es distinta (no es igual la latencia a las 3am que a las 8pm) — el modelo se re-entrena con la ventana de las últimas 1440 mediciones (24h) de **cada usuario individualmente**, así que aprende el patrón específico de esa casa, no un promedio genérico. La app de escritorio empieza a detectar con el día completo (1440); la web, que solo mide con la pestaña abierta, empieza con 720 (12h) y gana precisión al completar el día |

### 💬 Groq (Llama) — asistente conversacional

| | |
|---|---|
| **Qué hace** | Responde preguntas del usuario en lenguaje natural sobre su red, la seguridad de su router, o cómo usar la app |
| **Por qué este modelo** | API **gratuita** con límites generosos, inferencia extremadamente rápida, y modelos Llama de código abierto — no requiere entrenar nada propio |
| **Alcance controlado** | El asistente solo responde sobre 4 temas (red del usuario, seguridad del router, calidad de conexión, uso de la app) — controlado por instrucciones de sistema, no por un filtro de palabras clave. Si no tiene un dato real, lo dice explícitamente en vez de inventarlo |
| **Contexto real** | Antes de responder, el backend le inyecta los datos reales y actuales del usuario (dispositivos conectados, alertas activas, última medición) para que las respuestas sean concretas, no genéricas |

---

## ☁️ Arquitectura y despliegue

```
┌─────────────────────────────┐
│   App de escritorio (Tauri) │
│  ┌────────────────────────┐ │
│  │   Angular (interfaz)   │ │
│  └───────────┬────────────┘ │
│  ┌───────────▼────────────┐ │        ┌──────────────────┐
│  │  Rust (capa nativa):   │ │  HTTP  │  FastAPI backend  │
│  │  ping ICMP, ARP, WiFi  │─┼───────▶│  (local, junto a  │
│  └─────────────────────────┘ │        │  la app)          │
└─────────────────────────────┘        └─────────┬─────────┘
                                                    │
                                          JWT + SQL │
                                                    ▼
                                         ┌───────────────────┐
                                         │  Supabase (nube)   │
                                         │  · PostgreSQL      │
                                         │  · Auth            │
                                         │  · Storage         │
                                         └───────────────────┘
```

- **Frontend + capa nativa (Rust)**: se instalan en la máquina del usuario como una app de escritorio normal (vía Tauri). Es la única forma de que la app pueda medir la red *de verdad* — un navegador no tiene ese acceso.
- **Backend (FastAPI)**: corre localmente junto a la app durante el desarrollo (`uvicorn`, puerto 8000). Es la pieza intermedia entre la medición local y la base de datos en la nube. *(Para producción, este backend puede desplegarse igual como servicio local que arranca junto con la app, o evaluarse su empaquetado dentro del propio instalador — queda como decisión de la etapa de distribución.)*
- **Base de datos y autenticación**: viven en Supabase, en la nube — así los datos persisten entre sesiones y el panel de administración puede ver todos los usuarios desde cualquier lugar.

---

## ⚡ Event Loop: Tasks vs Microtasks

**Sí se aplica, de forma deliberada — auditada explícitamente, no por accidente.**

| Dónde | Cómo |
|---|---|
| 🐍 **Backend (FastAPI)** | La detección de anomalías (`IsolationForest`) tarda ~230ms en entrenar. Ejecutarla de forma síncrona dentro de la respuesta HTTP habría hecho que cada medición se sintiera lenta (~400ms en vez de ~160ms). Se usa **`BackgroundTasks`** de FastAPI: la respuesta al usuario se envía primero, y la evaluación pesada corre después, en segundo plano, sin bloquear al cliente. |
| 🅰️ **Frontend (Angular/RxJS)** | Todas las llamadas HTTP y las promesas de Tauri (`invoke()`) se resuelven vía la **cola de microtasks** de JavaScript (`Promise`/`async-await`), nunca de forma bloqueante. Los polling periódicos (medición de red cada 60s, refresco de alertas) usan `interval()` + `switchMap()` de RxJS, que encola correctamente sin apilar peticiones. |
| 🦀 **Capa nativa (Rust)** | El trabajo realmente pesado — ping ICMP, barrido ARP de toda la red local — nunca toca el hilo de JavaScript: corre en el proceso Rust, fuera del hilo de la interfaz por completo. |

**Regla aplicada:** las microtasks (promesas, resultados de red) siempre se procesan antes que cualquier tarea nueva encolada — es el comportamiento nativo de JS que el proyecto respeta usando `async/await` y observables correctamente, sin trucos que lo rompan.

---

## 🧵 Web Workers y trabajo en segundo plano

**Se evaluó explícitamente su uso y se determinó que no son necesarios — por una razón concreta, no por omisión.**

Un Web Worker tiene sentido cuando hay **cálculo pesado corriendo en JavaScript** en el hilo principal (procesamiento de imágenes, JSON grandes, ML en el navegador, etc.). En RedSana, **todo el trabajo pesado ya vive fuera de JavaScript**:

| Tarea pesada | Dónde corre en su lugar |
|---|---|
| Ping ICMP real, escaneo ARP de la red | 🦀 Rust (proceso nativo separado del hilo de la UI) |
| Detección de anomalías (IsolationForest) | 🐍 Backend Python, en segundo plano vía `BackgroundTasks` |
| Lectura de configuración WiFi del sistema | 🦀 Rust |

Es decir: **el patrón de "sacar el trabajo pesado del hilo principal" sí se aplica en todo el proyecto** — solo que el mecanismo correcto para este caso es Rust nativo (para acceso al sistema operativo) y tareas en segundo plano del backend (para el modelo de ML), no un Web Worker del navegador, que no tendría forma de hacer ping real ni leer el sistema operativo de todas formas.

---

## 🧩 Patrones de diseño aplicados

| Patrón | Dónde se usa | Para qué |
|---|---|---|
| 🗃️ **Repository** | Cada dominio (usuarios, dispositivos, métricas, alertas, evaluaciones de seguridad) tiene una clase abstracta + una implementación concreta, tanto en frontend (`*.repository.ts`) como en backend (`*_repository.py` + `*_sqlalchemy_repository.py`) | Aísla la lógica de negocio de cómo se guardan/leen los datos — se puede cambiar de fuente de datos sin tocar el resto del código |
| 🔌 **Inversión de dependencia (DI)** | Angular (`inject()`, providers) y FastAPI (`Depends()`) | Cada clase recibe sus dependencias desde afuera, nunca las crea ella misma — facilita testing y cambios |
| 🚪 **Gateway** | `NetworkMeasurementGateway`, `WifiEncryptionGateway`, `LanScanGateway`, `AvatarStorageGateway` | Aísla la comunicación con sistemas externos (Rust/Tauri, Supabase Storage) detrás de una interfaz simple |
| 🧱 **Arquitectura en capas** | Backend: `router → service → repository`. Frontend: `componente → repository → gateway/HTTP` | Cada capa tiene una única responsabilidad; los routers nunca hablan directo con la base de datos |
| 🧮 **Funciones de dominio puras** | Cálculo de puntaje de seguridad, clasificación de anomalías, detección de cortes | Lógica de negocio separada de la infraestructura (sin I/O), fácil de testear con datos sintéticos |
| 🧍 **Responsabilidad única** | Cada clase hace una sola cosa (ej. un servicio nunca mezcla acceso a datos con lógica de presentación) | Código mantenible y fácil de extender sin romper otras partes |

---

## 🗄️ Base de datos

**Motor:** PostgreSQL, alojado y gestionado por **Supabase**.

### Tablas principales

| Tabla | Contenido |
|---|---|
| `users` | Perfil propio del usuario (su `id` es el mismo UUID que genera Supabase Auth — no se duplica la identidad) |
| `roles` | `standard` / `admin` |
| `devices` | Dispositivos detectados en la red del usuario (MAC, IP, confianza, última vez visto) |
| `network_metric_snapshots` | Historial de mediciones reales (latencia, jitter, pérdida de paquetes) cada 60 segundos |
| `alerts` | Alertas generadas automáticamente (anomalías detectadas, cortes de conexión) o manualmente |
| `security_assessments` | Respuestas y puntaje del cuestionario de seguridad de cada usuario |
| `chat_conversations` / `chat_messages` | Historial de conversaciones con el asistente |

### Decisiones de diseño relevantes

- 🔗 Cada tabla de datos del usuario tiene `owner_id` con `ON DELETE CASCADE` — al borrar un usuario, se borra todo su historial automáticamente.
- 🕐 Todas las columnas de fecha son `timestamptz` (con zona horaria explícita), para que la hora se muestre correctamente sin importar dónde esté el usuario.
- 🚦 Los estados (confianza de dispositivo, severidad de alerta, estado de red) usan `ENUM` nativo de Postgres — no strings sueltos, evita datos inválidos a nivel de base de datos.

Las migraciones se gestionan con **Alembic**.

---

## 🚀 Instalación y ejecución

### Requisitos previos

- 🐍 Python 3.11+
- 🟢 Node.js 18+
- 🦀 Rust + Cargo (para compilar la capa nativa de Tauri) — instalable desde [rustup.rs](https://rustup.rs)
- 🪟 En Windows: Microsoft C++ Build Tools (necesarios para compilar Rust)
- ☁️ Una cuenta y proyecto de [Supabase](https://supabase.com) (gratis)
- 🔑 Una API key gratuita de [Groq](https://console.groq.com) (para el asistente conversacional)

### 1️⃣ Backend

```bash
cd backend

# Crear y activar entorno virtual
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS/Linux

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con:
#   DATABASE_URL, SUPABASE_URL, SUPABASE_JWT_AUDIENCE,
#   SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY, CORS_ORIGINS, etc.

# Aplicar migraciones a la base de datos
alembic upgrade head

# Levantar el servidor
uvicorn app.main:app --reload
```

El backend queda disponible en `http://localhost:8000`.

### 2️⃣ Frontend (app de escritorio)

```bash
cd frontend

# Instalar dependencias
npm install

# Configurar credenciales de Supabase
cp src/environments/environment.example.ts src/environments/environment.ts
# Editar con supabaseUrl, supabaseAnonKey y apiBaseUrl (http://localhost:8000)

# Modo desarrollo (abre la app de escritorio con recarga en caliente)
npx tauri dev
```

### 3️⃣ Compilar la app para distribución

```bash
cd frontend
npx tauri build
```

Esto genera el instalador nativo (`.exe`/`.msi` en Windows, `.dmg` en macOS, `.deb`/`.AppImage` en Linux) dentro de `frontend/src-tauri/target/release/bundle/`.

---

## ✅ Pruebas

| Componente | Comando | Desde |
|---|---|---|
| 🐍 Backend (Python) | `pytest` | `backend/` (con el entorno virtual activado) |
| 🅰️ Frontend (Angular/Vitest) | `ng test` | `frontend/` |
| 🦀 Capa nativa (Rust) | `cargo test` | `frontend/src-tauri/` |

Todos los dominios del backend tienen tests con repositorios en memoria (sin necesitar base de datos real) más validaciones puntuales contra la base de datos real de Supabase durante el desarrollo.

---

## 📂 Estructura del proyecto

```
RedSana/
├── frontend/                  # App Angular + Tauri
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/           # Servicios, repositorios, modelos, autenticación
│   │   │   ├── features/       # Pantallas (auth, usuario, admin)
│   │   │   ├── layouts/        # Estructura visual compartida
│   │   │   └── shared/         # Componentes reutilizables
│   │   └── environments/
│   └── src-tauri/               # Capa nativa en Rust
│       └── src/
│           ├── ping.rs          # Medición ICMP real
│           ├── lan_scan.rs      # Escaneo ARP de dispositivos
│           └── wifi.rs          # Detección de cifrado WiFi
│
├── backend/                    # API FastAPI
│   ├── app/
│   │   ├── core/                # Configuración, seguridad, base de datos
│   │   ├── domain/               # Lógica de negocio pura (sin I/O)
│   │   ├── models/               # Modelos SQLAlchemy
│   │   ├── repositories/         # Acceso a datos (contrato + implementación)
│   │   ├── schemas/               # Esquemas Pydantic (entrada/salida de la API)
│   │   ├── services/               # Orquestación de lógica de negocio
│   │   └── routers/                 # Endpoints HTTP
│   ├── alembic/                  # Migraciones de base de datos
│   └── tests/
│
└── README.md
```

---

## 📌 Estado actual

RedSana está funcionalmente completo con datos 100% reales (no simulados) en todos sus módulos:

- ✅ Autenticación real (Supabase Auth)
- ✅ Escaneo real de dispositivos en la red local (Rust + ARP)
- ✅ Medición real de latencia/jitter/pérdida de paquetes (Rust + ICMP)
- ✅ Detección automática de anomalías (IsolationForest) y cortes de conexión
- ✅ Cuestionario de seguridad con puntaje real y recomendaciones
- ✅ Asistente conversacional con contexto real del usuario (Groq)
- ✅ Panel de administración con supervisión de todos los hogares registrados
- ✅ Perfil de usuario con foto y datos editables

---

<p align="center">
  Realizado por Daniers Solarte — Universidad Cooperativa de Colombia · Ingeniería de Software
</p>