# Frontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.5.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

### Known build warning

`bundle initial exceeded maximum budget` (~579 kB raw / ~144 kB transferred vs the 500 kB budget in
`angular.json`) is a known, pre-existing warning. The initial chunks are Angular itself, the Supabase
client (needed before the first render to restore the session), the Tauri API used to detect the
runtime, and app bootstrap code; three.js is
already in a lazy chunk. It does not break the build. The budget is intentionally not raised, so any
further growth stays visible.

`npm run build` regenerates `src/environments/environment.ts` from `.env` (or the hosting environment)
and requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `API_BASE_URL`, `DESKTOP_DOWNLOAD_URL` and `WEB_APP_URL`.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.



# backend 

1. cd backend
2. venv\Scripts\activate
3. uvicorn app.main:app --reload

# frontend

1. cd frontend
2. npx tauri dev