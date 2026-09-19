# Couleurs des personnages et caractéristiques RPG

Ce guide explique l'onglet **Colors** (couleurs) et l'onglet **Stats** (caractéristiques) de Marinara Engine. Les deux onglets se trouvent dans l'éditeur de personnage et dans l'éditeur de persona (le personnage que tu incarnes). Les couleurs changent l'apparence d'un personnage ou du persona dans le chat. Les caractéristiques servent à suivre des valeurs comme la santé ou la faim.

## L'onglet Colors

Chaque personnage et chaque persona possède un onglet **Colors** dans son éditeur. Il règle trois couleurs : celle du nom, celle des dialogues et celle de la bulle de message. Laisse un champ vide et Marinara applique la couleur du thème par défaut à cet élément.

Pour ouvrir l'onglet Colors :

1. Ouvre un personnage dans l'éditeur de personnage, ou un persona dans l'éditeur de persona.
2. Clique sur l'onglet **Colors** dans la liste des onglets.
3. Une carte **Preview** (aperçu) en direct apparaît, avec les trois champs de couleur en dessous.

La carte **Preview** montre un exemple de nom et un exemple de bulle de message. Elle se met à jour à chaque changement de couleur : tu vois donc le résultat avant d'enregistrer.

### Extract Colors from Avatar

Le bouton **Extract Colors from Avatar** (extraire les couleurs de l'avatar) choisit automatiquement une couleur de nom, une couleur de dialogue et une couleur de bulle à partir de l'image de l'avatar. Le bouton ne devient actif qu'une fois un avatar en place. Tant qu'aucun avatar n'est téléversé, le bouton est désactivé et affiche **Upload an avatar first**. Après l'extraction, tu peux encore modifier chacune des trois couleurs à la main.

### Les trois couleurs

Règle chaque couleur avec le champ de couleur, ou saisis une valeur :

- **Name Display Color** : la couleur du nom. Ce champ accepte aussi un dégradé CSS. Un dégradé est un fondu progressif entre plusieurs couleurs. Exemple de valeur : `linear-gradient(90deg, #f59e0b, #ef4444)`.
- **Dialogue Highlight Color** : la couleur du texte placé entre guillemets de dialogue. Exemple de valeur : `#ffd700`.
- **Message Box Color** : la couleur de fond de la bulle de message dans le chat. Une couleur semi-transparente donne le meilleur rendu. Exemple de valeur : `rgba(0, 0, 0, 0.5)`.

Une couleur semi-transparente laisse voir une partie de l'arrière-plan à travers la bulle. Le format `rgba` correspond au rouge, au vert, au bleu, puis à une valeur alpha allant de 0 (transparent) à 1 (opaque).

## Où les couleurs apparaissent

Chaque couleur agit sur une partie différente du chat :

- La couleur du nom s'applique au nom affiché dans les messages du chat. Pour un personnage, elle colore aussi le nom dans les onglets de la barre latérale. Pour un persona, elle colore aussi le nom dans les sélecteurs de persona.
- La couleur des dialogues s'applique au texte placé entre guillemets de dialogue. Elle fonctionne avec les guillemets droits comme avec les autres styles de guillemets. Ce texte peut aussi être mis en gras depuis **Settings** (Paramètres).
- La couleur de la bulle définit l'arrière-plan des bulles de message de ce personnage ou de ce persona. Elle s'applique aussi bien aux chats Conversation qu'aux chats Roleplay.

## L'onglet Stats

Chaque personnage et chaque persona possède également un onglet **Stats**. Les caractéristiques sont des nombres comme les HP (points de vie), la STR (force) ou une barre de faim. Quand tu les actives, Marinara ajoute les valeurs au prompt – le texte que Marinara envoie à l'IA – pour que l'IA connaisse l'état actuel. Les valeurs définies ici sont les valeurs de départ par défaut des nouveaux chats. Les agents peuvent ensuite les faire évoluer en cours de partie. Voir la section sur les agents plus bas.

L'onglet **Stats** d'un personnage et l'onglet **Stats** d'un persona sont organisés différemment : chacun est donc décrit à part ci-dessous.

### Caractéristiques d'un personnage : Enable RPG Stats

Un personnage a un seul interrupteur : **Enable RPG Stats** (activer les caractéristiques RPG). Désactivé, rien de ce qui suit n'est affiché ni envoyé. Activé, deux sections apparaissent :

- **Pools** : des barres nommées avec une valeur actuelle, un maximum et une couleur. Les nouveaux personnages démarrent avec une réserve HP et une réserve MP, chacune à 100 sur 100. Clique sur **Add** (ajouter) pour créer une autre réserve. Clique sur le X d'une ligne pour la supprimer.
- **Attributes** : des valeurs numériques nommées. Les nouveaux personnages démarrent avec STR, DEX, CON, INT, WIS et CHA, chacune à 10. Clique sur **Add** pour créer un autre attribut. Clique sur le X d'une ligne pour le supprimer.

### Caractéristiques d'un persona : deux sections

L'onglet **Stats** d'un persona contient deux blocs distincts, chacun avec son propre interrupteur.

Le premier bloc, **Persona Status Bars** (barres d'état du persona), s'active avec **Enable Persona Stats**. Ces barres suivent les besoins physiques et mentaux. À l'activation, les barres de départ sont Satiety, Energy, Hygiene et Mood, chacune à 100 sur 100. La liste se gère sous **Status Bars**. Chaque barre a un nom, une valeur actuelle, un maximum et une couleur. Clique sur **Add** pour créer une barre et sur le X pour en supprimer une.

Le second bloc, **RPG Attributes**, s'active avec **Enable RPG Attributes**. Il fonctionne comme sur une fiche de personnage. Il donne au persona des **Pools** (HP et MP à 100 sur 100 au départ) et des **Attributes** (STR, DEX, CON, INT, WIS et CHA à 10 au départ).

<a id="ruleset-sheets"></a>

### Fiches d'ensembles de règles

Avec un ensemble installé, comme 5e (SRD 5.1), les deux onglets **Stats** présentent **Ruleset sheets** (fiches d'ensembles de règles), avec une entrée dépliable par ensemble. Le bloc reste visible si la carte contient la fiche d'un ensemble désormais absent.

1. Déplie une entrée et clique sur **Add a sheet** pour charger les valeurs par défaut.
2. Renseigne caractéristiques, champs, listes d'attaques ou de sorts, entraînement et bonus de compétences et sauvegardes. L'ensemble détermine la structure. Les valeurs calculées, comme la maîtrise ou la Perception passive, changent pendant la saisie et restent en lecture seule.
3. Enregistre le personnage ou la persona normalement.

Il s'agit de la configuration initiale. Une nouvelle partie copie la fiche ; les changements en jeu ne modifient pas la carte. **Add from catalog** ouvre un sélecteur avec recherche de sorts, attaques et capacités prêts à l'emploi. Les lignes ajoutées sont des copies modifiables.

Les nombres liés au niveau ou aux caractéristiques sont en lecture seule, avec "Set by the ruleset", et recalculés à la modification. Quand le catalogue propose un texte plus récent, **Review** affiche les textes enregistré et nouveau côte à côte. **Update selected** ne remplace que le texte des lignes choisies. Nombres, interrupteurs, autres colonnes et lignes non choisies restent intacts.

Une fiche dont l'ensemble manque reste enregistrée et exportée avec la carte, sans être envoyée à l'IA. Réinstalle l'ensemble pour la modifier ou utilise **Remove**. La limite est de 64 KB par fiche. Une fiche illisible provenant d'une version plus récente reste aussi conservée ; seul **Remove this sheet** est proposé pour éviter son écrasement accidentel.

Ces fiches sont indépendantes de **Enable RPG Stats** et **Enable RPG Attributes**. Les règles propres à Marinara Engine les ignorent ; une partie avec ensemble les utilise à la place des attributs habituels pour ses tests.

## Comment les agents mettent à jour les caractéristiques

Les valeurs de l'onglet **Stats** ne sont que des valeurs de départ. Pour que les caractéristiques évoluent pendant un chat, active l'agent correspondant. Un agent est une IA qui travaille en parallèle du chat.

- L'agent **Character Tracker** ajuste les caractéristiques RPG des personnages et les **RPG Attributes** du persona selon les combats, les soins et les événements de l'histoire.
- L'agent **Persona Stats** ajuste les **Persona Status Bars** après chaque message, selon ce qui se passe dans l'histoire.

Sans l'agent correspondant, les valeurs restent celles que tu as définies. À lui seul, l'onglet **Stats** ne met rien à jour. Voir le guide des agents intégrés pour activer ces agents.

## Affichage des caractéristiques dans le HUD

Quand les caractéristiques sont activées, elles apparaissent dans le widget HUD pendant le chat. HUD signifie heads-up display : un petit panneau qui affiche les valeurs en direct. Les barres s'affichent sous forme de dégradés colorés, lisibles d'un coup d'œil. Le guide du HUD détaille l'affichage complet, ainsi que la façon de le déplacer ou de le masquer.

## Guides associés

- [Créer et modifier des personnages](creating-and-editing-characters.md)
- [Personas : création et modification](personas.md)
- [HUD et trackers](../roleplay/hud-and-trackers.md)
- [Référence des agents téléchargeables](../agents/built-in-agents.md)
