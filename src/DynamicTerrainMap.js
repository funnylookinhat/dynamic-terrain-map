/**
 * Dynamic Terrain Map
 * This should divide a large terrain into manageable chunks
 * and automatically switch out low and high detail maps depending on
 * camera position.
 */

THREE.DynamicTerrainMap = function (parameters) {
  
  this._scene = parameters.scene ? parameters.scene : null;
  this._camera = parameters.camera ? parameters.camera : null;
  this._material = parameters.material ? parameters.material : null;
  this._debugMode = parameters.debugMode ? true : false; // Replaces material with wireframes

  this._position = parameters.position ? parameters.position : {x:0, y:0, z:0};

  // Defines how the terrain map adjusts
  this._mapChunkSize = parameters.mapChunkSize ? parameters.mapChunkSize : 500;
  this._detailRanges = parameters.detailRanges ? parameters.detailRanges : [100, 1500, 3000, 10000];
  this._chunkHoverRange = parameters.chunkHoverRange ? parameters.chunkHoverRange : 500;
  this._chunkShowFarthest = parameters.chunkShowFarthest ? parameters.chunkShowFarthest : false;

  // How we convert to and from RGBA.
  this._convertToRgba = parameters.convertToRgba ? parameters.convertToRgba : function (value) {
    value = parseInt(1000 * (parseFloat(value).toFixed(3)));
    var a = value & 255; value = value >>> 8;
    var b = value & 255; value = value >>> 8;
    var g = value & 255; value = value >>> 8;
    var r = value & 255; value = value >>> 8;
    return {
      r: r,
      g: g,
      b: b,
      a: a
    }
  };

  this._convertToFloat = parameters.convertToFloat ? parameters.convertToFloat : function (rgba) {
    var value = 0 >>> 32;
    value += rgba.r; value = value << 8;
    value += rgba.g; value = value << 8;
    value += rgba.b; value = value << 8;
    value += rgba.a;
    return value / 1000;
  }

  // If a useWorkers isn't strictly passed we just try to detect it.
  if( typeof parameters.useWorkers == "undefined" ) {
    this._useWorkers = ( typeof Worker == "undefined" ) ? false : true;
  } else {
    this._useWorkers = parameters.useWorkers ? true : false;
  }

  this._workerScriptLocation = parameters.workerScriptLocation ? parameters.workerScriptLocation : 'DynamicTerrainMapChunkWorker.js';
  
  // Declare a bunch of privates.
  this._cameraLastPosition = this._camera.position;
  this._width = null;
  this._depth = null;
  this._map = null;
  this._heightMap = null;
  this._heightMapLength = 0;
  this._chunkBuilder = null;
}

THREE.DynamicTerrainMap._debugModeColors = [
  0x414141,
  0x008800,
  0x336699,
  0xff4100,
  0x03899c,
  0xa6a400,
  0xbf3030
];

THREE.DynamicTerrainMap.lerp = function (v1, v2, f) {
  return v1 + (v2 - v1) * f;
}

THREE.DynamicTerrainMap.prototype.init = function (parameters, mainCallback) {
  if( this._width != null ||
      this._depth != null ) {
    return;
  }

  if( this._scene == null ||
      this._camera == null ) {
    return;
  }

  if( parameters.data && parameters.width && parameters.depth ) {
    this._createArrayHeightMap(parameters.data, parameters.width, parameters.depth, mainCallback);
  } else if( parameters.imageUrl ) {
	  this._loadImageHeightMap(parameters.imageUrl,mainCallback);
	} else {
    parameters.width = parameters.width ? parameters.width : 1000;
    parameters.depth = parameters.depth ? parameters.depth : parameters.width;
    this._createFlatHeightMap(parameters.width,parameters.depth,mainCallback);
  }
}

THREE.DynamicTerrainMap.prototype.width = function () {
  return this._width;
}

THREE.DynamicTerrainMap.prototype.depth = function () {
  return this._depth;
}

THREE.DynamicTerrainMap.prototype.position = function () {
  return this._position;
}

// TODO - Add RayCaster for interpolation with appropriate geometry
THREE.DynamicTerrainMap.prototype.heightAt = function (x,z) {

  x = Math.round(x * 100) / 100;
  z = Math.round(z * 100) / 100;

  // Make sure point is in range.
  if( x < 0 || x > this._width || z < 0 || z > this._depth ) {
    return undefined;
  }

  if( Math.round(x) == x &&
      Math.round(z) == z && 
      this._heightMap[this._getHeightMapArrayPosition(x,z)] ) {
    return this._heightMap[this._getHeightMapArrayPosition(x,z)];
  }

  // LERP 4 Corners
  var nw = { x: Math.floor(x), z: Math.floor(z) };
  var ne = { x: Math.ceil(x), z: Math.floor(z) };
  var sw = { x: Math.floor(x), z: Math.ceil(z) };
  var se = { x: Math.ceil(x), z: Math.ceil(z) };

  nw.y = this._heightMap[this._getHeightMapArrayPosition(nw.x,nw.z)];
  ne.y = this._heightMap[this._getHeightMapArrayPosition(ne.x,ne.z)];
  sw.y = this._heightMap[this._getHeightMapArrayPosition(sw.x,sw.z)];
  se.y = this._heightMap[this._getHeightMapArrayPosition(se.x,se.z)];

  console.log(nw);
  console.log(ne);
  console.log(sw);
  console.log(se);

  
  var dx = ( x - Math.floor(x) );
  var dz = ( z - Math.floor(z) );

  return THREE.DynamicTerrainMap.lerp(
    THREE.DynamicTerrainMap.lerp(
      nw.y, 
      se.y, 
      ( ( 1 + dx - dz ) / 2 )
    ),
    ( dx > ( 1 - dz ) ) ? ne.y : sw.y,
    Math.abs(1 - dx - dz )
  );
}



THREE.DynamicTerrainMap.prototype.checkGeometry = function () {
  for( var i = 0; i < this._map.length; i++ ) {
    this._map[i].checkGeometry();
  }
}

THREE.DynamicTerrainMap.prototype._loadImageHeightMap = function (imageUrl, callback) {
  var _this = this;
  var heightMapImage = new Image;
  
  // We could make this something like _parseImageHeightMapData
  heightMapImage.onload = (function() {
    _this._width = heightMapImage.width;
    _this._depth = heightMapImage.height;
    
    _this._heightMapLength = _this._width * _this._depth;
    _this._heightMap = new Float32Array(_this._heightMapLength);

    var heightMapImageDataCanvas = document.createElement('canvas');
    heightMapImageDataCanvas.width = _this._width;
    heightMapImageDataCanvas.height = _this._depth;
    var heightMapImageDataContext = heightMapImageDataCanvas.getContext('2d');
    heightMapImageDataContext.drawImage(heightMapImage, 0, 0);
    var heightMapImageData = heightMapImageDataContext.getImageData(0, 0, _this._width, _this._depth);

    var r,g,b,a;
    for( var i = 0; i < heightMapImageData.data.length; i += 4 ) {
      _this._heightMap[i/4] = _this._convertToFloat({
        r:heightMapImageData.data[i+0],
        g:heightMapImageData.data[i+1],
        b:heightMapImageData.data[i+2],
        a:heightMapImageData.data[i+3]
      });
    }
    _this._generateMap(callback);
  });

  heightMapImage.src = imageUrl;
}

THREE.DynamicTerrainMap.prototype._createFlatHeightMap = function (width, depth, callback) {
  this._width = width;
  this._depth = depth;

  this._heightMapLength = this._width * this._depth;
  this._heightMap = new Float32Array(this._heightMapLength);

  for( var i = 0; i < this._heightMapLength; i++ ) {
    this._heightMap[i] = 0; // Ground level.
  }

  this._generateMap(callback);
}

THREE.DynamicTerrainMap.prototype._createArrayHeightMap = function (data, width, depth, callback) {
  this._width = width;
  this._depth = depth;
  this._heightMapLength = this._width * this._depth;
  
  // Zero-fill
  if( data.length != ( width * depth ) ) {
    for( var i = data.length; i < this._heightMapLength; i++ ) {
      data[i] = 0;
    }
  }

  this._heightMap = data;
  
  this._generateMap(callback);
}

THREE.DynamicTerrainMap.prototype._generateMap = function (callback) {
  var _this = this;
  this._map = [];

  if( this._useWorkers ) {
    _this._chunkBuilder = new THREE.DynamicTerrainMapChunkBuilder();
    _this._chunkBuilder.init({
      workerCount: 2,
      workerScriptLocation: this._workerScriptLocation,
      width: this._width,
      depth: this._depth,
      heightMap: this._heightMap,
      heightMapLength: this._heightMapLength,
      sendChunkGeometry: function (index, distanceIndex, xVertices, zVertices, xOffset, zOffset, bufferGeometryIndices,bufferGeometryPositions,bufferGeometryNormals,bufferGeometryUvs,bufferGeometryOffsets) {
        _this._sendChunkGeometry(index, distanceIndex, xVertices, zVertices, xOffset, zOffset, bufferGeometryIndices,bufferGeometryPositions,bufferGeometryNormals,bufferGeometryUvs,bufferGeometryOffsets);
      }
    });
  }

  var widthStart = this._position.x - Math.floor( this._width / 2 ) + ( this._mapChunkSize / 2 );
  var depthStart = this._position.z - Math.floor( this._depth / 2 ) + ( this._mapChunkSize / 2 );
  for( var j = 0; j < Math.ceil(this._width / this._mapChunkSize); j++ ) {
    for( var k = 0; k < Math.ceil(this._depth / this._mapChunkSize); k++ ) { 
      var mapChunkMaterial = this._material;
      if( this._debugMode ) {
        var genericWireframeMaterial = new THREE.GenericWireframeMaterial({
          repeat: 10.0,
          width: 0.005,
          color: new THREE.Color(THREE.DynamicTerrainMap._debugModeColors[Math.floor(Math.random() * THREE.DynamicTerrainMap._debugModeColors.length)])
        });
        mapChunkMaterial = genericWireframeMaterial.generateMaterial();
      }
      var mapChunkIndex = parseInt( j + k * Math.ceil(this._width / this._mapChunkSize) );
      var mapChunkWidth = ( j * this._mapChunkSize + this._mapChunkSize > this._width )
             ? ( this._width - j * this._mapChunkSize )
             : this._mapChunkSize;
      var mapChunkDepth = ( k * this._mapChunkSize + this._mapChunkSize > this._depth )
             ? ( this._depth - k * this._mapChunkSize )
             : this._mapChunkSize;
      var mapChunk = new THREE.DynamicTerrainMapChunk({
        mapIndex: mapChunkIndex,
        width: mapChunkWidth,
        depth: mapChunkDepth,
        position: {
          x: ( widthStart + j * this._mapChunkSize - ( ( this._mapChunkSize - mapChunkWidth ) / 2 ) ),
          y: this._position.y,
          z: ( depthStart + k * this._mapChunkSize - ( ( this._mapChunkSize - mapChunkDepth ) / 2 ) )
        },
        detailRanges: this._detailRanges,
        chunkHoverRange: this._chunkHoverRange,
        chunkShowFarthest: this._chunkShowFarthest,
        heightMap: this._heightMap,
        heightMapLength: this._heightMapLength,
        heightMapWidth: this._width,
        heightMapDepth: this._depth,
        heightMapWidthZero: ( j * this._mapChunkSize ),
        heightMapDepthZero: ( k * this._mapChunkSize ),
        material: mapChunkMaterial,
        camera: this._camera,
        scene: this._scene,
        useWorkers: this._useWorkers,
        buildChunkGeometry: ! this._useWorkers ? null : function (chunkIndex, distanceIndex, widthZero, depthZero, chunkWidth, chunkDepth) {
          _this._chunkBuilder.updateChunkGeometry(
            {
              mapChunkIndex: chunkIndex,
              distanceIndex: distanceIndex,
              heightMapWidthZero: widthZero,
              heightMapDepthZero: depthZero,
              chunkWidth: chunkWidth,
              chunkDepth: chunkDepth
            }
          );
        }
      });
      this._map[mapChunkIndex] = mapChunk;
    }
  }

  if( callback ) callback();
}

THREE.DynamicTerrainMap.prototype._sendChunkGeometry = function (index, distanceIndex, xVertices, zVertices, xOffset, zOffset, bufferGeometryIndices,bufferGeometryPositions,bufferGeometryNormals,bufferGeometryUvs,bufferGeometryOffsets) {
  this._map[index].updateChunkGeometry(distanceIndex, xVertices, zVertices, xOffset, zOffset, bufferGeometryIndices,bufferGeometryPositions,bufferGeometryNormals,bufferGeometryUvs,bufferGeometryOffsets);
}

THREE.DynamicTerrainMap.prototype._getHeightMapArrayPosition = function (widthPosition, depthPosition) {
  return ( depthPosition * this._width + widthPosition );
}

THREE.DynamicTerrainMap.prototype._getMapArrayPosition = function (widthPosition, depthPosition) {
  return ( 
    ( Math.floor(this._width / this._mapChunkSize) * Math.floor(depthPosition / this._mapChunkSize) ) +
    Math.floor(widthPosition / this._mapChunkSize) 
  );
}
