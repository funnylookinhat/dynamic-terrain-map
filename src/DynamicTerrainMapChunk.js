/**
 * Dynamic Terrain Map Chunk
 * A portion of a larger terrain map.
 */

THREE.DynamicTerrainMapChunk = function (parameters) {

  this._width = parameters.width ? parameters.width : null;
  this._depth = parameters.depth ? parameters.depth : null;

  this._scene = parameters.scene ? parameters.scene : null;
  this._camera = parameters.camera ? parameters.camera : null;
  this._material = parameters.material ? parameters.material : null;
  
  this._buildChunkGeometry = parameters.buildChunkGeometry;
  this._useWorkers = parameters.useWorkers ? true : false;

  this._detailRanges = parameters.detailRanges;
  this._chunkHoverRange = parameters.chunkHoverRange;
  this._chunkShowFarthest = parameters.chunkShowFarthest;

  this._position = parameters.position ? parameters.position : {x:0,y:0,z:0};
  this._mapIndex = parameters.mapIndex ? parameters.mapIndex : null;
  this._heightMap = parameters.heightMap ? parameters.heightMap : null;
  this._heightMapLength = parameters.heightMapLength ? parameters.heightMapLength : null;
  this._heightMapWidth = parameters.heightMapWidth ? parameters.heightMapWidth : null;
  this._heightMapDepth = parameters.heightMapDepth ? parameters.heightMapDepth : null;
  this._heightMapWidthZero = parameters.heightMapWidthZero ? parameters.heightMapWidthZero : null;
  this._heightMapDepthZero = parameters.heightMapDepthZero ? parameters.heightMapDepthZero : null;

  // Declare some privates.
  this._geometry = null;
  this._mesh = null;
  this._updating = false;
  this._currentGeometryDistanceIndex = false;
  this._currentXVertices = null;
  this._currentZVertices = null;
}

THREE.DynamicTerrainMapChunk.prototype.updateChunkGeometry = function (distanceIndex, xVertices, zVertices, xOffset, zOffset, bufferGeometryIndices,bufferGeometryPositions,bufferGeometryNormals,bufferGeometryUvs,bufferGeometryOffsets) {

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
}

THREE.DynamicTerrainMapChunk.prototype.checkGeometry = function () {
  if( this._currentGeometryDistance == null ||
      ! this._updating ) {
    var index = this._geometryDistanceIndex();
    if( this._camera.position.y <= this._chunkHoverRange &&
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
}

THREE.DynamicTerrainMapChunk.prototype.position = function () {
  return this._position;
}

THREE.DynamicTerrainMapChunk.prototype._updateGeometry = function () {
  var _this = this;
  this._updating = true;
  if( this._currentGeometryDistanceIndex >= this._detailRanges.length &&
      ! this._chunkShowFarthest ) {
    if( this._mesh ) {
      scene.remove(this._mesh);
      delete this._mesh;
      delete this._geometry;
    }
    return;
  }

  // Send our request to the chunk builder.
  if( _this._useWorkers &&
      _this._buildChunkGeometry ) {
    _this._buildChunkGeometry(
      _this._mapIndex, 
      _this._currentGeometryDistanceIndex,
      _this._heightMapWidthZero, 
      _this._heightMapDepthZero, 
      _this._width, 
      _this._depth);
  } else {
    var xVertices = Math.floor( _this._width / Math.pow(4,_this._currentGeometryDistanceIndex) );
    var zVertices = Math.floor( _this._depth / Math.pow(4,_this._currentGeometryDistanceIndex) );

    // Cheap rigging for overlapping
    var geoWidth = _this._width;
    var geoDepth = _this._depth;
    var startWidth = _this._heightMapWidthZero;
    var startDepth = _this._heightMapDepthZero;
    var xOffset = 0;
    var zOffset = 0;
    var geoIncrement = Math.pow(4,_this._currentGeometryDistanceIndex);
    
    if( _this._heightMapWidthZero != 0 ) {
      geoWidth += geoIncrement;
      xVertices++;
      xOffset -= geoIncrement / 2;
      startWidth -= geoIncrement;
    }
    
    if( ( _this._heightMapWidthZero + _this._width + geoIncrement ) < _this._heightMapWidth ) {
      geoWidth += geoIncrement;
      xVertices++;
      xOffset += geoIncrement / 2;
    }
    
    if( _this._heightMapDepthZero != 0 ) {
      geoDepth += geoIncrement;
      zVertices++;
      zOffset -= (geoIncrement / 2);
      startDepth -= geoIncrement;
    }
    
    if( ( _this._heightMapDepthZero + _this._depth + geoIncrement ) < _this._heightMapDepth ) {
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
        positions[index + 1] = _this._heightMap[_this._getHeightMapArrayPosition((xOffset * 2) + Math.round(chunkX * x) + startWidth, (zOffset * 2) + Math.round(chunkZ * z) + startDepth, _this._width)];
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

    _this.updateChunkGeometry(_this._currentGeometryDistanceIndex, xVertices, zVertices, xOffset, zOffset, indices,positions,normals,uvs,offsets); 
  }
}

THREE.DynamicTerrainMapChunk.prototype._geometryDistanceIndex = function () {
  var cameraDistance = this._cameraDistance();
  var i;
  for( i = 0; i < this._detailRanges.length; i++ ) {
    if( cameraDistance < this._detailRanges[i] ) {
      return i;
    }
  }
  return i;
}

THREE.DynamicTerrainMapChunk.prototype._cameraDistance = function () {
  return Math.sqrt(
    Math.pow((this._position.x - this._camera.position.x),2) +
    Math.pow((this._position.y - this._camera.position.y),2) +
    Math.pow((this._position.z - this._camera.position.z),2)
  );
}

THREE.DynamicTerrainMapChunk.prototype._getHeightMapArrayPosition = function (widthPosition, depthPosition) {
  return ( depthPosition * this._heightMapWidth + widthPosition );
}
