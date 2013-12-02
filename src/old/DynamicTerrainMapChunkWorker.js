/**
 * Creates the geometry for a DynamicTerrainMapChunk
 */

// importScripts('includes/three.min.js');

self._id = null;
self._width = null;
self._depth = null;
self._heightMap = null;
self._heightMapLength = null;

self.onmessage = function (e) {
  if( e.data.action == 'init' ) {
    self._id = e.data.actionData.id;
    self._width = e.data.actionData.width;
    self._depth = e.data.actionData.depth;
    self._heightMap = e.data.actionData.heightMap;
    self._heightMapLength = e.data.actionData.heightapLength;

    // READY.
    self.postMessage({
      action: 'init',
      id: self._id
    });
  } else if ( e.data.action == 'setHeight' ) {
    var x = e.data.actionData.x;
    var z = e.data.actionData.z;
    var height = e.data.actionData.height;
    // We know this maps because it's checked for in Builder
    self._heightMap[_getHeightMapArrayPosition(x,z)] = height;
  } else {
    // Create Geometry
    var width = e.data.actionData.chunkWidth;
    var depth = e.data.actionData.chunkDepth;
    var heightMapWidthZero = e.data.actionData.heightMapWidthZero;
    var heightMapDepthZero = e.data.actionData.heightMapDepthZero;
    var currentGeometryDistanceIndex = e.data.actionData.distanceIndex;
    var mapChunkIndex = e.data.actionData.mapChunkIndex;
    
    var xVertices = Math.floor( width / Math.pow(4,currentGeometryDistanceIndex) );
    var zVertices = Math.floor( depth / Math.pow(4,currentGeometryDistanceIndex) );

    var geoWidth = width;
    var geoDepth = depth;
    var startWidth = heightMapWidthZero;
    var startDepth = heightMapDepthZero;
    var xOffset = 0;
    var zOffset = 0;
    var geoIncrement = Math.pow(4,currentGeometryDistanceIndex);
    
    if( heightMapWidthZero != 0 ) {
      geoWidth += geoIncrement;
      xVertices++;
      xOffset -= geoIncrement / 2;
      startWidth -= geoIncrement;
    }
    
    if( ( heightMapWidthZero + width + geoIncrement ) < self._width ) {
      geoWidth += geoIncrement;
      xVertices++;
      xOffset += geoIncrement / 2;
    }
    
    if( heightMapDepthZero != 0 ) {
      geoDepth += geoIncrement;
      zVertices++;
      zOffset -= (geoIncrement / 2);
      startDepth -= geoIncrement;
    }
    
    if( ( heightMapDepthZero + depth + geoIncrement ) < self._depth ) {
      geoDepth += geoIncrement;
      zVertices++;
      zOffset += geoIncrement / 2;
    }
    
    
    // var bufferGeometry = _createBufferGeometry(geoWidth,geoDepth,xVertices,zVertices,xOffset,zOffset,self._width);
    
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
        positions[index + 1] = self._heightMap[_getHeightMapArrayPosition((xOffset * 2) + Math.round(chunkX * x) + startWidth, (zOffset * 2) + Math.round(chunkZ * z) + startDepth, self._width)];
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

    self.postMessage({
      action: 'build',
      id: self._id,
      mapChunkIndex: mapChunkIndex,
      distanceIndex: currentGeometryDistanceIndex,
      xVertices: xVertices,
      zVertices: zVertices,
      xOffset: xOffset,
      zOffset: zOffset,
      bufferGeometryIndices: indices.buffer,
      bufferGeometryPositions: positions.buffer,
      bufferGeometryNormals: normals.buffer,
      bufferGeometryUvs: uvs.buffer,
      bufferGeometryOffsets: offsets
    },[
      indices.buffer, 
      positions.buffer, 
      normals.buffer,
      uvs.buffer
    ]);
  }
};

function  _getHeightMapArrayPosition (widthPosition, depthPosition, heightMapWidth) {
  return ( depthPosition * heightMapWidth + widthPosition );
}
/*
function _createBufferGeometry(widthLength,depthLength,widthVertices,depthVertices,xOffset,zOffset,heightMapWidth) {
  var numberOfVerts = widthVertices * depthVertices;
  var triangles = ( widthVertices - 1 ) * ( depthVertices - 1 ) * 2;
  var bufferGeometry = new THREE.BufferGeometry();
  
  bufferGeometry.attributes = {
    index: {
      itemSize: 1,
      array: new Uint16Array(triangles * 3),
      numItems: triangles * 3
    },
    position: {
      itemSize: 3,
      array: new Float32Array(numberOfVerts * 3),
      numItems: numberOfVerts * 3
    },
    normal: {
      itemSize: 3,
      array: new Float32Array(numberOfVerts * 3),
      numItems: numberOfVerts * 3
    },
    uv: {
      itemSize: 2,
      array: new Float32Array(numberOfVerts * 2),
      numItems: numberOfVerts * 2
    }
  };

  var chunkSize = 21845;

  var indices = bufferGeometry.attributes.index.array;
  var positions = bufferGeometry.attributes.position.array;
  var normals = bufferGeometry.attributes.normal.array;
  var uvs = bufferGeometry.attributes.uv.array;

  var startX = -widthLength / 2;
  var startZ = -depthLength / 2;
  var chunkX = widthLength / ( widthVertices - 1 );
  var chunkZ = depthLength / ( depthVertices - 1 );

  for( var x = 0; x < widthVertices; x++ ) {
    for( var z = 0; z < depthVertices; z++ ) {
      var index = ( z * widthVertices + x ) * 3;
      positions[index + 0] = startX + x * chunkX;  // X
      positions[index + 1] = _getHeightMapArrayPosition(xOffset + startX + x * chunkX, zOffset + startZ + z * chunkZ, heightMapWidth);
      positions[index + 2] = startZ + z * chunkZ;  // Z

      var uvIndex = ( z * widthVertices + x ) * 2;
      uvs[uvIndex + 0] = x / ( widthVertices - 1 );
      uvs[uvIndex + 1] = 1.0 - z / ( depthVertices - 1 );
    }
  }

  bufferGeometry.offsets = [];

  var lastChunkRow = 0;
  var lastChunkVertStart = 0;

 // For each rectangle, generate its indices
  for (var x = 0; x < ( depthVertices - 1 ); x++ ) {

    var startVertIndex = x * widthVertices;

    // If we don't have space for another row, close
    // off the chunk and start the next
    if ((startVertIndex - lastChunkVertStart) + widthVertices * 2 > chunkSize) {

      var newChunk = {
        start: lastChunkRow * ( widthVertices - 1 ) * 6,
        index: lastChunkVertStart,
        count: (x - lastChunkRow) * ( widthVertices - 1 ) * 6
      };

      bufferGeometry.offsets.push(newChunk);

      lastChunkRow = x;
      lastChunkVertStart = startVertIndex;
    }


    for (var z = 0; z < ( widthVertices - 1 ); ++z) {

      var index = (x * ( widthVertices - 1 ) + z) * 6;
      var vertIndex = (x * widthVertices + z) - lastChunkVertStart;

      indices[index + 0] = vertIndex;
      indices[index + 1] = vertIndex + widthVertices;
      indices[index + 2] = vertIndex + 1;
      indices[index + 3] = vertIndex + 1;
      indices[index + 4] = vertIndex + widthVertices;
      indices[index + 5] = vertIndex + widthVertices + 1;
    }
  }

  var lastChunk = {
    start: lastChunkRow * ( widthVertices - 1 ) * 6,
    index: lastChunkVertStart,
    count: ( ( depthVertices - 1 ) - lastChunkRow) * ( widthVertices - 1 ) * 6
  };

  bufferGeometry.offsets.push(lastChunk);
  //geometry.computeBoundingSphere();
  
  return bufferGeometry;
}
*/