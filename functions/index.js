/* eslint-disable indent */
/* eslint-disable object-curly-spacing */
/* eslint-disable max-len */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

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

exports.app = functions.https.onRequest(app);

// Cloud Storage trigger function
const storage = new Storage();
const bucketName = "cloudfunctions-b5b73.appspot.com";
// Replace with your bucket name

exports.generateShareableLink = functions.storage
  .object()
  .onFinalize(async (object) => {
    console.log("triggered");
    // Check if the upload is in the "recordings" folder
    if (object.name.startsWith("recordings/")) {
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
    }
  });
