import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Os paineis sao implantados em diretorios independentes no Nginx.
// Resolver a biblioteca local diretamente evita depender de node_modules
// desatualizado ou da estrutura original de monorepo.
const sharedUiPath = fileURLToPath(new URL('./vendor/deltatv-ui/src', import.meta.url));
const appearancePath = fileURLToPath(new URL('./vendor/deltatv-ui/src/appearance-screen-settings.js', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@deltatv\/ui\/appearance$/, replacement: appearancePath },
      { find: /^@deltatv\/ui(?=\/|$)/, replacement: sharedUiPath },
    ],
    dedupe: ['react', 'react-dom'],
  },
});
