# Boční displeje a napasování do 3D tisku

## Spuštění na iPadu

1. Sestavte aktuální aplikaci (`npm run build:ios`, potom Run v Xcode).
2. V nabídce **iPady** vyberte **Levý · informace o misi** nebo **Pravý · fáze a pokyny**.
3. Pro zkoušku vzhledu stiskněte **Spustit bez propojení**. Kód není potřeba, Bluetooth se nevyhledává. Boční iPad čte vlastní gyroskop a pravý displej po zvednutí spustí scénář. Volba přežije ukončení aplikace. Prostřední roli lze také spustit bez propojení.
4. Pro běžný provoz zvolte roli znovu, zadejte kód a stiskněte **Propojit přes Bluetooth**.

Ve všech nativních režimech je **vpravo dole** viditelné tlačítko **iPady**, kterým lze kdykoli přepnout na prostřední, levý, pravý nebo samostatný režim. Tlačítko má 64 × 44 bodů a je 12 bodů od bezpečného okraje; zůstává dostupné také při ztmavení a výpadku spojení.

## Kalibrace

- Na webu klepněte na viditelné tlačítko **Pozice a velikost** nad přepínačem displejů. V nativní aplikaci otevřete nabídku iPadů vpravo dole a vyberte **Kalibrace displeje · X / Y / velikost**, případně klepněte do **levého horního rohu** (neviditelná oblast 64 × 64 px).
- **X** posouvá celý návrh doprava/doleva, **Y** dolů/nahoru. Jednotkou jsou CSS pixely obrazovky; posun se nezvětšuje spolu s měřítkem.
- **Velikost** rovnoměrně mění celý návrh kolem jeho středu. 100 % je původních 744 × 1073 px z Figmy. Mezi texty, logem a grafickými prvky se nemění poměry.
- Hodnoty lze přímo zadat nebo upravovat tlačítky ±. Volba **Krok** nabízí 1/10/50 px a 0,1/1/5 %. Panel lze přesunout vlevo nebo vpravo; při otevření se objeví na protější straně od grafiky.
- **Skrýt** zavře veškeré ovládání. Uložení probíhá automaticky na daném iPadu, zvlášť pro levou a pravou roli. V případě nedostupného úložiště panel ukáže upozornění.
- Na konci opište nebo zkopírujte JSON z pole **Hodnoty pro nastavení výchozího rozložení**. Obsahuje roli, `x`, `y`, `scale` a rozměr obrazovky. Tyto hodnoty pak lze přepsat do `DISPLAY_DEFAULTS` v `lib/display-calibration.ts`. Do té doby zůstávají výchozí hodnoty 0 / 0 / 100 %.

Kalibrujte v konečné orientaci iPadu. Artboard je vycentrovaný v obrazovce a má pevné rozměry; změna orientace mění jeho střed, nikoli uložené měřítko. Rozložení se samo nepřizpůsobuje šířce displeje. Fyzický otvor určuje 3D tisk, aplikace nepřidává odhadnutou masku.

## Grafická předloha

Použité vrstvy ve [Figmě Designblok 26](https://www.figma.com/design/sUxmZReZMJJuCFsxLwVYp6/Designblok-26--UTB-?node-id=188-753): [levý displej 188:783](https://www.figma.com/design/sUxmZReZMJJuCFsxLwVYp6/Designblok-26--UTB-?node-id=188-783) a [pravý displej 188:754](https://www.figma.com/design/sUxmZReZMJJuCFsxLwVYp6/Designblok-26--UTB-?node-id=188-754).

Oba artboardy mají 744 × 1073 px. SVG v `native/web/artwork/` jsou exportované přímo z těchto vrstev se zapnutým převodem textů na křivky. Odstraněna je pouze zelená ochranná zóna pro výrobu. Geometrie, barvy (#0D0D0D, #CCCCCC, #5500FF, #C4432B), mezery i typografie standby stavu tak pocházejí přímo z návrhu. Originální písma jsou **Geist Mono Regular** (drobné texty 10/13/14 px) a **PP Neue Machina** (hlavní texty 14/24/25/40 px); logo DIGITÁL bylo již ve Figmě v křivkách. Samostatné fontové soubory pro tento stav nejsou potřeba.

## Scénář míchání

Nové obrazovky pocházejí z [Interakce_FlowMap 205:2702](https://www.figma.com/design/sUxmZReZMJJuCFsxLwVYp6/Designblok-26--UTB-?node-id=205-2702). Vektorové exporty zachovávají všechny titulky, QR kód, rozměry a původní fonty. Mění se pouze číselné hodnoty gyroskopu, hrudkovitost, stav míchání a odpočet; ty používají přibalený JetBrains Mono jako náhradu Geist Mono. Zelená výrobní zóna je odstraněna. Kalibrace platí pro všechny fáze najednou.

Průchod: **zvednutí → posádka detekována → autorizace udělena → rozhodni se → 3, 2, 1, start → analýza → úspěch / selhání → navazování kontaktu → vítejte na Digitálu**. V analýze se podle skutečného pohybu střídají pochvaly a výzvy k míchání. Závěrečné „spojení s kolonií“ patří do příběhu; není indikátorem Bluetooth.

Prozatímní časy a citlivost jsou soustředěné v `lib/mixing-scenario.ts`: potvrzení zvednutí 0,25 s, detekce 2 s, autorizace 1,2 s, rozhodnutí 2 s, odpočet 3 s + 0,6 s START, analýza **7 s**, výsledek 3 s, spojení 2,5 s. Úspěch vyžaduje pohyb alespoň polovinu analýzy. Vítejte zůstává nejméně 12 s a vrací se do standby po alespoň 8 s klidu. Samotný trvalý náklon bez pohybu míchání nepřičítá. Chybějící data pozastaví čas; uspání či odchod do pozadí scénář resetuje.

Hrudkovitost je vizuální ukazatel průběhu míchání, nikoli měření fyzikální simulace. Teplota a skořice zůstávají texty návrhu. Hodnoty X/Y/Z jsou skutečné úhly z Core Motion (roll/pitch/yaw) ve stupních; Z má relativní počátek při spuštění senzoru, nejde o kompas. Zobrazují se na dvě desetinná místa.

### Gyroskop a Bluetooth

Oba boční iPady mají zapnutý vlastní senzor i během hledání spojení. **Čerstvá Bluetooth data z prostředního iPadu mají přednost.** Pokud nedorazí 3 s nebo prostřední simulace hlásí nedostupnost, použije se lokální senzor. Po obnovení dat se prioritně použije prostřední iPad. Přepnutí zdroje zachová běžící scénář. Výpadek i lokálního senzoru skryje čísla namísto zobrazování starých hodnot.

Nativní protokol V2 přenáší všechny tři úhly, intenzitu pohybu, fázi a čas v původním limitu 20 bajtů na zprávu. Aktualizujte všechny tři iPady; nový přijímač umí i starší V1, u něhož nejsou dostupné všechny úhly. Uspání/probuzení připojených displejů dál řídí prostřední iPad, při výpadku spojení se boční displeje probudí a používají vlastní senzor.

### Zkouška a kalibrace scénáře

Otevřete kalibraci výše uvedeným ovládáním. Nahoře je **Zdroj dat**, volba konkrétní fáze (zastaví její náhled), **Ukázka: mícháš**, **Ukázka: nemícháš** a **Znovu podle gyroskopu**. Ukázky výslovně používají simulovaný pohyb, aby šly projít obě větve i na počítači. Volba ukázky ani zastavené fáze se neukládá; po restartu funguje skutečný senzor. Kalibrační X/Y/měřítko se nadále ukládá zvlášť pro každý boční displej. Webový náhled má navíc **Povolit gyroskop** pro mobilní prohlížeč s podporou Device Orientation.

## Náhled bez iPadu

Veřejné náhledy na GitHub Pages: [levý panel](https://mikstudio-pixel.github.io/Designblok-ADD-kase/displays/?display=left) a [pravý panel](https://mikstudio-pixel.github.io/Designblok-ADD-kase/displays/?display=right). Nasazují se automaticky spolu s prostřední simulací při aktualizaci `main`.

Na všech třech webových obrazovkách je malý přepínač **Levý / Střed / Pravý** vysoký 34 px. Na levém displeji je **vpravo dole**, na pravém a prostředním **vlevo dole**, aby na bočních displejích ležel proti grafice. Aktivní displej je zvýrazněný. Boční displeje mají hned nad přepínačem tlačítko **Pozice a velikost** pro nastavení X, Y a měřítka. Kalibrace každé strany zůstává uložená v prohlížeči. Nativní aplikace dál používá nabídku **iPady** vpravo dole.

```sh
npm run build:ios
python3 -m http.server 4173 --bind 127.0.0.1 --directory native/ios/Michas/Web
```

Otevřete `http://127.0.0.1:4173/?display=left` nebo `?display=right`. Parametr je pouze pro prohlížeč, nativně zvolená role má přednost. Pro rozměry iPadu 10 použijte náhled 820 × 1180 CSS px. Náhled ukládá vlastní kalibraci do prohlížeče; do fyzických iPadů ji nepřenáší.
