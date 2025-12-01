import * as faceapi from "@vladmandic/face-api";
import canvas from "canvas";

export async function loadFaceModels() {
  const { Canvas, Image, ImageData } = canvas;
  faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

  console.log("▶ Loading face-api models...");

  const MODEL_PATH = "./models";

  await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);

  console.log("✔ Face models loaded.");
}
