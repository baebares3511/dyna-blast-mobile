# DYNA BLAST — MOBILE

Zręcznościowa gra w stylu klasycznego Dyna Blaster / Bomberman na Androida (orientacja pozioma).
Cała grafika (pixel-art), dźwięki i muzyka są generowane w kodzie — gra nie zawiera żadnych
zewnętrznych assetów ani materiałów z oryginalnej gry.

## 📲 Pobierz na telefon

* **Android (APK):** [**pobierz najnowszą wersję DynaBlast.apk**](https://github.com/baebares3511/dyna-blast-mobile/releases/latest/download/DynaBlast.apk)
  — otwórz link na telefonie, uruchom pobrany plik i zezwól na instalację z tego źródła.
  Nowe wersje instalują się jako aktualizacja (dane i statystyki zostają).
  Wszystkie wersje: zakładka [Releases](https://github.com/baebares3511/dyna-blast-mobile/releases).
* **iPhone / iPad** (plik APK działa tylko na Androidzie — na iOS gra instaluje się z Safari):
  1. Otwórz w **Safari** <https://baebares3511.github.io/dyna-blast-mobile/>
  2. Stuknij **Udostępnij** (kwadrat ze strzałką) → **Do ekranu początkowego** → **Dodaj**.
  3. Uruchamiaj grę ikoną z ekranu głównego — działa na pełnym ekranie, poziomo, także bez
     internetu (internet potrzebny tylko do gry online). Aktualizacje pobierają się same.
  Wskazówka: dźwięk na iPhonie nie gra, gdy włączony jest przełącznik wyciszenia z boku telefonu.
* **Komputer / dowolny telefon bez instalacji:** ten sam link w przeglądarce
  (w Chrome na Androidzie i komputerze pojawi się też przycisk **ZAINSTALUJ GRĘ**).

Gracze z APK, z iPhone'a i z przeglądarki mogą grać razem w jednym pokoju online.

## Tryby gry

| Tryb | Opis |
|---|---|
| **PRZYGODA** | kampania z fabułą: **5 światów × 5 etapów**, na końcu każdego świata **boss**. Na etapie pokonaj potwory, znajdź ukryte pod skrzynką **wyjście**. Po utracie wszystkich żyć — **kontynuacja od początku świata** (punkty od zera). Ranking 8 najlepszych wyników |
| **GRA Z BOTAMI** | 1–3 boty, poziom ŁATWY / NORMALNY / TRUDNY / MIESZANY, mapa, mecz do 1/3/5 wygranych |
| **MULTIPLAYER → JEDEN EKRAN** | dwóch ludzi na jednym urządzeniu, opcjonalnie +1–2 boty |
| **MULTIPLAYER → UTWÓRZ POKÓJ / DOŁĄCZ** | **do 4 graczy** na osobnych telefonach przez Wi-Fi lub Internet (4-znakowy kod pokoju); wolne miejsca mogą zająć boty |

## Przygoda

* **Światy:** Zielone Wzgórza → Piaszczyste Wydmy → Lodowe Szczyty → Stalowa Fabryka (taśmociągi) →
  Cytadela Mroku (portale). Każdy ma własne potwory i bossa: Król Balonów, Skarabeusz (szarżuje),
  Mroźny Golem (lodowe bomby z nieba), Mecha-Bomber (podkłada bomby), Cesarz Mrok (teleportuje się,
  przyzywa duszki, gasi światło). Bossa ranią tylko płomienie gracza; po trafieniu chwilę miga.
* **Poziom trudności przygody:** ŁATWY — 5 żyć, po śmierci bonusy zostają, wolniejsze potwory;
  NORMALNY — 3 życia, tracisz połowę ulepszeń (oraz zapalnik i przebicie);
  TRUDNY — 3 życia, tracisz wszystkie ulepszenia, szybsze potwory, silniejsi bossowie.
* Na każdym etapie 3–5 bonusów, **gwarantowany SPEED co 3 etapy**; dopóki nie masz speeda,
  żaden potwór nie jest szybszy niż *(twoja prędkość − 0,2)*. Wchodząc do nowego świata dostajesz
  minimalny zestaw ulepszeń, więc kontynuacja nigdy nie zaczyna się od 1 bomby.
* Zbombardowanie odsłoniętego wyjścia sprawia, że gdy ogień zgaśnie, **z drzwi wychodzą** 2 potwory-kara:
  przez chwilę są odporne na ogień i **nie dają punktów** (tak samo potwory z dogrywki i przyzwane przez bossa).

## Postacie

Wybór w przygodzie i we wszystkich meczach — każda postać ma jedną cechę specjalną:
BOMBER (+1 bomba), IGNIS (+1 zasięg), ZEFIR (+1 speed), KOPACZ (kopie od startu),
BASTION (tarcza na start rundy), WIDMO (odporne na klątwy). Boty losują pozostałe postacie.

## Boty

| Umiejętność | ŁATWY | NORMALNY | TRUDNY |
|---|---|---|---|
| refleks / precyzja | wolny, myli się | dobry | bardzo szybki |
| kopanie bomb | nie | w obronie i gdy bomba leży obok | także specjalnie podchodzi, by kopnąć bombę w przeciwnika |
| przewidywanie toru kopniętych / niesionych taśmą bomb | nie | tak | tak |
| portale | omija | używa | używa (także do pościgu) |
| zamykanie przeciwnika w ślepym zaułku | nie | czasem | celowo |
| czaszki | wchodzi na nie | omija | omija |

## Urozmaicenia rozgrywki

* **Bonusy:** +1 bomba, zasięg, speed, kopanie bomb, zdalny zapalnik, **tarcza** (chroni przed jednym
  trafieniem), **przebijający ogień** (płomień przechodzi przez skrzynki), **maksymalny ogień**
  (rzadki) i **czaszka-klątwa** (losowo: spowolnienie, nadpobudliwość, odwrócone sterowanie,
  bombowa biegunka, brak bomb, słaby ogień, krótki lont — przenosi się dotykiem na innych!).
* **Areny ze specjalnymi polami:** **PORTALE** (pary teleportów — przenoszą też kopnięte bomby)
  i **TAŚMOCIĄGI** (przesuwają graczy i bomby). Razem 8 aren + generator proceduralny.
* **Wydarzenia w trakcie rundy** (można wyłączyć w ustawieniach meczu): *Deszcz bomb*, *Deszcz bonusów*,
  *Turbo*, *Ciemność*, *Mury odrastają* — co ok. 25–30 s.
* **Muzyka:** 5 autorskich utworów (menu, dwa bitewne, przygoda, boss). W *Ustawienia → MUZYKA W GRZE*
  można wybrać ORYGINALNĄ, KLASYCZNĄ lub MIESZANĄ. Klasyczna to chiptune'owe aranżacje: Mozart (Marsz turecki),
  Vivaldi (Wiosna), Bach (Badinerie), Beethoven (Oda do radości), Grieg (W grotach Króla Gór)
  i Chopin (Marsz żałobny — przy bossach). Tytuł utworu pojawia się podczas odliczania.

## Sterowanie

* **Telefon:** D-pad lub joystick + przycisk **BOMBA**; z zapalnikiem pojawia się **BUM!**.
  W *Ustawienia → DOTYK*: D-pad/joystick, rozmiar, strona przycisku bomby, przezroczystość.
* **Klawiatura — domyślnie:** gracz 1: `WASD` ruch, `Spacja` bomba, **`Lewy Shift` zapalnik**;
  gracz 2: strzałki, `Enter`, **`Prawy Shift`**. Gdy gra jedna osoba, działają oba zestawy.
  Wszystkie klawisze można zmienić w *Ustawienia → KLAWIATURA*. `Esc` — pauza.
* Z zapalnikiem: naciśnięcie BOMBY, gdy nie masz już wolnych bomb, też odpala bomby.
## Uruchomienie na komputerze (najprościej)

**Kliknij dwukrotnie plik `GRAJ.html`** — otworzy się w przeglądarce (Chrome / Edge / Firefox) i od razu
można grać (klawiatura lub myszka). Nie potrzeba serwera ani instalowania czegokolwiek.

`GRAJ.html` to jeden plik ze wszystkim w środku, generowany z folderu `www/`. Po zmianach w kodzie
odśwież go poleceniem:

```bash
py scripts/build-standalone.py
```

(Plik `www/index.html` wymaga serwera — przeglądarki blokują moduły JS otwierane jako plik.
Serwer deweloperski: `py scripts/devserver.py 8765` → `http://localhost:8765`. Na telefonie w tej
samej sieci Wi-Fi: `http://<IP-komputera>:8765`.)

## Budowanie pliku APK

Projekt jest gotowy do spakowania [Capacitorem](https://capacitorjs.com) (`www/` = cała gra).

### A) W chmurze — automatycznie (GitHub Actions)
Każdy push na `main` uruchamia dwa procesy:
* **Build APK** (`.github/workflows/build-apk.yml`) — buduje APK i publikuje go jako nowe
  wydanie w *Releases* (`DynaBlast.apk`, wersja `1.<numer buildu>`). APK jest podpisywany zawsze tym
  samym kluczem (`signing/debug.keystore`, tworzony przy pierwszym buildzie), więc aktualizacje
  instalują się na poprzednią wersję. Ręcznie: **Actions → Build APK → Run workflow**.
* **Web version** (`.github/workflows/pages.yml`) — publikuje folder `www/` na GitHub Pages.

### B) Lokalnie (Node 18+, JDK 17, Android Studio / Android SDK 34)
```bash
npm install
npm run android:add
npm run android:build
```
APK: `android/app/build/outputs/apk/debug/app-debug.apk`. Można też otworzyć projekt w Android
Studio: `npm run android:open`. Skrypt `scripts/patch-android.mjs` ustawia orientację poziomą,
pełny ekran (immersive) i blokadę wygaszania ekranu.

Po zmianach w `www/` wystarczy `npm run android:sync` i ponowny build.

## Multiplayer — jak to działa

* Jak zagrać: jedna osoba wybiera **MULTIPLAYER → UTWÓRZ POKÓJ** i podaje innym 4-znakowy kod,
  pozostali (do 3 osób) wybierają **DOŁĄCZ**. Lobby pokazuje, kto już jest w pokoju; host
  ustawia mapę, długość meczu i to, czy wolne miejsca mają zająć boty, potem **START!**
* Architektura **host-autorytatywna**: host liczy całą symulację (bomby, eksplozje, power-upy,
  śmierci, boty) i 30× na sekundę wysyła stan planszy do gości. Każdy gość przewiduje lokalnie tylko
  ruch własnej postaci (dzięki temu sterowanie jest natychmiastowe), host to weryfikuje.
  Wszyscy widzą ten sam stan planszy, bomb, płomieni i bonusów.
* **Kanał zapasowy:** gdy bezpośrednie połączenie nie powstanie w ~7 s (typowe między iPhone'em
  a Androidem — Safari ukrywa adresy w sieci lokalnej), gra sama łączy się przez publiczny serwer
  MQTT (HiveMQ, awaryjnie EMQX). W lobby taki gracz ma dopisek **PRZEZ SERWER**. Działa w każdej
  sieci, kosztem nieco większego opóźnienia (ruch własnej postaci nadal jest natychmiastowy).
* Gdy gość wyjdzie lub straci połączenie, jego bombera przejmuje bot i gra toczy się dalej.
  Do trwającej gry nie można dołączyć (pokój przyjmuje graczy tylko w lobby).
* Transport: WebRTC (biblioteka PeerJS). Publiczny serwer PeerJS służy wyłącznie do „przedstawienia”
  sobie urządzeń po kodzie pokoju — potem dane płyną bezpośrednio między telefonami (w tej samej
  sieci Wi-Fi zostają w sieci lokalnej). **Do zestawienia połączenia potrzebny jest dostęp do
  Internetu.** W rzadkich sieciach z restrykcyjnym NAT (np. niektóre sieci komórkowe) bezpośrednie
  połączenie może się nie udać — wtedy najlepiej grać w tej samej sieci Wi-Fi.
* Rewanż startuje, gdy zgodzą się wszyscy ludzie w pokoju (licznik „gotowi x/y”).
  Gdy host wyjdzie, gra kończy się u wszystkich (komunikat + powrót do menu).

## Architektura kodu

```
www/
  index.html, css/style.css      UI (menu, HUD, nakładki)
  js/main.js                     powłoka aplikacji: pętla 60 FPS, nawigacja, layout
  js/config.js                   wszystkie stałe balansu (czasy, prędkości, limity)
  js/core/       rng.js (seedowany PRNG), storage.js (ustawienia + statystyki)
  js/game/       czysta symulacja, bez grafiki/dźwięku:
                 board.js (siatka), maps.js (areny + generator proceduralny),
                 player.js (ruch po siatce z "corner assist", kopanie bomb),
                 bomb.js, explosion.js (zasięg, łańcuchy), powerups.js (rejestr bonusów),
                 monsters.js (potwory trybu Przygoda), boss.js (bossowie),
                 campaign.js (światy, fabuła, zasady trudności przygody),
                 game.js (runda: zasady, zwycięstwo, "POŚPIESZ SIĘ!")
  js/ai/         danger.js (mapa zagrożeń z czasem i reakcjami łańcuchowymi, BFS z timingiem),
                 bot.js (decyzje bota + profile trudności)
  js/session/    session.js (runda/mecz/rewanż, lokalnie i sieciowo), controllers.js
  js/net/        peer.js (WebRTC/PeerJS), snapshot.js (serializacja stanu)
  js/render/     sprites.js (proceduralny pixel-art), renderer.js, particles.js,
                 extras.js (portale, taśmy, wyjście, potwory, ciemność)
  js/audio/      audio.js (syntezowane SFX), music.js (sekwencer chiptune + autorskie utwory)
  js/input/      input.js (D-pad / joystick / klawiatura)
  js/ui/         ui.js (ekrany), hud.js
```

### Rozszerzanie
* **Nowa mapa:** dopisz obiekt do `MAPS` w `js/game/maps.js` (układ 15×13: `#` ściana,
  `+` zawsze skrzynia, `.` zawsze pusto, spacja = losowa skrzynia) i opcjonalnie motyw w `THEMES`.
* **Nowy power-up:** wpis w `POWERUPS` (`js/game/powerups.js`) z funkcją `apply(player)` +
  ikona w `ICONS` (`js/render/sprites.js`).
* **Nowa postać / kolor:** `PLAYER_STYLES` w `js/config.js` (sprite generuje się automatycznie).
* **Więcej graczy:** `SPAWNS` / `SPAWN_ORDER` + większa siatka (`GRID_W/GRID_H`).
* **Nowy typ bomby / kampania:** symulacja jest odseparowana (`Game` przyjmuje konfigurację rundy,
  zdarzenia trafiają do `game.events`), więc nowe zasady nie wymagają zmian w renderze ani sieci.

## Znane ograniczenia
* Czcionka „Press Start 2P” ładuje się z Google Fonts; bez Internetu gra używa czcionki zastępczej
  (monospace) — działa, tylko wygląda mniej retro.
* Tryb sieciowy: maksymalnie 4 bomberów (host + do 3 gości, wolne miejsca — boty). Wyjście hosta kończy mecz.
