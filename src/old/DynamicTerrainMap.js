/**
 * Dynamic Terrain Map
 * This should divide a large terrain into manageable chunks
 * and automatically switch out low and high detail maps depending on
 * camera position.
 */

/*
ADD PARAMETERS
chunkSize
chunkDetailRanges
chunkHoverRange
chunkHideLast
 */

THREE.DynamicTerrainMap = function () {
  this._width = null;
  this._depth = null;
  this._map = null;
  this._heightMap = null;
  this._heightMapLength = null;
  this._material = null;
  this._camera = null;
  this._cameraDelta = 0;
  this._scene = null;
  this._position = null;
  this._debugMode = false;
  this._chunkBuilder = null;
  this._useWorkers = false;
  this._mapChunkSize = null;
  this._detailRanges = null;
  this._chunkHoverRange = null;
  this._chunkHideFarthest = null;
}

THREE.DynamicTerrainMap._mapChunkSize = 500;

// Statics
THREE.DynamicTerrainMap._defaultMapChunkSize = 500;
THREE.DynamicTerrainMap._defaultDetailRanges = [
  100,
  1500,
  3000,
  10000
];
THREE.DynamicTerrainMap._defaultChunkHoverRange = 300;
THREE.DynamicTerrainMap._defaultChunkHideFarthest = true;

THREE.DynamicTerrainMap._debugModeColors = [
  0x414141,
  0x008800,
  0x336699,
  0xff4100,
  0x03899c,
  0xa6a400,
  0xbf3030
];

THREE.DynamicTerrainMap._cameraDeltaThreshold = 100;

THREE.DynamicTerrainMap.prototype = {
  
  constructor: THREE.DynamicTerrainMap,

  /**
   * options parameters:
   * heightmap based on an image
   *   imageUrl - a heightmap rgba image
   *   imageScale - Multiplier for RGBA values ( Base 255 )
   * OR a flat terrain
   *   flatWidth
   *   flatDepth
   * ALSO INCLUDE
   *   material - The terrain material w/ shaders, etc.
   *   camera - If you want automatic terrain updating
   *   scene
   */
  init: function (options, mainCallback) {
    if( this._width != null ||
        this._depth != null ) {
      return;
    }

    this._scene = options.scene ? options.scene : null;
    this._camera = options.camera ? options.camera : null;
    this._material = options.material ? options.material : null;

    // The "center" position
    this._position = options.position ? options.position : {x:0,y:0,z:0};

    // Requires GenericWireframeMaterial.js
    // Replace all textures with wireframes of varying colors
    this._debugMode = options.debugMode ? true : false;

    // If a useWorkers isn't strictly passed we just try to detect it.
    if( typeof options.useWorkers == "undefined" ) {
      this._useWorkers = typeof Worker == "undefined" ? false : true;
    } else {
      this._useWorkers = options.useWorkers ? true : false;
    }
    
    if( this._scene == null || 
        this._material == null ) {
      return;
    }

  	if( options.imageUrl ) {
      options.imageScale = options.imageScale ? options.imageScale : 1;
  	  this._loadImageHeightMap(options.imageUrl,options.imageScale,mainCallback);
  	} else {
      options.flatWidth = options.flatWidth ? options.flatWidth : 1000;
      options.flatDepth = options.flatDepth ? options.flatDepth : options.flatWidth;
      this._createFlatHeightMap(options.flatWidth,options.flatDepth,mainCallback);
    }
  },

  width: function () {
    return this._width;
  },

  depth: function () {
    return this._depth;
  },

  position: function () {
    return this._position;
  },

  getHeight: function (x,z) {
    if( ! this._heightMap[this._getHeightMapArrayPosition(x,z)] ) {
      return false;
    }
    return this._heightMap[this._getHeightMapArrayPosition(x,z)];
  },

  setHeight: function (x,z,height) {
    if( ! this._heightMap[this._getHeightMapArrayPosition(x,z)] ) {
      return;
    }
    this._heightMap[this._getHeightMapArrayPosition(x,z)] = height;
    this._chunkBuilder.setHeight(x,z,height);
    this._map[this._getMapArrayPosition(x,z)].setHeight(x,z,height);
  },

  increaseHeight: function (x,z,dHeight) {
    if( ! this._heightMap[this._getHeightMapArrayPosition(x,z)] ) {
      return;
    }
    dHeight = dHeight ? dHeight : 1;
    this._heightMap[this._getHeightMapArrayPosition(x,z)] += Math.abs(dHeight);
  },

  decreaseHeight: function (x,z,dHeight) {
    if( ! this._heightMap[this._getHeightMapArrayPosition(x,z)] ) {
      return;
    }
    dHeight = dHeight ? dHeight : 1;
    this._heightMap[this._getHeightMapArrayPosition(x,z)] -= Math.abs(dHeight);
  },

  checkGeometry: function(mainCallback) {
    for( var i = 0; i < this._map.length; i++ ) {
      this._map[i].checkGeometry();
    }

    if( mainCallback ) mainCallback();
  },

  _loadImageHeightMap: function (imageUrl, imageScale, callback) {
    var self = this;
    var heightMapImage = new Image;
    
    // We could make this something like _parseImageHeightMapData
    heightMapImage.onload = (function() {
      self._width = heightMapImage.width;
      self._depth = heightMapImage.height;

      console.log(heightMapImage.width+','+heightMapImage.height);

      self._heightMapLength = self._width * self._depth;
      self._heightMap = new Float32Array(self._heightMapLength);
      console.log("TOTAL COUNT: "+self._heightMapLength);

      var heightMapImageDataCanvas = document.createElement('canvas');
      heightMapImageDataCanvas.width = self._width;
      heightMapImageDataCanvas.height = self._depth;
      var heightMapImageDataContext = heightMapImageDataCanvas.getContext('2d');
      heightMapImageDataContext.drawImage(heightMapImage, 0, 0);
      var heightMapImageData = heightMapImageDataContext.getImageData(0, 0, self._width, self._depth);

      var r,g,b,a;
      for( var i = 0; i < heightMapImageData.data.length; i += 4 ) {
        r = heightMapImageData.data[ i + 0 ];
        g = heightMapImageData.data[ i + 1 ];
        b = heightMapImageData.data[ i + 2 ];
        a = heightMapImageData.data[ i + 3 ];
        self._heightMap[ i / 4 ] = imageScale * 
          (
            r * 1 + // Math.pow(255,0) +
            g * 1 + // Math.pow(255,1) +
            b * 1 + // 1 + // Math.pow(255,2) +
            a * 0 // Math.pow(255,3)
          );
      }
      self._generateMap(callback);
    });

    heightMapImage.src = imageUrl;
  },

  _createFlatHeightMap: function (width, depth, callback) {
    this._width = width;
    this._depth = depth;

    this._heightMapLength = this._width * this._depth;
    this._heightMap = new Float32Array(this._heightMapLength);

    for( var i = 0; i < this._heightMapLength; i++ ) {
      this._heightMap[i] = 0; // Ground level.
    }

    this._generateMap(callback);
  },

  _generateMap: function (callback) {
    // Create our Builder first - we'll need to pass references
    // to this in our mapChunks.
    
    this._chunkBuilder = new THREE.DynamicTerrainMapChunkBuilder();
    this._chunkBuilder.init({
      workerCount: 2,
      width: this._width,
      depth: this._depth,
      heightMap: this._heightMap,
      heightMapLength: this._heightMapLength,
      sendChunkGeometry: function (index, distanceIndex, xVertices, zVertices, xOffset, zOffset, bufferGeometryIndices,bufferGeometryPositions,bufferGeometryNormals,bufferGeometryUvs,bufferGeometryOffsets) {
        self._sendChunkGeometry(index, distanceIndex, xVertices, zVertices, xOffset, zOffset, bufferGeometryIndices,bufferGeometryPositions,bufferGeometryNormals,bufferGeometryUvs,bufferGeometryOffsets);
      }
    });

    this._map = [];
    var self = this;
    var widthStart = this._position.x - Math.floor( this._width / 2 ) + ( THREE.DynamicTerrainMap._mapChunkSize / 2 );
    var depthStart = this._position.z - Math.floor( this._depth / 2 ) + ( THREE.DynamicTerrainMap._mapChunkSize / 2 );
    for( var j = 0; j < Math.ceil(this._width / THREE.DynamicTerrainMap._mapChunkSize); j++ ) {
      for( var k = 0; k < Math.ceil(this._depth / THREE.DynamicTerrainMap._mapChunkSize); k++ ) { 
        var mapChunkIndex = ( j + k * Math.ceil(this._width / THREE.DynamicTerrainMap._mapChunkSize) );
        var mapChunkWidth = ( j * THREE.DynamicTerrainMap._mapChunkSize + THREE.DynamicTerrainMap._mapChunkSize > this._width )
               ? ( this._width - j * THREE.DynamicTerrainMap._mapChunkSize )
               : THREE.DynamicTerrainMap._mapChunkSize;
        var mapChunkDepth = ( k * THREE.DynamicTerrainMap._mapChunkSize + THREE.DynamicTerrainMap._mapChunkSize > this._depth )
               ? ( this._depth - k * THREE.DynamicTerrainMap._mapChunkSize )
               : THREE.DynamicTerrainMap._mapChunkSize;
        var mapChunk = new THREE.DynamicTerrainMapChunk();
        var mapChunkMaterial = this._material;
        if( this._debugMode ) {
          var genericWireframeMaterial = new THREE.GenericWireframeMaterial({
            repeat: 10.0,
            width: 0.005,
            color: new THREE.Color(THREE.DynamicTerrainMap._debugModeColors[Math.floor(Math.random() * THREE.DynamicTerrainMap._debugModeColors.length)])
          });
          mapChunkMaterial = genericWireframeMaterial.generateMaterial();
        }

        mapChunk.init({
          mapIndex: mapChunkIndex,
          width: mapChunkWidth,
          depth: mapChunkDepth,
          position: {
            x: ( widthStart + j * THREE.DynamicTerrainMap._mapChunkSize - ( ( THREE.DynamicTerrainMap._mapChunkSize - mapChunkWidth ) / 2 ) ),
            y: this._position.y,
            z: ( depthStart + k * THREE.DynamicTerrainMap._mapChunkSize - ( ( THREE.DynamicTerrainMap._mapChunkSize - mapChunkDepth ) / 2 ) )
          },
          heightMap: this._heightMap,
          heightMapLength: this._heightMapLength,
          heightMapWidth: this._width,
          heightMapDepth: this._depth,
          heightMapWidthZero: ( j * THREE.DynamicTerrainMap._mapChunkSize ),
          heightMapDepthZero: ( k * THREE.DynamicTerrainMap._mapChunkSize ),
          material: mapChunkMaterial,
          camera: this._camera,
          scene: this._scene,
          useWorkers: this._useWorkers,
          buildChunkGeometry: function (chunkIndex, distanceIndex, widthZero, depthZero, chunkWidth, chunkDepth) {
            self._chunkBuilder.updateChunkGeometry(
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
        this._map.push(mapChunk);
      }
    }

    // Our callback should fire once we're ready to start throwing meshes in and out.
    callback();
  },

  _sendChunkGeometry: function (index, distanceIndex, xVertices, zVertices, xOffset, zOffset, bufferGeometryIndices,bufferGeometryPositions,bufferGeometryNormals,bufferGeometryUvs,bufferGeometryOffsets) {
    this._map[index].updateChunkGeometry(distanceIndex, xVertices, zVertices, xOffset, zOffset, bufferGeometryIndices,bufferGeometryPositions,bufferGeometryNormals,bufferGeometryUvs,bufferGeometryOffsets);
  },

  _getHeightMapArrayPosition: function (widthPosition, depthPosition) {
    return ( depthPosition * this._width + widthPosition );
  },

  _getMapArrayPosition: function (widthPosition, depthPosition) {
    return ( 
      ( Math.floor(this._width / THREE.DynamicTerrainMap._mapChunkSize) * Math.floor(depthPosition / THREE.DynamicTerrainMap._mapChunkSize) ) +
      Math.floor(widthPosition / THREE.DynamicTerrainMap._mapChunkSize) 
    );
  }

}