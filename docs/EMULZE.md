# Emulze — vizuální prototyp

- Černé čtverečky, zrnka a dekorativní bublinky jsou odstraněné.
- Místo barevné textury počítáme podíl tmavé kapaliny `c` a světlé `1 − c`.
- Kroužení náklonu vytváří skutečnou rotační sílu ve společném poli rychlosti. Nerovnoměrná rotace a pohyblivý vedlejší vír natahují rozhraní do pruhů a vláken.
- Opačné kroužení obrátí proud; při zastavení síla dohasne. Samotný držený náklon trvalý vír nevytváří. Přesnější přenos omezuje rozmazávání vláken.
- Model inspirovaný Cahn–Hilliardovou rovnicí udržuje oddělené fáze a zaobluje jejich rozhraní. Dotýkající se kapky si mohou rozšířit společný krček.
- GPU průběžně kontroluje a opravuje poměr ploch obou složek. Směs se nevrací k původnímu obrázku a tmavá složka se neztrácí do šedi.
- Odlesky reagují na vlny i na hranici kapalin. Laser a volitelné efekty zůstávají.

Je to **stylizovaný 2D materiál ve společném proudění**, nikoli úplná simulace dvou různě hustých kapalin. Síly rozhraní zatím nepůsobí zpět na vlny. Materiál i vlny používají stejné rychlostní pole. Síla kroužení je výtvarně navržená odezva na gesto, ne přesná rekonstrukce pohybu tácu. Uchováváme plošný poměr, ne skutečnou hmotnost v proměnlivé hloubce. Výchozí režim je **Detailní**; výkon této varianty zatím neladíme.

Opravená kruhová stěna zůstává; silnější cirkulace používá menší časový krok. Parametr `?stir=0` vypne novou rotační sílu pro porovnání. Před přidáním cirkulace byl stav `dc8c149`; samostatný commit umožňuje její vrácení. Materiál je soustředěný v `lib/emulsion.ts`; předchozí varianta je v Gitu na `766e55b` a dá se obnovit revertem commitu s emulzí.

Principy: [Cahn–Hilliard a volná energie, NIST](https://pages.nist.gov/pfhub/benchmarks/benchmark1.ipynb/), [přenos MacCormack, NVIDIA GPU Gems](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-30-real-time-simulation-and-rendering-3d-fluids). Používáme vlastní zjednodušenou a omezenou diskretizaci, ne jejich hotový solver.
