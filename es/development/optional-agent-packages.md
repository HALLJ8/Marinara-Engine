# Paquetes opcionales de agentes y capacidades

Estado: implementado para el ciclo de desarrollo v2.3.0 en el issue #3612.

## Objetivo

La distribución base de Marinara Engine no debe compilar ni incluir implementaciones opcionales de agentes y capacidades. Las instalaciones nuevas empiezan sin paquetes opcionales. Las actualizaciones conservan las capacidades que estaban disponibles antes de que se introdujera este sistema de paquetes.

El catálogo oficial, las fuentes de los paquetes, los artefactos reproducibles, los scripts de validación y el flujo de contribución están en [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Los artefactos instalados quedan dentro de la carpeta de datos de Marinara configurada, para que las actualizaciones de la aplicación no puedan sobrescribirlos.

## Modelo de paquetes

Un paquete de agente puede aportar uno o más agentes declarativos y capacidades ejecutables de confianza opcionales:

- puntos de entrada del servidor para rutas, hooks de ciclo de vida, proveedores de prompt (instrucciones enviadas a la IA), manejadores de resultados y migraciones de almacenamiento;
- puntos de entrada del cliente para paneles, superficies de chat, secciones de configuración, opciones de configuración inicial, visualizaciones en tiempo de ejecución y superficies completas de Game Mode;
- esquemas JSON compartidos y contratos de comunicación estables;
- recursos propios del paquete, documentación y fragmentos de conocimiento de Professor Mari.

Los paquetes apuntan a una API de capacidades de Marinara con versión. No deben importar rutas de código privadas del motor.

Los elementos de capacidad del cliente reciben la configuración regional de la interfaz elegida en el Engine a través de sus atributos `lang` y `dir` y del objeto
`capabilityProps.localization`. Las interfaces propias del paquete conservan sus propios archivos de idioma y recurren al inglés del paquete; el Engine no traduce los prompts del paquete ni los valores de máquina escritos por el paquete. Los cambios de idioma reutilizan el evento
`marinara-capability-props` existente, para que una interfaz instalada pueda volver a renderizarse sin reiniciar el Engine.

### Entrega y caché

Los archivos de paquetes instalados se sirven con validadores fuertes derivados de los hashes SHA-256 por archivo del manifiesto, los mismos valores con los que Engine vuelve a verificar los bytes en cada lectura. El paquete del cliente (`/api/capability-packages/<id>/client`) y todos los recursos del paquete siempre se revalidan (`no-cache` junto con un `ETag`), por lo que un archivo sin cambios responde `304 Not Modified` en vez de descargarse de nuevo, mientras que un archivo vuelto a publicar se recoge de inmediato. Nada se sirve como `immutable`: la política de instalación permite volver a publicar la misma versión con bytes diferentes, por lo que ninguna URL de paquete está direccionada por contenido.

La API de capacidades 1.1 añade una fachada genérica de tiempo de ejecución al contexto de activación del servidor.
Los paquetes pueden leer el estado efectivo de depuración de agentes y escribir a través del
logger Pino del Engine, incluidos los reemplazos explícitos del modo de depuración, sin importar el
logger privado ni los módulos de configuración de tiempo de ejecución. La fachada expone operaciones,
no los objetos internos del Engine.

La API de capacidades 1.2 añade operaciones de chat/mensaje con alcance de transacción, escrituras
limitadas de metadatos de chat y lecturas de existencia de entradas de lore, y el almacén de
compatibilidad de instantáneas espaciales. Los paquetes pueden validar cambios de dominio dentro de una
transacción del Engine y confirmar de forma atómica los metadatos junto con un mensaje propietario, un swipe (respuesta alternativa) o una instantánea
espacial, sin recibir un manejador de base de datos ni un objeto de tabla. El Engine conserva
la reversión y la compatibilidad de almacenamiento histórico; los paquetes conservan la validación y
la política de dominio. La misma API expone registros normalizados de chat y personaje, la selección
de entradas de lore elegibles, el análisis de respuestas tipo JSON y las llamadas resueltas al modelo de lenguaje.
Las credenciales de conexión, las implementaciones de proveedor, los manejadores de base de datos y los objetos de almacenamiento
siguen siendo privados del Engine.

### Capability API 1.7: ramas de chat

Capability API 1.7 añade metadatos normalizados de rama a `CapabilityChatRecord`:

```ts
branch: {
  title: string | null;
  parentChatId: string | null;
  parentMessageId: string | null;
  childMessageId: string | null;
} | null;
```

`title` es el nombre de rama guardado sin espacios sobrantes. Los chats raíz devuelven `null`. Las ramas conocidas creadas por Engine exponen el chat padre inmediato, el mensaje de origen de la bifurcación y el mensaje hijo copiado. Las ramas vacías usan anclas de mensaje null. Las ramas heredadas, los metadatos no válidos y los chats hermanos de grupo importados sin una relación conocida devuelven campos de linaje null; Engine no deduce relaciones históricas. La exportación e importación genéricas omiten los ID del padre y de los mensajes porque cambian entre instalaciones. Eliminar el padre no modifica el linaje del hijo.

### Capability API 1.8: experiencias de Game

Capability API 1.8 añade experiencias de Game proporcionadas por paquetes, contexto de prompt por turno de Game y escritura de recursos.

Un paquete puede proporcionar un Game Mode completo en vez de un añadido al modo integrado. Declara la ranura `game-surface` y se elige al crear un juego, en el bloque Experiences del asistente de configuración. La elección queda guardada en el juego y no cambia durante toda su vida, por lo que una experiencia nunca se activa o desactiva en mitad de una partida. La superficie dibuja su propio HUD, menús y combate sobre la narración compartida, y declara qué sistemas integrados sustituye. Lo que no se declare sigue siendo integrado, así que una experiencia solo desactiva aquello que realmente implementa. El valor opcional `contributions.gameSurface.surfaceClass` indica una clase que Engine aplica al área de juego mientras la superficie está montada, lo que permite que la hoja de estilos del paquete cambie la interfaz compartida que se renderiza fuera de su propio elemento.

Los paquetes con el permiso `prompt-context` aportan texto al prompt del sistema de cada turno de Game generado. Así, un paquete que controla un estado activo puede mantener el modelo en consonancia con lo que ve el jugador. Una contribución también puede declarar qué sistemas integrados del juego sustituye, y Engine deja de pedir al modelo que los controle. Las contribuciones se recogen en cada turno y nunca son obligatorias: si no devuelven nada se omiten; si lanzan un error o no terminan dentro de su plazo, se registran y se omiten sin afectar a la generación.

La fachada de recursos permite escribir además de leer, por lo que el flujo de configuración de un paquete puede buscar o crear la Persona del jugador y su lorebook. Engine conserva el almacenamiento, la validación y la identidad; los paquetes conservan el contenido del dominio.

### Capability API 1.10: recursos de paquete

Capability API 1.10 añade la entrega general de recursos estáticos propios del paquete. Un manifiesto puede declarar `contributions.assets.paths`, una lista permitida de hasta 256 imágenes (`png`/`webp`/`gif`/`jpg`/`jpeg`) y archivos JSON incluidos en el paquete. Engine los sirve mediante `/api/capability-packages/<id>/assets/<path>` con la misma cadena de verificación exacta que ya usan los iconos de pestaña: contención de ruta, pertenencia del hash a `files[]`, lista permitida de tipos de contenido pasivos y nueva verificación de integridad en cada lectura. El esquema rechaza los tipos de documento activos (SVG, HTML y scripts); toda ruta declarada debe estar fijada por hash en `files[]`; y el `manifest.json` interno del paquete nunca puede servirse, aunque se declare. Declarar `contributions.assets` exige un manifiesto `schemaVersion` 2 con `capabilityApi` 1.10 o posterior; un manifiesto v1 no puede declararlo. Los recursos siempre se revalidan: como el paquete del cliente, llevan un `ETag` fuerte basado en el hash del manifiesto y responden a una revalidación sin cambios con `304 Not Modified` y sin cuerpo, de modo que un conjunto de mosaicos solo vuelve a descargarse cuando cambian sus bytes. Las respuestas nunca son `immutable` de forma deliberada: la política de instalación permite volver a publicar la misma versión con bytes distintos, así que una URL con versión no está direccionada por contenido. Esto permite que una experiencia `game-surface` incluya arte real en vez de incrustarlo en su paquete del cliente.

Un manifiesto que incumpla estas reglas se rechaza durante la instalación con uno de estos mensajes: "A declared package asset must be listed in the package file manifest", "contributions.assets requires schemaVersion 2 and capabilityApi 1.10 or newer", el error de extensión del esquema para una ruta que no sea de imagen o JSON, o, en archivos cuyos nombres solo difieran en mayúsculas y minúsculas y que se fusionarían en sistemas de archivos que no distinguen entre ellas, "Package contains duplicate file" / "Package manifest declares files that collide on case-insensitive filesystems".

Cada elemento de capacidad recibe su propia identidad para este fin: `capabilityProps.packageId` y `capabilityProps.packageVersion` llegan junto a `localization`, por lo que un paquete crea las URL de sus recursos como `/api/capability-packages/<packageId>/assets/<path>`, opcionalmente con `?v=<packageVersion>` para que un cambio de versión invalide cualquier caché intermedia, sin volver a solicitar la lista de instalados ni extraer información de su propia URL de importación.

### Capability API 1.11: interfaz de combate para experiencias

Capability API 1.11 añade una interfaz de combate a las propiedades de la capacidad `game-surface`. `combatActive` informa del instante en que la interfaz de combate integrada se monta de verdad, a diferencia de `chatMeta.gameActiveState`, el estado narrativo de la escena del GM, que tarda en reflejar el cambio y puede indicar "combat" sin que exista ningún encuentro. `combatStyle` contiene el estilo efectivo (`classic` o `tactical`). `requestCombat()` pide a Engine que genere un encuentro mediante el mismo proceso que usa el botón manual Start Combat, salvo por el diálogo de confirmación, porque la propia interfaz de la experiencia ya expresó la intención. El proceso de generación de Engine sigue decidiendo en qué consiste el encuentro. No existe deliberadamente ninguna forma de que el paquete suministre combatientes o un estado de combate directamente: el combate sigue siendo propiedad de Engine.

`requestCombat()` conserva una identidad estable, no muestra mensajes en la ruta del paquete y devuelve un código con el que la experiencia renderiza su propia respuesta: `"started"` o un rechazo, `"combat-active"`, `"pending"` (ya hay una generación en curso), `"no-turn"` (el GM todavía no ha escrito un turno) o `"unavailable"` (sesión terminada o repetición). `combatPending` y `combatError` reflejan el avance y el fallo de la generación para que un paquete no quede esperando `combatActive` después de un error. Como las interfaces 1.7 y 1.8, pero a diferencia de `contributions.assets` de 1.10, que tiene una barrera estricta, estas propiedades se entregan a todos los paquetes `game-surface` con independencia del valor de `capabilityApi` que declaren. La etiqueta 1.11 indica cuándo aparecieron; si un paquete las necesita, declara 1.11 y las versiones anteriores de Engine lo rechazan correctamente.

### Capability API 1.12: eventos espaciales para la experiencia propietaria

Capability API 1.12 también dirige los eventos de capacidad espacial al paquete de la experiencia propietaria del juego. `spatial_transition_committed`, `spatial_transition_rejected` y la indicación sin tipo `spatial_context_refresh`, antes dirigidos solo a `hierarchical-maps` en el evento de ventana `marinara-capability-server-event`, ahora se envían también con `packageId` establecido en el `gameExperienceId` del chat. Las cargas varían: un evento confirmado contiene `{ chatId, commandId, currentLocationId, definitionRevision, travel? }`; un evento rechazado contiene `{ chatId, commandId, code?, message? }`, sin campos de ubicación porque el movimiento no ocurrió; la indicación de actualización contiene `data: null`. Una experiencia que envió una orden de viaje mediante el argumento `pendingSpatialTransition` de `sendMessage` puede confirmar o borrar el viaje en cuanto el host conoce el resultado, en vez de deducirlo de lecturas posteriores. La versión 1.12 también cierra una brecha que afectaba a World Maps: las transiciones rechazadas por cualquiera de las dos rutas HTTP silenciosas, la confirmación del turno propietario antes del streaming dentro de una generación o la confirmación REST independiente, antes no generaban ningún evento. Ahora ambas sintetizan `spatial_transition_rejected`, pero solo con pruebas definitivas: un código de error `spatial_*` distinto de `already_applied`. Los fallos no concluyentes, como un error de red que podría haber perdido una confirmación correcta, envían en su lugar la indicación sin tipo `spatial_context_refresh` para que los receptores se sincronicen con el estado del servidor en vez de aceptar un veredicto inventado. Un evento confirmado cuyo `travel.mode` sea `"step_by_step"` y tenga `complete: false` significa que el viaje continúa; conserva el estado pendiente hasta el evento final. Es una interfaz flexible como la 1.11: los eventos se entregan con independencia del `capabilityApi` declarado. Declara 1.12 solo si el paquete los necesita.

### Capability API 1.13: contracción transitoria de la narración

Capability API 1.13 añade `requestsCollapsedNarration` a la declaración de interfaz que un paquete `game-surface` pasa a `setExperienceChrome`. Mientras el indicador sea true, el cuadro de narración de Game Mode se pliega hasta su tirador estrecho, de modo que una experiencia puede despejar la pantalla para una cinemática o una escena a pantalla completa.

Es una SOLICITUD, no una preferencia. Nunca se escribe el ajuste de contracción del jugador, y el indicador solo se respeta mientras la experiencia sea la superficie activa. Si se elimina el indicador o deja de ser la superficie activa, el cuadro vuelve a lo que eligió el jugador. Esa es la garantía de que siempre se abre de nuevo después; un paquete no puede guardar la contracción de forma permanente.

Las reglas de seguridad de Engine tienen prioridad. El cuadro se expande a la fuerza siempre que se muestre el campo de texto del jugador, incluso al principio de una escena antes de que exista un segmento, y cuando estén activos los controles para avanzar el segmento, porque son la única forma de terminar un turno. Un paquete capaz de ocultarlos podría dejar al jugador atrapado para siempre. El tirador también sigue mostrando su indicador de atención cuando hay pendiente un reintento de análisis de escena, generación o generación de combate. Si el jugador expande el cuadro a mano durante una solicitud, permanece abierto hasta que termine la solicitud. Como las interfaces 1.11 y 1.12, esta es flexible: el campo se respeta con independencia del `capabilityApi` declarado, y la etiqueta 1.13 indica cuándo apareció, por lo que un paquete que lo necesite declara 1.13.

### Capability API 1.17: preparar una Experience antes de su primer turno

Un paquete `game-surface` puede declarar `contributions.gameSurface.prepareBeforeStart: true` con la versión 2 del esquema y Capability API 1.17. Engine monta esa superficie cuando el juego está listo, antes de habilitar **Start Game** (Iniciar juego). Los juegos clásicos y los paquetes sin esta marca conservan su flujo de inicio actual.

La superficie principal que activa esta opción recibe dos propiedades adicionales:

- `startup: boolean` permanece en true hasta que el jugador termina la introducción de Engine con **Continue** (Continuar). Pausa la simulación del mundo y las acciones del jugador mientras sea true.
- `setStartupReady(context: string | null): void` comunica el estado de preparación. Envía `null` mientras cargas, guardas o te recuperas de un fallo. Envía una cadena solo cuando el mundo real esté guardado de forma persistente y se pueda usar; una cadena vacía permite iniciar sin contexto adicional.

El host bloquea **Start Game**, su confirmación de preparación de widgets y los reintentos del turno inicial hasta recibir una cadena de disponibilidad. Durante el bloqueo, la interfaz de carga y de error/reintento del propio paquete sigue visible. Cuando está listo, el paquete se oculta detrás de la introducción normal de Engine. **Continue** abre la superficie habitual, que puede montarse de nuevo: haz que la preparación del mundo sea idempotente y restaura el estado guardado en lugar de generarlo otra vez. Volver a un juego cuya introducción ya terminó no repite la preparación inicial.

El contexto de apertura tiene un límite de **8 000 caracteres**. Un contexto no válido o demasiado largo mantiene bloqueado el inicio y muestra un error; el host no recorta los hechos del mundo. Proporciona una descripción compacta de la ubicación inicial preparada y de los personajes realmente presentes. Engine añade este texto a su `generationGuide` existente del primer turno con el origen `game_start`, para que la apertura use el mundo que existe. Esto no registra contexto para turnos posteriores; sigue usando la contribución normal del paquete al prompt o su contexto de generación de turnos.

Las funciones de retorno de disponibilidad pertenecen al chat, al juego y al paquete montados. Las llamadas tardías de otro ámbito se ignoran. Un fallo del módulo o del entorno de ejecución bloquea el inicio en vez de tratar la ausencia de contexto del mundo como un éxito. Tras una recarga, el paquete debe comunicar su disponibilidad a partir del mundo guardado. El proveedor de contexto del prompt en el servidor sigue siendo de solo lectura y conserva su plazo breve; no lo uses para generar el mundo ni como barrera de inicio prolongada.

### Capability API 1.19: herramientas aportadas por paquetes

Capability API 1.16 permitía que un paquete hiciera que el modelo _dijera_ algo sobre lo que pudiera actuar. Esta versión permite que el modelo _llame_ a algo. Un paquete con el nuevo permiso `tools` registra una herramienta con nombre desde su punto de entrada del servidor. Engine la ofrece junto a las herramientas integradas en cada turno de cada chat, valida la llamada con el JSON Schema del paquete y entrega los argumentos a su manejador.

```ts
export async function activate({ api }) {
  api.registerTool({
    name: "set_time",
    description: "Move the world clock forward or back.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["advance", "rewind"] },
        minutes: { type: "integer", minimum: 0 },
      },
      required: ["action", "minutes"],
      additionalProperties: false,
    },
    handler: async (args, { chatId }) => {
      const clock = await moveClock(chatId, args.action, args.minutes);
      return { time: clock.label };
    },
  });
}
```

Se usan llamadas a herramientas en lugar de un formato de respuesta de forma deliberada. Un formato ocupa toda la respuesta: la narración tendría que ser un campo de un objeto JSON y no podría transmitirse progresivamente. Una llamada puede llegar junto al texto mientras el modelo escribe su turno. El paquete recibe argumentos que el proveedor ya restringió, en vez de extraerlos de la narración terminada: un esquema impone reglas, mientras que una convención solo le pide al modelo que las respete.

Los valores enumerados muestran la diferencia. Si un paquete conoce doce lugares, puede incluir esos doce nombres en el esquema. Un nombre decimotercero se rechaza antes de llegar al manejador. La validación de argumentos existente de Engine indica los valores válidos para que el modelo corrija la llamada. Lo que devuelve el manejador se muestra al modelo como resultado de la herramienta.

Antes de escribir una herramienta, ten en cuenta estas reglas:

- Los nombres usan `<packageId>_<name>`, reemplazando `-` por `_`: `set_time` de `world-clock` llega al modelo como `world_clock_set_time`. Se rechaza un nombre que ya pertenece a otro paquete. Las herramientas integradas y las herramientas personalizadas habilitadas conservan los nombres en conflicto; se omite la definición del paquete. El nombre completo tiene un máximo de **64 caracteres**. Tanto las definiciones como la ejecución siguen este orden: integrada, personalizada, paquete.
- Las herramientas se adjuntan mientras el paquete esté activo. No hay un segundo interruptor por chat como para las herramientas integradas: el permiso y el registro son la decisión. El proveedor seleccionado debe admitir llamadas nativas a herramientas.
- El esquema de parámetros se copia y compila al registrarse. Si Engine no puede compilarlo, falla la activación, donde puedes ver el problema durante el desarrollo, en vez de fallar a mitad del turno.
- Si el manejador lanza un error, la llamada se marca como fallida y se registra; su mensaje no se reenvía. Si no termina en **10 segundos**, el turno deja de esperar. El manejador sigue ejecutándose, pero no puede bloquear todo el turno.
- Los resultados deben poder serializarse en un máximo de **64 KiB**. Los resultados mayores o no serializables hacen fallar la llamada en vez de desplazar la conversación. Las descripciones y los resultados son contenido de confianza del paquete. Comprueba `chatId` antes de leer o cambiar datos de un chat.
- Cada definición se serializa en la solicitud al proveedor de cada turno y cuenta para el ajuste del contexto. Los límites son **16 herramientas por paquete**, **64 entre todos los paquetes**, **512 caracteres** por descripción y **8 KiB** por esquema de parámetros. Superarlos lanza un error que impide la activación. Registrar de nuevo un nombre propio reemplaza esa herramienta sin consumir otro espacio.
- El contexto de activación deja de funcionar cuando se desmonta. Si un paquete conserva `api` y llama a `registerTool` desde una devolución de llamada posterior, se rechaza: un entorno terminado no puede registrar herramientas ni reemplazar las de una nueva activación.
- Desactivar, actualizar o eliminar un paquete libera sus herramientas. El modelo no recibe herramientas de un paquete que ya no puede responder. Se eliminan antes de esperar la limpieza; cada devolución de llamada de limpieza tiene un plazo de 8 segundos.

Estos plazos solo limitan la espera asíncrona. Los paquetes se ejecutan como código de confianza en el proceso del servidor; un temporizador no puede interrumpir el trabajo síncrono que bloquea el bucle de eventos. La cancelación forzosa requeriría un worker o proceso separado, que esta API no proporciona.

`api.registerTool` solo existe a partir de esta versión de Engine. Un paquete que lo necesite debe declarar `capabilityApi` 1.19 y no se instalará en versiones anteriores.

## Paquetes iniciales

- todos los agentes integrados actuales;
- mapas espaciales jerárquicos para Roleplay y Game;
- llamadas de audio y video de Conversation;
- UNO;
- Chess;
- Poker;
- 8-Ball Pool;
- Tic-Tac-Toe;
- Rock-Paper-Scissors.

La base conserva el gestor de paquetes, el cliente del catálogo, los contratos genéricos del pipeline de agentes, los contratos genéricos del host de juegos por turnos y las interfaces de host inertes. Las implementaciones concretas pertenecen a los paquetes.

## Confianza e instalación

El catálogo oficial es un documento JSON con versión y validado por esquema, obtenido por HTTPS. Cada entrada de versión incluye URLs de artefactos inmutables, resúmenes SHA-256, tamaños en bytes, compatibilidad con el motor, permisos y si su tiempo de ejecución requiere reinicio.

Los comandos del modelo declarados por un paquete solo se ejecutan si el paquete declara `chat-write`, está instalado y está listo. Este permiso también controla las escrituras mediante la API de persistencia del paquete, incluidos mensajes, metadatos del chat, eventos de roleplay e instantáneas espaciales. `chat-read` controla las lecturas de chats, mensajes, estado del juego e instantáneas espaciales. Las mismas comprobaciones se aplican dentro de las transacciones de persistencia y los bloqueos del chat; el permiso de escritura no concede implícitamente permiso de lectura. Las llamadas de persistencia del propio motor siguen siendo de confianza.

La vista de detalles de **Download Agents** (descargar agentes) muestra los permisos declarados por la versión instalada después de la instalación. Si la versión del catálogo solicita permisos diferentes, los muestra por separado. Instalar o actualizar código sigue requiriendo la aprobación existente vinculada a esa versión y suma de comprobación exactas; los comandos del modelo no solicitan una aprobación independiente en cada turno.

Son comprobaciones de la API, no un entorno aislado de JavaScript. Los permisos de red, almacenamiento e interfaz son declaraciones de acceso. El código del paquete en el navegador y el servidor sigue siendo código de confianza y puede acceder al entorno del host; instala solo paquetes en los que confíes. Se comprueba que el paquete esté listo, no solo que pueda servirse, por lo que una actualización que lo deje en `restart-required` impide resolver sus comandos hasta que se reinicie el motor.

Al iniciar el servidor, el host obtiene el catálogo una vez cuando hay al menos un paquete oficial instalado, selecciona solo las versiones más nuevas compatibles con el Engine y la API de capacidades en ejecución, las verifica mediante el pipeline de instalación normal y las instala antes de que se activen los tiempos de ejecución de los paquetes. Los fallos se aíslan por paquete. Los archivos existentes y el estado del registro siguen siendo utilizables cuando el catálogo está fuera de línea o la verificación falla, y los fallos de disponibilidad del tiempo de ejecución del servidor usan la ruta de reversión a la versión anterior.

El instalador debe:

1. exigir acceso privilegiado de loopback/administrador;
2. imponer HTTPS, límites de descarga y tiempos de espera;
3. verificar la confianza del catálogo y el SHA-256 del artefacto antes de la extracción;
4. rechazar rutas absolutas, traversal, enlaces, archivos de dispositivo y archivos no declarados;
5. validar el manifiesto y la compatibilidad con el motor;
6. extraer en una carpeta hermana temporal;
7. activar de forma atómica solo después de que la validación tenga éxito;
8. conservar la versión anterior hasta que el nuevo tiempo de ejecución arranque correctamente;
9. revertir la activación en caso de fallo;
10. nunca ejecutar scripts de instalación, actualización o desinstalación.

Solo los paquetes ejecutables de confianza de primera parte quedan habilitados por el catálogo oficial. Un futuro flujo de terceros requiere un diseño de confianza explícito aparte.

## Comportamiento en tiempo de ejecución y reinicio

El servidor es dueño del registro de paquetes instalados y expone las capacidades instaladas a los clientes. Los módulos declarativos y recargables se activan de inmediato. La interfaz invalida las consultas de catálogo, agente, capacidad de modo y chat activo después de la activación.

El manifiesto puede declarar `restartRequired` solo cuando el host no puede recargar ese punto de entrada de forma segura. La activación en caliente exitosa dice `Agent installed. It is ready to use.` La activación que requiere reinicio dice `Agent installed. Restart Marinara Engine to finish setup.`

Los paquetes de juegos por turnos son recargables en caliente: la instalación registra de inmediato su motor de servidor y su lanzador manual por comando slash, y la desinstalación desacopla el tiempo de ejecución sin reiniciar el Engine. Los ajustes de Conversation Commands por chat solo controlan si los personajes pueden emitir el comando oculto del paquete; no limitan el lanzador slash del usuario. Los manifiestos oficiales actuales de juegos por turnos conservan su marcador conservador de reinicio heredado para compatibilidad con el Engine 2.x; el Engine 3.x reconoce el tipo `turn-game`, realiza la activación en caliente segura y devuelve el paquete como activo y listo.

## Migración de compatibilidad

En el primer arranque tras la actualización:

- los agentes personalizados quedan intactos;
- cada agente integrado heredado visible para esa instalación se registra como instalado;
- los mapas, las llamadas de Conversation y los juegos de Conversation conservan su disponibilidad anterior;
- la configuración por chat existente, las instantáneas, el estado del juego, el historial de llamadas y la memoria de agente permanecen en su lugar;
- la migración es idempotente y registra su finalización solo después de que todas las entradas de disponibilidad heredadas sean duraderas.

Los artefactos de paquetes heredados siguen disponibles en el catálogo oficial como fuentes de migración. Las instalaciones nuevas no los exponen ni los activan hasta que el usuario los instala.

## Desinstalación

La desinstalación quita el paquete de las selecciones del chat activo, elimina su configuración de agente y los archivos ejecutables descargados, y desacopla su tiempo de ejecución en el reinicio cuando es necesario. Los chats históricos, los mensajes, las instantáneas de mapa, los resúmenes de llamadas y los registros de juegos completados siguen siendo legibles, para que quitar un paquete no pueda destruir el trabajo del usuario. La eliminación destructiva de datos de dominio históricos es una acción de usuario aparte y explícita.

Toda desinstalación requiere confirmación. Los chats afectados vuelven a sus superficies base ordinarias sin corromper el historial.

## Interfaz del catálogo

El panel de Agents contiene un control `Download Agents` que coincide con la función `Download Cards` del Card Browser. Abre una biblioteca responsiva a pantalla completa con búsqueda, tipos de paquete, información de compatibilidad, estado de instalación/actualización, permisos, costo de almacenamiento, documentación y controles de desinstalación.

En escritorio se usa una lista de exploración con una región de detalle adyacente. En móvil se usa un solo panel con navegación de retroceso explícita y acciones de tamaño táctil. Los estados vacío, fuera de línea, incompatible, descarga corrupta, instalación interrumpida, actualización, reversión y requiere-reinicio son de primera clase.

## Puerta de extracción

Una extracción está completa solo cuando los paquetes base de producción del cliente y del servidor ya no contienen la implementación del paquete, una instalación nueva no puede activarlo sin descargar el paquete, una instalación actualizada lo conserva, y la instalación/actualización/desinstalación del paquete pasa en sistemas de archivos de escritorio, móvil y compatibles con Termux.

### Capability API 1.20: conjuntos de reglas de Game Mode

Un conjunto aporta datos validados: resolución de pruebas compatible con Engine, una ficha de elementos predefinidos, descansos y orientación para el GM. El recurso reservado `ruleset.json` se descubre como `gm-verbs.json`: mediante `contributions.assets.paths` y un hash en `files[]`.

```json
{
  "schemaVersion": 2,
  "capabilityApi": { "major": 1, "minor": 20 },
  "id": "ruleset-5e-2014",
  "kind": ["ruleset"],
  "permissions": [],
  "entrypoints": {},
  "contributions": { "assets": { "paths": ["ruleset.json"] } },
  "files": [{ "path": "ruleset.json", "sha256": "<sha256 of the file>", "bytes": 25767 }]
}
```

El ejemplo solo muestra campos del conjunto. Siguen siendo obligatorios `name`, `version`, `description`, `engine` y `builtAgainst`. No hacen falta permisos, agente ni puntos de entrada de cliente o servidor. El tipo `ruleset` y `ruleset.json` se requieren mutuamente. No se ejecuta código ni expresiones de texto; una mecánica nueva requiere cambios en Engine. Consulta formato y ejemplo 5e en [`game-rulesets-and-sheets-implementation.md`](game-rulesets-and-sheets-implementation.md).

Es un límite estricto de compatibilidad: el manifiesto debe declarar API 1.20 o un Engine anterior rechazará la instalación. Engine rechaza tamaños declarados superiores a 256 KB antes de leer, comprueba de nuevo el hash instalado y valida con `packages/shared/src/schemas/ruleset.schema.ts`. Un archivo inválido se omite con una entrada de registro que identifica paquete y primeros errores `path: message`. Ante IDs duplicados gana el primer paquete en orden de ID de paquete; el otro se omite con registro. `engine-legacy` y `traditional` están reservados.

La selección se guarda una vez en `chat.metadata.gameRuleset`. Sin selección se usan las reglas anteriores. Un paquete ausente o una definición antigua queda no disponible, sin sustitución automática. El vínculo comprueba ID del conjunto y paquete proveedor para impedir que otro paquete se apropie de la partida repitiendo el ID.

### Capability API 1.21: catálogos de conjuntos

Los catálogos ofrecen conjuros, capacidades de clase y equipo para el selector de la ficha. El encabezado está en `ruleset.json` bajo `catalogs`; las entradas pueden ser internas o un recurso reservado:

```json
{
  "capabilityApi": { "major": 1, "minor": 21 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } },
  "files": [
    { "path": "ruleset.json", "sha256": "<sha256>", "bytes": 25767 },
    { "path": "catalogs/spells.json", "sha256": "<sha256>", "bytes": 418204 }
  ]
}
```

`catalogs/<id>.json` debe coincidir con el ID del catálogo, no con otro. Lleva hash en `files[]` y requiere el `ruleset.json` que lo declara. Se rechazan tamaños declarados superiores a 1 MB antes de leer. Entradas internas y externas se validan contra la misma ficha. Límites: 12 catálogos por conjunto y 2000 entradas por catálogo.

El cliente carga contenido al abrir el selector mediante `GET /api/capability-packages/rulesets/catalog?rulesetId=&catalogId=&version=`. La lista instalada solo incluye recuentos. El texto del catálogo no entra automáticamente en el prompt: el GM solo ve lo seleccionado por `gm.sheetSummary`. Los recursos requieren API 1.21; el instalador comprueba también `catalogs` dentro de `ruleset.json` verificado. Un esquema estricto anterior rechazaría el archivo entero. No necesita permisos.

### Capability API 1.22: bloque battle

`battle` puede nombrar salud, MP opcional, reservas de espacios y listas cuyas filas de catálogo se convierten en `CombatSkill`. Al terminar, devuelve valores con las mismas operaciones de ficha que usan los controles del jugador.

```json
{
  "capabilityApi": { "major": 1, "minor": 22 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Es un enlace de datos al combate de Engine, no un adaptador completo de reglas de mesa. El daño sigue siendo integrado; no se leen `attackRoll`, `save`, `concentration` ni `perCostStep`. Las reglas exactas corresponden a otra integración con adaptadores. `coverage.combat` conserva su significado independiente y no lo lee este enlace. El instalador inspecciona `ruleset.json` verificado y rechaza `battle` por debajo de API 1.22, igual que `catalogs` por debajo de 1.21. Sin permisos ni cambios para conjuntos sin ese bloque.

### Capability API 1.23: valores de catálogo escalados

`scaled` permite mantener hasta cuatro columnas numéricas propias de una fila. Usa referencias de valores existentes y una tabla de umbrales opcional, por ejemplo recursos por nivel o usos por atributo, sin nueva aritmética.

```json
{
  "capabilityApi": { "major": 1, "minor": 23 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

Se recalcula al editar, no al leer. Estado de partida, prompt del GM y combate leen el número guardado. Se admiten filas en `ruleset.json` o `catalogs/<id>.json`; el instalador verifica el contenido y rechaza `scaled` por debajo de API 1.23. Sin permisos ni cambios para catálogos no escalados.

`[sheet: op="use" name="..."]` paga `mechanics.cost` y un uso de cada reserva de fila creada por la entrada. No requiere declaración adicional porque usa catálogos ya compatibles.

### Capability API 1.24: reservas de dados

`resolution` puede usar `"kind": "dice-pool"` en lugar de `"dice-sum"`. El valor de ficha determina cuántos dados se tiran; se cuentan resultados que alcanzan el umbral. El conjunto puede definir éxitos dobles, explosiones, cancelaciones, pifias, éxitos excepcionales y límites de ajustes situacionales del GM.

```json
{
  "capabilityApi": { "major": 1, "minor": 24 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Se conserva la ficha: el modificador de suma pasa a indicar cantidad de dados. No se añaden elementos de ficha, espacios de editor ni código del paquete. El instalador rechaza `dice-pool` en `ruleset.json` verificado por debajo de API 1.24; los motores anteriores con solo `dice-sum` rechazarían todo el archivo. Sin permisos ni cambios para conjuntos de sumas.

### Capability API 1.25: capas y orientación del mundo

`layers` ofrece variantes con nombre, elegidas al crear la partida y fijadas en su vínculo. `gm.worldGuidance` se lee una sola vez al generar el mundo para adaptarlo a las reglas del grupo.

```json
{
  "capabilityApi": { "major": 1, "minor": 25 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Los efectos permitidos añaden orientación después de la del conjunto, eliminan valores enumerados, reemplazan dificultades por una escala del mismo tipo de resolución y ocultan entradas de catálogo. No añaden elementos a la ficha; las existentes siguen legibles con cualquier capa. Sin código del paquete ni llamadas adicionales al modelo. Las capas de terceros quedan para más adelante. Ambos campos requieren API 1.25 tras verificar el contenido. Sin permisos ni cambios para conjuntos que no los usan.

### Capability API 1.26–1.27: formato de combate y criaturas

API 1.26 añade `combat` para tiradas, objetivos, economía de acciones, ataques, capacidades, estados, concentración, salud cero, tipos de daño y escala de enemigos. `mechanics` puede describir objetivos, impactos seguros, estados, puntos temporales, escalado según la ficha y consumo de presupuesto.

```json
{
  "capabilityApi": { "major": 1, "minor": 26 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

API 1.27 permite `"holds": "creatures"`. Sus bloques usan `combat`: salud fija o tirada al empezar, defensa, iniciativa, atributos y salvaciones con IDs de ficha, resistencias, debilidades, inmunidades, nivel de amenaza y rasgos para el GM. Las acciones pueden atacar, exigir salvaciones, aplicar estados, limitar usos, recargarse con dados, encadenar acciones con un presupuesto o gastar puntos especiales propios.

```json
{
  "capabilityApi": { "major": 1, "minor": 27 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/beasts.json"] } }
}
```

Estos catálogos no declaran `feeds` ni aparecen en el selector de fichas. Las versiones aportan formato y resolución compartida. El servidor ya puede resolver y guardar combates del conjunto y actualizar las fichas tras cada acción. Aún falta la pantalla de batalla correspondiente; los jugadores siguen usando la interfaz de combate existente. Tras verificar `ruleset.json` y `catalogs/<id>.json` declarados, el instalador rechaza `combat` y nuevas claves `mechanics` por debajo de 1.26, y `holds` y `creature` por debajo de 1.27. Un esquema estricto antiguo rechazaría el archivo. Sin permisos nuevos ni cambios para conjuntos sin esos campos.

### Capability API 1.18: mantener la configuración de Experience en el asistente de Game

Un paquete `game-surface` puede declarar `contributions.gameSurface.setup` con la versión 2 del esquema y Capability API 1.18. Engine conserva sus siete pasos habituales de configuración, incluidos **Party** (Grupo), objetivos, modelos y lorebooks. Solo los juegos nuevos ofrecen Experiences; volver a abrir la configuración de un juego existente conserva su Experience y la configuración del paquete. Los paquetes sin esta declaración mantienen su diálogo de configuración anterior.

```json
{
  "setup": {
    "seed": { "key": "seed", "label": "World seed" },
    "config": { "generate": true, "packWanted": true },
    "requires": { "enableCustomWidgets": false }
  }
}
```

Los tres campos son opcionales. La semilla declarada aparece debajo de la Experience seleccionada con un botón **Randomize** (Elegir al azar). Una entrada vacía o sin un valor numérico finito bloquea **Start** (Iniciar). El host escribe la semilla numérica y las constantes declaradas en `experienceConfig`; `config` no puede contener la clave de la semilla. Las constantes deben serializarse en un máximo de 8 000 caracteres. La etiqueta de la semilla es texto de visualización escrito por el paquete; omítela para usar la etiqueta localizada de Engine.

Un requisito de widgets declarado proporciona el valor predeterminado solo hasta que el jugador cambia ese control. Desactivar la Experience restaura el valor predeterminado habitual, mientras que las decisiones explícitas del jugador se mantienen. El control explica lo que espera la Experience y sigue siendo editable. Los controles de configuración del mapa espacial se ocultan para estas Experiences, por lo que no se inicia ningún borrador, plantilla o editor de mapas aparte.

El paso **Lorebooks** (Libros de trasfondo) permite seleccionar hasta 100 entradas individuales habilitadas, incluidas las de libros no adjuntos. Se respetan los libros y las entradas deshabilitados y las exclusiones del chat. Estos identificadores se envían en `GameSetupConfig.activeLorebookEntryIds`. En `/game/setup` son entradas forzadas adicionales: omiten las tiradas de probabilidad, pero mantienen los límites habituales de tokens. El lore global, vinculado a personajes y adjunto sigue participando en el escaneo normal. Los paquetes pueden leer los mismos identificadores seleccionados desde la configuración para su propia solicitud de generación del mundo.

Importar un archivo de configuración restaura una Experience instalada y compatible y su semilla numérica válida, pero descarta cualquier configuración arbitraria del paquete. El manifiesto actual vuelve a proporcionar las constantes. Los juegos existentes omiten la importación de Experiences con una explicación. Las instantáneas de creación conservan el nombre de la Experience y la semilla para el resumen de configuración.

Usa de forma independiente la declaración existente de disponibilidad de inicio cuando el mundo deba prepararse antes del primer turno. Declara API 1.18 como mínimo del paquete; los hosts anteriores no pueden interpretar esta declaración de configuración.
