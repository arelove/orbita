declare module 'shade-blend-color' {
  /**
   * Shade, blend, or convert a color.
   * @param p  percentage (-1..1): negative = darken, positive = lighten
   * @param c0 from-color (hex string)
   * @param c1 optional to-color for blending
   * @param l  use linear (true) or log blending
   */
  function pSBC(
    p: number,
    c0: string,
    c1?: string | null,
    l?: boolean
  ): string | null;

  export default pSBC;
}