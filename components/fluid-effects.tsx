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
    id: 'flow',
    label: 'Proudění',
    description: 'Světelné stopy proudění a barevné víry',
  },
  {
    id: 'original',
    label: 'Původní',
    description: 'Původní hladina bez zvýraznění',
  },
];

export function FluidEffects({
  value,
  onChange,
  disabled,
}: {
  value: SurfaceEffect;
  onChange: (effect: SurfaceEffect) => void;
  disabled: boolean;
}) {
  return (
    <fieldset
      className="effect-switcher"
      aria-label="Efekty hladiny"
      disabled={disabled}
    >
      {EFFECTS.map((effect) => (
        <button
          key={effect.id}
          type="button"
          aria-pressed={value === effect.id}
          title={effect.description}
          onClick={() => onChange(effect.id)}
        >
          {effect.label}
        </button>
      ))}
    </fieldset>
  );
}
