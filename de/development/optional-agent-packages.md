# Optionale Agent- und Capability-Pakete

Status: umgesetzt im Entwicklungszyklus für v2.3.0, Issue #3612.

## Ziel

Die Basis-Auslieferung von Marinara Engine darf optionale Agent- und Capability-Implementierungen weder kompilieren noch mitliefern. Eine frische Installation startet ganz ohne optionale Pakete. Bei einem Update bleiben alle Fähigkeiten erhalten, die es schon vor diesem Paketsystem gab.

Der offizielle Katalog, die Paketquellen, reproduzierbare Artefakte, Prüfskripte und der Beitragsprozess liegen in [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Installierte Artefakte landen unterhalb des konfigurierten Marinara-Datenordners, damit ein Update der Anwendung sie nicht überschreiben kann.

## Paketmodell

Ein Agent-Paket kann einen oder mehrere deklarative Agenten beisteuern, dazu optional vertrauenswürdigen, ausführbaren Capability-Code:

- Server-Einstiegspunkte für Routen, Lifecycle-Hooks, Prompt-Provider, Result-Handler und Storage-Migrationen;
- Client-Einstiegspunkte für Panels, Chat-Oberflächen, Einstellungsbereiche, Auswahlpunkte in der Einrichtung, Laufzeitanzeigen und vollständige Game-Mode-Oberflächen;
- gemeinsam genutzte JSON-Schemas und stabile Wire-Contracts;
- paketeigene Assets, Dokumentation und Wissensfragmente für Professor Mari.

Pakete richten sich nach einer versionierten Marinara-Capability-API. Private Quellpfade der Engine dürfen sie nicht importieren.

Client-seitige Capability-Elemente erhalten die in der Engine gewählte UI-Sprache über ihre Attribute `lang` und `dir` sowie über
das Objekt `capabilityProps.localization`. Paketeigene Oberflächen bringen eigene Sprachdateien mit und fallen sonst auf das
Englisch des Pakets zurück; die Engine übersetzt weder Paket-Prompts noch maschinenlesbare Werte aus dem Paket. Ein Sprachwechsel
nutzt weiterhin das bestehende Event `marinara-capability-props` – eine installierte Oberfläche rendert also ohne Neustart der Engine neu.

### Bereitstellung und Caching

Installierte Paketdateien werden mit starken Validatoren ausgeliefert, die aus den SHA-256-Hashes pro Datei im Manifest abgeleitet sind – denselben Werten, mit denen die Engine die Bytes bei jedem Lesen erneut prüft. Das Client-Bundle (`/api/capability-packages/<id>/client`) und jedes Paket-Asset werden immer revalidiert (`no-cache` zusammen mit einem `ETag`). Eine unveränderte Datei antwortet deshalb mit `304 Not Modified`, statt erneut heruntergeladen zu werden, während eine neu veröffentlichte Datei sofort übernommen wird. Nichts wird als `immutable` ausgeliefert: Die Installationsrichtlinie erlaubt, dieselbe Version mit anderen Bytes erneut zu veröffentlichen, daher ist keine Paket-URL inhaltsadressiert.

Capability-API 1.1 ergänzt den Server-Aktivierungskontext um eine generische Runtime-Fassade.
Pakete lesen darüber den effektiven Agent-Debug-Status und schreiben über den Pino-Logger
der Engine, inklusive expliziter Debug-Modus-Überschreibungen – ohne den privaten Logger
oder die Module der Laufzeitkonfiguration zu importieren. Die Fassade stellt Operationen
bereit, nicht die dahinterliegenden Engine-Objekte.

Capability-API 1.2 ergänzt transaktionsgebundene Chat- und Nachrichten-Operationen,
eng begrenzte Schreibzugriffe auf Chat-Metadaten, Existenzprüfungen für Lorebook-Einträge
sowie den Kompatibilitätsspeicher für räumliche Snapshots. Pakete prüfen fachliche
Änderungen damit innerhalb einer Engine-Transaktion und schreiben Metadaten atomar
zusammen mit der zugehörigen Nachricht, einem Swipe oder einem räumlichen Snapshot fest –
ganz ohne Datenbank-Handle oder Tabellenobjekt. Rollback und Kompatibilität mit
historischen Speicherständen bleiben Sache der Engine, Validierung und Fachlogik Sache
der Pakete. Dieselbe API liefert außerdem normalisierte Chat- und Charakterdatensätze,
die Auswahl passender Lorebook-Einträge, das Parsen JSON-ähnlicher Antworten und aufgelöste
Sprachmodell-Aufrufe. Zugangsdaten von Verbindungen, Anbieter-Implementierungen,
Datenbank-Handles und Speicherobjekte bleiben der Engine vorbehalten.

### Capability API 1.7: Chat-Branches

Capability API 1.7 ergänzt `CapabilityChatRecord` um normalisierte Branch-Metadaten:

```ts
branch: {
  title: string | null;
  parentChatId: string | null;
  parentMessageId: string | null;
  childMessageId: string | null;
} | null;
```

`title` ist der getrimmte gespeicherte Branch-Name. Wurzel-Chats geben `null` zurück. Bekannte, von der Engine erstellte Branches nennen den unmittelbaren Eltern-Chat, die Quellnachricht der Abzweigung und die kopierte Kindnachricht. Leere Branches verwenden null-Nachrichtenanker. Alte Branches, fehlerhafte Metadaten und importierte Geschwister aus Gruppen ohne bekannte Beziehung geben null-Abstammungsfelder zurück; die Engine leitet historische Beziehungen nicht nachträglich her. Der generische Export und Import lässt Eltern- und Nachrichten-IDs weg, weil sich IDs zwischen Installationen ändern. Das Löschen des Eltern-Chats lässt die Abstammung des Kindes unverändert.

### Capability API 1.8: Game-Erlebnisse

Capability API 1.8 ergänzt paketbereitgestellte Game-Erlebnisse, Game-Prompt-Kontext pro Runde und Schreibzugriffe auf Ressourcen.

Ein Paket kann einen vollständigen Game Mode anstelle einer Erweiterung des eingebauten Modus bereitstellen. Es deklariert den Slot `game-surface` und wird beim Erstellen eines Spiels im Experiences-Bereich des Einrichtungsassistenten ausgewählt. Die Auswahl wird am Spiel gespeichert und bleibt für dessen gesamte Laufzeit fest, daher wird ein Erlebnis nie mitten in einem Durchlauf ein- oder ausgeschaltet. Die Oberfläche zeichnet ihr eigenes HUD, ihre Menüs und ihren Kampf über der gemeinsamen Erzählung und deklariert, welche eingebauten Systeme sie ersetzt. Alles nicht Deklarierte bleibt eingebaut, sodass ein Erlebnis nur das abschaltet, was es tatsächlich selbst umsetzt. Das optionale `contributions.gameSurface.surfaceClass` benennt eine Klasse, die die Engine während der Einbindung der Oberfläche auf den Spielbereich legt. So kann das Stylesheet des Pakets die gemeinsame, außerhalb des eigenen Elements gerenderte Oberfläche umgestalten.

Pakete mit der Berechtigung `prompt-context` tragen Text zum System-Prompt jeder generierten Game-Runde bei. Ein Paket mit eigenem Live-Zustand kann das Modell dadurch mit der Ansicht des Spielers abgleichen. Ein Beitrag kann auch deklarieren, welche eingebauten Spielsysteme er ersetzt; die Engine weist das Modell dann nicht mehr an, diese zu steuern. Beiträge werden pro Runde gesammelt und sind nie erforderlich: Ein leerer Beitrag wird übersprungen. Löst ein Beitrag einen Fehler aus oder wird er nicht innerhalb seiner Frist fertig, wird dies protokolliert und der Beitrag übersprungen, ohne die Generierung zu beeinflussen.

Die Ressourcen-Fassade bietet neben Lesezugriffen auch Schreibzugriffe. Der Einrichtungsablauf eines Pakets kann dadurch die Spieler-Persona und ihr Lorebook finden oder erstellen. Speicherung, Validierung und Identität bleiben bei der Engine; die fachlichen Inhalte bleiben bei den Paketen.

### Capability API 1.10: Paket-Assets

Capability API 1.10 ergänzt die allgemeine Bereitstellung paketeigener statischer Assets. Ein Manifest kann `contributions.assets.paths` deklarieren – eine Zulassungsliste mit bis zu 256 Bilddateien (`png`/`webp`/`gif`/`jpg`/`jpeg`) und JSON-Dateien aus dem Paket. Die Engine liefert sie unter `/api/capability-packages/<id>/assets/<path>` über dieselbe exakte Prüfkette aus, die bereits Symbole von Browser-Tabs verwenden: Pfadbegrenzung, Hash-Mitgliedschaft in `files[]`, eine passive Inhaltstyp-Zulassungsliste und erneute Integritätsprüfung bei jedem Lesen. Aktive Dokumenttypen (SVG, HTML, Skripte) werden vom Schema abgelehnt. Jeder deklarierte Pfad muss per Hash in `files[]` festgeschrieben sein, und die paketinterne `manifest.json` kann selbst bei Deklaration nie ausgeliefert werden. Für `contributions.assets` ist ein Manifest mit `schemaVersion` 2 und `capabilityApi` 1.10 oder neuer erforderlich – ein v1-Manifest kann es überhaupt nicht deklarieren. Assets werden immer revalidiert: Wie das Client-Bundle tragen sie einen starken Manifest-Hash-`ETag` und beantworten eine unveränderte Revalidierung mit `304 Not Modified` ohne Body. Ein mitgeliefertes Tileset wird somit nur erneut geladen, wenn sich seine Bytes tatsächlich ändern. Antworten sind bewusst nie `immutable`, weil die Installationsrichtlinie eine erneute Veröffentlichung derselben Version mit anderen Bytes zulässt und eine URL mit Versionskennung daher nicht inhaltsadressiert ist. So kann ein `game-surface`-Erlebnis echte Grafik mitbringen, statt sie in sein Client-Bundle einzubetten.

Ein Manifest, das diese Regeln verletzt, wird bei der Installation mit einer der folgenden Meldungen abgelehnt: "A declared package asset must be listed in the package file manifest", "contributions.assets requires schemaVersion 2 and capabilityApi 1.10 or newer", dem Schemafehler zur Erweiterung bei einem Pfad, der weder Bild noch JSON ist, oder – bei Archiven mit Dateinamen, die sich nur in der Groß- und Kleinschreibung unterscheiden und auf entsprechenden Dateisystemen in dieselbe Datei fallen würden – "Package contains duplicate file" / "Package manifest declares files that collide on case-insensitive filesystems".

Jedes Capability-Element erhält dafür eine eigene Identität: `capabilityProps.packageId` und `capabilityProps.packageVersion` kommen zusammen mit `localization`. Ein Bundle baut damit seine Asset-URLs als `/api/capability-packages/<packageId>/assets/<path>` auf, optional mit `?v=<packageVersion>`, damit eine neue Version jeden Zwischenspeicher umgeht. Die Liste installierter Pakete muss dafür weder erneut geladen noch die eigene Import-URL untersucht werden.

### Capability API 1.11: Kampfschnittstelle für Erlebnisse

Capability API 1.11 ergänzt die Capability-Props von `game-surface` um eine Kampfschnittstelle. `combatActive` meldet genau den Zeitpunkt, an dem die eingebaute Kampfoberfläche tatsächlich eingebunden wird. Anders als `chatMeta.gameActiveState`, der narrative Szenenzustand des GM, hängt dieser Wert dem Wechsel nicht hinterher und kann nicht "combat" melden, obwohl noch keine Begegnung existiert. `combatStyle` enthält den wirksamen Stil (`classic` oder `tactical`). `requestCombat()` bittet die Engine, eine Begegnung mit genau demselben Durchlauf wie die manuelle Schaltfläche Start Combat zu erzeugen, nur ohne Bestätigungsdialog, da die eigene Oberfläche des Erlebnisses die Absicht bereits ausgedrückt hat. Der Generierungsdurchlauf der Engine entscheidet weiterhin über die Begegnung. Bewusst nicht vorhanden ist eine Möglichkeit für Pakete, Kämpfer oder Kampfzustand direkt vorzugeben – der Kampf bleibt Eigentum der Engine.

`requestCombat()` besitzt eine stabile Identität, bleibt im Paketpfad still und gibt einen Code zurück, aus dem das Erlebnis seine eigene Rückmeldung erzeugt: `"started"` oder eine Ablehnung – `"combat-active"`, `"pending"` (eine Generierung läuft bereits), `"no-turn"` (der GM hat noch keine Runde geschrieben) oder `"unavailable"` (beendete Sitzung oder Wiederholung). `combatPending` und `combatError` spiegeln Fortschritt und Fehler der Generierung, sodass ein Paket nach einer fehlgeschlagenen Generierung nicht endlos auf `combatActive` wartet. Wie die Schnittstellen 1.7 und 1.8, aber anders als die hart begrenzten `contributions.assets` aus 1.10, werden diese Props an jedes `game-surface`-Paket geliefert, unabhängig von seiner deklarierten `capabilityApi`. Die Kennzeichnung 1.11 nennt nur den Zeitpunkt ihrer Einführung; ein Paket, das sie benötigt, deklariert 1.11 und wird von älteren Engines sauber abgelehnt.

### Capability API 1.12: räumliche Events für das besitzende Erlebnis

Capability API 1.12 adressiert räumliche Capability-Events zusätzlich an das Paket des Erlebnisses, dem das Spiel gehört. `spatial_transition_committed`, `spatial_transition_rejected` und der untypisierte Hinweis `spatial_context_refresh`, die zuvor im Fenster-Event `marinara-capability-server-event` nur an `hierarchical-maps` adressiert waren, werden nun auch mit der auf die `gameExperienceId` des Chats gesetzten `packageId` ausgeliefert. Die Payloads unterscheiden sich: Ein bestätigtes Event enthält `{ chatId, commandId, currentLocationId, definitionRevision, travel? }`; ein abgelehntes Event enthält `{ chatId, commandId, code?, message? }` ohne Ortsfelder, da keine Bewegung stattgefunden hat; der Aktualisierungshinweis enthält `data: null`. Ein Erlebnis, das über das Argument `pendingSpatialTransition` von `sendMessage` einen Reisebefehl gesendet hat, kann seine Reise deshalb bestätigen oder löschen, sobald der Host das Ergebnis kennt, statt es aus späteren Zustandsabfragen abzuleiten. 1.12 schließt außerdem eine Lücke, die World Maps selbst betraf: Übergänge, die über einen der beiden stillen HTTP-Pfade abgelehnt wurden – den Commit vor dem Streaming der Besitzerrunde innerhalb einer Generierung oder den eigenständigen REST-Commit –, erzeugten zuvor gar kein Event. Beide erzeugen nun `spatial_transition_rejected`, und zwar nur bei eindeutigen Belegen, also einem `spatial_*`-Fehlercode außer `already_applied`. Bei nicht eindeutigen Fehlern – etwa einem Netzwerkfehler, bei dem ein erfolgreicher Commit verloren gegangen sein könnte – wird stattdessen der untypisierte Hinweis `spatial_context_refresh` gesendet, damit Listener den Serverzustand abgleichen, statt einem erfundenen Ergebnis zu folgen. Ein bestätigtes Event mit `travel.mode` gleich `"step_by_step"` und `complete: false` bedeutet, dass die Reise weitergeht; behalte den ausstehenden Zustand bis zum abschließenden Event. Dies ist wie 1.11 eine weiche Schnittstelle: Events werden unabhängig von der deklarierten `capabilityApi` geliefert. Deklariere 1.12 nur, wenn dein Paket sie benötigt.

### Capability API 1.13: vorübergehendes Einklappen der Erzählung

Capability API 1.13 ergänzt die Chrome-Deklaration, die ein `game-surface`-Paket an `setExperienceChrome` übergibt, um `requestsCollapsedNarration`. Solange das Flag true ist, klappt das Erzählfeld im Game Mode auf seinen schmalen Griff zusammen. Ein Erlebnis kann den Bildschirm so für eine Zwischensequenz oder einen Vollbildmoment freigeben.

Es handelt sich um eine ANFRAGE, nicht um eine Einstellung. Die eigene Einklapp-Einstellung des Spielers wird nie geschrieben, und das Flag gilt nur, solange dein Erlebnis die aktive Oberfläche ist. Entferne das Flag oder verliere den Status als aktive Oberfläche, und das Feld kehrt zur Auswahl des Spielers zurück. Das ist die Garantie, dass es sich danach immer wieder öffnet; ein Paket kann das Einklappen bewusst nicht dauerhaft speichern.

Die Sicherheitsregeln der Engine haben Vorrang. Das Feld wird zwangsweise ausgeklappt, sobald die Texteingabe des Spielers sichtbar ist, auch ganz am Anfang einer Szene vor dem ersten Segment, und sobald die Steuerelemente zum Fortsetzen eines Segments aktiv sind. Diese Steuerelemente sind der einzige Weg, eine Runde zu beenden; könnte ein Paket sie verbergen, könnte es den Spieler dauerhaft festsetzen. Der Griff zeigt außerdem weiterhin seinen Aufmerksamkeitsindikator, wenn eine Szenenanalyse, Generierung oder Wiederholung der Kampf-Generierung aussteht. Klappt ein Spieler das Feld während einer Anfrage von Hand aus, bleibt es offen, bis die Anfrage endet. Wie die Schnittstellen 1.11 und 1.12 ist dies eine weiche Schnittstelle: Das Feld wird unabhängig von der deklarierten `capabilityApi` beachtet. Die Kennzeichnung 1.13 nennt nur den Zeitpunkt seiner Einführung, daher deklariert ein Paket, das es benötigt, 1.13.

### Capability API 1.17: eine Experience vor ihrem ersten Zug vorbereiten

Ein `game-surface`-Paket kann mit Schemaversion 2 und Capability API 1.17 `contributions.gameSurface.prepareBeforeStart: true` deklarieren. Die Engine bindet diese Oberfläche ein, sobald das Spiel bereit ist, bevor **Start Game** (Spiel starten) aktiviert wird. Klassische Spiele und Pakete ohne dieses Flag behalten ihren bisherigen Startablauf.

Die Hauptoberfläche, die diese Option nutzt, erhält zwei zusätzliche Props:

- `startup: boolean` bleibt true, bis der Spieler die Engine-Einführung mit **Continue** (Weiter) abschließt. Pausiere währenddessen Weltsimulation und Spieleraktionen.
- `setStartupReady(context: string | null): void` meldet den Vorbereitungszustand. Sende beim Laden, Speichern oder Beheben eines Fehlers `null`. Sende erst dann eine Zeichenfolge, wenn die tatsächliche Welt dauerhaft gespeichert und nutzbar ist; eine leere Zeichenfolge erlaubt den Start ohne zusätzlichen Kontext.

Der Host blockiert **Start Game**, die Bestätigung der Widget-Vorbereitung und erneute Versuche des ersten Zugs, bis eine Bereitschaftszeichenfolge eintrifft. Solange die Sperre besteht, bleiben die paketeigenen Lade-, Fehler- und Wiederholungsanzeigen sichtbar. Sobald das Paket bereit ist, wird es hinter der normalen Engine-Einführung verborgen. **Continue** öffnet die gewöhnliche Oberfläche, die dabei erneut eingebunden werden kann: Gestalte die Weltvorbereitung idempotent und stelle gespeicherten Zustand wieder her, statt ihn erneut zu generieren. Bei der Rückkehr zu einem Spiel mit bereits abgeschlossener Einführung wird die Startvorbereitung nicht wiederholt.

Der Eröffnungskontext ist auf **8.000 Zeichen** begrenzt. Ungültiger oder zu langer Kontext hält den Start gesperrt und zeigt einen Fehler an; der Host schneidet keine Weltfakten ab. Liefere eine kompakte Beschreibung des vorbereiteten Startorts und seiner tatsächlich vorhandenen Charaktere. Die Engine hängt diesen Text mit der Quelle `game_start` an den bestehenden `generationGuide` des ersten Zugs an, damit die Eröffnung die vorhandene Welt verwendet. Dadurch wird kein Kontext für spätere Züge registriert; nutze dafür weiterhin den normalen Prompt-Beitrag des Pakets oder seinen Kontext zur Zuggenerierung.

Bereitschafts-Callbacks gehören zum eingebundenen Chat, Spiel und Paket. Verspätete Callbacks aus einem anderen Geltungsbereich werden ignoriert. Ein Modul- oder Laufzeitfehler blockiert den Start, statt fehlenden Weltkontext als Erfolg zu behandeln. Nach dem Neuladen muss das Paket seine Bereitschaft anhand der gespeicherten Welt melden. Der serverseitige Anbieter von Prompt-Kontext bleibt schreibgeschützt und an seine kurze Frist gebunden; verwende ihn weder zur Weltgenerierung noch als lang andauernde Startsperre.

### Capability API 1.19: Tools aus Paketen

Mit Capability API 1.16 konnte ein Paket das Modell etwas _sagen_ lassen, worauf es reagieren konnte. Diese Version lässt das Modell etwas _aufrufen_. Ein Paket mit der neuen Berechtigung `tools` registriert in seinem Server-Einstiegspunkt ein benanntes Tool. Die Engine bietet es neben den eingebauten Tools in jedem Zug jedes Chats an, prüft den Aufruf anhand des JSON Schema des Pakets und übergibt die Argumente an dessen Handler.

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

Tool-Aufrufe sind hier bewusst einem Antwortformat vorgezogen. Ein Antwortformat beansprucht die gesamte Antwort: Die Erzählung müsste als Feld in einem JSON-Objekt stehen und könnte nicht streamen. Ein Tool-Aufruf kann neben dem Fließtext eintreffen, während das Modell seinen Zug schreibt. Das Paket erhält Argumente, die schon der Anbieter eingeschränkt hat, statt sie aus der fertigen Erzählung herauszulesen. Ein Schema ist verbindlicher als eine Konvention, um deren Einhaltung das Modell gebeten wird.

Enums machen diesen Unterschied greifbar. Kennt ein Paket zwölf Orte, kann es deren Namen im Schema aufzählen. Ein dreizehnter Name wird abgelehnt, bevor der Handler ihn erhält. Die vorhandene Argumentprüfung der Engine nennt dabei gültige Werte, damit das Modell den Aufruf korrigieren kann. Der Rückgabewert des Handlers wird dem Modell als Tool-Ergebnis gezeigt.

Beachte beim Schreiben eines Tools diese Regeln:

- Namen erhalten das Präfix `<packageId>_<name>`; `-` wird zu `_`. Das Tool `set_time` aus `world-clock` heißt beim Modell also `world_clock_set_time`. Ein bereits von einem anderen Paket belegter Name wird abgelehnt. Eingebaute und aktivierte eigene Tools behalten gleichnamige Aufrufe; die Paketdefinition entfällt. Der vollständige Name darf höchstens **64 Zeichen** lang sein. Sowohl bei den Definitionen als auch bei der Ausführung gilt: eingebautes Tool, eigenes Tool, Paket-Tool.
- Die Tools eines aktiven Pakets werden immer angehängt. Anders als bei eingebauten Tools gibt es keinen weiteren Schalter pro Chat: Berechtigung und Registrierung sind die Entscheidung. Der gewählte Anbieter muss native Tool-Aufrufe unterstützen.
- Das Parameterschema wird bei der Registrierung kopiert und kompiliert. Kann die Engine es nicht kompilieren, schlägt die Aktivierung fehl, sichtbar für die Entwicklung, statt erst während eines Zuges.
- Wirft ein Handler einen Fehler, wird der Aufruf als fehlgeschlagen gemeldet und protokolliert; seine Fehlermeldung wird nicht weitergegeben. Nach **10 Sekunden** endet auch das Warten auf einen noch laufenden Handler. Er läuft weiter, hält den Zug aber nicht länger auf.
- Ergebnisse müssen sich in höchstens **64 KiB** serialisieren lassen. Größere oder nicht serialisierbare Ergebnisse lassen den Aufruf scheitern, statt den Gesprächskontext zu verdrängen. Beschreibungen und Ergebnisse gelten als vertrauenswürdiger Paketinhalt. Prüfe `chatId`, bevor dein Paket chatspezifische Daten liest oder verändert.
- Jede Definition wird bei jedem Zug an den Anbieter gesendet und bei der Kontextplanung mitgezählt. Deshalb gelten Grenzen: **16 Tools pro Paket**, **64 über alle Pakete**, **512 Zeichen** für die Beschreibung und **8 KiB** für das Parameterschema. Eine Überschreitung wirft einen Fehler und verhindert die Aktivierung. Eine erneute Registrierung eines eigenen Namens ersetzt das Tool, ohne einen weiteren Platz zu belegen.
- Nach dem Ende einer Aktivierung funktioniert deren Kontext nicht mehr. Ein gespeichertes `api`, das später aus einem Callback `registerTool` aufruft, wird abgewiesen. Eine beendete Laufzeit kann weder neue Tools registrieren noch die einer neuen Aktivierung ersetzen.
- Deaktivieren, Aktualisieren oder Entfernen eines Pakets gibt seine Tools frei. Das Modell erhält keine Tools, deren Paket nicht mehr antworten kann. Die Tools werden vor dem Warten auf die Bereinigung entfernt; jeder Bereinigungs-Callback hat ein Zeitlimit von 8 Sekunden.

Diese Zeitlimits begrenzen nur asynchrones Warten. Pakete laufen als vertrauenswürdiger Code im Serverprozess; synchrone Arbeit, die die Ereignisschleife blockiert, lässt sich nicht durch einen Timer unterbrechen. Ein erzwungener Abbruch würde einen separaten Worker oder Prozess erfordern, den diese API nicht bereitstellt.

`api.registerTool` gibt es erst ab dieser Engine-Version. Ein Paket, das es benötigt, muss `capabilityApi` 1.19 deklarieren und lässt sich auf älteren Versionen nicht installieren.

## Erste Pakete

- alle bisher fest eingebauten Agenten;
- hierarchische räumliche Karten für Roleplay und Game;
- Audio- und Videoanrufe in Conversation;
- UNO;
- Chess;
- Poker;
- 8-Ball Pool;
- Tic-Tac-Toe;
- Rock-Paper-Scissors.

In der Basis bleiben nur der Paketmanager, der Katalog-Client, die generischen Verträge für die Agent-Pipeline, die generischen Verträge für Turn-Game-Hosts und die inerten Host-Schnittstellen. Die konkreten Implementierungen gehören in die Pakete.

## Vertrauen und Installation

Der offizielle Katalog ist ein schemavalidiertes, versioniertes JSON-Dokument und wird über HTTPS geladen. Jeder Release-Eintrag nennt unveränderliche Artefakt-URLs, SHA-256-Prüfsummen, Dateigrößen in Byte, die Engine-Kompatibilität, die Berechtigungen und ob die Laufzeit einen Neustart braucht.

Vom Paket deklarierte Modellbefehle laufen nur, wenn das Paket `chat-write` deklariert sowie installiert und bereit ist. Diese Berechtigung schützt auch Schreibzugriffe über die Persistenz-API des Pakets, einschließlich Nachrichten, Chat-Metadaten, Roleplay-Ereignissen und räumlichen Snapshots. `chat-read` schützt Lesezugriffe auf Chats, Nachrichten, Spielzustände und räumliche Snapshots. Dieselben Prüfungen gelten innerhalb von Persistenztransaktionen und Chat-Sperren; eine Schreibberechtigung gewährt nicht automatisch Leserechte. Engine-eigene Persistenzaufrufe bleiben vertrauenswürdig.

Die Detailansicht von **Download Agents** (Agenten herunterladen) zeigt nach der Installation die deklarierten Berechtigungen der installierten Version. Fordert die Katalogversion andere Berechtigungen an, werden diese getrennt angezeigt. Installation oder Aktualisierung von Code erfordern weiterhin die bestehende Zustimmung, die an genau diese Version und Prüfsumme gebunden ist; Modellbefehle fragen nicht in jedem Zug erneut nach Zustimmung.

Das sind API-Prüfungen, keine JavaScript-Sandbox. Netzwerk-, Speicher- und UI-Berechtigungen sind Zugriffsdeklarationen. Browser- und Servercode eines Pakets bleibt vertrauenswürdiger Code und kann auf seine Hostumgebung zugreifen; installiere nur Pakete, denen du vertraust. Geprüft wird die Bereitschaft statt der Auslieferbarkeit. Hinterlässt ein Update ein Paket im Zustand `restart-required`, werden seine Befehle bis zum Neustart der Engine nicht mehr aufgelöst.

Beim Serverstart lädt der Host den Katalog genau einmal, sofern mindestens ein offizielles Paket installiert ist. Er wählt nur neuere Versionen aus, die zur laufenden Engine und zur Capability-API passen, prüft sie über die normale Installationsstrecke und installiert sie, bevor die Paket-Laufzeiten aktiv werden. Fehler bleiben auf das jeweilige Paket beschränkt. Ist der Katalog offline oder schlägt eine Prüfung fehl, bleiben vorhandene Dateien und der Registry-Stand nutzbar; scheitert die Bereitschaft einer Server-Laufzeit, greift der Rollback auf die Vorgängerversion.

Der Installer muss:

1. privilegierten Loopback-/Admin-Zugriff verlangen;
2. HTTPS, Download-Grenzen und Zeitlimits durchsetzen;
3. vor dem Entpacken das Katalogvertrauen und die SHA-256-Prüfsumme des Artefakts verifizieren;
4. absolute Pfade, Traversal, Links, Gerätedateien und nicht deklarierte Dateien ablehnen;
5. das Manifest und die Engine-Kompatibilität validieren;
6. in einen temporären Nachbarordner entpacken;
7. erst nach erfolgreicher Validierung atomar aktivieren;
8. die Vorgängerversion behalten, bis die neue Laufzeit sauber startet;
9. die Aktivierung im Fehlerfall zurückrollen;
10. niemals Install-, Update- oder Uninstall-Skripte ausführen.

Der offizielle Katalog aktiviert ausschließlich vertrauenswürdige, ausführbare Pakete aus erster Hand. Ein späterer Weg für Drittanbieter braucht ein eigenes, ausdrückliches Vertrauenskonzept.

## Laufzeit- und Neustartverhalten

Der Server verwaltet die Registry der installierten Pakete und stellt den Clients die installierten Fähigkeiten bereit. Deklarative und nachladbare Module werden sofort aktiv. Nach der Aktivierung verwirft die Oberfläche die Abfragen zu Katalog, Agenten, Modus-Fähigkeiten und aktivem Chat.

`restartRequired` darf im Manifest nur stehen, wenn der Host diesen Einstiegspunkt nicht gefahrlos neu laden kann. Nach erfolgreicher Aktivierung im laufenden Betrieb meldet Marinara `Agent installed. It is ready to use.` Ist ein Neustart nötig, lautet die Meldung `Agent installed. Restart Marinara Engine to finish setup.`

Turn-Game-Pakete lassen sich im laufenden Betrieb neu laden: Die Installation registriert Server-Engine und manuellen Slash-Befehl sofort, die Deinstallation löst die Laufzeit ohne Neustart der Engine wieder ab. Die Einstellung **Conversation Commands** (Chat-Befehle) je Chat regelt nur, ob Charaktere den versteckten Befehl des Pakets auslösen dürfen – den eigenen Slash-Befehl schränkt sie nicht ein. Die aktuellen offiziellen Turn-Game-Manifeste tragen aus Vorsicht weiterhin die alte Neustart-Markierung, damit sie mit Engine 2.x kompatibel bleiben; Engine 3.x erkennt die Art `turn-game`, aktiviert sicher im laufenden Betrieb und meldet das Paket als aktiv und einsatzbereit.

## Kompatibilitäts-Migration

Beim ersten Start nach dem Update gilt:

- eigene Agenten bleiben unangetastet;
- jeder alte, fest eingebaute Agent, den diese Installation kennt, wird als installiert vermerkt;
- Karten, Conversation-Anrufe und Conversation-Spiele bleiben genauso verfügbar wie zuvor;
- vorhandene Chat-Konfiguration, Snapshots, Spielzustand, Anrufverlauf und Agent-Gedächtnis bleiben erhalten;
- die Migration ist wiederholbar und vermerkt ihren Abschluss erst, wenn alle alten Verfügbarkeitseinträge dauerhaft gespeichert sind.

Die alten Paket-Artefakte bleiben als Migrationsquelle im offiziellen Katalog verfügbar. Frische Installationen zeigen und aktivieren sie erst, wenn du sie selbst installierst.

## Deinstallation

Beim Deinstallieren entfernt Marinara das Paket aus der Auswahl aktiver Chats, löscht seine Agent-Konfiguration und die heruntergeladenen ausführbaren Dateien und löst seine Laufzeit bei Bedarf mit dem nächsten Neustart ab. Bisherige Chats, Nachrichten, Karten-Snapshots, Anrufzusammenfassungen und abgeschlossene Spielstände bleiben lesbar – das Entfernen eines Pakets kann deine Arbeit also nicht zerstören. Fachdaten aus der Historie endgültig zu löschen, ist ein separater, ausdrücklicher Schritt.

Jede Deinstallation muss bestätigt werden. Betroffene Chats fallen auf ihre gewöhnlichen Basis-Oberflächen zurück, ohne dass der Verlauf Schaden nimmt.

## Katalog-Oberfläche

Im **Agents**-Panel gibt es die Schaltfläche `Download Agents`, passend zum `Download Cards` im **Card Browser** (Kartenbrowser). Sie öffnet eine bildschirmfüllende, responsive Bibliothek mit Suche, Paketarten, Kompatibilitätsangaben, Installations- und Update-Status, Berechtigungen, Speicherbedarf, Dokumentation und Schaltflächen zum Deinstallieren.

Am Desktop steht neben der Übersichtsliste ein Detailbereich. Auf dem Handy gibt es nur ein Panel, dafür eine ausdrückliche Zurück-Navigation und fingerfreundliche Aktionen. Leere, offline, inkompatibel, beschädigter Download, abgebrochene Installation, Update, Rollback und „Neustart nötig“ sind vollwertige Zustände der Oberfläche.

## Kriterium für eine abgeschlossene Auslagerung

Eine Auslagerung gilt erst dann als abgeschlossen, wenn die produktiven Basis-Bundles von Client und Server die Paket-Implementierung nicht mehr enthalten, eine frische Installation sie ohne Download des Pakets nicht aktivieren kann, eine aktualisierte Installation sie behält und Installation, Update und Deinstallation des Pakets am Desktop, auf dem Handy und auf Termux-kompatiblen Dateisystemen durchlaufen.

### Capability API 1.20: Game Mode-Regelsätze

Ein Regelsatz liefert validierte Daten: eine von der Engine unterstützte Probenauflösung, einen Bogen aus fest definierten Bausteinen, Rasten und GM-Hinweise. Die reservierte Datei `ruleset.json` wird wie `gm-verbs.json` über `contributions.assets.paths` erkannt und in `files[]` mit Hash erfasst.

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

Das Beispiel zeigt nur regelsatzrelevante Felder; `name`, `version`, `description`, `engine` und `builtAgainst` bleiben Pflicht. Berechtigungen, Agenten und Client- oder Server-Einstiegspunkte sind nicht nötig. Der Typ `ruleset` und `ruleset.json` setzen einander voraus. Die Datei führt weder Code noch Ausdruckszeichenfolgen aus; neue Auflösungsmechaniken brauchen Engine-Änderungen. Format und 5e-Beispiel stehen in [`game-rulesets-and-sheets-implementation.md`](game-rulesets-and-sheets-implementation.md).

Das ist eine feste Kompatibilitätsgrenze: Der Manifest-Eintrag verlangt API 1.20; ältere Engines verweigern die Installation. Die Engine lehnt deklarierte Größen über 256 KB vor dem Lesen ab, prüft den Installationshash erneut und validiert gegen `packages/shared/src/schemas/ruleset.schema.ts`. Ungültige Dateien werden mit einem Logeintrag zu Paket und ersten `path: message`-Fehlern übersprungen. Bei doppelten IDs gewinnt das erste Paket in der Reihenfolge der Paket-IDs; das andere wird mit einem Logeintrag übersprungen. `engine-legacy` und `traditional` sind reserviert.

Das Spiel speichert die Auswahl einmal in `chat.metadata.gameRuleset`. Ohne Bindung gelten die bisherigen Regeln. Fehlende oder ältere Definitionen machen den Regelsatz nicht verfügbar, ohne ihn zu ersetzen. Die Bindung prüft Regelsatz-ID und Anbieterpaket, sodass ein anderes Paket das Spiel nicht durch eine gleiche ID übernehmen kann.

### Capability API 1.21: Regelsatzkataloge

Kataloge liefern fertige Zauber, Klassenfähigkeiten und Ausrüstung für die Bogenauswahl. Der Kopf steht in `ruleset.json` unter `catalogs`; Einträge stehen inline oder in einer reservierten Datei:

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

`catalogs/<id>.json` muss zur Katalog-ID passen und darf nicht auf einen fremden Katalog zeigen. Die Datei braucht einen Hash in `files[]` und das deklarierende `ruleset.json`. Deklarierte Größen über 1 MB werden vor dem Lesen abgelehnt. Inline- und Dateieinträge werden gegen denselben Bogen geprüft. Grenzen: 12 Kataloge je Regelsatz, 2000 Einträge je Katalog.

Der Client lädt Inhalte erst beim Öffnen der Auswahl über `GET /api/capability-packages/rulesets/catalog?rulesetId=&catalogId=&version=`. Die installierte Liste enthält nur Anzahlen. Katalogtext wird nicht automatisch in Prompts eingefügt; der GM sieht nur die von `gm.sheetSummary` gewählten Angaben. Katalogdateien verlangen API 1.21. Der Installer prüft auch `catalogs` im hashgeprüften `ruleset.json`; ein älteres striktes Schema würde die ganze Datei ablehnen. Keine Berechtigungen nötig.

### Capability API 1.22: battle-Block

Der optionale Block `battle` benennt Gesundheit, optional MP, Zauberplatzpools und Listen, deren Katalogzeilen zu `CombatSkill` werden. Nach dem Kampf werden Werte mit denselben Bogenoperationen zurückgeschrieben wie bei Spieleraktionen.

```json
{
  "capabilityApi": { "major": 1, "minor": 22 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Das verbindet Daten mit dem Engine-Kampf und ist kein vollständiger Tischrollenspieladapter. Die eingebaute Schadensberechnung liest weder `attackRoll`, `save`, `concentration` noch `perCostStep`. Systemgetreue Kämpfe gehören zur getrennten Adapteranbindung. `coverage.combat` bleibt unabhängig und wird von dieser Verbindung nicht gelesen. Der Installer prüft hashgeprüftes `ruleset.json` und lehnt `battle` unter API 1.22 ab, wie `catalogs` unter 1.21. Ohne Berechtigungen; Regelsätze ohne Block bleiben unverändert.

### Capability API 1.23: skalierte Katalogwerte

`scaled` ordnet einer Katalogzeile bis zu vier eigene Zahlenspalten zu, die der Regelsatz verwaltet. Jede verwendet eine vorhandene Wertreferenz und optional eine Stufentabelle, etwa für stufenabhängige Ressourcen oder attributabhängige Nutzungen, ohne neue Rechenoperationen.

```json
{
  "capabilityApi": { "major": 1, "minor": 23 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

Die Berechnung geschieht beim Bearbeiten, nicht beim Lesen. Spielzustand, GM-Prompt und Kampf lesen die gespeicherte Zahl. Inline-Zeilen und `catalogs/<id>.json` werden als Manifest-Dateien anhand ihres geprüften Inhalts kontrolliert; `scaled` verlangt API 1.23. Keine neuen Berechtigungen oder Änderungen an unskalierten Katalogen.

Zusätzlich bezahlt `[sheet: op="use" name="..."]` die `mechanics.cost` eines Eintrags und eine Nutzung jedes von ihm angelegten Zeilenpools. Der Befehl braucht keine neue Deklaration, da er vorhandene Kataloge nutzt.

### Capability API 1.24: Würfelpools

`resolution` kann `"kind": "dice-pool"` statt `"dice-sum"` angeben. Der Bogenwert zählt Würfel; Ergebnisse ab der Schwelle zählen als Erfolge. Der Regelsatz kann doppelte Erfolge, Explosionen, gestrichene Erfolge, Patzer, außergewöhnliche Erfolge und Grenzen für situative Pooländerungen des GM festlegen.

```json
{
  "capabilityApi": { "major": 1, "minor": 24 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Der Bogen bleibt gleich: Der bisherige Summenmodifikator wird zur Würfelanzahl. Keine neuen Bogentypen, Editor-Slots oder Paketcodes. Der Installer lehnt `dice-pool` in geprüftem `ruleset.json` unter API 1.24 ab; ältere Engines mit nur `dice-sum` würden die ganze Datei ablehnen. Keine Berechtigungen oder Änderungen für Summenregelsätze.

### Capability API 1.25: Ebenen und Welthinweise

Optionale `layers` sind benannte Varianten, die bei Spielbeginn ausgewählt und dauerhaft in der Bindung gespeichert werden. `gm.worldGuidance` wird einmal bei der Welterstellung gelesen, damit die Welt zu den Gruppenregeln passt.

```json
{
  "capabilityApi": { "major": 1, "minor": 25 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Die geschlossene Effektmenge kann Hinweise nach den Regelsatzhinweisen ergänzen, Enum-Werte entfernen, die Schwierigkeitsskala durch eine zum selben Auflösungstyp passende ersetzen und Katalogeinträge ausblenden. Neue Bogenelemente sind nicht erlaubt; vorhandene Bögen bleiben mit jeder Ebenenauswahl lesbar. Kein Paketcode, kein zusätzlicher Modellaufruf. Fremde Ebenen sind für später vorgesehen. Beide Felder verlangen nach Inhaltsprüfung API 1.25. Keine Berechtigungen oder Änderungen für Regelsätze ohne diese Felder.

### Capability API 1.26–1.27: Kampfformat und Kreaturenkataloge

API 1.26 ergänzt `combat` für Würfe, Ziele, Aktionsbudget, Angriffs- und Fähigkeitslisten, Zustände, Konzentration, Verhalten bei null Gesundheit, Schadenstypen und Gegnerstufen. Katalog-`mechanics` kann Ziele, sichere Treffer, Zustände, temporäre Punkte, Bogenskalierung und Budgetverbrauch beschreiben.

```json
{
  "capabilityApi": { "major": 1, "minor": 26 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

API 1.27 erlaubt `"holds": "creatures"`. Kreaturenwerte verwenden `combat`: feste oder zu Kampfbeginn gewürfelte Gesundheit, Verteidigung, Initiative, Attribute und Rettungswürfe mit Bogen-IDs, Resistenzen, Schwächen, Immunitäten, Gefahrenstufe und GM-Merkmale. Aktionen können treffen, Rettungswürfe verlangen, Zustände anwenden, begrenzte Nutzungen haben, sich durch Würfe aufladen, mehrere Aktionen mit einem Budget ausführen oder eigene Spezialpunkte verbrauchen.

```json
{
  "capabilityApi": { "major": 1, "minor": 27 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/beasts.json"] } }
}
```

Ein Kreaturenkatalog deklariert kein `feeds` und erscheint nicht in der Blattauswahl. Bei eingeschaltetem Kampfdirektor verwendet ein Spiel mit `combat` diese Regeln und das Bestiarium auf dem Kampfbildschirm; nach jeder Aktion werden die Blätter gespeichert. Das ist der Stil `ruleset`, ohne zusätzliche Capability-API-Stufe. Ohne `combat` gelten weiterhin der `battle`-Block oder die Wahl Classic/Tactical. Die Installation prüft die verifizierten Dateien `ruleset.json` und `catalogs/<id>.json`: `combat` und die neuen `mechanics`-Schlüssel erfordern 1.26, `holds` und `creature` 1.27. Ein älteres strenges Schema würde die Datei ablehnen. Keine neuen Berechtigungen; Regelwerke ohne diese Felder bleiben unverändert.

### Capability API 1.18: Experience-Einrichtung im Game-Assistenten

Ein `game-surface`-Paket kann mit Schemaversion 2 und Capability API 1.18 `contributions.gameSurface.setup` deklarieren. Die Engine behält ihre üblichen sieben Einrichtungsschritte bei, einschließlich **Party** (Gruppe), Zielen, Modellen und Lorebooks. Experiences werden nur für neue Spiele angeboten; beim erneuten Öffnen der Einrichtung eines bestehenden Spiels bleiben dessen Experience und Paketkonfiguration erhalten. Pakete ohne diese Deklaration behalten ihren bisherigen Einrichtungsdialog.

```json
{
  "setup": {
    "seed": { "key": "seed", "label": "World seed" },
    "config": { "generate": true, "packWanted": true },
    "requires": { "enableCustomWidgets": false }
  }
}
```

Alle drei Felder sind optional. Der deklarierte Seed erscheint unter der gewählten Experience mit der Schaltfläche **Randomize** (Zufällig wählen). Eine leere Eingabe oder eine Eingabe ohne endlichen Zahlenwert blockiert **Start** (Starten). Der Host schreibt den numerischen Seed und die deklarierten Konstanten in `experienceConfig`; `config` darf den Seed-Schlüssel nicht enthalten. Die Konstanten dürfen serialisiert höchstens 8.000 Zeichen umfassen. Eine Seed-Beschriftung ist vom Paket verfasster Anzeigetext; lass sie weg, um die lokalisierte Engine-Beschriftung zu verwenden.

Eine deklarierte Widget-Anforderung liefert den Standardwert nur, bis der Spieler dieses Steuerelement ändert. Wird die Experience ausgeschaltet, kehrt der gewöhnliche Standardwert zurück, während ausdrückliche Spielerentscheidungen unverändert bleiben. Das Steuerelement erläutert die Erwartung der Experience und bleibt bearbeitbar. Die Einrichtungselemente für räumliche Karten sind für diese Experiences ausgeblendet, sodass kein separater Kartenentwurf, keine Vorlage und kein Kartenersteller gestartet wird.

Im Schritt **Lorebooks** (Lorebooks) lassen sich bis zu 100 einzelne aktivierte Einträge auswählen, auch aus nicht angehängten Büchern. Deaktivierte Bücher, Einträge und Chat-Ausschlüsse werden berücksichtigt. Diese IDs werden in `GameSetupConfig.activeLorebookEntryIds` übergeben. Bei `/game/setup` sind sie zusätzliche erzwungene Einträge: Sie überspringen Wahrscheinlichkeitswürfe, behalten aber die üblichen Token-Limits. Globale, charaktergebundene und angehängte Lore nimmt weiterhin am gewöhnlichen Scan teil. Pakete können dieselben ausgewählten IDs aus der Einrichtungskonfiguration für ihre eigene Weltgenerierungsanfrage lesen.

Der Import einer Einrichtungsdatei stellt eine installierte kompatible Experience und ihren gültigen numerischen Seed wieder her, verwirft aber beliebige Paketkonfiguration. Das aktuelle Manifest liefert die Konstanten erneut. Bestehende Spiele überspringen Experience-Importe mit einer Erklärung. Erstellungssnapshots behalten Experience-Name und Seed für die Einrichtungsübersicht.

Nutze die bestehende Startbereitschaftsdeklaration unabhängig davon, wenn die Welt vor dem ersten Zug vorbereitet werden muss. Deklariere API 1.18 als Mindestversion des Pakets; ältere Hosts können diese Einrichtungsdeklaration nicht interpretieren.
