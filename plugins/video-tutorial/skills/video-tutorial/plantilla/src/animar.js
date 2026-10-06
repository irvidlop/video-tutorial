// Lee el plan que escribe construir.mjs (o construir-entrada.mjs) y arma UNA línea de tiempo de GSAP en pausa:
// HyperFrames la mueve cuadro por cuadro, así que se puede buscar cualquier segundo y renderizar sin sorpresas.
const tl = gsap.timeline({ paused: true });
for (const c of PLAN) {
  if (c.k === "set") tl.set(c.s, c.v, c.t);
  else if (c.k === "to") tl.to(c.s, c.v, c.t);
  else tl.fromTo(c.s, c.f, c.v, c.t);
}
// HyperFrames ya trae el registro; medir.mjs abre la composición en un Chrome normal, donde hay que crearlo
window.__timelines = window.__timelines || {};
window.__timelines["main"] = tl;
