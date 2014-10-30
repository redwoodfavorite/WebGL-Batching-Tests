define(function(require){
    var gl; 
    var canvas;
    
    function initGL(canvas) {
        canvas = document.createElement('canvas');
        canvas.width = innerWidth;
        canvas.height = innerHeight;

        document.body.appendChild(canvas);

        try {
            gl = canvas.getContext("webgl");
            gl.viewportWidth = canvas.width;
            gl.viewportHeight = canvas.height;
        } catch (e) {
        }   
        if (!gl) {
            alert("Could not initialise WebGL, sorry :-(");
        }
    }

    function getShader(gl, id) {
        var shaderScript = document.getElementById(id);
        if (!shaderScript) {
            return null;
        }

        var str = "";
        var k = shaderScript.firstChild;
        while (k) {
            if (k.nodeType == 3) {
                str += k.textContent;
            }
            k = k.nextSibling;
        }

        var shader;
        if (shaderScript.type == "x-shader/x-fragment") {
            shader = gl.createShader(gl.FRAGMENT_SHADER);
        } else if (shaderScript.type == "x-shader/x-vertex") {
            shader = gl.createShader(gl.VERTEX_SHADER);
        } else {
            return null;
        }

        gl.shaderSource(shader, str);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            // alert(gl.getShaderInfoLog(shader, str));
            console.log(gl.getShaderInfoLog(shader, str));
            return null;
        }

        var floatTextures = gl.getExtension('OES_texture_float');

        return shader;
    }


    var shaderProgram;
    function initShaders() {
        var fragmentShader = getShader(gl, "shader-fs");
        var vertexShader = getShader(gl, "shader-vs");

        shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) alert("Could not initialise shaders");

        gl.useProgram(shaderProgram);

        shaderProgram.vertexIdAttribute = gl.getAttribLocation(shaderProgram, "aVertexId");
        gl.enableVertexAttribArray(shaderProgram.vertexIdAttribute);

        shaderProgram.normalAttribute = gl.getAttribLocation(shaderProgram, "aNormal");
        gl.enableVertexAttribArray(shaderProgram.normalAttribute);

        shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
        gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

        shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
        shaderProgram.uDataTexture   = gl.getUniformLocation(shaderProgram, "uDataTexture");
        shaderProgram.uTexWidth      = gl.getUniformLocation(shaderProgram, "uTexWidth");
    }

    var mvMatrix      = mat4.create();
    var pMatrix       = mat4.create();

    // FOR CUBE VERTICES
    var numCubes  = 200;

    var positions = [];
    var tempPos   = [];
    var rotations = [];
    var tempRot   = [];

    const VARIANCE = 2;
    const CUBESPERROW = 10;
    function updateVectors () {
        var i;
        var j;
        var iIndex;
        var jIndex;
        var calculatedVariance;
        var currentTime = Date.now();
        var translationCounter = Math.sin(currentTime * 0.001);
        var rotationCounter    = currentTime * 0.003;
        
        // Create array where length = pixel counter * the rgb channels for each pixel.
        var texData = new Float32Array(textureWidth * 3);

        for (i = 0; i < numCubes; i++) {
            calculatedVariance = Math.ceil(i / CUBESPERROW) * VARIANCE;

            iIndex = i * 144;
            tempPos[0] = Math.sin(i + translationCounter) * calculatedVariance;
            tempPos[1] = Math.cos(i + translationCounter) * calculatedVariance;
            tempPos[2] = Math.sin(i + translationCounter) - 100.0;

            tempRot[0] = Math.sin(i + rotationCounter);
            tempRot[1] = Math.cos(i + rotationCounter);
            tempRot[2] = Math.cos(i + rotationCounter);

            for (j = 0; j < 24; j++) {
                jIndex = j * 6;
                texData[iIndex + jIndex + 0] = tempPos[0];
                texData[iIndex + jIndex + 1] = tempPos[1];
                texData[iIndex + jIndex + 2] = tempPos[2];

                texData[iIndex + jIndex + 3] = tempRot[0];
                texData[iIndex + jIndex + 4] = tempRot[1];
                texData[iIndex + jIndex + 5] = tempRot[2];
            }
        }

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, dataTexture);
        gl.uniform1i(shaderProgram.uDataTexture, 0);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, textureWidth, 1, 0, gl.RGB, gl.FLOAT, texData);
    }

    var dataTexture;
    var textureWidth;
    function initTexture () {
        dataTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, dataTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        //24 vertices per cube, 2 different vector3s per vertex
        textureWidth = (numCubes * 24 * 2);

        console.log(textureWidth)
    }

    function flatten (array) {
        var flattened = [];
        for (var i = 0; i < array.length; i++) {
            if(Array.isArray(array[i])) {
                for (var j = 0; j < array[j].length; j++) {
                    flattened.push(array[i][j]);
                }
            } else {
                flattened.push(array[i]);
            }
        }

        return flattened;
    }

    var cubeVertexPositionBuffer;
    var translationBuffer;
    var cubeVertexColorBuffer;
    var cubeVertexIndexBuffer;
    var rotationBuffer;
    var normalBuffer;

    function initBuffers() {
        function pickOctant(i) {
            return [(i & 1) * 2 - 1, (i & 2) - 1, (i & 4) / 2 - 1];
        }

        var cubeData = [
            [0, 4, 2, 6, -1, 0, 0], 
            [1, 3, 5, 7, +1, 0, 0],
            [0, 1, 4, 5, 0, -1, 0],
            [2, 6, 3, 7, 0, +1, 0],
            [0, 2, 1, 3, 0, 0, -1],
            [4, 5, 6, 7, 0, 0, +1] 
        ];

        var vertices      = [];
        var textureCoords = [];
        var normals       = [];
        var indices       = [];
        var ids           = [];

        for (var i = 0; i < numCubes; i++) {
            var indexOffset = i * 24;
            for (var j = 0; j < cubeData.length; j++) {
                var data = cubeData[j], v = j * 4;
                for (var k = 0; k < 4; k++) {
                    var d = data[k];
                    vertices.push(pickOctant(d));
                    textureCoords.push([k & 1, (k & 2) / 2]);
                    normals.push(data.slice(4, 7));
                    ids.push(indexOffset + k + (j* 4));
                }
                indices.push([indexOffset + v, indexOffset + v + 1, indexOffset + v + 2]);
                indices.push([indexOffset + v + 2, indexOffset + v + 1, indexOffset + v + 3]);
            }
        }

        indices       = flatten(indices);
        vertices      = flatten(vertices);
        textureCoords = flatten(textureCoords);
        normals       = flatten(normals);

        /* SET UP POSITION BUFFER */
        cubeVertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        cubeVertexPositionBuffer.itemSize = 3;
        cubeVertexPositionBuffer.numItems = 24 * numCubes;

        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, cubeVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

        /* SET UP ID BUFFER */
        vertexIdBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexIdBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ids), gl.STATIC_DRAW);
        vertexIdBuffer.itemSize = 1;
        vertexIdBuffer.numItems = 24 * numCubes;

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexIdBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexIdAttribute, vertexIdBuffer.itemSize, gl.FLOAT, false, 0, 0);

        /* SET UP NORMAL BUFFER */
        normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
        normalBuffer.itemSize = 3;
        normalBuffer.numItems = 24 * numCubes;

        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
        gl.vertexAttribPointer(shaderProgram.normalAttribute, normalBuffer.itemSize, gl.FLOAT, false, 0, 0);

        cubeVertexIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        cubeVertexIndexBuffer.itemSize = 1;
        cubeVertexIndexBuffer.numItems = 36 * numCubes;

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
    }

    function drawScene() {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.drawElements(gl.TRIANGLES, cubeVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    }

    function webGLStart(canvas) {
        initGL(canvas);
        initShaders();
        initTexture();
        initBuffers();
        setPerspectiveMatrix();

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
        gl.enable(gl.DEPTH_TEST);

        tick();
    }

    function setPerspectiveMatrix () {
        mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 1000.0, pMatrix);
        gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
        gl.uniform1f(shaderProgram.uTexWidth, textureWidth - 1.);
    }

    function tick () {
        requestAnimationFrame(tick);
        updateVectors();
        drawScene();
    }

    webGLStart();
});

//
// FOR SQUARE TEXTURE
//
// textureWidth = Math.ceil(Math.sqrt((74 * numCubes / 3)));
//
// var texData = new Float32Array(textureWidth * textureWidth * 3);
// 
// float xPos       = mod(aVertexId, uTexWidth);
// float yPos       = floor(aVertexId / uTexWidth) / uTexWidth;
// vec3 translation = texture2D(uDataTexture, vec2(xPos, yPos)).rgb;

