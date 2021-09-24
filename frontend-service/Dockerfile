#FROM madnificent/ember:3.10.1 as builder
#
#LABEL maintainer="info@redpencil.io"
#
#WORKDIR /app
#COPY package.json .
#RUN npm install
#COPY . .
#RUN ember build -prod
#
#FROM semtech/ember-proxy-service:1.4.0
#
#COPY --from=builder /app/dist /app

FROM archlinux:base-20210808.0.31089

RUN pacman -Syu --noconfirm
RUN pacman -S --noconfirm nodejs
RUN pacman -S --noconfirm npm
RUN npm install -g ember-cli
RUN mkdir /webapp

ENTRYPOINT [ "sh", "-c", "cd /webapp && echo \"I am now in folder $(pwd) with contents \n$(ls -hal)\" &&  ember serve" ]

