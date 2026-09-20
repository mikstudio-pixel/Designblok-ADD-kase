# Emulze — stručný princip

- **Vlny a míchací proud se počítají odděleně.** Hřebeny a odlesky používají původní vlnění. Kapaliny a značky proudění unáší nový vír.
- Kroužení náklonu vytváří rotační sílu. Nerovnoměrná rychlost a vedlejší vír natahují obě složky do vláken; opačné kroužení obrátí směr a po zastavení proud dohasne.
- **Hřebeny se rozsvěcují automaticky:** rychlé kroužení je jemně nastartuje, sjednocení skutečné barvy směsi je vytáhne na maximum. Při oddělování barev zase plynule slábnou. Míru promísení měří rozptyl koncentrace na GPU.
- Materiál ukládá koncentraci tmavé složky `c`, světlé `1 − c` a místní historii míchání. Proud unáší koncentraci i tuto historii; přenos MacCormack omezuje nechtěné rozmazávání.
- **Rozpouštění je místní a plynulé.** Roste podle natahování a smyku proudu, rychlosti kroužení a kontaktu barev. Samotné posouvání nebo pevné otáčení směsi nestačí. Aktivní vlákna se mohou už spojovat do šedi, zatímco klidnější velké oblasti zůstávají oddělené; žádná společná hodnota nepřepne celou mísu najednou.
- **V klidu se rozpustitelnost snižuje** (časová konstanta 28 sekund místo původních 45). Ze směsi opět vyrostou světlé a tmavé oblasti, které lze znovu promíchat.
- **Spojování působí i na širší okolí.** Drobné kapky se rychleji sdružují do větších celků; u už vytvořených hran se tento vliv tlumí, aby zůstaly ostré. Při rychlém kroužení se přidané spojování vypíná. Jde o výměnu koncentrace, nikoli rozmazání výsledného obrazu.
- **Slabá protiváha brání přílišnému zjednodušování.** Krátký dosah dál spojuje drobné kapky, širší okolí mírně potlačuje přerůstání jednolitých ploch. Dva širší dosahy a hladce nepravidelná síla zachovávají různě velké tvary. Při míchání a rozpuštění vliv slábne; nic nepřekresluje původní obrázek.
- I dokonale jednolitou šeď rozruší drobné hladké zárodky v chemickém potenciálu. Vzniká nový nepravidelný obrazec; původní obrázek se neobnovuje. GPU zachovává plošný poměr obou složek.

Jde o **výtvarný 2D model**, nikoli skutečnou chemii oleje nebo úplnou simulaci dvou kapalin. Koncentrace se mění ve výpočtu, nejde o prolínání obrázku do šedi. Rozhraní nepůsobí silou zpět na proudění. Uchováváme plošný poměr, ne hmotnost v proměnlivé hloubce. Výkon nyní ustupuje vizuální kvalitě.

Jde o výtvarnou inspiraci [principem Ohta–Kawasakiho modelu](https://www.aimspress.com/article/doi/10.3934/era.2022081): používáme vlastní dvě konečně široká jádra a prostorově proměnlivou sílu, nikoli přesné řešení jeho rovnice.

Pro porovnání: `?organic=0` vypne jen novou protiváhu (stav před ní: `a3d5acd`). `?dissolve=0` zachová nové míchání bez rozpouštění, `?stir=0` vypne přidaný míchací proud. Před zesílením spojování byl stav `37f7f34`, před přidáním návratu do dvou fází `45731c1`. Před oddělením vln a rozpouštěním byl stav `377bd22`, před přidáním cirkulace `dc8c149`. Změny lze vracet samostatnými Git reverty.

Principy: [Cahn–Hilliard a volná energie, NIST](https://pages.nist.gov/pfhub/benchmarks/benchmark1.ipynb/), [přenos MacCormack, NVIDIA GPU Gems](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-30-real-time-simulation-and-rendering-3d-fluids). Používáme vlastní zjednodušenou a omezenou diskretizaci.
