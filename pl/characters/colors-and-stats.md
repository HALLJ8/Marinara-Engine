# Kolory postaci i statystyki RPG

Ten przewodnik wyjaśnia, jak działają zakładki **Colors** (kolory) i **Stats** (statystyki) w aplikacji Marinara Engine. Obie znajdują się w edytorze postaci i w edytorze persony. Kolory decydują o tym, jak postać albo persona wygląda na czacie. Statystyki służą do śledzenia wartości takich jak zdrowie czy głód.

## Zakładka **Colors**

Każda postać i każda persona ma w swoim edytorze zakładkę **Colors**. Ustawia się w niej trzy kolory: kolor imienia, kolor dialogu i kolor pola wiadomości. Puste pole oznacza, że dana część wygląda tak, jak przewiduje domyślny motyw aplikacji.

Aby otworzyć zakładkę **Colors**:

1. Otwórz postać w edytorze postaci albo personę w edytorze persony.
2. Kliknij zakładkę **Colors** na liście zakładek.
3. Powinien pojawić się panel **Preview** (podgląd) z podglądem na żywo, a pod nim trzy pola kolorów.

Panel **Preview** pokazuje przykładowe imię i przykładowy dymek wiadomości. Odświeża się przy każdej zmianie koloru, więc efekt widać jeszcze przed zapisem.

### Przycisk **Extract Colors from Avatar**

Przycisk **Extract Colors from Avatar** (pobranie kolorów z awatara) sam dobiera kolor imienia, kolor dialogu i kolor pola wiadomości na podstawie obrazka awatara. Działa dopiero wtedy, gdy awatar istnieje. Zanim awatar zostanie wgrany, przycisk jest nieaktywny i ma napis **Upload an avatar first**. Po pobraniu kolorów każdy z tych trzech nadal da się zmienić ręcznie.

### Trzy kolory

Każdy kolor ustaw w polu wyboru koloru albo wpisz wartość:

- **Name Display Color**: kolor imienia. To pole przyjmuje też gradient CSS. Gradient to płynne przejście między kolorami. Przykładowa wartość: `linear-gradient(90deg, #f59e0b, #ef4444)`.
- **Dialogue Highlight Color**: kolor tekstu w cudzysłowach dialogowych. Przykładowa wartość: `#ffd700`.
- **Message Box Color**: kolor tła dymka wiadomości na czacie. Najlepiej wygląda kolor półprzezroczysty. Przykładowa wartość: `rgba(0, 0, 0, 0.5)`.

Kolor półprzezroczysty przepuszcza część tła przez dymek. Format `rgba` to kolejno czerwony, zielony, niebieski oraz wartość alfa od 0 (pełna przezroczystość) do 1 (kolor kryjący).

## Gdzie widać ustawione kolory

Każdy kolor działa w innym miejscu czatu:

- Kolor imienia koloruje wyświetlaną nazwę w wiadomościach na czacie. U postaci koloruje dodatkowo nazwę na zakładkach paska bocznego. U persony koloruje też nazwę na listach wyboru persony.
- Kolor dialogu koloruje tekst w cudzysłowach dialogowych. Działa zarówno z prostymi cudzysłowami, jak i z innymi ich stylami. Ten tekst da się dodatkowo pogrubić w sekcji **Settings** (Ustawienia).
- Kolor pola wiadomości ustawia tło dymków danej postaci albo persony. Obowiązuje w czatach Conversation i Roleplay.

## Zakładka **Stats**

Każda postać i każda persona ma również zakładkę **Stats**. Statystyki to liczby takie jak HP (punkty zdrowia), STR (siła) czy pasek głodu. Po ich włączeniu Marinara dopisuje wartości do promptu, czyli tekstu wysyłanego do AI, dzięki czemu model zna aktualny stan. Wartości ustawione w tej zakładce to punkt wyjścia dla nowych czatów. Później mogą je zmieniać agenci. Więcej na ten temat znajdziesz w sekcji o agentach poniżej.

Zakładka **Stats** u postaci i zakładka **Stats** u persony wyglądają inaczej, dlatego każda z nich jest opisana osobno.

### Statystyki postaci: **Enable RPG Stats**

Postać ma jeden przełącznik: **Enable RPG Stats** (włączenie statystyk RPG). Kiedy jest wyłączony, nic poniżej nie jest widoczne ani wysyłane. Po włączeniu pojawiają się dwie sekcje:

- **Pools**: nazwane paski z wartością bieżącą, wartością maksymalną i kolorem. Nowe postacie mają na starcie pulę HP i pulę MP, obie na poziomie 100 ze 100. Kliknij przycisk **Add**, aby dodać kolejną pulę. Kliknij X w wierszu, aby go usunąć.
- **Attributes**: nazwane wartości liczbowe. Nowe postacie mają na starcie STR, DEX, CON, INT, WIS i CHA, każdą o wartości 10. Kliknij przycisk **Add**, aby dodać kolejny atrybut. Kliknij X w wierszu, aby go usunąć.

### Statystyki persony: dwie sekcje

Zakładka **Stats** persony składa się z dwóch osobnych bloków, każdy z własnym przełącznikiem.

Pierwszy blok to **Persona Status Bars**, włączany przełącznikiem **Enable Persona Stats**. Te paski śledzą potrzeby fizyczne i psychiczne. Po włączeniu bloku dostępne są paski startowe Satiety, Energy, Hygiene i Mood, każdy na poziomie 100 ze 100. Listą zarządza się w sekcji **Status Bars**. Każdy pasek ma nazwę, wartość bieżącą, wartość maksymalną i kolor. Kliknij przycisk **Add**, aby dodać pasek, a X, aby go usunąć.

Drugi blok to **RPG Attributes**, włączany przełącznikiem **Enable RPG Attributes**. Działa tak samo jak w karcie postaci. Daje personie sekcję **Pools** (na starcie HP i MP na poziomie 100 ze 100) oraz sekcję **Attributes** (na starcie STR, DEX, CON, INT, WIS i CHA o wartości 10).

<a id="ruleset-sheets"></a>

### Arkusze zestawów zasad

Po instalacji zestawu, np. 5e (SRD 5.1), obie zakładki **Stats** otrzymują blok **Ruleset sheets** (arkusze zestawów zasad), po jednym rozwijanym wpisie na zestaw. Blok jest widoczny również wtedy, gdy karta przechowuje arkusz nieobecnego już zestawu.

1. Otwórz wpis i kliknij **Add a sheet** (dodaj arkusz), aby otrzymać wartości domyślne.
2. Uzupełnij cechy, pola sekcji, listy ataków lub zaklęć, wyszkolenie i dodatkowe premie umiejętności oraz rzutów obronnych. Układ określa zestaw. Wartości obliczane, np. premia biegłości lub pasywna Percepcja, aktualizują się podczas pisania i nie podlegają bezpośredniej edycji.
3. Zapisz postać lub personę jak zwykle.

To początkowa konfiguracja postaci. Nowa gra kopiuje arkusz; zmiany w grze nie wracają na kartę. **Add from catalog** (dodaj z katalogu) otwiera wyszukiwarkę gotowych zaklęć, ataków i zdolności. Dodane wiersze są edytowalnymi kopiami.

Wartości zależne od poziomu lub cechy są tylko do odczytu z opisem "Set by the ruleset" i przeliczają się przy edycji arkusza. Gdy katalog ma nowszy tekst, **Review** (przejrzyj) pokazuje obok siebie zapisany i nowy opis oraz wybór wierszy. **Update selected** (aktualizuj wybrane) zmienia tylko tekst zaznaczonych wierszy. Liczby, przełączniki, inne kolumny i odznaczone wiersze pozostają nietknięte.

Arkusz brakującego zestawu pozostaje zapisany, eksportuje się razem z kartą, nie trafia do AI i ponownie podlega edycji po instalacji zestawu. Ma przycisk **Remove** (usuń). Limit arkusza wynosi 64 KB. Nieczytelny arkusz z nowszej wersji też pozostaje zapisany; jedyna opcja to **Remove this sheet** (usuń ten arkusz), więc dodanie nowego nie nadpisze go przypadkiem.

Arkusze są niezależne od **Enable RPG Stats** i **Enable RPG Attributes**. Własne zasady aplikacji Marinara Engine je ignorują; gra z zestawem używa ich zamiast zwykłych atrybutów do testów.

## Jak agenci aktualizują statystyki

Wartości w zakładce **Stats** to wyłącznie punkt wyjścia. Żeby statystyki zmieniały się w trakcie czatu, trzeba włączyć odpowiedniego agenta. Agent to pomocnik AI działający w tle czatu.

- Agent **Character Tracker** zmienia statystyki RPG postaci oraz sekcję **RPG Attributes** persony na podstawie walki, leczenia i wydarzeń fabularnych.
- Agent **Persona Stats** aktualizuje sekcję **Persona Status Bars** po każdej wiadomości, zgodnie z tym, co dzieje się w historii.

Bez włączonego agenta wartości pozostają takie, jakie zostały ustawione. Sama zakładka **Stats** niczego nie aktualizuje. Sposób włączania tych agentów opisuje przewodnik po wbudowanych agentach.

## Jak statystyki wyglądają na pasku HUD

Włączone statystyki pojawiają się w trakcie czatu w widgecie HUD. HUD to skrót od heads-up display – niewielki panel z aktualnymi wartościami. Paski mają gradienty z kolorami przypisanymi do poziomów, więc wystarczy jedno spojrzenie. Pełny opis wyświetlania oraz przenoszenia i ukrywania paska znajduje się w przewodniku po HUD.

## Powiązane przewodniki

- [Tworzenie i edycja postaci](creating-and-editing-characters.md)
- [Persony użytkownika: tworzenie i edycja](personas.md)
- [HUD i trackery](../roleplay/hud-and-trackers.md)
- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
