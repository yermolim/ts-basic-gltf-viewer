// Generated by dts-bundle-generator v5.3.0

import { Observable } from 'rxjs';

export interface ModelFileInfo {
	url: string;
	guid: string;
	name: string;
}
export interface ModelLoadedInfo {
	url: string;
	guid: string;
	error?: Error;
}
export interface ModelLoadingInfo {
	url: string;
	guid: string;
	progress: number;
}
export interface ModelOpenedInfo {
	guid: string;
	name: string;
	handles: Set<string>;
}
export interface ColoringInfo {
	color: number;
	opacity: number;
	ids: string[];
}
export declare class GltfViewerOptions {
	dracoDecoderEnabled: boolean;
	dracoDecoderPath: string;
	highlightingEnabled: boolean;
	highlightingLatency: number;
	highlightColor: number;
	highlightEmissive: number;
	selectionColor: number;
	selectionEmissive: number;
	isolationColor: number;
	isolationEmissive: number;
	isolationOpacity: number;
	usePhysicalLights: boolean;
	lightIntensity: number;
	useAntialiasing: boolean;
	constructor(item?: object);
}
export declare class GltfViewer {
	initialized$: Observable<boolean>;
	modelLoadingStateChange$: Observable<boolean>;
	modelLoadingStart$: Observable<ModelLoadedInfo>;
	modelLoadingEnd$: Observable<ModelLoadedInfo>;
	modelLoadingProgress$: Observable<ModelLoadingInfo>;
	openedModelsChange$: Observable<ModelOpenedInfo[]>;
	selectionChange$: Observable<Set<string>>;
	manualSelectionChange$: Observable<Set<string>>;
	private _initialized;
	private _modelLoadingStateChange;
	private _modelLoadingStart;
	private _modelLoadingEnd;
	private _modelLoadingProgress;
	private _openedModelsChange;
	private _selectionChange;
	private _manualSelectionChange;
	private readonly _bakMatProp;
	private readonly _colMatProp;
	private readonly _hlProp;
	private readonly _selProp;
	private readonly _isolProp;
	private readonly _colProp;
	private _subscriptions;
	private _options;
	private _container;
	private _containerResizeSensor;
	private _containerWidth;
	private _containerHeight;
	private _renderer;
	private _mainScene;
	private _loader;
	private _camera;
	private _orbitControls;
	private _selectionMaterial;
	private _isolationMaterial;
	private _highlightMaterial;
	private _queuedColoring;
	private _queuedSelection;
	private _highlightedMesh;
	private _selectedMeshes;
	private _isolatedMeshes;
	private _coloredMeshes;
	private _pickingTarget;
	private _pickingScene;
	private _pickingColorToMesh;
	private _lastPickingColor;
	private _pointerEventHelper;
	private _loadingInProgress;
	private _loadingQueue;
	private _loadedModelsByGuid;
	private _loadedMeshesById;
	constructor(containerId: string, options: GltfViewerOptions);
	init(): void;
	destroy(): void;
	openModelsAsync(modelInfos: ModelFileInfo[]): Promise<ModelLoadedInfo[]>;
	closeModels(modelGuids: string[]): void;
	selectItems(ids: string[]): void;
	isolateItems(ids: string[]): void;
	colorItems(coloringInfos: ColoringInfo[]): void;
	getOpenedModels(): ModelOpenedInfo[];
	getSelectedItems(): Set<string>;
	private initObservables;
	private closeSubjects;
	private _onCanvasPointerDown;
	private _onCanvasPointerUp;
	private _onCanvasMouseMove;
	private addCanvasEventListeners;
	private initRendererWithScene;
	private render;
	private fitCameraToObjects;
	private initPickingScene;
	private nextPickingColor;
	private addMeshToPickingScene;
	private removeMeshFromPickingScene;
	private getPickingPosition;
	private getItemAtPickingPosition;
	private updateContainerDimensions;
	private updateRendererSize;
	private initLoader;
	private loadQueuedModelsAsync;
	private loadModel;
	private onModelLoadingStart;
	private onModelLoadingProgress;
	private onModelLoadingEnd;
	private addModelToScene;
	private removeModelFromScene;
	private emitOpenedModelsChanged;
	private runQueuedColoring;
	private resetSelectionAndColorMeshes;
	private colorMeshes;
	private removeColoring;
	private runQueuedSelection;
	private findAndSelectMeshes;
	private findMeshesByIds;
	private removeSelection;
	private removeIsolation;
	private selectMeshAtPoint;
	private addToSelection;
	private removeFromSelection;
	private selectMeshes;
	private isolateSelectedMeshes;
	private emitSelectionChanged;
	private highlightMeshAtPoint;
	private highlightItem;
	private removeHighlighting;
	private initSpecialMaterials;
	private backupMeshMaterial;
	private refreshMeshMaterial;
}

export {};
