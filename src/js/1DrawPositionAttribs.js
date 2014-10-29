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
            alert(gl.getShaderInfoLog(shader));
            return null;
        }

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

        // shaderProgram.vertexColorAttribute = gl.getAttribLocation(shaderProgram, "aVertexColor");
        // gl.enableVertexAttribArray(shaderProgram.vertexColorAttribute);

        shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
        gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

        shaderProgram.worldPositionAttribute = gl.getAttribLocation(shaderProgram, "aWorldPosition");
        gl.enableVertexAttribArray(shaderProgram.worldPositionAttribute);

        shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    }

    var mvMatrix      = mat4.create();
    var pMatrix       = mat4.create();
    var worldPositionBuffer;

    // FOR CUBE VERTICES
    var numCubes = 5000;
    var genPositions = [];

    var pyramidVertexPositionBuffer;
    var cubeVertexPositionBuffer;
    var cubeVertexColorBuffer;
    var cubeVertexIndexBuffer;

    function initGeometries () {
        initBuffers();
        updatePositionAttribs();
    }

    function updatePositionAttribs () {
        genPositions = [];

        var i;
        var j;
        var cubePos;
        var counter = Math.sin(Date.now() * 0.002) * 50;

        for (i = 0; i < numCubes; i++) {
            cubePos = [
                Math.sin(i) * counter,
                Math.cos(i) * counter,
                Math.sin(i) * counter
            ];
            for (j = 0; j < 24; j++) {
                Array.prototype.push.apply(genPositions, cubePos);
            }
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, worldPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(genPositions), gl.STATIC_DRAW);
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

        for (var i = 0; i < numCubes; i++) {
            var indexOffset = i * 24;
            for (var j = 0; j < cubeData.length; j++) {
                var data = cubeData[j], v = j * 4;
                for (var k = 0; k < 4; k++) {
                    var d = data[k];
                    vertices.push(pickOctant(d));
                    textureCoords.push([k & 1, (k & 2) / 2]);
                    normals.push(data.slice(4, 7));
                }
                indices.push([indexOffset + v, indexOffset + v + 1, indexOffset + v + 2]);
                indices.push([indexOffset + v + 2, indexOffset + v + 1, indexOffset + v + 3]);
            }
        }

        indices       = flatten(indices);
        vertices      = flatten(vertices);
        textureCoords = flatten(textureCoords);
        normals       = flatten(normals);

        cubeVertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        cubeVertexPositionBuffer.itemSize = 3;
        cubeVertexPositionBuffer.numItems = 24 * numCubes;

        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, cubeVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

        // gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorData), gl.STATIC_DRAW);
        // cubeVertexColorBuffer.itemSize = 4;
        // cubeVertexColorBuffer.numItems = 24 * numCubes;

        cubeVertexIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        cubeVertexIndexBuffer.itemSize = 1;
        cubeVertexIndexBuffer.numItems = 36 * numCubes;

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);

        worldPositionBuffer = gl.createBuffer();
        worldPositionBuffer.itemSize = 3;
        worldPositionBuffer.numItems = 24 * numCubes;
    }

    function drawScene() {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexColorBuffer);
        // gl.vertexAttribPointer(shaderProgram.vertexColorAttribute, cubeVertexColorBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, worldPositionBuffer);
        gl.vertexAttribPointer(shaderProgram.worldPositionAttribute, worldPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.drawElements(gl.TRIANGLES, cubeVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    }

    var spriteSheet;
    function initTexture () {
        spriteSheet              = gl.createTexture();
        spriteSheet.image        = new Image();
        spriteSheet.image.onload = handleLoadTexture.bind(null, spriteSheet);

        spriteSheet.image.src = "./public/square.jpg";
    }

    function handleLoadTexture (texture) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    function webGLStart(canvas) {
        initGL(canvas);
        initShaders();
        initGeometries();
        setPerspectiveMatrix();

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
        gl.enable(gl.DEPTH_TEST);

        tick();
    }

    function setPerspectiveMatrix () {
        mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 1000.0, pMatrix);
        gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    }

    function tick () {
        requestAnimationFrame(tick);
        updatePositionAttribs();
        drawScene();
    }

    webGLStart();
});
