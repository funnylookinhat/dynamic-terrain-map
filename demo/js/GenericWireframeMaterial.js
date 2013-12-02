/**
 * GenericWireframeMaterial.js
 * Useful for testing mostly.
 */

THREE.GenericWireframeMaterial = function (parameters) {
	if( typeof parameters == "undefined" ) {
		parameters = {};
	}

	this._repeat = parameters.repeat ? parseFloat(parameters.repeat) : 1.0;
	this._width = parameters.width ? parseFloat(parameters.width) : 0.05;

	if( parameters.color ) {
		this._color = parameters.color;
	} else {
		this._color = new THREE.Color();
		this._color.setRGB(
			(Math.floor(Math.random() * 255)),
			(Math.floor(Math.random() * 255)),
			(Math.floor(Math.random() * 255))
		);
	}
}

THREE.GenericWireframeMaterial.prototype._fragmentShader = function () {
	var shader = [];
	shader.push('varying vec2 vUv;');
	shader.push('varying vec3 vPosition;');
	shader.push("varying vec4 wPosition;");
	
	shader.push('void main() {');

	shader.push('float alpha = 0.15;')

	shader.push('float xPos = wPosition.x / '+parseFloat(this._repeat).toFixed(1)+';');
	shader.push('float zPos = wPosition.z / '+parseFloat(this._repeat).toFixed(1)+';');
	
	shader.push('float lowVal = 0.0 + '+parseFloat(this._width).toFixed(3)+';');
	shader.push('float highVal = 1.0 - '+parseFloat(this._width).toFixed(3)+';');

	var rDec = parseFloat(this._color.r * 255).toFixed(1);
	var gDec = parseFloat(this._color.g * 255).toFixed(1);
	var bDec = parseFloat(this._color.b * 255).toFixed(1);

	shader.push('if( fract(xPos) < lowVal || fract(xPos) > highVal || fract(zPos) < lowVal || fract(zPos) > highVal ) {');
	shader.push('alpha = 1.0;');
	shader.push('gl_FragColor = vec4('+rDec+'/255.0,'+gDec+'/255.0,'+bDec+'/255.0,alpha);');
	shader.push('} else {');
	shader.push('gl_FragColor = vec4('+rDec+'/255.0,'+gDec+'/255.0,'+bDec+'/255.0,alpha);');
	shader.push('}');

	shader.push('}');
	
	return shader.join("\n");
}

THREE.GenericWireframeMaterial.prototype._vertexShader = function () {
	var shader = [];

	shader.push("varying vec2 vUv;");
	shader.push("varying vec3 vPosition;");
	shader.push("varying vec4 wPosition;");
	shader.push("void main( void ) {");
	shader.push("vUv = uv;");
	shader.push("vPosition = position;");
	shader.push("wPosition = modelMatrix * vec4(vPosition,1);");
	shader.push("gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1);");
	shader.push("}");

	return shader.join("\n");
}

THREE.GenericWireframeMaterial.prototype.generateMaterial = function () {
	return new THREE.ShaderMaterial({
		vertexShader: this._vertexShader(),
		fragmentShader: this._fragmentShader(),
		transparent: true
	});
}