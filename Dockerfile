FROM node:20-bullseye
WORKDIR /app
COPY package.json package-lock.json ./

RUN npm ci --prod

RUN apt update && apt-get update && install -m 0755 -d /etc/apt/keyrings && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && \
    chmod a+r /etc/apt/keyrings/docker.asc && \
    echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && apt install -y systemd bluez docker-ce-cli docker-compose-plugin
RUN groupadd -g 973 docker
# Switch to user
USER 1000:973
COPY index.js .

ENV XDG_RUNTIME_DIR="/run/user/1000"
ENV DBUS_SESSION_BUS_ADDRESS="unix:path=${XDG_RUNTIME_DIR}/bus"
ENV SYSTEMCTL_FORCE_BUS=1
CMD ["node", "index.js"]
