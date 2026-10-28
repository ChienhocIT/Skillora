# syntax=docker/dockerfile:1
FROM eclipse-temurin:17-jdk-alpine AS build

WORKDIR /app
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN chmod +x mvnw
RUN --mount=type=cache,target=/root/.m2 ./mvnw -q -DskipTests dependency:go-offline

COPY src src
RUN --mount=type=cache,target=/root/.m2 ./mvnw -q clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine

WORKDIR /app
ARG BUILD_REVISION=working-tree
LABEL org.opencontainers.image.title="Skillora Platform" org.opencontainers.image.revision=$BUILD_REVISION
RUN addgroup -S skillora && adduser -S skillora -G skillora
COPY --from=build /app/target/*.jar app.jar
USER skillora

EXPOSE 8080
ENV TZ=Asia/Ho_Chi_Minh
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError -Duser.timezone=Asia/Ho_Chi_Minh"

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=5 \
  CMD wget -q -O - http://127.0.0.1:${PORT:-8080}/actuator/health/readiness >/dev/null || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
