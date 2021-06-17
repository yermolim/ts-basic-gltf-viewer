import { Mesh_BG } from "../common-types";

import { PickingService } from "./picking-service";
import { RenderService } from "./render-service";

export class HighlightService {
  private readonly _pickingService: PickingService;
  
  private readonly _highlightedMeshes = new Set<Mesh_BG>();

  constructor(pickingService: PickingService) {
    if (!pickingService) {
      throw new Error("PickingService is not defined");
    }

    this._pickingService = pickingService;
  }

  destroy() {

  }

  highlightInArea(renderService: RenderService, 
    clientMinX: number, clientMinY: number, 
    clientMaxX: number, clientMaxY: number) {

    const found = this._pickingService.getMeshesInArea(renderService,
      clientMinX, clientMinY, clientMaxX, clientMaxY);
    this.highlightMeshes(renderService, found);
  }
  
  highlightAtPoint(renderService: RenderService, clientX: number, clientY: number) { 
    const mesh = this._pickingService.getMeshAt(renderService, clientX, clientY);  
    if (mesh) {
      this.highlightMeshes(renderService, [mesh]);
    } else {      
      this.highlightMeshes(renderService, []);
    }
  }

  clearHighlight(renderService: RenderService) {
    this.highlightMeshes(renderService, []);
  }

  private highlightMeshes(renderService: RenderService, meshes: Mesh_BG[]) {
    const meshSet = new Set<Mesh_BG>(meshes || []);    

    const addToHighlightList: Mesh_BG[] = [];
    const removeFromHighlightList: Mesh_BG[] = [];

    this._highlightedMeshes.forEach(mesh => {
      if (!meshSet.has(mesh)) {
        removeFromHighlightList.push(mesh);
      }
    });
    meshSet.forEach(mesh => {
      if (!this._highlightedMeshes.has(mesh)) {
        addToHighlightList.push(mesh);
      }
    });
    
    removeFromHighlightList.forEach(mesh => {
      mesh.userData.highlighted = undefined;
      renderService.enqueueMeshForColorUpdate(mesh);
      this._highlightedMeshes.delete(mesh);
    });

    addToHighlightList.forEach(mesh => {
      mesh.userData.highlighted = true;
      renderService.enqueueMeshForColorUpdate(mesh);
      this._highlightedMeshes.add(mesh);
    });

    renderService.render();
  }
}
