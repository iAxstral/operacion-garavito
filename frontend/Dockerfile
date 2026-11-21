# Imagen del frontend: compila con Node y sirve los archivos estaticos con nginx.
# nginx tambien reenvia /ws (WebSocket/SockJS) y /api al backend, asi el navegador
# habla con un solo origen, igual que en AWS con CloudFront.
#
#   docker build -t garavito-frontend ./frontend
#   docker run -p 8000:80 -e BACKEND_UPSTREAM=host.docker.internal:8080 garavito-frontend
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# El WebSocket va por el mismo dominio (nginx lo reenvia al backend).
ENV VITE_WS_URL=/ws
RUN npm run build

FROM nginx:1.27-alpine
# BACKEND_UPSTREAM: host:puerto del backend o del balanceador (lo reemplaza la imagen de
# nginx al arrancar, desde /etc/nginx/templates).
ENV BACKEND_UPSTREAM=lb:8080
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
