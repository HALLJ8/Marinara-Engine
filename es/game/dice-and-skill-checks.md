# Game Mode: dados y pruebas de habilidad

Esta guía cubre las tiradas de dados en el Game Mode (modo juego) de Marinara Engine. Explica el menú de dados rápidos, la notación de dados personalizada y los límites de las tiradas personalizadas. También explica cómo el Game Master (director del juego) resuelve una prueba de habilidad contra una Clase de Dificultad (DC).

## Tiradas de dados

La barra de entrada de mensajes en un chat de Game Mode tiene un botón de dados. Pasa el cursor por encima para ver la tooltip (texto de ayuda) **Roll dice**. Haz clic en él para abrir el menú de dados rápidos.

El menú tiene ocho presets (ajustes guardados) de un solo clic:

| Preset | Tira |
|---|---|
| d20 | un dado de 20 caras |
| d6 | un dado de 6 caras |
| 2d6 | dos dados de 6 caras |
| d10 | un dado de 10 caras |
| d100 | un dado de 100 caras |
| d4 | un dado de 4 caras |
| d8 | un dado de 8 caras |
| d12 | un dado de 12 caras |

Para hacer una tirada rápida:

1. Abre la barra de entrada de mensajes en un chat de Game Mode.
2. Haz clic en el botón de dados.
3. Haz clic en uno de los ocho presets, por ejemplo **d20**.
4. Deberías ver un pequeño chip en la barra de entrada, como `🎲 d20`.

La tirada no se envía de inmediato. Queda en cola. Para quitar una tirada en cola, haz clic en el botón de borrar del chip. Su tooltip es **Clear queued roll**.

El cálculo de los dados se ejecuta cuando envías tu siguiente mensaje. La app añade el resultado al final de tu mensaje como una etiqueta. Un solo dado sin bono se ve así:

```
[dice: d20 = 14]
```

Una tirada con más de un dado o con un bono también muestra las partes:

```
[dice: 3d8+2 = 18 (4, 6, 6 +2)]
```

El Game Master lee esa etiqueta y narra en torno al resultado.

Cuando el Game Master hace varias tiradas en un turno, cada tarjeta de dados ocupa su propio lugar en la cola. Cierra una tarjeta para ver la siguiente. Todas las tiradas se guardan en el swipe (respuesta alternativa) activo de ese turno y siguen en **Logs** (registros) después de recargar. Continuar un turno conserva las tiradas anteriores; regenerarlo crea un conjunto independiente para el nuevo swipe.

El Game Master también puede pedir una tirada en la narración con `[dice: 3d8+2]`. El motor proporciona los números reales y muestra la misma tarjeta animada. Funciona en conexiones que solo admiten texto, incluidas las suscripciones de Claude y Grok. Usa la misma notación y los mismos límites que el menú de dados.

## Notación de dados personalizada

El menú de dados también tiene un campo de texto para una tirada personalizada. Usa la notación estándar `NdM`. `N` es cuántos dados tirar y `M` es cuántas caras tiene cada dado. Puedes añadir un bono o una penalización al final.

El texto de ejemplo del campo muestra un ejemplo: `3d8+2`. Eso significa tirar tres dados de 8 caras y sumar 2 al total.

Para usar una tirada personalizada:

1. Haz clic en el botón de dados para abrir el menú.
2. Escribe tu notación en el campo de texto, por ejemplo `2d6+1`.
3. Pulsa Enter, o haz clic en el pequeño botón de avión de papel (enviar) junto al campo.
4. Deberías ver la tirada en cola como un chip, lista para enviar.

Algunos ejemplos más que puedes escribir:

- `d20` tira un dado de 20 caras.
- `4d8-1` tira cuatro dados de 8 caras y resta 1.
- `2d6+3` tira dos dados de 6 caras y suma 3.

Hay dos límites estrictos. Puedes tirar como máximo 100 dados a la vez y cada dado puede tener hasta 1000 caras. Si pides más, la aplicación reduce tu solicitud a esos límites en lugar de rechazarla, y la tarjeta de resultado muestra la notación reducida: escribir `500d6` genera una tarjeta `100d6` para los cien dados que realmente tiró. Si el texto no es una notación de dados válida – `NdM` o un simple `dM` como `d20` –, la tirada falla y aparece un error que indica el formato esperado.

## Pruebas de habilidad

Una prueba de habilidad comprueba si tienes éxito en algo arriesgado, como escabullirte, detectar una pista o convencer a un NPC (personaje no jugador). Tú no inicias una prueba de habilidad por tu cuenta. El Game Master la solicita dentro de su narración. La app la convierte entonces en una tirada de d20 animada con un banner de resultado.

Una prueba solicitada por texto empieza con el intento. El motor resuelve los dados y realiza una solicitud adicional al modelo con los resultados reales para que el Game Master complete el desenlace en el mismo turno. También corrige borradores que adivinaron el resultado antes de la tirada. La solicitud adicional vuelve a enviar el prompt y consume más tokens de entrada y salida. Si falla, el turno conserva los resultados resueltos en su registro sin guardar un desenlace inventado o parcial. Un aviso con el botón **Regenerate turn** (regenerar turno) permanece en el turno, incluso después de recargar el chat.

Desactiva **Narrate dice outcomes immediately** (narrar los resultados de los dados inmediatamente) en **Chat Settings → Function Calling** para conservar los resultados reales para el siguiente turno sin esta solicitud adicional. Esta opción está activada de forma predeterminada. Las solicitudes que no producen ninguna tirada real nunca activan la solicitud de narración adicional.

En una conexión compatible con la herramienta de dados, el Game Master puede obtener una tirada real durante la generación. La tarjeta aparece en cuanto responde la herramienta; la prueba completada registra ese resultado sin volver a tirar. Cada prueba de habilidad resuelta recibe su propio aviso de resultado después de las tarjetas de dados en cola.

El banner muestra la habilidad y el número objetivo, por ejemplo **Stealth Check** con **DC 15** al lado. DC significa Clase de Dificultad (Difficulty Class). Es el número que tu tirada debe alcanzar o superar.

### Cómo se decide el resultado

La prueba tira un dado de 20 caras y suma dos modificadores:

- Un modificador de habilidad, a partir del nivel de habilidad que el juego lleva para tu personaje. Si el juego todavía no tiene un nivel para esa habilidad, este modificador es 0.
- Un modificador de atributo, a partir del atributo que gobierna esa habilidad.

La tirada del dado más ambos modificadores es tu total. Si el total alcanza o supera la DC, la prueba tiene éxito. Si se queda corta, la prueba falla. Cada habilidad se asigna a un atributo gobernante automáticamente. Por ejemplo, Stealth usa Dexterity, Perception usa Wisdom y Persuasion usa Charisma. Una habilidad que la app no reconoce recurre a Intelligence.

### Éxito crítico y fallo crítico

Dos tiradas anulan el cálculo:

- Un 20 natural (el dado en sí muestra 20) es un **CRITICAL SUCCESS**. Siempre pasa, incluso contra una DC alta.
- Un 1 natural (el dado en sí muestra 1) es un **CRITICAL FAILURE**. Siempre falla, incluso con modificadores grandes.

El banner muestra uno de cuatro resultados: **CRITICAL SUCCESS**, **SUCCESS**, **FAILURE** o **CRITICAL FAILURE**.

### Otros sistemas de dados

El Game Master puede indicar otra notación, como `[skill_check: skill="Endurance" dc="12" dice="3d6+2"]`. Estas pruebas usan el modificador fijo de la notación en lugar de los modificadores de d20 de la ficha del personaje y tienen éxito cuando el total alcanza la DC. Las reglas del 1 y el 20 naturales solo se aplican a la prueba estándar de d20 descrita arriba.

Las reservas de éxitos deben indicar tanto el umbral por dado como el número de éxitos necesarios: `[skill_check: skill="Intimidation" dc="4" dice="6d10" resolution="successes" threshold="6"]` tira seis d10, cuenta una vez cada dado que muestre al menos 6 y tiene éxito con un mínimo de cuatro éxitos. El motor no adivina un umbral ausente ni implementa dados explosivos, pifias u otras reglas especiales de reservas. Una reserva sin un umbral válido queda sin resolver y se eliminan los números inventados por el modelo.

Las solicitudes no compatibles, como `4d6kh3`, `3d6!` o `4dF`, no se tiran. El motor registra la notación no compatible y elimina los números inventados de los registros de pruebas. Estos resultados quedan sin resolver; el motor no sustituye silenciosamente el sistema de dados.

### Ventaja y desventaja

El Game Master puede solicitar una prueba con ventaja o con desventaja. Una prueba nunca se tira con ambas al mismo tiempo.

- Con ventaja, la app tira dos dados de 20 caras y se queda con el más alto.
- Con desventaja, la app tira dos dados y se queda con el más bajo.

Cuando cualquiera de las dos está activa, el banner muestra el modo junto a la DC, y marca qué dado usó.

### Tirar tu propio dado por adelantado

Puedes poner en cola tu propio `d20` desde el menú de dados antes de que ocurra la prueba. Cuando lo haces, la prueba de habilidad usa tu número tirado en lugar de tirar un dado nuevo. Tus modificadores de habilidad y de atributo se aplican igualmente por encima de él.

<a id="games-that-use-a-ruleset"></a>

## Partidas con un conjunto de reglas

Elige el conjunto una sola vez en **Rules** al crear la partida; consulta [Elegir las reglas](getting-started.md#choosing-rules). Sin conjunto se mantienen las reglas anteriores, incluidas las reservas simples de éxitos sin dados explosivos ni otras reglas especiales.

- El GM indica la habilidad o salvación y una dificultad de la escala del conjunto. Esta puede superar 1–40; la resolución de emergencia de una prueba pendiente en un turno guardado sigue limitada a 1–40.
- El motor tira los dados del conjunto. El modificador sale de su ficha: atributo, entrenamiento (múltiplo de competencia, valor fijo o ambos) y bonificación adicional. No usa los atributos ni las bonificaciones de habilidad integrados.
- `who="Name"` selecciona un compañero; sin ese campo se usa al jugador. Un compañero sin ficha recibe valores predeterminados. Un nombre desconocido o ambiguo produce una tirada sin modificador. El nombre de la persona siempre identifica al jugador, aunque coincida con un compañero. Nunca se toma prestada otra ficha.
- Los resultados naturales dependen del conjunto. En 5e (SRD 5.1), un 20 o un 1 natural no tiene efecto especial en pruebas ni salvaciones; un 20 puede fallar.
- Los números escritos por el GM se validan. Un modificador, cantidad o tipo de dados, dado elegido o resultado natural no válido provoca una nueva tirada que sustituye el resultado.
- Una tirada manual previa solo se reutiliza para una d20 individual. Otros dados, como 2d6 o una reserva, se vuelven a tirar.
- `with="Ability"` permite usar otro atributo declarado por el conjunto; los desconocidos se ignoran. Los marcadores de tirada pueden nombrar atributos, habilidades, salvaciones y `PROF` si existe bonificación de competencia.
- Si falta el paquete o es demasiado antiguo, la prueba queda pendiente y sin números. El motor no la resuelve con otro sistema. Consulta los recursos, estados y descansos en [La ficha del conjunto](party-and-npcs.md#the-ruleset-sheet).

### Conjuntos con reservas de dados

La puntuación de la ficha determina cuántos dados se tiran: atributo 3 y habilidad 2 dan cinco dados. El editor y el contexto del GM muestran "5 dice" en lugar de "+5". La dificultad es el número de éxitos necesario, por ejemplo tres, no una suma de 15.

El conjunto define el umbral, éxitos dobles, explosiones, cancelaciones por resultados bajos, pifias y éxitos excepcionales. La tarjeta muestra todos los dados, destaca los éxitos y compara su cantidad con el objetivo. Las reservas grandes ocupan más filas sin encoger los dados ni mostrar una suma ficticia.

El GM solo puede modificar el umbral de cada dado o el tamaño de la reserva dentro de los límites del conjunto. Los resultados inventados por el modelo siempre se sustituyen por tiradas reales. No se aplican ventaja, tiradas manuales previas ni la vista previa de d20 del GM; el motor tira la reserva sin mostrarla de antemano.

## Guías relacionadas

- [Game Mode: Combate](combat.md)
- [Game Mode: Primeros pasos](getting-started.md)
- [Game Mode: Grupo y NPCs](party-and-npcs.md)
