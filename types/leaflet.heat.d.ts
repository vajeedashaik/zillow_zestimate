// Type declarations for leaflet.heat plugin
import * as L from 'leaflet';

declare module 'leaflet.heat' {
  const content: unknown;
  export default content;
}

declare module 'leaflet' {
  function heatLayer(
    latlngs: Array<[number, number, number?]>,
    options?: {
      minOpacity?: number;
      maxZoom?: number;
      max?: number;
      radius?: number;
      blur?: number;
      gradient?: Record<number, string>;
    }
  ): Layer;
}
