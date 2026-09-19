# Opcjonalne pakiety agentów i możliwości

Status: zaimplementowane w cyklu rozwojowym v2.3.0 w zgłoszeniu #3612.

## Cel

Podstawowa dystrybucja aplikacji Marinara Engine nie może kompilować ani dostarczać opcjonalnych implementacji agentów i możliwości. Świeża instalacja startuje bez żadnych opcjonalnych pakietów. Aktualizacja zachowuje możliwości, które były dostępne przed wprowadzeniem tego systemu pakietów.

Oficjalny katalog, źródła pakietów, powtarzalne artefakty, skrypty walidacyjne i proces współtworzenia znajdziesz w repozytorium [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Zainstalowane artefakty lądują wewnątrz skonfigurowanego folderu danych aplikacji Marinara Engine, więc aktualizacja aplikacji ich nie nadpisze.

## Model pakietu

Pakiet agenta może wnosić jednego lub kilku deklaratywnych agentów oraz opcjonalne zaufane możliwości wykonywalne:

- serwerowe punkty wejścia dla tras, haków cyklu życia, dostawców promptów, obsługi wyników i migracji magazynu danych;
- klienckie punkty wejścia dla paneli, powierzchni czatu, sekcji ustawień, wyborów w kreatorze konfiguracji i widoków czasu wykonania;
- wspólne schematy JSON i stabilne kontrakty transmisji;
- zasoby, dokumentację i fragmenty wiedzy dla asystentki Professor Mari należące do pakietu.

Pakiety celują w wersjonowane API możliwości aplikacji Marinara Engine. Nie mogą importować prywatnych ścieżek źródłowych silnika.

Klienckie elementy możliwości dostają wybrany w aplikacji język interfejsu przez atrybuty `lang` i `dir` oraz przez
obiekt `capabilityProps.localization`. Interfejsy należące do pakietu mają własne pliki językowe i wracają do angielskiego
z pakietu; Marinara Engine nie tłumaczy promptów pakietu ani wartości maszynowych zapisanych w pakiecie. Zmiana języka
nadal korzysta z istniejącego zdarzenia `marinara-capability-props`, więc zainstalowany interfejs odświeża się bez restartu aplikacji.

### Dostarczanie i pamięć podręczna

Zainstalowane pliki pakietu są udostępniane z silnymi walidatorami wyprowadzonymi ze skrótów SHA-256 poszczególnych plików w manifeście. Tych samych wartości Engine używa do ponownego sprawdzenia bajtów przy każdym odczycie. Pakiet klienta (`/api/capability-packages/<id>/client`) i każdy zasób pakietu są zawsze ponownie walidowane (`no-cache` wraz z `ETag`). Niezmieniony plik odpowiada więc kodem `304 Not Modified`, zamiast pobierać się ponownie, a ponownie opublikowany plik jest natychmiast wykrywany. Nic nie jest udostępniane jako `immutable`: zasady instalacji pozwalają ponownie opublikować tę samą wersję z innymi bajtami, dlatego adresy URL pakietów nie są adresowane zawartością.

API możliwości w wersji 1.1 dodaje do serwerowego kontekstu aktywacji ogólną
fasadę środowiska uruchomieniowego. Pakiety mogą odczytać obowiązujący stan debugowania agentów i pisać
przez logger Pino aplikacji Marinara Engine, łącznie z jawnym wymuszeniem trybu debugowania, bez importowania
prywatnych modułów loggera ani konfiguracji środowiska uruchomieniowego. Fasada udostępnia operacje,
a nie same obiekty silnika.

API możliwości w wersji 1.2 dodaje operacje na czatach i wiadomościach w obrębie transakcji,
wąskie zapisy metadanych czatu, odczyty istnienia wpisów lorebooka oraz zgodnościowy
magazyn migawek przestrzennych. Pakiety mogą sprawdzić poprawność zmian w domenie wewnątrz transakcji
silnika i atomowo zatwierdzić metadane razem z wiadomością właściciela, swipe'em lub migawką
przestrzenną, bez dostępu do uchwytu bazy danych czy obiektu tabeli. Marinara Engine odpowiada za
wycofywanie zmian i zgodność z historycznym magazynem, a pakiety za walidację i
zasady domeny. To samo API udostępnia znormalizowane rekordy czatów i postaci, wybór
kwalifikujących się wpisów lorebooka, parsowanie odpowiedzi zbliżonych do formatu JSON oraz rozstrzygnięte wywołania modeli językowych.
Dane uwierzytelniające połączeń, implementacje dostawców, uchwyty bazy danych i obiekty magazynu
pozostają prywatne dla silnika.

### Capability API 1.7: gałęzie czatu

Capability API 1.7 dodaje znormalizowane metadane gałęzi do `CapabilityChatRecord`:

```ts
branch: {
  title: string | null;
  parentChatId: string | null;
  parentMessageId: string | null;
  childMessageId: string | null;
} | null;
```

`title` to zapisana nazwa gałęzi bez zbędnych spacji. Czaty główne zwracają `null`. Znane gałęzie utworzone przez Engine udostępniają bezpośredni czat nadrzędny, wiadomość źródłową rozwidlenia i skopiowaną wiadomość potomną. Puste gałęzie używają kotwic wiadomości null. Starsze gałęzie, błędne metadane i zaimportowane równoległe czaty grupowe bez znanej relacji zwracają pola pochodzenia null; Engine nie odgaduje historycznych relacji. Ogólny eksport i import pomija identyfikatory elementu nadrzędnego i wiadomości, ponieważ zmieniają się między instalacjami. Usunięcie elementu nadrzędnego nie zmienia pochodzenia elementu potomnego.

### Capability API 1.8: Experiences w Game

Capability API 1.8 dodaje Experiences w Game dostarczane przez pakiety, kontekst promptu dla każdej tury Game oraz zapisywanie zasobów.

Pakiet może dostarczyć cały Game Mode zamiast dodatku do trybu wbudowanego. Deklaruje slot `game-surface` i jest wybierany podczas tworzenia gry w bloku Experiences kreatora konfiguracji. Wybór zostaje zapisany w grze na cały czas jej działania, dlatego Experience nigdy nie jest włączane ani wyłączane w połowie rozgrywki. Powierzchnia rysuje własny HUD, menu i walkę nad wspólną narracją oraz deklaruje, które systemy wbudowane zastępuje. Wszystko, czego nie zadeklaruje, pozostaje wbudowane, więc Experience wyłącza tylko to, co naprawdę implementuje. Opcjonalne `contributions.gameSurface.surfaceClass` podaje klasę nakładaną przez Engine na obszar gry, gdy powierzchnia jest zamontowana. Arkusz stylów pakietu może dzięki temu zmienić wspólny interfejs renderowany poza własnym elementem.

Pakiety z uprawnieniem `prompt-context` dodają tekst do promptu systemowego każdej generowanej tury Game. Pakiet posiadający stan na żywo może dzięki temu zachować zgodność modelu z widokiem gracza. Wkład może też zadeklarować zastępowane systemy wbudowane; Engine przestaje wtedy instruować model, aby nimi sterował. Wkłady są zbierane dla każdej tury i nigdy nie są wymagane: pusty wynik jest pomijany, a błąd lub przekroczenie czasu jest rejestrowane i pomijane bez wpływu na generowanie.

Fasada zasobów udostępnia zapis obok odczytu, więc konfiguracja pakietu może znaleźć lub utworzyć Personę gracza i jej lorebook. Pamięć, walidacja i tożsamość pozostają własnością Engine; treść domenowa pozostaje własnością pakietów.

### Capability API 1.10: zasoby pakietu

Capability API 1.10 dodaje ogólne udostępnianie statycznych zasobów pakietu. Manifest może zadeklarować `contributions.assets.paths` - listę dozwolonych maksymalnie 256 obrazów (`png`/`webp`/`gif`/`jpg`/`jpeg`) i plików JSON zawartych w pakiecie. Engine udostępnia je przez `/api/capability-packages/<id>/assets/<path>` przy użyciu tego samego łańcucha kontroli co ikony kart przeglądarki: zamknięcia ścieżki, obecności skrótu w `files[]`, listy dozwolonych pasywnych typów zawartości i ponownej kontroli integralności przy każdym odczycie. Schemat odrzuca aktywne typy dokumentów (SVG, HTML i skrypty); każda zadeklarowana ścieżka musi mieć przypięty skrót w `files[]`; a plik `manifest.json` z wnętrza pakietu nigdy nie może być udostępniony, nawet jeśli został zadeklarowany. `contributions.assets` wymaga manifestu `schemaVersion` 2 z `capabilityApi` 1.10 lub nowszym; manifest v1 w ogóle nie może go deklarować. Zasoby są zawsze ponownie walidowane: podobnie jak pakiet klienta mają silny `ETag` oparty na skrócie manifestu, a niezmienione żądanie dostaje `304 Not Modified` bez treści. Zestaw kafelków pobiera się ponownie tylko po rzeczywistej zmianie bajtów. Odpowiedzi celowo nigdy nie są `immutable`, ponieważ zasady instalacji pozwalają ponownie opublikować tę samą wersję z innymi bajtami, więc adres URL z wersją nie jest adresowany zawartością. W ten sposób Experience `game-surface` może dostarczyć prawdziwą grafikę zamiast osadzać ją w pakiecie klienta.

Manifest naruszający te zasady jest odrzucany przy instalacji jednym z komunikatów: "A declared package asset must be listed in the package file manifest", "contributions.assets requires schemaVersion 2 and capabilityApi 1.10 or newer", błędem rozszerzenia schematu dla ścieżki innej niż obraz lub JSON albo - w przypadku archiwum o nazwach różniących się tylko wielkością liter, które na systemie bez rozróżniania wielkości liter trafiłyby do jednego pliku - "Package contains duplicate file" / "Package manifest declares files that collide on case-insensitive filesystems".

Każdy element możliwości dostaje w tym celu własną tożsamość: `capabilityProps.packageId` i `capabilityProps.packageVersion` przychodzą razem z `localization`. Pakiet buduje adresy zasobów jako `/api/capability-packages/<packageId>/assets/<path>`, opcjonalnie z `?v=<packageVersion>`, aby zmiana wersji ominęła pośrednią pamięć podręczną, bez ponownego pobierania listy instalacji ani analizowania własnego adresu importu.

### Capability API 1.11: interfejs walki dla Experience

Capability API 1.11 dodaje interfejs walki do właściwości możliwości `game-surface`. `combatActive` zgłasza dokładny moment faktycznego zamontowania wbudowanego interfejsu walki. W przeciwieństwie do `chatMeta.gameActiveState`, narracyjnego stanu sceny GM, nie pozostaje w tyle za zmianą i nie wskazuje "combat", gdy nie istnieje jeszcze starcie. `combatStyle` zawiera efektywny styl (`classic` albo `tactical`). `requestCombat()` prosi Engine o wygenerowanie starcia tym samym przebiegiem co ręczny przycisk Start Combat, ale bez potwierdzenia, ponieważ własny interfejs Experience już wyraził zamiar. Przebieg generowania w Engine nadal decyduje, czym będzie starcie. Celowo nie istnieje sposób, by pakiet bezpośrednio dostarczył walczących lub stan walki - walka pozostaje własnością Engine.

`requestCombat()` ma stabilną tożsamość, pozostaje ciche na ścieżce pakietu i zwraca kod, z którego Experience renderuje własny komunikat: `"started"` albo odmowę - `"combat-active"`, `"pending"` (generowanie już trwa), `"no-turn"` (GM nie napisał jeszcze tury) lub `"unavailable"` (zakończona sesja albo powtórka). `combatPending` i `combatError` odzwierciedlają postęp i błąd generowania, aby pakiet nie czekał na `combatActive` po nieudanym generowaniu. Podobnie jak interfejsy 1.7 i 1.8, ale inaczej niż ściśle ograniczone `contributions.assets` z 1.10, te właściwości trafiają do każdego pakietu `game-surface` niezależnie od zadeklarowanego `capabilityApi`. Etykieta 1.11 oznacza czas ich wprowadzenia; pakiet, który ich wymaga, deklaruje 1.11, a starszy Engine odrzuca go w kontrolowany sposób.

### Capability API 1.12: zdarzenia przestrzenne dla właściciela Experience

Capability API 1.12 adresuje zdarzenia możliwości przestrzennych również do pakietu Experience, do którego należy gra. `spatial_transition_committed`, `spatial_transition_rejected` i nietypowana wskazówka `spatial_context_refresh`, wcześniej kierowane wyłącznie do `hierarchical-maps` w zdarzeniu okna `marinara-capability-server-event`, są teraz wysyłane również z `packageId` równym `gameExperienceId` czatu. Ładunki różnią się między zdarzeniami: zatwierdzone zdarzenie zawiera `{ chatId, commandId, currentLocationId, definitionRevision, travel? }`; odrzucone zawiera `{ chatId, commandId, code?, message? }` bez pól lokalizacji, ponieważ ruch nie nastąpił; wskazówka odświeżenia zawiera `data: null`. Experience, które wysłało polecenie podróży przez argument `pendingSpatialTransition` funkcji `sendMessage`, może potwierdzić lub usunąć podróż, gdy tylko host zna wynik, zamiast wnioskować z późniejszego odczytu. Wersja 1.12 zamyka też lukę dotyczącą World Maps: przejścia odrzucone przez jedną z dwóch cichych ścieżek HTTP - zatwierdzenie tury właściciela przed strumieniowaniem w generowaniu albo samodzielne zatwierdzenie REST - nie tworzyły wcześniej żadnego zdarzenia. Obie ścieżki tworzą teraz `spatial_transition_rejected`, wyłącznie przy rozstrzygającym dowodzie, czyli kodzie błędu `spatial_*` innym niż `already_applied`. Nierozstrzygające awarie, jak błąd sieci, który mógł zgubić udane zatwierdzenie, wysyłają zamiast tego nietypowaną wskazówkę `spatial_context_refresh`, aby odbiorcy uzgodnili stan z serwerem, zamiast przyjmować wymyślony werdykt. Zatwierdzone zdarzenie z `travel.mode` równym `"step_by_step"` i `complete: false` oznacza, że podróż trwa dalej; zachowaj stan oczekujący do zdarzenia kończącego. To miękki interfejs jak 1.11: zdarzenia są dostarczane niezależnie od zadeklarowanego `capabilityApi`. Deklaruj 1.12 tylko wtedy, gdy pakiet tego wymaga.

### Capability API 1.13: tymczasowe zwijanie narracji

Capability API 1.13 dodaje `requestsCollapsedNarration` do deklaracji interfejsu, którą pakiet `game-surface` przekazuje do `setExperienceChrome`. Gdy flaga ma wartość true, pole narracji w Game Mode zwija się do wąskiego uchwytu, aby Experience mogło odsłonić ekran na przerywnik filmowy lub pełnoekranową scenę.

To ŻĄDANIE, a nie preferencja. Ustawienie zwinięcia wybrane przez gracza nigdy nie jest zapisywane, a flaga działa tylko wtedy, gdy Experience jest aktywną powierzchnią. Usuń flagę albo przestań być aktywną powierzchnią, a pole wróci do wyboru gracza. To gwarancja, że później zawsze otworzy się ponownie; pakiet celowo nie może utrwalić zwinięcia.

Zasady bezpieczeństwa Engine mają pierwszeństwo. Pole jest przymusowo rozwijane zawsze, gdy widać pole tekstowe gracza, także na samym początku sceny przed powstaniem segmentu, oraz gdy działają kontrolki przejścia do kolejnego segmentu. Są one jedynym sposobem zakończenia tury; pakiet, który mógłby je ukryć, mógłby trwale zablokować gracza. Uchwyt nadal pokazuje wskaźnik uwagi przy oczekującej analizie sceny, generowaniu lub ponownej próbie generowania walki. Jeśli gracz rozwinie pole ręcznie podczas żądania, pozostaje ono otwarte do zakończenia żądania. Podobnie jak interfejsy 1.11 i 1.12 jest to miękki interfejs: pole działa niezależnie od zadeklarowanego `capabilityApi`. Etykieta 1.13 oznacza czas wprowadzenia, więc pakiet, który go wymaga, deklaruje 1.13.

### Capability API 1.17: przygotowanie Experience przed pierwszą turą

Pakiet `game-surface` może zadeklarować `contributions.gameSurface.prepareBeforeStart: true` przy schemacie w wersji 2 i Capability API 1.17. Engine montuje tę powierzchnię, gdy gra jest gotowa, zanim włączy **Start Game** (Rozpocznij grę). Klasyczne gry i pakiety bez tej flagi zachowują dotychczasowy przebieg uruchamiania.

Główna powierzchnia, która włącza tę opcję, otrzymuje dwie dodatkowe właściwości:

- `startup: boolean` pozostaje true, dopóki gracz nie zakończy wprowadzenia Engine przyciskiem **Continue** (Kontynuuj). W tym czasie wstrzymaj symulację świata i działania gracza.
- `setStartupReady(context: string | null): void` zgłasza stan przygotowania. Wysyłaj `null` podczas ładowania, zapisywania lub wychodzenia z błędu. Wyślij ciąg znaków dopiero wtedy, gdy faktyczny świat jest trwale zapisany i gotowy do użycia; pusty ciąg pozwala rozpocząć bez dodatkowego kontekstu.

Host blokuje **Start Game**, potwierdzenie przygotowania widżetów i ponowne próby pierwszej tury, dopóki nie otrzyma ciągu oznaczającego gotowość. Podczas blokady własny interfejs ładowania oraz błędu i ponowienia pakietu pozostaje widoczny. Po uzyskaniu gotowości pakiet jest ukryty za zwykłym wprowadzeniem Engine. **Continue** otwiera zwykłą powierzchnię, która może zostać zamontowana ponownie: zadbaj o idempotentne przygotowanie świata i odtwarzaj zapisany stan zamiast generować go od nowa. Powrót do gry, w której wprowadzenie już się zakończyło, nie powtarza przygotowania startowego.

Kontekst otwarcia ma limit **8 000 znaków**. Niepoprawny lub zbyt długi kontekst nadal blokuje start i wyświetla błąd; host nie ucina faktów o świecie. Przekaż krótki opis przygotowanej lokacji początkowej i faktycznie obecnych tam postaci. Engine dołącza ten tekst do istniejącego `generationGuide` pierwszej tury ze źródłem `game_start`, aby otwarcie korzystało ze świata, który już istnieje. Nie rejestruje to kontekstu dla późniejszych tur; dla nich nadal używaj zwykłego wkładu pakietu do promptu lub kontekstu generowania tury.

Wywołania zwrotne gotowości należą do zamontowanego czatu, gry i pakietu. Spóźnione wywołania z innego zakresu są ignorowane. Błąd modułu lub środowiska uruchomieniowego blokuje start, zamiast uznawać brak kontekstu świata za sukces. Po przeładowaniu pakiet musi zgłosić gotowość na podstawie zapisanego świata. Serwerowy dostawca kontekstu promptu nadal działa tylko do odczytu i ma krótki limit czasu; nie używaj go do generowania świata ani jako długotrwałej blokady startu.

### Capability API 1.19: narzędzia udostępniane przez pakiety

Capability API 1.16 pozwalało pakietowi nakłonić model, by coś _powiedział_, a następnie na to zareagować. Ta wersja pozwala modelowi coś _wywołać_. Pakiet z nowym uprawnieniem `tools` rejestruje nazwane narzędzie w serwerowym punkcie wejścia. Engine udostępnia je obok wbudowanych narzędzi w każdej turze każdego czatu, sprawdza wywołanie według JSON Schema pakietu i przekazuje argumenty do jego funkcji obsługi.

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

Wywołania narzędzi zamiast formatu odpowiedzi to świadomy wybór. Format zajmuje całą odpowiedź: narracja musiałaby trafić do pola obiektu JSON i nie mogłaby być strumieniowana. Wywołanie narzędzia może towarzyszyć tekstowi, gdy model pisze swoją turę. Pakiet otrzymuje argumenty, które dostawca już ograniczył, zamiast wydobywać je z gotowej narracji. Schemat wymusza reguły; konwencja tylko prosi model o ich przestrzeganie.

Widać to przy wyliczeniach. Pakiet znający dwanaście miejsc może wpisać ich nazwy do schematu. Trzynasta nazwa zostanie odrzucona, zanim dotrze do funkcji obsługi. Istniejący walidator argumentów w Engine wskazuje poprawne wartości, więc model może skorygować wywołanie. Wartość zwrócona przez funkcję obsługi trafia do modelu jako wynik narzędzia.

Zanim napiszesz narzędzie, poznaj te zasady:

- Nazwy mają postać `<packageId>_<name>`, a `-` jest zastępowany przez `_`: `set_time` z pakietu `world-clock` dociera do modelu jako `world_clock_set_time`. Nazwa zajęta przez inny pakiet jest odrzucana. Narzędzia wbudowane i włączone narzędzia niestandardowe zachowują kolidujące nazwy; definicja pakietu jest pomijana. Pełna nazwa może mieć najwyżej **64 znaki**. Definicje i wykonanie stosują tę samą kolejność: wbudowane, niestandardowe, pakietowe.
- Narzędzia są dołączane przez cały czas aktywności pakietu. Nie ma dodatkowego przełącznika dla czatu, jak przy narzędziach wbudowanych: decyzją jest nadanie uprawnienia i rejestracja. Wybrany dostawca musi obsługiwać natywne wywołania narzędzi.
- Schemat parametrów jest kopiowany i kompilowany podczas rejestracji. Jeśli Engine nie potrafi go skompilować, aktywacja kończy się błędem widocznym podczas pracy nad pakietem, zamiast przerywać turę.
- Wyjątek w funkcji obsługi oznacza nieudane wywołanie i jest zapisywany w logach; jego treść nie trafia do modelu. Po **10 sekundach** bez wyniku tura również przestaje czekać. Funkcja nadal działa, ale nie blokuje całej tury.
- Wyniki muszą dać się zserializować do najwyżej **64 KiB**. Większy wynik lub brak możliwości serializacji powoduje błąd wywołania, zamiast wypierać rozmowę z kontekstu. Opisy i wyniki są zaufaną treścią pakietu. Sprawdź `chatId`, zanim odczytasz lub zmienisz dane czatu.
- Każda definicja jest serializowana w żądaniu do dostawcy przy każdej turze i uwzględniana przy dopasowaniu kontekstu. Limity wynoszą **16 narzędzi na pakiet**, **64 we wszystkich pakietach**, **512 znaków** opisu i **8 KiB** schematu parametrów. Przekroczenie limitu zgłasza wyjątek i uniemożliwia aktywację. Ponowna rejestracja własnej nazwy zastępuje narzędzie bez zajmowania kolejnego miejsca.
- Kontekst aktywacji przestaje działać po jej zakończeniu. Jeśli pakiet zachowa `api` i później wywoła `registerTool` z callbacku, wywołanie zostanie odrzucone. Zakończone środowisko nie może rejestrować narzędzi ani zastępować narzędzi nowej aktywacji.
- Dezaktywacja, aktualizacja i usunięcie pakietu zwalniają jego narzędzia. Model nie otrzyma narzędzia, którego pakiet nie może już odpowiedzieć. Narzędzia są usuwane przed oczekiwaniem na sprzątanie; każdy callback sprzątający ma limit 8 sekund.

Te limity dotyczą wyłącznie oczekiwania asynchronicznego. Pakiety działają jako zaufany kod w procesie serwera; timer nie może przerwać pracy synchronicznej blokującej pętlę zdarzeń. Wymuszone anulowanie wymagałoby osobnego workera lub procesu, czego ten interfejs API nie zapewnia.

`api.registerTool` istnieje dopiero od tej wersji Engine. Pakiet, który go potrzebuje, musi zadeklarować `capabilityApi` 1.19 i nie zainstaluje się w starszej wersji.

## Pakiety początkowe

- wszyscy dotychczas wbudowani agenci;
- hierarchiczne mapy przestrzenne dla trybów Roleplay i Game Mode;
- rozmowy audio i wideo w trybie Conversation;
- UNO;
- Chess;
- Poker;
- 8-Ball Pool;
- Tic-Tac-Toe;
- Rock-Paper-Scissors.

W podstawie zostaje menedżer pakietów, klient katalogu, ogólne kontrakty potoku agentów, ogólne kontrakty hosta gier turowych oraz puste interfejsy hosta. Konkretne implementacje należą do pakietów.

## Zaufanie i instalacja

Oficjalny katalog to wersjonowany dokument JSON o sprawdzanym schemacie, pobierany przez HTTPS. Każdy wpis wydania zawiera niezmienne adresy URL artefaktów, skróty SHA-256, rozmiary w bajtach, informacje o zgodności z silnikiem, uprawnienia oraz to, czy dane środowisko uruchomieniowe wymaga restartu.

Polecenia modelu zadeklarowane przez pakiet działają tylko wtedy, gdy deklaruje on `chat-write`, jest zainstalowany i gotowy. To uprawnienie kontroluje też zapisy przez API trwałego magazynu pakietu, w tym wiadomości, metadane czatu, zdarzenia roleplay i migawki przestrzenne. `chat-read` kontroluje odczyty czatów, wiadomości, stanu gry i migawek przestrzennych. Te same kontrole obowiązują wewnątrz transakcji magazynu i blokad czatu; uprawnienie do zapisu nie daje automatycznie uprawnienia do odczytu. Wywołania magazynu należące do Engine pozostają zaufane.

Widok szczegółów **Download Agents** (pobieranie agentów) pokazuje po instalacji uprawnienia zadeklarowane przez zainstalowaną wersję. Gdy wersja katalogowa żąda innych uprawnień, pokazuje je osobno. Instalowanie lub aktualizowanie kodu nadal wymaga istniejącej zgody przypisanej do dokładnej wersji i sumy kontrolnej; polecenia modelu nie pytają o osobną zgodę w każdej turze.

To kontrole API, a nie izolowane środowisko JavaScript. Uprawnienia do sieci, magazynu i interfejsu są deklaracjami dostępu. Kod pakietu w przeglądarce i na serwerze pozostaje zaufanym kodem i ma dostęp do środowiska hosta; instaluj tylko pakiety, którym ufasz. Sprawdzana jest gotowość, a nie możliwość udostępniania plików, więc aktualizacja pozostawiająca pakiet w stanie `restart-required` wstrzymuje rozpoznawanie jego poleceń do restartu Engine.

Przy starcie serwera host pobiera katalog jeden raz, o ile zainstalowany jest przynajmniej jeden oficjalny pakiet. Wybiera tylko nowsze wersje zgodne z działającym silnikiem i z API możliwości, weryfikuje je zwykłym potokiem instalacyjnym i instaluje jeszcze przed aktywacją środowisk uruchomieniowych pakietów. Awarie są izolowane osobno dla każdego pakietu. Gdy katalog jest niedostępny albo weryfikacja się nie powiedzie, dotychczasowe pliki i stan rejestru nadal działają, a niepowodzenie gotowości środowiska serwerowego korzysta ze ścieżki wycofania do poprzedniej wersji.

Instalator musi:

1. wymagać uprzywilejowanego dostępu przez pętlę zwrotną lub konto administratora;
2. wymuszać HTTPS, limity pobierania i limity czasu;
3. sprawdzić zaufanie do katalogu i skrót SHA-256 artefaktu jeszcze przed rozpakowaniem;
4. odrzucać ścieżki bezwzględne, przejścia w górę drzewa, dowiązania, pliki urządzeń i pliki niezadeklarowane;
5. sprawdzić poprawność manifestu i zgodność z silnikiem;
6. rozpakować pliki do tymczasowego folderu obok docelowego;
7. przeprowadzić atomową aktywację dopiero po udanej walidacji;
8. zachować poprzednią wersję do czasu, aż nowe środowisko uruchomieniowe wystartuje poprawnie;
9. wycofać aktywację w razie niepowodzenia;
10. nigdy nie uruchamiać skryptów instalacji, aktualizacji ani odinstalowania.

Oficjalny katalog włącza wyłącznie zaufane pakiety wykonywalne od twórców aplikacji. Przyszła ścieżka dla pakietów zewnętrznych wymaga osobnego, jawnego projektu zaufania.

## Środowisko uruchomieniowe i zachowanie przy restarcie

Serwer jest właścicielem rejestru zainstalowanych pakietów i udostępnia zainstalowane możliwości klientom. Moduły deklaratywne i przeładowywalne aktywują się natychmiast. Po aktywacji interfejs unieważnia zapytania o katalog, agentów, możliwości trybu i aktywny czat.

Manifest może deklarować `restartRequired` tylko wtedy, gdy host nie potrafi bezpiecznie przeładować danego punktu wejścia. Udana aktywacja na gorąco kończy się komunikatem `Agent installed. It is ready to use.` Aktywacja wymagająca restartu kończy się komunikatem `Agent installed. Restart Marinara Engine to finish setup.`

Pakiety gier turowych da się przeładować na gorąco: instalacja od razu rejestruje ich silnik serwerowy i ręczną komendę slash do uruchomienia, a odinstalowanie odłącza środowisko uruchomieniowe bez restartu aplikacji. Ustawienia Conversation Commands w danym czacie decydują wyłącznie o tym, czy postacie mogą wysyłać ukrytą komendę pakietu; nie blokują komendy slash uruchamianej ręcznie. Obecne oficjalne manifesty gier turowych zachowują zachowawczy, dawny znacznik restartu dla zgodności z silnikiem w wersji 2.x. Silnik w wersji 3.x rozpoznaje rodzaj `turn-game`, przeprowadza bezpieczną aktywację na gorąco i zwraca pakiet jako aktywny i gotowy do użycia.

## Migracja zgodności

Przy pierwszym uruchomieniu po aktualizacji:

- własni agenci pozostają nietknięci;
- każdy dawny wbudowany agent widoczny w tej instalacji zostaje zapisany jako zainstalowany;
- mapy, rozmowy w trybie Conversation i gry w trybie Conversation zachowują dotychczasową dostępność;
- dotychczasowa konfiguracja poszczególnych czatów, migawki, stan gry, historia rozmów i pamięć agentów zostają na miejscu;
- migracja jest idempotentna i zapisuje swoje zakończenie dopiero wtedy, gdy wszystkie wpisy o dawnej dostępności są trwałe.

Artefakty dawnych pakietów nadal są dostępne w oficjalnym katalogu jako źródła migracji. Świeża instalacja ich nie pokazuje ani nie aktywuje, dopóki nie zostaną zainstalowane ręcznie.

## Odinstalowanie

Odinstalowanie usuwa pakiet z wyborów w aktywnych czatach, kasuje jego konfigurację agenta oraz pobrane pliki wykonywalne, a w razie potrzeby odłącza jego środowisko uruchomieniowe przy restarcie. Historyczne czaty, wiadomości, migawki map, podsumowania rozmów i zakończone rozgrywki nadal da się odczytać, więc usunięcie pakietu nie zniszczy niczyjej pracy. Trwałe usunięcie historycznych danych domenowych to osobna, jawna decyzja użytkownika.

Każde odinstalowanie wymaga potwierdzenia. Objęte nim czaty wracają do zwykłych powierzchni podstawowych bez uszkodzenia historii.

## Interfejs katalogu

Panel **Agents** (Agenci) zawiera przycisk `Download Agents`, który odpowiada przyciskowi `Download Cards` w panelu Card Browser. Otwiera on pełnoekranową, responsywną bibliotekę z wyszukiwaniem, rodzajami pakietów, informacją o zgodności, stanem instalacji i aktualizacji, uprawnieniami, kosztem miejsca na dysku, dokumentacją oraz przyciskami odinstalowania.

Na komputerze widać listę do przeglądania i sąsiadujący z nią obszar szczegółów. Na telefonie jest jeden panel, z jawną nawigacją wstecz i akcjami wygodnymi pod palec. Stany pusty, offline, niezgodny, uszkodzone pobieranie, przerwana instalacja, aktualizacja, wycofanie i wymagany restart są obsłużone pełnoprawnie.

## Warunek zakończenia wydzielenia

Wydzielenie jest kompletne dopiero wtedy, gdy podstawowe produkcyjne paczki klienta i serwera nie zawierają już implementacji pakietu, świeża instalacja nie potrafi jej aktywować bez pobrania pakietu, instalacja po aktualizacji ją zachowuje, a instalacja, aktualizacja i odinstalowanie pakietu przechodzą pomyślnie na komputerze, telefonie i systemach plików zgodnych z Termux.

### Capability API 1.20: zestawy zasad Game Mode

Zestaw zasad to sprawdzone dane: obsługiwany przez Engine sposób rozstrzygania testów, arkusz z zamkniętego zbioru elementów, odpoczynki i wskazówki do promptu GM. Pakiet dostarcza zastrzeżony zasób `ruleset.json`, wykrywany tak jak `gm-verbs.json`: wpisany w `contributions.assets.paths` i powiązany z hashem w `files[]`.

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

Przykład pokazuje tylko pola istotne dla zestawu. Nadal wymagane są `name`, `version`, `description`, `engine` i `builtAgainst`. Nie potrzeba uprawnień, agenta ani punktów wejścia klienta lub serwera. Typ `ruleset` wymaga `ruleset.json`, a ten plik wymaga tego typu. Plik nie wykonuje kodu ani wyrażeń tekstowych; nowa mechanika rozstrzygania wymaga zmiany Engine. Format i przykład 5e opisuje [`game-rulesets-and-sheets-implementation.md`](game-rulesets-and-sheets-implementation.md).

To twarda granica zgodności: manifest z tym zasobem musi deklarować API 1.20; starszy Engine odmawia instalacji. Engine odrzuca deklarowany rozmiar powyżej 256 KB przed odczytem, ponownie sprawdza hash instalacji i waliduje plik ścisłym schematem `packages/shared/src/schemas/ruleset.schema.ts`. Nieprawidłowy plik zostaje pominięty z jednym wpisem dziennika wskazującym pakiet i pierwsze błędy `path: message`. Przy powtórzonym identyfikatorze wygrywa pierwszy pakiet według kolejności identyfikatorów pakietów; drugi jest pomijany z wpisem dziennika. `engine-legacy` i `traditional` są zastrzeżone dla Engine.

Gra zapisuje wybór raz w `chat.metadata.gameRuleset`. Brak przypisania oznacza dotychczasowe zasady Engine. Brak pakietu lub starsza definicja oznaczają niedostępny zestaw, nie zastąpienie go innymi zasadami. Przypisanie sprawdza identyfikator zestawu oraz pakiet dostawcy, więc inny pakiet nie przejmie gry przez powtórzenie identyfikatora.

### Capability API 1.21: katalogi zestawów zasad

Katalogi dostarczają gotowe zaklęcia, zdolności klas i ekwipunek do selektora w edytorze arkusza. Nagłówek znajduje się w `ruleset.json` pod `catalogs`; wpisy mogą być tam bezpośrednio lub w osobnym zastrzeżonym zasobie:

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

Nazwa `catalogs/<id>.json` odpowiada identyfikatorowi katalogu; katalog nie może wskazać pliku innego katalogu. Zasób ma hash w `files[]`, występuje tylko obok deklarującego go `ruleset.json` i jest odrzucany przed odczytem przy deklarowanym rozmiarze powyżej 1 MB. Walidacja względem tego samego arkusza jest taka sama dla wpisów wbudowanych i plikowych. Limit to 12 katalogów na zestaw i 2000 wpisów na katalog.

Klient pobiera katalog dopiero po otwarciu selektora przez `GET /api/capability-packages/rulesets/catalog?rulesetId=&catalogId=&version=`. Lista zainstalowanych zestawów zawiera liczbę wpisów, nie ich treść. Tekst katalogu nie trafia do promptu: GM widzi tylko to, co wskazuje `gm.sheetSummary`, więc katalog sam nie zużywa tokenów. Zasób katalogu wymaga API 1.21; instalacja sprawdza też deklarację przy kluczu `catalogs` wewnątrz zweryfikowanego `ruleset.json`. Starszy ścisły schemat odrzuciłby cały plik. Uprawnienia nie są potrzebne.

### Capability API 1.22: blok battle

Opcjonalny `battle` wskazuje bieżącą pulę zdrowia, opcjonalną pulę MP, pule komórek zaklęć oraz listy, których wiersze z katalogu stają się `CombatSkill`. Po walce zdrowie, energia i komórki wracają przez te same operacje arkusza, których używają przyciski gracza.

```json
{
  "capabilityApi": { "major": 1, "minor": 22 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

To połączenie danych z walką Engine, nie pełny adapter systemu stołowego. Obliczenia obrażeń pozostają wbudowane; most nie używa `attackRoll`, `save`, `concentration` ani `perCostStep` wpisu katalogu. Dokładne zasady systemu należą do osobnego przekazania walki adapterom. `coverage.combat` zachowuje własne znaczenie i nie jest odczytywane przez most. Instalacja sprawdza zweryfikowaną zawartość `ruleset.json` i odrzuca `battle` przy deklaracji poniżej API 1.22, tak jak `catalogs` poniżej 1.21. Bez uprawnień i bez zmian dla zestawu bez tego bloku.

### Capability API 1.23: skalowane wartości katalogu

Wiersz wpisu katalogu może mieć `scaled`: mapę maksymalnie czterech własnych kolumn liczbowych, które utrzymuje zestaw. Każda używa zwykłego odwołania do wartości i opcjonalnej tabeli progów, np. zasób klasy zależny od poziomu lub użycia zależne od cechy, bez nowej arytmetyki formatu.

```json
{
  "capabilityApi": { "major": 1, "minor": 23 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

Wartość jest przeliczana przy edycji, nie przy odczycie. Stan gry, prompt GM i most walki czytają zapisaną liczbę. Wiersz może być w `ruleset.json` lub `catalogs/<id>.json`; oba pliki są zasobami manifestu. Instalacja sprawdza ich zweryfikowaną treść i odrzuca `scaled` poniżej API 1.23, tak jak wcześniejsze bramki katalogów i walki. Bez uprawnień i bez zmian dla katalogów bez skalowania.

Ta wersja dodaje też `[sheet: op="use" name="..."]`, opłacające `mechanics.cost` wpisu oraz po jednym użyciu każdej puli wiersza utworzonej przez ten wpis. Polecenie nie wymaga nowej deklaracji: czyta już obsługiwane katalogi.

### Capability API 1.24: pule kości

`resolution` może deklarować `"kind": "dice-pool"` zamiast `"dice-sum"`. Liczba z arkusza określa liczbę kości; silnik liczy wyniki osiągające próg. Zestaw może określać podwójne sukcesy, eksplodujące i anulujące wyniki, pech, wyjątkowe sukcesy oraz zakres kości dodawanych lub odejmowanych przez GM za okoliczności.

```json
{
  "capabilityApi": { "major": 1, "minor": 24 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Arkusz pozostaje ten sam: wartość dodawana do rzutu w `dice-sum` oznacza tutaj liczbę kości. Nie powstają nowe elementy arkusza, slot edytora ani kod pakietu. Instalacja odczytuje zweryfikowany `ruleset.json` i odrzuca `dice-pool` przy deklaracji poniżej 1.24; starszy Engine obsługujący tylko `dice-sum` odrzuciłby cały plik. Bez uprawnień i bez zmian dla zestawu sumującego kości.

### Capability API 1.25: warstwy i wskazówki świata

Opcjonalne `layers` to nazwane warianty wybierane przy tworzeniu gry i utrwalane w jej przypisaniu na cały czas gry. Opcjonalny tekst `gm.worldGuidance` jest czytany raz podczas tworzenia świata, aby pasował on do zasad drużyny.

```json
{
  "capabilityApi": { "major": 1, "minor": 25 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Zamknięty zbiór efektów warstw pozwala dopisywać wskazówki po wskazówkach zestawu, usuwać wartości pól wyliczeniowych, zastępować skalę trudności skalą tego samego rodzaju rozstrzygania i ukrywać wpisy katalogu w selektorze arkusza. Nie dodaje nowych elementów arkusza, więc arkusze pozostają czytelne niezależnie od warstw. Brak kodu pakietu i dodatkowego wywołania modelu. Warstwy innych autorów są planowane później. Instalacja odrzuca `layers` i `gm.worldGuidance` poniżej API 1.25 po sprawdzeniu zweryfikowanej treści. Bez uprawnień i bez zmian dla zestawów bez obu pól.

### Capability API 1.26–1.27: format walki i bestiariusze

API 1.26 dodaje opcjonalny `combat`: rzuty, cele, ekonomię akcji, listy ataków i zdolności, stany, koncentrację, zasady przy zerowym zdrowiu, typy obrażeń i skalę przeciwników. `mechanics` wpisów katalogu może opisywać liczbę celów, pewne trafienie, stany, punkty tymczasowe, skalowanie z arkuszem i zużywany budżet.

```json
{
  "capabilityApi": { "major": 1, "minor": 26 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

API 1.27 pozwala katalogowi deklarować `"holds": "creatures"`. Bloki stworzeń używają liczb z `combat`: zdrowia jako liczby lub rzutu na początku walki, obrony, inicjatywy, cech i obron według identyfikatorów arkusza, odporności, podatności i niewrażliwości na obrażenia, niewrażliwości na stany, poziomu zagrożenia oraz cech pokazywanych GM. Akcje mogą trafiać, wymuszać obronę, nakładać stan, mieć limit użyć, odnawiać się rzutem, wykonywać sekwencję innych akcji za jeden budżet albo kosztować własne punkty specjalne stworzenia.

```json
{
  "capabilityApi": { "major": 1, "minor": 27 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/beasts.json"] } }
}
```

Katalog stworzeń nie deklaruje `feeds` i nie pojawia się w selektorze arkusza. Przy włączonym reżyserze walki gra z `combat` używa tych zasad i bestiariusza na ekranie bitwy oraz zapisuje arkusze po każdym działaniu. To styl `ruleset`, który nie wymaga osobnego poziomu Capability API. Bez `combat` nadal działa blok `battle` albo wybrane Classic/Tactical. Instalacja sprawdza zweryfikowane `ruleset.json` i `catalogs/<id>.json`: `combat` i nowe klucze `mechanics` wymagają 1.26, a `holds` i `creature` — 1.27. Starszy ścisły schemat odrzuciłby plik. Nie ma nowych uprawnień ani zmian dla zestawów bez tych pól.

### Capability API 1.18: konfiguracja Experience w kreatorze Game

Pakiet `game-surface` może zadeklarować `contributions.gameSurface.setup` przy schemacie w wersji 2 i Capability API 1.18. Engine zachowuje siedem zwykłych kroków konfiguracji, w tym **Party** (Drużyna), cele, modele i lorebooki. Experiences są dostępne tylko przy nowych grach; ponowne otwarcie konfiguracji istniejącej gry zachowuje jej Experience i konfigurację pakietu. Pakiety bez tej deklaracji zachowują dawny dialog konfiguracji.

```json
{
  "setup": {
    "seed": { "key": "seed", "label": "World seed" },
    "config": { "generate": true, "packWanted": true },
    "requires": { "enableCustomWidgets": false }
  }
}
```

Wszystkie trzy pola są opcjonalne. Zadeklarowane ziarno pojawia się pod wybranym Experience z przyciskiem **Randomize** (Losuj). Pusta lub nieskończona wartość albo wartość niebędąca liczbą blokuje **Start** (Rozpocznij). Host zapisuje liczbowe ziarno i zadeklarowane stałe w `experienceConfig`; `config` nie może zawierać klucza ziarna. Stałe po serializacji muszą mieścić się w 8 000 znaków. Etykieta ziarna to tekst wyświetlany autorstwa pakietu; pomiń ją, aby użyć zlokalizowanej etykiety Engine.

Zadeklarowane wymaganie dotyczące widżetów ustala wartość domyślną tylko do chwili, gdy gracz zmieni tę kontrolkę. Wyłączenie Experience przywraca zwykłą wartość domyślną, a jawne wybory gracza pozostają bez zmian. Kontrolka wyjaśnia oczekiwanie Experience i nadal można ją edytować. Dla tych Experiences kontrolki konfiguracji mapy przestrzennej są ukryte, więc nie uruchamia się osobny szkic mapy, szablon ani kreator.

Krok **Lorebooks** (Lorebooki) pozwala wybrać do 100 pojedynczych włączonych wpisów, także z niepodłączonych książek. Wyłączone książki i wpisy oraz wykluczenia czatu są respektowane. Identyfikatory trafiają do `GameSetupConfig.activeLorebookEntryIds`. W `/game/setup` są to dodatkowe wymuszone wpisy: pomijają losowanie prawdopodobieństwa, ale zachowują zwykłe limity tokenów. Lore globalne, powiązane z postaciami i podłączone nadal uczestniczy w zwykłym skanowaniu. Pakiety mogą odczytać te same wybrane identyfikatory z konfiguracji na potrzeby własnego żądania generowania świata.

Import pliku konfiguracji odtwarza zainstalowane, zgodne Experience i jego poprawne liczbowe ziarno, ale odrzuca dowolną konfigurację pakietu. Stałe są ponownie dostarczane przez bieżący manifest. Istniejące gry pomijają import Experience z wyjaśnieniem. Migawki utworzenia zachowują nazwę Experience i ziarno do podsumowania konfiguracji.

Gdy świat musi być przygotowany przed pierwszą turą, niezależnie użyj istniejącej deklaracji gotowości startowej. Zadeklaruj API 1.18 jako minimum pakietu; starsze hosty nie potrafią zinterpretować tej deklaracji konfiguracji.
