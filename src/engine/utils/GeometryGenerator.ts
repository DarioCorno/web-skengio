// src/engine/GeometryGenerator.ts

import { BitmapFontAtlas } from "./BitmapFontAtlas";
import { vec3 } from 'gl-matrix'

export class GeometryGenerator {
  
    /**
     * Generates a cube with separated faces (6 faces, 2 triangles per face)
     */
    static generateCube(width: number = 1.0, height: number = 1.0, depth : number = 1.0): { positions: Float32Array; normals: Float32Array; uv: Float32Array; indices: Uint16Array } {
        let parameters = {
			width: width,
			height: height,
			depth: depth,
		};

        const halfX = width / 2.0;
        const halfY = height / 2.0;
        const halfZ = depth / 2.0;

        const positions = new Float32Array([
            // Front face
            //-0.5, -0.5,  0.5,  
            //0.5, -0.5,  0.5,  
            //0.5,  0.5,  0.5,  
            //-0.5,  0.5,  0.5,
            -halfX, -halfY, halfZ, 
            halfX, -halfY, halfZ, 
            halfX, halfY, halfZ, 
            -halfX, halfY, halfZ,

            // Back face
            //0.5, -0.5, -0.5, 
            //-0.5, -0.5, -0.5, 
            //-0.5,  0.5, -0.5,  
            //0.5,  0.5, -0.5,
            halfX, -halfY, -halfZ
            -halfX, -halfY, -halfZ,
            -halfX, halfY, -halfZ,
            halfX, halfY, -halfZ,

            // Left face
            //-0.5, -0.5, -0.5, 
            //-0.5, -0.5,  0.5, 
            //-0.5,  0.5,  0.5, 
            //-0.5,  0.5, -0.5,
            -halfX, -halfY, -halfZ,
            -halfX, -halfY, halfZ,
            -halfX, halfY, halfZ,
            -halfX, halfY, -halfZ,
            // Right face
            //0.5, -0.5,  0.5,  
            //0.5, -0.5, -0.5,  
            //0.5,  0.5, -0.5,  
            //0.5,  0.5,  0.5,
            halfX, -halfY, halfZ,
            halfX, -halfY, -halfZ,
            halfX, halfY, -halfZ,
            halfX, halfY, halfZ,
            // Top face
            //-0.5,  0.5,  0.5,  
            //0.5,  0.5,  0.5,  
            //0.5,  0.5, -0.5, 
            //-0.5,  0.5, -0.5,
            -halfX, halfY, halfZ,
            halfX, halfY, halfZ,
            halfX, halfY, -halfZ,
            -halfX, halfY, -halfZ,
            // Bottom face
            //-0.5, -0.5, -0.5,  
            //0.5, -0.5, -0.5,  
            //0.5, -0.5,  0.5, 
            //-0.5, -0.5,  0.5,
            -halfX, -halfY, -halfZ,
            halfX, -halfY, -halfZ,
            halfX, -halfY, halfZ,
            -halfX, -halfY, halfZ
        ]);
    
        const normals = new Float32Array([
            // Front face
            0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,
            // Back face
            0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,
            // Left face
          -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0,
            // Right face
            1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,
            // Top face
            0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,
            // Bottom face
            0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,
        ]);
    
        const uv = new Float32Array([
            // Each face has its own unique UV mapping
            0, 0,  1, 0,  1, 1,  0, 1, 
            0, 0,  1, 0,  1, 1,  0, 1, 
            0, 0,  1, 0,  1, 1,  0, 1, 
            0, 0,  1, 0,  1, 1,  0, 1, 
            0, 0,  1, 0,  1, 1,  0, 1, 
            0, 0,  1, 0,  1, 1,  0, 1, 
        ]);
    
        const indices = new Uint16Array([
            0, 1, 2,  0, 2, 3,  // Front face
            4, 5, 6,  4, 6, 7,  // Back face
            8, 9,10,  8,10,11,  // Left face
          12,13,14, 12,14,15,  // Right face
          16,17,18, 16,18,19,  // Top face
          20,21,22, 20,22,23,  // Bottom face
        ]);
    
        return { positions, normals, uv, indices };
    }
  
    static copyToMeshData(_positions: number[], _normals : number[], _uvs: number[], _indices: number[]) : { positions: Float32Array; normals: Float32Array; uv: Float32Array; indices: Uint16Array } {
        const positions: Float32Array = new Float32Array(_positions.length);
        const normals: Float32Array = new Float32Array(_normals.length);
        const uv: Float32Array = new Float32Array(_uvs.length);
        for(let i: number = 0; i < _positions.length; i++) {
            positions[i] = _positions[i];
            normals[i] = _normals[i];
            uv[i] = _uvs[i];
        }

        const indices : Uint16Array = new Uint16Array(_indices.length);
        for(let i : number = 0; i < _indices.length; i++) {
            indices[i] = _indices[i];
        }

        return { positions, normals, uv, indices }        
    }


    static GenerateTextMesh(
        text: string,
        fontAtlas: BitmapFontAtlas,
        startX: number,
        startY: number
    ): { positions: Float32Array; normals: Float32Array; uv: Float32Array; indices: Uint16Array } {
        const positions: number[] = [];
        const uvs: number[] = [];
        const normals: number[] = [];
        const indices: number[] = [];

        let cursorX = startX;
        const cursorY = startY;
        let vertexIndex = 0;

        const charsPerRow = fontAtlas.charsPerRow;
        const charsPerColumn = fontAtlas.charsPerColumn;
        let uvSizeX = 1.0 / charsPerRow;
        const uvSizeY = 1.0 / charsPerColumn;

        const spacingData = fontAtlas.getSpacingData();
        const charHeight = 1.0;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const ascii = char.charCodeAt(0);

            if (ascii < 32 || ascii > 126) continue; // Ignore non-printable ASCII

            // Calculate the position of the character in the texture atlas
            const charIndex = ascii - 32;
            const gridX = charIndex % charsPerRow;
            const gridY = Math.floor(charIndex / charsPerRow);

            let charWidth = spacingData[char].percWidth; // Fixed height of 1.0, width depends on aspect ratio
            
            // Define quad vertices
            //The quads have different width according to letter width
            const x1 = cursorX;
            const y1 = cursorY;
            const x2 = cursorX + charWidth;
            const y2 = cursorY + charHeight;  
            
            const deltaWidth = (1.0 - (x2 - x1)) / 2.0;

            // Compute UV coordinates
            //UV coords must be enlarged by the width ratio
            const u1 = (gridX * uvSizeX) + (deltaWidth * uvSizeX);
            const v1 = 1.0 - (gridY + 1) * uvSizeY; // Flip V because OpenGL uses bottom-left origin
            const u2 = ((gridX + 1) * uvSizeX)- (deltaWidth * uvSizeX);
            const v2 = 1.0 - gridY * uvSizeY;

            // Positions (X, Y, Z)
            positions.push(
                x1, y1, 0,  // Bottom-left
                x2, y1, 0,  // Bottom-right
                x1, y2, 0,  // Top-left
                x2, y2, 0   // Top-right
            );

            // UVs (U, V) - Corrected mapping
            uvs.push(
                u1, v1,  // Bottom-left
                u2, v1,  // Bottom-right
                u1, v2,  // Top-left
                u2, v2   // Top-right
            );

            // Normals (Nx, Ny, Nz) - Assuming flat surface facing +Z
            normals.push(
                0, 0, 1,  // Bottom-left
                0, 0, 1,  // Bottom-right
                0, 0, 1,  // Top-left
                0, 0, 1   // Top-right
            );

            // Indices for two triangles forming the quad
            const offset = vertexIndex;
            indices.push(
                offset, offset + 1, offset + 2,  // First triangle
                offset + 2, offset + 1, offset + 3  // Second triangle
            );

            // Move cursor forward by fixed size
            cursorX += charWidth; 
            vertexIndex += 4;

            // Debug logs
            console.log(`Char: ${char} (ASCII ${ascii}), Index: ${charIndex}`);
            console.log(`Position: [${x1}, ${y1}] to [${x2}, ${y2}]`);
            console.log(`UV: [${u1}, ${v1}] to [${u2}, ${v2}]`);
        }

        return {
            positions: new Float32Array(positions),
            normals: new Float32Array(normals),
            uv: new Float32Array(uvs),
            indices: new Uint16Array(indices),
        };
    }

    /**
     * Generate a plane
     * @param width - Width of the plane
     * @param height - Height of the plane
     * @param widthSegments - Number of segments along the width
     * @param heightSegments - Number of segments along the height
     * @returns {positions, normals, uvs, indices}
     */
    static generatePlane(width = 1, height = 1, widthSegments = 1, heightSegments = 1) : { positions: Float32Array; normals: Float32Array; uv: Float32Array; indices: Uint16Array } {
        const _positions: number[] = [];
        const _normals: number[] = [];
        const _uvs: number[] = [];
        const _indices: number[] = [];

        let parameters = {
			width: width,
			height: height,
			widthSegments: widthSegments,
			heightSegments: heightSegments
		};

		const width_half = width / 2;
		const height_half = height / 2;

		const gridX = Math.floor( widthSegments );
		const gridY = Math.floor( heightSegments );

		const gridX1 = gridX + 1;
		const gridY1 = gridY + 1;

		const segment_width = width / gridX;
		const segment_height = height / gridY;


		for ( let iy = 0; iy < gridY1; iy ++ ) {

			const y = iy * segment_height - height_half;

			for ( let ix = 0; ix < gridX1; ix ++ ) {

				const x = ix * segment_width - width_half;

				_positions.push( x, - y, 0 );

				_normals.push( 0, 0, 1 );

				_uvs.push( ix / gridX );
				_uvs.push( 1 - ( iy / gridY ) );

			}


            for ( let iy = 0; iy < gridY; iy ++ ) {

                for ( let ix = 0; ix < gridX; ix ++ ) {
    
                    const a = ix + gridX1 * iy;
                    const b = ix + gridX1 * ( iy + 1 );
                    const c = ( ix + 1 ) + gridX1 * ( iy + 1 );
                    const d = ( ix + 1 ) + gridX1 * iy;
    
                    _indices.push( a, b, d );
                    _indices.push( b, c, d );
    
                }
    
            }     
            
            return GeometryGenerator.copyToMeshData(_positions, _normals, _uvs, _indices);

		}

        return GeometryGenerator.copyToMeshData(_positions, _normals, _uvs, _indices);
    }

  
    /**
     * Generate a sphere
     * @param radius - Radius of the sphere
     * @param widthSegments - Number of segments along the horizontal direction
     * @param heightSegments - Number of segments along the vertical direction
     * @returns {positions, normals, uvs, indices}
     */
    static generateSphere(radius = 1, widthSegments = 16, heightSegments = 12): { positions: Float32Array; normals: Float32Array; uv: Float32Array; indices: Uint16Array } {
        const _positions: number[] = [];
        const _normals: number[] = [];
        const _uvs: number[] = [];
        const _indices: number[] = [];

        let parameters = {
			radius: radius,
			widthSegments: widthSegments,
			heightSegments: heightSegments,
			phiStart: 0,
			phiLength: Math.PI * 2.0,
			thetaStart: 0,
			thetaLength: Math.PI
		};

		widthSegments = Math.max( 3, Math.floor( widthSegments ) );
		heightSegments = Math.max( 2, Math.floor( heightSegments ) );

		const thetaEnd = Math.min( parameters.thetaStart + parameters.thetaLength, Math.PI );

		let index = 0;
		const grid = [];

		const vertex = vec3.create();
		const normal = vec3.create();

		// generate vertices, normals and uvs

		for ( let iy = 0; iy <= heightSegments; iy ++ ) {

			const verticesRow = [];

			const v = iy / heightSegments;

			// special case for the poles

			let uOffset = 0;

			if ( iy === 0 && parameters.thetaStart === 0 ) {

				uOffset = 0.5 / widthSegments;

			} else if ( iy === heightSegments && thetaEnd === Math.PI ) {

				uOffset = - 0.5 / widthSegments;

			}

			for ( let ix = 0; ix <= widthSegments; ix ++ ) {

				const u = ix / widthSegments;

				// vertex

				vertex[0] = - radius * Math.cos( parameters.phiStart + u * parameters.phiLength ) * Math.sin( parameters.thetaStart + v * parameters.thetaLength );
				vertex[1] = radius * Math.cos( parameters.thetaStart + v * parameters.thetaLength );
				vertex[2] = radius * Math.sin( parameters.phiStart + u * parameters.phiLength ) * Math.sin( parameters.thetaStart + v * parameters.thetaLength );

				_positions.push( vertex[0], vertex[1], vertex[2] );

				// normal

				vec3.normalize(normal, vec3.clone(vertex));
				_normals.push( normal[0], normal[1], normal[2] );

				// uv

				_uvs.push( u + uOffset, 1 - v );

				verticesRow.push( index ++ );

			}

			grid.push( verticesRow );

		}

		// indices

		for ( let iy = 0; iy < parameters.heightSegments; iy ++ ) {

			for ( let ix = 0; ix < parameters.widthSegments; ix ++ ) {

				const a = grid[ iy ][ ix + 1 ];
				const b = grid[ iy ][ ix ];
				const c = grid[ iy + 1 ][ ix ];
				const d = grid[ iy + 1 ][ ix + 1 ];

				if ( iy !== 0 || parameters.thetaStart > 0 ) _indices.push( a, b, d );
				if ( iy !== parameters.heightSegments - 1 || thetaEnd < Math.PI ) _indices.push( b, c, d );

			}

		}

        return GeometryGenerator.copyToMeshData(_positions, _normals, _uvs, _indices);
    }
  
    /**
     * Generate a torus
     * @param radius - Radius of the torus (distance from center of tube to center of torus)
     * @param tubeRadius - Radius of the tube
     * @param radialSegments - Number of radial segments
     * @param tubularSegments - Number of tubular segments
     * @returns {positions, normals, uvs, indices}
     */
    static generateTorus(radius = 1, tubeRadius = 0.4, radialSegments = 16, tubularSegments = 16) : { positions: Float32Array; normals: Float32Array; uv: Float32Array; indices: Uint16Array } {
        const _positions: number[] = [];
        const _normals: number[] = [];
        const _uvs: number[] = [];
        const _indices: number[] = [];

        for (let i = 0; i <= radialSegments; i++) {
            const theta = (i / radialSegments) * (2 * Math.PI);
            const cosTheta = Math.cos(theta);
            const sinTheta = Math.sin(theta);

            for (let j = 0; j <= tubularSegments; j++) {
                const phi = (j / tubularSegments) * (2 * Math.PI);
                const cosPhi = Math.cos(phi);
                const sinPhi = Math.sin(phi);

                const x = (radius + tubeRadius * cosPhi) * cosTheta;
                const y = (radius + tubeRadius * cosPhi) * sinTheta;
                const z = tubeRadius * sinPhi;

                // Position
                _positions.push(x, y, z);

                // Normal
                const nx = cosPhi * cosTheta;
                const ny = cosPhi * sinTheta;
                const nz = sinPhi;
                _normals.push(nx, ny, nz);

                // UV
                _uvs.push(j / tubularSegments, i / radialSegments);
            }
        }

        for (let i = 0; i < radialSegments; i++) {
            for (let j = 0; j < tubularSegments; j++) {
                const a = i * (tubularSegments + 1) + j;
                const b = a + 1;
                const c = a + tubularSegments + 1;
                const d = c + 1;

                _indices.push(a, b, d);
                _indices.push(a, d, c);
            }
        }

        return GeometryGenerator.copyToMeshData(_positions, _normals, _uvs, _indices);
    }
  }
  