# GLBIM 🏗️
#### Three.js-based GLB/IFC model viewer

Created for personal use in a project focused on BIM, so use cases may be limited, but maybe will still be helpful to someone. 
The main goal was to make it possible to open dozens of large industrial building models with thousands of elements and millions of polygons while keeping an optimal render performance. Optimized mesh merging to reduce render calls, GPU picking, using only vertex colors, etc. were the ways to achieve it. Target models are static, without the need to take into account their internal structure, textures are ignored. 

## Main features:
<ul>
  <li>loading multiple GLB(with draco compression support) and IFC models</li>
  <li>huge performance optimization by merging all scene meshes into single mesh (or one mesh per loaded model optionally) with vertex colors (with alpha value supported) to reduce frame time by minimizing render calls</li>
  <li>additional render speed optimization while moving/rotating camera by using simplified background scene</li>
  <li>ability to interact with models (select/isolate/hide/color model meshes) from code by mesh ids*</li>
  <li>mouse and touch support (pointer events used) with numerous actions available: orbit navigation (zoom/pan/rotate), single and multiple manual selections of model meshes (fast GPU picking with background scene is used), area mesh selection, isolation of selected meshes, highlighting model meshes on hover</li>
  <li>detailed feedback about current viewer state by notifying of all changes in the opened scene using RxJS observables</li>
  <li>customization with options provided, most of which are available for modification at runtime</li>
  <li>custom axes helper with camera rotation on axis label click</li>
  <li>HUD scene for showing custom 2d infographics on top of model view</li>
  <li>vertex selection mode with point snap using raycaster and barycentric coordinates</li>
  <li>distance measure mode (extremely useful for BIM)</li>
  <li>auto-resized canvas with transparent background (so outer container background used, easy to switch colors)</li>
</ul>

### Outside of scope:
The support of these possible features are outside of the current module scope and their implementation is implausible unless there will be a huge amount of requests for additional features, which I think is extremely unrealistic.
<ul>
  <li>textures</li>
  <li>animation</li>
  <li>model editing</li>
</ul>

## External dependencies:
<ul>
  <li><a href="https://github.com/mrdoob/three.js">Three.js<a></li>
  <li><a href="https://github.com/ReactiveX/rxjs">RxJS<a></li>
  <li><a href="https://github.com/tomvandig/web-ifc">IFC.js web-api<a></li>
</ul>

#### *Mesh ids
A combination of model id and mesh 'name' field is used as mesh id (`${modelId}|${meshName}`). This id is used for all available manipulations with a mesh (selection/isolation/hiding/coloring etc.). If mesh id is not unique, any manipulation will affect all meshes with this id.

If I find time for this, or if there are any requests, I will add more details to the description.