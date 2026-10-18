declare module 'dxf-render/parser' {
  export function parseDxf(text: string): any;
  export type DxfData = any;
  export function parseDxfAsync(text: string): Promise<any>;
  export function terminateParserWorker(): void;
}

declare module 'dxf-render' {
  export function parseDxf(text: string): any;
  export function parseDxfAsync(text: string): Promise<any>;
  export function createThreeObjectsFromDXF(dxf: any, options?: any): Promise<any>;
  export function loadDefaultFont(): Promise<void>;
  export function useCamera(camera: any): any;
  export function useControls(camera: any, domElement: any): any;
}
