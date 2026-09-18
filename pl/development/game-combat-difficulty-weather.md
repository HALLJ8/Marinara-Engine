# Poziom trudności walki i pogoda

Zapis implementacji zadania [#6305](https://github.com/Pasta-Devs/Marinara-Engine/issues/6305), będącego kontynuacją reżysera walki z #6302. Dokument przedstawia uzgodniony zakres i granice implementacji.

## Konfiguracja i trudność

Usuń pole **Battlefield Seed** (ziarno pola bitwy) i jego podsumowanie, zachowując **Battlefield Size** (rozmiar pola bitwy). Nowe starcia otrzymują wewnętrzne losowe ziarna. Przy rozpoczynaniu kolejnych bitew ignoruj nieaktualne ustawienie ziarna kampanii; zachowaj zaakceptowane ziarna bitew, siatki i działanie ponownego rozpoczęcia. Zmień opis Classic na "Cinematic menu battles."

Normalizuj poziom trudności za pomocą jednego wspólnego pomocnika, również w starszych konfiguracjach z nazwami pisanymi wielką literą. Zachowaj mnożniki obrażeń przeciwników: Casual 0.6, Normal 1, Hard 1.3 i Brutal 1.6. Classic, podobnie jak Tactical, ma skalować wyłącznie obrażenia przeciwników. Sprawdź występowanie tego samego błędu wielkości liter w starciach i łupach. Ustal trudność przy tworzeniu starcia; zmiana ustawień podczas walki nie może jej zmienić.

Te mnożniki obrażeń należą wyłącznie do Traditional, czyli obecnej starszej mechaniki silnika. Przy implementacji 5e, V20 lub innego zestawu zasad ponownie określ trudność zgodnie z polityką danego zestawu. Nie dziedzicz domyślnie mnożników Traditional. Strojenie decyzji AI jest niezależne od skalowania obrażeń.

## Pogoda

Korzystaj z istniejącej pogody kampanii i ekspozycji starcia wynikającej z otoczenia. Zapisuj zaakceptowaną pogodę wraz ze starciem; brak pola w starszym zapisie walki oznacza neutralną mechanikę. Nieznana ekspozycja jest neutralna. Zamknięte otoczenie zapewnia osłonę. Obecne aliasy pogody muszą być normalizowane do istniejących typów, a ustawienie typu musi tworzyć zgodne wartości wiatru i widoczności.

Początkowe zasady dotyczą jednakowo obu stron: deszcz umiarkowanie zmniejsza obrażenia od ognia i zwiększa obrażenia od błyskawic; silny wiatr osłabia ataki jawnie oznaczone jako pociski; słaba widoczność osłabia ataki jawnie wymagające widzenia; śnieg zwiększa koszt chodzenia w Tactical. Lot i teleportacja zachowują swoje zasady ruchu. Dla nieoznaczonych zdolności nie wywnioskuj cechy pocisku ani wymogu widzenia z nazwy. Pogoda bezchmurna lub pochmurna jest zwykle neutralna. Prognozy, rozstrzyganie i oceny AI muszą korzystać ze wspólnych pomocników bez zużywania przyszłych rzutów walki.

Pokazuj zaakceptowane warunki i efekty w obu interfejsach walki. Kosmetyczne ustawienia pogody nie mogą wyłączać mechaniki. Pogoda pozostaje stała przez całe starcie; zdolności zmieniające pogodę, okresowe zmiany warunków, losowe uderzenia pioruna i wyczerpanie od upału są odłożone na później. Summoning i przyszłe zestawy zasad mogą korzystać ze wspólnego kontraktu pogody bez dodawania niedokończonego trybu interfejsu.

## Decyzje przeciwników

Zachowaj rolę, przymiotnik, biegłość, legalność i rozliczanie zasobów. Trudność zmienia ograniczoną zmienność decyzji opartą na ziarnie: Casual dopuszcza więcej wiarygodnych błędów, Normal pozostaje blisko obecnego punktu odniesienia, Hard zwiększa konsekwencję, a Brutal minimalizuje błędy, zachowując różnice biegłości. Strojenie decyzji towarzyszy zawsze korzysta ze stałego poziomu Normal; towarzysze nadal reagują na rzeczywistą pogodę i zagrożenia. Ograniczenia Mindless pozostają w mocy.

Uwzględniaj pogodę przy ocenie ataków, wsparcia, pozycji i reakcji. Counterspell i osłona konkurują z pominięciem reakcji zależnie od zagrożenia, kosztu i osobowości. Żaden poziom trudności nie udostępnia ukrytych poleceń, przyszłych rzutów, darmowych zasobów ani dodatkowych akcji. Prompt GM sterującego bossem otrzymuje zaakceptowaną trudność i pogodę oraz wskazówki dotyczące wywierania presji i wyboru okazji; silnik nadal egzekwuje udostępnione legalne wybory i limity. Awaria dostawcy pozostawia lokalną ścieżkę zastępczą.

## Walidacja i dostarczenie

Zaimplementuj kolejno konfigurację i poprawność, pogodę, a następnie integrację AI. Dodaj uruchamialne testy regresji obejmujące wielkość liter w nazwach trudności; obrażenia wyłącznie przeciwników; ekspozycję na pogodę, aliasy, prognozy i ruch; zapis i przywracanie; deterministyczne wybory przeciwników i strojenie towarzyszy; koszty reakcji i granice promptu bossa. Zaktualizuj istniejące scenariusze testowe konfiguracji i terenu pod kątem wycofanego ustawienia ziarna. Sprawdź komputer, telefon i oba motywy, również z wyłączonymi animacjami pogody. Przed oznaczeniem szkicu PR jako gotowego uruchom podstawowe kontrole, odpowiednie regresje promptów i przeglądarki oraz lokalną ocenę CodeRabbit.

Wartości strojenia są początkowymi założeniami projektowymi, a nie potwierdzonym balansem. Automatyczne scenariusze testowe potwierdzają mechanikę i niezmienniki; jakość bossów przy rzeczywistym dostawcy i balans długich kampanii wymagają testów rozgrywki. Odłożone zadania pozostają nieprzypisane do czasu faktycznego rozpoczęcia pracy.

## Szczegóły implementacji

Wspólne warunki znajdują się w `packages/shared/src/features/combat-conditions.ts`. Trudność jest normalizowana przy imporcie i tworzeniu konfiguracji oraz w kodzie starć, łupów, Classic i Tactical. Zmienność decyzji przeciwników jest mnożona przez 2.5 / 1 / 0.4 / 0.15 odpowiednio dla Casual / Normal / Hard / Brutal; zapisana biegłość i osobowość pozostają w mocy. Oceny Classic używają tego samego prawdopodobieństwa trafienia w przeciwstawnym rzucie d20 co rozstrzyganie, a Tactical korzysta ze wspólnej prognozy ataku. Pościg w Tactical szereguje trasy według kosztów terenu i pogody dla zwykłych profili. Jednostki Mindless wybierają natomiast legalną trasę o najmniejszej liczbie kroków; obie strategie płacą rzeczywiste koszty terenu i pogody podczas ruchu. Reakcje uwzględniają oczekiwane zagrożenie i niedobór zasobów, z tą samą polityką zmienności dotyczącą wyłącznie przeciwników.

Deszcz, ulewa i burze przy ekspozycji na pogodę mnożą obrażenia od ognia przez 0.85, a od błyskawic przez 1.15. Jawnie oznaczone pociski tracą 10 punktów celności przy silnym wietrze i 15 przy wichurze. Ataki jawnie wymagające widzenia tracą 5 punktów przy ograniczonej widoczności i 15 przy słabej. Łączna kara nie przekracza 25 punktów. Classic przelicza ją na modyfikatory przeciwstawnych rzutów ataku, po jednym punkcie na pięć punktów celności, i nazywa te kary w opisie warunków. W Tactical śnieg lub zamieć przy ekspozycji na pogodę dodają jeden punkt kosztu chodzenia za wejście na każde pole; lot i teleportacja pozostają bez zmian. Przedmioty zadające obrażenia od żywiołów również otrzymują modyfikatory deszczu; leczenie i czas trwania stanów nie.

Generowanie starcia określa wartości logiczne `projectile` / `requiresSight` dla ataków podstawowych i umiejętności oraz `battlefield.terrainBrief.exposure`. Brak cech ataku oznacza neutralność. Jawna ekspozycja ma pierwszeństwo; rozpoznane zamknięte otoczenie jest osłonięte, rozpoznane otwarte otoczenie jest odsłonięte, a niejednoznaczne pozostaje nieznane. Pogoda kampanii pochodzi z zapisanego systemu pogody, a gdy jej brakuje, z zatwierdzonej wartości pogody sceny. Tagi wiadomości rozpoczynającej walkę wstrzymują rozwój pogody w tle, zanim renderowany tryb nadąży za zmianą. Zaakceptowane warunki są zapisywane w stanie reżysera i Tactical; sprzeczne lub uszkodzone importy są odrzucane. Istniejące zapisy bez pogody pozostają neutralne. Ponowne rozpoczęcie starszej walki Tactical przekazuje zaakceptowane warunki, w tym ich neutralny brak, zamiast odczytywać zmienioną pogodę kampanii.

Konfiguracja nadal sprawdza wycofane pola przy imporcie ze względu na zgodność i bezpieczeństwo, ale usuwa je z normalizowanych eksportów. Silnik zachowuje jawne ziarna starć do przywracania, ponownego rozpoczęcia i odtwarzania regresji. Nie usuwa to ziaren świata Experience, które mają inne zastosowanie.

## Zapis weryfikacji

Podstawowe `pnpm check`, obejmujące lokalizację, typy, lint i kompilacje produkcyjne, oraz `pnpm version:check` przeszły lokalnie. Zestaw Node obejmował 295 plików regresji; pięć uruchomiono ponownie z powodzeniem po tym, jak równoległa kompilacja chwilowo usunęła wygenerowane pliki. Po poprawkach z przeglądu ponowiono regresje walki, w tym przychodzące tagi walki, rozwój pogody poza walką, pościg z uwzględnieniem kosztów, konsekwencję decyzji zależną od trudności, zasoby reakcji i kontekst bossa.

Chromium na komputerze w jasnym motywie i mobilny Chromium w ciemnym motywie sprawdziły konfigurację i importy, oba tryby walki, pogodę z wyłączonymi animacjami, reakcje, przeładowania, zastępcze generowanie terenu i izolację przywróconych map. Lokalny mobilny WebKit nie mógł się uruchomić, ponieważ na hoście brakowało libicu74, libjpeg-turbo8, libmanette-0.2-0 i gstreamer1.0-libav; ta przeglądarka pozostaje elementem weryfikacji w CI lub ręcznie. PR zawiera końcowe wyniki przeglądu i powtórzonych testów map losowych.
