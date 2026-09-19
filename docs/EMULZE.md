# Emulze — vizuální prototyp

- Černé čtverečky, zrnka a dekorativní bublinky jsou odstraněné.
- Místo barevné textury počítáme podíl tmavé kapaliny `c` a světlé `1 − c`.
- Proudění tácu natahuje rozhraní; přesnější přenos omezuje rozmazávání vláken.
- Model inspirovaný Cahn–Hilliardovou rovnicí udržuje oddělené fáze a zaobluje jejich rozhraní. Dotýkající se kapky si mohou rozšířit společný krček.
- GPU průběžně kontroluje a opravuje poměr ploch obou složek. Směs se nevrací k původnímu obrázku a tmavá složka se neztrácí do šedi.
- Odlesky reagují na vlny i na hranici kapalin. Laser a volitelné efekty zůstávají.

Je to **stylizovaný 2D materiál ve společném proudění**, nikoli úplná simulace dvou různě hustých kapalin. Síly rozhraní zatím nepůsobí zpět na vlny. Pohyb materiálu je pro výraznější míchání zesílený 3×. Uchováváme plošný poměr, ne skutečnou hmotnost v proměnlivé hloubce. Výchozí režim je **Detailní**; výkon této varianty zatím neladíme.

Samotné vlny a opravená kruhová stěna se nemění. Materiál je soustředěný v `lib/emulsion.ts`; předchozí varianta je v Gitu na `766e55b` a dá se obnovit revertem commitu s emulzí.

Principy: [Cahn–Hilliard a volná energie, NIST](https://pages.nist.gov/pfhub/benchmarks/benchmark1.ipynb/), [přenos MacCormack, NVIDIA GPU Gems](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-30-real-time-simulation-and-rendering-3d-fluids). Používáme vlastní zjednodušenou a omezenou diskretizaci, ne jejich hotový solver.
