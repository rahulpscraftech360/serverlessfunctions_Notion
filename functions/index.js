/* eslint-disable indent */
/* eslint-disable object-curly-spacing */
/* eslint-disable max-len */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { Storage } = require("@google-cloud/storage"); // Add this for Storage access

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
const db = admin.firestore();

// eslint-disable-next-line object-curly-spacing
app.use(cors({ origin: true })); // Enable CORS for all domains
app.use(express.json()); // To parse JSON bodies

// Routes
app.get("/", (req, res) => {
  console.log("triggered,/");
  return res.send("Hello World!");
});

app.post("/", (req, res) => {
  try {
    console.log("success");
    return res.send("success");
  } catch (error) {
    console.log(error);
    return res.status(500).send("failed");
  }
});

// Corrected async POST request handler
app.post("/api/upload", async (req, res) => {
  try {
    console.log("uploading");
    // eslint-disable-next-line no-unused-vars
    const docRef = await db.collection("recordings").doc(`${Date.now()}`).set({
      id: Date.now(),
      data: req.body,
    });
    return res.status(200).send({ status: "success", msg: "recording saved" });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ status: "failed", msg: error.message });
  }
});

// "https://model-YOUR_MODEL_ID.api.baseten.co/production/predict";
const basetenApiUrl = "https://model-qjj0klq.api.baseten.co/production/predict"; // Replace YOUR_MODEL_ID with your actual model ID
const basetenApiKey = "SPm30BuL.WmiOvbe20jiB0aog3XYMkDX4rXN7b5gc"; // Replace this with your actual Baseten API key

app.post("/call-baseten-model", async (req, res) => {
  try {
    const data = {
      url: "https://cdn.baseten.co/docs/production/Gettysburg.mp3",
    };

    const response = await axios.post(basetenApiUrl, data, {
      headers: {
        Authorization: `Api-Key ${basetenApiKey}`,
      },
    });

    // Send the model's response back to the client
    res.json(response.data);
  } catch (error) {
    console.error("Error calling Baseten model:", error);
    res.status(500).send("Failed to call Baseten model");
  }
});
exports.app = functions.https.onRequest(app);

// Cloud Storage trigger function
const storage = new Storage({
  projectId: "your-project-id",
  keyFilename: "./serviceAccountKey.json",
});
const bucketName = "cloudfunctions-b5b73.appspot.com";
// Replace with your bucket name

exports.generateShareableLink = functions.storage
  .object()
  .onFinalize(async (object) => {
    console.log("triggered");
    console.log("Function triggered for file:", object.name);
    // Check if the upload is in the "recordings" folder
    if (object.name.startsWith("recordings/")) {
      console.log('File is in "recordings/" folder:', object.name);
      try {
        // Generate a signed URL for the uploaded file
        const options = {
          version: "v4",
          action: "read",
          expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        };

        const [url] = await storage
          .bucket(bucketName)
          .file(object.name)
          .getSignedUrl(options);
        console.log(`Generated signed URL: ${url}`);
        // Optionally, perform additional actions like storing the URL in Firestore
      } catch (error) {
        console.error(`Failed to generate signed URL: ${error}`);
      }
    } else {
      // This log is helpful to understand if the function is being triggered for files outside "recordings/"
      console.log('File is not in "recordings/" folder:', object.name);
    }
  });
exports.generateThumbnail = functions.storage
  .object()
  .onFinalize(async (object) => {
    // generateThumbnail code...
    console.log("ghafjfdsg");
  });
