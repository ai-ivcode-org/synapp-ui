# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

----

## Debugging in IntelliJ IDEA

To debug this application in IntelliJ, you need to run **two configurations at the same time**:
- **NPM:** Starts the application.
- **JavaScript Debug:** Opens a browser with all the hooks needed to attach your debugger to the running application.

### Create an NPM Configuration

1. Go to `Run` > `Edit Configurations...`
2. Click the `+` icon and select **NPM**.
3. Set **Command** to `run` and **Scripts** to `dev`.

### Create a JavaScript Debug Configuration

1. Go to `Run` > `Edit Configurations...`
2. Click the `+` icon and select **JavaScript Debug**.
3. Set the **URL** to `http://localhost:5173/`.
