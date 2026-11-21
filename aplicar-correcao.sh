#!/bin/sh
# Execute na raiz do projeto Vite correspondente. Nao sobrescreve arquivos existentes.
set -eu
if [ ! -f package.json ] || [ ! -f vite.config.js ]; then
  echo 'ERRO: execute este script na raiz do projeto Vite (junto de package.json e vite.config.js).' >&2
  exit 1
fi
if [ ! -s src/EmergencyDns.jsx ]; then
  echo 'ERRO: arquivo src/EmergencyDns.jsx nao encontrado. Extraia o ZIP nesta pasta primeiro.' >&2
  exit 1
fi
if [ ! -f src/EmergencyDnsPage.jsx ]; then
  echo 'ERRO: src/EmergencyDnsPage.jsx nao encontrado. Nao alterei este import.' >&2
  exit 1
fi
if [ ! -f src/pages/DeviceRecordModal.jsx ]; then
  echo 'ERRO: src/pages/DeviceRecordModal.jsx nao encontrado. Nao alterei este import.' >&2
  exit 1
fi
if grep -q '@deltatv/ui/EmergencyDns' src/EmergencyDnsPage.jsx; then
  sed -i 's|@deltatv/ui/EmergencyDns|./EmergencyDns.jsx|g' src/EmergencyDnsPage.jsx
fi
if ! grep -q './EmergencyDns.jsx' src/EmergencyDnsPage.jsx; then
  echo 'ERRO: import inesperado em src/EmergencyDnsPage.jsx. Revise manualmente.' >&2
  exit 1
fi
if grep -q '@deltatv/ui/EmergencyDns' src/pages/DeviceRecordModal.jsx; then
  sed -i 's|@deltatv/ui/EmergencyDns|../EmergencyDns.jsx|g' src/pages/DeviceRecordModal.jsx
fi
if ! grep -q '../EmergencyDns.jsx' src/pages/DeviceRecordModal.jsx; then
  echo 'ERRO: import inesperado em src/pages/DeviceRecordModal.jsx. Revise manualmente.' >&2
  exit 1
fi
echo 'OK: componente em src/EmergencyDns.jsx e imports locais atualizados.'
