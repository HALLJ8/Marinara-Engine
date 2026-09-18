# Dificultad del combate y clima

Registro de implementación de [#6305](https://github.com/Pasta-Devs/Marinara-Engine/issues/6305), posterior al director de combate de #6302. Este documento recoge el alcance acordado y los límites de la implementación.

## Configuración y dificultad

Elimina el campo **Battlefield Seed** (semilla del campo de batalla) y su resumen, y conserva **Battlefield Size** (tamaño del campo de batalla). Los encuentros nuevos reciben semillas aleatorias internas. Ignora las preferencias obsoletas de semilla de campaña al iniciar futuras batallas; conserva las semillas, cuadrículas y reinicios de las batallas aceptadas. Cambia la descripción de Classic a "Cinematic menu battles." (Batallas cinematográficas con menús).

Normaliza la dificultad mediante una función compartida, incluidas las configuraciones antiguas con inicial mayúscula. Conserva los multiplicadores de daño enemigo Casual 0,6, Normal 1, Hard 1,3 y Brutal 1,6. Classic debe escalar solo el daño enemigo, como Tactical. Revisa encuentros y botín para detectar el mismo error de mayúsculas. Fija la dificultad al crear el encuentro; no la cambies al modificar ajustes durante el combate.

Los multiplicadores actuales pertenecen únicamente a Traditional (la mecánica heredada actual de Engine). Al implementar 5e, V20 u otro conjunto de reglas, revisa la dificultad según la política propia de esas reglas. No heredes los multiplicadores de Traditional de forma predeterminada. Ajustar las decisiones de la IA es independiente de escalar el daño.

## Clima

Usa el clima de campaña existente y la exposición fundamentada del encuentro. Guarda el clima aceptado con el encuentro; la ausencia del campo en un combate antiguo significa mecánica neutral. La exposición desconocida es neutral. Los entornos cerrados están protegidos. Normaliza los alias actuales a los tipos de clima existentes; al establecer un tipo, genera viento y visibilidad compatibles.

Las reglas iniciales se aplican por igual a ambos bandos: la lluvia reduce moderadamente el daño de fuego y aumenta el de rayo; el viento fuerte penaliza los ataques marcados explícitamente como proyectiles; la mala visibilidad penaliza los ataques que requieren vista explícitamente; la nieve aumenta el costo de caminar en Tactical. El vuelo y la teletransportación conservan su semántica. No deduzcas los rasgos de proyectil/vista de los nombres de habilidades sin etiquetas. El clima despejado/nublado suele ser neutral. Las funciones compartidas deben gobernar previsiones, resolución y estimaciones de IA sin consumir futuras tiradas de combate.

Muestra las condiciones aceptadas y sus efectos en ambas interfaces. Los ajustes visuales del clima no pueden desactivar la mecánica. El clima permanece fijo durante el encuentro; se posponen las habilidades que lo cambian, las transiciones periódicas, los rayos aleatorios y el desgaste por calor. Summoning y futuras reglas pueden reutilizar el contrato compartido sin añadir un modo de interfaz incompleto.

## Decisiones de los enemigos

Conserva rol, adjetivo, competencia, legalidad y contabilidad de recursos. La dificultad modifica una variación de decisiones acotada y con semilla: Casual admite más errores plausibles, Normal queda cerca de la base actual, Hard es más consistente y Brutal minimiza errores sin eliminar las diferencias de competencia. Los compañeros usan una base fija Normal en cualquier dificultad; siguen respondiendo al clima y al peligro reales. Las restricciones de Mindless permanecen intactas.

Usa puntuaciones sensibles al clima para ataques, apoyo, posicionamiento y reacciones. Counterspell y guard compiten con pasar según amenaza, costo y personalidad. Ninguna dificultad concede órdenes ocultas, tiradas futuras, recursos gratuitos ni acciones adicionales. El prompt (las instrucciones enviadas a la IA) del jefe GM recibe la dificultad/clima aceptados y orientación sobre presión y oportunidades; el motor sigue imponiendo las opciones legales y los presupuestos ofrecidos. Si falla el proveedor, se conserva la alternativa local.

## Validación y entrega

Implementa configuración/corrección, clima e integración de IA en ese orden. Añade pruebas de regresión ejecutables para mayúsculas de dificultad; daño solo a enemigos; exposición, alias, previsiones y movimiento del clima; guardado/restauración; decisiones deterministas de enemigos y ajuste de compañeros; costos de reacciones y límites del prompt del jefe. Actualiza las pruebas de configuración/terreno para la preferencia de semilla obsoleta. Prueba computadora/móvil y ambos temas, incluidas las animaciones meteorológicas desactivadas. Ejecuta comprobaciones básicas, regresiones pertinentes de prompts y navegador, y CodeRabbit local antes de marcar el borrador como listo.

Los valores de ajuste son valores iniciales de diseño, no un equilibrio demostrado. Las pruebas automatizadas establecen mecánicas e invariantes; la calidad de jefes con un proveedor real y el equilibrio de campañas largas requieren pruebas de juego. Los asuntos pospuestos quedan sin asignar hasta que comience realmente el trabajo.

## Detalles de implementación

Las condiciones compartidas están en `packages/shared/src/features/combat-conditions.ts`. La dificultad se normaliza al importar/crear configuraciones y en los consumidores de encuentros, botín, Classic y Tactical. La variación de decisiones enemigas se multiplica por 2,5 / 1 / 0,4 / 0,15 para Casual / Normal / Hard / Brutal; la competencia y personalidad guardadas siguen vigentes. Classic estima con la misma probabilidad de impacto de d20 enfrentados que la resolución; Tactical usa la previsión de ataque compartida. La persecución Tactical ordena las rutas por costo de terreno y clima para los perfiles ordinarios. Las unidades Mindless eligen la ruta legal con menos pasos espaciales; ambas políticas pagan los costos reales de terreno y clima al moverse. Las reacciones valoran amenaza esperada y escasez, con la misma variación exclusiva de enemigos.

Con exposición a lluvia, lluvia intensa o tormentas, el daño de fuego se multiplica por 0,85 y el de rayo por 1,15. Los proyectiles explícitos pierden 10 puntos de precisión con viento fuerte y 15 con vendavales. Los ataques que requieren vista explícitamente pierden 5 con visibilidad reducida y 15 con mala visibilidad. La penalización combinada tiene un máximo de 25. Classic la convierte en modificadores de tiradas enfrentadas (un punto por cada cinco de precisión); su panel de condiciones identifica esas penalizaciones de tirada. En Tactical, la nieve/ventisca con exposición añade un punto de caminata por casilla; vuelo y teletransporte no cambian. Los objetos de daño elemental también reciben modificadores de lluvia; la curación y la duración de estados no.

El generador crea booleanos `projectile` / `requiresSight` para ataques básicos y habilidades, y `battlefield.terrainBrief.exposure`. Los rasgos ausentes son neutrales. Gana la exposición explícita; los entornos cerrados reconocidos están protegidos, los exteriores reconocidos expuestos y los ambiguos son desconocidos. El clima de campaña procede del sistema persistido, con el valor meteorológico de la escena confirmada como alternativa si falta. Las etiquetas de mensaje de inicio de combate detienen la progresión meteorológica de fondo antes de que el modo renderizado se actualice. Las condiciones aceptadas se guardan en el director y en el estado Tactical; se rechazan importaciones contradictorias o malformadas. Los guardados sin clima siguen neutrales. Los reinicios de Tactical heredado transmiten las condiciones aceptadas (incluida la ausencia neutral) en lugar de muestrear el clima de campaña cambiado.

La configuración sigue validando campos obsoletos de importación por compatibilidad y seguridad, pero los elimina de las exportaciones normalizadas. El motor conserva semillas explícitas de encuentro para restauración/reinicio y reproducción de regresiones. Esto no elimina las semillas de mundo de Experience, que tienen otra finalidad.

## Registro de verificación

Pasaron localmente `pnpm check` (localización, tipos, lint y compilaciones de producción) y `pnpm version:check`. La suite Node cubrió 295 archivos de regresión; cinco se repitieron con éxito después de que una compilación concurrente eliminara brevemente archivos generados. Las regresiones de combate se repitieron tras las correcciones de revisión, incluidas etiquetas de combate entrantes, progresión del clima fuera de combate, persecución ponderada, consistencia de dificultad, recursos de reacciones y contexto del jefe.

Chromium de computadora en tema claro y móvil en tema oscuro ejercitaron configuración/importaciones, ambos modos de combate, clima sin animaciones, reacciones, recargas, terreno alternativo y aislamiento del mapa restaurado. WebKit móvil local no pudo arrancar porque faltan libicu74, libjpeg-turbo8, libmanette-0.2-0 y gstreamer1.0-libav; ese navegador sigue pendiente de CI/verificación manual. El PR registra la revisión final y las repeticiones de la prueba de mapas aleatorios.
