import { MeshMergeType, FastRenderType, CornerName, Vec4DoubleCS } from "./common-types";

export class GltfViewerOptions {
  useAntialiasing = false;
  usePhysicalLights = false; 
  ambientLightIntensity = 1;
  hemiLightIntensity = 0.4;
  dirLightIntensity = 0.6;

  highlightingEnabled = true;
  highlightColor = 0xFFFF00;
  selectionColor = 0xFF0000;
  isolationColor = 0x555555;
  isolationOpacity = 0.2;  

  meshMergeType: MeshMergeType = null;
  fastRenderType: FastRenderType = null;

  axesHelperEnabled = true;
  axesHelperPlacement: CornerName = "top-right";
  axesHelperSize = 128;

  basePoint: Vec4DoubleCS = null;
  
  constructor(item: object = null) {
    if (item != null) {
      Object.assign(this, item);
    }
  }
}
