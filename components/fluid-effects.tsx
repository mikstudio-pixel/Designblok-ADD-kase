import type { SurfaceEffect } from '@/lib/fluid';

const EFFECTS: { id: SurfaceEffect; label: string; description: string }[] = [
  {
    id: 'crests',
    label: 'Hřebeny',
    description: 'Jemná záře na vrcholcích vln',
  },
  {
    id: 'contours',
    label: 'Vrstevnice',
    description: 'Čáry stejné výšky hladiny',
  },
  {
    id: 'height',
    label: 'Výška',
    description: 'Studené prohlubně a teplé vrcholky',
  },
  {
    id: 'grid',
    label: 'Síť',
    description: 'Mřížka kopírující vlny se svítícími hřebeny',
  },
  {
    id: 'dots',
    label: 'Tečky',
    description: 'Hustá síť teček, které zesilují jas na vyvýšené hladině a hřebenech vln',
  },
  {
    id: 'flow',
    label: 'Proudění',
    description: 'Světelné stopy proudění a barevné víry',
  },
];

export function FluidEffects({
  value,
  onChange,
  disabled,
}: {
  value: readonly SurfaceEffect[];
  onChange: (effects: SurfaceEffect[]) => void;
  disabled: boolean;
}) {
  return (
    <fieldset
      className="effect-switcher"
      aria-label="Efekty hladiny"
      disabled={disabled}
    >
      {EFFECTS.map((effect) => (
        <label
          key={effect.id}
          className="effect-option"
          data-checked={value.includes(effect.id)}
          title={effect.description}
        >
          <input
            type="checkbox"
            checked={value.includes(effect.id)}
            onChange={(event) => onChange(event.currentTarget.checked
              ? [...value, effect.id]
              : value.filter((id) => id !== effect.id))}
          />
          {effect.label}
        </label>
      ))}
      <button type="button" aria-pressed={value.length === 0} title="Vypnout všechna zvýraznění" onClick={() => onChange([])}>Původní</button>
    </fieldset>
  );
}
