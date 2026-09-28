/** The wetsuit colour for a locker hue, used everywhere the diver appears so they always match. */
export const suitColor = (hue: number) => `hsl(${(178 + hue) % 360}, 60%, 42%)`;
