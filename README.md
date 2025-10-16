WebGL Forward+ and Clustered Deferred Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 4**

* Jacqueline (Jackie) Li
  * [LinkedIn](https://www.linkedin.com/in/jackie-lii/), [personal website](https://sites.google.com/seas.upenn.edu/jacquelineli/home), [Instagram](https://www.instagram.com/sagescherrytree/), etc.
* Tested on: : Chrome/141.0.7390.67, : Windows NT 10.0.19045.6332, 11th Gen Intel(R) Core(TM) i7-11800H @ 2.30GHz, NVIDIA GeForce RTX 3060 Laptop GPU (6 GB)

### Live Demo

[Demo link](https://sagescherrytree.github.io/Project4-WebGPU-Forward-Plus-and-Clustered-Deferred-2025/)

[![](img/thumbnailToonOutlines.png)](https://github.com/sagescherrytree/Project4-WebGPU-Forward-Plus-and-Clustered-Deferred-2025)

### Demo Video/GIF

<video width="640" height="360" controls>
  <source src="img/AllRenderModesDemo.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

### Forward+ Rendering Technique v. Naive

Using the NVidia GeForce RTX 3060 GPU, my forward+ render at 500 lights and cluster size of 1024 actually seems visually slower than naive method with the same settings.

This is rendered with the following settings for variables:
computeClustersWorkgroupSize: [4,4,4]
maxLightsInCluster: 1024

[![](img/ForwardSlow.mp4)]

For an additional test, I changed these values:
computeClustersWorkgroupSize: [8,8,4]
maxLightsInCluster: 128

These are the parameters that are used in the demo video.

It seemed that reducing the maximum lights and increasing the workgroup size made processing each cluster faster, making forward+ run faster than naive, as it should be.

### Credits

- [Vite](https://vitejs.dev/)
- [loaders.gl](https://loaders.gl/)
- [dat.GUI](https://github.com/dataarts/dat.gui)
- [stats.js](https://github.com/mrdoob/stats.js)
- [wgpu-matrix](https://github.com/greggman/wgpu-matrix)
