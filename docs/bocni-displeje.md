# Boční displeje a napasování do 3D tisku

## Spuštění na iPadu

1. Sestavte aktuální aplikaci (`npm run build:ios`, potom Run v Xcode).
2. V nabídce **iPady** vyberte **Levý · informace o misi** nebo **Pravý · fáze a pokyny**.
3. Pro zkoušku vzhledu stiskněte **Spustit bez propojení**. Kód není potřeba, Bluetooth se nevyhledává a displej zůstává ve stavu z referenčního obrázku. Volba přežije ukončení aplikace. Prostřední roli lze také spustit bez propojení.
4. Pro běžný provoz zvolte roli znovu, zadejte kód a stiskněte **Propojit přes Bluetooth**.

Ve všech nativních režimech je **vpravo dole** viditelné tlačítko **iPady**, kterým lze kdykoli přepnout na prostřední, levý, pravý nebo samostatný režim. Tlačítko má 64 × 44 bodů a je 12 bodů od bezpečného okraje; zůstává dostupné také při ztmavení a výpadku spojení.

## Kalibrace

- Klepněte do **levého horního rohu** (neviditelná oblast 64 × 64 px). Nebo otevřete nabídku iPadů vpravo dole a vyberte **Kalibrace displeje · X / Y / velikost**.
- **X** posouvá celý návrh doprava/doleva, **Y** dolů/nahoru. Jednotkou jsou CSS pixely obrazovky; posun se nezvětšuje spolu s měřítkem.
- **Velikost** rovnoměrně mění celý návrh kolem jeho středu. 100 % je původních 744 × 1073 px z Figmy. Mezi texty, logem a grafickými prvky se nemění poměry.
- Hodnoty lze přímo zadat nebo upravovat tlačítky ±. Volba **Krok** nabízí 1/10/50 px a 0,1/1/5 %. Panel lze přesunout vlevo nebo vpravo; při otevření se objeví na protější straně od grafiky.
- **Skrýt** zavře veškeré ovládání. Uložení probíhá automaticky na daném iPadu, zvlášť pro levou a pravou roli. V případě nedostupného úložiště panel ukáže upozornění.
- Na konci opište nebo zkopírujte JSON z pole **Hodnoty pro nastavení výchozího rozložení**. Obsahuje roli, `x`, `y`, `scale` a rozměr obrazovky. Tyto hodnoty pak lze přepsat do `DISPLAY_DEFAULTS` v `lib/display-calibration.ts`. Do té doby zůstávají výchozí hodnoty 0 / 0 / 100 %.

Kalibrujte v konečné orientaci iPadu. Artboard je vycentrovaný v obrazovce a má pevné rozměry; změna orientace mění jeho střed, nikoli uložené měřítko. Rozložení se samo nepřizpůsobuje šířce displeje. Fyzický otvor určuje 3D tisk, aplikace nepřidává odhadnutou masku.

## Grafická předloha

Použité vrstvy ve [Figmě Designblok 26](https://www.figma.com/design/sUxmZReZMJJuCFsxLwVYp6/Designblok-26--UTB-?node-id=188-753): [levý displej 188:783](https://www.figma.com/design/sUxmZReZMJJuCFsxLwVYp6/Designblok-26--UTB-?node-id=188-783) a [pravý displej 188:754](https://www.figma.com/design/sUxmZReZMJJuCFsxLwVYp6/Designblok-26--UTB-?node-id=188-754).

Oba artboardy mají 744 × 1073 px. SVG v `native/web/artwork/` jsou exportované přímo z těchto vrstev se zapnutým převodem textů na křivky. Odstraněna je pouze zelená ochranná zóna pro výrobu. Geometrie, barvy (#0D0D0D, #CCCCCC, #5500FF, #C4432B), mezery i typografie standby stavu tak pocházejí přímo z návrhu. Originální písma jsou **Geist Mono Regular** (drobné texty 10/13/14 px) a **PP Neue Machina** (hlavní texty 14/24/25/40 px); logo DIGITÁL bylo již ve Figmě v křivkách. Samostatné fontové soubory pro tento stav nejsou potřeba.

Při živém propojení pravý panel zachovává reakce na fáze míchání, ustálení a nedostupnosti simulace. Pro tyto doplňkové proměnlivé texty jsou připravené fontové rodiny Geist Mono a PP Neue Machina, zatím s náhradami JetBrains Mono a Helvetica Neue. Tyto další fáze nejsou exportem dalších scénářů z Figmy. Levý informační panel je statický. Uspání a probuzení připojených iPadů nadále řídí nativní aplikace.

## Náhled bez iPadu

Veřejné náhledy na GitHub Pages: [levý panel](https://mikstudio-pixel.github.io/Designblok-ADD-kase/displays/?display=left) a [pravý panel](https://mikstudio-pixel.github.io/Designblok-ADD-kase/displays/?display=right). Nasazují se automaticky spolu s prostřední simulací při aktualizaci `main`.

```sh
npm run build:ios
python3 -m http.server 4173 --bind 127.0.0.1 --directory native/ios/Michas/Web
```

Otevřete `http://127.0.0.1:4173/?display=left` nebo `?display=right`. Parametr je pouze pro prohlížeč, nativně zvolená role má přednost. Pro rozměry iPadu 10 použijte náhled 820 × 1180 CSS px. Náhled ukládá vlastní kalibraci do prohlížeče; do fyzických iPadů ji nepřenáší.
