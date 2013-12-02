/**
 * Dynamic Terrain Map Chunk
 * A portion of a larger terrain map.
 */

THREE.DynamicTerrainMapChunk = function () {
  this._mapIndex = null;
  this._buildChunkGeometry = null;
  this._width = null;
  this._depth = null;
  this._position = null;
  this._heightMap = null;
  this._heightMapLength = null;
  this._heightMapWidth = null;
  this._heightMapDepth = null;
  this._heightMapWidthZero = null;
  this._heightMapDepthZero = null;
  this._material = null;
  this._camera = null;
  this._scene = null;
  this._useWorkers = false;

  this._geometry = null;
  this._mesh = null;

  this._updating = false;
  this._currentGeometryDistanceIndex = false;
}

THREE.DynamicTerrainMapChunk.detailRanges = [
	100,
  750,
  2500,
  10000
];

THREE.DynamicTerrainMapChunk.prototype = {
  
  constructor: THREE.DynamicTerrainMapChunk,

  /**
   * options parameters:
   *   width
   *   depth
   *   widthPosition
   *   depthPosition
   *   heightMap
   *   heightMapLength
   *   heightMapWidth
   *   heightMapDepth
   *   heightMapWidthZero
   *   heightMapDepthZero
   *   material
   *   camera
   *   scene
   */
  init: function (options) {
    if( this._width != null ||
        this._depth != null ) {
      return;
    }

    this._mapIndex = options.mapIndex.toString ? options.mapIndex : null;
    this._width = options.width.toString ? options.width : null;
    this._depth = options.depth.toString ? options.depth : null;
    this._heightMap = options.heightMap.toString ? options.heightMap : null;
    this._heightMapLength = options.heightMapLength.toString ? options.heightMapLength : null;
    this._heightMapWidth = options.heightMapWidth.toString ? options.heightMapWidth : null;
    this._heightMapDepth = options.heightMapDepth.toString ? options.heightMapDepth : null;
    this._heightMapWidthZero = options.heightMapWidthZero.toString ? options.heightMapWidthZero : null;
    this._heightMapDepthZero = options.heightMapDepthZero.toString ? options.heightMapDepthZero : null;
    this._material = options.material.toString ? options.material : null;
    this._camera = options.camera.toString ? options.camera : null;
    this._scene = options.scene.toString ? options.scene : null;
    this._buildChunkGeometry = options.buildChunkGeometry;
    this._useWorkers = options.useWorkers ? true : false;

    this._currentXVertices = null;
    this._currentZVertices = null;

    this._position = options.position.toString ? options.position : {x:0,y:0,z:0};

    // console.log("CREATING CHUNK AT "+this._position.x+','+this._position.z+' WITH ZEROS '+this._heightMapWidthZero+','+this._heightMapDepthZero);

    // Check if any null?
    this.checkGeometry();
  },

  updateChunkGeometry: function (distanceIndex, xVertices, zVertices, xOffset, zOffset, bufferGeometryIndices,bufferGeometryPositions,bufferGeometryNormals,bufferGeometryUvs,bufferGeometryOffsets) {

    this._currentXVertices = xVertices;
    this._currentZVertices = zVertices;

    var numberOfVerts = xVertices * zVertices;
    var triangles = ( xVertices - 1 ) * ( zVertices - 1 ) * 2;
    
    var bufferGeometryIndicesLength = (triangles * 3);
    var bufferGeometryPositionsLength = (numberOfVerts * 3);
    var bufferGeometryNormalsLength = (numberOfVerts * 3);
    var bufferGeometryUvsLength = (numberOfVerts * 2);

    var bufferGeometry = new THREE.BufferGeometry();
    
    bufferGeometry.attributes = {
      index: {
        itemSize: 1,
        array: bufferGeometryIndices,
        numItems: bufferGeometryIndicesLength
      },
      position: {
        itemSize: 3,
        array: bufferGeometryPositions,
        numItems: bufferGeometryPositionsLength
      },
      normal: {
        itemSize: 3,
        array: bufferGeometryNormals,
        numItems: bufferGeometryNormalsLength
      },
      uv: {
        itemSize: 2,
        array: bufferGeometryUvs,
        numItems: bufferGeometryUvsLength
      }
    };
    
    bufferGeometry.offsets = bufferGeometryOffsets;

    if( this._mesh != null ) {
      this._scene.remove(this._mesh);
      delete this._mesh;
      delete this._geometry;
    }

    this._geometry = bufferGeometry;
    this._mesh = new THREE.Mesh(
      this._geometry,
      this._material
    );
    
    this._mesh.position.set(this._position.x + xOffset,this._position.y,this._position.z + zOffset);
    this._scene.add(this._mesh);

    this._updating = false;
  },

  // Check if we need to redraw 
  checkGeometry: function() {
    if( this._currentGeometryDistance == null ||
        ! this._updating ) {
      var index = this._geometryDistanceIndex();
      if( this._camera.position.y <= THREE.DynamicTerrainMapChunk.detailRanges[0] &&
        (
          ( this._position.x - (this._width / 2) ) >= this._camera.position.x &&
          ( this._position.x + (this._width / 2) ) <= this._camera.position.x &&
          ( this._position.z - (this._depth / 2) ) >= this._camera.position.z &&
          ( this._position.z + (this._depth / 2) ) <= this._camera.position.z
        ) ) {
        this._currentGeometryDistanceIndex = 0;
      }
      if( index != this._currentGeometryDistanceIndex ) {
        this._currentGeometryDistanceIndex = index;
        this._updateGeometry();
      }
    }
  },

  position: function() {
    return this._position;
  },

  // The height has already been updated in DynamicTerrainMap - but this flags that we should update
  // the vertex.
  setHeight: function (x,z,height) {
    if( this._geometry ) {
      // TODO - Figure out how to look up specific vertex and apply new height - then call
      // this._geometry.verticesNeedUpdate = true;
    }
  },

  _updateGeometry: function() {
    var self = this;
    this._updating = true;
    console.log('UPDATING FOR INDEX: '+this._currentGeometryDistanceIndex);
    if( this._currentGeometryDistanceIndex >= THREE.DynamicTerrainMapChunk.detailRanges.length ) {
      if( this._mesh ) {
        scene.remove(this._mesh);
        delete this._mesh;
        delete this._geometry;
      }
      return;
    }

    // Send our request to the chunk builder.
    if( self._useWorkers ) {
      self._buildChunkGeometry(
        self._mapIndex, 
        self._currentGeometryDistanceIndex,
        self._heightMapWidthZero, 
        self._heightMapDepthZero, 
        self._width, 
        self._depth);
    } else {
      var xVertices = Math.floor( self._width / Math.pow(4,self._currentGeometryDistanceIndex) );
      var zVertices = Math.floor( self._depth / Math.pow(4,self._currentGeometryDistanceIndex) );

      // Cheap rigging for overlapping
      var geoWidth = self._width;
      var geoDepth = self._depth;
      var startWidth = self._heightMapWidthZero;
      var startDepth = self._heightMapDepthZero;
      var xOffset = 0;
      var zOffset = 0;
      var geoIncrement = Math.pow(4,self._currentGeometryDistanceIndex);
      
      if( self._heightMapWidthZero != 0 ) {
        geoWidth += geoIncrement;
        xVertices++;
        xOffset -= geoIncrement / 2;
        startWidth -= geoIncrement;
      }
      
      if( ( self._heightMapWidthZero + self._width + geoIncrement ) < self._heightMapWidth ) {
        geoWidth += geoIncrement;
        xVertices++;
        xOffset += geoIncrement / 2;
      }
      
      if( self._heightMapDepthZero != 0 ) {
        geoDepth += geoIncrement;
        zVertices++;
        zOffset -= (geoIncrement / 2);
        startDepth -= geoIncrement;
      }
      
      if( ( self._heightMapDepthZero + self._depth + geoIncrement ) < self._heightMapDepth ) {
        geoDepth += geoIncrement;
        zVertices++;
        zOffset += geoIncrement / 2;
      }
      
      var numberOfVerts = xVertices * zVertices;
      var triangles = ( xVertices - 1 ) * ( zVertices - 1 ) * 2;
       
      var indices = new Uint16Array(triangles * 3);
      var indicesLength = (triangles * 3);
      var positions = new Float32Array(numberOfVerts * 3);
      var positionsLength = (numberOfVerts * 3);
      var normals = new Float32Array(numberOfVerts * 3);
      var normalsLength = (numberOfVerts * 3);
      var uvs = new Float32Array(numberOfVerts * 2);
      var uvsLength = (numberOfVerts * 2);
      var offsets = [];

      var chunkSize = 21845;

      var startX = -geoWidth / 2;
      var startZ = -geoDepth / 2;
      var chunkX = geoWidth / ( xVertices - 1 );
      var chunkZ = geoDepth / ( zVertices - 1 );

      // Create Vertices
      for( var x = 0; x < xVertices; x++ ) {
        for( var z = 0; z < zVertices; z++ ) {
          var index = ( z * xVertices + x ) * 3;
          positions[index + 0] = startX + x * chunkX;  // X
          positions[index + 1] = self._heightMap[self._getHeightMapArrayPosition((xOffset * 2) + Math.round(chunkX * x) + startWidth, (zOffset * 2) + Math.round(chunkZ * z) + startDepth, self._width)];
          positions[index + 2] = startZ + z * chunkZ;  // Z

          var uvIndex = ( z * xVertices + x ) * 2;
          uvs[uvIndex + 0] = x / ( xVertices - 1 );
          uvs[uvIndex + 1] = 1.0 - z / ( zVertices - 1 );
        }
      }

      // Create Chunks and Indices
      var lastChunkRow = 0;
      var lastChunkVertStart = 0;

      for (var x = 0; x < ( zVertices - 1 ); x++ ) {
        var startVertIndex = x * xVertices;

        if ((startVertIndex - lastChunkVertStart) + xVertices * 2 > chunkSize) {
          var newChunk = {
            start: lastChunkRow * ( xVertices - 1 ) * 6,
            index: lastChunkVertStart,
            count: (x - lastChunkRow) * ( xVertices - 1 ) * 6
          };
          offsets.push(newChunk);
          lastChunkRow = x;
          lastChunkVertStart = startVertIndex;
        }

        for (var z = 0; z < ( xVertices - 1 ); ++z) {
          var index = (x * ( xVertices - 1 ) + z) * 6;
          var vertIndex = (x * xVertices + z) - lastChunkVertStart;

          indices[index + 0] = vertIndex;
          indices[index + 1] = vertIndex + xVertices;
          indices[index + 2] = vertIndex + 1;
          indices[index + 3] = vertIndex + 1;
          indices[index + 4] = vertIndex + xVertices;
          indices[index + 5] = vertIndex + xVertices + 1;
        }
      }

      var lastChunk = {
        start: lastChunkRow * ( xVertices - 1 ) * 6,
        index: lastChunkVertStart,
        count: ( ( zVertices - 1 ) - lastChunkRow) * ( xVertices - 1 ) * 6
      };

      offsets.push(lastChunk);

      self.updateChunkGeometry(self._currentGeometryDistanceIndex, xVertices, zVertices, xOffset, zOffset, indices,positions,normals,uvs,offsets); 
    }
  },

  _geometryDistanceIndex: function() {
    var cameraDistance = this._cameraDistance();
    var i;
    for( i = 0; i < THREE.DynamicTerrainMapChunk.detailRanges.length; i++ ) {
      if( cameraDistance < THREE.DynamicTerrainMapChunk.detailRanges[i] ) {
        return i;
      }
    }
    return i;
  },

  // Get the distance from the center of this chunk to the camera.
  _cameraDistance: function() {
    return Math.sqrt(
      Math.pow((this._position.x - this._camera.position.x),2) +
      Math.pow((this._position.y - this._camera.position.y),2) +
      Math.pow((this._position.z - this._camera.position.z),2)
    );
  },

  _getHeightMapArrayPosition: function (widthPosition, depthPosition) {
    return ( depthPosition * this._heightMapWidth + widthPosition );
  },

};