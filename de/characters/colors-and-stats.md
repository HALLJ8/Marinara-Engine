# Charakterfarben und RPG-Werte

In dieser Anleitung erfährst du, wie der Tab **Colors** (Farben) und der Tab **Stats** (Werte) in Marinara Engine funktionieren. Beide Tabs gibt es im Charakter-Editor und im Persona-Editor. Über die Farben legst du fest, wie ein Charakter oder die Persona im Chat aussieht. Über die Werte richtest du mitgeführte Größen wie Gesundheit oder Hunger ein.

## Der Tab **Colors**

Jeder Charakter und jede Persona hat im Editor einen Tab **Colors**. Dort stellst du drei Farben ein: die Namensfarbe, die Dialogfarbe und die Farbe der Nachrichtenbox. Bleibt ein Feld leer, gilt für diesen Teil die Standardfarbe des App-Themes.

So öffnest du den Tab **Colors**:

1. Öffne einen Charakter im Charakter-Editor oder eine Persona im Persona-Editor.
2. Klick in der Tab-Leiste auf den Tab **Colors**.
3. Jetzt siehst du eine Live-Karte **Preview** (Vorschau) und darunter drei Farbfelder.

Die **Preview**-Karte zeigt einen Beispielnamen und eine Beispiel-Sprechblase. Sie aktualisiert sich bei jeder Farbänderung – so siehst du das Ergebnis schon vor dem Speichern.

### Extract Colors from Avatar

Die Schaltfläche **Extract Colors from Avatar** (Farben aus dem Avatar übernehmen) wählt Namensfarbe, Dialogfarbe und Farbe der Nachrichtenbox automatisch aus dem Avatarbild. Aktiv ist die Schaltfläche erst, sobald ein Avatar vorhanden ist. Vorher bleibt sie deaktiviert und trägt die Beschriftung **Upload an avatar first**. Auch nach der Übernahme lässt sich jede der drei Farben von Hand ändern.

### Die drei Farben

Stell jede Farbe über das Farbfeld ein oder tippe einen Wert ein:

- **Name Display Color** (Namensfarbe): die Farbe des Namens. Dieses Feld akzeptiert auch einen CSS-Verlauf. Ein Verlauf ist ein weicher Übergang zwischen Farben. Beispielwert: `linear-gradient(90deg, #f59e0b, #ef4444)`.
- **Dialogue Highlight Color** (Hervorhebung für Dialoge): die Farbe für Text innerhalb von Dialog-Anführungszeichen. Beispielwert: `#ffd700`.
- **Message Box Color** (Farbe der Nachrichtenbox): die Hintergrundfarbe der Sprechblase im Chat. Am besten wirkt eine halbtransparente Farbe. Beispielwert: `rgba(0, 0, 0, 0.5)`.

Eine halbtransparente Farbe lässt den Hintergrund teilweise durch die Sprechblase scheinen. Das Format `rgba` steht für Rot, Grün, Blau und einen Alpha-Wert von 0 (durchsichtig) bis 1 (deckend).

## Wo die Farben auftauchen

Jede Farbe wirkt an einer anderen Stelle im Chat:

- Die Namensfarbe färbt den angezeigten Namen in den Chat-Nachrichten. Bei einem Charakter färbt sie zusätzlich den Namen in den Tabs der Seitenleiste. Bei einer Persona färbt sie zusätzlich den Namen in den Persona-Auswahllisten.
- Die Dialogfarbe färbt Text innerhalb von Dialog-Anführungszeichen. Das klappt mit geraden Anführungszeichen ebenso wie mit anderen Anführungsstilen. Unter **Settings** (Einstellungen) lässt sich dieser Text zusätzlich fett darstellen.
- Die Farbe der Nachrichtenbox bestimmt den Hintergrund der Sprechblasen dieses Charakters bzw. dieser Persona. Sie gilt in Conversation- und in Roleplay-Chats.

## Der Tab **Stats**

Jeder Charakter und jede Persona hat außerdem einen Tab **Stats**. Werte sind Zahlen wie HP (Lebenspunkte), STR (Stärke) oder eine Hungeranzeige. Sind die Werte aktiviert, schreibt die App sie in den Prompt – also in den Text, den Marinara an die KI schickt –, damit die KI den aktuellen Stand kennt. Was du hier einträgst, sind die Startwerte für neue Chats. Während des Spiels ändern Agenten sie dann. Mehr dazu im Abschnitt zu den Agenten weiter unten.

Der Tab **Stats** beim Charakter und der Tab **Stats** bei der Persona sind unterschiedlich aufgebaut. Deshalb beschreibt der folgende Text beide einzeln.

### Charakterwerte: Enable RPG Stats

Beim Charakter gibt es einen einzigen Schalter: **Enable RPG Stats** (RPG-Werte aktivieren). Steht er auf aus, wird darunter nichts angezeigt und nichts gesendet. Steht er auf an, erscheinen zwei Bereiche:

- **Pools**: benannte Balken mit aktuellem Wert, Maximum und Farbe. Neue Charaktere starten mit einem HP-Pool und einem MP-Pool, jeweils bei 100 von 100. Klick auf **Add** (Hinzufügen), um einen weiteren Pool anzulegen. Klick auf das X in einer Zeile, um sie zu entfernen.
- **Attributes**: benannte Zahlenwerte. Neue Charaktere starten mit STR, DEX, CON, INT, WIS und CHA, jeweils bei 10. Klick auf **Add**, um ein weiteres Attribut anzulegen. Klick auf das X in einer Zeile, um sie zu entfernen.

### Persona-Werte: zwei Bereiche

Der Tab **Stats** einer Persona besteht aus zwei getrennten Blöcken mit jeweils eigenem Schalter.

Der erste Block heißt **Persona Status Bars** (Statusleisten der Persona) und wird über **Enable Persona Stats** (Persona-Werte aktivieren) eingeschaltet. Diese Leisten führen körperliche und seelische Bedürfnisse mit. Nach dem Aktivieren stehen als Startleisten Satiety, Energy, Hygiene und Mood bereit, jeweils bei 100 von 100. Unter **Status Bars** verwaltest du die Liste. Jede Leiste hat einen Namen, einen aktuellen Wert, ein Maximum und eine Farbe. Klick auf **Add**, um eine Leiste anzulegen, und auf das X, um eine zu entfernen.

Der zweite Block heißt **RPG Attributes** und wird über **Enable RPG Attributes** (RPG-Attribute aktivieren) eingeschaltet. Er funktioniert wie bei einer Charakterkarte: Die Persona bekommt **Pools** (Start: HP und MP mit 100 von 100) und **Attributes** (Start: STR, DEX, CON, INT, WIS und CHA mit 10).

<a id="ruleset-sheets"></a>

### Regelsatzbögen

Mit einem installierten Regelsatz, etwa 5e (SRD 5.1), erscheint in beiden **Stats**-Reitern **Ruleset sheets** (Regelsatzbögen), mit einem aufklappbaren Eintrag je Regelsatz. Der Bereich bleibt auch sichtbar, wenn die Karte einen Bogen eines inzwischen fehlenden Regelsatzes enthält.

1. Klapp einen Eintrag auf und klick auf **Add a sheet** (Bogen hinzufügen), um die Standardwerte zu übernehmen.
2. Bearbeite Attribute, Abschnittsfelder, Angriffs- oder Zauberlisten sowie Ausbildung und Zusatzboni für Fertigkeiten und Rettungswürfe. Der Regelsatz bestimmt den Aufbau. Berechnete Werte wie Übungsbonus oder passive Wahrnehmung aktualisieren sich beim Bearbeiten und sind schreibgeschützt.
3. Speichere Charakter oder Persona wie gewohnt.

Das ist die Startkonfiguration. Neue Spiele kopieren den Bogen; Änderungen im Spiel ändern die Karte nicht. **Add from catalog** (Aus Katalog hinzufügen) öffnet durchsuchbare Vorlagen für Zauber, Angriffe und Fähigkeiten. Hinzugefügte Zeilen sind bearbeitbare Kopien.

Zahlen, die von Stufe oder Attributen abhängen, sind mit "Set by the ruleset" gekennzeichnet und werden beim Bearbeiten neu berechnet. Bei neueren Katalogtexten zeigt **Review** (Prüfen) gespeicherten und neuen Text nebeneinander. Mit **Update selected** (Auswahl aktualisieren) änderst du nur den Text ausgewählter Zeilen. Zahlen, Schalter, andere Spalten und nicht ausgewählte Zeilen bleiben erhalten.

Bögen fehlender Regelsätze bleiben gespeichert und werden mit der Karte exportiert, aber nicht an die KI geschickt. Nach erneuter Installation kannst du sie wieder bearbeiten; **Remove** entfernt sie. Ein Bogen darf höchstens 64 KB groß sein. Auch ein unlesbarer Bogen aus einer neueren Version bleibt erhalten. Dort gibt es nur **Remove this sheet**, damit ein neuer Bogen ihn nicht versehentlich überschreibt.

Bögen sind unabhängig von **Enable RPG Stats** und **Enable RPG Attributes**. Die eigenen Regeln von Marinara Engine ignorieren sie; Spiele mit Regelsatz verwenden sie anstelle der normalen Attribute für Proben.

## Wie Agenten die Werte aktualisieren

Die Angaben im Tab **Stats** sind nur die Startwerte. Damit sich Werte während eines Chats ändern, schaltest du den passenden Agenten ein. Ein Agent ist ein KI-Helfer, der neben dem Chat mitläuft.

- Der Agent **Character Tracker** passt die RPG-Werte des Charakters und die **RPG Attributes** der Persona an – abhängig von Kämpfen, Heilung und Ereignissen der Geschichte.
- Der Agent **Persona Stats** passt nach jeder Nachricht die **Persona Status Bars** an, je nachdem, was in der Geschichte passiert.

Ohne den passenden Agenten bleiben die Werte auf dem eingestellten Stand. Der Tab **Stats** allein aktualisiert nichts von selbst. Wie du diese Agenten einschaltest, steht in der Anleitung zu den mitgelieferten Agenten.

## Wie die Werte im HUD erscheinen

Sind Werte aktiviert, erscheinen sie während des Chats im HUD-Widget. HUD steht für Heads-up-Display, ein kleines Panel mit den aktuellen Werten. Balken erscheinen als farbcodierte Verläufe und sind so auf einen Blick lesbar. Die HUD-Anleitung beschreibt die vollständige Anzeige und erklärt, wie du sie verschiebst oder ausblendest.

## Verwandte Anleitungen

- [Charaktere erstellen und bearbeiten](creating-and-editing-characters.md)
- [Personas: erstellen und bearbeiten](personas.md)
- [HUD und Tracker](../roleplay/hud-and-trackers.md)
- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
