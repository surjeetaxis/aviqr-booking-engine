FROM gradle:8.14-jdk21 AS backend-build
WORKDIR /src
COPY . .
RUN gradle --no-daemon bootJar
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=backend-build /src/build/libs/aviqr-booking-engine-1.0.0.jar app.jar
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java","-XX:MaxRAMPercentage=75","-jar","/app/app.jar"]
