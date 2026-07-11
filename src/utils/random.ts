// Uniform-random point on the surface of a sphere (Marsaglia method).
// Used to scatter stars without clustering at the poles.
export function randomPointOnSphere(radius: number): [number, number, number] {
  let x1: number, x2: number, sq: number;
  do {
    x1 = Math.random() * 2 - 1;
    x2 = Math.random() * 2 - 1;
    sq = x1 * x1 + x2 * x2;
  } while (sq >= 1);

  const factor = 2 * Math.sqrt(1 - sq);
  const x = x1 * factor;
  const y = x2 * factor;
  const z = 1 - 2 * sq;

  return [x * radius, y * radius, z * radius];
}
