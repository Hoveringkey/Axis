# Setup local de Axis

Esta guia deja listo un entorno local nuevo para Axis usando Django/DRF con PostgreSQL local via Supabase, y React + TypeScript + Vite en el frontend.

## Requisitos

- Git
- Python 3
- Node.js y npm
- Docker Desktop
- Supabase CLI

No uses una base de Supabase de produccion para migraciones, pruebas ni desarrollo local. Las migraciones actuales dependen de PostgreSQL y pueden incluir SQL especifico como triggers `plpgsql`; SQLite ya no es una base local de referencia para este proyecto.

## Instalar Supabase CLI en Windows

La instalacion recomendada en Windows es con Scoop:

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Verifica la instalacion:

```powershell
supabase --version
```

## Levantar PostgreSQL local con Supabase

Desde la raiz del repo:

```powershell
supabase init
docker ps
supabase start
```

`docker ps` debe responder sin error antes de ejecutar `supabase start`. Si falla, abre Docker Desktop y espera a que el motor de Docker termine de arrancar.

`supabase start` imprime las URLs locales del stack. Toma la Database URL local de esa salida; para el setup por defecto suele ser:

```text
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

El comando `supabase init` puede crear una carpeta `supabase/` local. En esta rama de documentacion local, no agregues `supabase/` al commit.

## Backend

Desde la raiz del repo:

```powershell
Copy-Item backend\.env.example backend\.env
```

Revisa que `backend\.env` tenga al menos:

```env
SECRET_KEY=dev-local-axis-secret-key
DEBUG=True
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Crea y activa el entorno virtual:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

Instala dependencias:

```powershell
pip install -r requirements.txt
```

Aplica migraciones y corre pruebas:

```powershell
python manage.py migrate
python manage.py test
```

## Frontend

En otra terminal, desde la raiz del repo:

```powershell
cd frontend
npm install
npm run build
```

En PowerShell, si la politica de ejecucion bloquea shims de npm, usa `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run build
```

## Troubleshooting

### SECRET_KEY missing

Falta `backend\.env` o no contiene `SECRET_KEY`. Copia `backend\.env.example` a `backend\.env` y confirma que `SECRET_KEY=dev-local-axis-secret-key` exista para desarrollo local.

### No module named django

El entorno virtual no esta activo o las dependencias no estan instaladas. Entra a `backend`, activa `.venv` y ejecuta:

```powershell
pip install -r requirements.txt
```

### requirements.txt no encontrado

Estas ejecutando `pip install -r requirements.txt` desde la carpeta incorrecta. El archivo esta en `backend\requirements.txt`; ejecuta primero:

```powershell
cd backend
```

### SQLite error near "OR"

El proyecto esta usando SQLite por accidente. Axis debe correr localmente contra PostgreSQL/Supabase porque hay migraciones con SQL especifico de PostgreSQL. Revisa `DATABASE_URL` en `backend\.env` y confirma que apunte a `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

### Supabase command not found

Supabase CLI no esta instalado o no esta en `PATH`. Instala con Scoop y abre una nueva terminal:

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
supabase --version
```

### PostgreSQL connection refused

Supabase local no esta levantado, Docker Desktop no esta corriendo o el puerto local no coincide. Abre Docker Desktop y ejecuta desde la raiz del repo:

```powershell
supabase start
```

Luego copia la Database URL local que imprime Supabase a `backend\.env`.
