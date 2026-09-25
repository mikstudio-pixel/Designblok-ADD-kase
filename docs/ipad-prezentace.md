# Prezentace na 3× iPad 10 (2022)

Připraveno pro tři iPady, 12 hodin provozu denně, nabíjení přes noc a jednu společnou powerbanku 20 000 mAh. Výdrž a skutečné senzory zatím nebyly změřeny na fyzickém zařízení.

## Co aplikace dělá

- Swift aplikace obsahuje stávající React/WebGL studii ve `WKWebView`. Web, písmo i grafika jsou součástí instalace; aplikace nepotřebuje server ani internet. Safari a webová verze zůstávají dostupné samostatně.
- V samostatné a prostřední roli se při spuštění automaticky zapne nativní snímání náklonu. První platný vzorek stanoví rovinu; iPad při spuštění položte do výchozí polohy. Dvojí klepnutí na mísu nastaví rovinu; s připojenou klávesnicí ji nastaví také C a O otočí osy. Boční role nespouštějí senzory ani WebGL simulaci.
- Aktivní jas je nastavený na 100 % systémového ovladače. Po probuzení pohybem nebo dotykem se obnoví maximum; při nečinnosti jas klesne na minimum.
- Po 30 sekundách bez smysluplného pohybu a bez dotyku obraz během dvou sekund plynule zčerná a systémový jas klesne na minimum. Nehybný iPad usne i tehdy, když zůstane nakloněný. Simulace se pozastaví už na začátku stmívání.
- V klidu se zruší plánování snímků, výpočty simulace, aktualizace textové miniatury a časovač diagnostiky. Gyroskopické slučování dat se vypne; zůstane pouze akcelerometr s požadavkem 5 vzorků/s. Do webu se v klidu neposílají pohybová data.
- Probuzení pohybem vyžaduje změnu alespoň 0,08 g oproti klidové poloze (při čistém náklonu přibližně 5°), potvrzenou alespoň 0,6 sekundy ve stejném směru. Jednotlivé otřesy a střídavé vibrace se nepočítají; citlivost náklonu při samotném míchání se nemění. Dotyk probouzí ihned, i v průběhu stmívání, a obnoví jas na 100 %. Dotyk probouzející černou plochu nemění ovládací prvky pod ní. Obsah kaše se zachová a doba klidu se nedopočítává.
- Za provozu je požadováno 30 vzorků náklonu/s a vykreslování nejvýše 30 fps. Výstupní obraz má nejvýše 1 pixel na CSS pixel a rozměr 1024 × 1024; výpočetní mřížka a fyzika se nemění. Část výpočtů fyziky proto i nadále běží se stejnou časovou přesností.
- Při odchodu aplikace do pozadí se zastaví všechny senzory a obnoví původní jas. Při návratu se aplikace probudí. Selhání senzoru ponechá ovládání a probuzení dotykem.

Čas nečinnosti a pracovní jas nastavíte před sestavením v `native/ios/Michas/Info.plist`: `KioskIdleSeconds` a `KioskActiveBrightness`. Citlivost pohybu je v `MotionActivity.swift`. Prvotní hodnoty je nutné ověřit na skutečném tácu: vibrace podložky mohou způsobovat nechtěná probuzení, velmi pomalý posun bez změny náklonu může zůstat nerozpoznán.

## Synchronizace tří iPadů přes Bluetooth LE

Všechny tři iPady používají stejné sestavení aplikace. Wi-Fi, internet, router ani další počítač pro provoz nejsou potřeba; **Bluetooth musí zůstat zapnuté**. Čerstvá instalace začíná v samostatném režimu, který Bluetooth nepoužívá.

1. Na prostředním iPadu klepněte na tlačítko **iPady** vpravo dole, vyberte **Prostřední · simulace** a zadejte šestimístný kód tácu.
2. Na levém vyberte **Levý · hodnoty**, na pravém **Pravý · fáze a pokyny**. Zadejte na nich stejný kód. Každý další tác musí mít jiný kód a právě jeden prostřední iPad.
3. Povolte aplikaci přístup k Bluetooth. Potvrďte případné systémové párování na obou zařízeních; během prvního připojení na něj aplikace čeká až minutu. Přenos stavů i požadavků na probuzení vyžaduje šifrované Bluetooth spojení.
4. Na prostředním iPadu ověřte **Připojené displeje: 2/2**. Levý ukazuje relativní aktivitu, náklon X/Y a čas simulace; pravý fázi a pokyn návštěvníkovi.
5. Role a kód zůstávají uložené pro příští spuštění. Boční displej si po prvním úspěšném přenosu pamatuje prostřední iPad. Při jeho výměně znovu nastavte roli a kód na bočních iPadech, čímž se uložená volba zruší. Samotný kód vybírá tác; nenahrazuje systémové párování.

Prostřední iPad je jediným zdrojem stavu, náklonu a simulace. V aktivním režimu posílá úplný stav přibližně 10× za sekundu, bez přenosu obrazu nebo celé fyzikální mřížky. Fáze **Připraveno / Mícháš / Zklidnění** se odvozují z aktivity stávajícího modelu, nejsou zatím autorským scénářem ani měřením fyzikálních jednotek. Klávesa R nebo vývojářský příkaz pro novou porci na prostředním resetuje i sdílené hodnoty a čas simulace.

Po 30 sekundách nečinnosti prostřední uspí celý tác. Boční iPady nemají vlastní pohybové snímání ani vlastní časovač usnutí. V klidu zůstává zpráva o stavu spojení přibližně jednou za sekundu a na prostředním snímání pohybu pro probuzení. Pohyb prostředního iPadu nebo dotyk černé plochy kteréhokoli připojeného iPadu probudí celý tác. Ztmavení stále není systémové zamknutí.

Při odpojení nebo přibližně třech až čtyřech sekundách bez platné nové zprávy boční displej skryje staré hodnoty a začne obnovovat spojení. Pokud byl ztmavený, zobrazí se informace o výpadku. Po připojení převezme aktuální stav. Při zastavení či pádu webové simulace prostřední označí data jako nedostupná; funkční Bluetooth samo nestačí k zobrazení starých hodnot jako živých. Odchod aplikace do pozadí spojení ukončí, návrat je obnoví. Systémové dialogy oprávnění a párování spojení neukončují.

Tlačítko **iPady** zůstává dostupné i při ztmavení a výpadku spojení. Před předáním návštěvníkům jeho oblast zablokujte v Asistovaném přístupu, pokud návštěvníci nemají měnit konfiguraci.

Technicky přenos používá nativní Core Bluetooth a most mezi Swiftem a lokálním webem. Stav má 20 bajtů: verzi, fázi, identifikátor relace, pořadové číslo, náklon, aktivitu, olej a čas simulace. Zpráva se vejde do minimální BLE velikosti bez fragmentace. Při zahlcení se uchovává pouze nejnovější neodeslaný stav pro každý displej. Náklon má rozlišení 0,001 a procentní ukazatele 1 %. Pole oleje je kvůli kompatibilitě protokolu zachované jako nula; současný model emulze samostatný olej nemá. Přesná současnost snímků tří obrazovek není garantovaná.

Před výstavou na všech třech fyzických iPadech ověřte první párování, připojení v různém pořadí, vypnutí/zapnutí Bluetooth, restart prostředního, výpadek jednoho bočního, uspání/probuzení dotykem na každém iPadu a několikahodinový provoz na finálním tácu. Tyto rádiové a energetické vlastnosti nelze potvrdit simulátorem.

## Ztmavení versus skutečné vypnutí displeje

iPad 10 používá LCD s LED podsvícením. Černá kresba sama podsvícení nevypíná. Veřejné API `UIScreen.brightness = 0` nastavuje **minimální jas**, nikoliv vypnutí panelu. Aplikace udržuje systém v popředí, aby mohla reagovat na pohyb. [Specifikace iPadu](https://support.apple.com/en-us/111840), [API jasu](https://developer.apple.com/documentation/uikit/uiscreen/brightness).

Skutečné systémové zamknutí vypne displej účinněji, ale aplikace pak nemá zaručené průběžné snímání a vlastní probuzení pohybem. Pro ten režim by se muselo akceptovat probuzení systémovým ovládáním iPadu. Tento obal používá ztmavení a funguje v popředí; nenahrazuje systémový spánek. [Systémový časovač](https://developer.apple.com/documentation/uikit/uiapplication/isidletimerdisabled), [Core Motion a životní cyklus](https://developer.apple.com/documentation/coremotion/getting-processed-device-motion-data).

## Instalace zdarma přes Xcode

Na tomto Macu je Xcode nainstalovaný. Není nutné placené členství; potřebujete vlastní Apple Account přihlášený v Xcode a přijetí bezplatné vývojářské dohody. Apple to označuje jako **Personal Team** a určuje pro instalaci a testování na vlastních zařízeních.

Aktuální limity jsou 3 registrovaná zařízení, 3 aplikace na zařízení a podpis platný **7 dní od vystavení profilu**. Potom je třeba aplikaci znovu sestavit a nainstalovat. Tyto tři iPady tedy vyčerpají limit zařízení, pokud už účet nemá další registrace. Odpojení od internetu ani ponechání aplikace otevřené nejsou řešením expirace. [Oficiální pravidla Apple](https://developer.apple.com/help/account/basics/about-your-developer-account/).

**Xcode 27 vyžaduje pro přímou instalaci a ladění na zařízení iPadOS 17 nebo novější.** Aplikace má minimální systém 16, ale iPad s iPadOS 16.4.1 se v Xcode 27 nenabídne jako instalační cíl. Před zapínáním Režimu vývojáře proto ověřte verzi systému a kompatibilitu Xcode. [Požadavky Xcode](https://developer.apple.com/xcode/system-requirements).

Pokud Finder hlásí **„Párování je zakázáno pravidly pro používání zařízení“**, instalaci blokuje správa zařízení. Správce musí povolit párování s daným Macem a ověřit povolení vývojových aplikací. Opakované potvrzování důvěry tuto zásadu nezmění. [Správa párování](https://support.apple.com/en-gb/guide/deployment/depf8a4cb051/1/web/1.0).

1. V kořeni projektu spusťte `npm ci` (pokud chybí závislosti) a `npm run build:ios`. Tím se vytvoří lokální web v `native/ios/Michas/Web/`.
2. Otevřete `native/ios/Michas.xcodeproj` v Xcode.
3. V **Xcode → Settings → Apple Accounts** přidejte svůj Apple Account (ve starších verzích **Accounts**).
4. U cíle **Michas → Signing & Capabilities** ponechte **Automatically manage signing**, vyberte svou **Personal Team**. Pokud Xcode odmítne výchozí identifikátor `cz.designblok.michas`, změňte **Bundle Identifier** na vlastní unikátní hodnotu.
5. Připojte první iPad datovým USB-C kabelem, odemkněte ho a potvrďte důvěru Macu.
6. Pokud Xcode vyžádá **Developer Mode**, zapněte ho na iPadu v **Nastavení → Soukromí a zabezpečení → Režim vývojáře**, restartujte a potvrďte. Volba se může objevit až po spárování s Xcode. [Postup Apple](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device).
7. V Xcode vyberte připojený iPad jako cíl a spusťte **Run**. Případnou důvěru vývojářskému profilu potvrďte v Nastavení iPadu podle hlášky systému.
8. Ověřte funkčnost, ukončete ladění v Xcode a spusťte aplikaci ikonou na iPadu. Opakujte pro zbývající dva iPady.
9. Nainstalujte čerstvé sestavení těsně před akcí a ověřte platnost profilu. Pokud akce přesahuje sedmidenní okno, počítejte s novým podpisem a instalací přes Mac.

Při úpravě webu zopakujte `npm run build:ios`, potom Run v Xcode. Při změně pouze Swiftu nebo Info.plist stačí nové sestavení v Xcode. Vygenerovaný web a osobní podpisové údaje se necommitují.

## Placené možnosti

| Cesta | Co vyžaduje | Kdy dává smysl |
| --- | --- | --- |
| Personal Team | Bezplatný Apple Account, Mac, Xcode, opakovaná instalace po 7 dnech | Příprava a test na těchto třech iPadech |
| Placené členství + přímá / Ad Hoc instalace | Apple Developer Program, registrace zařízení, podepsaný profil | Delší instalace na konkrétních iPadech bez zveřejnění v App Storu |
| TestFlight | Placené členství, App Store Connect, aplikace TestFlight | Pohodlné rozesílání testovacích verzí; jedno sestavení platí nejvýše 90 dní |
| App Store | Placené členství, kompletní distribuční podklady a schválení | Dlouhodobá veřejná distribuce |

Apple Developer Program stojí **99 USD za rok**, případně lokální cenu uvedenou při registraci. Pro naše konkrétní iPady bych při delší akci zvolil přímou instalaci. Ad Hoc podporuje až 100 iPadů za členský rok; je nutné sledovat skutečné datum expirace podepisovacího profilu a certifikátu. TestFlight je testovací distribuce a první externí sestavení prochází kontrolou Apple. Configurator samotný nezruší požadavek na platný podpis. [Členství](https://developer.apple.com/programs/enroll/), [registrovaná zařízení](https://developer.apple.com/help/account/devices/devices-overview), [TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/).

## Jak zabránit návštěvníkovi odejít z aplikace

Pro tři iPady s obsluhou doporučuji **Asistovaný přístup (Guided Access)**. Nevyžaduje placený vývojářský účet.

1. Na iPadu zapněte **Nastavení → Zpřístupnění → Asistovaný přístup** a nastavte kód známý pouze obsluze.
2. Pro tento režim nastavte **Automatické zamykání displeje → Nikdy**, pokud je volba dostupná. Řízení klidu přebírá aplikace.
3. Spusťte aplikaci, ověřte náklon a nastavte rovinu.
4. Třikrát stiskněte horní tlačítko, zvolte Asistovaný přístup a spusťte relaci.
5. **Pohyb ponechte zapnutý. Dotyk ponechte zapnutý**, protože slouží i k probuzení. Lze zakázat horní tlačítko a tlačítka hlasitosti; nepotřebné ovladače aplikace můžete označit jako neaktivní oblasti.
6. Zkuste gesto Domů, Ovládací centrum a přepínač aplikací. Ověřte také probuzení pohybem a dotykem při běžící relaci. Pro ukončení použije obsluha trojí stisk a kód.

Jde o omezení poskytované systémem. Samotná aplikace nemůže spolehlivě zablokovat odchod ani vynutit kiosk režim na běžném osobním iPadu. [Návod Apple v češtině](https://support.apple.com/cs-cz/111795).

Pro trvalý kiosk je silnější **Single App Mode** přes Apple Configurator na spravovaném (supervised) iPadu. Po restartu automaticky otevírá zvolenou aplikaci. Ruční přepnutí dosud nespravovaného iPadu pod supervision vyžaduje jeho vymazání; na zapůjčených nebo osobních iPadech to není první volba. Placený vývojářský účet není totéž co správa zařízení: ani Single App Mode neřeší expiraci podpisu aplikace. [Single App Mode](https://support.apple.com/guide/apple-configurator-mac/cadbf9c172/mac), [supervision a vymazání](https://support.apple.com/guide/deployment/dep1d89f0bff/web).

## Energetický rozpočet a provozní zkouška

Každý iPad 10 má jmenovitě **28,6 Wh**, tři nové baterie tedy celkem **85,8 Wh**. Apple uvádí až 10 hodin webu nebo videa; to není měření této WebGL simulace. Stav baterií z roku 2022 může dostupnou energii snížit. [Specifikace](https://support.apple.com/en-us/111840).

Powerbanka 20 000 mAh by při jmenovitém napětí článků 3,7 V měla **74 Wh**. Jde o předpoklad: správná hodnota je údaj Wh na jejím štítku. Po započtení ztrát dodá méně, ne energii pro tři plná dobití. Součet nových iPadů a této powerbanky je ideálně 159,8 Wh. Pro 3 × 12 hodin to dává horní mez **4,44 W průměrně na iPad**, ještě před ztrátami a rezervou. Reálný dostupný rozpočet je nižší.

Z kapacity samotné proto nelze potvrdit 12 hodin. Rozhoduje poměr doby manipulace a klidu, jas, kondice baterií a výkon nabíjení. U powerbanky ověřte počet portů a **celkový souběžný výkon**, nejen maximum jednoho USB-C portu. Pokud používáte jeden port, je potřeba iPady během dne v nabíjení střídat; běžný USB rozbočovač nezaručí odpovídající nabíjení všech tří.

Pro provozní zkoušku:

1. Nainstalujte finální verzi, nabijte všechny iPady i powerbanku a odpojte ladicí kabel. Ověřte studený start bez Wi-Fi. Pro synchronizaci musí být Bluetooth zapnuté; při použití režimu Letadlo ho znovu zapněte. Vypnout Bluetooth lze jen v samostatném režimu.
2. Na skutečné podložce otestujte alespoň 30 minut klidu, včetně okolních vibrací. Displej musí zůstat černý a iPad se nesmí samovolně probouzet. Pak proveďte opakované pomalé zvednutí, naklonění a probuzení dotykem.
3. Spusťte delší aktivní úsek při plánovaném jasu a zaznamenejte úbytek baterie, teplotu a plynulost. Samostatně změřte klidový úsek. Krátké měření podle procent baterie je pouze orientační.
4. Udělejte celou 12hodinovou generálku s realistickým střídáním návštěvníků, zapnutým Asistovaným přístupem a plánovaným rozdělením powerbanky. Cílem je alespoň 15–20 % zbývající rezervy. Teprve toto měření potvrdí, zda jedna powerbanka stačí.

## Vývojářské ověření

`npm test` ověřuje webové i nativní vstupy, kalibraci, orientaci, uspání a plánování snímků. `npm run test:ios-motion` na Macu ověřuje potlačení šumu, pomalé naklánění, setrvání v náklonu a pohybové impulzy. `npm run test:ios-sync` ověřuje přesný formát Bluetooth zpráv, mezní hodnoty, neplatná data, stáří zpráv, jejich pořadí a restart zdroje. `npx tsc --noEmit` kontroluje typy.

`npm run build:ios` vytváří samostatný offline web. Xcode projekt lze sestavit pro simulátor bez účtu:

```sh
xcodebuild -project native/ios/Michas.xcodeproj -scheme Michas \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath native/ios/build CODE_SIGNING_ALLOWED=NO build
```

Simulátor nemá fyzický akcelerometr. Jeho hláška o nedostupném senzoru je očekávaná; může ověřit načtení webu a probuzení dotykem, nikoliv výdrž, skutečný jas panelu nebo správnost fyzických os. Kalibraci, všechny čtyři směry náklonu a skutečné uzamčení prezentace ověřte na všech třech iPadech.

Ověření při přípravě: 21 testů JavaScriptu/TypeScriptu, testy detekce pohybu ve Swiftu, typová kontrola, webový build, offline build a sestavení pro simulátor i zařízení bez podpisu prošly. V simulátoru bylo vizuálně ověřeno načtení a automatické ztmavení. Automatizované klikání do okna simulátoru nebylo dostupné (`noWindowsAvailable`), takže probuzení skutečným dotykem zbývá ověřit ručně. Lint změněných souborů prošel; celkový lint má existující chyby v obecných UI komponentách a `use-mobile.ts`.

Ověření synchronizace (22. 9. 2026): testy zpráv ve Swiftu, stávajících 21 testů vstupů a snímkové smyčky, testy nativního pohybu, TypeScript a lint změněného webového kódu prošly. Offline web i nativní sestavení pro simulátor a zařízení bez podpisu prošly. V iPad simulátoru bylo ověřeno nastavení kódu a přepínání bočních rolí. Náhled s testovacími daty ověřil oba displeje, ztrátu a obnovu hodnot i absenci grafických kontextů a požadavků na senzory v bočních rolích. Fyzické Bluetooth párování, společné probouzení přes rádio, dosah a výdrž zůstávají k ověření na skutečných iPadech.

## Aktuální rozhraní v nativní aplikaci

Nativní prostřední a samostatný režim používají přímo stejnou komponentu `app/page.tsx` jako současná webová instalace: středovou mísu s oranžovými indikátory, která vyplní kratší stranu displeje s okrajem nejméně 16 px. Nastavení vlevo a živé hodnoty vpravo jsou po spuštění sbalené; otevřou se klepnutím na příslušný nadpis. Model kapaliny vychází z `aee9877`; starší pohybová studie `BowlPreview` se do sestavení nebalí. Nativní senzory se zapnou automaticky, webové hledání aktualizací se v offline obalu nespouští.

Ověření 24. 9. 2026: prošlo všech 27 testů JavaScriptu/TypeScriptu, testy pohybu a Bluetooth zpráv ve Swiftu, typová kontrola a lint změněných souborů. Offline web a podepsané sestavení Release prošly. Sestavení 2 bylo nainstalováno a spuštěno na fyzickém iPadu 10. generace. Náhled s nativním mostem ověřil zastavení snímků a publikování při uspání i jejich obnovení po probuzení. Obsluha na fyzickém iPadu potvrdila správné rozhraní i maximální jas při probuzení pohybem. Spojení všech tří zařízení dosud nebylo ověřeno.

Sestavení 3 zvětšuje mísu a standardně sbaluje nastavení i živé hodnoty. Rozložení, velikost mísy a rozbalování panelů byly ověřeny v náhledu na šířku i na výšku. Typová kontrola, lint, offline i podepsaný nativní build prošly; sestavení bylo nainstalováno a spuštěno na připojeném iPadu.

Sestavení 5 (25. 9. 2026) navazuje na sestavení 4, přidává dvousekundové stmívání a samostatný filtr probouzení. Testy pokrývají drobné vibrace, jednotlivé i opakované impulzy, střídavé chvění, souvislý a pomalý náklon, klid v nakloněné poloze i výpadky vzorků. Pohybové a synchronizační testy, offline build a podepsaný nativní build prošly; instalace a spuštění na iPadu byly úspěšné. Pocit z přechodu a citlivost na finálním stole je potřeba ověřit fyzicky.
