// TODO-2: implement the light clustering compute shader

// ------------------------------------
// Calculating cluster bounds:
// ------------------------------------
// For each cluster (X, Y, Z):
//     - Calculate the screen-space bounds for this cluster in 2D (XY).
//     - Calculate the depth bounds for this cluster in Z (near and far planes).
//     - Convert these screen and depth bounds into view-space coordinates.
//     - Store the computed bounding box (AABB) for the cluster.

// ------------------------------------
// Assigning lights to clusters:
// ------------------------------------
// For each cluster:
//     - Initialize a counter for the number of lights in this cluster.

//     For each light:
//         - Check if the light intersects with the cluster’s bounding box (AABB).
//         - If it does, add the light to the cluster's light list.
//         - Stop adding lights if the maximum number of lights is reached.

//     - Store the number of lights assigned to this cluster.

@group(${bindGroup_scene}) @binding(0) var<storage, read> lightSet: LightSet;
@group(${bindGroup_scene}) @binding(1) var<storage, read_write> clusterSet: ClusterSet;
@group(${bindGroup_scene}) @binding(2) var<uniform> cameraUnif: CameraUniforms;

// WGSL functions need the values passed as arguments, e.g.:

fn screenToViewSpace(screenCoord: vec2<f32>, depthNDC: f32) -> vec3<f32> {
    let ndcX = (screenCoord.x / cameraUnif.screenResolution.x);
    let ndcY = (screenCoord.y / cameraUnif.screenResolution.y);
    let ndcZ = depthNDC;
    let ndc = vec4<f32>(ndcX, ndcY, ndcZ, 1.0);
    var viewPos = cameraUnif.invProjMat * ndc;
    viewPos /= viewPos.w;
    return viewPos.xyz;
}

// Intersection test w/ cluster as sphere.
fn testLightIntersection(lightPos: vec3<f32>, lightRadius: f32, clusterMin: vec3<f32>, clusterMax: vec3<f32>) -> bool {
    let closestPoint = clamp(lightPos, clusterMin, clusterMax);
    let distSq = dot(closestPoint - lightPos, closestPoint - lightPos);
    return distSq <= lightRadius * lightRadius;
}

@compute
@workgroup_size(${computeClustersWorkgroupSize[0]}, ${computeClustersWorkgroupSize[1]}, ${computeClustersWorkgroupSize[2]})
fn main(@builtin(global_invocation_id) globalIdx: vec3u) {
    // Get specific cluster instance (something about indexing?).
    let clusterDims = vec3<u32>(${clusterDims[0]}, ${clusterDims[1]}, ${clusterDims[2]});
    if (globalIdx.x >= clusterDims.x || globalIdx.y >= clusterDims.y || globalIdx.z >= clusterDims.z) {
        return;
    }
    let clusterIdx: u32 = globalIdx.x + globalIdx.y * clusterDims.x + globalIdx.z * clusterDims.x * clusterDims.y;

    // Calculate min/max depth bounds in z (near and far planes).
    let x0 = f32(globalIdx.x) / f32(clusterDims.x) * cameraUnif.screenResolution.x;
    let x1 = f32(globalIdx.x + 1u) / f32(clusterDims.x) * cameraUnif.screenResolution.x;
    let y0 = f32(globalIdx.y) / f32(clusterDims.y) * cameraUnif.screenResolution.y;
    let y1 = f32(globalIdx.y + 1u) / f32(clusterDims.y) * cameraUnif.screenResolution.y;

    // Depth bounds in view space using logarithmic slices.
    let near = cameraUnif.nearFarClip[0];
    let far  = cameraUnif.nearFarClip[1];
    let zSlice  = f32(globalIdx.z) / f32(clusterDims.z);
    let zSlice1 = f32(globalIdx.z + 1u) / f32(clusterDims.z);
    let zNear = -near * pow(far / near, zSlice);
    let zFar  = -near * pow(far / near, zSlice1);

    let clusterMinNear = screenToViewSpace(vec2<f32>(x0, y0), -1.0);
    let clusterMaxFar  = screenToViewSpace(vec2<f32>(x1, y1), 1.0);

    // Get bounding box using AABB intersection.
    let minBBox = vec3f(min(clusterMinNear.x, clusterMaxFar.x),
                    min(clusterMinNear.y, clusterMaxFar.y),
                    min(zNear, zFar));

    let maxBBox = vec3f(max(clusterMinNear.x, clusterMaxFar.x),
                    max(clusterMinNear.y, clusterMaxFar.y),
                    max(zNear, zFar));

    // For each cluster do:
    // Initialize counter for each light in cluster.
    // For each light in cluster do:
    // Check if light intersects w/ bounding box.
    // If yes, add to cluster's light list.
    // If counter > maximum number of lights, stop.
    // Store numLights to this cluster.

    var lightCounter: u32 = 0u;

    for (var i: u32 = 0u; i < lightSet.numLights; i++) {
        let currLight = lightSet.lights[i];
        let lightPos = currLight.pos;
        let currTransformedLight = cameraUnif.viewMat * vec4f(lightPos, 1f);

        // Check for intersection.
        if (testLightIntersection(currTransformedLight.xyz, ${lightRadius}, minBBox, maxBBox)) {
            clusterSet.clusters[clusterIdx].lights[lightCounter] = i;
            lightCounter += 1;

            if (lightCounter >= ${maxLightsInCluster}) {
                break;
            }
        }
    }
    clusterSet.clusters[clusterIdx].numLights = lightCounter;
}
