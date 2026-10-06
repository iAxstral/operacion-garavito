# Imagen del backend: compila con Maven y corre con un JRE 21 liviano.
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml ./
# En Windows git puede dejar mvnw con fin de linea CRLF: se quitan los CR.
RUN tr -d '\015' < mvnw > mvnw.lf && mv mvnw.lf mvnw && chmod +x mvnw && ./mvnw -q dependency:go-offline
COPY src src
RUN ./mvnw -q package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
