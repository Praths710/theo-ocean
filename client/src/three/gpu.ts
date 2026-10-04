/** Laptop/phone graphics built into the CPU (e.g. Intel UHD): start in the lighter quality mode. */
let integratedGpu: boolean | null = null;
export function isIntegratedGpu() {
  if (integratedGpu !== null) return integratedGpu;
  try {
    const g = document.createElement("canvas").getContext("webgl2");
    const info = g?.getExtension("WEBGL_debug_renderer_info");
    const name = info ? String(g!.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    integratedGpu = /intel|uhd|iris|mali|adreno|powervr|swiftshader|llvmpipe/i.test(name) && !/arc/i.test(name);
  } catch { integratedGpu = false; }
  return integratedGpu;
}

