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
require("dotenv").config();
const { Client } = require("@notionhq/client");

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
const model_id = process.env.BASETEN_MODEL_ID;
// "https://model-YOUR_MODEL_ID.api.baseten.co/production/predict";
const basetenApiUrl = `https://model-${model_id}.api.baseten.co/production/predict`; // Replace YOUR_MODEL_ID with your actual model ID
const basetenApiKey = process.env.BASETEN_API_KEY; // Replace this with your actual Baseten API key

app.post("/call-baseten-model", async (req, res) => {
  console.log("calling baseTen");
  try {
    const data = {
      url: "https://storage.googleapis.com/cloudfunctions-b5b73.appspot.com/recordings/Gettysburg.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=firebase-adminsdk-188fi%40cloudfunctions-b5b73.iam.gserviceaccount.com%2F20240224%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20240224T120141Z&X-Goog-Expires=900&X-Goog-SignedHeaders=host&X-Goog-Signature=55155b5ee1c55d786f173747a0e45fbfcf18446ab3d295a87995b7a36ce217e2854b05a12b378b1c4989fc8c74272cc0c1fe54930e29173fe1fecdb82cdad7bca44284f0419736b52f0a2882670d7f1147b8e783b8beefd12d9b1c762ddc1be5dc3950b2437c2e6910feaa4e53ff14d2b9741c91eeda91f6ae44598a0e4ad248577ba85971b7ab95831d03f4be191b56f81d20055e21eebf5866a792f4465ecdc4e9fd698fa02b17747a283f60196a4488182f8d720c9fb9e33cb3c0a0151cc6d235c010b221b627722c527315254cb6f668095e44d2bb6795828294fcad7a1d725e8d219f5fb8ed848022b61f0661aa6af1455e059787548f5a50d8b4ee1c72",
      // url: "https://cdn.baseten.co/docs/production/Gettysburg.mp3",
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

// expected result

// {
//     "language": "english",
//     "segments": [
//         {
//             "start": 0,
//             "end": 11.52,
//             "text": " Four score and seven years ago our fathers brought forth upon this continent a new nation conceived in liberty and dedicated to the proposition that all men are created equal."
//         }
//     ],
//     "text": " Four score and seven years ago our fathers brought forth upon this continent a new nation conceived in liberty and dedicated to the proposition that all men are created equal."
// }

//generate summery using open ai

app.post("/generate-summary", async (req, res) => {
  const text =
    "Summarize the following text :\n\nFour score and seven years ago our fathers brought forth upon this continent a new nation conceived in liberty and dedicated to the proposition that all men are created equal.";
  //   console.log(req.body);
  //   const { text } = req.body; // Extracting text from the request body
  console.log("hereee>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
  //   console.log(text);
  if (!text) {
    return res.status(400).send({ error: "Please provide text to summarize." });
  }

  const openaiApiKey = process.env.OPENAI_API_KEY; // Replace this with your OpenAI API key

  try {
    console.log("APIKEY", openaiApiKey);
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        // model: "text-davinci-003", // or another model name as per your requirement
        model: "gpt-3.5-turbo", // or another model name as per your requirement
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant.",
          },
          {
            role: "user",
            content:
              "Summarize the following text  and list the main points as bullet points and the response should include both summery and main points :\n\nFour score and seven years ago our fathers brought forth upon this continent a new nation conceived in liberty and dedicated to the proposition that all men are created equal.",
          },
        ],
        temperature: 0.5,
        max_tokens: 150,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
      }
    );
    console.log(response.data.choices[0].content);
    // // Sending the summary and bullet points back to the client
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    res.status(500).send({ error: "Failed to generate summary" });
  }
});

const notion = new Client({
  auth: process.env.NOTION_TOKEN, // Your Internal Integration Token
});

const databaseId = process.env.NOTION_DATABASE_ID; // Make sure to set this in your .env file

// Function to add an item to the Notion database
async function addItem(details, Transcription) {
  // console.log("addItem<<<<<<<<<<<<<<<<<<", details);

  function extractData(data) {
    // Split the data into lines
    const lines = data
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);

    // Initialize variables to hold the extracted parts
    let title = "";
    let summary = "";
    const mainPoints = [];

    // Flags to know what part we're currently extracting
    let isSummary = false;
    let isMainPoints = false;

    lines.forEach((line) => {
      if (line.startsWith("**Main Title:**")) {
        title = line.replace("Main Title:", "").trim();
      } else if (line.startsWith("**Summary:**")) {
        isSummary = true;
        isMainPoints = false;
      } else if (line.startsWith("**Main Points:**")) {
        isSummary = false;
        isMainPoints = true;
      } else {
        if (isSummary) {
          summary += line + " ";
        } else if (isMainPoints) {
          mainPoints.push(line.replace("-", "").trim());
        }
      }
    });

    // Trim the summary to remove the trailing space
    summary = summary.trim();

    return { title, summary, mainPoints };
  }

  const extractedData = extractData(details);
  console.log("Title:", extractedData.title);
  console.log("Summary:", extractedData.summary);
  console.log("Main Points:", extractedData.mainPoints);
  try {
    console.log("create page");
    const newPageResponse = await notion.pages.create({
      parent: { database_id: databaseId },
      icon: {
        type: "emoji",
        emoji: "🤖", // Add your desired emoji here
      },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: extractedData.title,
              },
            },
          ],
        },
        // Add more properties as needed
        Tags: {
          // Assuming "Tags" is the name of your multi-select property
          multi_select: [
            { name: "VoiceToNotion" }, // Add your tag here
          ],
        },
      },
    });

    let children = [];

    // Add Transcription if available
    if (Transcription) {
      console.log("length", Transcription.length);
      console.log("transcription>>>>>>>>>>>>>>>>>>>>>>>", Transcription);
      const MAX_LENGTH = 2000;
      const transcription = Transcription;
      console.log("length", transcription.length);
      children.push({
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "Transcription" } }],
        },
      });

      // Split the transcription into chunks and create blocks for each
      for (let i = 0; i < transcription.length; i += MAX_LENGTH) {
        const chunk = transcription.substring(i, i + MAX_LENGTH);
        children.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: chunk } }],
          },
        });
      }
    }

    // Add Summary if available
    if (extractedData.summary) {
      const MAX_LENGTH = 2000;
      const summary = extractedData.summary;
      children.push({
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "Summary" } }],
        },
      });

      // Split the summary into chunks and create blocks for each
      for (let i = 0; i < summary.length; i += MAX_LENGTH) {
        const chunk = summary.substring(i, i + MAX_LENGTH);
        children.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: chunk } }],
          },
        });
      }
    }

    // Add Main Points if available
    if (extractedData.mainPoints && extractedData.mainPoints.length > 0) {
      console.log("in main points");
      children.push({
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "Main Points" } }],
        },
      });

      extractedData.mainPoints.forEach((point) => {
        const MAX_LENGTH = 2000;
        // Check if the point exceeds the maximum length and needs to be split
        if (point.length > MAX_LENGTH) {
          for (let i = 0; i < point.length; i += MAX_LENGTH) {
            const chunk = point.substring(i, i + MAX_LENGTH);
            // Add each chunk as a separate bulleted item
            children.push({
              object: "block",
              type: "bulleted_list_item",
              bulleted_list_item: {
                rich_text: [{ type: "text", text: { content: chunk } }],
              },
            });
          }
        } else {
          // If the point does not exceed the maximum length, add it as a single bulleted item
          children.push({
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: [{ type: "text", text: { content: point } }],
            },
          });
        }
      });
    }

    // Add Potential Action Items if available
    if (
      extractedData.potentialActionItems &&
      extractedData.potentialActionItems.length > 0
    ) {
      console.log("in potentialActionItems");
      children.push(
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [
              { type: "text", text: { content: "Potential Action Items" } },
            ],
          },
        },
        ...details.potentialActionItems.map((item) => ({
          object: "block",
          type: "to_do",
          to_do: {
            rich_text: [{ type: "text", text: { content: item } }],
            checked: false,
          },
        }))
      );
    }

    // Finally, append the blocks to the new page
    const result = await notion.blocks.children.append({
      block_id: newPageResponse.id,
      children: children,
    });

    console.log("Success! Entry added to notion");
    return result;
  } catch (error) {
    console.error(error);
  }
}

// API endpoint to add an item
app.post("/addItem", async (req, res) => {
  const details = req.body; // Use the entire body as details
  console.log(req.body);
  if (!details || !details.name) {
    // Adjust validation as necessary
    return res.status(400).send("Details with a 'name' property is required");
  } // Expecting { "text": "Your text here" } in the request body

  try {
    const response = await addItem(details);
    res.status(200).json({ message: "Success! Entry added.", id: response.id });
  } catch (error) {
    res.status(500).send("Failed to add item to Notion database");
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
const callBasetenModel = async (generatedUrl) => {
  const model_id = process.env.BASETEN_MODEL_ID;
  // "https://model-YOUR_MODEL_ID.api.baseten.co/production/predict";
  const basetenApiUrl = `https://model-${model_id}.api.baseten.co/production/predict`; // Replace YOUR_MODEL_ID with your actual model ID
  const basetenApiKey = process.env.BASETEN_API_KEY; // Replace this with your actual Baseten API key

  try {
    const response = await axios.post(
      `https://model-${model_id}.api.baseten.co/production/predict`, // Use your deployed function URL
      // { url: "https://cdn.baseten.co/docs/production/Gettysburg.mp3" },
      { url: generatedUrl },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Api-Key ${basetenApiKey}`,
          // Include any necessary headers
        },
      }
    );
    const result = response.data.text;
    console.log("Baseten response:", response.data.text);
    return result;
  } catch (error) {
    console.error("Error calling /call-baseten-model:", error);
  }
};
// exports.generateShareableLink = functions.storage
//   .object()
//   .onFinalize(async (object) => {
//     console.log("triggered");
//     console.log("Function triggered for file:", object.name);
//     // Check if the upload is in the "recordings" folder
//     if (object.name.startsWith("recordings/")) {
//       console.log('File is in "recordings/" folder:', object.name);
//       try {
//         // Generate a signed URL for the uploaded file
//         const options = {
//           version: "v4",
//           action: "read",
//           expires: Date.now() + 15 * 60 * 1000, // 15 minutes
//         };

//         const [url] = await storage
//           .bucket(bucketName)
//           .file(object.name)
//           .getSignedUrl(options);
//         console.log(`Generated signed URL: ${url}`);
//         // callBasetenModel(url);
//         // Optionally, perform additional actions like storing the URL in Firestore
//       } catch (error) {
//         console.error(`Failed to generate signed URL: ${error}`);
//       }
//     } else {
//       // This log is helpful to understand if the function is being triggered for files outside "recordings/"
//       console.log('File is not in "recordings/" folder:', object.name);
//     }
//   });

// function generatinog  summery using open ai
const generateSummary = async (textToSummarize) => {
  console.log("here we are generating summary of text");
  console.log(textToSummarize);
  // if (!textToSummarize) {
  //   throw new Error("Please provide text to summarize.");
  // }

  const openaiApiKey = process.env.OPENAI_API_KEY; // Ensure your OpenAI API key is set in your environment variables
  console.log("openAi Key", process.env.OPENAI_API_KEY);
  // try {
  //   const response = await axios.post(
  //     "https://api.openai.com/v1/chat/completions",
  //     {
  //       model: "gpt-3.5-turbo", // or another model name as per your requirement
  //       messages: [
  //         {
  //           role: "system",
  //           content: "You are a helpful assistant.",
  //         },
  //         {
  //           role: "user",
  //           content: `Summarize the following text and list the main points as bullet points and the response should include both summary and main points :\n\n${textToSummarize}`,
  //         },
  //       ],
  //       temperature: 0.5,
  //       max_tokens: 150,
  //       top_p: 1.0,
  //       frequency_penalty: 0.0,
  //       presence_penalty: 0.0,
  //     },
  //     {
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: `Bearer ${openaiApiKey}`,
  //       },
  //     }
  //   );
  //   console.log("here will get response");
  //   console.log(response.datat);
  //   return response.data.choices[0].content;
  // } catch (error) {
  //   console.error("Error calling OpenAI:", error);
  //   throw error; // Propagate the error
  // }

  try {
    console.log("APIKEY", openaiApiKey);
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        // model: "text-davinci-003", // or another model name as per your requirement
        model: "gpt-3.5-turbo", // or another model name as per your requirement
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant.",
          },
          {
            role: "user",
            content: `Summarize the following text give a main title, and list the main points as bullet points under main points heading  and the response should include both summery and main points :\n\n${textToSummarize}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 150,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
      }
    );

    console.log("response>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
    console.log(response.data.choices[0]);
    // // Sending the summary and bullet points back to the client
    return response.data.choices[0].message;
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    // res.status(500).send({ error: "Failed to generate summary" });
  }
};

exports.generatePublicLink = functions.storage
  .object()
  .onFinalize(async (object) => {
    console.log("Function triggered for file:", object.name);
    if (object.name.startsWith("recordings/")) {
      console.log('File is in "recordings/" folder:', object.name);
      try {
        const bucket = admin.storage().bucket(object.bucket);
        const file = bucket.file(object.name);

        // Make the file publicly accessible
        await file.makePublic();

        // Construct the public URL
        // For Firebase, the URL format is typically "https://storage.googleapis.com/[BUCKET_NAME]/[FILE_NAME]"
        // Ensure this format matches your bucket's URL format as it may vary especially if using a custom domain
        const publicUrl = `https://storage.googleapis.com/${
          object.bucket
        }/${encodeURIComponent(object.name)}`;
        console.log(`Public URL: ${publicUrl}`);
        // You can now use publicUrl for sharing or further processing
        //1  first transcripitin using whisper
        const Transcription = await callBasetenModel(publicUrl);

        // creatiing  data , like summey , main ponts using opnen ai
        // const Transcription = "fjbkdsbkjbsdk";
        // console.log("Transcription", Transcription);

        const summery = await generateSummary(Transcription);
        // const transcription = textToSummarize;
        console.log("summery>>>>>", summery.content);
        const details = summery.content;
        // now  saving this information into notion

        await addItem(details, Transcription);
        // Optionally, store the public URL in Firestore or another database for easy access
      } catch (error) {
        console.error(`Failed to make the file public: ${error}`);
      }
    } else {
      console.log('File is not in "recordings/" folder:', object.name);
    }
  });
