// ============================================================
// common.wgsl
// Shared math + uniforms for all cube rendering pipelines
// ============================================================

// ------------------------------------------------------------
// Uniforms
// ------------------------------------------------------------
struct Uniforms {
    mvp : mat4x4<f32>,
};
@group(0) @binding(0) var<uniform> uUniforms : Uniforms;

// Instance matrix buffer (optional)
struct InstanceMatrices {
    m : array<mat4x4<f32>>,
};
@group(0) @binding(1) var<storage, read> uInstances : InstanceMatrices;

// ------------------------------------------------------------
// Math Helpers
// ------------------------------------------------------------

// Multiply two 4x4 matrices (column-major)
fn mat4_mul(a : mat4x4<f32>, b : mat4x4<f32>) -> mat4x4<f32> {
    var result : mat4x4<f32>;
    for (var i = 0u; i < 4u; i = i + 1u) {
        for (var j = 0u; j < 4u; j = j + 1u) {
            result[i][j] =
                a[0][j] * b[i][0] +
                a[1][j] * b[i][1] +
                a[2][j] * b[i][2] +
                a[3][j] * b[i][3];
        }
    }
    return result;
}

// Rotation around X axis
fn rotX(a : f32) -> mat4x4<f32> {
    let c = cos(a);
    let s = sin(a);
    return mat4x4<f32>(
        vec4<f32>(1, 0, 0, 0),
        vec4<f32>(0, c, s, 0),
        vec4<f32>(0, -s, c, 0),
        vec4<f32>(0, 0, 0, 1)
    );
}

// Rotation around Y axis
fn rotY(a : f32) -> mat4x4<f32> {
    let c = cos(a);
    let s = sin(a);
    return mat4x4<f32>(
        vec4<f32>(c, 0, -s, 0),
        vec4<f32>(0, 1, 0, 0),
        vec4<f32>(s, 0, c, 0),
        vec4<f32>(0, 0, 0, 1)
    );
}

// Perspective projection
fn perspective(fov : f32, aspect : f32, near : f32, far : f32) -> mat4x4<f32> {
    let f = 1.0 / tan(fov * 0.5);
    let nf = 1.0 / (near - far);

    return mat4x4<f32>(
        vec4<f32>(f/aspect, 0, 0, 0),
        vec4<f32>(0, f, 0, 0),
        vec4<f32>(0, 0, (far+near)*nf, -1),
        vec4<f32>(0, 0, (2.0*far*near)*nf, 0)
    );
}

// Simple view matrix (camera pulled back)
fn view_matrix() -> mat4x4<f32> {
    return mat4x4<f32>(
        vec4<f32>(1,0,0,0),
        vec4<f32>(0,1,0,0),
        vec4<f32>(0,0,1,0),
        vec4<f32>(0,0,-50,1)
    );
}
