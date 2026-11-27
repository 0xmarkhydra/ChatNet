FROM debian:bookworm-slim AS build

# Match the Flutter SDK used to verify the native and Web builds.
ARG FLUTTER_VERSION=3.44.4
ENV PATH="/opt/flutter/bin:${PATH}"
ENV CI=true
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git unzip xz-utils zip libglu1-mesa \
    && rm -rf /var/lib/apt/lists/* \
    && git clone --depth 1 --branch "${FLUTTER_VERSION}" https://github.com/flutter/flutter.git /opt/flutter \
    && flutter --disable-analytics \
    && flutter precache --web

WORKDIR /app
COPY pubspec.yaml pubspec.lock ./
RUN flutter pub get --enforce-lockfile

COPY . .
ARG API_URL=https://api-chat.codelocal.cloud
ARG WEB_URL=https://chat.codelocal.cloud
RUN case "$API_URL" in https://*) ;; *) exit 1 ;; esac \
    && flutter build web --release --no-pub --no-web-resources-cdn \
      --dart-define=API_URL="${API_URL}" \
      --dart-define=WEB_URL="${WEB_URL}"

FROM nginx:1.28-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/build/web/ /usr/share/nginx/html/
ENV PORT=8080
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
