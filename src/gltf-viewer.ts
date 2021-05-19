import { Observable, Subscription, Subject, BehaviorSubject } from "rxjs";
import { Mesh, Color, Matrix4, Vector3 } from "three";
  
import { GltfViewerOptions } from "./gltf-viewer-options";
import { ModelLoadedInfo, ModelLoadingInfo, ModelOpenedInfo, ModelFileInfo,
  MeshBgSm, ColoringInfo, PointerEventHelper, ViewerInteractionMode,
  Distance, Vec4DoubleCS, SnapPoint, MarkerInfo, MarkerType } from "./common-types";

import { ColorRgbRmo } from "./helpers/color-rgb-rmo";
import { PointSnapHelper } from "./helpers/point-snap-helper";

import { ModelLoader } from "./components/model-loader";
import { CameraControls } from "./components/camera-controls";

import { PickingScene } from "./scenes/picking-scene";

import { ScenesService } from "./services/scenes-service";
import { RenderService } from "./services/render-service";

export { GltfViewerOptions, ModelFileInfo, ModelOpenedInfo, ViewerInteractionMode,
  Distance, Vec4DoubleCS, ColoringInfo, SnapPoint, MarkerInfo, MarkerType };

export class GltfViewer {
  // #region public observables
  optionsChange$: Observable<GltfViewerOptions>; 
  
  contextLoss$: Observable<boolean>;
  lastFrameTime$: Observable<number>;

  cameraPositionChange$: Observable<Vec4DoubleCS>;
  
  loadingStateChange$: Observable<boolean>;
  modelLoadingStart$: Observable<ModelLoadedInfo>;
  modelLoadingEnd$: Observable<ModelLoadedInfo>;
  modelLoadingProgress$: Observable<ModelLoadingInfo>;
  modelsOpenedChange$: Observable<ModelOpenedInfo[]>; 

  meshesSelectionChange$: Observable<Set<string>>;
  meshesManualSelectionChange$: Observable<Set<string>>; 

  snapPointsHighlightChange$: Observable<SnapPoint>;
  snapPointsManualSelectionChange$: Observable<SnapPoint[]>;  
  
  markersChange$: Observable<MarkerInfo[]>;
  markersHighlightChange$: Observable<MarkerInfo>;
  markersSelectionChange$: Observable<MarkerInfo[]>;
  markersManualSelectionChange$: Observable<MarkerInfo[]>;

  distanceMeasureChange$: Observable<Distance>;
  // #endregion
  
  // #region private rx subjects
  private _optionsChange = new BehaviorSubject<GltfViewerOptions>(null);
  private _selectionChange = new BehaviorSubject<Set<string>>(new Set());
  private _manualSelectionChange = new Subject<Set<string>>();
  private _contextLoss = new BehaviorSubject<boolean>(false);  
  private _lastFrameTime = new BehaviorSubject<number>(0);  
  // #endregion
  
  private _subscriptions: Subscription[] = [];
  
  private _container: HTMLElement;
  private _containerResizeObserver: ResizeObserver;

  private _options: GltfViewerOptions;  

  private _loader: ModelLoader;  
  private _cameraControls: CameraControls; 

  private _scenesService: ScenesService;
  private _renderService: RenderService;

  // #region selection/highlighting related fieds
  private _pointerEventHelper = PointerEventHelper.default;
  private _pointSnapHelper: PointSnapHelper;
  private _pickingScene: PickingScene;

  private _queuedColoring: ColoringInfo[] = null;
  private _queuedSelection: {ids: string[]; isolate: boolean} = null;

  private _highlightedMesh: MeshBgSm = null;
  private _selectedMeshes: MeshBgSm[] = [];
  private _isolatedMeshes: MeshBgSm[] = [];
  private _coloredMeshes: MeshBgSm[] = [];

  private _interactionMode: ViewerInteractionMode = "select_mesh";
  // #endregion  

  /**
   * 
   * @param containerId HTMLElement id
   * @param dracoDecoderPath path to the folder with 'draco_decoder.js' file
   * @param options viewer options
   */
  constructor(containerId: string, dracoDecoderPath: string, options: GltfViewerOptions) {
    this.initObservables();

    this._container = document.getElementById(containerId);
    if (!this._container) {
      throw new Error("Container not found!");
    }

    this._options = new GltfViewerOptions(options);  
    this._optionsChange.next(this._options);
    
    this._cameraControls = new CameraControls(this._container, () => {
      this._renderService?.renderOnCameraMove();
    }); 
    this.cameraPositionChange$ = this._cameraControls.cameraPositionChange$;

    
    this._pointSnapHelper = new PointSnapHelper();
    this._pickingScene = new PickingScene();
    
    this.initLoader(dracoDecoderPath);
    this.initScenesService();
    this.initRenderService();
 
    this._containerResizeObserver = new ResizeObserver(() => {
      this._renderService?.resizeRenderer();
    });
    this._containerResizeObserver.observe(this._container);
  }

  /**
   * free viewer resources
   */
  destroy() {   
    this._subscriptions.forEach(x => x.unsubscribe()); 
    this.closeSubjects();  
    this.removeRendererEventListeners();
    
    this._containerResizeObserver?.disconnect();
    this._containerResizeObserver = null;    

    this._renderService?.destroy();
    this._renderService = null; 
    
    this._scenesService?.destroy();
    this._scenesService = null;

    this._loader?.destroy();
    this._loader = null;

    this._pickingScene?.destroy();
    this._pickingScene = null;

    this._pointSnapHelper?.destroy();
    this._pointSnapHelper = null; 
    
    this._cameraControls?.destroy();
    this._cameraControls = null;
  }

  // #region public interaction 

  // common
  /**
   * update viewer options. not all options can be changed after construction
   * @param options 
   * @returns 
   */
  async updateOptionsAsync(options: GltfViewerOptions): Promise<GltfViewerOptions> {
    const oldOptions = this._options;
    this._options = new GltfViewerOptions(options);
    this._renderService.options = this._options;

    let rendererReinitialized = false;
    let axesHelperUpdated = false;
    let lightsUpdated = false;
    let colorsUpdated = false;
    let materialsUpdated = false;
    let sceneUpdated = false;

    if (this._options.useAntialiasing !== oldOptions.useAntialiasing) {
      this.initRenderService();
      rendererReinitialized = true;
    }

    if (this._options.axesHelperEnabled !== oldOptions.axesHelperEnabled
      || this._options.axesHelperPlacement !== oldOptions.axesHelperPlacement
      || this._options.axesHelperSize !== oldOptions.axesHelperSize) {
      this._scenesService.axes.updateOptions(this._options.axesHelperEnabled,
        this._options.axesHelperPlacement, this._options.axesHelperSize);
      axesHelperUpdated = true;
    }
    
    if (this._options.usePhysicalLights !== oldOptions.usePhysicalLights
        || this._options.ambientLightIntensity !== oldOptions.ambientLightIntensity
        || this._options.hemiLightIntensity !== oldOptions.hemiLightIntensity
        || this._options.dirLightIntensity !== oldOptions.dirLightIntensity) {
      this._renderService.renderer.physicallyCorrectLights = this._options.usePhysicalLights;
      this._scenesService.lights.update(this._options.usePhysicalLights, this._options.ambientLightIntensity,
        this._options.hemiLightIntensity, this._options.dirLightIntensity);
      lightsUpdated = true;
    }  

    if (this._options.isolationColor !== oldOptions.isolationColor
        || this._options.isolationOpacity !== oldOptions.isolationOpacity
        || this._options.selectionColor !== oldOptions.selectionColor
        || this._options.highlightColor !== oldOptions.highlightColor) {      
      this._scenesService.renderScene.updateCommonColors({
        isolationColor: this._options.isolationColor, 
        isolationOpacity: this._options.isolationOpacity,
        selectionColor: this._options.selectionColor, 
        highlightColor: this._options.highlightColor
      });
      colorsUpdated = true;
    }

    if (rendererReinitialized || lightsUpdated || colorsUpdated) {
      this._scenesService.renderScene.updateSceneMaterials();
      this._scenesService.simplifiedScene.updateSceneMaterials();
      materialsUpdated = true;
    }

    if (this._options.meshMergeType !== oldOptions.meshMergeType
        || this._options.fastRenderType !== oldOptions.fastRenderType) {
      await this._renderService.updateRenderSceneAsync();
      sceneUpdated = true;
    }
    
    if (!(materialsUpdated || sceneUpdated) 
        && axesHelperUpdated) {
      this._renderService.render();
    }    

    if (this._options.highlightingEnabled !== oldOptions.highlightingEnabled) {
      if (this._options.highlightingEnabled) {        
        this._renderService.renderer.domElement.addEventListener("mousemove", this.onRendererMouseMove);
      } else {
        this._renderService.renderer.domElement.removeEventListener("mousemove", this.onRendererMouseMove);
      }
    }

    this._optionsChange.next(this._options);  
    return this._options;
  }
  
  /**
   * set viewer interaction mode
   * @param value 
   * @returns 
   */
  setInteractionMode(value: ViewerInteractionMode) {
    if (this._interactionMode === value) {
      return;
    }
    switch (this._interactionMode) {
      case "select_mesh":
        // TODO?: reset mesh selection
        break;
      case "select_vertex":
        this._scenesService.hudScene.pointSnap.reset();
        break;
      case "select_sprite":
        this._scenesService.hudScene.markers.highlightMarker(null);
        this._scenesService.hudScene.markers.resetSelectedMarkers();
        break;
      case "measure_distance":
        this._scenesService.hudScene.pointSnap.reset();
        this._scenesService.hudScene.distanceMeasurer.reset();
        break;
      default:
        return;
    }
    this._interactionMode = value;
    this._renderService.render();
  }  

  // models
  /**
   * open models
   * @param modelInfos model information objects
   * @returns 
   */
  async openModelsAsync(modelInfos: ModelFileInfo[]): Promise<ModelLoadedInfo[]> {
    return this._loader.openModelsAsync(modelInfos);
  };

  /**
   * close models with the specified guids
   * @param modelGuids 
   * @returns 
   */
  async closeModelsAsync(modelGuids: string[]): Promise<void> {
    return this._loader.closeModelsAsync(modelGuids);
  };

  /**
   * get a short information about the currently opened models
   * @returns 
   */
  getOpenedModels(): ModelOpenedInfo[] {
    return this._loader?.openedModelInfos;
  }

  /**
   * paint items using the specified coloring information
   * @param coloringInfos coloring information objects
   * @returns 
   */
  colorItems(coloringInfos: ColoringInfo[]) {
    if (this._loader.loadingInProgress) {
      this._queuedColoring = coloringInfos;
      return;
    }

    this.resetSelectionAndColorMeshes(coloringInfos);
  }

  /**
   * select items with the specified ids if found
   * @param ids item identifiers represented as `${model_uuid}|${item_name}`
   * @returns
   */
  selectItems(ids: string[]) {
    if (!ids?.length) {
      return;
    }

    if (this._loader.loadingInProgress) {
      this._queuedSelection = {ids, isolate: false};
      return;
    }

    this.findAndSelectMeshes(ids, false);
  };

  /**
   * make all items semi-transparent except the ones with the specified ids
   * @param ids item identifiers represented as `${model_uuid}|${item_name}`
   * @returns 
   */
  isolateItems(ids: string[]) {
    if (!ids?.length) {
      return;
    }

    if (this._loader.loadingInProgress) {
      this._queuedSelection = {ids, isolate: true};
      return;
    }

    this.findAndSelectMeshes(ids, true);
  };
  
  /**
   * center view on the items with the specified ids if found
   * @param ids item identifiers represented as `${model_uuid}|${item_name}`
   * @returns 
   */
  zoomToItems(ids: string[]) {
    if (ids?.length) {
      const { found } = this._loader.findMeshesByIds(new Set<string>(ids));     
      if (found.length) {
        this._renderService.render(found);
        return;
      }
    }
    this._renderService.renderWholeScene();
  }

  /**
   * get identifiers of the selected items
   * @returns item identifiers represented as `${model_uuid}|${item_name}`
   */
  getSelectedItems(): Set<string> {
    return this._selectionChange.getValue();
  }

  // markers
  /**
   * add markers to the HUD
   * @param markers marker information objects
   */
  setMarkers(markers: MarkerInfo[]) {
    this._scenesService.hudScene?.markers.setMarkers(markers);
    this._renderService.render();
  }

  /**
   * select markers with the specified ids if found
   * @param ids marker ids
   */
  selectMarkers(ids: string[]) {   
    this._scenesService.hudScene?.markers.setSelectedMarkers(ids, false);
    this._renderService.render();
  }
  // #endregion

  // #region rx
  private initObservables() {
    this.contextLoss$ = this._contextLoss.asObservable();
    this.optionsChange$ = this._optionsChange.asObservable();
    this.meshesSelectionChange$ = this._selectionChange.asObservable();
    this.meshesManualSelectionChange$ = this._manualSelectionChange.asObservable();
    this.lastFrameTime$ = this._lastFrameTime.asObservable();
  }

  private closeSubjects() {
    this._contextLoss.complete();
    this._optionsChange.complete(); 
    this._selectionChange.complete();
    this._manualSelectionChange.complete();
    this._lastFrameTime.complete();
  }
  // #endregion

  // #region renderer
  private initRenderService() {    
    if (this._renderService) {
      this.removeRendererEventListeners();
      this._renderService.destroy();
      this._renderService = null;
    }
    
    this._renderService = new RenderService(this._container, this._loader, 
      this._cameraControls, this._scenesService, this._options, this._lastFrameTime);  
    this.addRendererEventListeners();
  }

  private onRendererMouseMove = (e: MouseEvent) => {   
    if (e.buttons) {
      return;
    } 

    clearTimeout(this._pointerEventHelper.mouseMoveTimer);
    this._pointerEventHelper.mouseMoveTimer = null;
    this._pointerEventHelper.mouseMoveTimer = window.setTimeout(() => {
      const x = e.clientX;
      const y = e.clientY;

      switch (this._interactionMode) {
        case "select_mesh":  
          this.highlightMeshAtPoint(x, y);      
          break;
        case "select_vertex":
          this.highlightMeshAtPoint(x, y);
          this.setVertexSnapAtPoint(x, y);
          break;
        case "select_sprite":
          this.highlightSpriteAtPoint(x, y);
          break;
        case "measure_distance":
          this.setVertexSnapAtPoint(x, y);
          break;
      }
    }, 30);
  };

  private onRendererPointerDown = (e: PointerEvent) => {
    this._pointerEventHelper.downX = e.clientX;
    this._pointerEventHelper.downY = e.clientY;
  };

  private onRendererPointerUp = (e: PointerEvent) => {
    const x = e.clientX;
    const y = e.clientY;

    if (!this._pointerEventHelper.downX 
      || Math.abs(x - this._pointerEventHelper.downX) > this._pointerEventHelper.maxDiff
      || Math.abs(y - this._pointerEventHelper.downY) > this._pointerEventHelper.maxDiff) {
      return;
    }

    switch (this._interactionMode) {
      case "select_mesh":    
        if (this._pointerEventHelper.waitForDouble) {
          this.isolateSelectedMeshes();
          this._pointerEventHelper.waitForDouble = false;
        } else {
          this._pointerEventHelper.waitForDouble = true;
          setTimeout(() => {
            this._pointerEventHelper.waitForDouble = false;
          }, 300);
          this.selectMeshAtPoint(x, y, e.ctrlKey);
        }      
        break;
      case "select_vertex":
        this.selectVertexAtPoint(x, y);
        break;
      case "select_sprite":
        this.selectSpriteAtPoint(x, y);
        break;
      case "measure_distance":
        this.measureDistanceAtPoint(x, y);
        break;
    }

    this._pointerEventHelper.downX = null;
    this._pointerEventHelper.downY = null;
  };

  private onRendererContextLoss = () => {
    this._contextLoss.next(true);
    this._loader?.closeAllModelsAsync();
  };

  private onRendererContextRestore = () => {
    this._contextLoss.next(false);     
  };

  private addRendererEventListeners() {
    const { highlightingEnabled } = this._options;

    this._renderService.renderer.domElement.addEventListener("webglcontextlost", () => this.onRendererContextLoss);    
    this._renderService.renderer.domElement.addEventListener("webglcontextrestored ", this.onRendererContextRestore); 
    this._renderService.renderer.domElement.addEventListener("pointerdown", this.onRendererPointerDown);
    this._renderService.renderer.domElement.addEventListener("pointerup", this.onRendererPointerUp);
    if (highlightingEnabled) {      
      this._renderService.renderer.domElement.addEventListener("mousemove", this.onRendererMouseMove);
    }
  }

  private removeRendererEventListeners() {   
    this._renderService.renderer.domElement.removeEventListener("webglcontextlost", () => this.onRendererContextLoss);    
    this._renderService.renderer.domElement.removeEventListener("webglcontextrestored ", this.onRendererContextRestore);     
    this._renderService.renderer.domElement.removeEventListener("pointerdown", this.onRendererPointerDown);
    this._renderService.renderer.domElement.removeEventListener("pointerup", this.onRendererPointerUp);   
    this._renderService.renderer.domElement.removeEventListener("mousemove", this.onRendererMouseMove);
  }
  // #endregion

  private initScenesService() {
    this._scenesService = new ScenesService(this._container, this._cameraControls, this._options);
    this.snapPointsHighlightChange$ = this._scenesService.hudScene.pointSnap.snapPointsHighlightChange$;
    this.snapPointsManualSelectionChange$ = this._scenesService.hudScene.pointSnap.snapPointsManualSelectionChange$;
    this.markersChange$ = this._scenesService.hudScene.markers.markersChange$;
    this.markersSelectionChange$ = this._scenesService.hudScene.markers.markersSelectionChange$;
    this.markersManualSelectionChange$ = this._scenesService.hudScene.markers.markersManualSelectionChange$;
    this.markersHighlightChange$ = this._scenesService.hudScene.markers.markersHighlightChange$;
    this.distanceMeasureChange$ = this._scenesService.hudScene.distanceMeasurer.distanceMeasureChange$;
  }

  private initLoader(dracoDecoderPath: string) {    
    const wcsToUcsMatrix = new Matrix4();
    const ucsOrigin = this._options.basePoint;
    if (ucsOrigin) {
      wcsToUcsMatrix
        .makeTranslation(ucsOrigin.x, ucsOrigin.y_Yup, ucsOrigin.z_Yup)
        .invert();
    }

    this._loader = new ModelLoader(dracoDecoderPath,
      async () => {
        this.runQueuedColoring();
        this.runQueuedSelection();
        await this._renderService.updateRenderSceneAsync();
      },
      (guid: string) => {},
      (guid: string) => {
        this._highlightedMesh = null;
        this._selectedMeshes = this._selectedMeshes.filter(x => x.userData.modelGuid !== guid);
        this._isolatedMeshes = this._isolatedMeshes.filter(x => x.userData.modelGuid !== guid);
        this._coloredMeshes = this._coloredMeshes.filter(x => x.userData.modelGuid !== guid);
      },
      (mesh: MeshBgSm) => {        
        this._pickingScene.add(mesh);
      },
      (mesh: MeshBgSm) => {
        this._pickingScene.remove(mesh);
      },
      wcsToUcsMatrix,
    );

    this.loadingStateChange$ = this._loader.loadingStateChange$;
    this.modelLoadingStart$ = this._loader.modelLoadingStart$;
    this.modelLoadingEnd$ = this._loader.modelLoadingEnd$;
    this.modelLoadingProgress$ = this._loader.modelLoadingProgress$;
    this.modelsOpenedChange$ = this._loader.modelsOpenedChange$;  
  }

  // #region item custom coloring
  private runQueuedColoring() {
    if (this._queuedColoring) {
      this.resetSelectionAndColorMeshes(this._queuedColoring);
    }
  }

  private resetSelectionAndColorMeshes(coloringInfos: ColoringInfo[]) {    
    this.resetSelection();
    this.colorMeshes(coloringInfos);
  }

  private colorMeshes(coloringInfos: ColoringInfo[]) {
    this.removeColoring();

    if (coloringInfos?.length) {
      for (const info of coloringInfos) {
        const color = new Color(info.color);
        const customColor = new ColorRgbRmo(color.r, color.g, color.b, 1, 0, info.opacity);
        info.ids.forEach(x => {
          const meshes = this._loader.getLoadedMeshesById(x);
          if (meshes?.length) {
            meshes.forEach(mesh => {
              mesh.userData.colored = true;
              ColorRgbRmo.setCustomToMesh(mesh, customColor);
              this._renderService.enqueueMeshForColorUpdate(mesh);
              this._coloredMeshes.push(mesh);
            });
          }
        });
      }
    }

    this._renderService.render();
  }

  private removeColoring() {
    for (const mesh of this._coloredMeshes) {
      mesh.userData.colored = undefined;
      ColorRgbRmo.deleteFromMesh(mesh, true);
      this._renderService.enqueueMeshForColorUpdate(mesh);
    }
    this._coloredMeshes.length = 0;
  }
  // #endregion

  // #region picking 
  private getMeshAt(clientX: number, clientY: number): MeshBgSm {  
    const position = PointSnapHelper.convertClientToCanvas(this._renderService.renderer, clientX, clientY); 
    return this._renderService.renderer && this._pickingScene
      ? this._pickingScene.getSourceMeshAt(this._cameraControls.camera, this._renderService.renderer, position)
      : null;
  }
  
  private getSnapPointAt(clientX: number, clientY: number): SnapPoint {
    const position = PointSnapHelper.convertClientToCanvas(this._renderService.renderer, clientX, clientY);
    const pickingMesh = this._pickingScene.getPickingMeshAt(this._cameraControls.camera,
      this._renderService.renderer, position);

    const point = pickingMesh
      ? this._pointSnapHelper.getMeshSnapPointAtPosition(this._cameraControls.camera,
        this._renderService.renderer, position, pickingMesh)
      : null;

    const snapPoint = point
      ? { meshId: pickingMesh.userData.sourceId, position: Vec4DoubleCS.fromVector3(point) } 
      : null;

    return snapPoint;
  }
  // #endregion  

  // #region hud methods

  // common

  // snap points
  private setVertexSnapAtPoint(clientX: number, clientY: number) {    
    if (!this._renderService.renderer || !this._pickingScene) {
      return;
    } 
    const snapPoint = this.getSnapPointAt(clientX, clientY);    
    this._scenesService.hudScene.pointSnap.setSnapPoint(snapPoint);
    this._renderService.render(); 
  }
  
  private selectVertexAtPoint(clientX: number, clientY: number) {    
    if (!this._renderService.renderer || !this._pickingScene) {
      return;
    } 
    const snapPoint = this.getSnapPointAt(clientX, clientY);    
    this._scenesService.hudScene.pointSnap.setSelectedSnapPoints(snapPoint ? [snapPoint] : null);
    this._renderService.render(); 
  }
  
  // sprites(markers)
  private highlightSpriteAtPoint(clientX: number, clientY: number) {    
    if (!this._renderService.renderer || !this._pickingScene) {
      return;
    } 

    const point = PointSnapHelper.convertClientToCanvasZeroCenter(this._renderService.renderer, clientX, clientY);
    const marker = this._scenesService.hudScene.markers.getMarkerAtCanvasPoint(point);
    this._scenesService.hudScene.markers.highlightMarker(marker);
    this._renderService.render(); 
  }
  
  private selectSpriteAtPoint(clientX: number, clientY: number) {    
    if (!this._renderService.renderer || !this._pickingScene) {
      return;
    } 

    const point = PointSnapHelper.convertClientToCanvasZeroCenter(this._renderService.renderer, clientX, clientY);
    const marker = this._scenesService.hudScene.markers.getMarkerAtCanvasPoint(point);
    this._scenesService.hudScene.markers.setSelectedMarkers(marker ? [marker.id] : null, true);
    this._renderService.render(); 
  }

  // distance measure
  private measureDistanceAtPoint(clientX: number, clientY: number) { 
    if (!this._renderService.renderer || !this._pickingScene) {
      return;
    }       
    const snapPoint = this.getSnapPointAt(clientX, clientY); 
    const snapPosition = snapPoint?.position.toVec4();
    this._scenesService.hudScene.distanceMeasurer.setEndMarker(snapPoint
      ? new Vector3(snapPosition.x, snapPosition.y, snapPosition.z)
      : null); 
    this._renderService.render(); 
  }

  // #endregion

  // #region item selection/isolation   
  private runQueuedSelection() {    
    if (this._queuedSelection) {
      const { ids, isolate } = this._queuedSelection;
      this.findAndSelectMeshes(ids, isolate);
    }
  }

  private findAndSelectMeshes(ids: string[], isolate: boolean) {    
    const { found } = this._loader.findMeshesByIds(new Set<string>(ids));
    if (found.length) {
      this.selectMeshes(found, false, isolate);
    }
  }

  private removeSelection() {
    for (const mesh of this._selectedMeshes) {
      mesh.userData.selected = undefined;
      this._renderService.enqueueMeshForColorUpdate(mesh);
    }
    this._selectedMeshes.length = 0;
  }

  private removeIsolation() {
    for (const mesh of this._isolatedMeshes) {
      mesh.userData.isolated = undefined;
      this._renderService.enqueueMeshForColorUpdate(mesh);
    }
    this._isolatedMeshes.length = 0;
  }

  private resetSelection() {    
    this.removeSelection();
    this.removeIsolation();
  }

  private selectMeshAtPoint(clientX: number, clientY: number, keepPreviousSelection: boolean) {
    const mesh = this.getMeshAt(clientX, clientY);
    if (!mesh) {
      this.selectMeshes([], true, false);
      return;
    }

    if (keepPreviousSelection) {
      if (mesh.userData.selected) {
        this.removeFromSelection(mesh);
      } else {        
        this.addToSelection(mesh);
      }
    } else {
      this.selectMeshes([mesh], true, false);
    }
  }

  private addToSelection(mesh: MeshBgSm): boolean {   
    const meshes = [mesh, ...this._selectedMeshes];
    this.selectMeshes(meshes, true, false);
    return true;
  }

  private removeFromSelection(mesh: Mesh): boolean {
    const meshes = this._selectedMeshes.filter(x => x !== mesh);
    this.selectMeshes(meshes, true, false);
    return true;
  }
 
  private selectMeshes(meshes: MeshBgSm[], 
    manual: boolean, isolateSelected: boolean) { 
      
    this.resetSelection();

    if (!meshes?.length) {
      this.emitSelectionChanged(manual, true);
      return null;
    }
    
    meshes.forEach(x => {
      x.userData.selected = true;
      this._renderService.enqueueMeshForColorUpdate(x);
    });


    this._selectedMeshes = meshes;
    if (isolateSelected) {
      this.emitSelectionChanged(manual, false);
      this.isolateSelectedMeshes();
    } else {
      this.emitSelectionChanged(manual, true);
    }
  }

  private isolateSelectedMeshes() {
    if (!this._selectedMeshes.length) {
      return;
    }

    this._loader.loadedMeshesArray.forEach(x => {
      if (!x.userData.selected) {
        x.userData.isolated = true;
        this._renderService.enqueueMeshForColorUpdate(x);
        this._isolatedMeshes.push(x);
      }
    }); 
    this._renderService.render(this._selectedMeshes);
  }

  private emitSelectionChanged(manual: boolean, render: boolean) {
    if (render) {
      this._renderService.render(manual ? null : this._selectedMeshes);
    }

    const ids = new Set<string>();
    this._selectedMeshes.forEach(x => ids.add(x.userData.id));

    this._selectionChange.next(ids);
    if (manual) {
      this._manualSelectionChange.next(ids);
    }
  }
  // #endregion

  // #region item highlighting
  private highlightMeshAtPoint(clientX: number, clientY: number) { 
    const mesh = this.getMeshAt(clientX, clientY);  
    this.highlightItem(mesh);
  }

  private highlightItem(mesh: MeshBgSm) {
    if (mesh === this._highlightedMesh) {
      return;
    }

    this.removeHighlighting();
    if (mesh) {
      mesh.userData.highlighted = true;
      this._renderService.enqueueMeshForColorUpdate(mesh);
      this._highlightedMesh = mesh;
    }
    this._renderService.render();
  }

  private removeHighlighting() {
    if (this._highlightedMesh) {
      const mesh = this._highlightedMesh;
      mesh.userData.highlighted = undefined;
      this._renderService.enqueueMeshForColorUpdate(mesh);
      this._highlightedMesh = null;
    }
  }
  // #endregion
}
