/**
 * Worker / Pool Manager for Generating Chunks
 * Requires DynamicTerrainMapChunkWorker.js
 */

THREE.DynamicTerrainMapChunkBuilder = function () {
  this._width = null;
  this._depth = null;
  this._heightMap = null;
  this._heightMapLength = null;
  this._sendChunkGeometry = null;
  this._requestQueue = null;
  
  this._workers = null;
}

THREE.DynamicTerrainMapChunkBuilder.prototype.init = function (options) {
  this._width = options.width;
  this._depth = options.depth;
  this._heightMap = options.heightMap;
  this._heightMapLength = options.heightMapLength;
  this._sendChunkGeometry = options.sendChunkGeometry;

  var workerCount = options.workerCount ? options.workerCount : 1;
  this._workers = [];
  this._workersReady = [];
  this._requestQueue = [];

  var self = this;

  for( var i = 0; i < workerCount; i++ ) {
    this._workers[i] = new Worker('js/DynamicTerrainMapChunkWorker.js');
    this._workers[i].onmessage = function (e) {
      self._workerCallback(e,self);
    }
    this._workersReady[i] = false;
    this._workers[i].postMessage({
      action: 'init',
      actionData: {
        id: i,
        width: this._width,
        depth: this._depth,
        heightMap: this._heightMap,
        heightMapLength: this._heightMapLength
      }
    });
  }
}

THREE.DynamicTerrainMapChunkBuilder.prototype.setHeight = function (x,z,height) {
  if( ! this._heightMap[this._getHeightMapArrayPosition(x,z)] ) {
    return;
  }
  this._heightMap[this._getHeightMapArrayPosition(x,z)] = height;
  // Update workers
  for( var i = 0; i < workerCount; i++ ) {
    this._workers[i].postMessage({
      action: 'setHeight',
      actionData: {
        x: x,
        z: z,
        height: height
      }
    });
  }
}

THREE.DynamicTerrainMapChunkBuilder.prototype._getHeightMapArrayPosition = function (widthPosition, depthPosition) {
  return ( depthPosition * this._width + widthPosition );
}

THREE.DynamicTerrainMapChunkBuilder.prototype._workerCallback = function (e, self) {
  var workerId = e.data.id;
  if( e.data.action == 'init' ) {
    // Grab the next - we're ready!
    self._getNextJob(workerId, self);
  } else {
    // Process
    var mapChunkIndex = e.data.mapChunkIndex;
    var distanceIndex = e.data.distanceIndex;
    var bufferGeometryIndices = e.data.bufferGeometryIndices;
    var bufferGeometryPositions = e.data.bufferGeometryPositions;
    var bufferGeometryNormals = e.data.bufferGeometryNormals;
    var bufferGeometryUvs = e.data.bufferGeometryUvs;
    var bufferGeometryOffsets = e.data.bufferGeometryOffsets;
    var xVertices = e.data.xVertices;
    var zVertices = e.data.zVertices;
    var xOffset = e.data.xOffset;
    var zOffset = e.data.zOffset;
    console.log('INDEX: '+distanceIndex+' / OFFSET: '+xOffset+','+zOffset+' / VERTICES: '+xVertices+','+zVertices);
    self._sendChunkGeometry(mapChunkIndex, distanceIndex, xVertices, zVertices, xOffset, zOffset, bufferGeometryIndices,bufferGeometryPositions,bufferGeometryNormals,bufferGeometryUvs,bufferGeometryOffsets);
    // Grab the next
    self._getNextJob(workerId, self);
  }
}

THREE.DynamicTerrainMapChunkBuilder.prototype._getNextJob = function (workerId, self) {
  if( this._requestQueue.length > 0 ) {
    var request =  this._requestQueue.shift();
   
    //console.log('SENDING REQUEST FOR INDEX '+request.mapChunkIndex+' ? '+request.distanceIndex);
    this._workers[workerId].postMessage({
      action: 'build',
      actionData: request
    });
  } else {
    this._workersReady[workerId] = true;
  }
}

THREE.DynamicTerrainMapChunkBuilder.prototype.updateChunkGeometry = function (request) {
  //console.log("REQUEST RECEIVED FOR INDEX "+request.mapChunkIndex+" ? "+request.distanceIndex+" / "+request.heightMapWidthZero+','+request.heightMapDepthZero);
  var insert = true;
  for( var i = 0; i < this._requestQueue.length; i++ ) {
    if( this._requestQueue[i].mapChunkIndex == request.mapChunkIndex ) {
      insert = false;
      // Update Distance Index
      this._requestQueue[i].distanceIndex = request.distanceIndex;
    }
  }
  if( insert ) {
    //console.log('NEW INSERT');
    this._requestQueue.push(request);
    //console.log('REQUEST QUEUE LENGTH '+this._requestQueue.length);
    this._assignEmptyWorkers();
  } else {
    //console.log('ALREADY INSERTED');
  }
}

THREE.DynamicTerrainMapChunkBuilder.prototype._assignEmptyWorkers = function () {
  for( var i = 0; i < this._workersReady.length; i++ ) {
    if( this._workersReady[i] ) {
      this._getNextJob(i);
    }
  }
}