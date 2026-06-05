# ── Frontend Dockerfile ───────────────────────────────────────────────────────
# Node 20 Alpine — lightweight base for React/Vite
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first (layer caching — only re-runs npm install when deps change)
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies needed for Vite dev server)
# --legacy-peer-deps: @react-three/postprocessing@3.x declares a peer dep on
# @react-three/fiber@^9, but this project intentionally uses v8. The same flag
# was used locally when node_modules was first created.
RUN npm ci --legacy-peer-deps

# Copy the rest of the source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start Vite dev server, binding to all interfaces so Docker can forward the port
CMD ["npm", "run", "dev"]
