# Emulze — stručný princip

- **Vlny a míchací proud se počítají odděleně.** Hřebeny, odlesky a ostatní výškové efekty používají původní vlnění. Kapaliny a značky proudění unáší nový vír.
- Kroužení náklonu vytváří rotační sílu. Nerovnoměrná rychlost a vedlejší vír natahují obě složky do vláken; opačné kroužení obrátí směr a po zastavení proud dohasne.
- Materiál ukládá koncentraci tmavé složky `c` a světlé `1 − c`. Přenos MacCormack omezuje nechtěné rozmazávání.
- **Rychlé míchání postupně zvyšuje rozpustitelnost.** Výměna mezi sousedy přechází od udržování oddělených fází k promísení koncentrací. Tenká vlákna se rozpustí dříve, větší oblasti později; vzniká společná šedá.
- Dosažená rozpustitelnost se po zastavení nesnižuje. Nová porce ji vynuluje. GPU zachovává celkový plošný poměr složek, takže šedá neznamená ztrátu tmavé kapaliny.

Jde o **výtvarný 2D model**, nikoli skutečnou chemii oleje nebo úplnou simulaci dvou kapalin. Koncentrace se mění ve výpočtu, nejde o prolínání obrázku do šedi. Rozhraní nepůsobí silou zpět na proudění. Uchováváme plošný poměr, ne hmotnost v proměnlivé hloubce. Výkon nyní ustupuje vizuální kvalitě.

Pro porovnání: `?dissolve=0` zachová nové míchání bez rozpouštění, `?stir=0` vypne přidaný míchací proud. Před oddělením vln a rozpouštěním byl stav `377bd22`, před přidáním cirkulace `dc8c149`. Změny lze vracet samostatnými Git reverty.

Principy: [Cahn–Hilliard a volná energie, NIST](https://pages.nist.gov/pfhub/benchmarks/benchmark1.ipynb/), [přenos MacCormack, NVIDIA GPU Gems](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-30-real-time-simulation-and-rendering-3d-fluids). Používáme vlastní zjednodušenou a omezenou diskretizaci.
