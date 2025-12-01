import * as faceapi from "@vladmandic/face-api/dist/face-api.node.js";
import fetch from "node-fetch";
import sharp from "sharp";
import * as tf from "@tensorflow/tfjs-node";

let loaded = false;

async function decodeImageUniversal(buffer) {
  try {
    const jpegBuffer = await sharp(buffer).jpeg().toBuffer();
    return tf.node.decodeImage(jpegBuffer, 3);
  } catch (e) {
    console.log("sharp decode error:", e.message);
    return null;
  }
}

export async function loadFaceModels() {
  if (loaded) return;

  console.log("▶ Loading face-api models...");
  await faceapi.nets.tinyFaceDetector.loadFromDisk("./models");
  await faceapi.nets.faceLandmark68Net.loadFromDisk("./models");
  loaded = true;
  console.log("✔ Face models loaded.");
}

export async function isAsianFace(url) {
  await loadFaceModels();

  try {
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());

    // 🎯 Node.js で画像を読み込む正しい方法
    const imgTensor = await decodeImageUniversal(buffer);

    if (!imgTensor) return false;

    const detection = await faceapi
      .detectSingleFace(
        imgTensor,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224 })
      )
      .withFaceLandmarks();

    imgTensor.dispose();

    if (!detection) return false;

    const pts = detection.landmarks.positions;
    const eyeWidth = pts[45].x - pts[36].x;
    const noseWidth = pts[35].x - pts[31].x;

    const ratio = noseWidth / eyeWidth;
    return ratio < 0.37;
  } catch (e) {
    console.log("AI Asian check error:", e.message);
    return false;
  }
}
