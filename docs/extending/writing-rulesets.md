# Writing Game Mode Rulesets

A ruleset tells Game Mode how a tabletop system works: which dice a check rolls, what is on the character sheet, which resources get spent, and what a rest gives back. This guide is for people who want to write their own and share it. To play on a ruleset somebody else made, start with [Choosing rules](../game/getting-started.md#choosing-rules).

A ruleset is one JSON file. It is data, not code. Nothing in it runs, so importing one cannot do anything to your computer. The one part that deserves a careful read before you import somebody else's file is the Game Master text, because that text is sent to the model in every game that uses the ruleset.

## Read this first: what a ruleset can and cannot do

A ruleset can only fill in the blanks of a mechanic the Engine already knows. Today the Engine knows one way to resolve a check, called `dice-sum`: roll some dice, add numbers from the sheet, and meet or beat a difficulty. You choose the dice, how a score becomes a modifier, what training is worth, whether advantage exists, and what natural results do. That covers d20 systems, 2d6 plus stat systems, and many others.

A mechanic that does not fit that shape cannot be written in a ruleset file. Dice pools that count successes, exploding dice, roll-under percentile checks, and degrees of success are examples. Each of those needs a new resolution kind inside the Engine, which is a code contribution with tests, not a JSON file. If your system needs one, open a feature request on the Engine repository and describe the mechanic with a few worked rolls. Those worked rolls become the tests.

Combat is separate too. Battles run on Marinara's own combat, in whichever Combat Preference the game was created with. A ruleset does not change how battles work yet.

## Quickstart

1. Copy the example file [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json). It is a small 2d6 system with three stats, written to show that nothing in the format assumes a d20 or six abilities. For a full-size example, see the 5e (SRD 5.1) file in [`ruleset-5e-2014.example.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/ruleset-5e-2014.example.json).
2. Change `id` to your own. An id is lowercase letters, digits, and single hyphens, such as `ember-roads`.
3. Edit the sheet, the rests, and the Game Master text.
4. Import it (see [Trying your ruleset](#trying-your-ruleset)). The import checks the whole file and tells you what is wrong, line by line, before anything is saved.
5. Create a new game, pick your ruleset under **Rules**, and play a few checks.

For help while you type, point your editor at the JSON Schema by adding this as the first line inside the file's outer braces:

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

The schema catches misspelled keys and wrong types as you type. It cannot check that the names in your file point at things that exist, such as a skill naming an ability. The import does that.

You may add a `"$comment": "..."` line to any object in the file to leave yourself a note. The Engine ignores it.

## The parts of the file

| Key             | What it holds                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------- |
| `schemaVersion` | Always `1`.                                                                                       |
| `id`, `version` | Your ruleset's name for the Engine, and a whole number you raise every time you publish a change. |
| `name`          | What players see in the setup wizard.                                                             |
| `edition`       | Optional. One line about which edition or draft this is.                                          |
| `license`       | Optional. An SPDX id and the attribution text your source requires.                               |
| `coverage`      | What the ruleset handles, plus the one-line summary shown in the setup wizard.                    |
| `resolution`    | How a check or a save is rolled.                                                                  |
| `sheet`         | Everything on the character sheet.                                                                |
| `rests`         | What each kind of rest restores and clears.                                                       |
| `gm`            | The text the Game Master model is given, and which sheet values it sees for each character.       |

The file may be up to 256 KB. Text that ends up in a prompt (names, labels, Game Master text) cannot contain line breaks, square brackets, or double curly braces.

Ids inside the sheet (abilities, skills, fields, pools, and so on) are lowercase letters, digits, and underscores, starting with a letter, such as `grit_max`.

### Resolution

```json
"resolution": {
  "kind": "dice-sum",
  "dice": { "count": 2, "sides": 6 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "untrained", "label": "Untrained" },
    { "id": "trained", "label": "Trained", "flat": 1 }
  ],
  "advantage": false,
  "difficultyLadder": [
    { "label": "Easy", "dc": 6 },
    { "label": "Hard", "dc": 10 }
  ]
}
```

- `dice`: how many dice and how many sides. The total is what gets compared to the difficulty.
- `abilityModifier`: how a score on the sheet becomes the number added to a roll. `identity` means the score is the modifier. `floorHalfMinusTen` is the 5e rule. `stepTable` lets you list your own thresholds as `[[score, modifier], ...]`.
- `proficiencyTiers`: the training levels a skill or save can have. The first one is what an unlisted skill gets. A tier adds `flat`, or `multiplier` times a proficiency bonus, or both. If your system has a proficiency bonus, name where it comes from with `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`.
- `advantage`: whether the Game Master may ask for the dice to be rolled twice and one roll kept.
- `naturals`: what the highest and lowest face of a single die do for checks and for saves: `none`, `both`, `max-only`, or `min-only`. Leave it out for pure arithmetic.
- `difficultyLadder`: the difficulties the Game Master is told to pick from.

### The sheet

- `sections` group things in the editor.
- `abilities` are the core scores. `skills` and `saves` each may name the ability they roll with.
- `fields` are single values. Types: `number`, `text`, `longtext`, `boolean`, `enum` (a fixed list of choices), and `dice` (text such as `1d8`).
- `derived` values are worked out from other values and cannot be typed over. The operations are `sum`, `min`, `max`, `scale` (multiply and round), and `stepTable` (look a value up in thresholds, the way a level gives a proficiency bonus).
- `lists` are tables with your own columns, such as gear, spells, or features. A list with `pools` turns every row into a resource with its own maximum, for class features with limited uses.
- `live` is what changes during play: `pools` (hit points, spell slots, Grit), `tracks` (a number on a scale, such as exhaustion), `text` (short notes such as what a character is concentrating on), and `conditions`.

Anything that reads a number names it with a value reference, which is an object with exactly one key: `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod`, or `saveMod`. For example, a pool whose maximum is a derived value: `"max": { "derived": "grit_max" }`.

`hideWhen` hides a field, a list, or a pool when another field has a given value. The 5e file uses it to hide spell slots from a character who does not cast spells.

### Rests

A rest is a list of restore steps and things to clear. Each step names one target (`pool`, `poolGroup`, `listPools`, or `track`) and either sets it (`"to": "max"`, `"to": "min"`, or a number) or changes it (`"by": { "const": 1 }`, or `"by": { "fractionOfMax": 0.5 }`).

### Game Master text

- `checkGuidance` replaces the built-in paragraph that tells the Game Master how to ask for a check. Say which system this is and when to call for a roll. The Game Master only names the skill and the difficulty. The Engine rolls the dice and does the arithmetic from the sheet, so do not ask the model to do math.
- `sheetGuidance` introduces the character sheets in the prompt. Use it to say which resources matter and when to spend them.
- `sheetSummary` chooses which fields, derived values, and list rows the Game Master sees for each character. The Engine always shows ability modifiers, trained skills and saves, and live values. Keep the rest short, because it is sent on every turn.

## Trying your ruleset

Community rulesets use the same switch as imported agents. Open **Settings** > **Advanced** > **Danger Zone** and make sure **Allow custom Agent imports** is on. Importing also needs localhost access or configured **Admin Access**.

1. Open the **Agents** panel and choose the **Import agents** button (the download icon in the row of buttons at the top of the panel).
2. Pick **Game Mode ruleset** and choose your JSON file.
3. Read the review. It shows the name, version, license, what the ruleset covers, and the Game Master text. Choose **Import**.

Your ruleset appears in the panel's **Rules** section and in the setup wizard's **Rules** choice for new games. A ruleset imported from a file is filed as `local/<your id>`, so it can never be confused with an official ruleset or with somebody else's.

### Changing a ruleset you already imported

A version that has been imported is never rewritten. If you change the file and import it again with the same `version`, the import is refused and asks you to raise the number. This is on purpose: a game is tied to the exact version it was created on, so a running campaign never wakes up on different math.

So the loop while you are drafting is: edit, raise `version`, import, start a new game. Old versions stay installed beside the new one until you remove the ruleset from the **Rules** section. Removing a ruleset that a game still uses makes that game say its ruleset is missing until you import it again.

If you change the shape of the sheet (add, remove, or rename things), raise `sheet.version` too. Existing sheets are read tolerantly: values the new sheet does not know are kept, and missing ones take their defaults.

## Sharing your ruleset

**As a file.** Send the JSON file to a friend. They import it the same way you did.

**From a GitHub repository.** If you keep your work in a public GitHub repository, put each ruleset in a `rulesets` folder at the top of the repository, one file per ruleset:

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

A user adds your repository once through the custom agent repository list, reviews what it holds, and can sync later to receive new versions. The custom repository list is an advanced feature that the person running the server has to turn on with `ENABLE_CUSTOM_AGENT_REPOS=true`. Rulesets from a repository are filed under the repository owner's name, such as `alice/ember-roads`, so two authors can both publish a ruleset called `v20` without clashing.

**In the official catalog.** A widely played system with clean licensing can be offered to everyone through **Download Agents**. That is a pull request to the [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) repository. Look at the `ruleset-5e-2014` package there for the layout.

## Licensing

Only publish rules text you have the right to share. Many systems publish a reference document under an open license, and that document is what you may copy from. Put the license id and the attribution text the license asks for under `license`. Do not copy text from rulebooks that are not openly licensed. A ruleset mostly needs names and numbers, and the Game Master text should be your own words.

## Troubleshooting

- **The import says a name does not exist.** Something in the file points at an id that is not declared, such as a skill naming an ability you removed. The message gives the path to the line.
- **The import says a version is already installed with different contents.** Raise `version` and import again.
- **My ruleset is missing from the setup wizard.** Check that **Allow custom Agent imports** is on. While it is off, imported rulesets are left out of new games. Games that already use one keep working.
- **A game says its ruleset is missing.** The exact version the game was created on is not installed. Import that version of the file again.
