FROM node:20-bullseye
WORKDIR /app
COPY package.json package-lock.json ./

RUN npm ci --prod

RUN apt update && apt install -y systemd

# Switch to user
USER 1000
COPY index.js .

ENV XDG_RUNTIME_DIR="/run/user/1000"
ENV DBUS_SESSION_BUS_ADDRESS="unix:path=${XDG_RUNTIME_DIR}/bus"
ENV SYSTEMCTL_FORCE_BUS=1
CMD ["node", "index.js"]
